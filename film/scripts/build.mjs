// Builds comp/index.html (narrated) and comp/silent.html (captions only) from the shot list below.
// Footage times are seconds into raw/main-L.mp4, raw/main-R.mp4 (copied to comp/assets/clips) and pile-P.mp4.
import { readFileSync, writeFileSync } from 'node:fs';

const COMP = new URL('../comp/', import.meta.url).pathname;
const VO = JSON.parse(readFileSync(new URL('vo-durations.json', import.meta.url)));
const COAT = JSON.parse(readFileSync(new URL('../raw/coat-draft.json', import.meta.url))).draft;
const SKEW = 0.28; // L clock = R clock + 0.28 s (both marked "ready" at the same wall moment)
const KNOT_D = readFileSync('/Users/ethan/loop/brand/knot.svg', 'utf8').match(/ d="([^"]+)"/)[1];

// Pane geometry (2x captures: 1280x1688 two-up, 780x1688 phone).
const PH = 868, PW = Math.round((1280 / 1688) * PH), PY = 36, LX = 960 - 30 - PW, RX = 990;

// Beats: kind, dur, caption(s), vo, shots. Two-up shots: [pane, from, to, caption?].
const BEATS = [
  { id: 'cold', kind: 'cold', dur: 12.2, vo: 'v1', voAt: 0.25 },
  { id: 'title', kind: 'title', dur: 2.4, cap: '[A place to post what you have.] No names, no accounts.', vo: 'v2', voAt: 0.25 },
  { id: 'ask', kind: 'two', vo: 'v3', cap: '[Asked just now] · Reading lamp for my desk',
    shots: [['R', 4.4, 9.4], ['R', 11.0, 13.4], ['R', 17.35, 19.35]] },
  { id: 'post', kind: 'two', vo: 'v4', cap: 'Gemini [drafts]. A person [decides].',
    shots: [['L', 22.2, 26.4], ['L', 27.0, 33.4, null, 'still-1'], ['L', 35.3, 39.7, '[Offer to them]']] },
  { id: 'accept', kind: 'two', vo: 'v6', cap: 'The ticket is the [only identity] that matters.',
    shots: [['R', 41.9, 46.1], ['R', 48.8, 54.2, null, 'still-2']] },
  { id: 'plan', kind: 'two', vo: 'v7', voAt: 0.25, cap: 'Loop [proposes]. People [confirm].',
    shots: [['L', 56.9, 59.2], ['L', 61.4, 65.0], ['L', 66.8, 70.2], ['R', 71.2, 73.4], ['R', 75.4, 80.9, null, 'still-3']] },
  { id: 'handoff', kind: 'two', vo: 'v8', cap: 'Four digits are the whole [handshake].',
    shots: [['R', 96.0, 98.2], ['L', 98.9, 101.1], ['L', 103.2, 106.4], ['L', 106.4, 108.8, '[KEPT IN USE]', 'still-4'], ['R', 111.3, 113.7, '[KEPT IN USE]']] },
  { id: 'phone', kind: 'phone', dur: 15.5, cap: '[No app needed.] Text a photo.', vo: 'v9', voAt: 0.15, still: 'still-5' },
  { id: 'honest', kind: 'honest', vo: 'v10', voAt: 0.25, voSpan: 'tech', cap: 'Gemini says [no match] when there is none.',
    shots: [['P', 10.2, 14.4, null, 'still-6'], ['P', 16.2, 18.8], ['X', 91.2, 94.2, 'Loop [says no] when it should.']] },
  { id: 'tech', kind: 'tech', dur: 10.2 },
  { id: 'end', kind: 'end', dur: 3.2, vo: 'v12', voAt: 0.6 },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const capHtml = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<span class="hl">$1</span>');
const f = (n) => Number(n.toFixed(3));
let uid = 0;
const timed = (tag, start, dur, attrs, inner = '') =>
  `<${tag} id="e${++uid}" class="clip ${attrs.cls ?? ''}" data-start="${f(start)}" data-duration="${f(dur)}"${attrs.extra ?? ''}${attrs.style ? ` style="${attrs.style}"` : ''}>${inner}</${tag}>`;

const els = [];
const audio = [];
const stills = [];
const anim = [];
let t = 0;

function caption(start, dur, text) {
  els.push(timed('div', start, dur, { cls: 'cap' }, `<p>${capHtml(text)}</p>`));
}

function vid(src, start, dur, from, style, dim) {
  els.push(timed('video', start, dur, {
    style,
    extra: ` src="assets/clips/${src}" muted playsinline data-media-start="${f(from)}"`,
  }));
}

function twoUp(start, dur, shot) {
  const [pane, from] = shot;
  const tL = pane === 'L' ? from : from + SKEW;
  const tR = pane === 'R' ? from : from - SKEW;
  const box = (x) => `left:${x}px;top:${PY}px;width:${PW}px;height:${PH}px;`;
  els.push(timed('div', start, dur, { cls: 'pane-shadow', style: box(LX) }));
  els.push(timed('div', start, dur, { cls: 'pane-shadow', style: box(RX) }));
  vid('main-L.mp4', start, dur, tL, `${box(LX)}border-radius:14px;object-fit:cover;`, pane !== 'L');
  vid('main-R.mp4', start, dur, tR, `${box(RX)}border-radius:14px;object-fit:cover;`, pane !== 'R');
  els.push(timed('div', start, dur, { cls: `pane-edge${pane !== 'L' ? ' veil' : ''}`, style: box(LX) }, '<span class="who giver">Giver</span>'));
  els.push(timed('div', start, dur, { cls: `pane-edge${pane !== 'R' ? ' veil' : ''}`, style: box(RX) }, '<span class="who taker">Taker</span>'));
  els.push(timed('div', start, dur, { cls: 'side' }, '<p>RECORDED LIVE</p><p>localhost:3000</p><p>Gemini 3.5 Flash-Lite</p><p>two anonymous tabs</p>'));
}

function phonePane(start, dur, from) {
  const w = Math.round((780 / 1688) * PH);
  const x = 1100;
  const box = `left:${x}px;top:${PY}px;width:${w}px;height:${PH}px;`;
  els.push(timed('div', start, dur, { cls: 'pane-shadow', style: box }));
  vid('pile-P.mp4', start, dur, from, `${box}border-radius:14px;object-fit:cover;`, false);
  els.push(timed('div', start, dur, { cls: 'pane-edge', style: box }, '<span class="who giver">Giver</span>'));
  els.push(timed('div', start, dur, { cls: 'pile-note' }, '<p class="big">One photo.<br><span class="hl">Six drafts.</span></p><p class="small">A pile, sorted by Gemini.<br>Each box is its own listing.</p>'));
}

function refusal(start, dur, from) {
  // Crop of the taker's thread: CSS y 290..760 of the 640x844 tab.
  const w = 1200, s = w / 1280, top = 290 * 2 * s, h = Math.round(470 * 2 * s);
  const x = (1920 - w) / 2;
  els.push(timed('div', start, dur, { cls: 'pane-shadow', style: `left:${x}px;top:${PY}px;width:${w}px;height:${h}px;` }));
  els.push(timed('div', start, dur, { cls: 'crop', style: `left:${x}px;top:${PY}px;width:${w}px;height:${h}px;` }));
  vid('main-R.mp4', start, dur, from, `left:${x}px;top:${PY - top}px;width:${w}px;height:${Math.round(1688 * s)}px;clip-path:inset(${top}px 0 ${Math.round(1688 * s) - top - h}px 0 round 14px);`, false);
  els.push(timed('div', start, dur, { cls: 'pane-edge', style: `left:${x}px;top:${PY}px;width:${w}px;height:${h}px;` }, '<span class="who taker">Taker</span>'));
}

function shotsBeat(b) {
  const start = t;
  for (const [pane, from, to, cap, still] of b.shots) {
    const dur = to - from;
    if (pane === 'P') phonePane(t, dur, from);
    else if (pane === 'X') refusal(t, dur, from);
    else twoUp(t, dur, [pane, from]);
    caption(t, dur, cap ?? b.cap);
    if (still) stills.push([still, t + dur - 0.5]);
    t += dur;
  }
  return t - start;
}

const KNOT = (cls, mask) => `<svg class="${cls}" viewBox="2 4.02 60 55.96" aria-hidden="true">${mask ? `<defs><mask id="${mask}"><path class="draw" d="${KNOT_D}" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></mask></defs>` : ''}<path d="${KNOT_D}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="65.17 18.81"${mask ? ` mask="url(#${mask})"` : ''}/></svg>`;

function card(b) {
  const start = t;
  const dur = b.dur;
  if (b.kind === 'cold') {
    els.push(timed('div', start, dur, { cls: 'card cold' },
      '<p class="kicker">EVERY MOVE-OUT</p><h1>Working lamps and chargers go into the dumpster.</h1><p class="sub">Someone down the hall is about to buy the same thing.</p>'));
    anim.push(`tl.fromTo("#e${uid} .sub", {opacity:0}, {opacity:1, duration:0.4}, ${f(start + 4.0)});`);
    caption(start + 6.9, dur - 6.9, 'Listings stop at [posted].');
  } else if (b.kind === 'title') {
    els.push(timed('div', start, dur, { cls: 'card title' }, `${KNOT('knot-big', 'drawmask')}<p class="word">Loop</p>`));
    anim.push(`tl.fromTo("#drawmask .draw", {attr:{"stroke-dashoffset":1}}, {attr:{"stroke-dashoffset":0}, duration:1.4, ease:"power2.inOut"}, ${f(start + 0.1)});`);
    anim.push(`tl.fromTo("#e${uid} .word", {opacity:0, x:-16}, {opacity:1, x:0, duration:0.4}, ${f(start + 1.2)});`);
  } else if (b.kind === 'phone') {
    els.push(timed('div', start, dur, { cls: 'card phone' }, phoneCard()));
    const at = [0.2, 2.0, 3.0, 4.2, 10.6, 11.8]; // synced to the v9 sentence breaks
    at.forEach((s, i) => anim.push(`tl.fromTo("#e${uid} .m${i}", {opacity:0, y:14}, {opacity:1, y:0, duration:0.3}, ${f(start + s)});`));
    if (b.still) stills.push([b.still, start + dur - 0.5]);
  } else if (b.kind === 'tech') {
    els.push(timed('div', start, dur, { cls: 'card tech' },
      '<p class="kicker">UNDER THE HOOD</p><ul><li class="t0">Node + plain JavaScript</li><li class="t1">Gemini 3.5 Flash-Lite behind JSON schemas</li><li class="t2">Photon Spectrum for iMessage</li></ul><p class="sub t3">The model drafts and proposes. People decide.</p>'));
    [0, 2.4, 5.3, 7.4].forEach((s, i) => anim.push(`tl.fromTo("#e${uid} .t${i}", {opacity:0, y:12}, {opacity:1, y:0, duration:0.3}, ${f(start + s)});`)); // v10 sentence breaks
  } else if (b.kind === 'end') {
    els.push(timed('div', start, dur, { cls: 'card end' },
      `<div class="lockup">${KNOT('knot-end')}<p class="word">Loop</p></div><p class="tag"><span class="hl">Post what you don't need.</span></p><p class="mono">github.com/rongtnt/loop</p><p class="mono">Text a photo · (773) 912-3997</p>`));
    stills.push(['still-end', start + dur - 0.5]);
  }
  if (b.cap) caption(start, dur, b.cap);
  t += dur;
  return dur;
}

function phoneCard() {
  const notes = COAT.conditionNotes.replace(/\.$/, '');
  const line = [COAT.title, `${COAT.condition}${notes ? ` (${notes})` : ''}`, COAT.description].filter(Boolean).join(' · ');
  const draft = `${/[.?]$/.test(line) ? line : `${line}.`} Someone nearby asked for "Winter coat, size M-ish" 1 h ago — it fits. Reply YES to offer it, BOARD to post it for anyone, or type a correction.`;
  const loop = (i, text, extra = '') => `<div class="msg loop m${i}"><p class="from">LOOP</p><p>${esc(text)}</p>${extra}</div>`;
  return `<div class="sms"><p class="sms-head">iMESSAGE · (773) 912-3997</p><div class="thread">
    ${loop(0, "Hi — this is Loop. Text me a photo of something you don't need and I'll draft the listing.")}
    <div class="msg you m1"><img src="assets/coat.jpg" alt=""></div>
    ${loop(2, 'Got it — looking at your photo…')}
    <div class="msg loop m3"><p class="from">LOOP</p><p>${esc(draft)}</p><p class="tap">👍 YES · 👎 BOARD</p><span class="tapback m4">👎</span></div>
    ${loop(5, "Posted to the board. I'll text you when someone reserves it.")}
  </div></div>
  <p class="fineprint">Loop's real reply strings, set in type (not a phone recording).<br>The draft is Gemini's real output for this photo.</p>`;
}

for (const b of BEATS) {
  const start = t;
  const dur = b.kind === 'two' || b.kind === 'honest' ? shotsBeat(b) : card(b);
  b.start = start;
  b.durActual = dur;
  if (!b.vo) continue;
  const voDur = VO[b.vo];
  const at = start + (b.voAt ?? 0.35);
  const slot = dur + (b.voSpan ? BEATS.find((x) => x.id === b.voSpan).dur : 0);
  if (at + voDur > start + slot - 0.1) console.warn(`VO ${b.vo} (${voDur}s) overflows beat ${b.id} (${slot.toFixed(2)}s)`);
  audio.push(`<audio id="a-${b.vo}" src="assets/audio/${b.vo}.mp3" data-start="${f(at)}" data-duration="${f(voDur)}" data-volume="1"></audio>`);
}
const TOTAL = f(t);

const css = readFileSync(new URL('film.css', import.meta.url), 'utf8');
const page = (withAudio) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
${css}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
${els.join('\n')}
${withAudio ? audio.join('\n') : ''}
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${anim.join('\n')}
window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
writeFileSync(`${COMP}index.html`, page(true));
// Silent cut: made from the narrated render (audio replaced by silence), so the picture is frame-identical.
writeFileSync(new URL('../raw/timeline.json', import.meta.url), JSON.stringify({ total: TOTAL, beats: BEATS.map(({ id, start, durActual, vo }) => ({ id, start: f(start), dur: f(durActual), vo })), stills }, null, 1));
console.log(`total ${TOTAL}s`, BEATS.map((b) => `${b.id}@${b.start.toFixed(1)}+${b.durActual.toFixed(1)}`).join(' '));
