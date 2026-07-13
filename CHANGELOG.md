# Changelog

All notable changes to Alto Translate are documented in this file.

## [Unreleased]

## [1.6.5] - 2026-07-13

### Fixed

- **Alto Cloud routing** ([`background/background.js`](background/background.js)): derive free-vs-cloud tier at translate time from `apiKey_alto` instead of stored `apiPreference`, so paying users are never silently routed to the rate-limited free tier when storage fields desync.

## [1.6.4] - 2026-07-13

### Fixed

- **Alto Cloud contamination retry** ([`utils/api-alto-cloud.js`](utils/api-alto-cloud.js)): detect plain-ASCII loanword drift in non-Latin targets (e.g. `teknoloj`, `resultados`) via `hasSuspiciousLowercaseLatinWord`; log contamination checks at `console.log` with per-attempt diagnostics; retry up to 3 times (auto + 2 forced Gemini) before returning best-effort output.

## [1.6.3] - 2026-07-09

### Changed

- **Store listing & privacy**: updated `manifest.json` summary, [`privacy.html`](privacy.html), and docs to reflect that altoTranslate now uses **only** altoTranslate infrastructure — free tier (100 translations/day) and **altoCloud Pro** (unlimited with API key). Removed references to Gemini, DeepL, Azure, and MyMemory as user-facing options.
- **CSP**: extension pages `connect-src` now allows only `api.altotranslate.xyz` (plus localhost for dev).

## [1.6.2] - 2026-07-09

### Changed

- **Branding**: extension name is now **altoTranslate** in [`manifest.json`](manifest.json) (Chrome Web Store title), toolbar tooltip, page titles, and [`privacy.html`](privacy.html).
- **Store summary**: updated `manifest.json` `description` to reflect current engines (Gemini, DeepL, Azure, MyMemory, Alto Cloud), vocabulary review, and smart fallback.

## [1.6.1] - 2026-07-09

### Added

- **Dev tooling**: `npm run dev` (live-reload watcher), `npm run zip` (Chrome Web Store packaging via [`scripts/build-zip.sh`](scripts/build-zip.sh)), and [`utils/dev-reload.js`](utils/dev-reload.js) for local iteration.

### Changed

- **Typography**: **Google Sans Flex** replaces Manrope — Google Fonts on extension pages; bundled latin + latin-ext `.woff2` subsets for the in-page translation bubble ([`content/content.css`](content/content.css), [`utils/fonts/`](utils/fonts/)).
- **Vocabulary page** ([`vocabulary/vocabulary.html`](vocabulary/vocabulary.html), [`vocabulary/vocabulary.css`](vocabulary/vocabulary.css), [`vocabulary/vocabulary.mjs`](vocabulary/vocabulary.mjs)): layout refresh; fade/blur reveal replaces 3D card flip; Reveal / Got it / Again buttons unified in a single action bar; Motion timings aligned with the options page stagger pattern.
- **Options & onboarding**: animation and layout refinements carried forward from the 1.6.0 redesign.

### Fixed

- **Open vocabulary from popup**: the translation popup no longer uses `window.open()` for the extension URL (blocked by some browsers); it sends `{ action: 'openVocabulary' }` to the background, which opens the page via `chrome.tabs.create()` ([`content/content.js`](content/content.js), [`background/background.js`](background/background.js)).

## [1.6.0] - 2026-06-22

### Added

- **Alto Cloud**: expanded client integration in [`utils/api-alto-cloud.js`](utils/api-alto-cloud.js).
- **Translation popup**: vocabulary save/open controls and banner feedback in [`content/content.js`](content/content.js).

### Changed

- **Options & onboarding**: major UI simplification and redesign — leaner markup, shared settings patterns, and refined Motion intro animations.
- **Background service worker**: streamlined message handling and vocabulary/new-tab logic.

## [1.5.1] - 2026-05-28

### Fixed

- **Review page link**: replaced the hardcoded `EXTENSION_ID` placeholder in the review nudge with a dynamic `chrome.runtime.id` URL so the "Leave a review" link opens the correct Chrome Web Store listing ([`background/background.js`](background/background.js)).

## [1.5.0] - 2026-05-20

### Added

- **First-run onboarding flow**: a 5-screen wizard that opens in a new tab on first install. Covers target language, translation engine selection, API key setup, a live sandbox demo, and optional extras. Skippable at every step. Replayable from the settings sidebar footer ([`onboarding/onboarding.html`](onboarding/onboarding.html), [`background/background.js`](background/background.js)).

## [1.4.0] - 2026-05-12

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

- **Typography**: **Inter / rsms.me** removed; **Manrope** via Google Fonts on [**`popup/popup.html`**](popup/popup.html) and [**`privacy.html`**](privacy.html). The **content script** translation bubble uses a **bundled** Manrope variable font ([**`utils/fonts/Manrope-Variable.woff2`](utils/fonts/Manrope-Variable.woff2), **`@font-face`** in [**`content/content.css`**](content/content.css)) so strict host **CSP** cannot block loading it.
- **Package metadata**: [`package.json`](package.json) `version` aligned with **`manifest.json`** (`1.4.0`); **`license`** set to **`MIT`** to match [`LICENSE`](LICENSE).
- **Node tooling**: [`package.json`](package.json) with `motion` + `esbuild`; [`scripts/build-motion.mjs`](scripts/build-motion.mjs) bundles exports for the extension.
- **Popup / vocabulary**: settings **gear** opens options — browser-action footer [`popup/popup.html`](popup/popup.html); vocabulary tab bar [`vocabulary/vocabulary.html`](vocabulary/vocabulary.html) uses `chrome.runtime.openOptionsPage`; **in-page translation** footer [`content/content.js`](content/content.js) uses `sendMessage({ action: 'openSettings' })` (content scripts cannot call `openOptionsPage`).
- **Vocabulary page** ([`vocabulary/vocabulary.html`](vocabulary/vocabulary.html), [`vocabulary/vocabulary.css`](vocabulary/vocabulary.css), [`vocabulary/vocabulary.mjs`](vocabulary/vocabulary.mjs)): **Review** / **All words** tabs with **cross-fade + slide** Motion; **empty ↔ deck** celebration and resume transitions; **All words** table no longer re-animates rows on every refresh (delete/restore/filter/storage); optional `renderTable({ animateRows: true })` still runs a **light parallel** row nudge (no cascading stagger); first-visit **all caught up** entrance after `is-ready`; page intro unchanged otherwise; deck float pauses on Words tab.
- **Vocabulary (review)**: hide **Today’s review** title when the empty **All caught up for today** state is shown; review landmark gets `aria-label` in that case.
- **Vocabulary page layout**: `.vocab-main` tighter vertical rhythm (`gap: 2rem`) under the shared tab chrome.
- Page intro timing: `body.is-ready` is added **after** Motion intro completes (when motion is allowed), so CSS no longer runs competing stagger transitions on the review deck.

### Removed

- Legacy CSS keyframe deck choreography and `animationend` token plumbing from the old `vocabulary.js` implementation.
