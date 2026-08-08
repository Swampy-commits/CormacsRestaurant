// The takings. Cormac is getting rich and the site keeps score.
//
// Every booking is worth its party size times the price per head of whichever service it falls
// in, so breakfast and dinner move the counter by different amounts.

import { serviceForSlot } from './booking-rules.js';

/** What one booking is worth. Unrecognised sittings are worth nothing rather than throwing. */
export function bookingValue(booking, config) {
  const service = serviceForSlot(booking.slot, config);
  if (!service) return 0;
  return booking.party * service.pricePerHead;
}

/** Everything taken, ever. This is the CASH figure in the status bar. */
export function totalTakings(bookings, config) {
  return bookings.reduce((total, booking) => total + bookingValue(booking, config), 0);
}

/** Takings for each day, keyed by date. */
export function takingsByDate(bookings, config) {
  const byDate = {};
  for (const booking of bookings) {
    byDate[booking.date] = (byDate[booking.date] ?? 0) + bookingValue(booking, config);
  }
  return byDate;
}

/** The best single day's takings — the HI figure. Not the running total. */
export function hiScore(bookings, config) {
  const days = Object.values(takingsByDate(bookings, config));
  return days.length === 0 ? 0 : Math.max(...days);
}

/**
 * How tall the cash pile should be: the index of the highest threshold the takings have passed.
 * Caps at the top tier, so a very good season doesn't run off the top of the sprite.
 */
export function cashPileTier(total, config) {
  const tiers = config.cashPileTiers;
  let tier = 0;
  for (let i = 0; i < tiers.length; i += 1) {
    if (total >= tiers[i]) tier = i;
  }
  return tier;
}

/** Money for humans: €1,240. */
export function formatCash(amount, config) {
  const whole = Math.round(amount);
  const grouped = String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${whole < 0 ? '-' : ''}${config.currency}${grouped}`;
}

/** Money for an arcade cabinet: 014320. Never truncates, so a big score just gets wider. */
export function padScore(amount, width) {
  return String(Math.max(0, Math.round(amount))).padStart(width, '0');
}
