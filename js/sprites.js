// The pixel art.
//
// Every sprite is a list of strings, one character per pixel, looked up in PALETTE. A dot is
// transparent. Want to change a picture? Change a character. That's the whole format, and it is
// meant to be edited by hand - including by a ten year old.
//
// The guests are recognisable by what they carry rather than by their faces: gloves and a belt
// read as the boxer, a headguard and an odd-shaped ball as the rugby player, and so on.

export const PALETTE = {
  '.': null, // transparent
  k: '#12121c', // outline
  w: '#f4f4f8', // white - chef's hat, shirts
  y: '#ffd54a', // blonde hair, gold
  s: '#f0b98d', // skin
  r: '#ff2e88', // magenta
  c: '#00e5ff', // cyan
  g: '#00ff85', // green
  b: '#2b4cff', // blue
  o: '#ff8b1f', // orange
  n: '#7a4a20', // brown
  d: '#3a3a52', // dim grey
  m: '#1faa59', // money green
  e: '#8b5a2b', // dark brown
};

// --- Cormac ---------------------------------------------------------------------------------
// Chef's hat, blonde hair, and an apron with the day's takings stuffed in the front.

const CORMAC = [
  '................',
  '.....wwwwww.....',
  '....wwwwwwww....',
  '....wwwwwwww....',
  '.....kkkkkk.....',
  '....yyyyyyyy....',
  '...yyyyyyyyyy...',
  '...yyssssssyy...',
  '...yskssskssy...',
  '...ysssssssss...',
  '....sskkkkss....',
  '.....ssssss.....',
  '......kkkk......',
  '...wwwwwwwwww...',
  '..wwwwwwwwwwww..',
  '..wwkkkkkkkkww..',
  '..wkwwwwwwwwkw..',
  '..wkwmmmmmmwkw..',
  '..wkwmyyyymwkw..',
  '..wkwmmmmmmwkw..',
  '..wkwwwwwwwwkw..',
  '..wwkkkkkkkkww..',
  '...wwwwwwwwww...',
  '....ww....ww....',
  '....kk....kk....',
  '...kkk....kkk...',
];

// --- The famous guests ----------------------------------------------------------------------

// Boxing gloves and a title belt.
const BOXER = [
  '................',
  '.....kkkkkk.....',
  '....knnnnnnk....',
  '...knnnnnnnnk...',
  '...nsssssssn....',
  '...skskssksks...',
  '...ssssssssss...',
  '...sskkkkkkss...',
  '....ssssssss....',
  '.....ssssss.....',
  '......kkkk......',
  '...kkkkkkkkkk...',
  '..kddddddddddk..',
  '.rkddddddddddkr.',
  'rrrkddddddddkrrr',
  'rrrkyyyyyyyykrrr',
  '.rrkyykyykyykrr.',
  '..kkyyyyyyyykk..',
  '..kddddddddddk..',
  '..kddddddddddk..',
  '...kddddddddk...',
  '...kdddkkdddk...',
  '...kkkk..kkkk...',
  '...kdd....ddk...',
  '...kdd....ddk...',
  '..kkkk....kkkk..',
];

// Headguard and a rugby ball under one arm.
const RUGBY = [
  '................',
  '.....kkkkkk.....',
  '....kbbbbbbk....',
  '...kbbbbbbbbk...',
  '...kbssssssbk...',
  '...bskskssksb...',
  '...kssssssssk...',
  '....sskkkkss....',
  '.....ssssss.....',
  '......kkkk......',
  '...wwwwwwwwww...',
  '..wwwwwwwwwwww..',
  '..wwkkwwwwkkww..',
  '..wwwwwwwwwwww..',
  '..wwwwwwwwww.kk.',
  '..wwwwwwwww.knnk',
  '..wwwwwwwww.nwwn',
  '...wwwwwwww.nwwn',
  '...wwwwwwwww.knk',
  '...wwwwwwwwww.k.',
  '....wwwwwwww....',
  '....kk....kk....',
  '....kk....kk....',
  '...kkk....kkk...',
  '................',
  '................',
];

// Blond mullet and a football.
const FOOTBALLER = [
  '................',
  '.....yyyyyy.....',
  '....yyyyyyyy....',
  '...yyyyyyyyyy...',
  '...yyssssssyy...',
  '...yskssskssy...',
  '...yyssssssyy...',
  '...yysskkkkss...',
  '....yssssssy....',
  '.....yykkyy.....',
  '......kkkk......',
  '...ggggggggg....',
  '..gggggggggg....',
  '..ggkkggggkk....',
  '..gggggggggg....',
  '..gggggggggg....',
  '...gggggggg.....',
  '...gggggggg.....',
  '....gg..gg......',
  '....kk..kk......',
  '....kk..kk...kk.',
  '...kkk..kkk.kwwk',
  '............kwwk',
  '.............kk.',
  '................',
  '................',
];

// Cap, beard, and a fistful of cash.
const YOUTUBER = [
  '................',
  '....kkkkkkkk....',
  '...kbbbbbbbbk...',
  '..kbbbbbbbbbbk..',
  '..kkkkkkkkkkkk..',
  '...kssssssssk...',
  '...skskssksks...',
  '...ssssssssss...',
  '...neeeeeeeen...',
  '...nneeeeeenn...',
  '....nneeeenn....',
  '.....nnnnnn.....',
  '......kkkk......',
  '...cccccccccc...',
  '..cccccccccccc..',
  '..cckkccccckkc..',
  '..cccccccccccc..',
  '..cccccccccccc..',
  '...cccccccccc...',
  '...cccccccccc...',
  '..mmm.cc.cc.mmm.',
  '.mymym.cc.cc....',
  '.mmmmm.kk.kk....',
  '..mmm.kkk.kkk...',
  '................',
  '................',
];

// Two spares, so a new guest can be added with a name and a quote before anyone draws them.
const GUEST_A = [
  '................',
  '.....kkkkkk.....',
  '....kddddddk....',
  '...kddddddddk...',
  '...dssssssssd...',
  '...skskssksks...',
  '...ssssssssss...',
  '....sskkkkss....',
  '.....ssssss.....',
  '......kkkk......',
  '...rrrrrrrrrr...',
  '..rrrrrrrrrrrr..',
  '..rrkkrrrrkkrr..',
  '..rrrrrrrrrrrr..',
  '..rrrrrrrrrrrr..',
  '...rrrrrrrrrr...',
  '...rrrrrrrrrr...',
  '....rrr..rrr....',
  '....kk....kk....',
  '....kk....kk....',
  '...kkk....kkk...',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const GUEST_B = [
  '................',
  '.....kkkkkk.....',
  '....koooooook...',
  '...koooooooook..',
  '...osssssssso...',
  '...skskssksks...',
  '...ssssssssss...',
  '....sskkkkss....',
  '.....ssssss.....',
  '......kkkk......',
  '...oooooooooo...',
  '..oooooooooooo..',
  '..ookkooookkoo..',
  '..oooooooooooo..',
  '..oooooooooooo..',
  '...oooooooooo...',
  '...oooooooooo...',
  '....ooo..ooo....',
  '....kk....kk....',
  '....kk....kk....',
  '...kkk....kkk...',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- The cash pile --------------------------------------------------------------------------
// Eight tiers, one per threshold in CONFIG.cashPileTiers. Tier 0 is an empty floor; each tier
// after that stacks more notes and coins.

const CASH_TIERS = [
  // 0 - nothing yet
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....dddddddd....',
  ],
  // 1 - a couple of coins
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....ky..ky.....',
    '....dyyddyydd...',
  ],
  // 2 - a small stack of notes
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...kkkkkkkkk....',
    '...kmmmmmmmk....',
    '...kmyyyyymk.ky.',
    '...kkkkkkkkkdyy.',
  ],
  // 3
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...kkkkkkkkk....',
    '...kmmmmmmmk....',
    '...kmyyyyymk....',
    '...kkkkkkkkk....',
    '..kkkkkkkkkkk...',
    '..kmmmmmmmmmk...',
  ],
  // 4
  [
    '................',
    '................',
    '................',
    '................',
    '...kkkkkkkkk....',
    '...kmyyyyymk....',
    '...kkkkkkkkk....',
    '..kkkkkkkkkkk...',
    '..kmyyyyyyymk...',
    '..kkkkkkkkkkk...',
    '.kkkkkkkkkkkkk..',
    '.kmmmmmmmmmmmk..',
  ],
  // 5
  [
    '................',
    '................',
    '...kkkkkkkkk....',
    '...kmyyyyymk....',
    '...kkkkkkkkk....',
    '..kkkkkkkkkkk...',
    '..kmyyyyyyymk...',
    '..kkkkkkkkkkk...',
    '.kkkkkkkkkkkkk..',
    '.kmyyyyyyyyymk..',
    '.kkkkkkkkkkkkk..',
    'kkkkkkkkkkkkkkk.',
  ],
  // 6
  [
    '.......ky.......',
    '......kyyk......',
    '...kkkkkkkkk....',
    '...kmyyyyymk....',
    '..kkkkkkkkkkk...',
    '..kmyyyyyyymk...',
    '..kkkkkkkkkkk...',
    '.kkkkkkkkkkkkk..',
    '.kmyyyyyyyyymk..',
    '.kkkkkkkkkkkkk..',
    'kkkkkkkkkkkkkkk.',
    'kmyyyyyyyyyyymk.',
  ],
  // 7 - the top tier, spilling over
  [
    '..ky...ky...ky..',
    '.kyyk.kyyk.kyyk.',
    '..kkkkkkkkkkk...',
    '..kmyyyyyyymk...',
    '..kkkkkkkkkkk...',
    '.kkkkkkkkkkkkk..',
    '.kmyyyyyyyyymk..',
    '.kkkkkkkkkkkkk..',
    'kkkkkkkkkkkkkkk.',
    'kmyyyyyyyyyyymk.',
    'kkkkkkkkkkkkkkk.',
    'kmyyyyyyyyyyymk.',
  ],
];

export const SPRITES = {
  cormac: CORMAC,
  boxer: BOXER,
  rugby: RUGBY,
  footballer: FOOTBALLER,
  youtuber: YOUTUBER,
  guestA: GUEST_A,
  guestB: GUEST_B,
};

// --- The renderer ---------------------------------------------------------------------------

/**
 * Turn sprite rows into an SVG string. One <rect> per run of identical pixels, which keeps the
 * markup small enough that a page full of guests stays light.
 *
 * @param {string[]} rows  sprite data
 * @param {object}  [options]
 * @param {string}  [options.title] accessible name; omit for purely decorative art
 * @param {string}  [options.className]
 */
export function spriteSvg(rows, { title, className } = {}) {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const rects = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const colour = PALETTE[row[x]];
      if (!colour) {
        x += 1;
        continue;
      }
      // Extend the run while the colour stays the same.
      let run = 1;
      while (x + run < row.length && PALETTE[row[x + run]] === colour) run += 1;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${colour}"/>`);
      x += run;
    }
  });

  const labelled = title
    ? `role="img" aria-label="${escapeAttribute(title)}"`
    : 'role="presentation" aria-hidden="true"';

  return [
    `<svg viewBox="0 0 ${width} ${height}" ${labelled}`,
    ` class="sprite${className ? ` ${className}` : ''}"`,
    ' preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges">',
    rects.join(''),
    '</svg>',
  ].join('');
}

/** The cash pile at a given tier, clamped so an unexpected tier can't blow up the page. */
export function cashPileSvg(tier, options) {
  const index = Math.max(0, Math.min(CASH_TIERS.length - 1, tier));
  return spriteSvg(CASH_TIERS[index], options);
}

export const CASH_TIER_COUNT = CASH_TIERS.length;

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
