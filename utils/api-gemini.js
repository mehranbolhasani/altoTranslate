// Gemini API integration for translation
// Chrome Extension compatible - no CommonJS exports

// Import language utilities (must be loaded before this script)
// Assumes languages.js and constants.js are loaded via importScripts before this file

// GEMINI_MODELS is imported from utils/constants.js via importScripts
// getLanguageName is imported from utils/languages.js via importScripts

/**
 * Cache for available models (per API key)
 * Structure: { apiKey: { models: [...], apiVersion: string, timestamp: number } }
 */
const availableModelsCache = {};

/**
 * Cache for failed models to avoid retrying them (per API key)
 * Structure: { apiKey: { failedModels: Set<string>, timestamp: number } }
 */
const failedModelsCache = {};

/**
 * Cache TTL for failed models (24 hours - models don't become available quickly)
 */
const FAILED_MODELS_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Cache TTL for available models (24 hours to minimize API calls)
 * Models don't change frequently, so longer cache is safe
 */
const MODELS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get list of available Gemini models from API
 * Only calls API if cache is expired to minimize API usage
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{models: string[], apiVersion: string}>} Object with available models and API version
 */
async function getAvailableGeminiModels(apiKey) {
  // Check cache first - use longer TTL to reduce API calls
  const cacheKey = apiKey.substring(0, 10); // Use first 10 chars as cache key
  const cached = availableModelsCache[cacheKey];
  if (cached && (Date.now() - cached.timestamp) < MODELS_CACHE_TTL) {
    return { models: cached.models, apiVersion: cached.apiVersion };
  }

  // Try to get available models, but don't fail if API call doesn't work
  // This prevents wasting quota on model discovery
  const apiVersions = ['v1beta', 'v1'];
  let availableModels = [];
  let workingApiVersion = null;

  for (const apiVersion of apiVersions) {
    try {
      const listUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`;
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.models && Array.isArray(data.models)) {
          // Filter models that support generateContent
          // Prioritize newer stable models
          availableModels = data.models
            .filter(model => 
              model.supportedGenerationMethods && 
              model.supportedGenerationMethods.includes('generateContent')
            )
            .map(model => model.name.replace('models/', ''))
            .filter(model => 
              // Prioritize stable models - avoid experimental unless necessary
              model.includes('gemini-1.5-flash') || 
              model.includes('gemini-1.5-pro') ||
              model.includes('gemini-2.0-flash') ||
              model.includes('gemini-2.5-flash') ||
              model.includes('gemini-3-flash')
            )
            .sort((a, b) => {
              // Sort: stable models first, then by version (newer first)
              const aIsExp = a.includes('exp') || a.includes('experimental');
              const bIsExp = b.includes('exp') || b.includes('experimental');
              if (aIsExp !== bIsExp) return aIsExp ? 1 : -1;
              return b.localeCompare(a); // Newer versions first
            });
          
          if (availableModels.length > 0) {
            workingApiVersion = apiVersion;
            // Cache the results for 1 hour
            availableModelsCache[cacheKey] = {
              models: availableModels,
              apiVersion: apiVersion,
              timestamp: Date.now()
            };
            return { models: availableModels, apiVersion: apiVersion };
          }
        }
      } else if (response.status === 403 || response.status === 401) {
        // API key issue - don't retry other versions
        break;
      }
    } catch (error) {
      // Try next API version
      continue;
    }
  }

  // If API call fails or returns no models, use a smart fallback
  // Try models that are most likely to work based on common availability
  console.warn('Could not fetch available models from API, using smart fallback models');
  const fallbackModels = [
    'gemini-1.5-flash',  // Most commonly available
    'gemini-1.5-pro',    // Widely available
    'gemini-2.0-flash-exp' // Experimental as last resort
  ];
  
  // Cache the fallback to avoid repeated API calls
  availableModelsCache[cacheKey] = {
    models: fallbackModels,
    apiVersion: 'v1beta',
    timestamp: Date.now()
  };
  
  return { models: fallbackModels, apiVersion: 'v1beta' };
}

/**
 * Translate text using Gemini API
 * Tries multiple models in order until one succeeds
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} apiKey - Gemini API key
 * @param {string} sourceLanguage - Source language code (optional, for auto-detect)
 * @returns {Promise<Object>} Translation result
 */
async function translateWithGemini(text, targetLanguage, apiKey, sourceLanguage = 'auto', contextSnippet = null) {
  let lastError = null;
  const errorsByModel = [];
  
  // Get available models dynamically from API
  let modelsToTry;
  let preferredApiVersion = 'v1beta'; // Default fallback
  
  try {
    const availableModelsData = await getAvailableGeminiModels(apiKey);
    modelsToTry = availableModelsData.models;
    preferredApiVersion = availableModelsData.apiVersion || 'v1beta';
    
    // Sort models: stable first, experimental last
    const stableModels = modelsToTry.filter(model => !model.includes('exp') && !model.includes('experimental'));
    const experimentalModels = modelsToTry.filter(model => model.includes('exp') || model.includes('experimental'));
    modelsToTry = [...stableModels, ...experimentalModels];
    
    // If no models found, fall back to defaults
    if (modelsToTry.length === 0) {
      console.warn('No available models found, using default models');
      const stableDefaults = GEMINI_MODELS.filter(model => !model.includes('exp'));
      const expDefaults = GEMINI_MODELS.filter(model => model.includes('exp'));
      modelsToTry = [...stableDefaults, ...expDefaults];
    }
  } catch (error) {
    console.warn('Error fetching available models, using default models:', error);
    // Fall back to default models if API call fails
    const stableModels = GEMINI_MODELS.filter(model => !model.includes('exp'));
    const experimentalModels = GEMINI_MODELS.filter(model => model.includes('exp'));
    modelsToTry = [...stableModels, ...experimentalModels];
  }
  
  // Check failed models cache to avoid retrying models that consistently fail
  const cacheKey = apiKey.substring(0, 10);
  const failedCache = failedModelsCache[cacheKey];
  const failedModels = (failedCache && (Date.now() - failedCache.timestamp) < FAILED_MODELS_CACHE_TTL) 
    ? failedCache.failedModels 
    : new Set();
  
  // Filter out models that have failed before
  const modelsToTryFiltered = modelsToTry.filter(model => !failedModels.has(model));
  
  // If all models are in failed cache, clear it and try again (maybe models became available)
  if (modelsToTryFiltered.length === 0 && modelsToTry.length > 0) {
    delete failedModelsCache[cacheKey];
    modelsToTryFiltered.push(...modelsToTry);
  }
  
  for (const model of modelsToTryFiltered) {
    try {
      // Add timeout to prevent hanging (30 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      const result = await Promise.race([
        tryTranslateWithModel(text, targetLanguage, apiKey, sourceLanguage, model, preferredApiVersion, contextSnippet),
        timeoutPromise
      ]);
      
      if (result?.success) {
        // Success! Remove from failed cache if it was there
        if (failedModels.has(model)) {
          failedModels.delete(model);
          failedModelsCache[cacheKey] = { failedModels, timestamp: Date.now() };
        }
        return result;
      }
    } catch (error) {
      const errorMessage = error.message || error.toString();
      const isQuotaError = error.status === 429 || error.isQuotaError || 
                          errorMessage.includes('quota') || 
                          errorMessage.includes('Quota exceeded') || 
                          errorMessage.includes('429');
      const isNotFoundError = error.status === 404 || 
                             errorMessage.includes('not found') || 
                             errorMessage.includes('404') ||
                             errorMessage.includes('is not found');
      
      // Track errors for debugging
      errorsByModel.push({ model, error: errorMessage, status: error.status });
      
      // If it's a 404 (model not found/deprecated), add to failed cache and skip
      if (isNotFoundError) {
        // Model doesn't exist - cache it to avoid retrying
        failedModels.add(model);
        failedModelsCache[cacheKey] = { failedModels, timestamp: Date.now() };
        continue; // Try next model
      }
      
      // If it's a quota error for experimental model, add to failed cache and skip
      if (isQuotaError && model.includes('exp')) {
        // Experimental models with quota errors - cache to avoid retrying
        failedModels.add(model);
        failedModelsCache[cacheKey] = { failedModels, timestamp: Date.now() };
        continue;
      }
      
      // For quota errors on stable models, save but continue trying other models
      // Don't cache quota errors on stable models - they might work later
      // For other errors, save and try next model
      lastError = errorMessage;
      continue;
    }
  }
  
  // Build a more helpful error message
  let errorMessage = 'All Gemini models failed. ';
  
  if (errorsByModel.length > 0) {
    const quotaErrors = errorsByModel.filter(e => e.error.includes('quota') || e.error.includes('429'));
    const notFoundErrors = errorsByModel.filter(e => e.status === 404 || e.error.includes('not found'));
    
    if (quotaErrors.length === errorsByModel.length) {
      errorMessage += 'All models hit quota limits. Your API key is valid but the free tier quota has been exceeded. ';
      errorMessage += 'Please wait for the quota to reset or consider upgrading your plan.';
    } else if (notFoundErrors.length === errorsByModel.length) {
      errorMessage += 'All tested models are not available. This might be a temporary issue. Please try again later.';
    } else {
      errorMessage += `Errors: ${errorsByModel.map(e => `${e.model}: ${e.error}`).join('; ')}`;
    }
  } else {
    errorMessage += lastError || 'Please check your API key and try again.';
  }
  
  // Return error object instead of throwing
  return {
    success: false,
    error: errorMessage,
    api: 'gemini',
    errorsByModel: errorsByModel
  };
}

/**
 * Gemini prompt for translation; optional page context improves disambiguation.
 * @param {string|null|undefined} rawContext
 */
function buildGeminiTranslationPrompt(text, targetLanguage, sourceLanguage, rawContext) {
  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = sourceLanguage === 'auto' ? 'auto-detect' : getLanguageName(sourceLanguage);

  const capped =
    rawContext && typeof rawContext === 'string' && typeof clampContextSnippetForApi === 'function'
      ? clampContextSnippetForApi(rawContext)
      : '';

  if (capped) {
    if (sourceLanguage === 'auto') {
      return (
        `Surrounding context (reference only; helps disambiguate — do not reply with a translation of the whole context):\n` +
        `${capped}\n\n` +
        `Translate ONLY the following segment to ${targetLangName}. ` +
        `Output only the translated text of that segment with no quotes and no extra explanation:\n\n${text}`
      );
    }
    return (
      `Surrounding context (reference only; helps disambiguate — do not reply with a translation of the whole context):\n` +
      `${capped}\n\n` +
      `Translate ONLY the following segment from ${sourceLangName} to ${targetLangName}. ` +
      `Output only the translated text of that segment with no quotes and no extra explanation:\n\n${text}`
    );
  }

  return sourceLanguage === 'auto'
    ? `Translate the following text to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`
    : `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`;
}

/**
 * Try translating with a specific Gemini model
 * @param {string|null|undefined} [contextSnippet]
 * @returns {Promise<Object>}
 */
async function tryTranslateWithModel(text, targetLanguage, apiKey, sourceLanguage, model, preferredApiVersion = 'v1beta', contextSnippet = null) {
  // Try preferred API version first, then fallback to others
  const apiVersions = [preferredApiVersion, 'v1beta', 'v1'].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates

  const prompt = buildGeminiTranslationPrompt(text, targetLanguage, sourceLanguage, contextSnippet);

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: TRANSLATION_MAX_OUTPUT_TOKENS
    }
  };

  // Try each API version until one works
  let lastError = null;
  for (const apiVersion of apiVersions) {
  try {
      const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;

    const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
      method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message ?? response.statusText;
        
        // If 404 and there are more API versions to try, continue to next version
        if (response.status === 404 && apiVersions.indexOf(apiVersion) < apiVersions.length - 1) {
          lastError = `API ${apiVersion}: ${errorMessage}`;
          continue; // Try next API version
        }
        
        // Check if it's a quota error (429)
        if (response.status === 429) {
          const quotaError = new Error(`Gemini API quota exceeded: ${errorMessage}`);
          quotaError.status = 429;
          quotaError.isQuotaError = true;
          throw quotaError;
        }
        
        const statusMessages = {
          400: ' (Check your API key and request format)',
          403: ' (API key may be invalid or restricted)',
          404: ' (Model not found - check API version)'
        };
        
        const fullErrorMessage = `Gemini API error (${apiVersion}): ${response.status} - ${errorMessage}${statusMessages[response.status] ?? ''}`;
        const apiError = new Error(fullErrorMessage);
        apiError.status = response.status;
        throw apiError;
      }

      // Success - parse and return result
    const data = await response.json();
      const candidate = data?.candidates?.[0]?.content?.parts?.[0];
    
      if (!candidate?.text) {
      throw new Error('Invalid response format from Gemini API');
    }
    
    return {
      success: true,
        translatedText: candidate.text.trim(),
        sourceLanguage,
        targetLanguage,
        api: 'gemini',
        usage: data.usageMetadata ?? null
      };
  } catch (error) {
      // If this is the last API version, throw the error
      if (apiVersions.indexOf(apiVersion) === apiVersions.length - 1) {
        throw error;
      }
      // Otherwise, save error and try next version
      lastError = error.message || error.toString();
    }
  }
  
  // If we get here, all API versions failed
  throw new Error(lastError || `Model ${model} not found in any API version`);
}
