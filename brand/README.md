# Loop marks (Lane L)

Three candidates. Every coordinate comes from `build.py` (stdlib Python):
`python3 brand/build.py` regenerates all the files here. Open `preview.html` to compare them. It is
self-contained, with the fonts embedded. `preview.html#knot`, `#orbit` and `#bloom` each show a single row.

| File | What |
|---|---|
| `knot.svg`, `orbit.svg`, `bloom.svg` | 64×64 viewBox, `currentColor`, no colour on the root. Recolour with CSS `color`. |
| `favicon-knot.svg`, `favicon-orbit.svg`, `favicon-bloom.svg` | 32×32 re-tune for 16 px tabs. Ink `#15130f`, flips to paper `#f6f1e8` under `prefers-color-scheme: dark`. |
| `preview.html` | 16 / 32 / 64 / 256 px on paper and reversed on ink, the lockups, a favicon tab and a masthead mock. |
| `build.py` | The construction itself. Change a parameter in `MARKS` and re-run. |

## Shared grid

- 64-unit square with a 2-unit margin, so the ink box is 60 units. The knot is 60 wide and 56 tall, centred.
- Stroke is 6 units with round caps: 1.5 px at 16 px, 24 px at 256 px. The bloom is filled, and its thinnest
  band (the ring around the hole) is also 6 units.
- Over-under gaps: the under strand stops once its cap edge is `clear` units from the over strand's edge.
  That puts the dash end at distance `w + clear` from the over strand's centreline, so the gap is about
  `2(w + clear) / sin θ` for a crossing angle θ. The code solves the exact value numerically.
- Favicons use a 32-unit grid with a 1-unit margin (bloom 0.5). The stroke is 3.6, which is 1.8 px at
  16 px, heavier than the 1.5 px a straight halving would give. Gaps are re-solved for the heavier stroke,
  and coordinates are rounded to 1 decimal.

## 1. Knot

- Curve: trefoil `z(t) = i·e^(−it) − i·k·e^(2it)` with k = 2, i.e. `x = sin t + 2 sin 2t`,
  `y = cos t − 2 cos 2t`. The radius `√(5 − 4 cos 3t)` runs from 1 to 3. The curve is three-fold symmetric:
  `t + 2π/3` rotates it by 120°. One lobe points up and two form the base.
- Crossings sit on the symmetry axes at `cos t = −1/(2k)` (t ≈ 104.5°), where strands cross at about 75.5°.
  The traversal alternates over and under, so the three under-passes fall at `ta`, `ta + 2π/3` and
  `ta + 4π/3`, equally spaced in arc length.
- Drawing: one closed path of 48 cubic Béziers. Each is a Hermite fit from the exact derivative over 7.5°.
  The path starts where a gap ends. The gaps are a dash pattern, `stroke-dasharray = (L/3 − g) g`, where L
  is measured on the rounded path and g is the arc length during which the under strand is within
  `w + clear` = 9 units of the over strand's centreline (g ≈ 18.8). The lengths are absolute, with no
  `pathLength`, so design tools render it the same as browsers do. Animating `stroke-dashoffset` makes the
  line travel round the knot.
- Parameters: w 6, clear 3. Favicon: w 3.6, clear 2, 24 segments.

## 2. Orbit

- Two equal rings with their centres on the rising diagonal, offset d = 22. The radius comes from the box:
  `d/√2 + 2R + w = 60`, giving R ≈ 19.22. The rings cross on the falling diagonal at about 70°.
- Linked: the lower-left ring breaks at the lower-right crossing and the upper-right ring breaks at the
  upper-left one. Each ring is a single SVG arc with round caps, with no dashes.
- The handoff dot (r 3) sits at the centre of the overlap. The overlap's clear half-width is
  `R − d/2 − w/2` ≈ 5.2.
- Parameters: w 6, clear 2. Favicon: d 10.5, w 3.6, clear 1.2, dot 1.4.

## 3. Bloom

- Eight petals at 45° intervals, with petal 0 straight up so the vertical and horizontal petals land on the
  pixel grid. Each petal has a tip circle of radius b = 5 whose outer edge touches radius 30. Its sides are
  tangents to that circle, tapering inward at α = 11°.
- Neighbouring sides meet on the bisector, and the valley is rounded by a circle of radius f = 2.5 tangent to
  both. The outline is 8 × (tip arc, side, valley arc, side): one subpath, arcs and lines only.
- Hole: a circle whose radius is the valley depth minus 6 (the stroke weight), ≈ 5.2. It is a second subpath
  with `fill-rule="evenodd"`.
- Favicon: b 2.7, f 1.3, band 3.2, margin 0.5.

## Lockup

- The mark's ink height is 1.04 × cap height. Round shapes overshoot by 2 % above the cap line and 2 % below
  the baseline. The gap is 12 px at the 26 px masthead size, which is 0.4615 em and scales with the type.
- CSS: `.lockup{display:inline-flex;align-items:baseline;gap:.4615em}` and
  `.lockup svg{height:1.04cap;position:relative;top:.02cap}`, with the svg viewBox cropped to the ink box
  (see `lockup()` in `build.py`).
- Measured in Chrome at 26 px: Fraunces italic 600 gives a mark of 18.9 px (0.728 em), Inter 700 gives
  19.7 px (0.757 em). Use these em values where the `cap` unit is unsupported.
