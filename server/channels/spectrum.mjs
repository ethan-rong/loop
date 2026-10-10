// iMessage channel through Photon Spectrum (SPEC2 §1, SPEC3). Off unless the project id and secret are set
// (SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET, or the PHOTON_* aliases) and GEMINI_MOCK is not 1, so automated
// tests never text real phones. PHONE_<PERSONID>=+1XXXXXXXXXX (E.164) links a demo person to a number. A number
// links to one person; when two share it, ethan wins (SPEC3: PHONE_ETHAN takes over the phase-2 PHONE_CALEB link).
//
// SDK facts (spectrum-ts 12.10.1 source, plus live checks on Oct 10):
//   const app = await Spectrum({projectId, projectSecret, providers: [imessage.config()]})
//   outbound: (await imessage(app).space.create('+1…')).send(text); a string is sent as plain text. Shared line: the
//     DM id is "any;-;+1…" and the proxy rejects other prefixes. It answers "Target not allowed for this project"
//     (PERMISSION_DENIED) until the person is on the dashboard Users page and has texted the line once; the first
//     send after connect also failed that way once (transient), hence one retry.
//   inbound: for await (const [space, message] of app.messages); message.sender.id is the sender's address.
//     message.content: {type:'text', text} | {type:'attachment', name, mimeType, size, read(): Promise<Buffer>}
//     | {type:'group', items: [Message, …]} (a photo with a caption) | {type:'reply'|'effect', content}.
//     Tapbacks, read receipts and typing arrive as other types and are ignored.
// Logs never include numbers or credentials. No project imports, so it can be tested on its own.
import { setTimeout as sleep } from 'node:timers/promises';

const E164 = /^\+[1-9]\d{6,14}$/;
const HINT = "Reply 'works', 'here', or suggest a time.";
const NOT_LINKED = "This number isn't linked to a Loop handoff.";
const STOPPED = "Unlinked. Loop won't text you here again.";
const PHOTOS_ONLY = 'I can only read photos. Send a photo of the thing you want to give away.';
const NO_DOWNLOAD = "I couldn't download that photo. Send it again when you're ready.";
const TOO_BIG = 'That photo is too big. Try one under 6 MB.';
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024; // photos are shrunk later; this only refuses huge downloads
const DOWNLOAD_TRIES = 3; // an attachment can still be transferring when its message arrives
const DOWNLOAD_RETRY_MS = 1000;
const SEND_RETRY_MS = 1500;
const MAX_WAITING = 10;
const LOOKUP_TIMEOUT_MS = 10_000;

let im = null; // imessage(app) once connected
let connected = false;
let lastSendOk = null; // null until something was sent
let lineNumber = null; // the shared line people text, when the cloud API says
const spaces = new Map(); // personId -> the DM we last used, so replies stay in the same conversation
const queues = new Map(); // personId -> send chain, keeps each person's texts in order
const waiting = new Map(); // personId -> texts that failed twice; sent before Loop answers that person's next text
const stopped = new Set(); // STOP, in memory only: the env link comes back on restart
const toldUnknown = new Set(); // unknown senders already answered once
const sentTo = new Set(); // people whose first successful send was logged
const logged = new Set();

const credentials = () => ({
  projectId: process.env.SPECTRUM_PROJECT_ID || process.env.PHOTON_PROJECT_ID,
  projectSecret: process.env.SPECTRUM_PROJECT_SECRET || process.env.PHOTON_PROJECT_SECRET,
});

// personId -> E.164 number from PHONE_<ID>; malformed values are ignored. A number shared by two people links to
// ethan when he is one of them, else to the first; someone who texted STOP is left out.
function phones() {
  const entries = Object.entries(process.env)
    .map(([key, value]) => [key.match(/^PHONE_([A-Z0-9_]+)$/)?.[1]?.toLowerCase(), value?.replace(/[\s().-]/g, '')])
    .filter(([id, phone]) => id && E164.test(phone))
    .sort(([a], [b]) => (b === 'ethan') - (a === 'ethan'));
  const linked = new Map();
  const taken = new Set();
  for (const [id, phone] of entries) {
    if (taken.has(phone)) continue;
    taken.add(phone);
    if (!stopped.has(id)) linked.set(id, phone);
  }
  return linked;
}

// Logged once per distinct failure, without numbers, addresses or the secret.
function fail(what, err) {
  const secret = credentials().projectSecret;
  let detail = String(err?.message ?? '').replace(/\+?\d[\d\s().-]{5,}\d/g, '[number]').replace(/\S+@\S+/g, '[address]');
  if (secret) detail = detail.split(secret).join('[secret]');
  const line = `imessage: ${what} failed (${err?.name ?? 'Error'}${detail ? `: ${detail.slice(0, 160)}` : ''})`;
  if (logged.has(line)) return;
  logged.add(line);
  const hint = detail.includes('Target not allowed') ? ' That person has to be on the Users page and text the line once.' : '';
  console.warn(`${line}.${hint} Loop keeps working in the app.`);
}

// imessage = the channel is connected; a failed send doesn't change it (lastSendOk tells how the last send went).
export const channelStatus = () => ({ imessage: connected, lastSendOk, lineNumber, linkedPhones: [...phones().keys()] });

// Fire and forget: the server starts listening while this connects.
export function startChannel({ onInbound }) {
  const { projectId, projectSecret } = credentials();
  if (!projectId || !projectSecret) return;
  // Every automated test runs with GEMINI_MOCK=1 and reserves items for Caleb: never text real phones from them.
  if (process.env.GEMINI_MOCK === '1') return console.log('imessage: off while GEMINI_MOCK=1, so tests never text real phones.');
  connect(projectId, projectSecret, onInbound).catch((err) => fail('connect', err));
}

async function connect(projectId, projectSecret, onInbound) {
  let sdk, providers;
  try {
    [sdk, providers] = await Promise.all([import('spectrum-ts'), import('spectrum-ts/providers')]);
  } catch (err) {
    return fail('import (run `npm i spectrum-ts`)', err);
  }
  const app = await sdk.Spectrum({ projectId, projectSecret, providers: [providers.imessage.config()], options: { logLevel: 'error' } });
  im = providers.imessage(app);
  connected = true;
  console.log(`imessage: connected; linked people: ${[...phones().keys()].join(', ') || 'none'}`);
  findLine(projectId, projectSecret).catch((err) => fail('line lookup', err));
  listen(app, onInbound);
}

// The shared line's number ("Texts on" on the dashboard Users page). The SDK doesn't expose it; the cloud API behind
// that page does (users[].assignedPhoneNumber, same Basic auth as the SDK). Best effort: stays null otherwise.
async function findLine(projectId, projectSecret) {
  const res = await fetch(`${process.env.SPECTRUM_CLOUD_URL ?? 'https://spectrum.photon.codes'}/projects/${projectId}/users/`, {
    headers: { authorization: `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString('base64')}` },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const users = (await res.json())?.data?.users ?? [];
  const mine = new Set(phones().values());
  const line = (users.find((u) => mine.has(u.phoneNumber)) ?? users[0])?.assignedPhoneNumber;
  lineNumber = E164.test(line ?? '') ? line : null;
}

// One message at a time, so a person's texts are handled in order.
async function listen(app, onInbound) {
  try {
    for await (const [space, message] of app.messages) {
      try {
        await receive(space, message, onInbound);
      } catch (err) {
        fail('inbound', err);
      }
    }
  } catch (err) {
    fail('listen', err);
  }
  connected = false;
}

const isImage = (file) => /^image\//i.test(file.mimeType ?? '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name ?? '');

/** SDK message -> {from, text, photo, otherFile}. photo is the first image attachment (photo.read() gives the bytes). */
export function readMessage(message) {
  const parts = [];
  const walk = (content) => {
    if (content?.type === 'group') for (const item of content.items ?? []) walk(item?.content);
    else if (content?.type === 'reply' || content?.type === 'effect') walk(content.content);
    else if (content) parts.push(content);
  };
  walk(message?.content);
  const files = parts.filter((p) => p.type === 'attachment');
  const photo = files.find(isImage) ?? null;
  return {
    from: message?.sender?.id ?? '',
    text: parts.filter((p) => p.type === 'text' && typeof p.text === 'string').map((p) => p.text).join(' ').trim(),
    photo,
    otherFile: !photo && files.length > 0,
  };
}

async function download(photo) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await photo.read();
    } catch (err) {
      if (attempt === DOWNLOAD_TRIES) throw err;
      await sleep(DOWNLOAD_RETRY_MS);
    }
  }
}

/**
 * One inbound message (exported so scripts/e2e-textflow.mjs can feed it fake SDK messages). Texts that failed to
 * send earlier go out first; then onInbound({personId, text, photoBuffer}) decides Loop's reply.
 */
export async function receive(space, message, onInbound) {
  if (message?.platform !== 'imessage' || message.direction !== 'inbound') return;
  const { from, text, photo, otherFile } = readMessage(message);
  if (!text && !photo && !otherFile) return; // tapbacks, read receipts, typing
  const personId = [...phones()].find(([, phone]) => phone === from)?.[0];
  if (!personId) {
    if (toldUnknown.has(from)) return;
    toldUnknown.add(from);
    return space.send(NOT_LINKED).catch((err) => fail('send', err));
  }
  spaces.set(personId, space);
  if (!photo && /^stop$/i.test(text)) {
    waiting.delete(personId);
    await space.send(STOPPED).catch((err) => fail('send', err)); // the last text Loop sends them
    stopped.add(personId);
    spaces.delete(personId);
    return;
  }
  const missed = waiting.get(personId) ?? [];
  waiting.delete(personId); // one that fails again goes back in
  for (const queued of missed) deliver(personId, queued);
  if (!photo && !text) return deliver(personId, PHOTOS_ONLY);
  let photoBuffer = null;
  if (photo) {
    if (photo.size > MAX_DOWNLOAD_BYTES) return deliver(personId, TOO_BIG);
    try {
      photoBuffer = await download(photo);
    } catch (err) {
      fail('photo download', err);
      return deliver(personId, NO_DOWNLOAD);
    }
  }
  const reply = await onInbound({ personId, text, photoBuffer });
  if (reply) await deliver(personId, reply);
}

// Sends on the person's chain so their texts stay in order. A failed send is retried once after 1.5 s with a fresh
// DM; if that fails too, the text waits for the person's next message and goes out right before Loop answers it.
// Never rejects: resolves true when sent.
function deliver(personId, text) {
  const run = (queues.get(personId) ?? Promise.resolve()).then(async () => {
    let error;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        let space = attempt === 1 ? spaces.get(personId) : null;
        if (!space) {
          const phone = phones().get(personId);
          if (!phone) return false; // unlinked (STOP) meanwhile
          space = await im.space.create(phone);
          spaces.set(personId, space);
        }
        await space.send(text);
        lastSendOk = true;
        if (!sentTo.has(personId)) console.log(`imessage: sent to ${personId}`);
        sentTo.add(personId);
        return true;
      } catch (err) {
        error = err;
        if (attempt === 1) await sleep(SEND_RETRY_MS);
      }
    }
    lastSendOk = false;
    fail('send', error);
    waiting.set(personId, [...(waiting.get(personId) ?? []), text].slice(-MAX_WAITING));
    return false;
  });
  queues.set(personId, run);
  return run;
}

// Never rejects: resolves true when sent; false when not linked, not connected, or it failed twice (it then waits
// for the person's next text).
export function sendToPerson(personId, text) {
  if (!im || !phones().has(personId)) return Promise.resolve(false);
  return deliver(personId, text);
}

/**
 * What each participant's phone gets for the thread messages added between two states. A message addressed to one
 * person (forPersonId) goes only to them; the rest go to both participants except the author, prefixed with the
 * sender. Buttons meant for that person become one trailing hint line; when the recipient arrives, the owner is
 * asked to text the code instead of typing it on the item page (SPEC3 §2). Pure, so tests can check it.
 * @returns {{personId: string, text: string}[]}
 */
export function threadTexts(before, after) {
  const seen = new Map((before?.threads ?? []).map((t) => [t.id, t.messages.length]));
  const firstName = (id) => after.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  const texts = [];
  for (const thread of after.threads ?? []) {
    for (const m of thread.messages.slice(seen.get(thread.id) ?? 0)) {
      const sender = m.from === 'loop' ? 'Loop' : firstName(m.from);
      for (const personId of [thread.ownerId, thread.recipientId]) {
        if (personId === m.from || (m.forPersonId && m.forPersonId !== personId)) continue;
        if (personId === thread.ownerId && m.actions.some((a) => a.action === 'enter_code')) {
          const recipient = firstName(thread.recipientId);
          texts.push({ personId, text: `${sender}: ${recipient} is at ${thread.plan.place}. Ask ${recipient} for the 4-digit code and text it to me.` });
          continue;
        }
        const replyable = m.actions.some((a) => a.action !== 'enter_code' && (a.forPersonId ?? m.forPersonId ?? personId) === personId);
        texts.push({ personId, text: `${sender}: ${m.text}${replyable ? `\n${HINT}` : ''}` });
      }
    }
  }
  return texts;
}

// Forward each new thread message to the linked phones it is meant for (no-op until the channel is connected).
export function forwardNewMessages(before, after) {
  if (!im) return;
  for (const { personId, text } of threadTexts(before, after)) sendToPerson(personId, text);
}
