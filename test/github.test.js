import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../js/config.js';
import { hasToken, token, readMarker, issueUrl, GitHubError } from '../js/github.js';
import { encodeToken } from '../js/token-codec.js';

// CONFIG is shared, so each test puts back what it found. Test files run in separate processes
// under `node --test`, so this cannot leak into the other suites.
function withTokenParts(parts, body) {
  const original = CONFIG.tokenParts;
  CONFIG.tokenParts = parts;
  try {
    body();
  } finally {
    CONFIG.tokenParts = original;
  }
}

test('a fresh clone with no token knows it has no token', () => {
  withTokenParts([], () => {
    assert.equal(hasToken(), false);
  });
});

test('asking for a token that was never configured fails with something a person can read', () => {
  withTokenParts([], () => {
    assert.throws(
      () => token(),
      (error) => {
        assert.ok(error instanceof GitHubError);
        assert.match(error.friendly, /README/, 'the message should point somewhere useful');
        return true;
      },
    );
  });
});

test('a configured token is reassembled exactly', () => {
  const sample = `${['github', 'pat', ''].join('_')}11EXAMPLEEXAMPLEEXAMPLE_abcdefghijklmnopqrstuvwxyz012345`;

  withTokenParts(encodeToken(sample), () => {
    assert.equal(hasToken(), true);
    assert.equal(token(), sample);
  });
});

// --- Reading the Action's answer -------------------------------------------------------------

test('the outcome is read out of the hidden marker, not the prose', () => {
  const body = [
    '## TABLE BOOKED',
    '',
    '**Code `K7QD2M`** - keep this.',
    '',
    '<!-- cormac:{"status":"confirmed","message":"Table booked.","reasons":[],"booking":{"id":"K7QD2M","party":4}} -->',
  ].join('\n');

  const outcome = readMarker(body);

  assert.equal(outcome.status, 'confirmed');
  assert.equal(outcome.booking.id, 'K7QD2M');
  assert.equal(outcome.booking.party, 4);
});

test('a comment from a person is not mistaken for an answer', () => {
  assert.equal(readMarker('Can I bring the dog?'), null);
  assert.equal(readMarker(''), null);
  assert.equal(readMarker(undefined), null);
});

test('a corrupted marker is ignored rather than crashing the page', () => {
  assert.equal(readMarker('<!-- cormac:{not json} -->'), null);
});

test('a refusal carries its reasons through', () => {
  const outcome = readMarker(
    '## NO TABLE\n\n<!-- cormac:{"status":"rejected","message":"That table is not available.",' +
      '"reasons":["INSIDE is full at 15:00."],"booking":null} -->',
  );

  assert.equal(outcome.status, 'rejected');
  assert.deepEqual(outcome.reasons, ['INSIDE is full at 15:00.']);
});

test('the issue link points at this repository', () => {
  assert.equal(issueUrl(12), `https://github.com/${CONFIG.owner}/${CONFIG.repo}/issues/12`);
});
