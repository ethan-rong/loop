// Bilingual threads (SPEC4 §C) at the API level, 3 runs against a running mock server:
//   GEMINI_MOCK=1 PORT=3700 DATA_DIR=.tmp-g/data node server/index.mjs &
//   PORT=3700 node scripts/e2e-translate.mjs        (BASE_URL overrides http://localhost:$PORT)
// Refuses to run unless the server reports mock mode, so it never spends real Gemini calls (mock: "[lang] text").
// Translations land a moment after the message (their own commit), so the checks poll GET /api/state.
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { threadTexts } from '../server/channels/spectrum.mjs';

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3700}`;
const RUNS = 3;
const WAIT_MS = 3000;
const CHINESE = '我六点在图书馆可以吗';
const meet = { place: 'Davis Library lobby', time: 'Today 5 pm' };

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
const say = (t, personId, text) => ok(call('POST', `/api/threads/${t.id}/messages`, { personId, text }));
const act = (t, personId, action) => ok(call('POST', `/api/threads/${t.id}/actions`, { personId, action }));
const newestThread = async (itemId) => (await state()).threads.findLast((t) => t.itemId === itemId);
const mock = (lang, m) => ({ [lang]: `[${lang}] ${m.text}` });

// Polls until done(thread) is true.
async function waitFor(id, done, what) {
  for (const end = Date.now() + WAIT_MS; Date.now() < end; await sleep(50)) {
    const t = (await state()).threads.find((x) => x.id === id);
    if (done(t)) return t;
  }
  throw new Error(`timed out waiting for ${what}`);
}
// Tom (zh) and Jerry (en): Tom's lines carry English, everyone else's (Loop's too) Chinese, a text with 4 digits in
// a row (maybe the code) nothing. Settled = every message in the thread carries exactly that.
const expected = (m) => {
  if (/\d{4}/.test(m.text)) return {};
  return m.from === 'tom' ? mock('en', m) : mock('zh', m);
};
const settled = (t) => t.messages.every((m) => JSON.stringify(m.translations) === JSON.stringify(expected(m)));
const byText = (t, text) => t.messages.find((m) => m.text === text);

// Tom reserves Jerry's fan; the whole pickup is translated both ways, the closing line of the done thread included.
async function zhThread() {
  const seed = await ok(call('POST', '/api/reset'));
  const people = Object.fromEntries(seed.people.map((p) => [p.id, p]));
  assert.deepEqual([people.tom.lang, people.jerry.lang], ['zh', undefined], 'seed: Tom reads Chinese, Jerry the default');
  const { reservation: { code } } = await ok(call('POST', '/api/items/i_fan/reserve', { personId: 'tom' }));
  let t = await newestThread('i_fan');
  assert.deepEqual([t.ownerId, t.recipientId, t.messages.length], ['jerry', 'tom', 2]);
  t = await waitFor(t.id, settled, 'the opening messages in zh');
  assert.ok(t.messages.every((m) => m.from === 'loop' && m.translations.zh), 'both opening lines in zh');

  // Tom writes Chinese: his message gets English, Loop's (English) reply gets Chinese. The original is kept.
  const reply = (await say(t, 'tom', CHINESE)).thread.messages.at(-1);
  t = await waitFor(t.id, (x) => byText(x, CHINESE) && settled(x), "Tom's message and Loop's reply");
  assert.deepEqual([byText(t, CHINESE).from, byText(t, CHINESE).translations], ['tom', { en: `[en] ${CHINESE}` }]);
  assert.deepEqual(t.messages.find((m) => m.id === reply.id).translations, { zh: '[zh] Got it.' });

  // Jerry types a plan, Tom taps the buttons: every new line reaches Tom in Chinese.
  await say(t, 'jerry', 'Davis at 5 pm?');
  assert.equal((await act(t, 'tom', 'accept')).thread.status, 'set');
  assert.equal((await act(t, 'tom', 'arrived')).thread.status, 'meeting');
  t = await waitFor(t.id, (x) => x.messages.at(-1).text.includes('4-digit code') && settled(x), 'plan, set and arrived in zh');
  assert.equal(t.plan.place, 'Davis Library lobby');
  assert.ok(byText(t, 'Davis at 5 pm?').translations.zh);

  // The code text stays untranslated; the closing line still gets Chinese after the thread is done.
  const codeText = `我的取件码是 ${code}`;
  await say(t, 'tom', codeText);
  assert.equal((await ok(call('POST', '/api/items/i_fan/confirm', { personId: 'jerry', code }))).status, 'collected');
  t = await waitFor(t.id, (x) => x.status === 'done' && settled(x), 'the closing line in zh');
  assert.deepEqual(byText(t, codeText).translations, {});
  assert.match(t.messages.at(-1).translations.zh, /^\[zh\] Handed over/);
  assert.ok(!JSON.stringify(t.messages.map((m) => m.translations)).includes(code), 'no translation carries the code');
}

// Jerry and Jack both read English: no translations, ever. Then Thomas switches to Spanish and his new thread follows.
async function sameLanguage() {
  await ok(call('POST', '/api/items/i_book/reserve', { personId: 'jerry', ...meet }));
  let t = await newestThread('i_book');
  t = (await say(t, 'jerry', 'hello')).thread;
  assert.equal(t.messages.at(-1).text, 'Got it.');
  await ok(call('POST', '/api/items/i_book/release', { personId: 'jerry' }));
  await sleep(200); // a translation would have landed by now in mock mode
  t = await waitFor(t.id, (x) => x.status === 'cancelled', 'the cancel');
  assert.equal(t.messages.length, 4);
  for (const m of t.messages) assert.deepEqual(m.translations, {}, `no translation for "${m.text}"`);

  await expect(call('POST', '/api/people/thomas/lang', { lang: 'fr' }), 400, 'invalid_field');
  await expect(call('POST', '/api/people/thomas/lang', {}), 400, 'invalid_field');
  await expect(call('POST', '/api/people/nobody/lang', { lang: 'es' }), 404, 'unknown_person');
  const before = (await state()).version;
  const thomas = await ok(call('POST', '/api/people/thomas/lang', { lang: 'es' }));
  assert.deepEqual([thomas.id, thomas.name, thomas.lang], ['thomas', 'Thomas Hale', 'es']);
  const after = await state();
  assert.equal(after.people.find((p) => p.id === 'thomas').lang, 'es');
  assert.equal(after.version, before + 1);
  await ok(call('POST', '/api/items/i_book/reserve', { personId: 'thomas', ...meet }));
  t = await newestThread('i_book');
  t = await waitFor(t.id, (x) => x.messages[0].translations.es, "Loop's opening in Spanish for Thomas");
  assert.deepEqual([t.recipientId, t.messages.length, t.messages[0].translations], ['thomas', 1, mock('es', t.messages[0])]);
}

// iMessage (pure, no server): a phone gets the message in its person's language when the translation is already there.
function forwardsInTheirLanguage() {
  const people = [{ id: 'jerry', name: 'Jerry Lin' }, { id: 'tom', name: 'Tom Zhao', lang: 'zh' }];
  const db = (messages) => ({ people, threads: [{ id: 't_1', ownerId: 'jerry', recipientId: 'tom', plan: {}, messages }] });
  const m = (from, text, translations) => ({ id: `m_${from}`, from, text, at: '', via: 'web', actions: [], forPersonId: null, translations });
  const after = db([m('jerry', 'Davis at 5 pm?', { zh: '[zh] Davis at 5 pm?' }), m('tom', CHINESE, { en: `[en] ${CHINESE}` }), m('loop', 'Got it.', {})]);
  assert.deepEqual(threadTexts(db([]), after), [
    { personId: 'tom', text: 'Jerry: [zh] Davis at 5 pm?' },
    { personId: 'jerry', text: `Tom: [en] ${CHINESE}` },
    { personId: 'jerry', text: 'Loop: Got it.' },
    { personId: 'tom', text: 'Loop: Got it.' }, // not translated yet: the original goes out
  ]);
}

const health = await ok(call('GET', '/api/health'));
if (health.mock !== true) {
  console.error('Server is not in mock mode (GEMINI_MOCK=1). Refusing to run.');
  process.exit(2);
}
assert.equal(health.translate, true, 'health.translate');
let failed = 0;
for (let run = 1; run <= RUNS; run++) {
  try {
    forwardsInTheirLanguage();
    await zhThread();
    await sameLanguage();
    console.log(`run ${run}: PASS`);
  } catch (err) {
    failed++;
    console.log(`run ${run}: FAIL ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
