// The spike: one real Gemini call with a real photo, through the same prompt, schema, call and
// cleaning code the server uses. Quota is 15/min and 500/day, so run it by hand only.
// Usage: node scripts/photo-test.mjs <photo.jpg> [expected requestId: r1|r2|r3|null]
import '../server/env.mjs';
import { readFileSync } from 'node:fs';
import { callGemini, cleanDraft, describePrompt, CONDITIONS, DRAFT_SCHEMA, modelName } from '../server/gemini.mjs';

const [file, expected] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/photo-test.mjs <photo.jpg> [r1|r2|r3|null]');
  process.exit(2);
}

const requests = [
  { id: 'r1', title: 'Reading lamp for my desk', details: 'Anything that clips or stands. My room light is awful.' },
  { id: 'r2', title: 'Winter coat, size M-ish', details: 'First real winter for me. Anything warm.' },
  { id: 'r3', title: 'Mini fridge for a double', details: 'Small enough to fit under a desk.' },
];
const ids = requests.map((r) => r.id);

// JSON Schema form of the OpenAPI-style schema, only for the responseJsonSchema fallback.
const toJsonSchema = ({ nullable, type, properties, items, ...rest }) => ({
  ...rest,
  type: nullable ? [type.toLowerCase(), 'null'] : type.toLowerCase(),
  ...(properties && { properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, toJsonSchema(v)])) }),
  ...(items && { items: toJsonSchema(items) }),
});
const variants = [
  ['responseSchema', DRAFT_SCHEMA],
  ['responseJsonSchema', toJsonSchema(DRAFT_SCHEMA)],
  ['none', null],
];

const image = readFileSync(file);
console.log(`model ${modelName()} | photo ${file} (${image.length} bytes)`);
const parts = [{ text: describePrompt(requests) }, { inline_data: { mime_type: 'image/jpeg', data: image.toString('base64') } }];

let result;
for (const [field, schema] of variants) {
  result = await callGemini(parts, schema, field);
  console.log(`variant ${field}: generationConfig keys temperature, responseMimeType${schema ? `, ${field}` : ''}`);
  console.log(`  HTTP ${result.status ?? '-'} in ${result.ms ?? '-'} ms, aiError ${result.aiError ?? 'none'}`);
  // Fall back only when the API rejects the schema field itself (protects the call budget).
  if (!(result.status === 400 && /schema|unknown name|invalid json payload/i.test(result.text ?? ''))) break;
  console.log(`  rejected: ${result.text.slice(0, 300)}`);
}
console.log('usageMetadata', JSON.stringify(result.usage));
console.log('raw text', result.text);
if (result.aiError) {
  console.log(`FAIL aiError=${result.aiError}`);
  process.exit(1);
}
const draft = cleanDraft(result.data, ids);
console.log('cleaned draft', JSON.stringify(draft, null, 2));

const rawId = result.data?.match?.requestId ?? null;
const checks = [
  ['identified === true', draft?.identified === true],
  ['condition is valid', CONDITIONS.includes(draft?.condition)],
  ['raw match.requestId in {r1,r2,r3,null}', [...ids, null].includes(rawId)],
];
if (expected) checks.push([`match.requestId === ${expected}`, String(draft?.match.requestId ?? null) === expected]);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
