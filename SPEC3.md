# Loop — phase 3 contract: Loop lives in iMessage (Sat Oct 10 2026, 15:45 EDT)

Phase 1 (web loop) and phase 2 (threads + coordinator + pile + env-gated iMessage channel) are built. Phase 3 makes **iMessage a first-class way to use Loop, with no app install**: a student texts a photo to Loop's number and the whole give-away runs in the thread. The web app stays the board and the recipient side for the demo.

Facts: Photon project "HackNC" (Free plan, shared line). Allowed targets = people on the dashboard Users page (10 seats). Ethan's phone is added (`PHONE_ETHAN` in `.env.local`; the same number was `PHONE_JERRY` during phase 2 — Lane F renames the link to the `ethan` persona, keeping `PHONE_JERRY` working if still present but preferring `PHONE_ETHAN`). The shared line's number is shown on the Users page ("Texts on"). Inbound and outbound go through `server/channels/spectrum.mjs` (`startChannel({onInbound})`, `sendToPerson`). SDK: `spectrum-ts` 12.x; inbound iterates `app.messages` yielding `[space, message]`; message content has `text` and, for photos, an attachment (check `message.type`/`content.attachments`/`attachment` in the SDK types under `node_modules/spectrum-ts` — find the real field and the download method; the marketing page shows `message.type === "attachment"`).

File ownership: Lane F owns `server/textflow.mjs` (new), `server/channels/spectrum.mjs`, `server/index.mjs` (wiring only), `scripts/e2e-textflow.mjs` (new), `server/seed.mjs` (only to add `phoneLinked` display data if needed). Lane D (frontend, running) owns `public/**` — do not touch. Lane F may add small pure helpers to `server/store.mjs` only if they do not change existing signatures.

## 1. Text-a-photo giving (server/textflow.mjs)

A per-phone conversation state machine, persisted in db.json under `textSessions: { "<personId>": { state, photoId, draft, matchRequestId, updatedAt } }`.

| State | Inbound | Loop replies (iMessage, plain words, ≤ 2 short sentences each) | Next |
|---|---|---|---|
| idle | photo attachment | "Got it — looking at your photo…" then, after `describeItem` with the open requests: "**Blue adjustable desk lamp** · good · Blue metal desk lamp with an adjustable arm. Jerry (Ehringhaus) asked for a reading lamp 2 h ago — it fits. Reply **YES** to offer it to Jerry, **BOARD** to post it for anyone, or type a correction (e.g. 'condition fair, dent on base')." If no match: "…No open request fits yet. Reply **BOARD** to post it, or type a correction." If `identified:false`/`notAllowed`/`aiError`: the plain explanation + "Send another photo when you're ready." | drafting (or idle on failure) |
| drafting | YES | creates the item with `offerToRequestId` → "Offered to Jerry. I'll tell you when Jerry accepts and we'll sort out the pickup here." | offered |
| drafting | BOARD | creates the item available → "Posted to the board. I'll text you when someone reserves it." | posted |
| drafting | any other text | run `coordinateDraft` (Gemini, text-only): apply the correction to the draft (title/description/condition/conditionNotes) → reply with the updated one-line draft + the same YES/BOARD prompt. Mock: "condition (good|fair|worn)" sets condition; "title: …" sets title; else appends the text to conditionNotes. | drafting |
| drafting | photo | restart from idle with the new photo | drafting |
| offered/posted | (thread events) | the existing thread coordinator takes over: the opening message, proposals, reminders, "I'm here", etc. are already forwarded to linked phones by phase 2 | — |
| any | "HELP" / unknown with no photo in idle | "Text me a photo of something you don't need and I'll draft the listing. Reply STOP to unlink." | same |

Rules: Loop never publishes without YES/BOARD; the draft shown by text is the same cleaned draft the web app would show; the photo is stored with `POST /api/photos`-equivalent logic (write `data/photos/<id>.jpg`, same magic-byte checks, max 6 MB; download the attachment via the SDK, convert HEIC to JPEG if the SDK delivers HEIC — if conversion isn't available in Node without a dependency, ask Spectrum for JPEG or reject HEIC with "Please send it as a JPEG/PNG (Settings → Camera → Formats → Most Compatible)"). Items created by text carry `source: "imessage"` and the web board shows the existing "iMessage" tag on them (Lane D reads `item.source`).

## 2. Owner-side handoff by text

The thread coordinator already forwards Loop/other-party messages to linked phones and routes replies. Add two owner-by-text abilities:
- When the thread reaches `meeting` (recipient tapped "I'm here"), Loop texts the owner: "Jerry is at Davis Library lobby. Ask Jerry for the 4-digit code and text it to me." A 4-digit reply from the owner's number is treated as `confirmItem(code)` → on success Loop texts both: "Handed over. Thanks, both — the lamp stays in use." (`collected` state in the web app updates by polling). Wrong code → "That code doesn't match. Ask Jerry to show the code on their screen."
- When a recipient reserves an item posted by text, Loop texts the owner the opening message exactly as the web thread (already built) — verify end to end.

## 3. Proactive connector (small)

When an item is posted to the board (no offer) and its draft matched an open request, Loop texts that requester, if linked: "Ethan just posted a blue desk lamp that fits your request for a reading lamp. Reply YES to reserve it, or ignore this." YES from that number → `reserveItem` (no place/time) → the normal thread starts. Never text unlinked people; never text more than once per item per person.

## 4. Health, tests, safety

- `/api/health` adds `lineNumber` (the shared line number, if the SDK exposes it; else null) and `textSessions` count.
- `scripts/e2e-textflow.mjs`: drives `textflow.handleInbound({personId, text?, photoBuffer?})` directly (no Spectrum, GEMINI_MOCK=1) through: photo → draft reply → correction → YES → offered item exists; photo → BOARD → posted; posted item reserved on the web → owner texts wrong code (403 message) → right code → collected; proactive YES → reserved. 3× PASS.
- Live check (Fable, with Ethan): send one real photo from the phone to the line; expect the draft reply within ~5 s.
- Rate limits: each photo = one Gemini call; corrections = one call each; keep the demo under 10 calls.
- Plain words, no exclamation marks, never include the pickup code in a message to the owner, never share phone numbers, STOP unlinks (sets `people[].phone = null` in memory only; env stays).
