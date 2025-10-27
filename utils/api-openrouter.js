// OpenRouter API integration for translation

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Translate text using OpenRouter API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} apiKey - OpenRouter API key
 * @param {string} sourceLanguage - Source language code (optional, defaults to 'auto')
 * @returns {Promise<Object>} Translation result
 */
async function translateWithOpenRouter(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  if (!text || !targetLanguage || !apiKey) {
    throw new Error('Missing required parameters for OpenRouter translation');
  }

  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = sourceLanguage === 'auto' ? 'auto-detect' : getLanguageName(sourceLanguage);

  const prompt = sourceLanguage === 'auto' 
    ? `Translate the following text to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`
    : `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`;

  const requestBody = {
    model: 'google/gemma-3-4b-it:free', // Using Google Gemma free model through OpenRouter
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 1000
  };

  try {
    const response = await fetch(OPENROUTER_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://alto-translate-extension.com', // Optional: for analytics
        'X-Title': 'Alto Translate Extension' // Optional: for analytics
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter API');
    }

    const translatedText = data.choices[0].message.content.trim();
    
    return {
      success: true,
      translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage,
      api: 'openrouter',
      usage: data.usage || null
    };

  } catch (error) {
    console.error('OpenRouter translation error:', error);
    return {
      success: false,
      error: error.message,
      api: 'openrouter'
    };
  }
}

/**
 * Detect language using OpenRouter API
 * @param {string} text - Text to analyze
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Object>} Language detection result
 */
async function detectLanguageWithOpenRouter(text, apiKey) {
  if (!text || !apiKey) {
    throw new Error('Missing required parameters for language detection');
  }

  const prompt = `Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., 'en', 'es', 'fr'):\n\n${text}`;

  const requestBody = {
    model: 'google/gemma-3-4b-it:free',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 10
  };

  try {
    const response = await fetch(OPENROUTER_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://alto-translate-extension.com',
        'X-Title': 'Alto Translate Extension'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter API');
    }

    const detectedLanguage = data.choices[0].message.content.trim().toLowerCase();
    
    return {
      success: true,
      detectedLanguage,
      confidence: 0.9, // OpenRouter doesn't provide confidence scores, so we use a default
      api: 'openrouter'
    };

  } catch (error) {
    console.error('OpenRouter language detection error:', error);
    return {
      success: false,
      error: error.message,
      api: 'openrouter'
    };
  }
}

/**
 * Get supported languages from OpenRouter API
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Object>} Supported languages result
 */
async function getSupportedLanguagesFromOpenRouter(apiKey) {
  // OpenRouter supports many languages through its various models
  // Return a comprehensive list of supported languages
  const supportedLanguages = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'fa', 'hi', 'ur', 'bn', 'ta', 'te', 'ml', 'kn', 'gu', 'pa', 'mr', 'th', 'vi', 'id', 'ms', 'tl', 'he', 'uk', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr', 'sr', 'sl', 'et', 'lv', 'lt', 'el', 'is', 'mt', 'cy', 'ga', 'eu', 'ca', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'tr'
  ];
  
  return {
    success: true,
    languages: supportedLanguages,
    api: 'openrouter'
  };
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
  return languageNames[code] || code;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    translateWithOpenRouter,
    detectLanguageWithOpenRouter,
    getSupportedLanguagesFromOpenRouter
  };
}
