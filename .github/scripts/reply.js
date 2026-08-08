// Replies on the booking issue and closes it.
//
// Kept separate from process-booking.js because the write step may run several times when two
// bookings race for the same seats. This runs exactly once, at the end, so the family sees one
// answer rather than one per attempt.
//
// Reads: GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE_NUMBER, and outcome.json from RUNNER_TEMP.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CONFIG } from '../../js/config.js';
import { areaById, serviceForSlot } from '../../js/booking-rules.js';
import { bookingValue, formatCash } from '../../js/money.js';

const API = 'https://api.github.com';
const TEMP = process.env.RUNNER_TEMP || tmpdir();

const token = required('GITHUB_TOKEN');
const repository = required('GITHUB_REPOSITORY');
const issueNumber = required('ISSUE_NUMBER');

const outcome = readOutcome();

await comment(`${composeComment(outcome)}\n\n${marker(outcome)}`);
await closeIssue();

console.log(`Replied on issue #${issueNumber} (${outcome.status}).`);

// --- The machine-readable answer ------------------------------------------------------------

/**
 * The site is watching this issue's comments to find out what happened. Prose is for people, so
 * the answer it actually reads goes in an HTML comment: invisible on GitHub, trivial to parse,
 * and it means the browser never has to guess meaning from wording.
 */
function marker(outcome) {
  const booking = outcome.booking ?? null;

  const payload = {
    status: outcome.status,
    message: outcome.message,
    reasons: (outcome.errors ?? []).map((error) => error.message),
    booking: booking
      ? {
          id: booking.id,
          date: booking.date,
          slot: booking.slot,
          area: booking.area,
          party: booking.party,
          name: booking.name,
          clientRef: booking.clientRef ?? null,
        }
      : null,
  };

  return `<!-- cormac:${JSON.stringify(payload)} -->`;
}

// --- Composing the reply --------------------------------------------------------------------

function composeComment(outcome) {
  switch (outcome.status) {
    case 'confirmed':
      return confirmedComment(outcome.booking);
    case 'cancelled':
      return [
        '## TABLE FREED',
        '',
        `Booking \`${outcome.booking.id}\` is cancelled and those seats are back on the board.`,
      ].join('\n');
    case 'rejected':
      return rejectedComment(outcome);
    default:
      return [
        '## OUT OF ORDER',
        '',
        'Something went wrong in the kitchen and this booking was not saved.',
        '',
        `> ${outcome.message}`,
        '',
        'Nothing has been changed. Try again, and if it keeps happening check the Actions log.',
      ].join('\n');
  }
}

function confirmedComment(booking) {
  const area = areaById(booking.area, CONFIG);
  const service = serviceForSlot(booking.slot, CONFIG);
  const value = bookingValue(booking, CONFIG);

  return [
    '## TABLE BOOKED',
    '',
    `**Code \`${booking.id}\`** - keep this, it is what cancels the booking.`,
    '',
    `| | |`,
    `|---|---|`,
    `| Name | ${escapeCell(booking.name)} |`,
    `| Party | ${booking.party} |`,
    `| Day | ${booking.date} |`,
    `| Sitting | ${booking.slot} (${service.label.toLowerCase()}) |`,
    `| Seated | ${area.label.toLowerCase()} |`,
    `| Worth | ${formatCash(value, CONFIG)} to the chef |`,
    '',
    'See you then.',
  ].join('\n');
}

function rejectedComment(outcome) {
  const reasons = (outcome.errors ?? []).map((error) => `- ${error.message}`);

  return [
    '## NO TABLE',
    '',
    outcome.message,
    ...(reasons.length > 0 ? ['', ...reasons] : []),
    '',
    'Nothing has been booked. Pick another sitting and try again.',
  ].join('\n');
}

/** Names are family first names, but they still shouldn't be able to break a table row. */
function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|');
}

// --- The API -------------------------------------------------------------------------------

async function comment(body) {
  await api(`/repos/${repository}/issues/${issueNumber}/comments`, 'POST', { body });
}

async function closeIssue() {
  await api(`/repos/${repository}/issues/${issueNumber}`, 'PATCH', {
    state: 'closed',
    state_reason: 'completed',
  });
}

async function api(path, method, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

// --- Odds and ends -------------------------------------------------------------------------

function readOutcome() {
  try {
    return JSON.parse(readFileSync(join(TEMP, 'outcome.json'), 'utf8'));
  } catch {
    // The write step crashed before it could record anything.
    return {
      status: 'error',
      message: 'The booking never got as far as being checked.',
      errors: [],
    };
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}
