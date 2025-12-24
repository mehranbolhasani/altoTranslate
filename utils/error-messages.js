// Structured error messages with actionable steps
// Chrome Extension compatible - no CommonJS exports

/**
 * Error message structure
 * @typedef {Object} ErrorMessage
 * @property {string} message - User-friendly error message
 * @property {string[]} steps - Actionable steps to resolve the issue
 * @property {string} helpLink - Optional help link URL
 */

/**
 * Get structured error message for common error types
 * @param {string} errorType - Type of error
 * @param {Object} context - Additional context (error details, API type, etc.)
 * @returns {ErrorMessage} Structured error message
 */
function getErrorMessage(errorType, context = {}) {
  const errorMessages = {
    'NO_API_KEYS': {
      message: 'No translation services configured',
      steps: [
        'Open the extension settings',
        'Configure at least one API key (Gemini or OpenRouter)',
        'Or enable LibreTranslate/MyMemory API (no key required)',
        'Save your settings'
      ],
      helpLink: null
    },
    'GEMINI_API_KEY_MISSING': {
      message: 'Gemini API key not configured',
      steps: [
        'Get a free API key from Google AI Studio',
        'Open extension settings',
        'Enter your Gemini API key',
        'Click "Validate" to test the key',
        'Save your settings'
      ],
      helpLink: 'https://makersuite.google.com/app/apikey'
    },
    'OPENROUTER_API_KEY_MISSING': {
      message: 'OpenRouter API key not configured',
      steps: [
        'Get an API key from OpenRouter',
        'Open extension settings',
        'Enter your OpenRouter API key',
        'Click "Validate" to test the key',
        'Save your settings'
      ],
      helpLink: 'https://openrouter.ai/'
    },
    'LIBRETRANSLATE_DISABLED': {
      message: 'LibreTranslate (MyMemory API) is not enabled',
      steps: [
        'Open extension settings',
        'Select "MyMemory API" (LibreTranslate) as your translation service',
        'Or enable it as a fallback option',
        'Save your settings'
      ],
      helpLink: null
    },
    'INVALID_API_KEY': {
      message: `Invalid ${context.apiType || 'API'} key`,
      steps: [
        'Check that your API key is correct',
        'Verify the key hasn\'t expired',
        'Click "Validate" in settings to test the key',
        'Get a new key if needed'
      ],
      helpLink: context.apiType === 'gemini' ? 'https://makersuite.google.com/app/apikey' : 
                context.apiType === 'openrouter' ? 'https://openrouter.ai/' : null
    },
    'API_ERROR': {
      message: `${context.apiType || 'Translation'} API error: ${context.error || 'Unknown error'}`,
      steps: [
        'Check your internet connection',
        'Verify your API key is valid',
        'Check if the service is experiencing issues',
        'Try again in a few moments'
      ],
      helpLink: null
    },
    'RATE_LIMIT': {
      message: 'Rate limit exceeded',
      steps: [
        'You\'ve reached the API rate limit',
        'Wait a few minutes before trying again',
        'Consider upgrading your API plan',
        'Or switch to a different translation service'
      ],
      helpLink: null
    },
    'TEXT_TOO_LONG': {
      message: `Text too long (maximum ${context.maxLength || 5000} characters)`,
      steps: [
        'Select a shorter text segment',
        'Split long text into smaller parts',
        'Translate each part separately'
      ],
      helpLink: null
    },
    'TRANSLATION_FAILED': {
      message: 'Translation failed',
      steps: [
        'Check your internet connection',
        'Verify your API keys are configured correctly',
        'Try selecting the text again',
        'Check the extension settings'
      ],
      helpLink: null
    },
    'NETWORK_ERROR': {
      message: 'Network error - unable to connect',
      steps: [
        'Check your internet connection',
        'Verify you can access the internet',
        'Check firewall settings',
        'Try again in a few moments'
      ],
      helpLink: null
    },
    'UNKNOWN_ERROR': {
      message: context.error || 'An unexpected error occurred',
      steps: [
        'Try selecting the text again',
        'Reload the page',
        'Check extension settings',
        'Report the issue if it persists'
      ],
      helpLink: null
    }
  };

  return errorMessages[errorType] || errorMessages['UNKNOWN_ERROR'];
}

/**
 * Format error message for display
 * @param {string} errorType - Type of error
 * @param {Object} context - Additional context
 * @returns {string} Formatted error message with steps
 */
function formatErrorMessage(errorType, context = {}) {
  const error = getErrorMessage(errorType, context);
  let message = error.message;
  
  if (error.steps && error.steps.length > 0) {
    message += '\n\nSteps to resolve:\n';
    error.steps.forEach((step, index) => {
      message += `${index + 1}. ${step}\n`;
    });
  }
  
  return message;
}

/**
 * Get error type from error message string
 * @param {string} errorMessage - Error message string
 * @returns {string} Error type
 */
function getErrorTypeFromMessage(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return 'UNKNOWN_ERROR';
  }

  const lowerMessage = errorMessage.toLowerCase();
  
  if (lowerMessage.includes('no translation services') || lowerMessage.includes('no api')) {
    return 'NO_API_KEYS';
  }
  if (lowerMessage.includes('gemini') && (lowerMessage.includes('not configured') || lowerMessage.includes('missing'))) {
    return 'GEMINI_API_KEY_MISSING';
  }
  if (lowerMessage.includes('openrouter') && (lowerMessage.includes('not configured') || lowerMessage.includes('missing'))) {
    return 'OPENROUTER_API_KEY_MISSING';
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    return 'RATE_LIMIT';
  }
  if (lowerMessage.includes('too long') || lowerMessage.includes('maximum')) {
    return 'TEXT_TOO_LONG';
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    return 'NETWORK_ERROR';
  }
  if (lowerMessage.includes('invalid') && lowerMessage.includes('key')) {
    return 'INVALID_API_KEY';
  }
  
  return 'UNKNOWN_ERROR';
}

