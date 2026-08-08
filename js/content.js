// Everything written rather than calculated: the chef's note, the menu, and the hall of fame.
// Edit freely - none of it is wired into any logic.

export const CHEF_NOTE = {
  text:
    'I am Cormac. I am 10 and I am the chef. I do breakfast and I do dinner and I am very good ' +
    'at chips. Book a table and bring money.',
  by: 'CORMAC, HEAD CHEF & OWNER',
};

// --- The menu -------------------------------------------------------------------------------
// Prices here are decoration. What the takings counter actually charges is pricePerHead in
// config.js, one price for breakfast and one for dinner.

export const MENU = [
  {
    course: 'BREAKFAST',
    items: [
      { name: 'The Full Cormac', price: 6, note: 'Sausages, beans, toast. No mushrooms, they are disgusting.' },
      { name: 'Pancake Tower', price: 5, note: 'As many as fit. Syrup included.' },
      { name: 'Eggs Any Way', price: 4, note: 'Scrambled, fried, or a surprise.' },
      { name: 'Cereal', price: 2, note: 'You pour it yourself.' },
    ],
  },
  {
    course: 'DINNER',
    items: [
      { name: 'World Famous Chips', price: 8, note: 'The reason people come. Ask Tyson.' },
      { name: 'Nuggets Deluxe', price: 9, note: 'Twelve of them. Dip included, extra dip is extra.' },
      { name: 'Spaghetti Bolognese', price: 10, note: 'Secret recipe (it is Mam’s).' },
      { name: 'Chicken Curry', price: 11, note: 'Mild. Do not ask for spicy.' },
      { name: 'Steak For A Champion', price: 15, note: 'Cooked how you like as long as it is well done.' },
    ],
  },
  {
    course: 'PUDDING',
    items: [
      { name: 'Ice Cream Mountain', price: 5, note: 'Three scoops, sprinkles, a flake.' },
      { name: 'Chocolate Cake', price: 4, note: 'Slice is huge.' },
      { name: 'Fruit', price: 1, note: 'Nobody has ever ordered this.' },
    ],
  },
  {
    course: 'DRINKS',
    items: [
      { name: 'Fizzy Orange', price: 2, note: null },
      { name: 'Milkshake', price: 3, note: 'Banana, chocolate or strawberry.' },
      { name: 'Tap Water', price: 0, note: 'Free, but it comes in a fancy glass.' },
    ],
  },
];

// --- The hall of fame -----------------------------------------------------------------------
// sprite: a key from js/sprites.js.
// image:  optional path under images/. If set, it is shown instead of the sprite - so pixel-art
//         pictures can be dropped in later without changing anything else.

export const GUESTS = [
  {
    name: 'TYSON FURY',
    known: 'Heavyweight boxing',
    sprite: 'boxer',
    image: null,
    stars: 5,
    quote: 'Best chips I have ever had, and I have had chips everywhere.',
  },
  {
    name: 'ANTOINE DUPONT',
    known: 'Rugby, France',
    sprite: 'rugby',
    image: null,
    stars: 5,
    quote: 'I came for the nuggets. I stayed for more nuggets.',
  },
  {
    name: 'LAMINE YAMAL',
    known: 'Football, Barcelona',
    sprite: 'footballer',
    image: null,
    stars: 5,
    quote: 'The chef is 10 and cooks better than my chef.',
  },
  {
    name: 'MRBEAST',
    known: 'The internet',
    sprite: 'youtuber',
    image: null,
    stars: 5,
    quote: 'I tried to buy the restaurant. He said no. Respect.',
  },
];

// Shown on the hall of fame page. It matters that this is obviously a joke.
export const GUESTS_DISCLAIMER =
  'Every review on this page was made up by a ten year old. None of these people have been here. Yet.';
