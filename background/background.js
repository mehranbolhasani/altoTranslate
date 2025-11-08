// Background service worker for Chrome extension

/**
 * Language name mapping - single source of truth
 * @type {Object<string, string>}
 */
const LANGUAGE_NAMES = {
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

/**
 * Predefined themes for translation popup
 * @type {Object<string, Object>}
 */
const PREDEFINED_THEMES = {
  'default': {
    name: 'Default',
    description: 'Clean and minimal',
    colors: {
      background: 'rgba(255, 255, 255, 0.95)',
      border: '#e5e7eb',
      text: '#374151',
      textSecondary: '#6b7280',
      headerBorder: '#f3f4f6',
      buttonBg: 'rgba(59, 131, 246, 0.2)',
      buttonText: '#3b82f6',
      buttonHover: '#2563eb',
      translatedText: '#0c4a6e',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  },
  'ocean': {
    name: 'Ocean',
    description: 'Calm blue tones',
    colors: {
      background: 'rgba(240, 249, 255, 0.95)',
      border: '#bae6fd',
      text: '#0c4a6e',
      textSecondary: '#075985',
      headerBorder: '#e0f2fe',
      buttonBg: 'rgba(14, 165, 233, 0.2)',
      buttonText: '#0ea5e9',
      buttonHover: '#0284c7',
      translatedText: '#0369a1',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  },
  'sunset': {
    name: 'Sunset',
    description: 'Warm orange and pink',
    colors: {
      background: 'rgba(255, 247, 237, 0.95)',
      border: '#fed7aa',
      text: '#7c2d12',
      textSecondary: '#9a3412',
      headerBorder: '#ffedd5',
      buttonBg: 'rgba(249, 115, 22, 0.2)',
      buttonText: '#f97316',
      buttonHover: '#ea580c',
      translatedText: '#c2410c',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  },
  'forest': {
    name: 'Forest',
    description: 'Natural green shades',
    colors: {
      background: 'rgba(240, 253, 244, 0.95)',
      border: '#bbf7d0',
      text: '#14532d',
      textSecondary: '#166534',
      headerBorder: '#dcfce7',
      buttonBg: 'rgba(34, 197, 94, 0.2)',
      buttonText: '#22c55e',
      buttonHover: '#16a34a',
      translatedText: '#15803d',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  },
  'purple': {
    name: 'Purple',
    description: 'Rich purple hues',
    colors: {
      background: 'rgba(250, 245, 255, 0.95)',
      border: '#e9d5ff',
      text: '#581c87',
      textSecondary: '#6b21a8',
      headerBorder: '#f3e8ff',
      buttonBg: 'rgba(168, 85, 247, 0.2)',
      buttonText: '#a855f7',
      buttonHover: '#9333ea',
      translatedText: '#7e22ce',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  },
  'midnight': {
    name: 'Midnight',
    description: 'Dark elegant theme',
    colors: {
      background: 'rgba(15, 23, 42, 0.95)',
      border: '#334155',
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
      headerBorder: '#1e293b',
      buttonBg: 'rgba(59, 130, 246, 0.3)',
      buttonText: '#60a5fa',
      buttonHover: '#3b82f6',
      translatedText: '#93c5fd',
      errorBg: '#7f1d1d',
      errorText: '#fca5a5',
      errorBorder: '#dc2626'
    }
  },
  'rose': {
    name: 'Rose',
    description: 'Soft pink tones',
    colors: {
      background: 'rgba(255, 241, 242, 0.95)',
      border: '#fecdd3',
      text: '#881337',
      textSecondary: '#9f1239',
      headerBorder: '#fff1f2',
      buttonBg: 'rgba(244, 63, 94, 0.2)',
      buttonText: '#f43f5e',
      buttonHover: '#e11d48',
      translatedText: '#be123c',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  },
  'amber': {
    name: 'Amber',
    description: 'Bright and energetic',
    colors: {
      background: 'rgba(255, 251, 235, 0.95)',
      border: '#fde68a',
      text: '#78350f',
      textSecondary: '#92400e',
      headerBorder: '#fef3c7',
      buttonBg: 'rgba(245, 158, 11, 0.2)',
      buttonText: '#f59e0b',
      buttonHover: '#d97706',
      translatedText: '#b45309',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  },
  'slate': {
    name: 'Slate',
    description: 'Cool gray tones',
    colors: {
      background: 'rgba(248, 250, 252, 0.95)',
      border: '#cbd5e1',
      text: '#1e293b',
      textSecondary: '#334155',
      headerBorder: '#f1f5f9',
      buttonBg: 'rgba(100, 116, 139, 0.2)',
      buttonText: '#64748b',
      buttonHover: '#475569',
      translatedText: '#334155',
      errorBg: '#fef2f2',
      errorText: '#dc2626',
      errorBorder: '#fecaca'
    }
  }
};

/**
 * Default settings for the extension
 * @type {Object}
 */
const DEFAULT_SETTINGS = {
  apiPreference: 'gemini',
  geminiApiKey: '',
  openrouterApiKey: '',
  libretranslateEnabled: true,
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  popupTheme: 'default'
};

/**
 * Gemini API models to try in order
 * @type {string[]}
 */
const GEMINI_MODELS = [
  'gemini-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-exp'
];

/**
 * Cache configuration
 */
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const CACHE_PREFIX = 'translation_cache_';
const MAX_CACHE_SIZE_MB = 8; // Maximum cache size in MB (80% of 10MB limit)
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;
const EVICTION_THRESHOLD = 0.9; // Evict when cache reaches 90% of max size

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

/**
 * Development hot reload shortcut (Ctrl+Shift+R)
 */
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'reload-extension') {
    chrome.runtime.reload();
  }
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
  
  const MAX_TEXT_LENGTH = 5000;
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
  try {
    const { text, targetLanguage, sourceLanguage = 'auto' } = request;
    
    // Validate input
    const validation = validateTranslationInput(text, targetLanguage);
    if (!validation.valid) {
      sendResponse({ success: false, error: validation.error });
      return;
    }
    
    const { sanitizedText } = validation;
    const settings = await getSettings();
    
    // Check if at least one service is configured
    const hasService = settings.geminiApiKey || 
                       settings.openrouterApiKey || 
                       settings.libretranslateEnabled;
    
    if (!hasService) {
      sendResponse({
        success: false,
        error: 'No translation services configured. Please set up your API keys or enable LibreTranslate in the extension settings.'
      });
      return;
    }

    // Generate cache key
    const { apiPreference } = settings;
    const cacheKey = generateCacheKey(sanitizedText, sourceLanguage, targetLanguage, apiPreference);
    
    // Check cache first
    const cachedResult = await getCachedTranslation(cacheKey);
    if (cachedResult) {
      // Add cache indicator flag
      sendResponse({ ...cachedResult, fromCache: true });
      return;
    }

    // Cache miss - proceed with API call
    let result;
    
    switch (apiPreference) {
      case 'gemini':
        if (!settings.geminiApiKey) {
          sendResponse({ success: false, error: 'Gemini API key not configured' });
          return;
        }
        result = await translateWithGemini(sanitizedText, targetLanguage, settings.geminiApiKey, sourceLanguage);
        break;
        
      case 'openrouter':
        if (!settings.openrouterApiKey) {
          sendResponse({ success: false, error: 'OpenRouter API key not configured' });
          return;
        }
        result = await translateWithOpenRouter(sanitizedText, targetLanguage, settings.openrouterApiKey, sourceLanguage);
        break;
        
      case 'libretranslate':
        if (!settings.libretranslateEnabled) {
          sendResponse({ success: false, error: 'LibreTranslate is not enabled' });
          return;
        }
        result = await translateWithLibreTranslate(sanitizedText, targetLanguage, sourceLanguage);
        break;
        
      case 'both':
        result = await translateWithAll(sanitizedText, targetLanguage, sourceLanguage, settings);
        break;
        
      default:
        sendResponse({ success: false, error: `Invalid API preference: ${apiPreference}` });
        return;
    }

    // Cache successful translations only
    if (result?.success) {
      await setCachedTranslation(cacheKey, result);
    }

    // Add cache indicator flag (false for new translations)
    sendResponse({ ...result, fromCache: false });
    
  } catch (error) {
    console.error('Translation error:', error);
    sendResponse({
      success: false,
      error: error?.message ?? 'Unknown translation error'
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
    return { success: false, error: 'No translation services configured' };
  }
  
  try {
    const results = await Promise.allSettled(promises);
    
    // Find the first successful result
    const successResult = results.find(r => 
      r.status === 'fulfilled' && r.value?.success === true
    );
    
    if (successResult) {
      return successResult.value;
    }
    
    // Return the first error if available
    const firstError = results.find(r => 
      r.status === 'fulfilled' && r.value?.success === false
    );
    
    return firstError?.value ?? { 
      success: false, 
      error: 'All translation services failed' 
    };
    
  } catch (error) {
    return {
      success: false,
      error: error?.message ?? 'Translation failed'
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
 * Generate a simple hash from a string
 * @param {string} str - String to hash
 * @returns {string} Hash value
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate cache key for translation
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @param {string} apiPreference - API preference
 * @returns {string} Cache key
 */
function generateCacheKey(text, sourceLanguage, targetLanguage, apiPreference) {
  const keyString = `${text}|${sourceLanguage}|${targetLanguage}|${apiPreference}`;
  return `${CACHE_PREFIX}${simpleHash(keyString)}`;
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
      
      // Also remove from storage
      try {
        await chrome.storage.local.remove(keyToEvict);
      } catch (error) {
        console.error('Error removing from storage during eviction:', error);
      }
      
      evicted++;
    }
  }
  
  // LRU eviction completed
  
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
  for (const model of GEMINI_MODELS) {
    try {
      const result = await tryTranslateWithModel(text, targetLanguage, apiKey, sourceLanguage, model);
      if (result?.success) {
        return result;
      }
    } catch (error) {
      // Model failed, try next one
      continue;
    }
  }
  
  throw new Error('All Gemini models failed. Please check your API key and try again.');
}

/**
 * Try translating with a specific Gemini model
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} apiKey - Gemini API key
 * @param {string} sourceLanguage - Source language code
 * @param {string} model - Model name to use
 * @returns {Promise<Object>} Translation result
 */
async function tryTranslateWithModel(text, targetLanguage, apiKey, sourceLanguage, model) {
  const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = sourceLanguage === 'auto' ? 'auto-detect' : getLanguageName(sourceLanguage);

  const prompt = sourceLanguage === 'auto' 
    ? `Translate the following text to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`
    : `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const statusMessages = {
      400: ' (Check your API key and request format)',
      403: ' (API key may be invalid or restricted)',
      404: ' (Model not found - check API version)'
    };
    
    const errorMessage = `Gemini API error: ${response.status} - ${errorData?.error?.message ?? response.statusText}${statusMessages[response.status] ?? ''}`;
    throw new Error(errorMessage);
  }

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

/**
 * Get language name from code
 * @param {string} code - Language code
 * @returns {string} Language name
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] ?? code;
}

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
      
      for (const model of GEMINI_MODELS) {
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
