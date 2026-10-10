// Side-effect module: loads KEY=VALUE lines into process.env (existing env vars win).
// Reads <repo>/.env.local (see .env.example). Only this Node process reads the file.
// Never log, print, or send the values anywhere.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOCAL = fileURLToPath(new URL('../.env.local', import.meta.url));

let text = '';
try {
  text = readFileSync(LOCAL, 'utf8');
} catch {
  // No env file: GEMINI_MOCK=1 still works; real calls return aiError "unavailable".
}
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
