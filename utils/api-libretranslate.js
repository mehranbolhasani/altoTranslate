// LibreTranslate API integration module
// Uses MyMemory API as fallback - no API key required for basic usage

// MyMemory API endpoint (free, no API key required)
const MYMEMORY_API_BASE = 'https://api.mymemory.translated.net/get';

// Language code mapping for LibreTranslate
const LIBRETRANSLATE_LANGUAGES = {
  'en': 'en',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'pt': 'pt',
  'ru': 'ru',
  'zh': 'zh',
  'ja': 'ja',
  'ko': 'ko',
  'ar': 'ar',
  'fa': 'fa',
  'hi': 'hi',
  'ur': 'ur',
  'bn': 'bn',
  'ta': 'ta',
  'te': 'te',
  'ml': 'ml',
  'kn': 'kn',
  'gu': 'gu',
  'pa': 'pa',
  'mr': 'mr',
  'th': 'th',
  'vi': 'vi',
  'id': 'id',
  'ms': 'ms',
  'tl': 'tl',
  'he': 'he',
  'uk': 'uk',
  'cs': 'cs',
  'sk': 'sk',
  'hu': 'hu',
  'ro': 'ro',
  'bg': 'bg',
  'hr': 'hr',
  'sr': 'sr',
  'sl': 'sl',
  'et': 'et',
  'lv': 'lv',
  'lt': 'lt',
  'el': 'el',
  'is': 'is',
  'mt': 'mt',
  'cy': 'cy',
  'ga': 'ga',
  'eu': 'eu',
  'ca': 'ca',
  'nl': 'nl',
  'sv': 'sv',
  'da': 'da',
  'no': 'no',
  'fi': 'fi',
  'pl': 'pl',
  'tr': 'tr'
};

/**
 * Translate text using MyMemory API (free, no API key required)
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} sourceLanguage - Source language code (optional, auto-detect if not provided)
 * @returns {Promise<Object>} Translation result
 */
async function translateWithLibreTranslate(text, targetLanguage, sourceLanguage = 'auto') {
  // Convert language codes to MyMemory format
  const sourceLang = sourceLanguage === 'auto' ? 'auto' : LIBRETRANSLATE_LANGUAGES[sourceLanguage];
  const targetLang = LIBRETRANSLATE_LANGUAGES[targetLanguage];
  
  if (!targetLang) {
    return {
      success: false,
      error: `Target language '${targetLanguage}' is not supported by MyMemory API`,
      api: 'libretranslate'
    };
  }
  
  if (sourceLang && sourceLang !== 'auto' && !LIBRETRANSLATE_LANGUAGES[sourceLanguage]) {
    return {
      success: false,
      error: `Source language '${sourceLanguage}' is not supported by MyMemory API`,
      api: 'libretranslate'
    };
  }
  
  try {
    const result = await tryTranslateWithMyMemory(text, targetLang, sourceLang);
    return result;
  } catch (error) {
    console.error('MyMemory API failed:', error);
    return {
      success: false,
      error: 'MyMemory API is currently unavailable. Please try again later.',
      api: 'libretranslate'
    };
  }
}

/**
 * Try to translate with MyMemory API
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @param {string} sourceLang - Source language code
 * @returns {Promise<Object>} Translation result
 */
async function tryTranslateWithMyMemory(text, targetLang, sourceLang) {
  // MyMemory API uses GET requests with query parameters
  const params = new URLSearchParams({
    q: text,
    langpair: sourceLang === 'auto' ? `auto|${targetLang}` : `${sourceLang}|${targetLang}`
  });
  
  const url = `${MYMEMORY_API_BASE}?${params.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'AltoTranslate-Extension/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.responseData || !data.responseData.translatedText) {
    throw new Error('Invalid response format from MyMemory API');
  }
  
  return {
    success: true,
    translatedText: data.responseData.translatedText,
    sourceLanguage: sourceLang === 'auto' ? 'auto' : sourceLang,
    targetLanguage: targetLang,
    api: 'libretranslate',
    instance: 'MyMemory API'
  };
}

/**
 * Get supported languages from MyMemory API
 * @returns {Promise<Array>} Array of supported languages
 */
async function getSupportedLanguagesFromLibreTranslate() {
  // MyMemory API supports a wide range of languages
  // Return the languages we have mapped
  return Object.entries(LIBRETRANSLATE_LANGUAGES).map(([code, name]) => ({
    code: code,
    name: name
  }));
}

/**
 * Detect language using MyMemory API (not directly supported, return auto)
 * @param {string} text - Text to detect language for
 * @returns {Promise<Object>} Language detection result
 */
async function detectLanguageWithLibreTranslate(text) {
  // MyMemory API doesn't have a direct language detection endpoint
  // Return auto-detect as the source language
  return {
    success: true,
    language: 'auto',
    confidence: 0.5
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    translateWithLibreTranslate,
    getSupportedLanguagesFromLibreTranslate,
    detectLanguageWithLibreTranslate,
    LIBRETRANSLATE_LANGUAGES
  };
}
