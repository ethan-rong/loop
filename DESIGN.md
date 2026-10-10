# Loop — design notes

**v2 (current, 2026-10-10):** modern and mostly white, with Frutiger Aero kept as an accent. A
near-white page, white cards with a hairline and a short soft shadow, big confident Nunito, one deep
calm blue. The aero traces are deliberate and few: a sky-to-mint ribbon at the top of the page with
two faint bubbles, the glossy logo orb, and the two "moment" surfaces (pickup-code badge, Collected
orb). One column, max 592 px (528 px of content from 640 px up), so it reads the same on a phone and
in a half-width laptop window (the two-person demo is two windows side by side). v1, the full aero
costume, is kept at the end for history: the user found its saturated sky blue cheap ("这蓝色很丑").

## Reference board

Three references, one pattern taken from each. Awards were checked on 2026-10-10.

1. **Shupatto Bags brand site** by mount inc. Awwwards Site of the Day, Feb 3 2024 (also a 2024 D&AD
   Wood Pencil). Pattern: make a physical action legible through motion and big product imagery.
   In Loop, the item photo is the hero of every detail page, and the handoff is shown as three physical
   steps: Posted → Reserved → Collected. The pickup code scales in; a collected item plays one soft ripple.
2. **Ocean Lovers Guide to Compost** by HLabs. Awwwards Honorable Mention, May 16 2025.
   Pattern: blue-and-white sustainability storytelling. In Loop: the sky-to-mint ribbon over white
   surfaces, and a plain reuse story ("Handed over and kept in use", "N items kept in use" counted
   from real `collected` items, hidden at zero).
3. **motion.dev examples / UI gallery** (no award claim). Pattern: state transitions that keep identity.
   In Loop, the item photo carries a `view-transition-name`, so it morphs from the board card into
   the detail hero and back (`document.startViewTransition`, 200–240 ms; 180 ms fade where unsupported).

## v2 (current)

### Tokens (public/styles.css `:root`)

| Token | Value | Use |
|---|---|---|
| `--ink` / `--ink-2` | `#0f1f2e` / `#4a5d70` | text / secondary text |
| `--page` / `--card` | `#f6f8fb` / `#fff` | page colour (on `html`) / card surface |
| `--line` | `#e3eaf2` | decorative hairlines: card edges, dividers, meet tiles |
| `--field-border` | `#7d8ea1` | control edges: inputs, quick picks, composer, idle timeline and agree dots |
| `--accent` | `#1f6fd3` | primary fill, my bubble, focus ring, AI-draft dashed edge, selected states |
| `--accent-hi` | `#2b7de9` | top 10 px of the primary gradient only |
| `--accent-edge` | `#5a8bcf` | secondary-button and drop-zone edges |
| `--link` | `#1a5fb8` | links, secondary and ghost text, thread pills, Gemini tag |
| `--blue-ink` / `--sky-ink` | `#1753a6` / `#0b5b85` | text on blue tints / open need |
| `--success` / `--green-ink` | `#1f9d5a` / `#136b3d` | Collected orb, checked edge, agree dot / text on green |
| `--warning` / `--amber-ink` / `--amber-bg` | `#d98b12` / `#7a4800` / `#fdf1dc` | reserved, demo-mode and offline banners |
| `--violet` / `--violet-ink` | `#6a4fe0` / `#4b33b8` | offered |
| `--danger-ink` / `--danger-bg` | `#a5281b` / `#fdecea` | errors |
| `--shadow` / `--shadow-lift` | `0 4px 16px rgba(15,31,46,.06)` / `0 10px 28px rgba(15,31,46,.10)` | cards at rest / hovered link cards (lift 2 px) |
| `--radius` | 20 px | cards (inputs and notices 12, meet tiles 14, pills 999) |
| `--primary` | `#2b7de9 0 → #1f6fd3 10px → #1c68c9 100%`, plus a 1 px inner highlight `rgba(255,255,255,.28)` | primary buttons, camera orb |
| `--spec` | white specular dot at 32 % / 24 % | the glossy orbs only |
| type | h1 `clamp(32px, 26px + 1.6vw, 36px)`/800, h2 21/700, h3 18/700, body 16/500 at line-height 1.5, lead 17, small 15 and 13 | Nunito, self-hosted (unchanged file) |
| gutters | 16 px below 640 px, 32 px from 640 px; card padding 20 / 24 | |

### Surfaces

- **Page.** `html { background: #f6f8fb }`. The body stays transparent so the z-index -1 ribbon can paint.
- **Ribbon.** `.ribbon` in index.html: absolute at the top, 180 px, `linear-gradient(100deg, #cfe6ff, #dcf5e8)`
  under an eased fade to the page colour (clear to 45 %, then `.42 / .78 / .95 / 1` at 66 / 82 / 93 / 100 %).
  A linear fade left a visible seam at its bottom edge. It scrolls away with the page. Its two bubbles
  (128 px and 38 px: white rim and specular dot, `opacity: .75`) sit inside it with `overflow: hidden`.
  They drift 10–12 px over 38–46 s and get `animation: none` under reduced motion.
- **Top bar.** White at 58 % with a 16 px blur over the ribbon, hairline bottom. It is chrome, not a card,
  and it is the only blur left.
- **Cards** (`.glass`; the v1 name is kept so app.js stays untouched). White, 1 px `#e3eaf2`, radius 20,
  `--shadow`. No blur, no sheen. The board greeting and the first-run hero are not cards: big type
  sits straight on the ribbon (`.hero.glass` resets the surface).
- **Buttons.** Primary uses `--primary` and the 1 px inner highlight. v1's gloss band (`::before`) is gone.
  Hover is `brightness(.94)`: darker, so label contrast only rises. Secondary is white with `--link`
  text and a 1 px `#5a8bcf` edge. Ghost is text only, with an 8 % accent tint on hover. Every `.btn`
  has a 1 px transparent border, so forced-colors mode still outlines it.
- **Chips.** Tinted 11–12 % with dark text, 6 px dot, 13 px/700.
- **AI vs human.** A Gemini draft has a 1.5 px dashed `#1f6fd3` edge, a sparkle and "Drafted by Gemini —
  check it". Editing any field or tapping **Looks right** turns it solid 1.5 px `#1f9d5a` ("Checked by
  Ethan"). Publish buttons stay locked until then, and Enter never publishes a Gemini draft (behaviour
  unchanged from v1).
- **Thread.**
  - Loop bubble: white, 1 px `rgba(31,111,211,.28)` edge, the logo orb beside it.
  - Mine: solid `#1f6fd3`, white text.
  - Theirs: `#eef3f8` plus a 1 px `#dbe4ee` hairline. `#eef3f8` alone is 1.05:1 against the page, and
    the conversation sits on the page, not in a card.
  - Action pills are secondary. The one Loop wants next (accept, I'm here, enter code; still
    `.btn-primary` in the markup) gets an 8 % accent tint and a full `#1f6fd3` edge instead of a fill.
  - The composer is one field: the white dock carries the 1 px field edge and the focus ring
    (`:has(.composer-input:focus-visible)`), and the textarea inside is bare. Without `:has`, the dock's
    edge still turns accent on `:focus-within`.
- **Glossy "moments."**
  - Logo and favicon orb, re-tinted `#a9cfff → #3a86ea → #154f9c` (gloss ellipse, rim and bottom glow
    kept). The thread's Loop orb reuses these gradient ids.
  - Pickup-code badge: `#3584ea → #1f6fd3 18 % → #1a5fb8 55 % → #154f9c`. Its band's white ends at
    ~17 % of the pill, above the digits (~28 %).
  - Collected orb and the final timeline orb: `#36b36e → #1f9d5a → #178a4c` plus the specular dot.
- **Timeline.** Done dots stay small blue orbs. Connectors are 2 px and flat: `#dbe3ec`, accent when
  reached, accent → green into Collected, no glow.
- **Pile review.** Same cards. Boxes have a white 2 px rim, a `#1a5fb8` outline and a 12 % accent fill.
  Numbered discs are `#1f6fd3` (`#5b6e82` when unticked).
- **Toast.** White pill, hairline, soft shadow, no blur.
- **Motion** unchanged: 150–250 ms transitions, view transitions 200 / 240 ms, logo pop once (520 ms),
  ripple once (600 ms), and the same reduced-motion block.
- **Spacing fix.** `.list`, `.grid` and `.timeline` set only `margin-bottom: 0`. Their old `margin: 0`
  beat the stacks' `margin-top` (same specificity, later rule), so the timeline card touched the card
  above it in v1.

### Deviations from DESIGN_V2, all for contrast

- **Primary gradient.** White on `#2b7de9` is 4.03:1, under 4.5 for a 16 px label. The gradient reaches
  `#1f6fd3` (4.91:1) by 10 px from the top, then darkens to `#1c68c9` (5.42:1). Measured in Chrome: on a
  one-line 44 px button the glyph tops sit at 15.4 px. A wrapped label's first row starts about 3 px
  below its 10 px padding, so about 13 px. A percentage stop would land in the glyph rows once a label wraps.
- **Secondary edge.** `#5a8bcf` (3.48:1 on white, 3.27:1 on the page). Lighter blues measured 2.6–3.0.
- **Idle dots.** The timeline and agree dots use `--field-border` `#7d8ea1`; `#8a9bad` was 2.85:1.
- **Theirs bubble.** It gets the hairline described above.
- **Thread pills.** All are secondary, but one keeps a tint and an accent edge, so the next step still
  stands out.

### Contrast (v2, measured 2026-10-10)

Method: a scratch script (`.tmp-b3/contrast.mjs`, gitignored) composites each translucent layer over
its real backdrop, then computes the WCAG ratio. Text on the ribbon is measured on its darkest stop,
`#cfe6ff`. The fade, the top bar's white wash and the bubbles only add white, so dark text only gains there.

| Pair | Text / edge | Background (composited) | Ratio | Needs |
|---|---|---|---|---|
| ink / page | `#0f1f2e` | `#f6f8fb` | 15.72 | 4.5 |
| ink / ribbon sky end (darkest ribbon stop) | `#0f1f2e` | `#cfe6ff` | 13.07 | 4.5 |
| ink-2 / white card | `#4a5d70` | `#ffffff` | 6.79 | 4.5 |
| ink-2 / page (meta, footer, closed note) | `#4a5d70` | `#f6f8fb` | 6.39 | 4.5 |
| ink-2 / ribbon sky end (lead under the greeting) | `#4a5d70` | `#cfe6ff` | 5.31 | 4.5 |
| ink-2 / segmented track `#eef3f8` | `#4a5d70` | `#eef3f8` | 6.09 | 4.5 |
| link / white (links, secondary and ghost buttons, AI tag) | `#1a5fb8` | `#ffffff` | 6.23 | 4.5 |
| link / page (back link, footer, thread pills) | `#1a5fb8` | `#f6f8fb` | 5.85 | 4.5 |
| link / ribbon sky end (back link at the top) | `#1a5fb8` | `#cfe6ff` | 4.87 | 4.5 |
| link / emphasised thread pill (8 % accent over page) | `#1a5fb8` | `#e5edf8` | 5.28 | 4.5 |
| placeholder / white | `#66788b` | `#ffffff` | 4.54 | 4.5 |
| white / primary `#1f6fd3` (glyph rows, from 10 px down) | `#ffffff` | `#1f6fd3` | 4.91 | 4.5 |
| white / primary bottom | `#ffffff` | `#1c68c9` | 5.42 | 4.5 |
| white / my bubble | `#ffffff` | `#1f6fd3` | 4.91 | 4.5 |
| ink / theirs bubble | `#0f1f2e` | `#eef3f8` | 14.98 | 4.5 |
| white / code badge at 18 % (digits start ~28 %) | `#ffffff` | `#1f6fd3` | 4.91 | 4.5 |
| white / pile number | `#ffffff` | `#1f6fd3` | 4.91 | 4.5 |
| white / pile number, unticked | `#ffffff` | `#5b6e82` | 5.25 | 4.5 |
| chip neutral (6 % ink over white) | `#3f5266` | `#f1f2f2` | 7.15 | 4.5 |
| chip available (11 % accent) | `#1753a6` | `#e6effa` | 6.42 | 4.5 |
| chip open need (12 % sky) | `#0b5b85` | `#e2f1f8` | 6.39 | 4.5 |
| chip offered (11 % violet) | `#4b33b8` | `#efecfc` | 7.31 | 4.5 |
| chip reserved (12 % amber) | `#7a4800` | `#faf1e3` | 6.82 | 4.5 |
| chip collected (12 % green) | `#136b3d` | `#e4f3eb` | 5.74 | 4.5 |
| notice info (9 % accent) | `#1753a6` | `#ebf2fb` | 6.59 | 4.5 |
| notice warn, demo-mode and offline banners | `#7a4800` | `#fdf1dc` | 6.82 | 4.5 |
| notice error | `#a5281b` | `#fdecea` | 6.29 | 4.5 |
| notice ok (12 % green) | `#136b3d` | `#e4f3eb` | 5.74 | 4.5 |
| inline error / white | `#a5281b` | `#ffffff` | 7.19 | 4.5 |
| for-you banner, offered (10 % violet) | `#4b33b8` | `#f0edfc` | 7.41 | 4.5 |
| reserved step number | `#7a4800` | `#fff7e6` | 7.15 | 4.5 |
| "Checked by" tag / white | `#136b3d` | `#ffffff` | 6.57 | 4.5 |
| avatar initials, lowest of the three (Jack) | `#ffffff` | `#1b7f45` | 5.04 | 4.5 |
| edge: field, quick pick, composer / white | `#7d8ea1` | `#ffffff` | 3.36 | 3 |
| edge: field / page | `#7d8ea1` | `#f6f8fb` | 3.16 | 3 |
| edge: idle timeline and agree dots / white | `#7d8ea1` | `#ffffff` | 3.36 | 3 |
| edge: secondary button, drop zone / white | `#5a8bcf` | `#ffffff` | 3.48 | 3 |
| edge: secondary button / page | `#5a8bcf` | `#f6f8fb` | 3.27 | 3 |
| edge: focus ring / white | `#1f6fd3` | `#ffffff` | 4.91 | 3 |
| edge: focus ring / page | `#1f6fd3` | `#f6f8fb` | 4.62 | 3 |
| edge: focus ring / ribbon sky end | `#1f6fd3` | `#cfe6ff` | 3.84 | 3 |
| edge: AI-draft dashed / white | `#1f6fd3` | `#ffffff` | 4.91 | 3 |
| edge: checked or manual draft / white | `#1f9d5a` | `#ffffff` | 3.48 | 3 |
| edge: selected pick, emphasised thread pill / page | `#1f6fd3` | `#f6f8fb` | 4.62 | 3 |
| edge: selected segment / track | `#1f6fd3` | `#eef3f8` | 4.40 | 3 |
| edge: reserved step ring | `#b46f00` | `#fff7e6` | 3.78 | 3 |
| edge: pile box outline / white rim | `#1a5fb8` | `#ffffff` | 6.23 | 3 |
| icon: white on primary top (top 10 px only) | `#ffffff` | `#2b7de9` | 4.03 | 3 |
| icon: white check / done dot | `#ffffff` | `#1f6fd3` | 4.91 | 3 |
| icon: white check / Collected orb, agree dot | `#ffffff` | `#1f9d5a` | 3.48 | 3 |
| icon: white camera / drop orb | `#ffffff` | `#1f6fd3` | 4.91 | 3 |

All 52 measured pairs pass (51 rows: the two identical white-on-`#1f9d5a` icon pairs share one). Lowest text: placeholder 4.54, link on the ribbon's sky end 4.87, white on accent
4.91. Lowest edges: field border on the page 3.16, secondary edge on the page 3.27.

Not counted as edges, because they are decorative or text identifies the thing: card hairlines
`#e3eaf2`, the Loop bubble's tinted edge, the theirs hairline, and the person button's hairline (its
"You're Ethan" label identifies it). Disabled buttons (opacity .5) are exempt, as in v1.

### Verified (2026-10-10, `GEMINI_MOCK=1`, port 3005, Chrome in the Browser pane)

- **Two tabs at 390 px**, Ethan (owner) and Jerry (recipient):
  1. Board → Give (`/seed/lamp.jpg` fed through a DataTransfer) → draft → **Looks right** → **Offer to Jerry**.
  2. Jerry accepts with a blank place and time → the thread opens with Loop's two opening messages.
  3. Ethan: **Suggest a time and place** (Student Union, Today 8 pm) → Jerry: **Works for me** →
     the reminder lands about 3 s later.
  4. A message from Jerry ("On my way, see you at the Union") was read by the mock as a new suggestion,
     so Ethan re-accepted. That is app behaviour, not styling.
  5. **I'm here** → one wrong code (403, intentional) → the right code → **Collected**.
- **Pile review** on `/seed/pile.jpg`: 3 items, one unticked to check the "not listing" state.
- **Widths.** No horizontal overflow anywhere checked:
  - 390 px, `scrollWidth === innerWidth`: board, give, draft, item and thread, collected, pile, ask.
  - 640 px, `scrollWidth === innerWidth`: board, draft, item, ask.
  - The pane width (1179 px): board, item, pile, draft. `scrollWidth` was 1164 there, the viewport
    minus its 15 px scrollbar.
- **Console.** Clean in Jerry's tab. Ethan's tab shows one error, the intentional wrong-code 403.
- **Focus.** Keyboard Tab shows the 3 px `#1f6fd3` ring at a 2 px offset.

## Accessibility checks run

- **Contrast.** See the v2 table above (re-measured after the restyle, 2026-10-10).
- **Keyboard** (tested in Chrome; behaviour unchanged by v2):
  - Every action is a native button, link or form control.
  - `:focus-visible` shows the ring.
  - Escape closes the person menu and returns focus to its button.
  - A route change moves focus to the page `h1`. Reserve, confirm, decline and release move it to the
    action heading.
  - A wrong code focuses and selects the code input.
- **Screen readers.** One polite live region announces drafting, "Checked by …", the pickup code
  (digit by digit), 409s, wrong codes, and offline/online. The timeline uses `aria-current="step"` plus
  hidden "done" / "not yet". No state is shown by colour alone: chips and labels always carry text.
- **Targets.** Buttons, quick picks, condition chips, segments and menu rows are at least 44 px tall.
- **Reduced motion.** `@media (prefers-reduced-motion: reduce)` neutralises CSS animation and
  transitions. The two ribbon bubbles and the logo pop get `animation: none`, so they are fully static,
  not snapped to an end frame. JS skips view transitions and the shake. The test browser cannot emulate
  the media query, so the v2 rules are verified by reading the code, not observed.
- **Widths.** v2: see "Verified" above.
- **Escaping.** A request titled `<img src=x onerror=…>` renders as text.

## v1 (superseded 2026-10-10)

Frutiger Aero, restrained: a saturated sky-to-meadow page with slow aero bubbles, aero glass cards,
glossy pill buttons and orbs, Nunito. One column, max 520 px.

### v1 tokens

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
warm-white sun at top-left and a soft green meadow swell along the bottom. Four aero bubbles sat
behind the content (`.b1`–`.b4`, 96–420 px, `opacity: .34`) and drifted 14–48 px over 44–64 s.

Gloss: primary buttons used `--gloss` plus the `--band` pseudo-element and, on hover, an inner cyan
bottom glow and a bluer outer glow. Chips had a white top sheen. The "Hi, Maya" hero had a faint sun
flare. Timeline connectors glowed on reached steps. Done dots were blue gloss orbs and Collected a
green glass orb (`#2eaa66 → #12703c`). The pickup code was a deep-blue glossy pill
(`#2a84d8 → #0e60b0 18% → #0a4f96 55% → #083f7c`). Type sizes were 28/22/17/15/13.

### v1 deviations from SPEC, all for contrast

- **Gloss gradient.** SPEC `#4fb0ff → #1b8fe6 → #1480d8` put white labels on 3.4:1 or less. The bright
  highlight ended at 30 %, above the glyphs, so white text sat on 4.7–6.5:1.
- **Highlight band.** Its white ended at 54 % of a 50 %-tall band, about 28 % of a 44 px button, just
  above the cap line. A full-height 35 % band measured 3.7:1 on the glyph rows.
- **Link text.** `#0b67b5` (5.09:1 on glass over the darkest sky). `#1b8fe6` was 3.3:1.
- **Focus ring.** A solid 3 px `--edge` outline, 2 px offset, instead of a soft 45 % box-shadow ring.
- **Edges.** `#1272c4` and `#23814e` replaced SPEC `#1b8fe6` / `#2f9e64`, which measured 2.56:1 and
  2.75:1 against the `#b9dcff` sky.
- **On-sky controls.** The back link, "Reset demo" and "Use a different photo" got a glass pill,
  because link text on bare top sky was 4.07:1.

### v1 contrast (for history)

Composited over the darkest sky stop `#b9dcff`. Lowest text: placeholder 4.63, white on primary
buttons 4.76, ink-2 on bare sky 5.03, link on glass 5.09. Pickup-code digits 6.69, chips 5.52–7.15,
banners 7.63–7.80. Edges and icons 3.35–3.81. Widths checked: 390, 640, 720, 1024 and 1280 px.
