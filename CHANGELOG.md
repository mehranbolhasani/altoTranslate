# Changelog

All notable changes to Alto Translate are documented in this file.

## [Unreleased]

### Fixed

- **Content script → settings**: in-page translation popup gear now uses `sendMessage({ action: 'openSettings' })`; `chrome.runtime.openOptionsPage` is not available in content scripts, so the background opens options ([`content/content.js`](content/content.js), [`background/background.js`](background/background.js)).
- **New tab vocabulary vs `target="_blank"`**: optional “open vocabulary in new tab” no longer overwrites tabs that briefly start blank while a link navigation is loading — redirect runs after a short delay only if the tab URL is still blank/new-tab ([`background/background.js`](background/background.js)).
- **Vocabulary motion (double-animations)** ([`vocabulary/vocabulary.mjs`](vocabulary/vocabulary.mjs), [`vocabulary/vocabulary.css`](vocabulary/vocabulary.css)): “All caught up” — hide celebration under `body:not(.is-ready)`, **sync Motion reset** after `is-ready` + **busy guard** + **parallel** container/icon (icon **scale-only** to avoid nested opacity); **table** — removed row stagger on tab switch (panel already enters), **stop** prior row Motion on each stagger, cancel duplicate opacity with parent panel animation.
- **Vocabulary review UI**: enforce **either** the review deck **or** the “All caught up” block (CSS `display:flex` vs `[hidden]`, `#reviewCard.is-review-empty`).
- **Vocabulary page** ([`vocabulary/vocabulary.mjs`](vocabulary/vocabulary.mjs)): restore missing `runDeckExit` method header (body was orphaned after `resetRevealUi()`), which caused a class-body syntax error and blank page.

### Added

- **Motion (motion.dev)** for extension pages: vendored ESM bundle [`vendor/motion-lib.js`](vendor/motion-lib.js) (build: `npm run build:motion`). CSP-safe `script-src 'self'` only — no CDN.
- **Vocabulary page** ([`vocabulary/vocabulary.mjs`](vocabulary/vocabulary.mjs)): deck intro, exit/enter, shake, idle float, and flip `rotateY` via Motion; ghost cards are DOM elements (`.vocab-deck-layer--before` / `--after`) instead of `::before`/`::after`. Content script animations unchanged per scope.
- **Options** ([`options/options.mjs`](options/options.mjs)): tab panel enter uses Motion; CSS `tabFadeIn` keyframes removed.
- **Popup** ([`popup/popup.mjs`](popup/popup.mjs)): short shell intro via Motion.

### Changed

- **Node tooling**: [`package.json`](package.json) with `motion` + `esbuild`; [`scripts/build-motion.mjs`](scripts/build-motion.mjs) bundles exports for the extension.
- **Popup / vocabulary**: settings **gear** opens options — browser-action footer [`popup/popup.html`](popup/popup.html); vocabulary tab bar [`vocabulary/vocabulary.html`](vocabulary/vocabulary.html) uses `chrome.runtime.openOptionsPage`; **in-page translation** footer [`content/content.js`](content/content.js) uses `sendMessage({ action: 'openSettings' })` (content scripts cannot call `openOptionsPage`).
- **Vocabulary page** ([`vocabulary/vocabulary.html`](vocabulary/vocabulary.html), [`vocabulary/vocabulary.css`](vocabulary/vocabulary.css), [`vocabulary/vocabulary.mjs`](vocabulary/vocabulary.mjs)): **Review** / **All words** tabs with **cross-fade + slide** Motion; **empty ↔ deck** celebration and resume transitions; **All words** table no longer re-animates rows on every refresh (delete/restore/filter/storage); optional `renderTable({ animateRows: true })` still runs a **light parallel** row nudge (no cascading stagger); first-visit **all caught up** entrance after `is-ready`; page intro unchanged otherwise; deck float pauses on Words tab.
- **Vocabulary (review)**: hide **Today’s review** title when the empty **All caught up for today** state is shown; review landmark gets `aria-label` in that case.
- **Vocabulary page layout**: `.vocab-main` tighter vertical rhythm (`gap: 2rem`) under the shared tab chrome.
- Page intro timing: `body.is-ready` is added **after** Motion intro completes (when motion is allowed), so CSS no longer runs competing stagger transitions on the review deck.

### Removed

- Legacy CSS keyframe deck choreography and `animationend` token plumbing from the old `vocabulary.js` implementation.
