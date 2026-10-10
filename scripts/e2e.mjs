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
const draftLamp = () => ok(call('POST', '/api/items/draft', { ownerId: 'ethan', imageBase64: LAMP, mimeType: 'image/jpeg' }));
const meet = { place: 'Davis Library lobby', time: 'Today 5 pm' };
const MAX_PEOPLE = 50;

// SPEC5: no "name" or "spot" key anywhere in what the server sends, at any depth (the replacer visits every key).
function noNames(data) {
  JSON.stringify(data, (key, value) => {
    assert.ok(key !== 'name' && key !== 'spot', `the server sent a "${key}" key`);
    return value;
  });
  return data;
}

async function mainLoop() {
  const seed = await ok(call('POST', '/api/reset'));
  assert.deepEqual([seed.people.length, seed.requests.length, seed.items.length], [5, 4, 2]);

  // jerry posts a need.
  const posted = await ok(call('POST', '/api/requests', { personId: 'jerry', title: 'Desk lamp for late reading', details: 'Mine broke.' }));
  const need = posted.request;
  assert.equal(need.status, 'open');
  assert.ok(Array.isArray(posted.suggestions));
  assert.equal(posted.mock, true);

  // ethan photographs a lamp: photo stored, mock draft returned, nothing published.
  const drafted = await draftLamp();
  assert.equal(drafted.aiError, null);
  assert.equal(drafted.mock, true);
  assert.equal(drafted.draft.identified, true);
  const lampNeeds = (await state()).requests.filter((r) => r.status === 'open' && /lamp/i.test(r.title)).map((r) => r.id);
  assert.ok(lampNeeds.includes(drafted.draft.match.requestId), 'draft matched an open lamp request');
  assert.equal((await fetch(BASE + drafted.photo)).status, 200, 'photo is served');

  // ethan posts it, offered to jerry's need.
  const { title, description, condition, category } = drafted.draft;
  const item = await ok(call('POST', '/api/items', {
    ownerId: 'ethan', photoId: drafted.photoId, title, description, condition, category, aiDraft: drafted.draft, offerToRequestId: need.id,
  }));
  assert.equal(item.status, 'offered');
  assert.equal(await requestStatus(need.id), 'matched');

  // jerry accepts and reserves.
  const reserved = await ok(call('POST', `/api/items/${item.id}/reserve`, { personId: 'jerry', ...meet }));
  assert.equal(reserved.status, 'reserved');
  assert.match(reserved.reservation.code, /^\d{4}$/);
  assert.notEqual(reserved.reservation.code, '0000');
  assert.equal(reserved.reservation.requestId, need.id);

  // Wrong code, then the right one.
  const { code } = reserved.reservation;
  await expect(call('POST', `/api/items/${item.id}/confirm`, { personId: 'ethan', code: code === '1234' ? '4321' : '1234' }), 403, 'wrong_code');
  const collected = await ok(call('POST', `/api/items/${item.id}/confirm`, { personId: 'ethan', code }));
  assert.equal(collected.status, 'collected');
  assert.ok(collected.collectedAt);
  const after = noNames(await state());
  assert.equal(after.requests.find((r) => r.id === need.id).status, 'fulfilled');
  assert.ok(after.version > seed.version, 'version went up');

  // Reserving a collected item conflicts.
  const late = await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'jack', ...meet }), 409, 'already_claimed');
  assert.equal(late.message, 'Someone got there first.');
}

async function sideFlows() {
  // Offer to jack -> others can't take it -> jack declines -> jerry reserves, cancels -> ethan takes it back.
  const drafted = await draftLamp();
  const item = await ok(call('POST', '/api/items', {
    ownerId: 'ethan', photoId: drafted.photoId, title: 'Spare lamp', condition: 'fair', category: 'lighting', aiDraft: null, offerToRequestId: 'r_coat',
  }));
  assert.equal(await requestStatus('r_coat'), 'matched');
  const offered = await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'jerry', ...meet }), 409, 'already_claimed');
  assert.equal(offered.message, 'Someone got there first.');
  assert.equal((await ok(call('POST', `/api/items/${item.id}/decline`, { personId: 'jack' }))).status, 'available');
  assert.equal(await requestStatus('r_coat'), 'open');
  await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'ethan', ...meet }), 403, 'own_item');
  assert.equal((await ok(call('POST', `/api/items/${item.id}/reserve`, { personId: 'jerry', ...meet }))).status, 'reserved');
  await expect(call('POST', `/api/items/${item.id}/withdraw`, { personId: 'ethan' }), 409, 'cant_withdraw');
  const released = await ok(call('POST', `/api/items/${item.id}/release`, { personId: 'jerry' }));
  assert.equal(released.status, 'available');
  assert.equal(released.reservation, null);
  assert.equal((await ok(call('POST', `/api/items/${item.id}/withdraw`, { personId: 'ethan' }))).status, 'withdrawn');
  const gone = await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'jerry', ...meet }), 409, 'already_claimed');
  assert.equal(gone.message, 'The giver took this back.');
  const { request: lamp } = await ok(call('POST', '/api/requests', { personId: 'jerry', title: 'Reading lamp for my desk' }));
  await expect(call('DELETE', `/api/requests/${lamp.id}`, { personId: 'jack' }), 403, 'not_yours');
  assert.equal((await ok(call('DELETE', `/api/requests/${lamp.id}`, { personId: 'jerry' }))).status, 'closed');
}

// SPEC5: a fresh anonymous person (a new browser tab) can reserve and chat. People are {id, lang} only; at most 50;
// reset drops the added ones.
async function anonymousPerson() {
  noNames(await ok(call('POST', '/api/reset')));
  const me = await ok(call('POST', '/api/people'));
  assert.match(me.id, /^p_[0-9a-f]{8}$/);
  assert.deepEqual(me, { id: me.id, lang: 'en' });
  assert.equal((await ok(call('POST', '/api/items/i_book/reserve', { personId: me.id }))).reservation.personId, me.id);
  const s = noNames(await state());
  assert.ok(s.people.every((p) => Object.keys(p).join() === 'id,lang'), 'people are {id, lang} only');
  assert.deepEqual(s.people.find((p) => p.id === me.id), me);
  const t = s.threads.findLast((x) => x.itemId === 'i_book');
  assert.deepEqual([t.ownerId, t.recipientId], ['jack', me.id]);
  assert.deepEqual(t.messages.map((m) => [m.forPersonId, m.text]), [
    ['jack', "Someone reserved your Intro to Psychology textbook (8th ed.). You're the one handing it over, so you pick: when and where works for you?"],
    [me.id, 'The giver will suggest a time and place; you can reply here too.'],
  ]);
  const said = (text) => ok(call('POST', `/api/threads/${t.id}/messages`, { personId: me.id, text })).then((r) => r.thread.messages);
  assert.deepEqual((await said('hello there')).slice(-2).map((m) => [m.from, m.text]), [[me.id, 'hello there'], ['loop', 'Got it.']]);
  assert.match((await said('Davis at 5 pm?')).at(-1).text, /^New suggestion from the taker: Davis Library lobby, (Today|Tomorrow) 5 pm\. Does that work for you\?$/);
  assert.equal((await ok(call('POST', `/api/people/${me.id}/lang`, { lang: 'es' }))).lang, 'es');
  noNames(await state());

  for (let n = s.people.length; n < MAX_PEOPLE; n++) await ok(call('POST', '/api/people'));
  await expect(call('POST', '/api/people'), 429, 'too_many_people');
  const reset = await ok(call('POST', '/api/reset'));
  assert.deepEqual(reset.people.map((p) => p.id), ['ethan', 'jerry', 'jack', 'tom', 'thomas']);
}

async function badInput() {
  await expect(call('POST', '/api/requests', undefined, '{"personId": "jerry", '), 400, 'invalid_json');
  await expect(call('POST', '/api/requests', { personId: 'jerry' }), 400, 'missing_field');
  await expect(call('POST', '/api/requests', { personId: 'jerry', title: 'x'.repeat(61) }), 400, 'too_long');
  await expect(call('POST', '/api/requests', { personId: 'nobody', title: 'Lamp' }), 404, 'unknown_person');
  await expect(call('POST', '/api/items', { ownerId: 'ethan' }), 400, 'missing_field');
  await expect(call('POST', '/api/items/i_book/confirm', { personId: 'jack', code: 1234 }), 400, 'invalid_field');
  await expect(call('POST', '/api/items/nope/reserve', { personId: 'jerry', ...meet }), 404, 'unknown_item');
  const sevenMb = Buffer.alloc(7 * 1024 * 1024, 0xff).toString('base64');
  await expect(call('POST', '/api/items/draft', { ownerId: 'ethan', mimeType: 'image/jpeg', imageBase64: sevenMb }), 400, 'too_large');
  const notAPhoto = Buffer.from('<html>hello</html>').toString('base64');
  await expect(call('POST', '/api/items/draft', { ownerId: 'ethan', mimeType: 'image/jpeg', imageBase64: notAPhoto }), 400, 'bad_image');
  await expect(call('POST', '/api/items/draft', { ownerId: 'ethan', mimeType: 'image/gif', imageBase64: LAMP }), 400, 'invalid_field');
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
    await anonymousPerson();
    console.log(`run ${run}: PASS`);
  } catch (err) {
    failed++;
    console.log(`run ${run}: FAIL ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
