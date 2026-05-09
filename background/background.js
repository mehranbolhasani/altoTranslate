// Background service worker for Chrome extension

// Import utility modules
importScripts(
  '../utils/constants.js',
  '../utils/languages.js',
  '../utils/error-messages.js',
  '../utils/themes.js',
  '../utils/mymemory_infer_source.js',
  '../utils/selection_context.js',
  '../utils/api-gemini.js',
  '../utils/api-openrouter.js',
  '../utils/api-libretranslate.js'
);

// PREDEFINED_THEMES is imported from utils/themes.js via importScripts

/**
 * Default settings for the extension
 * @type {Object}
 */
const DEFAULT_SETTINGS = {
  apiPreference: 'gemini',
  geminiApiKey: '',
  openrouterApiKey: '',
  libretranslateEnabled: true, // Legacy field; MyMemory always on (normalized in getSettings)
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  popupTheme: 'default',
  disableInputFields: false // Disable translation for input fields and textareas
};

// Constants are now imported from utils/constants.js via importScripts
// GEMINI_MODELS, CACHE_TTL, CACHE_PREFIX, MAX_CACHE_SIZE_MB, MAX_CACHE_SIZE_BYTES, EVICTION_THRESHOLD

/**
 * In-memory cache for fast lookups
 * Structure: Map<key, {result, timestamp, lastAccessed, size}>
 */
const memoryCache = new Map();

/**
 * LRU tracking: Array of keys in order of access (most recent last)
 */
const lruOrder = [];

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'translate-selection') return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs && tabs.length > 0 ? tabs[0] : null;
    const tabId = tab?.id;
    const url = tab?.url ?? '';
    if (
      tabId === undefined ||
      tabId === null ||
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url === '' ||
      url.startsWith('https://chromewebstore.google.com') ||
      url.includes('chrome.google.com/webstore')
    ) {
      return;
    }
    chrome.tabs.sendMessage(tabId, { action: 'triggerTranslateShortcut' }, () => {
      void chrome.runtime.lastError;
    });
  });
});

/**
 * Message handler router
 * @param {Object} request - Message request
 * @param {chrome.runtime.MessageSender} sender - Message sender
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} Whether to keep message channel open
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;
  
  switch (action) {
    case 'translate':
      handleTranslation(request, sendResponse);
      return true;
    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;
    case 'saveSettings':
      handleSaveSettings(request.settings, sendResponse);
      return true;
    case 'openSettings':
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return true;
    case 'validateApiKey':
      handleValidateApiKey(request, sendResponse);
      return true;
    case 'getCacheStats':
      handleGetCacheStats(sendResponse);
      return true;
    case 'clearCache':
      handleClearCache(sendResponse);
      return true;
    case 'getThemes':
      sendResponse({ success: true, themes: PREDEFINED_THEMES });
      return true;
    case 'getLanguages':
      sendResponse({ success: true, languages: LANGUAGE_NAMES });
      return true;
    default:
      sendResponse({ success: false, error: `Unknown action: ${action}` });
      return false;
  }
});

/**
 * Validate and sanitize translation input
 * @param {string} text - Text to validate
 * @param {string} targetLanguage - Target language code
 * @returns {{valid: boolean, sanitizedText?: string, error?: string}}
 */
function validateTranslationInput(text, targetLanguage) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { valid: false, error: 'Invalid text input' };
  }
  
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    return { valid: false, error: 'Invalid target language' };
  }
  
  // MAX_TEXT_LENGTH is imported from utils/constants.js
  if (text.length > MAX_TEXT_LENGTH) {
    return { 
      valid: false, 
      error: `Text too long. Please select text with less than ${MAX_TEXT_LENGTH} characters.` 
    };
  }
  
  return { valid: true, sanitizedText: text.trim().substring(0, MAX_TEXT_LENGTH) };
}

/**
 * Handle translation request
 * @param {Object} request - Translation request
 * @param {Function} sendResponse - Response callback
 */
async function handleTranslation(request, sendResponse) {
  /** Hoisted for outer catch — must not reference block-scoped `settings` in catch */
  let settings = null;
  let apiPreference = null;

  try {
    const { text, targetLanguage, sourceLanguage = 'auto', contextSnippet } = request;
    
    // Validate input
    const validation = validateTranslationInput(text, targetLanguage);
    if (!validation.valid) {
      const errorType = validation.error.toLowerCase().includes('too long') ? 'TEXT_TOO_LONG' : 'UNKNOWN_ERROR';
      const errorMsg = getErrorMessage(errorType, { maxLength: MAX_TEXT_LENGTH });
      sendResponse({ 
        success: false, 
        error: validation.error,
        errorDetails: errorMsg
      });
      return;
    }
    
    const { sanitizedText } = validation;
    const llmContext =
      typeof contextSnippet === 'string' && contextSnippet.trim().length > 0
        ? contextSnippet.trim()
        : null;

    settings = await getSettings();
    apiPreference = settings.apiPreference;

    // MyMemory is always available (no toggle). Gemini/OpenRouter need keys when selected.

    // Generate cache key
    const cacheKey = await generateCacheKey(sanitizedText, sourceLanguage, targetLanguage, apiPreference);
    
    // Check cache first
    const cachedResult = await getCachedTranslation(cacheKey);
    if (cachedResult) {
      // Add cache indicator flag
      sendResponse({ ...cachedResult, fromCache: true });
      return;
    }

    // Cache miss - proceed with API call
    let result;
    
    try {
      switch (apiPreference) {
        case 'gemini':
          if (!settings.geminiApiKey) {
            sendResponse({ 
              success: false, 
              error: formatErrorMessage('GEMINI_API_KEY_MISSING'),
              errorDetails: getErrorMessage('GEMINI_API_KEY_MISSING')
            });
            return;
          }
          result = await translateWithGemini(
            sanitizedText,
            targetLanguage,
            settings.geminiApiKey,
            sourceLanguage,
            llmContext
          );
          // No automatic fallback when user explicitly selects Gemini - show the error
          break;
          
        case 'openrouter':
          if (!settings.openrouterApiKey) {
            sendResponse({ 
              success: false, 
              error: formatErrorMessage('OPENROUTER_API_KEY_MISSING'),
              errorDetails: getErrorMessage('OPENROUTER_API_KEY_MISSING')
            });
            return;
          }
          result = await translateWithOpenRouter(
            sanitizedText,
            targetLanguage,
            settings.openrouterApiKey,
            sourceLanguage,
            llmContext
          );
          break;
          
        case 'libretranslate':
          result = await translateWithLibreTranslate(sanitizedText, targetLanguage, sourceLanguage);
          break;
          
        case 'both':
          result = await translateWithAll(
            sanitizedText,
            targetLanguage,
            sourceLanguage,
            settings,
            llmContext
          );
          break;
          
        default:
          sendResponse({ success: false, error: `Invalid API preference: ${apiPreference}` });
          return;
      }

      // Ensure result is an object
      if (!result || typeof result !== 'object') {
        result = {
          success: false,
          error: 'Translation API returned an invalid response'
        };
      }

      // Cache successful translations only
      if (result.success) {
        await setCachedTranslation(cacheKey, result);
      }

      // Add cache indicator flag (false for new translations)
      sendResponse({ ...result, fromCache: false });
    } catch (apiError) {
      // Handle any unexpected errors from API calls
      console.error('API call error:', apiError);
      sendResponse({
        success: false,
        error: apiError?.message || 'Translation API call failed',
        errorDetails: {
          message: apiError?.message || 'Unknown error',
          api: apiPreference
        }
      });
    }
    
  } catch (error) {
    console.error('Translation error:', error);
    const errorType = getErrorTypeFromMessage(error?.message ?? '');
    const apiPref = settings?.apiPreference ?? apiPreference;
    const errorMsg = getErrorMessage(errorType, { 
      error: error?.message,
      apiType: apiPref 
    });
    sendResponse({
      success: false,
      error: formatErrorMessage(errorType, { 
        error: error?.message,
        apiType: apiPref 
      }),
      errorDetails: errorMsg
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
async function translateWithAll(text, targetLanguage, sourceLanguage, settings, contextSnippet = null) {
  const geminiKey = String(settings?.geminiApiKey || '').trim();
  const openrouterKey = String(settings?.openrouterApiKey || '').trim();

  const hasAnyLlmKey = Boolean(geminiKey || openrouterKey);
  const preferLlmFirst =
    hasAnyLlmKey &&
    typeof SMART_FALLBACK_LLM_FIRST_MIN_CHARS === 'number' &&
    text.length >= SMART_FALLBACK_LLM_FIRST_MIN_CHARS;

  /** @type {{ id: string, run: () => Promise<*> }[]} */
  const memorySteps = [];
  if (typeof myMemorySupportsLanguagePair === 'function' && myMemorySupportsLanguagePair(sourceLanguage, targetLanguage)) {
    memorySteps.push({
      id: 'mymemory',
      run: () => translateWithLibreTranslate(text, targetLanguage, sourceLanguage)
    });
  }

  /** @type {{ id: string, run: () => Promise<*> }[]} */
  const geminiSteps = [];
  if (geminiKey) {
    geminiSteps.push({
      id: 'gemini',
      run: () => translateWithGemini(text, targetLanguage, geminiKey, sourceLanguage, contextSnippet)
    });
  }

  /** @type {{ id: string, run: () => Promise<*> }[]} */
  const openrouterSteps = [];
  if (openrouterKey) {
    openrouterSteps.push({
      id: 'openrouter',
      run: () => translateWithOpenRouter(text, targetLanguage, openrouterKey, sourceLanguage, contextSnippet)
    });
  }

  const steps = preferLlmFirst
    ? [...geminiSteps, ...openrouterSteps, ...memorySteps]
    : [...memorySteps, ...geminiSteps, ...openrouterSteps];

  if (steps.length === 0) {
    return {
      success: false,
      error:
        'Smart fallback has no usable path: this language pair is not supported by MyMemory, and no Gemini or OpenRouter API key is set. Add a key or pick a single API.',
      api: 'both'
    };
  }

  let lastFailure = null;

  for (const step of steps) {
    try {
      const result = await step.run();
      if (result?.success) {
        return {
          ...result,
          fallbackMode: true,
          fallbackWinner: step.id,
          ...(preferLlmFirst ? { fallbackPreferLlmDueToLength: true } : {})
        };
      }
      lastFailure = result;
    } catch (error) {
      console.error(`translateWithAll: ${step.id} threw`, error);
      lastFailure = {
        success: false,
        error: error?.message ?? 'Translation failed',
        api: step.id
      };
    }
  }

  return (
    lastFailure ?? {
      success: false,
      error: 'All translation services in the smart fallback chain failed',
      api: 'both'
    }
  );
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
 * Generate a collision-resistant cache key using SHA-256
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @param {string} apiPreference - API preference
 * @returns {Promise<string>} Cache key
 */
async function generateCacheKey(text, sourceLanguage, targetLanguage, apiPreference) {
  // Null-byte delimiters prevent "ab|c" and "a|bc" from colliding
  const keyString = `${text}\0${sourceLanguage}\0${targetLanguage}\0${apiPreference}`;
  const encoded = new TextEncoder().encode(keyString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${CACHE_PREFIX}${hashHex}`;
}

/**
 * Calculate size of cache entry in bytes
 * @param {Object} entry - Cache entry
 * @returns {number} Size in bytes
 */
function calculateEntrySize(entry) {
  return JSON.stringify(entry).length;
}

/**
 * Update LRU order - move key to end (most recently used)
 * @param {string} cacheKey - Cache key
 */
function updateLRU(cacheKey) {
  // Remove from current position
  const index = lruOrder.indexOf(cacheKey);
  if (index > -1) {
    lruOrder.splice(index, 1);
  }
  // Add to end (most recently used)
  lruOrder.push(cacheKey);
}

/**
 * Safe storage operation with retry logic and exponential backoff
 * @param {Function} operation - Async function that performs the storage operation
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<any>} Result of the operation
 */
async function safeStorageOperation(operation, retries = STORAGE_RETRY_ATTEMPTS) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      // If this is the last retry, throw the error
      if (i === retries - 1) {
        console.error('Storage operation failed after all retries:', error);
        throw error;
      }
      
      // Exponential backoff: wait STORAGE_RETRY_BASE_DELAY * (attempt number + 1)
      const delay = STORAGE_RETRY_BASE_DELAY * (i + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Log retry attempt (but don't spam console)
      if (i === 0) {
        console.warn('Storage operation failed, retrying...', error.message);
      }
    }
  }
}

/**
 * Evict least recently used entries until cache is under threshold
 * @returns {Promise<number>} Number of entries evicted
 */
async function evictLRU() {
  let evicted = 0;
  let currentSize = getMemoryCacheSize();
  
  // Evict until we're under 90% of max size
  const targetSize = MAX_CACHE_SIZE_BYTES * EVICTION_THRESHOLD;
  
  while (currentSize > targetSize && lruOrder.length > 0) {
    // Remove least recently used (first in array)
    const keyToEvict = lruOrder.shift();
    const entry = memoryCache.get(keyToEvict);
    
    if (entry) {
      const entrySize = entry.size || calculateEntrySize(entry);
      currentSize -= entrySize;
      memoryCache.delete(keyToEvict);
      
      // Also remove from storage with retry logic
      try {
        await safeStorageOperation(async () => {
        await chrome.storage.local.remove(keyToEvict);
        }, 3);
      } catch (error) {
        // If storage removal fails after retries, log but continue eviction
        // The entry is already removed from memory cache, so we continue
        console.error('Failed to remove from storage after retries, continuing eviction:', error);
      }
      
      evicted++;
    }
  }
  
  return evicted;
}

/**
 * Get total size of in-memory cache
 * @returns {number} Size in bytes
 */
function getMemoryCacheSize() {
  let totalSize = 0;
  for (const entry of memoryCache.values()) {
    totalSize += entry.size || calculateEntrySize(entry);
  }
  return totalSize;
}

/**
 * Get cached translation if available and not expired
 * Checks in-memory cache first, then storage
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Object|null>} Cached translation result or null
 */
async function getCachedTranslation(cacheKey) {
  const now = Date.now();
  
  // Check in-memory cache first (fastest)
  const memoryEntry = memoryCache.get(cacheKey);
  if (memoryEntry) {
    const age = now - memoryEntry.timestamp;
    
    if (age > CACHE_TTL) {
      // Expired - remove from both caches
      memoryCache.delete(cacheKey);
      const lruIndex = lruOrder.indexOf(cacheKey);
      if (lruIndex > -1) {
        lruOrder.splice(lruIndex, 1);
      }
      await chrome.storage.local.remove(cacheKey).catch(() => {});
      return null;
    }
    
    // Update LRU order
    updateLRU(cacheKey);
    memoryEntry.lastAccessed = now;
    
    return memoryEntry.result;
  }
  
  // Not in memory - check storage
  try {
    const result = await chrome.storage.local.get(cacheKey);
    const cached = result[cacheKey];
    
    if (!cached) {
      return null;
    }
    
    // Check if cache entry is expired
    const age = now - cached.timestamp;
    
    if (age > CACHE_TTL) {
      // Cache expired, remove it
      await chrome.storage.local.remove(cacheKey);
      return null;
    }
    
    // Load into memory cache for faster future access
    const entrySize = calculateEntrySize(cached);
    memoryCache.set(cacheKey, {
      result: cached.result,
      timestamp: cached.timestamp,
      lastAccessed: now,
      size: entrySize
    });
          updateLRU(cacheKey);
          
          return cached.result;
    
  } catch (error) {
    console.error('Error getting cached translation:', error);
    return null;
  }
}

/**
 * Store translation result in cache (both memory and storage)
 * @param {string} cacheKey - Cache key
 * @param {Object} translationResult - Translation result to cache
 * @returns {Promise<void>}
 */
async function setCachedTranslation(cacheKey, translationResult) {
  try {
    const now = Date.now();
    const cacheEntry = {
      result: translationResult,
      timestamp: now
    };
    
    const entrySize = calculateEntrySize(cacheEntry);
    
    // Check if adding this entry would exceed cache limit
    const currentSize = getMemoryCacheSize();
    const newSize = currentSize + entrySize;
    
    if (newSize > MAX_CACHE_SIZE_BYTES) {
      // Need to evict before adding
      await evictLRU();
    }
    
    // Store in memory cache
    memoryCache.set(cacheKey, {
      result: translationResult,
      timestamp: now,
      lastAccessed: now,
      size: entrySize
    });
    updateLRU(cacheKey);
    
    // Store in persistent storage
    await chrome.storage.local.set({ [cacheKey]: cacheEntry });
    
    // Periodic eviction check (every 10 entries)
    if (memoryCache.size % 10 === 0) {
      const sizeAfterAdd = getMemoryCacheSize();
      if (sizeAfterAdd > MAX_CACHE_SIZE_BYTES * EVICTION_THRESHOLD) {
        await evictLRU();
      }
    }
    
  } catch (error) {
    console.error('Error caching translation:', error);
    // Don't throw - caching failure shouldn't break translation
  }
}

/**
 * Get cache statistics (includes both memory and storage)
 * @returns {Promise<Object>} Cache statistics
 */
async function getCacheStats() {
  try {
    const allData = await chrome.storage.local.get(null);
    const cacheEntries = Object.entries(allData).filter(([key]) => 
      key.startsWith(CACHE_PREFIX)
    );
    
    const now = Date.now();
    let storageSize = 0;
    let validEntries = 0;
    let expiredEntries = 0;
    
    // Calculate storage cache stats
    cacheEntries.forEach(([key, entry]) => {
      if (entry && entry.timestamp) {
        const age = now - entry.timestamp;
        const entrySize = JSON.stringify(entry).length;
        storageSize += entrySize;
        
        if (age > CACHE_TTL) {
          expiredEntries++;
        } else {
          validEntries++;
        }
      }
    });
    
    // Get memory cache stats
    const memorySize = getMemoryCacheSize();
    const memoryEntries = memoryCache.size;
    const totalSize = Math.max(storageSize, memorySize); // Use larger of the two
    
    return {
      totalEntries: Math.max(cacheEntries.length, memoryEntries),
      validEntries,
      expiredEntries,
      memoryEntries,
      storageEntries: cacheEntries.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      memorySizeMB: (memorySize / (1024 * 1024)).toFixed(2),
      storageSizeMB: (storageSize / (1024 * 1024)).toFixed(2),
      maxSizeMB: MAX_CACHE_SIZE_MB,
      cacheTTLDays: CACHE_TTL / (24 * 60 * 60 * 1000),
      usagePercent: ((totalSize / MAX_CACHE_SIZE_BYTES) * 100).toFixed(1)
    };
    
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalEntries: 0,
      validEntries: 0,
      expiredEntries: 0,
      memoryEntries: 0,
      storageEntries: 0,
      totalSizeBytes: 0,
      totalSizeMB: '0.00',
      memorySizeMB: '0.00',
      storageSizeMB: '0.00',
      maxSizeMB: MAX_CACHE_SIZE_MB,
      cacheTTLDays: 7,
      usagePercent: '0.0'
    };
  }
}

/**
 * Clear all cached translations (both memory and storage)
 * @returns {Promise<Object>} Result with count of cleared entries
 */
async function clearCache() {
  try {
    // Clear in-memory cache
    const memoryCount = memoryCache.size;
    memoryCache.clear();
    lruOrder.length = 0;
    
    // Clear storage cache
    const allData = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(allData).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    
    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
    }
    
    const totalCleared = Math.max(memoryCount, cacheKeys.length);
    
    return { success: true, cleared: totalCleared };
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: error?.message ?? 'Failed to clear cache' };
  }
}

/**
 * Get settings from Chrome storage
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    const merged = { ...DEFAULT_SETTINGS, ...result };
    // MyMemory is always on; legacy installs may have libretranslateEnabled: false
    merged.libretranslateEnabled = true;
    return merged;
  } catch (error) {
    console.error('Error getting settings:', error);
    return { ...DEFAULT_SETTINGS, libretranslateEnabled: true };
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

// Translation functions are now imported from utility modules via importScripts
// translateWithGemini, translateWithOpenRouter, and translateWithLibreTranslate
// are available from the imported modules

// getLanguageName is now imported from utils/languages.js via importScripts

/**
 * Handle get cache statistics request
 * @param {Function} sendResponse - Response callback
 */
async function handleGetCacheStats(sendResponse) {
  try {
    const stats = await getCacheStats();
    sendResponse({
      success: true,
      stats
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error?.message ?? 'Failed to get cache statistics'
    });
  }
}

/**
 * Handle clear cache request
 * @param {Function} sendResponse - Response callback
 */
async function handleClearCache(sendResponse) {
  try {
    const result = await clearCache();
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error?.message ?? 'Failed to clear cache'
    });
  }
}

/**
 * Handle API key validation request
 * @param {Object} request - Validation request
 * @param {Function} sendResponse - Response callback
 */
async function handleValidateApiKey(request, sendResponse) {
  try {
    const { apiKey, apiType } = request;
    
    // Only check for API key if it's required (not for LibreTranslate/MyMemory API - no key needed)
    if (!apiKey && apiType !== 'libretranslate') {
      sendResponse({
        success: false,
        error: 'No API key provided'
      });
      return;
    }

    if (apiType === 'gemini') {
      // Test with different models to find one that works
      // GEMINI_MODELS is imported from utils/constants.js
      // Skip experimental models for validation (they may not be available on free tier)
      const validationModels = GEMINI_MODELS.filter(model => !model.includes('exp'));
      
      let lastError = null;
      let lastErrorDetails = null;
      let quotaExceeded = false;
      let has403Error = false; // Track if we got any 403 errors (invalid key)
      let has404Error = false; // Track if we got any 404 errors (model not available)
      
      for (const model of validationModels) {
        try {
          const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Hello' }] }]
            })
          });

          if (testResponse.ok) {
            sendResponse({
              success: true,
              message: `API key is valid (using ${model})`
            });
            return;
          }
          
          // Capture error details for better feedback
          try {
            const errorData = await testResponse.json();
            const errorMessage = errorData?.error?.message || '';
            
            // Track error types
            if (testResponse.status === 403) {
              has403Error = true;
            } else if (testResponse.status === 404) {
              has404Error = true;
            }
            
            // Check if it's a quota error (key is valid but quota exceeded)
            if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
              quotaExceeded = true;
              lastError = errorMessage;
              lastErrorDetails = {
                status: testResponse.status,
                model: model,
                message: errorMessage,
                isQuotaError: true
              };
              // Continue trying other models - quota might be model-specific
              continue;
            }
            
            lastError = errorMessage || `HTTP ${testResponse.status}`;
            lastErrorDetails = {
              status: testResponse.status,
              model: model,
              message: errorMessage
            };
          } catch (e) {
            lastError = `HTTP ${testResponse.status}: ${testResponse.statusText}`;
            lastErrorDetails = {
              status: testResponse.status,
              model: model
            };
            if (testResponse.status === 403) {
              has403Error = true;
            } else if (testResponse.status === 404) {
              has404Error = true;
            }
          }
        } catch (error) {
          lastError = error.message;
          lastErrorDetails = { model: model, error: error.message };
          continue;
        }
      }
      
      // Provide more helpful error message
      let errorMessage = '';
      let isValidKey = false;
      
      if (quotaExceeded) {
        // Quota exceeded means the key is valid but free tier quota is used up
        errorMessage = 'API key is valid, but free tier quota has been exceeded. ';
        errorMessage += 'You can either wait for the quota to reset or upgrade your plan. ';
        errorMessage += 'The extension will still work for translation, but you may hit rate limits.';
        isValidKey = true;
      } else if (has403Error) {
        // 403 means invalid key or no access
        errorMessage = 'API key is invalid or does not have access to Gemini API. ';
        errorMessage += 'Please verify your API key is correct and that you have enabled the Gemini API in Google Cloud Console.';
        isValidKey = false;
      } else if (has404Error && !has403Error) {
        // Only 404s and no 403s - key format might be valid but models not available
        errorMessage = 'API key format appears valid, but the tested models are not available. ';
        errorMessage += 'This could mean: (1) The models require a different API version, (2) Your API key needs model access enabled, ';
        errorMessage += 'or (3) The models are not available in your region. ';
        errorMessage += 'The extension may still work - try using it for translation.';
        isValidKey = true; // Treat as potentially valid since we didn't get 403
      } else if (lastErrorDetails?.status === 400) {
        errorMessage = 'Invalid API key format. Please check that your API key is correct.';
        isValidKey = false;
      } else if (lastError) {
        errorMessage = `API key validation failed. Error: ${lastError}`;
        isValidKey = false;
      } else {
        errorMessage = 'API key validation failed. Unable to connect to Gemini API. Please check your internet connection and try again.';
        isValidKey = false;
      }
      
      sendResponse({
        success: isValidKey,
        error: errorMessage,
        isQuotaError: quotaExceeded,
        isModelUnavailable: has404Error && !has403Error
      });
    } else if (apiType === 'openrouter') {
      try {
        const result = await validateOpenRouterApiKey(apiKey);
        if (result.success) {
          sendResponse({ success: true, message: result.message || 'OpenRouter API key is valid' });
        } else {
          sendResponse({ success: false, error: result.error });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: `OpenRouter API key validation failed: ${error.message}\n\nPlease check:\n1. Your internet connection\n2. API key format\n3. OpenRouter account status`
        });
      }
    } else if (apiType === 'libretranslate') {
      // LibreTranslate (MyMemory API) doesn't require API keys, just test connectivity
      try {
        const testResult = await translateWithLibreTranslate('Hello', 'es', 'en');
        
        if (testResult.success) {
          sendResponse({
            success: true,
            message: 'LibreTranslate (MyMemory API) is available and working'
          });
        } else {
          sendResponse({
            success: false,
            error: `LibreTranslate (MyMemory API) test failed: ${testResult.error}`
          });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: `LibreTranslate (MyMemory API) connectivity test failed: ${error.message}`
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
