// The menu. Static content from content.js, laid out as an arcade item list.

import { CONFIG } from './config.js';
import { MENU } from './content.js';
import { formatCash } from './money.js';
import { SPRITES, spriteSvg } from './sprites.js';
import { el, fill, mountChrome } from './ui.js';

mountChrome('menu');

fill(document.getElementById('chef-art'), [
  el('div', { class: 'sprite--chef', svg: spriteSvg(SPRITES.cormac, { title: 'Cormac, the chef' }) }),
]);

fill(
  document.getElementById('menu'),
  MENU.map((course) =>
    el('section', { class: 'menu-course' }, [
      el('h2', { text: `- ${course.course} -` }),
      ...course.items.map((item) =>
        el('div', { class: 'menu-item' }, [
          el('div', {}, [
            el('strong', { text: item.name }),
            item.note ? el('span', { class: 'menu-item__note', text: item.note }) : null,
          ]),
          el('span', {
            class: 'menu-item__price',
            text: item.price === 0 ? 'FREE' : formatCash(item.price, CONFIG),
          }),
        ]),
      ),
    ]),
  ),
);

// What the takings counter actually charges is per head, not per dish, so say so rather than
// letting anyone try to reconcile the two.
fill(document.getElementById('pricing-note'), [
  el('p', { class: 'tiny' }, [
    'Dish prices are for show. A booking is charged per head: ',
    ...CONFIG.services.map((service, index) =>
      el('span', {
        text: `${index > 0 ? ', ' : ''}${service.label.toLowerCase()} ${formatCash(service.pricePerHead, CONFIG)}`,
      }),
    ),
    '.',
  ]),
]);
