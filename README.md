# Loop

Photograph something you don't need. Loop finds who does and walks you both to the handoff.

Built solo at **HackNC 2026** (UNC–Chapel Hill, Oct 10–11, theme Frutiger Aero). Tracks: Beginner, Frutiger Aero, Best Community Hack, MLH Best Use of Gemini API.

## What it does

1. Someone posts a need in plain words: "Reading lamp for my desk".
2. An owner photographs an item. **Gemini drafts** the title, description and visible condition, and suggests at most one open request the item genuinely fits, with a one-sentence reason.
3. The owner checks and edits the draft, then **offers it** to that person or posts it to the board. The draft is marked "Drafted by Gemini — check it" until a person approves it.
4. The recipient accepts, picks a pickup place and time, and gets a **4-digit pickup code**.
5. At pickup the owner types the code. Only then does the item become **Collected** and the request **Fulfilled**.

Gemini never publishes, reserves, contacts anyone, or marks anything collected. A person taps every state change. When Gemini can't identify the object, is rate-limited, or times out, the owner sees a plain explanation and fills the form in by hand.

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
```

Two people = two browser tabs (each tab picks its own person; identity lives in `sessionStorage`). "Reset demo" in the footer, or `npm run seed`, restores the seed data.

Other commands:

```bash
npm run seed                    # reset data/ to the seed state
npm run e2e                     # scripted full loop ×3 with GEMINI_MOCK=1 (no quota used)
npm run photo-test -- path.jpg  # one real Gemini call with a real photo; prints latency, tokens, draft
GEMINI_MOCK=1 npm start         # canned drafts, no network; the UI shows a "Demo mode" banner
```

## How it works

```
phone/laptop photo ─► client resizes to ≤1024px JPEG ─► POST /api/items/draft
   server stores photo ─► Gemini generateContent (image + open requests + JSON schema)
   server validates: known request ids only, string clamps, blocked categories
   ─► editable draft in the browser ─► owner publishes or offers
   ─► recipient reserves (server issues the code) ─► owner confirms with code
   ─► item: collected, request: fulfilled
```

- `server/index.mjs` — Express routes, boundary validation, JSON errors.
- `server/store.mjs` — JSON-file store with atomic writes; pure transition functions enforce the state machine (`available → reserved → collected`, plus `offered` and `withdrawn`). Illegal moves return 409 (already claimed) or 403 (wrong code).
- `server/gemini.mjs` — the two Gemini calls (describe a photo, suggest items for a need), timeouts, retries, hallucination guard, and the mock path.
- `public/` — plain HTML/CSS/JS, no framework, no build step: hash routes, one `render()` from state, polling for live updates, View Transitions, `prefers-reduced-motion` respected.

Design notes and references are in [DESIGN.md](DESIGN.md). The build contract is [SPEC.md](SPEC.md).

## Verification

[Fill from the hand-back: Gemini request variant that worked; two real-photo results (latency, tokens, match/no-match); three consecutive e2e runs; bad-input checks.]

## Limits, stated plainly

- No accounts: identities are demo presets. No notifications. Single-server JSON store.
- Image understanding was spot-checked on a handful of photos, not measured.
- No real users, no exchange has happened outside the demo, and no environmental impact has been measured. Any "items kept in use" count is computed from the demo database.

## Attribution and AI disclosure

- Built during the hacking window with AI coding assistance: **Claude Code** (Claude Fable 5.1 for planning and review, Claude Opus 5.5 for implementation), with every file reviewed and tested by the participant. Earlier event research used ChatGPT/Codex.
- The product calls **Google Gemini** (`gemini-3.5-flash-lite`) through the Gemini API.
- **Express** (MIT). **Nunito** font (SIL Open Font License), self-hosted.
- Seed photos from **Wikimedia Commons**, credited in `public/seed/ATTRIBUTION.md`.
- Design references: Shupatto brand site by mount inc. (Awwwards Site of the Day, Feb 3 2024), Ocean Lovers Guide to Compost (Awwwards Honorable Mention, May 16 2025), motion.dev examples. Patterns were adapted, not copied; no assets were taken from those sites.
