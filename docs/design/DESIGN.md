# Loop — design notes

**v4 "poster, light" (2026-10-10), decluttered as v4.1 (next section).** The user picked the poster direction from
`docs/mockups/poster/` but on a light background, with the Knot logo (SPEC6). Loop now reads like a printed
gig poster: a cream canvas, ink type, 2–3 px ink rules, hard offset ink shadows, and two loud fills,
acid lime and hot coral, always carrying ink print. Space Grotesk does the talking, JetBrains Mono does
the labelling (times, chips, Loop's own voice). Everything structural from Lane I stays: no identities,
the posting-first board, roles You / Giver / Taker / Loop, the campus map. One column, max 592 px. v3,
v2 and v1 are summarised at the end.

## v4.1 declutter (current, 2026-10-10)

The user: "Make the page cleaner. Too much information right now." Same v4 language, far less of it
(SPEC6 "Declutter"), plus the coordinator's "no Spanish or Chinese needed". Where this list and v4 below
disagree, this list wins.

- **Gone:** the lime "TEXT LOOP" strip (`#line`, `.ear`, `renderLine`); the globe, its language popover and
  `setLang`; the "translated" tag and toggle in threads (messages show `message.text`); the coral count
  stickers; the 3 px section rules; the hero highlighter, the ruled class and the secondary hero button;
  For you's lime / coral band; the condition chip and "yours" chip on board cards; need-card details on
  the face; the Where / When ledger inside the ticket card while the plan card shows it; chip tilt.
- **Moved:** the line number lives only in the board footer (one 13 px mono link) and as one 13 px line
  on the Post page. "Ask for something" is a quiet 44 px text link under the one primary button. "Yours"
  on the board is an 8 px ink dot before the title with a screen-reader "yours:" (the item page keeps
  the chip). For you's reason ("Someone offered you this", "You reserved this · …") is the row's sub-line.
- **Board:** top bar = wordmark only (the demo-mode line stays when the server says it's mocked: it's
  an honesty note, 11 px, one line). Hero h1 `clamp(36px, 28px + 2.4vw, 48px)`, plain ink. Section titles
  are 13 px mono uppercase labels, 36 px above each section. Item cards: photo, title, one status chip;
  grid gap 14 / 12 px. Need cards: title + "Asked … ago" in 12 px mono muted, a chip only once Matched;
  with details or a Remove, the face is one button (`aria-expanded`, chevron) that opens them inline
  (`state.ui.needOpen`), and the card takes the focus ring. At most 4 cards, then "Show all (N)" /
  "Show fewer" (`state.ui.needsAll`, `aria-expanded`). For you: one row, 56 px thumbnail, title, reason,
  chevron.
- **Chrome tokens:** `--rule` 1.5 px; `--lift-sm` 3 px; hover `--lift-up` 5 px. The 3 px rule and 6 px
  shadow stay only on the ticket and the collected (stamp) card. Top bar, footer, photos, plan and match
  cards, drop zone: 1.5 px. Chips and tags: 11 px mono, 1 px edge, flat (only the ticket's sticker, the
  map's MEET sticker and the stamp tilt). Loop's title bar: 28 px. Timeline connectors 2 px dotted.
- **Item page:** the Gemini line is a 12 px mono footnote (no rule). Order is unchanged and already the
  spec's: photo, head, timeline, then the ticket / Hand it over card, the plan card, the thread, the
  composer last.
- **Moot v4 deviation:** "Language stays a menu" (there is no language control any more).

Contrast (`.tmp-m/pairs.mjs`, scratch): no new colours, so every changed element maps onto a measured v4
row. 16 pairs, 0 below target: section labels, hero, quiet link, footer link, Show all ink / cream 17.17;
"Asked …", details, For you reason, footnote muted / white 7.96; Post-page line muted / cream 7.05; 11 px
chips ink / white 19.37, ink / lime 16.44, ink / coral 6.91, cream / ink 17.17; Loop bar ink / lime 16.44.
Edges: 1.5 px rules ink / cream 17.17, ink / white 19.37; mine dot and chevron ink / white 19.37; the
need-card ring's ink band / cream 17.17 and coral ring / ink 6.91.

Verified on port 3009 (`GEMINI_MOCK=1 DEMO_REMINDER_SECONDS=3`), two anonymous tabs, line number
injected for the footer and Post page: board with and without For you (offer row and reservation row),
need expand / Remove / Show all (5) / Show fewer with focus kept by id, Post page, Gemini match, item
page as giver (Hand it over) and taker (ticket), plan with map, collected, pile review, Ask. Swept for
`scrollWidth − innerWidth = 0` and no control under 44 px: board (with and without For you, and with a
need card open), ticket item page, collected item page, pile review and Ask at 390; board, ticket,
collected and pile review at 700. All passed. Keyboard Tab onto a need card: the card shows `3px solid
coral`, offset 2 px, shadow `0 0 0 2px ink, 3px 3px 0 ink`. Console: no errors in what the tabs still
buffered (one tab had dropped older entries); the server logged no 4xx / 5xx besides the browser's own
`favicon.ico`. Not rendered: Ask-done with suggestions (its `.section-title` is now the mono label) and
a need card with no details that isn't yours (plain `h3`, no chevron). Reduced motion: the global block
covers the chevron's rotate transition; not driven under emulation.

## v4 (superseded by v4.1 above where they differ)

### Tokens (`public/styles.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--cream` | `#f6f1e3` | canvas (on `html` and `body`), the You card, Yours chip, map paper |
| `--card` | `#ffffff` | cards, inputs, menus, Taker / Giver cards |
| `--ink` | `#0b0d17` | text, every rule, every shadow, primary fill |
| `--muted` | `#4a5068` | secondary text: lead, meta, labels, hints, placeholders |
| `--lime` | `#c8ff3c` | fill only: the Text Loop strip, Loop's title bar and disc, highlighter, Available / Fulfilled / Set chips, Gemini tags, picked chips, pile numbers, the map ring, the pickup sticker |
| `--coral` | `#ff6b57` | fill only: moment buttons, count badges, Reserved / Meeting chips, the MEET sticker, check stickers, the current step, the Taker disc; as decoration: the focus ring, link underlines, the code's dotted underline, error bars |
| `--sunk` | `#ebe4d1` | photo letterbox, skeleton bars (decorative) |
| rules | 2 px ink; 3 px on hero cards (plan, match, collected, ticket, photos), the top bar and section titles | |
| shadows | `4px 4px 0` ink on list cards and primary / moment buttons; `6px 6px 0` ink on hero cards and photos; hover lifts 2 px and grows the shadow 2 px, press sinks it | no blur, no gradients |
| radius | 14 px cards, 10 px buttons / inputs / ledger, 6 px stickers, 999 px pills | |
| type | **Space Grotesk** 500 / 700 (UI, display); **JetBrains Mono** 400 / 700 (labels, times, chips, stickers, Loop's cards, the code input) | `public/fonts/`, OFL in `OFL-space-grotesk.txt`, `OFL-jetbrains-mono.txt`. Fraunces and Inter files stay but nothing loads them |
| sizes | hero h1 `clamp(44px, 32px + 3.2vw, 60px)` (44.5 at 390 px); page h1 `clamp(34px, 28px + 2vw, 44px)`; section titles 26–34 uppercase; body 16; labels and chips 12 mono uppercase; pickup digits `clamp(96px, 80px + 3vw, 104px)` | |
| gutters | 16 px below 640 px, 32 px from 640 px; card padding 20 / 24 | |

### Surfaces

- **Top bar.** Cream, sticky, 3 px ink rule. The lockup from `brand/README.md`: the knot (`brand/knot.svg`,
  viewBox cropped to its ink box `2 4.02 60 55.96`) at `1.04cap`, `.4615em` gap, then "Loop" in
  Space Grotesk 700 at 28 px. Measured in Chrome: cap 19.60 px, knot 20.38 px (1.04 × cap), gap
  12.92 px. On the right, the language control: an ink pill (globe + `EN`) that opens a menu whose
  three languages are an ink segmented pill with the current one in cream. The demo-mode banner is an
  ink strip with cream mono text.
- **Text Loop strip** (replaces v3's ear). A full-width lime strip under the bar, outside the sticky
  header so it scrolls away: `✳ TEXT LOOP · (773) 912-3997 ✳` in mono, an `sms:` link, hidden while
  `/api/health` has no `lineNumber` (always the case under `GEMINI_MOCK=1`). The footer repeats it as
  a mono link with a coral underline.
- **Board.** The greeting sits on the canvas with "need." under a lime highlighter (rotated −1°).
  Section titles are uppercase on a 3 px rule with a coral count sticker (`aria-hidden`: the lists
  already expose their size). Need cards: mono "ASKED …", bold title, sticker chips, 4 px shadow.
  Item cards: photo over a 2 px rule, 4 px shadow, lift on hover. For you cards open with a mono band,
  lime for an offer, coral for a reservation.
- **Buttons** (48 px; small 44). Primary: ink, cream label, 4 px ink shadow. Moment (Offer to them,
  Reserve, Accept & reserve, Confirm handoff, Works for me, I'm here, Enter code, and the "Post it"
  buttons: Post to board, Ask's Post, List N items): coral, ink label, ink edge, 4 px shadow.
  Secondary: white, ink edge, shadow only on hover. Ghost: ink text, 3 px coral underline.
- **Chips are stickers.** 12 px mono uppercase, 2 px ink edge, rotated −1.5° / +1.5° alternately.
  Available, Fulfilled, Set: lime. Reserved, Meeting now: coral. Offered, Matched, Open need,
  Planning, condition: white. Collected, Done: ink with a cream check. Taken back: cream, dashed.
  Yours: cream, dashed ink.
- **Forms.** Mono uppercase labels; inputs white with a 2 px ink edge. Quick picks are white tiles that
  turn lime with a tick and a 3 px shadow when picked. The One thing / A pile switch is the same ink
  segmented pill as the language menu. Drop zone: 3 px dashed ink, a lime camera disc.
- **AI vs human.** A Gemini draft has a 2 px dashed ink edge and a lime sticker "Drafted by Gemini —
  check it"; once checked the edge is solid and the sticker is ink "Checked by you". Gemini's match is
  a hero card (3 px, 6 px shadow) with the request's title under the lime highlighter.
- **Item page.** Photo in a 3 px ink frame with the 6 px shadow. Mono "POSTED …" and provenance.
  Timeline: 36 px tiles, ink when done, coral and tilted when current, lime when collected;
  connectors 3 px dotted ink ahead, solid once reached.
- **Pickup code.** A white ticket, 3 px ink rule, 6 px shadow. A lime sticker "SHOW THIS AT PICKUP"
  rotated −3° sits on its top edge; Space Grotesk 700 digits at 96–104 px over an 8 px dotted coral
  underline; the knot in the top-right corner. It scales in once (250 ms).
- **Collected.** A coral check sticker beside "Collected by …" and the mono time, then an ink rubber
  stamp "KEPT IN USE": 3 px rule plus an inner 2 px rule, 22 px mono, rotated −8°, stamped once per tab
  (scale 1.8 → 1, 250 ms) through the existing `seenCollected` gate. The card gets the hero shadow.
- **Thread.** Loop: a full-width white system card with a lime title bar ("LOOP · 5:12 PM"), mono
  text, and a lime tile with the knot. Taker: white card with a coral rule and a coral "T" disc.
  Giver: white card with an ink rule and an ink "G" disc. You: a cream card on the right with a cream
  "Y" disc. Headers are mono uppercase; "iMessage" and "translated" are small mono stickers (the
  translated one dashed; it still sits in a 44 px button). The composer is one white dock with a
  4 px shadow.
- **Campus map.** An ink line drawing on cream inside the plan card: Franklin St as a 3 px street,
  dashed footpaths, white dots, mono uppercase labels with a cream halo. The chosen spot gets a lime
  disc with an ink edge (r 11) and an ink dot. On the plan card a coral sticker "MEET · <time>" hangs
  below the spot (above it in the bottom 40 %, pulled inward near the sides); it is HTML over the
  SVG so any time text sizes itself, and `aria-hidden` (Where / When says the same).
- **"Meet at" picks** (coordinator request): one de-duplicated list, the quick picks' wording first
  ("Davis Library lobby", "Student Union", "Dorm front desk"), then every other map spot. A map tap
  and a chip are the same choice, so the chip, the field and the map ring always agree
  (`MEET_PLACES` in app.js, with a `console.assert`).
- **Pile review.** Boxes: a white rim inside a 2 px ink outline; numbers are lime discs with an ink
  edge (white when unticked).
- **Notices.** White, 2 px ink edge, an 8 px left rule with a lime (info, ok) or coral (warning,
  error) bar inside. Inline errors are ink with a coral bar; an invalid input gets an 8 px coral inset
  bar. Toast and offline pill: ink, cream mono.
- **Focus.** 3 px coral outline at a 2 px offset, with the offset filled by a 2 px ink band
  (`--focus`, a non-inherited `@property`, composed with each component's shadow so lifts survive
  focus). Inside the ink language / give pills the ink band is dropped (the coral sits on ink). The
  lime strip takes a 3 px ink ring inset 6 px.
- **Motion.** 120–160 ms lifts, view transitions 200 / 240 ms, route fade 180 ms, ticket scale-in and
  stamp 250 ms once. Rotations use the `rotate` property and lifts use `translate`, so they never
  fight each other or the keyframes.
- **Reduced motion.** The global block shortens animation and transitions; hover lifts lose their
  `translate` (the shadow still grows); the stamp, ticket, check badge, scan line and skeleton get
  `animation: none`, so the stamp just sits at −8°.

### Deviations from SPEC6

- **Focus ring has an ink band.** Coral alone is 2.48:1 on cream and 2.80:1 on white, under 3:1. The
  ink band (17.17:1 on cream) carries the contrast and the coral ring sits on ink (6.91:1).
- **The map ring has an ink edge.** Lime is 1.04:1 on cream: a 2 px ink stroke around the lime disc
  carries it.
- **No red.** Errors are ink text marked with a coral bar; `aria-invalid` and the words carry the
  state. Lime and coral are never text.
- **Language stays a menu.** SPEC6 draws EN · 中文 · ES as a segmented pill in the bar. The SPEC5
  globe button and popover are app behaviour, so the pill lives inside the menu and the bar shows the
  ink globe pill.
- **No map caption.** SPEC6's "Public spots only. Nobody's room is on the map." would be new copy in
  app.js, which this lane may not add. Left for the orchestrator.
- **Pickup digits are Space Grotesk**, as the Pickup code line says; the token line's "JetBrains Mono
  for … the pickup code" is applied to the giver's code input.
- **Ticket mark in the corner, not a stub.** The knot sits in the top-right corner so the 96 px digits
  fit a 390 px phone; v3's perforated stub and notches are gone.

### Contrast (v4, measured 2026-10-10)

Method: `.tmp-j/pairs.mjs` (scratch, gitignored), WCAG 2.x relative luminance. Every v4 colour is
opaque, so nothing needs compositing. 20 counted pairs, 0 below target. Lowest text: ink on coral
6.91, muted on cream 7.05. Lowest edge: coral ring against its ink band 6.91.

Text (needs 4.5:1):

| Pair | Text | Background | Ratio |
|---|---|---|---|
| ink / cream (page text, hero, section titles, You card, Yours chip, selected language) | `#0b0d17` | `#f6f1e3` | 17.17 |
| ink / white (card text, inputs, white chips, Taker / Giver cards) | `#0b0d17` | `#ffffff` | 19.37 |
| ink / drop-zone hover | `#0b0d17` | `#fffdf5` | 19.02 |
| muted / cream (lead, meta, footer, closed note, Taken back chip) | `#4a5068` | `#f6f1e3` | 7.05 |
| muted / white (labels, hints, placeholders, card meta) | `#4a5068` | `#ffffff` | 7.96 |
| cream / ink (primary buttons, globe pill, segments, Checked tag, Collected chip, Giver disc, toast, demo banner) | `#f6f1e3` | `#0b0d17` | 17.17 |
| ink / lime (strip, Loop title bar, highlighter, lime chips and tags, offer band, picked chips, pile numbers, pickup sticker) | `#0b0d17` | `#c8ff3c` | 16.44 |
| ink / coral (moment buttons, count badges, Reserved chip, MEET sticker, reserved band, Taker disc, current step) | `#0b0d17` | `#ff6b57` | 6.91 |

Edges and icons (needs 3:1):

| Pair | Edge | Against | Ratio |
|---|---|---|---|
| ink rule / cream (cards, top bar, strip, map frame, section rules) | `#0b0d17` | `#f6f1e3` | 17.17 |
| ink rule / white (inputs, chips, ledger, inner rules) | `#0b0d17` | `#ffffff` | 19.37 |
| ink rule / lime (sticker and chip edges on lime, the map ring's stroke) | `#0b0d17` | `#c8ff3c` | 16.44 |
| ink rule / coral (sticker and chip edges on coral) | `#0b0d17` | `#ff6b57` | 6.91 |
| focus: ink band / cream | `#0b0d17` | `#f6f1e3` | 17.17 |
| focus: ink band / white | `#0b0d17` | `#ffffff` | 19.37 |
| focus: coral ring / its ink band, or the ink pills | `#ff6b57` | `#0b0d17` | 6.91 |
| focus: ink ring / lime (Text Loop strip) | `#0b0d17` | `#c8ff3c` | 16.44 |
| icon: ink on lime (camera disc, ticks, map dot) | `#0b0d17` | `#c8ff3c` | 16.44 |
| icon: ink check on coral (check stickers) | `#0b0d17` | `#ff6b57` | 6.91 |
| icon: cream check on ink (done steps) | `#f6f1e3` | `#0b0d17` | 17.17 |
| map: ink edge of the lime ring / cream | `#0b0d17` | `#f6f1e3` | 17.17 |

Not counted, because they are decorative or text identifies the thing: coral alone (2.48 on cream,
2.80 on white: the Taker card's rule, link and ghost underlines, the code's dotted underline, error
bars, the scan line), lime alone (1.04 on cream, 1.18 on white: the highlighter block, the ring's fill,
title-bar and band fills, whose ink text is measured above), and `--sunk` (1.12). Disabled buttons
(opacity .45) are exempt, as before.

### Verified (2026-10-10, `GEMINI_MOCK=1 DEMO_REMINDER_SECONDS=3`, port 3008)

- **Two anonymous tabs in the Browser pane**, driven through the DOM (the pane went hidden mid-run, so
  clicks are `element.click()` / synthetic events on the real handlers):
  1. Taker: Ask → "Reading lamp for my desk" → Posted.
  2. Giver: Give → `/seed/lamp.jpg` through a DataTransfer drop → draft → **Looks right** → Gemini's
     match names the taker's request → **Offer to them** → item page, Offered.
  3. Taker: For you band → **Accept & reserve** with blank place and time → ticket (code shown) and
     Loop's two opening cards.
  4. Giver: **Suggest a time and place** → tapped Student Union on the map (field filled, chip
     pressed, ring moved) → Today 8 pm → plan card with the MEET sticker.
  5. Taker: **Works for me** → Set, both agreed → the reminder landed ~3 s later → **I'm here** →
     Meeting now.
  6. Giver: **Enter code** focused the code input → 1234 (403, intentional: error text, `aria-invalid`,
     focus kept) → the right code → Collected, stamp, closed thread.
  7. A second handoff for chat cards: giver posted to the board, taker reserved, both sent a message:
     Loop, Taker (coral rule), Giver (ink rule) and You (cream) cards all rendered.
  8. Language: globe → menu open (three 52 px segments) → 中文: the choice stuck (the pill read 中文),
     the menu closed, focus went back to the globe, "Language: 中文." was announced → back to English.
  9. Pile: A pile → `/seed/pile.jpg` → 3 things outlined and numbered; #2 unticked shows "NOT LISTING".
- **Screenshots** (`.tmp-j/shots/`, gitignored), from headless Chrome over CDP as the same anonymous
  ids (the pane could not draw while hidden), with the demo line injected
  (`state.health.lineNumber = '+17739123997'; renderLine(); render()`, as v3 did): board, draft-match,
  thread-map, ticket, collected, pile and lang-menu at 390 and 700; thread cards (giver and taker),
  map picker, focus ring at 390.
- **Widths.** `scrollWidth − innerWidth = 0` at 390 and 700 on board, Give, draft + match, Ask, both
  item pages (ticket, code entry, propose form, collected), the open language menu and pile review.
- **44 px sweep** (every visible `a`, `button`, field, pick and pile label measured with
  `getBoundingClientRect`, map spots excluded because the chips and field are the real controls):
  nothing under 44 px on those pages at either width.
- **Console.** Taker tab clean. Giver tab: one error, the intentional wrong-code 403. Re-checked
  after a reload and a walk through every route: no new errors, no failed `console.assert`.
- **Keyboard.** Tab order on the board: wordmark → globe → Text Loop strip → Post something. Computed
  ring on Post something: `outline: 3px solid rgb(255,107,87)`, offset 2 px, box-shadow
  `0 0 0 2px #0b0d17, 4px 4px 0 #0b0d17`. On the strip: a 3 px ink outline at −6 px.
- **Reduced motion, observed** (CDP `Emulation.setEmulatedMedia`): the stamp's `animation-name` is
  `none` and it sits at −8°. The no-lift-on-hover rule is present in the sheet; an actual hover was
  not driven under emulation.

## Accessibility checks run

- **Contrast.** The v4 tables above.
- **Keyboard** (behaviour unchanged since v1): every action is a native button, link or form control;
  `:focus-visible` shows the ring; Escape closes the language menu; a route change moves focus to the
  page `h1`; reserve, confirm, decline and release move it to the action heading; a wrong code focuses
  and selects the code input.
- **Screen readers.** One polite live region announces drafting, "Checked by …", the pickup code
  (digit by digit), 409s, wrong codes, language changes and offline/online. The timeline uses
  `aria-current="step"` plus hidden "done" / "not yet". Count stickers, the MEET sticker, the stamp,
  the ticket's sticker and the discs are `aria-hidden` duplicates of text that is read. No state is
  shown by colour alone.
- **Targets.** 44 px minimum, measured (see Verified).
- **Escaping.** A request titled `<img src=x onerror=…>` renders as text.

## History

- **v3 "campus paper"** (2026-10-10, superseded by v4 the same day): warm paper `#f6f1e8`, ink
  `#15130f`, one tangerine accent `#e4572e` (ink labels on it, `#b5401a` as text), moss for done,
  ochre for reserved, slate for Gemini; Fraunces display and Inter body; a tangerine ticket stub and a
  moss double-ruled stamp; a hand-drawn one-stroke loop mark; the iMessage line as a newspaper "ear".
  40 contrast pairs passed (lowest: ink on tangerine 5.04, tangerine ring 3.27 on paper).
- **v2** (superseded 2026-10-10, rejected by the user): near-white, one calm blue `#1f6fd3`, Nunito,
  a sky-to-mint ribbon and glossy Frutiger Aero orbs for the logo, the pickup code and Collected.
- **v1** (superseded 2026-10-10): full Frutiger Aero, a sky-to-meadow page with drifting bubbles,
  blurred glass cards, glossy pill buttons, Nunito, max 520 px.

## v4.2 — desktop layout (Oct 10, 21:15 EDT)
One `@media (min-width: 960px)` block: 1120 px content on a 12-column grid (32 px gaps, 40 px gutters). Board: hero lead + button on 7 columns with the riffle figure on 5; For you full width; Inventory 3-up on 8 columns (4:3 photos); People need as a 4-column sidebar. Item page: photo/card/timeline/action on 7, plan + thread sticky on 5 with its own scroll. Give and pile review: sticky photo on 6, cards on 6. Ask: centred 640 px. Below 960 px nothing changed (verified box-for-box at 390/700/959). Hero title is one line at clamp(56px, 32px + 2.5vw, 64px).
