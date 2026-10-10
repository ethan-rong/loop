# Loop — phase 4 contract (Sat Oct 10 2026, 15:35 EDT)

User verdicts: the current look is "not great"; the Beginner winners never needed the theme, so Frutiger Aero is dropped as a visual constraint (we stay in Beginner, Community, Gemini, Photon). Demo people are now Ethan (phone, giver), Fox (web, recipient), Kite, Owl (Chinese-speaking), Wolf. Loop's iMessage number must appear consistently in the UI. Add bilingual threads.

## A. Design v3 — "campus paper" editorial look (Lane B4; owns public/styles.css, public/index.html, public/favicon.svg, public/fonts/**, DESIGN.md; app.js only class names/wrappers and the small additions listed in D)

Why: judges will see forty light-blue SaaS cards this weekend. Loop should look like a well-set campus paper or zine: warm paper, ink type, one hot accent, photographs that feel like photographs, and a few printed-object metaphors (a ticket stub for the pickup code, a rubber stamp for "Kept in use"). Distinct, calm, and legible on a phone in two seconds.

Tokens:
- Paper `#f6f1e8` (page), card `#fffcf6`, ink `#15130f`, ink-2 `#5c5649`, rule `rgba(21,19,15,.14)`.
- Accent "tangerine" `#e4572e` (primary buttons, links, the moment surfaces), moss `#2f6b3a` (collected / fulfilled), ochre `#b7791f` (reserved / warnings), slate `#3b5b8a` (offered / Loop's voice). Chips: 1 px ink-tinted outlines with ink text, no pastel fills.
- Type: display **Fraunces** (Google Fonts, OFL, self-host the variable woff2 with opsz/wght axes; fallback Georgia) for page titles and item titles, 36–44 px on phone h1 with tight leading (1.02) and `font-variation-settings: "opsz" 144`; body **Inter** or **Manrope** (self-host one, OFL) 16/1.5, labels 13 px uppercase tracking .06em in ink-2. Numbers in the code badge: Fraunces 56 px.
- Surfaces: cards flat on paper with a 1 px rule and 16 px radius; no blur, no gloss, no gradients anywhere except a 2 px tangerine underline motif under section titles. Photos edge-to-edge at the top of cards with 12 px radius, a thin ink rule under them.
- Buttons: primary = ink `#15130f` fill, paper text, pill, 48 px; "moment" buttons (Offer to Fox, Reserve, Confirm handoff, YES) = tangerine fill, paper text; secondary = paper fill, 1 px ink rule, ink text. Hover: lift 1 px + rule darkens. Focus ring 3 px tangerine, 2 px offset.
- Loop's identity: a small ink loop mark (a single continuous stroke, hand-drawn feel; SVG, 20 px) before every Loop bubble and in the top bar next to the wordmark set in Fraunces italic ("Loop"). Loop bubbles: paper with a dashed ink rule; people's bubbles: solid ink (mine) / card with rule (theirs); "iMessage" tag in slate.
- Status chips carry text always; Collected uses moss with a tiny check.
- The pickup code = a ticket stub: dashed perforation line, "Show this at pickup" label, Fraunces digits, a slight -1.5° rotation. Collected = a rubber stamp "KEPT IN USE" in moss, rotated -8°, stamped once with a 250 ms scale-in (none under reduced motion).
- The AI-draft card keeps the "Drafted by Gemini — check it" label, now with a dashed slate rule; human-checked = solid ink rule and "Checked by Ethan".
- Background: plain paper, no bubbles, no ribbon. One optional decorative detail: a faint ruled-paper line pattern behind the board header only (opacity ≤ .06).
- Motion unchanged (view transitions, 150–250 ms), reduced-motion respected. Contrast ≥ 4.5:1 text / ≥ 3:1 edges, re-measured and written to DESIGN.md "v3".
- Top bar: wordmark, "You're Ethan ▾", and a right-aligned small ink line **"Text Loop · (773) 912-3997"** rendered from `health.lineNumber` (hidden when null) as an `sms:` link; the same line repeats in the board footer and on the Give page ("No app? Text a photo to Loop at (773) 912-3997").

Deliver: screenshots at 390 and ~700 px of board, draft+match, thread, ticket, collected stamp, pile; DESIGN.md v3 with tokens and contrast; no copy or behavior changes beyond D.

## B. Names (done by Fable): people ids `ethan, jerry, jack, tom, thomas`; env `PHONE_ETHAN` (and `PHONE_JERRY` alias, same number). Seed: Fox asks for a reading lamp, Kite for a winter coat, Owl (lang zh) for a mini fridge, Wolf for a desk fan; Kite gives the textbook, Fox gives the desk fan.

## C. Bilingual threads (Lane G; owns server/translate.mjs (new), scripts/e2e-translate.mjs (new), and small additive edits in server/store.mjs (message `translations` field), server/index.mjs (hook after any message append), server/channels/spectrum.mjs (forward in the recipient's language))

- People may carry `lang` (`en` default, `zh`, `es`). The seed sets Owl to `zh`. The UI lets a person switch their language from the person menu (D).
- Whenever a message is appended to a thread (human or Loop) and the two participants' languages differ, the server translates it once with Gemini (text-only call, schema `{text}`) into the OTHER participant's language and stores it as `message.translations[lang]`. Loop's own template messages are translated the same way. Translation is additive: the original is always kept; never translate the pickup code; keep names, places, times and digits unchanged (prompt rule).
- Mock (`GEMINI_MOCK=1`): translations[lang] = `[${lang}] ${text}`.
- Rate limits: one call per message when languages differ; the demo thread is ~8 messages.
- iMessage: when forwarding to a linked person, use that person's language if a translation exists.
- `coordinate()` already receives the full message text; when the speaker writes in zh, the model's reply is still English in the store; the hook translates it for the zh reader. Add to the coordinator prompt: "People may write in any language; understand it and act; reply in English."
- API: `GET /api/state` includes `translations` on messages and `lang` on people. `POST /api/people/:id/lang {lang}` sets the language (demo only, no auth). Health adds `translate: true|false` (true when the hook is active).
- Tests: `scripts/e2e-translate.mjs` (mock): Owl (zh) reserves Fox's fan → opening messages get `translations.zh`; Owl writes "我六点在图书馆可以吗" → the message gets `translations.en`; Loop's reply gets `translations.zh`; a thread between two `en` people gets no translations; 3× PASS. Plus one REAL call in a tiny script that translates one line zh→en and en→zh and prints both (max 2 real calls).

## D. Small UI hooks for C (Lane B4, in app.js, ≤ 60 lines, additive)
- Person menu: a "Language: English | 中文 | Español" row that POSTs `/api/people/:id/lang` and stores nothing locally.
- Thread bubbles: when `message.translations[myLang]` exists and the original is in another language, show the translation as the bubble text with a small "translated" tag; tapping the tag toggles the original. Loop's messages follow the same rule.
- Board request cards: if a request was posted in another language, show the original (no translation needed for v1).

## E. Out of scope: voice, maps, accounts, naming the iMessage sender (shared line stays unnamed on Free/Pro), any new npm dependency.

## F. Campus map (added 16:45 EDT; user: "shall we include a map" → yes, schematic)

No tile maps, no geodata, no dependency. One inline SVG "campus map" component drawn once in app.js (`campusMap({highlight, from, to})`), styled per the chosen direction:
- 8 labelled spots with fixed schematic coordinates (0–100 units): Davis Library, Student Union, Franklin St, Lenoir, Hinton James, South Campus, Franklin St area, South Campus, Mid Campus. South Campus = cluster of Hinton James / South Campus / South Campus at the bottom; Franklin St at the top; Union and Davis in the middle.
- Where it appears: (1) the pickup-plan card in a thread (highlight = the agreed or proposed spot; `from` = giver's dorm, `to` = taker's dorm, with a dotted path between them); (2) the reserve/propose form: tapping a spot on the map fills the place field (same as the quick-pick chips); (3) the board header, small, with pins for where current items are (giver's spot) — optional, only if cheap.
- People's `spot` strings map to the nearest schematic spot by name match; unknown spots show no pin. Spot names in the plan ("Davis Library lobby") match by prefix.
- Accessibility: the SVG has a title and the spot list is also real text (the chips), so the map is decorative-plus, never the only control.
