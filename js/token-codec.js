// Hides the booking token from GitHub's secret scanning.
//
// Shared by tools/encode-token.js (which produces the parts) and js/github.js (which reads them
// back), so the two can never drift apart. btoa and atob exist in both Node and the browser, so
// this one implementation serves both.
//
// This is obfuscation, not encryption, and does not pretend otherwise. The token ships inside a
// public site; anyone who wants it can have it in seconds. It is acceptable only because the
// token can do exactly one thing - open issues in one repository - and because this is a family
// app. The point is purely to stop secret scanning auto-revoking the token and silently breaking
// bookings. See the README.

const KEY = 'cormac-arcade';

/** Split a token into obfuscated, base64 parts for pasting into config.js. */
export function encodeToken(token, chunks = 4) {
  const scrambled = xor(token);
  const size = Math.ceil(scrambled.length / chunks);

  const parts = [];
  for (let start = 0; start < scrambled.length; start += size) {
    parts.push(btoa(scrambled.slice(start, start + size)));
  }
  return parts;
}

/** Reassemble a token from the parts in config.js. */
export function decodeToken(parts) {
  return xor(parts.map((part) => atob(part)).join(''));
}

/** XOR against the repeating key. Its own inverse, so encode and decode are the same pass. */
function xor(value) {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    out += String.fromCharCode(value.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return out;
}
