// Builds comp/index.html for the v2 film: the storyboard's shots (submission/STORYBOARD.md) locked to the
// voice-over windows in film/vo-timing.json (the pacer schedule Ethan records against).
//   node scripts/compose.mjs           full film (silent picture lock: captions only)
//   node scripts/compose.mjs --smoke   shots 1-3 only (pipeline proof: WC + Remotion clip + three.js in HF)
//   node scripts/compose.mjs --render  also renders out/loop-film-silent.mp4 (H.264 + silent AAC) and out/stills/
//   node scripts/compose.mjs --render --audio raw/vo.m4a   final cut with his voice -> out/loop-film.mp4
// Footage: raw/main-L.mp4 (giver) and raw/main-R.mp4 (taker), 1440x900 CSS at 2x, copied to comp/assets/clips.
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const COMP = new URL('../comp/', import.meta.url).pathname;
const SMOKE = process.argv.includes('--smoke');
const VO = JSON.parse(readFileSync(process.env.VO_TIMING ?? new URL('../vo-timing.json', import.meta.url)));
const B = Object.fromEntries(VO.beats.map((b) => [b.id, b])); // B[n].start / B[n].end: where beat n's words sit
// Picture windows tile the film: shot n runs from its beat's first word (0 for beat 1) to the next beat's first word,
// so the pause after a beat belongs to its shot. W[n] = [start, end]; the last beat ends at speechEnd.
const W = Object.fromEntries(VO.beats.map((b, i, all) => [b.id, [i === 0 ? 0 : b.start, all[i + 1]?.start ?? VO.speechEnd]]));
const SPEECH = (n) => B[n].end - B[n].start;
const KNOT_SVG = readFileSync('/Users/ethan/loop/brand/knot.svg', 'utf8');
const KNOT_D = KNOT_SVG.match(/ d="([^"]+)"/)[1];
const KNOT_DASH = KNOT_SVG.match(/stroke-dasharray="([^"]+)"/)[1];
const CSS_W = 1440, CSS_H = 900;
const END_SPIN = 3.0; // the end-card knot spins and flattens for 3 s; its words land exactly at speechEnd

// Cuts are written against the take's marks (raw/main-marks.json, seconds on each tab's own clock), so a re-take
// re-cuts itself. cut(pane, mark, a, b, region, zmax, minFont, click): source window mark+a .. mark+b.
//   region  the CSS box [x0, y0, x1, y1] whose words must stay readable for the whole cut: the camera is fitted so
//           the box (after the push) stays inside the safe frame, and its smallest word is >= 18 px at 1080p.
//   minFont the smallest CSS font size in the region that the beat needs read (checked: minFont x scale >= 18).
//   click   the mark is a click; fitCuts() keeps it in place when a window rescales the shot.
// One idea per cut: few, long cuts (>= 1.5 s; a 1.0 s click cut only before a hold of >= 2 s), crossfaded inside
// a beat, hard cuts only on beat boundaries.
const RAW = new URL('../raw/', import.meta.url).pathname;
// Marks of the main take (panes L, R) plus the pile re-take (pane P, scripts/record.mjs pile) when it exists.
const MARKS = [...JSON.parse(readFileSync(`${RAW}main-marks.json`)), ...(existsSync(`${RAW}pile-marks.json`) ? JSON.parse(readFileSync(`${RAW}pile-marks.json`)) : [])];
if (existsSync(`${RAW}pile-P.mp4`)) copyFileSync(`${RAW}pile-P.mp4`, `${COMP}assets/clips/pile-P.mp4`);
const M = (pane, label) => {
  const m = MARKS.find((x) => x.pane === pane && x.label === label);
  if (!m) throw new Error(`no mark ${pane}:${label} in raw/main-marks.json or raw/pile-marks.json`);
  return m.ms / 1000;
};
const cut = (pane, label, a, b, region, zmax = 1.5, minFont = 14, click = false) => {
  const t = M(pane, label);
  const to = Array.isArray(b) ? M(pane, b[0]) + b[1] : t + b; // b = [otherMark, offset] spans two marks
  return { pane, from: t + a, to, region, zmax, minFont, anchor: click ? t : undefined };
};
const split = (pane, label, a, b, fy, click = false) => ({ ...cut(pane, label, a, b, null, 1, 14, click), fy });
const SKEW = M('L', 'ready') - M('R', 'ready'); // L clock = R clock + SKEW (both tabs marked "ready" at the same moment)
const FOOTAGE = {
  4: [cut('L', 'board', 0.11, 3.97, [60, 60, 1380, 720], 1.2, 16)], // the board: hero, Inventory, People need
  5: [cut('R', 'type-ask', 0.45, 2.15, [380, 140, 1030, 620], 1.4, 15), // typing the ask
    cut('R', 'needs-visible', 0.06, 2.22, [890, 340, 1340, 650], 1.6, 12)], // result: it sits under People need
  6: [cut('L', 'photo', -0.2, 3.69, [40, 100, 1400, 760], 1.2, 14), // photo in, Gemini looks at it: photo + card, whole page
    cut('L', 'match', -0.3, 2.9, [700, 540, 1360, 800], 1.5, 14), // the match card
    cut('L', 'fair', -0.5, 1.3, [680, 180, 1330, 480], 1.5, 14, true), // correct the condition: Fair
    cut('L', 'offer', -0.8, 0.91, [650, 620, 1300, 770], 1.5, 14, true)], // approve: Offer to them
  7: [cut('R', 'open-reserve', -0.6, 0.4, [860, 560, 1380, 800], 1.5, 14, true), // Accept & reserve (1.0 s click cut)
    cut('R', 'ticket', 0.1, 3.09, [60, 280, 760, 560], 1.6, 14)], // the ticket holds
  // Beat 8 is a split screen of the two thread columns; pane = the side the action is on, fy = the thread row.
  8: [split('L', 'loop-asks', -0.3, 2.2, 380), split('L', 'pick-time', -0.8, ['propose', 0.6], 540),
    split('R', 'works', -0.9, 0.6, 600, true), split('R', 'set', -0.3, 1.96, 450)],
  // The Confirm click sits so the stamp lands on "Done." (beat 9's third sentence).
  9: [cut('R', 'here', -0.9, 0.7, [60, 230, 1380, 560], 1.6, 14, true), cut('L', 'confirm', -1.33, 2.9, [60, 300, 810, 520], 1.5, 14, true),
    cut('R', 'pass-on', -0.5, 3.37, [60, 290, 810, 530], 1.5, 14)],
  10.5: [cut('R', 'works', -0.2, 0.75, [840, 70, 1385, 310], 2.0, 10)], // PLANNING -> SET, "YOU AGREED"
  11: [cut('P', 'pile-photo', -0.3, 2.2, [60, 220, 1300, 660], 1.5, 13), // one photo in
    cut('P', 'pile-review', -0.4, 2.3, [40, 100, 1400, 760], 1.2, 14), // "Gemini found 6 things": the boxes on the photo + draft 1
    cut('P', 'pile-card-2', -0.6, ['pile-scrolled', 1.4], [640, 130, 1400, 790], 1.3, 14)], // the scroll through drafts 2-6
};
const REFUSAL = ['R', M('R', 'refusal'), 600]; // old shot 12 [pane, Loop's refusal on screen, focus row], under the last sentence of beat 10
const STAMP_CSS = [460, 430]; // where the KEPT IN USE stamp sits on the giver's page (CSS px)
const SHAKE = { pane: 'L', at: M('L', 'confirm') + 0.15 }; // the KEPT IN USE stamp lands: a 2-frame shake (+ thump)

// Beat 10 (shot 10, iPhone): phrase onsets measured in raw/voice/vo-minimax.wav, as seconds after beat 10's first
// word: "Text it a photo" +5.74 · "and it drafts the listing" (on "drafts") +7.18 · "it texts you" +9.66 ·
// "You reply" +10.70 · "and the plan is set" +11.48 · "Your phone number stays private." +12.50.
const V10 = (dt) => B[10].start + dt;
const SET_AT = V10(11.48); // hard cut on "and" of "and the plan is set" to the desktop plan card (no dissolve between worlds)
const REFUSAL_AT = V10(12.43); // then the refusal line, under "Your phone number stays private."
const REFUSAL_LEN = W[10][1] - REFUSAL_AT;
// raw/phone/imessage-take1.mov, cropped to the conversation (comp/assets/clips/phone.mp4, 1320x1600 at 30 fps).
// Each kept segment lands one recording moment on one word; the waits between them (Gemini thinking, the idle
// keyboard, typing "Board", opening the emoji keyboard) are cut out, never sped up.
const PHONE_SEGS = [ // [recording second of the moment, film time of the word, segment start (fade in), what]
  [0.3, V10(5.74), V10(5.44), 'photo sent on "Text it a photo"'],
  [4.9, V10(7.18), V10(6.18), 'draft lands on "drafts the listing"'],
  [15.0, V10(9.66), V10(8.23), '"Someone reserved your…" lands on "it texts you"'],
  [19.05, V10(10.70), V10(10.43), 'thumbs-up sent on "You reply"'],
];
const PHONE_S = 0.55; // 1320 px recording -> 726 px: bubble text (~44 px) at ~24 px, the To: number (~34 px) at ~19 px
const REF_FROM = REFUSAL[1] - Math.min(0.5, REFUSAL_LEN * 0.25); // open just before the refusal lands

// Kinetic captions: the plain words fade in 120 ms before the first lime wipe; each [phrase] wipes under on its word.
// Wipe times are film seconds measured in raw/voice/vo-minimax.wav (phrase onsets); beat 9 wipes on the stamp.
const CAP_WIPES = { 5: [26.9], 6: [30.5, 38.3], 7: [42.25], 8: [43.9, 51.0], 10: [67.5], 11: [81.5] };
// Shots on the VO windows. cap: the storyboard's caption column ("[x]" = lime).
const SHOTS = [
  { n: 1, at: W[1][0], end: W[1][1], kind: 'wc' },
  { n: 2, at: W[2][0], end: W[2][1], kind: 'clip', comp: 'Slam', cue: SPEECH(2) / 10 },
  { n: 3, at: W[3][0], end: W[3][1], kind: 'knot', knot: 'title' },
  { n: 4, at: W[4][0], end: W[4][1], kind: 'p' },
  { n: 5, at: W[5][0], end: W[5][1], kind: 'p', cap: '[ASKED JUST NOW]', capFrom: 1 },
  { n: 6, at: W[6][0], end: W[6][1], kind: 'p', cap: 'Gemini [drafts]. A person [decides].' },
  { n: 7, at: W[7][0], end: W[7][1], kind: 'p', cap: 'The ticket is the [only identity].' },
  { n: 8, at: W[8][0], end: W[8][1], kind: 'split', cap: 'Loop [proposes]. People [confirm].' },
  { n: 9, at: W[9][0], end: W[9][1], kind: 'p', cap: '[KEPT IN USE]', capAt: SHAKE },
  { n: 10, at: W[10][0], end: SET_AT, kind: 'phone', cap: "Photon Spectrum = Loop's [real iMessage number]" },
  { n: 10.5, at: SET_AT, end: REFUSAL_AT, kind: 'p' }, // the plan card flips to SET (desktop take), hard cut in
  { n: 12, at: REFUSAL_AT, end: W[10][1], kind: 'refusal' },
  { n: 11, at: W[11][0], end: W[11][1], kind: 'p', cap: 'One photo, [six listings].' },
  // Beat 12: no code. The pile cuts straight to the end card: the knot ties over beat 12's first words, the card is
  // fully on screen ~3.6 s in (before the middle of the beat) and holds to the end.
  { n: 14, at: W[12][0], end: VO.total, kind: 'knot', knot: 'end' },
];
const shots = SMOKE ? SHOTS.filter((s) => s.n <= 3) : SHOTS;
const TOTAL = shots.at(-1).end;
// Scale a shot's cuts to its window: each cut keeps its share of the shot and its anchor (default: its middle).
function fitCuts(cuts, window) {
  const r = window / cuts.reduce((a, c) => a + c.to - c.from, 0);
  let used = 0;
  return cuts.map((c, i) => {
    const d = i === cuts.length - 1 ? window - used : (c.to - c.from) * r;
    const anchor = c.anchor ?? (c.from + c.to) / 2;
    const from = Math.max(0, anchor - (anchor - c.from) * r);
    used += d;
    return { ...c, from, to: from + d };
  });
}
for (const s of shots) if (FOOTAGE[s.n]) FOOTAGE[s.n] = fitCuts(FOOTAGE[s.n], s.end - s.at);

// Remotion clips are rendered at the window's exact frame count (cached by length).
function remotionClip(comp, seconds, cue) {
  const frames = Math.round(seconds * 30);
  const name = `${comp.toLowerCase()}-${frames}${cue ? `-c${Math.round(cue * 1000)}` : ''}.mp4`;
  const out = `${COMP}assets/clips/${name}`;
  if (!existsSync(out)) {
    const rm = new URL('../remotion/', import.meta.url).pathname;
    execFileSync('npx', ['remotion', 'render', 'src/index.ts', comp, `out/${name}`, '--codec=h264', '--crf=16', `--props=${JSON.stringify(cue ? { frames, cue } : { frames })}`], { cwd: rm, stdio: 'inherit' });
    copyFileSync(`${rm}out/${name}`, out);
  }
  return name;
}

// Knot choreography (local seconds). from/to: the 64-unit SVG box on screen [left, top, size].
const KNOTS = {
  title: (r) => ({ // "That's why I built Loop." (1.9 s at 150 wpm; times scale by r): spin settles, flattens, wordmark on "Loop"
    cfg: { drawEnd: 0.45 * r, turns: 0.6, spinEnd: 1.0 * r, spinEase: 'out', flatAt: 1.0 * r, flatDur: 0.42 * r, from: [610, 165, 700], to: [452, 370, 340] },
    words: `<p class="kword" data-in="${f3(1.45 * r)}" style="left:842px;top:392px;font-size:250px">Loop</p>`,
  }),
  end: () => ({ // spins once more and settles by speechEnd; the end card holds to the end, then 0.3 s of black
    cfg: { turns: 1, spinEnd: 2.3, spinEase: 'inout', flatAt: 2.3, flatDur: 0.6, from: [700, 60, 520], to: [612, 168, 230] },
    words: `<p class="kword cascade" style="left:860px;top:184px;font-size:176px">${[...'Loop'].map((ch, i) => `<span class="kl" data-in="${f3(2.95 + i * 0.04)}">${ch}</span>`).join('')}</p>
<p class="ktag" data-in="3.05"><span class="hl">Post what you don't need.</span></p>
<p class="kmono" data-in="3.2" style="top:630px">github.com/rongtnt/loop</p>
<p class="kbuilt" data-in="3.35">BUILT WITH</p>
<p class="kbrands" data-in="3.45"><span class="brand-photon">Photon</span><span class="brand-dot">·</span><span class="brand-gemini">Google Gemini</span></p>`,
  }),
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const capHtml = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<span class="hl">$1</span>');
const f3 = (n) => Number(n.toFixed(3));
const tc = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
let uid = 0;
const els = [];
const anim = [];
const stills = [];
const timed = (cls, at, dur, inner, extra = '', tag = 'div') =>
  `<${tag} id="e${++uid}" class="clip ${cls}" data-start="${f3(at)}" data-duration="${f3(dur)}"${extra}>${inner}</${tag}>`;
const src = (pane) => (pane === 'P' ? 'assets/clips/pile-P.mp4' : `assets/clips/main-${pane}.mp4`);

// ---- camera: fit the cut's region into the safe frame (above the caption when one shows), push <= 1.02 eased ----
const PUSH = 1.02, XF = 0.25, MIN_PUSH_CUT = 1.5;
const SAFE = { x0: 60, x1: 1860, y0: 50, y1: 1030, capY1: 920 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const checks = []; // one row per product cut: the readable region's bounds at the cut's last frame
// Product footage sits in a minimal window on the cream: 12 px radius, ink hairline, soft shadow. The page inside
// drifts 18 px against the frame (parallax) under the 1.02 push; the camera keeps the region inside the window.
const WIN = { x: 32, y: 24, w: 1856, h: 1036 }, DRIFT = 18; // 1856 px wide: 14 px page text >= 18 px at the widest shot
function camera(c, capOn) {
  const k = Math.max(WIN.w / CSS_W, WIN.h / CSS_H), [x0, y0, x1, y1] = c.region;
  const left = WIN.x + 20 + DRIFT / 2, right = WIN.x + WIN.w - 20 - DRIFT / 2;
  const top = WIN.y + 14, bottom = capOn ? SAFE.capY1 : WIN.y + WIN.h - 14;
  const z = Math.max(1, Math.min(c.zmax, (right - left) / ((x1 - x0) * k * PUSH), (bottom - top) / ((y1 - y0) * k * PUSH)));
  const S = k * z, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const tx = clamp((left + right) / 2 - WIN.x - cx * S, WIN.w - CSS_W * S, 0);
  const ty = clamp((top + bottom) / 2 - WIN.y - cy * S, WIN.h - CSS_H * S, 0);
  const hx = ((x1 - x0) * S * PUSH) / 2 + DRIFT / 2, hy = ((y1 - y0) * S * PUSH) / 2;
  const sx = WIN.x + cx * S + tx, sy = WIN.y + cy * S + ty;
  const box = [sx - hx, sy - hy, sx + hx, sy + hy].map((v) => Math.round(v));
  const ok = box[0] >= WIN.x && box[1] >= WIN.y && box[2] <= WIN.x + WIN.w && box[3] <= (capOn ? SAFE.capY1 + 20 : WIN.y + WIN.h) && c.minFont * S >= 18;
  return { S, tx, ty, ox: cx * S, oy: cy * S, box, ok, px: c.minFont * S };
}

// Where each source second lands in the film (for SFX cues): [pane, from, to, filmStart].
const placed = [];
const mapIn = (pane, src) => placed.filter((p) => p.pane === pane && src >= p.from && src < p.to).map((p) => p.at + src - p.from);

// A product cut in its window. The box is untimed (HyperFrames times the video itself); the frame (hairline +
// shadow) is timed. enter: 'tilt' (a shot's first cut: 2.5 deg perspective easing flat over 1 s), 'slide' (a cut
// inside a beat: the window slides 24 px in with the 0.25 s crossfade), 'flip' (the ticket: a 3D card flip).
function fullCut(at, c, capOn, xf, label, enter) {
  const dur = c.to - c.from, cam = camera(c, capOn);
  const start = at - xf, from = c.from - xf;
  const id = `v${++uid}`, box = `w${++uid}`, frame = `w${++uid}`;
  const rect = `left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${WIN.h}px`;
  els.push(`<div id="${box}" class="win-box" style="${rect}"><video id="${id}" class="clip" src="${src(c.pane)}" muted playsinline data-start="${f3(start)}" data-duration="${f3(dur + xf)}" data-media-start="${f3(from)}" style="left:${f3(cam.tx)}px;top:${f3(cam.ty)}px;width:${f3(CSS_W * cam.S)}px;height:${f3(CSS_H * cam.S)}px;transform-origin:${f3(cam.ox)}px ${f3(cam.oy)}px"></video></div>`);
  els.push(`<div id="${frame}" class="clip win-frame" data-start="${f3(start)}" data-duration="${f3(dur + xf)}" style="${rect}"></div>`);
  const both = `#${box}, #${frame}`;
  const push = dur >= MIN_PUSH_CUT ? PUSH : 1;
  anim.push(`tl.fromTo("#${id}", {scale:1, x:${DRIFT / 2}}, {scale:${push}, x:${-DRIFT / 2}, duration:${f3(dur + xf)}, ease:"sine.inOut"}, ${f3(start)});`);
  if (enter === 'tilt') anim.push(`tl.fromTo("${both}", {rotationX:2.5, rotationY:-2, transformPerspective:1600}, {rotationX:0, rotationY:0, duration:1, ease:"power2.out"}, ${f3(start)});`);
  if (enter === 'slide') {
    anim.push(`tl.fromTo("${both}", {x:24, opacity:0}, {x:0, opacity:1, duration:${xf}, ease:"power2.out"}, ${f3(start)});`);
    sfx.push({ t: start, kind: 'whoosh', db: -9, why: 'frame slide' });
  }
  if (enter === 'flip') anim.push(`tl.fromTo("${both}", {rotationY:-90, transformPerspective:800}, {rotationY:0, duration:0.5, ease:"power3.out"}, ${f3(start)});`);
  placed.push({ pane: c.pane, from, to: c.to, at: start, thread: c.region[2] > 840 });
  checks.push(`${label}  film ${at.toFixed(2)}-${(at + dur).toFixed(2)}  ${c.pane} ${c.from.toFixed(2)}-${c.to.toFixed(2)}  ${dur.toFixed(2)} s  scale ${cam.S.toFixed(2)}  push ${push}  smallest word ${cam.px.toFixed(0)} px  region at end [${cam.box}]  ${cam.ok ? 'ok' : 'CHECK'}`);
  return { id, both, cam };
}

// One thread column (CSS x 840-1385) in a pane at frame rect [X, Y, W, H], scaled by k, centred on CSS row fy.
const COL_X = 840, COL_W = 545; // the thread column of the 1400 px desktop layout
function threadPane(pane, at, dur, from, fy, [X, Y, W, H], extraCls = '') {
  const k = W / COL_W;
  const visH = H / k;
  const y0 = Math.max(0, Math.min(CSS_H - visH, fy - visH / 2));
  const rect = `left:${X}px;top:${Y}px;width:${W}px;height:${H}px`;
  const who = pane === 'L' ? '<span class="who giver">Giver</span>' : '<span class="who taker">Taker</span>';
  const box = `p${++uid}`, edge = `p${++uid}`;
  // Untimed clipping box around the timed video, and a timed frame (border, shadow, label) over it.
  els.push(`<div id="${box}" class="pane-box" style="${rect}"><video id="m${++uid}" class="clip" src="${src(pane)}" muted playsinline data-start="${f3(at)}" data-duration="${f3(dur)}" data-media-start="${f3(from)}" style="left:${f3(-COL_X * k)}px;top:${f3(-y0 * k)}px;width:${f3(CSS_W * k)}px;height:${f3(CSS_H * k)}px"></video></div>`);
  els.push(`<div id="${edge}" class="clip pane-edge ${extraCls}" data-start="${f3(at)}" data-duration="${f3(dur)}" style="${rect}">${who}</div>`);
  placed.push({ pane, from, to: from + dur, at, thread: true });
  checks.push(`        ${pane} thread pane  scale ${k.toFixed(2)}  thread text ${(14 * k).toFixed(0)} px`);
  return `#${box}, #${edge}`;
}

function splitCut(at, c, xf, label) {
  const dur = c.to - c.from;
  const other = c.pane === 'L' ? 'R' : 'L';
  const otherFrom = c.pane === 'L' ? c.from - SKEW : c.from + SKEW;
  const W = 760, H = 880, Y = 40, gap = 60; // 760 px: the 14 px thread text renders at 19.5 px
  const rect = (p) => [p === 'L' ? 960 - gap / 2 - W : 960 + gap / 2, Y, W, H];
  checks.push(`${label}  film ${at.toFixed(2)}-${(at + dur).toFixed(2)}  split, ${c.pane} active  ${c.from.toFixed(2)}-${c.to.toFixed(2)}  ${dur.toFixed(2)} s`);
  const a = threadPane(c.pane, at - xf, dur + xf, c.from - xf, c.fy, rect(c.pane), 'active');
  const b = threadPane(other, at - xf, dur + xf, otherFrom - xf, c.fy, rect(other), 'veil');
  if (dur >= MIN_PUSH_CUT) anim.push(`tl.fromTo("${a}", {scale:1}, {scale:${PUSH}, duration:${f3(dur + xf)}, ease:"sine.inOut"}, ${f3(at - xf)});`);
  if (xf) {
    anim.push(`tl.fromTo("${a}, ${b}", {opacity:0, x:24}, {opacity:1, x:0, duration:${xf}, ease:"power2.out"}, ${f3(at - xf)});`);
    sfx.push({ t: at - xf, kind: 'whoosh', db: -9, why: 'frame slide' });
  }
}

const sfx = []; // { t, kind, db, why }
const phoneCuts = []; // for the report

// Shot 10: the phone in a device frame on cream, sliding in from the right. The opening holds the recording's first
// frame (the number in the To: field) until the photo send; then four segments, crossfaded, each landing its moment
// on its word. The shell runs to y 900, above the caption; the keyboard is outside the crop.
function phoneShot(s) {
  const W = 1320 * PHONE_S, H = 1600 * PHONE_S, X = 960 - W / 2, Y = 34, B = 14; // screen ends at y 914, above the caption
  const end = s.end; // hard cut to the cream UI: the phone slides out first, nothing dissolves
  const shell = `ph${++uid}`, box = `ph${++uid}`;
  els.push(`<div id="${shell}" class="clip phone-shell" data-start="${f3(s.at)}" data-duration="${f3(end - s.at)}" style="left:${X - B}px;top:${Y - B}px;width:${W + 2 * B}px;height:${H + B + 10}px"></div>`);
  const media = [];
  const first = PHONE_SEGS[0], firstStart = first[1] - first[0]; // recording second 0 on screen
  media.push(`<img class="clip" src="assets/phone-first.png" alt="" data-start="${f3(s.at)}" data-duration="${f3(firstStart - s.at + 0.05)}" style="width:${W}px;height:${H}px">`);
  phoneCuts.push(`${f3(s.at)}-${f3(firstStart)}  first frame held (To: +1 (773) 912-3997), device slides in`);
  PHONE_SEGS.forEach(([rec, word, start, what], i) => {
    const segStart = i ? start : firstStart;
    const segEnd = i + 1 < PHONE_SEGS.length ? PHONE_SEGS[i + 1][2] + XF : end;
    const from = rec - (word - segStart);
    const id = `ph${++uid}`;
    media.push(`<video id="${id}" class="clip" src="assets/clips/phone.mp4" muted playsinline data-start="${f3(segStart)}" data-duration="${f3(segEnd - segStart)}" data-media-start="${f3(from)}" style="width:${W}px;height:${H}px"></video>`);
    if (i) anim.push(`tl.fromTo("#${id}", {opacity:0}, {opacity:1, duration:${XF}, ease:"sine.inOut"}, ${f3(segStart)});`);
    phoneCuts.push(`${f3(segStart)}-${f3(segEnd)}  recording ${from.toFixed(2)}-${(from + segEnd - segStart).toFixed(2)} s  ${what} (at ${word.toFixed(2)})`);
  });
  els.push(`<div id="${box}" class="phone-box" style="left:${X}px;top:${Y}px;width:${W}px;height:${H}px">${media.join('')}</div>`);
  const both = `#${shell}, #${box}`;
  anim.push(`tl.fromTo("${both}", {x:1300}, {x:0, duration:0.7, ease:"power3.out"}, ${f3(s.at)});`);
  anim.push(`tl.fromTo("${both}", {scale:1}, {scale:${PUSH}, duration:${f3(end - s.at - 0.95)}, ease:"sine.inOut"}, ${f3(s.at + 0.7)});`);
  anim.push(`tl.fromTo("${both}", {x:0}, {x:1300, duration:0.25, ease:"power2.in", immediateRender:false}, ${f3(end - 0.25)});`);
  // Sound: his two sends swoosh; Loop's bubbles pop as they land.
  sfx.push({ t: PHONE_SEGS[0][1], kind: 'swoosh', why: 'phone: photo sent' }, { t: PHONE_SEGS[3][1], kind: 'swoosh', why: 'phone: thumbs-up sent' },
    { t: PHONE_SEGS[1][1], kind: 'pop', why: 'phone: Loop draft lands' }, { t: PHONE_SEGS[2][1], kind: 'pop', why: 'phone: "Someone reserved your…" lands' });
}
for (const s of shots) {
  const dur = s.end - s.at;
  if (CAP_WIPES[s.n]) s.wipes = CAP_WIPES[s.n];
  if (['wc', 'clip', 'knot'].includes(s.kind)) els.push(`<div class="clip surface" data-start="${f3(s.at)}" data-duration="${f3(dur)}"></div>`);
  if (s.kind === 'wc') {
    els.push(`<div id="wc" class="clip scene" data-start="${f3(s.at)}" data-duration="${f3(dur)}" data-cue-scale="${f3(SPEECH(1) / 9.81)}" data-cue-offset="${f3(B[1].start - s.at - 0.6 * (SPEECH(1) / 9.81))}"></div>`); // wc.js cues are in this voice's seconds (beat 1 speech 0.6-10.41)
  } else if (s.kind === 'clip') {
    els.push(timed('scene', s.at, dur, '', ` src="assets/clips/${remotionClip(s.comp, dur, s.cue)}" muted playsinline data-media-start="0"`, 'video'));
    if (s.comp === 'Code') codeTicks(s.at, dur);
  } else if (s.kind === 'knot') {
    const k = KNOTS[s.knot](SPEECH(3) / 1.9);
    const [l, t, z] = k.cfg.to;
    els.push(timed('scene knot-scene', s.at, dur,
      `<canvas width="1920" height="1080"></canvas>
<svg class="knot2d" viewBox="0 0 64 64" style="left:${l}px;top:${t}px;width:${z}px;height:${z}px" aria-hidden="true"><path d="${KNOT_D}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="${KNOT_DASH}"/></svg>
${k.words}`, ` data-knot='${JSON.stringify(k.cfg)}'`));
    sfx.push({ t: s.at + k.cfg.flatAt - 0.12, kind: 'whoosh', why: `knot ties (${s.knot})` });
    if (s.knot === 'end') els.push(`<div class="clip black" data-start="${f3(s.end - 0.3)}" data-duration="0.3"></div>`);
  } else if (s.kind === 'p' || s.kind === 'split') {
    const cuts = FOOTAGE[s.n];
    const starts = cuts.map((_, i) => s.at + cuts.slice(0, i).reduce((a, c) => a + c.to - c.from, 0));
    // The caption lands on a cut (capFrom) or on the stamp (capAt); cuts it covers keep their words above it.
    const stampCut = cuts.findIndex((c) => c.pane === SHAKE.pane && SHAKE.at >= c.from && SHAKE.at < c.to);
    if (s.capAt && stampCut >= 0) s.wipes = [starts[stampCut] + SHAKE.at - cuts[stampCut].from];
    s.capStart = s.wipes ? s.wipes[0] - 0.12 : Infinity;
    cuts.forEach((c, i) => {
      const flip = s.n === 7 && i === 1; // the ticket lands as a card flip
      const xf = i && !flip ? XF : 0, t = starts[i], label = `beat ${s.n}.${i + 1}`;
      if (s.kind === 'split') return splitCut(t, c, xf, label);
      const { both, cam } = fullCut(t, c, Boolean(s.cap) && t + (c.to - c.from) > s.capStart, xf, label, flip ? 'flip' : i ? 'slide' : 'tilt');
      if (i === stampCut) { // KEPT IN USE: a 2-frame paper squash and a faint ink bleed under the stamp
        const at = f3(s.wipes[0]);
        anim.push(`tl.set("${both}", {scaleX:1.02, scaleY:0.97}, ${at}); tl.set("${both}", {scaleX:1, scaleY:1}, ${f3(at + 2 / 30)});`);
        const bx = WIN.x + STAMP_CSS[0] * cam.S + cam.tx, by = WIN.y + STAMP_CSS[1] * cam.S + cam.ty;
        els.push(`<div id="bl${++uid}" class="clip bleed" data-start="${at}" data-duration="0.7" style="left:${f3(bx - 220)}px;top:${f3(by - 130)}px"></div>`);
        anim.push(`tl.fromTo("#bl${uid}", {opacity:0, scale:0.85}, {opacity:1, scale:1.15, duration:0.7, ease:"power2.out"}, ${at}); tl.to("#bl${uid}", {opacity:0, duration:0.45, ease:"sine.in"}, ${f3(at + 0.25)});`);
        sfx.push({ t: at, kind: 'thump', why: 'KEPT IN USE stamp' }, { t: at + 0.03, kind: 'crack', why: 'KEPT IN USE stamp' });
      }
      if (s.n === 7 && i === 1) sfx.push({ t: t - 0.2, kind: 'slide', why: 'ticket lands' }, { t: t + 0.02, kind: 'tick', why: 'ticket lands' });
    });
  } else if (s.kind === 'refusal') {
    const ref = threadPane(REFUSAL[0], s.at, dur, REF_FROM, REFUSAL[2], [504, 40, 912, 880], 'active');
    anim.push(`tl.fromTo("${ref}", {scale:1}, {scale:${PUSH}, duration:${f3(dur)}, ease:"sine.inOut"}, ${f3(s.at)});`);
  } else if (s.kind === 'phone') {
    phoneShot(s);
  }
  if (s.cap) {
    const wipes = s.wipes ?? [s.at + 0.12];
    const from = Math.max(s.at, wipes[0] - 0.12), cid = `c${++uid}`;
    let k = 0;
    const html = esc(s.cap).replace(/\[([^\]]+)\]/g, (_, w) => `<span class="hl" id="${cid}h${k++}">${w}</span>`);
    els.push(`<div class="clip cap" data-start="${f3(from)}" data-duration="${f3(s.end - from)}"><p id="${cid}">${html}</p></div>`);
    anim.push(`tl.fromTo("#${cid}", {opacity:0, y:6}, {opacity:1, y:0, duration:0.12, ease:"power1.out"}, ${f3(from)});`);
    for (let i = 0; i < k; i++) anim.push(`tl.fromTo("#${cid}h${i}", {backgroundSize:"0% 100%"}, {backgroundSize:"100% 100%", duration:0.35, ease:"power2.out"}, ${f3(wipes[Math.min(i, wipes.length - 1)])});`);
  }
}

// ---- SFX cues from the footage: every real click, key ticks under visible typing, a pop per Loop message ----
const CLICKS = ['ask', 'type-ask', 'post-ask', 'back-board', 'give', 'photo', 'fair', 'looks-right', 'offer', 'open-offer', 'open-reserve',
  'reserve', 'suggest', 'type-place', 'pick-date', 'pick-time', 'propose', 'works', 'here', 'type-code', 'confirm', 'pile-give', 'pile-mode', 'pile-photo'];
const once = (list) => [...new Set(list.map((t) => f3(t)))];
for (const m of MARKS.filter((x) => CLICKS.includes(x.label))) {
  for (const t of once(mapIn(m.pane, m.ms / 1000 + 0.09))) sfx.push({ t, kind: 'click', why: `click: ${m.label}` });
}
// Typing in the take: the recorder clicks the field, waits 0.25 s, then types one character every 70 ms.
const TYPING = [['R', 'type-ask', 24], ['L', 'type-place', 40], ['L', 'type-code', 4]];
for (const [pane, label, n] of TYPING) {
  const t0 = M(pane, label) + 0.34;
  for (let i = 0; i < n; i += 2.5) for (const t of once(mapIn(pane, t0 + i * 0.07))) sfx.push({ t, kind: 'key', why: `typing: ${label}` });
}
// Loop's thread messages: server times (raw/main-state.json) put on the giver's clock via the handoff (collectedAt =
// the Confirm click); a pop where the message arrives on a tab whose thread is on screen.
const STATE = JSON.parse(readFileSync(new URL('../raw/main-state.json', import.meta.url)));
const item = STATE.items.filter((i) => i.reservation && i.collectedAt).at(-1);
const thread = STATE.threads.find((t) => t.itemId === item.id);
const wallToL = (iso) => (Date.parse(iso) - Date.parse(item.collectedAt)) / 1000 + M('L', 'confirm') + 0.21;
for (const msg of thread.messages.filter((m) => m.from === 'loop')) {
  const tL = wallToL(msg.at);
  const hits = [...placed.filter((p) => p.thread && p.pane === 'L' && tL >= p.from && tL < p.to).map((p) => p.at + tL - p.from),
    ...placed.filter((p) => p.thread && p.pane === 'R' && tL - SKEW >= p.from && tL - SKEW < p.to).map((p) => p.at + tL - SKEW - p.from)];
  if (hits.length) sfx.push({ t: Math.min(...hits) + 0.05, kind: 'pop', why: `Loop: ${msg.text.slice(0, 32)}…` });
}
// Code cards: a soft key tick every 2-3 characters while a key line types (same plan as remotion/src/Code.tsx).
function codeTicks(at, dur) {
  const spec = JSON.parse(readFileSync(new URL('../remotion/src/cards.json', import.meta.url)));
  const frames = Math.round(dur * 30);
  spec.cards.forEach((c, i) => {
    const arrive = Math.round(spec.arrive[i] * frames);
    const limit = i + 1 < spec.cards.length ? Math.round(spec.arrive[i + 1] * frames) : frames - spec.tail;
    const key = c.lines.at(-1)[1].trimStart();
    const from = arrive + spec.typeDelay;
    if (from + Math.ceil((key.length / spec.cps) * 30) > limit) return; // shown already typed
    for (let ch = 0; ch < key.length; ch += 2.5) sfx.push({ t: at + from / 30 + ch / spec.cps, kind: 'key', why: `code card ${i + 1}` });
  });
}
sfx.sort((a, b) => a.t - b.t);
const REVIEW = new URL('../out/review/', import.meta.url).pathname;
writeFileSync(`${REVIEW}cut-checks.txt`, `${checks.join('\n')}\n\nshot 10 (phone):\n${phoneCuts.join('\n')}\n`);
writeFileSync(`${REVIEW}sfx-cues.json`, JSON.stringify(sfx.map((c) => ({ ...c, t: f3(c.t) })), null, 1));
if (checks.some((l) => l.endsWith('CHECK'))) console.warn(checks.filter((l) => l.endsWith('CHECK')).join('\n'));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<script src="assets/vendor/gsap.min.js"></script>
<script src="assets/vendor/p5.min.js"></script>
<style>
@font-face { font-family: "SG"; src: url("assets/fonts/space-grotesk-latin-700-normal.woff2") format("woff2"); font-weight: 700; }
@font-face { font-family: "JBM"; src: url("assets/fonts/jetbrains-mono-latin-400-normal.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "JBM"; src: url("assets/fonts/jetbrains-mono-latin-700-normal.woff2") format("woff2"); font-weight: 700; }
:root { --cream: #f6f1e3; --ink: #0b0d17; --lime: #c8ff3c; --coral: #ff6b57; --muted: #4a5068; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: var(--cream); color: var(--ink); font-family: "SG", sans-serif; }
#root { position: relative; width: 1920px; height: 1080px; background: var(--cream); overflow: hidden; }
.clip { position: absolute; }
.scene { left: 0; top: 0; width: 1920px; height: 1080px; background: var(--cream); }
.win-box { position: absolute; overflow: hidden; border-radius: 12px; z-index: 2; }
.win-box video { position: absolute; }
.win-frame { border: 1.5px solid var(--ink); border-radius: 12px; box-shadow: 0 20px 40px rgba(11, 13, 23, .12); z-index: 3; }
.bleed { width: 440px; height: 260px; border-radius: 50%; background: radial-gradient(closest-side, rgba(11, 13, 23, .10), rgba(11, 13, 23, 0)); z-index: 4; }
.surface { left: 0; top: 0; width: 1920px; height: 1080px; z-index: 30; pointer-events: none;
  background-image: radial-gradient(ellipse at center, rgba(11, 13, 23, 0) 58%, rgba(11, 13, 23, .06) 100%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='1' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.04 0 0 0 0 0.05 0 0 0 0 0.09 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='0.028'/%3E%3C/svg%3E"); }
.kword.cascade { opacity: 1; }
.kl { display: inline-block; opacity: 0; }
.scene canvas { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.hl { background: linear-gradient(var(--lime), var(--lime)) no-repeat 0 0 / 0% 100%; padding: 0 .2em; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.ktag .hl, .end .hl { background-size: 100% 100%; }
.cap { left: 0; top: 948px; width: 1920px; height: 104px; display: flex; align-items: center; justify-content: center; z-index: 20; }
.cap p { font: 400 48px/1.2 "JBM", monospace; letter-spacing: -.01em; background: var(--cream); border: 3px solid var(--ink); border-radius: 12px; padding: 12px 26px; box-shadow: 6px 6px 0 var(--ink); white-space: nowrap; }
.phone-shell { background: #0d0d10; border-radius: 74px 74px 0 0; box-shadow: 0 20px 40px rgba(11, 13, 23, .12); z-index: 2;
  -webkit-mask-image: linear-gradient(to bottom, #000 94%, transparent); mask-image: linear-gradient(to bottom, #000 94%, transparent); }
.phone-box { position: absolute; overflow: hidden; border-radius: 60px 60px 0 0; z-index: 3; }
.phone-box img, .phone-box video { position: absolute; left: 0; top: 0; }
.pane-box { position: absolute; overflow: hidden; border-radius: 12px; z-index: 2; }
.pane-box video { position: absolute; }
.pane-edge { border: 1.5px solid var(--ink); border-radius: 12px; box-shadow: 0 20px 40px rgba(11, 13, 23, .12); z-index: 3; }
.pane-edge.veil { background: rgba(246, 241, 227, .55); }
.who { position: absolute; top: -18px; left: 22px; font: 700 22px/1 "JBM", monospace; text-transform: uppercase; letter-spacing: .06em; padding: 8px 14px; border: 2px solid var(--ink); border-radius: 6px; transform: rotate(-2deg); }
.who.giver { background: var(--ink); color: var(--cream); }
.who.taker { background: var(--coral); color: var(--ink); }
.knot2d { position: absolute; color: var(--ink); opacity: 0; }
.kword { position: absolute; font-weight: 700; line-height: 1; letter-spacing: -.04em; opacity: 0; }
.ktag { position: absolute; left: 0; width: 1920px; top: 486px; text-align: center; font: 700 70px/1.2 "SG", sans-serif; letter-spacing: -.02em; opacity: 0; }
.kmono { position: absolute; left: 0; width: 1920px; text-align: center; font: 400 44px/1.2 "JBM", monospace; opacity: 0; }
.kbuilt { position: absolute; left: 0; top: 730px; width: 1920px; text-align: center; font: 700 20px/1 "JBM", monospace; letter-spacing: .18em; color: var(--muted); opacity: 0; }
.kbrands { position: absolute; left: 0; top: 768px; width: 1920px; display: flex; justify-content: center; align-items: center; gap: 22px; color: var(--ink); opacity: 0; }
.kbrands span { font: 700 36px/1 "SG", sans-serif; letter-spacing: -.02em; } /* wordmarks in type, ~28 px cap height */
.kbrands .brand-dot { color: var(--muted); font-weight: 400; }
.black { left: 0; top: 0; width: 1920px; height: 1080px; background: #000; z-index: 50; }
.slot { display: flex; align-items: center; justify-content: center; }
.slot-in { width: 1500px; padding: 60px 70px; border: 3px dashed var(--ink); border-radius: 18px; }
.slot-n { font: 700 30px/1 "JBM", monospace; letter-spacing: .08em; color: var(--coral); }
.slot-label { margin-top: 28px; font: 700 72px/1.12 "SG", sans-serif; letter-spacing: -.02em; }
.slot-tc { margin-top: 28px; font: 400 30px/1.3 "JBM", monospace; color: var(--muted); }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
${els.join('\n')}
</div>
<script src="assets/wc.js"></script>
<script src="assets/knot.js"></script>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${anim.join('\n')}
tl.set({}, {}, ${TOTAL});
window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
writeFileSync(`${COMP}index.html`, page);
console.log(`${SMOKE ? 'smoke' : 'full'}: ${shots.length} shots, ${TOTAL}s`);
console.log(shots.map((s) => `${s.n}@${s.at.toFixed(1)}-${s.end.toFixed(1)}`).join(' '));

// Picture lock: HyperFrames render -> mux a silent AAC track -> six stills at fixed points of the story.
if (process.argv.includes('--render')) {
  const OUT = new URL('../out/', import.meta.url).pathname;
  const picture = `${OUT}review/lock-picture.mp4`;
  execFileSync('npx', ['hyperframes', 'render', '-o', picture], { cwd: COMP, stdio: 'inherit' });
  // --audio <file>: the voice (untouched) + the SFX bed under it -> loop-film.mp4, plus a 720p CRF 27 preview.
  const voice = process.argv[process.argv.indexOf('--audio') + 1];
  const withVoice = process.argv.includes('--audio') && voice;
  const film = `${OUT}${withVoice ? 'loop-film.mp4' : 'loop-film-silent.mp4'}`;
  if (withVoice) {
    // Stems for sound-only iteration (scripts/mix.mjs): the silent picture, the voice as is, the SFX bed.
    const { synth, bed } = await import('./sfx.mjs');
    const dir = new URL('../raw/sfx/', import.meta.url).pathname;
    const STEMS = `${OUT}stems/`;
    mkdirSync(STEMS, { recursive: true });
    synth(dir);
    bed(sfx, dir, TOTAL, `${dir}bed.wav`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', picture, '-an', '-c:v', 'copy', `${STEMS}video-silent.mp4`]);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', voice, '-c:a', 'pcm_s16le', `${STEMS}voice.wav`]);
    copyFileSync(`${dir}bed.wav`, `${STEMS}sfx.wav`);
    const { mix } = await import('./mix.mjs'); // music from the stems slot, if one was ever given
    console.log(JSON.stringify(mix(), null, 1));
  } else {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', picture, '-f', 'lavfi', '-t', String(TOTAL), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', film]);
  }
  const at = (n, frac) => B[n].start + (B[n].end - B[n].start) * frac;
  const STILLS = [['1-watercolor', at(1, 0.95)], ['2-ticket', at(7, 0.9)], ['3-plan-set', at(8, 0.95)],
    ['4-kept-in-use', at(9, 0.7)], ['5-pile', at(11, 0.6)], ['6-end-card', VO.total - 0.6]];
  for (const [name, t] of STILLS) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(t), '-i', film, '-frames:v', '1', `${OUT}stills/${name}.png`]);
  console.log(`wrote ${film} and ${STILLS.length} stills`);
}
