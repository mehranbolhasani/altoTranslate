# Alto Translate - Documentation & Next Steps Plan

## Project Status

**Current Version:** 1.4.0  
**Status:** Live on Chrome Web Store  
**Link:** https://chromewebstore.google.com/detail/alto-translate/icpcjiealadibmgncmoejgjakcihmbco

## Recently completed (Phase 2 — v1.4.0)

- **Phonetics**: Gemini JSON responses with optional romanization; in-page popup line gated by language list + settings flag; local storage + `getSettings` merge.
- **Vocabulary save**: Bookmark + My Vocabulary in content popup; background CRUD helpers; 500 entry cap + duplicate by original text.
- **Vocabulary page**: Manrope, review queue + daily `reviewedToday` rollover, table with filter + favicon links; **`Review` / `All words`** tabs + **settings** icon (opens options) beside the bottom tab bar; optional service-worker **deferred** new-tab→vocabulary redirect when the setting is on (stats stay in the header).
- **Vocabulary page motion**: [`vocabulary/vocabulary.mjs`](vocabulary/vocabulary.mjs) + [Motion](https://motion.dev/) — deck, **tab panel cross-fade**, empty/resume review states; **All words** table row Motion disabled on routine refreshes (actions use instant updates); `vendor/motion-lib.js`. Content script stays CSS-only.
- **Settings**: Languages phonetics toggle; **Vocabulary** sidebar tab; footer link to vocabulary page; **browser-action popup** / vocabulary page gears call `openOptionsPage`; **in-page translation** gear uses **`openSettings`** message (content scripts cannot open options directly).
- **New tab vocabulary**: optional redirect to the vocabulary page waits briefly before replacing a blank tab so normal **`target="_blank"`** navigations are not overwritten.

## Recently completed (options UI)

- **Settings page** (`options/`): Sidebar navigation (API, Languages, Theme, Cache, Test), Manrope typography, API card status indicators, `manifest.json` CSP updated for Google Fonts.

## Recently completed (v1.3.1 reliability)

- **Fixes**: Popup `display`/`box-sizing`/width after `all: initial`; `window` capture `scroll` so dismiss works; pin honored in delayed hide timer; `createPopup` awaits theme; collapsed selection uses mouse anchor; context container size cap + snippet null fix; command **Alt+A**, `lastFocusedWindow`, skip restricted tabs; `document_idle`.
- **Docs**: `CHANGELOG.md` [1.3.1].

## Recently completed (v1.3.0)

- **Phase 1 UX & LLM**: Selection **context snippets** in Gemini/OpenRouter prompts (`utils/selection_context.js`); **Alt+A** command; **pin** popup (`altoTranslatePopupPinned` in `chrome.storage.local`); **viewport-aware** popup + icon positioning; **`privacy.html`** + in-app links (set the store privacy URL to your hosted `privacy.html`).
- **Docs / version**: Manifest `1.3.0+`; `CHANGELOG.md` updated.

## Recently completed (v1.2.2)

- **Reliability**: Fixed outer `handleTranslation` catch referencing undefined `settings`.
- **MyMemory**: Always-on product behavior — no user toggle; `getSettings()` normalizes legacy `libretranslateEnabled: false`; options save persists `libretranslateEnabled: true`; `translateWithAll` always queues MyMemory.
- **MyMemory auto source**: Script-based inference (`utils/mymemory_infer_source.js`) with `sourceLanguageUsed` / `sourceInferred` on success responses (replaces dead `en`/`en` branch).
- **Popup**: Status indicators use key presence only (no live API validation on each open).
- **Options**: Reset-to-defaults includes `disableInputFields` and `libretranslateEnabled`; removed invalid “enable LibreTranslate” save gate when no keys.
- **Tests**: `tests/mymemory_infer_source.test.js`, `tests/settings_save_rules.test.js`.

## Completed Features (v1.0.0)

### Core Functionality
- Text selection detection with floating "ax" icon
- Mouse cursor positioning for floating button
- Translation popup with formatted output
- Copy to clipboard functionality
- Auto language detection
- Support for 50+ languages including RTL (Arabic, Persian, Hebrew, Urdu)

### API Integrations
- **Google Gemini API** - Primary translation service
- **OpenRouter API** — Key-only UX: **`OPENROUTER_FREE_MODEL_CANDIDATES`** in `utils/constants.js` is tried in order (free `:free` models only); update the list when the catalog rotates.
- **MyMemory API** - Free, no API key required, excellent for EN↔FA translations
- **Fallback System** - "All (fallback)" runs a **sequential** adaptive chain when MyMemory is eligible: usually **MyMemory → Gemini → OpenRouter** (if keys exist). For long selections (**`SMART_FALLBACK_LLM_FIRST_MIN_CHARS`** in `utils/constants.js`, default **2000** chars) with an LLM key, order becomes **Gemini → OpenRouter → MyMemory**. MyMemory remains skipped when the language pair is unsupported.

### User Interface
- Extension popup with quick settings access
- Comprehensive options/settings page
- Tailwind CSS (local build for CSP compliance)
- Dark mode with automatic system preference detection
- Persian/Farsi font support (Estedad)
- Clean, minimal design

### Technical Excellence
- Manifest V3 compliant
- Memory leak prevention with proper cleanup
- XSS protection with input sanitization
- Text length validation (5000 char limit)
- Secure API key storage in Chrome's encrypted storage
- CSP compliant (no inline scripts)
- Hot reload support for development

### Developer Experience
- No build process required (vanilla JS)
- Keyboard shortcut for extension reload (Ctrl+Shift+R / Cmd+Shift+R)
- Clean file structure
- Comprehensive error handling

## Documentation Tasks

### 1. Update Chrome Web Store Link
**File:** `README.md` line 30  
**Current:** "Coming soon - extension will be published to the Chrome Web Store"  
**Update to:** Link to live Chrome Web Store listing with badge/button

### 2. Verify File Structure Documentation
**File:** `README.md` lines 94-120  
**Check:**
- Missing files: `hot-reload.js`, `dark-mode.js` in popup/options
- Missing: `utils/api-gemini.js`, `utils/api-openrouter.js`, `utils/api-libretranslate.js`
- Missing: `utils/fonts/` directory with Estedad fonts
- Extra file: `icon.svg` in icons folder
- Extra file: `alto-translate-extension-v1.0.1.zip`

### 3. Update Description
**File:** `manifest.json` line 5  
**Current:** "A minimal Chrome extension for translating selected text using Gemini and OpenRouter APIs"  
**Missing:** MyMemory API reference

## Potential Enhancements (Future Versions)

### High Priority
1. **Analytics Dashboard** - Track translation usage, most translated languages
2. **Translation History** - Save and browse past translations
3. ~~**Keyboard Shortcut**~~ — **Done (v1.3.0+)** — Default **Alt+A**; configurable in `chrome://extensions/shortcuts`
4. **Custom Language Pairs** - Save favorite language combinations
5. **Context Menu Integration** - Right-click to translate

### Medium Priority
6. **Pronunciation/Audio** - Listen to translations
7. **Dictionary Integration** - Show word definitions
8. **Phrase Book** - Save commonly used translations
9. **Offline Mode** - Cache common translations
10. **Multi-word Selection** - Translate multiple selections at once

### Low Priority
11. **Browser Action Badge** - Show translation count
12. **Theme Customization** - Custom colors/fonts
13. **Export Translations** - CSV/JSON export
14. **OCR Support** - Translate text in images
15. **PDF Translation** - Translate PDF content

### Technical Improvements
16. **Unit Tests** - Add test coverage
17. **E2E Tests** - Automated browser testing
18. **CI/CD Pipeline** - Automated deployment
19. **Performance Monitoring** - Track API response times
20. **Error Reporting** - Automatic error tracking

## Known Issues & Limitations

### Current Limitations
- Maximum text length: 5000 characters
- MyMemory with source “auto” uses script heuristics (not true linguistic detection); wrong guesses possible for ambiguous Latin text
- No translation history persistence
- No offline capability

### Browser Support
- Chrome/Chromium: ✅ Fully supported
- Edge: ⚠️ Likely works (not tested)
- Firefox: ❌ Requires Manifest V2 port
- Safari: ❌ Requires Safari extension port

## Marketing & Growth

### Immediate Actions
1. Update GitHub README with Chrome Web Store link
2. Add screenshots to Chrome Web Store listing
3. Create demo video/GIF for README
4. Add Chrome Web Store badge to README

### Content Strategy
5. Write blog post about development process
6. Create Twitter/X announcement thread
7. Post on Reddit (r/chrome, r/languagelearning, r/webdev)
8. Post on Product Hunt
9. Share on Hacker News "Show HN"

### User Acquisition
10. SEO optimization for Chrome Web Store listing
11. Request reviews from early users
12. Create landing page
13. Submit to extension directories/lists
14. Reach out to language learning communities

## Maintenance Plan

### Weekly
- Monitor Chrome Web Store reviews
- Check for bug reports on GitHub
- Monitor API service status (Gemini, OpenRouter, MyMemory)

### Monthly
- Review analytics/usage data
- Update dependencies if needed
- Plan next feature release

### Quarterly
- Major version release with new features
- Security audit
- Performance optimization review

## File Structure Reference

```
altoTranslate/
├── manifest.json                    # Extension manifest (Manifest V3)
├── LICENSE                          # MIT License
├── README.md                        # Documentation
├── hot-reload.js                    # Development hot reload
├── alto-translate-extension-v1.0.1.zip  # Distribution package
├── altoTranslate.code-workspace     # VS Code workspace
│
├── icons/                           # Extension icons
│   ├── icon.svg                     # Source SVG
│   ├── icon16.png                   # 16x16 icon
│   ├── icon48.png                   # 48x48 icon
│   └── icon128.png                  # 128x128 icon
│
├── background/                      # Background service worker
│   └── background.js                # API routing, message handling
│
├── content/                         # Content scripts
│   ├── content.js                   # Text selection, floating icon, popup
│   └── content.css                  # Popup styling
│
├── popup/                           # Extension popup
│   ├── popup.html                   # Quick settings interface
│   ├── popup.mjs                    # Popup logic (ES module + Motion)
│   └── popup.css                    # Popup styling
│
├── vocabulary/                       # Saved words / daily review page
│   ├── vocabulary.html
│   ├── vocabulary.mjs               # Review UI (ES module + Motion)
│   └── vocabulary.css
│
├── vendor/                           # CSP-safe bundles (`script-src 'self'`)
│   └── motion-lib.js                # Built via `npm run build:motion`
├── scripts/
│   ├── build-motion.mjs
│   └── motion-export.mjs
├── package.json
├── package-lock.json
├── options/                         # Settings page
│   ├── options.html                 # Comprehensive settings UI
│   ├── options.mjs                  # Settings management (ES module + Motion)
│   └── options.css                  # Settings styling
│
└── utils/                           # Utility modules
    ├── api-gemini.js                # Google Gemini API integration
    ├── api-openrouter.js            # OpenRouter API integration
    ├── mymemory_infer_source.js     # Heuristic source lang for MyMemory when auto
    ├── api-libretranslate.js        # MyMemory API integration
    ├── storage.js                   # Chrome storage utilities
    ├── tailwind.css                 # Local Tailwind CSS build
    └── fonts/                       # Custom fonts
        ├── Estedad-Regular.woff2    # Persian font (regular)
        └── Estedad-Bold.woff2       # Persian font (bold)
```

## API Configuration Details

### Google Gemini API
- **Model:** `gemini-1.5-flash`
- **Endpoint:** `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent`
- **Rate Limit:** ~60 requests/minute (free tier)
- **Cost:** Free tier available
- **Best For:** General translations, auto-detection

### OpenRouter API
- **Models:** `OPENROUTER_FREE_MODEL_CANDIDATES` in `utils/constants.js` — ordered `$0`/`:free` slugs refreshed when OpenRouter rotates the catalog (no user-facing model picker).
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Rate Limit:** Varies by model
- **Cost:** Free models available
- **Best For:** Backup, alternative model access

### MyMemory API
- **Endpoint:** `https://api.mymemory.translated.net/get`
- **Rate Limit:** Unlimited (1000 words/day for anonymous)
- **Cost:** Free
- **Best For:** English↔Persian, zero-configuration

## Security Considerations

### Implemented
- ✅ Input validation (text length, type checks)
- ✅ XSS protection (HTML escaping)
- ✅ Secure API key storage (Chrome encrypted storage)
- ✅ CSP compliance (no inline scripts)
- ✅ Memory leak prevention
- ✅ Minimal permissions (storage only)

### Future Considerations
- Rate limiting per user session
- API key validation before storage
- Encrypted local storage option
- Content Security Policy v2
- Subresource Integrity (SRI)

## Chrome Web Store Submission Checklist

### Completed
- ✅ Extension approved and published
- ✅ Removed unused `scripting` permission
- ✅ Verified all permissions are necessary
- ✅ Tested in production environment
- ✅ Created promotional materials
- ✅ Written clear description
- ✅ Added privacy policy details

### For Future Updates
- Create changelog for each update
- Increment version number in manifest.json
- Test new version thoroughly
- Update screenshots if UI changes
- Submit update for review

## Next Steps (To-dos)

- [ ] Update README.md line 30 to include live Chrome Web Store link with badge
- [ ] Update README.md file structure section to include all current files (hot-reload.js, dark-mode.js, API files, `mymemory_infer_source.js`, fonts)
- [ ] Update manifest.json description to mention MyMemory API alongside Gemini and OpenRouter
- [ ] Add screenshots or demo GIF to README.md showing extension in action
- [x] Create CHANGELOG.md file to track version history and updates (present; keep updated per release)


