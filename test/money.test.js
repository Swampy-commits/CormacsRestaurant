import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingValue,
  totalTakings,
  takingsByDate,
  hiScore,
  cashPileTier,
  formatCash,
  padScore,
} from '../js/money.js';

import { CONFIG } from '../js/config.js';

// Breakfast is €6 a head, dinner €15.
const BREAKFAST_PRICE = 6;
const DINNER_PRICE = 15;

function booking(overrides = {}) {
  return { id: 'AAAAAA', date: '2026-08-09', slot: '15:00', area: 'outside', name: 'Cormac', party: 2, ...overrides };
}

test('a booking is worth the price of its own service', () => {
  assert.equal(bookingValue(booking({ slot: '09:00', party: 3 }), CONFIG), 3 * BREAKFAST_PRICE);
  assert.equal(bookingValue(booking({ slot: '15:00', party: 4 }), CONFIG), 4 * DINNER_PRICE);
});

test('the area a booking sits in does not change its price', () => {
  const inside = booking({ slot: '15:00', party: 4, area: 'inside' });
  const outside = booking({ slot: '15:00', party: 4, area: 'outside' });

  assert.equal(bookingValue(inside, CONFIG), bookingValue(outside, CONFIG));
});

test('a booking on an unrecognised slot is worth nothing rather than throwing', () => {
  assert.equal(bookingValue(booking({ slot: '12:00' }), CONFIG), 0);
});

test('takings add up across services at their different prices', () => {
  const bookings = [
    booking({ id: 'A', slot: '08:00', party: 2 }), //  2 × 6  = 12
    booking({ id: 'B', slot: '15:00', party: 4 }), //  4 × 15 = 60
    booking({ id: 'C', slot: '17:00', party: 6 }), //  6 × 15 = 90
  ];

  assert.equal(totalTakings(bookings, CONFIG), 12 + 60 + 90);
});

test('takings are zero when nothing is booked', () => {
  assert.equal(totalTakings([], CONFIG), 0);
  assert.equal(hiScore([], CONFIG), 0);
});

test('takingsByDate groups each day separately', () => {
  const bookings = [
    booking({ id: 'A', date: '2026-08-09', slot: '08:00', party: 2 }), // 12
    booking({ id: 'B', date: '2026-08-09', slot: '15:00', party: 4 }), // 60
    booking({ id: 'C', date: '2026-08-10', slot: '16:00', party: 2 }), // 30
  ];

  assert.deepEqual(takingsByDate(bookings, CONFIG), {
    '2026-08-09': 72,
    '2026-08-10': 30,
  });
});

test('the hi-score is the best single day, not the running total', () => {
  const bookings = [
    // A big breakfast-only day: 10 × 6 = 60.
    booking({ id: 'A', date: '2026-08-09', slot: '08:00', party: 10 }),
    // A quieter day, but dinner pays better: 6 × 15 = 90.
    booking({ id: 'B', date: '2026-08-10', slot: '15:00', party: 6 }),
  ];

  assert.equal(totalTakings(bookings, CONFIG), 150);
  assert.equal(hiScore(bookings, CONFIG), 90);
});

test('the hi-score sums every sitting within its best day', () => {
  const bookings = [
    booking({ id: 'A', date: '2026-08-09', slot: '08:00', party: 4 }), // 24
    booking({ id: 'B', date: '2026-08-09', slot: '14:00', party: 8 }), // 120
    booking({ id: 'C', date: '2026-08-09', slot: '17:00', party: 2 }), // 30
    booking({ id: 'D', date: '2026-08-11', slot: '15:00', party: 9 }), // 135
  ];

  assert.equal(hiScore(bookings, CONFIG), 174);
});

test('the cash pile gains a tier as each threshold is passed', () => {
  const tiers = CONFIG.cashPileTiers; // [0, 100, 250, 500, 1000, 2500, 5000, 10000]

  assert.equal(cashPileTier(0, CONFIG), 0);
  assert.equal(cashPileTier(99, CONFIG), 0);
  assert.equal(cashPileTier(100, CONFIG), 1);
  assert.equal(cashPileTier(249, CONFIG), 1);
  assert.equal(cashPileTier(250, CONFIG), 2);
  assert.equal(cashPileTier(9999, CONFIG), tiers.length - 2);
});

test('the cash pile stops growing at the top tier rather than overflowing', () => {
  const top = CONFIG.cashPileTiers.length - 1;

  assert.equal(cashPileTier(10000, CONFIG), top);
  assert.equal(cashPileTier(999999, CONFIG), top);
});

test('cash is formatted with the currency symbol and thousands separators', () => {
  assert.equal(formatCash(0, CONFIG), '€0');
  assert.equal(formatCash(72, CONFIG), '€72');
  assert.equal(formatCash(1240, CONFIG), '€1,240');
  assert.equal(formatCash(14320, CONFIG), '€14,320');
  assert.equal(formatCash(1000000, CONFIG), '€1,000,000');
});

test('the arcade score pads to a fixed width and never truncates a big number', () => {
  assert.equal(padScore(0, 6), '000000');
  assert.equal(padScore(1240, 6), '001240');
  assert.equal(padScore(14320, 6), '014320');
  assert.equal(padScore(1234567, 6), '1234567');
});
