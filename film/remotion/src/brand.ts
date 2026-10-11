import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const C = { cream: '#f6f1e3', ink: '#0b0d17', coral: '#ff6b57', lime: '#c8ff3c', muted: '#4a5068', card: '#ffffff' };

const faces: [string, string, string][] = [
  ['SG', 'space-grotesk-latin-700-normal.woff2', '700'],
  ['JBM', 'jetbrains-mono-latin-400-normal.woff2', '400'],
  ['JBM', 'jetbrains-mono-latin-700-normal.woff2', '700'],
];
for (const [family, file, weight] of faces) loadFont({ family, url: staticFile(`fonts/${file}`), weight });
