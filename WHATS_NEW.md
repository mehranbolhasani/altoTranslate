# What's New — Alto Translate

## Version 1.6.1 (July 2026)

**Typography & vocabulary refresh**
- Switched to **Google Sans Flex** across extension pages and the in-page translation bubble.
- Redesigned the vocabulary page: cleaner layout, fade/blur card reveal, and unified review action buttons.
- Vocabulary animations now follow the same stagger pattern as the options page.

**Bug fix**
- Fixed opening the vocabulary page from the translation popup in browsers that block `window.open()` on extension URLs (e.g. Arc/Dia).

**Developer**
- Added `npm run zip` for Chrome Web Store packaging and `npm run dev` for live-reload during local development.

## Version 1.6.0 (June 2026)

**Major settings & onboarding redesign**
- Simplified and refreshed the options and onboarding pages with a cleaner layout and smoother animations.
- Expanded Alto Cloud integration and added vocabulary save/open controls to the translation popup.

## Version 1.5.1 (May 2026)

**Bug fix**
- Fixed the "Leave a review" link in the translation popup so it correctly opens this extension's Chrome Web Store page instead of a broken placeholder URL.

## Version 1.5.0 (May 2026)

**New onboarding experience**
- Added a 5-step first-run setup wizard that appears after install. It walks you through choosing your target language, picking a translation engine (Gemini, DeepL, Azure, MyMemory, or Alto Cloud), entering your API key, trying a live demo, and setting optional preferences. Skippable at any step.

## Version 1.4.0 (May 2026)

**Major UX & animation overhaul**
- Added a full **Vocabulary** page with daily review flashcards and an "All words" list.
- Added **Motion.dev** animations across the options, vocabulary, and onboarding pages (with `prefers-reduced-motion` support).
- Added **Smart Fallback** mode: automatically routes short text through MyMemory first, and long text through DeepL/Gemini/Azure first based on text length.
- Added phonetic romanization for non-Latin scripts (Chinese, Japanese, Arabic, etc.) when using Gemini.
- Added translation caching with LRU eviction and cache stats in settings.
- Added 9 popup color themes (Ocean, Sunset, Forest, Purple, Midnight, Rose, Amber, Slate).
- Added keyboard shortcut support (default: **Alt+A**) to translate the current selection.
- Added pin-to-page for the translation popup, so it stays open while you scroll or click elsewhere.
- Improved dark mode detection and auto-theming on websites.
