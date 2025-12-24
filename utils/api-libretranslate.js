// LibreTranslate API integration module
// Uses MyMemory API as fallback - no API key required for basic usage
// Chrome Extension compatible - no CommonJS exports

// Import constants (must be loaded before this script)
// Assumes constants.js is loaded via importScripts before this file

// MYMEMORY_API_BASE is imported from utils/constants.js via importScripts

// Language code mapping for MyMemory API
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
 * Note: Function name uses "LibreTranslate" for consistency with user-facing naming
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
      api: 'mymemory'
    };
  }
  
  if (sourceLang && sourceLang !== 'auto' && !LIBRETRANSLATE_LANGUAGES[sourceLanguage]) {
    return {
      success: false,
      error: `Source language '${sourceLanguage}' is not supported by MyMemory API`,
      api: 'mymemory'
    };
  }
  
  try {
    // MyMemory API doesn't support 'auto' - try to detect language or use English as default
    let actualSourceLang = sourceLang;
    if (sourceLang === 'auto') {
      // For auto-detect, try to detect if it's English, otherwise use English as fallback
      // This is a simple heuristic - in a real app you might want more sophisticated detection
      const isLikelyEnglish = /^[a-zA-Z\s.,!?;:'"()-]+$/.test(text.trim());
      actualSourceLang = isLikelyEnglish ? 'en' : 'en'; // Default to English for now
    }
    
    const params = new URLSearchParams({
      q: text,
      langpair: `${actualSourceLang}|${targetLang}`
    });
    
    // Use getApiEndpoint if available, otherwise use MYMEMORY_API_BASE from constants.js
    const apiEndpoint = typeof getApiEndpoint === 'function' 
      ? getApiEndpoint('mymemory')
      : (typeof MYMEMORY_API_BASE !== 'undefined' ? MYMEMORY_API_BASE : 'https://api.mymemory.translated.net/get');
    
    const url = `${apiEndpoint}?${params.toString()}`;
    
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
    const translatedText = data?.responseData?.translatedText;
    
    if (!translatedText) {
      throw new Error('Invalid response format from MyMemory API');
    }
    
    return {
      success: true,
      translatedText,
      sourceLanguage: sourceLang === 'auto' ? 'auto' : sourceLang,
      targetLanguage: targetLang,
      api: 'mymemory',
      instance: 'MyMemory API'
    };
    
  } catch (error) {
    console.error('MyMemory API failed:', error);
    return {
      success: false,
      error: error?.message ?? 'MyMemory API is currently unavailable. Please try again later.',
      api: 'mymemory'
    };
  }
}
