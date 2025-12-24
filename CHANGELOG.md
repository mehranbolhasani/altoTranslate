# Changelog

All notable changes to Alto Translate will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2024-12-XX

### Removed
- **Unused Permission**: Removed `activeTab` permission from manifest.json
  - Extension uses content scripts declared in manifest, which don't require `activeTab`
  - Addresses Chrome Web Store policy violation for requesting unused permissions
  - Reduces permission footprint and improves user trust

## [1.1.0] - 2024-12-18

### Added
- **Dynamic Model Discovery**: Gemini API now automatically discovers available models
  - Queries API to get list of available models for your API key
  - Caches model list for 24 hours to minimize API calls
  - Automatically uses correct API version (v1 or v1beta)
  - Falls back gracefully if model discovery fails
- **Input Field Control**: Option to disable translation popup for input fields and textareas
  - New setting in Languages tab: "Disable for input fields"
  - Prevents translation popup from appearing when selecting text in forms
  - Improves user experience when filling out forms
- **Failed Model Cache**: Remembers models that consistently fail (404 errors)
  - Avoids retrying unavailable models
  - Reduces unnecessary API calls and quota usage
  - Automatically clears cache after 24 hours

### Changed
- **Gemini Model Handling**: Improved model selection and error handling
  - Prioritizes stable models over experimental ones
  - Better handling of quota errors (429)
  - Skips deprecated models automatically (404 errors)
  - Tries multiple API versions (v1 and v1beta) for compatibility
- **Quota Optimization**: Reduced unnecessary API calls
  - Model discovery cache increased from 1 hour to 24 hours
  - Failed models are cached to avoid retries
  - Smarter fallback logic

### Fixed
- **Model Availability**: Fixed 404 errors for unavailable Gemini models
- **Quota Usage**: Reduced quota consumption by avoiding unavailable models
- **Input Field Detection**: Fixed translation popup appearing in input fields when disabled
- **Settings Loading**: Fixed issue where `disableInputFields` setting wasn't loaded correctly

### Removed
- **Development Commands**: Removed reload-extension keyboard shortcut from production build
- **Debug Logging**: Removed all console.log statements from production code

## [1.1.0] - 2024-12-08

### Added
- **Theme Customization System**: Added 9 predefined color themes for the translation popup
  - Default, Ocean, Sunset, Forest, Purple, Midnight, Rose, Amber, and Slate themes
  - Visual theme selector in options page with color palette previews
  - Theme persistence across sessions
  - Dynamic theme application via CSS variables
- **Tab-based Options Page**: Restructured settings page with organized tabs
  - API Settings tab (API selection and keys)
  - Theme tab (popup theme customization)
  - Languages tab (source/target language settings)
  - Cache tab (cache statistics and management)
  - Test tab (translation testing)
- **Toast Notification System**: Replaced status messages with modern toast notifications
  - Fixed top-right positioning
  - Stacking support for multiple toasts
  - Smooth slide-in/out animations
  - Color-coded by type (success, error, warning, info)
  - Auto-dismiss after 5 seconds
  - Manual close button
  - Dark mode support
- **Webpage Theme Detection**: Smart detection of webpage's actual theme
  - Detects dark/light mode based on webpage's background colors
  - Checks for common dark mode classes (`dark`, `dark-mode`, etc.)
  - Analyzes background color brightness
  - Checks data attributes
  - Falls back to system preference if unclear
  - Automatically matches popup theme to webpage theme
- **Grid Column Utilities**: Added comprehensive grid column utilities to Tailwind CSS
  - Base utilities: `grid-cols-1` through `grid-cols-12`
  - Responsive utilities: `sm:grid-cols-*`, `md:grid-cols-*`, `lg:grid-cols-*`
  - Supports responsive theme selector layout

### Changed
- **Options Page Layout**: Complete restructure with tab-based navigation
  - Improved organization and user experience
  - Better visual hierarchy
  - Easier navigation between settings sections
- **Theme System**: Switched from media query-based dark mode to class-based system
  - More flexible and controllable
  - Works with webpage theme detection
  - Better performance

### Removed
- **Console Logging**: Removed all `console.log` statements from production code
  - Cleaner codebase
  - Better performance
  - Professional code quality
  - Note: `console.error` statements retained for error handling

### Fixed
- **Theme Detection**: Fixed issue where popup would use system dark mode even when webpage was light
- **Grid Layout**: Fixed missing grid column utilities causing layout issues

## [1.0.0] - Initial Release

### Added
- Core translation functionality with text selection
- Support for Google Gemini, OpenRouter, and MyMemory APIs
- Auto language detection
- 50+ language support including RTL languages
- Extension popup and options page
- Dark mode support
- Cache system with LRU eviction
- Copy to clipboard functionality
- Comprehensive error handling
- Security features (XSS protection, input validation)

