// Options page script for Alto Translate extension

class OptionsManager {
  constructor() {
    this.settings = null;
    this.init();
  }

  async init() {
    // Load current settings
    await this.loadSettings();
    
    // Populate form
    this.populateForm();
    
    // Add event listeners
    this.addEventListeners();
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        this.settings = response.settings;
      } else {
        console.error('Failed to load settings:', response.error);
        this.showStatus('error', 'Error', 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('error', 'Error', 'Failed to load settings');
    }
  }

  populateForm() {
    if (!this.settings) return;

    // API preference
    const apiPreference = document.querySelector(`input[name="apiPreference"][value="${this.settings.apiPreference}"]`);
    if (apiPreference) {
      apiPreference.checked = true;
    }

    // API keys
    const geminiApiKey = document.getElementById('geminiApiKey');
    const openrouterApiKey = document.getElementById('openrouterApiKey');
    
    if (geminiApiKey) {
      geminiApiKey.value = this.settings.geminiApiKey || '';
    }
    
    if (openrouterApiKey) {
      openrouterApiKey.value = this.settings.openrouterApiKey || '';
    }

    // Languages
    const sourceLanguage = document.getElementById('sourceLanguage');
    const targetLanguage = document.getElementById('targetLanguage');
    
    if (sourceLanguage) {
      sourceLanguage.value = this.settings.sourceLanguage || 'auto';
    }
    
    if (targetLanguage) {
      targetLanguage.value = this.settings.targetLanguage || 'en';
    }
  }

  addEventListeners() {
    // Form submission
    const form = document.getElementById('settingsForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }

    // API key visibility toggles
    const toggleGeminiKey = document.getElementById('toggleGeminiKey');
    const toggleOpenRouterKey = document.getElementById('toggleOpenRouterKey');
    
    if (toggleGeminiKey) {
      toggleGeminiKey.addEventListener('click', () => {
        this.togglePasswordVisibility('geminiApiKey', toggleGeminiKey);
      });
    }
    
    if (toggleOpenRouterKey) {
      toggleOpenRouterKey.addEventListener('click', () => {
        this.togglePasswordVisibility('openrouterApiKey', toggleOpenRouterKey);
      });
    }

    // Test translation
    const testBtn = document.getElementById('testBtn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.testTranslation();
      });
    }

    // Reset to defaults
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetToDefaults();
      });
    }

    // API key validation
    const geminiApiKey = document.getElementById('geminiApiKey');
    const openrouterApiKey = document.getElementById('openrouterApiKey');
    const validateGeminiBtn = document.getElementById('validateGeminiBtn');
    const validateOpenRouterBtn = document.getElementById('validateOpenRouterBtn');
    const validateLibreTranslateBtn = document.getElementById('validateLibreTranslateBtn');
    
    if (geminiApiKey) {
      geminiApiKey.addEventListener('input', () => {
        this.validateApiKey('gemini', geminiApiKey.value);
      });
    }
    
    if (openrouterApiKey) {
      openrouterApiKey.addEventListener('input', () => {
        this.validateApiKey('openrouter', openrouterApiKey.value);
      });
    }

    if (validateGeminiBtn) {
      validateGeminiBtn.addEventListener('click', () => {
        this.validateApiKeyWithServer('gemini', geminiApiKey.value);
      });
    }

    if (validateOpenRouterBtn) {
      validateOpenRouterBtn.addEventListener('click', () => {
        this.validateApiKeyWithServer('openrouter', openrouterApiKey.value);
      });
    }

    if (validateLibreTranslateBtn) {
      validateLibreTranslateBtn.addEventListener('click', () => {
        this.validateApiKeyWithServer('libretranslate', '');
      });
    }
  }

  togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      button.innerHTML = '🙈';
    } else {
      input.type = 'password';
      button.innerHTML = '👁️';
    }
  }

  validateApiKey(apiType, apiKey) {
    const input = document.getElementById(`${apiType}ApiKey`);
    if (!input) return;

    // Remove existing validation classes
    input.classList.remove('api-key-valid', 'api-key-invalid');

    if (!apiKey.trim()) {
      return; // Don't validate empty keys
    }

    let isValid = false;
    
    switch (apiType) {
      case 'gemini':
        // Gemini API keys typically start with 'AIza' and are 39 characters long
        isValid = apiKey.startsWith('AIza') && apiKey.length === 39;
        break;
      case 'openrouter':
        // OpenRouter API key validation - typically starts with 'sk-or-'
        isValid = apiKey.startsWith('sk-or-') && apiKey.length > 20;
        break;
    }

    if (isValid) {
      input.classList.add('api-key-valid');
    } else {
      input.classList.add('api-key-invalid');
    }
  }

  async saveSettings() {
    const formData = new FormData(document.getElementById('settingsForm'));
    const settings = {
      apiPreference: formData.get('apiPreference'),
      geminiApiKey: formData.get('geminiApiKey'),
      openrouterApiKey: formData.get('openrouterApiKey'),
      sourceLanguage: formData.get('sourceLanguage'),
      targetLanguage: formData.get('targetLanguage')
    };

    // Validate settings
    if (!this.validateSettings(settings)) {
      return;
    }

    // Show loading state
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner inline-block mr-2"></div>Saving...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: settings
      });

      if (response.success) {
        this.settings = settings;
        this.showStatus('success', 'Success', 'Settings saved successfully');
      } else {
        this.showStatus('error', 'Error', response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus('error', 'Error', 'Failed to save settings');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  }

  validateSettings(settings) {
    // Check if at least one translation service is available
    if (!settings.geminiApiKey && !settings.openrouterApiKey && !settings.libretranslateEnabled) {
      this.showStatus('error', 'Validation Error', 'Please provide at least one API key or enable LibreTranslate');
      return false;
    }

    // Check if selected API has a key (LibreTranslate doesn't need a key)
    if (settings.apiPreference === 'gemini' && !settings.geminiApiKey) {
      this.showStatus('error', 'Validation Error', 'Please provide a Gemini API key');
      return false;
    }

    if (settings.apiPreference === 'openrouter' && !settings.openrouterApiKey) {
      this.showStatus('error', 'Validation Error', 'Please provide an OpenRouter API key');
      return false;
    }

    // LibreTranslate doesn't need validation - it's always available

    return true;
  }

  async testTranslation() {
    const testText = document.getElementById('testText').value.trim();
    if (!testText) {
      this.showStatus('warning', 'Warning', 'Please enter test text');
      return;
    }

    const testBtn = document.getElementById('testBtn');
    const testResult = document.getElementById('testResult');
    const testResultText = document.getElementById('testResultText');

    // Show loading state
    const originalText = testBtn.innerHTML;
    testBtn.disabled = true;
    testBtn.innerHTML = '<div class="spinner inline-block mr-2"></div>Testing...';
    testResult.classList.add('hidden');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: testText,
        targetLanguage: this.settings.targetLanguage,
        sourceLanguage: this.settings.sourceLanguage
      });

      if (response.success) {
        testResultText.textContent = response.translatedText;
        testResult.className = 'p-4 bg-gray-50 rounded-lg test-result-success';
        testResult.classList.remove('hidden');
        this.showStatus('success', 'Test Successful', 'Translation completed successfully');
      } else {
        testResultText.textContent = `Error: ${response.error}`;
        testResult.className = 'p-4 bg-gray-50 rounded-lg test-result-error';
        testResult.classList.remove('hidden');
        this.showStatus('error', 'Test Failed', response.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Test translation error:', error);
      testResultText.textContent = `Error: ${error.message}`;
      testResult.className = 'p-4 bg-gray-50 rounded-lg test-result-error';
      testResult.classList.remove('hidden');
      this.showStatus('error', 'Test Failed', 'Failed to connect to translation service');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = originalText;
    }
  }

  async resetToDefaults() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This will clear your API keys.')) {
      return;
    }

    const defaultSettings = {
      apiPreference: 'gemini',
      geminiApiKey: '',
      openrouterApiKey: '',
      sourceLanguage: 'auto',
      targetLanguage: 'en'
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: defaultSettings
      });

      if (response.success) {
        this.settings = defaultSettings;
        this.populateForm();
        this.showStatus('success', 'Reset Complete', 'Settings have been reset to defaults');
      } else {
        this.showStatus('error', 'Error', 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      this.showStatus('error', 'Error', 'Failed to reset settings');
    }
  }

  showStatus(type, title, message) {
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusText = document.getElementById('statusText');

    if (!statusMessage || !statusIcon || !statusTitle || !statusText) return;

    // Set icon based on type
    switch (type) {
      case 'success':
        statusIcon.innerHTML = '✅';
        statusIcon.className = 'w-5 h-5 mr-3 text-green-500';
        break;
      case 'error':
        statusIcon.innerHTML = '❌';
        statusIcon.className = 'w-5 h-5 mr-3 text-red-500';
        break;
      case 'warning':
        statusIcon.innerHTML = '⚠️';
        statusIcon.className = 'w-5 h-5 mr-3 text-yellow-500';
        break;
      default:
        statusIcon.innerHTML = 'ℹ️';
        statusIcon.className = 'w-5 h-5 mr-3 text-blue-500';
    }

    statusTitle.textContent = title;
    statusText.textContent = message;

    // Show message
    statusMessage.classList.remove('hidden');
    statusMessage.classList.add('status-message');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusMessage.classList.add('hide');
      setTimeout(() => {
        statusMessage.classList.add('hidden');
        statusMessage.classList.remove('status-message', 'hide');
      }, 300);
    }, 5000);
  }

  async validateApiKeyWithServer(apiType, apiKey) {
    // LibreTranslate doesn't need an API key
    if (apiType !== 'libretranslate' && !apiKey.trim()) {
      this.showStatus('warning', 'Warning', 'Please enter an API key first');
      return;
    }

    // Handle special case for OpenRouter (capital R)
    const buttonId = apiType === 'openrouter' ? 'validateOpenRouterBtn' : 
                     apiType === 'libretranslate' ? 'validateLibreTranslateBtn' : 
                     `validate${apiType.charAt(0).toUpperCase() + apiType.slice(1)}Btn`;
    const button = document.getElementById(buttonId);
    
    if (!button) {
      this.showStatus('error', 'Error', 'Validation button not found');
      return;
    }
    
    const originalText = button.textContent;
    
    button.disabled = true;
    button.textContent = apiType === 'libretranslate' ? 'Testing...' : 'Validating...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateApiKey',
        apiKey: apiKey,
        apiType: apiType
      });

      if (response.success) {
        this.showStatus('success', 'API Key Valid', response.message);
      } else {
        this.showStatus('error', 'API Key Invalid', response.error);
      }
    } catch (error) {
      this.showStatus('error', 'Validation Failed', error.message);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});
