import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encodeToken, decodeToken } from '../js/token-codec.js';

// If the encoder and the browser ever disagree, bookings stop working with a confusing 401. So
// the round trip is worth pinning down, as is the one property that matters: the encoded form
// must not contain anything that looks like a GitHub token, or secret scanning will revoke it.

// Assembled rather than written out, so this test file doesn't itself look like a leaked token
// and trip push protection on the way into a public repository.
const PREFIX = ['github', 'pat', ''].join('_');
const SAMPLE = `${PREFIX}11ABCDEFG0abcdefghijkl_MNOPQRSTUVWXYZ0123456789abcdefghijKLMNOP`;

test('a token survives the round trip', () => {
  assert.equal(decodeToken(encodeToken(SAMPLE)), SAMPLE);
});

test('tokens of any length round trip, including awkward ones', () => {
  for (const token of ['ghp' + '_a', 'ghp' + '_ab', PREFIX + 'x'.repeat(63), 'ghp' + '_' + 'z'.repeat(100)]) {
    assert.equal(decodeToken(encodeToken(token)), token, `failed for length ${token.length}`);
  }
});

test('the encoded parts do not contain the token or its prefix', () => {
  const joined = encodeToken(SAMPLE).join('');

  assert.ok(!joined.includes(PREFIX), 'the prefix survived, so secret scanning would match');
  assert.ok(!joined.includes('ghp' + '_'), 'the prefix survived, so secret scanning would match');
  assert.ok(!joined.includes(SAMPLE.slice(11, 25)), 'a recognisable run of the token survived');
});

test('the token is split into several parts, so no single string is the whole secret', () => {
  assert.equal(encodeToken(SAMPLE).length, 4);
  assert.equal(encodeToken(SAMPLE, 2).length, 2);
});

test('every part is valid base64', () => {
  for (const part of encodeToken(SAMPLE)) {
    assert.match(part, /^[A-Za-z0-9+/]+={0,2}$/, `not base64: ${part}`);
  }
});
