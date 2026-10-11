/* Loop frontend: vanilla JS, no build step.
   One state object -> one render() -> the current hash route's DOM.
   Every value interpolated into html`` is escaped unless it is already-built markup. */
'use strict';

/* ---------- constants ---------- */

const POLL_MS = 1500;
const SLOW_MS = 8000;
const UPLOAD_TIMEOUT_MS = 60000;
const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.85;
const CONDITIONS = ['good', 'fair', 'worn'];
const CATEGORIES = ['furniture', 'lighting', 'kitchen', 'textbooks', 'electronics', 'clothing', 'bedding', 'sports', 'other'];
const COND_LABEL = { good: 'Good condition', fair: 'Fair condition', worn: 'Worn' };
const STATUS_LABEL = { available: 'Available', offered: 'Offered', reserved: 'Reserved', collected: 'Collected', withdrawn: 'Taken back' };
const REQUEST_LABEL = { open: 'Open need', matched: 'Matched', fulfilled: 'Fulfilled', closed: 'Closed' };
const STEP_INDEX = { available: 0, offered: 0, reserved: 1, collected: 2 };
const OFFLINE = "Can't reach Loop. Check your connection and try again.";
const AI_ERRORS = {
  rate_limited: 'Gemini is busy right now (rate limit). Try again in a minute or fill this in yourself.',
  timeout: 'Gemini took too long. Try again or fill this in yourself.',
};
const AI_ERROR_OTHER = "Gemini couldn't look at this photo right now. Fill this in yourself.";
const NOT_IDENTIFIED = "Gemini couldn't pick out one clear thing to post. Try a closer photo of a single item, or fill this in yourself.";
const DONE_TEXT = {
  decline: "You said no thanks. It's back on the board.",
  release: "Reservation cancelled. It's back on the board.",
  withdraw: "You took it back. It's off the board.",
};
/* Phase 2: handoff threads and pile photos. */
const OPEN_THREAD = ['planning', 'set', 'meeting'];
const THREAD_CHIP = { planning: ['Planning', 'open'], set: ['Set', 'available'], meeting: ['Meeting now', 'reserved'], done: ['Done', 'collected'], cancelled: ['Cancelled', 'withdrawn'] };
const THREAD_ACTIONS = ['accept', 'propose', 'arrived', 'cancel', 'enter_code']; // enter_code never goes to the server
const PRIMARY_ACTIONS = ['accept', 'arrived', 'enter_code'];
const NOT_SET = 'Not set yet';
const MAX_PILE = 6;
const NEED_LIMIT = 4; // need cards on the board before "Show all (N)"
const CROP_PAD = 0.06; // padding around each box, as a share of the box
const MIN_CROP = 256; // px, per side of the crop in the original photo
const TOAST_MS = 5000;
const PILE_AI_ERRORS = {
  rate_limited: 'Gemini is busy right now (rate limit). Try again in a minute, or list it as one thing.',
  timeout: 'Gemini took too long. Try again, or list it as one thing.',
};
const PILE_AI_ERROR_OTHER = "Gemini couldn't sort this photo right now. List it as one thing instead.";
const PILE_NOT_FOUND = "Gemini couldn't pick out separate things to post here. List it as one thing, or try a photo with the things spread out a little.";

/* ---------- markup: escape by default ---------- */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
class Markup {
  constructor(text) { this.text = text; }
  toString() { return this.text; }
}
const raw = (text) => new Markup(text);
const piece = (v) => {
  if (v instanceof Markup) return v.text;
  if (Array.isArray(v)) return v.map(piece).join('');
  return v == null || v === false ? '' : esc(v);
};
const html = (strings, ...values) => new Markup(strings.reduce((out, s, i) => out + piece(values[i - 1]) + s));
console.assert(String(html`<b title="${'"x'}">${'<i>'}</b>`) === '<b title="&quot;x">&lt;i&gt;</b>', 'html`` must escape');

const ICONS = {
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  camera: '<path d="M4 8.5C4 7.7 4.7 7 5.5 7H8l1.6-2h4.8L16 7h2.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5z"/><circle cx="12" cy="12.8" r="3.4"/>',
  ask: '<path d="M5 5h14c.6 0 1 .4 1 1v9c0 .6-.4 1-1 1h-8l-4 3v-3H5c-.6 0-1-.4-1-1V6c0-.6.4-1 1-1z"/><path d="M12 8v5M9.5 10.5h5"/>',
  sparkle: '<path fill="currentColor" stroke="none" d="M11 4c.6 4.3 3.7 7.4 8 8-4.3.6-7.4 3.7-8 8-.6-4.3-3.7-7.4-8-8 4.3-.6 7.4-3.7 8-8z"/><path fill="currentColor" stroke="none" d="M19 2l.7 2.3L22 5l-2.3.7L19 8l-.7-2.3L16 5l2.3-.7z"/>',
  pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  retry: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
};
const icon = (name, cls = 'i') => raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`);

/* ---------- state ---------- */

const $ = (selector) => document.querySelector(selector);
const view = $('#view');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const freshUi = () => ({
  notice: null, // { text, tone, where } for the current view; where = 'thread' puts it in the conversation
  reserveOpen: false,
  reserve: { place: '', date: '', hour: '', time: '' }, // all optional: people can settle it in the thread
  phone: { phone: '' }, // the texts card's number field
  propose: null, // { threadId, place, time } while "Suggest another time" is open
  composer: {}, // thread id -> unsent message
  code: '',
  codeError: '',
  codeAlert: false, // a fresh wrong code: focus + shake once
  revealCode: '', // item id whose pickup code scales in once
  ask: { title: '', details: '' },
  askResult: null,
  needOpen: new Set(), // board: request ids whose card is expanded inline (there is no request page)
  needsAll: false, // board: every need card, not just the newest NEED_LIMIT
});
const freshGive = () => ({
  phase: 'pick', // pick | uploading | drafting | review | failed
  attempt: 0,
  previewUrl: '',
  imageBase64: '',
  photoId: '',
  draft: null,
  aiError: null,
  error: '',
  canRetry: false,
  slow: false,
  slowTimer: 0,
  checked: false,
  form: { title: '', description: '', condition: '', category: 'other' },
});
const freshPile = () => ({
  phase: 'pick', // pick | sorting | review | failed
  attempt: 0,
  file: null, // the original photo: crops come from it, not from the 1024 px upload
  previewUrl: '',
  imageBase64: '',
  aiError: null,
  error: '',
  canRetry: false,
  slow: false,
  slowTimer: 0,
  items: [],
});

const state = {
  db: null,
  online: true,
  mock: false,
  health: { imessage: false, linkedPhones: [], lineNumber: null },
  texts: null, // this tab's {linked, code, lineNumber} from /api/people/:id/texts (the footer line)
  me: loadMe(),
  route: parseRoute(),
  busy: '',
  pendingRender: false,
  focusTarget: '',
  ui: freshUi(),
  give: freshGive(),
  giveMode: 'one', // one | pile
  pile: freshPile(),
  seenCollected: new Set(),
};

function loadMe() {
  try { return sessionStorage.getItem('loop.person'); } catch { return null; }
}
function saveMe(id) {
  try {
    if (id) sessionStorage.setItem('loop.person', id);
    else sessionStorage.removeItem('loop.person');
  } catch { /* private mode: the id stays in memory */ }
}

// SPEC5: no names anywhere. A tab is an anonymous person, known only by an opaque id the page never shows.
const hasMe = () => Boolean(state.me && state.db?.people.some((p) => p.id === state.me));
const requestOf = (id) => state.db?.requests.find((r) => r.id === id) ?? null;
const itemOf = (id) => state.db?.items.find((i) => i.id === id) ?? null;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const newest = (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
const vtName = (id) => `item-${String(id).replace(/[^\w-]/g, '')}`;
const spaced = (code) => String(code).split('').join(' ');
const busyText = (kind, idle, working) => (state.busy === kind ? working : idle);
const isManual = (g) => !g.draft || Boolean(g.aiError) || g.draft.identified === false;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const clockFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const stampFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function formatTime(format, iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return format.format(date).replace(/\s?([AP])M\b/, (_, p) => ` ${p.toLowerCase()}m`);
}
function timeAgo(iso) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return '';
  if (seconds > -60) return 'just now';
  if (seconds > -3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (seconds > -86400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86400), 'day');
}

/* Quick picks carry their real moment, so the server can time the reminder. Campus is in New York. */
const NEW_YORK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
function nyWall(ms) { // New York's wall clock at instant ms, written as if it were UTC
  const p = Object.fromEntries(NEW_YORK.formatToParts(ms).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}
/* The plan's time comes from a date-time picker; this label is what both people, Loop and the iMessage line read. */
const DAY_MS = 86_400_000;
const NY_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const NY_DATE = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
function dayLabel(ms, now = Date.now()) {
  const days = Math.floor(nyWall(ms) / DAY_MS) - Math.floor(nyWall(now) / DAY_MS);
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : NY_DATE.format(ms).replace(',', ''); // "Tue Oct 13"
}
function timeLabel(ms, now = Date.now()) {
  const day = dayLabel(ms, now);
  const clock = NY_CLOCK.format(ms).toLowerCase().replace(/[\u202f\u00a0]/g, ' ');
  return `${day}${day === 'Today' || day === 'Tomorrow' ? ' ' : ', '}${clock}`;
}
console.assert(timeLabel(Date.parse('2026-10-10T21:00:00Z'), Date.parse('2026-10-10T17:37:00Z')) === 'Today 5:00 pm', 'time label: today');
console.assert(timeLabel(Date.parse('2026-10-11T16:00:00Z'), Date.parse('2026-10-10T17:37:00Z')) === 'Tomorrow 12:00 pm', 'time label: tomorrow');
console.assert(timeLabel(Date.parse('2026-10-13T16:30:00Z'), Date.parse('2026-10-10T17:37:00Z')) === 'Tue Oct 13, 12:30 pm', 'time label: later');
// Today's date as the date picker writes it, in the browser's own zone (the pickers give local wall time).
function localDate(ms) {
  const d = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/* Two announcements in one burst (pickup code, then Loop's message) are read together, not the last one only. */
let announcing = '';
function announce(text) {
  const live = $('#live');
  if (!announcing) {
    live.textContent = '';
    setTimeout(() => {
      live.textContent = announcing;
      announcing = '';
    }, 40);
  }
  announcing = announcing ? `${announcing} ${text}` : text;
}

/* ---------- server ---------- */

class ApiError extends Error {
  constructor(message, status = 0, code = 'network') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const httpError = (status, data) => new ApiError(data?.message || 'Something went wrong. Try again.', status, data?.error || 'http_error');

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      cache: 'no-store',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(OFFLINE);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw httpError(res.status, data);
  return data;
}

/* XHR, not fetch, so "uploading" and "Gemini is looking" are two real phases. */
function postDraft(body, onUploaded) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/items/draft');
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.addEventListener('load', onUploaded);
    xhr.addEventListener('load', () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else reject(httpError(xhr.status, data));
    });
    xhr.addEventListener('error', () => reject(new ApiError(OFFLINE)));
    xhr.addEventListener('timeout', () => reject(new ApiError('Loop took too long to answer. Try again.', 0, 'timeout')));
    xhr.send(JSON.stringify(body));
  });
}

let fetchSeq = 0;
let appliedSeq = 0;
async function refresh() {
  const seq = ++fetchSeq;
  try {
    const db = await api('GET', '/api/state');
    if (!Array.isArray(db?.items)) throw new ApiError(OFFLINE);
    setOnline(true);
    if (seq < appliedSeq) return false; // an older response arrived late
    appliedSeq = seq;
    const first = !state.db;
    const changed = first || db.version !== state.db.version;
    state.db = db;
    if (first) markAllHeard();
    return changed;
  } catch {
    setOnline(false);
    return false;
  }
}
async function pollLoop() {
  const changed = await refresh();
  if (changed) requestRender();
  ensureMe();
  if (changed || !state.texts) refreshTexts();
  setTimeout(pollLoop, POLL_MS);
}

/* Loop's texts for this tab: the code to text, or "linked". Asked once the tab has an id, then again on every state
   change until it is linked (the link itself bumps the state version). */
let textsFor = null; // the person id state.texts belongs to
async function refreshTexts() {
  if (!hasMe() || !state.health.lineNumber || (state.texts?.linked && textsFor === state.me)) return;
  const me = state.me;
  const texts = await api('GET', `/api/people/${encodeURIComponent(me)}/texts`).catch(() => null);
  if (!texts || state.me !== me) return;
  const changed = texts.linked !== state.texts?.linked || texts.code !== state.texts?.code;
  state.texts = texts;
  textsFor = me;
  if (changed) requestRender();
}

/* SPEC5: a tab with no id (first visit, after a reset, or a server with a fresh db) becomes a new anonymous person.
   One join at a time; offline retries on the next poll. */
let joining = false;
let joinError = ''; // a refusal to join, e.g. 429 "This demo is full. Reset it to make room."
async function ensureMe() {
  if (!state.db || !state.online || joining || hasMe()) return;
  joining = true;
  try {
    const res = await api('POST', '/api/people').catch((err) => {
      if (err.status === 404) return null; // a backend without SPEC5's route yet
      throw err;
    });
    // ponytail: on that 404 the tab silently acts as the first seed person; drop once every backend has the route
    const id = res?.id ?? state.db.people[0]?.id;
    if (!id) return;
    joinError = '';
    state.me = id;
    saveMe(id);
    await refresh();
    render();
  } catch (err) {
    if (!err.status || err.message === joinError) return; // offline: setOnline already shows it
    joinError = err.message; // shown instead of "Loading Loop…"; the next poll tries again
    render();
    announce(err.message);
  } finally {
    joining = false;
  }
}
function setOnline(online) {
  if (state.online === online) return;
  state.online = online;
  { const net = $('#net'); if (net) net.hidden = true; } // quiet: no offline banner
  if (online) announce('Back online.');
  if (!state.db) render();
}
function setMock(on) {
  if (!on || state.mock) return;
  state.mock = true;
  { const mock = $('#mock'); if (mock) mock.hidden = true; } // never show a demo-mode banner
}

/* ---------- render ---------- */

function isTyping() {
  const el = document.activeElement;
  return Boolean(el && view.contains(el) && el.matches('input:not([type=file]):not([type=radio]):not([type=checkbox]), textarea, select'));
}
/* A render between pointerdown and click replaces the button under the finger and the click is lost,
   so renders wait for the press to end. */
let pressing = false;
function requestRender() {
  if (!isTyping() && !pressing) return render();
  if (pressing || !document.activeElement.matches('.composer-input')) {
    state.pendingRender = true; // a phase-1 field (or a press): render once it's done
    return;
  }
  if (!patchThread()) render(); // the thread closed or was replaced: the composer goes, so redraw everything
}
function flushRender() { // the press or the field is done: render now, patch the thread, or keep waiting
  if (!state.pendingRender) return;
  state.pendingRender = false;
  requestRender();
}
addEventListener('pointerdown', () => { pressing = true; }, true);
for (const type of ['pointerup', 'pointercancel']) {
  // ponytail: 60 ms covers the click a touch screen fires after pointerup; a slower click could still race a poll
  addEventListener(type, () => setTimeout(() => { pressing = false; flushRender(); }, 60), true);
}

function render() {
  state.pendingRender = false;
  const active = view.contains(document.activeElement) ? document.activeElement : null;
  const focusId = active?.id ?? '';
  const caret = active?.matches('textarea, input[type=text], input:not([type])') ? [active.selectionStart, active.selectionEnd] : null;
  view.innerHTML = String(currentView());
  mountFigures(); // before the focus comes back: a kept figure (the riffle is focusable) is back in place by then
  document.title = pageTitle();
  const target = state.focusTarget ? view.querySelector(state.focusTarget) : focusId && document.getElementById(focusId);
  state.focusTarget = '';
  if (target) {
    if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    if (caret && target.id === focusId && target.setSelectionRange) target.setSelectionRange(...caret);
  }
  afterRender();
}

/* Hairline line figures (SPEC6), vendored in /vendor/ and imported the first time a page has a .fig slot. A slot
   names its figure in data-fig. A render that draws the same kind again keeps the running figure (moved into the new
   slot, so a poll doesn't restart it); a figure whose slot is gone is destroyed. If the module can't load, the page
   renders the same without figures. */
const FIGURES = {
  hero: ['riffle', { intensity: 0.45, label: 'A tray of posts standing up', play: true }],
  phone: ['phone', { intensity: 0.4, label: 'A phone opening in layers' }],
  basket: ['basket', { intensity: 0.4, label: 'An empty basket' }],
};
let hairline = null; // the module promise, once a page needs a figure
const figures = new Map(); // slot element -> running figure { update, destroy }
function mountFigures() {
  for (const slot of view.querySelectorAll('.fig[data-fig]')) {
    const kept = [...figures.keys()].find((el) => !el.isConnected && el.dataset.fig === slot.dataset.fig);
    if (kept) slot.replaceWith(kept);
  }
  for (const [el, fig] of figures) {
    if (el.isConnected) continue;
    fig.destroy();
    figures.delete(el);
  }
  const fresh = [...view.querySelectorAll('.fig[data-fig]')].filter((el) => !figures.has(el));
  if (!fresh.length) return;
  hairline ??= import('/vendor/hairline.js').catch(() => {
    document.documentElement.classList.add('no-figs'); // the empty slots fold away
    return null;
  });
  hairline.then((lib) => {
    for (const el of fresh) {
      const [name, options] = FIGURES[el.dataset.fig] ?? [];
      if (!lib?.[name] || !el.isConnected || figures.has(el)) continue; // a render replaced the slot while loading
      try {
        figures.set(el, lib[name](el, { ...options, theme: 'light', play: Boolean(options.play) && !reducedMotion.matches }));
      } catch { /* a figure that can't draw leaves an empty box */ }
    }
  });
}

/* While someone types a message, replies still arrive: the conversation and the action card are redrawn
   around the composer, so the text field, its caret and the phone keyboard stay put. While the thread stays
   open the item stays reserved, so nothing else on the page can change. false = needs a full render. */
function patchThread() {
  const box = $('#thread-live');
  const item = state.route.name === 'item' ? itemOf(state.route.id) : null;
  const thread = item && threadOf(item);
  if (!box || !thread || thread.id !== box.dataset.thread || !isOpenThread(thread)) return false;
  box.innerHTML = String(threadLive(thread));
  const action = $('.action');
  if (action && !action.contains(document.activeElement)) action.innerHTML = String(actionArea(item));
  return true;
}

function afterRender() {
  state.ui.revealCode = '';
  if (!state.ui.codeAlert) return;
  state.ui.codeAlert = false;
  const input = $('#code-input');
  if (!input) return;
  input.focus();
  input.select();
  if (reducedMotion.matches) return;
  input.classList.add('shake');
  input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
}

function parseRoute() {
  const path = location.hash.slice(1) || '/';
  const item = path.match(/^\/item\/([\w-]+)\/?$/);
  if (item) return { name: 'item', id: item[1] };
  if (path === '/give') return { name: 'give' };
  if (path === '/ask') return { name: 'ask' };
  return { name: 'board' };
}

function onRouteChange() {
  state.route = parseRoute();
  state.ui = freshUi();
  state.focusTarget = 'h1';
  markAllHeard(); // a page you open reads as a page; only messages that arrive while you're on it are announced
  let done = false;
  const update = () => {
    if (done) return;
    done = true;
    render();
    scrollTo(0, 0);
  };
  if (reducedMotion.matches) return update();
  if (document.startViewTransition) {
    // A skipped transition (fast clicks, hidden tab) rejects `ready`; the DOM update still runs, so that's fine.
    document.startViewTransition(update).ready.catch(() => {});
    setTimeout(update, 400); // ponytail: a tab that never paints never runs the transition callback; render anyway
    return;
  }
  update();
  view.classList.remove('route-enter');
  void view.offsetWidth; // restart the 180 ms fade
  view.classList.add('route-enter');
}

function pageTitle() {
  if (!hasMe()) return 'Loop';
  const { name, id } = state.route;
  if (name === 'give') return 'Post something · Loop';
  if (name === 'ask') return 'Ask for something · Loop';
  if (name === 'item') return `${itemOf(id)?.title ?? 'Not found'} · Loop`;
  return 'Board · Loop';
}

function currentView() {
  if (!state.db) return state.online ? loadingView() : offlineView();
  if (!hasMe()) return joinError ? joinErrorView() : loadingView(); // ensureMe() is joining
  const { name, id } = state.route;
  if (name === 'give') return giveView();
  if (name === 'ask') return askView();
  if (name === 'item') return itemView(id);
  return boardView();
}

/* ---------- shared pieces ---------- */

const condChip = (c) => html`<span class="chip">${COND_LABEL[c] ?? 'Condition not set'}</span>`;
const statusChip = (item) => html`<span class="chip dot chip-${item.status}">${STATUS_LABEL[item.status] ?? item.status}</span>`;
// "Pass it on again": LAP 2 from the second time round (items without `lap` are lap 1, no sticker).
const lapChip = (item) => ((item.lap ?? 1) >= 2 ? html`<span class="chip chip-lap">Lap ${item.lap}</span>` : '');
// Optional price in whole dollars (Loop never handles money, it only shows it): every item gets a sticker, FREE without one.
const priceChip = (item) => html`<span class="chip chip-price">${item.price ? `$${item.price}` : 'Free'}</span>`;
const atPickup = (item) => (item.price ? `$${item.price} at pickup · cash or Venmo` : '');
const priceValue = (p) => (p == null || String(p).trim() === '' ? null : Number(p)); // "$" left empty = free; the server checks 1-500
const requestChip = (r) => html`<span class="chip dot chip-${r.status}">${REQUEST_LABEL[r.status] ?? r.status}</span>`;
const yoursChip = (mine) => (mine ? html`<span class="chip chip-yours">yours</span>` : ''); // SPEC5: the only sign of "mine"
const noticeBlock = (where = 'action') => {
  const n = state.ui.notice;
  return n && (n.where ?? 'action') === where ? html`<p class="notice ${n.tone}">${n.text}</p>` : '';
};
const backLink = () => html`<a class="back" href="#/">${icon('back')} Board</a>`;

/* Loop's shared iMessage line (SPEC4 §A) from /api/health: one mono line in the board footer and one small line on
   the Post page (v4.1); hidden while unknown. */
const lineLabel = (e164) => e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
const smsHref = (body = '') => `sms:${state.health.lineNumber}${body ? `&body=${encodeURIComponent(body)}` : ''}`; // &body: Messages on Apple devices
/* The board footer: how to get Loop's texts on your phone. Linking is done by texting the tab's 4-digit code to the
   line, so no phone number is ever typed into the site; the server keeps the number and never shows it. */
function textsLine() {
  const t = state.texts;
  const line = (body) => html`<a class="line-link" href="${smsHref(body)}">${lineLabel(state.health.lineNumber)}</a>`;
  if (!t) return html`Text Loop · ${line('')}`;
  if (t.linked) return html`Loop texts you on your phone · reply STOP to unlink`;
  return html`Get Loop's texts: text <b class="link-code">${t.code}</b> to ${line(t.code)} · your number stays private`;
}
const textIn = () => (state.health.lineNumber
  ? html`<div class="text-in-row"><div class="fig fig-phone" data-fig="phone"></div><p class="text-in">No app? Text a photo to Loop at <a href="${smsHref()}">${lineLabel(state.health.lineNumber)}</a></p></div>`
  : '');
// Board empty states: one muted basket per page (the needs one only shows it when the inventory has things).
const basketFig = () => html`<div class="fig fig-basket" data-fig="basket"></div>`;

/* ---------- views: loading ---------- */

const loadingView = () => html`<div class="glass card loading"><span class="spinner" aria-hidden="true"></span><h1>Loading Loop…</h1></div>`;
const joinErrorView = () => html`<section class="glass card stack-sm"><h1>Can't join Loop right now</h1><p class="muted">${joinError}</p>
  <div class="actions"><button class="btn btn-secondary" id="reset" data-action="reset">${busyText('reset', 'Reset demo', 'Resetting…')}</button></div></section>`;
const offlineView = () => html`<section class="glass card stack-sm"><h1>Can't reach Loop</h1><p class="muted">Retrying every few seconds. If this keeps up, check that the Loop server is running.</p></section>`;

/* ---------- views: board ---------- */

function bannerFor(item) {
  if (item.status === 'offered' && requestOf(item.offeredToRequestId)?.personId === state.me) return 'Someone offered you this';
  if (item.status !== 'reserved' || !item.reservation) return '';
  if (item.reservation.personId === state.me) return 'You reserved this · your pickup code is inside';
  if (item.ownerId === state.me) return 'Someone reserved this · confirm at pickup';
  return '';
}

/* SPEC5 framing, "a platform for people to post stuff": the stuff leads (photos), the asks follow. "For you" stays on
   top because it only appears when an offer or a pickup needs this tab. */
function boardView() {
  const { requests, items } = state.db;
  const needs = requests.filter((r) => r.status === 'open' || r.status === 'matched').sort(newest);
  const live = items.filter((i) => i.status !== 'withdrawn' && i.status !== 'collected').sort(newest);
  const forYou = live.filter((i) => bannerFor(i));
  const grabs = live.filter((i) => !bannerFor(i));
  const allNeeds = state.ui.needsAll;
  return html`<div class="stack board">
    <section class="hero">
      <h1>Post what you don't need.</h1>
      <div class="fig fig-hero" id="fig-hero" data-fig="hero" aria-hidden="false"></div>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#/give">${icon('camera')} Post something</a>
        <a class="quiet-link" href="#/ask">Ask for something</a>
      </div>
    </section>
    ${forYou.length ? html`<section class="stack-sm board-you" aria-labelledby="h-you"><h2 id="h-you" class="section-title">For you</h2><ul class="list">${forYou.map(forYouCard)}</ul></section>` : ''}
    <section class="stack-sm board-inv" aria-labelledby="h-grabs">
      <h2 id="h-grabs" class="section-title">Inventory</h2>
      ${grabs.length ? html`<ul class="grid">${grabs.map(itemCard)}</ul>` : html`<div class="empty glass">${basketFig()}<p>Nothing up for grabs yet. Got something you don't use? Post it.</p></div>`}
    </section>
    <section class="stack-sm board-needs" aria-labelledby="h-needs">
      <h2 id="h-needs" class="section-title">People need</h2>
      ${needs.length ? html`<ul class="list" id="needs">${(allNeeds ? needs : needs.slice(0, NEED_LIMIT)).map(needCard)}</ul>` : html`<div class="empty glass">${grabs.length ? basketFig() : ''}<p>No open requests right now.</p></div>`}
      ${needs.length > NEED_LIMIT ? html`<button class="btn btn-ghost btn-small more" id="needs-all" data-action="toggle-needs" aria-expanded="${String(allNeeds)}" aria-controls="needs">${allNeeds ? 'Show fewer' : `Show all (${needs.length})`}</button>` : ''}
    </section>
    <footer class="foot">
      ${state.health.lineNumber ? html`<span class="foot-line">${textsLine()}</span>` : ''}
    </footer>
  </div>`;
}

/* One compact row: thumbnail, title, why it's here (the old banner line), chevron. */
const forYouCard = (item) => html`<li><a class="foryou glass" href="#/item/${item.id}">
  <img src="${item.photo}" alt="" style="view-transition-name:${vtName(item.id)}">
  <span class="foryou-text"><span class="foryou-title">${item.title}</span><span class="small muted">${[bannerFor(item), atPickup(item)].filter(Boolean).join(' · ')}</span></span>
  ${icon('next')}
</a></li>`;

// v4.1: "yours" on the board is a small ink dot before the title (the item page keeps the chip). Not shape alone:
// screen readers hear "yours".
const mineDot = (mine) => (mine ? html`<span class="mine-dot"><span class="sr-only">yours: </span></span>` : '');

const itemCard = (item) => html`<li><a class="item-card glass" href="#/item/${item.id}">
  <img class="thumb" src="${item.photo}" alt="" loading="lazy" style="view-transition-name:${vtName(item.id)}">
  <div class="item-body"><h3 class="item-title">${mineDot(item.ownerId === state.me)}${item.title}</h3><div class="chips">${statusChip(item)}${priceChip(item)}${lapChip(item)}</div></div>
</a></li>`;

/* Title and "Asked … ago"; a chip only once it's matched. Details and Remove open inline on a tap (no request page). */
function needCard(r) {
  const mine = r.personId === state.me;
  const removable = mine && r.status === 'open';
  const open = state.ui.needOpen.has(r.id);
  const face = html`<span class="need-title">${mineDot(mine)}${r.title}</span>
    <span class="need-meta">Asked <time datetime="${r.createdAt}">${timeAgo(r.createdAt)}</time>${r.status === 'open' ? '' : html` ${requestChip(r)}`}</span>`;
  if (!r.details && !removable) return html`<li class="need glass"><h3 class="need-face">${face}</h3></li>`;
  return html`<li class="need glass ${open ? 'is-open' : ''}">
    <h3><button class="need-face" id="need-${r.id}" data-action="toggle-need" data-id="${r.id}" aria-expanded="${String(open)}" aria-controls="need-more-${r.id}">${face}${icon('chevron')}</button></h3>
    <div class="need-more" id="need-more-${r.id}" ${open ? '' : raw('hidden')}>
      ${r.details ? html`<p class="need-details">${r.details}</p>` : ''}
      ${removable ? html`<button class="btn btn-ghost btn-small" id="remove-${r.id}" data-action="remove-request" data-id="${r.id}">Remove<span class="sr-only"> request: ${r.title}</span></button>` : ''}
    </div>
  </li>`;
}

/* ---------- views: item detail ---------- */

const notFoundView = () => html`<div class="stack">${backLink()}<section class="glass card stack-sm">
  <h1>We can't find that item</h1>
  <p class="muted">It may have been removed, or the demo was reset.</p>
  <div class="actions"><a class="btn btn-primary" href="#/">Back to the board</a></div>
</section></div>`;

function itemView(id) {
  const item = itemOf(id);
  if (!item) return notFoundView();
  const mine = item.ownerId === state.me;
  return html`<div class="stack item-page">
    ${backLink()}
    <figure class="photo-frame glass detail-photo"><img src="${item.photo}" alt="Photo of ${item.title}" style="view-transition-name:${vtName(item.id)}"></figure>
    <section class="glass card detail-head">
      <div class="chips">${condChip(item.condition)}${statusChip(item)}${priceChip(item)}${lapChip(item)}${yoursChip(mine)}</div>
      <h1>${item.title}</h1>
      <p class="from">Posted <time datetime="${item.createdAt}">${timeAgo(item.createdAt)}</time></p>
      ${item.description ? html`<p class="desc">${item.description}</p>` : ''}
      ${item.aiDraft ? html`<p class="provenance">${icon('sparkle')} Gemini drafted this listing. ${mine ? 'You' : 'The giver'} checked it.</p>` : ''}
    </section>
    ${item.status === 'withdrawn' ? '' : timeline(item)}
    <section class="glass card action" aria-labelledby="action-title">${actionArea(item)}</section>
    ${textsCard(item)}
    ${threadSection(item)}
  </div>`;
}

/* Right after posting (the giver) or reserving (the taker): a card on how Loop reaches them by text, until linked.
   Linking is one text of the tab's code; the "Open Messages" button pre-fills it on a phone or a Mac. */
function textsCard(item) {
  const t = state.texts;
  const mine = item.ownerId === state.me;
  const taker = item.reservation?.personId === state.me;
  if (!t || t.linked || !state.health.lineNumber || !(mine || taker)) return '';
  return html`<section class="glass card texts-card" aria-labelledby="texts-title">
    <h2 id="texts-title">${mine ? 'Get a text when someone reserves this' : "Get Loop's messages on your phone"}</h2>
    <p class="muted">${mine
      ? "Loop will message you here when someone wants it. If you'd rather not keep this tab open, give Loop your number and it texts you instead."
      : "The pickup plan and the giver's replies can reach you by text."}</p>
    <form class="stack-sm" data-form="phone" novalidate>
      <label class="sr-only" for="phone-input">Your mobile number</label>
      <div class="phone-row">
        <input id="phone-input" class="input" type="tel" name="phone" data-scope="phone" inputmode="tel" autocomplete="tel" placeholder="Your mobile number" value="${state.ui.phone.phone}">
        <button class="btn btn-primary" type="submit" id="phone-submit">${busyText('phone', 'Text me', 'Linking…')}</button>
      </div>
      ${noticeBlock('texts')}
    </form>
    <p class="small muted">Or text <b class="link-code">${t.code}</b> to <a class="line-link" href="${smsHref(t.code)}">${lineLabel(state.health.lineNumber)}</a>. Your number stays private. Reply STOP to unlink.</p>
  </section>`;
}

/* The texts card's number: Loop lists it with Photon and texts a hello; the card then goes away. */
async function submitPhone() {
  const phone = state.ui.phone.phone.trim();
  if (!phone) {
    state.ui.notice = { text: 'Enter your mobile number.', tone: 'error', where: 'texts' };
    render();
    announce(state.ui.notice.text);
    return;
  }
  await mutate('phone', () => api('POST', `/api/people/${encodeURIComponent(state.me)}/phone`, { phone }), (res) => {
    state.texts = { ...(state.texts ?? {}), linked: true };
    textsFor = state.me;
    state.ui.phone.phone = '';
    showToast(res.sent ? 'Linked. Loop just texted you.' : 'Linked.');
    announce('Linked.');
  });
}

function timeline(item) {
  const current = STEP_INDEX[item.status] ?? 0;
  const steps = [['Posted', item.createdAt], ['Reserved', item.reservation?.at], ['Collected', item.collectedAt]];
  return html`<ol class="timeline glass" aria-label="Progress">${steps.map(([label, at], i) => {
    const done = i < current || (i === 2 && current === 2);
    const cls = [
      i <= current ? 'reached' : '',
      done ? 'done' : '',
      i === current ? 'current' : '',
      i === current && item.status === 'reserved' ? 'is-reserved' : '',
      i === 2 && current === 2 ? 'final' : '',
    ].join(' ');
    return html`<li class="${cls}" ${i === current ? raw('aria-current="step"') : ''}>
      <span class="step-dot">${done ? icon('check') : i + 1}</span>
      <span class="step-label">${label}<span class="sr-only">${done ? ', done' : i > current ? ', not yet' : ''}</span></span>
      <span class="step-time">${i <= current && at ? formatTime(clockFormat, at) : ' '}</span>
    </li>`;
  })}</ol>`;
}

function actionArea(item) {
  const mine = item.ownerId === state.me;
  const res = item.reservation;
  if (item.status === 'available') return mine ? ownerWaitingBlock() : reserveBlock(item, null);
  if (item.status === 'offered') {
    const req = requestOf(item.offeredToRequestId);
    return req?.personId === state.me ? reserveBlock(item, req) : offeredElsewhereBlock(mine);
  }
  if (item.status === 'reserved') {
    if (res?.personId === state.me) return recipientBlock(item);
    if (mine) return ownerReservedBlock(item);
    return html`<h2 id="action-title">Reserved</h2>
      <p class="muted">It's spoken for. Check the board for other things up for grabs.</p>${noticeBlock()}`;
  }
  if (item.status === 'collected') return collectedBlock(item);
  return html`<h2 id="action-title">${mine ? 'You took this back' : 'The giver took this back'}</h2>
    <p class="muted">It's no longer up for grabs.</p>${noticeBlock()}`;
}

const withdrawButton = () => html`<div class="actions"><button class="btn btn-ghost" id="withdraw" data-action="withdraw">${busyText('withdraw', 'Take it back', 'Taking it back…')}</button></div>`;

const ownerWaitingBlock = () => html`<h2 id="action-title">Posted to the board</h2>
  <p class="muted">Anyone can reserve it. Their pickup place and time will show up here.</p>
  ${noticeBlock()}${withdrawButton()}`;

function offeredElsewhereBlock(mine) {
  const text = mine
    ? 'Waiting for them to accept. If they say no thanks, it goes on the board.'
    : 'The giver offered this to someone who asked for one. If they say no thanks, it comes back on the board.';
  return html`<h2 id="action-title">Offered to someone who asked</h2><p class="muted">${text}</p>${noticeBlock()}${mine ? withdrawButton() : ''}`;
}

function reserveBlock(item, offeredReq) {
  if (!state.ui.reserveOpen) {
    if (offeredReq) {
      return html`<h2 id="action-title">Someone offered you this</h2>
        <p class="muted">For your request: <em>${offeredReq.title}</em>. Accept to reserve it and plan the pickup with the giver, or say no thanks and it goes back on the board.</p>
        ${noticeBlock()}
        <div class="actions">
          <button class="btn btn-primary btn-moment" id="open-reserve" data-action="open-reserve">Accept &amp; reserve</button>
          <button class="btn btn-secondary" id="decline" data-action="decline">${busyText('decline', 'No thanks', 'Saying no…')}</button>
        </div>`;
    }
    return html`<h2 id="action-title">Want it?</h2>
      <p class="muted">Reserve it, then sort out where and when with the giver. You'll get a pickup code to show at the handoff.</p>
      ${noticeBlock()}
      <div class="actions"><button class="btn btn-primary btn-moment btn-block" id="open-reserve" data-action="open-reserve">Reserve</button></div>`;
  }
  return html`<form class="stack-sm" data-form="reserve" data-request="${offeredReq?.id ?? ''}" novalidate>
    <h2 id="action-title">Suggest a time and place <span class="optional">(optional)</span></h2>
    <p class="muted small">Or leave it blank and work it out with the giver in the chat; they're handing it over, so their time comes first.</p>
    ${placeTimeFields('reserve', state.ui.reserve)}
    ${noticeBlock()}
    <div class="actions">
      <button class="btn btn-primary btn-moment" type="submit" id="reserve-submit">${busyText('reserve', offeredReq ? 'Accept & reserve' : 'Reserve', 'Reserving…')}</button>
      <button class="btn btn-ghost" type="button" data-action="close-reserve">Cancel</button>
    </div>
  </form>`;
}

/* One box for the exact place, a date and a time picker, or a time in words; shared by the reserve form and
   "Suggest another time". Everything is optional. */
function placeTimeFields(scope, { place, date, hour, time }) {
  const id = (field) => (scope === 'reserve' ? `${field}-input` : `${scope}-${field}`);
  return html`<fieldset class="field">
      <legend class="label">Meet at</legend>
      <label class="sr-only" for="${id('place')}">Exact place</label>
      <input id="${id('place')}" class="input" name="place" data-scope="${scope}" maxlength="80" autocomplete="off" placeholder="Exactly where, e.g. Davis Library, 2nd floor by the printers" value="${place}">
    </fieldset>
    <fieldset class="field">
      <legend class="label">When</legend>
      <div class="when-row">
        <label class="sr-only" for="${id('date')}">Date</label>
        <input id="${id('date')}" class="input" type="date" name="date" data-scope="${scope}" min="${localDate(Date.now())}" value="${date}">
        <label class="sr-only" for="${id('hour')}">Time</label>
        <input id="${id('hour')}" class="input" type="time" name="hour" data-scope="${scope}" step="300" value="${hour}">
      </div>
      <label class="sr-only" for="${id('time')}">Or a time in words</label>
      <input id="${id('time')}" class="input" name="time" data-scope="${scope}" maxlength="40" autocomplete="off" placeholder="Or type it, like “after 6 tonight”" value="${time}">
    </fieldset>`;
}
const meetGrid = (place, time) => html`<dl class="meet"><div><dt>Where</dt><dd>${place || NOT_SET}</dd></div><div><dt>When</dt><dd>${time || NOT_SET}</dd></div></dl>`;





function recipientBlock(item) {
  const res = item.reservation;
  return html`<h2 id="action-title">Your pickup code</h2>
    <div class="ticket ${state.ui.revealCode === item.id ? 'reveal' : ''}">
      <div class="ticket-main"><p class="ticket-label" aria-hidden="true">Show this at pickup</p><p class="code"><span aria-hidden="true">${res.code}</span><span class="sr-only">${spaced(res.code)}</span></p>${atPickup(item) ? html`<p class="ticket-pay">${atPickup(item)}</p>` : ''}</div>
      <span class="ticket-stub" aria-hidden="true">${LOOP_MARK}</span>
    </div>
    <p class="center">Show this code to the giver at pickup.</p>
    ${inThread(threadOf(item)) ? '' : meetGrid(res.place, res.time) /* v4.1: the plan card below says the same */}
    ${noticeBlock()}
    <div class="actions"><button class="btn btn-secondary" id="release" data-action="release">${busyText('release', 'Cancel reservation', 'Cancelling…')}</button></div>`;
}

function ownerReservedBlock(item) {
  const res = item.reservation;
  const error = state.ui.codeError;
  const when = [res.place, res.time].filter(Boolean).join(' · ') || 'time and place not set yet';
  return html`<h2 id="action-title">Hand it over</h2>
    <p class="muted">Reserved · ${when}</p>
    <form data-form="confirm" novalidate>
      <div class="field">
        <label class="label" for="code-input">The taker's pickup code</label>
        <input id="code-input" class="input code-input" name="code" data-scope="code" inputmode="numeric" autocomplete="one-time-code" value="${state.ui.code}" aria-describedby="code-help" ${error ? raw('aria-invalid="true"') : ''}>
        <p id="code-help" class="${error ? 'error' : 'hint'}">${error || "Ask the taker for the code: 4 digits on their screen. Type it in when you meet."}</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary btn-moment" type="submit" id="confirm-submit">${busyText('confirm', 'Confirm handoff', 'Checking…')}</button>
        <button class="btn btn-ghost" type="button" id="release" data-action="release">${busyText('release', 'Release', 'Releasing…')}</button>
      </div>
    </form>
    ${noticeBlock()}`;
}

function collectedBlock(item) {
  const animate = !state.seenCollected.has(item.id); // the success ripple plays once per tab
  state.seenCollected.add(item.id);
  let label = 'Collected';
  if (item.reservation?.personId === state.me) label = 'Collected by you';
  else if (item.ownerId === state.me) label = 'Collected by the taker';
  return html`<div class="success collected ${animate ? 'animate' : ''}">
      <span class="stamp" aria-hidden="true">Kept in use</span>
      <h2 id="action-title">${label}</h2><p class="muted">${formatTime(stampFormat, item.collectedAt)}</p>
    </div>
    <p class="muted thanks">Handed over and kept in use.</p>
    ${item.reservation?.personId === state.me && !state.db.items.some((i) => i.fromItemId === item.id)
    ? html`${noticeBlock()}<div class="actions"><button class="btn btn-primary btn-moment btn-block" id="repost" data-action="repost">${busyText('repost', 'Pass it on again', 'Posting…')}</button></div>`
    : ''}`;
}

/* ---------- views: handoff thread (owner, recipient and Loop) ---------- */

// The item's newest thread, shown only to its two people: live while open, read-only history after.
const threadOf = (item) => (state.db.threads ?? []).findLast((t) => t.itemId === item.id) ?? null;
const threadById = (id) => (state.db.threads ?? []).find((t) => t.id === id) ?? null;
const inThread = (t) => Boolean(t) && (t.ownerId === state.me || t.recipientId === state.me);
const isOpenThread = (t) => OPEN_THREAD.includes(t.status);
const otherIn = (t) => (t.ownerId === state.me ? t.recipientId : t.ownerId);
// SPEC5: in a thread people are roles, never names: "giver" (the owner) and "taker"; the reader is "You".
const roleIn = (t, id) => (id === t.ownerId ? 'giver' : 'taker');
const whoIn = (t, id) => (id === state.me ? 'You' : cap(roleIn(t, id)));
// Loop's lines meant for one person (forPersonId) say so to the other reader: "Loop to the taker".
const toWhom = (t, m) => (m.from === 'loop' && m.forPersonId && m.forPersonId !== state.me ? ` to the ${roleIn(t, m.forPersonId)}` : '');

/* New messages from the other two are read out once; everything already on screen counts as heard. */
const heardIds = new Set();
function markAllHeard() {
  for (const t of state.db?.threads ?? []) for (const m of t.messages) heardIds.add(m.id);
}
function announceNew(t) {
  const fresh = t.messages.filter((m) => !heardIds.has(m.id));
  fresh.forEach((m) => heardIds.add(m.id));
  const said = fresh.filter((m) => m.from !== state.me).map((m) => `${m.from === 'loop' ? 'Loop' : whoIn(t, m.from)}${toWhom(t, m)}: ${m.text}`);
  if (said.length) announce(said.join(' '));
}

function threadSection(item) {
  const t = threadOf(item);
  if (!inThread(t)) return '';
  return html`<section class="thread" aria-labelledby="thread-title">
    <div id="thread-live" class="thread-live" data-thread="${t.id}">${threadLive(t)}</div>
    ${isOpenThread(t) ? composer(t) : html`<p class="closed-note">This conversation is closed.</p>`}
  </section>`;
}

// Everything that can change while someone types: patchThread() redraws exactly this.
function threadLive(t) {
  announceNew(t);
  return html`${planCard(t)}${messageLog(t)}${noticeBlock('thread')}${proposeForm(t)}`;
}

function planCard(t) {
  const { place, time } = t.plan;
  // A plan with a blank place or time is still being worked out (Lane C keeps such threads in planning anyway).
  const status = t.status === 'set' && !(place && time) ? 'planning' : t.status;
  const [label, chip] = THREAD_CHIP[status] ?? [status, ''];
  const people = [state.me, otherIn(t)];
  return html`<div class="glass card plan">
    <div class="plan-head"><h2 id="thread-title">Pickup plan</h2><span class="chip dot chip-${chip}">${label}</span></div>
    ${meetGrid(place, time)}
    ${isOpenThread(t) && (place || time) ? html`<ul class="agree" aria-label="Who agreed to this plan">${people.map((id) => {
      const yes = (t.plan.confirmedBy ?? []).includes(id);
      return html`<li class="${yes ? 'yes' : ''}"><span class="agree-dot" aria-hidden="true">${yes ? icon('check') : ''}</span><span><strong>${whoIn(t, id)}</strong> ${yes ? 'agreed' : 'not yet'}</span></li>`;
    })}</ul>` : ''}
    ${imessageNote(t)}
  </div>`;
}

function imessageNote(t) {
  const { imessage, linkedPhones } = state.health;
  if (!imessage || !isOpenThread(t)) return '';
  const linked = [otherIn(t), state.me].filter((id) => linkedPhones.includes(id));
  if (!linked.length) return '';
  const other = linked[0] === state.me ? '' : `the ${roleIn(t, linked[0])}`;
  let text = `${cap(other)} also gets this thread on iMessage.`;
  if (!other) text = 'You also get this thread on iMessage.';
  else if (linked.length === 2) text = `You and ${other} also get this thread on iMessage.`;
  return html`<p class="note">${icon('ask')}<span>${text}</span></p>`;
}

function messageLog(t) {
  // Lane C keeps live buttons on one Loop message at most; the newest one with buttons is that message.
  const live = t.messages.findLast((m) => m.from === 'loop' && m.actions?.length);
  return html`<ol class="msgs" aria-label="Conversation">${t.messages.map((m) => messageItem(t, m, m === live ? actionsFor(t, m) : []))}</ol>`;
}

function actionsFor(t, m) {
  if (!isOpenThread(t)) return [];
  return m.actions.filter((a) => {
    const forId = a.forPersonId ?? m.forPersonId ?? null;
    if (!THREAD_ACTIONS.includes(a.action) || (forId && forId !== state.me)) return false;
    if (a.action === 'enter_code') return t.status === 'meeting' && t.ownerId === state.me;
    if (a.action === 'accept') return !(t.plan.confirmedBy ?? []).includes(state.me);
    return true;
  });
}

// Loop's mark: the knot (brand/knot.svg, viewBox cropped to its ink box), the same as the top bar.
const LOOP_MARK = raw('<svg class="loop-mark knot" viewBox="2 4.02 60 55.96" aria-hidden="true" focusable="false"><path d="M25.66 44.93C24.38 43.2 23.26 41.35 22.31 39.42C21.37 37.49 20.61 35.48 20.05 33.45C19.49 31.42 19.13 29.38 18.98 27.38C18.83 25.37 18.89 23.41 19.14 21.55C19.4 19.7 19.85 17.94 20.47 16.35C21.09 14.75 21.88 13.31 22.8 12.07C23.73 10.84 24.79 9.8 25.94 9C27.09 8.2 28.32 7.63 29.59 7.31C30.86 7 32.17 6.94 33.45 7.13C34.74 7.32 36 7.76 37.19 8.44C38.38 9.13 39.49 10.05 40.48 11.19C41.47 12.32 42.34 13.67 43.04 15.19C43.74 16.7 44.28 18.39 44.63 20.19C44.98 21.99 45.14 23.91 45.09 25.89C45.04 27.87 44.79 29.9 44.33 31.94C43.87 33.97 43.21 36 42.36 37.97C41.5 39.93 40.46 41.83 39.26 43.62C38.06 45.4 36.7 47.06 35.23 48.56C33.75 50.06 32.16 51.39 30.5 52.52C28.84 53.66 27.11 54.59 25.38 55.3C23.64 56.01 21.9 56.49 20.2 56.75C18.51 57.02 16.87 57.05 15.33 56.87C13.8 56.68 12.37 56.28 11.1 55.69C9.84 55.09 8.73 54.31 7.82 53.37C6.91 52.42 6.2 51.33 5.73 50.12C5.25 48.91 5 47.59 5 46.22C5 44.85 5.24 43.43 5.73 42C6.22 40.58 6.95 39.15 7.91 37.79C8.87 36.42 10.06 35.11 11.45 33.91C12.84 32.7 14.42 31.61 16.16 30.66C17.89 29.71 19.78 28.91 21.77 28.29C23.76 27.67 25.85 27.23 27.98 26.99C30.11 26.74 32.28 26.69 34.42 26.84C36.57 26.99 38.69 27.33 40.72 27.86C42.76 28.39 44.71 29.11 46.52 29.98C48.33 30.85 50 31.88 51.48 33.03C52.96 34.18 54.26 35.44 55.33 36.78C56.4 38.11 57.25 39.52 57.86 40.94C58.47 42.36 58.84 43.8 58.96 45.19C59.08 46.59 58.95 47.94 58.59 49.2C58.23 50.46 57.63 51.62 56.82 52.63C56.01 53.65 55 54.52 53.81 55.21C52.63 55.9 51.27 56.4 49.79 56.69C48.31 56.98 46.71 57.06 45.05 56.91C43.38 56.76 41.65 56.38 39.92 55.78C38.18 55.18 36.44 54.36 34.75 53.33C33.06 52.3 31.43 51.06 29.9 49.65C28.36 48.24 26.94 46.65 25.66 44.93Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="65.17 18.81"/></svg>');

function messageItem(t, m, actions) {
  const loop = m.from === 'loop';
  const mine = m.from === state.me;
  let side = 'theirs';
  if (loop) side = 'loop';
  else if (mine) side = 'mine';
  const who = loop ? 'Loop' : whoIn(t, m.from);
  return html`<li class="msg msg-${side} ${loop ? '' : `is-${roleIn(t, m.from)}`}">
    ${loop ? html`<span class="disc-loop" aria-hidden="true">${LOOP_MARK}</span>` : html`<span class="role" aria-hidden="true">${who.charAt(0)}</span>`}
    <div class="msg-body">
      <p class="msg-meta"><strong>${who}</strong>${toWhom(t, m)} · <time datetime="${m.at}">${formatTime(clockFormat, m.at)}</time>${m.via === 'imessage' ? html` <span class="via">iMessage</span>` : ''}</p>
      <p class="msg-text">${m.text}</p>
      ${actions.length ? html`<div class="msg-actions">${actions.map((a) => html`<button class="btn btn-small ${PRIMARY_ACTIONS.includes(a.action) ? 'btn-primary btn-moment' : 'btn-secondary'}" id="act-${a.action}" data-action="thread-action" data-thread="${t.id}" data-kind="${a.action}">${busyText(`thread:${a.action}`, a.label, 'Saving…')}</button>`)}</div>` : ''}
    </div>
  </li>`;
}

function proposeForm(t) {
  const p = state.ui.propose;
  if (!p || p.threadId !== t.id || !isOpenThread(t)) return '';
  const title = t.plan.place || t.plan.time ? 'Suggest another time or place' : 'Suggest a time and place';
  return html`<form class="glass card stack-sm" data-form="propose" novalidate aria-labelledby="propose-title">
    <h3 id="propose-title">${title}</h3>
    ${placeTimeFields('propose', p)}
    <div class="actions">
      <button class="btn btn-primary" type="submit" id="propose-submit">${busyText('thread:propose', `Suggest to the ${roleIn(t, otherIn(t))}`, 'Sending…')}</button>
      <button class="btn btn-ghost" type="button" data-action="close-propose">Cancel</button>
    </div>
  </form>`;
}

function composer(t) {
  const other = `the ${roleIn(t, otherIn(t))}`;
  const sending = state.busy === 'thread:send';
  return html`<form class="composer glass" data-form="message" data-thread="${t.id}" novalidate>
    <label class="sr-only" for="composer-${t.id}">Message ${other} and Loop</label>
    <textarea id="composer-${t.id}" class="input composer-input" name="${t.id}" data-scope="composer" rows="1" maxlength="300" placeholder="Message ${other} and Loop…" enterkeyhint="send" ${sending ? raw('readonly') : ''}>${state.ui.composer[t.id] ?? ''}</textarea>
    <button class="btn btn-primary composer-send" type="submit" id="send-${t.id}">${sending ? 'Sending…' : 'Send'}</button>
  </form>`;
}

/* ---------- views: give ---------- */

function giveView() {
  const g = state.give;
  const head = html`${backLink()}<h1>Post something</h1><p class="appear">Nothing identifies you. The pickup code proves it's you at the handoff.</p>`;
  if (state.giveMode === 'pile') return pileView(head);
  if (g.phase === 'pick') {
    return html`<div class="stack give-page">${head}${modeSwitch()}${g.error ? html`<p class="notice error">${g.error}</p>` : ''}${dropZone()}${textIn()}</div>`;
  }
  if (g.phase === 'failed') return html`<div class="stack give-page">${head}<div class="give-center">${failedCard(g)}</div></div>`;
  const busy = g.phase === 'uploading' || g.phase === 'drafting';
  let body = reviewCards(g);
  if (busy) body = draftingCard(g);
  // The failure cards carry their own "Try another photo"; a good draft needs a way out too.
  const swap = g.phase === 'review' && !isManual(g) && !g.draft.notAllowed
    ? html`<div class="swap"><button class="btn btn-ghost btn-small" id="new-photo" data-action="new-photo">${icon('camera')} Use a different photo</button></div>`
    : '';
  return html`<div class="stack give-page">${head}
    <div class="stack give-split">
      <div class="stack give-photo"><figure class="photo-frame glass ${busy ? 'is-busy' : ''}">${g.previewUrl ? html`<img src="${g.previewUrl}" alt="Your photo">` : ''}</figure>${swap}</div>
      <div class="stack give-cards">${body}</div>
    </div>
  </div>`;
}

const dropZone = (
  title = 'Take or choose a photo',
  text = 'One thing per photo works best. Gemini drafts the listing, you check it, and nothing goes up until you say so.',
) => html`
  <input id="photo-input" class="sr-only" type="file" accept="image/*" capture="environment">
  <label class="drop glass" id="drop" for="photo-input">
    <span class="drop-orb" aria-hidden="true">${icon('camera')}</span>
    <span class="drop-title">${title}</span>
    <span class="muted">${text}</span>
    <span class="btn btn-primary" aria-hidden="true">Choose a photo</span>
  </label>`;

const modeSwitch = () => html`<div class="segmented" role="group" aria-label="How many things are in the photo?">
  ${[['one', 'One thing'], ['pile', 'A pile']].map(([mode, label]) => html`<button type="button" class="segment" id="mode-${mode}" data-action="give-mode" data-mode="${mode}" aria-pressed="${String(state.giveMode === mode)}">${label}</button>`)}
</div>`;

const draftingCard = (g, text = g.phase === 'uploading' ? 'Uploading your photo…' : 'Gemini is looking at your photo…') => html`<section class="glass card">
  <p class="status-line"><span class="spinner" aria-hidden="true"></span>${text}</p>
  ${g.slow ? html`<p class="muted slow">Taking longer than usual…</p>` : ''}
  <div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
</section>`;

const newPhotoButton = (cls = 'btn-secondary') => html`<button class="btn ${cls}" id="new-photo" data-action="new-photo">${icon('camera')} Try another photo</button>`;

const failedCard = (g) => html`<section class="glass card stack-sm">
  <h2>Your photo didn't go through</h2>
  <p>${g.error}</p>
  <div class="actions">${g.canRetry ? html`<button class="btn btn-primary" id="retry" data-action="retry">${icon('retry')} Try again</button>` : ''}${newPhotoButton()}</div>
</section>`;

function reviewCards(g) {
  const d = g.draft;
  if (d?.notAllowed) {
    return html`<section class="glass card stack-sm">
      <h2>This can't go on Loop</h2>
      <p>${d.notAllowed}</p>
      <p class="muted">Food, medicine, weapons, and anything unsafe to pass on stay off the board.</p>
      <div class="actions">${newPhotoButton('btn-primary')}</div>
    </section>`;
  }
  const manual = isManual(g);
  return html`${manual ? explainCard(g) : ''}${draftForm(g, manual)}${manual ? '' : matchCard(g)}`;
}

function explainCard(g) {
  const retry = g.aiError === 'rate_limited' || g.aiError === 'timeout';
  const text = g.aiError ? AI_ERRORS[g.aiError] ?? AI_ERROR_OTHER : NOT_IDENTIFIED;
  return html`<section class="glass card stack-sm">
    <h2>${g.aiError ? "Gemini couldn't draft this" : 'Nothing clear to list'}</h2>
    <p>${text}</p>
    <div class="actions">${retry ? html`<button class="btn btn-primary" id="retry" data-action="retry">${icon('retry')} Retry</button>` : ''}${newPhotoButton()}</div>
  </section>`;
}

function draftForm(g, manual) {
  const f = g.form;
  const d = g.draft;
  let cls = 'is-draft';
  if (manual) cls = 'is-manual';
  else if (g.checked) cls = 'is-checked';
  const head = manual
    ? html`<p class="tag tag-human">${icon('pencil')} Your details</p>`
    : html`<p class="tag tag-ai">${icon('sparkle')} Drafted by Gemini — check it</p><p class="tag tag-human">${icon('check')} Checked by you</p>`;
  return html`<form id="draft-card" class="glass card draft ${cls}" data-form="publish" novalidate aria-label="Listing details">
    <div class="draft-head">${head}</div>
    <div class="field">
      <label class="label" for="f-title">Title</label>
      <input id="f-title" class="input" name="title" data-scope="give" maxlength="60" autocomplete="off" value="${f.title}" placeholder="${manual ? 'e.g. Black desk lamp' : ''}">
    </div>
    <div class="field">
      <label class="label" for="f-desc">Description</label>
      <textarea id="f-desc" class="input" name="description" data-scope="give" maxlength="240" rows="3" placeholder="What it is, what's worn or missing">${f.description}</textarea>
    </div>
    <fieldset class="field">
      <legend class="label">Condition</legend>
      <div class="picks">${CONDITIONS.map((c) => html`<label class="pick"><input type="radio" name="condition" value="${c}" data-scope="give" ${f.condition === c ? raw('checked') : ''}>${icon('check', 'tick')}${cap(c)}</label>`)}</div>
      ${!manual && d.conditionNotes ? html`<p class="note">${icon('sparkle')}<span>Gemini noticed: ${d.conditionNotes}</span></p>` : ''}
    </fieldset>
    <div class="field">
      <label class="label" for="f-cat">Category</label>
      <select id="f-cat" class="input" name="category" data-scope="give">${CATEGORIES.map((c) => html`<option value="${c}" ${f.category === c ? raw('selected') : ''}>${cap(c)}</option>`)}</select>
    </div>
    ${priceField((field) => `f-${field}`, f.price, raw('data-scope="give"'))}
    ${manual
      ? html`${noticeBlock()}<div class="actions"><button class="btn btn-primary btn-moment btn-block" type="submit" id="publish-board">${busyText('publish:board', 'Post to board', 'Posting…')}</button></div>`
      : html`<div class="actions"><button type="button" class="btn btn-secondary approve" id="approve" data-action="approve">${icon('check')} Looks right</button></div>`}
  </form>`;
}

/* "Free" | "$" segments; "$" shows a whole-dollar box. price: null = free, a string ('' at first) = "$" chosen. */
function priceField(id, price, attrs) {
  const paid = price != null;
  return html`<fieldset class="field">
    <legend class="label">Price</legend>
    <div class="price-row">
      <div class="segmented inline">${[['free', 'Free'], ['paid', '$']].map(([mode, label]) => html`<button type="button" class="segment" id="${id(`price-${mode}`)}" data-action="price-mode" data-mode="${mode}" ${attrs} aria-pressed="${String((mode === 'paid') === paid)}">${label}${mode === 'paid' ? html`<span class="sr-only"> Set a price</span>` : ''}</button>`)}</div>
      ${paid ? html`<label class="sr-only" for="${id('price')}">Price in dollars, 1 to 500</label><input id="${id('price')}" class="input" type="number" inputmode="numeric" min="1" max="500" step="1" placeholder="10" name="price" data-field="price" ${attrs} value="${price}">` : ''}
    </div>
  </fieldset>`;
}

function matchCard(g) {
  const m = g.draft?.match;
  const req = m?.requestId ? requestOf(m.requestId) : null;
  const lock = g.checked ? '' : raw('disabled');
  const hint = g.checked ? '' : html`<p class="hint" id="check-hint">Check the details above first: fix anything that's off, or tap <strong>Looks right</strong>.</p>`;
  const board = (label) => html`<button class="btn ${label === 'Post to board' ? 'btn-primary btn-moment' : 'btn-secondary'}" id="publish-board" data-action="publish" data-offer="" data-needs-check ${lock}>${busyText('publish:board', label, 'Posting…')}</button>`;
  if (!req || req.status !== 'open' || req.personId === state.me) {
    return html`<section class="glass card match" aria-labelledby="match-title">
      <h2 id="match-title">No open request fits yet.</h2>
      ${m?.reason ? html`<p class="note">${icon('sparkle')}<span>Gemini: ${m.reason}</span></p>` : ''}
      ${hint}${noticeBlock()}
      <div class="actions">${board('Post to board')}</div>
    </section>`;
  }
  return html`<section class="glass card match ai-box" aria-labelledby="match-title">
    <p class="tag tag-ai">${icon('sparkle')} Gemini's suggestion</p>
    <h2 id="match-title">Fits someone's request: <em>${req.title}</em></h2>
    ${m.reason ? html`<p class="muted">${m.reason}</p>` : ''}
    ${hint}${noticeBlock()}
    <div class="actions">
      <button class="btn btn-primary btn-moment" id="publish-offer" data-action="publish" data-offer="${req.id}" data-needs-check ${lock}>${busyText(`publish:${req.id}`, 'Offer to them', 'Offering…')}</button>
      ${board('Post to board instead')}
    </div>
  </section>`;
}

/* ---------- views: give a pile ---------- */

const isPending = (it) => it.checked && !it.notAllowed && !it.itemId;
const boxStyle = ([y0, x0, y1, x1]) => `top:${y0 / 10}%;left:${x0 / 10}%;height:${(y1 - y0) / 10}%;width:${(x1 - x0) / 10}%`;
function pileMatch(it) { // the open request this item may be offered to, if it is still open
  const req = requestOf(it.match?.requestId);
  return req && req.status === 'open' && req.personId !== state.me ? req : null;
}

function pileView(head) {
  const p = state.pile;
  if (p.phase === 'pick') {
    return html`<div class="stack give-page">${head}${modeSwitch()}${p.error ? html`<p class="notice error">${p.error}</p>` : ''}
      ${dropZone('Take or choose a photo of a pile', "Up to six things in one photo. Gemini outlines each one and drafts its listing. You check them, and nothing goes up until you say so.")}${textIn()}</div>`;
  }
  if (p.phase === 'failed') return html`<div class="stack give-page">${head}<div class="give-center">${failedCard(p)}</div></div>`;
  let body = pileReview(p);
  if (p.phase === 'sorting') body = draftingCard(p, 'Gemini is sorting the pile…');
  else if (p.aiError || !p.items.length) body = pileExplainCard(p);
  const outlined = p.phase === 'review' ? p.items.filter((it) => it.box) : [];
  return html`<div class="stack give-page">${head}
    <div class="stack give-split"><div class="stack give-photo">
    <figure class="photo-frame glass pile-photo ${p.phase === 'sorting' ? 'is-busy' : ''}">
      ${p.previewUrl ? html`<img src="${p.previewUrl}" alt="${outlined.length ? `Your photo, with ${outlined.length} things outlined and numbered` : 'Your photo'}">` : ''}
      ${outlined.map((it) => html`<span class="pile-box ${isPending(it) || it.itemId ? '' : 'is-off'}" style="${boxStyle(it.box)}" aria-hidden="true"><span class="pile-num">${it.n}</span></span>`)}
    </figure></div>
    <div class="stack give-cards">${body}</div></div>
  </div>`;
}

function pileExplainCard(p) {
  const retry = p.aiError === 'rate_limited' || p.aiError === 'timeout';
  const text = p.aiError ? PILE_AI_ERRORS[p.aiError] ?? PILE_AI_ERROR_OTHER : PILE_NOT_FOUND;
  return html`<section class="glass card stack-sm">
    <h2>${p.aiError ? "Gemini couldn't sort this pile" : 'No separate things found'}</h2>
    <p>${text}</p>
    <div class="actions">
      ${retry ? html`<button class="btn btn-secondary" id="retry" data-action="retry">${icon('retry')} Try again</button>` : ''}
      <button class="btn btn-primary" id="as-one" data-action="pile-as-one">List it as one thing</button>
      ${newPhotoButton('btn-ghost')}
    </div>
  </section>`;
}

function pileReview(p) {
  const todo = p.items.filter(isPending).length;
  const listed = p.items.filter((it) => it.itemId).length;
  const busy = state.busy === 'pile';
  let label = `List ${todo} ${todo === 1 ? 'item' : 'items'}`;
  if (busy) label = 'Listing…';
  return html`<section class="glass card pile-intro" aria-labelledby="pile-title">
      <p class="tag tag-ai">${icon('sparkle')} Drafted by Gemini — check each one</p>
      <h2 id="pile-title">Gemini found ${p.items.length} ${p.items.length === 1 ? 'thing' : 'things'}</h2>
      <p class="muted small">Untick anything you're keeping. Fix any detail that's off before you list.</p>
    </section>
    <fieldset class="pile-list" ${busy ? raw('disabled') : ''}>
      <legend class="sr-only">Things in the photo</legend>
      ${p.items.map(pileCard)}
    </fieldset>
    ${noticeBlock()}
    <div class="actions">
      <button class="btn btn-primary btn-moment btn-block" id="pile-list" data-action="pile-list" ${todo && !busy ? '' : raw('disabled')}>${label}</button>
      ${listed && !busy ? html`<button class="btn btn-secondary" id="pile-finish" data-action="pile-finish">Done, go to the board</button>` : ''}
      ${busy ? '' : newPhotoButton('btn-ghost')}
    </div>`;
}

function pileCard(it) {
  const i = it.n - 1;
  const id = (field) => `p${i}-${field}`;
  const name = it.label || it.title || `Thing ${it.n}`;
  if (it.itemId) {
    return html`<div class="glass card pile-item is-listed" role="group" aria-label="${it.n}. ${name}">
      <p class="pile-check"><span class="pile-num" aria-hidden="true">${it.n}</span><span class="pile-label">${it.title}</span>
        <span class="chip dot ${it.offeredTo ? 'chip-offered' : 'chip-collected'}">${it.offeredTo ? 'Offered' : 'Listed'}</span></p>
    </div>`;
  }
  const on = isPending(it);
  const attrs = raw(`data-scope="pile" data-index="${i}"`);
  return html`<div class="glass card pile-item ${on ? 'ai-box' : 'is-off'}" role="group" aria-label="${it.n}. ${name}">
    <label class="pile-check">
      <input type="checkbox" id="${id('check')}" ${attrs} data-field="checked" ${on ? raw('checked') : ''} ${it.notAllowed ? raw('disabled') : ''}>
      <span class="pile-num" aria-hidden="true">${it.n}</span>
      <span class="pile-label">${name}</span>
      ${on ? '' : html`<span class="muted small pile-skip">${it.notAllowed ? "can't be listed" : 'not listing'}</span>`}
    </label>
    ${it.notAllowed ? html`<p class="notice warn">${it.notAllowed}</p>` : ''}
    ${on ? html`
      <div class="field">
        <label class="label" for="${id('title')}">Title</label>
        <input id="${id('title')}" class="input" name="title" ${attrs} maxlength="60" autocomplete="off" value="${it.title}" ${it.error && !it.title.trim() ? raw('aria-invalid="true"') : ''}>
      </div>
      <div class="field">
        <label class="label" for="${id('desc')}">Description</label>
        <textarea id="${id('desc')}" class="input" name="description" ${attrs} maxlength="240" rows="2" placeholder="What it is, what's worn or missing">${it.description}</textarea>
      </div>
      <fieldset class="field">
        <legend class="label">Condition</legend>
        <div class="picks">${CONDITIONS.map((c, k) => html`<label class="pick"><input type="radio" id="${id(`cond-${k}`)}" name="${id('condition')}" value="${c}" ${attrs} data-field="condition" ${it.condition === c ? raw('checked') : ''}>${icon('check', 'tick')}${cap(c)}</label>`)}</div>
        ${it.conditionNotes ? html`<p class="note">${icon('sparkle')}<span>Gemini noticed: ${it.conditionNotes}</span></p>` : ''}
      </fieldset>
      <div class="field">
        <label class="label" for="${id('cat')}">Category</label>
        <select id="${id('cat')}" class="input" name="category" ${attrs}>${CATEGORIES.map((c) => html`<option value="${c}" ${it.category === c ? raw('selected') : ''}>${cap(c)}</option>`)}</select>
      </div>
      ${pileMatchLine(it, id, attrs)}` : ''}
    ${it.error ? html`<p class="error" id="${id('error')}">${it.error}</p>` : ''}
  </div>`;
}

function pileMatchLine(it, id, attrs) {
  const req = pileMatch(it);
  if (!req) return html`<p class="note">${icon('pin')}<span>No open request fits this one. It goes on the board.</span></p>`;
  const choices = [['offer', 'Offer to them'], ['board', 'Post to board']];
  return html`<fieldset class="field pile-match">
    <legend class="label">Fits someone's request: <em>${req.title}</em></legend>
    ${it.match.reason ? html`<p class="note">${icon('sparkle')}<span>Gemini: ${it.match.reason}</span></p>` : ''}
    <div class="picks">${choices.map(([value, label]) => html`<label class="pick"><input type="radio" id="${id(`choice-${value}`)}" name="${id('choice')}" value="${value}" ${attrs} data-field="choice" ${it.choice === value ? raw('checked') : ''}>${icon('check', 'tick')}${label}</label>`)}</div>
  </fieldset>`;
}

/* ---------- views: ask ---------- */

function askView() {
  const result = state.ui.askResult;
  if (result) return askDoneView(result);
  const { title, details } = state.ui.ask;
  return html`<div class="stack ask-page">
    ${backLink()}
    <form class="glass card" data-form="ask" novalidate>
      <h1>Ask for something</h1>
      <p class="lead">Say what you need. People nearby see it on the board, and Gemini checks it against what's already up for grabs.</p>
      <div class="field ask-fields">
        <label class="label" for="a-title">What do you need?</label>
        <input id="a-title" class="input" name="title" data-scope="ask" maxlength="60" autocomplete="off" placeholder="e.g. Reading lamp for my desk" value="${title}">
      </div>
      <div class="field">
        <label class="label" for="a-details">Details <span class="muted small">(optional)</span></label>
        <textarea id="a-details" class="input" name="details" data-scope="ask" maxlength="240" rows="3" placeholder="Size, color, anything that helps">${details}</textarea>
      </div>
      ${state.ui.notice ? html`<div class="field">${noticeBlock()}</div>` : ''}
      <div class="actions"><button class="btn btn-primary btn-moment btn-block" type="submit" id="ask-submit">${busyText('ask', 'Post', 'Posting…')}</button></div>
    </form>
  </div>`;
}

function askDoneView(result) {
  const suggestions = (result.suggestions ?? []).map((s) => ({ ...s, item: itemOf(s.itemId) })).filter((s) => s.item);
  return html`<div class="stack ask-page">
    ${backLink()}
    <section class="glass card">
      <div class="success"><span class="check-badge">${icon('check')}</span><div><h1>Posted</h1><p class="muted">${result.request?.title ?? ''}</p></div></div>
    </section>
    ${suggestions.length
      ? html`<section class="glass card ai-box" aria-labelledby="sugg-title">
          <p class="tag tag-ai">${icon('sparkle')} Gemini's suggestion</p>
          <h2 id="sugg-title" class="section-title sugg-title">Already on the board</h2>
          <ul class="suggestions">${suggestions.map(({ item, reason }) => html`<li class="suggestion">
            <img src="${item.photo}" alt="">
            <div><p><em>${item.title}</em> might fit</p>${reason ? html`<p class="muted small">${reason}</p>` : ''}</div>
            <a class="btn btn-secondary btn-small" href="#/item/${item.id}">View<span class="sr-only"> ${item.title}</span></a>
          </li>`)}</ul>
        </section>`
      : html`<p class="glass card muted">It's on the board now. When someone posts something that fits, they can offer it to you.</p>`}
    <div class="actions">
      <a class="btn btn-primary" href="#/">Back to the board</a>
      <button class="btn btn-secondary" id="ask-again" data-action="ask-again">Ask for something else</button>
    </div>
  </div>`;
}

/* ---------- actions ---------- */

async function mutate(kind, request, onDone) {
  if (state.busy) return null;
  state.busy = kind;
  state.ui.notice = null;
  render();
  let result = null;
  try {
    result = await request();
  } catch (err) {
    showError(err);
  }
  state.busy = '';
  await refresh();
  ensureMe(); // a reset elsewhere drops this tab's id (the write fails with unknown_person): join again right away
  // onDone returns false when it navigates away; the route change renders, so the old view never shows stale data.
  if (result && onDone?.(result) === false) return result;
  render();
  return result;
}

function showError(err) {
  const where = state.busy.startsWith('thread') ? 'thread' : state.busy === 'phone' ? 'texts' : 'action'; // thread errors show in the conversation
  if (err.code === 'wrong_code') {
    state.ui.codeError = err.message;
    state.ui.codeAlert = true;
  } else {
    if (err.status === 409) {
      state.ui.reserveOpen = false;
      state.focusTarget = where === 'thread' ? '#thread-title' : '#action-title';
    }
    state.ui.notice = { text: err.message, tone: err.status === 409 ? 'warn' : 'error', where };
  }
  announce(err.message);
}

async function resetDemo() {
  if (!confirm('Reset the demo? Every item and request goes back to the starting set.')) return;
  const done = await mutate('reset', () => api('POST', '/api/reset'));
  if (!done) return;
  resetGive();
  resetPile();
  state.seenCollected.clear();
  // SPEC5: a reset also forgets this tab's anonymous id; ensureMe() joins again as a new person.
  state.me = null;
  saveMe(null);
  ensureMe();
  announce('Demo reset.');
}

async function removeRequest(id) {
  if (!confirm('Remove your request from the board?')) return;
  await mutate('remove', () => api('DELETE', `/api/requests/${encodeURIComponent(id)}`, { personId: state.me }), () => announce('Request removed.'));
}

const itemPath = (action) => `/api/items/${encodeURIComponent(state.route.id)}/${action}`;

/* Place and time are optional; blank ones are left out so the two people settle them in the thread. A picked date and
   time become a label plus the instant (so Loop can remind); a time in words stays words, with the day in front
   when a date was picked; a time with no date means today. */
function planBody({ place, date, hour, time }) {
  const body = {};
  if (place.trim()) body.place = place.trim();
  const words = time.trim();
  const day = date ? dayLabel(new Date(`${date}T12:00`).getTime()) : '';
  if (words) body.time = day ? `${day}, ${words}` : words;
  else if (hour) {
    const at = new Date(`${date || localDate(Date.now())}T${hour}`).getTime();
    if (!(at > Date.now())) return { error: date ? "Pick a time that's still ahead." : 'That time has passed today. Pick a date too.' };
    body.time = timeLabel(at);
    body.timeISO = new Date(at).toISOString();
  } else if (day) body.time = day;
  return { body };
}
console.assert(planBody({ place: ' Davis Library, 2nd floor ', date: '', hour: '', time: '' }).body.place === 'Davis Library, 2nd floor', 'plan: place trimmed');
console.assert(planBody({ place: '', date: localDate(Date.now() + DAY_MS), hour: '', time: 'after 6' }).body.time === 'Tomorrow, after 6', 'plan: day + words');
console.assert(planBody({ place: '', date: '2000-01-01', hour: '10:00', time: '' }).error, 'plan: a past time is refused');
console.assert(planBody({ place: '', date: '2000-01-01', hour: '10:00', time: 'whenever' }).body.time === 'Sat Jan 1, whenever', 'plan: words win over the clock');

async function reserveItem(requestId) {
  const { body: plan, error } = planBody(state.ui.reserve);
  if (error) {
    state.ui.notice = { text: error, tone: 'error' };
    state.focusTarget = '#date-input';
    render();
    announce(error);
    return;
  }
  const body = { personId: state.me, ...plan };
  if (requestId) body.requestId = requestId;
  await mutate('reserve', () => api('POST', itemPath('reserve'), body), (item) => {
    state.ui.reserveOpen = false;
    state.ui.revealCode = item.id;
    state.focusTarget = '#action-title';
    announce(`Reserved. Your pickup code is ${spaced(item.reservation?.code ?? '')}.`);
  });
}

async function confirmHandoff() {
  const code = state.ui.code;
  if (!/^\d{4}$/.test(code)) {
    state.ui.codeError = "Type the 4-digit code from the taker's screen.";
    state.ui.codeAlert = true;
    render();
    announce(state.ui.codeError);
    return;
  }
  state.ui.codeError = '';
  await mutate('confirm', () => api('POST', itemPath('confirm'), { personId: state.me, code }), (item) => {
    state.ui.code = '';
    state.focusTarget = '#action-title';
    announce('Handoff confirmed. Collected.');
  });
}

function confirmQuestion(kind, item) {
  if (kind === 'withdraw') return 'Take this back? It comes off the board.';
  if (kind !== 'release') return '';
  if (item?.reservation?.personId === state.me) return 'Cancel your reservation? It goes back on the board.';
  return "Release the taker's reservation? Their code stops working and it goes back on the board.";
}

async function itemAction(kind) {
  const question = confirmQuestion(kind, itemOf(state.route.id));
  if (question && !confirm(question)) return;
  await mutate(kind, () => api('POST', itemPath(kind), { personId: state.me }), () => {
    state.ui.notice = { text: DONE_TEXT[kind], tone: 'ok' };
    state.focusTarget = '#action-title';
    announce(DONE_TEXT[kind]);
  });
}

const threadPath = (id, what) => `/api/threads/${encodeURIComponent(id)}/${what}`;

async function threadAction(threadId, kind) {
  if (kind === 'enter_code') return focusCodeInput();
  const t = threadById(threadId);
  if (kind === 'propose') {
    state.ui.propose = { threadId, place: t?.plan.place ?? '', date: '', hour: '', time: '' };
    state.ui.notice = null;
    state.focusTarget = '#propose-place';
    return render();
  }
  if (kind === 'cancel' && !confirm(`Cancel this pickup? The reservation ends and it goes back on the board.`)) return;
  await mutate(`thread:${kind}`, () => api('POST', threadPath(threadId, 'actions'), { personId: state.me, action: kind }), () => {
    state.focusTarget = '#thread-title'; // Loop's reply is read out by the live region
  });
}

function focusCodeInput() {
  const input = $('#code-input');
  if (!input) return;
  input.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  input.focus({ preventScroll: true });
}

async function submitPropose() {
  const p = state.ui.propose;
  const t = p && threadById(p.threadId);
  if (!t) return;
  const { body: plan, error } = planBody(p);
  const fail = error || (!plan.time && (!plan.place || plan.place === t.plan.place) ? 'Pick a new time or place to suggest.' : '');
  if (fail) {
    state.ui.notice = { text: fail, tone: 'error', where: 'thread' };
    state.focusTarget = '#propose-date';
    render();
    announce(fail);
    return;
  }
  const body = { personId: state.me, action: 'propose', ...plan };
  await mutate('thread:propose', () => api('POST', threadPath(t.id, 'actions'), body), () => {
    state.ui.propose = null;
    state.focusTarget = '#thread-title';
  });
}

async function sendMessage(form) {
  const id = form.dataset.thread;
  const text = (state.ui.composer[id] ?? '').trim();
  if (!text) {
    form.querySelector('textarea')?.focus();
    return;
  }
  await mutate('thread:send', () => api('POST', threadPath(id, 'messages'), { personId: state.me, text }), () => {
    state.ui.composer[id] = '';
    state.focusTarget = `#composer-${id}`;
  });
}

async function postAsk() {
  const title = state.ui.ask.title.trim();
  if (!title) {
    state.ui.notice = { text: 'Say what you need in a few words.', tone: 'error' };
    render();
    $('#a-title')?.focus();
    return;
  }
  const body = { personId: state.me, title, details: state.ui.ask.details.trim() };
  await mutate('ask', () => api('POST', '/api/requests', body), (res) => {
    setMock(Boolean(res.mock));
    state.ui.askResult = res;
    state.ui.ask = { title: '', details: '' };
    state.focusTarget = 'h1';
    announce(res.suggestions?.length ? 'Posted. Gemini found something that might fit.' : 'Posted.');
  });
}

/* ---------- give flow ---------- */

function resetGive() {
  clearTimeout(state.give.slowTimer);
  if (state.give.previewUrl) URL.revokeObjectURL(state.give.previewUrl);
  state.give = freshGive();
}

/* Source rectangle for one pile item: the box plus 6% of its size on each side, grown around its centre
   to at least 256 px a side (or the whole photo when it is smaller), kept inside the photo. No box: whole photo. */
function cropRect(box, w, h) {
  if (!box) return { sx: 0, sy: 0, sw: w, sh: h };
  const [y0, x0, y1, x1] = box.map((v) => v / 1000);
  const sw = Math.min(w, Math.max((x1 - x0) * w * (1 + 2 * CROP_PAD), MIN_CROP));
  const sh = Math.min(h, Math.max((y1 - y0) * h * (1 + 2 * CROP_PAD), MIN_CROP));
  const sx = Math.min(Math.max(0, ((x0 + x1) / 2) * w - sw / 2), w - sw);
  const sy = Math.min(Math.max(0, ((y0 + y1) / 2) * h - sh / 2), h - sh);
  return { sx: Math.floor(sx), sy: Math.floor(sy), sw: Math.floor(sw), sh: Math.floor(sh) };
}
console.assert(JSON.stringify(cropRect([500, 500, 600, 600], 1000, 1000)) === '{"sx":422,"sy":422,"sw":256,"sh":256}', 'crop: small box grows to 256 px');
console.assert(JSON.stringify(cropRect([0, 900, 500, 1000], 1000, 800)) === '{"sx":744,"sy":0,"sw":256,"sh":448}', 'crop: padding stays inside the photo');

// The crop as JPEG base64, at most 1024 px a side.
function cropToJpeg(bitmap, box) {
  const { sx, sy, sw, sh } = cropRect(box, bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
}

// The browser opens JPEG, PNG, WebP (and HEIC on Safari). Anything else goes to the server once and comes back as a
// JPEG blob, used from then on, for the preview too. Throws when neither side can open it.
async function decodeImage(file) {
  try {
    return { bitmap: await createImageBitmap(file), blob: file };
  } catch {
    const { jpegBase64 } = await api('POST', '/api/photos/convert', { imageBase64: await fileToBase64(file) });
    const blob = new Blob([Uint8Array.from(atob(jpegBase64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' });
    return { bitmap: await createImageBitmap(blob), blob };
  }
}
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});
const PHOTO_OPEN_ERROR = "This photo couldn't be opened here. Try a JPEG or PNG.";
const openError = (err) => (err?.code === 'unsupported_image' || err?.code === 'too_large' ? err.message : PHOTO_OPEN_ERROR);

// {imageBase64, blob}: the listing JPEG (at most 1024 px a side) and a blob the browser can show.
async function toJpegBase64(file) {
  const { bitmap, blob } = await decodeImage(file);
  try {
    return { imageBase64: cropToJpeg(bitmap, null), blob };
  } finally {
    bitmap.close?.();
  }
}

async function onPhoto(file) {
  if (!file) return;
  resetGive();
  const g = state.give;
  if (file.type && !file.type.startsWith('image/')) {
    g.error = "That file isn't a photo. Choose a JPEG, PNG, or WebP image.";
    render();
    return;
  }
  g.phase = 'uploading';
  render();
  announce('Uploading your photo…');
  try {
    const { imageBase64, blob } = await toJpegBase64(file);
    if (state.give !== g) return;
    Object.assign(g, { imageBase64, previewUrl: URL.createObjectURL(blob) });
  } catch (err) {
    if (state.give !== g) return;
    Object.assign(g, { phase: 'failed', error: openError(err), canRetry: false });
    render();
    return;
  }
  if (state.give === g) sendDraft();
}

function sendDraft() {
  const g = state.give;
  if (!g.imageBase64) return;
  const attempt = ++g.attempt;
  const current = () => state.give === g && g.attempt === attempt;
  Object.assign(g, { phase: 'uploading', slow: false, draft: null, aiError: null, error: '', checked: false });
  clearTimeout(g.slowTimer);
  g.slowTimer = setTimeout(() => {
    if (!current() || (g.phase !== 'uploading' && g.phase !== 'drafting')) return;
    g.slow = true;
    requestRender();
    announce('Taking longer than usual…');
  }, SLOW_MS);
  state.ui.notice = null;
  render();
  const body = { ownerId: state.me, imageBase64: g.imageBase64, mimeType: 'image/jpeg' };
  postDraft(body, () => {
    if (!current()) return;
    g.phase = 'drafting';
    requestRender();
    announce('Gemini is looking at your photo…');
  }).then((res) => {
    if (!current()) return;
    clearTimeout(g.slowTimer);
    setMock(Boolean(res.mock));
    Object.assign(g, { phase: 'review', photoId: res.photoId, draft: res.draft ?? null, aiError: res.aiError ?? null, form: formFromDraft(res.draft) });
    requestRender();
    announce(reviewAnnouncement(g));
  }, (err) => {
    if (!current()) return;
    clearTimeout(g.slowTimer);
    Object.assign(g, { phase: 'failed', error: err.message, canRetry: err.code === 'network' || err.code === 'timeout' || err.status >= 500 });
    requestRender();
    announce(err.message);
  });
}

function formFromDraft(d) {
  const usable = d && d.identified !== false && !d.notAllowed;
  return {
    title: usable ? String(d.title ?? '') : '',
    description: usable ? String(d.description ?? '') : '',
    condition: usable && CONDITIONS.includes(d.condition) ? d.condition : '',
    category: usable && CATEGORIES.includes(d.category) ? d.category : 'other',
    price: null, // free until "$" is picked
  };
}

function reviewAnnouncement(g) {
  if (g.draft?.notAllowed) return "This can't go on Loop.";
  if (isManual(g)) return "Gemini couldn't draft this. Fill in the details yourself.";
  const req = requestOf(g.draft.match?.requestId);
  return req ? "Gemini drafted the listing. It may fit someone's request. Check the details." : 'Gemini drafted the listing. Check the details.';
}

/* Editing any field or tapping "Looks right" turns the dashed Gemini draft into a solid, human-checked one. */
function markChecked() {
  const g = state.give;
  if (g.checked) return;
  g.checked = true;
  const card = $('#draft-card');
  if (!card?.classList.contains('is-draft')) return;
  card.classList.replace('is-draft', 'is-checked');
  document.querySelectorAll('[data-needs-check]').forEach((button) => { button.disabled = false; });
  $('#check-hint')?.remove();
  announce('Checked by you.');
}

async function publish(offerTo) {
  const g = state.give;
  const f = g.form;
  const title = f.title.trim();
  if (g.draft?.notAllowed || !g.photoId) return;
  if (!title) return giveProblem('Add a title so people know what it is.', '#f-title');
  if (!CONDITIONS.includes(f.condition)) return giveProblem('Pick a condition: good, fair, or worn.', '[name=condition]');
  const body = {
    ownerId: state.me,
    photoId: g.photoId,
    title,
    description: f.description.trim(),
    condition: f.condition,
    category: f.category,
    price: priceValue(f.price),
    aiDraft: isManual(g) ? null : g.draft, // the untouched Gemini draft, kept for the record
  };
  if (offerTo) body.offerToRequestId = offerTo;
  await mutate(`publish:${offerTo ?? 'board'}`, () => api('POST', '/api/items', body), (item) => {
    resetGive();
    announce(offerTo ? 'Offered.' : 'Posted to the board.');
    location.hash = `#/item/${item.id}`;
    return false;
  });
}

function giveProblem(text, focusSelector) {
  state.ui.notice = { text, tone: 'error' };
  render();
  $(focusSelector)?.focus();
  announce(text);
}

/* ---------- give flow: a pile ---------- */

function resetPile() {
  clearTimeout(state.pile.slowTimer);
  if (state.pile.previewUrl) URL.revokeObjectURL(state.pile.previewUrl);
  state.pile = freshPile();
}

function setGiveMode(mode) {
  if (state.giveMode === mode) return;
  state.giveMode = mode;
  resetGive();
  resetPile();
  state.ui.notice = null;
}

const onPicked = (file) => (state.giveMode === 'pile' ? onPilePhoto(file) : onPhoto(file));

async function onPilePhoto(file) {
  if (!file) return;
  resetPile();
  const p = state.pile;
  if (file.type && !file.type.startsWith('image/')) {
    p.error = "That file isn't a photo. Choose a JPEG, PNG, or WebP image.";
    render();
    return;
  }
  Object.assign(p, { file, phase: 'sorting' });
  render();
  try {
    const { imageBase64, blob } = await toJpegBase64(file);
    if (state.pile !== p) return;
    Object.assign(p, { imageBase64, file: blob, previewUrl: URL.createObjectURL(blob) }); // crops read the shown blob
  } catch (err) {
    if (state.pile !== p) return;
    Object.assign(p, { phase: 'failed', error: openError(err), canRetry: false });
    render();
    return;
  }
  if (state.pile === p) sendPile();
}

function sendPile() {
  const p = state.pile;
  if (!p.imageBase64) return;
  const attempt = ++p.attempt;
  const current = () => state.pile === p && p.attempt === attempt;
  Object.assign(p, { phase: 'sorting', slow: false, aiError: null, error: '', items: [] });
  clearTimeout(p.slowTimer);
  p.slowTimer = setTimeout(() => {
    if (!current() || p.phase !== 'sorting') return;
    p.slow = true;
    requestRender();
    announce('Taking longer than usual…');
  }, SLOW_MS);
  state.ui.notice = null;
  render();
  announce('Gemini is sorting the pile…');
  const body = { ownerId: state.me, imageBase64: p.imageBase64, mimeType: 'image/jpeg' };
  api('POST', '/api/items/pile', body).then((res) => {
    if (!current()) return;
    clearTimeout(p.slowTimer);
    setMock(Boolean(res?.mock));
    const items = res?.identified === false || !Array.isArray(res?.items) ? [] : res.items.slice(0, MAX_PILE).map(pileEntry);
    Object.assign(p, { phase: 'review', aiError: res?.aiError ?? null, items });
    requestRender();
    announce(p.aiError || !items.length ? "Gemini couldn't sort this pile." : `Gemini found ${items.length} things. Check each one, then list them.`);
  }, (err) => {
    if (!current()) return;
    clearTimeout(p.slowTimer);
    Object.assign(p, { phase: 'failed', error: err.message, canRetry: err.code === 'network' || err.status >= 500 });
    requestRender();
    announce(err.message);
  });
}

function validBox(box) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) return null;
  const [y0, x0, y1, x1] = box.map((v) => Math.min(1000, Math.max(0, v)));
  return y0 < y1 && x0 < x1 ? [y0, x0, y1, x1] : null;
}

function pileEntry(raw, i) {
  const text = (v) => (typeof v === 'string' ? v : '');
  return {
    n: i + 1,
    label: text(raw?.label),
    box: validBox(raw?.box), // no usable box: listed from the whole photo
    aiDraft: raw, // the untouched Gemini entry, kept on the item for the record
    title: text(raw?.title),
    description: text(raw?.description),
    condition: CONDITIONS.includes(raw?.condition) ? raw.condition : '',
    category: CATEGORIES.includes(raw?.category) ? raw.category : 'other',
    price: null, // free until "$" is picked
    conditionNotes: text(raw?.conditionNotes),
    notAllowed: text(raw?.notAllowed) || null,
    match: raw?.match ?? null,
    checked: !raw?.notAllowed,
    choice: raw?.match?.requestId ? 'offer' : 'board',
    photoId: '', // set once the crop is stored, so a retry never uploads it twice
    itemId: '', // set once listed, so a retry never lists it twice
    offeredTo: '',
    error: '',
  };
}

function pileProblem(it) {
  if (!it.title.trim()) return 'Add a title so people know what it is.';
  if (!CONDITIONS.includes(it.condition)) return 'Pick a condition: good, fair, or worn.';
  return '';
}

async function listPile() {
  const p = state.pile;
  const todo = p.items.filter(isPending);
  if (state.busy || !todo.length) return;
  todo.forEach((it) => { it.error = pileProblem(it); });
  const bad = todo.find((it) => it.error);
  if (bad) {
    render();
    const field = bad.title.trim() ? 'cond-0' : 'title';
    $(`#p${bad.n - 1}-${field}`)?.focus();
    announce(`Thing ${bad.n}: ${bad.error}`);
    return;
  }
  state.busy = 'pile';
  state.ui.notice = null;
  render();
  announce(`Listing ${todo.length} ${todo.length === 1 ? 'item' : 'items'}…`);
  const ownerId = state.me; // a reset mid-way gives this tab a new id: the rest must not list under it
  let bitmap = null;
  try {
    ({ bitmap } = await decodeImage(p.file));
  } catch {
    state.ui.notice = { text: "This photo couldn't be opened here. Try another photo.", tone: 'error' };
  }
  for (const it of bitmap ? todo : []) {
    if (state.pile !== p) break; // reset: stop here
    try {
      if (!it.photoId) {
        const crop = { ownerId, imageBase64: cropToJpeg(bitmap, it.box), mimeType: 'image/jpeg' };
        it.photoId = (await api('POST', '/api/photos', crop)).photoId;
      }
      const offer = it.choice === 'offer' ? pileMatch(it) : null;
      const body = {
        ownerId, photoId: it.photoId, title: it.title.trim(), description: it.description.trim(),
        condition: it.condition, category: it.category, price: priceValue(it.price), aiDraft: it.aiDraft,
      };
      if (offer) body.offerToRequestId = offer.id;
      const item = await api('POST', '/api/items', body);
      Object.assign(it, { itemId: item.id, offeredTo: offer?.personId ?? '', error: '' });
    } catch (err) {
      it.error = err.message;
    }
    if (state.pile === p) render(); // progress: listed cards turn into "Listed" one by one
  }
  bitmap?.close?.();
  state.busy = '';
  await refresh();
  if (state.pile !== p) return;
  const left = p.items.filter(isPending);
  if (!left.length) return finishPile();
  render();
  const listed = p.items.filter((it) => it.itemId).length;
  announce(`${listed} listed. ${left.length} didn't go through: the reason is under each one. Fix it and list again.`);
}

function finishPile() {
  const done = state.pile.items.filter((it) => it.itemId);
  const offered = done.filter((it) => it.offeredTo);
  const text = `${done.length} ${done.length === 1 ? 'item' : 'items'} listed${offered.length ? ` · ${offered.length} offered` : ''}`;
  resetPile();
  location.hash = '#/';
  showToast(text);
  announce(text);
}

let toastTimer = 0;
function showToast(text) {
  const toast = $('#toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}

/* ---------- events ---------- */

const actions = {
  reset: resetDemo,
  'remove-request': (el) => removeRequest(el.dataset.id),
  'toggle-need': (el) => { // focus stays on the card: render() restores it by id
    const open = state.ui.needOpen;
    if (!open.delete(el.dataset.id)) open.add(el.dataset.id);
    render();
  },
  'toggle-needs': () => {
    state.ui.needsAll = !state.ui.needsAll;
    render();
  },
  'open-reserve': () => {
    state.ui.reserveOpen = true;
    state.ui.notice = null;
    state.focusTarget = '#pick-place-0';
    render();
  },
  'close-reserve': () => {
    state.ui.reserveOpen = false;
    state.focusTarget = '#open-reserve';
    render();
  },
  'thread-action': (el) => threadAction(el.dataset.thread, el.dataset.kind),
  'close-propose': () => {
    state.ui.propose = null;
    state.ui.notice = null;
    state.focusTarget = '#thread-title';
    render();
  },
  'give-mode': (el) => {
    setGiveMode(el.dataset.mode);
    state.focusTarget = `#mode-${el.dataset.mode}`;
    render();
  },
  'price-mode': (el) => {
    const pile = el.dataset.scope === 'pile';
    const target = pile ? state.pile.items[Number(el.dataset.index)] : state.give.form;
    if (!target) return;
    const paid = el.dataset.mode === 'paid';
    target.price = paid ? (target.price ?? '') : null;
    if (!pile) markChecked();
    state.focusTarget = `#${pile ? `p${el.dataset.index}-` : 'f-'}price${paid ? '' : '-free'}`;
    render();
  },
  'pile-list': listPile,
  'pile-finish': finishPile,
  'pile-as-one': () => {
    const { file } = state.pile;
    setGiveMode('one');
    onPhoto(file);
  },
  decline: () => itemAction('decline'),
  release: () => itemAction('release'),
  withdraw: () => itemAction('withdraw'),
  repost: () => mutate('repost', () => api('POST', itemPath('repost'), { personId: state.me }), (item) => {
    announce('Passed on. It is back on the board.');
    location.hash = `#/item/${item.id}`;
    return false;
  }),
  approve: () => {
    markChecked();
    $('[data-needs-check]')?.focus();
  },
  publish: (el) => publish(el.dataset.offer || null),
  retry: () => (state.giveMode === 'pile' ? sendPile() : sendDraft()),
  'new-photo': () => {
    resetGive();
    resetPile();
    state.focusTarget = '#photo-input';
    render();
  },
  'ask-again': () => {
    state.ui.askResult = null;
    state.focusTarget = 'h1';
    render();
  },
};

const forms = {
  phone: () => submitPhone(),
  reserve: (form) => reserveItem(form.dataset.request || null),
  confirm: confirmHandoff,
  ask: postAsk,
  publish: () => (isManual(state.give) ? publish(null) : actions.approve()), // Enter never publishes a Gemini draft
  propose: submitPropose,
  message: sendMessage,
};

function bindPile(el) {
  const it = state.pile.items[Number(el.dataset.index)];
  const field = el.dataset.field || el.name;
  if (!it || !(field in it)) return;
  it[field] = el.type === 'checkbox' ? el.checked : el.value;
  if (field === 'checked') render(); // shows or hides the card's fields and updates "List N items"
}

function bind(el) {
  const scope = el.dataset?.scope;
  if (scope === 'pile') return bindPile(el); // pile checkboxes carry data-field, not a name
  if (!scope || !el.name) return;
  if (scope === 'code') {
    el.value = el.value.replace(/\D/g, '').slice(0, 4);
    state.ui.code = el.value;
    return;
  }
  const target = scope === 'give' ? state.give.form : state.ui[scope];
  if (!target) return;
  target[el.name] = el.value;
  if (scope === 'give') markChecked();
}

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  const run = el && actions[el.dataset.action];
  if (!run || el.disabled) return;
  event.preventDefault();
  run(el);
});
document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  forms[form.dataset.form]?.(form);
});
document.addEventListener('input', (event) => bind(event.target));
document.addEventListener('change', (event) => {
  if (event.target.id === 'photo-input') onPicked(event.target.files?.[0]);
});
/* The composer sends on Enter; Shift+Enter is a new line, and IME composition is never cut short. */
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || !event.target.matches?.('.composer-input')) return;
  event.preventDefault();
  event.target.form?.requestSubmit();
});

/* Drop a photo anywhere on the give screen. */
const canDrop = () => hasMe() && state.route.name === 'give' && (state.giveMode === 'pile' ? state.pile : state.give).phase === 'pick';
for (const type of ['dragenter', 'dragover']) {
  document.addEventListener(type, (event) => {
    if (!canDrop()) return;
    event.preventDefault();
    $('#drop')?.classList.add('is-over');
  });
}
document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) $('#drop')?.classList.remove('is-over');
});
document.addEventListener('drop', (event) => {
  if (!canDrop()) return;
  event.preventDefault();
  $('#drop')?.classList.remove('is-over');
  onPicked(event.dataTransfer?.files?.[0]);
});

/* A poll that landed while someone was typing renders as soon as they leave the field. */
view.addEventListener('focusout', () => setTimeout(flushRender));
addEventListener('hashchange', onRouteChange);

/* ---------- start ---------- */

render();
api('GET', '/api/health').then((health) => {
  setMock(Boolean(health?.mock));
  state.health = {
    imessage: health?.imessage === true,
    linkedPhones: Array.isArray(health?.linkedPhones) ? health.linkedPhones : [],
    lineNumber: typeof health?.lineNumber === 'string' && health.lineNumber ? health.lineNumber : null,
  };
  if (state.health.imessage || state.health.lineNumber) requestRender();
}).catch(() => { /* no health route: rely on per-response flags */ });
pollLoop();
