// Gemini API integration for translation

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Translate text using Gemini API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} apiKey - Gemini API key
 * @param {string} sourceLanguage - Source language code (optional, for auto-detect)
 * @returns {Promise<Object>} Translation result
 */
async function translateWithGemini(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  if (!text || !targetLanguage || !apiKey) {
    throw new Error('Missing required parameters for Gemini translation');
  }

  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = sourceLanguage === 'auto' ? 'auto-detect' : getLanguageName(sourceLanguage);

  const prompt = sourceLanguage === 'auto' 
    ? `Translate the following text to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`
    : `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 1000
    }
  };

  try {
    const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    const translatedText = data.candidates[0].content.parts[0].text.trim();
    
    return {
      success: true,
      translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage,
      api: 'gemini',
      usage: data.usageMetadata || null
    };

  } catch (error) {
    console.error('Gemini translation error:', error);
    return {
      success: false,
      error: error.message,
      api: 'gemini'
    };
  }
}

/**
 * Detect language using Gemini API
 * @param {string} text - Text to analyze
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Language detection result
 */
async function detectLanguageWithGemini(text, apiKey) {
  if (!text || !apiKey) {
    throw new Error('Missing required parameters for language detection');
  }

  const prompt = `Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., 'en', 'es', 'fr'):\n\n${text}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 10
    }
  };

  try {
    const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    const detectedLanguage = data.candidates[0].content.parts[0].text.trim().toLowerCase();
    
    return {
      success: true,
      detectedLanguage,
      confidence: 0.9, // Gemini doesn't provide confidence scores, so we use a default
      api: 'gemini'
    };

  } catch (error) {
    console.error('Gemini language detection error:', error);
    return {
      success: false,
      error: error.message,
      api: 'gemini'
    };
  }
}

/**
 * Get language name from code (helper function)
 * @param {string} code - Language code
 * @returns {string} Language name
 */
function getLanguageName(code) {
  const languageNames = {
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
    'hi': 'Hindi',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'pl': 'Polish',
    'tr': 'Turkish'
  };
  return languageNames[code] || code;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    translateWithGemini,
    detectLanguageWithGemini
  };
}
