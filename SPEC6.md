# Loop — design v4 "poster, light" (user pick, Sat Oct 10 2026, 17:15 EDT)

User chose direction 2 (poster) "but keep it the light background". Reference: `mockups/poster/` (styles.css, fonts) translated onto a light canvas. Keep everything structural from Lane I (no identities, posting-first board, campus map, roles You/Giver/Taker/Loop).

## Tokens
- Canvas cream `#f6f1e3`; card `#ffffff`; ink `#0b0d17`; muted `#4a5068` (≥ 7:1 on cream); rule = 2 px ink (3 px on hero cards).
- Acid lime `#c8ff3c` and hot coral `#ff6b57`: FILLS only (stickers, chips, button fills, highlighter blocks, map accents), always with ink text (ink on lime ≥ 14:1, ink on coral 6.9:1). Never lime or coral as text on cream.
- Primary buttons: ink fill, cream text, 2 px ink border, hard offset shadow 4 px 4 px 0 ink; moment buttons (Post it / Offer / Reserve / Confirm handoff / Works for me / YES): coral fill, ink text, ink border, hard shadow; secondary: white fill, ink text, 2 px ink border, no shadow until hover.
- Hard offset shadows everywhere a card lifts: `6px 6px 0 #0b0d17` on hero and plan cards, `4px 4px 0` on item cards; hover translates −2 px and the shadow grows by 2 px. No blur, no gradients.
- Type: Space Grotesk (mockups/poster/fonts, OFL) 500/700 for UI and display; JetBrains Mono 400/700 for labels, times, chips, Loop's system cards and the pickup code. Display h1 44–52 px on phone with one word wrapped in a lime highlighter block (`<mark>`-style span, lime fill, ink text, slight -1° rotation). Section titles uppercase Space Grotesk 700 with a coral count badge.
- Chips = stickers: mono uppercase 12 px, 2 px ink border, white/lime/coral fills, rotated ±1.5° alternating; status: Available lime, Reserved coral, Offered white with ink text, Collected ink fill cream text, Open need white, Fulfilled lime.
- Loop's messages: white "system" card with 2 px ink border and a lime title bar (mono "LOOP · 5:12 PM"); the letter disc "L" lime with ink text. Taker/Giver bubbles: white card with coral (Taker) or ink (Giver) 2 px border, mono header "TAKER · 5:19 PM"; You: cream card with ink border, right-aligned. "translated" and "iMessage" tags: mono stickers.
- Pickup code: 96–104 px Space Grotesk 700 ink digits, 8 px dotted coral underline, a lime sticker "SHOW THIS AT PICKUP" rotated -3° above; ticket card white with 3 px ink border and 6 px shadow; the loop mark at the right.
- Collected: an ink stamp "KEPT IN USE" (3 px ink border, mono, rotated -8°, stamped once; static under reduced motion) and a coral check sticker.
- Campus map: ink line drawing on cream inside the plan card, lime highlight ring + coral "MEET · 6 PM" sticker at the agreed spot, mono labels; caption "Public spots only. Nobody's room is on the map."
- Top bar: logo (brand/ chosen mark, ink) + "Loop" Space Grotesk 700; right: EN · 中文 · ES segmented (ink pill with cream active); under the bar a full-width lime strip in mono: "✳ TEXT LOOP · (773) 912-3997 ✳" (sms: link) — the "ear" from v3 is replaced by this strip. Board footer repeats the number as a mono link.
- Focus ring: 3 px coral outline, 2 px offset. Targets ≥ 44 px. Reduced motion: no translate on hover, no stamp animation.
- Contrast: measure every text/background pair (≥ 4.5:1) and every border/icon (≥ 3:1) and record a "v4" section in DESIGN.md.

## Out of scope
Dark mode (the user wants light), new copy, new behaviour.
