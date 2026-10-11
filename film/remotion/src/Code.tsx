import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './brand';

// Shot 13: three real snippets (lines verbatim from the repo; "…" marks lines left out). Each card shows its context
// lines at once and types only its last line, at 26 chars/s; a card that could not finish before the next one
// arrives is shown already typed, with the cursor. The schedule (cardPlan) is shared with scripts/compose.mjs (SFX).
import SPEC from './cards.json';
type Line = [number | null, string];
const CARDS0 = SPEC.cards as { file: string; lines: Line[] }[];
export function cardPlan(frames: number) {
  return CARDS0.map((c, i) => {
    const at = Math.round(SPEC.arrive[i] * frames);
    const limit = i + 1 < CARDS0.length ? Math.round(SPEC.arrive[i + 1] * frames) : frames - SPEC.tail;
    const key = c.lines[c.lines.length - 1][1].trimStart();
    const need = Math.ceil((key.length / SPEC.cps) * 30);
    const typeFrom = at + SPEC.typeDelay;
    return { ...c, at, typeFrom, typed: typeFrom + need <= limit };
  });
}
const FPS = 30;
const LINE_H = 52;
const HEAD_H = 52;
const PAD = 26;
const GAP = 34;
const cardH = (n: number) => HEAD_H + PAD * 2 + n * LINE_H;

const KEYWORDS = /^(export|const|function|return|null)$/;
function tokens(text: string) {
  return text.split(/('[^']*'|\b\w+\b|…)/).filter(Boolean).map((t) => ({
    t,
    color: t.startsWith("'") ? '#c2402e' : t === '…' ? C.muted : C.ink,
    weight: KEYWORDS.test(t) ? 700 : 400,
  }));
}

export const Code = () => {
  const f = useCurrentFrame();
  const CARDS = cardPlan(useVideoConfig().durationInFrames);
  const arrived = CARDS.map((c) => interpolate(f - c.at, [0, 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }));
  // Stack height grows as each card lands; the stack stays centred.
  const total = CARDS.reduce((h, c, i) => h + arrived[i] * (cardH(c.lines.length) + (i ? GAP : 0)), 0);
  let y = (1080 - total) / 2;
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      {CARDS.map((c, i) => {
        const top = y;
        y += arrived[i] * (cardH(c.lines.length) + GAP);
        if (f < c.at) return null;
        // Context lines are there at once; the key (last) line types at SPEC.cps, or is already typed.
        const keyChars = c.typed ? Math.max(0, Math.floor(((f - c.typeFrom) / FPS) * SPEC.cps)) : Infinity;
        const rows = c.lines.map(([, text], j) => {
          if (j < c.lines.length - 1) return { text };
          const indent = text.length - text.trimStart().length;
          return { text: text.slice(0, indent + Math.min(text.trimStart().length, keyChars)) };
        });
        const newest = CARDS.findLastIndex((x) => f >= x.at) === i;
        const blink = Math.floor(f / 8) % 2 === 0;
        return (
          <div key={c.file} style={{ position: 'absolute', left: 90, top: top + (1 - arrived[i]) * 220, width: 1740, opacity: arrived[i], background: C.card, border: `3px solid ${C.ink}`, borderRadius: 14, boxShadow: `8px 8px 0 ${C.ink}`, overflow: 'hidden' }}>
            <div style={{ height: HEAD_H, background: C.lime, borderBottom: `3px solid ${C.ink}`, padding: '0 26px', display: 'flex', alignItems: 'center', font: '700 24px/1 JBM', letterSpacing: '0.04em' }}>{c.file}</div>
            <div style={{ padding: `${PAD}px 26px` }}>
              {rows.map((r, j) => (
                <div key={j} style={{ height: LINE_H, display: 'flex', alignItems: 'center', font: '400 34px/1 JBM', whiteSpace: 'pre' }}>
                  <span style={{ width: 96, color: C.muted, opacity: 0.6, flex: 'none' }}>{c.lines[j][0] ?? ''}</span>
                  {tokens(r.text).map((t, k) => <span key={k} style={{ color: t.color, fontWeight: t.weight }}>{t.t}</span>)}
                  {newest && j === rows.length - 1 && blink ? <span style={{ width: 19, height: 40, background: C.ink, marginLeft: 2 }} /> : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
