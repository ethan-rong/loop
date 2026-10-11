// Loop server: static files, JSON API (SPEC "API"), one log line per request, central error handler.
import './env.mjs';
import express from 'express';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { channelStatus, forwardNewMessages, forwardTranslation, sendToPerson, startChannel } from './channels/spectrum.mjs';
import { coordinate } from './coordinator.mjs';
import { CATEGORIES, CONDITIONS, clamp, describeItem, isMock, modelName, suggestItems } from './gemini.mjs';
import { pileRouter } from './pile.mjs';
import { convertRouter } from './convert.mjs';
import { resetToSeed } from './seed.mjs';
import * as store from './store.mjs';
import { handleInbound, itemPosted, startTextflow } from './textflow.mjs';
import { startTranslations, translateOn } from './translate.mjs';

const { ApiError, DATA_DIR } = store;
const PORT = Number(process.env.PORT) || 3000;
const PHOTOS_DIR = join(DATA_DIR, 'photos');
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_AI_DRAFT_CHARS = 4000;
const ID_MAX = 40;
// Magic bytes per accepted mimeType: [offset, hex].
const SIGNATURES = {
  'image/jpeg': [[0, 'ffd8ff']],
  'image/png': [[0, '89504e47']],
  'image/webp': [[0, '52494646'], [8, '57454250']],
};

mkdirSync(PHOTOS_DIR, { recursive: true });
let db = store.loadDb(DATA_DIR) ?? resetToSeed(DATA_DIR);

// Persist a transition's new state, then swap it in. Sync on purpose: no interleaved writes.
// New thread messages get translated for a reader of another language (SPEC4 §C; async, each lands later as its own
// commit) and go out to linked phones (no-op unless the iMessage channel is connected): right away in the message's
// own language, after its translation (or the original if that failed) to a phone that reads the other one.
function commit(result) {
  store.saveDb(DATA_DIR, result.db);
  const before = db;
  db = result.db;
  const translating = startTranslations(before, db, { getDb: () => db, commit, forward: forwardTranslation });
  forwardNewMessages(before, db, translating);
  return result;
}

function body(req) {
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ApiError(400, 'bad_body', 'Send a JSON object with Content-Type: application/json.');
  return b;
}

function text(b, key, max, required = true) {
  const value = b[key] ?? '';
  if (typeof value !== 'string') throw new ApiError(400, 'invalid_field', `${key} must be text.`);
  const s = value.trim();
  if (required && !s) throw new ApiError(400, 'missing_field', `${key} is required.`);
  if (s.length > max) throw new ApiError(400, 'too_long', `${key} must be ${max} characters or fewer.`);
  return s;
}

function oneOf(b, key, allowed) {
  if (!allowed.includes(b[key])) throw new ApiError(400, 'invalid_field', `${key} must be one of: ${allowed.join(', ')}.`);
  return b[key];
}

// Optional ISO date-time (client quick picks); normalised to UTC "…Z", null when absent.
function isoTime(b, key) {
  const value = b[key];
  if (value === undefined || value === null || value === '') return null;
  const ms = typeof value === 'string' && value.length <= 40 ? Date.parse(value) : NaN;
  if (Number.isNaN(ms)) throw new ApiError(400, 'invalid_field', `${key} must be a date and time like 2026-10-10T21:00:00.000Z.`);
  return new Date(ms).toISOString();
}

// Optional price in whole US dollars: absent, null or empty = free (null). Loop never handles money; it only shows it.
const MAX_PRICE = 500;
function dollars(b, key) {
  const value = b[key];
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isInteger(value) || value < 1 || value > MAX_PRICE) {
    throw new ApiError(400, 'invalid_field', `${key} must be a whole number of dollars from 1 to ${MAX_PRICE}, or empty for free.`);
  }
  return value;
}

const looksLike = (buf, mime) =>
  SIGNATURES[mime].every(([at, hex]) => buf.subarray(at, at + hex.length / 2).toString('hex') === hex);

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    if (path === '/api/state' && res.statusCode < 400) return; // 1.5 s polling would drown the log
    console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});
app.use(express.json({ limit: '8mb' }));
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
app.use('/photos', express.static(PHOTOS_DIR));

app.get('/api/health', (req, res) => {
  const { imessage, lastSendOk, lineNumber, linkedPhones } = channelStatus(); // person ids only, never their numbers
  res.json({
    ok: true, mock: isMock(), model: modelName(), imessage, lastSendOk, lineNumber,
    linkedPhones: linkedPhones.filter((id) => db.people.some((p) => p.id === id)),
    textSessions: Object.keys(db.textSessions ?? {}).length,
    translate: translateOn(),
  });
});
// SPEC5: people go out as {id, lang} only. Names never leave the server, even from an older db.json that still has them.
const publicPerson = ({ id, lang }) => ({ id, lang: lang ?? 'en' });
const publicDb = (d) => ({ ...d, people: d.people.map(publicPerson) });

app.get('/api/state', (req, res) => res.json(publicDb(db)));

// SPEC5, demo only (no auth): a new browser tab gets an anonymous person {id, lang: 'en'}.
app.post('/api/people', (req, res) => {
  res.json(publicPerson(commit(store.createPerson(db)).person));
});

// SPEC4 §C, demo only (no auth): a person's thread language, en | zh | es.
// Loop's texts for this tab: linked = a phone is on file (env or a texted code); code = what to text to link one.
// ponytail: codes live in memory with no expiry; a restart clears them and the page asks for a fresh one.
const linkCodes = new Map(); // code -> personId
app.get('/api/people/:id/texts', (req, res) => {
  const { id } = store.getPerson(db, req.params.id);
  let code = [...linkCodes].find(([, personId]) => personId === id)?.[0];
  if (!code) {
    do code = String(1000 + Math.floor(Math.random() * 9000)); while (linkCodes.has(code));
    linkCodes.set(code, id);
  }
  const { lineNumber, linkedPhones } = channelStatus();
  res.json({ linked: linkedPhones.includes(id), code, lineNumber });
});
// A stranger texted the 4-digit code from the web page: their phone now belongs to that tab's person.
function linkPhone(code, phone) {
  const personId = linkCodes.get(code);
  if (!personId || !db.people.some((p) => p.id === personId)) return null;
  linkCodes.delete(code);
  commit(store.setPersonPhone(db, personId, phone));
  return personId;
}
const phoneLinks = () => new Map(db.people.filter((p) => p.phone).map((p) => [p.id, p.phone]));

app.post('/api/people/:id/lang', (req, res) => {
  res.json(publicPerson(commit(store.setPersonLang(db, req.params.id, body(req).lang)).person));
});

app.post('/api/requests', async (req, res) => {
  const b = body(req);
  const { request } = commit(store.createRequest(db, {
    personId: text(b, 'personId', ID_MAX), title: text(b, 'title', 60), details: text(b, 'details', 240, false),
  }));
  const availableItems = db.items.filter((i) => i.status === 'available' && i.ownerId !== request.personId);
  const { suggestions, aiError } = await suggestItems({ request, availableItems });
  res.json({ request, suggestions, aiError, mock: isMock() });
});

app.delete('/api/requests/:id', (req, res) => {
  res.json(commit(store.closeRequest(db, req.params.id, text(body(req), 'personId', ID_MAX))).request);
});

// Stores the photo first, then asks Gemini for a draft. Publishes nothing.
app.post('/api/items/draft', async (req, res) => {
  const b = body(req);
  const ownerId = text(b, 'ownerId', ID_MAX);
  const mimeType = oneOf(b, 'mimeType', Object.keys(SIGNATURES));
  if (typeof b.imageBase64 !== 'string' || !b.imageBase64) throw new ApiError(400, 'missing_field', 'imageBase64 is required.');
  store.getPerson(db, ownerId);
  const image = Buffer.from(b.imageBase64.replace(/^data:[^,]*,/, ''), 'base64');
  if (image.length > MAX_IMAGE_BYTES) throw new ApiError(400, 'too_large', 'That photo is too big. Try one under 6 MB.');
  if (!looksLike(image, mimeType)) throw new ApiError(400, 'bad_image', "That file doesn't look like a photo.");
  const photoId = store.newId('p');
  writeFileSync(join(PHOTOS_DIR, `${photoId}.jpg`), image);
  const openRequests = db.requests.filter((r) => r.status === 'open' && r.personId !== ownerId);
  const { draft, aiError } = await describeItem({ jpegBase64: image.toString('base64'), mimeType, openRequests });
  res.json({ photoId, photo: `/photos/${photoId}.jpg`, draft, aiError, mock: isMock() });
});

app.post('/api/items', (req, res) => {
  const b = body(req);
  const photoId = text(b, 'photoId', ID_MAX);
  if (!/^p_[0-9a-f]{8}$/.test(photoId) || !existsSync(join(PHOTOS_DIR, `${photoId}.jpg`))) {
    throw new ApiError(404, 'unknown_photo', 'That photo is missing. Please take it again.');
  }
  const aiDraft = b.aiDraft ?? null;
  if (aiDraft !== null && (typeof aiDraft !== 'object' || Array.isArray(aiDraft) || JSON.stringify(aiDraft).length > MAX_AI_DRAFT_CHARS)) {
    throw new ApiError(400, 'invalid_field', 'aiDraft must be the draft object or null.');
  }
  const { item } = commit(store.createItem(db, {
    ownerId: text(b, 'ownerId', ID_MAX),
    photo: `/photos/${photoId}.jpg`,
    title: text(b, 'title', 60),
    description: text(b, 'description', 240, false),
    condition: oneOf(b, 'condition', CONDITIONS),
    category: oneOf(b, 'category', CATEGORIES),
    price: dollars(b, 'price'),
    aiDraft,
    offerToRequestId: text(b, 'offerToRequestId', ID_MAX, false) || null,
  }));
  itemPosted(item); // SPEC3 §3: a board item that fits a linked person's open request gets them one text
  res.json(item);
});

app.post('/api/items/:id/reserve', (req, res) => {
  const b = body(req);
  res.json(commit(store.reserveItem(db, req.params.id, {
    personId: text(b, 'personId', ID_MAX),
    requestId: text(b, 'requestId', ID_MAX, false) || null,
    place: text(b, 'place', 100, false) || null, // optional since SPEC2: the owner can pick in the thread
    time: text(b, 'time', 40, false) || null,
    timeISO: isoTime(b, 'timeISO'),
  })).item);
});

app.post('/api/items/:id/decline', (req, res) => {
  res.json(commit(store.declineItem(db, req.params.id, text(body(req), 'personId', ID_MAX))).item);
});

app.post('/api/items/:id/release', (req, res) => {
  res.json(commit(store.releaseItem(db, req.params.id, text(body(req), 'personId', ID_MAX))).item);
});

app.post('/api/items/:id/confirm', (req, res) => {
  const b = body(req);
  res.json(commit(store.confirmItem(db, req.params.id, text(b, 'personId', ID_MAX), text(b, 'code', 10))).item);
});

app.post('/api/items/:id/withdraw', (req, res) => {
  res.json(commit(store.withdrawItem(db, req.params.id, text(body(req), 'personId', ID_MAX))).item);
});

// "Pass it on again": the taker relists a collected item without a new photo. Answers with the new item.
app.post('/api/items/:id/repost', (req, res) => {
  res.json(commit(store.repostItem(db, req.params.id, text(body(req), 'personId', ID_MAX))).item);
});

app.post('/api/reset', (req, res) => {
  db = resetToSeed(DATA_DIR, db.version); // SPEC5: also drops every person POST /api/people added
  res.json(publicDb(db));
});

// Pile photo (SPEC2 §2, Lane E): POST /api/items/pile and POST /api/photos.
app.use('/api', pileRouter);
app.use(convertRouter);

// ---- Handoff threads (SPEC2 §1) ----
// Button taps and the coordinator's suggestions go through the same store transitions.
const THREAD_ACTIONS = { accept: store.acceptPlan, propose: store.proposePlan, arrived: store.markArrived, cancel: store.cancelThread };
const AI_ERROR_REPLY = "I couldn't read that just now. Use the buttons, or try again in a moment.";
const NO_PICKUP_REPLY = 'You have no active pickup right now.';

// Post a person's message, then let the coordinator suggest Loop's reply and at most one action.
async function converse(threadId, personId, said, via) {
  const { thread } = commit(store.postHumanMessage(db, threadId, { personId, text: said, via }));
  const item = db.items.find((i) => i.id === thread.itemId);
  const { reply, action, aiError } = await coordinate({ thread, item, speakerId: personId, text: said, now: new Date() });
  // Gemini can take seconds: re-check against the current state, not the snapshot it saw.
  if (!store.isOpenThread(store.getThread(db, threadId))) return store.getThread(db, threadId);
  try {
    if (aiError) commit(store.postLoopMessage(db, threadId, AI_ERROR_REPLY));
    else if (THREAD_ACTIONS[action.type]) commit(THREAD_ACTIONS[action.type](db, threadId, { ...action, personId, say: reply || null }));
    else commit(store.postLoopMessage(db, threadId, reply));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    // Not allowed right now (accept twice, "I'm here" before the plan is set, …): no state change, Loop says why.
    commit(store.postLoopMessage(db, threadId, err.message));
  }
  return store.getThread(db, threadId);
}

// iMessage from a linked person that textflow routes to their newest open thread: same path as the web composer.
async function threadReply(personId, said) {
  const thread = store.newestOpenThread(db, personId);
  if (!thread) return NO_PICKUP_REPLY;
  const message = clamp(said, 300);
  if (!message) return null;
  try {
    await converse(thread.id, personId, message, 'imessage');
    return null;
  } catch (err) {
    if (err instanceof ApiError) return err.message;
    throw err;
  }
}

app.post('/api/threads/:id/messages', async (req, res) => {
  const b = body(req);
  const thread = await converse(req.params.id, text(b, 'personId', ID_MAX), text(b, 'text', 300), 'web');
  res.json({ thread });
});

app.post('/api/threads/:id/actions', (req, res) => {
  const b = body(req);
  const action = oneOf(b, 'action', Object.keys(THREAD_ACTIONS));
  const { thread } = commit(THREAD_ACTIONS[action](db, req.params.id, {
    personId: text(b, 'personId', ID_MAX),
    place: text(b, 'place', 100, false) || null,
    time: text(b, 'time', 40, false) || null,
    timeISO: isoTime(b, 'timeISO'),
  }));
  res.json({ thread });
});

// Demo helper: post the reminder now (only when the plan is set and not yet reminded).
app.post('/api/threads/:id/reminder', (req, res) => {
  res.json({ thread: commit(store.postReminder(db, req.params.id, { force: true })).thread });
});

// Reminders: every 30 s, or every n s when DEMO_REMINDER_SECONDS=n so a sped-up reminder lands on time.
const REMINDER_TICK_MS = Math.min(30_000, (store.reminderDemoSeconds() || 30) * 1000);
setInterval(() => {
  try {
    for (const t of db.threads ?? []) {
      if (t.status === 'set' && !t.reminded && t.remindAt && Date.parse(t.remindAt) <= Date.now()) commit(store.postReminder(db, t.id));
    }
  } catch (err) {
    console.error(err); // a throw here would otherwise take the server down
  }
}, REMINDER_TICK_MS);

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found', message: 'No such API route.' }));

app.use((err, req, res, _next) => { // four params: Express treats this as the error handler
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.error, message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json', message: "That request wasn't valid JSON." });
  if (err.type === 'entity.too.large') return res.status(400).json({ error: 'too_large', message: 'That photo is too big. Try one under 6 MB.' });
  if (err.status >= 400 && err.status < 500) return res.status(400).json({ error: 'bad_request', message: "That request couldn't be read." });
  console.error(err);
  res.status(500).json({ error: 'server_error', message: 'Something went wrong on our side. Please try again.' });
});

app.listen(PORT, () => {
  const ai = isMock() ? 'GEMINI_MOCK=1 (canned drafts, no Gemini calls)' : `Gemini ${modelName()}`;
  console.log(`Loop on http://localhost:${PORT} | ${ai} | data in ${DATA_DIR}`);
});
// Loop in iMessage (SPEC3): texts from linked phones go through textflow (photos, YES/BOARD, codes, suggestions),
// which hands pickup-thread messages back to threadReply.
startTextflow({ getDb: () => db, commit, send: sendToPerson, toThread: threadReply, linked: (id) => channelStatus().linkedPhones.includes(id) });
startChannel({ onInbound: handleInbound, links: phoneLinks, onLink: linkPhone }); // env-gated; does nothing without Spectrum credentials
