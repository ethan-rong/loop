# Loop — the two-minute film (script v2, Sat Oct 10, ~19:40 EDT)

Target: under 2:00, judged on Application/Impact, Functionality, Creativity, Technical Complexity, Presentation. The film tells one object's story and lets the product's restraint be the point. No invented numbers, no names, real timestamps on screen.

## Setup for the take (30 min before recording)
- Laptop: `cd ~/loop && npm run seed && npm start`. Chrome window at half the screen width, zoom 100 %, at `http://localhost:3000` (this tab is **the taker**). Second Chrome window (giver's web view) only for the closing board shot.
- Phone: Messages thread with Loop (773) 912-3997, mirrored to the Mac with QuickTime (File → New Movie Recording → camera = iPhone) so both the phone and the browser record in one screen capture (Cmd+Shift+5, record the whole screen, 1080p). The phone is **the giver**.
- Real object on the desk: a lamp (or anything; say its name instead of "lamp" in the VO). Photograph it with the phone during the take.
- Voice-over: record separately afterwards in Voice Memos or QuickTime audio, calm and unhurried, then lay it over the cut. Captions carry every key line so it also works muted.
- Cut in iMovie/CapCut. Hard cuts only. Each shot ≥ 2 s. Mono captions in ink on cream, lime highlight on the one phrase per shot that matters.

## Script

| Time | Picture | Voice-over | Caption (lime phrase in **bold**) |
|---|---|---|---|
| 0:00–0:07 | Cream card, ink type, no UI yet. | "Every move-out, working lamps and chargers go into the dumpster. Someone down the hall is about to buy the same thing. Listings don't fix that; most of them stop at 'posted'." | Listings stop at **posted**. |
| 0:07–0:11 | Knot mark draws in, "Loop" wordmark, one line under it. | "Loop finishes the loop." | **A place to post what you have.** No names, no accounts. |
| 0:11–0:20 | Taker tab: "Ask for something" → types "Reading lamp for my desk" → Post. | "It starts with a need, not a sale. Someone on campus asks for a reading lamp. That's all Loop knows about them." | **Asked 1 min ago** · Reading lamp for my desk |
| 0:20–0:38 | Phone: photo of the lamp sent to Loop; the reply appears with the draft and "Someone nearby asked for "Reading lamp for my desk" — it fits. Reply YES…". | "The giver doesn't install anything. They text a photo. Gemini drafts the listing and notices who asked for it. It only drafts: the giver fixes the condition, and the giver says yes." | Gemini **drafts**. A person **decides**. |
| 0:38–0:43 | Phone: "condition fair, dent on base" → updated draft → YES → "Offered." | — | **YES** |
| 0:43–0:52 | Taker tab: the For you row → Accept & reserve, left blank → the ticket with the code. | "The taker accepts and leaves the pickup blank on purpose. The two of them have never met and never will know each other's names." | The ticket is the **only identity** that matters. |
| 0:52–1:12 | Phone: "Someone reserved your … You're the one handing it over, so you pick." → giver texts "6 pm at Davis Library" → taker tab shows "New suggestion from the giver: Davis Library lobby, Today 6 pm. Does that work for you?" → Works for me → plan card SET with the map and the MEET sticker. | "Now Loop is the third voice in the chat. It asks the giver first, because the giver is the one doing the favour. It turns a text into a proposal, asks the other side, and reminds both of them later. It proposes. It never decides for anyone." | Loop **proposes**. People **confirm**. |
| 1:12–1:30 | Taker: I'm here → phone: "Loop: The taker is at Davis Library lobby. Ask for the 4-digit code and text it to me." → giver texts the four digits → COLLECTED, the KEPT IN USE stamp. | "At the library, the taker shows four digits. The giver texts them to Loop. That is the whole handshake, and it's the only moment that proves anything." | **KEPT IN USE** |
| 1:30–1:46 | Quick cuts, 3 s each: (a) the pile photo → six outlined items, one matched, five "No open request fits"; (b) a thread line "I can't share phone numbers or the pickup code."; (c) the draft card "Drafted by Gemini — check it". | "The honest parts are the point. One photo of a pile becomes six listings, and Gemini says when nothing fits. Ask Loop for a number or the code, and it says no." | Gemini says **no match** when there is none. |
| 1:46–1:55 | Board: "Up for grabs", one item kept in use, then the footer line with the number. | "Node and plain JavaScript. Gemini 3.5 Flash-Lite behind JSON schemas for every draft and every decision. Photon's Spectrum for iMessage. The server validates everything; a person approves every step." | Built in a day at HackNC. |
| 1:55–2:00 | End card: Knot, "Loop", "Post what you don't need.", GitHub URL, the number. | "Loop." | **Post what you don't need.** |

Total VO about 230 words at a calm pace = 1:45. Leave air.

## Rules for the take
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
