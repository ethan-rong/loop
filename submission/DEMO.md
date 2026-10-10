# Demo script, judging runbook, and Q&A sheet — Loop

## Setup (laptop)

```bash
cd ~/loop && npm start          # http://localhost:3000, real Gemini
```

Open two Chrome windows side by side, each about half the screen:
- LEFT = Maya (owner). RIGHT = Sam (recipient). Pick the person on first load (per tab, stored in sessionStorage).
- Before every judge: click "Reset demo" in the footer (or `npm run seed`). Check both windows show the fresh board.
- Keep 3–4 real photos ready in `~/loop/demo-photos/` (your own objects, shot on your phone). Use the file picker; don't depend on venue Wi-Fi for the phone.
- Emergency fallback if Gemini is down or rate-limited: restart with `GEMINI_MOCK=1 npm start`. The UI shows a "canned draft" banner; tell the judge "the model is offline, this is the canned draft path" — never present mock output as live.

## Two-minute video / live demo script

| Time | Window | Say | Do |
|---|---|---|---|
| 0:00 | both | "Every move-out, working lamps and fridges go in the dumpster while someone down the hall is about to buy one. Listings don't finish the job. Loop does." | Show the board. |
| 0:12 | RIGHT (Sam) | "Sam needs a reading lamp." | Ask for something → title "Reading lamp for my desk" → Post. |
| 0:25 | LEFT (Maya) | "Maya photographs the lamp she's about to throw out. Gemini drafts the listing and says: this fits Sam's request, here's why." | Give something → pick lamp photo → wait for draft → point at the dashed "Drafted by Gemini — check it" card and the match card. |
| 0:50 | LEFT | "She fixes the condition herself, Gemini only drafts, then offers it to Sam." | Change condition to "fair", edit one word → Offer to Sam. |
| 1:02 | RIGHT | "Sam sees the offer live, accepts, picks the pickup spot, and gets a code." | Open the offer → Accept & reserve → Davis Library lobby, Today 5 pm → Reserve → show the big code. |
| 1:20 | LEFT | "At the handoff Maya types Sam's code. That's the only way an item becomes collected." | Type a wrong code first (shows the error), then the right one → Collected. |
| 1:35 | RIGHT | "Sam's need is fulfilled. The loop closed: photo, reviewed draft, real need, reservation, confirmed handoff." | Show Fulfilled chip and the "1 item kept in use" footer. |
| 1:45 | LEFT | "Built in plain JavaScript on Node with Gemini 3.5 Flash-Lite behind a JSON schema; the server validates every suggestion and a person approves every step." | Show the code briefly (gemini.mjs schema, store transitions). |
| 1:57 | — | "Loop." | End. |

Rehearse with a timer three times. Cut words, not steps.

## How it works (for the two minutes of questions)

- **Flow:** photo → client resizes to ≤1024 px JPEG → `POST /api/items/draft` → server stores the photo, calls Gemini `generateContent` with the image + the open requests + a JSON schema → server validates (known request IDs only, string clamps, blocked categories) → browser shows an editable draft → owner publishes or offers → recipient reserves (server issues 4-digit code) → owner confirms with code → server flips item to `collected` and request to `fulfilled`.
- **State machine:** `available → reserved → collected`, plus `offered` (to one person) and `withdrawn`. Illegal transitions return 409/403; nothing is mutated in place; `version` increments so both windows re-render.
- **Why Gemini only drafts:** condition claims affect a stranger's decision; the owner is accountable, so the model's text stays a dashed draft until a person edits or approves it.
- **What's checked:** three consecutive scripted end-to-end runs (mock AI, no quota use) + two real-photo calls (lamp → matched the lamp request; unrelated object → no match). Latency and token counts in README.
- **Limits, said plainly:** no accounts (demo identities), single-server JSON store, no notifications, image accuracy only spot-checked, no real users yet, no environmental impact measured.
- **What I built vs. reused:** everything in `server/` and `public/` was written during the event with AI coding assistance that I reviewed and tested; Express and Nunito are third-party; seed photos are Wikimedia Commons (credited).
- **Frutiger Aero fit:** reuse is the sustainability substance; the sky/mint glass look is the aesthetic. Both are needed for that track.

## Backup plan

- If the laptop can't reach the internet: the whole app runs locally; only the Gemini call fails. The UI explains and falls back to the manual form. Say so.
- If something crashes: `npm run seed && npm start`. Data resets in under 5 seconds.
- Video is the primary record; the live demo is the bonus. Upload the video Saturday night.
