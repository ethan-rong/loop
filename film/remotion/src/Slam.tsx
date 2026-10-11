import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './brand';

// Shot 2, beat 2: "Giving it away should be simple. Less waste. One less thing to buy. But posting is only the
// beginning. There's still a pickup to arrange." Quiet typography: each phrase rises in on its words, nothing slams.
// After the turn ("But posting…") the first three lines dim, the last line is set in coral.
// Cue frames at the nominal 300-frame (10 s) beat; scaled to the beat's real length at render time.
const NOMINAL = 300;
const TURN0 = 156;
const LINES0 = [
  { text: 'Giving it away should be simple.', at: 12 },
  { text: 'Less waste.', at: 76 },
  { text: 'One less thing to buy.', at: 106 },
  { text: 'But posting is only the beginning.', at: 160, turn: true },
  { text: 'There’s still a pickup to arrange.', at: 226, coral: true },
];
const LINE = 118;
const RISE = 16; // frames for a line to settle

const enter = (f: number, at: number) => {
  const p = interpolate(f - at, [0, RISE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return { opacity: p, y: 14 * (1 - p) };
};

// cue: the time scale (the beat's spoken length / 10 s); defaults to the clip length.
export const Slam = ({ cue }: { cue?: number }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = cue ?? durationInFrames / NOMINAL;
  const at = (n: number) => Math.round(n * k);
  const turn = at(TURN0);
  const dim = interpolate(f - turn, [0, 14], [1, 0.32], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <div style={{ position: 'absolute', left: 190, top: 214 }}>
        {LINES0.map((l, i) => {
          const e = enter(f, at(l.at));
          const color = l.coral ? C.coral : C.ink;
          const opacity = e.opacity * (i < 3 ? dim : 1);
          return (
            <div key={l.text} style={{ position: 'absolute', left: 0, top: i * LINE + (i >= 3 ? 56 : 0), opacity, transform: `translateY(${e.y}px)`, font: '700 84px/1.15 SG', letterSpacing: '-0.025em', color, whiteSpace: 'nowrap' }}>
              {l.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
