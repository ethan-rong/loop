# Loop — design notes

Frutiger Aero, restrained: an airy sky-to-mint page, white glass cards, glossy pill buttons, Nunito.
Optimistic and tactile, not a toy. One column, max 520 px, so it reads the same on a phone and in a
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
| `--link`, `--accent-deep` | `#0d6fc0` | links, secondary-button text, timeline |
| `--edge` | `#1a8ae0` | focus ring, dashed Gemini border |
| `--gloss` | `#62b4f6 0% → #1676c9 30% → #0d6fc0 60% → #0a5fa8 100%` | primary pill buttons |
| `--green-ink` / `--green-edge` | `#14603a` / `#2a925c` | collected, "Checked by …" |
| `--amber-ink` | `#6e4300` on `#fff1d6` | reserved, demo-mode and offline banners |
| `--violet-ink` | `#4a32b8` | offered |
| `--sky-ink` | `#0b4a78` | open need |
| `--danger-ink` | `#a12a2a` | inline errors |
| glass | `rgba(255,255,255,.62)`, blur 14 px, saturate 140 %, 1 px white edge, radius 20 px | cards |

Page: `linear-gradient(180deg, #dff1ff, #f3f9ff 45%, #e8f7ee)` with one radial "sun" at top-left and
two faint CSS bubbles. Type: Nunito 500/700/800, self-hosted (`public/fonts/nunito-latin.woff2`,
Google Fonts v32 latin subset, 38 KB variable file; licence in `public/fonts/OFL.txt`); sizes
28/22/17/15/13. Motion: chips and buttons 150–200 ms, code reveal 250 ms, collected ripple 600 ms (once).

AI vs human: a Gemini draft has a dashed `--edge` border, a sparkle and "Drafted by Gemini — check it".
Editing any field or tapping **Looks right** turns it solid green ("Checked by Maya"). Publish
buttons stay locked until then, and Enter never publishes a Gemini draft.

### Deviations from SPEC, all for contrast

- **Gloss gradient.** SPEC `#4fb0ff → #1b8fe6 → #1480d8` puts white labels on 3.4:1 or less. The bright
  highlight now ends at 30 %, above the glyphs, so white text sits on 4.7–6.5:1.
- **Link text.** `#0d6fc0` (4.9:1 on glass), not `#1b8fe6` (3.3:1).
- **Focus ring.** A solid 3 px `#1a8ae0` outline, 2 px offset, instead of the soft 45 % box-shadow
  ring, which was too faint on the sky background.
- **Edges.** `#1a8ae0` and `#2a925c` replace `#1b8fe6` and `#2f9e64`, which measured 2.97:1 and 2.93:1
  against the page.

## Accessibility checks run

- **Contrast.** A script composited every translucent layer over the darkest page stop `#dff1ff`
  (lighter backdrops only raise dark-text contrast):
  - All text pairs are ≥ 4.5:1. The lowest are placeholder 4.68, white on gloss 4.70 and link 4.92.
    Chips are 5.95–7.63 and banners 7.63–7.80.
  - All edges (focus ring, field border, dashed and checked card borders, check icon) are ≥ 3:1.
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
  transitions. JS skips view transitions and the shake: verified by forcing the flag, because the test
  browser cannot emulate the media query.
- **Widths.** 390, 640 and 1280 px with no horizontal scroll.
- **Escaping.** A request titled `<img src=x onerror=…>` renders as text.
