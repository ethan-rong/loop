// Bilingual threads (SPEC4 §C) at the API level, 3 runs against a running mock server:
//   GEMINI_MOCK=1 PORT=3700 DATA_DIR=.tmp-g/data node server/index.mjs &
//   PORT=3700 node scripts/e2e-translate.mjs        (BASE_URL overrides http://localhost:$PORT)
// Refuses to run unless the server reports mock mode, so it never spends real Gemini calls (mock: "[lang] text").
// Translations land a moment after the message (their own commit), so the checks poll GET /api/state.
// The phone forwards run in-process (no server, no Spectrum): index.mjs's commit with recording phones.
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { threadTexts, translationTexts } from '../server/channels/spectrum.mjs';
import { resetToSeed } from '../server/seed.mjs';
import * as store from '../server/store.mjs';
import { startTranslations } from '../server/translate.mjs';

process.env.GEMINI_MOCK = '1'; // the in-process translations are mock ones too

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3700}`;
const RUNS = 3;
const WAIT_MS = 3000;
const CHINESE = '我六点在图书馆可以吗';
const meet = { place: 'Davis Library lobby', time: 'Today 5 pm' };
const HINT = "\nReply 'works', 'here', or suggest a time.";
const PHONES_DIR = fileURLToPath(new URL('../.tmp-h/phones', import.meta.url));

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
// tom (zh) and jerry (en): tom's lines carry English, everyone else's (Loop's too) Chinese, a text with 4 digits in
// a row (maybe the code) nothing. Settled = every message in the thread carries exactly that.
const expected = (m) => {
  if (/\d{4}/.test(m.text)) return {};
  return m.from === 'tom' ? mock('en', m) : mock('zh', m);
};
const settled = (t) => t.messages.every((m) => JSON.stringify(m.translations) === JSON.stringify(expected(m)));
const byText = (t, text) => t.messages.find((m) => m.text === text);

// tom reserves jerry's fan; the whole pickup is translated both ways, the closing line of the done thread included.
async function zhThread() {
  const seed = await ok(call('POST', '/api/reset'));
  await ok(call('POST', '/api/people/tom/lang', { lang: 'zh' })); // the seed is English-only; this test opts tom into Chinese
  const people = Object.fromEntries((await ok(call('GET', '/api/state'))).people.map((p) => [p.id, p]));
  assert.deepEqual([people.tom, people.jerry], [{ id: 'tom', lang: 'zh' }, { id: 'jerry', lang: 'en' }], 'tom reads Chinese, jerry English; nothing else');
  void seed;
  const { reservation: { code } } = await ok(call('POST', '/api/items/i_fan/reserve', { personId: 'tom' }));
  let t = await newestThread('i_fan');
  assert.deepEqual([t.ownerId, t.recipientId, t.messages.length], ['jerry', 'tom', 2]);
  t = await waitFor(t.id, settled, 'the opening messages in zh');
  assert.ok(t.messages.every((m) => m.from === 'loop' && m.translations.zh), 'both opening lines in zh');

  // tom writes Chinese: his message gets English, Loop's (English) reply gets Chinese. The original is kept.
  const reply = (await say(t, 'tom', CHINESE)).thread.messages.at(-1);
  t = await waitFor(t.id, (x) => byText(x, CHINESE) && settled(x), "tom's message and Loop's reply");
  assert.deepEqual([byText(t, CHINESE).from, byText(t, CHINESE).translations], ['tom', { en: `[en] ${CHINESE}` }]);
  assert.deepEqual(t.messages.find((m) => m.id === reply.id).translations, { zh: '[zh] Got it.' });

  // jerry types a plan, tom taps the buttons: every new line reaches tom in Chinese.
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

// jerry and jack both read English: no translations, ever. Then thomas switches to Spanish and his new thread follows.
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
  assert.deepEqual(thomas, { id: 'thomas', lang: 'es' });
  const after = await state();
  assert.equal(after.people.find((p) => p.id === 'thomas').lang, 'es');
  assert.equal(after.version, before + 1);
  await ok(call('POST', '/api/items/i_book/reserve', { personId: 'thomas', ...meet }));
  t = await newestThread('i_book');
  t = await waitFor(t.id, (x) => x.messages[0].translations.es, "Loop's opening in Spanish for thomas");
  assert.deepEqual([t.recipientId, t.messages.length, t.messages[0].translations], ['thomas', 1, mock('es', t.messages[0])]);
}

// Stands in for index.mjs's commit() (same two calls) with phones that record what they get; everyone counts as linked.
function phones(translate) {
  let db = store.setPersonLang(resetToSeed(PHONES_DIR), 'tom', 'zh').db;
  let inbox = [];
  const forward = (after, job, translated) => inbox.push(...translationTexts(after, job, translated));
  const commit = (result) => {
    const before = db;
    db = result.db;
    const translating = startTranslations(before, db, { getDb: () => db, commit, forward, translate });
    inbox.push(...threadTexts(before, db, translating));
    return result;
  };
  const take = () => {
    const got = inbox;
    inbox = [];
    return got;
  };
  return { commit, take, db: () => db };
}
const settle = () => sleep(20); // mock translations land within a few microtasks

// iMessage: a phone that reads another language gets the message once, translated; the same language at once, as
// written; a failed translation (null or a throw) still delivers the original once.
async function phoneForwards() {
  let p = phones();
  const { thread: fan } = p.commit(store.reserveItem(p.db(), 'i_fan', { personId: 'tom' }));
  assert.deepEqual(p.take(), [{ personId: 'jerry', text: `Loop: Someone reserved your Small desk fan. You're the one handing it over, so you pick: when and where works for you?${HINT}` }]);
  await settle();
  assert.deepEqual(p.take(), [{ personId: 'tom', text: 'Loop: [zh] The giver will suggest a time and place; you can reply here too.' }]);
  p.commit(store.postHumanMessage(p.db(), fan.id, { personId: 'tom', text: CHINESE }));
  assert.deepEqual(p.take(), [], "held back until it's translated");
  await settle();
  assert.deepEqual(p.take(), [{ personId: 'jerry', text: `Taker: [en] ${CHINESE}` }]);
  p.commit(store.postLoopMessage(p.db(), fan.id, 'Got it.'));
  assert.deepEqual(p.take(), [{ personId: 'jerry', text: 'Loop: Got it.' }]);
  await settle();
  assert.deepEqual(p.take(), [{ personId: 'tom', text: 'Loop: [zh] Got it.' }]);
  await settle();
  assert.deepEqual(p.take(), [], 'each exactly once');
  assert.deepEqual(store.getThread(p.db(), fan.id).messages.map((m) => Object.keys(m.translations)), [['zh'], ['zh'], ['en'], ['zh']]);

  const { thread: book } = p.commit(store.reserveItem(p.db(), 'i_book', { personId: 'jerry', ...meet }));
  p.commit(store.postHumanMessage(p.db(), book.id, { personId: 'jerry', text: 'hello' }));
  assert.deepEqual(p.take(), [
    { personId: 'jack', text: `Loop: Someone reserved your Intro to Psychology textbook (8th ed.) and suggested Davis Library lobby, Today 5 pm. Does that work?${HINT}` },
    { personId: 'jack', text: 'Taker: hello' },
  ]);
  await settle();
  assert.deepEqual(p.take(), [], 'same language: nothing held back, nothing twice');

  for (const failing of [async () => null, async () => { throw new Error('offline'); }]) {
    p = phones(failing);
    const { thread } = p.commit(store.reserveItem(p.db(), 'i_fan', { personId: 'tom' }));
    p.commit(store.postHumanMessage(p.db(), thread.id, { personId: 'tom', text: CHINESE }));
    assert.deepEqual(p.take().map((t) => t.personId), ['jerry'], "only jerry's own-language line goes out at once");
    await settle();
    assert.deepEqual(p.take(), [
      { personId: 'tom', text: 'Loop: The giver will suggest a time and place; you can reply here too.' },
      { personId: 'jerry', text: `Taker: ${CHINESE}` },
    ], 'failed translation: the original, once');
    await settle();
    assert.deepEqual(p.take(), []);
    assert.ok(store.getThread(p.db(), thread.id).messages.every((m) => !Object.keys(m.translations).length), 'nothing stored');
  }
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
    await phoneForwards();
    await zhThread();
    await sameLanguage();
    console.log(`run ${run}: PASS`);
  } catch (err) {
    failed++;
    console.log(`run ${run}: FAIL ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
