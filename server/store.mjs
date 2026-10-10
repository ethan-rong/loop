// db.json persistence and the item/request state machine (SPEC "States").
// Every transition is pure: (db, ...) -> {db: nextDb, item | request}. Inputs are never mutated,
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
const firstName = (db, id) => db.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';

const putItem = (db, item) => db.items.map((x) => (x.id === item.id ? item : x));
const patchRequest = (requests, id, patch) => (id ? requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) : requests);
const next = (db, { items = db.items, requests = db.requests }) => ({ ...db, items, requests, version: db.version + 1 });
const reopen = { status: 'open', matchedItemId: null };

function claimedError(db, item) {
  const holder = item.reservation?.personId ?? db.requests.find((r) => r.id === item.offeredToRequestId)?.personId;
  return new ApiError(409, 'already_claimed', holder
    ? `${firstName(db, holder)} got there first.`
    : `${firstName(db, item.ownerId)} took this back.`);
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
  if (offer && offer.status !== 'open') throw new ApiError(409, 'request_not_open', `${firstName(db, offer.personId)}'s request already has a match.`);
  const item = {
    id: newId('i'), ownerId, photo, title, description, condition, category, aiDraft,
    status: offer ? 'offered' : 'available', offeredToRequestId: offer?.id ?? null,
    reservation: null, collectedAt: null, createdAt: now(),
  };
  const requests = patchRequest(db.requests, offer?.id, { status: 'matched', matchedItemId: item.id });
  return { db: next(db, { items: [...db.items, item], requests }), item };
}

// Reserve an available item, or accept an item offered to one of my requests.
export function reserveItem(db, id, { personId, requestId, place, time }) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
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
  return { db: next(db, { items: putItem(db, reserved), requests }), item: reserved };
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

export function releaseItem(db, id, personId) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.status !== 'reserved') throw new ApiError(409, 'not_reserved', 'This is not reserved right now.');
  if (personId !== item.ownerId && personId !== item.reservation.personId) {
    throw new ApiError(403, 'not_allowed', 'Only the owner or the person who reserved it can cancel.');
  }
  const available = { ...item, status: 'available', reservation: null };
  const requests = patchRequest(db.requests, item.reservation.requestId, reopen);
  return { db: next(db, { items: putItem(db, available), requests }), item: available };
}

export function confirmItem(db, id, personId, code) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.ownerId !== personId) throw new ApiError(403, 'not_owner', 'Only the owner can confirm the handoff.');
  if (item.status !== 'reserved') throw new ApiError(409, 'not_reserved', 'This is not reserved right now.');
  if (code !== item.reservation.code) {
    const name = firstName(db, item.reservation.personId);
    throw new ApiError(403, 'wrong_code', `That code doesn't match. Ask ${name} to show the code on their screen.`);
  }
  const collected = { ...item, status: 'collected', collectedAt: now() };
  const requests = patchRequest(db.requests, item.reservation.requestId, { status: 'fulfilled' });
  return { db: next(db, { items: putItem(db, collected), requests }), item: collected };
}

export function withdrawItem(db, id, personId) {
  const item = find(db.items, id, 'item');
  getPerson(db, personId);
  if (item.ownerId !== personId) throw new ApiError(403, 'not_owner', 'Only the owner can take this back.');
  if (item.status !== 'available' && item.status !== 'offered') {
    throw new ApiError(409, 'cant_withdraw', item.status === 'reserved'
      ? 'Cancel the reservation before taking this back.'
      : 'This is already off the board.');
  }
  const withdrawn = { ...item, status: 'withdrawn', offeredToRequestId: null };
  const requests = patchRequest(db.requests, item.offeredToRequestId, reopen);
  return { db: next(db, { items: putItem(db, withdrawn), requests }), item: withdrawn };
}
