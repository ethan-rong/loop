// Pile photo check (SPEC2 §2). Always runs an offline check of the cleaning rules first; with a
// photo it then makes ONE real Gemini call through the same prompt, schema, call and cleaning code
// as POST /api/items/pile, with the seed's open requests. Quota is 15/min, 500/day: run by hand.
// Usage: node scripts/pile-test.mjs [photo.jpg]
import '../server/env.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelName } from '../server/gemini.mjs';
import { cleanPile, detectPile } from '../server/pile.mjs';
import { resetToSeed } from '../server/seed.mjs';

// Offline: hallucination guard, one item per request, box clamp/drop, max 6. No network.
const entry = (box, requestId) => ({ label: 'thing', box, title: 'Thing', description: 'A thing.', condition: 'good',
  conditionNotes: '', category: 'other', notAllowed: null, match: { requestId, reason: 'Fits.' } });
const tiny = [1, 1, 2, 2];
const offline = cleanPile({ identified: true, items: [
  entry([10, 10, 100, 100], 'r_lamp'), // kept with its match
  entry([10, 10, 100, 100], 'r_lamp'), // same request again -> null
  entry([10, 10, 100, 100], 'r_made_up'), // unknown id -> null
  entry([500, 10, 100, 100], null), // ymin > ymax -> dropped
  entry([10, 10, 100], null), // 3 numbers -> dropped
  entry([-5, 20.4, 1200, 300], null), // clamped and rounded
  entry(tiny, null), entry(tiny, null), entry(tiny, null), // 7th valid item -> cut
] }, ['r_lamp', 'r_coat']);
assert.equal(offline.identified, true);
assert.equal(offline.items.length, 6);
assert.deepEqual(offline.items.map((i) => i.match.requestId), ['r_lamp', null, null, null, null, null]);
assert.deepEqual(offline.items.map((i) => i.match.reason), ['Fits.', '', '', 'Fits.', 'Fits.', 'Fits.']);
assert.deepEqual(offline.items[3].box, [0, 20, 1000, 300]);
assert.deepEqual(cleanPile({ identified: false, items: [entry(tiny, null)] }, []), { identified: false, items: [] });
assert.deepEqual(cleanPile({ identified: true, items: [entry([5, 5, 5, 9], null)] }, []), { identified: false, items: [] });
assert.equal(cleanPile({ items: [] }, []), null);
console.log('PASS offline cleanPile checks');

const [file] = process.argv.slice(2);
if (!file) process.exit(0);

const openRequests = resetToSeed(mkdtempSync(join(tmpdir(), 'loop-pile-'))).requests.filter((r) => r.status === 'open');
const ids = openRequests.map((r) => r.id);
const image = readFileSync(file);
console.log(`model ${modelName()} | photo ${file} (${image.length} bytes) | open requests ${ids.join(', ')}`);

const result = await detectPile({ imageBase64: image.toString('base64'), mimeType: 'image/jpeg', openRequests });
console.log(`HTTP ${result.status ?? '-'} in ${result.ms ?? '-'} ms, aiError ${result.aiError ?? 'none'}`);
console.log('usageMetadata', JSON.stringify(result.usage));
let raw = null;
try {
  raw = JSON.parse(result.text);
} catch {
  console.log('raw text', result.text);
}
const rawItems = Array.isArray(raw?.items) ? raw.items : [];
console.log(`raw identified ${raw?.identified} | raw items ${rawItems.length} | kept ${result.items.length}`);
if (rawItems[0]) console.log(`raw key order: item ${Object.keys(rawItems[0])} | match ${Object.keys(rawItems[0].match ?? {})}`);
for (const [n, r] of rawItems.entries()) console.log(`  raw #${n + 1} ${JSON.stringify(r.label)} box ${JSON.stringify(r.box)} match ${JSON.stringify(r.match)}`);
for (const [n, i] of result.items.entries()) {
  console.log(`#${n + 1} ${i.label} [${i.box}] ${i.condition} | ${i.title} | ${i.match.requestId ?? 'no match'}: ${i.match.reason}`);
  console.log(`   ${i.description}${i.conditionNotes ? ` | notes: ${i.conditionNotes}` : ''}${i.notAllowed ? ` | NOT ALLOWED: ${i.notAllowed}` : ''}`);
}

const validBox = (b) => Array.isArray(b) && b.length === 4 && b.every((v) => Number.isInteger(v) && v >= 0 && v <= 1000)
  && b[0] < b[2] && b[1] < b[3];
const checks = [
  ['no aiError', !result.aiError],
  ['identified === true', result.identified === true],
  ['>= 2 items kept', result.items.length >= 2],
  ['kept boxes valid', result.items.every((i) => validBox(i.box))],
  ['raw boxes valid as returned (no clamping needed)', rawItems.every((r) => validBox(r.box))],
  [`raw match.requestId in {${ids}} or null`, rawItems.every((r) => [...ids, null].includes(r.match?.requestId ?? null))],
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
