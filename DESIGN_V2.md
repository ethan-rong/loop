# Design direction v2 (user verdict, Sat Oct 10 ~2:45 PM EDT)

User: "这蓝色很丑" — the saturated sky blue reads cheap. Wanted: **modern + a trace of Frutiger Aero**, not a full aero costume. Keep the Frutiger Aero track eligible with accents, win on modern polish.

## Rules for the restyle lane (styles only; no copy, no behavior)
1. **Base = modern, mostly white.** Page background near-white warm (#f6f8fb → #ffffff), text #0f1f2e / #4a5d70. Large, confident type: page titles 32–36 px / 800, card titles 20–22 px / 700, body 16 px / 500, generous whitespace (24–32 px gutters on desktop, 16 on phone). Cards: white, 1 px #e3eaf2 border, radius 18–20, shadow soft and short (0 4 16 rgba(15,31,46,.06)). No glass blur on ordinary cards.
2. **Aero as accent only.** One soft gradient ribbon at the very top of the page (sky #cfe6ff → mint #dcf5e8, 140–180 px tall, fading into white), two faint bubbles at most, *inside that ribbon only*, static under reduced motion. The logo orb keeps its gloss. The primary button keeps a *subtle* gradient (#2b7de9 → #1f6fd3) with a 1 px inner highlight — no big gloss band. The pickup-code badge and the Collected orb may stay glossy (they are the "moment" surfaces).
3. **Accent colour**: deep calm blue #1f6fd3 (links #1a5fb8), success #1f9d5a, warning #d98b12, violet for Offered #6a4fe0. Chips: tinted 10–12 % with dark text. Contrast ≥ 4.5:1 on text, ≥ 3:1 on edges, re-measure after.
4. **Photo hero** stays dominant (Shupatto principle). Timeline keeps the three orbs but thinner connectors.
5. **Thread (chat) surfaces**: Loop bubbles = white with a 1 px blue-tinted border and the small orb; my bubbles = accent blue with white text; theirs = #eef3f8. Action pills = secondary (white, blue text, 1 px border).
6. Motion unchanged: 150–250 ms transitions, view transitions, logo pop once, reduced-motion respected.
7. Phone first (390 px), then the half-width laptop window, then 1280.

Deliver: updated styles.css/index.html tokens, DESIGN.md "v2" section with the measured contrast, screenshots at 390 and ~640 px.
