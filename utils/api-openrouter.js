// OpenRouter API integration for translation
// Chrome Extension compatible - no CommonJS exports

// Import language utilities and constants (must be loaded before this script)
// Assumes languages.js and constants.js are loaded via importScripts before this file

// OPENROUTER_API_BASE and OPENROUTER_MODEL are imported from utils/constants.js via importScripts
// getLanguageName is imported from utils/languages.js via importScripts

// getLanguageName is imported from utils/languages.js via importScripts

/**
 * Translate text using OpenRouter API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} apiKey - OpenRouter API key
 * @param {string} sourceLanguage - Source language code (optional, defaults to 'auto')
 * @returns {Promise<Object>} Translation result
 */
async function translateWithOpenRouter(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = sourceLanguage === 'auto' ? 'auto-detect' : getLanguageName(sourceLanguage);

  const prompt = sourceLanguage === 'auto' 
    ? `Translate the following text to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`
    : `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`;

  // Use OPENROUTER_MODEL from constants.js if available
  const model = typeof OPENROUTER_MODEL !== 'undefined' ? OPENROUTER_MODEL : 'google/gemma-3-4b-it:free';
  
  const requestBody = {
    model: model, // Using Google Gemma free model through OpenRouter
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
    // Use getApiEndpoint if available, otherwise use OPENROUTER_API_BASE from constants.js
    const apiEndpoint = typeof getApiEndpoint === 'function' 
      ? getApiEndpoint('openrouter')
      : (typeof OPENROUTER_API_BASE !== 'undefined' ? OPENROUTER_API_BASE : 'https://openrouter.ai/api/v1/chat/completions');
    
    const response = await fetch(apiEndpoint, {
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
      const statusMessages = {
        400: ' (Check your API key and request format)',
        401: ' (Invalid API key)',
        403: ' (API key may be invalid or restricted)',
        429: ' (Rate limit exceeded or insufficient credits)'
      };
      
      const errorMessage = `OpenRouter API error: ${response.status} - ${errorData?.error?.message ?? response.statusText}${statusMessages[response.status] ?? ''}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    
    if (!message?.content) {
      throw new Error('Invalid response format from OpenRouter API');
    }

    const translatedText = message.content.trim();
    
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
      error: error?.message ?? 'OpenRouter translation failed',
      api: 'openrouter'
    };
  }
}
