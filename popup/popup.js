// Popup script for Alto Translate extension

class PopupManager {
  constructor() {
    this.settings = null;
    this.init();
  }

  async init() {
    // Load settings
    await this.loadSettings();
    
    // Update UI
    this.updateUI();
    
    // Check API status
    this.checkApiStatus();
    
    // Add event listeners
    this.addEventListeners();
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        this.settings = response.settings;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  updateUI() {
    if (!this.settings) return;

    // Update current settings display
    const currentApi = document.getElementById('currentApi');
    const currentTarget = document.getElementById('currentTarget');
    
    if (currentApi) {
      currentApi.textContent = this.settings.apiPreference.toUpperCase();
    }
    
    if (currentTarget) {
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
      currentTarget.textContent = languageNames[this.settings.targetLanguage] || this.settings.targetLanguage;
    }
  }

  async checkApiStatus() {
    // Check Gemini API
    this.updateApiStatus('gemini', 'checking');
    if (this.settings && this.settings.geminiApiKey) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'translate',
          text: 'test',
          targetLanguage: 'en',
          sourceLanguage: 'auto'
        });
        this.updateApiStatus('gemini', response.success ? 'connected' : 'disconnected');
      } catch (error) {
        this.updateApiStatus('gemini', 'disconnected');
      }
    } else {
      this.updateApiStatus('gemini', 'disconnected');
    }

    // Check OpenRouter API
    this.updateApiStatus('openrouter', 'checking');
    if (this.settings && this.settings.openrouterApiKey) {
      try {
        // Note: This is a placeholder - actual OpenRouter API testing would go here
        this.updateApiStatus('openrouter', 'disconnected'); // Placeholder
      } catch (error) {
        this.updateApiStatus('openrouter', 'disconnected');
      }
    } else {
      this.updateApiStatus('openrouter', 'disconnected');
    }
  }

  updateApiStatus(api, status) {
    const statusElement = document.getElementById(`${api}Status`);
    if (!statusElement) return;

    const indicator = statusElement.querySelector('.w-2');
    const text = statusElement.querySelector('span');

    if (!indicator || !text) return;

    // Remove existing classes
    indicator.className = 'w-2 h-2 rounded-full mr-2 status-indicator';
    
    switch (status) {
      case 'connected':
        indicator.classList.add('connected');
        text.textContent = 'Connected';
        text.className = 'text-xs text-green-600';
        break;
      case 'disconnected':
        indicator.classList.add('disconnected');
        text.textContent = 'Not configured';
        text.className = 'text-xs text-red-600';
        break;
      case 'checking':
        indicator.classList.add('checking');
        text.textContent = 'Checking...';
        text.className = 'text-xs text-yellow-600';
        break;
    }
  }

  addEventListeners() {
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // Open settings button
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // Test translation button
    const testTranslationBtn = document.getElementById('testTranslationBtn');
    if (testTranslationBtn) {
      testTranslationBtn.addEventListener('click', () => {
        this.showTestModal();
      });
    }

    // Help link
    const helpLink = document.getElementById('helpLink');
    if (helpLink) {
      helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHelp();
      });
    }
  }

  showTestModal() {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'test-modal';
    modal.innerHTML = `
      <div class="test-modal-content">
        <h3 class="text-lg font-semibold mb-4">Test Translation</h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Test Text:</label>
          <textarea id="testText" class="w-full p-2 border border-gray-300 rounded-lg text-sm" rows="3" placeholder="Enter text to translate...">Hello, world!</textarea>
        </div>
        <div class="flex space-x-2">
          <button id="testTranslateBtn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium">
            Translate
          </button>
          <button id="closeTestModal" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium">
            Cancel
          </button>
        </div>
        <div id="testResult" class="mt-4 p-3 bg-gray-50 rounded-lg hidden">
          <div class="text-sm font-medium text-gray-700 mb-1">Result:</div>
          <div id="testResultText" class="text-sm text-gray-600"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    const testTranslateBtn = modal.querySelector('#testTranslateBtn');
    const closeTestModal = modal.querySelector('#closeTestModal');
    const testText = modal.querySelector('#testText');
    const testResult = modal.querySelector('#testResult');
    const testResultText = modal.querySelector('#testResultText');

    testTranslateBtn.addEventListener('click', async () => {
      const text = testText.value.trim();
      if (!text) return;

      testTranslateBtn.disabled = true;
      testTranslateBtn.innerHTML = '<div class="spinner inline-block mr-2"></div>Translating...';

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'translate',
          text: text,
          targetLanguage: this.settings.targetLanguage,
          sourceLanguage: 'auto'
        });

        if (response.success) {
          testResultText.textContent = response.translatedText;
          testResult.classList.remove('hidden');
        } else {
          testResultText.textContent = `Error: ${response.error}`;
          testResult.classList.remove('hidden');
        }
      } catch (error) {
        testResultText.textContent = `Error: ${error.message}`;
        testResult.classList.remove('hidden');
      }

      testTranslateBtn.disabled = false;
      testTranslateBtn.innerHTML = 'Translate';
    });

    closeTestModal.addEventListener('click', () => {
      modal.remove();
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  showHelp() {
    // Create help modal
    const modal = document.createElement('div');
    modal.className = 'test-modal';
    modal.innerHTML = `
      <div class="test-modal-content">
        <h3 class="text-lg font-semibold mb-4">Help & Support</h3>
        <div class="space-y-3 text-sm text-gray-600">
          <div>
            <h4 class="font-medium text-gray-800 mb-1">Getting Started:</h4>
            <p>1. Configure your API keys in Settings</p>
            <p>2. Select text on any webpage</p>
            <p>3. Click the "ax" icon to translate</p>
          </div>
          <div>
            <h4 class="font-medium text-gray-800 mb-1">API Keys:</h4>
            <p>• Gemini: Get free API key from Google AI Studio</p>
            <p>• OpenRouter: Get API key from openrouter.ai</p>
          </div>
          <div>
            <h4 class="font-medium text-gray-800 mb-1">Features:</h4>
            <p>• Auto-detect source language</p>
            <p>• Support for 20+ languages</p>
            <p>• Copy translated text</p>
            <p>• Dark mode support</p>
          </div>
        </div>
        <button id="closeHelpModal" class="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium">
          Got it
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeHelpModal = modal.querySelector('#closeHelpModal');
    closeHelpModal.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
