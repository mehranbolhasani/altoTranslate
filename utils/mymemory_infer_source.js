// Heuristic source-language guess for MyMemory when user selects "auto"
// MyMemory does not support true auto-detect in langpair; we infer a plausible ISO code.
// Chrome Extension compatible — also exportable for Node tests.

/**
 * Infer a MyMemory-compatible source language code from text (script / rough signals).
 * @param {string} text - Text to analyze
 * @returns {string} Language code (always one of the codes MyMemory commonly accepts)
 */
function inferMyMemorySourceLanguage(text) {
  const t = (text || '').trim();
  if (!t) return 'en';

  // Persian uses Arabic script but has distinct letters (گ چ پ ژ)
  if (/[\u067E\u0686\u0698\u06AF]/.test(t)) return 'fa';
  // Arabic script (Arabic, Urdu, etc.) — default to ar when not clearly Persian
  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  // Cyrillic
  if (/[\u0400-\u04FF]/.test(t)) return 'ru';
  // Japanese (Hiragana/Katakana)
  if (/[\u3040-\u30ff]/.test(t)) return 'ja';
  // Korean Hangul
  if (/[\uac00-\ud7af]/.test(t)) return 'ko';
  // CJK unified (Chinese primary)
  if (/[\u4e00-\u9fff]/.test(t)) return 'zh';
  // Hebrew
  if (/[\u0590-\u05FF]/.test(t)) return 'he';
  // Devanagari (Hindi and related)
  if (/[\u0900-\u097F]/.test(t)) return 'hi';
  // Thai
  if (/[\u0E00-\u0E7F]/.test(t)) return 'th';

  // Latin script and unknown: conservative default
  return 'en';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { inferMyMemorySourceLanguage };
}
