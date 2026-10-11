// Sound-only remix: voice + SFX + music onto the silent picture, no video re-render (the video stream is copied).
//   node scripts/mix.mjs --music raw/music/calm-bed.wav [--music-db -21] [--duck 5]
//   node scripts/mix.mjs                      re-mix with the music and settings used last time
// Stems live in out/stems/ (written by `node scripts/compose.mjs --render --audio …`):
//   video-silent.mp4  voice.wav  sfx.wav  music.wav (the slot --music fills)  mix-settings.json
// --music-db  the music bed level before ducking, LUFS (default -21: ~-24 in the short gaps, ~-27 under speech)
// --duck      how far the music drops under the voice, dB (default 5, so about -27 LUFS under speech);
//             a sidechain compressor keyed by the voice, attack 20 ms, release 700 ms.
// The voice is never processed; one loudnorm pass on the finished mix brings it to -16 LUFS / -1.5 dBTP.
// Writes out/loop-film.mp4 and out/loop-film-preview-720p.mp4.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILM = new URL('../', import.meta.url).pathname;
const STEMS = `${FILM}out/stems/`;
const VO = JSON.parse(readFileSync(`${FILM}vo-timing.json`));
const TOTAL = VO.total;
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

function loudness(inputs, filter) { // integrated LUFS (and true peak) of a filter graph's output
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...inputs, '-filter_complex', `${filter},ebur128=peak=true[o]`, '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8' });
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  return { i: Number(tail.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]), peak: Number(tail.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]) };
}

// Speech = the beats' word windows; gaps = everything between them (inside the music's fades).
const speech = VO.beats.map((b) => [b.start, b.end]);
const select = (wins) => `aselect='${wins.map(([a, b]) => `between(t,${a},${b})`).join('+')}',asetpts=N/SR/TB`;
const gaps = [];
let prev = 2.5;
for (const [a, b] of speech) { if (a - prev > 0.2) gaps.push([prev, a]); prev = Math.max(prev, b); }
if (TOTAL - 3 - prev > 0.2) gaps.push([prev, TOTAL - 3]);

export function mix({ music, musicDb, duck } = {}) {
  const settingsFile = `${STEMS}mix-settings.json`;
  const last = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {};
  if (music) copyFileSync(music, `${STEMS}music.wav`);
  const hasMusic = existsSync(`${STEMS}music.wav`);
  const opts = { musicDb: musicDb ?? last.musicDb ?? -21, duck: duck ?? last.duck ?? 5 };
  writeFileSync(settingsFile, JSON.stringify(opts, null, 1));

  const inputs = ['-i', `${STEMS}video-silent.mp4`, '-i', `${STEMS}voice.wav`, '-i', `${STEMS}sfx.wav`];
  let musicChain = '';
  if (hasMusic) {
    inputs.push('-stream_loop', '-1', '-i', `${STEMS}music.wav`);
    const own = loudness(['-i', `${STEMS}music.wav`], '[0:a]anull').i;
    // Sidechain: the voice (rms ~ -20 dBFS while speaking) sits ~16 dB over the -36 dBFS threshold, so this ratio
    // takes about `duck` dB off the music under speech.
    const ratio = Math.min(20, 1 / Math.max(0.05, 1 - opts.duck / 16));
    musicChain = `[3:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${TOTAL},asetpts=N/SR/TB,volume=${(opts.musicDb - own).toFixed(2)}dB,`
      + `afade=t=in:st=0:d=2.5,afade=t=out:st=${(TOTAL - 3).toFixed(2)}:d=3[m];`
      + `[1:a]aformat=channel_layouts=stereo,asplit=2[vk][vm];`
      + `[m][vk]sidechaincompress=threshold=0.0158:ratio=${ratio.toFixed(2)}:attack=20:release=700:knee=4:makeup=1[md];`;
  }
  const voice = hasMusic ? '[vm]' : '[1:a]aformat=channel_layouts=stereo[vm];[vm]';
  const graph = `${musicChain}${voice}[2:a]${hasMusic ? '[md]' : ''}amix=inputs=${hasMusic ? 3 : 2}:normalize=0:duration=first[pre]`;

  // loudnorm, two passes (measure, then a linear correction) so the voice's dynamics are left alone.
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...inputs, '-filter_complex', `${graph};[pre]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(probe.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  const norm = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const film = `${FILM}out/loop-film.mp4`;
  ff([...inputs, '-filter_complex', `${graph};[pre]${norm},aresample=48000[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(TOTAL), '-movflags', '+faststart', film]);
  ff(['-i', film, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', `${FILM}out/loop-film-preview-720p.mp4`]);

  // Levels report: the voice alone, the whole mix, and the music under speech vs in the gaps.
  const report = { settings: opts, voice: loudness(['-i', `${STEMS}voice.wav`], '[0:a]anull'), mix: loudness(['-i', film], '[0:a]anull') };
  if (hasMusic) {
    const musicOnly = (wins) => `${musicChain}[vm]anullsink;[md]${select(wins)}`; // the ducked music alone
    report.musicUnderVoice = loudness(inputs, musicOnly(speech)).i;
    report.musicInGaps = loudness(inputs, musicOnly(gaps)).i;
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const num = (v) => (v === undefined ? undefined : Number(v));
  const t0 = Date.now();
  const report = mix({ music: arg('--music'), musicDb: num(arg('--music-db')), duck: num(arg('--duck')) });
  console.log(JSON.stringify(report, null, 1));
  console.log(`mixed in ${((Date.now() - t0) / 1000).toFixed(1)} s -> out/loop-film.mp4, out/loop-film-preview-720p.mp4`);
}
