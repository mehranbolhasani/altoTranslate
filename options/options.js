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
    
    // Load themes and render selector
    await this.loadThemes();
    
    // Load cache statistics
    await this.loadCacheStats();
    
    // Initialize tabs
    this.initTabs();
    
    // Add event listeners
    this.addEventListeners();
  }

  initTabs() {
    // Set default tab to 'api'
    this.switchTab('api');
  }

  switchTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.classList.add('hidden');
    });

    // Remove active state from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.classList.remove('active', 'text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
      button.classList.add('text-gray-500', 'dark:text-gray-400');
    });

    // Show selected tab content
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
      selectedTab.classList.remove('hidden');
    }

    // Activate selected tab button
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedButton) {
      selectedButton.classList.add('active', 'text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
      selectedButton.classList.remove('text-gray-500', 'dark:text-gray-400');
    }
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response?.success) {
        this.settings = response.settings;
      } else {
        console.error('Failed to load settings:', response?.error);
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

    // Popup theme
    const popupTheme = this.settings.popupTheme || 'default';
    const themeRadio = document.querySelector(`input[name="popupTheme"][value="${popupTheme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }
  }

  async loadThemes() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getThemes' });
      
      if (response?.success && response.themes) {
        this.themes = response.themes;
        this.renderThemeSelector();
      } else {
        console.error('Failed to load themes:', response?.error);
      }
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  }

  renderThemeSelector() {
    const themeSelector = document.getElementById('themeSelector');
    if (!themeSelector || !this.themes) return;

    const currentTheme = this.settings?.popupTheme || 'default';
    
    themeSelector.innerHTML = Object.entries(this.themes).map(([key, theme]) => {
      const colors = theme.colors;
      const isSelected = key === currentTheme;
      
      // Extract main colors for preview
      const bgColor = colors.background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const borderColor = colors.border;
      const textColor = colors.text;
      const buttonColor = colors.buttonText;
      
      return `
        <label class="theme-option ${isSelected ? 'selected' : ''}" data-theme="${key}">
          <input type="radio" name="popupTheme" value="${key}" ${isSelected ? 'checked' : ''} class="hidden">
          <div class="theme-preview border-2 rounded-lg p-3 cursor-pointer transition-all hover:scale-105 ${isSelected ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500 dark:ring-blue-400' : 'border-gray-200 dark:border-gray-600'}" 
               style="background: ${colors.background}; border-color: ${colors.border};">
            <div class="flex items-center justify-between mb-2">
              <div class="font-medium text-sm" style="color: ${colors.text};">${theme.name}</div>
              ${isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>' : ''}
            </div>
            <div class="text-xs mb-3" style="color: ${colors.textSecondary};">${theme.description}</div>
            <div class="flex gap-0 justify-end theme-preview-colors">
              <div class="h-8 w-8 rounded-full -translate-x-5" style="background: ${colors.background}; border: 1px solid ${colors.border};"></div>
              <div class="h-8 w-8 rounded-full -translate-x-5" style="background: ${colors.buttonBg}; border: 1px solid ${colors.buttonText};"></div>
              <div class="h-8 w-8 rounded-full -translate-x-5" style="background: ${colors.translatedText};"></div>
              <div class="h-8 w-8 rounded-full -translate-x-5" style="background: ${colors.text};"></div>
            </div>
          </div>
        </label>
      `;
    }).join('');

    // Add click handlers
    themeSelector.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const themeKey = option.getAttribute('data-theme');
        const radio = option.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          // Update visual selection
          themeSelector.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.remove('selected');
            const preview = opt.querySelector('.theme-preview');
            if (preview) {
              preview.classList.remove('border-blue-500', 'dark:border-blue-400', 'ring-2', 'ring-blue-500', 'dark:ring-blue-400');
              preview.classList.add('border-gray-200', 'dark:border-gray-600');
            }
            const checkIcon = opt.querySelector('svg');
            if (checkIcon) checkIcon.remove();
          });
          
          option.classList.add('selected');
          const preview = option.querySelector('.theme-preview');
          if (preview) {
            preview.classList.remove('border-gray-200', 'dark:border-gray-600');
            preview.classList.add('border-blue-500', 'dark:border-blue-400', 'ring-2', 'ring-blue-500', 'dark:ring-blue-400');
          }
          
          // Add checkmark
          const nameDiv = option.querySelector('.font-medium');
          if (nameDiv && nameDiv.nextElementSibling?.tagName !== 'svg') {
            nameDiv.insertAdjacentHTML('afterend', '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>');
          }
        }
      });
    });
  }

  addEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });

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

    // Cache management
    const refreshCacheStatsBtn = document.getElementById('refreshCacheStatsBtn');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    
    if (refreshCacheStatsBtn) {
      refreshCacheStatsBtn.addEventListener('click', () => {
        this.loadCacheStats();
      });
    }
    
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        this.clearCache();
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
      targetLanguage: formData.get('targetLanguage'),
      popupTheme: formData.get('popupTheme') || 'default'
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

      if (response?.success) {
        this.settings = settings;
        await this.loadThemes(); // Reload themes to update selection
        this.showStatus('success', 'Success', 'Settings saved successfully');
      } else {
        this.showStatus('error', 'Error', response?.error ?? 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus('error', 'Error', error?.message ?? 'Failed to save settings');
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

      if (response?.success) {
        testResultText.textContent = response.translatedText ?? '';
        testResult.className = 'p-4 bg-gray-50 rounded-lg test-result-success';
        testResult.classList.remove('hidden');
        this.showStatus('success', 'Test Successful', 'Translation completed successfully');
      } else {
        testResultText.textContent = `Error: ${response?.error ?? 'Unknown error'}`;
        testResult.className = 'p-4 bg-gray-50 rounded-lg test-result-error';
        testResult.classList.remove('hidden');
        this.showStatus('error', 'Test Failed', response?.error ?? 'Translation failed');
      }
    } catch (error) {
      console.error('Test translation error:', error);
      testResultText.textContent = `Error: ${error?.message ?? 'Unknown error'}`;
      testResult.className = 'p-4 bg-gray-50 rounded-lg test-result-error';
      testResult.classList.remove('hidden');
      this.showStatus('error', 'Test Failed', error?.message ?? 'Failed to connect to translation service');
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
        targetLanguage: 'en',
        popupTheme: 'default'
      };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: defaultSettings
      });

      if (response?.success) {
        this.settings = defaultSettings;
        this.populateForm();
        await this.loadThemes(); // Reload themes to update selection
        this.showStatus('success', 'Reset Complete', 'Settings have been reset to defaults');
      } else {
        this.showStatus('error', 'Error', response?.error ?? 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      this.showStatus('error', 'Error', error?.message ?? 'Failed to reset settings');
    }
  }

  showStatus(type, title, message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} pointer-events-auto`;
    
    // Set icon and colors based on type
    let icon, bgColor, borderColor, iconColor;
    switch (type) {
      case 'success':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        bgColor = 'bg-green-50 dark:bg-green-900/20';
        borderColor = 'border-green-200 dark:border-green-800';
        iconColor = 'text-green-600 dark:text-green-400';
        break;
      case 'error':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        bgColor = 'bg-red-50 dark:bg-red-900/20';
        borderColor = 'border-red-200 dark:border-red-800';
        iconColor = 'text-red-600 dark:text-red-400';
        break;
      case 'warning':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
        bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
        borderColor = 'border-yellow-200 dark:border-yellow-800';
        iconColor = 'text-yellow-600 dark:text-yellow-400';
        break;
      default:
        icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        bgColor = 'bg-blue-50 dark:bg-blue-900/20';
        borderColor = 'border-blue-200 dark:border-blue-800';
        iconColor = 'text-blue-600 dark:text-blue-400';
    }

    toast.innerHTML = `
      <div class="flex items-start gap-3 p-4 ${bgColor} border ${borderColor} rounded-lg shadow-lg max-w-sm">
        <div class="${iconColor} flex-shrink-0 mt-0.5">
          ${icon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">${title}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">${message}</div>
        </div>
        <button class="toast-close flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeToast(toast);
      });
    }

    // Auto-hide after 5 seconds
    const autoHideTimer = setTimeout(() => {
      this.removeToast(toast);
    }, 5000);

    // Store timer on toast for cleanup
    toast._autoHideTimer = autoHideTimer;
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    // Clear auto-hide timer if exists
    if (toast._autoHideTimer) {
      clearTimeout(toast._autoHideTimer);
    }

    // Animate out
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');

    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  async loadCacheStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCacheStats' });
      
      if (response?.success && response.stats) {
        const { stats } = response;
        
        const totalEntriesEl = document.getElementById('cacheTotalEntries');
        const validEntriesEl = document.getElementById('cacheValidEntries');
        const cacheSizeEl = document.getElementById('cacheSize');
        const cacheTTLEl = document.getElementById('cacheTTL');
        const memoryEntriesEl = document.getElementById('cacheMemoryEntries');
        const expiredEntriesEl = document.getElementById('cacheExpiredEntries');
        const usagePercentEl = document.getElementById('cacheUsagePercent');
        const maxSizeEl = document.getElementById('cacheMaxSize');
        
        if (totalEntriesEl) {
          totalEntriesEl.textContent = stats.totalEntries ?? 0;
        }
        
        if (validEntriesEl) {
          validEntriesEl.textContent = stats.validEntries ?? 0;
        }
        
        if (cacheSizeEl) {
          cacheSizeEl.textContent = `${stats.totalSizeMB ?? '0.00'} MB`;
        }
        
        if (cacheTTLEl) {
          cacheTTLEl.textContent = `${stats.cacheTTLDays ?? 7} days`;
        }
        
        if (memoryEntriesEl) {
          memoryEntriesEl.textContent = `${stats.memoryEntries ?? 0}`;
        }
        
        if (expiredEntriesEl) {
          expiredEntriesEl.textContent = `${stats.expiredEntries ?? 0}`;
        }
        
        if (usagePercentEl) {
          const usagePercent = parseFloat(stats.usagePercent ?? '0');
          usagePercentEl.textContent = `${usagePercent}%`;
          
          // Color code based on usage
          if (usagePercent >= 90) {
            usagePercentEl.className = 'font-medium text-red-600 dark:text-red-400';
          } else if (usagePercent >= 70) {
            usagePercentEl.className = 'font-medium text-yellow-600 dark:text-yellow-400';
          } else {
            usagePercentEl.className = 'font-medium text-green-600 dark:text-green-400';
          }
        }
        
        if (maxSizeEl) {
          maxSizeEl.textContent = `${stats.maxSizeMB ?? 8} MB`;
        }
      } else {
        console.error('Failed to load cache stats:', response?.error);
      }
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  }

  async clearCache() {
    if (!confirm('Are you sure you want to clear all cached translations? This action cannot be undone.')) {
      return;
    }

    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (!clearCacheBtn) return;
    
    const originalText = clearCacheBtn.textContent;
    clearCacheBtn.disabled = true;
    clearCacheBtn.textContent = 'Clearing...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearCache' });
      
      if (response?.success) {
        const cleared = response.cleared ?? 0;
        this.showStatus('success', 'Cache Cleared', `Successfully cleared ${cleared} cached translation${cleared !== 1 ? 's' : ''}`);
        
        // Refresh cache statistics
        await this.loadCacheStats();
      } else {
        this.showStatus('error', 'Error', response?.error ?? 'Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      this.showStatus('error', 'Error', error?.message ?? 'Failed to clear cache');
    } finally {
      clearCacheBtn.disabled = false;
      clearCacheBtn.textContent = originalText;
    }
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

      if (response?.success) {
        this.showStatus('success', 'API Key Valid', response.message ?? 'API key is valid');
      } else {
        this.showStatus('error', 'API Key Invalid', response?.error ?? 'API key validation failed');
      }
    } catch (error) {
      this.showStatus('error', 'Validation Failed', error?.message ?? 'API key validation failed');
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
