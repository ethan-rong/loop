// Sound design for the film: short synthesized cues (ffmpeg aevalsrc, no samples), each peak-normalized, laid on a
// bed at their cue times and mixed UNDER the voice. The voice track itself is passed through untouched.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const SR = 48000;
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const NOISE = '(random(0)*2-1)';

// kind -> [seconds, aevalsrc expression, extra filters, peak dBFS]. All 15-320 ms.
export const SOUNDS = {
  thump: [0.22, 'sin(2*PI*(50+45*exp(-t*28))*t)*exp(-t*16)*min(1,t*300)', 'lowpass=f=500', -20], // dull paper thump
  crack: [0.05, `${NOISE}*exp(-t*110)`, 'highpass=f=1800,lowpass=f=6000', -27], // tiny crack
  slide: [0.2, `${NOISE}*pow(sin(PI*t/0.2),2)`, 'bandpass=f=1400:width_type=h:width=1600', -25], // card slide
  tick: [0.03, 'sin(2*PI*2200*t)*exp(-t*250)*min(1,t*2000)', 'lowpass=f=6000', -25],
  pop: [0.2, '(lt(t,0.085)*sin(2*PI*740*t)*exp(-t*40)+gte(t,0.085)*sin(2*PI*1110*(t-0.085))*exp(-(t-0.085)*32))*min(1,t*800)', 'lowpass=f=4000', -22], // two-note message pop
  key: [0.025, `${NOISE}*exp(-t*350)`, 'bandpass=f=3200:width_type=h:width=2400', -31], // low soft key tick
  whoosh: [0.32, `${NOISE}*pow(sin(PI*t/0.32),2)`, 'highpass=f=400,lowpass=f=3500', -22], // airy whoosh
  swoosh: [0.16, `${NOISE}*pow(sin(PI*t/0.16),2)*(0.4+3*t)`, 'highpass=f=900,lowpass=f=7000', -24], // message send: a short rising noise sweep
  click: [0.015, `${NOISE}*exp(-t*700)`, 'bandpass=f=1800:width_type=h:width=1800', -27], // faint mouse click
};

// Synthesize every sound once into dir, normalized so its peak sits at its target level.
export function synth(dir) {
  mkdirSync(dir, { recursive: true });
  for (const [kind, [dur, expr, filters, target]] of Object.entries(SOUNDS)) {
    const raw = `${dir}${kind}-raw.wav`;
    ff(['-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':s=${SR}:d=${dur}`, '-af', `${filters},afade=t=out:st=${dur * 0.7}:d=${dur * 0.3}`, '-ac', '1', raw]);
    const res = spawnPeak(raw);
    ff(['-i', raw, '-af', `volume=${(target - res).toFixed(2)}dB`, '-ac', '1', `${dir}${kind}.wav`]);
  }
}

function spawnPeak(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = r.stderr.match(/max_volume: (-?[\d.]+) dB/);
  if (!m) throw new Error(`no peak for ${file}`);
  return Number(m[1]);
}

// cues: [{ t, kind, db? }] -> one mono bed of exactly `total` seconds.
export function bed(cues, dir, total, out) {
  const kinds = [...new Set(cues.map((c) => c.kind))];
  const inputs = kinds.flatMap((k) => ['-i', `${dir}${k}.wav`]);
  const parts = [];
  const labels = [];
  kinds.forEach((k, i) => {
    const mine = cues.filter((c) => c.kind === k);
    parts.push(`[${i}:a]asplit=${mine.length}${mine.map((_, j) => `[${k}${j}]`).join('')}`);
    mine.forEach((c, j) => {
      const ms = Math.max(0, Math.round(c.t * 1000));
      const l = `c${labels.length}`;
      parts.push(`[${k}${j}]adelay=${ms}:all=1,volume=${c.db ?? 0}dB[${l}]`);
      labels.push(l);
    });
  });
  parts.push(`${labels.map((l) => `[${l}]`).join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,apad=whole_dur=${total},atrim=0:${total}[bed]`);
  ff([...inputs, '-filter_complex', parts.join(';'), '-map', '[bed]', '-ar', String(SR), '-ac', '1', out]);
  writeFileSync(out.replace(/\.wav$/, '.json'), JSON.stringify(cues, null, 1));
}

// Voice first and untouched; the bed only adds. Output length = the voice's length.
export function mix(picture, voice, bedFile, film) {
  ff(['-i', picture, '-i', voice, '-i', bedFile, '-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0:duration=first[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', film]);
}
