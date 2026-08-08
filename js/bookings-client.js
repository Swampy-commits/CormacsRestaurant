// Filing a booking or a cancellation, and waiting for the answer.
//
// Both the booking page and OWNER MODE need this, so the issue format and the polling live here
// once. The issue body is the contract with .github/scripts/process-booking.js: a fenced json
// block holding the request.

import * as gh from './github.js';

/**
 * Ask for a table.
 *
 * @param {{date: string, slot: string, area: string, name: string, party: number}} request
 * @param {object} [options] passed through to the poller (timeoutMs, intervalMs, onTick)
 * @returns {Promise<{outcome: object|null, issueNumber: number}>} outcome is null on timeout
 */
export async function submitBooking(request, options) {
  const payload = { action: 'create', ...request, clientRef: newRef() };

  const issue = await gh.createIssue(
    `booking: ${request.date} ${request.slot} ${request.area}`,
    issueBody(payload),
  );

  return { outcome: await gh.waitForOutcome(issue.number, options), issueNumber: issue.number };
}

/**
 * Give a table back.
 *
 * @param {string} code the booking code
 * @param {object} [options]
 * @returns {Promise<{outcome: object|null, issueNumber: number}>}
 */
export async function submitCancellation(code, options) {
  const id = String(code ?? '').trim().toUpperCase();
  const payload = { action: 'cancel', id, clientRef: newRef() };

  const issue = await gh.createIssue(`cancel: ${id}`, issueBody(payload));

  return { outcome: await gh.waitForOutcome(issue.number, options), issueNumber: issue.number };
}

/** A throwaway id, so a request can be matched to its answer if it ever needs to be. */
function newRef() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function issueBody(payload) {
  return [
    'Filed by the booking page. The workflow reads the block below.',
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
  ].join('\n');
}
