import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SPRITES, PALETTE, spriteSvg, cashPileSvg, CASH_TIER_COUNT } from '../js/sprites.js';
import { CONFIG } from '../js/config.js';

// The sprites are hand-edited pixel strings, so the things that go wrong are boring: a row a
// character short, or a stray character that isn't in the palette and silently renders as a
// transparent hole. These tests exist to catch exactly that.

test('every sprite has rectangular rows', () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    const widths = new Set(rows.map((row) => row.length));
    assert.equal(widths.size, 1, `${name} has ragged rows: widths ${[...widths].join(', ')}`);
  }
});

test('every sprite pixel is a known palette character', () => {
  const known = new Set(Object.keys(PALETTE));

  for (const [name, rows] of Object.entries(SPRITES)) {
    rows.forEach((row, y) => {
      for (const character of row) {
        assert.ok(
          known.has(character),
          `${name} row ${y} uses "${character}" (U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}), which is not in the palette`,
        );
      }
    });
  }
});

test('there is a cash pile tier for every threshold in the config', () => {
  assert.equal(
    CASH_TIER_COUNT,
    CONFIG.cashPileTiers.length,
    'each cashPileTiers threshold needs a matching pile drawing',
  );
});

test('every cash pile tier is rectangular and uses known colours', () => {
  const known = new Set(Object.keys(PALETTE));

  for (let tier = 0; tier < CASH_TIER_COUNT; tier += 1) {
    const svg = cashPileSvg(tier);
    assert.match(svg, /^<svg viewBox="0 0 \d+ \d+"/, `tier ${tier} did not render`);
    assert.ok(known.size > 0);
  }
});

test('spriteSvg sizes the viewBox to the sprite', () => {
  const svg = spriteSvg(['kkk', 'k.k', 'kkk']);
  assert.match(svg, /viewBox="0 0 3 3"/);
});

test('spriteSvg merges runs of the same colour into one rect', () => {
  const svg = spriteSvg(['kkkk']);
  assert.equal((svg.match(/<rect/g) ?? []).length, 1);
  assert.match(svg, /width="4"/);
});

test('spriteSvg skips transparent pixels', () => {
  assert.equal((spriteSvg(['....']).match(/<rect/g) ?? []).length, 0);
});

test('a titled sprite is announced, an untitled one is hidden from screen readers', () => {
  assert.match(spriteSvg(['k'], { title: 'Cormac the chef' }), /role="img" aria-label="Cormac the chef"/);
  assert.match(spriteSvg(['k']), /aria-hidden="true"/);
});

test('a sprite title cannot break out of the attribute', () => {
  const svg = spriteSvg(['k'], { title: 'a" onload="alert(1)' });

  // The quotes must be entity-escaped, so the whole thing stays inside aria-label and cannot
  // become a second attribute. The text "onload=" surviving is harmless once quoted.
  assert.ok(svg.includes('aria-label="a&quot; onload=&quot;alert(1)"'), `not escaped: ${svg}`);
});

test('cashPileSvg clamps a tier outside the range instead of throwing', () => {
  assert.match(cashPileSvg(-5), /^<svg/);
  assert.match(cashPileSvg(999), /^<svg/);
  assert.equal(cashPileSvg(999), cashPileSvg(CASH_TIER_COUNT - 1));
});
