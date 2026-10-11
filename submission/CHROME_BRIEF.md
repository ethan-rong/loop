# Brief for Claude in Chrome — filling Loop's Devpost entry (HackNC 2026)

You are helping Ethan fill the existing Devpost draft ("Untitled", 1/5 steps) at
https://devpost.com/submit-to/31530-hacknc-2026/manage/submissions → Edit project.
Fill fields and save drafts. Never click the final Submit/Publish button yourself: Ethan clicks it.
Deadline: Sunday Oct 11, 2026, 10:00 AM EDT. Everything below is true as of Oct 10, 23:30 EDT.

## Step 1 — Overview
- Project name: **Loop**
- Tagline: **Photograph something you don't need. Loop finds who does and walks you both to the handoff.**
- Submitter: Ethan (solo). No teammates to add.
- Experience question: Ethan is a first-time hackathon participant → choose **Beginner** track when asked "beginner or general".

## Step 2 — Project details ("About the project")
Copy the sections from `submission/DEVPOST.md` in the repo, in this order: Inspiration · What it does · How we built it · Challenges we ran into · Accomplishments that we're proud of · What we learned · What's next for Loop. Ethan will paste the file's text; keep it verbatim, do not add claims.
Two facts newer than that file, add them to "What it does" / "How we built it" if the file does not already say so:
- Phones link themselves: a person types their number on the item page, Loop texts a 4-digit code, they type it, done. Or they text the page's code to Loop's number. Loop registers the number on Photon's user list through Photon's API, so nobody touches a dashboard. The number is stored on the server only and never shown.
- Pickup plans are an exact place (free text), a date picker and a time picker, or a time in words; either side can change them in the thread or by text.

## Step 3 — Built with (tags)
javascript, node.js, express, html, css, gemini-api, photon, spectrum, imessage, playwright, ffmpeg

## Step 4 — Links and media
- GitHub: https://github.com/rongtnt/loop (public; Ethan pushes right before filling this)
- Demo video: the YouTube unlisted link Ethan gives you (file `film/out/loop-film.mp4`, 1:40, under the 2-minute limit). Title on YouTube: "Loop — HackNC 2026 demo". Unlisted.
- Images to upload (in this order): `docs/readme/hero.png` (if present), `film/out/stills/2-ticket.png`, `film/out/stills/3-plan-set.png`, `film/out/stills/4-kept-in-use.png`, `film/out/stills/5-pile.png`, `film/out/stills/1-watercolor.png`. Thumbnail = hero.png, else 2-ticket.png.

## Step 5 — Prizes / tracks: tick exactly these
- HackNC Beginner (not General)
- HackNC Best Community Hack
- [MLH] Best Use of Gemini API
- [Photon] Best iMessage Agent
Do NOT tick: Frutiger Aero, Ig Turing, [MLH] Best Use of ElevenLabs (the voice-over uses MiniMax, not ElevenLabs), Solana, Tiger Data, Snowflake, .Tech, Capital One Nessie.

## Disclosure text (paste at the end of the project details if there is no separate field)
Built solo during the HackNC 2026 hacking window. AI engineering with a human in the loop: Ethan set the product, the design, every flow and rule, tested each step on the real services (live Gemini, the real iMessage line, his own phone) and sent work back until it met the bar; AI coding agents (Claude) wrote the code, the tests and most of the copy under that direction; he has not reviewed every line. The product calls Google's Gemini API (gemini-3.5-flash-lite) and Photon Spectrum (Loop's real iMessage number). The demo video's narration is Ethan's own voice, cloned with his consent from a 58-second voice memo (Higgsfield voice clone, rendered with MiniMax text-to-speech); the video was composited with HyperFrames (HTML rendered by Puppeteer and FFmpeg), product footage recorded with Playwright on the live app, a p5.js watercolor opening, a three.js knot, Remotion typography, an iPhone screen recording of real Messages, FFmpeg-synthesized sound effects and an AI-generated instrumental bed. Fonts: Space Grotesk and JetBrains Mono (SIL OFL). Seed photos: Wikimedia Commons, credited in the repo. No user data or impact figures are claimed beyond what the demo shows.

## After the Devpost draft is complete
- GitHub repo settings → Social preview → upload `docs/readme/social.png` (if present). Repo "About": the tagline above; topics: hackathon, hacknc, gemini, imessage, photon, campus.
- Tell Ethan when every step shows a check mark, then stop. He clicks Submit.
