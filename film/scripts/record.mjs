// Records the real Loop app on :3000 with Playwright (Chromium, DPR 2) for the demo film.
// Usage: node scripts/record.mjs test|main|pile   -> raw/<mode>-*.webm + raw/<mode>-marks.json
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:3000';
const RAW = new URL('../raw/', import.meta.url).pathname;
const SEED = '/Users/ethan/loop/public/seed/';
const mode = process.argv[2] ?? 'test';
mkdirSync(RAW, { recursive: true });

// Headless Chromium paints no pointer: draw one (and a click ring) outside the app's render root.
const CURSOR = `(() => {
  let c;
  const make = () => {
    c = document.createElement('div');
    c.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2.5l6.8 18.2 2.6-7.4 7.3-2.7z" fill="#0b0d17" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:0;top:0;width:34px;height:34px;pointer-events:none;z-index:2147483647;transform:translate(-200px,-200px)';
    document.documentElement.appendChild(c);
  };
  addEventListener('mousemove', (e) => {
    if (!c || !c.isConnected) make();
    c.style.transform = 'translate(' + (e.clientX - 5) + 'px,' + (e.clientY - 3) + 'px)';
  }, true);
  addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border:3px solid #ff6b57;border-radius:50%;pointer-events:none;z-index:2147483646;left:' + e.clientX + 'px;top:' + e.clientY + 'px';
    document.documentElement.appendChild(r);
    r.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 450 }).onfinish = () => r.remove();
  }, true);
})();`;

const marks = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pos = new Map();

async function open(browser, name, width, height) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2,
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  page.t0 = Date.now(); // video time 0
  page.label = name;
  await startCapture(page, width * 2, height * 2);
  pos.set(page, { x: width / 2, y: height - 120 });
  await page.goto(BASE);
  return page;
}

function mark(page, label) {
  const ms = Date.now() - page.t0;
  marks.push({ pane: page.label, label, ms });
  console.log(`${page.label} ${label} ${(ms / 1000).toFixed(2)}`);
}

// Slow, eased pointer travel so viewers can follow it.
async function glide(page, x, y, ms = 650) {
  const from = pos.get(page);
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(16);
  }
  pos.set(page, { x, y });
}

async function reveal(page, locator) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  await locator.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(700);
}

async function tap(page, locator, label, { after = 700 } = {}) {
  await reveal(page, locator);
  const b = await locator.boundingBox();
  await glide(page, b.x + b.width / 2, b.y + b.height / 2);
  await sleep(220);
  mark(page, label);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  await sleep(after);
}

async function type(page, locator, text, label) {
  await tap(page, locator, label, { after: 250 });
  await locator.pressSequentially(text, { delay: 70 });
  await sleep(400);
}

async function scrollBy(page, dy) {
  await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), dy);
  await sleep(800);
}

async function pickPhoto(page, file, label) {
  const chooser = page.waitForEvent('filechooser');
  await tap(page, page.locator('#drop'), label, { after: 0 });
  await (await chooser).setFiles(SEED + file);
  mark(page, `${label}:set`);
}

const api = (path, init) => fetch(BASE + path, init).then((r) => r.json());

// CDP screencast at device pixels (Playwright's own recorder captures at 1x). Frames keep their wall-clock
// timestamps; ffmpeg's concat demuxer turns them into a constant-30-fps MP4 whose time 0 is page.t0.
async function startCapture(page, w, h) {
  const dir = `${RAW}${mode}-${page.label}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `${dir}f${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, ms: metadata.timestamp * 1000 - page.t0 });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  page.capture = { cdp, frames, w, h };
}

async function stopCapture(page) {
  const { cdp, frames, w, h } = page.capture;
  await cdp.send('Page.stopScreencast').catch(() => {});
  const end = Date.now() - page.t0;
  // Output frame k shows the newest captured frame at k/30 s, so video time == ms since page.t0.
  const ff = spawn('/opt/homebrew/bin/ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${w}:${h}:flags=lanczos`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    `${RAW}${mode}-${page.label}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (code) => (code ? reject(new Error(`ffmpeg ${code}`)) : resolve())));
  let idx = 0;
  for (let k = 0; k * 1000 / 30 <= end; k++) {
    while (idx + 1 < frames.length && frames[idx + 1].ms <= k * 1000 / 30) idx++;
    if (!ff.stdin.write(readFileSync(frames[idx].file))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  console.log(`${page.label}: ${frames.length} frames, ${(end / 1000).toFixed(1)} s`);
}

async function finish(browser, pages) {
  for (const p of pages) await stopCapture(p);
  await browser.close();
  writeFileSync(`${RAW}${mode}-marks.json`, JSON.stringify(marks, null, 1));
}

async function runTest(browser) {
  const p = await open(browser, 'L', 640, 844);
  await sleep(1500);
  await tap(p, p.getByRole('link', { name: 'Post something' }), 'give');
  await sleep(1500);
  return [p];
}

// v2 film (STORYBOARD.md): desktop layout, 1440x900 viewport at 2x. L = giver, R = taker. One take covers
// shots 4-9, 11 and 12 (the refusal is sent through the API as the taker; the pile runs last on the giver's tab).
const VW = 1440, VH = 900;

async function runMain(browser) {
  await api('/api/reset', { method: 'POST' });
  const L = await open(browser, 'L', VW, VH);
  const R = await open(browser, 'R', VW, VH);
  await sleep(2500);
  mark(L, 'ready'); mark(R, 'ready');

  // Shot 4: the board as it is (hero, riffle, Inventory, People need), no cursor.
  mark(L, 'board');
  await sleep(4000);

  // Shot 5: the taker asks.
  await tap(R, R.getByRole('link', { name: 'Ask for something' }), 'ask');
  await type(R, R.locator('#a-title'), 'Reading lamp for my desk', 'type-ask');
  await tap(R, R.locator('#ask-submit'), 'post-ask', { after: 1200 });
  await R.getByRole('heading', { name: 'Posted' }).waitFor({ timeout: 30_000 });
  mark(R, 'posted');
  await sleep(1000);
  await tap(R, R.getByRole('link', { name: 'Back to the board' }), 'back-board', { after: 600 });
  await reveal(R, R.locator('#h-needs'));
  mark(R, 'needs-visible');
  await sleep(2500);

  // Shot 6: the giver posts the lamp; Gemini drafts and matches (real wait kept, trimmed in the edit).
  await sleep(600);
  await tap(L, L.getByRole('link', { name: 'Post something' }), 'give', { after: 900 });
  await pickPhoto(L, 'lamp.jpg', 'photo');
  await L.locator('#draft-card').waitFor({ timeout: 45_000 });
  mark(L, 'draft');
  await sleep(2500);
  await reveal(L, L.locator('#match-title'));
  mark(L, 'match');
  await sleep(2500);
  await tap(L, L.locator('#draft-card label.pick', { hasText: 'Fair' }), 'fair');
  if (await L.locator('#approve').isVisible()) await tap(L, L.locator('#approve'), 'looks-right');
  else mark(L, 'checked-by-edit');
  await tap(L, L.locator('#publish-offer'), 'offer', { after: 2500 });

  // Shot 7: the taker accepts; the ticket.
  await R.locator('#h-you').waitFor({ timeout: 20_000 });
  await R.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(900);
  mark(R, 'for-you');
  await sleep(1500);
  await tap(R, R.locator('section[aria-labelledby="h-you"] a').first(), 'open-offer', { after: 1300 });
  await tap(R, R.locator('#open-reserve'), 'open-reserve', { after: 900 });
  await tap(R, R.locator('#reserve-submit'), 'reserve', { after: 400 });
  await R.locator('.ticket').waitFor({ timeout: 20_000 });
  await reveal(R, R.locator('.ticket'));
  mark(R, 'ticket');
  await sleep(3500);

  // Shot 8: Loop asks the giver first; the giver proposes Davis, tomorrow noon; the taker confirms.
  const suggest = L.getByRole('button', { name: 'Suggest a time and place' });
  await suggest.waitFor({ timeout: 20_000 });
  await reveal(L, L.locator('.msg-loop').last());
  mark(L, 'loop-asks');
  await sleep(2500);
  await tap(L, suggest, 'suggest', { after: 900 });
  // The form: an exact place typed, then the date and time pickers (no time in words).
  await type(L, L.locator('#propose-place'), 'Davis Library, 2nd floor by the printers', 'type-place');
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + 86_400_000)); // YYYY-MM-DD in Chapel Hill
  await tap(L, L.locator('#propose-date'), 'pick-date', { after: 150 });
  await L.locator('#propose-date').fill(tomorrow);
  await sleep(600);
  await tap(L, L.locator('#propose-hour'), 'pick-time', { after: 150 });
  await L.locator('#propose-hour').fill('17:00');
  await sleep(600);
  await tap(L, L.locator('#propose-submit'), 'propose', { after: 1500 });
  const works = R.getByRole('button', { name: 'Works for me' });
  await works.waitFor({ timeout: 20_000 });
  await reveal(R, R.locator('.msg-loop').last());
  mark(R, 'proposal');
  await sleep(2500);
  await tap(R, works, 'works', { after: 1500 });
  await R.getByText('remind you both', { exact: false }).first().waitFor({ timeout: 20_000 }).catch(() => mark(R, 'no-reminder-line'));
  mark(R, 'set');
  await reveal(R, R.getByText('remind you both', { exact: false }).first()).catch(() => {});
  mark(R, 'plan-set');
  await sleep(3000);

  // Shot 12: the taker asks Loop for the giver's number (sent through the API as the taker; Loop refuses).
  const st = await api('/api/state');
  const tid = st.threads.at(-1).id;
  const me = await R.evaluate(() => sessionStorage.getItem('loop.person'));
  const before = st.version;
  mark(R, 'refusal-ask');
  await api(`/api/threads/${tid}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: me, text: "What's the giver's phone number?" }) });
  for (let i = 0; i < 40; i++) {
    const s = await api('/api/state');
    if (s.threads.find((t) => t.id === tid).messages.at(-1)?.from === 'loop' && s.version > before) break;
    await sleep(400);
  }
  await sleep(1800);
  await reveal(R, R.locator('.msg').last());
  mark(R, 'refusal');
  await sleep(3500);

  // Shot 9: the taker is here; the giver types the code; collected; KEPT IN USE; Pass it on again.
  await tap(R, R.getByRole('button', { name: "I'm here" }), 'here', { after: 1500 });
  const prompt = L.getByText('Ask for the 4-digit code', { exact: false }).last();
  await prompt.waitFor({ timeout: 20_000 });
  await reveal(L, L.locator('#code-input'));
  mark(L, 'code-prompt');
  await sleep(2000);
  const s = await api('/api/state');
  const item = s.items.filter((i) => i.reservation && i.status === 'reserved').at(-1);
  await type(L, L.locator('#code-input'), item.reservation.code, 'type-code');
  await tap(L, L.locator('#confirm-submit'), 'confirm', { after: 600 });
  await L.getByText('Kept in use', { exact: false }).first().waitFor({ timeout: 20_000 });
  await reveal(L, L.getByText('Kept in use', { exact: false }).first());
  mark(L, 'collected');
  await sleep(3000);
  const again = R.getByRole('button', { name: 'Pass it on again' });
  await again.waitFor({ timeout: 20_000 });
  await reveal(R, again);
  mark(R, 'pass-on');
  await sleep(3000);
  writeFileSync(`${RAW}main-state.json`, JSON.stringify(await api('/api/state'), null, 1));

  // Shot 11: the giver posts a pile.
  await L.evaluate(() => { location.hash = '#/'; window.scrollTo(0, 0); }); // hash route: no reload, the screencast keeps running
  await sleep(1500);
  await tap(L, L.getByRole('link', { name: 'Post something' }), 'pile-give', { after: 900 });
  await tap(L, L.locator('#mode-pile'), 'pile-mode');
  await pickPhoto(L, 'pile.jpg', 'pile-photo');
  await L.locator('#pile-title').waitFor({ timeout: 60_000 });
  mark(L, 'pile-review');
  await sleep(3000);
  const nomatch = L.getByText('No open request fits this one', { exact: false }).first();
  if (await nomatch.count()) { await reveal(L, nomatch); mark(L, 'pile-nomatch'); }
  await sleep(4000);
  return [L, R];
}

// Pile re-take for shot 11 (desktop, one tab, pane P): the six drafts are scrolled through, one card per second, so
// the film can show all of them. node scripts/record.mjs pile -> raw/pile-P.mp4 + raw/pile-marks.json.
async function runPile(browser) {
  await api('/api/reset', { method: 'POST' });
  const P = await open(browser, 'P', VW, VH);
  await sleep(2500);
  mark(P, 'ready');
  await tap(P, P.getByRole('link', { name: 'Post something' }), 'pile-give', { after: 900 });
  await tap(P, P.locator('#mode-pile'), 'pile-mode');
  await pickPhoto(P, 'pile.jpg', 'pile-photo');
  await P.locator('#pile-title').waitFor({ timeout: 60_000 });
  mark(P, 'pile-review');
  await glide(P, 1400, 860, 500); // pointer out of the way
  await sleep(2600);
  const cards = P.locator('.pile-item');
  const n = await cards.count();
  for (let i = 1; i < n; i++) {
    await cards.nth(i).evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    mark(P, `pile-card-${i + 1}`);
    await sleep(1000);
  }
  mark(P, 'pile-scrolled');
  await sleep(2500);
  return [P];
}

const browser = await chromium.launch({ channel: 'chromium', args: ['--force-device-scale-factor=2'] });
let pages = [];
try {
  pages = await ({ test: runTest, main: runMain, pile: runPile })[mode](browser);
} catch (err) {
  console.error('FAILED:', err.message);
  for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: `${RAW}${mode}-fail-${p.label ?? 'x'}.png` }).catch(() => {});
  pages = browser.contexts().flatMap((c) => c.pages());
  process.exitCode = 1;
}
await finish(browser, pages);
await api('/api/reset', { method: 'POST' }); // leave the demo data clean
