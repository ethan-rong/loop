# Loop

Photograph something you don't need. Loop finds who does and walks you both to the handoff.

Built solo at **HackNC 2026** (UNC–Chapel Hill, Oct 10–11). Tracks: Beginner, Best Community Hack, MLH Best Use of Gemini API, Photon (Agents in iMessage).

## What it does

1. Someone posts a need in plain words: "Reading lamp for my desk".
2. An owner photographs an item (or a whole pile: one photo becomes up to six listings, each with its own box, draft and match). **Gemini drafts** the title, description and visible condition, and suggests at most one open request each item genuinely fits, with a one-sentence reason — or says honestly that nothing fits.
3. The owner checks and edits the draft, then **offers it** to that person or posts it to the board. The draft is marked "Drafted by Gemini — check it" until a person approves it.
4. The recipient accepts. A **handoff thread** opens between the two people and Loop, the coordinator: Loop asks the giver when and where works, turns typed replies ("I can do 6 at the Union") into proposals with Gemini, asks the other person to confirm, reminds both before the pickup, and tells the giver when the recipient says "I'm here".
5. At pickup the recipient shows a **4-digit code**; the giver types or texts it. Only then does the item become **Collected** and the request **Fulfilled**.
6. **iMessage, no app needed** (Photon Spectrum): one-tap answers too: Loop ends each two-way question with "👍 Works for me · 👎 Suggest another time" (or 👍 YES · 👎 BOARD) and a tapback counts as the answer; the same thread reaches people's phones; a giver can text a photo to Loop's number, get the draft back, reply YES to offer it, settle the pickup by text and send the code by text.

**Free by default, a price if you want.** A giver can ask for a few dollars (shown as a sticker and in Loop's opening line); payment happens in person at the same handshake. Loop never processes money.

**It loops.** The person who collected an item can pass it on again without a new photo; the listing carries its lap count.

**No identities at all.** Loop is a place to post what you have and what you need. There are no accounts, names, nicknames, avatars or dorms; a browser tab or a phone is just an anonymous session, and in a handoff the two sides are simply "the giver" and "the taker". Nobody needs to know who you are: the 4-digit pickup code proves identity at the handoff, and Loop refuses to share numbers or the code in a thread.

Gemini never publishes, reserves, contacts anyone, or marks anything collected. A person taps (or texts) every state change. When Gemini can't identify the object, is rate-limited, or times out, the owner sees a plain explanation and fills the form in by hand; when iMessage is unavailable, everything works in the browser.

## Run it

Requirements: Node 22+, a Gemini API key (free tier works).

```bash
npm install
cp .env.example .env.local      # then put your key in GEMINI_API_KEY
npm start                       # http://localhost:3000
```

`.env.local`:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash-lite
# optional, for iMessage:
SPECTRUM_PROJECT_ID=...
SPECTRUM_PROJECT_SECRET=...
PHONE_ETHAN=+1...   # a demo phone linked to the seed id "ethan"
```

Two people = two browser tabs (each tab becomes its own anonymous session automatically; nothing identifies it). "Reset demo" in the footer, or `npm run seed`, restores the seed data.

Other commands:

```bash
npm run seed                    # reset data/ to the seed state
npm run e2e                     # scripted full loop ×3 with GEMINI_MOCK=1 (no quota used)
npm run e2e-threads             # handoff threads ×3 (needs a mock server on :3100, see scripts)
npm run e2e-textflow            # iMessage text flow ×3 (no server, no SDK)
npm run photo-test -- path.jpg  # one real Gemini call with a real photo; prints latency, tokens, draft
GEMINI_MOCK=1 npm start         # canned drafts, no network, iMessage off (tests only)
LOOP_POLLS=1 npm start          # ask thread questions as iMessage polls instead of the 👍/👎 line (off by default; the shared line echoed a poll without a title)
```

## How it works

```
photo ─► client resize ─► POST /api/items/draft (or /items/pile)
   server stores photo ─► Gemini generateContent (image + open requests + JSON schema)
   server validates: known request ids only, reason before id, string clamps, blocked categories
   ─► editable draft ─► owner publishes or offers ─► recipient reserves
   ─► handoff thread: Loop coordinator (templates for buttons, Gemini for typed replies → {propose|accept|arrived|cancel})
   ─► both confirm ─► reminder ─► "I'm here" ─► giver enters/texts the code ─► collected + fulfilled
iMessage: Spectrum forwards thread messages to linked phones and routes replies back into the same thread;
          a texted photo runs the same draft pipeline and replies with the draft.
```

- `server/index.mjs` — Express routes, boundary validation, JSON errors, reminder loop, channel wiring.
- `server/store.mjs` — JSON-file store with atomic writes; pure transition functions enforce the item state machine (`available → reserved → collected`, plus `offered` and `withdrawn`) and the thread state machine (`planning → set → meeting → done | cancelled`). Illegal moves return 409/403.
- `server/gemini.mjs` — describe a photo, suggest items for a need; timeouts, retries, hallucination guard, mock path.
- `server/pile.mjs` — one photo → up to six items with normalised boxes, each cleaned like a single draft.
- `server/coordinator.mjs` — the thread agent: prompt with the giver-first rule, JSON action schema, validation, mock rules.
- `server/channels/spectrum.mjs` + `server/textflow.mjs` — the iMessage channel and the text-a-photo conversation.
- `public/` — plain HTML/CSS/JS, no framework, no build step: hash routes, one `render()` from state, polling for live updates, View Transitions, `prefers-reduced-motion` respected.

Design notes and references are in [DESIGN.md](DESIGN.md). Build contracts: [SPEC.md](SPEC.md), [SPEC2.md](SPEC2.md), [SPEC3.md](SPEC3.md).

## Verification

Measured on Oct 10 2026 on the development laptop (Node 22.23, Express 5.3, macOS). Details in [SPIKE.md](SPIKE.md).

| Check | Result |
|---|---|
| Gemini request shape | `generateContent` with an `inline_data` image part and an OpenAPI-style `responseSchema` was accepted on the first try; no thinking tokens returned |
| Real photo: desk lamp (seed photo) vs. requests {lamp, coat, fridge} | HTTP 200 in 1.9 s, about 1,470 prompt tokens (1,107 for the image) and 112 output tokens; matched the lamp request |
| Real photo: desk fan vs. the same requests | HTTP 200 in 2.3 s; `match.requestId: null`, "None of the open requests ask for a desk fan." |
| Condition honesty after the prompt tightening | the dusty fan came back `fair` with "The fan blades and center are dusty." |
| Need → suggestion (text-only call) | "Desk fan for a hot room" suggested the seed fan in 0.8 s |
| `npm run e2e` (mock Gemini, no quota used) | 3 of 3 consecutive runs PASS: reset → need → draft → offer → accept → wrong code 403 → right code → collected + fulfilled → re-reserve 409; also decline, release, withdraw, close |
| `npm run e2e-threads` (mock) | 3 of 3 PASS: both thread openings (with and without a suggested place/time), button and typed paths, reminder within 3 s, cancel releases the item, non-participant 403, code → done |
| `npm run e2e-textflow` (mock, no SDK) | 3 of 3 PASS: photo → draft → correction → YES → offered; BOARD; wrong then right code by text; proactive suggestion YES → reserved; HEIC, not-a-photo, no-match, STOP, strangers |
| Pile photo (real call, yard-sale photo with 6 objects) | 6 items with valid boxes in about 3 s; the lamp matched the lamp request, the other five returned honest "no match" reasons after the schema change (reason before id); the same flow then listed all six from the browser with crops |
| iMessage (real, Photon shared line) | channel connects; thread messages reached the linked phone; a dropped connection reconnects on restart; first send right after connect can fail once, so sends retry |
| Live no-identities loop (browser, real Gemini, final look) | anonymous taker posts a need → anonymous giver's lamp photo matched it → offer → accept → giver's proposal via the spot chips → "works for me" → "I'm here" → wrong code rejected → right code → Collected, stamp, closing line |
| Proactive connector (live) | a web post matching an open request texted the linked phone "…Reply YES to reserve it" (`sent to ethan` in the log) |
| Judging-path runs (`npm start` on :3000) | 2 of 2 complete API loops with Reset between; reset clears text sessions |
| Cold start | fresh data directory + `npm start`: server up, seed written, page served |
| Bad input | malformed JSON, missing fields, a 7 MB image, a non-image file and a bad mimeType all return 400 and the server keeps answering |

Not measured: behaviour under a real 429 (would burn quota), image accuracy beyond these photos, the real-Gemini coordinator on many phrasings, any real user.

## Limits, stated plainly

- No accounts: identities are demo presets. No notifications. Single-server JSON store.
- Image understanding was spot-checked on a handful of photos, not measured.
- No real users, no exchange has happened outside the demo, and no environmental impact has been measured. Any "items kept in use" count is computed from the demo database.

## Attribution and AI disclosure

- Built during the hacking window with AI coding assistance: **Claude Code** (Claude Fable 5.1 for planning, specification and review; Claude Opus for implementation). AI wrote the code under my direction: I set the scope and the rules (human approval at every step, honest AI drafts, no identities), directed each change and design pass, and tested the flows myself, including the live iMessage path from my own phone. I have not reviewed every line; the server is about 2,500 lines across eight modules and I know what each one does. Pre-event research on the rules and past winners used OpenAI Codex/ChatGPT; no code came from it.
- The product calls **Google Gemini** (`gemini-3.5-flash-lite`) through the Gemini API, and **Photon Spectrum** (`spectrum-ts`) for iMessage on a shared line.
- **Express** (MIT), **spectrum-ts** (Photon). Fonts **Space Grotesk** and **JetBrains Mono** (SIL Open Font License), self-hosted.
- **Hairline** figures by Lucas Marques (MIT), vendored in `public/vendor/`.
- Seed photos from **Wikimedia Commons**, credited in `public/seed/ATTRIBUTION.md`.
- Design: a "poster, light" system — cream and ink, acid lime and coral as fills only, Space Grotesk and JetBrains Mono (both SIL OFL, self-hosted), hard offset shadows, sticker chips, a ticket-stub pickup code, a rubber-stamp "Kept in use", a schematic campus map, and the Knot mark (a single over-under line, built mathematically; see `brand/`). References studied along the way: Shupatto brand site by mount inc. (Awwwards Site of the Day, Feb 3 2024), motion.dev examples, the OpenAI and Claude marks for logo construction. Patterns were adapted, not copied; no assets were taken.
