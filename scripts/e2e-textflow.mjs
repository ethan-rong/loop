// Loop in iMessage (SPEC3 §4) without a server or Spectrum: drives textflow.handleInbound directly (GEMINI_MOCK=1)
// and feeds the channel fake SDK messages (spectrum.mjs receive / readMessage / threadTexts). Phones are fake +1555
// numbers and the channel is never started, so nothing is texted. Everything runs 3 times:
//   node scripts/e2e-textflow.mjs        (DATA_DIR defaults to .tmp-f/e2e-textflow)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

process.env.GEMINI_MOCK = '1';
delete process.env.DEMO_REMINDER_SECONDS;
process.env.DATA_DIR ||= fileURLToPath(new URL('../.tmp-f/e2e-textflow', import.meta.url));
const PHONES = { ethan: '+15550100001', jerry: '+15550100002', jack: '+15550100003' };
for (const [id, phone] of Object.entries(PHONES)) process.env[`PHONE_${id.toUpperCase()}`] = phone;

const store = await import('../server/store.mjs');
const { resetToSeed } = await import('../server/seed.mjs');
const { handleInbound, itemPosted, startTextflow } = await import('../server/textflow.mjs');
const { channelStatus, readMessage, receive, threadTexts } = await import('../server/channels/spectrum.mjs');

const RUNS = 3;
const LAMP_FILE = fileURLToPath(new URL('../public/seed/lamp.jpg', import.meta.url));
const LAMP = readFileSync(LAMP_FILE);
const HEIC = heicFixture(); // null where sips can't make one
const HELP = "Text me a photo of something you don't need and I'll draft the listing. Reply STOP to unlink.";
const WELCOME = "Hi — this is Loop. Text me a photo of something you don't need and I'll draft the listing.";
const ACK = 'Got it — looking at your photo…';
const HINT = "\nReply 'works', 'here', or suggest a time.";
const LAMP_LINE = 'Desk lamp with a jointed arm, a round base, and a metal shade.';
const FITS = 'Someone nearby asked for "Reading lamp for my desk" 2 h ago — it fits. '
  + 'Reply YES to offer it, BOARD to post it for anyone, or type a correction.';
const NO_FIT = 'No open request fits yet. Reply BOARD to post it, or type a correction.';
const E164_ANYWHERE = /\+\d{8,15}/;
const PERSON_ID = /\b(ethan|jerry|jack|tom|thomas)\b/i; // internal ids; Loop never shows them

function heicFixture() {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'loop-heic-'));
    const out = join(dir, 'lamp.heic');
    execFileSync('sips', ['-s', 'format', 'heic', LAMP_FILE, '--out', out], { stdio: 'ignore' });
    const heic = readFileSync(out);
    rmSync(dir, { recursive: true, force: true });
    return heic;
  } catch {
    console.log('sips is not available: the HEIC check is skipped');
    return null;
  }
}

// Stands in for index.mjs: its own db and commit (which records what linked phones would get for new thread
// messages, through the channel's own threadTexts), and a send that only reaches linked people.
let db = null;
let outbox = []; // {personId, text} not yet checked
let everSent = []; // everything this scenario texted
let linkedNow = new Set();
let sendWorks = true;
const sent = (personId, text) => {
  outbox.push({ personId, text });
  everSent.push({ personId, text });
};
function commit(result) {
  store.saveDb(store.DATA_DIR, result.db);
  const before = db;
  db = result.db;
  for (const t of threadTexts(before, db)) if (linkedNow.has(t.personId)) sent(t.personId, t.text);
  return result;
}
startTextflow({
  getDb: () => db,
  commit,
  send: async (personId, text) => {
    if (!linkedNow.has(personId) || !sendWorks) return false;
    sent(personId, text);
    return true;
  },
  toThread: async (personId, text) => `thread:${personId}:${text}`,
  linked: (personId) => linkedNow.has(personId),
});

const say = (personId, text) => handleInbound({ personId, text });
const snap = (personId, photoBuffer = LAMP) => handleInbound({ personId, photoBuffer });
const itemById = (id) => db.items.find((i) => i.id === id);
function take(personId) { // what that person's phone got since the last take
  const mine = outbox.filter((o) => o.personId === personId).map((o) => o.text);
  outbox = outbox.filter((o) => o.personId !== personId);
  return mine;
}
function fresh(...linked) {
  db = resetToSeed(store.DATA_DIR, db?.version ?? 0);
  outbox = [];
  everSent = [];
  linkedNow = new Set(linked);
  sendWorks = true;
}
function noLeaks() {
  for (const { text } of everSent) {
    assert.ok(!E164_ANYWHERE.test(text), `a text carried a phone number: ${text}`);
    assert.ok(!PERSON_ID.test(text), `a text named a person (SPEC5): ${text}`);
  }
}

// §1 photo -> draft -> corrections -> YES -> offered; §2 jerry (the taker) accepts on the web and ethan's phone gets
// the thread's opening line, and nothing addressed to the taker reaches the taker's phone.
async function offerByText() {
  fresh('ethan', 'jerry');
  assert.equal(await say('ethan', 'hi'), WELCOME);
  assert.equal(await say('ethan', 'what is this?'), HELP);
  assert.equal(await snap('ethan'), `Adjustable desk lamp · good · ${LAMP_LINE} ${FITS}`);
  assert.deepEqual(take('ethan'), [ACK]);
  const session = db.textSessions.ethan;
  assert.deepEqual([session.state, session.matchRequestId], ['drafting', 'r_lamp']);
  assert.ok(existsSync(join(store.DATA_DIR, 'photos', `${session.photoId}.jpg`)), 'photo stored');
  assert.equal(await say('ethan', 'condition fair'), `Updated: Adjustable desk lamp · fair · ${LAMP_LINE} ${FITS}`);
  assert.equal(await say('ethan', 'title: Blue adjustable desk lamp'), `Updated: Blue adjustable desk lamp · fair · ${LAMP_LINE} ${FITS}`);
  assert.equal(await say('ethan', 'dent on base'), `Updated: Blue adjustable desk lamp · fair (dent on base) · ${LAMP_LINE} ${FITS}`);
  assert.equal(db.items.length, 2, 'nothing published before YES');
  assert.equal(await say('ethan', 'YES'), "Offered. I'll tell you when they accept and we'll sort out the pickup here.");
  const item = db.items.at(-1);
  assert.deepEqual(
    [item.ownerId, item.status, item.offeredToRequestId, item.source, item.title, item.condition, item.category, item.photo],
    ['ethan', 'offered', 'r_lamp', 'imessage', 'Blue adjustable desk lamp', 'fair', 'lighting', `/photos/${session.photoId}.jpg`],
  );
  assert.equal(item.description, `${LAMP_LINE} Dent on base.`);
  assert.equal(item.aiDraft.title, 'Adjustable desk lamp', 'aiDraft keeps the untouched Gemini draft');
  assert.equal(db.requests.find((r) => r.id === 'r_lamp').status, 'matched');
  assert.deepEqual([db.textSessions.ethan.state, db.textSessions.ethan.itemId], ['offered', item.id]);
  assert.deepEqual(take('ethan'), []);
  commit(store.reserveItem(db, item.id, { personId: 'jerry', place: 'Davis Library lobby', time: 'Today 5 pm' }));
  assert.deepEqual(take('ethan'), [`Loop: Someone reserved your Blue adjustable desk lamp and suggested Davis Library lobby, Today 5 pm. Does that work?${HINT}`]);
  assert.deepEqual(take('jerry'), [], "the giver's line is not texted to the taker");
  assert.equal(await say('ethan', 'works'), 'thread:ethan:works', 'after the offer, texts go to the pickup thread');
  noLeaks();
}

// §1 BOARD, §2 owner by text: reserved on the web; at the meeting ethan is asked to text the code; a wrong code gets
// the store's message, the right one collects. jerry has no linked phone, so Loop never texts him.
async function boardAndCode() {
  fresh('ethan');
  await snap('ethan');
  assert.equal(await say('ethan', 'BOARD'), "Posted to the board. I'll text you when someone reserves it.");
  const item = db.items.at(-1);
  assert.deepEqual([item.status, item.source, item.offeredToRequestId], ['available', 'imessage', null]);
  assert.equal(db.textSessions.jerry, undefined, 'no suggestion for a requester without a linked phone');
  assert.deepEqual(take('ethan'), [ACK]);
  const { code } = commit(store.reserveItem(db, item.id, { personId: 'jerry', place: 'Davis Library lobby', time: 'Today 5 pm' })).item.reservation;
  assert.deepEqual(take('ethan'), [`Loop: Someone reserved your Adjustable desk lamp and suggested Davis Library lobby, Today 5 pm. Does that work?${HINT}`]);
  const thread = store.newestOpenThread(db, 'ethan');
  commit(store.acceptPlan(db, thread.id, { personId: 'ethan' }));
  assert.deepEqual(take('ethan'), [`Loop: Pickup set: Davis Library lobby, Today 5 pm. Taker, tap 'I'm here' when you arrive.${HINT}`]);
  commit(store.markArrived(db, thread.id, { personId: 'jerry' }));
  assert.deepEqual(take('ethan'), ['Loop: The taker is at Davis Library lobby. Ask for the 4-digit code and text it to me.']);
  assert.equal(await say('ethan', code === '1234' ? '4321' : '1234'), "That code doesn't match. Ask the taker to show the code on their screen.");
  assert.equal(itemById(item.id).status, 'reserved');
  assert.equal(await say('ethan', `it's ${code}`), null);
  assert.equal(itemById(item.id).status, 'collected');
  assert.equal(store.getThread(db, thread.id).status, 'done');
  assert.deepEqual(take('ethan'), ['Loop: Handed over. Thanks, both — the adjustable desk lamp stays in use.']);
  assert.ok(!store.getThread(db, thread.id).messages.some((m) => m.text.includes(code)), 'the code never enters the thread');
  assert.ok(!everSent.some((t) => t.text.includes(code)), 'no text carries the code');
  assert.deepEqual(everSent.filter((t) => t.personId !== 'ethan'), [], 'the unlinked taker is never texted');
  noLeaks();
}

// §3 from a text post: jerry's open request fits and his phone is linked, so he gets one text; YES reserves it.
async function connectorByText() {
  fresh('ethan', 'jerry');
  await snap('ethan');
  await say('ethan', 'board');
  const item = db.items.at(-1);
  assert.deepEqual(take('jerry'), ['Someone just posted an adjustable desk lamp that fits your request for "Reading lamp for my desk". Reply YES to reserve it, or ignore this.']);
  assert.equal(await say('jerry', 'YES'), null);
  const reserved = itemById(item.id);
  assert.deepEqual([reserved.status, reserved.reservation.personId, reserved.reservation.requestId], ['reserved', 'jerry', 'r_lamp']);
  assert.equal(db.requests.find((r) => r.id === 'r_lamp').status, 'matched');
  assert.equal(db.textSessions.jerry.suggestion, null);
  assert.deepEqual(take('ethan'), [ACK, `Loop: Someone reserved your Adjustable desk lamp. You're the one handing it over, so you pick: when and where works for you?${HINT}`]);
  assert.deepEqual(take('jerry'), ['Loop: The giver will suggest a time and place; you can reply here too.']);
  assert.equal(await say('jerry', 'yes'), 'thread:jerry:yes', 'the next YES goes to the pickup thread');
  noLeaks();
}

// §3 from a web post whose text fails to send: it waits for ethan's next text, and that text can't answer it.
async function connectorFromWeb() {
  fresh('ethan');
  sendWorks = false;
  const { item } = commit(store.createItem(db, {
    ownerId: 'jack', photo: '/photos/i_book.jpg', title: 'Mini fridge', description: 'Small black mini fridge.', condition: 'good',
    category: 'kitchen', aiDraft: { match: { requestId: 'r_fridge', reason: 'It is a mini fridge.' } }, offerToRequestId: null,
  }));
  itemPosted(item);
  await sleep(10); // the send result arrives a moment later
  assert.equal(db.textSessions.ethan.suggestion.delivered, false);
  sendWorks = true;
  assert.equal(await say('ethan', 'hi'), WELCOME, 'written before he saw the suggestion');
  assert.equal(db.textSessions.ethan.suggestion.delivered, true);
  assert.equal(await say('ethan', 'yes'), null);
  assert.deepEqual([itemById(item.id).status, itemById(item.id).reservation.personId], ['reserved', 'ethan']);
  assert.equal(db.requests.find((r) => r.id === 'r_fridge').status, 'matched');
  assert.deepEqual(take('ethan'), ['Loop: The giver will suggest a time and place; you can reply here too.']);
  itemPosted(itemById(item.id));
  assert.deepEqual(take('ethan'), [], 'a reserved item never triggers a text');
  // Offered items and the owner's own request never trigger one either.
  const offered = commit(store.createItem(db, { ownerId: 'jack', photo: '/photos/i_book.jpg', title: 'Coat', description: '', condition: 'good',
    category: 'clothing', aiDraft: { match: { requestId: 'r_coat' } }, offerToRequestId: null })).item;
  itemPosted(offered);
  assert.deepEqual(outbox, []);
  noLeaks();
}

// HELP, not a photo, HEIC, no match, a new photo restarts the draft, and the newest question gets the text.
async function edges() {
  fresh('ethan');
  assert.equal(await say('ethan', 'help'), HELP);
  assert.equal(await snap('ethan', Buffer.from('<html>hello</html>')), "That doesn't look like a photo. Send a JPEG or PNG.");
  assert.deepEqual(take('ethan'), [], 'no "looking at your photo" for a non-photo');
  if (HEIC) {
    assert.equal(await snap('ethan', HEIC), `Adjustable desk lamp · good · ${LAMP_LINE} ${FITS}`);
    const stored = readFileSync(join(store.DATA_DIR, 'photos', `${db.textSessions.ethan.photoId}.jpg`));
    assert.equal(stored.subarray(0, 3).toString('hex'), 'ffd8ff', 'HEIC is stored as JPEG');
  }
  commit(store.closeRequest(db, 'r_lamp', 'jerry'));
  assert.equal(await snap('ethan'), `Adjustable desk lamp · good · ${LAMP_LINE} ${NO_FIT}`);
  const first = db.textSessions.ethan.photoId;
  assert.equal(await say('ethan', 'yes'), 'No open request fits it right now. Reply BOARD to post it for anyone, or type a correction.');
  assert.equal(db.textSessions.ethan.state, 'drafting');
  await snap('ethan');
  assert.notEqual(db.textSessions.ethan.photoId, first, 'a new photo restarts the draft');
  await sleep(5);
  commit(store.reserveItem(db, 'i_book', { personId: 'ethan' })); // a pickup thread newer than the draft
  assert.equal(await say('ethan', 'sounds good'), 'thread:ethan:sounds good');
  await sleep(5);
  await snap('ethan'); // now the draft is newer
  assert.equal(await say('ethan', 'condition worn'), `Updated: Adjustable desk lamp · worn · ${LAMP_LINE} ${NO_FIT}`);
  assert.equal(await say('ethan', 'HELP'), HELP);
  noLeaks();
}

// The channel with fake SDK messages: content shapes, routing, STOP, one number per person, and a reply that fails
// twice waiting for the person's next text.
async function channelChecks(run) {
  const msg = (from, content, direction = 'inbound') => ({ platform: 'imessage', direction, sender: { id: from }, content });
  const text = (t) => ({ type: 'text', text: t });
  const photo = (mimeType = 'image/jpeg', name = 'IMG_0001.JPG') =>
    ({ type: 'attachment', id: 'g1', name, mimeType, size: LAMP.length, read: async () => LAMP });
  const captioned = () => ({ type: 'group', items: [{ content: photo() }, { content: text('free lamp') }] });

  assert.deepEqual(readMessage(msg(PHONES.ethan, text(' hi '))), { from: PHONES.ethan, text: 'hi', photo: null, otherFile: false });
  const group = readMessage(msg(PHONES.ethan, captioned()));
  assert.deepEqual([group.text, group.photo?.name, group.otherFile], ['free lamp', 'IMG_0001.JPG', false]);
  assert.equal(readMessage(msg(PHONES.ethan, { type: 'reply', content: text('yes'), target: {} })).text, 'yes');
  assert.equal(readMessage(msg(PHONES.ethan, photo('image/heic', 'IMG_0002.HEIC'))).photo?.name, 'IMG_0002.HEIC');
  assert.equal(readMessage(msg(PHONES.ethan, photo('video/quicktime', 'IMG_0003.MOV'))).otherFile, true);

  const out = [];
  const space = { send: async (t) => { out.push(t); } };
  const calls = [];
  const onInbound = async (m) => {
    calls.push(m);
    return 'ok';
  };
  await receive(space, msg(PHONES.ethan, text('hi')), onInbound);
  assert.deepEqual(calls.at(-1), { personId: 'ethan', text: 'hi', photoBuffer: null });
  await receive(space, msg(PHONES.ethan, captioned()), onInbound);
  assert.deepEqual([calls.at(-1).personId, calls.at(-1).text, calls.at(-1).photoBuffer?.equals(LAMP)], ['ethan', 'free lamp', true]);
  assert.deepEqual(out, ['ok', 'ok']);
  for (const ignored of [msg(PHONES.ethan, { type: 'reaction', emoji: '👍' }), msg(PHONES.ethan, { type: 'read' }), msg(PHONES.ethan, text('echo'), 'outbound')]) {
    await receive(space, ignored, onInbound);
  }
  assert.deepEqual([calls.length, out.length], [2, 2], 'tapbacks, read receipts and our own texts are ignored');
  await receive(space, msg(PHONES.ethan, photo('video/quicktime', 'IMG_0003.MOV')), onInbound);
  assert.equal(out.at(-1), 'I can only read photos. Send a photo of the thing you want to give away.');

  const stranger = `+1555019000${run}`;
  await receive(space, msg(stranger, text('hello')), onInbound);
  await receive(space, msg(stranger, text('hello?')), onInbound);
  assert.equal(out.filter((t) => t === "This number isn't linked to a Loop handoff.").length, 1, 'a stranger is answered once');
  assert.equal(calls.length, 2, 'strangers never reach Loop');

  const temp = `temp${run}`; // STOP unlinks that person until the server restarts
  const tempPhone = `+1555020000${run}`;
  process.env[`PHONE_${temp.toUpperCase()}`] = tempPhone;
  assert.ok(channelStatus().linkedPhones.includes(temp));
  await receive(space, msg(tempPhone, text('STOP')), onInbound);
  assert.equal(out.at(-1), "Unlinked. Loop won't text you here again.");
  assert.ok(!channelStatus().linkedPhones.includes(temp));
  await receive(space, msg(tempPhone, text('hi')), onInbound);
  assert.equal(out.at(-1), "This number isn't linked to a Loop handoff.");
  assert.equal(calls.length, 2);

  process.env.PHONE_JERRY = PHONES.ethan; // one number, one person: ethan wins it
  assert.deepEqual(['ethan', 'jerry'].map((id) => channelStatus().linkedPhones.includes(id)), [true, false]);
  delete process.env.PHONE_ETHAN; // without PHONE_ETHAN the phase-2 PHONE_JERRY link keeps working
  assert.deepEqual(['ethan', 'jerry'].map((id) => channelStatus().linkedPhones.includes(id)), [false, true]);
  process.env.PHONE_ETHAN = PHONES.ethan;
  process.env.PHONE_JERRY = PHONES.jerry;

  // A reply that fails twice (one retry after 1.5 s) waits, then goes out before the answer to the next text.
  await receive({ send: async () => { throw new Error('offline'); } }, msg(PHONES.ethan, text('first')), onInbound);
  assert.equal(channelStatus().lastSendOk, false);
  const later = [];
  await receive({ send: async (t) => { later.push(t); } }, msg(PHONES.ethan, text('second')), onInbound);
  assert.deepEqual(later, ['ok', 'ok'], 'the missed reply first, then the new one');
  assert.deepEqual([channelStatus().imessage, channelStatus().lastSendOk], [false, true], 'never connected in tests; the last send worked');
}

let failed = 0;
for (let run = 1; run <= RUNS; run++) {
  try {
    await channelChecks(run);
    await offerByText();
    await boardAndCode();
    await connectorByText();
    await connectorFromWeb();
    await edges();
    console.log(`run ${run}: PASS`);
  } catch (err) {
    failed++;
    console.log(`run ${run}: FAIL ${err.message}\n${err.stack?.split('\n').slice(1, 4).join('\n')}`);
  }
}
process.exit(failed ? 1 : 0);
