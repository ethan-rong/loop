# Demo script, judging runbook, and Q&A sheet — Loop

## Setup (laptop)

```bash
cd ~/loop && (lsof -ti :3000 | xargs kill 2>/dev/null; true) && npm run seed && npm start   # http://localhost:3000, real Gemini
```

Open two Chrome windows side by side, each about half the screen:
- LEFT = Ethan (owner). RIGHT = Caleb (recipient). Pick the person on first load (per tab, stored in sessionStorage).
- Before every judge: click "Reset demo" in the footer (or `npm run seed`). Check both windows show the fresh board.
- Keep 3–4 real photos ready in `~/loop/demo-photos/` (your own objects, shot on your phone). Use the file picker; don't depend on venue Wi-Fi for the phone.
- If venue Wi-Fi fails: tether the laptop to your phone's hotspot first (only the Gemini call needs the internet). Last resort: restart with `GEMINI_MOCK=1 npm start`; the UI shows a "Demo mode" banner, and you tell the judge "the model is offline, this is the canned draft path". Never present mock output as live.

## Two-minute video / live demo script

The seed already contains Caleb's request for the hero object, so the match works even if a step is skipped under pressure. HERO = the object you photograph live (set the seed request to match it; see "Seed for the demo" below).

| Time | Window | Say | Do |
|---|---|---|---|
| 0:00 | both | "Every move-out, working lamps and chargers go in the dumpster while someone down the hall is about to buy one. Listings don't finish the job. Loop does." | Show the board: point at Caleb's open need for HERO. |
| 0:15 | LEFT (Ethan) | "Ethan photographs the HERO she's about to throw out. Gemini drafts the listing and says: this fits Caleb's request, and why." | Give something → pick the HERO photo → wait ~2 s → point at the dashed "Drafted by Gemini — check it" card and the match card. |
| 0:40 | LEFT | "She corrects the condition herself. Gemini only drafts. Then she offers it to Caleb." | Tap "Fair" (or edit one word) → Looks right → Offer to Caleb. |
| 0:55 | RIGHT (Caleb) | "Caleb sees the offer live, accepts, picks the pickup spot, and gets a code." | Open the "Ethan offered you this" card → Accept & reserve → Davis Library lobby, Today 5 pm → show the big code. |
| 1:12 | LEFT | "At the handoff Ethan types Caleb's code. That's the only way an item becomes collected." | Type a wrong code (error), then the right one → Collected. |
| 1:25 | RIGHT | "Caleb's need is fulfilled, and the board counts one item kept in use." | Board: Fulfilled chip, "1 item kept in use". |
| 1:35 | RIGHT | "It works the other way too: Dani asks for a desk fan, and Loop points her at the fan Caleb already posted." | Ask for something → "Desk fan for a hot room" → Post → suggestion card appears. |
| 1:48 | LEFT | "Plain JavaScript on Node, Gemini 3.5 Flash-Lite behind a JSON schema, the server validates every suggestion, a person approves every step." | Show gemini.mjs schema + store.mjs transitions for 5 seconds. |
| 1:57 | — | "Loop." | End. |

Rehearse with a timer three times. Cut words, not steps.

### Seed for the demo
`server/seed.mjs` holds the three people, their requests and the two available items. Before the video, change Caleb's request title/details to match the HERO object you will photograph (for a lamp: keep "Reading lamp for my desk"; for a charger: "USB-C charger for my laptop"). Keep Dani's coat request and Ethan's fridge request as unmatched background needs. Run `npm run seed` after editing.

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
- **Frutiger Aero fit:** reuse is the sustainability substance; the sky ribbon, glossy orb and code badge are the aesthetic accent on a modern base.

## Backup plan

- If the laptop can't reach the internet: the whole app runs locally; only the Gemini call fails. The UI explains and falls back to the manual form. Say so.
- If something crashes: `npm run seed && npm start`. Data resets in under 5 seconds.
- Video is the primary record; the live demo is the bonus. Upload the video Saturday night.
