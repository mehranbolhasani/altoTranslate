// LibreTranslate API integration module
// Uses MyMemory API as fallback - no API key required for basic usage
// Chrome Extension compatible - no CommonJS exports

// Import constants (must be loaded before this script)
// Assumes constants.js and mymemory_infer_source.js are loaded via importScripts before this file

// MYMEMORY_API_BASE is imported from utils/constants.js via importScripts
// inferMyMemorySourceLanguage from utils/mymemory_infer_source.js

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
 * Whether MyMemory can handle this direction (used by smart fallback to skip a doomed first hop).
 * @param {string} sourceLanguage
 * @param {string} targetLanguage
 */
function myMemorySupportsLanguagePair(sourceLanguage, targetLanguage) {
  if (!MYMEMORY_SUPPORTED_LANGUAGES.has(targetLanguage)) return false;
  if (sourceLanguage !== 'auto' && !MYMEMORY_SUPPORTED_LANGUAGES.has(sourceLanguage)) return false;
  return true;
}

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

  const targetLang = targetLanguage;
  let actualSourceLang;
  let sourceInferred = false;

  if (sourceLanguage === 'auto') {
    sourceInferred = true;
    let guessed =
      typeof inferMyMemorySourceLanguage === 'function'
        ? inferMyMemorySourceLanguage(text)
        : 'en';
    if (!MYMEMORY_SUPPORTED_LANGUAGES.has(guessed)) {
      guessed = 'en';
    }
    actualSourceLang = guessed;
  } else {
    actualSourceLang = sourceLanguage;
  }

  try {
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
      sourceLanguage: sourceInferred ? 'auto' : sourceLanguage,
      sourceLanguageUsed: actualSourceLang,
      sourceInferred,
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
