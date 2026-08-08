// OWNER MODE: every booking, grouped by day and sitting, with what each day took.
//
// There is no login. A static page cannot authenticate anyone, and a password in client-side
// JavaScript is decoration - anybody can read it. This page is public, which is why bookings only
// ever hold a first name.

import { CONFIG } from './config.js';
import { toDateKey, slotSummary, areaById, serviceForSlot } from './booking-rules.js';
import { takingsByDate, totalTakings, hiScore, formatCash } from './money.js';
import { submitCancellation } from './bookings-client.js';
import { playNope } from './sound.js';
import * as gh from './github.js';
import { el, fill, mountChrome, loadBookings, renderStatus, meter, dayLabel, banner } from './ui.js';

const state = {
  today: toDateKey(new Date()),
  bookings: [],
  busy: false,
};

start();

async function start() {
  mountChrome('admin');

  try {
    state.bookings = await loadBookings();
  } catch (error) {
    show(banner('NO DATA', error.message));
    return;
  }

  render();
}

function render() {
  fill(document.getElementById('status'), renderStatus(state.bookings));
  renderSummary();
  renderDays();
}

// --- Summary --------------------------------------------------------------------------------

function renderSummary() {
  const covers = state.bookings.reduce((total, booking) => total + booking.party, 0);
  const upcoming = state.bookings.filter((booking) => booking.date >= state.today).length;

  fill(document.getElementById('summary'), [
    el('h2', { text: '- THE BOOKS -' }),
    el('div', { class: 'controls' }, [
      stat('BOOKINGS', String(state.bookings.length)),
      stat('STILL TO COME', String(upcoming)),
      stat('COVERS', String(covers)),
      stat('TAKINGS', formatCash(totalTakings(state.bookings, CONFIG), CONFIG)),
      stat('BEST DAY', formatCash(hiScore(state.bookings, CONFIG), CONFIG)),
    ]),
  ]);
}

function stat(label, value) {
  return el('div', { class: 'field' }, [
    el('span', { class: 'field__label', text: label }),
    el('div', { class: 'stepper__readout', text: value }),
  ]);
}

// --- Days and sittings ----------------------------------------------------------------------

function renderDays() {
  const byDate = takingsByDate(state.bookings, CONFIG);
  const dates = [...new Set(state.bookings.map((booking) => booking.date))].sort();

  if (dates.length === 0) {
    fill(document.getElementById('days'), [
      el('h2', { text: '- EVERY SITTING -' }),
      el('p', { class: 'empty', text: 'Nothing booked at all yet. The restaurant is very quiet.' }),
    ]);
    return;
  }

  fill(document.getElementById('days'), [
    el('h2', { text: '- EVERY SITTING -' }),
    el('p', { class: 'tiny', text: 'Only days with bookings are listed. Empty days are not shown.' }),
    ...dates.map((dateKey) => day(dateKey, byDate[dateKey] ?? 0)),
  ]);
}

function day(dateKey, takings) {
  const past = dateKey < state.today;

  // Only sittings that actually have someone in them - an owner wants the schedule, not a grid
  // of empty boxes.
  const booked = CONFIG.services
    .flatMap((service) => service.slots)
    .filter((slot) => state.bookings.some((b) => b.date === dateKey && b.slot === slot));

  return el('section', { class: 'day', style: past ? 'opacity: 0.55' : null }, [
    el('div', { class: 'day__head' }, [
      el('span', { class: 'day__date', text: `${dayLabel(dateKey)}${past ? ' (PAST)' : ''}` }),
      el('span', { class: 'day__takings', text: formatCash(takings, CONFIG) }),
    ]),
    ...booked.map((slot) => sitting(dateKey, slot, past)),
  ]);
}

function sitting(dateKey, slot, past) {
  const summary = slotSummary(state.bookings, dateKey, slot, CONFIG);
  const service = serviceForSlot(slot, CONFIG);

  const here = state.bookings
    .filter((booking) => booking.date === dateKey && booking.slot === slot)
    .sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name));

  return el('div', { class: 'sitting' }, [
    el('div', { class: 'sitting__head' }, [
      el('span', { class: 'sitting__time', text: slot }),
      el('span', { class: 'tiny', text: service?.label.toLowerCase() ?? '' }),
      el(
        'div',
        { class: 'sitting__areas' },
        summary.areas.map((area) =>
          el('div', { class: 'sitting__area' }, [
            el('div', { class: 'area__head' }, [
              el('span', { class: 'area__name', text: area.label }),
              el('span', { class: 'area__count', text: `${area.taken}/${area.seats}` }),
            ]),
            meter(area.taken, area.seats),
          ]),
        ),
      ),
    ]),
    ...here.map((booking) => row(booking, past)),
  ]);
}

function row(booking, past) {
  const area = areaById(booking.area, CONFIG);

  return el('div', { class: 'booking-row' }, [
    el('div', { class: 'booking-row__who' }, [
      el('strong', { text: booking.name }),
      ' ',
      el('span', {
        class: 'tiny',
        text: `${booking.party} ${booking.party === 1 ? 'person' : 'people'}, ${
          area?.label.toLowerCase() ?? booking.area
        }`,
      }),
      ' ',
      el('span', { class: 'booking-row__code', text: booking.id }),
    ]),
    el('button', {
      class: 'btn btn--ghost btn--danger',
      type: 'button',
      text: past ? 'REMOVE' : 'CANCEL',
      disabled: state.busy || !gh.hasToken(),
      onClick: () => cancel(booking),
    }),
  ]);
}

// --- Cancelling -----------------------------------------------------------------------------

async function cancel(booking) {
  const label = `${booking.name}, ${dayLabel(booking.date)} at ${booking.slot}`;
  if (!window.confirm(`Cancel ${label}?`)) return;

  state.busy = true;
  render();
  show(
    banner('CANCELLING', `Freeing ${label}. This takes about half a minute.`, {
      ok: true,
    }),
  );

  try {
    const { outcome } = await submitCancellation(booking.id);

    if (!outcome) {
      show(banner('STILL THINKING', 'No answer yet. Reload in a minute to see whether it went through.'));
    } else if (outcome.status === 'cancelled') {
      state.bookings = state.bookings.filter((b) => b.id !== booking.id);
      show(banner('TABLE FREED', `${booking.id} is cancelled.`, { ok: true }));
    } else {
      playNope();
      show(banner('NOT CANCELLED', outcome.message, { reasons: outcome.reasons ?? [] }));
    }
  } catch (error) {
    playNope();
    show(banner('OUT OF ORDER', error.friendly ?? 'Something went wrong. Try again.'));
  } finally {
    state.busy = false;
    render();
  }
}

function show(node) {
  fill(document.getElementById('message'), node);
}
