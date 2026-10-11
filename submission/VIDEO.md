# Loop — the film, v3 (your voice, real phone, fast cuts)

Director's notes, Sat Oct 10, 20:30 EDT. Rules: your voice, not a synthetic one. Footage is the real product in a real desktop browser (new desktop layout) and your real iPhone screen recording of Messages. Cuts every 1–3 seconds, push-ins on the moment that matters, kinetic captions, no cursor wandering: every mouse move lands on something within half a second or gets cut. Under 2:00.

## 1. What I need from you (30 minutes)

**A. Voice-over (record on your phone, Voice Memos, quiet room, phone 20 cm from your mouth).** Read this like you're telling a friend, quickly, not reading an ad. Natural pauses are fine; I'll cut to your pace. Send me the file (.m4a). If a line feels fake, change the words and keep the meaning.

> Last May I watched a guy on my floor throw out a desk lamp that worked. Two doors down, someone was about to buy one.
>
> That's the real problem with campus "free stuff" boards: they stop at "posted". Nobody matches the thing to the person, nobody sorts out the pickup, and nothing proves it ever happened.
>
> So I built Loop. You post what you don't need, or what you need. Gemini looks at the photo, drafts the listing, and tells you who already asked for it. It only drafts. You fix the condition. You say yes.
>
> The other person accepts and gets a four-digit ticket. Then Loop joins the chat as the third voice. It asks the giver first, because the giver is doing the favour. It turns "tomorrow at noon at Davis" into a plan, gets the other side to confirm, and reminds both of them.
>
> At the pickup, the taker shows the code, the giver types it, and the item flips to collected. That's the handshake. No names, no accounts, no ratings. The code is the only identity that matters.
>
> And you don't even need the app. Loop has a real iMessage number, through Photon's Spectrum. Text it a photo, and the same Gemini draft comes back as a text. Tap thumbs-up to offer it. When someone reserves it, Loop texts you, you text back a time, and at the pickup you text the four digits. The whole handoff can happen in Messages.
>
> One photo of a pile becomes six listings. Gemini says "no match" when nothing fits, and Loop refuses to share your number.
>
> Plain JavaScript on Node. Gemini 3.5 Flash-Lite behind JSON schemas. Photon for iMessage. Built in a day at HackNC.
>
> Loop.

(~260 words. At a normal talking pace that is about 1:45. If you need to cut, cut the pile line first.)

**B. Phone screen recording (iPhone: Control Center → Screen Recording; Do Not Disturb on; Messages open on the Loop thread).** I'll drive the web side and tell you when to text. Record ONE take of:
1. Text **hi** → wait for the reply.
2. Take a photo of the lamp in Messages (camera button) and send it → wait for the draft reply (ends with "👍 YES · 👎 BOARD").
3. Tap **👍** on that message → "Offered. I'll tell you when they accept…"
4. Wait: I accept on the web → you get "Someone reserved your … you pick: when and where works for you?"
5. Text **tomorrow noon at Davis** → wait → I confirm on the web → you get "Pickup set…"
6. Wait: I tap "I'm here" on the web → you get "The taker is at … text it to me."
7. Text the four digits I give you → "Handed over…"
Stop recording. AirDrop me the .mov (or send it in chat). Keep the phone upright; don't scroll while a message is arriving.

## 2. Shot plan (what the picture does while you talk)

| VO beat | Picture (all real) | Motion |
|---|---|---|
| "Last May…" | Black. Kinetic type: "A WORKING LAMP." then "IN THE DUMPSTER." slam in, one word at a time. | Hard cuts on syllables. |
| "That's the real problem…" | Desktop browser, a generic-looking "free stuff" board (our own board, blurred, with the word POSTED stamped over it), then the stamp cracks. | Push-in 1.1× over 1.5 s. |
| "So I built Loop." | Knot mark draws itself, wordmark lands, cut to the real desktop site: hero "Post what you don't need." | Draw-on, snap. |
| "You post what you don't need…" | Desktop: Post something → photo lands → the draft card types itself in (real Gemini) → push-in on "DRAFTED BY GEMINI — CHECK IT" → the match card: "Fits someone's request: Reading lamp for my desk". | Zoom 1.3× on the match card; caption pops. |
| "It only drafts. You fix the condition. You say yes." | Click Fair (ring), click Looks right, click Offer to them: three quick cuts, each on the click. | 0.8 s per cut. |
| "The other person accepts…" | Second browser (taker): For you row → Accept & reserve → the ticket fills the frame. | Push-in 1.4× on the four digits. |
| "Then Loop joins the chat…" | Split screen: giver left, taker right. Loop's green card slides in; "Suggest a time and place" → chips → "New suggestion from the giver…" on the right → Works for me → SET. | Alternate left/right push-ins; each message slides in. |
| "At the pickup…" | I'm here → code prompt → typing 4 digits (one per frame burst) → Confirm → COLLECTED → the KEPT IN USE stamp slams. | Stamp lands with a 2-frame shake. |
| "No names, no accounts…" | Fast montage: three board cards, no names anywhere; the ticket; the "Nothing identifies you" line. | 0.7 s cuts. |
| "And you don't even need the app. Loop has a real iMessage number, through Photon's Spectrum." | YOUR PHONE recording in a device frame, full height: the thread header "(773) 912-3997", hi → welcome. Caption: "Photon Spectrum = Loop's iMessage line". | Phone frame slides in from the right. |
| "Text it a photo… Tap thumbs-up to offer it." | Phone: photo sent → draft reply → the 👍 tapback lands → "Offered." | Push-in on the 👍. |
| "When someone reserves it, Loop texts you… text the four digits." | Phone: "Someone reserved your…" → your typed time → "Pickup set…" → "The taker is at…" → you text the code → "Handed over." Caption: "Server ⇄ Photon ⇄ Messages: same thread, same state machine." | Quick cuts. |
| "One photo of a pile…" | Desktop: A pile → outlines pop one by one (1..6) → "Gemini found 6 things". | Each outline pops with a tick sound-free bounce. |
| "Gemini says no match… refuses to share your number." | Two cards: "No open request fits this one." and the thread line "I cannot share phone numbers…" | Two cuts. |
| "Plain JavaScript…" | Three code snippets, 1 s each: the draft schema, the coordinator actions, the Spectrum send. | Type-on. |
| "Loop." | End card: knot, "Post what you don't need.", github.com/rongtnt/loop, the number. | Snap, hold 3 s. |

## 3. How it gets made
- You send the two files. I lock the picture to your voice (your pace sets the cuts), composite the phone recording in a device frame, add the motion (GSAP in HyperFrames: push-ins, slides, kinetic type), and render 1080p under 2:00.
- No synthetic voice anywhere. No music, or a single quiet pulse if you want one (say so).
