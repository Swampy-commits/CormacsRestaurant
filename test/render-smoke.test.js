import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installFakeDom } from './support/fake-dom.js';
import { CONFIG } from '../js/config.js';
import { toDateKey, addDays } from '../js/booking-rules.js';

// Smoke tests for the render path. These do not check that anything looks right - only a browser
// can do that - but they do prove the pages render at all, that a full area reads FULL, and that
// the booking buttons refuse to work without a token.
//
// Each page is rendered exactly once, at module load. A page controller runs its work in its
// module body, and ES modules only ever execute once, so re-importing per test would hand back a
// cached module that renders nothing and every assertion would pass vacuously.

const TODAY = toDateKey(new Date());
const SOON = addDays(TODAY, 3);

// Outside filled to all 16 seats at 15:00 on a future day, with four people inside at the same
// sitting - so one area is full while the other is not.
const BOOKINGS = [
  { id: 'FULLOU', date: SOON, slot: '15:00', area: 'outside', name: 'Big group', party: 16 },
  { id: 'INSID4', date: SOON, slot: '15:00', area: 'inside', name: 'Nana', party: 4 },
];

const bookingPage = installFakeDom({
  containers: [
    'topbar',
    'status',
    'chef-art',
    'cash-pile',
    'restaurant-name',
    'chef-note',
    'controls',
    'message',
    'slots',
    'mine',
  ],
  bookings: BOOKINGS,
});
await import('../js/app.js');
await settle();

// Which day the page opens on depends on the time of day - after the last sitting it sensibly
// starts on tomorrow. So the tests pick the fixture's day explicitly rather than depending on
// when they happen to run.
const daySelect = bookingPage.getElementById('day');
daySelect.value = SOON;
daySelect.dispatch('change');

const ownerPage = installFakeDom({
  containers: ['topbar', 'status', 'summary', 'message', 'days'],
  bookings: BOOKINGS,
});
await import('../js/admin.js');
await settle();

function settle() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Point the global document at one of the two pages.
 *
 * Both pages were rendered above, and each install replaced globalThis.document - so a click
 * handler belonging to the booking page would otherwise look up its containers in the owner
 * page's document and find nothing.
 */
function focus(page) {
  globalThis.document = page;
  return page;
}

// --- The booking page -----------------------------------------------------------------------

test('a tile is rendered for every sitting', () => {
  const tiles = bookingPage.getElementById('slots').findAll('tile');
  const sittings = CONFIG.services.reduce((total, service) => total + service.slots.length, 0);

  assert.equal(tiles.length, sittings, 'one tile per sitting');
});

test('every bookable tile shows both areas', () => {
  const tiles = bookingPage.getElementById('slots').findAll('tile');
  const bookable = tiles.filter((tile) => !tile.classList.contains('tile--gone'));

  assert.ok(bookable.length > 0, 'every sitting rendered as gone, which cannot be right');

  for (const tile of bookable) {
    for (const area of CONFIG.areas) {
      assert.ok(tile.textContent.includes(area.label), `a tile omitted ${area.label}`);
    }
  }
});

test('the day selector offers today plus the booking horizon', () => {
  const options = bookingPage.getElementById('day').children;

  assert.equal(options.length, CONFIG.maxDaysAhead + 1);
  assert.match(options[0].textContent, /^TODAY/);
});

test('the status bar shows the takings from the data', () => {
  const status = bookingPage.getElementById('status').textContent;
  const dinner = CONFIG.services.find((service) => service.id === 'dinner');
  const expected = 20 * dinner.pricePerHead; // 16 outside + 4 inside, at the dinner price

  assert.ok(status.includes('CASH'), `no CASH in the status bar: ${status}`);
  assert.ok(status.includes(String(expected)), `takings of ${expected} not shown: ${status}`);
});

test('a full area reads FULL while the other area stays open', () => {
  const tile = bookingPage
    .getElementById('slots')
    .findAll('tile')
    .find((node) => node.textContent.includes('15:00'));

  assert.ok(tile, 'no 15:00 tile rendered');

  const text = tile.textContent;
  assert.ok(text.includes('FULL'), `outside is full but the tile does not say so: ${text}`);

  // Four of ten inside seats are taken, so inside must still be offering six.
  assert.ok(text.includes('6/10'), `inside should show 6 of 10 free: ${text}`);

  const buttons = tile.findAll('btn');
  assert.equal(buttons.length, CONFIG.areas.length, 'one button per area');
  assert.ok(
    buttons.some((button) => button.textContent === 'FULL'),
    'no FULL button for the full area',
  );
});

test('a party too big for inside is told so, and outside is unaffected', () => {
  // Twelve people cannot sit inside at all - the area only has ten seats - so that button must
  // explain itself rather than just greying out.
  focus(bookingPage);

  const partyUp = bookingPage.getElementById('controls').findAll('btn').find((b) => b.textContent === '+');
  assert.ok(partyUp, 'no party stepper');

  for (let i = 0; i < 10; i += 1) partyUp.dispatch('click'); // 2 -> 12

  const tile = bookingPage
    .getElementById('slots')
    .findAll('tile')
    .find((node) => node.textContent.includes('16:00')); // an empty sitting

  const labels = tile.findAll('btn').map((button) => button.textContent);
  assert.ok(labels.includes('TOO BIG'), `expected TOO BIG for inside, got ${labels.join(', ')}`);
  assert.ok(labels.includes('OUTSIDE'), `outside should still be offered, got ${labels.join(', ')}`);
});

test('the chef note and the restaurant name are filled in', () => {
  assert.equal(bookingPage.getElementById('restaurant-name').textContent, CONFIG.restaurantName);
  assert.ok(bookingPage.getElementById('chef-note').textContent.length > 20);
});

test('a sprite is drawn for the chef and for the cash pile', () => {
  assert.match(bookingPage.getElementById('chef-art').children[0].innerHTML, /^<svg/);
  assert.match(bookingPage.getElementById('cash-pile').children[0].innerHTML, /^<svg/);
});

test('with no token configured the page says so and every booking button is dead', () => {
  assert.ok(
    bookingPage.getElementById('message').textContent.includes('NOT PLUGGED IN'),
    'expected the no-token notice',
  );

  const buttons = bookingPage.getElementById('slots').findAll('btn');
  assert.ok(buttons.length > 0, 'no booking buttons rendered');
  assert.ok(
    buttons.every((button) => button.disabled),
    'a booking button was live despite there being no token',
  );
});

test('the page offers a way to cancel with a code from another device', () => {
  assert.ok(bookingPage.getElementById('cancel-code'), 'no cancel-by-code input');
});

// --- OWNER MODE -----------------------------------------------------------------------------

test('OWNER MODE lists the sittings that have bookings, by name', () => {
  const days = ownerPage.getElementById('days').textContent;

  assert.ok(days.includes('15:00'), `the booked sitting is not listed: ${days}`);
  assert.ok(days.includes('Nana'), 'the booking is not listed by name');
  assert.ok(days.includes('Big group'), 'the outside booking is not listed');
});

test('OWNER MODE totals the books', () => {
  const summary = ownerPage.getElementById('summary').textContent;

  assert.ok(summary.includes('COVERS'), `no covers total: ${summary}`);
  assert.ok(summary.includes('20'), 'the 20 covers are not totalled');
});

test('OWNER MODE shows both areas for a booked sitting', () => {
  const days = ownerPage.getElementById('days').textContent;

  for (const area of CONFIG.areas) {
    assert.ok(days.includes(area.label), `${area.label} missing from the sitting breakdown`);
  }
});
