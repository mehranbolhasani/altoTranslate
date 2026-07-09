# Alto Translate - Chrome Extension

A minimal and elegant Chrome extension for translating selected text using Google Gemini, DeepL, Microsoft Azure Translator, and MyMemory APIs.

## Features

- **Simple Text Selection**: Select any text on a webpage and click the "ax" icon to translate
- **Multiple API Support**: Choose MyMemory, Google Gemini, DeepL, Microsoft Azure Translator, or **smart fallback** (sequential: MyMemory-first for shorter text, then DeepL → Gemini → Azure; **long selections** flip to DeepL → Gemini first — see `SMART_FALLBACK_LLM_FIRST_MIN_CHARS` in `utils/constants.js`)
- **Auto Language Detection**: Automatically detects source language
- **50+ Languages**: Support for major world languages including RTL languages
- **Clean UI**: Minimal, non-intrusive popup design with Tailwind CSS
- **Dark Mode**: Automatic dark mode support
- **Copy to Clipboard**: Easy copying of translated text
- **Settings Page**: Comprehensive configuration options
- **Memory Optimized**: Zero memory leaks, optimized for long-running sessions
- **Security First**: Input validation, XSS protection, secure API key storage

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will be installed and ready to use

### From Chrome Web Store

*Coming soon - extension will be published to the Chrome Web Store*

## Setup

1. **Get API Keys** (Optional):
   - **Gemini API**: Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **DeepL API**: Get a free API key from [DeepL](https://www.deepl.com/en/your-account/keys)
   - **Microsoft Azure Translator**: Get a free key from the [Azure portal](https://portal.azure.com) (2M chars/month free)
   - **MyMemory API**: No API key required! Works out of the box.

2. **Configure Settings**:
   - Click the extension icon in your browser toolbar
   - Click "Settings" to open the configuration page
   - Enter your API keys (optional - MyMemory works without keys)
   - Choose your preferred translation service
   - Select target language

## Usage

1. **Select Text**: Highlight any text on a webpage
2. **Click Icon**: Click the "ax" icon that appears near your selection
3. **View Translation**: The translated text will appear in a popup
4. **Keyboard shortcut**: With text selected on a normal page (not typing in an input), press **Alt+A** to translate (same as the icon). Change the binding under `chrome://extensions/shortcuts` (new installs pick up the default; if yours still shows Alt+T from an older build, remap it once).
5. **Copy text**: Use the copy button in the popup.

## API Configuration

### Google Gemini
- High-quality translations with context awareness
- Free tier available with rate limits
- Auto language detection
- Supports romanization for non-Latin scripts
- Get API key: [Google AI Studio](https://makersuite.google.com/app/apikey)

### DeepL
- Best quality for European languages
- Free tier with character quota
- 30+ languages supported
- Get API key: [DeepL](https://www.deepl.com/en/your-account/keys)

### Microsoft Azure Translator
- 2 million free characters/month, no expiry
- 100+ languages supported
- Requires both an API key and Azure region
- Get API key: [Azure portal](https://portal.azure.com)

### MyMemory API (Recommended)
- **No API key required!**
- Free and unlimited
- Excellent for English to Persian translations
- Works out of the box
- Perfect fallback option

## Supported Languages

**Major Languages:**
- English (en), Spanish (es), French (fr), German (de)
- Italian (it), Portuguese (pt), Russian (ru), Chinese (zh)
- Japanese (ja), Korean (ko), Arabic (ar), Hindi (hi)

**European Languages:**
- Dutch (nl), Swedish (sv), Danish (da), Norwegian (no)
- Finnish (fi), Polish (pl), Turkish (tr), Greek (el)
- Czech (cs), Hungarian (hu), Romanian (ro), Bulgarian (bg)

**Asian Languages:**
- Thai (th), Vietnamese (vi), Indonesian (id), Malay (ms)
- Filipino (tl), Hebrew (he), Ukrainian (uk)

**RTL Languages (Right-to-Left):**
- Arabic (ar), Persian/Farsi (fa), Hebrew (he), Urdu (ur)

**Total: 50+ languages supported**

## File Structure

```
altoTranslate/
├── manifest.json              # Extension manifest
├── icons/                     # Extension icons (PNG + icon.svg — required sizes for Chrome Web Store)
│   ├── icon16.png / icon48.png / icon128.png
│   └── icon.svg
├── content/                   # Content script
│   ├── content.js            # Text selection and popup logic
│   └── content.css           # In-page popup styling (+ local @font-face fonts)
├── background/               # Background service worker
│   └── background.js         # API routing and message handling
├── popup/                    # Extension popup
│   ├── popup.html           # Popup interface
│   ├── popup.mjs            # Popup logic (ESM + Motion)
│   └── popup.css            # Popup styling
├── options/                  # Settings page
│   ├── options.html         # Settings interface
│   ├── options.mjs          # Settings logic (ESM + Motion)
│   └── options.css          # Settings styling
├── vocabulary/               # Vocabulary / review page
│   ├── vocabulary.html
│   ├── vocabulary.mjs       # Page logic (ESM + Motion)
│   └── vocabulary.css
├── vendor/                   # Vendored bundles (MV3 CSP)
│   └── motion-lib.js        # Built by `npm run build:motion`
├── scripts/
│   ├── build-motion.mjs     # esbuild wrapper
│   └── motion-export.mjs    # Motion re-exports
├── package.json
├── package-lock.json
└── utils/                   # Utility modules
│   ├── fonts/               # Bundled .woff2 (Estedad, Google Sans Flex latin subsets for content UI)
│   ├── tailwind.css         # Tailwind CSS utilities
│   ├── dark-mode.js         # Dark mode functionality
│   ├── storage.js           # Settings storage utilities
│   ├── mymemory_infer_source.js  # Source-language heuristic for MyMemory (auto)
│   ├── api-gemini.js        # Gemini API
│   ├── api-deepl.js         # DeepL API
│   ├── api-azure.js         # Microsoft Azure Translator API
│   └── api-libretranslate.js # MyMemory API
```

## Development

### Prerequisites
- Chrome browser
- Basic knowledge of JavaScript and Chrome extensions
- **Node.js 18+** (only if you rebuild the Motion bundle)

### Building
- The shipped extension includes [`vendor/motion-lib.js`](vendor/motion-lib.js). To regenerate it after upgrading the `motion` dependency: `npm ci` then `npm run build:motion`.
- Otherwise no build step is required for day-to-day editing of non-bundled scripts.

### Testing
1. Load the extension in developer mode
2. Test on various websites
3. Verify API key configuration
4. Test error handling scenarios

## Privacy & Security

- **Privacy policy page**: See [`privacy.html`](privacy.html) in this repository. Host it at a public HTTPS URL (for example GitHub Pages) and set that URL as the **Privacy practices** link in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) for Alto Translate.
- **API Keys**: Stored securely in Chrome's encrypted storage
- **No Data Collection**: Extension doesn't collect or store user data
- **Local Processing**: All translation requests go directly to chosen API services
- **No Tracking**: No analytics or tracking code included
- **Input Validation**: All user inputs are validated and sanitized
- **XSS Protection**: HTML content is properly escaped
- **Memory Safe**: Zero memory leaks, proper cleanup on page unload
- **CSP Compliant**: No inline scripts, secure content loading

## Troubleshooting

### Common Issues

1. **Icon doesn't appear**: 
   - Check if text is properly selected
   - Ensure extension is enabled
   - Try refreshing the page

2. **Translation fails**:
   - Verify API keys are correct
   - Check internet connection
   - Try switching to a different API

3. **Settings not saving**:
   - Check browser permissions
   - Try reloading the extension

### Error Messages

- **"No API keys configured"**: Set up your API keys in settings
- **"API key not configured"**: Add the required API key for your chosen service
- **"Translation failed"**: Check API key validity and internet connection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review the Chrome extension documentation

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for full release notes.

### Version 1.6.1 (current)

- **Google Sans Flex** typography across extension pages and the in-page translation bubble.
- Vocabulary page redesign: fade/blur reveal, unified review buttons, animations aligned with options.
- Fixed vocabulary page link from the translation popup (background `chrome.tabs.create`).
- Dev tooling: `npm run zip` and `npm run dev`.

### Version 1.6.0

- Major options and onboarding UI redesign; expanded Alto Cloud integration.
- Vocabulary save/open controls in the translation popup.

### Version 1.0.0

- Initial release
- Gemini, DeepL, Azure, and MyMemory API support
- Auto language detection
- 50+ language support including RTL languages
- Clean, minimal UI with Tailwind CSS
- Dark mode support
- Settings page with comprehensive options
- Copy to clipboard functionality
- Memory leak prevention and optimization
- Security enhancements (XSS protection, input validation)
- Mouse cursor positioning for better UX
- Zero-configuration option with MyMemory API