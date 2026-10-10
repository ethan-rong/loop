# Loop — the two-minute film (script v2, Sat Oct 10, ~19:40 EDT)

Target: under 2:00, judged on Application/Impact, Functionality, Creativity, Technical Complexity, Presentation. The film tells one object's story and lets the product's restraint be the point. No invented numbers, no names, real timestamps on screen.

## Setup for the take (30 min before recording)
- Laptop: `cd ~/loop && npm run seed && npm start`. Two Chrome windows side by side, each half the screen, zoom 100 %, both at `http://localhost:3000` (LEFT = the giver, RIGHT = the taker; they become separate anonymous sessions by themselves).
- Phone: Messages thread with Loop (773) 912-3997, mirrored to the Mac with QuickTime (File → New Movie Recording → camera = iPhone), shown only for the 1:28 beat. Record the whole screen with Cmd+Shift+5 at 1080p.
- Photos: the lamp photo for the web beat is `~/loop/public/seed/lamp.jpg` (or your own); the pile is `public/seed/pile.jpg`; the phone beat uses a photo you take of any object on the desk.
- Voice-over: record separately afterwards in Voice Memos or QuickTime audio, calm and unhurried, then lay it over the cut. Captions carry every key line so it also works muted.
- Cut in iMovie/CapCut. Hard cuts only. Each shot ≥ 2 s. Mono captions in ink on cream, lime highlight on the one phrase per shot that matters.

## Script (web first; the phone is the twist)

Stage: two Chrome windows side by side at half width each. LEFT = **the giver**, RIGHT = **the taker**. Both are anonymous tabs; nothing to pick. The phone appears only in the 1:30 beat.

| Time | Picture | Voice-over | Caption (lime phrase in **bold**) |
|---|---|---|---|
| 0:00–0:07 | Cream card, ink type, no UI yet. | "Every move-out, working lamps and chargers go into the dumpster. Someone down the hall is about to buy the same thing. Listings don't fix that; most of them stop at 'posted'." | Listings stop at **posted**. |
| 0:07–0:11 | Knot draws in, "Loop", one line. | "Loop finishes the loop." | **A place to post what you have.** No names, no accounts. |
| 0:11–0:19 | RIGHT: Ask for something → "Reading lamp for my desk" → Post. The board shows it under PEOPLE NEED. | "It starts with a need, not a sale. Someone on campus asks for a reading lamp. That is all Loop knows about them." | **Asked just now** · Reading lamp for my desk |
| 0:19–0:38 | LEFT: Post something → choose the lamp photo → the draft card fills in ("Drafted by Gemini — check it") → the match card: "Fits someone's request: Reading lamp for my desk" with the reason. | "The giver posts a photo. Gemini drafts the listing and notices who asked for exactly this. It only drafts: the giver fixes the condition, taps Looks right, and offers it." | Gemini **drafts**. A person **decides**. |
| 0:38–0:42 | LEFT: tap Fair → Looks right → Offer to them. | — | **Offer to them** |
| 0:42–0:52 | RIGHT: the For you row → Accept & reserve, left blank → the ticket with the four digits. | "The taker accepts and leaves the pickup blank on purpose. The two of them have never met and will never know each other's names." | The ticket is the **only identity** that matters. |
| 0:52–1:12 | LEFT: Loop's card "Someone reserved your… you pick" → Suggest a time and place → tap Davis Library on the map, Tomorrow noon → Suggest to the taker. RIGHT: "The giver suggested Davis Library lobby at noon tomorrow. Does that work for you?" → Works for me → plan card SET, map with the MEET sticker, "I'll remind you both 30 minutes before." | "Now Loop is the third voice in the chat. It asks the giver first, because the giver is doing the favour. A tap or a typed sentence becomes a proposal; the other side confirms; Loop reminds both later. It proposes. It never decides for anyone." | Loop **proposes**. People **confirm**. |
| 1:12–1:28 | RIGHT: I'm here. LEFT: "The taker is at Davis Library lobby. Ask for the 4-digit code…" → types the four digits → Confirm handoff → COLLECTED, the KEPT IN USE stamp. | "At the library the taker shows four digits; the giver types them. That is the whole handshake, and it is the only moment that proves anything." | **KEPT IN USE** |
| 1:28–1:46 | Phone mirrored on screen: a photo of a second object texted to Loop → the draft reply with "Someone nearby asked for…" or "No open request fits yet. Reply BOARD…" → tap 👎 on Loop's reply (its last line reads "👍 YES · 👎 BOARD"; a tapback is the answer) → "Posted to the board." LEFT window: the item appears under INVENTORY. | "And if you never open the app: text a photo to Loop. Same draft, same honesty, same handoff. Every question Loop asks ends with a thumbs-up or thumbs-down you can tap, and the four digits can be texted too." | **No app needed.** Text a photo. |
| 1:46–1:55 | LEFT: Post something → A pile → the yard-sale photo → six outlined items, one matched, five "No open request fits". Then a thread line "I can't share phone numbers or the pickup code." | "The honest parts are the point: one photo becomes six listings, Gemini says when nothing fits, and Loop says no when it should. Node and plain JavaScript, Gemini 3.5 Flash-Lite behind JSON schemas, Photon Spectrum for iMessage." | Gemini says **no match** when there is none. |
| 1:55–2:00 | End card: Knot, "Loop", "Post what you don't need.", GitHub URL, the number. | "Loop." | **Post what you don't need.** |

About 250 words of voice-over at a calm pace = 1:50. Leave air; cut words, not steps.

### How the web is used, in one breath (for judges who ask)
Post (one photo or a pile) → Gemini drafts and matches → offer or post → someone reserves and gets a ticket → the thread with Loop settles when and where, map included → the giver types the four digits → collected. Ask for something is the other entrance. iMessage is the same loop without the app.

## Rules for the take
- Say a time that is still in the future when you record; a past time gets no reminder sentence ("I'll remind you both 30 minutes before" only appears when the time is ahead).
- Real time in the UI is fine; don't fake timestamps.
- If Gemini takes longer than 5 s on the photo, keep rolling; cut the wait in the edit.
- If a text doesn't arrive within 10 s, re-send once; otherwise cut around it and say so in the README's limits.
- Do not show the phone number of the giver or any notification from other apps: Do Not Disturb on, Messages only.
- No music, or a single quiet pulse under the VO. Silence reads as confidence here.

## Checklist before upload
- [ ] Under 2:00 (check the exported file, not the timeline).
- [ ] Captions legible on a phone.
- [ ] GitHub link on the end card matches the Devpost link.
- [ ] Uploaded unlisted to YouTube; link pasted into the Devpost draft; draft saved.
