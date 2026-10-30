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
- **Display mode** (phone controls, tablet only shows): `js/link.js` sends `{ game, view }` one way over WebRTC (PeerJS, peer id `wizard-tracker-<4-digit code>`), with pings and automatic reconnects. `js/qr.js` draws the pairing QR and scans it with the camera, selfie camera first. PeerJS and the QR libraries load from unpkg on first use only. On the tablet `displayMode` is on and `currentGame` returns the received `displayGame`, so all computeds and the table-mode tiles work unchanged and nothing is written to `games`. Any new control in the game, score or end views must be hidden with `!displayMode`. A QR code holds the app URL with `?display=<code>`; `wizard_link` keeps the phone's code across restarts.

## Styling

- Tailwind and daisyUI 3 are compiled ahead of time into `css/tailwind.css`, which **is committed** because GitHub Pages does no build. After adding or changing Tailwind/daisyUI classes in `index.html` or `js/`, run `npm run build:css` and commit the output.
- `style.css` holds the hand-written styles: chips, table mode, chart, confetti. Theme colors come from daisyUI CSS variables (`hsl(var(--su))` etc.).
- Custom class names must not collide with Tailwind utilities. A class called `table-row` once got overridden to `display: table-row`, which is why table mode uses the `tm-` prefix.

## Versioning & changelog

Every change that affects the app (anything a user could notice, including fixes) ships in the **same commit** with:
1. A new entry at the top of `CHANGELOG.md`: `## [x.y.z] - YYYY-MM-DD`, written in German, using the sections Hinzugefügt / Geändert / Behoben / Entfernt.
2. A version bump following SemVer:
   - **Patch** for fixes and small tweaks.
   - **Minor** for new features.
   - **Major** when old saved games can no longer be read or the way the app is used changes fundamentally.

The version lives in four places, and `tests/version.test.js` (part of `npm test`) fails if they differ:
- `package.json` and `package-lock.json`: update both with `npm version x.y.z --no-git-tag-version`.
- `js/version.js` (`APP_VERSION`), which the overview page displays.
- `CACHE_NAME` in `sw.js` (`wizard-pwa-x.y.z`). A new version therefore always refreshes the offline cache.
- The newest heading in `CHANGELOG.md`.

Repo-only changes that don't touch the shipped app (CLAUDE.md, tests, tooling) get no version bump.

## Service worker / deploy

- `sw.js` serves same-origin files network-first with a cache fallback and pinned CDN URLs cache-first. New app-shell files must be added to `APP_SHELL`.
- All paths must stay relative (`./…`) because the site is served from a GitHub Pages subpath.
- Active development happens on the `feature-wizard-pwa-9715076361554955563` branch. `main` still has an older layout with the app in a `pwa-wizard/` subfolder.
