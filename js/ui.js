// Shared furniture: the DOM helper, the nav, the CRT and sound toggles, the status bar, and
// loading the bookings. Every page uses this.

import { CONFIG } from './config.js';
import { dateFromKey } from './booking-rules.js';
import { totalTakings, hiScore, formatCash, padScore } from './money.js';
import { soundOn, toggleSound } from './sound.js';

const CRT_KEY = 'cormac.crt';
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// --- DOM -----------------------------------------------------------------------------------

/**
 * Build an element.
 *
 * Text always goes in as text, never as markup, so a name typed into the booking form can never
 * become HTML. The one exception is `svg`, which takes sprite markup we generated ourselves.
 *
 * @param {string} tag
 * @param {object} [props] class, text, svg, on<Event> handlers, everything else an attribute
 * @param {Array}  [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'svg') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

/** Replace everything inside a node. */
export function fill(node, children) {
  node.replaceChildren(...[].concat(children).filter(Boolean));
}

// --- Page chrome ---------------------------------------------------------------------------

const PAGES = [
  { id: 'book', href: 'index.html', label: 'BOOK' },
  { id: 'menu', href: 'menu.html', label: 'MENU' },
  { id: 'guests', href: 'guests.html', label: 'HALL OF FAME' },
  { id: 'admin', href: 'admin.html', label: 'OWNER' },
];

/** Apply the saved CRT setting and draw the nav and toggles into #topbar. */
export function mountChrome(currentPage) {
  applyCrt(crtOn());

  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const crtButton = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    'aria-pressed': String(crtOn()),
    text: `CRT: ${crtOn() ? 'ON' : 'OFF'}`,
  });

  crtButton.addEventListener('click', () => {
    const next = !crtOn();
    localStorage.setItem(CRT_KEY, next ? 'on' : 'off');
    applyCrt(next);
    crtButton.textContent = `CRT: ${next ? 'ON' : 'OFF'}`;
    crtButton.setAttribute('aria-pressed', String(next));
  });

  const soundButton = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    'aria-pressed': String(soundOn()),
    text: `SOUND: ${soundOn() ? 'ON' : 'OFF'}`,
  });

  soundButton.addEventListener('click', () => {
    const next = toggleSound();
    soundButton.textContent = `SOUND: ${next ? 'ON' : 'OFF'}`;
    soundButton.setAttribute('aria-pressed', String(next));
  });

  fill(topbar, [
    el(
      'nav',
      { class: 'nav', 'aria-label': 'Pages' },
      PAGES.map((page) =>
        el('a', {
          href: page.href,
          text: page.label,
          'aria-current': page.id === currentPage ? 'page' : null,
        }),
      ),
    ),
    el('div', { class: 'toggles' }, [crtButton, soundButton]),
  ]);
}

function crtOn() {
  return localStorage.getItem(CRT_KEY) !== 'off';
}

function applyCrt(on) {
  document.documentElement.dataset.crt = on ? 'on' : 'off';
}

// --- The bookings --------------------------------------------------------------------------

/**
 * Load the bookings.
 *
 * Cache-busted, because GitHub Pages will happily serve a stale copy for several minutes and
 * stale availability is worse than a slightly slower page.
 */
export async function loadBookings() {
  const response = await fetch(`data/bookings.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the bookings (${response.status}).`);

  const store = await response.json();
  if (!Array.isArray(store.bookings)) throw new Error('The bookings file is malformed.');

  return store.bookings;
}

// --- The status bar ------------------------------------------------------------------------

/** CASH and HI, arcade style. */
export function renderStatus(bookings) {
  const cash = totalTakings(bookings, CONFIG);
  const best = hiScore(bookings, CONFIG);

  return el('div', { class: 'status' }, [
    el('div', { class: 'status__item' }, [
      el('span', { class: 'status__label', text: 'CASH' }),
      el('span', { class: 'status__value', id: 'cash-value', text: padScore(cash, 6) }),
    ]),
    el('div', { class: 'status__item' }, [
      el('span', { class: 'status__label', text: 'HI' }),
      el('span', { class: 'status__value', text: padScore(best, 6) }),
    ]),
    el('div', { class: 'status__item' }, [
      el('span', { class: 'status__label', text: 'TAKINGS' }),
      el('span', { class: 'status__value', text: formatCash(cash, CONFIG) }),
    ]),
  ]);
}

/**
 * Wind the CASH figure up to a new total. Skipped entirely when the visitor has asked for
 * reduced motion - they get the new number immediately.
 */
export function animateCounter(node, from, to, { width = 6, durationMs = 900 } = {}) {
  if (!node) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || from === to) {
    node.textContent = padScore(to, width);
    return;
  }

  const startedAt = performance.now();

  function step(now) {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    node.textContent = padScore(from + (to - from) * progress, width);
    if (progress < 1) requestAnimationFrame(step);
  }

  node.classList.add('status__value--flash');
  setTimeout(() => node.classList.remove('status__value--flash'), 1400);
  requestAnimationFrame(step);
}

// --- Seat meters ---------------------------------------------------------------------------

/** A pixel seat meter for one area of one sitting. */
export function meter(taken, seats) {
  const fraction = seats === 0 ? 1 : Math.min(1, taken / seats);
  const level = fraction >= 1 ? 'full' : fraction >= 0.6 ? 'mid' : 'low';

  return el('div', { class: `meter meter--${level}` }, [
    el('div', { class: 'meter__fill', style: `width: ${fraction * 100}%` }),
  ]);
}

// --- Dates ---------------------------------------------------------------------------------

/** 'SAT 15 AUG' - short enough for the pixel font, clear enough to book by. */
export function dayLabel(dateKey) {
  const date = dateFromKey(dateKey);
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// --- Messages ------------------------------------------------------------------------------

/** A banner. `reasons` are listed underneath when there are any. */
export function banner(title, message, { ok = false, reasons = [], extra = null } = {}) {
  return el('div', { class: `banner${ok ? ' banner--ok' : ''}`, role: 'status' }, [
    el('strong', { class: 'banner__title', text: title }),
    message ? el('span', { text: message }) : null,
    reasons.length > 0
      ? el(
          'ul',
          {},
          reasons.map((reason) => el('li', { text: reason })),
        )
      : null,
    extra,
  ]);
}
