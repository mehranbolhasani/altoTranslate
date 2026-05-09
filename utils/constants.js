// Centralized constants configuration
// Chrome Extension compatible - no CommonJS exports

/**
 * Text processing constants
 */
const MAX_TEXT_LENGTH = 5000;

/**
 * UI timing constants (in milliseconds)
 */
const DEBOUNCE_DELAY = 300;
const AUTO_HIDE_DELAY = 10000; // 10 seconds
const MIN_POPUP_DISPLAY_TIME = 2000; // 2 seconds minimum before popup can be hidden
const TRANSLATION_PROTECTION_DELAY = 500; // Delay before allowing popup to be hidden after translation
const COPY_FEEDBACK_DURATION = 2000; // Duration for copy button feedback
const HIDE_TIMER_DELAY = 1000; // Delay before hiding popup on click outside

/**
 * UI interaction constants
 */
const CLICK_TOLERANCE = 100; // Pixels tolerance for click detection near selected text

/**
 * Cache configuration constants
 */
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const CACHE_PREFIX = 'translation_cache_';
const MAX_CACHE_SIZE_MB = 8; // Maximum cache size in MB (80% of 10MB limit)
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;
const EVICTION_THRESHOLD = 0.9; // Evict when cache reaches 90% of max size

/**
 * Gemini API configuration
 * Models are tried in order - most stable/reliable first
 * Free tier models are prioritized
 * Note: gemini-pro has been deprecated and removed from v1beta API
 */
const GEMINI_MODELS = [
  'gemini-1.5-flash',      // Most stable, widely available, free tier friendly
  'gemini-1.5-pro',        // More capable model, free tier available
  'gemini-2.0-flash-exp'   // Experimental (not available on free tier, try last)
];

/**
 * OpenRouter API configuration
 *
 * Ordered list of free-tier chat model ids (see https://openrouter.ai/models).
 * Translation tries each in turn so users only paste an API key — no model UI.
 * When OpenRouter deprecates an id (404), a later candidate may still work.
 */
const OPENROUTER_FREE_MODEL_CANDIDATES = [
  // Verified against OpenRouter catalog (pricing prompt+completion = 0); Gemma 3 :free ids were retired (404 "No endpoints found").
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'z-ai/glm-4.5-air:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'openai/gpt-oss-20b:free'
];
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Max tokens for translation completions. 1000 is too low for long selections
 * (especially EN→RTL); Gemini Flash/Pro typically allow up to ~8k output.
 */
const TRANSLATION_MAX_OUTPUT_TOKENS = 8192;

/**
 * MyMemory API configuration
 */
const MYMEMORY_API_BASE = 'https://api.mymemory.translated.net/get';

/**
 * Smart fallback (`apiPreference` both): selections with at least this many characters
 * run Gemini/OpenRouter before MyMemory when an LLM key exists (long passages, fewer URL issues, better quality).
 */
const SMART_FALLBACK_LLM_FIRST_MIN_CHARS = 2000;

/**
 * Storage operation retry configuration
 */
const STORAGE_RETRY_ATTEMPTS = 3;
const STORAGE_RETRY_BASE_DELAY = 100; // Base delay in milliseconds for exponential backoff


