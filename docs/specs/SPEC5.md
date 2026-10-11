# Loop — phase 5 contract: no identities (Sat Oct 10 2026, 16:25 EDT)

User rule: "No names at all. Simply a place for people to place what they have." Loop shows no names, nicknames, avatars, dorms or areas anywhere. A person is a device/session with an opaque id. In a handoff the two sides are "you", "the giver" and "the taker". Identity is proven only by the 4-digit code at the handoff.

## Data and API (Lane H, backend part)
- `people[]` keep opaque ids; `name` and `spot` are dropped from the public state (`GET /api/state` returns `{id, lang}` only; the server may keep internal fields but must never send names). Seed people have no names. The phone link `PHONE_<ID>` keeps working on ids (PHONE_ETHAN → id `ethan` stays as the demo phone's id; never shown).
- `POST /api/people` → creates an anonymous person `{id, lang:'en'}` (used by a new browser tab on first visit). Rate-limit trivially: max 50 people in the demo db; reset clears extras.
- All server-generated text replaces names with roles. Helper `who(db, personId, { viewer, thread })` → "you" when personId === viewer; otherwise "the giver" / "the taker" inside a thread; "someone" elsewhere. Templates:
  - Opening (no suggestion): "Someone reserved your {item}. You're the one handing it over, so you pick: when and where works for you?" (to the giver); "The giver will suggest a time and place; you can reply here too." (to the taker).
  - Opening (with suggestion): "Someone reserved your {item} and suggested {place}, {time}. Does that work?"
  - Proposal: "New suggestion from the {giver|taker}: {place}, {time}. Does that work for you?"
  - Set: "Pickup set: {place}, {time}. I'll remind you both 30 minutes before. Taker, tap 'I'm here' when you arrive."
  - Arrived: "The taker is at {place}. Ask for the 4-digit code and type it on the item page." (to the giver)
  - Done: "Handed over. Thanks, both — the {item} stays in use."
  - Conflict: "Someone got there first." / "The giver took this back."
  - Text flow (iMessage): "Hi — this is Loop. Text me a photo…", "…Someone nearby asked for a reading lamp 2 h ago — it fits. Reply YES to offer it, BOARD to post it for anyone…", "Offered. I'll tell you when they accept…"
- Coordinator prompt: refer to "the giver" and "the taker"; the speaker is given as a role; replies use roles ("The taker suggested… Giver, does that work?" → prefer "Does that work for you?" addressed to the reader; when both are addressed say "both").
- Translation prompt: no names to protect anymore; keep places/times/digits.
- iMessage forwards: prefix with "Loop:" or "Giver:"/"Taker:" (relative to the recipient: the other party is always the opposite role).
- Request cards carry no person data; items carry no person data; `ownerId`/`personId`/`recipientId` stay internal for permissions.
- Tests: update e2e suites to the new strings; add a test that `/api/state` contains no `name`/`spot` keys and that a fresh `POST /api/people` can reserve and chat.

## UI (Lane H, frontend part; B4's styling stays)
- Remove the person picker and the "You're X ▾" menu. First visit: `POST /api/people` → store the id in sessionStorage; show nothing about it. The top bar right side holds only the language control (a small globe button: English / 中文 / Español) and the "Text Loop · (773) 912-3997" line.
- Board: "People need" cards show title, details, time-ago, status chip; nothing else. Item cards: photo, title, condition, status. "Mine" is indicated only by a subtle "yours" chip on items/requests the session created.
- Give page: no "You'll appear as…" line. Replace with "Nothing identifies you. The pickup code proves it's you at the handoff."
- Thread: bubbles labelled "You", "Giver", "Taker", "Loop"; no avatars (use the role letter G/T/L in a plain disc). Plan card: "You agreed · Taker not yet" style using roles.
- Demo: two browser tabs are two anonymous sessions automatically; the phone is a third. For the video the operator says "this tab is the taker".
- Footer keeps "Reset demo" (which also forgets this tab's session id → new anonymous id on reload).

## Out of scope
Accounts, reputation, blocking, reporting (mention as next steps only).

## Framing (user, 16:30): "It's a platform for people to post stuff."
- The board leads with the stuff: "Up for grabs" grid first (photos), then "People need" below. Hero copy: title "Post what you don't need." subtitle "Someone nearby takes it. No names, no accounts." Primary button "Post something" (was "Give something"); secondary "Ask for something".
- Copy everywhere: "post" instead of "give" where it reads naturally ("Posted to the board", "Post it"), keep "giver/taker" as the thread roles.
