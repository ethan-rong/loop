# Loop — design notes

Frutiger Aero, restrained: a saturated sky-to-meadow page with slow aero bubbles, aero glass cards,
glossy pill buttons and orbs, Nunito. Optimistic and tactile, not a toy. One column, max 520 px, so it reads the same on a phone and in a
half-width laptop window (the two-person demo is two windows side by side).

## Reference board

Three references, one pattern taken from each. Awards were checked on 2026-10-10.

1. **Shupatto Bags brand site** by mount inc. Awwwards Site of the Day, Feb 3 2024 (also a 2024 D&AD
   Wood Pencil). Pattern: make a physical action legible through motion and big product imagery.
   In Loop, the item photo is the hero of every detail page, and the handoff is shown as three physical
   steps: Posted → Reserved → Collected. The pickup code scales in; a collected item plays one soft ripple.
2. **Ocean Lovers Guide to Compost** by HLabs. Awwwards Honorable Mention, May 16 2025.
   Pattern: blue-and-white sustainability storytelling. In Loop: the sky/mint palette, white glass, and a
   plain reuse story ("Handed over and kept in use", "N items kept in use" counted from real
   `collected` items, hidden at zero).
3. **motion.dev examples / UI gallery** (no award claim). Pattern: state transitions that keep identity.
   In Loop, the item photo carries a `view-transition-name`, so it morphs from the board card into
   the detail hero and back (`document.startViewTransition`, 200–240 ms; 180 ms fade where unsupported).

## Tokens in use (public/styles.css `:root`)

| Token | Value | Use |
|---|---|---|
| `--ink` / `--ink-2` | `#0b2a4a` / `#3d5a78` | text / secondary text |
| `--accent` | `#1b8fe6` | tints only (chips, hovers, spinner track) |
| `--link` | `#0b67b5` | links, secondary/ghost-button text, Gemini tag |
| `--accent-deep` | `#0d6fc0` | timeline, current step, input focus border |
| `--edge` | `#1272c4` | focus ring, dashed Gemini border |
| `--gloss` | `#62b4f6 0% → #1676c9 30% → #0d6fc0 60% → #0a5fa8 100%` | primary pill buttons, camera orb |
| `--band` | white `.35 → .12` over the top 54 % of a 50 %-tall pseudo-element, then a crisp cut | aero highlight on primary buttons |
| `--spec` | white specular dot at 32 % / 24 % fading by 28 % | orbs: camera, timeline dots, success badge |
| `--green-ink` / `--green-edge` | `#14603a` / `#23814e` | collected, "Checked by …" |
| `--amber-ink` | `#6e4300` on `#fff1d6` | reserved, demo-mode and offline banners |
| `--violet-ink` | `#4a32b8` | offered |
| `--sky-ink` | `#0b4a78` | open need |
| `--danger-ink` | `#a12a2a` | inline errors |
| `--sky-top` / `--sky-mid` / `--meadow` | `#b9dcff` / `#e6f4ff` / `#dff5e6` | page gradient |
| glass | `rgba(255,255,255,.62)`, blur 18 px, saturate 170 %, 1 px `rgba(255,255,255,.6)` edge, radius 20 px | cards |
| `--sheen` | 118° white `.42 → .15` with a crisp edge at 34 %, then `.06 → 0` by 60 % | diagonal reflection on every glass card |
| `--shadow` / `--shadow-lift` | `0 16px 36px -14px rgba(16,86,170,.30)` + pure-white 1 px inner top line / bluer `rgba(27,120,230,.42)` | cards at rest / hovered or focused link cards (lift 2 px) |

Page: a fixed `body::before` layer with `linear-gradient(180deg, #b9dcff, #e6f4ff 50%, #dff5e6)`, a
warm-white sun at top-left and a soft green meadow swell along the bottom. The body has no background
of its own; an opaque one hid this layer completely before. Four aero bubbles sit behind the content
(`.b1`–`.b4`, 96–420 px, `opacity: .34`): a white rim, a crisp highlight arc (`::before` border
segment) and a specular dot. Every bubble colour is lighter than the sky behind it. They drift 14–48 px over 44–64 s
(`alternate`, transform only) and get `animation: none` under reduced motion.

Gloss: primary buttons keep `--gloss` and add the `--band` pseudo-element and, on hover, an inner
cyan bottom glow plus a bluer outer glow. Chips get a white top sheen and a 1 px inner highlight;
text fields stay matte. The logo and favicon are the same orb: a radial gradient with its focus at
top-left, a crisp gloss ellipse, a cyan bottom glow, a white rim, and embossed loop arrows. The
logo pops once on load (scale 1 → 1.06 → 1, 520 ms). The "Hi, Maya" hero has a faint sun flare
in its top-right corner: a warm core, a halo ring and one ghost dot. Timeline connectors glow on
reached steps (blue; blue → green into Collected). Done dots are blue gloss orbs, and Collected
is a green glass orb (`#2eaa66 → #12703c`) with a soft halo. The pickup code is an aero badge: a
deep-blue glossy pill (`#2a84d8 → #0e60b0 18% → #0a4f96 55% → #083f7c`) with white digits, a
crisp top band that ends at 18 % of the pill, above the digits, and an inner cyan bottom glow.

Type: Nunito 500/700/800, self-hosted (`public/fonts/nunito-latin.woff2`,
Google Fonts v32 latin subset, 38 KB variable file; licence in `public/fonts/OFL.txt`); sizes
28/22/17/15/13. Motion: chips and buttons 150–200 ms, code reveal 250 ms, logo pop 520 ms (once),
collected ripple 600 ms (once). Only the bubble drift runs longer than 600 ms.

AI vs human: a Gemini draft has a dashed `--edge` border, a sparkle and "Drafted by Gemini — check it".
Editing any field or tapping **Looks right** turns it solid green ("Checked by Ethan"). Publish
buttons stay locked until then, and Enter never publishes a Gemini draft.

### Deviations from SPEC, all for contrast

- **Gloss gradient.** SPEC `#4fb0ff → #1b8fe6 → #1480d8` puts white labels on 3.4:1 or less. The bright
  highlight ends at 30 %, above the glyphs, so white text sits on 4.7–6.5:1.
- **Highlight band.** The aero band is a 50 %-tall pseudo-element, but its white ends at 54 % of it,
  about 28 % of a 44 px button, just above the cap line (~35 %). A full-height 35 % band measured 3.7:1
  on the glyph rows. With the cut, the glyph rows stay at 4.76:1, the same as without the band.
- **Sheen strength.** A 6 % white sheen on 62 % glass shifts the colour by about 2/255, which is
  invisible. The sheen is `.42` at the corner and `.15` at its crisp edge: still faint, but visible.
  It only adds white, so dark text gains contrast.
- **Link text.** `#0b67b5` (5.09:1 on glass over the darkest sky). `#1b8fe6` was 3.3:1, and the
  earlier `#0d6fc0` fell to 4.55:1 once the sky got more saturated.
- **Focus ring.** A solid 3 px `--edge` outline, 2 px offset, instead of the soft 45 % box-shadow ring,
  which was too faint on the sky background.
- **Edges.** `#1272c4` and `#23814e` replace SPEC `#1b8fe6` / `#2f9e64` and Lane B's `#1a8ae0` /
  `#2a925c`. Against the new `#b9dcff` sky, those measured 2.56:1 and 2.75:1.
- **On-sky controls.** The back link, "Reset demo" and "Use a different photo" sit directly on the
  sky, so they get a glass pill (`rgba(255,255,255,.62)`, blur 10 px): link text on bare top sky is
  4.07:1. Section titles and the footer count stay bare (ink 10.2:1, ink-2 5.03:1).

## Accessibility checks run

- **Contrast** (re-measured after the aero pass, 2026-10-10).
  - Method: a script composited every translucent layer over the darkest sky stop `#b9dcff`. Lighter
    backdrops, sheens and bubbles only raise dark-text contrast. White-text gloss surfaces were sampled
    row by row across the glyph rows, band included.
  - As a margin check for backdrop `saturate()`, everything was re-run over `#a9d6ff`. All pairs
    still pass there (lowest: placeholder 4.62, ink-2 on bare sky 4.69, white on gloss 4.76, link on
    glass 4.96).
  - All text pairs are ≥ 4.5:1 on `#b9dcff`. Lowest: placeholder 4.63, white on primary buttons
    (glyph rows, with band) 4.76, ink-2 on bare sky 5.03, link on glass and on-sky pills 5.09.
    Pickup-code digits are 6.69. Chips are 5.52–7.15 and banners 7.63–7.80.
  - All edges and icons are ≥ 3:1: Collected check 3.35, success-badge check 3.39, checked border
    3.41, field border 3.43, focus ring and dashed border 3.49, white icon on band rows 3.56, done-dot
    check 3.81.
- **Keyboard** (tested in Chrome):
  - Every action is a native button, link or form control.
  - `:focus-visible` shows the ring.
  - Escape closes the person menu and returns focus to its button.
  - A route change moves focus to the page `h1`. Reserve, confirm, decline and release move it to the
    action heading.
  - A wrong code focuses and selects the code input.
- **Screen readers.** One polite live region announces drafting, "Checked by …", the pickup code
  (digit by digit), 409s, wrong codes, and offline/online. The timeline uses `aria-current="step"` plus
  hidden "done" / "not yet". No state is shown by colour alone: chips and labels always carry text.
- **Targets.** Buttons, quick picks, condition chips and menu rows are at least 44 px tall.
- **Reduced motion.** `@media (prefers-reduced-motion: reduce)` neutralises CSS animation and
  transitions. The bubbles and the logo pop get `animation: none`, so they are fully static, not
  snapped to an end frame. JS skips view transitions and the shake: verified by forcing the flag,
  because the test browser cannot emulate the media query. The aero-pass rules are verified by
  reading the code, not observed.
- **Widths.** 390, 640 and 1280 px with no horizontal scroll. After the aero pass: 390, 720 and
  1024 px, with `scrollWidth === innerWidth` at 390 and 720.
- **Escaping.** A request titled `<img src=x onerror=…>` renders as text.
