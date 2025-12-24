// Centralized language mappings and utilities
// Chrome Extension compatible - no CommonJS exports

/**
 * Language name mapping - single source of truth
 * @type {Object<string, string>}
 */
const LANGUAGE_NAMES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'fa': 'Persian/Farsi',
  'hi': 'Hindi',
  'ur': 'Urdu',
  'bn': 'Bengali',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ml': 'Malayalam',
  'kn': 'Kannada',
  'gu': 'Gujarati',
  'pa': 'Punjabi',
  'mr': 'Marathi',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'id': 'Indonesian',
  'ms': 'Malay',
  'tl': 'Filipino',
  'he': 'Hebrew',
  'uk': 'Ukrainian',
  'cs': 'Czech',
  'sk': 'Slovak',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sr': 'Serbian',
  'sl': 'Slovenian',
  'et': 'Estonian',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'el': 'Greek',
  'is': 'Icelandic',
  'mt': 'Maltese',
  'cy': 'Welsh',
  'ga': 'Irish',
  'eu': 'Basque',
  'ca': 'Catalan',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'da': 'Danish',
  'no': 'Norwegian',
  'fi': 'Finnish',
  'pl': 'Polish',
  'tr': 'Turkish'
};

/**
 * Right-to-left (RTL) languages
 * @type {string[]}
 */
const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur'];

/**
 * Get language name from code
 * @param {string} code - Language code
 * @returns {string} Language name
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] ?? code;
}

/**
 * Check if a language is RTL (Right-to-Left)
 * @param {string} languageCode - Language code
 * @returns {boolean} True if language is RTL
 */
function isRTLLanguage(languageCode) {
  return RTL_LANGUAGES.includes(languageCode);
}

/**
 * Get all supported language codes
 * @returns {string[]} Array of language codes
 */
function getSupportedLanguageCodes() {
  return Object.keys(LANGUAGE_NAMES);
}

/**
 * Get all supported languages as an object
 * @returns {Object<string, string>} Language codes and names
 */
function getSupportedLanguages() {
  return { ...LANGUAGE_NAMES };
}

