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
const PLACES = ['Davis Library lobby', 'Student Union', 'Dorm front desk'];
const TIMES = ['Today 5 pm', 'Today 8 pm', 'Tomorrow noon'];
const CONDITIONS = ['good', 'fair', 'worn'];
const CATEGORIES = ['furniture', 'lighting', 'kitchen', 'textbooks', 'electronics', 'clothing', 'bedding', 'sports', 'other'];
const AVATAR_COLORS = { maya: '#0d6fc0', sam: '#6a4fe0', priya: '#1b7f45' };
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
const NOT_IDENTIFIED = "Gemini couldn't pick out one clear thing to give away. Try a closer photo of a single item, or fill this in yourself.";
const DONE_TEXT = {
  decline: "You said no thanks. It's back on the board.",
  release: "Reservation cancelled. It's back on the board.",
  withdraw: "You took it back. It's off the board.",
};

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
  gift: '<path d="M4 11h16v9H4z"/><path d="M3 7.5h18V11H3zM12 7.5V20"/><path d="M12 7.5C10.5 4 7 4 7 6s3 1.5 5 1.5zM12 7.5C13.5 4 17 4 17 6s-3 1.5-5 1.5z"/>',
};
const icon = (name, cls = 'i') => raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`);

/* ---------- state ---------- */

const $ = (selector) => document.querySelector(selector);
const view = $('#view');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const freshUi = () => ({
  notice: null, // { text, tone } for the current view
  reserveOpen: false,
  reserve: { place: PLACES[0], time: TIMES[0] },
  code: '',
  codeError: '',
  codeAlert: false, // a fresh wrong code: focus + shake once
  revealCode: '', // item id whose pickup code scales in once
  ask: { title: '', details: '' },
  askResult: null,
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

const state = {
  db: null,
  online: true,
  mock: false,
  me: loadMe(),
  route: parseRoute(),
  busy: '',
  pendingRender: false,
  focusTarget: '',
  ui: freshUi(),
  give: freshGive(),
  seenCollected: new Set(),
};

function loadMe() {
  try { return sessionStorage.getItem('loop.person'); } catch { return null; }
}
function saveMe(id) {
  try { sessionStorage.setItem('loop.person', id); } catch { /* private mode: identity stays in memory */ }
}

const person = (id) => state.db?.people.find((p) => p.id === id) ?? { id, name: 'Someone', spot: '' };
const firstName = (id) => person(id).name.split(' ')[0];
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

function announce(text) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 40);
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
    const changed = !state.db || db.version !== state.db.version;
    state.db = db;
    return changed;
  } catch {
    setOnline(false);
    return false;
  }
}
async function pollLoop() {
  if (await refresh()) requestRender();
  setTimeout(pollLoop, POLL_MS);
}
function setOnline(online) {
  if (state.online === online) return;
  state.online = online;
  $('#net').hidden = online;
  announce(online ? 'Back online.' : "Can't reach Loop. Retrying…");
  if (!state.db) render();
}
function setMock(on) {
  if (!on || state.mock) return;
  state.mock = true;
  $('#mock').hidden = false;
}

/* ---------- render ---------- */

function isTyping() {
  const el = document.activeElement;
  return Boolean(el && view.contains(el) && el.matches('input:not([type=file]):not([type=radio]), textarea, select'));
}
function requestRender() {
  if (isTyping()) state.pendingRender = true;
  else render();
}

function render() {
  state.pendingRender = false;
  if (state.db && state.me && !state.db.people.some((p) => p.id === state.me)) state.me = null;
  const focusId = view.contains(document.activeElement) ? document.activeElement.id : '';
  renderWho();
  view.innerHTML = String(currentView());
  document.title = pageTitle();
  const target = state.focusTarget ? view.querySelector(state.focusTarget) : focusId && document.getElementById(focusId);
  state.focusTarget = '';
  if (target) {
    if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
  afterRender();
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
  if (!state.db || !state.me) return 'Loop';
  const { name, id } = state.route;
  if (name === 'give') return 'Give something · Loop';
  if (name === 'ask') return 'Ask for something · Loop';
  if (name === 'item') return `${itemOf(id)?.title ?? 'Not found'} · Loop`;
  return 'Board · Loop';
}

function currentView() {
  if (!state.db) return state.online ? loadingView() : offlineView();
  if (!state.me) return pickerView();
  const { name, id } = state.route;
  if (name === 'give') return giveView();
  if (name === 'ask') return askView();
  if (name === 'item') return itemView(id);
  return boardView();
}

/* ---------- shared pieces ---------- */

const initials = (name) => name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase();
const avatar = (p) => html`<span class="avatar" style="background-color:${AVATAR_COLORS[p.id] ?? '#3d5a78'}" aria-hidden="true">${initials(p.name)}</span>`;
const condChip = (c) => html`<span class="chip">${COND_LABEL[c] ?? 'Condition not set'}</span>`;
const statusChip = (item) => html`<span class="chip dot chip-${item.status}">${STATUS_LABEL[item.status] ?? item.status}</span>`;
const requestChip = (r) => html`<span class="chip dot chip-${r.status}">${REQUEST_LABEL[r.status] ?? r.status}</span>`;
const noticeBlock = () => (state.ui.notice ? html`<p class="notice ${state.ui.notice.tone}">${state.ui.notice.text}</p>` : '');
const backLink = () => html`<a class="back" href="#/">${icon('back')} Board</a>`;

let whoKey = '';
function renderWho() {
  const me = state.db && state.me ? person(state.me) : null;
  const key = me ? JSON.stringify([me.id, state.db.people]) : '';
  if (key === whoKey) return;
  whoKey = key;
  $('#who').innerHTML = me ? String(whoMarkup(me)) : '';
  $('#who-menu')?.addEventListener('beforetoggle', placeMenu);
}
const whoMarkup = (me) => html`
  <button class="who-btn" id="who-btn" popovertarget="who-menu">You're <strong>${firstName(me.id)}</strong>${icon('chevron')}<span class="sr-only">, switch person</span></button>
  <div class="menu" id="who-menu" popover>
    <p class="menu-title">Switch person</p>
    ${state.db.people.map((p) => html`
      <button class="menu-item" data-action="pick-person" data-id="${p.id}" ${p.id === me.id ? raw('aria-current="true"') : ''}>
        ${avatar(p)}
        <span class="menu-text"><strong>${p.name}</strong><span class="small muted">${p.spot}</span></span>
        ${p.id === me.id ? icon('check') : ''}
      </button>`)}
  </div>`;
function placeMenu(event) {
  if (event.newState !== 'open') return;
  const box = $('#who-btn').getBoundingClientRect();
  event.currentTarget.style.top = `${Math.round(box.bottom + 8)}px`;
  event.currentTarget.style.right = `${Math.max(8, Math.round(document.documentElement.clientWidth - box.right))}px`;
}

/* ---------- views: first run, loading ---------- */

const loadingView = () => html`<div class="glass card loading"><span class="spinner" aria-hidden="true"></span><h1>Loading Loop…</h1></div>`;
const offlineView = () => html`<section class="glass card stack-sm"><h1>Can't reach Loop</h1><p class="muted">Retrying every few seconds. If this keeps up, check that the Loop server is running.</p></section>`;

const pickerView = () => html`<div class="stack">
  <section class="hero glass">
    <h1>Pass it on.</h1>
    <p class="lead">Loop helps students hand usable things to people nearby who need them. Snap a photo, Gemini drafts the listing, you check it, then you meet up to hand it over.</p>
  </section>
  <section class="glass card" aria-labelledby="pick-title">
    <h2 id="pick-title">Who are you?</h2>
    <p class="muted small">This demo has three students. Each browser tab is one person, so open a second tab to play the other side.</p>
    <ul class="list people">${state.db.people.map((p) => html`
      <li><button class="menu-item person-pick" id="pick-${p.id}" data-action="pick-person" data-id="${p.id}">
        ${avatar(p)}<span class="menu-text"><strong>${p.name}</strong><span class="small muted">${p.spot}</span></span>${icon('next')}
      </button></li>`)}</ul>
  </section>
</div>`;

/* ---------- views: board ---------- */

function bannerFor(item) {
  if (item.status === 'offered' && requestOf(item.offeredToRequestId)?.personId === state.me) return `${firstName(item.ownerId)} offered you this`;
  if (item.status !== 'reserved' || !item.reservation) return '';
  if (item.reservation.personId === state.me) return 'You reserved this · your pickup code is inside';
  if (item.ownerId === state.me) return `${firstName(item.reservation.personId)} reserved this · confirm at pickup`;
  return '';
}

function boardView() {
  const { requests, items } = state.db;
  const needs = requests.filter((r) => r.status === 'open' || r.status === 'matched').sort(newest);
  const live = items.filter((i) => i.status !== 'withdrawn' && i.status !== 'collected').sort(newest);
  const forYou = live.filter((i) => bannerFor(i));
  const grabs = live.filter((i) => !bannerFor(i));
  const kept = items.filter((i) => i.status === 'collected').length;
  return html`<div class="stack">
    <section class="hero glass">
      <h1>Hi, ${firstName(state.me)}</h1>
      <p class="lead">Give what you don't need. Ask for what you do.</p>
      <div class="actions hero-actions">
        <a class="btn btn-primary" href="#/give">${icon('camera')} Give something</a>
        <a class="btn btn-secondary" href="#/ask">${icon('ask')} Ask for something</a>
      </div>
    </section>
    ${forYou.length ? html`<section class="stack-sm" aria-labelledby="h-you"><h2 id="h-you" class="section-title">For you</h2><ul class="list">${forYou.map(forYouCard)}</ul></section>` : ''}
    <section class="stack-sm" aria-labelledby="h-needs">
      <h2 id="h-needs" class="section-title">People need</h2>
      ${needs.length ? html`<ul class="list">${needs.map(needCard)}</ul>` : html`<p class="empty glass">No open requests right now.</p>`}
    </section>
    <section class="stack-sm" aria-labelledby="h-grabs">
      <h2 id="h-grabs" class="section-title">Up for grabs</h2>
      ${grabs.length ? html`<ul class="grid">${grabs.map(itemCard)}</ul>` : html`<p class="empty glass">Nothing up for grabs yet. Got something you don't use? Give it.</p>`}
    </section>
    <footer class="foot">
      ${kept ? html`<span>${kept} ${kept === 1 ? 'item' : 'items'} kept in use</span><span aria-hidden="true">·</span>` : ''}
      <button class="btn btn-ghost btn-small" id="reset" data-action="reset">${busyText('reset', 'Reset demo', 'Resetting…')}</button>
    </footer>
  </div>`;
}

function forYouCard(item) {
  const offered = item.status === 'offered';
  const from = item.ownerId === state.me ? 'Your listing' : `from ${firstName(item.ownerId)} · ${person(item.ownerId).spot}`;
  return html`<li><a class="foryou glass ${offered ? 'is-offered' : 'is-reserved'}" href="#/item/${item.id}">
    <span class="banner">${icon(offered ? 'gift' : 'pin')}${bannerFor(item)}</span>
    <span class="foryou-row">
      <img src="${item.photo}" alt="" style="view-transition-name:${vtName(item.id)}">
      <span class="foryou-text"><span class="foryou-title">${item.title}</span><span class="small muted">${from}</span></span>
      ${icon('next')}
    </span>
  </a></li>`;
}

const itemCard = (item) => html`<li><a class="item-card glass" href="#/item/${item.id}">
  <img class="thumb" src="${item.photo}" alt="" loading="lazy" style="view-transition-name:${vtName(item.id)}">
  <div class="item-body"><h3 class="item-title">${item.title}</h3><div class="chips">${condChip(item.condition)}${statusChip(item)}</div></div>
</a></li>`;

function needCard(r) {
  const p = person(r.personId);
  const mine = r.personId === state.me;
  return html`<li class="need glass">
    ${avatar(p)}
    <div>
      <p class="need-meta"><strong>${mine ? 'You' : p.name}</strong> · ${p.spot} · <time datetime="${r.createdAt}">${timeAgo(r.createdAt)}</time></p>
      <h3>${r.title}</h3>
      ${r.details ? html`<p class="need-details">${r.details}</p>` : ''}
      <div class="need-foot">${requestChip(r)}${mine && r.status === 'open' ? html`<button class="btn btn-ghost btn-small" id="remove-${r.id}" data-action="remove-request" data-id="${r.id}">Remove<span class="sr-only"> request: ${r.title}</span></button>` : ''}</div>
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
  const owner = person(item.ownerId);
  const ownerName = mine ? 'you' : firstName(item.ownerId);
  return html`<div class="stack">
    ${backLink()}
    <figure class="photo-frame glass detail-photo"><img src="${item.photo}" alt="Photo of ${item.title}" style="view-transition-name:${vtName(item.id)}"></figure>
    <section class="glass card detail-head">
      <div class="chips">${condChip(item.condition)}${statusChip(item)}</div>
      <h1>${item.title}</h1>
      <p class="from">from <strong>${ownerName}</strong> · ${owner.spot}</p>
      ${item.description ? html`<p class="desc">${item.description}</p>` : ''}
      ${item.aiDraft ? html`<p class="provenance">${icon('sparkle')} Gemini drafted this listing. ${cap(ownerName)} checked it.</p>` : ''}
    </section>
    ${item.status === 'withdrawn' ? '' : timeline(item)}
    <section class="glass card action" aria-labelledby="action-title">${actionArea(item)}</section>
  </div>`;
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
    return req?.personId === state.me ? reserveBlock(item, req) : offeredElsewhereBlock(item, req, mine);
  }
  if (item.status === 'reserved') {
    if (res?.personId === state.me) return recipientBlock(item);
    if (mine) return ownerReservedBlock(item);
    return html`<h2 id="action-title">Reserved by ${firstName(res?.personId)}</h2>
      <p class="muted">It's spoken for. Check the board for other things up for grabs.</p>${noticeBlock()}`;
  }
  if (item.status === 'collected') return collectedBlock(item);
  return html`<h2 id="action-title">${mine ? 'You took this back' : `${firstName(item.ownerId)} took this back`}</h2>
    <p class="muted">It's no longer up for grabs.</p>${noticeBlock()}`;
}

const withdrawButton = () => html`<div class="actions"><button class="btn btn-ghost" id="withdraw" data-action="withdraw">${busyText('withdraw', 'Take it back', 'Taking it back…')}</button></div>`;

const ownerWaitingBlock = () => html`<h2 id="action-title">On the board</h2>
  <p class="muted">Anyone can reserve it. Their pickup place and time will show up here.</p>
  ${noticeBlock()}${withdrawButton()}`;

function offeredElsewhereBlock(item, req, mine) {
  const who = firstName(req?.personId);
  const text = mine
    ? `Waiting for ${who} to accept. If they say no thanks, it goes on the board.`
    : `${firstName(item.ownerId)} offered this to ${who} for their request.`;
  return html`<h2 id="action-title">Offered to ${who}</h2><p class="muted">${text}</p>${noticeBlock()}${mine ? withdrawButton() : ''}`;
}

function reserveBlock(item, offeredReq) {
  const owner = firstName(item.ownerId);
  if (!state.ui.reserveOpen) {
    if (offeredReq) {
      return html`<h2 id="action-title">${owner} offered you this</h2>
        <p class="muted">For your request: <em>${offeredReq.title}</em>. Accept to pick a time and place, or say no thanks and it goes back on the board.</p>
        ${noticeBlock()}
        <div class="actions">
          <button class="btn btn-primary" id="open-reserve" data-action="open-reserve">Accept &amp; reserve</button>
          <button class="btn btn-secondary" id="decline" data-action="decline">${busyText('decline', 'No thanks', 'Saying no…')}</button>
        </div>`;
    }
    return html`<h2 id="action-title">Want it?</h2>
      <p class="muted">Reserve it and pick where to meet ${owner}. You'll get a pickup code to show at the handoff.</p>
      ${noticeBlock()}
      <div class="actions"><button class="btn btn-primary btn-block" id="open-reserve" data-action="open-reserve">Reserve</button></div>`;
  }
  const { place, time } = state.ui.reserve;
  const pick = (field, value, i, current) => html`<button type="button" class="pick" id="pick-${field}-${i}" data-action="pick" data-field="${field}" data-value="${value}" aria-pressed="${String(value === current)}">${icon('check', 'tick')}${value}</button>`;
  return html`<form class="stack-sm" data-form="reserve" data-request="${offeredReq?.id ?? ''}" novalidate>
    <h2 id="action-title">Where and when?</h2>
    <fieldset class="field">
      <legend class="label">Meet at</legend>
      <div class="picks">${PLACES.map((v, i) => pick('place', v, i, place))}</div>
      <label class="sr-only" for="place-input">Or type a place</label>
      <input id="place-input" class="input" name="place" data-scope="reserve" maxlength="60" autocomplete="off" placeholder="Or type a place" value="${place}">
    </fieldset>
    <fieldset class="field">
      <legend class="label">Time</legend>
      <div class="picks">${TIMES.map((v, i) => pick('time', v, i, time))}</div>
      <label class="sr-only" for="time-input">Or type a time</label>
      <input id="time-input" class="input" name="time" data-scope="reserve" maxlength="40" autocomplete="off" placeholder="Or type a time" value="${time}">
    </fieldset>
    ${noticeBlock()}
    <div class="actions">
      <button class="btn btn-primary" type="submit" id="reserve-submit">${busyText('reserve', offeredReq ? 'Accept & reserve' : 'Reserve', 'Reserving…')}</button>
      <button class="btn btn-ghost" type="button" data-action="close-reserve">Cancel</button>
    </div>
  </form>`;
}

function recipientBlock(item) {
  const res = item.reservation;
  return html`<h2 id="action-title">Your pickup code</h2>
    <p class="code ${state.ui.revealCode === item.id ? 'reveal' : ''}"><span aria-hidden="true">${res.code}</span><span class="sr-only">${spaced(res.code)}</span></p>
    <p class="center">Show this code to <strong>${firstName(item.ownerId)}</strong> at pickup.</p>
    <dl class="meet"><div><dt>Where</dt><dd>${res.place}</dd></div><div><dt>When</dt><dd>${res.time}</dd></div></dl>
    ${noticeBlock()}
    <div class="actions"><button class="btn btn-secondary" id="release" data-action="release">${busyText('release', 'Cancel reservation', 'Cancelling…')}</button></div>`;
}

function ownerReservedBlock(item) {
  const res = item.reservation;
  const who = firstName(res.personId);
  const error = state.ui.codeError;
  return html`<h2 id="action-title">Hand it over</h2>
    <p class="muted">Reserved by <strong>${who}</strong> · ${res.place} · ${res.time}</p>
    <form data-form="confirm" novalidate>
      <div class="field">
        <label class="label" for="code-input">${who}'s pickup code</label>
        <input id="code-input" class="input code-input" name="code" data-scope="code" inputmode="numeric" autocomplete="one-time-code" value="${state.ui.code}" aria-describedby="code-help" ${error ? raw('aria-invalid="true"') : ''}>
        <p id="code-help" class="${error ? 'error' : 'hint'}">${error || `${who} has a 4-digit code on their screen. Type it in when you meet.`}</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary" type="submit" id="confirm-submit">${busyText('confirm', 'Confirm handoff', 'Checking…')}</button>
        <button class="btn btn-ghost" type="button" id="release" data-action="release">${busyText('release', 'Release', 'Releasing…')}</button>
      </div>
    </form>
    ${noticeBlock()}`;
}

function collectedBlock(item) {
  const animate = !state.seenCollected.has(item.id); // the success ripple plays once per tab
  state.seenCollected.add(item.id);
  const who = item.reservation?.personId;
  const label = who ? `Collected by ${who === state.me ? 'you' : firstName(who)}` : 'Collected';
  return html`<div class="success ${animate ? 'animate' : ''}">
      <span class="check-badge">${icon('check')}</span>
      <div><h2 id="action-title">${label}</h2><p class="muted">${formatTime(stampFormat, item.collectedAt)}</p></div>
    </div>
    <p class="muted thanks">Handed over and kept in use.</p>`;
}

/* ---------- views: give ---------- */

function giveView() {
  const g = state.give;
  const head = html`${backLink()}<h1>Give something</h1>`;
  if (g.phase === 'pick') {
    return html`<div class="stack">${head}${g.error ? html`<p class="notice error">${g.error}</p>` : ''}${dropZone()}</div>`;
  }
  const busy = g.phase === 'uploading' || g.phase === 'drafting';
  let body = reviewCards(g);
  if (busy) body = draftingCard(g);
  else if (g.phase === 'failed') body = failedCard(g);
  // The failure cards carry their own "Try another photo"; a good draft needs a way out too.
  const swap = g.phase === 'review' && !isManual(g) && !g.draft.notAllowed
    ? html`<div class="swap"><button class="btn btn-ghost btn-small" id="new-photo" data-action="new-photo">${icon('camera')} Use a different photo</button></div>`
    : '';
  return html`<div class="stack">${head}
    <figure class="photo-frame glass ${busy ? 'is-busy' : ''}"><img src="${g.previewUrl}" alt="Your photo"></figure>
    ${swap}${body}
  </div>`;
}

const dropZone = () => html`
  <input id="photo-input" class="sr-only" type="file" accept="image/*" capture="environment">
  <label class="drop glass" id="drop" for="photo-input">
    <span class="drop-orb" aria-hidden="true">${icon('camera')}</span>
    <span class="drop-title">Take or choose a photo</span>
    <span class="muted">One thing per photo works best. Gemini drafts the listing, you check it, and nothing goes up until you say so.</span>
    <span class="btn btn-primary" aria-hidden="true">Choose a photo</span>
  </label>`;

const draftingCard = (g) => html`<section class="glass card">
  <p class="status-line"><span class="spinner" aria-hidden="true"></span>${g.phase === 'uploading' ? 'Uploading your photo…' : 'Gemini is looking at your photo…'}</p>
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
    : html`<p class="tag tag-ai">${icon('sparkle')} Drafted by Gemini — check it</p><p class="tag tag-human">${icon('check')} Checked by ${firstName(state.me)}</p>`;
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
    ${manual
      ? html`${noticeBlock()}<div class="actions"><button class="btn btn-primary btn-block" type="submit" id="publish-board">${busyText('publish:board', 'Post to board', 'Posting…')}</button></div>`
      : html`<div class="actions"><button type="button" class="btn btn-secondary approve" id="approve" data-action="approve">${icon('check')} Looks right</button></div>`}
  </form>`;
}

function matchCard(g) {
  const m = g.draft?.match;
  const req = m?.requestId ? requestOf(m.requestId) : null;
  const lock = g.checked ? '' : raw('disabled');
  const hint = g.checked ? '' : html`<p class="hint" id="check-hint">Check the details above first: fix anything that's off, or tap <strong>Looks right</strong>.</p>`;
  const board = (label) => html`<button class="btn ${label === 'Post to board' ? 'btn-primary' : 'btn-secondary'}" id="publish-board" data-action="publish" data-offer="" data-needs-check ${lock}>${busyText('publish:board', label, 'Posting…')}</button>`;
  if (!req || req.status !== 'open' || req.personId === state.me) {
    return html`<section class="glass card match" aria-labelledby="match-title">
      <h2 id="match-title">No open request fits yet.</h2>
      ${m?.reason ? html`<p class="note">${icon('sparkle')}<span>Gemini: ${m.reason}</span></p>` : ''}
      ${hint}${noticeBlock()}
      <div class="actions">${board('Post to board')}</div>
    </section>`;
  }
  const who = firstName(req.personId);
  return html`<section class="glass card match ai-box" aria-labelledby="match-title">
    <p class="tag tag-ai">${icon('sparkle')} Gemini's suggestion</p>
    <h2 id="match-title">Fits <strong>${who}</strong>'s request: <em>${req.title}</em></h2>
    ${m.reason ? html`<p class="muted">${m.reason}</p>` : ''}
    ${hint}${noticeBlock()}
    <div class="actions">
      <button class="btn btn-primary" id="publish-offer" data-action="publish" data-offer="${req.id}" data-needs-check ${lock}>${busyText(`publish:${req.id}`, `Offer to ${who}`, 'Offering…')}</button>
      ${board('Post to board instead')}
    </div>
  </section>`;
}

/* ---------- views: ask ---------- */

function askView() {
  const result = state.ui.askResult;
  if (result) return askDoneView(result);
  const { title, details } = state.ui.ask;
  return html`<div class="stack">
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
      <p class="note">${icon('pin')}<span>Pickup near ${person(state.me).spot}, from your profile.</span></p>
      ${state.ui.notice ? html`<div class="field">${noticeBlock()}</div>` : ''}
      <div class="actions"><button class="btn btn-primary btn-block" type="submit" id="ask-submit">${busyText('ask', 'Post', 'Posting…')}</button></div>
    </form>
  </div>`;
}

function askDoneView(result) {
  const suggestions = (result.suggestions ?? []).map((s) => ({ ...s, item: itemOf(s.itemId) })).filter((s) => s.item);
  return html`<div class="stack">
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
            <div><p><strong>${firstName(item.ownerId)}</strong>'s <em>${item.title}</em> might fit</p>${reason ? html`<p class="muted small">${reason}</p>` : ''}</div>
            <a class="btn btn-secondary btn-small" href="#/item/${item.id}">View<span class="sr-only"> ${item.title}</span></a>
          </li>`)}</ul>
        </section>`
      : html`<p class="glass card muted">You'll see it on the board; owners get your request when they photograph something.</p>`}
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
  // onDone returns false when it navigates away; the route change renders, so the old view never shows stale data.
  if (result && onDone?.(result) === false) return result;
  render();
  return result;
}

function showError(err) {
  if (err.code === 'wrong_code') {
    state.ui.codeError = err.message;
    state.ui.codeAlert = true;
  } else {
    if (err.status === 409) {
      state.ui.reserveOpen = false;
      state.focusTarget = '#action-title';
    }
    state.ui.notice = { text: err.message, tone: err.status === 409 ? 'warn' : 'error' };
  }
  announce(err.message);
}

function pickPerson(id) {
  if (!state.db?.people.some((p) => p.id === id)) return;
  state.me = id;
  saveMe(id);
  state.ui = freshUi();
  resetGive();
  state.focusTarget = 'h1';
  render();
  announce(`You're now ${person(id).name}.`);
}

async function resetDemo() {
  if (!confirm('Reset the demo? Every item and request goes back to the starting set.')) return;
  const done = await mutate('reset', () => api('POST', '/api/reset'));
  if (!done) return;
  resetGive();
  state.seenCollected.clear();
  announce('Demo reset.');
}

async function removeRequest(id) {
  if (!confirm('Remove your request from the board?')) return;
  await mutate('remove', () => api('DELETE', `/api/requests/${encodeURIComponent(id)}`, { personId: state.me }), () => announce('Request removed.'));
}

const itemPath = (action) => `/api/items/${encodeURIComponent(state.route.id)}/${action}`;

async function reserveItem(requestId) {
  const place = state.ui.reserve.place.trim();
  const time = state.ui.reserve.time.trim();
  if (!place || !time) {
    state.ui.notice = { text: 'Pick a place and a time to meet.', tone: 'error' };
    render();
    return;
  }
  const body = { personId: state.me, place, time };
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
    const who = firstName(itemOf(state.route.id)?.reservation?.personId);
    state.ui.codeError = `Type the 4-digit code from ${who}'s screen.`;
    state.ui.codeAlert = true;
    render();
    announce(state.ui.codeError);
    return;
  }
  state.ui.codeError = '';
  await mutate('confirm', () => api('POST', itemPath('confirm'), { personId: state.me, code }), (item) => {
    state.ui.code = '';
    state.focusTarget = '#action-title';
    announce(`Handoff confirmed. Collected by ${firstName(item.reservation?.personId)}.`);
  });
}

function confirmQuestion(kind, item) {
  if (kind === 'withdraw') return 'Take this back? It comes off the board.';
  if (kind !== 'release') return '';
  if (item?.reservation?.personId === state.me) return 'Cancel your reservation? It goes back on the board.';
  return `Release ${firstName(item?.reservation?.personId)}'s reservation? Their code stops working and it goes back on the board.`;
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

async function toJpegBase64(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
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
  g.previewUrl = URL.createObjectURL(file);
  g.phase = 'uploading';
  render();
  announce('Uploading your photo…');
  try {
    g.imageBase64 = await toJpegBase64(file);
  } catch {
    if (state.give !== g) return;
    Object.assign(g, { phase: 'failed', error: "This photo couldn't be opened here. Try a JPEG or PNG.", canRetry: false });
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
  };
}

function reviewAnnouncement(g) {
  if (g.draft?.notAllowed) return "This can't go on Loop.";
  if (isManual(g)) return "Gemini couldn't draft this. Fill in the details yourself.";
  const req = requestOf(g.draft.match?.requestId);
  return req ? `Gemini drafted the listing. It may fit ${firstName(req.personId)}'s request. Check the details.` : 'Gemini drafted the listing. Check the details.';
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
  announce(`Checked by ${firstName(state.me)}.`);
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
    aiDraft: isManual(g) ? null : g.draft, // the untouched Gemini draft, kept for the record
  };
  if (offerTo) body.offerToRequestId = offerTo;
  const who = offerTo ? firstName(requestOf(offerTo)?.personId) : '';
  await mutate(`publish:${offerTo ?? 'board'}`, () => api('POST', '/api/items', body), (item) => {
    resetGive();
    announce(offerTo ? `Offered to ${who}.` : 'Posted to the board.');
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

/* ---------- events ---------- */

const actions = {
  'pick-person': (el) => pickPerson(el.dataset.id),
  reset: resetDemo,
  'remove-request': (el) => removeRequest(el.dataset.id),
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
  pick: (el) => {
    state.ui.reserve[el.dataset.field] = el.dataset.value;
    render();
  },
  decline: () => itemAction('decline'),
  release: () => itemAction('release'),
  withdraw: () => itemAction('withdraw'),
  approve: () => {
    markChecked();
    $('[data-needs-check]')?.focus();
  },
  publish: (el) => publish(el.dataset.offer || null),
  retry: sendDraft,
  'new-photo': () => {
    resetGive();
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
  reserve: (form) => reserveItem(form.dataset.request || null),
  confirm: confirmHandoff,
  ask: postAsk,
  publish: () => (isManual(state.give) ? publish(null) : actions.approve()), // Enter never publishes a Gemini draft
};

function bind(el) {
  const scope = el.dataset?.scope;
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
  if (scope === 'reserve') {
    document.querySelectorAll(`[data-field="${el.name}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === el.value)));
  }
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
  if (event.target.id === 'photo-input') onPhoto(event.target.files?.[0]);
});

/* Drop a photo anywhere on the give screen. */
const canDrop = () => Boolean(state.me) && state.route.name === 'give' && state.give.phase === 'pick';
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
  onPhoto(event.dataTransfer?.files?.[0]);
});

/* A poll that landed while someone was typing renders as soon as they leave the field. */
view.addEventListener('focusout', () => setTimeout(() => {
  if (state.pendingRender && !isTyping()) render();
}));
addEventListener('hashchange', onRouteChange);

/* ---------- start ---------- */

render();
api('GET', '/api/health').then((health) => setMock(Boolean(health?.mock))).catch(() => { /* no health route: rely on per-response flags */ });
pollLoop();
