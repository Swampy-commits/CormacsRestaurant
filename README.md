# Cormac's Restaurant

A booking app for Cormac's Restaurant. Cormac is 10, he is the chef, and he would like you to book
a table and bring money.

It runs entirely on GitHub — GitHub Pages serves the site, a GitHub Action is the backend, and the
repository is the database. No servers, no third-party services, no npm packages.

- **Book** — pick a day, a party size, a sitting, and inside or outside.
- **Menu** — what Cormac cooks.
- **Hall of Fame** — famous guests and their entirely invented reviews.
- **Owner Mode** — every booking, grouped by day and sitting, with the day's takings.

## How it works

GitHub Pages can only serve files. It cannot receive or store anything. But bookings have to be
*shared*, or a table booked on a phone would be invisible on the laptop. So GitHub itself is the
backend:

```
browser ──opens an issue──▶ GitHub issue
                              │
                              ▼
                    Action: process-booking
                      · re-checks the rules
                      · writes data/bookings.json
                      · comments and closes the issue
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    Pages redeploys the site        browser reads the comment
    (availability for everyone)     (confirmation for you)
```

The browser's only privileged action is opening an issue. Everything that decides whether a table
is free happens inside the Action, where the client cannot interfere.

A booking takes 20–40 seconds, because that is how long an Action takes to start, run and push.
The page shows a spinner and narrates the kitchen while it waits.

### Why the confirmation and the availability come from different places

The confirmation is read from the issue's comments. Availability is read from `data/bookings.json`
on the Pages site, which lags another 30–60 seconds behind while Pages redeploys. Waiting for
Pages would double the wait for the person who just booked, so their own booking is merged into the
page immediately and everyone else picks it up on their next load.

### How two people can't book the same last seats

There is deliberately **no** `concurrency` group on the workflow. GitHub keeps only one pending run
per concurrency group and cancels any earlier pending one, so with three bookings arriving at once
the middle booking would be silently thrown away.

Instead `write-booking.sh` retries: each run fetches the latest bookings, checks availability
against them, and pushes. A run that loses the race re-reads the winner's booking and re-checks
availability — so the last seats can only ever be sold once, and no booking is dropped.

## Setting it up

### 1. Turn on Pages

Settings → Pages → deploy from branch `main`, folder `/` (root).

The repository has to be **public**, because Pages from a private repository needs a paid plan.
That means bookings are publicly readable — see [What is public](#what-is-public).

### 2. Create the booking token

The site needs a token to open issues on your behalf.

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new
2. **Repository access**: only this repository
3. **Permissions**: Issues → **Read and write**. Nothing else. Do not grant Contents.
4. Generate, and copy the token

Then obfuscate it and put it in the config:

```bash
node tools/encode-token.js github_pat_your_token_here
```

Paste the printed `tokenParts` array into `js/config.js`, replacing the empty one, and commit.

Until you do this the site works fine — you can browse the menu, the hall of fame and Owner Mode —
but the booking buttons stay dead and say so.

### 3. Check it

Open the site, book a table, and watch the Actions tab. You should get a booking code within about
40 seconds, and the issue should close itself with a confirmation comment.

## The token, honestly

**The token is public.** It ships inside a public website. Anyone who views source can extract it
in seconds. That is understood and accepted here, for two reasons:

1. It can do exactly one thing — open issues in this one repository. It cannot read or change code,
   and it cannot touch anything else you own. The worst case is nuisance issues, and the Action
   ignores any issue that isn't a properly formatted booking.
2. This is a family app, not a business.

It is stored XOR-obfuscated by `js/token-codec.js`. That is **not** security and does not pretend to
be. Its only purpose is to stop GitHub's secret scanning recognising the token, flagging it and
auto-revoking it — which would break bookings quietly, days later, for no visible reason.

### Rotating the token

Fine-grained tokens expire (up to about a year), and a revoked one will stop bookings dead. The
site is explicit when this happens: it shows **OUT OF ORDER — the booking key needs renewing**
rather than failing silently.

To fix it, repeat step 2 above: new token, `node tools/encode-token.js`, paste, commit. Takes a
minute.

## What is public

Anyone with the link can read:

- every booking, including the first name, party size and sitting
- Owner Mode, which has no password

Owner Mode cannot be protected. A static page has no way to check a password — anything in the
JavaScript can be read by anyone. So **use first names only**. There is nothing in here worth
protecting, and that is by design.

## Changing the restaurant

Almost everything lives in two files and needs no code changes.

**`js/config.js`** — opening hours, capacity, prices:

```js
services: [
  { id: 'breakfast', label: 'BREAKFAST', slots: ['08:00', '09:00'], pricePerHead: 6 },
  { id: 'dinner', label: 'DINNER', slots: ['14:00','15:00','16:00','17:00'], pricePerHead: 15 },
],
areas: [
  { id: 'inside',  label: 'INSIDE',  seats: 10 },
  { id: 'outside', label: 'OUTSIDE', seats: 16 },
],
maxDaysAhead: 30,
```

Sittings are an hour long, so the last one starts an hour before you close. Add or remove slots,
change the seat counts, change the prices — every page derives its layout from this.

**`js/content.js`** — the chef's note, the menu, the guests and their reviews.

### Adding a guest to the Hall of Fame

Add an entry to `GUESTS` in `js/content.js`. Use `sprite: 'guestA'` or `'guestB'` as a placeholder
until someone draws them.

### Drawing a sprite

Sprites in `js/sprites.js` are lists of strings, one character per pixel, looked up in `PALETTE`.
A dot is transparent. To change a picture, change a character:

```js
const CORMAC = [
  '.....wwwwww.....',   // w = white, the chef's hat
  '....yyyyyyyy....',   // y = blonde hair
  ...
];
```

The tests check that every row is the same length and every character is in the palette, so a
typo is caught rather than rendering as an invisible hole.

If you would rather use real pictures, put an image in `images/` and set `image: 'images/name.png'`
on that guest. It is used instead of the sprite.

## Running it locally

```bash
python3 -m http.server 8000     # or: npm run serve
```

Then open <http://localhost:8000>. Booking works from localhost too — the GitHub API allows it.

## Tests

```bash
node --test                     # or: npm test
```

No test framework, no dependencies: Node's built-in runner.

- `test/booking-rules.test.js` — the rules that decide whether a table is free. Per-area capacity,
  the closed gap between services, sittings that have already started, the booking horizon.
- `test/money.test.js` — takings at two different prices per head, the best-day hi-score, cash pile
  tiers.
- `test/sprites.test.js` — every sprite is rectangular and every pixel is a real palette colour.
- `test/token-codec.test.js` — the encoder and the browser agree, and nothing token-shaped survives.
- `test/render-smoke.test.js` — the pages actually render, against a small hand-written DOM stub in
  `test/support/`. This is a smoke test, not a browser: it proves a full area reads `FULL` while the
  other stays open, and that a party of 12 is refused inside but offered outside. How it *looks*
  still has to be checked by eye.

They run on every push via `.github/workflows/test.yml`.

## Layout

```
index.html  menu.html  guests.html  admin.html
css/styles.css                      arcade theme, tokens, responsive, CRT toggle
fonts/                              Press Start 2P, self-hosted (SIL OFL, see fonts/OFL.txt)
js/config.js                        hours, capacity, prices, the token
js/content.js                       chef's note, menu, guests, reviews
js/booking-rules.js                 the rules - shared by the browser AND the Action
js/money.js                         takings, hi-score, cash pile tiers
js/sprites.js                       palette, pixel data, SVG renderer
js/github.js                        the API, and the token
js/bookings-client.js               file a booking or cancellation, wait for the answer
js/ui.js                            DOM helper, nav, status bar, seat meters, banners
js/app.js                           the booking page
js/admin.js                         Owner Mode
js/sound.js                         WebAudio coin blip - no audio file
data/bookings.json                  the database. Only the Action writes to it
tools/encode-token.js               obfuscate a new token
.github/workflows/                  process-booking, tests
.github/scripts/                    the backend
```

`js/booking-rules.js` is imported by both the browser and the Action, so the rule that decides
whether a table is free exists exactly once. `package.json` is there only to set
`"type": "module"` so Node treats `.js` as ESM — it has no dependencies.

## Accessibility and comfort

The scanlines and neon glow are lovely on a laptop at night and hard going on a phone in daylight,
so there is a **CRT: ON/OFF** toggle in the corner, remembered per device. `prefers-reduced-motion`
turns off every animation, including the takings counter. Sound starts on, can be switched off with
the **SOUND** toggle, and only ever plays in response to a tap.
