# Demo script, judging runbook, and Q&A sheet — Loop

## Setup (laptop + your phone)

```bash
cd ~/loop && (lsof -ti :3000 | xargs kill 2>/dev/null; true) && npm run seed && npm start   # http://localhost:3000, real Gemini + iMessage
```

- Exactly ONE Loop server may run with the real channel (it consumes the shared line's inbound messages). Stop any test server first (`lsof -ti :3500 | xargs kill`).
- `.env.local` must hold the Gemini key, the Photon project id/secret, and `PHONE_ETHAN=+1…` (your phone). Your number must be on Photon's Users page and must have texted the line once (done Oct 10).
- Loop's number: **+1 (773) 912-3997** (also in `/api/health` as `lineNumber`). Save it in your phone as "Loop".
- Browser window = **the taker** (any tab is an anonymous session; nothing to pick). Your phone = **the giver** over iMessage. Loop has no identities at all: no names, no accounts; the 4-digit code proves identity at the handoff. Say that to judges when they ask about privacy. Second browser tab = Ethan's web view, optional, to show the board updating.
- Before every judge: click "Reset demo" in the footer (or `npm run seed`), and start a fresh thread in Messages (previous Loop messages stay; that's fine).
- Wi-Fi fallback: tether the laptop to your phone's hotspot (both Gemini and Photon need the internet). Last resort: `GEMINI_MOCK=1 npm start` shows a "Demo mode" banner and turns iMessage off; say so to the judge. Never present mock output as live.
- Keep a real object on the table to photograph (a lamp-like object matches the seeded request "Reading lamp for my desk"; otherwise edit the taker's seed request to match your object before `npm run seed`).

## Two-minute video / live demo script (giver on iMessage, recipient on the web)

| Time | Where | Say | Do |
|---|---|---|---|
| 0:00 | board (taker tab) | "Every move-out, working lamps and chargers go in the dumpster while someone down the hall is about to buy one. Listings don't finish the job. Loop does, and you don't even need the app. Nobody here has a name." | Show the board. Tap Ask for something → "Reading lamp for my desk" → Post. (Post the need live: the seed holds no lamp request on purpose, so the match goes to this tab.) |
| 0:12 | phone (giver) | "The giver texts a photo of the lamp he's about to toss to Loop's number." | Send the lamp photo to Loop. |
| 0:20 | phone | "Four seconds later Loop replies with a draft and a match: the taker across campus asked for exactly this." | Show the reply: "Got it — looking at your photo…" then the draft line and "Someone nearby asked for \"Reading lamp for my desk\" 1 min ago — it fits. Reply YES to offer it, BOARD to post it for anyone, or type a correction." |
| 0:32 | phone | "The giver corrects the condition himself — Loop only drafts — then says YES." | Text "condition fair, dent on base" → updated draft → text YES → "Offered. I'll tell you when they accept and we'll sort out the pickup here." |
| 0:45 | board (taker tab) | "The taker gets the offer on the web, accepts, and leaves the pickup blank. No name on either side." | Open the offer → Accept & reserve with blank place/time. |
| 0:58 | phone + web | "Now Loop coordinates. It asks the giver first — the giver is giving, so their availability wins." | Show the giver's phone: "Someone reserved your … You're the one handing it over, so you pick…". Text "6 pm at Davis Library?". |
| 1:10 | web (taker) | "Gemini turns that into a proposal; the taker confirms with one tap. Both get the plan and a reminder." | The taker taps "Works for me". Show the plan card "Set". |
| 1:25 | web → phone | "At the library the taker taps I'm here; the giver gets the code prompt and texts the four digits." | The taker taps "I'm here" → show Ethan's phone prompt → text the code from the taker's screen. |
| 1:40 | both | "Collected. Fulfilled. One item kept in use, and the whole handoff happened in a text thread." | Show COLLECTED and the KEPT IN USE stamp on the web, and "Loop: Handed over. Thanks, both — the … stays in use." on the phone. |
| 1:50 | code | "Plain JavaScript on Node, Gemini 3.5 Flash-Lite behind JSON schemas for drafts, piles and the coordinator's actions, Photon Spectrum for iMessage. The server validates every suggestion; a person approves every step." | 5 s on gemini.mjs / coordinator.mjs / textflow.mjs. |
| 1:58 | — | "Loop." | End. |

Optional 10-second inserts if time allows (replace the code shot):
- "One photo, a whole pile": Give → A pile → the yard-sale photo → six items, one matched.
- "Loop speaks both languages": switch the web tab to **the Chinese-speaking tab** (language 中文 in the person menu), reserve the taker's fan, type 我六点在图书馆可以吗 — the taker's tab shows "Is 6 o'clock at the library okay with you?" with a "translated" tag, and Loop's reply reaches the Chinese-speaking tab in Chinese. Costs one Gemini call per message; keep it to three messages.

Button labels as built: Post something · Ask for something · Looks right · Offer to them · Post to board instead · Accept & reserve · Suggest a time and place → Suggest to the taker · Works for me · I'm here · Confirm handoff · Release · Reset demo. Phone replies as built: welcome "Hi — this is Loop. Text me a photo…"; after YES "Offered. I'll tell you when they accept…"; after BOARD "Posted to the board. I'll text you when someone reserves it."; at the meeting "Loop: The taker is at {place}. Ask for the 4-digit code and text it to me."

Rehearse with a timer three times. Cut words, not steps. Record phone and screen together (QuickTime: screen recording + iPhone mirrored via USB, or film the phone with a second device).

### Seed for the demo
`server/seed.mjs` holds the three people, their requests and the two available items. the taker's request is "Reading lamp for my desk"; change its title/details to match the object you will photograph, then `npm run seed`. Keep another tab's coat request and Ethan's fridge request as unmatched background needs.

## How it works (for the two minutes of questions)

- **Flow:** photo → client resizes to ≤1024 px JPEG → `POST /api/items/draft` (or `/api/items/pile` for a pile) → server stores the photo, calls Gemini `generateContent` with the image + the open requests + a JSON schema → server validates (known request IDs only, reason written before the id, string clamps, blocked categories) → editable draft → owner publishes or offers → recipient reserves → **handoff thread** opens with Loop as coordinator → both confirm a plan → reminder → "I'm here" → giver enters (or texts) the 4-digit code → `collected` + `fulfilled`.
- **Two state machines, both pure functions on a JSON store:** items `available → offered → reserved → collected` (plus `withdrawn`); threads `planning → set → meeting → done | cancelled`. Illegal moves return 409/403; `version` increments so both windows re-render by polling.
- **The coordinator:** button taps change state without any AI call. Typed messages go to Gemini with the thread context and the current New York time, and come back as one action (`propose | accept | arrived | cancel | chat | decline`) plus a one-sentence reply. The server validates the action (can't accept on someone's behalf, can't say "arrived" before the plan is set, times must be in the future) and applies it through the same transitions as the buttons. The giver's availability has priority by rule in the prompt. Loop never sees or sends the pickup code to the giver.
- **Pile detection:** one call returns up to six objects with boxes in 0–1000 units; the client crops each box (plus 6 %) from the original photo on a canvas and lists each as its own item. A request can be matched by only one item.
- **iMessage:** Photon's Spectrum on a shared line forwards thread messages to linked phones and routes replies back into the same thread (text-a-photo giving and code-by-text are described in SPEC3.md; say exactly what was verified live).
- **Why Gemini only drafts:** condition claims affect a stranger's decision; the owner is accountable, so the model's text stays a dashed draft until a person edits or approves it.
- **What's checked:** scripted end-to-end runs (items ×3, threads ×3, mock AI) + real-photo calls (lamp → matched; fan → no match and honest "dusty"; pile → 6 items, 1 correct match, 5 honest no-matches) + full UI loop with the live model.
- **Limits, said plainly:** no accounts (demo identities), single-server JSON store, free-tier iMessage line (10 people, must text the line once), image accuracy spot-checked only, no real users yet, no environmental impact measured.
- **What I built vs. reused:** everything in `server/` and `public/` was written during the event with AI coding assistance that I directed, reviewed and tested; Express, spectrum-ts and Nunito are third-party; seed photos are Wikimedia Commons (credited).
- **Why it looks like a poster:** judges see dozens of pale SaaS screens; Loop is set like a bold light poster — cream and ink, lime and coral stickers, hard shadows, a ticket stub for the code, a "Kept in use" stamp, a campus map — so the physical handoff reads as physical. The Knot mark is one continuous over-under line, built from a parametric curve.

## Backup plan

- If the laptop can't reach the internet: the whole app runs locally; only the Gemini call fails. The UI explains and falls back to the manual form. Say so.
- If something crashes: `npm run seed && npm start`. Data resets in under 5 seconds.
- Video is the primary record; the live demo is the bonus. Upload the video Saturday night.
