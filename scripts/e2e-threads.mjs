// API-level checks for handoff threads (SPEC2 §1, §3): both opening variants (recipient suggests / owner
// picks), buttons and typed messages, reminder, cancel and release, errors. Runs 3 times against a mock server:
//   GEMINI_MOCK=1 DEMO_REMINDER_SECONDS=1 PORT=3200 DATA_DIR=.tmp-c/data node server/index.mjs &
//   PORT=3200 node scripts/e2e-threads.mjs        (BASE_URL overrides http://localhost:$PORT)
// Refuses to run unless the server reports mock mode, so it never spends real Gemini calls.
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
const RUNS = 3;
const TITLE = 'Blue adjustable desk lamp';
const meet = { place: 'Davis Library lobby', time: 'Today 5 pm' };
const REMINDER = 'Reminder: pickup in 30 minutes at Davis Library lobby. (demo: reminder sped up)';

async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
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
const thread = async (id) => (await state()).threads.find((t) => t.id === id);
const openThreadFor = async (itemId) => (await state()).threads.findLast((t) => t.itemId === itemId && t.status !== 'done' && t.status !== 'cancelled');
const act = (t, personId, action, extra = {}) => call('POST', `/api/threads/${t.id}/actions`, { personId, action, ...extra });
const say = (t, personId, text) => call('POST', `/api/threads/${t.id}/messages`, { personId, text });
const reserve = (itemId, body) => ok(call('POST', `/api/items/${itemId}/reserve`, { personId: 'caleb', ...meet, ...body }));

async function waitFor(id, done, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) {
    const t = await thread(id);
    if (done(t)) return t;
  }
  throw new Error(`thread ${id} did not reach the expected state within ${ms} ms`);
}

// Ethan lists a lamp (mock draft for the photo, his own title).
async function ethanListsLamp() {
  const lamp = (await import('node:fs')).readFileSync(new URL('../public/seed/lamp.jpg', import.meta.url)).toString('base64');
  const drafted = await ok(call('POST', '/api/items/draft', { ownerId: 'ethan', imageBase64: lamp, mimeType: 'image/jpeg' }));
  const item = await ok(call('POST', '/api/items', { ownerId: 'ethan', photoId: drafted.photoId, title: TITLE, condition: 'good', category: 'lighting', aiDraft: null }));
  assert.equal(item.status, 'available');
  return item;
}

async function fullLoop() {
  const seed = await ok(call('POST', '/api/reset'));
  const item = await ethanListsLamp();

  // Reserve opens the thread with Loop's opening message and buttons for the owner.
  const timeISO = new Date(Date.now() + 3 * 3600_000).toISOString();
  const reserved = await reserve(item.id, { timeISO });
  assert.equal(reserved.status, 'reserved');
  let t = await openThreadFor(item.id);
  assert.match(t.id, /^t_[0-9a-f]{8}$/);
  assert.deepEqual([t.status, t.ownerId, t.recipientId, t.remindAt, t.reminded], ['planning', 'ethan', 'caleb', null, false]);
  assert.deepEqual(t.plan, { ...meet, timeISO, proposedBy: 'caleb', confirmedBy: ['caleb'] });
  assert.equal(t.messages.length, 1);
  const [opening] = t.messages;
  assert.match(opening.id, /^m_[0-9a-f]{8}$/);
  assert.deepEqual([opening.from, opening.via, opening.forPersonId], ['loop', 'system', 'ethan']);
  assert.equal(opening.text, `Hi Ethan — Caleb reserved your ${TITLE} and suggested Davis Library lobby, Today 5 pm. Does that work?`);
  assert.deepEqual(opening.actions, [{ label: 'Works for me', action: 'accept' }, { label: 'Suggest another time', action: 'propose' }]);

  // Only the two participants; the proposer can't accept their own plan; no "I'm here" before it is set.
  await expect(act(t, 'dani', 'accept'), 403, 'not_participant');
  await expect(say(t, 'dani', 'Can I have it instead?'), 403, 'not_participant');
  await expect(act(t, 'caleb', 'accept'), 409, 'already_confirmed');
  await expect(act(t, 'caleb', 'arrived'), 409, 'not_set');

  // Owner taps "Works for me": plan set, reminder scheduled, old buttons retired.
  t = (await ok(act(t, 'ethan', 'accept'))).thread;
  assert.equal(t.status, 'set');
  assert.deepEqual(t.plan.confirmedBy, ['caleb', 'ethan']);
  assert.ok(Date.parse(t.remindAt) > Date.now() - 1000, 'remindAt set');
  let last = t.messages.at(-1);
  assert.equal(last.text, "Pickup set: Davis Library lobby, Today 5 pm. I'll remind you both 30 minutes before. Caleb, tap 'I'm here' when you arrive.");
  assert.deepEqual(last.actions, [{ label: "I'm here", action: 'arrived', forPersonId: 'caleb' }, { label: "Can't make it", action: 'cancel' }]);
  assert.equal(last.forPersonId, null);
  assert.deepEqual(t.messages[0].actions, [], 'superseded buttons are retired');

  // DEMO_REMINDER_SECONDS=1: the reminder appears within 3 s.
  t = await waitFor(t.id, (x) => x.reminded, 3000);
  assert.equal(t.messages.filter((m) => m.text === REMINDER).length, 1);

  // Recipient types a new plan; the mock coordinator reads it as a proposal.
  t = (await ok(say(t, 'caleb', 'actually 6 pm at the Union?'))).thread;
  const typed = t.messages.at(-2);
  assert.deepEqual([typed.from, typed.text, typed.via, typed.actions], ['caleb', 'actually 6 pm at the Union?', 'web', []]);
  assert.equal(t.status, 'planning');
  assert.equal(t.plan.place, 'Student Union');
  assert.match(t.plan.time, /^(Today|Tomorrow) 6 pm$/);
  assert.ok(Date.parse(t.plan.timeISO) > Date.now(), 'timeISO in the future');
  assert.deepEqual([t.plan.proposedBy, t.plan.confirmedBy, t.reminded, t.remindAt], ['caleb', ['caleb'], false, null]);
  last = t.messages.at(-1);
  assert.equal(last.text, `New suggestion from Caleb: Student Union, ${t.plan.time}. Ethan, does that work?`);
  assert.deepEqual([last.from, last.forPersonId, last.actions.map((a) => a.action)], ['loop', 'ethan', ['accept', 'propose']]);
  const reservation = (await state()).items.find((i) => i.id === item.id).reservation;
  assert.deepEqual([reservation.place, reservation.time], ['Student Union', t.plan.time], 'item page stays in sync');

  // Owner accepts again; the demo reminder route posts at most once per plan.
  t = (await ok(act(t, 'ethan', 'accept'))).thread;
  assert.equal(t.status, 'set');
  t = (await ok(call('POST', `/api/threads/${t.id}/reminder`, {}))).thread;
  assert.equal(t.reminded, true);
  t = (await ok(call('POST', `/api/threads/${t.id}/reminder`, {}))).thread;
  assert.equal(t.messages.filter((m) => m.text.startsWith('Reminder:')).length, 2, 'one reminder per agreed plan');

  // Only the recipient can say "I'm here".
  await expect(act(t, 'ethan', 'arrived'), 403, 'not_recipient');
  t = (await ok(act(t, 'caleb', 'arrived'))).thread;
  assert.equal(t.status, 'meeting');
  last = t.messages.at(-1);
  assert.equal(last.text, 'Caleb is at Student Union. Ethan, ask Caleb for the 4-digit code and type it on the item page.');
  assert.deepEqual([last.forPersonId, last.actions], ['ethan', [{ label: 'Enter code', action: 'enter_code' }]]);
  assert.ok(!JSON.stringify(t.messages.map((m) => m.text)).includes(reserved.reservation.code), 'Loop never posts the code');

  // Owner confirms the code on the item page: thread done with the closing line.
  const collected = await ok(call('POST', `/api/items/${item.id}/confirm`, { personId: 'ethan', code: reserved.reservation.code }));
  assert.equal(collected.status, 'collected');
  t = await thread(t.id);
  assert.equal(t.status, 'done');
  assert.equal(t.messages.at(-1).text, 'Handed over. Thanks, both — the blue adjustable desk lamp stays in use.');
  assert.ok(t.messages.every((m) => m.actions.length === 0), 'no live buttons on a closed thread');
  await expect(act(t, 'ethan', 'accept'), 409, 'thread_closed');
  await expect(say(t, 'caleb', 'thanks'), 409, 'thread_closed');
  assert.ok((await state()).version > seed.version);
}

// Reserve without a place/time: the owner picks, then the recipient agrees, all by typing (mock coordinator).
async function ownerPicks() {
  const item = await ethanListsLamp();
  await expect(call('POST', `/api/items/${item.id}/reserve`, { personId: 'caleb', place: 'Student Union' }), 400, 'missing_field');
  const reserved = await ok(call('POST', `/api/items/${item.id}/reserve`, { personId: 'caleb' }));
  assert.deepEqual([reserved.status, reserved.reservation.place, reserved.reservation.time], ['reserved', null, null]);
  let t = await openThreadFor(item.id);
  assert.deepEqual([t.status, t.plan], ['planning', { place: null, time: null, timeISO: null, proposedBy: null, confirmedBy: [] }]);
  assert.equal(t.messages.length, 2);
  const [opening, note] = t.messages;
  assert.equal(opening.text, `Hi Ethan — Caleb reserved your ${TITLE}. You're the one handing it over, so you pick: when and where works for you?`);
  assert.deepEqual([opening.forPersonId, opening.actions], ['ethan', [{ label: 'Suggest a time and place', action: 'propose' }]]);
  assert.deepEqual([note.from, note.text, note.forPersonId, note.actions], ['loop', 'Caleb, Ethan will suggest a time and place; you can reply here too.', 'caleb', []]);

  // Nothing to agree to yet, and a proposal on an empty plan needs both a time and a place.
  await expect(act(t, 'caleb', 'accept'), 409, 'plan_incomplete');
  await expect(act(t, 'ethan', 'accept'), 409, 'plan_incomplete');
  await expect(act(t, 'caleb', 'arrived'), 409, 'not_set');
  await expect(act(t, 'ethan', 'propose', { time: 'Today 6 pm' }), 400, 'missing_field');
  t = (await ok(say(t, 'ethan', '6 pm works for me'))).thread;
  assert.deepEqual([t.messages.at(-1).text, t.plan.place, t.status], ['Add a place too, like Davis Library lobby.', null, 'planning']);

  // Owner types a full plan; the recipient agrees by typing.
  t = (await ok(say(t, 'ethan', 'Davis at 5 pm?'))).thread;
  assert.deepEqual([t.plan.place, t.plan.proposedBy, t.plan.confirmedBy], ['Davis Library lobby', 'ethan', ['ethan']]);
  assert.match(t.plan.time, /^(Today|Tomorrow) 5 pm$/);
  assert.equal(t.messages.at(-1).text, `New suggestion from Ethan: Davis Library lobby, ${t.plan.time}. Caleb, does that work?`);
  assert.deepEqual([t.messages.at(-1).forPersonId, t.messages[0].actions], ['caleb', []]);
  const reservation = (await state()).items.find((i) => i.id === item.id).reservation;
  assert.deepEqual([reservation.place, reservation.time], ['Davis Library lobby', t.plan.time]);
  t = (await ok(say(t, 'caleb', 'sounds good'))).thread;
  assert.equal(t.status, 'set');
  assert.equal(t.messages.at(-1).text, `Pickup set: Davis Library lobby, ${t.plan.time}. I'll remind you both 30 minutes before. Caleb, tap 'I'm here' when you arrive.`);
  t = (await ok(say(t, 'caleb', "I'm here"))).thread;
  assert.equal(t.status, 'meeting');
  assert.equal(t.messages.at(-1).text, 'Caleb is at Davis Library lobby. Ethan, ask Caleb for the 4-digit code and type it on the item page.');
  await ok(call('POST', `/api/items/${item.id}/confirm`, { personId: 'ethan', code: reserved.reservation.code }));
  assert.equal((await thread(t.id)).status, 'done');
}

async function cancelPaths() {
  const item = await ethanListsLamp();

  // Recipient taps "Can't make it": item back on the board, linked request reopened.
  await reserve(item.id, { requestId: 'r_lamp' });
  let s = await state();
  assert.equal(s.requests.find((r) => r.id === 'r_lamp').status, 'matched');
  let t = await openThreadFor(item.id);
  assert.equal(t.plan.timeISO, null);
  t = (await ok(act(t, 'caleb', 'cancel'))).thread;
  assert.equal(t.status, 'cancelled');
  assert.equal(t.messages.at(-1).text, 'Reservation cancelled. The blue adjustable desk lamp is back on the board.');
  s = await state();
  const back = s.items.find((i) => i.id === item.id);
  assert.deepEqual([back.status, back.reservation], ['available', null]);
  assert.equal(s.requests.find((r) => r.id === 'r_lamp').status, 'open');
  await expect(act(t, 'caleb', 'accept'), 409, 'thread_closed');

  // Reserve again: a new thread. Owner releases from the item page: that thread is cancelled too.
  await reserve(item.id, {});
  const second = await openThreadFor(item.id);
  assert.notEqual(second.id, t.id);
  await ok(call('POST', `/api/items/${item.id}/release`, { personId: 'ethan' }));
  assert.equal((await thread(second.id)).status, 'cancelled');

  // Free text: chat, a refused accept (no state change, Loop says why), then a typed cancel.
  await reserve(item.id, {});
  t = await openThreadFor(item.id);
  t = (await ok(say(t, 'caleb', 'hello there'))).thread;
  assert.deepEqual([t.messages.at(-1).from, t.messages.at(-1).text, t.status], ['loop', 'Got it.', 'planning']);
  t = (await ok(say(t, 'caleb', 'yes'))).thread;
  assert.deepEqual([t.messages.at(-1).text, t.status], ['You already agreed to Davis Library lobby, Today 5 pm.', 'planning']);
  t = (await ok(say(t, 'caleb', 'sorry, I can’t make it'))).thread;
  assert.equal(t.status, 'cancelled');
  assert.equal(t.messages.at(-1).text, 'Reservation cancelled. The blue adjustable desk lamp is back on the board.');
  assert.equal((await state()).items.find((i) => i.id === item.id).status, 'available');
  return item;
}

async function badInput(item) {
  await reserve(item.id, {});
  const t = await openThreadFor(item.id);
  await expect(call('POST', '/api/threads/t_00000000/messages', { personId: 'caleb', text: 'hi' }), 404, 'unknown_thread');
  await expect(call('POST', '/api/threads/t_00000000/reminder', {}), 404, 'unknown_thread');
  await expect(act(t, 'nobody', 'accept'), 404, 'unknown_person');
  await expect(say(t, 'caleb', 'x'.repeat(301)), 400, 'too_long');
  await expect(say(t, 'caleb', '   '), 400, 'missing_field');
  await expect(act(t, 'ethan', 'enter_code'), 400, 'invalid_field');
  await expect(act(t, 'ethan', 'propose'), 400, 'missing_field');
  await expect(act(t, 'ethan', 'propose', { time: 'Today 6 pm', timeISO: 'soonish' }), 400, 'invalid_field');
  await expect(call('POST', '/api/items/i_fan/reserve', { personId: 'dani', ...meet, timeISO: 'tomorrowish' }), 400, 'invalid_field');
  // Owner-side proposal by button keeps the place when only the time changes.
  const moved = (await ok(act(t, 'ethan', 'propose', { time: 'Today 8 pm' }))).thread;
  assert.deepEqual([moved.plan.place, moved.plan.time, moved.plan.timeISO, moved.plan.proposedBy], ['Davis Library lobby', 'Today 8 pm', null, 'ethan']);
  assert.equal(moved.messages.at(-1).text, 'New suggestion from Ethan: Davis Library lobby, Today 8 pm. Caleb, does that work?');
  assert.equal(moved.messages.at(-1).forPersonId, 'caleb');
}

const health = await ok(call('GET', '/api/health'));
if (health.mock !== true) {
  console.error('Server is not in mock mode (GEMINI_MOCK=1). Refusing to run.');
  process.exit(2);
}
assert.equal(typeof health.imessage, 'boolean');
assert.ok(Array.isArray(health.linkedPhones));
let failed = 0;
for (let run = 1; run <= RUNS; run++) {
  try {
    await fullLoop();
    await ownerPicks();
    await badInput(await cancelPaths());
    console.log(`run ${run}: PASS`);
  } catch (err) {
    failed++;
    console.log(`run ${run}: FAIL ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
