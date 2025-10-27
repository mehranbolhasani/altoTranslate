// Storage utility functions for Chrome extension settings

const DEFAULT_SETTINGS = {
  apiPreference: 'gemini', // 'gemini', 'openrouter', 'libretranslate', or 'both'
  geminiApiKey: '',
  openrouterApiKey: '',
  libretranslateEnabled: true, // LibreTranslate doesn't need API key
  sourceLanguage: 'auto',
  targetLanguage: 'en'
};

const SUPPORTED_LANGUAGES = {
  'auto': 'Auto-detect',
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
 * Get settings from Chrome storage
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result };
  } catch (error) {
    console.error('Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to Chrome storage
 * @param {Object} settings - Settings object to save
 * @returns {Promise<boolean>} Success status
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set(settings);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Get a specific setting value
 * @param {string} key - Setting key
 * @returns {Promise<any>} Setting value
 */
async function getSetting(key) {
  const settings = await getSettings();
  return settings[key];
}

/**
 * Set a specific setting value
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<boolean>} Success status
 */
async function setSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  return await saveSettings(settings);
}

/**
 * Clear all settings (reset to defaults)
 * @returns {Promise<boolean>} Success status
 */
async function clearSettings() {
  try {
    await chrome.storage.sync.clear();
    return true;
  } catch (error) {
    console.error('Error clearing settings:', error);
    return false;
  }
}

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @param {string} apiType - Type of API ('gemini' or 'openrouter')
 * @returns {boolean} Is valid
 */
function validateApiKey(apiKey, apiType) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  switch (apiType) {
    case 'gemini':
      // Gemini API keys typically start with 'AIza' and are 39 characters long
      return apiKey.startsWith('AIza') && apiKey.length === 39;
    case 'openrouter':
      // OpenRouter API key format - typically starts with 'sk-or-'
      return apiKey.startsWith('sk-or-') && apiKey.length > 20; // Placeholder validation
    case 'libretranslate':
      // LibreTranslate doesn't require API keys
      return true;
    default:
      return false;
  }
}

/**
 * Get language name from code
 * @param {string} code - Language code
 * @returns {string} Language name
 */
function getLanguageName(code) {
  return SUPPORTED_LANGUAGES[code] || code;
}

/**
 * Get all supported languages
 * @returns {Object} Language codes and names
 */
function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSettings,
    saveSettings,
    getSetting,
    setSetting,
    clearSettings,
    validateApiKey,
    getLanguageName,
    getSupportedLanguages,
    DEFAULT_SETTINGS,
    SUPPORTED_LANGUAGES
  };
}
