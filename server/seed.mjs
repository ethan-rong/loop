// Seed state (SPEC "Seed"). resetToSeed writes it to <dataDir>/db.json and copies the two item
// photos into <dataDir>/photos. `npm run seed` does the same for DATA_DIR while the server is
// stopped; while it runs, use POST /api/reset so the in-memory state resets too.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, loadDb, saveDb } from './store.mjs';

const SEED_PHOTOS = fileURLToPath(new URL('../public/seed/', import.meta.url));
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

export function resetToSeed(dataDir, prevVersion = 0) {
  const photos = join(dataDir, 'photos');
  mkdirSync(photos, { recursive: true });
  copyFileSync(join(SEED_PHOTOS, 'textbook.jpg'), join(photos, 'i_book.jpg'));
  copyFileSync(join(SEED_PHOTOS, 'fan.jpg'), join(photos, 'i_fan.jpg'));
  copyFileSync(join(SEED_PHOTOS, 'coat.jpg'), join(photos, 'i_coat.jpg'));
  const request = (id, personId, title, details, minutes) =>
    ({ id, personId, title, details, status: 'open', matchedItemId: null, createdAt: ago(minutes) });
  const item = (id, ownerId, title, description, condition, category, minutes) => ({
    id, ownerId, photo: `/photos/${id}.jpg`, title, description, condition, category, aiDraft: null,
    status: 'available', offeredToRequestId: null, reservation: null, collectedAt: null, createdAt: ago(minutes),
  });
  const db = {
    version: prevVersion + 1,
    // SPEC5: no names, nicknames or areas. A person is an opaque id (internal, never shown) and a thread language.
    // Demo mapping (operator only): ethan = the phone (PHONE_ETHAN), jerry = the web taker.
    people: [
      { id: 'ethan', lang: 'en' },
      { id: 'jerry', lang: 'en' },
      { id: 'jack', lang: 'en' },
      { id: 'tom' },
      { id: 'thomas', lang: 'en' },
    ],
    requests: [
      request('r_coat', 'jack', 'Winter coat, size M-ish', 'First real winter for me. Anything warm works.', 70),
      request('r_fridge', 'ethan', 'Mini fridge for a double', 'Small enough to fit under a desk. Shared with my roommate.', 40),
      request('r_cooker', 'tom', 'Small rice cooker', 'Enough for two. With the inner pot.', 35),
      request('r_fan', 'thomas', 'Desk fan, any size', 'Third floor, no AC. Anything that moves air.', 25),
    ],
    threads: [],
    items: [
      item('i_book', 'ethan', 'Intro to Psychology textbook (8th ed.)', 'Hardcover. Some highlighting in the first few chapters.', 'fair', 'textbooks', 60),
      item('i_fan', 'ethan', 'Small desk fan', 'Blue metal fan on a stand. A little dusty.', 'fair', 'electronics', 30),
      item('i_coat', 'ethan', 'Winter coat, men\'s M', 'Warm, zip works, one small stain on the cuff.', 'fair', 'clothing', 20),
    ],
  };
  saveDb(dataDir, db);
  return db;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = resetToSeed(DATA_DIR, loadDb(DATA_DIR)?.version ?? 0);
  console.log(`Seeded ${DATA_DIR} (version ${db.version})`);
}
