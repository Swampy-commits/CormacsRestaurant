// The booking rules. Pure functions, no imports, no I/O.
//
// This module is loaded by both the browser and the GitHub Action, so the rule that decides
// whether a booking is allowed exists exactly once. The browser runs it for instant feedback;
// the Action runs it again before writing anything, because the client cannot be trusted.

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_TIME = /^(\d{2}):(\d{2})$/;

// --- Dates ---------------------------------------------------------------------------------
// Everything is local time. One family in one timezone, so local is correct, and it avoids the
// UTC off-by-one that bites date-only values either side of midnight.

/** Format a Date as a local YYYY-MM-DD key. */
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True if a string is a well-formed YYYY-MM-DD key for a real calendar date. */
export function isDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false;
  // Round-trip through a Date to reject the likes of 2026-02-31 and 9999-99-99.
  return toDateKey(dateFromKey(value)) === value;
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Shift a YYYY-MM-DD key by a number of days, crossing months and years correctly. */
export function addDays(key, days) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Minutes since midnight for an HH:MM string, or null if it isn't one. */
function minutesOfDay(slot) {
  const match = typeof slot === 'string' ? slot.match(SLOT_TIME) : null;
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * True if this sitting has already started. Only today can be in the past — a sitting on a
 * future date is always still ahead of us, however early in the day it is.
 */
export function isSittingPast(dateKey, slot, now) {
  if (dateKey !== toDateKey(now)) return false;
  const start = minutesOfDay(slot);
  if (start === null) return false;
  return now.getHours() * 60 + now.getMinutes() >= start;
}

// --- Services, slots and areas -------------------------------------------------------------

/** The service a sitting belongs to, or null if the time isn't a sitting at all. */
export function serviceForSlot(slot, config) {
  return config.services.find((service) => service.slots.includes(slot)) ?? null;
}

/** Every sitting in the day, in opening order. */
export function allSlots(config) {
  return config.services.flatMap((service) => service.slots);
}

/** An area by id, or null. */
export function areaById(areaId, config) {
  return config.areas.find((area) => area.id === areaId) ?? null;
}

// --- Capacity ------------------------------------------------------------------------------
// Always per area. Inside and outside never share seats, so every one of these takes an area.

/** Seats already booked in one area of one sitting. */
export function seatsTaken(bookings, dateKey, slot, areaId) {
  return bookings
    .filter((b) => b.date === dateKey && b.slot === slot && b.area === areaId)
    .reduce((total, b) => total + b.party, 0);
}

/** Seats still free in one area of one sitting. */
export function seatsRemaining(bookings, dateKey, slot, areaId, config) {
  const area = areaById(areaId, config);
  if (!area) return 0;
  return Math.max(0, area.seats - seatsTaken(bookings, dateKey, slot, areaId));
}

/**
 * Everything the UI needs about one sitting: the service it belongs to and, for each area,
 * how full it is. Both the booking tiles and the admin grid render from this.
 */
export function slotSummary(bookings, dateKey, slot, config) {
  return {
    slot,
    service: serviceForSlot(slot, config),
    areas: config.areas.map((area) => {
      const taken = seatsTaken(bookings, dateKey, slot, area.id);
      const remaining = Math.max(0, area.seats - taken);
      return { id: area.id, label: area.label, seats: area.seats, taken, remaining, full: remaining === 0 };
    }),
  };
}

// --- Validation ----------------------------------------------------------------------------

/**
 * Check a booking request against the rules and everything already booked.
 * Returns { ok, errors: [{ code, message }] } — every problem at once, not just the first.
 */
export function validateBooking(request, bookings, config, now) {
  const errors = [];
  const add = (code, message) => errors.push({ code, message });

  const { date, slot, area: areaId, name, party } = request ?? {};

  // --- The sitting ---
  const service = serviceForSlot(slot, config);
  if (!service) add('UNKNOWN_SLOT', `${slot ?? 'That'} is not a sitting. We serve ${describeHours(config)}.`);

  // --- The area ---
  const area = areaById(areaId, config);
  if (!area) add('UNKNOWN_AREA', `You can sit ${config.areas.map((a) => a.label.toLowerCase()).join(' or ')}.`);

  // --- The date ---
  let dateOk = false;
  if (!isDateKey(date)) {
    add('BAD_DATE', 'That date makes no sense.');
  } else {
    const today = toDateKey(now);
    if (date < today) {
      add('PAST_DATE', 'That day has already been and gone.');
    } else if (date > addDays(today, config.maxDaysAhead)) {
      add('TOO_FAR_AHEAD', `We only take bookings ${config.maxDaysAhead} days ahead.`);
    } else {
      dateOk = true;
    }
  }

  // Only today can have sittings in the past, and only if we know which sitting is meant.
  if (dateOk && service && isSittingPast(date, slot, now)) {
    add('PAST_SITTING', `The ${slot} sitting has already started.`);
  }

  // --- The party ---
  const partyOk = Number.isInteger(party) && party > 0;
  if (!partyOk) add('BAD_PARTY', 'How many of you are coming?');

  // --- The name ---
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.length > config.maxNameLength) {
    add('BAD_NAME', `Give a name, up to ${config.maxNameLength} characters.`);
  }

  // --- Capacity ---
  // Only worth checking once we know the sitting, the area and the party size are all sane.
  if (service && area && partyOk && dateOk) {
    if (party > area.seats) {
      add(
        'PARTY_TOO_BIG_FOR_AREA',
        `${area.label.toLowerCase()} only seats ${area.seats}. Try ${otherAreasThatFit(party, areaId, config)}.`,
      );
    } else {
      const remaining = seatsRemaining(bookings, date, slot, areaId, config);
      if (party > remaining) {
        add(
          'NO_ROOM',
          remaining === 0
            ? `${area.label} is full at ${slot}.`
            : `Only ${remaining} ${remaining === 1 ? 'seat' : 'seats'} left ${area.label.toLowerCase()} at ${slot}.`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function describeHours(config) {
  return config.services
    .map((service) => `${service.label.toLowerCase()} at ${service.slots.join(', ')}`)
    .join(' and ');
}

function otherAreasThatFit(party, excludeAreaId, config) {
  const fits = config.areas.filter((a) => a.id !== excludeAreaId && a.seats >= party);
  if (fits.length === 0) return 'asking the chef nicely';
  return fits.map((a) => a.label.toLowerCase()).join(' or ');
}

// --- Changing the list ---------------------------------------------------------------------
// All of these return a new array. The Action writes the result out as JSON; nothing mutates
// the list in place.

/** Add a booking. */
export function applyBooking(bookings, booking) {
  return [...bookings, booking];
}

/** Remove a booking by its code. Unknown codes leave the list untouched. */
export function removeBooking(bookings, id) {
  const key = normaliseId(id);
  return bookings.filter((b) => normaliseId(b.id) !== key);
}

/** Find a booking by its code, forgiving whitespace and lowercase typing. */
export function findById(bookings, id) {
  const key = normaliseId(id);
  if (!key) return null;
  return bookings.find((b) => normaliseId(b.id) === key) ?? null;
}

function normaliseId(id) {
  return typeof id === 'string' ? id.trim().toUpperCase() : '';
}
