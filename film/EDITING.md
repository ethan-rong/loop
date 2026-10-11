# Editing the Loop film (outputs: `out/loop-film.mp4`, `out/loop-film-preview-720p.mp4`)
**Change a cut (picture), about 5 min:** edit `scripts/compose.mjs`, then run `node scripts/compose.mjs --render --audio raw/voice/vo-minimax.wav`.
- Which footage, and how long: the `FOOTAGE` table. `cut(pane, mark, from, to, region, zoom, …)` uses seconds relative to a mark in `raw/main-marks.json`. `region` is the box of words the camera keeps readable.
- When things happen: `vo-timing.json` sets each beat's window. Cuts stretch to fit.
- Phone shot: `PHONE_SEGS`. Each entry is a recording second, the word it lands on, and the segment start.
- Watercolor: cue times in `comp/assets/wc.js`.
- Slam: `remotion/src/Slam.tsx`. Code cards: `remotion/src/cards.json`.
- The render rewrites `out/stems/` and remixes the sound automatically, keeping the music.

**Change sound only, about 8 s:** run `node scripts/mix.mjs [--music <file>] [--music-db -21] [--duck 5]`.
- It copies the picture and mixes voice + effects + music. The voice is untouched, then the whole mix is loudness-normalised to −16 LUFS.
- `--music-db` is how loud the music bed is. `--duck` is how many dB it drops under the voice.
- Without arguments it reuses the last settings (`out/stems/mix-settings.json`).
- To change the effects themselves: sounds in `scripts/sfx.mjs`, cue times in `out/review/sfx-cues.json`. Those need the compose render, because the cues come from the cut.

**Hand-edit in iMovie:**
1. Import `out/stems/video-silent.mp4`, then add `voice.wav`, `sfx.wav` and `music.wav` as audio clips, all starting at 0:00.
2. Lower the music clip's volume to about 15%, and dip it under speech if you like.
3. Export at 1080p.
