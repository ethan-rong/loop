# Loop — design notes

**v3 (current, 2026-10-10): "campus paper".** Loop now looks like a well-set campus paper or zine:
warm paper, ink type, one hot tangerine accent, photographs that look like photographs, and two
printed objects for the two moments that matter (a ticket stub for the pickup code, a rubber stamp
for "Kept in use"). No gradients, no blur, no gloss, no bubbles, no ribbon. One column, max 592 px,
so it reads the same on a phone and in a half-width laptop window. The user rejected v2 ("not great,
I don't like it") and dropped the Frutiger Aero constraint (SPEC4 §A). v2 and v1 are kept below for
history.

## v3 (current)

### Patterns borrowed (no award claims)

1. **Penguin's orange-band paperbacks.** Black type on a hot orange band. In Loop the "moment"
   buttons (Offer to Fox, Reserve, Accept & reserve, Confirm handoff, the thread's next step) are
   tangerine with ink labels, and the pickup code is a tangerine ticket.
2. **Newspaper nameplates and "ears".** A ruled masthead with the wordmark on the left and a small
   boxed note on the right. In Loop the ear carries the iMessage line ("Text Loop · (773) 912-3997").
3. **Cloakroom tickets and rubber stamps.** A perforated stub you hand over, and a stamp that says
   the job is done. The code sits on a stub with a dashed perforation and two notches; a collected
   item gets a moss "KEPT IN USE" stamp, rotated -8°, stamped once.

### Tokens (`public/styles.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--paper` / `--card` | `#f6f1e8` / `#fffcf6` | page (on `html` and `body`) / cards, inputs, menu |
| `--sunk` | `#ece5d8` | photo letterbox, skeleton bars |
| `--ink` / `--ink-2` | `#15130f` / `#5c5649` | text, primary fill, my bubble / secondary text, labels, secondary-button rule |
| `--rule` / `--rule-strong` | `rgba(21,19,15,.14)` / `.32` | decorative only: card edges, dividers / hovered cards, their bubble, the ear's divider |
| `--field` | `#857f71` | control edges: inputs, quick picks, language toggles, segmented track, idle dots |
| `--tangerine` | `#e4572e` | moment fills, the ticket, focus ring, section-title underline, chip dots for open things |
| `--tangerine-ink` | `#b5401a` | tangerine as text (plain links); Owl's avatar |
| `--moss` | `#2f6b3a` | collected / fulfilled: chip, stamp, final step, agree dot |
| `--ochre` | `#b7791f` | reserved / warnings: band, ring, dot, notice rule (never text) |
| `--slate` | `#3b5b8a` | offered band, Gemini tags, AI-draft dashed edge, iMessage and "translated" tags |
| `--danger` | `#a3271b` | inline errors |
| `--radius` / `--radius-photo` | 16 px / 12 px | cards (inputs 10, notices 8, pills 999) / photos |
| type | display **Fraunces** (variable, opsz 9–144, wght 400–700, roman + italic); body **Inter** (variable, wght 400–700) | self-hosted latin subsets from Google Fonts, `public/fonts/`, OFL in `public/fonts/OFL.txt` |
| sizes | h1 `clamp(38px, 32px + 1.6vw, 44px)`/1.02 at `"opsz" 144` (board greeting 44–52, item title 32–40), h2 24, h3 19, section titles 26 with a 2 px tangerine underline; body 16/1.5; labels 13 px uppercase, tracking .06em, ink-2; pickup digits Fraunces 56 | |
| gutters | 16 px below 640 px, 32 px from 640 px; card padding 20 / 24 | |

Avatars (white initials) take their ink from the person's place in the list, never from a name:
ink `#15130f`, slate `#3b5b8a`, moss `#2f6b3a`, `#b5401a`, `#8a5a12`, then repeat; unknown ids get
ink-2. (The seed is anonymous now, nicknames only; a follow-up lane removes identities from the UI.)

### Surfaces

- **Masthead.** Paper, a 1 px ink rule under it, sticky. Hand-drawn loop mark (one stroke, the same
  path in `index.html`, `LOOP_MARK` in app.js and `favicon.svg`) plus "Loop" in Fraunces italic.
  Then the ear and "You're Ethan ▾" on the right. The ear is two stacked lines on a phone ("TEXT LOOP"
  over the number), one line from 640 px, and its own right-aligned row below 380 px. It renders
  from `/api/health` `lineNumber` as an `sms:` link and stays hidden while that is null. The demo
  banner is an ink strip with paper uppercase text.
- **Board.** The greeting is big Fraunces straight on the paper, over a ruled-paper pattern (6 % ink
  lines every 32 px, the only pattern). Section titles carry the 2 px tangerine underline. Need cards
  read like classifieds: avatar, meta, Fraunces title, ink-outlined chip. Item cards run the photo
  edge to edge with a 1 px ink rule under it. "For you" cards open with a band: slate with paper
  text for an offer, ochre with ink text for a reservation. The footer is a colophon under an ink
  rule: the kept-in-use count, Reset demo, and the Text Loop line.
- **Cards.** `.glass` (name kept from v1): card fill, 1 px `--rule`, radius 16, no shadow. Link
  cards lift 1 px and their rule turns ink on hover.
- **Buttons** (48 px, pills). Primary: ink fill, paper label. Moment: tangerine fill, ink label, 1 px
  ink edge (`.btn-moment`, added next to `.btn-primary` so nothing that selects `.btn-primary`
  changes). Secondary: paper fill, ink-2 rule that turns ink on hover, lifts 1 px. Ghost: ink text
  with a 2 px tangerine underline, like a proof mark. Focus: 3 px tangerine ring, 2 px offset.
- **Chips.** 1 px ink outline at 40 %, ink text, colour only in the 7 px dot (tangerine open or
  available, slate offered, ochre reserved, ink-2 withdrawn). Collected and Done: moss text and edge
  with a tiny check instead of the dot.
- **AI vs human.** A Gemini draft has a 1.5 px dashed slate edge and "Drafted by Gemini — check it"
  (uppercase slate label). Checked or manual: 1.5 px solid ink and "Checked by Ethan". Behaviour
  unchanged: publish stays locked until checked.
- **Pickup code.** A tangerine ticket, 1 px ink edge, radius 10, rotated -1.5°: "Show this at
  pickup" (uppercase, aria-hidden, the sentence under it says the same), Fraunces digits at 56 px,
  then a stub with a dashed ink perforation, two card-coloured notches and the loop mark. It scales
  in once (250 ms, rotation kept in both keyframes).
- **Collected.** The glossy orb is gone. A moss rubber stamp, 5 px double border, uppercase
  "Kept in use", rotated -8°, floats right of "Collected by Fox" and stamps in once per tab
  (scale 1.8 → 1, 250 ms) using the existing `seenCollected` gate.
- **Where / when.** A two-cell ledger with a rule between, uppercase labels, Fraunces values.
- **Timeline.** Done = ink dot with a paper check, current = tangerine ring (ochre when reserved),
  Collected = moss dot. Connectors 2 px: rule, ink once reached, moss into Collected.
- **Thread.** Loop: paper bubble with a dashed ink-2 rule and the loop mark beside it. Mine: solid
  ink, paper text. Theirs: card with `--rule-strong`. "iMessage" and "translated" are small slate
  pills in the name line. The next step Loop wants (Works for me, I'm here, Enter code) is a moment
  button; the rest are secondary. The composer is one pill with an ink-2 edge (ink when focused).
- **Translated messages (SPEC4 §D).** When `message.translations[myLang]` exists and differs from
  the original, the bubble shows the translation and a dashed "translated" pill; tapping it shows
  the original and the pill reads "original". The pill sits in a 44 px button (negative margins keep
  the name line's height). Screen-reader announcements read the shown text.
- **Person menu.** Five people, then a Language row: English | 中文 | Español, three 44 px toggles
  (`aria-pressed`) that POST `/api/people/:id/lang`. Nothing is stored locally; a 404 is ignored
  silently. The menu scrolls if the window is short. The first-run picker is one ruled directory
  of five rows instead of five cards.
- **Give.** Segmented control: card track with a field edge, ink thumb. Drop zone: dashed ink-2
  edge, ink disc with a paper camera, Fraunces title. Under it, when the line is known: "No app?
  Text a photo to Loop at (773) 912-3997" (`sms:` link). While Gemini looks, a 2 px tangerine scan
  line sweeps the photo (no shimmer gradient); skeleton bars pulse flat.
- **Pile review.** Boxes: a 2 px card-coloured rim inside a 2 px ink outline, readable on light and
  dark photos. Numbers: ink discs (ink-2 when unticked), item names in Fraunces.
- **Notices.** Card fill, ink text, a 4 px rule on the left: slate info, ochre warning, moss ok,
  danger error (error text in danger red). Toast and the offline pill are ink with paper text.
- **Motion** unchanged: 150–250 ms transitions, view transitions 200 / 240 ms, route fade 180 ms.
  New: ticket scale-in and stamp, 250 ms each, once.
- **Reduced motion.** The global block shortens every animation and transition; the stamp, ticket,
  check badge, scan line and skeleton get `animation: none` (static, not a snap) and the scan line is
  hidden. Not observed: the test browser cannot emulate the media query; verified by reading the CSS.

### Deviations from SPEC4 §A, all for contrast

- **Moment buttons and the ticket use ink labels, not paper.** Paper on `#e4572e` is 3.27:1 (white
  3.68), under 4.5 for a 16 px label. Ink on it is 5.04:1. The tangerine itself is unchanged.
- **Tangerine as text is `#b5401a`.** `#e4572e` on paper is 3.27:1. Text links (Text Loop, the Give
  line) are ink with a tangerine underline; plain links fall back to `#b5401a` (5.03 paper, 5.52 card).
- **Ochre never carries text.** `#b7791f` on paper is 3.24:1. It is a fill (with ink text, 5.10), a
  ring, a dot or a rule.
- **Control edges use `--field` `#857f71`, not the spec rule.** `rgba(21,19,15,.14)` is 1.34:1 on
  paper, fine for card edges but not for inputs. `--field` is 3.54 on paper and 3.89 on card. The
  secondary-button rule starts at ink-2 (6.48) so it can "darken" to ink on hover.
- **Avatars.** "ethan ink-accent" read as ink for the first person; all five inks are ≥ 5.66:1
  with white initials.

Layout deviations (not contrast):

- **Top bar order** is wordmark · ear · person button, not wordmark · person button · line. The
  button stays at the far right because `placeMenu` anchors the popover to the button's right edge;
  with the button on the left the menu would open off-screen at 390 px.
- **Item-card photos** take the card's 16 px corner radius (they run edge to edge inside it).
  Standalone photos (item page, Give preview, pile) use the spec's 12 px.

### Contrast (v3, measured 2026-10-10)

Method: `.tmp-b4/pairs.mjs` (scratch, gitignored) composites translucent layers over their real
backdrop, then computes the WCAG ratio. 40 pairs, 0 below target. Lowest text: ink on tangerine
5.04, tangerine-ink on paper 5.03, ink on ochre 5.10. Lowest edges: tangerine focus ring on paper
3.27, field edge on paper 3.54, ochre ring on card 3.56.

Text (needs 4.5:1):

| Pair | Text | Background | Ratio |
|---|---|---|---|
| ink / paper (page text, Loop bubble) | `#15130f` | `#f6f1e8` | 16.49 |
| ink / card (card text, their bubble) | `#15130f` | `#fffcf6` | 18.12 |
| ink-2 / paper (lead, meta, ear label, footer) | `#5c5649` | `#f6f1e8` | 6.48 |
| ink-2 / card (labels, hints, muted in cards) | `#5c5649` | `#fffcf6` | 7.11 |
| ink-2 / ruled line under the greeting (6 % ink) | `#5c5649` | `#e8e4db` | 5.74 |
| placeholder / card | `#6e685b` | `#fffcf6` | 5.40 |
| paper / ink (primary, my bubble, selected picks, toast, demo banner) | `#f6f1e8` | `#15130f` | 16.49 |
| ink / tangerine (moment buttons, ticket label and digits) | `#15130f` | `#e4572e` | 5.04 |
| tangerine-ink / paper (plain links) | `#b5401a` | `#f6f1e8` | 5.03 |
| tangerine-ink / card (plain links in cards) | `#b5401a` | `#fffcf6` | 5.52 |
| slate / paper (translated tag, iMessage tag) | `#3b5b8a` | `#f6f1e8` | 6.12 |
| slate / card (Gemini tags) | `#3b5b8a` | `#fffcf6` | 6.72 |
| paper / slate (For you band, offered) | `#f6f1e8` | `#3b5b8a` | 6.12 |
| ink / ochre (For you band, reserved) | `#15130f` | `#b7791f` | 5.10 |
| moss / card (Collected chip, Done chip, stamp) | `#2f6b3a` | `#fffcf6` | 6.24 |
| moss / paper | `#2f6b3a` | `#f6f1e8` | 5.68 |
| danger / card (inline errors, error notice) | `#a3271b` | `#fffcf6` | 7.16 |
| white / avatar ethan (ink) | `#ffffff` | `#15130f` | 18.55 |
| white / avatar jerry (slate) | `#ffffff` | `#3b5b8a` | 6.89 |
| white / avatar jack (moss) | `#ffffff` | `#2f6b3a` | 6.39 |
| white / avatar tom (#b5401a) | `#ffffff` | `#b5401a` | 5.66 |
| white / avatar thomas (#8a5a12) | `#ffffff` | `#8a5a12` | 5.91 |
| paper / ink-2 (unticked pile number) | `#f6f1e8` | `#5c5649` | 6.48 |

Edges and icons (needs 3:1):

| Pair | Edge | Against | Ratio |
|---|---|---|---|
| field / card (inputs, picks, language toggles, idle step and agree dots) | `#857f71` | `#fffcf6` | 3.89 |
| field / paper (segmented track edge) | `#857f71` | `#f6f1e8` | 3.54 |
| ink-2 / paper (secondary button, person button, composer at rest) | `#5c5649` | `#f6f1e8` | 6.48 |
| ink-2 / card (drop zone dashed edge) | `#5c5649` | `#fffcf6` | 7.11 |
| ink / paper (masthead rule, photo frame, composer focused, checked draft) | `#15130f` | `#f6f1e8` | 16.49 |
| ink / card (checked draft edge, hovered input) | `#15130f` | `#fffcf6` | 18.12 |
| tangerine / paper (focus ring, section underline) | `#e4572e` | `#f6f1e8` | 3.27 |
| tangerine / card (focus ring in cards, current step ring) | `#e4572e` | `#fffcf6` | 3.60 |
| slate / paper (AI-draft dashed edge outside) | `#3b5b8a` | `#f6f1e8` | 6.12 |
| slate / card (AI-draft dashed edge inside) | `#3b5b8a` | `#fffcf6` | 6.72 |
| ink-2 / paper (Loop bubble dashed edge) | `#5c5649` | `#f6f1e8` | 6.48 |
| ochre / card (reserved step ring) | `#b7791f` | `#fffcf6` | 3.56 |
| moss / card (agree dot, final step, stamp frame) | `#2f6b3a` | `#fffcf6` | 6.24 |
| paper / moss (check icon on agree dot and final step) | `#f6f1e8` | `#2f6b3a` | 5.68 |
| paper / ink (check icon on done steps, camera on the drop disc) | `#f6f1e8` | `#15130f` | 16.49 |
| ink / card rim (pile box outline) | `#15130f` | `#fffcf6` | 18.12 |
| ink / paper (the 1 px ink edge around moment buttons and the ticket) | `#15130f` | `#f6f1e8` | 16.49 |

Not counted as edges, because they are decorative or text identifies the thing: card edges
(`--rule`, 1.34:1 on paper), their bubble and the ledger grid (`--rule-strong`, 2.06–2.09), chip
outlines (ink at 40 %, 2.58 on card), the ear's divider, and the ruled-paper lines. Disabled buttons
(opacity .45) are exempt, as before.

### Verified (2026-10-10, `GEMINI_MOCK=1`, port 3006, Chrome in the Browser pane)

- **Two tabs**, Ethan (owner) and Fox (recipient), at 390 px, then again at 700 px after a reset:
  1. Board → Give (`/seed/lamp.jpg` fed through a DataTransfer) → draft → **Looks right** → **Offer to Fox**.
  2. Fox: the For you band → **Accept & reserve** with a blank place and time → ticket, plus the
     thread with Loop's two opening messages.
  3. Ethan: **Suggest a time and place** (Student Union, Today 8 pm) → Fox: **Works for me** → the
     reminder landed about 3 s later.
  4. Fox: **I'm here** → Ethan: **Enter code** → one wrong code (403, intentional) → the right
     code → **Collected** and the stamp.
- **Pile review** on `/seed/pile.jpg` at 390 and 700 px: 3 items, #2 unticked.
- **Anonymous seed re-run.** After the seed switched to nicknames (Heron, Fox, Kite, Owl, Wolf) the
  390 px flow was run again end to end (picker, board, Give, draft + match, ticket, thread, wrong
  code, collected, pile); those are the 390 px screenshots. The 700 px set and the translation and
  menu shots are from the first run and still show the old seed names; the layout is the same.
- **44 px sweep** (every visible `a`, `button`, field, `label.pick`, `label.pile-check` measured
  with `getBoundingClientRect`) on board, open menu, Give, draft, item + thread, pile: nothing under
  44 px except the hidden radios inside 44 px pick labels and the 22 px pile checkboxes inside 44 px
  labels. The Give-page link was 42 px and was fixed; the narrow-phone ear was 36 px and was fixed.
- **Language row.** Fox → 中文: POST 200, the menu closed, focus went back to the person button,
  "Language: 中文." was announced; then back to English. A forced 404 (fetch stubbed in the page)
  changed nothing and announced nothing.
- **Translated bubbles**, through the real hook (mock translations read `[lang] text`): Owl (zh)
  reserved Fox's fan and saw Loop's messages as `[zh] …` with "translated"; one tap showed the
  original ("original"). Fox saw Owl's "我六点在图书馆可以吗" as `[en] …` with "translated". Owl's
  own message stayed as written.
- **The iMessage line.** `lineNumber` is null under `GEMINI_MOCK=1` (Spectrum is off), so for the
  screenshots it was injected in the page (`state.health.lineNumber = '+17739123997'; renderLine();
  render()`). With null, the ear, the footer line and the Give line are all absent (checked).
- **Widths.** `scrollWidth === innerWidth` at 390 px (board, give, draft, item, ticket, thread,
  collected, pile, menu), 360 px (board, give, both item pages, ask) and 700 px (board, draft,
  ticket, thread, collected, pile). The top bar is one row at 390 px for all five names; "You're
  Wolf" is the widest (brand 84 + ear 107 + button 150 + gaps 12 = 353 of 358 px). Below 380 px
  the ear takes its own row.
- **Console.** Fox's tab clean. Ethan's tab: one error, the intentional wrong-code 403.
- **Keyboard.** Tab order: wordmark → ear → person button → Give something; the ring computes to
  3 px solid `#e4572e`, 2 px offset.
- Screenshots in `.tmp-b4/shots/` (gitignored).

## v2 (superseded 2026-10-10)

Modern and mostly white, with Frutiger Aero kept as an accent: near-white page, white cards with a
hairline and a short soft shadow, Nunito, one deep calm blue, a sky-to-mint ribbon, the glossy logo orb
and two glossy "moment" surfaces. The user rejected it on 2026-10-10.

### v2 reference board

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

### v2 tokens (public/styles.css `:root`)

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

### v2 surfaces

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

### v2 deviations from DESIGN_V2, all for contrast

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
| avatar initials, lowest of the three (Kite) | `#ffffff` | `#1b7f45` | 5.04 | 4.5 |
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

### v2 verified (2026-10-10, `GEMINI_MOCK=1`, port 3005, Chrome in the Browser pane)

- **Two tabs at 390 px**, Ethan (owner) and Fox (recipient):
  1. Board → Give (`/seed/lamp.jpg` fed through a DataTransfer) → draft → **Looks right** → **Offer to Fox**.
  2. Fox accepts with a blank place and time → the thread opens with Loop's two opening messages.
  3. Ethan: **Suggest a time and place** (Student Union, Today 8 pm) → Fox: **Works for me** →
     the reminder lands about 3 s later.
  4. A message from Fox ("On my way, see you at the Union") was read by the mock as a new suggestion,
     so Ethan re-accepted. That is app behaviour, not styling.
  5. **I'm here** → one wrong code (403, intentional) → the right code → **Collected**.
- **Pile review** on `/seed/pile.jpg`: 3 items, one unticked to check the "not listing" state.
- **Widths.** No horizontal overflow anywhere checked:
  - 390 px, `scrollWidth === innerWidth`: board, give, draft, item and thread, collected, pile, ask.
  - 640 px, `scrollWidth === innerWidth`: board, draft, item, ask.
  - The pane width (1179 px): board, item, pile, draft. `scrollWidth` was 1164 there, the viewport
    minus its 15 px scrollbar.
- **Console.** Clean in Fox's tab. Ethan's tab shows one error, the intentional wrong-code 403.
- **Focus.** Keyboard Tab shows the 3 px `#1f6fd3` ring at a 2 px offset.

## Accessibility checks run

- **Contrast.** See the v3 table above (40 pairs, measured 2026-10-10).
- **Keyboard** (tested in Chrome; behaviour unchanged by v2 and v3):
  - Every action is a native button, link or form control.
  - `:focus-visible` shows the ring.
  - Escape closes the person menu and returns focus to its button.
  - A route change moves focus to the page `h1`. Reserve, confirm, decline and release move it to the
    action heading.
  - A wrong code focuses and selects the code input.
- **Screen readers.** One polite live region announces drafting, "Checked by …", the pickup code
  (digit by digit), 409s, wrong codes, and offline/online. The timeline uses `aria-current="step"` plus
  hidden "done" / "not yet". No state is shown by colour alone: chips and labels always carry text.
- **Targets.** Buttons (48 px; small ones 44), quick picks, condition chips, segments, menu rows,
  language toggles, the ear link and the "translated" tag are at least 44 px tall.
- **Reduced motion.** `@media (prefers-reduced-motion: reduce)` neutralises CSS animation and
  transitions. v3: the stamp, the ticket, the check badge, the scan line and the skeleton get
  `animation: none` (static, not snapped), and the scan line is hidden. JS skips view transitions and
  the shake. The test browser cannot emulate the media query, so this is verified by reading the
  code, not observed.
- **Widths.** v3: see "Verified" in the v3 section.
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
