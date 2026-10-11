// Shots 3 and 14 (3D): a (2,3) torus knot in ink wire on cream that settles face-on, then flattens onto the
// brand knot (brand/knot.svg). Bundled to comp/assets/knot.js by esbuild. Deterministic: every frame is a pure
// function of the time HyperFrames seeks to (window "hf-seek"), nothing accumulates between frames.
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

const W = 1920, H = 1080, FPS = 30;
const INK = 0x0b0d17;

// The brand curve, exactly as brand/build.py draws it: P(t) = (sin t + 2 sin 2t, cos t - 2 cos 2t), SVG y-down,
// fitted into a 64-unit box with a 2-unit margin and a 6-unit stroke.
const P = (t) => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t)];
const dP = (t) => [Math.cos(t) + 4 * Math.cos(2 * t), -Math.sin(t) + 4 * Math.sin(2 * t)];
const raw = Array.from({ length: 3000 }, (_, i) => P((2 * Math.PI * i) / 3000));
const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
const S = (64 - 4 - 6) / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
const OX = 32 - (S * (Math.max(...xs) + Math.min(...xs))) / 2;
const OY = 32 - (S * (Math.max(...ys) + Math.min(...ys))) / 2;
const TUBE = 3 / S; // half the brand stroke, in curve units

// Torus knot (R = 2 gives radius 1..3, the same as the brand curve), turned so its first lobe points up the
// way the brand's top lobe does (t = pi); along the curve, u in [0, 4pi] meets brand t = pi + u/2.
const TUB = 192, RAD = 8;
const toBrand = (x, y, z) => [y, -x, z];
const centre = (u) => {
  const cs = Math.cos(1.5 * u);
  return toBrand((2 + cs) * Math.cos(u), (2 + cs) * Math.sin(u), Math.sin(1.5 * u));
};
const unit = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

function buildEdges(threshold) {
  const g = new THREE.TorusKnotGeometry(2, TUBE, TUB, RAD, 2, 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = toBrand(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, x, y, z);
  }
  const e = new THREE.EdgesGeometry(g, threshold).attributes.position.array;
  const cs = Array.from({ length: TUB }, (_, i) => centre((4 * Math.PI * i) / TUB));
  const flat = new Float32Array(e.length);
  for (let v = 0; v < e.length; v += 3) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < TUB; i++) {
      const d = (e[v] - cs[i][0]) ** 2 + (e[v + 1] - cs[i][1]) ** 2 + (e[v + 2] - cs[i][2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    // Offset from the tube's centre, measured across the projected curve, laid across the brand curve.
    const u = (4 * Math.PI * best) / TUB, t = Math.PI + u / 2;
    const c0 = cs[best], c1 = centre(u + 1e-3);
    const [tx, ty] = unit([c1[0] - c0[0], c1[1] - c0[1]]);
    const across = (e[v] - c0[0]) * -ty + (e[v + 1] - c0[1]) * tx;
    const [bx, by] = unit(dP(t));
    const b = P(t);
    flat[v] = b[0] + across * -by;
    flat[v + 1] = b[1] + across * bx;
    flat[v + 2] = 0;
  }
  return { round: Float32Array.from(e), flat };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const outCubic = (x) => 1 - Math.pow(1 - x, 3);
const inOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, s) => a + (b - a) * s;
const AXIS = new THREE.Vector3(0.38, 1, 0.22).normalize();

// box = the 64-unit SVG box on screen in CSS px: [left, top, size]. Returns the group transform that draws the
// curve-unit geometry exactly over that box (y flipped: the curve is SVG y-down).
const placeFor = ([left, top, size]) => ({
  x: left + (OX * size) / 64 - W / 2,
  y: H / 2 - (top + (OY * size) / 64),
  k: (S * size) / 64,
});

function mount(host) {
  const cfg = JSON.parse(host.dataset.knot);
  const start = Number(host.dataset.start), dur = Number(host.dataset.duration);
  const canvas = host.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -5000, 5000);
  const { round, flat } = buildEdges(cfg.threshold ?? 10);
  const geom = new LineSegmentsGeometry();
  const mat = new LineMaterial({ color: INK, linewidth: cfg.linewidth ?? 2.6, worldUnits: false, transparent: true, side: THREE.DoubleSide }); // the y flip reverses winding
  mat.resolution.set(W, H);
  const lines = new LineSegments2(geom, mat);
  const group = new THREE.Group();
  group.add(lines);
  scene.add(group);
  const buf = new Float32Array(round.length);
  const svg = host.querySelector('.knot2d');
  const fades = [...host.querySelectorAll('[data-in]')];
  const from = placeFor(cfg.from), to = placeFor(cfg.to);

  function frame(local) {
    const t = Math.round(local * FPS) / FPS;
    const spin = cfg.spinEase === 'inout' ? inOutCubic(clamp01(t / cfg.spinEnd)) : outCubic(clamp01(t / cfg.spinEnd));
    group.quaternion.setFromAxisAngle(AXIS, (1 - spin) * cfg.turns * 2 * Math.PI);
    const s = inOutCubic(clamp01((t - cfg.flatAt) / cfg.flatDur));
    for (let i = 0; i < buf.length; i++) buf[i] = lerp(round[i], flat[i], s);
    geom.setPositions(buf);
    if (cfg.drawEnd) { // trim path: the wire draws itself along the knot before it ties
      const total = buf.length / 6;
      geom.instanceCount = Math.max(1, Math.round(total * outCubic(clamp01(t / cfg.drawEnd))));
    }
    const k = lerp(from.k, to.k, s);
    group.position.set(lerp(from.x, to.x, s), lerp(from.y, to.y, s), 0);
    group.scale.set(k, -k, k);
    // The wire hands over to the brand stroke over three frames once it lies flat.
    const hand = clamp01((t - (cfg.flatAt + cfg.flatDur) + 0.05) / 0.1);
    mat.opacity = 1 - hand;
    svg.style.opacity = String(hand);
    for (const el of fades) {
      const q = clamp01((t - Number(el.dataset.in)) / 0.067);
      el.style.opacity = String(q);
      el.style.transform = `translateX(${(1 - q) * -18}px)`;
    }
    renderer.render(scene, camera);
  }

  window.addEventListener('hf-seek', (e) => {
    const local = e.detail.time - start;
    if (local < -0.5 || local > dur + 0.5) return;
    frame(Math.max(0, Math.min(dur, local)));
  });
  return frame;
}

window.__knotFrames = [...document.querySelectorAll('.knot-scene')].map(mount);
