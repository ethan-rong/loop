// One real check of server/translate.mjs (SPEC4 §C): zh -> en and en -> zh, printed. Exactly 2 Gemini calls, no
// retries beyond callGemini's own. Reads GEMINI_API_KEY from .env.local; never prints it.
//   node scripts/translate-test.mjs
import '../server/env.mjs';
import { modelName } from '../server/gemini.mjs';
import { translate } from '../server/translate.mjs';

if (process.env.GEMINI_MOCK === '1') {
  console.error('GEMINI_MOCK=1 is set: this script is the real check. Unset it to run.');
  process.exit(2);
}
const CASES = [['我六点在图书馆可以吗', 'en'], ['Pickup set: Davis Library lobby, Today 6 pm.', 'zh']];
let failed = 0;
console.log(`model: ${modelName()}`);
for (const [text, lang] of CASES) {
  const started = Date.now();
  const out = await translate(text, lang);
  if (!out) failed++;
  console.log(`${text}\n  -> ${lang}: ${out ?? '(no translation)'}  [${Date.now() - started} ms]`);
}
process.exit(failed ? 1 : 0);
