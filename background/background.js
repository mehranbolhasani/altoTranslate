// Background service worker for Chrome extension

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

/**
 * Development hot reload shortcut (Ctrl+Shift+R)
 */
if (typeof chrome !== 'undefined' && chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'reload-extension') {
      chrome.runtime.reload();
    }
  });
}

/**
 * Handle translation requests from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getSettings') {
    handleGetSettings(sendResponse);
    return true;
  }
  
  if (request.action === 'saveSettings') {
    handleSaveSettings(request.settings, sendResponse);
    return true;
  }
  
  if (request.action === 'openSettings') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'validateApiKey') {
    handleValidateApiKey(request, sendResponse);
    return true;
  }
});

/**
 * Handle translation request
 * @param {Object} request - Translation request
 * @param {Function} sendResponse - Response callback
 */
async function handleTranslation(request, sendResponse) {
  try {
    const { text, targetLanguage, sourceLanguage } = request;
    
    // Input validation and sanitization
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      sendResponse({
        success: false,
        error: 'Invalid text input'
      });
      return;
    }
    
    if (!targetLanguage || typeof targetLanguage !== 'string') {
      sendResponse({
        success: false,
        error: 'Invalid target language'
      });
      return;
    }
    
    // Limit text length to prevent abuse
    if (text.length > 5000) {
      sendResponse({
        success: false,
        error: 'Text too long. Please select text with less than 5000 characters.'
      });
      return;
    }
    
    // Sanitize text (remove potentially harmful content)
    const sanitizedText = text.trim().substring(0, 5000);

    // Get settings from storage
    const settings = await getSettings();
    
    if (!settings.geminiApiKey && !settings.openrouterApiKey && !settings.libretranslateEnabled) {
      sendResponse({
        success: false,
        error: 'No translation services configured. Please set up your API keys or enable LibreTranslate in the extension settings.'
      });
      return;
    }

    let result;
    
    // Route to appropriate API based on user preference
    switch (settings.apiPreference) {
      case 'gemini':
        if (!settings.geminiApiKey) {
          sendResponse({
            success: false,
            error: 'Gemini API key not configured'
          });
          return;
        }
        result = await translateWithGemini(sanitizedText, targetLanguage, settings.geminiApiKey, sourceLanguage);
        break;
        
      case 'openrouter':
        if (!settings.openrouterApiKey) {
          sendResponse({
            success: false,
            error: 'OpenRouter API key not configured'
          });
          return;
        }
        result = await translateWithOpenRouter(sanitizedText, targetLanguage, settings.openrouterApiKey, sourceLanguage);
        break;
        
      case 'libretranslate':
        if (!settings.libretranslateEnabled) {
          sendResponse({
            success: false,
            error: 'LibreTranslate is not enabled'
          });
          return;
        }
        result = await translateWithLibreTranslate(sanitizedText, targetLanguage, sourceLanguage);
        break;
        
      case 'both':
        // Try all available APIs, use the first successful result
        result = await translateWithAll(sanitizedText, targetLanguage, sourceLanguage, settings);
        break;
        
      default:
        sendResponse({
          success: false,
          error: 'Invalid API preference setting'
        });
        return;
    }

    sendResponse(result);
    
  } catch (error) {
    console.error('Translation error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Unknown translation error'
    });
  }
}

/**
 * Translate using all available APIs and return the first successful result
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language
 * @param {string} sourceLanguage - Source language
 * @param {Object} settings - User settings
 * @returns {Promise<Object>} Translation result
 */
async function translateWithAll(text, targetLanguage, sourceLanguage, settings) {
  const promises = [];
  
  if (settings.geminiApiKey) {
    promises.push(translateWithGemini(text, targetLanguage, settings.geminiApiKey, sourceLanguage));
  }
  
  if (settings.openrouterApiKey) {
    promises.push(translateWithOpenRouter(text, targetLanguage, settings.openrouterApiKey, sourceLanguage));
  }
  
  if (settings.libretranslateEnabled) {
    promises.push(translateWithLibreTranslate(text, targetLanguage, sourceLanguage));
  }
  
  if (promises.length === 0) {
    return {
      success: false,
      error: 'No translation services configured'
    };
  }
  
  try {
    // Use Promise.race to get the first successful result
    const results = await Promise.allSettled(promises);
    
    // Find the first successful result
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        return result.value;
      }
    }
    
    // If no successful results, return the first error
    const firstError = results.find(r => r.status === 'fulfilled' && !r.value.success);
    if (firstError) {
      return firstError.value;
    }
    
    return {
      success: false,
      error: 'All translation services failed'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Translation failed'
    };
  }
}

/**
 * Handle get settings request
 * @param {Function} sendResponse - Response callback
 */
async function handleGetSettings(sendResponse) {
  try {
    const settings = await getSettings();
    sendResponse({
      success: true,
      settings
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle save settings request
 * @param {Object} settings - Settings to save
 * @param {Function} sendResponse - Response callback
 */
async function handleSaveSettings(settings, sendResponse) {
  try {
    const success = await saveSettings(settings);
    sendResponse({
      success,
      error: success ? null : 'Failed to save settings'
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get settings from Chrome storage
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
  const DEFAULT_SETTINGS = {
    apiPreference: 'gemini',
    geminiApiKey: '',
    openrouterApiKey: '',
    libretranslateEnabled: true,
    sourceLanguage: 'auto',
    targetLanguage: 'en'
  };
  
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
 * Translate text using Gemini API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} apiKey - Gemini API key
 * @param {string} sourceLanguage - Source language code
 * @returns {Promise<Object>} Translation result
 */
async function translateWithGemini(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  // Try different model names for free tier compatibility
  const models = [
    'gemini-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp'
  ];
  
  for (const model of models) {
    try {
      const result = await tryTranslateWithModel(text, targetLanguage, apiKey, sourceLanguage, model);
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.log(`Model ${model} failed:`, error.message);
      continue;
    }
  }
  
  throw new Error('All Gemini models failed. Please check your API key and try again.');
}

async function tryTranslateWithModel(text, targetLanguage, apiKey, sourceLanguage, model) {
  const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
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

  const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let errorMessage = `Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`;
    
    // Add specific error messages for common issues
    if (response.status === 400) {
      errorMessage += ' (Check your API key and request format)';
    } else if (response.status === 403) {
      errorMessage += ' (API key may be invalid or restricted)';
    } else if (response.status === 404) {
      errorMessage += ' (Model not found - check API version)';
    }
    
    throw new Error(errorMessage);
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
}

/**
 * Translate text using OpenRouter API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} apiKey - OpenRouter API key
 * @param {string} sourceLanguage - Source language code
 * @returns {Promise<Object>} Translation result
 */
async function translateWithOpenRouter(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1/chat/completions';
  
  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = sourceLanguage === 'auto' ? 'auto-detect' : getLanguageName(sourceLanguage);

  const prompt = sourceLanguage === 'auto' 
    ? `Translate the following text to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`
    : `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`;

  const requestBody = {
    model: 'google/gemma-3-4b-it:free', // Using OpenAI OSS free model through OpenRouter
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
      let errorMessage = `OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`;
      
      // Add specific error messages for common issues
      if (response.status === 400) {
        errorMessage += ' (Check your API key and request format)';
      } else if (response.status === 401) {
        errorMessage += ' (Invalid API key)';
      } else if (response.status === 403) {
        errorMessage += ' (API key may be invalid or restricted)';
      } else if (response.status === 429) {
        errorMessage += ' (Rate limit exceeded or insufficient credits)';
      }
      
      throw new Error(errorMessage);
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
 * Translate text using MyMemory API (LibreTranslate fallback)
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} sourceLanguage - Source language code
 * @returns {Promise<Object>} Translation result
 */
async function translateWithLibreTranslate(text, targetLanguage, sourceLanguage = 'auto') {
  // MyMemory API endpoint (free, no API key required)
  const MYMEMORY_API_BASE = 'https://api.mymemory.translated.net/get';
  
  // Language code mapping for MyMemory API
  const MYMEMORY_LANGUAGES = {
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
  
  // Convert language codes to MyMemory format
  const sourceLang = sourceLanguage === 'auto' ? 'auto' : MYMEMORY_LANGUAGES[sourceLanguage];
  const targetLang = MYMEMORY_LANGUAGES[targetLanguage];
  
  if (!targetLang) {
    return {
      success: false,
      error: `Target language '${targetLanguage}' is not supported by MyMemory API`,
      api: 'mymemory'
    };
  }
  
  if (sourceLang && sourceLang !== 'auto' && !MYMEMORY_LANGUAGES[sourceLanguage]) {
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
      api: 'mymemory',
      instance: 'MyMemory API'
    };
    
  } catch (error) {
    console.error('MyMemory API failed:', error);
    return {
      success: false,
      error: 'MyMemory API is currently unavailable. Please try again later.',
      api: 'mymemory'
    };
  }
}

/**
 * Get language name from code
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

/**
 * Handle API key validation request
 * @param {Object} request - Validation request
 * @param {Function} sendResponse - Response callback
 */
async function handleValidateApiKey(request, sendResponse) {
  try {
    const { apiKey, apiType } = request;
    
    // Only check for API key if it's required (not for LibreTranslate/MyMemory API)
    if (!apiKey && apiType !== 'libretranslate') {
      sendResponse({
        success: false,
        error: 'No API key provided'
      });
      return;
    }

    if (apiType === 'gemini') {
      // Test with different models to find one that works
      const models = [
        'gemini-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp'
      ];
      
      for (const model of models) {
        try {
          const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: 'Hello'
                }]
              }]
            })
          });

          if (testResponse.ok) {
            sendResponse({
              success: true,
              message: `API key is valid (using ${model})`
            });
            return;
          }
        } catch (error) {
          continue;
        }
      }
      
      sendResponse({
        success: false,
        error: 'API key validation failed: No compatible models found. Please check your API key and ensure you have access to Gemini API.'
      });
    } else if (apiType === 'openrouter') {
      // Test OpenRouter API
      try {
        const testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://alto-translate-extension.com',
            'X-Title': 'Alto Translate Extension'
          },
          body: JSON.stringify({
            model: 'google/gemma-3-4b-it:free',
            messages: [
              {
                role: 'user',
                content: 'Hello'
              }
            ],
            max_tokens: 10
          })
        });

        if (testResponse.ok) {
          sendResponse({
            success: true,
            message: 'OpenRouter API key is valid'
          });
        } else {
          const errorData = await testResponse.json().catch(() => ({}));
          let errorMessage = `OpenRouter API key validation failed: ${testResponse.status} - ${errorData.error?.message || testResponse.statusText}`;
          
          // Add helpful error messages
          if (testResponse.status === 401) {
            errorMessage += '\n\nPossible solutions:\n1. Check if your API key is correct\n2. Ensure you have credits in your OpenRouter account\n3. Verify your API key has the necessary permissions\n4. Check if your account is active';
          } else if (testResponse.status === 403) {
            errorMessage += '\n\nYour API key may not have permission to access OpenRouter services. Please check your account permissions.';
          } else if (testResponse.status === 429) {
            errorMessage += '\n\nRate limit exceeded or insufficient credits. Please check your account balance and usage limits.';
          }
          
          sendResponse({
            success: false,
            error: errorMessage
          });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: `OpenRouter API key validation failed: ${error.message}\n\nPlease check:\n1. Your internet connection\n2. API key format\n3. OpenRouter account status`
        });
      }
    } else if (apiType === 'libretranslate') {
      // MyMemory API doesn't require API keys, just test connectivity
      try {
        const testResult = await translateWithLibreTranslate('Hello', 'es', 'en');
        
        if (testResult.success) {
          sendResponse({
            success: true,
            message: 'MyMemory API is available and working'
          });
        } else {
          sendResponse({
            success: false,
            error: `MyMemory API test failed: ${testResult.error}`
          });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: `MyMemory API connectivity test failed: ${error.message}`
        });
      }
    } else {
      sendResponse({
        success: false,
        error: 'Unsupported API type for validation'
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message || 'API key validation failed'
    });
  }
}
