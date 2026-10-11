import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './brand';

// Shot 2: LISTINGS / STOP / AT / "POSTED" slam in (0.5 s apart at the end), the coral stamp cracks on "-ted".
// Beat 2 (14.7-24.7 s): "Giving it away should be simple. Less waste. One less thing to buy." (part A), then
// "But posting is only the beginning. There's still a pickup to arrange." (part B: the slams, the crack on "pickup").
// Cue frames at the nominal 300-frame (10 s) beat; scaled to the beat's real length at render time.
const NOMINAL = 300;
const CUT0 = 156;
const INTRO0 = [
  { text: 'SIMPLE.', at: 54, y: 0 },
  { text: 'LESS WASTE.', at: 76, y: 1 },
  { text: 'ONE LESS THING TO BUY.', at: 106, y: 2 },
];
const WORDS0 = [
  { text: 'LISTINGS', at: 160, x: 0, y: 0 },
  { text: 'STOP', at: 180, x: 0, y: 1 },
  { text: 'AT', at: 192, x: 590, y: 1 },
];
const STAMP_AT0 = 207;
const CRACK_AT0 = 254;
const LINE = 196;
const SHAKE = [[9, -6], [-7, 5], [3, -2]];

const slam = (f: number, at: number) => {
  const p = f - at;
  return {
    opacity: interpolate(p, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    scale: interpolate(p, [0, 4, 7], [2.3, 0.96, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) }),
  };
};
const shakeAt = (f: number, impacts: number[]) => {
  for (const i of impacts) {
    const k = f - i;
    if (k >= 0 && k < SHAKE.length) return SHAKE[k];
  }
  return [0, 0];
};

const CRACK = [[57, 0], [52, 17], [59, 33], [50, 51], [58, 68], [52, 85], [58, 100]];
const LEFT = `polygon(0% 0%, ${CRACK.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 0% 100%)`;
const RIGHT = `polygon(${CRACK.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 100% 100%, 100% 0%)`;

const Stamp = ({ clip, style }: { clip?: string; style?: React.CSSProperties }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, clipPath: clip, ...style }}>
    <div style={{ position: 'relative', border: `14px solid ${C.coral}`, borderRadius: 18, padding: '0 46px', color: C.coral, font: '700 236px/1.08 SG', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden' }}>
      “POSTED”
      {Array.from({ length: 140 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: `${random(`x${i}`) * 100}%`, top: `${random(`y${i}`) * 100}%`, width: 2 + random(`r${i}`) * 9, height: 2 + random(`r${i}`) * 7, borderRadius: '50%', background: C.cream, opacity: 0.85 }} />
      ))}
    </div>
  </div>
);

// cue: the slams' time scale (the beat's spoken length / 10 s); defaults to the clip length.
export const Slam = ({ cue }: { cue?: number }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = cue ?? durationInFrames / NOMINAL;
  const at = (n: number) => Math.round(n * k);
  const CUT = at(CUT0), STAMP_AT = at(STAMP_AT0), CRACK_AT = at(CRACK_AT0);
  const INTRO = INTRO0.map((w) => ({ ...w, at: at(w.at) }));
  const WORDS = WORDS0.map((w) => ({ ...w, at: at(w.at) }));
  const [sx, sy] = shakeAt(f, [...WORDS.map((w) => w.at + 4), STAMP_AT + 4, CRACK_AT]);
  const st = slam(f, STAMP_AT);
  const crack = interpolate(f - CRACK_AT, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const fall = Math.max(0, f - CRACK_AT);
  const cracked = f >= CRACK_AT;
  if (f < CUT) {
    const [ix, iy] = shakeAt(f, INTRO.map((w) => w.at + 4));
    return (
      <AbsoluteFill style={{ background: C.cream }}>
        <div style={{ position: 'absolute', left: 190, top: 250, transform: `translate(${ix}px, ${iy}px)` }}>
          {INTRO.map((w) => {
            const s = slam(f, w.at);
            return (
              <div key={w.text} style={{ position: 'absolute', left: 0, top: w.y * 190, opacity: s.opacity, transform: `scale(${s.scale})`, transformOrigin: '20% 60%', font: '700 150px/1 SG', letterSpacing: '-0.04em', color: C.ink, whiteSpace: 'nowrap' }}>
                {w.text}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <div style={{ position: 'absolute', left: 190, top: 112, transform: `translate(${sx}px, ${sy}px)` }}>
        {WORDS.map((w) => {
          const s = slam(f, w.at);
          return (
            <div key={w.text} style={{ position: 'absolute', left: w.x, top: w.y * LINE, opacity: s.opacity, transform: `scale(${s.scale})`, transformOrigin: '30% 60%', font: '700 220px/1 SG', letterSpacing: '-0.045em', color: C.ink, whiteSpace: 'nowrap' }}>
              {w.text}
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: -6, top: 2 * LINE + 78, opacity: st.opacity, transform: `rotate(-5deg) scale(${st.scale})`, transformOrigin: '40% 50%' }}>
          {cracked ? (
            <>
              <Stamp clip={LEFT} style={{ transform: `translate(${-14 * crack}px, ${5 * crack}px) rotate(${-1.6 * crack}deg)` }} />
              <Stamp clip={RIGHT} style={{ transform: `translate(${16 * crack}px, ${12 * crack + 0.15 * fall}px) rotate(${2.8 * crack}deg)` }} />
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ position: 'absolute', left: 560 + i * 26, top: 60 + i * 90 + 0.9 * fall * fall * (0.6 + 0.3 * i), width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: `16px solid ${C.coral}`, transform: `rotate(${fall * (20 + i * 15)}deg)`, opacity: fall > 0 ? 1 : 0 }} />
              ))}
            </>
          ) : (
            <Stamp />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
