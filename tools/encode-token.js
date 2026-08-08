// Obfuscates a booking token so it can be committed without GitHub's secret scanning spotting
// it and auto-revoking it.
//
//   node tools/encode-token.js github_pat_xxxxxxxxxxxx
//
// Paste the printed array into tokenParts in js/config.js. See the README for how to create the
// token in the first place, and what it is and isn't allowed to do.

import { encodeToken, decodeToken } from '../js/token-codec.js';

const token = process.argv[2];

if (!token) {
  console.error('Usage: node tools/encode-token.js <token>');
  process.exit(1);
}

if (!/^(github_pat_|ghp_)/.test(token)) {
  console.error('That does not look like a GitHub token (expected it to start github_pat_ or ghp_).');
  process.exit(1);
}

const parts = encodeToken(token);

console.log('\nPaste this into js/config.js as tokenParts:\n');
console.log(`  tokenParts: [\n${parts.map((part) => `    '${part}',`).join('\n')}\n  ],\n`);

// Prove the round trip before anyone commits it, so a bad paste fails here rather than in the app.
if (decodeToken(parts) !== token) {
  console.error('Round trip failed - do not use this output.');
  process.exit(1);
}

console.log('Round trip checked: the site will decode this back to your token.\n');
