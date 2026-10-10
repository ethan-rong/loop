# Devpost copy — Loop (draft 1, Sat Oct 10, 12:30 PM EDT)

Paste into https://hacknc-2026.devpost.com → "My projects" → create project. Create the draft and tick the tracks BEFORE midnight Saturday; edit text later. Items in [brackets] are filled in after the build is verified. Do not add claims that are not in this file.

## Project name
Loop

## Tagline (one line)
Photograph something you don't need. Loop finds who does and walks you both to the handoff.

## Tracks / opt-in prizes to select
- HackNC Beginner (you are a first-time hackathon participant; answer the experience question truthfully)
- Best Community Hack
- [MLH] Best Use of Gemini API

- Photon (Agents in iMessage)

Do not opt into Frutiger Aero (the look is editorial, not aero), Nessie, Solana, ElevenLabs, Snowflake, .Tech, or Tiger Data.

## About the project

### Inspiration
Every May the dumpsters outside UNC dorms fill with lamps, fans, mini fridges and textbooks that still work, while a few hundred metres away someone is about to buy the same thing. Campus listing boards exist, but most posts stop at "posted": nobody matches the item to a real need, nobody agrees a pickup, and nobody knows whether the handoff happened. I wanted the whole loop to close, not just the listing.

### What it does
Loop is a small web app plus an iMessage agent for passing usable belongings to the people who need them.

1. Someone posts a need in plain words ("reading lamp for my desk").
2. An owner photographs an item — or a whole pile. Gemini drafts the title, description and visible condition for each thing it finds (up to six per photo, each with its own box), and suggests at most one open request each item genuinely fits, with a one-sentence reason. When nothing fits, it says so.
3. The owner checks and edits the draft (it stays marked "Drafted by Gemini — check it" until a person approves it), then offers it to that person or posts it to the board.
4. The recipient accepts, and a handoff thread opens between the two people and Loop, the coordinator. Loop asks the giver when and where works (the giver's availability comes first), turns typed replies like "I can do 6 at the Union" into proposals with Gemini, asks the other person to confirm, reminds both before the pickup, and tells the giver when the recipient taps "I'm here".
5. At pickup the recipient shows a 4-digit code; the giver types it in the app or texts it to Loop. Only then does the item become "Collected" and the request "Fulfilled".
6. No app needed: through Photon's Spectrum, the same thread reaches people's phones as iMessages, and a giver can text a photo to Loop's number, get the draft back, reply YES to offer it, settle the pickup by text and send the code by text.

No identities at all: no accounts, names, nicknames, avatars or dorms. A tab or a phone is an anonymous session, the two sides of a handoff are just "the giver" and "the taker", and the 4-digit code proves identity when it matters. Gemini never publishes, reserves, contacts anyone or marks anything collected; a person taps or texts every state change. If Gemini cannot identify the object, is rate-limited, or times out, the owner gets a plain explanation and fills in the form by hand. If iMessage is unavailable, everything works in the browser.

### How we built it
- Node 22 + Express server with a JSON-file store; every state change is a pure transition function. Items: available → offered → reserved → collected (409 when someone else already claimed it, 403 on a wrong code). Threads: planning → set → meeting → done or cancelled.
- Gemini 3.5 Flash-Lite through `generateContent` with image parts and JSON response schemas: one schema for a single item, one for a pile (boxes in 0–1000 units), one for the coordinator's actions (propose / accept / arrived / cancel / chat / decline). The server validates everything: unknown request ids are dropped, the schema asks for the reason before the id so the model commits to its reasoning first, strings are clamped, "not allowed" items (food, medicine, weapons) are blocked, and the coordinator can never confirm on someone's behalf or reveal the code.
- Photon Spectrum (`spectrum-ts`) on a shared iMessage line: thread messages are forwarded to linked phones, replies are routed back into the same thread, and a texted photo runs the same draft pipeline.
- Front end in plain HTML, CSS and JavaScript, no framework, no build step: hash routing, one render function, polling with a version counter so two people see each other's actions within about 1.5 seconds, View Transitions, `prefers-reduced-motion` respected, every text pair measured at 4.5:1 or better.
- Visual language: a "poster, light" system — cream and ink, acid lime and coral only as fills, Space Grotesk + JetBrains Mono, hard offset shadows, sticker chips, a ticket-stub pickup code, a rubber-stamp "Kept in use", a schematic campus map with the agreed spot, and the Knot mark (one continuous over-under line). No names, avatars or dorms anywhere.

### Challenges we ran into
- Proving the riskiest call first: the Gemini docs now lead with a newer Interactions API, so the first job was confirming the classic `generateContent` request shape (image part + JSON schema) on gemini-3.5-flash-lite. It worked first try, about 2 seconds per photo.
- Honest drafts: the first prompt rated a visibly dusty fan "good"; telling the model to look for dust, scratches and dents, and to write its reason before it picks a request id, fixed both that and a false "coat" match in the pile photo.
- An agent that never oversteps: the coordinator may only propose, ask, remind and relay. Clear agreements take a deterministic path (no model call), the model handles the messy sentences, and the server rejects anything the rules forbid (accepting for someone else, "I'm here" before a plan exists, revealing the code).
- iMessage on a shared line: Photon's Free plan only reaches people on the project's Users page who have texted the line once, and the first send after connecting can fail, so sends retry and queue.
- Three looks in one day: pale "Frutiger Aero" glass, then a modern blue, then a warm paper zine, before settling on a bold poster on a light canvas. Each pass re-measured every text and edge for contrast (the last one: 20 pairs, none below target).
- No identities, late: removing names, avatars and dorms touched every sentence the server writes. People became opaque session ids and the two sides of a handoff became "the giver" and "the taker"; the 4-digit code carries all the trust.

### Accomplishments that we're proud of
- A complete two-person loop that ends in a confirmed handoff, not a listing.
- Honest AI: the model says "no suitable match" when nothing fits, and the UI treats its output as a draft.
- [Three consecutive end-to-end runs passed on the judging laptop; see README "Verification".]

### What we learned
- Prove the riskiest call with a ten-minute script before building anything on it.
- Design every state before styling anything: uploading, drafting, no match, AI failed, offered, reserved, already claimed, collected, withdrawn, network down. The polish passes were fast because the states already existed.
- An AI coordinator earns trust by what it refuses to do. The demo is strongest when Loop says "nothing to agree to yet" or "I can't share the code".
- Anonymity simplifies the product: once nobody has a name, the code at the handoff is the only identity that matters, and the whole board becomes just things people have and things people need.

### What's next for Loop
Real accounts and campus email verification, photos of the handoff spot, notifications when a new need matches an existing item, and a trial with one residence hall at move-out. Nothing here has been tested with real users yet.

## Built with (tags)
javascript, node.js, express, html, css, gemini, gemini-api, photon, spectrum, imessage, json

## Links
- GitHub: [https://github.com/rongtnt/loop — fill after push]
- Video: [YouTube unlisted link, ≤ 2:00 — fill after upload]

## AI and attribution disclosure (also in README)
Built solo during the HackNC 2026 hacking window with AI coding assistance (Claude Code: Claude Fable 5.1 for planning, specification and review; Claude Opus for implementation). AI wrote most of the code under my direction; I set the scope and rules, reviewed the flows, tested the app end to end, and can explain how it works. Pre-event research on rules and past winners used OpenAI Codex/ChatGPT; no code came from it. The product itself calls Google's Gemini API (model gemini-3.5-flash-lite) and Photon's Spectrum (iMessage). Libraries: Express. Fonts: Space Grotesk and JetBrains Mono (SIL Open Font License). Seed photos: Wikimedia Commons, credited in `public/seed/ATTRIBUTION.md`. No user data, impact figures or completed exchanges are claimed beyond what the demo shows.
