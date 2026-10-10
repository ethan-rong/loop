# Devpost copy — Loop (draft 1, Sat Oct 10, 12:30 PM EDT)

Paste into https://hacknc-2026.devpost.com → "My projects" → create project. Create the draft and tick the tracks BEFORE midnight Saturday; edit text later. Items in [brackets] are filled in after the build is verified. Do not add claims that are not in this file.

## Project name
Loop

## Tagline (one line)
Photograph something you don't need. Loop finds who does and walks you both to the handoff.

## Tracks / opt-in prizes to select
- HackNC Beginner (you are a first-time hackathon participant; answer the experience question truthfully)
- Frutiger Aero
- Best Community Hack
- [MLH] Best Use of Gemini API

Do not opt into Photon, Nessie, Solana, ElevenLabs, Snowflake, .Tech, or Tiger Data: Loop does not use them.

## About the project

### Inspiration
Every May the dumpsters outside UNC dorms fill with lamps, fans, mini fridges and textbooks that still work, while a few hundred metres away someone is about to buy the same thing. Campus listing boards exist, but most posts stop at "posted": nobody matches the item to a real need, nobody agrees a pickup, and nobody knows whether the handoff happened. I wanted the whole loop to close, not just the listing.

### What it does
Loop is a small web app for passing usable belongings to the people who need them.

1. Someone posts a need in plain words ("reading lamp for my desk").
2. An owner photographs an item. Gemini drafts the title, description and visible condition, and suggests at most one open request the item genuinely fits, with a one-sentence reason.
3. The owner checks and edits the draft (the AI draft is visibly marked "Drafted by Gemini — check it" until a person approves it), then offers it to that person or posts it to the board.
4. The recipient accepts, picks a pickup place and time, and gets a 4-digit pickup code.
5. At pickup the owner types the code. Only then does the item become "Collected" and the request "Fulfilled".

Gemini never publishes, reserves, contacts anyone or marks anything collected. A person taps every state change. If Gemini cannot identify the object, is rate-limited, or times out, the owner gets a plain explanation and fills in the form by hand.

### How we built it
- Node 22 + Express server with a JSON-file store; every state change (available → offered → reserved → collected) is a pure transition function that rejects invalid moves (409 when someone else already claimed an item, 403 on a wrong pickup code).
- Gemini 3.5 Flash-Lite through the Gemini API `generateContent` endpoint with an image part and a JSON response schema. The server validates the result: unknown request IDs are discarded, strings are clamped, and "not allowed" items (food, medicine, weapons) are blocked.
- Front end in plain HTML, CSS and JavaScript, no framework and no build step: hash routing, one render function, polling for live updates so two people see each other's actions, View Transitions for route changes, `prefers-reduced-motion` respected.
- Visual language: Frutiger Aero, kept restrained. Sky-to-mint gradient, glass cards, glossy pill buttons, Nunito. References: Shupatto brand site (Awwwards Site of the Day, Feb 3 2024) for making a physical action legible through motion; Ocean Lovers Guide to Compost (Awwwards Honorable Mention, May 16 2025) for blue/white sustainability storytelling; motion.dev examples for state transitions.

### Challenges we ran into
- The Gemini docs now lead with a newer Interactions API, so the first job was proving the classic `generateContent` request shape (image part + `responseSchema`) on gemini-3.5-flash-lite before writing any UI. It worked first try, about 2 seconds per photo.
- Honest condition drafts: the first prompt rated a visibly dusty fan "good". Telling the model to look for dust, scratches, dents, stains and frayed cords, and to only say "good" when nothing is visible, fixed it ("fair", "The fan blades and center are dusty").
- Two people, no accounts: each browser tab is one person (sessionStorage), the server owns the state machine, and both tabs poll a version counter so an offer or reservation shows up on the other screen within about 1.5 seconds without a refresh.
- Keeping the AI draft visually separate from human-checked facts without making the UI preachy: a dashed card and "Drafted by Gemini — check it" until the owner edits or taps "Looks right", then a solid card and "Checked by Ethan".
- Contrast: the glossy Frutiger Aero palette had to be darkened in places (button gradient, links, focus ring) to keep every text at 4.5:1 or better.
- Free-tier rate limits (15 requests/min, 500/day): all automated tests run against a mock path, and the UI shows a clear "Demo mode" banner whenever the mock is on, so canned output can never pass as a live model result.

### Accomplishments that we're proud of
- A complete two-person loop that ends in a confirmed handoff, not a listing.
- Honest AI: the model says "no suitable match" when nothing fits, and the UI treats its output as a draft.
- [Three consecutive end-to-end runs passed on the judging laptop; see README "Verification".]

### What we learned
- Prove the riskiest call first with a ten-minute script, then build. Everything downstream of the Gemini photo call would have changed if it had failed.
- Design every state before styling anything: uploading, drafting, no match, AI failed, offered, reserved, already claimed, collected, withdrawn, network down. The polish came last and went faster because the states already existed.
- Scope to one loop. One owner, one recipient, one item, one need, one confirmed handoff, and nothing else, was the only way a solo first-timer could finish and verify it.

### What's next for Loop
Real accounts and campus email verification, photos of the handoff spot, notifications when a new need matches an existing item, and a trial with one residence hall at move-out. Nothing here has been tested with real users yet.

## Built with (tags)
javascript, node.js, express, html, css, gemini, gemini-api, json

## Links
- GitHub: [https://github.com/rongtnt/loop — fill after push]
- Video: [YouTube unlisted link, ≤ 2:00 — fill after upload]

## AI and attribution disclosure (also in README)
Built solo during the HackNC 2026 hacking window with AI coding assistance (Claude Code: Claude Fable 5.1 for planning, specification and review; Claude Opus for implementation). AI wrote most of the code under my direction; I set the scope and rules, reviewed the flows, tested the app end to end, and can explain how it works. Pre-event research on rules and past winners used OpenAI Codex/ChatGPT; no code came from it. The product itself calls Google's Gemini API (model gemini-3.5-flash-lite). Libraries: Express. Fonts: Nunito (SIL Open Font License). Seed photos: Wikimedia Commons, credited in `public/seed/ATTRIBUTION.md`. No user data, impact figures or completed exchanges are claimed beyond what the demo shows.
