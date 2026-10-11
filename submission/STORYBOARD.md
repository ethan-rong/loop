# Loop — storyboard v1.1 (director: Fable; Sat Oct 10, 21:40 EDT)

**Voice-over is Ethan's own script (below), 288 words, 150 wpm; timings in `film/vo-timing.json`; the pacer is at `/film/pacer.html` on the running app.** The VO column in the table is superseded by the beat text in the timing file; the shot column stays.

Length target 1:55. 1920×1080, 30 fps. Voice: Ethan, recorded last, over the locked picture. Sound: none under the voice (one soft "thock" on the stamp is allowed).
Tooling per shot: **P** = real product, recorded by Fable with Playwright at 2× on the desktop layout (or Ethan's own screen recording if he prefers); **PH** = Ethan's iPhone screen recording of Messages; **3D** = three.js scene (HTML, rendered inside HyperFrames); **WC** = p5.js hand-drawn watercolor animation (HTML, seeded, deterministic per frame); **RM** = Remotion composition rendered to MP4, then placed as a clip; **HF** = HyperFrames composition (puppeteer + FFmpeg) that assembles everything.

| # | Time | What we see (exactly) | Source | Text on screen | VO (Ethan says) | Motion / cut |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:04 | A desk lamp painted in six quick watercolor strokes on cream paper; then a dumpster painted around it in three strokes; a drip runs. | WC | — | "Every May, stuff that still works ends up in a dumpster." | Strokes appear in sync with the words; hard cut at "dumpster". |
| 2 | 0:04–0:08 | Ink words slam in one by one on cream: LISTINGS / STOP / AT / "POSTED". The last word gets a coral stamp "POSTED" that cracks. | RM | the words themselves | "Boards don't fix that. They stop at 'posted'." | 4 slams, 0.5 s each; crack on the last syllable. |
| 3 | 0:08–0:12 | The Knot as a 3D torus knot in ink wire on cream, slowly rotating, then it flattens into the 2D logo and "Loop" lands beside it. | 3D | Loop | "So I built Loop." | Rotation eases to a stop; flatten over 0.6 s; wordmark snaps. |
| 4 | 0:12–0:17 | Real site, desktop, full browser viewport: the board. Hero "Post what you don't need.", the riffle figure moving, Inventory grid, People need. | P | — | "You post what you don't need. Or what you need." | Slow push-in 1.0→1.08 over the shot. |
| 5 | 0:17–0:23 | Taker's browser: Ask for something → types "Reading lamp for my desk" → Post → the board shows it under People need. | P | caption: ASKED JUST NOW | "Someone asks for a lamp." | Type-on is real; cut on the Post click. |
| 6 | 0:23–0:36 | Giver's browser: Post something → photo lands → the draft card fills in (real Gemini) → push-in on "DRAFTED BY GEMINI — CHECK IT" → match card "Fits someone's request: Reading lamp for my desk". | P | caption: Gemini **drafts**. A person **decides**. | "I post mine. Gemini reads the photo, writes the listing, and sees who asked for one. It only drafts: I fix the condition, I say yes." | Zoom 1.3× on the match card; three quick cuts on the clicks Fair → Looks right → Offer to them. |
| 7 | 0:36–0:42 | Taker's browser: the For you row → Accept & reserve → the ticket fills the frame. | P | caption: the ticket is the only identity | "They accept and get a four-digit ticket." | Push-in 1.4× on the digits. |
| 8 | 0:42–0:56 | Split screen giver/taker: Loop's green card slides in on the left ("Someone reserved your…"), "Suggest a time and place" → chips → right side "New suggestion from the giver…" → Works for me → SET → "I'll remind you both". | P | caption: Loop **proposes**. People **confirm**. | "Now Loop is in the chat. It asks me first, because I'm the one giving. 'Tomorrow noon at Davis' becomes a plan, they confirm, Loop reminds us both." | Each message slides in; alternate push-ins left/right. |
| 9 | 0:56–1:06 | Taker: I'm here → giver: code prompt → four digits typed → Confirm handoff → COLLECTED → the KEPT IN USE stamp slams; "Pass it on again" visible on the taker side. | P | caption: KEPT IN USE | "At the pickup they show the code, I type it. Done. No names, no accounts. The code is the identity." | Digits one per 3 frames; stamp lands with a 2-frame shake and the "thock". |
| 10 | 1:06–1:26 | Ethan's iPhone in a device frame, full height: thread header (773) 912-3997 → "hi" → welcome → the lamp photo sent → the draft reply ending "👍 YES · 👎 BOARD" → the 👍 tapback → "Offered." → "Someone reserved your…" → "tomorrow noon at Davis" → "Pickup set…" → "The taker is at…" → the four digits → "Handed over." | PH | caption: Photon Spectrum = Loop's real iMessage number | "You don't even need the app. Loop has a real iMessage number through Photon's Spectrum. Text it a photo, tap thumbs-up, text a time, text the code. The whole handoff can happen in Messages." | Phone frame slides in from the right; quick cuts between replies; push-in on the 👍. |
| 11 | 1:26–1:34 | Giver's browser: A pile → the yard-sale photo → outlines 1…6 pop → "Gemini found 6 things" → one card "No open request fits this one." | P | caption: one photo, six listings | "A pile becomes six listings. Gemini says 'no match' when there's none." | Outlines pop one per 4 frames. |
| 12 | 1:34–1:39 | Thread: "What's the giver's phone number?" → Loop: "I cannot share phone numbers or personal data." | P | — | "And Loop won't give out your number." | One cut, hold 2 s. |
| 13 | 1:39–1:49 | Three code cards type on and stack: the draft JSON schema (gemini.mjs), the coordinator action enum (coordinator.mjs), the Spectrum send (spectrum.mjs). | RM | the code | "Node and plain JavaScript. Gemini 3.5 Flash-Lite behind JSON schemas. Photon for iMessage. Built in one day." | Type-on 25 chars/s; cards slide up. |
| 14 | 1:49–1:55 | The 3D knot spins once more and settles; end card: Loop · Post what you don't need. · github.com/rongtnt/loop · (773) 912-3997 | 3D + HF | end card | "Loop." | Hold 3 s, cut to black. |

VO word count ≈ 175 → about 1:20 spoken at a normal pace, so there is air in every shot. Ethan: read it like you're explaining to a friend; if a line sounds written, change the words.

## Assets and who makes what
- P footage: Fable records on localhost:3000 (desktop layout, 1440×900 viewport, 2× scale) with the shot list above; each step timestamped so cuts land on clicks. Ethan may instead screen-record the same steps on his Mac and send the .mov.
- PH footage: Ethan records Messages on the iPhone while Fable drives the web side (steps in VIDEO.md §1B).
- 3D: three.js TorusKnotGeometry (p=2, q=3) with EdgesGeometry/LineSegments in ink, OrthographicCamera, deterministic per frame (time from HyperFrames' seek).
- WC: p5.js instance mode, seeded noise, a brush function that lays overlapping translucent ellipses along a stroke path with slight jitter and a wet edge; deterministic per frame.
- RM: Remotion project in film/remotion (two compositions: "Slam" and "Code"), rendered with `npx remotion render` to MP4 at 1920×1080/30.
- HF: film/comp/index.html assembles clips, HTML scenes and captions with GSAP-free CSS keyframes, rendered with `npx hyperframes render` (puppeteer + FFmpeg).
- Captions: JetBrains Mono 48 px, lime highlight on the bold phrase, bottom-centre, never over the ticket digits.

## Acceptance
- Every frame is either the real product, Ethan's phone, or a scene labelled by this table. No synthetic voice. No stock footage.
- ≤ 1:59, 1080p, H.264 + AAC (silent track until Ethan's voice is laid in; then a final render with his audio).
- Each cut lands on an action; no shot longer than 6 s without a change; no cursor idle longer than 0.5 s.
