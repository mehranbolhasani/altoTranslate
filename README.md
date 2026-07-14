# altoTranslate — Chrome Extension

A minimal Chrome extension for translating selected text on any webpage. Powered by **altoTranslate infrastructure** — AI translations via Gemini and Groq with automatic quality routing. Free to start (100 translations/day), or upgrade to **altoCloud Pro** for unlimited translations.

**Website:** [altotranslate.xyz](https://altotranslate.xyz) · **Pricing:** [altotranslate.xyz/pricing](https://altotranslate.xyz/pricing) · **Dashboard:** [altotranslate.xyz/dashboard](https://altotranslate.xyz/dashboard)

## Features

- **Zero setup**: Works the moment you install — no API keys, no accounts, no configuration
- **Simple text selection**: Select any text on a webpage and click the "ax" icon to translate
- **AI-powered translations**: Multi-model routing (Gemini + Groq) for speed and quality
- **Auto language detection**: Automatically detects source language
- **50+ languages**: Major world languages including RTL scripts (Arabic, Persian, Hebrew, Urdu)
- **Vocabulary review**: Save words from translations and review them with flashcards
- **First-run onboarding**: 3-step setup wizard on install (target language, preferences, live demo)
- **Clean UI**: Minimal, non-intrusive in-page popup with Google Sans Flex typography
- **Dark mode**: Automatic dark mode support on websites and extension pages
- **9 color themes**: Ocean, Sunset, Forest, Purple, Midnight, Rose, Amber, Slate, and more
- **Pin to page**: Keep the translation popup open while scrolling or clicking elsewhere
- **Keyboard shortcut**: **Alt+A** to translate the current selection (configurable at `chrome://extensions/shortcuts`)
- **Translation cache**: LRU cache for faster repeat lookups; clearable from settings
- **Copy to clipboard**: Easy copying of translated text
- **Memory optimized**: Zero memory leaks, optimized for long-running sessions
- **Security first**: Input validation, XSS protection, CSP-compliant architecture

## Plans

| | **Free** | **altoCloud Pro** |
|---|---|---|
| **Price** | €0 / forever | €1.99/month (annual plan −29%) |
| **Translations** | 100/day | Unlimited |
| **Languages** | 50+ | 50+ |
| **API key required** | No | Yes (from dashboard) |
| **Account required** | No | Yes (for subscription) |
| **AI routing** | Gemini + Groq | Gemini + Groq (priority routing) |
| **Key rotation** | — | Via dashboard |

Payments are handled by Polar (Merchant of Record). VAT included. Cancel anytime with a 3-day grace period.

To upgrade, visit [altotranslate.xyz/pricing](https://altotranslate.xyz/pricing), subscribe, then paste your altoCloud key in **Settings → altoCloud**.

## Installation

### From Chrome Web Store

Install from the [Chrome Web Store listing](https://chromewebstore.google.com/) (search for **altoTranslate**) or click **Add to Chrome** on [altotranslate.xyz](https://altotranslate.xyz).

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** in the top right
4. Click **Load unpacked** and select the extension folder
5. The extension is ready — select text on any page to translate

## Setup

**No setup required for the free tier.** altoTranslate works immediately after install.

### Optional: altoCloud Pro

1. Subscribe at [altotranslate.xyz/pricing](https://altotranslate.xyz/pricing)
2. Copy your API key from [altotranslate.xyz/dashboard](https://altotranslate.xyz/dashboard)
3. Click the extension icon in the toolbar to open **Settings**
4. Go to the **altoCloud** tab, paste your key, and click **Validate**
5. Save settings — you now have unlimited translations

### First-run onboarding

On first install, a setup wizard opens in a new tab. It walks you through choosing your target language and preferences. You can skip at any step and replay it later from **Settings → Replay setup tour**.

## Usage

1. **Select text**: Highlight any text on a webpage
2. **Click icon**: Click the "ax" icon that appears near your selection
3. **View translation**: The translated text appears in an in-page popup
4. **Keyboard shortcut**: With text selected (not while typing in an input), press **Alt+A** to translate
5. **Save to vocabulary**: Use the bookmark button in the popup to save the word for later review
6. **Open settings**: Click the extension toolbar icon to open the settings page
7. **Copy text**: Use the copy button in the popup

## How translation works

All translations go through **altoTranslate's own API** at `api.altotranslate.xyz`:

- **Free tier** (`/v1/free/chat/completions`) — no API key, rate-limited to 100 requests/day per IP
- **altoCloud Pro** (`/v1/chat/completions`) — authenticated with your dashboard API key, unlimited

The backend auto-routes requests between **Gemini** and **Groq** for optimal speed and quality. Long selections are automatically chunked and translated in parallel. The extension does **not** use third-party APIs you configure yourself (Gemini, DeepL, Azure, or MyMemory keys are no longer supported).

When you hit the free daily limit, the popup shows an upgrade prompt linking to [altotranslate.xyz/pricing](https://altotranslate.xyz/pricing).

## Supported Languages

**Major languages:** English (en), Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt), Russian (ru), Chinese (zh), Japanese (ja), Korean (ko), Arabic (ar), Hindi (hi)

**European languages:** Dutch (nl), Swedish (sv), Danish (da), Norwegian (no), Finnish (fi), Polish (pl), Turkish (tr), Greek (el), Czech (cs), Hungarian (hu), Romanian (ro), Bulgarian (bg)

**Asian languages:** Thai (th), Vietnamese (vi), Indonesian (id), Malay (ms), Filipino (tl), Hebrew (he), Ukrainian (uk)

**RTL languages (right-to-left):** Arabic (ar), Persian/Farsi (fa), Hebrew (he), Urdu (ur)

**Total: 50+ languages supported**

## File Structure

```
altoTranslate/
├── manifest.json              # Extension manifest (MV3)
├── privacy.html               # Privacy policy page
├── icons/                     # Extension icons (PNG + SVG)
├── content/                   # Content script
│   ├── content.js            # Text selection, popup, vocabulary save
│   └── content.css           # In-page popup styling (+ bundled @font-face fonts)
├── background/               # Background service worker
│   └── background.js         # API routing, caching, message handling
├── options/                  # Settings page
│   ├── options.html
│   ├── options.mjs           # Settings logic (ESM + Motion)
│   └── options.css
├── onboarding/               # First-run setup wizard
│   ├── onboarding.html
│   ├── onboarding.mjs
│   └── onboarding.css
├── vocabulary/               # Vocabulary / review page
│   ├── vocabulary.html
│   ├── vocabulary.mjs
│   └── vocabulary.css
├── vendor/                   # Vendored bundles (MV3 CSP)
│   └── motion-lib.js        # Built by `npm run build:motion`
├── scripts/
│   ├── build-motion.mjs     # esbuild wrapper
│   ├── build-zip.sh         # Chrome Web Store packaging
│   ├── dev-watch.mjs        # Live-reload watcher
│   └── motion-export.mjs    # Motion re-exports
├── tests/                    # Node.js test scripts
├── package.json
└── utils/                    # Utility modules (globals, no bundler)
    ├── api-alto-cloud.js    # altoTranslate API (free + cloud tiers)
    ├── constants.js         # Shared constants
    ├── languages.js         # Language name/code mapping
    ├── selection_context.js # Sentence/snippet bounds for context
    ├── alto-select.js       # Custom styled dropdown (ESM)
    ├── themes.js            # Popup color themes
    ├── error-messages.js    # User-facing error strings
    ├── dark-mode.js         # Dark mode utilities
    ├── dev-reload.js        # Dev-only live reload
    ├── tailwind.css         # Tailwind CSS utilities
    └── fonts/               # Bundled .woff2 (Google Sans Flex latin subsets)
```

## Development

### Prerequisites

- Chrome browser
- **Node.js 18+** (for Motion bundle rebuild, dev watcher, and packaging)

### Commands

```bash
npm run dev          # Live-reload watcher for local iteration
npm run zip          # Package for Chrome Web Store (outputs dist/alto-translate-v{VERSION}.zip)
npm run build:motion # Rebuild vendor/motion-lib.js after upgrading the motion dependency
```

The shipped extension includes `vendor/motion-lib.js`. No build step is required for day-to-day editing of non-bundled scripts.

### Testing

Runnable Node.js tests (manual assertions, no framework):

```bash
node tests/selection_context.test.js
node tests/mymemory_infer_source.test.js
node tests/settings_save_rules.test.js
```

See [`tests/README.md`](tests/README.md) for the full test suite overview.

## Privacy & Security

- **Privacy policy**: [`privacy.html`](privacy.html) — also hosted at [altotranslate.xyz](https://altotranslate.xyz)
- **No third-party API keys**: Translations go only to `api.altotranslate.xyz`; you never configure external provider keys
- **Local storage**: Settings, optional altoCloud key, vocabulary, and translation cache are stored in Chrome extension storage on your device
- **No tracking**: No analytics or tracking code included
- **Input validation**: All user inputs are validated and sanitized
- **XSS protection**: HTML content is properly escaped
- **CSP compliant**: Extension pages connect only to `api.altotranslate.xyz` (plus localhost for dev)

## Troubleshooting

### Common issues

1. **Icon doesn't appear**
   - Check if text is properly selected
   - Ensure the extension is enabled
   - Try refreshing the page

2. **Translation fails**
   - Check your internet connection
   - If on altoCloud Pro, verify your API key in Settings → altoCloud → Validate
   - If on the free tier, you may have hit the 100/day limit — wait until tomorrow or upgrade

3. **Settings not saving**
   - Check browser permissions
   - Try reloading the extension at `chrome://extensions/`

### Error messages

- **"You've reached the free daily limit"**: Upgrade to altoCloud Pro at [altotranslate.xyz/pricing](https://altotranslate.xyz/pricing), or wait until the limit resets
- **"Invalid or expired Alto Cloud key"**: Check your subscription and key at [altotranslate.xyz/dashboard](https://altotranslate.xyz/dashboard)
- **"Alto Cloud is temporarily busy"**: Transient upstream issue — try again in a moment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Support

- **Website**: [altotranslate.xyz](https://altotranslate.xyz)
- **Pricing & upgrade**: [altotranslate.xyz/pricing](https://altotranslate.xyz/pricing)
- **Dashboard**: [altotranslate.xyz/dashboard](https://altotranslate.xyz/dashboard)
- **Issues**: Open an issue on [GitHub](https://github.com/mehranbolhasani/altoTranslate/issues)

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for full release notes.

### Version 1.6.5 (current)

- Fixed Alto Cloud routing desync — paying users are never silently routed to the free tier when storage fields desync.
- Strengthened contamination retry for non-Latin targets (up to 3 attempts with forced Gemini fallback).

### Version 1.6.3

- Translations run on altoTranslate infrastructure only — no third-party API keys to configure.
- **Free**: 100 translations/day. **altoCloud Pro**: unlimited with API key from [altotranslate.xyz/dashboard](https://altotranslate.xyz/dashboard).
- Updated privacy policy and store listing copy.

### Version 1.6.2

- Renamed to **altoTranslate** across the extension and Chrome Web Store package metadata.

### Version 1.6.1

- **Google Sans Flex** typography across extension pages and the in-page translation bubble.
- Vocabulary page redesign; fixed vocabulary page link from the translation popup.
- Dev tooling: `npm run zip` and `npm run dev`.

### Version 1.6.0

- Major options and onboarding UI redesign; expanded altoCloud integration.
- Vocabulary save/open controls in the translation popup.
