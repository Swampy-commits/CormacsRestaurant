// The hall of fame: famous guests, their sprites and their entirely invented reviews.

import { GUESTS } from './content.js';
import { SPRITES, spriteSvg } from './sprites.js';
import { el, fill, mountChrome } from './ui.js';

mountChrome('guests');

fill(
  document.getElementById('guests'),
  GUESTS.map((guest) => el('article', { class: 'guest' }, [art(guest), ...details(guest)])),
);

/**
 * A guest's picture: their own image if one has been added to /images, otherwise the pixel
 * sprite. This is what lets real pixel-art pictures be dropped in later without touching code.
 */
function art(guest) {
  if (guest.image) {
    return el('img', {
      class: 'sprite guest__art',
      src: guest.image,
      alt: `${guest.name} at Cormac's Restaurant`,
      loading: 'lazy',
    });
  }

  const rows = SPRITES[guest.sprite] ?? SPRITES.guestA;
  return el('div', { class: 'guest__art', svg: spriteSvg(rows, { title: guest.name }) });
}

function details(guest) {
  return [
    el('h2', { class: 'guest__name', text: guest.name }),
    el('span', { class: 'guest__known', text: guest.known }),
    el('span', {
      class: 'stars',
      role: 'img',
      'aria-label': `${guest.stars} out of 5`,
      text: '★'.repeat(guest.stars) + '☆'.repeat(Math.max(0, 5 - guest.stars)),
    }),
    el('blockquote', { class: 'guest__quote', text: `“${guest.quote}”` }),
  ];
}
