// iMessage channel through Photon Spectrum (SPEC2 §1, SPEC3). Off unless the project id and secret are set
// (SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET, or the PHOTON_* aliases) and GEMINI_MOCK is not 1, so automated
// tests never text real phones. PHONE_<PERSONID>=+1XXXXXXXXXX (E.164) links a demo person to a number. A number
// links to one person; when two share it, ethan wins (SPEC3: PHONE_ETHAN takes over the phase-2 PHONE_JERRY link).
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
//     A tapback is {type:'reaction', emoji: '👍'|'👎'|'❤️'|…, target: Message} (target.id = the guid that
//     space.send resolved with); a poll vote is {type:'poll_option', option: {title}, selected} with message id
//     "<poll guid>:<voter>:<option>:selected:<time>". Read receipts and typing are other types and are ignored.
// One-tap answers: a text that offers two choices gets a "👍 first · 👎 second" line (a pickup thread's
// accept/propose goes out as a poll instead; the line is the fallback); a tapback or vote on it answers it.
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
const POLL_TITLE = 'Does that work?';
const PICKS = { '👍': 0, '❤️': 0, '❤': 0, '👎': 1 }; // like and love tapbacks pick the first choice, dislike the second

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
const offers = new Map(); // personId -> {id, choice}: the last text Loop sent them with two choices, until answered

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
  // Every automated test runs with GEMINI_MOCK=1 and reserves items for Jerry: never text real phones from them.
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

const personFor = (from) => [...phones()].find(([, phone]) => phone === from)?.[0];
const tapHint = ({ labels }) => `👍 ${labels[0]} · 👎 ${labels[1]}`;
const pollOf = ({ labels }) => ({ build: async () => ({ type: 'poll', title: POLL_TITLE, options: labels.map((title) => ({ title })) }) });
const bareId = (id) => String(id ?? '').replace(/^p:\d+\//, ''); // one part of a message: "p:<index>/<guid>"

/**
 * A 👍/❤️/👎 tapback or a poll vote answering the last two-choice text Loop sent this person:
 * {personId, choice, pick: 0|1}. null for anything else (other reactions, other messages, unlinked numbers).
 * When either id is missing, the newest offer takes it.
 */
function choiceAnswer(message) {
  const { content } = message;
  const personId = personFor(message.sender?.id);
  const offer = personId && offers.get(personId);
  if (!offer) return null;
  let pick, target;
  if (content?.type === 'reaction') {
    pick = PICKS[content.emoji];
    target = content.target?.id;
  } else if (content?.type === 'poll_option' && content.selected) {
    pick = offer.choice.labels.indexOf(content.option?.title);
    target = String(message.id ?? '').split(':')[0];
  }
  if (!(pick >= 0)) return null;
  if (offer.id && target && bareId(target) !== bareId(offer.id)) return null;
  return { personId, choice: offer.choice, pick };
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
  const answer = choiceAnswer(message);
  const { from, text, photo, otherFile } = readMessage(message);
  if (!answer && !text && !photo && !otherFile) return; // other tapbacks, read receipts, typing
  const personId = answer?.personId ?? personFor(from);
  if (!personId) {
    if (toldUnknown.has(from)) return;
    toldUnknown.add(from);
    return space.send(NOT_LINKED).catch((err) => fail('send', err));
  }
  spaces.set(personId, space);
  if (!answer && !photo && /^stop$/i.test(text)) {
    waiting.delete(personId);
    await space.send(STOPPED).catch((err) => fail('send', err)); // the last text Loop sends them
    stopped.add(personId);
    spaces.delete(personId);
    return;
  }
  const missed = waiting.get(personId) ?? [];
  waiting.delete(personId); // one that fails again goes back in
  for (const queued of missed) deliver(personId, queued.text, queued.choice);
  if (answer) {
    offers.delete(personId); // one answer per offer
    const reply = await onInbound({ personId, text: '', photoBuffer: null, reaction: { ...answer.choice, pick: answer.pick } });
    if (reply) await deliver(personId, reply.text ?? reply, reply.choice);
    return;
  }
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
  const reply = await onInbound({ personId, text, photoBuffer }); // a string, or {text, choice} when it offers two
  if (reply) await deliver(personId, reply.text ?? reply, reply.choice);
}

// Sends on the person's chain so their texts stay in order. A failed send is retried once after 1.5 s with a fresh
// DM; if that fails too, the text waits for the person's next message and goes out right before Loop answers it.
// choice = {kind, labels: [first, second], …} when the text offers two answers (offer() below). Never rejects:
// resolves true when sent.
function deliver(personId, text, choice = null) {
  const run = (queues.get(personId) ?? Promise.resolve()).then(async () => {
    const poll = choice?.kind === 'thread';
    const body = choice && !poll ? `${text}\n${tapHint(choice)}` : text;
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
        const sent = await space.send(body);
        lastSendOk = true;
        if (!sentTo.has(personId)) console.log(`imessage: sent to ${personId}`);
        sentTo.add(personId);
        if (choice) await offer(personId, space, sent, choice, poll);
        return true;
      } catch (err) {
        error = err;
        if (attempt === 1) await sleep(SEND_RETRY_MS);
      }
    }
    lastSendOk = false;
    fail('send', error);
    waiting.set(personId, [...(waiting.get(personId) ?? []), { text, choice }].slice(-MAX_WAITING));
    return false;
  });
  queues.set(personId, run);
  return run;
}

// Remember the message whose tapback (or vote) answers `choice`. A pickup thread's accept/propose is asked as a poll
// right after its text; when no poll comes back (refused or skipped), a separate "👍 … · 👎 …" line takes its place.
// Never throws.
async function offer(personId, space, sent, choice, poll) {
  let message = sent;
  if (poll) {
    message = await space.send(pollOf(choice)).catch((err) => fail('poll', err));
    if (!message?.id) message = await space.send(tapHint(choice)).catch((err) => fail('send', err));
  }
  offers.set(personId, { id: message?.id ?? null, choice });
}

// Never rejects: resolves true when sent; false when not linked, not connected, or it failed twice (it then waits
// for the person's next text).
// The DM a person last texted from counts too (in production that only happens once connected; tests use it).
export function sendToPerson(personId, text, choice = null) {
  if (!(im || spaces.has(personId)) || !phones().has(personId)) return Promise.resolve(false);
  return deliver(personId, text, choice);
}

const langIn = (db, id) => db.people.find((p) => p.id === id)?.lang ?? 'en';

// One thread message on one participant's phone, prefixed with the sender: "Loop", or the other person's role
// (SPEC5: "Giver:" / "Taker:", never a name); body = its text or a translation of it.
// null when it isn't for them: their own, or addressed to the other person (forPersonId). Buttons meant for them
// become one trailing hint line; when the taker arrives, the giver is asked to text the code instead of typing it
// on the item page (SPEC3 §2).
function phoneText(thread, m, personId, body) {
  if (personId === m.from || (m.forPersonId && m.forPersonId !== personId)) return null;
  const sender = m.from === 'loop' ? 'Loop' : m.from === thread.ownerId ? 'Giver' : 'Taker';
  if (personId === thread.ownerId && m.actions.some((a) => a.action === 'enter_code')) {
    return `${sender}: The taker is at ${thread.plan.place}. Ask for the 4-digit code and text it to me.`;
  }
  const replyable = m.actions.some((a) => a.action !== 'enter_code' && (a.forPersonId ?? m.forPersonId ?? personId) === personId);
  return `${sender}: ${body}${replyable ? `\n${HINT}` : ''}`;
}

// The two answers a thread message offers this person when they are accept + propose ("Works for me" / "Suggest
// another time"): deliver() asks them as a poll. null otherwise (arrived/cancel are left to typing on purpose).
function threadChoice(thread, m, personId) {
  const live = m.actions.filter((a) => a.action !== 'enter_code' && (a.forPersonId ?? m.forPersonId ?? personId) === personId);
  if (live.map((a) => a.action).join() !== 'accept,propose') return null;
  return { kind: 'thread', threadId: thread.id, messageId: m.id, labels: live.map((a) => a.label) };
}
const withoutChoice = (texts) => texts.map(({ personId, text }) => ({ personId, text }));

/**
 * What each participant's phone gets right away for the thread messages added between two states. `translating` =
 * the translations just started for them ({messageId, lang}, translate.mjs, SPEC4 §C): a participant who reads that
 * lang gets that message from translationTexts once it is done instead. Pure, so tests can check it.
 * @returns {{personId: string, text: string}[]}
 */
export const threadTexts = (before, after, translating = []) => withoutChoice(newTexts(before, after, translating));

function newTexts(before, after, translating = []) {
  const seen = new Map((before?.threads ?? []).map((t) => [t.id, t.messages.length]));
  const later = new Set(translating.map((job) => `${job.messageId} ${job.lang}`));
  const texts = [];
  for (const thread of after.threads ?? []) {
    for (const m of thread.messages.slice(seen.get(thread.id) ?? 0)) {
      for (const personId of [thread.ownerId, thread.recipientId]) {
        if (later.has(`${m.id} ${langIn(after, personId)}`)) continue;
        const text = phoneText(thread, m, personId, m.text);
        if (text) texts.push({ personId, text, choice: threadChoice(thread, m, personId) });
      }
    }
  }
  return texts;
}

/**
 * The texts held back for one finished translation (a job from translate.mjs): each participant who reads job.lang
 * gets the message in it, or the original when the translation failed (translated = null), so nobody misses it.
 * `after` = the state the message was added in. Pure.
 * @returns {{personId: string, text: string}[]}
 */
export const translationTexts = (after, job, translated) => withoutChoice(translatedTexts(after, job, translated));

function translatedTexts(after, job, translated) {
  const thread = (after.threads ?? []).find((t) => t.id === job.threadId);
  const m = thread?.messages.find((x) => x.id === job.messageId);
  if (!m) return [];
  return [thread.ownerId, thread.recipientId]
    .filter((personId) => langIn(after, personId) === job.lang)
    .map((personId) => ({ personId, text: phoneText(thread, m, personId, translated ?? m.text), choice: threadChoice(thread, m, personId) }))
    .filter((t) => t.text);
}

// Forward each new thread message to the linked phones it is meant for (no-op until the channel is connected), except
// to readers of a language it is being translated into: forwardTranslation sends theirs when the translation is done.
// ponytail: a held-back message can land after a later immediate one (~0.5 s window); per-person ordering if it matters.
export function forwardNewMessages(before, after, translating = []) {
  for (const { personId, text, choice } of newTexts(before, after, translating)) sendToPerson(personId, text, choice);
}

export function forwardTranslation(after, job, translated) {
  for (const { personId, text, choice } of translatedTexts(after, job, translated)) sendToPerson(personId, text, choice);
}
