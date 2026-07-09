# AGENTS.md — Alto Translate

Chrome extension (Manifest V3). Translates selected text via Gemini, DeepL, Azure, and MyMemory APIs.

## Architecture

- **No bundler / no build for runtime code.** All extension scripts run directly in the browser.
- **`background/background.js`** — service worker. Loads libs via `importScripts('../utils/...')` because MV3 SW does not support ES modules.
- **`content/content.js`** — injected content script (class `AltoTranslate`). Also loads `utils/selection_context.js` as a separate content script (defined in `manifest.json`).
- **`.mjs` pages** — `options/options.mjs`, `popup/popup.mjs`, `vocabulary/vocabulary.mjs`. True ESM, loaded via `<script type="module">`. They import Motion from `../vendor/motion-lib.js`.

## Build

Only one build step exists — bundling the Motion animation library for CSP compliance:

```bash
npm run build:motion
```

This runs esbuild over `scripts/motion-export.mjs` → `vendor/motion-lib.js`. Only needed when the `motion` npm dependency version changes. Do not CDN-link Motion; the extension CSP forbids external scripts (`script-src 'self'`).

## Utility scripts (no module system)

Files in `utils/` define globals with `var`/`const` — no `export`/`module.exports`. This lets both `importScripts` (background SW) and plain `<script>` tags load them. The exceptions are:
- `utils/selection_context.js` and `utils/mymemory_infer_source.js` — add a `module.exports` gate for Node tests.
- `utils/alto-select.js` — ES module (`export function enhanceSelect / enhanceAllSelects`). Imported by `.mjs` pages. Zero dependencies, ~3 KB. Enhances `<select>` elements with a custom styled dropdown. Injects its own CSS dynamically.

## Testing

Tests are plain Node.js scripts with manual assertions — no framework:

```bash
node tests/<name>.test.js
```

Runnable tests (these use `require()` on the dual-purpose utility files):
- `node tests/selection_context.test.js`
- `node tests/mymemory_infer_source.test.js`
- `node tests/settings_save_rules.test.js`

Other test files (`validation.test.js`, `cache.test.js`, `languages.test.js`) are stubs/frameworks requiring a test runner. `api.test.js` is not present despite README mention.

`package.json` `test` script is a no-op stub. Add `"test": "jest"` when converting to a framework.

## Key conventions

- In extension pages (popup/options/vocabulary), open settings via `chrome.runtime.openOptionsPage()`.
- In the **content script**, `chrome.runtime.openOptionsPage` is not available — send a message instead: `chrome.runtime.sendMessage({ action: 'openSettings' })`. The background SW handles it.
- **MyMemory is always enabled** — the options "Save Rules" logic normalizes `libretranslateEnabled` to `true` regardless of UI checkbox state.
- **CSP-safe fonts**: The content script translation bubble uses bundled `.woff2` fonts (`utils/fonts/GoogleSansFlex-Latin.woff2` + `GoogleSansFlex-LatinExt.woff2`) with `@font-face` (latin + latin-ext subsets) in `content/content.css`. Extension pages (popup/options/vocabulary) load Google Sans Flex from Google Fonts (allowed by `style-src` CSP exception).
- **Motion animations** respect `prefers-reduced-motion` — each page checks this before running intro animations.
- `package.json` `type` is `commonjs`, so `.js` files default to CJS, `.mjs` files are ESM.
- `manifest.json` version must stay in sync with `package.json` version.

## OpenRouter removal & storage migration

OpenRouter has been removed from the UI. A migration in `background/background.js` runs on every SW start:
- Reads `apiPreference` from `chrome.storage.sync`.
- If the value is `openrouter` (exact match), overwrites with `libretranslate` and logs `[Alto] Migrated provider from openrouter → mymemory`.
- Idempotent by nature (no version flag). Errors are logged unconditionally.

## Onboarding engine selection

`onboarding/onboarding.mjs` saves the selected engine to storage **immediately** on card click via the `saveSettings` message handler (same path as options page). On page load, `syncEngineUI()` syncs the visual card selection to match the stored `apiPreference`, falling back to MyMemory if no card matches.

## Smart fallback

When `apiPreference` is `"both"`, the fallback order depends on text length:
- Short text (<500 chars): MyMemory first, then DeepL → Gemini → Azure.
- Long text (>=500 chars): DeepL → Gemini first, then MyMemory → Azure.

Threshold set by `SMART_FALLBACK_LLM_FIRST_MIN_CHARS` in `utils/constants.js`.
