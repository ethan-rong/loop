# Loop — build contract (v1, Sat Oct 10 2026, 12:15 EDT)

Loop helps students pass usable belongings to people who need them. A photo becomes a
reviewed offer, a relevant request, a reservation with a pickup code, and a confirmed handoff.
Hackathon: HackNC 2026 (theme Frutiger Aero). Solo entrant. Deadline Sun Oct 11 10:00 EDT.
Tracks: Beginner, Frutiger Aero, Best Community Hack, MLH Best Use of Gemini API.

Scope is ONE complete loop: one owner, one recipient, one item, one need, one confirmed handoff.
Everything not listed here is out of scope. Do not add features.

## Non‑negotiables

- AI outputs are suggestions. Gemini never publishes, reserves, contacts anyone, or marks collected. A human taps every state change.
- The Gemini key stays server-side. Never print it, log it, echo it, commit it, or send it to the browser.
- Loading `.env.local`: the server loads `./.env.local` if present, else the file at
  `/Users/ethan/Documents/Codex/2026-10-10/go-into-hacknc-look-through-everything/.env.local`
  (variables `GEMINI_API_KEY`, `GEMINI_MODEL`; model is `gemini-3.5-flash-lite`). Parse `KEY=VALUE` lines yourself (10 lines, no dotenv dep). Do NOT `cat`/`cp`/`open` that file in a shell command; only the Node process reads it.
- Quota observed: 15 requests/min, 500/day. `GEMINI_MOCK=1` must make the server return a fixed draft/match without calling Gemini. All automated tests run with `GEMINI_MOCK=1`. Only `scripts/photo-test.mjs` and the live demo use real calls.
- No invented impact numbers. The only count shown is computed from real DB state (items with status `collected`).
- No git commits from builders. Ethan/Fable commits.
- Plain words in UI copy. No jargon ("leverage", "seamless", "AI-powered"). Say "Gemini drafted this" not "AI magic".

## Stack

- Node 22 (`node:fs`, `node:crypto`), Express (only runtime dependency). ESM (`.mjs`).
- Frontend: vanilla HTML/CSS/JS in `public/`, no build step, no frameworks. Hash routing. One `render()` from state.
- Persistence: `data/db.json` (atomic write: write temp then rename). Photos: `data/photos/<id>.jpg` served at `/photos/<id>.jpg`.
- Env: `PORT` (default 3000), `DATA_DIR` (default `./data`), `GEMINI_MOCK` (`1` = no network), `GEMINI_MODEL`, `GEMINI_API_KEY`.

## Repo layout

```
loop/
  package.json            scripts: start, dev (same as start), seed, e2e, photo-test
  server/index.mjs        Express app: static, JSON API, error handling
  server/store.mjs        load/save db.json; pure mutation functions that return a new state (no in-place mutation)
  server/gemini.mjs       describeItem({jpegBase64, openRequests}) and suggestItems({request, availableItems}); mock path
  server/seed.mjs         resetToSeed(dataDir): writes seed db + copies public/seed photos into data/photos
  scripts/photo-test.mjs  real Gemini call with a real photo (the spike)
  scripts/e2e.mjs         API-level full loop, run 3x, GEMINI_MOCK=1
  public/index.html public/app.js public/styles.css public/seed/*.jpg public/seed/ATTRIBUTION.md
  SPEC.md DESIGN.md README.md
```

## Data model (db.json)

```json
{
  "version": 12,
  "people": [
    {"id": "maya",  "name": "Maya Chen",   "spot": "Hinton James"},
    {"id": "sam",   "name": "Sam Rivera",  "spot": "Ehringhaus"},
    {"id": "priya", "name": "Priya Nair",  "spot": "Granville Towers"}
  ],
  "requests": [
    {"id": "r_ab12", "personId": "sam", "title": "Reading lamp for my desk", "details": "Anything that clips or stands. My room light is awful.", "status": "open", "matchedItemId": null, "createdAt": "2026-10-10T15:00:00Z"}
  ],
  "items": [
    {"id": "i_cd34", "ownerId": "maya", "photo": "/photos/i_cd34.jpg",
     "title": "Black adjustable desk lamp", "description": "Bendy neck, works, small dent on the base.",
     "condition": "good", "category": "lighting",
     "aiDraft": {"title": "...", "description": "...", "condition": "good", "category": "lighting", "conditionNotes": "...", "match": {"requestId": "r_ab12", "reason": "..."}},
     "status": "available", "offeredToRequestId": null,
     "reservation": null, "collectedAt": null, "createdAt": "2026-10-10T15:10:00Z"}
  ]
}
```

`version` increments on every mutation (frontend polls and re-renders only when it changes).

### States

Item `status`: `available` → `reserved` → `collected`. Also `offered` (owner offered it to one specific request; only that requester may accept) and `withdrawn` (owner pulled it). Transitions:

| From | Action | By | To |
|---|---|---|---|
| (new) | create without `offerToRequestId` | owner | `available` |
| (new) | create with `offerToRequestId` | owner | `offered`; request → `matched` |
| `available` | reserve | anyone but owner | `reserved` (reservation set, 4‑digit code) |
| `offered` | accept (reserve) | the requester only | `reserved`; request stays `matched` |
| `offered` | decline | the requester | `available`; request → `open` |
| `reserved` | release | recipient or owner | `available`; linked request → `open` |
| `reserved` | confirm with correct code | owner | `collected`; linked request → `fulfilled` |
| `available`/`offered` | withdraw | owner | `withdrawn`; linked request → `open` |

Request `status`: `open` → `matched` (an item is offered/reserved for it) → `fulfilled` (that item collected). `closed` when the requester removes it.

Reservation object: `{"personId": "sam", "requestId": "r_ab12" | null, "place": "Davis Library lobby", "time": "Today 5:00 pm", "code": "4821", "at": "ISO"}`. Code: 4 digits from `crypto.randomInt(0, 10000)` padded, never `0000`. Returned to everyone in `/api/state` (demo app, no auth) but the UI shows it only to the recipient; the owner types it.

Conflict rule: reserve/accept on an item that is not `available`/`offered` to you → HTTP 409 `{error: "already_claimed", message: "Sam got there first."}`. Wrong code → HTTP 403 `{error: "wrong_code", message: "That code doesn't match. Ask Sam to show the code on their screen."}`.

## API (JSON; errors are `{error: <snake_code>, message: <plain sentence>}`)

| Method, path | Body | Returns |
|---|---|---|
| `GET /api/state` | — | whole db (`people`, `requests`, `items`, `version`) |
| `POST /api/requests` | `{personId, title, details}` | `{request, suggestions: [{itemId, reason}], aiError: null \| string}` — suggestions come from Gemini over currently `available` items (text-only call); empty array if none available or AI failed |
| `DELETE /api/requests/:id` | `{personId}` | request with status `closed` |
| `POST /api/items/draft` | `{ownerId, imageBase64, mimeType}` | `{photoId, photo: "/photos/<id>.jpg", draft, aiError: null \| string}` — stores the photo immediately, nothing published. `draft` is null when AI failed (UI falls back to a manual form). |
| `POST /api/items` | `{ownerId, photoId, title, description, condition, category, aiDraft, offerToRequestId?}` | item |
| `POST /api/items/:id/reserve` | `{personId, requestId?, place, time}` | item (409 on conflict) |
| `POST /api/items/:id/decline` | `{personId}` | item (offered → available) |
| `POST /api/items/:id/release` | `{personId}` | item (reserved → available) |
| `POST /api/items/:id/confirm` | `{personId, code}` | item (403 wrong code; 409 if not reserved) |
| `POST /api/items/:id/withdraw` | `{personId}` | item |
| `POST /api/reset` | — | fresh seed state (used between judges; also `npm run seed`) |

Validation at the boundary: every body field type-checked; unknown `personId`/`requestId`/`itemId` → 404; title ≤ 60 chars, description ≤ 240, details ≤ 240, place ≤ 60, time ≤ 40; `imageBase64` ≤ 6 MB decoded, mimeType in `image/jpeg|image/png|image/webp`. Express JSON limit 8mb. Server never crashes on bad input (central error handler → 400/500 JSON).

## Gemini (server/gemini.mjs)

Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, header `x-goog-api-key`. Timeout 20 s (AbortController). One retry on network error / 5xx. 429 → `aiError: "rate_limited"`. Timeout → `aiError: "timeout"`. Parse failure → `aiError: "bad_json"`. Never throw to the route; return `{draft: null, aiError}`.

Request body (verify in the spike; adapt if the API rejects a field):

```json
{
  "contents": [{"role": "user", "parts": [
    {"text": "<prompt>"},
    {"inline_data": {"mime_type": "image/jpeg", "data": "<base64>"}}
  ]}],
  "generationConfig": {
    "temperature": 0.2,
    "responseMimeType": "application/json",
    "responseSchema": { ...schema below... }
  }
}
```

If `responseSchema` is rejected for this model, try `responseJsonSchema`; if that fails, drop the schema, keep `responseMimeType: application/json`, and validate the parsed JSON yourself. Record which variant worked in a comment at the top of gemini.mjs.

Draft schema (OpenAPI-style for `responseSchema`):

```
identified: boolean          // false if no single give-away object is clearly visible
title: string                // ≤ 40 chars, plain, e.g. "Black adjustable desk lamp"
description: string          // ≤ 200 chars, plain words, only what is visible
condition: enum good|fair|worn|unknown
conditionNotes: string       // visible wear, missing parts; "" if none. Never claim it works unless visibly obvious.
category: enum furniture|lighting|kitchen|textbooks|electronics|clothing|bedding|sports|other
notAllowed: string|null      // non-null if food, medicine, weapons, or something unsafe to pass on
match: { requestId: string|null, reason: string }   // at most one open request this item genuinely satisfies; otherwise null + one plain sentence why not
```

Prompt (describeItem): system-style text in the user turn. Must say: campus give-away app; describe only what is visible; be honest about condition; do not invent brand or whether it works; here are the open requests as `id — title — details`; pick at most one the item genuinely satisfies, else null; plain words, no exclamation marks. After parsing: if `match.requestId` is not in the provided open-request IDs → set to null (hallucination guard). Clamp string lengths.

suggestItems(request, availableItems): text-only call, same style; returns `[{itemId, reason}]` (max 2); filter to known IDs.

Mock (`GEMINI_MOCK=1`): return a deterministic draft (desk lamp, condition good, match = the first open request whose title contains "lamp" else null) after a 300 ms delay; suggestItems mock → first available item whose title shares a word with the request title.

## Frontend (public/)

Mobile-first; content max-width 520px centered; must look right at 390px wide and inside a ~50%-width laptop window (the two-person demo is two browser windows side by side). Also fine at 1280px.

Identity: `sessionStorage['loop.person']` (per tab, so two tabs are two people). Top bar: "You're **Maya** ▾" → menu with the three presets. First visit → pick-a-person screen.

Hash routes:

- `#/` Board. Two sections: **People need** (open/matched requests: name, spot, title, details, time-ago, chip) and **Up for grabs** (items not withdrawn/collected: photo, title, condition chip, status chip). Items `offered` to me render first with a highlighted banner "Maya offered you this". Primary buttons: **Give something** and **Ask for something**. Small footer line: "N items kept in use" (count of `collected`, hidden when 0) · "Reset demo".
- `#/give` Give flow. 1) big capture/drop zone (`<input type=file accept="image/*" capture="environment">`); 2) on select, show the photo immediately, resize client-side to max 1024px JPEG q0.85 (canvas) before upload, show shimmer "Gemini is looking at your photo…"; after 8 s add "Taking longer than usual…"; 3) draft card: fields prefilled from draft, each editable (title input, description textarea, condition chips good/fair/worn, category select). Label the card "Drafted by Gemini — check it" with a dashed border; once the owner edits/approves it becomes solid "Checked by Maya". 4) Match card when `match.requestId`: "Fits **Sam**'s request: *Reading lamp for my desk*" + reason + buttons **Offer to Sam** / **Post to board instead**. When null: "No open request fits yet." + **Post to board**. 5) `aiError` or `identified:false` or `notAllowed`: plain explanation + the same form empty for manual entry (+ Retry when rate_limited/timeout). `notAllowed` blocks publishing with the reason.
- `#/item/:id` Detail. Photo hero, title, condition chip, description, "from Maya · Hinton James", status timeline (Posted → Reserved → Collected, current step highlighted). Action area by role × status:
  - not owner, `available` → **Reserve** → inline form: place (text + quick picks "Davis Library lobby", "Student Union", "Dorm front desk"), time (quick picks "Today 5 pm", "Today 8 pm", "Tomorrow noon" or free text) → **Reserve** → shows pickup code large: "Show this code to Maya at pickup".
  - requester of an `offered` item → **Accept & reserve** (same form) / **No thanks**.
  - recipient, `reserved` → code, place, time, **Cancel reservation**.
  - owner, `reserved` → "Reserved by Sam · Davis Library lobby · Today 5 pm", 4-digit code input, **Confirm handoff**, **Release**. Wrong code → inline message, input shakes (no shake under reduced motion).
  - `collected` → "Collected by Sam · Oct 10, 5:12 pm", green check, short restrained success animation once.
  - `offered` to someone else → "Offered to Sam" (no actions for others). `withdrawn` → "Maya took this back".
  - someone else reserved while I was looking → on 409 show "Sam got there first." and refresh.
- `#/ask` Need form: title, details, spot auto from person → **Post** → shows suggestions if any ("Maya's *Black adjustable desk lamp* might fit — View") else "Posted. You'll see it on the board; owners get your request when they photograph something."

Polling: `GET /api/state` every 1500 ms; re-render only if `version` changed and no text field in the current view has focus. Optimistic nothing: always render from server state after a mutation.

Every state has copy: uploading, drafting, no match, AI failed, available, offered, reserved, already claimed, collected, withdrawn, network error ("Can't reach Loop. Retrying…").

### Design system (see DESIGN.md for references)

Frutiger Aero, restrained: optimistic, airy, tactile. Not a toy.

- Background: `linear-gradient(180deg, #dff1ff 0%, #f3f9ff 45%, #e8f7ee 100%)` fixed; one soft blurred "sun" radial highlight top-left (`radial-gradient(circle at 20% 0%, rgba(255,255,255,.9), transparent 45%)`); optional two very faint bubbles (CSS only, `prefers-reduced-motion` → static).
- Glass card: `background: rgba(255,255,255,.62); backdrop-filter: blur(14px) saturate(140%); border: 1px solid rgba(255,255,255,.8); box-shadow: 0 10px 30px rgba(20,80,140,.10), inset 0 1px 0 rgba(255,255,255,.9); border-radius: 20px`.
- Text: `#0b2a4a` primary, `#3d5a78` secondary. Fonts: **Nunito** (self-hosted woff2 in `public/fonts/`, OFL) 500/700/800, fallback `system-ui`. Sizes: 28/22/17/15/13.
- Accent aqua `#1b8fe6` (buttons, links), deep `#0d6fc0` hover; green `#2fbf71` for collected/fulfilled; amber `#f0a31a` for reserved; chips use tinted backgrounds (`rgba(accent,.14)`) + dark text, contrast ≥ 4.5:1.
- Gloss button: pill, `background: linear-gradient(180deg, #4fb0ff 0%, #1b8fe6 55%, #1480d8 100%)`, inner top highlight `inset 0 1px 0 rgba(255,255,255,.55)`, white text 700, min-height 44px; secondary = glass pill with aqua text. Focus ring `0 0 0 3px rgba(27,143,230,.45)` always visible on `:focus-visible`.
- Status chips: Available (aqua), Offered (violet `#7b61ff` tint), Reserved (amber), Collected (green), Open need (sky), Fulfilled (green).
- AI vs human: Gemini draft = dashed `1.5px` aqua border + small sparkle icon + label "Drafted by Gemini — check it". Human-checked = solid border + "Checked by Maya".
- Motion: `document.startViewTransition` for route changes when available (fallback: 180 ms fade/translate); chips and buttons 150–200 ms ease-out; reserve → code reveal 250 ms scale-in; collected → one 600 ms soft ripple. `@media (prefers-reduced-motion: reduce)` disables all non-essential motion.
- Accessibility: semantic buttons/labels, `aria-live="polite"` region for status messages, touch targets ≥ 44px, no color-only state (chips carry text), keyboard reachable.

## Seed

Three people above. Requests: Sam "Reading lamp for my desk"; Priya "Winter coat, size M-ish"; Maya "Mini fridge for a double". Items: Priya offers "Intro to Psychology textbook (8th ed.)" (available); Sam offers "Small desk fan" (available). Photos: `public/seed/*.jpg`, sourced from Wikimedia Commons (prefer CC0/Public Domain/CC‑BY; record file page URL, author, license in `public/seed/ATTRIBUTION.md`), ≤ 1024px, re-encoded JPEG. If the Commons fetch fails, use solid-color placeholder JPEGs and say so in ATTRIBUTION.md.

## Verification required before hand-back

- `scripts/photo-test.mjs <path.jpg>`: real call; prints latency, token usage, the parsed draft; asserts `identified === true`, valid `condition`, `match.requestId ∈ provided ids ∪ {null}`. Run it twice with two different photos (a lamp-like object and something unrelated to all requests, expecting `match.requestId === null`).
- `scripts/e2e.mjs` (GEMINI_MOCK=1, PORT=3100, DATA_DIR=.tmp-e2e): reset → post need → draft (seed photo) → create item offered to that need → accept/reserve → wrong code (403) → correct code → item collected + request fulfilled → second reserve attempt on a collected item (409). Loop 3× and print PASS/FAIL per run.
- Bad input: malformed JSON, missing fields, 7 MB image → 400, server stays up.
- Report back: exact commands run, outputs (truncated), which Gemini request variant worked, latencies, anything deviating from this contract.
