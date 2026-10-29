# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A buildless Vue 3 PWA for tracking scores in the card game Wizard. It is served as static files from the repo root via GitHub Pages and stores data only in `localStorage`. The UI and all user-facing text are in German.

## Commands

```bash
npm test                                                   # all logic tests (node:test)
node --test --test-name-pattern="forbiddenBid" tests/      # single test by name
npm run build:css                                          # rebuild css/tailwind.css (minified)
npm run watch:css                                          # rebuild on change while developing
npm run wizard                                             # static server on http://localhost:8000
```

There is no linter and no JS bundler.

## Architecture

- **No build for the app itself.** `index.html` loads Vue's global production build from unpkg, followed by `js/app.js` as an ES module. All templates live in-DOM inside `index.html` (one `v-if` block per view: `dashboard`, `setup`, `game`, `score`, `end`, `stats`), so in-DOM template rules apply. There are no components; everything sits in a single `setup()` in `js/app.js`.
- **`js/rules.js` holds all game logic** as pure functions with no DOM and no Vue. Examples: scoring, bidding order, the "bids must not add up" rule (`forbiddenBid`), round completion and reopening, stats and leaderboard, and save-format migration. `tests/rules.test.js` imports it directly. New logic goes here and gets a test; `app.js` should only wire state to the UI.
- **Data model:** `games` is an array saved under the `wizard_games` key on every deep change. A game holds `players` (seat order), `totalRounds`, `state` (`bidding` | `playing` | `finished`), `settings` (`noEvenBids`, `bomb`, `cloud`), `startScores` and `rounds[]`. Each round holds `roundNum` (the card count), `dealerIndex`, `bids`, `tricks`, `bombPlayed` and `cloudUsedBy`. A round gets `scores` once it is evaluated.
  - The current round is always the last element of `rounds`.
  - Totals are never stored. They are derived as `startScores + Σ round.scores` (`totals()`), which is why editing or reopening a round only needs `rescoreRound`/`reopenLastRound`.
- **Save-format migrations:** `GAME_VERSION` in `rules.js`, together with `migrateGame()`, upgrades old saves on load (v1 → v2 → v3). Any change to the stored shape must bump the version, add a migration step and add a migration test. Users have real games saved on their phones.
- **Session restore:** `wizard_session` remembers `{ view, gameId }` so the PWA reopens where it was. `tableMode`, `tableFlip` and `theme` are also kept in `localStorage`.
- **Table mode** is a separate fixed full-screen layout in `index.html` (`.tm*` classes in `style.css`). It shares all state with the phone layout. With `tableFlip` on, the players are split into two rows and the top row is rotated 180°, keeping seats in clockwise order.

## Styling

- Tailwind and daisyUI 3 are compiled ahead of time into `css/tailwind.css`, which **is committed** because GitHub Pages does no build. After adding or changing Tailwind/daisyUI classes in `index.html` or `js/`, run `npm run build:css` and commit the output.
- `style.css` holds the hand-written styles: chips, table mode, chart, confetti. Theme colors come from daisyUI CSS variables (`hsl(var(--su))` etc.).
- Custom class names must not collide with Tailwind utilities. A class called `table-row` once got overridden to `display: table-row`, which is why table mode uses the `tm-` prefix.

## Service worker / deploy

- `sw.js` serves same-origin files network-first with a cache fallback and pinned CDN URLs cache-first. New app-shell files must be added to `APP_SHELL`. Bump `CACHE_NAME` when the shell changes.
- All paths must stay relative (`./…`) because the site is served from a GitHub Pages subpath.
- Active development happens on the `feature-wizard-pwa-9715076361554955563` branch. `main` still has an older layout with the app in a `pwa-wizard/` subfolder.
