// db.json persistence, the item/request state machine (SPEC "States") and handoff threads (SPEC2 §1).
// Every transition is pure: (db, ...) -> {db: nextDb, item | request | thread}. Inputs are never mutated,
// version goes up by one per mutation, and rule violations throw ApiError {status, error, message}.
import { randomBytes, randomInt } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = resolve(process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url)));

export class ApiError extends Error {
  constructor(status, error, message) {
    super(message);
    this.status = status;
    this.error = error;
  }
}

export const newId = (prefix) => `${prefix}_${randomBytes(4).toString('hex')}`;
const now = () => new Date().toISOString();
const newCode = () => String(randomInt(1, 10000)).padStart(4, '0'); // 0001..9999, never 0000

export function loadDb(dataDir) {
  try {
    return JSON.parse(readFileSync(join(dataDir, 'db.json'), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export function saveDb(dataDir, db) {
  const file = join(dataDir, 'db.json');
  writeFileSync(`${file}.tmp`, JSON.stringify(db, null, 2));
  renameSync(`${file}.tmp`, file);
}

function find(list, id, what) {
  const found = list.find((x) => x.id === id);
  if (!found) throw new ApiError(404, `unknown_${what}`, `No ${what} with that id.`);
  return found;
}
export const getPerson = (db, id) => find(db.people, id, 'person');

// SPEC5: nobody has a name. In a pickup the two people are "the giver" and "the taker" ("you" to themselves);
// anywhere else a person is "someone".
export const who = (personId, { viewer = null, thread = null } = {}) => {
  if (personId && personId === viewer) return 'you';
  if (personId && personId === thread?.ownerId) return 'the giver';
  if (personId && personId === thread?.recipientId) return 'the taker';
  return 'someone';
};

// Bilingual threads (SPEC4 §C): a person may carry `lang` (absent = English).
export const LANGUAGES = { en: 'English', zh: 'Simplified Chinese', es: 'Spanish' };
export const langOf = (db, id) => db.people.find((p) => p.id === id)?.lang ?? 'en';

export function setPersonLang(db, id, lang) {
  const person = getPerson(db, id);
  if (!Object.hasOwn(LANGUAGES, lang)) throw new ApiError(400, 'invalid_field', `lang must be one of: ${Object.keys(LANGUAGES).join(', ')}.`);
  const updated = { ...person, lang };
  return { db: next(db, { people: db.people.map((p) => (p.id === id ? updated : p)) }), person: updated };
}

// SPEC5: an anonymous person (a new browser tab) is an opaque id and a thread language, nothing else.
// ponytail: a flat cap instead of a rate limit; reset clears the extras.
const MAX_PEOPLE = 50;
export function createPerson(db) {
  if (db.people.length >= MAX_PEOPLE) throw new ApiError(429, 'too_many_people', 'This demo is full. Reset it to make room.');
  const person = { id: newId('p'), lang: 'en' };
  return { db: next(db, { people: [...db.people, person] }), person };
}

const putItem = (db, item) => db.items.map((x) => (x.id === item.id ? item : x));
const patchRequest = (requests, id, patch) => (id ? requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) : requests);
const threadsOf = (db) => db.threads ?? []; // older db.json files have no threads key
const next = (db, { items = db.items, requests = db.requests, threads = threadsOf(db), people = db.people }) =>
  ({ ...db, people, items, requests, threads, version: db.version + 1 });
const reopen = { status: 'open', matchedItemId: null };

function claimedError(db, item) {
  const holder = item.reservation?.personId ?? db.requests.find((r) => r.id === item.offeredToRequestId)?.personId;
  return new ApiError(409, 'already_claimed', holder ? 'Someone got there first.' : 'The giver took this back.');
}

export function createRequest(db, { personId, title, details }) {
  getPerson(db, personId);
  const request = { id: newId('r'), personId, title, details, status: 'open', matchedItemId: null, createdAt: now() };
  return { db: next(db, { requests: [...db.requests, request] }), request };
}

export function closeRequest(db, id, personId) {
  const request = find(db.requests, id, 'request');
  getPerson(db, personId);
  if (request.personId !== personId) throw new ApiError(403, 'not_yours', 'Only the person who asked can remove this request.');
  if (request.status !== 'open') throw new ApiError(409, 'request_not_open', 'Only open requests can be removed.');
  const closed = { ...request, status: 'closed' };
  return { db: next(db, { requests: patchRequest(db.requests, id, { status: 'closed' }) }), request: closed };
}

export function createItem(db, { ownerId, photo, title, description, condition, category, aiDraft, offerToRequestId }) {
  getPerson(db, ownerId);
  const offer = offerToRequestId ? find(db.requests, offerToRequestId, 'request') : null;
  if (offer?.personId === ownerId) throw new ApiError(400, 'own_request', "You can't offer something to your own request.");
  if (offer && offer.status !== 'open') throw new ApiError(409, 'request_not_open', 'That request already has a match.');
  const item = {
    id: newId('i'), ownerId, photo, title, description, condition, category, aiDraft,
    status: offer ? 'offered' : 'available', offeredToRequestId: offer?.id ?? null,
    reservation: null, collectedAt: null, createdAt: now(),
  };
  const requests = patchRequest(db.requests, offer?.id, { status: 'matched', matchedItemId: item.id });
  return { db: next(db, { items: [...db.items, item], requests }), item };
}

// Reserve an available item, or accept an item offered to one of my requests. Also opens the
// handoff thread (SPEC2 §1). Place and time are optional, but only as a pair: with them Loop asks the
// owner to confirm; without them the owner picks (plan stays empty until someone proposes).
export function reserveItem(db, id, { personId, requestId, place = null, time = null, timeISO = null }) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (!place !== !time) throw new ApiError(400, 'missing_field', 'Pick both a place and a time, or leave both empty.');
  if (item.ownerId === personId) throw new ApiError(403, 'own_item', "You can't reserve your own item.");
  const offer = item.status === 'offered' ? db.requests.find((r) => r.id === item.offeredToRequestId) : null;
  const offeredToMe = offer?.personId === personId;
  if (item.status !== 'available' && !offeredToMe) throw claimedError(db, item);
  let link = offeredToMe ? offer.id : null;
  let requests = db.requests;
  if (!offeredToMe && requestId) {
    const request = find(db.requests, requestId, 'request');
    if (request.personId !== personId) throw new ApiError(403, 'not_yours', 'You can only link your own request.');
    if (request.status !== 'open') throw new ApiError(409, 'request_not_open', 'That request already has a match.');
    link = request.id;
    requests = patchRequest(requests, link, { status: 'matched', matchedItemId: item.id });
  }
  const reserved = {
    ...item, status: 'reserved', offeredToRequestId: null,
    reservation: { personId, requestId: link, place, time, code: newCode(), at: now() },
  };
  const hello = `Someone reserved your ${item.title}`;
  const thread = {
    id: newId('t'), itemId: item.id, ownerId: item.ownerId, recipientId: personId, status: 'planning',
    plan: place
      ? { place, time, timeISO: timeISO ?? null, proposedBy: personId, confirmedBy: [personId] }
      : { place: null, time: null, timeISO: null, proposedBy: null, confirmedBy: [] },
    remindAt: null, reminded: false,
    messages: place
      ? [message('loop', `${hello} and suggested ${place}, ${time}. Does that work?`, { actions: PLAN_ACTIONS, forPersonId: item.ownerId })]
      : [
        message('loop', `${hello}. You're the one handing it over, so you pick: when and where works for you?`, { actions: PICK_ACTIONS, forPersonId: item.ownerId }),
        message('loop', 'The giver will suggest a time and place; you can reply here too.', { forPersonId: personId }),
      ],
  };
  return { db: next(db, { items: putItem(db, reserved), requests, threads: [...threadsOf(db), thread] }), item: reserved, thread };
}

export function declineItem(db, id, personId) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.status !== 'offered') throw new ApiError(409, 'not_offered', 'This is no longer on offer.');
  const offer = db.requests.find((r) => r.id === item.offeredToRequestId);
  if (offer?.personId !== personId) throw new ApiError(403, 'not_yours', 'Only the person it was offered to can decline it.');
  const available = { ...item, status: 'available', offeredToRequestId: null };
  return { db: next(db, { items: putItem(db, available), requests: patchRequest(db.requests, offer.id, reopen) }), item: available };
}

// `say` replaces Loop's closing line (the coordinator's reply when the cancel came from free text).
export function releaseItem(db, id, personId, say = null) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.status !== 'reserved') throw new ApiError(409, 'not_reserved', 'This is not reserved right now.');
  if (personId !== item.ownerId && personId !== item.reservation.personId) {
    throw new ApiError(403, 'not_allowed', 'Only the giver or the taker can cancel.');
  }
  const available = { ...item, status: 'available', reservation: null };
  const requests = patchRequest(db.requests, item.reservation.requestId, reopen);
  const { threads, thread } = closeItemThread(db, id, 'cancelled',
    say || `Reservation cancelled. The ${noun(item.title)} is back on the board.`);
  return { db: next(db, { items: putItem(db, available), requests, threads }), item: available, thread };
}

export function confirmItem(db, id, personId, code) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.ownerId !== personId) throw new ApiError(403, 'not_owner', 'Only the giver can confirm the handoff.');
  if (item.status !== 'reserved') throw new ApiError(409, 'not_reserved', 'This is not reserved right now.');
  if (code !== item.reservation.code) {
    throw new ApiError(403, 'wrong_code', "That code doesn't match. Ask the taker to show the code on their screen.");
  }
  const collected = { ...item, status: 'collected', collectedAt: now() };
  const requests = patchRequest(db.requests, item.reservation.requestId, { status: 'fulfilled' });
  const { threads, thread } = closeItemThread(db, id, 'done', `Handed over. Thanks, both — the ${noun(item.title)} stays in use.`);
  return { db: next(db, { items: putItem(db, collected), requests, threads }), item: collected, thread };
}

export function withdrawItem(db, id, personId) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.ownerId !== personId) throw new ApiError(403, 'not_owner', 'Only the giver can take this back.');
  if (item.status !== 'available' && item.status !== 'offered') {
    throw new ApiError(409, 'cant_withdraw', item.status === 'reserved'
      ? 'Cancel the reservation before taking this back.'
      : 'This is already off the board.');
  }
  const withdrawn = { ...item, status: 'withdrawn', offeredToRequestId: null };
  const requests = patchRequest(db.requests, item.offeredToRequestId, reopen);
  return { db: next(db, { items: putItem(db, withdrawn), requests }), item: withdrawn };
}

// "Pass it on again": the taker of a collected item lists it anew, same photo and words, one lap further round.
// Items from before laps have no `lap`: read it as 1 everywhere. Once per item, so a retry can't list it twice.
export function repostItem(db, id, personId) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.status !== 'collected') throw new ApiError(409, 'not_collected', 'Only something already handed over can be passed on again.');
  if (item.reservation?.personId !== personId) throw new ApiError(403, 'not_taker', 'Only the person who collected this can pass it on.');
  if (db.items.some((i) => i.fromItemId === id)) throw new ApiError(409, 'already_passed_on', 'You already passed this on.');
  const { photo, title, description, condition, category } = item;
  const passed = {
    id: newId('i'), ownerId: personId, photo, title, description, condition, category, aiDraft: null,
    status: 'available', offeredToRequestId: null, reservation: null, collectedAt: null, createdAt: now(),
    lap: (item.lap ?? 1) + 1, fromItemId: item.id,
  };
  return { db: next(db, { items: [...db.items, passed] }), item: passed };
}

// ---- Handoff threads (SPEC2 §1): owner + recipient + Loop, one per reservation ----
// Same rules as above: pure, version + 1 per mutation, ApiError on violations. `say` (optional) replaces
// Loop's template line with the coordinator's reply; the buttons stay the transition's own.
const OPEN = ['planning', 'set', 'meeting'];
const REMIND_LEAD_MS = 30 * 60_000;
const PLAN_ACTIONS = [{ label: 'Works for me', action: 'accept' }, { label: 'Suggest another time', action: 'propose' }];
const PICK_ACTIONS = [{ label: 'Suggest a time and place', action: 'propose' }];

export const isOpenThread = (thread) => OPEN.includes(thread.status);
export const getThread = (db, id) => find(threadsOf(db), id, 'thread');
export const newestOpenThread = (db, personId) =>
  threadsOf(db).findLast((t) => isOpenThread(t) && (t.ownerId === personId || t.recipientId === personId)) ?? null;
// DEMO_REMINDER_SECONDS=n: the reminder fires n seconds after the plan is set instead of 30 min before it.
export const reminderDemoSeconds = () => Math.max(0, Number(process.env.DEMO_REMINDER_SECONDS) || 0);

const noun = (title) => (/^[A-Z][a-z]/.test(title) ? title[0].toLowerCase() + title.slice(1) : title);
const putThread = (db, thread) => threadsOf(db).map((t) => (t.id === thread.id ? thread : t));
const otherOf = (thread, personId) => (personId === thread.ownerId ? thread.recipientId : thread.ownerId);
const closed = () => new ApiError(409, 'thread_closed', 'This pickup is already closed.');

// translations: {lang: text}, filled in a moment later by the translation hook (index.mjs, SPEC4 §C).
function message(from, text, { via = 'system', actions = [], forPersonId = null } = {}) {
  return { id: newId('m'), from, text, at: now(), via, actions, forPersonId, translations: {} };
}

// Append a message (patching the thread first). A Loop message with buttons, or a closed thread, retires
// the buttons on every earlier message, so at most one message ever carries live buttons.
function withMessage(thread, msg, patch = {}) {
  const updated = { ...thread, ...patch };
  const retire = msg.actions.length > 0 || !isOpenThread(updated);
  const earlier = retire ? thread.messages.map((m) => (m.actions.length ? { ...m, actions: [] } : m)) : thread.messages;
  return { ...updated, messages: [...earlier, msg] };
}

// Close the item's open thread, if any (items reserved before phase 2 have none).
function closeItemThread(db, itemId, status, text) {
  const open = threadsOf(db).find((t) => t.itemId === itemId && isOpenThread(t));
  if (!open) return { threads: threadsOf(db), thread: null };
  const thread = withMessage(open, message('loop', text), { status });
  return { threads: putThread(db, thread), thread };
}

// Lookup + guards shared by every participant action: 404 thread/person, 403 not_participant, 409 thread_closed.
function participantThread(db, id, personId) {
  const thread = getThread(db, id);
  getPerson(db, personId);
  if (personId !== thread.ownerId && personId !== thread.recipientId) {
    throw new ApiError(403, 'not_participant', 'Only the two people in this pickup can do that.');
  }
  if (!isOpenThread(thread)) throw closed();
  return thread;
}

const saved = (db, thread) => ({ db: next(db, { threads: putThread(db, thread) }), thread });

// New time and/or place. Omitted fields keep the current value, but the result must have both
// (an empty plan needs both at once); everyone has to agree again.
export function proposePlan(db, id, { personId, place = null, time = null, timeISO = null, say = null }) {
  const thread = participantThread(db, id, personId);
  if (!place && !time) throw new ApiError(400, 'missing_field', 'Suggest a time and a place.');
  const old = thread.plan;
  const plan = {
    place: place || old.place, time: time || old.time, timeISO: (time ? timeISO : old.timeISO) ?? null,
    proposedBy: personId, confirmedBy: [personId],
  };
  if (!plan.place) throw new ApiError(400, 'missing_field', 'Add a place too, like Davis Library lobby.');
  if (!plan.time) throw new ApiError(400, 'missing_field', 'Add a time too, like Today 5 pm.');
  const other = otherOf(thread, personId);
  const text = say || `New suggestion from ${who(personId, { thread })}: ${plan.place}, ${plan.time}. Does that work for you?`;
  const updated = withMessage(thread, message('loop', text, { actions: PLAN_ACTIONS, forPersonId: other }),
    { status: 'planning', plan, remindAt: null, reminded: false });
  const item = db.items.find((i) => i.id === thread.itemId);
  const items = item?.reservation
    ? putItem(db, { ...item, reservation: { ...item.reservation, place: plan.place, time: plan.time } })
    : db.items;
  return { db: next(db, { items, threads: putThread(db, updated) }), thread: updated };
}

// `set` needs a place, a time and both people. The proposer is always in confirmedBy, so in practice
// the other person's accept completes the plan.
export function acceptPlan(db, id, { personId, say = null }) {
  const thread = participantThread(db, id, personId);
  const { plan } = thread;
  if (!plan.place || !plan.time) {
    throw new ApiError(409, 'plan_incomplete', 'Nothing to agree to yet. Suggest a time and place first.');
  }
  if (plan.confirmedBy.includes(personId)) {
    throw new ApiError(409, 'already_confirmed', `You already agreed to ${plan.place}, ${plan.time}.`);
  }
  const confirmedBy = [...plan.confirmedBy, personId];
  if (![thread.ownerId, thread.recipientId].every((p) => confirmedBy.includes(p))) {
    return saved(db, { ...thread, plan: { ...plan, confirmedBy } }); // unreachable while the proposer invariant holds
  }
  const demo = reminderDemoSeconds();
  const due = Date.parse(plan.timeISO) - REMIND_LEAD_MS; // NaN without timeISO -> no reminder
  const remindAt = demo ? new Date(Date.now() + demo * 1000).toISOString() : due > Date.now() ? new Date(due).toISOString() : null;
  const text = say || `Pickup set: ${plan.place}, ${plan.time}.${remindAt ? " I'll remind you both 30 minutes before." : ''} Taker, tap 'I'm here' when you arrive.`;
  const actions = [{ label: "I'm here", action: 'arrived', forPersonId: thread.recipientId }, { label: "Can't make it", action: 'cancel' }];
  return saved(db, withMessage(thread, message('loop', text, { actions }),
    { status: 'set', plan: { ...plan, confirmedBy }, remindAt, reminded: false }));
}

export function markArrived(db, id, { personId, say = null }) {
  const thread = participantThread(db, id, personId);
  if (personId !== thread.recipientId) throw new ApiError(403, 'not_recipient', "Only the taker can say they've arrived.");
  if (thread.status !== 'set') {
    throw new ApiError(409, 'not_set', thread.status === 'meeting' ? "You're already marked as here." : 'Agree on a time and place first.');
  }
  const text = say || `The taker is at ${thread.plan.place}. Ask for the 4-digit code and type it on the item page.`;
  // enter_code is client-side only: it opens the code input on the item page.
  return saved(db, withMessage(thread, message('loop', text, { actions: [{ label: 'Enter code', action: 'enter_code' }], forPersonId: thread.ownerId }),
    { status: 'meeting' }));
}

// Either person, any open status: same as releasing the item (request reopens, thread cancelled).
export function cancelThread(db, id, { personId, say = null }) {
  const thread = participantThread(db, id, personId);
  return releaseItem(db, thread.itemId, personId, say);
}

export function postHumanMessage(db, id, { personId, text, via = 'web' }) {
  const thread = participantThread(db, id, personId);
  return saved(db, withMessage(thread, message(personId, text, { via })));
}

export function postLoopMessage(db, id, text) {
  const thread = getThread(db, id);
  if (!isOpenThread(thread)) throw closed();
  return saved(db, withMessage(thread, message('loop', text)));
}

// One message's translation (SPEC4 §C). Additive: the original text never changes. Closed threads too (their
// closing line arrives with the close). A thread or message that is gone (reset meanwhile) is a no-op: same db.
export function setTranslation(db, threadId, messageId, lang, text) {
  const thread = threadsOf(db).find((t) => t.id === threadId);
  if (!thread?.messages.some((m) => m.id === messageId)) return { db, thread: thread ?? null };
  const messages = thread.messages.map((m) => (m.id === messageId ? { ...m, translations: { ...m.translations, [lang]: text } } : m));
  return saved(db, { ...thread, messages });
}

// Posts once per agreed plan; anything else is a no-op (same db, no version bump).
// `force` = the demo route asked for it now, so the text says it was sped up.
export function postReminder(db, id, { force = false } = {}) {
  const thread = getThread(db, id);
  if (thread.status !== 'set' || thread.reminded) return { db, thread };
  const sped = force || reminderDemoSeconds() > 0 ? ' (demo: reminder sped up)' : '';
  return saved(db, withMessage(thread, message('loop', `Reminder: pickup in 30 minutes at ${thread.plan.place}.${sped}`), { reminded: true }));
}
