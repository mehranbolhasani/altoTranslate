# Changelog

All notable changes to Alto Translate will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

