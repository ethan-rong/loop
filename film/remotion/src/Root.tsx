import { Composition } from 'remotion';
import { Slam } from './Slam';
import { Code } from './Code';

// Durations come from film/vo-timing.json via --props '{"frames": N}' (scripts/compose.mjs renders them).
const byProps = ({ props }: { props: { frames: number } }) => ({ durationInFrames: props.frames });

export const Root = () => (
  <>
    <Composition id="Slam" component={Slam} defaultProps={{ frames: 300 }} calculateMetadata={byProps} fps={30} width={1920} height={1080} />
    <Composition id="Code" component={Code} defaultProps={{ frames: 327 }} calculateMetadata={byProps} fps={30} width={1920} height={1080} />
  </>
);
