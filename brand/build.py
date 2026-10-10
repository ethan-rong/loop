#!/usr/bin/env python3
"""Loop mark candidates, built from geometry (stdlib only).

    python3 brand/build.py

Writes knot.svg, orbit.svg, bloom.svg (64-unit grid, currentColor), favicon-*.svg (32-unit grid,
re-tuned for 16 px, ink with a dark-mode flip to paper) and preview.html (marks inlined, fonts
embedded as data URIs so the sheet works from file://). Construction notes: README.md.
"""
import base64
import math
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
FONTS = HERE.parent / "public" / "fonts"
TAU = 2 * math.pi


def num(v, nd):
    s = f"{v:.{nd}f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def xy(p, nd):
    return f"{num(p[0], nd)} {num(p[1], nd)}"


def first_true(pred, lo, hi, n=50):
    """Smallest x in [lo, hi] where pred flips from False to True."""
    for _ in range(n):
        mid = (lo + hi) / 2
        lo, hi = (lo, mid) if pred(mid) else (mid, hi)
    return hi


def polyline_len(pts):
    return sum(math.dist(p, q) for p, q in zip(pts, pts[1:]))


def cubic_len(p0, p1, p2, p3, steps=200):
    def at(t):
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
        return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])
    return polyline_len([at(i / steps) for i in range(steps + 1)])


# ---------- 1. Knot: trefoil z(t) = i·e^(-it) - ik·e^(2it), one closed path, 3 dash gaps ----------

def knot(size, margin, w, clear, k=2.0, segs=48, nd=2):
    def P(t):
        return (math.sin(t) + k * math.sin(2 * t), math.cos(t) - k * math.cos(2 * t))

    def dP(t):
        return (math.cos(t) + 2 * k * math.cos(2 * t), -math.sin(t) + 2 * k * math.sin(2 * t))

    raw = [P(TAU * i / 3000) for i in range(3000)]
    xs, ys = [p[0] for p in raw], [p[1] for p in raw]
    S = (size - 2 * margin - w) / max(max(xs) - min(xs), max(ys) - min(ys))
    ox = size / 2 - S * (max(xs) + min(xs)) / 2
    oy = size / 2 - S * (max(ys) + min(ys)) / 2

    def Q(t):
        p = P(t)
        return (ox + S * p[0], oy + S * p[1])

    def dQ(t):
        d = dP(t)
        return (S * d[0], S * d[1])

    # The crossing opposite the top lobe sits on the y axis where cos t = -1/(2k): passing it at ta goes
    # under, at 2π - ta over. t + 2π/3 rotates the curve by 120°, so the other two under-passes follow.
    ta = math.acos(-1 / (2 * k))
    over = [Q(TAU - ta + j * 0.002) for j in range(-300, 301)]

    def clear_of_over(t):  # cap edge at least `clear` from the over strand's edge
        q = Q(t)
        return min(math.dist(q, o) for o in over) >= w + clear

    t1 = ta - first_true(lambda dt: clear_of_over(ta - dt), 0, 0.8)
    t2 = ta + first_true(lambda dt: clear_of_over(ta + dt), 0, 0.8)
    gap = polyline_len([Q(t1 + (t2 - t1) * i / 2000) for i in range(2001)])

    # Hermite cubics from the exact derivative, starting where the first gap ends.
    h = TAU / segs
    ts = [t2 + i * h for i in range(segs + 1)]
    segs_pts = []
    for a, b in zip(ts, ts[1:]):
        pa, pb, da, db = Q(a), Q(b), dQ(a), dQ(b)
        seg = (pa, (pa[0] + h / 3 * da[0], pa[1] + h / 3 * da[1]),
               (pb[0] - h / 3 * db[0], pb[1] - h / 3 * db[1]), pb)
        segs_pts.append(tuple((round(p[0], nd), round(p[1], nd)) for p in seg))
    d = "M" + xy(segs_pts[0][0], nd) + "".join(
        "C" + " ".join(xy(p, nd) for p in seg[1:]) for seg in segs_pts) + "Z"
    length = sum(cubic_len(*seg) for seg in segs_pts)  # measured on the rounded path
    dash = length / 3 - gap
    assert 0 < gap < dash, (gap, dash)

    pts = [Q(TAU * i / 3000) for i in range(3000)]
    bbox = (min(p[0] for p in pts) - w / 2, min(p[1] for p in pts) - w / 2,
            max(p[0] for p in pts) + w / 2, max(p[1] for p in pts) + w / 2)
    markup = (f'<path d="{d}" fill="none" stroke="currentColor" stroke-width="{num(w, 2)}" '
              f'stroke-linecap="round" stroke-dasharray="{num(dash, 2)} {num(gap, 2)}"/>')
    return markup, bbox


# ---------- 2. Orbit: two equal rings on the rising diagonal, linked, a dot at the handoff ----------

def orbit(size, margin, w, clear, d, dot, nd=2):
    c = size / 2
    R = (size - 2 * margin - w - d / math.sqrt(2)) / 2   # bounding box fills size - 2·margin
    e = d / 2 / math.sqrt(2)
    C1, C2 = (c - e, c + e), (c + e, c - e)              # lower-left, upper-right
    h = math.sqrt(R * R - (d / 2) ** 2) / math.sqrt(2)
    Xa, Xb = (c - h, c - h), (c + h, c + h)              # upper-left, lower-right crossings

    def ring(C, X, other):  # one arc, broken where this ring passes under the other
        th = math.atan2(X[1] - C[1], X[0] - C[0])

        def ok(a):
            p = (C[0] + R * math.cos(a), C[1] + R * math.sin(a))
            return abs(math.dist(p, other) - R) >= w + clear

        a0 = th + first_true(lambda dt: ok(th + dt), 0, 1.5)
        a1 = th - first_true(lambda dt: ok(th - dt), 0, 1.5) + TAU
        p0 = (C[0] + R * math.cos(a0), C[1] + R * math.sin(a0))
        p1 = (C[0] + R * math.cos(a1), C[1] + R * math.sin(a1))
        return f"M{xy(p0, nd)}A{num(R, nd)} {num(R, nd)} 0 1 1 {xy(p1, nd)}"

    lens = R - d / 2 - w / 2                              # clear half-width of the overlap
    assert dot < lens, (dot, lens)
    path = ring(C1, Xb, C2) + ring(C2, Xa, C1)            # ring 1 under at Xb, ring 2 under at Xa: linked
    markup = (f'<path d="{path}" fill="none" stroke="currentColor" stroke-width="{num(w, 2)}" '
              f'stroke-linecap="round"/><circle cx="{num(c, nd)}" cy="{num(c, nd)}" r="{num(dot, 2)}" '
              f'fill="currentColor"/>')
    return markup, (margin, margin, size - margin, size - margin)


# ---------- 3. Bloom: n petals (round tips, tapered sides, round valleys) around a round hole ----------

def bloom(size, margin, n, b, alpha, f, band, nd=2):
    c = size / 2
    d2 = c - margin - b                                    # tip-circle centre distance
    al, be = math.radians(alpha), math.pi / n
    # Petal-local frame: y along the petal (outward), x toward the next petal clockwise.
    Tp = (b * math.cos(al), d2 - b * math.sin(al))         # where the right side leaves the tip circle
    det = math.sin(al - be)                                # right side meets the bisector ray at V
    s = (Tp[0] * math.cos(be) - Tp[1] * math.sin(be)) / det
    rho = (math.sin(al) * Tp[1] - math.cos(al) * Tp[0]) / det
    V = (Tp[0] - s * math.sin(al), Tp[1] - s * math.cos(al))
    g = be - al                                            # side-to-bisector angle
    F1 = (V[0] + f / math.tan(g) * math.sin(al), V[1] + f / math.tan(g) * math.cos(al))
    r_valley = rho + f / math.sin(g) - f
    r0 = r_valley - band
    assert s > f / math.tan(g) and r0 > 0, (s, f / math.tan(g), r0)

    def glob(p, i):  # petal-local -> grid; petal 0 points up, i counts clockwise
        ph = -math.pi / 2 + i * 2 * be
        ax, ay = math.cos(ph), math.sin(ph)
        return (c - p[0] * ay + p[1] * ax, c + p[0] * ax + p[1] * ay)

    def mir(p):
        return (-p[0], p[1])

    large = 1 if al > 0 else 0
    bs, fs, rs = num(b, nd), num(f, nd), num(r0, nd)
    d = "M" + xy(glob(mir(Tp), 0), nd)
    for i in range(n):
        d += f"A{bs} {bs} 0 {large} 1 {xy(glob(Tp, i), nd)}"
        d += f"L{xy(glob(F1, i), nd)}"
        d += f"A{fs} {fs} 0 0 0 {xy(glob(mir(F1), i + 1), nd)}"
        if i < n - 1:
            d += f"L{xy(glob(mir(Tp), i + 1), nd)}"
    d += "Z"
    d += f"M{xy((c + r0, c), nd)}A{rs} {rs} 0 1 0 {xy((c - r0, c), nd)}A{rs} {rs} 0 1 0 {xy((c + r0, c), nd)}Z"
    markup = f'<path d="{d}" fill="currentColor" fill-rule="evenodd"/>'
    return markup, (margin, margin, size - margin, size - margin)


# ---------- the three candidates: 64-unit mark + 32-unit favicon re-tune ----------

MARKS = {
    "knot": dict(
        title="Knot",
        line="One closed line that passes over and under itself three times: pass it on, round and round.",
        mark=lambda: knot(64, 2, w=6, clear=3),
        fav=lambda: knot(32, 1, w=3.6, clear=2, segs=24, nd=1),
    ),
    "orbit": dict(
        title="Orbit",
        line="Two loops linked on a rising diagonal, the thing being passed held where they overlap.",
        mark=lambda: orbit(64, 2, w=6, clear=2, d=22, dot=3),
        fav=lambda: orbit(32, 1, w=3.6, clear=1.2, d=10.5, dot=1.4, nd=1),
    ),
    "bloom": dict(
        title="Bloom",
        line="Eight soft petals opening around an empty circle: many hands, one loop at the centre.",
        mark=lambda: bloom(64, 2, n=8, b=5, alpha=11, f=2.5, band=6),
        fav=lambda: bloom(32, 0.5, n=8, b=2.7, alpha=11, f=1.3, band=3.2, nd=1),
    ),
}

FAV_STYLE = '<style>svg{color:#15130f}@media (prefers-color-scheme:dark){svg{color:#f6f1e8}}</style>'


def svg_file(markup, size, style=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{style}{markup}</svg>\n'


def use(ref, size, px, extra=""):
    return f'<svg viewBox="0 0 {size} {size}" width="{px}" height="{px}" aria-hidden="true"{extra}><use href="#m-{ref}"/></svg>'


def lockup(key, bbox, cls):
    x0, y0, x1, y1 = bbox
    vb = f"{num(x0, 2)} {num(y0, 2)} {num(x1 - x0, 2)} {num(y1 - y0, 2)}"
    aspect = (x1 - x0) / (y1 - y0)
    svg = (f'<svg viewBox="{vb}" style="width:calc(1.04cap * {aspect:.4f})" aria-hidden="true">'
           f'<use href="#m-{key}"/></svg>')
    return f'<span class="lockup {cls}">{svg}Loop</span>'


def section(key, spec, bbox):
    figs = "".join(f'<figure>{use(key, 64, px)}<figcaption>{px}</figcaption></figure>' for px in (16, 32, 64, 256))
    tab = lambda cls: (f'<span class="tab {cls}">{use(key + "-fav", 32, 16)}Loop</span>')
    return f"""
<section id="{key}">
  <h2>{spec['title']}</h2>
  <p class="line">{spec['line']}</p>
  <div class="row">
    <div class="panel">{figs}</div>
    <div class="panel rev">{figs}</div>
  </div>
  <div class="row second">
    <div class="side">
      <div class="lockups">{lockup(key, bbox, "serif")}{lockup(key, bbox, "sans")}</div>
      {lockup(key, bbox, "serif big")}
      <div class="tabs">{tab("")}{tab("dark")}<span class="note">favicon-{key}.svg at 16 px</span></div>
    </div>
    <div class="topbar"><div class="topbar-inner">{lockup(key, bbox, "serif")}<span class="btn">Give something</span></div></div>
  </div>
</section>"""


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Loop marks</title>
<style>
@font-face{font-family:Fraunces;font-style:italic;font-weight:400 700;src:url(data:font/woff2;base64,@@FRAUNCES@@) format("woff2")}
@font-face{font-family:Inter;font-style:normal;font-weight:400 700;src:url(data:font/woff2;base64,@@INTER@@) format("woff2")}
:root{--ink:#15130f;--paper:#f6f1e8;--ink-2:#5c5649;--rule:rgba(21,19,15,.14)}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink);font:500 14px/1.45 Inter,system-ui,sans-serif}
body{margin:0 auto;max-width:1240px;padding:22px 24px 28px}
header h1{margin:0;font:italic 600 32px/1.1 Fraunces,Georgia,serif;font-variation-settings:"opsz" 72}
header p{margin:6px 0 16px;color:var(--ink-2);max-width:90ch}
section{border-top:1px solid var(--ink);padding:14px 0 20px}
body:has(section:target) section:not(:target),body:has(section:target)>header{display:none}
body:has(section:target) section{border-top:0}
h2{margin:0;font:italic 600 26px/1.1 Fraunces,Georgia,serif;font-variation-settings:"opsz" 72}
.line{margin:4px 0 12px;color:var(--ink-2)}
.row{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch}
.second{margin-top:14px}
.panel{display:flex;flex-wrap:wrap;align-items:flex-end;gap:22px;padding:18px 20px 10px;border:1px solid var(--rule);border-radius:14px}
.panel.rev{background:var(--ink);color:var(--paper);border-color:var(--ink)}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
figcaption{font-size:11px;letter-spacing:.06em;opacity:.6;font-variant-numeric:tabular-nums}
.side{display:flex;flex-direction:column;gap:14px;flex:1;min-width:min(360px,100%)}
.lockups{display:flex;gap:36px;align-items:baseline}
.lockup{display:inline-flex;align-items:baseline;gap:.4615em;font:italic 600 26px/1 Fraunces,Georgia,serif;font-variation-settings:"opsz" 72;letter-spacing:-.01em;color:var(--ink)}
.lockup.sans{font:700 26px/1 Inter,system-ui,sans-serif;letter-spacing:-.025em}
.lockup.big{font-size:60px;align-self:flex-start}
.lockup svg{height:1.04cap;position:relative;top:.02cap;flex:none;overflow:visible}
.tabs{display:flex;gap:8px;align-items:flex-end}
.tab{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 14px 0 10px;border-radius:8px 8px 0 0;background:#e3dccf;color:var(--ink);font:500 12px/1 system-ui,sans-serif}
.tab.dark{background:#2b2926;color:var(--paper)}
.note{margin-left:6px;font-size:11px;color:var(--ink-2)}
.topbar{flex:0 1 592px;align-self:flex-start;border:1px solid var(--rule);border-bottom:1px solid var(--ink);border-radius:12px 12px 0 0;background:var(--paper)}
.topbar-inner{display:flex;align-items:center;min-height:64px;padding:8px 16px;gap:8px}
.topbar .lockup{margin-right:auto}
.btn{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border-radius:999px;background:var(--ink);color:var(--paper);font:600 14px/1 Inter,system-ui,sans-serif}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>@@DEFS@@</defs></svg>
<header>
  <h1>Loop marks</h1>
  <p>Three candidates on a 64-unit grid, 6-unit even stroke, round caps, one colour (currentColor). Each row: 16 / 32 / 64 / 256 px on paper, then reversed on ink; lockups with the mark at cap height and a 12 px gap at the 26 px masthead size; the 32-unit favicon re-tune in a tab; the masthead as it would ship.</p>
</header>
@@SECTIONS@@
</body>
</html>
"""


def main():
    defs, sections = [], []
    for key, spec in MARKS.items():
        mark, bbox = spec["mark"]()
        fav, _ = spec["fav"]()
        (HERE / f"{key}.svg").write_text(svg_file(mark, 64))
        (HERE / f"favicon-{key}.svg").write_text(svg_file(fav, 32, FAV_STYLE))
        defs.append(f'<g id="m-{key}">{mark}</g><g id="m-{key}-fav">{fav}</g>')
        sections.append(section(key, spec, bbox))
    font = lambda name: base64.b64encode((FONTS / name).read_bytes()).decode()
    page = (PAGE.replace("@@FRAUNCES@@", font("fraunces-italic-latin.woff2"))
                .replace("@@INTER@@", font("inter-latin.woff2"))
                .replace("@@DEFS@@", "".join(defs))
                .replace("@@SECTIONS@@", "".join(sections)))
    (HERE / "preview.html").write_text(page)
    print("wrote", ", ".join(sorted(p.name for p in HERE.iterdir() if p.suffix in (".svg", ".html"))))


if __name__ == "__main__":
    main()
