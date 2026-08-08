// Turns a booking issue into a line in data/bookings.json.
//
// This is the whole backend. It runs inside GitHub Actions, re-validates the request with the
// same rules the browser used - the client is not trusted - and writes the result out. It does
// not talk to the API: replying to the issue is reply.js's job, so the caller can safely run
// this more than once when a push races another booking.
//
// Reads:  ISSUE_BODY (from the workflow env, never interpolated into a shell command).
// Writes: data/bookings.json (only when the request is good), plus outcome.json and
//         commit-message.txt in RUNNER_TEMP for the steps that follow.

import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CONFIG } from '../../js/config.js';
import {
  validateBooking,
  applyBooking,
  removeBooking,
  findById,
  areaById,
  serviceForSlot,
} from '../../js/booking-rules.js';

const BOOKINGS_PATH = 'data/bookings.json';
const TEMP = process.env.RUNNER_TEMP || tmpdir();

// Ambiguous characters left out on purpose: a booking code gets read aloud and typed in by hand,
// so no O/0, no I/1, no S/5.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXY2346789';
const CODE_LENGTH = 6;

// Built from escapes rather than written literally, so no control bytes ever sit in this file.
const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

const outcome = run();
writeFileSync(join(TEMP, 'outcome.json'), `${JSON.stringify(outcome, null, 2)}\n`);
console.log(`${outcome.status.toUpperCase()}: ${outcome.message}`);

function run() {
  let store;
  try {
    store = readStore();
  } catch (error) {
    return {
      status: 'error',
      action: null,
      message: `Could not read the bookings file: ${error.message}`,
      errors: [],
    };
  }

  const parsed = parseRequest(process.env.ISSUE_BODY);
  if (!parsed.ok) {
    return { status: 'rejected', action: null, message: parsed.message, errors: [] };
  }

  const request = parsed.request;

  switch (request.action) {
    case 'create':
      return createBooking(request, store);
    case 'cancel':
      return cancelBooking(request, store);
    default:
      return {
        status: 'rejected',
        action: typeof request.action === 'string' ? request.action.slice(0, 20) : null,
        message: 'That request is neither a booking nor a cancellation.',
        errors: [],
      };
  }
}

// --- Creating -------------------------------------------------------------------------------

function createBooking(request, store) {
  const cleaned = {
    date: request.date,
    slot: request.slot,
    area: request.area,
    name: cleanName(request.name),
    party: request.party,
  };

  const result = validateBooking(cleaned, store.bookings, CONFIG, new Date());
  if (!result.ok) {
    return {
      status: 'rejected',
      action: 'create',
      message: 'That table is not available.',
      errors: result.errors,
    };
  }

  const booking = {
    id: newCode(store.bookings),
    date: cleaned.date,
    slot: cleaned.slot,
    area: cleaned.area,
    name: cleaned.name,
    party: cleaned.party,
    clientRef: typeof request.clientRef === 'string' ? request.clientRef.slice(0, 40) : null,
    createdAt: new Date().toISOString(),
  };

  writeStore({ ...store, bookings: applyBooking(store.bookings, booking) });

  const area = areaById(booking.area, CONFIG);
  const service = serviceForSlot(booking.slot, CONFIG);
  writeCommitMessage(
    `Book ${booking.party} for ${service.label.toLowerCase()} at ${booking.slot} ` +
      `${area.label.toLowerCase()} on ${booking.date} (${booking.id})`,
  );

  return {
    status: 'confirmed',
    action: 'create',
    message: `Table booked. Code ${booking.id}.`,
    booking,
    errors: [],
  };
}

// --- Cancelling -----------------------------------------------------------------------------

function cancelBooking(request, store) {
  const existing = findById(store.bookings, request.id);
  if (!existing) {
    const asked = typeof request.id === 'string' ? request.id.trim().slice(0, 20) : '';
    return {
      status: 'rejected',
      action: 'cancel',
      message: `No booking has the code ${asked || '(blank)'}.`,
      errors: [],
    };
  }

  writeStore({ ...store, bookings: removeBooking(store.bookings, existing.id) });
  writeCommitMessage(`Cancel ${existing.slot} ${existing.area} on ${existing.date} (${existing.id})`);

  return {
    status: 'cancelled',
    action: 'cancel',
    message: `Booking ${existing.id} cancelled.`,
    booking: existing,
    errors: [],
  };
}

// --- Reading the request --------------------------------------------------------------------

/**
 * Pull the request out of the issue body. The client posts it as a fenced json block so the
 * issue stays readable by a human; a bare JSON body is accepted too.
 */
function parseRequest(body) {
  if (typeof body !== 'string' || body.trim() === '') {
    return { ok: false, message: 'The issue had no body, so there was nothing to book.' };
  }

  const fenced = body.match(/```json\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : body).trim();

  let request;
  try {
    request = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'The booking details were not valid JSON.' };
  }

  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return { ok: false, message: 'The booking details were not an object.' };
  }

  return { ok: true, request };
}

/**
 * Names end up in JSON, in a commit message and on a web page, so strip control characters and
 * collapse whitespace. Length is enforced by validateBooking.
 */
function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();
}

// --- Booking codes --------------------------------------------------------------------------

function newCode(bookings) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    if (!findById(bookings, code)) return code;
  }
  // 29^6 codes against at most a few hundred bookings, so this is unreachable in practice -
  // but a silent duplicate would be worse than a loud failure.
  throw new Error('Could not find an unused booking code.');
}

// --- The bookings file ----------------------------------------------------------------------

function readStore() {
  const store = JSON.parse(readFileSync(BOOKINGS_PATH, 'utf8'));
  if (!Array.isArray(store.bookings)) throw new Error('bookings is not a list');
  return store;
}

function writeStore(store) {
  // Sorted on write so the diffs in the repo read as a schedule rather than an append log.
  const bookings = [...store.bookings].sort(
    (a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot) || a.id.localeCompare(b.id),
  );
  writeFileSync(BOOKINGS_PATH, `${JSON.stringify({ ...store, bookings }, null, 2)}\n`);
}

function writeCommitMessage(message) {
  writeFileSync(join(TEMP, 'commit-message.txt'), message);
}
