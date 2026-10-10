// iMessage channel through Photon Spectrum (SPEC2 §1 "iMessage channel"). Off unless the project id and secret
// are set (SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET, or the PHOTON_* aliases), GEMINI_MOCK is not 1, AND
// `spectrum-ts` is installed; it is deliberately not in package.json (188 packages, ~132 MB). Enable: `npm i spectrum-ts`.
// PHONE_<PERSONID>=+1XXXXXXXXXX (E.164) links a demo person to a number.
//
// SDK calls used, checked against spectrum-ts 12.10.1 types and source (not yet against a live line):
//   const app = await Spectrum({projectId, projectSecret, providers: [imessage.config()]})
//   outbound: (await imessage(app).space.create('+1…')).send(text)   — shared line: DM "any;-;+1…"
//   inbound:  for await (const [space, message] of app.messages)     — message.sender.id is the address
// Logs never include numbers, credentials or SDK error text: a fixed line plus err.name only.
// No project imports, so it can be smoke-tested on its own.

const E164 = /^\+[1-9]\d{6,14}$/;
const HINT = "Reply 'works', 'here', or suggest a time.";
const NOT_LINKED = "This number isn't linked to a Loop handoff.";

let im = null; // imessage(app) once connected
let healthy = false;
const spaces = new Map(); // personId -> the DM we last used, so replies stay in the same conversation
const queues = new Map(); // personId -> send chain, keeps each person's messages in order
const toldUnknown = new Set(); // unknown senders already answered once
const logged = new Set();

const credentials = () => ({
  projectId: process.env.SPECTRUM_PROJECT_ID || process.env.PHOTON_PROJECT_ID,
  projectSecret: process.env.SPECTRUM_PROJECT_SECRET || process.env.PHOTON_PROJECT_SECRET,
});

// personId -> E.164 number from PHONE_<ID>; malformed values are ignored.
function phones() {
  const linked = new Map();
  for (const [key, value] of Object.entries(process.env)) {
    const id = key.match(/^PHONE_([A-Z0-9_]+)$/)?.[1];
    const phone = value?.replace(/[\s().-]/g, '');
    if (id && E164.test(phone)) linked.set(id.toLowerCase(), phone);
  }
  return linked;
}

function fail(what, err) {
  healthy = false;
  if (logged.has(what)) return;
  logged.add(what);
  console.warn(`imessage: ${what} failed (${err?.name ?? 'Error'}). Loop keeps working in the app.`);
}

export const channelStatus = () => ({ imessage: healthy, linkedPhones: [...phones().keys()] });

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
  healthy = true;
  console.log(`imessage: connected; linked people: ${[...phones().keys()].join(', ') || 'none'}`);
  listen(app, onInbound);
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
}

async function receive(space, message, onInbound) {
  if (message.platform !== 'imessage' || message.direction !== 'inbound' || message.content?.type !== 'text') return;
  const from = message.sender?.id ?? '';
  const personId = [...phones()].find(([, phone]) => phone === from)?.[0];
  if (!personId) {
    if (toldUnknown.has(from)) return;
    toldUnknown.add(from);
    return space.send(NOT_LINKED);
  }
  spaces.set(personId, space);
  const reply = await onInbound({ personId, text: message.content.text });
  if (reply) await space.send(reply);
}

// Never rejects: resolves true when sent, false when not linked, not connected, or the send failed.
export function sendToPerson(personId, text) {
  const phone = phones().get(personId);
  if (!im || !phone) return Promise.resolve(false);
  const run = (queues.get(personId) ?? Promise.resolve())
    .then(async () => {
      const space = spaces.get(personId) ?? await im.space.create(phone);
      spaces.set(personId, space);
      await space.send(text);
      healthy = true;
      return true;
    })
    .catch((err) => {
      fail('send', err);
      return false;
    });
  queues.set(personId, run);
  return run;
}

// Forward each new thread message to every participant with a linked phone except its author,
// prefixed with the sender. Buttons meant for that person become one trailing hint line.
export function forwardNewMessages(before, after) {
  if (!im) return;
  const seen = new Map((before?.threads ?? []).map((t) => [t.id, t.messages.length]));
  const firstName = (id) => after.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  for (const thread of after.threads ?? []) {
    for (const m of thread.messages.slice(seen.get(thread.id) ?? 0)) {
      for (const personId of [thread.ownerId, thread.recipientId]) {
        if (personId === m.from) continue;
        const replyable = m.actions.some((a) => a.action !== 'enter_code' && (a.forPersonId ?? m.forPersonId ?? personId) === personId);
        sendToPerson(personId, `${m.from === 'loop' ? 'Loop' : firstName(m.from)}: ${m.text}${replyable ? `\n${HINT}` : ''}`);
      }
    }
  }
}
