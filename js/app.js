// The booking page.
//
// Picks a day, a party size and a sitting, files the booking as a GitHub issue, then waits for
// the Action to answer. Availability comes from data/bookings.json; the confirmation comes from
// the issue, because Pages lags behind the data by another half-minute.

import { CONFIG } from './config.js';
import {
  toDateKey,
  addDays,
  slotSummary,
  validateBooking,
  isSittingPast,
  applyBooking,
  removeBooking,
  findById,
  areaById,
  serviceForSlot,
} from './booking-rules.js';
import { totalTakings, bookingValue, formatCash, cashPileTier } from './money.js';
import { SPRITES, spriteSvg, cashPileSvg } from './sprites.js';
import { CHEF_NOTE } from './content.js';
import { playCoin, playNope } from './sound.js';
import * as gh from './github.js';
import { submitBooking, submitCancellation } from './bookings-client.js';
import { el, fill, mountChrome, loadBookings, renderStatus, animateCounter, meter, dayLabel, banner } from './ui.js';

const MY_BOOKINGS_KEY = 'cormac.myBookings';
const NAME_KEY = 'cormac.name';

const WAITING_LINES = [
  'WAKING THE CHEF',
  'BUTTERING THE PAN',
  'FINDING A CHAIR',
  'WARMING THE OVEN',
  'PEELING THE SPUDS',
  'ASKING PERMISSION',
];

const state = {
  today: toDateKey(new Date()),
  dateKey: toDateKey(new Date()),
  party: 2,
  name: localStorage.getItem(NAME_KEY) ?? '',
  bookings: [],
  busy: false,
};

const maxAreaSeats = Math.max(...CONFIG.areas.map((area) => area.seats));

start();

async function start() {
  mountChrome('book');
  renderMarquee();
  renderChefNote();

  try {
    state.bookings = await loadBookings();
  } catch (error) {
    show(banner('NO DATA', `${error.message} Availability cannot be shown.`));
    return;
  }

  // Open the site after the last sitting and today is useless, so start on the first day that
  // still has something left. In practice that means today, or tomorrow after about 5pm.
  state.dateKey = firstBookableDay(new Date());

  renderStatusBar();
  renderCashPile();
  renderControls();
  renderSlots();
  renderMyBookings();

  if (!gh.hasToken()) {
    show(
      banner(
        'NOT PLUGGED IN YET',
        'This cabinet has no booking key, so nothing can be booked yet. Everything else works. ' +
          'See the README to create one.',
      ),
    );
  }
}

// --- The top of the page --------------------------------------------------------------------

function renderMarquee() {
  fill(document.getElementById('chef-art'), [
    el('div', { class: 'sprite--chef', svg: spriteSvg(SPRITES.cormac, { title: 'Cormac, the chef' }) }),
  ]);
  document.getElementById('restaurant-name').textContent = CONFIG.restaurantName;
}

function renderChefNote() {
  fill(document.getElementById('chef-note'), [
    el('span', { text: CHEF_NOTE.text }),
    el('span', { class: 'chef-note__by', text: CHEF_NOTE.by }),
  ]);
}

function renderStatusBar() {
  fill(document.getElementById('status'), renderStatus(state.bookings));
}

function renderCashPile() {
  const tier = cashPileTier(totalTakings(state.bookings, CONFIG), CONFIG);
  fill(document.getElementById('cash-pile'), [
    el('div', { class: 'sprite--cash', svg: cashPileSvg(tier) }),
  ]);
}

// --- Day, party and name --------------------------------------------------------------------

function renderControls() {
  const lastDay = addDays(state.today, CONFIG.maxDaysAhead);

  // A select rather than only arrows: thirty taps to reach the end of the month is not a booking
  // system, and a native select is the one control that behaves well on every phone.
  const dayOptions = [];
  for (let key = state.today; key <= lastDay; key = addDays(key, 1)) {
    dayOptions.push(
      el('option', {
        value: key,
        text: key === state.today ? `TODAY - ${dayLabel(key)}` : dayLabel(key),
        selected: key === state.dateKey,
      }),
    );
  }

  const daySelect = el('select', { class: 'stepper__readout', id: 'day', 'aria-label': 'Day' }, dayOptions);
  daySelect.addEventListener('change', () => {
    state.dateKey = daySelect.value;
    renderSlots();
  });

  const nudge = (days) => () => {
    const next = addDays(state.dateKey, days);
    if (next < state.today || next > lastDay) return;
    state.dateKey = next;
    daySelect.value = next;
    renderSlots();
  };

  const partyReadout = el('div', {
    class: 'stepper__readout',
    id: 'party-readout',
    'aria-live': 'polite',
    text: partyText(),
  });

  const bumpParty = (by) => () => {
    state.party = Math.max(1, Math.min(maxAreaSeats, state.party + by));
    partyReadout.textContent = partyText();
    // Every tile's buttons depend on party size, so they all need re-testing.
    renderSlots();
  };

  const nameInput = el('input', {
    type: 'text',
    id: 'name',
    maxlength: String(CONFIG.maxNameLength),
    placeholder: 'Your name',
    value: state.name,
    'aria-label': 'Who is booking',
  });
  nameInput.addEventListener('input', () => {
    state.name = nameInput.value;
    localStorage.setItem(NAME_KEY, state.name);
  });

  fill(document.getElementById('controls'), [
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label', text: 'WHICH DAY' }),
      el('div', { class: 'stepper' }, [
        el('button', { class: 'btn', type: 'button', 'aria-label': 'Previous day', text: '<', onClick: nudge(-1) }),
        daySelect,
        el('button', { class: 'btn', type: 'button', 'aria-label': 'Next day', text: '>', onClick: nudge(1) }),
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label', text: 'HOW MANY' }),
      el('div', { class: 'stepper' }, [
        el('button', { class: 'btn', type: 'button', 'aria-label': 'One fewer', text: '-', onClick: bumpParty(-1) }),
        partyReadout,
        el('button', { class: 'btn', type: 'button', 'aria-label': 'One more', text: '+', onClick: bumpParty(1) }),
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label', text: 'WHO IS BOOKING' }),
      nameInput,
    ]),
  ]);
}

function partyText() {
  return `${state.party} ${state.party === 1 ? 'PERSON' : 'PEOPLE'}`;
}

// --- The slot grid --------------------------------------------------------------------------

/** The first day from today onwards with at least one sitting still to come. */
function firstBookableDay(now) {
  const today = toDateKey(now);
  const last = addDays(today, CONFIG.maxDaysAhead);

  for (let key = today; key <= last; key = addDays(key, 1)) {
    if (CONFIG.services.some((service) => service.slots.some((slot) => !isSittingPast(key, slot, now)))) {
      return key;
    }
  }
  return today;
}

function renderSlots() {
  const now = new Date();

  const nothingLeft = !CONFIG.services.some((service) =>
    service.slots.some((slot) => !isSittingPast(state.dateKey, slot, now)),
  );

  const services = CONFIG.services.map((service) =>
    el('section', { class: 'service' }, [
      el('h2', { text: `- ${service.label} -` }),
      el('p', {
        class: 'service__hours',
        text: `${service.slots.length} sittings, ${formatCash(service.pricePerHead, CONFIG)} a head`,
      }),
      el(
        'div',
        { class: 'slots' },
        service.slots.map((slot) => tile(slot, now)),
      ),
    ]),
  );

  fill(document.getElementById('slots'), [
    nothingLeft
      ? banner('KITCHEN SHUT', 'Every sitting today has gone. Pick another day above.')
      : null,
    ...services,
  ]);
}

function tile(slot, now) {
  const gone = isSittingPast(state.dateKey, slot, now);
  const summary = slotSummary(state.bookings, state.dateKey, slot, CONFIG);

  return el('div', { class: `tile${gone ? ' tile--gone' : ''}` }, [
    el('span', { class: 'tile__time', text: slot }),
    ...(gone
      ? [el('span', { class: 'tile__gone', text: 'GONE' })]
      : summary.areas.map((area) =>
          el('div', { class: 'area' }, [
            el('div', { class: 'area__head' }, [
              el('span', { class: 'area__name', text: area.label }),
              el('span', {
                class: 'area__count',
                text: area.full ? 'FULL' : `${area.remaining}/${area.seats}`,
              }),
            ]),
            meter(area.taken, area.seats),
          ]),
        )),
    gone
      ? null
      : el(
          'div',
          { class: 'tile__actions' },
          summary.areas.map((area) => areaButton(slot, area)),
        ),
  ]);
}

/**
 * The button for one area of one sitting. When it can't be pressed it says why, rather than just
 * greying out: FULL is a different problem from a party that will never fit.
 */
function areaButton(slot, area) {
  let label = area.label;
  let disabled = false;

  if (area.full) {
    label = 'FULL';
    disabled = true;
  } else if (state.party > area.seats) {
    label = 'TOO BIG';
    disabled = true;
  } else if (state.party > area.remaining) {
    label = `ONLY ${area.remaining}`;
    disabled = true;
  }

  return el('button', {
    class: 'btn',
    type: 'button',
    text: label,
    disabled: disabled || state.busy || !gh.hasToken(),
    title: disabled ? `${area.label}: ${area.remaining} of ${area.seats} seats free` : `Book ${area.label.toLowerCase()}`,
    onClick: () => book(slot, area.id),
  });
}

// --- Booking --------------------------------------------------------------------------------

async function book(slot, areaId) {
  const request = {
    date: state.dateKey,
    slot,
    area: areaId,
    name: state.name,
    party: state.party,
  };

  // Checked here for instant feedback, and again in the Action because the client is not trusted.
  const check = validateBooking(request, state.bookings, CONFIG, new Date());
  if (!check.ok) {
    playNope();
    show(banner('NO TABLE', 'That does not work:', { reasons: check.errors.map((e) => e.message) }));
    return;
  }

  const area = areaById(areaId, CONFIG);

  setBusy(true);
  showWaiting(`Asking for ${state.party} ${area.label.toLowerCase()} at ${slot}`);

  try {
    const { outcome, issueNumber } = await submitBooking(request);

    if (!outcome) {
      show(
        banner('STILL THINKING', 'The kitchen is taking longer than usual. Your booking may still land.', {
          extra: el('p', {}, [
            'Check ',
            el('a', { href: 'admin.html', text: 'OWNER MODE' }),
            ' in a minute, or look at ',
            el('a', { href: gh.issueUrl(issueNumber), text: 'the request itself', target: '_blank', rel: 'noopener' }),
            '.',
          ]),
        }),
      );
      return;
    }

    if (outcome.status === 'confirmed' && outcome.booking) {
      confirmed(outcome.booking);
    } else {
      playNope();
      show(banner('NO TABLE', outcome.message, { reasons: outcome.reasons ?? [] }));
    }
  } catch (error) {
    playNope();
    show(banner('OUT OF ORDER', error.friendly ?? 'Something went wrong. Try again.'));
  } finally {
    setBusy(false);
    renderSlots();
  }
}

function confirmed(booking) {
  const before = totalTakings(state.bookings, CONFIG);

  // Merge it in rather than re-fetching: Pages can serve a stale bookings.json for minutes, and
  // the person who just booked should see their own table immediately.
  state.bookings = applyBooking(state.bookings, booking);
  remember(booking);

  playCoin();
  renderStatusBar();
  animateCounter(document.getElementById('cash-value'), before, totalTakings(state.bookings, CONFIG));
  renderCashPile();
  renderMyBookings();
  show(receipt(booking));
}

function receipt(booking) {
  const area = areaById(booking.area, CONFIG);
  const service = serviceForSlot(booking.slot, CONFIG);
  const value = bookingValue(booking, CONFIG);

  return el('div', { class: 'receipt' }, [
    el('strong', { class: 'receipt__title', text: '* CORMAC’S RESTAURANT *' }),
    line('WHO', booking.name),
    line('DAY', dayLabel(booking.date)),
    line('SITTING', `${booking.slot} ${service.label.toLowerCase()}`),
    line('SEATED', area.label.toLowerCase()),
    line('COVERS', `${booking.party} x ${formatCash(service.pricePerHead, CONFIG)}`),
    el('div', { class: 'receipt__line receipt__total' }, [
      el('span', { text: 'TOTAL' }),
      el('span', { text: formatCash(value, CONFIG) }),
    ]),
    el('p', { class: 'receipt__code', text: booking.id }),
    el('p', { class: 'tiny', text: 'Keep this code. It is the only way to cancel.' }),
  ]);

  function line(label, value) {
    return el('div', { class: 'receipt__line' }, [
      el('span', { text: label }),
      el('span', { text: value }),
    ]);
  }
}

// --- My bookings and cancelling -------------------------------------------------------------

function renderMyBookings() {
  const mine = myBookings().filter((booking) => booking.date >= state.today);
  localStorage.setItem(MY_BOOKINGS_KEY, JSON.stringify(mine));

  const codeInput = el('input', {
    type: 'text',
    id: 'cancel-code',
    maxlength: '8',
    placeholder: 'Booking code',
    'aria-label': 'Booking code to cancel',
  });

  fill(document.getElementById('mine'), [
    el('h2', { text: '- YOUR TABLES -' }),
    mine.length === 0
      ? el('p', { class: 'empty', text: 'Nothing booked on this device yet.' })
      : el(
          'div',
          {},
          mine.map((booking) =>
            el('div', { class: 'booking-row' }, [
              el('div', { class: 'booking-row__who' }, [
                el('strong', { text: `${dayLabel(booking.date)} ${booking.slot}` }),
                el('br'),
                el('span', {
                  class: 'tiny',
                  text: `${booking.party} ${booking.party === 1 ? 'person' : 'people'}, ${
                    areaById(booking.area, CONFIG)?.label.toLowerCase() ?? booking.area
                  }`,
                }),
                ' ',
                el('span', { class: 'booking-row__code', text: booking.id }),
              ]),
              el('button', {
                class: 'btn btn--ghost btn--danger',
                type: 'button',
                text: 'CANCEL',
                disabled: state.busy || !gh.hasToken(),
                onClick: () => cancel(booking.id),
              }),
            ]),
          ),
        ),
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label', text: 'CANCEL FROM ANOTHER DEVICE' }),
      el('div', { class: 'stepper' }, [
        codeInput,
        el('button', {
          class: 'btn',
          type: 'button',
          text: 'CANCEL',
          disabled: state.busy || !gh.hasToken(),
          onClick: () => cancel(codeInput.value),
        }),
      ]),
    ]),
  ]);
}

async function cancel(code) {
  const wanted = String(code ?? '').trim().toUpperCase();
  if (!wanted) {
    show(banner('NO CODE', 'Type the booking code first.'));
    return;
  }

  setBusy(true);
  showWaiting(`Cancelling ${wanted}`);

  try {
    const { outcome } = await submitCancellation(wanted);

    if (!outcome) {
      show(banner('STILL THINKING', 'The cancellation is taking a while. Check OWNER MODE in a minute.'));
      return;
    }

    if (outcome.status === 'cancelled') {
      const before = totalTakings(state.bookings, CONFIG);

      state.bookings = removeBooking(state.bookings, wanted);
      forget(wanted);

      renderStatusBar();
      animateCounter(document.getElementById('cash-value'), before, totalTakings(state.bookings, CONFIG));
      renderCashPile();
      show(banner('TABLE FREED', `${wanted} is cancelled and those seats are back.`, { ok: true }));
    } else {
      playNope();
      show(banner('NOT CANCELLED', outcome.message, { reasons: outcome.reasons ?? [] }));
    }
  } catch (error) {
    playNope();
    show(banner('OUT OF ORDER', error.friendly ?? 'Something went wrong. Try again.'));
  } finally {
    setBusy(false);
    renderMyBookings();
    renderSlots();
  }
}

function myBookings() {
  try {
    const stored = JSON.parse(localStorage.getItem(MY_BOOKINGS_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function remember(booking) {
  const mine = myBookings();
  if (!findById(mine, booking.id)) mine.push(booking);
  localStorage.setItem(MY_BOOKINGS_KEY, JSON.stringify(mine));
}

function forget(id) {
  localStorage.setItem(MY_BOOKINGS_KEY, JSON.stringify(removeBooking(myBookings(), id)));
}

// --- Waiting, messages, busy state ----------------------------------------------------------

let waitingTimer = null;

/**
 * The Action takes 20 to 40 seconds, which is far too long to leave a button looking stuck. So
 * the wait becomes part of the act: a pixel spinner and the kitchen narrating itself.
 */
function showWaiting(what) {
  const line = el('span', { text: WAITING_LINES[0] });

  const node = el('div', { class: 'banner banner--ok', role: 'status' }, [
    el('strong', { class: 'banner__title' }, [
      el('span', { class: 'spinner' }, [el('span'), el('span'), el('span')]),
      'PLACING ORDER',
    ]),
    el('span', { text: `${what}. This takes about half a minute.` }),
    el('br'),
    line,
  ]);

  show(node);

  let index = 0;
  clearInterval(waitingTimer);
  waitingTimer = setInterval(() => {
    index = (index + 1) % WAITING_LINES.length;
    line.textContent = WAITING_LINES[index];
  }, 2500);
}

function show(node) {
  clearInterval(waitingTimer);
  waitingTimer = null;
  fill(document.getElementById('message'), node);
  document.getElementById('message').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setBusy(busy) {
  state.busy = busy;

  // Re-rendering the whole grid mid-request would scroll the waiting message out from under the
  // reader, so while busy we only harden the buttons. renderSlots runs once the request settles
  // and puts every button back into its true state.
  if (!busy) return;
  for (const button of document.querySelectorAll('.tile__actions .btn, #mine .btn')) {
    button.disabled = true;
  }
}
