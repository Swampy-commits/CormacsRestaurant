// The whole restaurant lives in this file. Changing opening hours, capacity, prices or the
// booking token means editing here and nothing else.

export const CONFIG = {
  // --- Where the bookings are stored ------------------------------------------------------
  owner: 'Swampy-commits',
  repo: 'CormacsRestaurant',

  restaurantName: "CORMAC'S RESTAURANT",
  currency: '€',

  // --- Opening hours ----------------------------------------------------------------------
  // Hour-long sittings, seven days a week. Breakfast doors shut at 10:00, dinner at 18:00,
  // so the last sitting of each service starts an hour before closing.
  services: [
    {
      id: 'breakfast',
      label: 'BREAKFAST',
      slots: ['08:00', '09:00'],
      pricePerHead: 6,
    },
    {
      id: 'dinner',
      label: 'DINNER',
      slots: ['14:00', '15:00', '16:00', '17:00'],
      pricePerHead: 15,
    },
  ],

  // --- Seating ----------------------------------------------------------------------------
  // Two independent areas. Filling one has no effect on the other.
  areas: [
    { id: 'inside', label: 'INSIDE', seats: 10 },
    { id: 'outside', label: 'OUTSIDE', seats: 16 },
  ],

  // How far ahead you can book.
  maxDaysAhead: 30,

  maxNameLength: 40,

  // --- Money ------------------------------------------------------------------------------
  // The cash pile gains a tier each time takings pass one of these totals.
  cashPileTiers: [0, 100, 250, 500, 1000, 2500, 5000, 10000],

  // --- The booking token ------------------------------------------------------------------
  // A fine-grained personal access token limited to this repo with "Issues: read and write".
  // Stored XOR-obfuscated so GitHub's secret scanning doesn't spot it and auto-revoke it.
  // Generate these with: node tools/encode-token.js <token>
  // See README for the full rotation procedure.
  tokenParts: [],
};
