// Talking to GitHub.
//
// The site is static, so GitHub itself is the backend. The browser's only privileged action is
// opening an issue: the token in config.js can do nothing else, in no other repository. An Action
// picks the issue up, checks it, writes data/bookings.json and answers in a comment.
//
// The token is public - anyone can read it out of this site. That is understood and accepted for
// a family app; see the README. It is XOR-obfuscated only so GitHub's secret scanning doesn't
// spot it and auto-revoke it, which would quietly break bookings.

import { CONFIG } from './config.js';
import { decodeToken } from './token-codec.js';

const API = 'https://api.github.com';

/** Thrown for anything that isn't a normal, expected answer. */
export class GitHubError extends Error {
  constructor(message, { status = null, friendly = null } = {}) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    // What a family member should be shown, as opposed to what a developer needs.
    this.friendly = friendly ?? 'The booking machine is not answering. Try again in a minute.';
  }
}

/** Is a token configured at all? False on a fresh clone, before one has been generated. */
export function hasToken() {
  return Array.isArray(CONFIG.tokenParts) && CONFIG.tokenParts.length > 0;
}

/** Reassemble the token from the obfuscated parts in config.js. */
export function token() {
  if (!hasToken()) {
    throw new GitHubError('No token configured.', {
      friendly: 'This machine has no booking key yet. See the README to set one up.',
    });
  }

  return decodeToken(CONFIG.tokenParts);
}

/** Open an issue. This is the one write the browser is allowed to make. */
export async function createIssue(title, body) {
  return api(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues`, {
    method: 'POST',
    body: { title, body },
  });
}

/** Read the comments on an issue, which is how we learn what the Action decided. */
export async function issueComments(number) {
  return api(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${number}/comments`);
}

/**
 * Wait for the Action to answer.
 *
 * Polls the issue's comments rather than data/bookings.json, because a Pages redeploy adds
 * another half-minute of lag after the data is already correct. Resolves with the outcome the
 * Action recorded, or null if it never showed up.
 *
 * @param {number} number issue number
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.intervalMs]
 * @param {(elapsedMs: number) => void} [options.onTick]
 */
export async function waitForOutcome(number, { timeoutMs = 90000, intervalMs = 3000, onTick } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(intervalMs);

    if (onTick) onTick(Date.now() - startedAt);

    let comments;
    try {
      comments = await issueComments(number);
    } catch (error) {
      // A blip while polling shouldn't abandon a booking that may well have succeeded.
      if (error.status === 401 || error.status === 403) throw error;
      continue;
    }

    for (const comment of comments) {
      const outcome = readMarker(comment.body);
      if (outcome) return outcome;
    }
  }

  return null;
}

/**
 * Pull the machine-readable outcome out of a comment. reply.js hides it in an HTML comment so
 * the visible text stays readable, and so this never has to parse prose.
 */
export function readMarker(body) {
  const match = typeof body === 'string' ? body.match(/<!--\s*cormac:(\{[\s\S]*?\})\s*-->/) : null;
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** The URL of an issue, for when we give up waiting and want to show the family something. */
export function issueUrl(number) {
  return `https://github.com/${CONFIG.owner}/${CONFIG.repo}/issues/${number}`;
}

// --- The plumbing ---------------------------------------------------------------------------

async function api(path, { method = 'GET', body = null } = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new GitHubError(`Network request failed: ${error.message}`, {
      friendly: 'No connection. Check the wifi and try again.',
    });
  }

  if (response.status === 401 || response.status === 403) {
    // The single most likely long-term breakage: fine-grained tokens expire, and a leaked one
    // gets revoked. Say so plainly instead of failing silently.
    throw new GitHubError(`Auth failed: ${response.status}`, {
      status: response.status,
      friendly: 'OUT OF ORDER - the booking key needs renewing. Ask the owner.',
    });
  }

  if (!response.ok) {
    throw new GitHubError(`${method} ${path} failed: ${response.status}`, { status: response.status });
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
