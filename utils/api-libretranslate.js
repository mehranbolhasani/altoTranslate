// LibreTranslate API integration module
// Uses MyMemory API as fallback - no API key required for basic usage
// Chrome Extension compatible - no CommonJS exports

// Import constants (must be loaded before this script)
// Assumes constants.js is loaded via importScripts before this file

// MYMEMORY_API_BASE is imported from utils/constants.js via importScripts

// Language codes supported by the MyMemory API
const MYMEMORY_SUPPORTED_LANGUAGES = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
  'ar', 'fa', 'hi', 'ur', 'bn', 'ta', 'te', 'ml', 'kn', 'gu',
  'pa', 'mr', 'th', 'vi', 'id', 'ms', 'tl', 'he', 'uk', 'cs',
  'sk', 'hu', 'ro', 'bg', 'hr', 'sr', 'sl', 'et', 'lv', 'lt',
  'el', 'is', 'mt', 'cy', 'ga', 'eu', 'ca', 'nl', 'sv', 'da',
  'no', 'fi', 'pl', 'tr'
]);

/**
 * Translate text using MyMemory API (free, no API key required)
 * Note: Function name uses "LibreTranslate" for consistency with user-facing naming
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} sourceLanguage - Source language code (optional, auto-detect if not provided)
 * @returns {Promise<Object>} Translation result
 */
async function translateWithLibreTranslate(text, targetLanguage, sourceLanguage = 'auto') {
  if (!MYMEMORY_SUPPORTED_LANGUAGES.has(targetLanguage)) {
    return {
      success: false,
      error: `Target language '${targetLanguage}' is not supported by MyMemory API`,
      api: 'mymemory'
    };
  }

  if (sourceLanguage !== 'auto' && !MYMEMORY_SUPPORTED_LANGUAGES.has(sourceLanguage)) {
    return {
      success: false,
      error: `Source language '${sourceLanguage}' is not supported by MyMemory API`,
      api: 'mymemory'
    };
  }

  const sourceLang = sourceLanguage === 'auto' ? 'auto' : sourceLanguage;
  const targetLang = targetLanguage;
  
  try {
    // MyMemory requires an explicit source language — it does not support 'auto'.
    // Heuristic: text containing only printable ASCII (0x20-0x7E) is assumed English;
    // non-ASCII text (CJK, Arabic, Cyrillic, etc.) defaults to Chinese as best-effort.
    // Users needing accurate source detection should set it explicitly in settings.
    let actualSourceLang = sourceLang;
    if (sourceLang === 'auto') {
      const isLikelyLatin = /^[\x20-\x7E]+$/.test(text.trim());
      actualSourceLang = isLikelyLatin ? 'en' : 'zh';
    }
    
    const params = new URLSearchParams({
      q: text,
      langpair: `${actualSourceLang}|${targetLang}`
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
