// Loop server: static files, JSON API (SPEC "API"), one log line per request, central error handler.
import './env.mjs';
import express from 'express';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, CONDITIONS, describeItem, isMock, modelName, suggestItems } from './gemini.mjs';
import { resetToSeed } from './seed.mjs';
import * as store from './store.mjs';

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
function commit(result) {
  store.saveDb(DATA_DIR, result.db);
  db = result.db;
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

app.get('/api/health', (req, res) => res.json({ ok: true, mock: isMock(), model: modelName() }));
app.get('/api/state', (req, res) => res.json(db));

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
  res.json(commit(store.createItem(db, {
    ownerId: text(b, 'ownerId', ID_MAX),
    photo: `/photos/${photoId}.jpg`,
    title: text(b, 'title', 60),
    description: text(b, 'description', 240, false),
    condition: oneOf(b, 'condition', CONDITIONS),
    category: oneOf(b, 'category', CATEGORIES),
    aiDraft,
    offerToRequestId: text(b, 'offerToRequestId', ID_MAX, false) || null,
  })).item);
});

app.post('/api/items/:id/reserve', (req, res) => {
  const b = body(req);
  res.json(commit(store.reserveItem(db, req.params.id, {
    personId: text(b, 'personId', ID_MAX),
    requestId: text(b, 'requestId', ID_MAX, false) || null,
    place: text(b, 'place', 60),
    time: text(b, 'time', 40),
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

app.post('/api/reset', (req, res) => {
  db = resetToSeed(DATA_DIR, db.version);
  res.json(db);
});

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
