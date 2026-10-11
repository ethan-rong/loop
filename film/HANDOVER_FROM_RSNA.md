# Handover from the RSNA session (2026-10-11 ~01:30Z)

Ethan posted two HackNC tasks in the RSNA chat by mistake. The prep below is done and UNCOMMITTED in /Users/ethan/loop; finish, verify, deliver.

## Task 1: fix the demo film (Ethan's words)
- ~0:30 "zoom out because we're not showing how Gemini is scanning the image"
- ~1:27 "we are trying to show the six labels Gemini has created, however you have only shown two because you didn't scroll down" (both marks are approximate ranges)
- opener (beat 2, "Giving it away should be simple. Less waste. One less thing to buy. But posting is only the beginning.") "looks really AI generated, make it smoother, have some taste"

Done so far (not rendered yet):
- film/scripts/record.mjs: new `pile` mode (runPile, pane P, desktop 1440x900): scrolls through the draft cards one per second, marks pile-card-2..6 and pile-scrolled. Recorded raw/pile-P.mp4 (23.7 s) + raw/pile-marks.json with SIX cards (Gemini's count varies per call; the loop in the shell re-recorded until >= 6). The old pile-P.mp4 (a phone-layout take) is overwritten.
- film/scripts/compose.mjs: MARKS = main-marks + pile-marks; pile-P.mp4 copied into comp/assets/clips; src('P') points at it; FOOTAGE[6] first cut region widened to the whole page [40,90,1400,820], zmax 1.2 (photo pane + "Gemini is looking at your photo…" card both visible); FOOTAGE[11] = pane P cuts: pile-photo, pile-review (whole page: "Gemini found 6 things" + numbered boxes), then pile-card-2 -0.6 .. pile-scrolled +1.4 (the scroll through drafts 2-6); Slam thump/crack SFX cues removed.
- film/remotion/src/Slam.tsx rewritten: five sentence-case lines rise in on their words (16-frame ease-out; no slam, shake, scale, stamp or crack), the first three dim to 32% after the turn, the last line in coral; cached slam-*.mp4 clips deleted so it re-renders.

Remaining:
1. `cd film && node scripts/compose.mjs --render --audio raw/voice/vo-minimax.wav` (film/EDITING.md).
2. Read the checks it prints: no "CHECK" rows.
3. Stills at ~11-18 s, ~29-33 s, ~82-88 s (`ffmpeg -ss T -i out/loop-film.mp4 -frames:v 1 x.jpg`), look at them, adjust regions/timing if needed.
4. Back up ~/Desktop/Loop-HackNC-2026-demo.mp4, replace it with out/loop-film.mp4.
5. Ethan also said the submission form asks whether the team registered a .tech domain during the hackathon ("maybe we can get a domain"): handle with him.

## Task 2: "do we need to reference this shit we pulled from the open source?" (the isometric card-tray illustration)
It is the Hairline "riffle" figure by Lucas Marques, MIT. Already satisfied: license text vendored at public/vendor/hairline-LICENSE.txt next to hairline.js; README.md "Credits and licenses" names it with the GitHub link; submission/DEVPOST.md's disclosure lists "Hairline (figures, MIT)". Nothing more is required. If the figure appears in the film, one line in film/ATTRIBUTION.md would be tidy.
