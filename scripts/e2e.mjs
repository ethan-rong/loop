// API-level full loop, run 3 times against a running mock server. Start the server first:
//   GEMINI_MOCK=1 PORT=3100 DATA_DIR=.tmp-e2e node server/index.mjs &
// then: npm run e2e   (BASE_URL overrides http://localhost:$PORT)
// Refuses to run unless the server reports mock mode, so it never spends real Gemini calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3100}`;
const LAMP = readFileSync(new URL('../public/seed/lamp.jpg', import.meta.url)).toString('base64');
const RUNS = 3;

async function call(method, path, body, rawBody) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function expect(promise, status, error) {
  const { status: got, data } = await promise;
  assert.equal(got, status, `expected HTTP ${status}, got ${got}: ${JSON.stringify(data)}`);
  if (error) assert.equal(data?.error, error);
  return data;
}

const ok = (promise) => expect(promise, 200);
const state = () => ok(call('GET', '/api/state'));
const requestStatus = async (id) => (await state()).requests.find((r) => r.id === id).status;
const draftLamp = () => ok(call('POST', '/api/items/draft', { ownerId: 'maya', imageBase64: LAMP, mimeType: 'image/jpeg' }));
const meet = { place: 'Davis Library lobby', time: 'Today 5 pm' };

async function mainLoop() {
  const seed = await ok(call('POST', '/api/reset'));
  assert.deepEqual([seed.people.length, seed.requests.length, seed.items.length], [3, 3, 2]);

  // Sam posts a need.
  const posted = await ok(call('POST', '/api/requests', { personId: 'sam', title: 'Desk lamp for late reading', details: 'Mine broke.' }));
  const need = posted.request;
  assert.equal(need.status, 'open');
  assert.ok(Array.isArray(posted.suggestions));
  assert.equal(posted.mock, true);

  // Maya photographs a lamp: photo stored, mock draft returned, nothing published.
  const drafted = await draftLamp();
  assert.equal(drafted.aiError, null);
  assert.equal(drafted.mock, true);
  assert.equal(drafted.draft.identified, true);
  const lampNeeds = (await state()).requests.filter((r) => r.status === 'open' && /lamp/i.test(r.title)).map((r) => r.id);
  assert.ok(lampNeeds.includes(drafted.draft.match.requestId), 'draft matched an open lamp request');
  assert.equal((await fetch(BASE + drafted.photo)).status, 200, 'photo is served');

  // Maya posts it, offered to Sam's need.
  const { title, description, condition, category } = drafted.draft;
  const item = await ok(call('POST', '/api/items', {
    ownerId: 'maya', photoId: drafted.photoId, title, description, condition, category, aiDraft: drafted.draft, offerToRequestId: need.id,
  }));
  assert.equal(item.status, 'offered');
  assert.equal(await requestStatus(need.id), 'matched');

  // Sam accepts and reserves.
  const reserved = await ok(call('POST', `/api/items/${item.id}/reserve`, { personId: 'sam', ...meet }));
  assert.equal(reserved.status, 'reserved');
  assert.match(reserved.reservation.code, /^\d{4}$/);
  assert.notEqual(reserved.reservation.code, '0000');
  assert.equal(reserved.reservation.requestId, need.id);

  // Wrong code, then the right one.
  const { code } = reserved.reservation;
  await expect(call('POST', `/api/items/${item.id}/confirm`, { personId: 'maya', code: code === '1234' ? '4321' : '1234' }), 403, 'wrong_code');
  const collected = await ok(call('POST', `/api/items/${item.id}/confirm`, { personId: 'maya', code }));
  assert.equal(collected.status, 'collected');
  assert.ok(collected.collectedAt);
  const after = await state();
  assert.equal(after.requests.find((r) => r.id === need.id).status, 'fulfilled');
  assert.ok(after.version > seed.version, 'version went up');

  // Reserving a collected item conflicts.
  await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'priya', ...meet }), 409, 'already_claimed');
}

async function sideFlows() {
  // Offer to Priya -> others can't take it -> Priya declines -> Sam reserves, cancels -> Maya takes it back.
  const drafted = await draftLamp();
  const item = await ok(call('POST', '/api/items', {
    ownerId: 'maya', photoId: drafted.photoId, title: 'Spare lamp', condition: 'fair', category: 'lighting', aiDraft: null, offerToRequestId: 'r_coat',
  }));
  assert.equal(await requestStatus('r_coat'), 'matched');
  await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'sam', ...meet }), 409, 'already_claimed');
  assert.equal((await ok(call('POST', `/api/items/${item.id}/decline`, { personId: 'priya' }))).status, 'available');
  assert.equal(await requestStatus('r_coat'), 'open');
  await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'maya', ...meet }), 403, 'own_item');
  assert.equal((await ok(call('POST', `/api/items/${item.id}/reserve`, { personId: 'sam', ...meet }))).status, 'reserved');
  await expect(call('POST', `/api/items/${item.id}/withdraw`, { personId: 'maya' }), 409, 'cant_withdraw');
  const released = await ok(call('POST', `/api/items/${item.id}/release`, { personId: 'sam' }));
  assert.equal(released.status, 'available');
  assert.equal(released.reservation, null);
  assert.equal((await ok(call('POST', `/api/items/${item.id}/withdraw`, { personId: 'maya' }))).status, 'withdrawn');
  await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'sam', ...meet }), 409, 'already_claimed');
  await expect(call('DELETE', '/api/requests/r_lamp', { personId: 'priya' }), 403, 'not_yours');
  assert.equal((await ok(call('DELETE', '/api/requests/r_lamp', { personId: 'sam' }))).status, 'closed');
}

async function badInput() {
  await expect(call('POST', '/api/requests', undefined, '{"personId": "sam", '), 400, 'invalid_json');
  await expect(call('POST', '/api/requests', { personId: 'sam' }), 400, 'missing_field');
  await expect(call('POST', '/api/requests', { personId: 'sam', title: 'x'.repeat(61) }), 400, 'too_long');
  await expect(call('POST', '/api/requests', { personId: 'nobody', title: 'Lamp' }), 404, 'unknown_person');
  await expect(call('POST', '/api/items', { ownerId: 'maya' }), 400, 'missing_field');
  await expect(call('POST', '/api/items/i_book/confirm', { personId: 'priya', code: 1234 }), 400, 'invalid_field');
  await expect(call('POST', '/api/items/nope/reserve', { personId: 'sam', ...meet }), 404, 'unknown_item');
  const sevenMb = Buffer.alloc(7 * 1024 * 1024, 0xff).toString('base64');
  await expect(call('POST', '/api/items/draft', { ownerId: 'maya', mimeType: 'image/jpeg', imageBase64: sevenMb }), 400, 'too_large');
  const notAPhoto = Buffer.from('<html>hello</html>').toString('base64');
  await expect(call('POST', '/api/items/draft', { ownerId: 'maya', mimeType: 'image/jpeg', imageBase64: notAPhoto }), 400, 'bad_image');
  await expect(call('POST', '/api/items/draft', { ownerId: 'maya', mimeType: 'image/gif', imageBase64: LAMP }), 400, 'invalid_field');
  await state(); // still up
}

const health = await ok(call('GET', '/api/health'));
if (health.mock !== true) {
  console.error('Server is not in mock mode (GEMINI_MOCK=1). Refusing to run.');
  process.exit(2);
}
let failed = 0;
for (let run = 1; run <= RUNS; run++) {
  try {
    await mainLoop();
    await sideFlows();
    await badInput();
    console.log(`run ${run}: PASS`);
  } catch (err) {
    failed++;
    console.log(`run ${run}: FAIL ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
