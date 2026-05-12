// Options page script for Alto Translate extension
import { animate } from '../vendor/motion-lib.js';

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

class OptionsManager {
  constructor() {
    this.settings = null;
    this.init();
  }

  async init() {
    // Load current settings
    await this.loadSettings();
    
    // Update version display
    this.updateVersion();
    
    // Populate form
    this.populateForm();
    await this.refreshOpenVocabNewTabCheckbox();

    // Load themes and render selector
    await this.loadThemes();
    
    // Load cache statistics
    await this.loadCacheStats();
    
    // Initialize tabs
    this.initTabs();
    
    // Add event listeners
    this.addEventListeners();
  }

  updateVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      const version = manifest.version || '1.1.0';
      const versionElement = document.getElementById('versionDisplay');
      const versionFooter = document.getElementById('versionFooter');
      if (versionElement) {
        versionElement.textContent = `v${version}`;
      }
      if (versionFooter) {
        versionFooter.textContent = `Version ${version}`;
      }
    } catch (error) {
      console.error('Error getting version:', error);
    }
  }

  initTabs() {
    // Set default tab to 'api'
    this.switchTab('api');
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('is-active');
      button.removeAttribute('aria-current');
    });

    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
      selectedTab.classList.remove('hidden');
      if (!prefersReducedMotion()) {
        requestAnimationFrame(() => {
          void animate(selectedTab, { opacity: [0, 1], y: [6, 0] }, { duration: 1, ease: [0.33, 1, 0.68, 1] });
        });
      }
    }

    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedButton) {
      selectedButton.classList.add('is-active');
      selectedButton.setAttribute('aria-current', 'page');
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

    // Disable input fields setting
    const disableInputFields = document.getElementById('disableInputFields');
    if (disableInputFields) {
      disableInputFields.checked = this.settings.disableInputFields || false;
    }

    const showPhoneticsNonLatin = document.getElementById('showPhoneticsNonLatin');
    if (showPhoneticsNonLatin) {
      showPhoneticsNonLatin.checked = this.settings.showPhoneticsNonLatin !== false;
    }

    this.updateApiCardStatus();
  }

  async refreshOpenVocabNewTabCheckbox() {
    const el = document.getElementById('openVocabNewTab');
    if (!el) return;
    try {
      const r = await chrome.storage.local.get('altoOpenVocabularyNewTab');
      el.checked = r.altoOpenVocabularyNewTab === true;
    } catch (error) {
      console.error('Error loading new-tab vocabulary preference:', error);
    }
  }

  updateApiCardStatus() {
    const geminiInput = document.getElementById('geminiApiKey');
    const openrouterInput = document.getElementById('openrouterApiKey');
    const gemini = geminiInput?.value?.trim() ?? '';
    const openrouter = openrouterInput?.value?.trim() ?? '';

    const setRow = (forName, dotClass, labelText) => {
      const wrap = document.querySelector(`[data-status-for="${forName}"]`);
      if (!wrap) return;
      const dot = wrap.querySelector('.status-dot');
      const label = wrap.querySelector('.status-label');
      if (dot) {
        dot.className = `status-dot ${dotClass}`;
      }
      if (label) {
        label.textContent = labelText;
      }
    };

    setRow('gemini', gemini ? 'status-dot--ok' : 'status-dot--muted', gemini ? 'Key saved' : 'No key');
    setRow('openrouter', openrouter ? 'status-dot--ok' : 'status-dot--muted', openrouter ? 'Key saved' : 'No key');

    const keyCount = (gemini ? 1 : 0) + (openrouter ? 1 : 0);
    if (keyCount === 0) {
      setRow('both', 'status-dot--muted', 'No keys');
    } else if (keyCount === 1) {
      setRow('both', 'status-dot--warn', '1 key');
    } else {
      setRow('both', 'status-dot--ok', '2 keys');
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
      
      const checkSvg = `<span class="theme-option-check-wrap" style="color:${colors.text};"><svg xmlns="http://www.w3.org/2000/svg" class="theme-option-check" width="14" height="14" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></span>`;
      return `
        <label class="theme-option ${isSelected ? 'selected' : ''}" data-theme="${key}">
          <input type="radio" name="popupTheme" value="${key}" ${isSelected ? 'checked' : ''} class="theme-option-input">
          <div class="theme-preview theme-preview-card ${isSelected ? 'theme-preview--selected' : ''}" 
               style="background: ${colors.background}; border-color: ${colors.border};">
            <div class="theme-mini-popup" aria-hidden="true">
              <div class="theme-mini-header" style="border-bottom: 1px solid ${colors.headerBorder};">
                <span class="theme-mini-title" style="color: ${colors.text};">Translate</span>
                ${isSelected ? checkSvg : ''}
              </div>
              <div class="theme-mini-body">
                <p class="theme-mini-src" style="color: ${colors.textSecondary};">Hello, world</p>
                <p class="theme-mini-translation" style="color: ${colors.translatedText};">Hola, mundo</p>
              </div>
              <div class="theme-mini-footer">
                <span class="theme-mini-chip" style="background: ${colors.buttonBg}; color: ${colors.buttonText};">Copy</span>
              </div>
            </div>
          </div>
          <div class="theme-option-caption">
            <span class="theme-option-caption-title">${theme.name}</span>
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
          const checkColor = this.themes[themeKey]?.colors?.text ?? '#374151';
          const checkSvg = `<span class="theme-option-check-wrap" style="color:${checkColor};"><svg xmlns="http://www.w3.org/2000/svg" class="theme-option-check" width="14" height="14" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></span>`;
          themeSelector.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.remove('selected');
            const preview = opt.querySelector('.theme-preview');
            if (preview) {
              preview.classList.remove('theme-preview--selected');
            }
            opt.querySelectorAll('.theme-option-check-wrap').forEach(el => el.remove());
          });
          
          option.classList.add('selected');
          const preview = option.querySelector('.theme-preview');
          if (preview) {
            preview.classList.add('theme-preview--selected');
          }
          
          const titleEl = option.querySelector('.theme-mini-title');
          const headerEl = option.querySelector('.theme-mini-header');
          if (titleEl && headerEl && !headerEl.querySelector('.theme-option-check-wrap')) {
            titleEl.insertAdjacentHTML('afterend', checkSvg);
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
        this.updateApiCardStatus();
      });
    }
    
    if (openrouterApiKey) {
      openrouterApiKey.addEventListener('input', () => {
        this.validateApiKey('openrouter', openrouterApiKey.value);
        this.updateApiCardStatus();
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

    const showPhoneticsEl = document.getElementById('showPhoneticsNonLatin');
    if (showPhoneticsEl) {
      showPhoneticsEl.addEventListener('change', async () => {
        try {
          await chrome.storage.local.set({ altoShowPhoneticsNonLatin: showPhoneticsEl.checked });
        } catch (error) {
          console.error('Error saving phonetics preference:', error);
        }
      });
    }

    const openVocabNewTabEl = document.getElementById('openVocabNewTab');
    if (openVocabNewTabEl) {
      openVocabNewTabEl.addEventListener('change', async () => {
        try {
          await chrome.storage.local.set({ altoOpenVocabularyNewTab: openVocabNewTabEl.checked });
        } catch (error) {
          console.error('Error saving new-tab preference:', error);
        }
      });
    }

    const vocabPageUrl = chrome.runtime.getURL('vocabulary/vocabulary.html');
    const openFooterVocab = document.getElementById('openVocabularyPageFooter');
    if (openFooterVocab) {
      openFooterVocab.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: vocabPageUrl });
      });
    }
    const openSettingsVocab = document.getElementById('openVocabularyFromSettings');
    if (openSettingsVocab) {
      openSettingsVocab.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: vocabPageUrl });
      });
    }

    const clearAllVocabBtn = document.getElementById('clearAllVocabularyBtn');
    if (clearAllVocabBtn) {
      clearAllVocabBtn.addEventListener('click', () => {
        void this.clearAllVocabulary();
      });
    }
  }

  async clearAllVocabulary() {
    if (!confirm('Delete all saved vocabulary and today’s review progress? This cannot be undone.')) {
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearVocabulary' });
      if (response?.success) {
        this.showStatus('success', 'Cleared', 'All vocabulary entries were removed.');
      } else {
        this.showStatus('error', 'Error', response?.error ?? 'Failed to clear vocabulary');
      }
    } catch (error) {
      console.error('clearAllVocabulary:', error);
      this.showStatus('error', 'Error', error?.message ?? 'Failed to clear vocabulary');
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
    const disableInputFieldsCheckbox = document.getElementById('disableInputFields');
    const apiPreference = formData.get('apiPreference');
    const settings = {
      apiPreference,
      geminiApiKey: formData.get('geminiApiKey'),
      openrouterApiKey: formData.get('openrouterApiKey'),
      // libretranslateEnabled is true when the user selects libretranslate or "both" mode
      libretranslateEnabled: apiPreference === 'libretranslate' || apiPreference === 'both',
      sourceLanguage: formData.get('sourceLanguage'),
      targetLanguage: formData.get('targetLanguage'),
      popupTheme: formData.get('popupTheme') || 'default',
      disableInputFields: disableInputFieldsCheckbox ? disableInputFieldsCheckbox.checked : false,
      // MyMemory is always on (legacy field for storage compatibility)
      libretranslateEnabled: true
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
    // MyMemory/LibreTranslate never needs an API key — always valid
    if (settings.apiPreference === 'libretranslate') {
      return true;
    }

    if (settings.apiPreference === 'gemini' && !settings.geminiApiKey) {
      this.showStatus('error', 'Validation Error', 'Please provide a Gemini API key');
      return false;
    }

    if (settings.apiPreference === 'openrouter' && !settings.openrouterApiKey) {
      this.showStatus('error', 'Validation Error', 'Please provide an OpenRouter API key');
      return false;
    }

    // "Use All" mode works with any combination; MyMemory is always available as fallback
    if (settings.apiPreference === 'both' && !settings.geminiApiKey && !settings.openrouterApiKey) {
      this.showStatus('error', 'Validation Error', 'Please provide at least one API key for "Use All" mode');
      return false;
    }

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
        testResult.className = 'test-result test-result-success';
        testResult.classList.remove('hidden');
        this.showStatus('success', 'Test Successful', 'Translation completed successfully');
      } else {
        testResultText.textContent = `Error: ${response?.error ?? 'Unknown error'}`;
        testResult.className = 'test-result test-result-error';
        testResult.classList.remove('hidden');
        this.showStatus('error', 'Test Failed', response?.error ?? 'Translation failed');
      }
    } catch (error) {
      console.error('Test translation error:', error);
      testResultText.textContent = `Error: ${error?.message ?? 'Unknown error'}`;
      testResult.className = 'test-result test-result-error';
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
        libretranslateEnabled: false,
        sourceLanguage: 'auto',
        targetLanguage: 'en',
        popupTheme: 'default',
        disableInputFields: false
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showStatus(type, title, message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    title = this.escapeHtml(String(title));
    message = this.escapeHtml(String(message));

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
