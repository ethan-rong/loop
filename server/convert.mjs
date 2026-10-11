// Photos the browser cannot decode (HEIC from an iPhone, TIFF, BMP…): the client sends the raw file here and gets a
// JPEG back, at most 1024 px a side, then carries on exactly as with a JPEG. The listing photo stays client-made.
// ponytail: macOS `sips` only (the judging server is a Mac); add sharp+libheif if this ever runs on Linux.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import * as store from './store.mjs';

const { ApiError } = store;
const MAX_RAW_BYTES = 12 * 1024 * 1024;
const MAX_SIDE = 1024;
const SIPS_TIMEOUT_MS = 15_000;

const UNSUPPORTED = () => new ApiError(415, 'unsupported_image', "This photo type can't be opened here. Try a JPEG or PNG.");

/** Raw image bytes in → JPEG bytes out. Throws ApiError. */
export function toJpeg(raw) {
  if (process.platform !== 'darwin') throw UNSUPPORTED();
  const dir = mkdtempSync(join(tmpdir(), 'loop-convert-'));
  try {
    const src = join(dir, 'in');
    const out = join(dir, 'out.jpg');
    writeFileSync(src, raw);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-Z', String(MAX_SIDE), src, '--out', out], {
      stdio: 'ignore', timeout: SIPS_TIMEOUT_MS,
    });
    const jpeg = readFileSync(out);
    if (jpeg.subarray(0, 3).toString('hex') !== 'ffd8ff') throw UNSUPPORTED();
    return jpeg;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw UNSUPPORTED(); // sips exits non-zero on anything it cannot read
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const convertRouter = express.Router();

// POST /api/photos/convert {imageBase64} → {jpegBase64}
convertRouter.post('/api/photos/convert', (req, res) => {
  const b = req.body ?? {};
  if (typeof b.imageBase64 !== 'string' || !b.imageBase64) throw new ApiError(400, 'missing_field', 'imageBase64 is required.');
  const raw = Buffer.from(b.imageBase64.replace(/^data:[^,]*,/, ''), 'base64');
  if (!raw.length) throw new ApiError(400, 'missing_field', 'imageBase64 is required.');
  if (raw.length > MAX_RAW_BYTES) throw new ApiError(400, 'too_large', 'That photo is too big. Try one under 12 MB.');
  res.json({ jpegBase64: toJpeg(raw).toString('base64') });
});
