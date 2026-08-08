import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  serviceForSlot,
  allSlots,
  areaById,
  seatsTaken,
  seatsRemaining,
  slotSummary,
  validateBooking,
  applyBooking,
  removeBooking,
  findById,
  toDateKey,
  addDays,
} from '../js/booking-rules.js';

import { CONFIG } from '../js/config.js';

// A fixed "now" so nothing here depends on the real clock: Sat 8 Aug 2026, 12:00 local.
// Midday sits in the closed gap between breakfast and dinner, which is a useful vantage point.
const NOW = new Date(2026, 7, 8, 12, 0, 0);
const TODAY = '2026-08-08';
const TOMORROW = '2026-08-09';

function booking(overrides = {}) {
  return {
    id: 'AAAAAA',
    date: TOMORROW,
    slot: '15:00',
    area: 'outside',
    name: 'Cormac',
    party: 2,
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    date: TOMORROW,
    slot: '15:00',
    area: 'outside',
    name: 'Cormac',
    party: 2,
    ...overrides,
  };
}

function codes(result) {
  return result.errors.map((e) => e.code);
}

// --- Services and slots -------------------------------------------------------------------

test('serviceForSlot maps each opening time to its service', () => {
  assert.equal(serviceForSlot('08:00', CONFIG).id, 'breakfast');
  assert.equal(serviceForSlot('09:00', CONFIG).id, 'breakfast');
  assert.equal(serviceForSlot('14:00', CONFIG).id, 'dinner');
  assert.equal(serviceForSlot('17:00', CONFIG).id, 'dinner');
});

test('serviceForSlot rejects times in the closed midday gap', () => {
  for (const slot of ['10:00', '11:00', '12:00', '13:00']) {
    assert.equal(serviceForSlot(slot, CONFIG), null, `${slot} should not be a sitting`);
  }
});

test('serviceForSlot rejects times after the last dinner sitting', () => {
  // Doors shut at 18:00, so 18:00 itself is not a sitting.
  assert.equal(serviceForSlot('18:00', CONFIG), null);
  assert.equal(serviceForSlot('07:00', CONFIG), null);
});

test('allSlots returns the six daily sittings in order', () => {
  assert.deepEqual(allSlots(CONFIG), ['08:00', '09:00', '14:00', '15:00', '16:00', '17:00']);
});

test('areaById finds known areas and rejects unknown ones', () => {
  assert.equal(areaById('inside', CONFIG).seats, 10);
  assert.equal(areaById('outside', CONFIG).seats, 16);
  assert.equal(areaById('rooftop', CONFIG), null);
});

// --- Per-area capacity --------------------------------------------------------------------

test('seatsTaken counts only the matching date, slot and area', () => {
  const bookings = [
    booking({ id: 'A', party: 4, area: 'inside' }),
    booking({ id: 'B', party: 3, area: 'outside' }),
    booking({ id: 'C', party: 5, area: 'inside', slot: '16:00' }),
    booking({ id: 'D', party: 2, area: 'inside', date: '2026-08-10' }),
  ];

  assert.equal(seatsTaken(bookings, TOMORROW, '15:00', 'inside'), 4);
  assert.equal(seatsTaken(bookings, TOMORROW, '15:00', 'outside'), 3);
  assert.equal(seatsTaken(bookings, TOMORROW, '16:00', 'inside'), 5);
  assert.equal(seatsTaken(bookings, '2026-08-10', '15:00', 'inside'), 2);
});

test('filling inside does not consume any outside seats', () => {
  const bookings = [booking({ id: 'A', party: 10, area: 'inside' })];

  assert.equal(seatsRemaining(bookings, TOMORROW, '15:00', 'inside', CONFIG), 0);
  assert.equal(seatsRemaining(bookings, TOMORROW, '15:00', 'outside', CONFIG), 16);
});

test('filling outside does not consume any inside seats', () => {
  const bookings = [booking({ id: 'A', party: 16, area: 'outside' })];

  assert.equal(seatsRemaining(bookings, TOMORROW, '15:00', 'outside', CONFIG), 0);
  assert.equal(seatsRemaining(bookings, TOMORROW, '15:00', 'inside', CONFIG), 10);
});

test('slotSummary reports both areas independently', () => {
  const bookings = [
    booking({ id: 'A', party: 4, area: 'inside' }),
    booking({ id: 'B', party: 16, area: 'outside' }),
  ];

  const summary = slotSummary(bookings, TOMORROW, '15:00', CONFIG);

  assert.equal(summary.slot, '15:00');
  assert.equal(summary.service.id, 'dinner');

  const inside = summary.areas.find((a) => a.id === 'inside');
  const outside = summary.areas.find((a) => a.id === 'outside');

  assert.deepEqual(
    { taken: inside.taken, remaining: inside.remaining, full: inside.full },
    { taken: 4, remaining: 6, full: false },
  );
  assert.deepEqual(
    { taken: outside.taken, remaining: outside.remaining, full: outside.full },
    { taken: 16, remaining: 0, full: true },
  );
});

// --- Validation: capacity edges -----------------------------------------------------------

test('a party that exactly fills the remaining seats is accepted', () => {
  const bookings = [booking({ id: 'A', party: 6, area: 'inside' })];
  const result = validateBooking(request({ area: 'inside', party: 4 }), bookings, CONFIG, NOW);

  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('a party one seat over the remaining seats is refused', () => {
  const bookings = [booking({ id: 'A', party: 6, area: 'inside' })];
  const result = validateBooking(request({ area: 'inside', party: 5 }), bookings, CONFIG, NOW);

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['NO_ROOM']);
});

test('a party of 12 is refused inside but accepted outside', () => {
  const inside = validateBooking(request({ area: 'inside', party: 12 }), [], CONFIG, NOW);
  const outside = validateBooking(request({ area: 'outside', party: 12 }), [], CONFIG, NOW);

  assert.equal(inside.ok, false);
  assert.deepEqual(codes(inside), ['PARTY_TOO_BIG_FOR_AREA']);
  assert.equal(outside.ok, true, JSON.stringify(outside.errors));
});

test('a party of 17 is refused everywhere', () => {
  for (const area of ['inside', 'outside']) {
    const result = validateBooking(request({ area, party: 17 }), [], CONFIG, NOW);
    assert.equal(result.ok, false, `party of 17 should not fit ${area}`);
    assert.deepEqual(codes(result), ['PARTY_TOO_BIG_FOR_AREA']);
  }
});

test('the two areas can be filled to capacity in the same sitting', () => {
  let bookings = [];
  bookings = applyBooking(bookings, booking({ id: 'A', party: 10, area: 'inside' }));
  bookings = applyBooking(bookings, booking({ id: 'B', party: 16, area: 'outside' }));

  assert.equal(validateBooking(request({ area: 'inside', party: 1 }), bookings, CONFIG, NOW).ok, false);
  assert.equal(validateBooking(request({ area: 'outside', party: 1 }), bookings, CONFIG, NOW).ok, false);

  // ...but the next sitting along is untouched.
  const next = validateBooking(request({ slot: '16:00', area: 'inside', party: 10 }), bookings, CONFIG, NOW);
  assert.equal(next.ok, true, JSON.stringify(next.errors));
});

// --- Validation: times, dates and areas ---------------------------------------------------

test('a time in the closed midday gap is refused', () => {
  const result = validateBooking(request({ slot: '12:00' }), [], CONFIG, NOW);

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['UNKNOWN_SLOT']);
});

test('an unknown area is refused', () => {
  const result = validateBooking(request({ area: 'rooftop' }), [], CONFIG, NOW);

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['UNKNOWN_AREA']);
});

test('a date in the past is refused', () => {
  const result = validateBooking(request({ date: '2026-08-07' }), [], CONFIG, NOW);

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['PAST_DATE']);
});

test('a date beyond the booking horizon is refused', () => {
  const justInside = addDays(TODAY, CONFIG.maxDaysAhead);
  const justOutside = addDays(TODAY, CONFIG.maxDaysAhead + 1);

  assert.equal(validateBooking(request({ date: justInside }), [], CONFIG, NOW).ok, true);

  const result = validateBooking(request({ date: justOutside }), [], CONFIG, NOW);
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['TOO_FAR_AHEAD']);
});

test('a malformed date is refused', () => {
  for (const date of ['', 'tomorrow', '2026-8-9', '9999-99-99']) {
    const result = validateBooking(request({ date }), [], CONFIG, NOW);
    assert.equal(result.ok, false, `${date} should be refused`);
    assert.ok(codes(result).includes('BAD_DATE'), `${date} should report BAD_DATE`);
  }
});

test("a sitting that has already started today is refused, later ones today are fine", () => {
  // NOW is 12:00, so both breakfast sittings have gone but every dinner sitting is still ahead.
  for (const slot of ['08:00', '09:00']) {
    const result = validateBooking(request({ date: TODAY, slot }), [], CONFIG, NOW);
    assert.equal(result.ok, false, `${slot} today should have gone`);
    assert.deepEqual(codes(result), ['PAST_SITTING']);
  }

  for (const slot of ['14:00', '17:00']) {
    const result = validateBooking(request({ date: TODAY, slot }), [], CONFIG, NOW);
    assert.equal(result.ok, true, `${slot} today should still be bookable`);
  }
});

test('a sitting under way right now is refused', () => {
  // 15:30: the 15:00 sitting has started, 16:00 has not.
  const during = new Date(2026, 7, 8, 15, 30, 0);

  assert.equal(validateBooking(request({ date: TODAY, slot: '15:00' }), [], CONFIG, during).ok, false);
  assert.equal(validateBooking(request({ date: TODAY, slot: '16:00' }), [], CONFIG, during).ok, true);
});

test('a past sitting on a future date is still bookable', () => {
  const result = validateBooking(request({ date: TOMORROW, slot: '08:00' }), [], CONFIG, NOW);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

// --- Validation: party size and name ------------------------------------------------------

test('party size must be a positive whole number', () => {
  for (const party of [0, -3, 2.5, '4', null, undefined, NaN]) {
    const result = validateBooking(request({ party }), [], CONFIG, NOW);
    assert.equal(result.ok, false, `party of ${String(party)} should be refused`);
    assert.ok(codes(result).includes('BAD_PARTY'), `party of ${String(party)} should report BAD_PARTY`);
  }
});

test('a name is required and is length limited', () => {
  assert.deepEqual(codes(validateBooking(request({ name: '' }), [], CONFIG, NOW)), ['BAD_NAME']);
  assert.deepEqual(codes(validateBooking(request({ name: '   ' }), [], CONFIG, NOW)), ['BAD_NAME']);
  assert.deepEqual(
    codes(validateBooking(request({ name: 'x'.repeat(CONFIG.maxNameLength + 1) }), [], CONFIG, NOW)),
    ['BAD_NAME'],
  );
  assert.equal(
    validateBooking(request({ name: 'x'.repeat(CONFIG.maxNameLength) }), [], CONFIG, NOW).ok,
    true,
  );
});

test('several problems at once are all reported', () => {
  const result = validateBooking(
    request({ slot: '12:00', area: 'rooftop', party: 0, name: '' }),
    [],
    CONFIG,
    NOW,
  );

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result).sort(), ['BAD_NAME', 'BAD_PARTY', 'UNKNOWN_AREA', 'UNKNOWN_SLOT']);
});

// --- Adding, removing and finding ---------------------------------------------------------

test('applyBooking does not mutate the array it is given', () => {
  const original = [booking({ id: 'A' })];
  const updated = applyBooking(original, booking({ id: 'B' }));

  assert.equal(original.length, 1);
  assert.equal(updated.length, 2);
});

test('cancelling returns the seats to the right area only', () => {
  let bookings = [];
  bookings = applyBooking(bookings, booking({ id: 'IN', party: 10, area: 'inside' }));
  bookings = applyBooking(bookings, booking({ id: 'OUT', party: 16, area: 'outside' }));

  bookings = removeBooking(bookings, 'IN');

  assert.equal(seatsRemaining(bookings, TOMORROW, '15:00', 'inside', CONFIG), 10);
  assert.equal(seatsRemaining(bookings, TOMORROW, '15:00', 'outside', CONFIG), 0);
});

test('removeBooking leaves the list alone when the code is unknown', () => {
  const bookings = [booking({ id: 'A' })];
  const updated = removeBooking(bookings, 'NOPE12');

  assert.equal(updated.length, 1);
  assert.equal(findById(updated, 'NOPE12'), null);
  assert.equal(findById(updated, 'A').id, 'A');
});

test('findById is case insensitive, so a code typed in lowercase still works', () => {
  const bookings = [booking({ id: 'K7QD2M' })];

  assert.equal(findById(bookings, 'k7qd2m').id, 'K7QD2M');
  assert.equal(findById(bookings, ' K7QD2M ').id, 'K7QD2M');
});

// --- Date helpers -------------------------------------------------------------------------

test('toDateKey uses local time, not UTC', () => {
  // Late evening local: a UTC-based conversion would roll this into the next day for anyone
  // east of Greenwich, which is exactly the off-by-one this helper exists to prevent.
  assert.equal(toDateKey(new Date(2026, 7, 8, 23, 30, 0)), '2026-08-08');
  assert.equal(toDateKey(new Date(2026, 0, 1, 0, 5, 0)), '2026-01-01');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-08-08', 1), '2026-08-09');
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-08-08', 30), '2026-09-07');
});
