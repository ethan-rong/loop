// Shot 1 (WC), beat 1: hand-painted watercolor objects that move on the voice. Each wash is a polygon deformed from a
// fixed seed and stacked in thin translucent layers (a darker rim where the layers' edges pile up = the wet edge);
// a stroke "paints" by revealing that fixed wash behind a wobbly front. Objects then move, dim and scale on
// keyframes. Every frame is repainted from scratch, so any HyperFrames worker can seek any frame.
//
// Cue times are seconds in Ethan's track (raw/voice/vo-minimax.wav), phrase onsets measured from it:
//   0.78 "We all have stuff we don't use anymore."   2.74 "Maybe you got a new lamp,"
//   4.04 "and the old one's just sitting there."      5.84 "For you, it's taking up space."
//   7.94 "For someone else, it could be exactly what they need." ("need" ~ 9.9)
// data-cue-scale / data-cue-offset map them onto a re-timed voice (both 1 / 0 for this track).
(() => {
  const host = document.getElementById('wc');
  const START = Number(host.dataset.start);
  const R = Number(host.dataset.cueScale ?? 1);
  const OFF = Number(host.dataset.cueOffset ?? 0);
  const T = (c) => OFF + c * R; // cue -> local seconds
  const FPS = 30;
  const INK = [11, 13, 23];
  const CORAL = [255, 107, 87];
  const LAYERS = 16;

  // ---- shapes (local coordinates: origin = the object's foot, y up is negative) ----
  function ellipse(cx, cy, rx, ry) {
    return Array.from({ length: 16 }, (_, i) => [cx + rx * Math.cos((i / 16) * 2 * Math.PI), cy + ry * Math.sin((i / 16) * 2 * Math.PI)]);
  }
  function shoulders(cx, cy, rx, ry) { // the top half of an ellipse, flat underneath
    return Array.from({ length: 13 }, (_, i) => [cx - rx * Math.cos((i / 12) * Math.PI), cy - ry * Math.sin((i / 12) * Math.PI)]);
  }
  function curve(a, c, b, n = 16) { // quadratic Bezier, sampled
    return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [0, 1].map((k) => u * u * a[k] + 2 * u * t * c[k] + t * t * b[k]); });
  }
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const mirror = (pts) => pts.map(([x, y]) => [-x, y]);
  const lampStrokes = (flip, clean) => {
    const m = flip ? mirror : (p) => p;
    const op = clean ? 0.92 : 0.8;
    return [
      { col: INK, op, kind: 'wash', pts: ellipse(0, 0, 92, 17), dir: [1, 0] },
      { col: INK, op, kind: 'line', w: clean ? 11 : 14, pts: m([[0, -6], [45, -90], [107, -184]]), dir: [flip ? -0.5 : 0.5, -1] },
      { col: INK, op, kind: 'line', w: clean ? 11 : 14, pts: m([[107, -184], [50, -256], [-9, -322]]), dir: [flip ? 0.8 : -0.8, -1] },
      { col: CORAL, op: clean ? 0.9 : 0.78, kind: 'wash', pts: m([[-33, -356], [25, -316], [-63, -196], [-173, -272]]), dir: [flip ? 0.7 : -0.7, 0.75] },
      { col: INK, op: 0.45, kind: 'wash', pts: ellipse(flip ? 113 : -113, -222, 24, 18), dir: [0, 1] },
    ].map((s) => ({ ...s, clean }));
  };
  const SHAPES = {
    old: lampStrokes(false, false),
    fresh: lampStrokes(true, true),
    mug: [
      { col: INK, op: 0.3, kind: 'wash', pts: rect(-70, -150, 70, 0), dir: [0, 1] },
      { col: CORAL, op: 0.7, kind: 'wash', pts: rect(-70, -96, 70, -70), dir: [1, 0] },
      { col: INK, op: 0.8, kind: 'line', w: 12, pts: [[70, -122], [118, -100], [118, -62], [70, -42]], dir: [0, 1] },
      { col: INK, op: 0.85, kind: 'line', w: 10, pts: [[-72, -150], [0, -153], [72, -150]], dir: [1, 0] },
    ],
    books: [
      { col: INK, op: 0.4, kind: 'wash', pts: rect(-125, -42, 125, 0), dir: [1, 0] },
      { col: CORAL, op: 0.72, kind: 'wash', pts: rect(-104, -82, 114, -42), dir: [1, 0] },
      { col: INK, op: 0.55, kind: 'wash', pts: rect(-112, -118, 92, -82), dir: [1, 0] },
    ],
    figure: [
      { col: CORAL, op: 0.75, kind: 'wash', pts: ellipse(0, -255, 38, 40), dir: [0, 1] },
      { col: CORAL, op: 0.65, kind: 'wash', pts: shoulders(0, -110, 82, 92), dir: [0, 1] },
    ],
    arc: [{ col: CORAL, op: 0.75, kind: 'line', w: 13, pts: curve([300, 560], [900, 120], [1440, 430]), dir: [1, 0.1] }],
  };
  const ARC_PATH = curve([300, 560], [900, 120], [1440, 430], 40); // the lamp's top rides just under the arc

  // ---- timing: when each object is painted [start, seconds] and how it moves ----
  // Tracks are keyframes [cue, value]; between keys the value eases in and out.
  const DRAW = {
    old: [0.8, 0.5], mug: [1.35, 0.5], books: [1.9, 0.5], // three quick sketches in a row
    fresh: [3.3, 0.16], // the new lamp pops in on "new lamp"
    figure: [7.98, 0.45], arc: [8.4, 0.8], // "For someone else": the figure, then the arc
  };
  const MOVE = {
    old: { x: [[0, 560], [4.1, 560], [4.9, 250]], y: [[0, 760], [4.1, 760], [4.9, 930]], s: [[0, 0.78], [4.1, 0.78], [4.9, 0.6]],
      a: [[0, 1], [4.1, 1], [4.9, 0.45], [8.95, 0.45], [9.5, 1]] }, // slides to the corner and dims; lifted, it comes back
    mug: { x: [[0, 960], [2.75, 960], [3.2, 1240], [5.85, 1240], [6.7, 560]], y: [[0, 760], [5.85, 760], [6.7, 980]],
      s: [[0, 0.8], [5.85, 0.8], [6.7, 1.05]], a: [[0, 1], [7.94, 1], [8.4, 0.3]] },
    books: { x: [[0, 1360], [2.75, 1360], [3.2, 1580], [5.85, 1580], [6.9, 360]], y: [[0, 760], [5.85, 760], [6.9, 690]],
      s: [[0, 0.8], [5.85, 0.8], [6.9, 1.1]], a: [[0, 1], [7.94, 1], [8.4, 0.3]] },
    fresh: { x: [[0, 880], [5.85, 880], [7.0, 560]], y: [[0, 760], [5.85, 760], [7.0, 760]],
      s: [[0, 0.55], [3.3, 0.55], [3.48, 0.92], [3.62, 0.8], [3.74, 0.84], [5.85, 0.84], [7.0, 1.05]], a: [[0, 1], [7.94, 1], [8.4, 0.3]] },
    figure: { x: [[0, 1560]], y: [[0, 760]], s: [[0, 1], [9.9, 1], [10.02, 1.1], [10.16, 1]], a: [[0, 0.35], [9.75, 0.35], [10.0, 1]] },
    arc: { x: [[0, 0]], y: [[0, 0]], s: [[0, 1]], a: [[0, 1]] },
  };
  // The crowd: on "taking up space" the view closes in on the corner; on "For someone else" it opens again.
  const CAM = { s: [[0, 1], [6.2, 1], [7.3, 1.45], [7.94, 1.45], [8.5, 1]], x: [[0, 330]], y: [[0, 900]] };
  const LIFT = [9.0, 9.95]; // the old lamp rides the arc to the figure, arriving on "need"
  const DRIP = { at: 4.9, dur: 0.9, x: 40, y0: 0, y1: 120 }; // a dust drip from the old lamp's foot (local)

  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function track(keys, t) {
    if (t <= T(keys[0][0])) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [c0, v0] = keys[i - 1], [c1, v1] = keys[i];
      if (t <= T(c1)) return v0 + (v1 - v0) * ease((t - T(c0)) / (T(c1) - T(c0) || 1));
    }
    return keys.at(-1)[1];
  }

  // ---- watercolor machinery ----
  function ribbon(pts, w) { // polyline -> tapered ribbon polygon
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 12; k++) {
      const t = k / 12;
      dense.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]);
    }
    dense.push(pts.at(-1));
    const L = [], Rr = [];
    dense.forEach(([x, y], i) => {
      const [ax, ay] = dense[Math.max(0, i - 1)], [bx, by] = dense[Math.min(dense.length - 1, i + 1)];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const half = (w / 2) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, i / (dense.length - 1)))) ** 0.5);
      L.push([x - ((by - ay) / l) * half, y + ((bx - ax) / l) * half]);
      Rr.push([x + ((by - ay) / l) * half, y - ((bx - ax) / l) * half]);
    });
    return [...L, ...Rr.reverse()];
  }
  function deform(pts, depth, v) { // midpoint displacement, gaussian, scaled by edge length
    let out = pts;
    for (let d = 0; d < depth; d++) {
      const next = [];
      out.forEach((a, i) => {
        const b = out[(i + 1) % out.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        next.push(a, [(a[0] + b[0]) / 2 + p.randomGaussian(0, len * v), (a[1] + b[1]) / 2 + p.randomGaussian(0, len * v)]);
      });
      out = next;
    }
    return out;
  }

  let p, paper, ready, built = null;
  const readyP = new Promise((res) => { ready = res; });
  new p5((sk) => {
    p = sk;
    sk.setup = () => {
      sk.pixelDensity(1);
      sk.createCanvas(1920, 1080).parent(host);
      sk.noLoop();
      paper = sk.createGraphics(1920, 1080);
      paper.pixelDensity(1);
      sk.noiseSeed(11);
      paper.loadPixels();
      for (let y = 0; y < 1080; y++) {
        for (let x = 0; x < 1920; x++) {
          const m = (sk.noise(x * 0.004, y * 0.004) - 0.5) * 10 + (sk.noise(x * 0.09, y * 0.09) - 0.5) * 7;
          const i = 4 * (y * 1920 + x);
          paper.pixels[i] = 246 + m; paper.pixels[i + 1] = 241 + m; paper.pixels[i + 2] = 227 + m * 0.8; paper.pixels[i + 3] = 255;
        }
      }
      paper.updatePixels();
      let seed = 100;
      built = Object.fromEntries(Object.entries(SHAPES).map(([name, strokes]) => [name, strokes.map((s) => {
        sk.randomSeed(seed++);
        const shape = s.kind === 'line' ? ribbon(s.pts, s.w) : s.pts;
        const v = s.clean ? 0.012 : s.kind === 'line' ? 0.03 : 0.035; // the new lamp is painted cleaner
        const base = deform(shape, s.kind === 'line' ? 2 : 3, v);
        return { ...s, layers: Array.from({ length: LAYERS }, () => deform(base, 2, s.clean ? 0.01 : s.kind === 'line' ? 0.04 : 0.03)) };
      })]));
      ready();
    };
  }, host);

  function revealClip(layers, dir, q, seed) { // clip to the part the brush has reached
    const l = Math.hypot(...dir), dx = dir[0] / l, dy = dir[1] / l;
    const proj = layers.flat().map(([x, y]) => x * dx + y * dy);
    const lo = Math.min(...proj) - 30, hi = Math.max(...proj) + 30;
    const front = lo + (hi - lo) * q;
    const ctx = p.drawingContext;
    ctx.beginPath();
    for (let k = -2400; k <= 2400; k += 40) {
      const f = front + (p.noise(seed * 7 + k * 0.01) - 0.5) * 70;
      ctx.lineTo(f * dx - k * dy, f * dy + k * dx);
    }
    ctx.lineTo((lo - 3000) * dx + 2400 * dy, (lo - 3000) * dy - 2400 * dx);
    ctx.lineTo((lo - 3000) * dx - 2400 * dy, (lo - 3000) * dy + 2400 * dx);
    ctx.closePath();
    ctx.clip();
  }
  function paintStroke(s, q, seed) {
    if (q <= 0) return;
    const ctx = p.drawingContext;
    ctx.save();
    if (q < 1) revealClip(s.layers, s.dir, q, seed);
    const [r, g, b] = s.col;
    const a = 1 - Math.pow(1 - s.op, 1 / LAYERS); // per-layer alpha that stacks to the stroke's opacity
    for (const layer of s.layers) {
      ctx.beginPath();
      layer.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.9})`; // pigment collects at the drying edge
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }
  function drip(t) {
    const q = clamp01((t - T(DRIP.at)) / (DRIP.dur * R));
    if (q <= 0) return;
    const len = (DRIP.y1 - DRIP.y0) * Math.pow(q, 1.7); // gathers, then runs
    const ctx = p.drawingContext;
    ctx.fillStyle = 'rgba(11,13,23,0.22)';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(DRIP.x - 6 + k, DRIP.y0);
      ctx.quadraticCurveTo(DRIP.x - 2, DRIP.y0 + len * 0.6, DRIP.x - 3, DRIP.y0 + len);
      ctx.lineTo(DRIP.x + 3, DRIP.y0 + len);
      ctx.quadraticCurveTo(DRIP.x + 2, DRIP.y0 + len * 0.6, DRIP.x + 6 - k, DRIP.y0);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(11,13,23,0.45)';
    ctx.beginPath();
    ctx.ellipse(DRIP.x, DRIP.y0 + len + 4, 8, 10, 0, 0, 2 * Math.PI);
    ctx.fill();
  }

  function place(name, t) { // object transform at t (the old lamp rides the arc while lifted)
    const m = MOVE[name];
    let x = track(m.x, t), y = track(m.y, t), s = track(m.s, t);
    if (name === 'old' && t > T(LIFT[0])) {
      const q = ease(clamp01((t - T(LIFT[0])) / ((LIFT[1] - LIFT[0]) * R)));
      const [ax, ay] = ARC_PATH[Math.round(q * (ARC_PATH.length - 1))];
      s = 0.6 + 0.08 * q;
      x = ax; y = ay + 345 * s; // the lamp's foot hangs below the arc
    }
    return { x, y, s, a: track(m.a, t) };
  }

  const ORDER = ['books', 'mug', 'fresh', 'figure', 'arc', 'old']; // back to front
  function paint(local) {
    const t = Math.round(local * FPS) / FPS;
    const ctx = p.drawingContext;
    p.noiseSeed(7);
    p.blendMode(p.BLEND);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    p.image(paper, 0, 0);
    p.blendMode(p.MULTIPLY);
    const cs = track(CAM.s, t), cx = track(CAM.x, t), cy = track(CAM.y, t);
    ORDER.forEach((name, n) => {
      const [at, dur] = DRAW[name] ?? [0, 0];
      if (t < T(at)) return;
      const o = place(name, t);
      const k = cs * o.s;
      ctx.setTransform(k, 0, 0, k, cx + (o.x - cx) * cs, cy + (o.y - cy) * cs);
      ctx.globalAlpha = o.a;
      const strokes = built[name];
      strokes.forEach((s, i) => {
        const s0 = T(at) + (i / strokes.length) * dur * R, s1 = T(at) + ((i + 1) / strokes.length) * dur * R;
        paintStroke(s, ease(clamp01((t - s0) / (s1 - s0))), n * 10 + i);
      });
      if (name === 'old' && t < T(LIFT[0]) + 0.3 * R) drip(t);
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    p.blendMode(p.BLEND);
  }

  window.addEventListener('hf-seek', (e) => {
    const local = e.detail.time - START;
    if (local < -0.5 || local > Number(host.dataset.duration) + 0.5) return;
    if (built) paint(Math.max(0, local));
    else e.detail.waitUntil(readyP.then(() => paint(Math.max(0, local))));
  });
})();
