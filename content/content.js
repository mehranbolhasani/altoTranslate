// Content script for text selection and translation popup

class AltoTranslate {
  constructor() {
    this.selectedText = '';
    this.selectionRange = null;
    this.translateIcon = null;
    this.translatePopup = null;
    this.isPopupOpen = false;
    this.debounceTimer = null;
    this.autoHideTimer = null; // Track auto-hide timer
    this.hideTimer = null; // Track hide timer
    this.settings = null;
    this.mousePosition = { x: 0, y: 0 }; // Track mouse position
    this.detectedThemeCache = null; // Cache detected theme per page
    this.themeCachePageUrl = null; // Track which page the cache is for
    
    // Bind methods to preserve context
    this.handleTextSelection = this.handleTextSelection.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleSettingsUpdate = this.handleSettingsUpdate.bind(this);
    
    this.init();
  }

  async init() {
    // Load settings
    await this.loadSettings();
    
    // Detect webpage theme (with caching)
    this.detectedTheme = this.getDetectedTheme();
    
    // Add event listeners
    document.addEventListener('mouseup', this.handleTextSelection);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeydown);
    
    // Listen for settings changes
    chrome.runtime.onMessage.addListener(this.handleSettingsUpdate);
    
    // Clear theme cache on page visibility change (indicates navigation)
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Page became visible, might be a new page - clear cache
          this.clearThemeCache();
        }
      });
    }
  }

  /**
   * Get detected theme with caching
   * @returns {string} 'dark' or 'light'
   */
  getDetectedTheme() {
    const currentUrl = window.location.href;
    
    // Check if cache is valid for current page
    if (this.detectedThemeCache && this.themeCachePageUrl === currentUrl) {
      return this.detectedThemeCache;
    }
    
    // Cache miss - detect theme
    const theme = this.detectWebpageTheme();
    this.detectedThemeCache = theme;
    this.themeCachePageUrl = currentUrl;
    
    return theme;
  }

  /**
   * Clear theme detection cache
   * Call this when page navigation is detected
   */
  clearThemeCache() {
    this.detectedThemeCache = null;
    this.themeCachePageUrl = null;
  }

  /**
   * Detect the webpage's dominant theme (light or dark)
   * @returns {string} 'dark' or 'light'
   */
  detectWebpageTheme() {
    // Method 1: Check for common dark mode classes
    const darkModeClasses = ['dark', 'dark-mode', 'theme-dark', 'dark-theme'];
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    for (const className of darkModeClasses) {
      if (htmlElement.classList.contains(className) || 
          bodyElement.classList.contains(className)) {
        return 'dark';
      }
    }
    
    // Method 2: Check computed background color brightness
    try {
      const bodyStyle = window.getComputedStyle(bodyElement);
      const htmlStyle = window.getComputedStyle(htmlElement);
      
      // Get background color from body or html
      let bgColor = bodyStyle.backgroundColor || htmlStyle.backgroundColor;
      
      // If background is transparent, check parent elements
      if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
        // Try to get color from a visible element
        const sampleElements = document.querySelectorAll('div, section, article, main');
        for (const el of Array.from(sampleElements).slice(0, 10)) {
          const style = window.getComputedStyle(el);
          const color = style.backgroundColor;
          if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
            bgColor = color;
            break;
          }
        }
      }
      
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        const brightness = this.calculateBrightness(bgColor);
        // If brightness is less than 128 (midpoint), consider it dark
        return brightness < 128 ? 'dark' : 'light';
      }
    } catch (error) {
      // Error detecting theme from colors, continue with fallback
    }
    
    // Method 3: Check for dark mode data attributes
    if (htmlElement.getAttribute('data-theme') === 'dark' ||
        bodyElement.getAttribute('data-theme') === 'dark') {
      return 'dark';
    }
    
    // Method 4: Fallback to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    // Default to light
    return 'light';
  }

  /**
   * Calculate brightness of a color
   * @param {string} color - CSS color string (rgb, rgba, hex)
   * @returns {number} Brightness value (0-255)
   */
  calculateBrightness(color) {
    // Parse color string to RGB values
    let r, g, b;
    
    if (color.startsWith('rgb')) {
      // Parse rgb/rgba string
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        r = parseInt(matches[0], 10);
        g = parseInt(matches[1], 10);
        b = parseInt(matches[2], 10);
      }
    } else if (color.startsWith('#')) {
      // Parse hex color
      const hex = color.slice(1);
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    
    if (r !== undefined && g !== undefined && b !== undefined) {
      // Calculate relative luminance using standard formula
      // Y = 0.299*R + 0.587*G + 0.114*B
      return (r * 0.299 + g * 0.587 + b * 0.114);
    }
    
    // Default to light if we can't parse
    return 255;
  }

  /**
   * Apply theme to popup and icon elements
   * @param {HTMLElement} element - Element to apply theme to
   * @param {string} theme - Theme to apply ('dark' or 'light')
   */
  applyTheme(element, theme) {
    if (!element) return;
    
    if (theme === 'dark') {
      element.classList.add('alto-dark-theme');
      element.classList.remove('alto-light-theme');
    } else {
      element.classList.add('alto-light-theme');
      element.classList.remove('alto-dark-theme');
    }
  }

  /**
   * Apply custom theme colors to popup
   * @param {HTMLElement} popup - Popup element
   */
  async applyCustomTheme(popup) {
    if (!popup || !this.settings) {
      await this.loadSettings();
    }
    
    const themeName = this.settings?.popupTheme || 'default';
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getThemes' });
      if (response?.success && response.themes?.[themeName]) {
        const theme = response.themes[themeName];
        const colors = theme.colors;
        
        // Apply theme colors via CSS variables
        popup.style.setProperty('--alto-bg', colors.background);
        popup.style.setProperty('--alto-border', colors.border);
        popup.style.setProperty('--alto-text', colors.text);
        popup.style.setProperty('--alto-text-secondary', colors.textSecondary);
        popup.style.setProperty('--alto-header-border', colors.headerBorder);
        popup.style.setProperty('--alto-button-bg', colors.buttonBg);
        popup.style.setProperty('--alto-button-text', colors.buttonText);
        popup.style.setProperty('--alto-button-hover', colors.buttonHover);
        popup.style.setProperty('--alto-translated-text', colors.translatedText);
        popup.style.setProperty('--alto-error-bg', colors.errorBg);
        popup.style.setProperty('--alto-error-text', colors.errorText);
        popup.style.setProperty('--alto-error-border', colors.errorBorder);
        
        // Add theme class for CSS targeting
        popup.classList.add(`alto-theme-${themeName}`);
      }
    } catch (error) {
      console.error('Error applying custom theme:', error);
    }
  }

  handleSettingsUpdate(request, sender, sendResponse) {
    if (request.action === 'settingsUpdated') {
      this.loadSettings();
    }
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        this.settings = response.settings;
      } else {
        // Fallback to default settings if loading fails
        this.settings = { disableInputFields: false };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Fallback to default settings
      this.settings = { disableInputFields: false };
    }
  }
  
  /**
   * Check if the current selection is inside an input field or textarea
   * @returns {boolean} True if selection is in input/textarea
   */
  isSelectionInInputField() {
    // Method 1: Check active element first (most reliable for input fields)
    const activeElement = document.activeElement;
    if (activeElement) {
      const tagName = activeElement.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return true;
      }
    }
    
    // Method 2: Check all input and textarea elements to see if any have selection
    const allInputs = document.querySelectorAll('input, textarea');
    for (const input of allInputs) {
      // Check if input has text selection
      if (input.selectionStart !== undefined && input.selectionEnd !== undefined) {
        if (input.selectionStart !== input.selectionEnd) {
          return true;
        }
      }
    }
    
    // Method 3: Check selection range containers
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }
    
    const range = selection.getRangeAt(0);
    if (!range) {
      return false;
    }
    
    // Check start container
    let element = range.startContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    // Walk up the DOM tree
    while (element && element !== document.body && element !== document.documentElement) {
      const tagName = element.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return true;
      }
      element = element.parentElement;
    }
    
    // Check end container as well
    element = range.endContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    while (element && element !== document.body && element !== document.documentElement) {
      const tagName = element.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return true;
      }
      element = element.parentElement;
    }
    
    return false;
  }

  handleMouseMove(event) {
    // Track mouse position for icon positioning
    this.mousePosition = { x: event.clientX, y: event.clientY };
    
    // Don't move the icon once it's created - it should stay in place
    // The icon position is set when it's first created based on mouse position
  }

  handleTextSelection() {
    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Debounce the selection to avoid showing icon on accidental selections
    // DEBOUNCE_DELAY is defined in utils/constants.js (300ms)
    // For content scripts, we use a local constant since importScripts doesn't work here
    const DEBOUNCE_DELAY = 300; // Matches utils/constants.js
    this.debounceTimer = setTimeout(async () => {
      await this.processTextSelection();
      this.debounceTimer = null;
    }, DEBOUNCE_DELAY);
  }

  handleMouseDown(event) {
    // Don't hide popup during setup
    if (!this.popupSetupComplete) {
      return;
    }

    // Don't hide popup during translation
    if (this.translationInProgress) {
      return;
    }

    // Add a minimum time before popup can be hidden (prevent immediate hiding)
    // MIN_POPUP_DISPLAY_TIME is defined in utils/constants.js (2000ms)
    const MIN_POPUP_DISPLAY_TIME = 2000; // Matches utils/constants.js
    if (this.isPopupOpen && this.popupOpenTime) {
      const timeSinceOpen = Date.now() - this.popupOpenTime;
      if (timeSinceOpen < MIN_POPUP_DISPLAY_TIME) {
        return;
      }
    }

    // Don't hide popup immediately - let the user interact with it
    // Only hide if clicking on a completely different element
    if (this.isPopupOpen && this.translatePopup && 
        !this.translatePopup.contains(event.target) && 
        !this.translateIcon?.contains(event.target)) {
      
      // Check if the click is on the selected text or nearby
      // CLICK_TOLERANCE is defined in utils/constants.js (100px)
      const CLICK_TOLERANCE = 100; // Matches utils/constants.js
      const selection = window.getSelection();
      if (selection?.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const { clientX: clickX, clientY: clickY } = event;
        
        // If click is near the selected text, don't hide popup
        if (clickX >= rect.left - CLICK_TOLERANCE && 
            clickX <= rect.right + CLICK_TOLERANCE &&
            clickY >= rect.top - CLICK_TOLERANCE && 
            clickY <= rect.bottom + CLICK_TOLERANCE) {
          return;
        }
      }
      
      // Add a longer delay to prevent immediate hiding
      // HIDE_TIMER_DELAY is defined in utils/constants.js (1000ms)
      const HIDE_TIMER_DELAY = 1000; // Matches utils/constants.js
      const hideTimer = setTimeout(() => {
        if (this.isPopupOpen && this.translatePopup && 
            !this.translatePopup.contains(event.target) && !this.translationInProgress) {
          this.hidePopup();
        }
      }, HIDE_TIMER_DELAY);
      
      // Store timer reference for potential cleanup
      this.hideTimer = hideTimer;
    }
  }

  handleScroll() {
    // Hide popup on scroll, but keep icon visible
    if (this.isPopupOpen && !this.translationInProgress) {
      this.hidePopup();
    }
  }

  handleResize() {
    // Hide popup on window resize, but keep icon visible
    if (this.isPopupOpen && !this.translationInProgress) {
      this.hidePopup();
    }
  }

  async processTextSelection() {
    // Ensure settings are loaded FIRST before any checks
    if (!this.settings) {
      await this.loadSettings();
    }

    // Check if selection is within an input field or textarea (if setting is enabled)
    // Do this BEFORE checking selectedText, because input selections work differently
    if (this.settings?.disableInputFields === true) {
      // Check active element first - this catches most input field cases
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        // Check if there's actually selected text in the input
        const hasSelection = activeElement.selectionStart !== undefined && 
                             activeElement.selectionEnd !== undefined &&
                             activeElement.selectionStart !== activeElement.selectionEnd;
        
        if (hasSelection) {
          this.hideIcon();
          this.hidePopup();
          return;
        }
      }
      
      // Also check using the helper method for other cases
      if (this.isSelectionInInputField()) {
        this.hideIcon();
        this.hidePopup();
        return;
      }
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Hide existing popup but keep icon if it's the same selection
    this.hidePopup();

    // Check if we have valid text selection
    if (!selectedText || selectedText.length < 2) {
      this.hideIcon();
      return;
    }

    // If it's the same text selection, don't recreate the icon
    if (this.selectedText === selectedText && this.translateIcon) {
      return;
    }

    // Hide existing icon
    this.hideIcon();

    // Store selection info
    this.selectedText = selectedText;
    this.selectionRange = selection.getRangeAt(0);

    // Show translate icon
    this.showIcon();
  }

  async showIcon() {
    if (!this.selectionRange) return;

    // Remove existing icon
    this.hideIcon();

    // Get theme (uses cache if available)
    this.detectedTheme = this.getDetectedTheme();

    // Create icon element
    this.translateIcon = document.createElement('div');
    this.translateIcon.className = 'alto-translate-icon';
    this.translateIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-option-icon lucide-option" viewBox="0 0 24 24"><path d="M3 3h6l6 18h6M14 3h7"/></svg>';
    this.translateIcon.title = 'Translate with Alto Translate';

    // Apply detected theme
    this.applyTheme(this.translateIcon, this.detectedTheme);

    // Position icon near selection
    this.positionIcon();

    // Add click handler
    this.translateIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.showPopup();
    });

    // Add to document
    document.body.appendChild(this.translateIcon);

    // Auto-hide after timeout if not clicked
    // AUTO_HIDE_DELAY is defined in utils/constants.js (10000ms)
    const AUTO_HIDE_DELAY = 10000; // Matches utils/constants.js
    this.autoHideTimer = setTimeout(() => {
      if (this.translateIcon && !this.isPopupOpen) {
        this.hideIcon();
      }
      this.autoHideTimer = null;
    }, AUTO_HIDE_DELAY);
  }

  hideIcon() {
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    
    if (this.translateIcon) {
      this.translateIcon.remove();
      this.translateIcon = null;
    }
  }

  positionIcon() {
    if (!this.translateIcon || !this.selectionRange) return;

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const iconSize = 24; // Icon size for calculations

    // Position icon near the mouse cursor with a small offset
    let left = this.mousePosition.x + scrollX + 10; // 10px offset from cursor
    let top = this.mousePosition.y + scrollY - 10; // 10px offset above cursor

    // Ensure icon doesn't go off-screen to the right
    if (left + iconSize > window.innerWidth + scrollX) {
      left = this.mousePosition.x + scrollX - iconSize - 10; // Position to the left of cursor
    }

    // Ensure icon doesn't go off-screen to the bottom
    if (top + iconSize > window.innerHeight + scrollY) {
      top = this.mousePosition.y + scrollY - iconSize - 10; // Position above cursor
    }

    // Ensure icon doesn't go off-screen to the left
    if (left < scrollX + 10) {
      left = scrollX + 10;
    }

    // Ensure icon doesn't go off-screen to the top
    if (top < scrollY + 10) {
      top = scrollY + 10;
    }

    this.translateIcon.style.left = `${left}px`;
    this.translateIcon.style.top = `${top}px`;
  }

  async showPopup() {
    if (this.isPopupOpen || !this.selectedText) {
      return;
    }

    this.isPopupOpen = true;
    this.popupOpenTime = Date.now(); // Record when popup was opened
    this.hideIcon();

    // Add a flag to prevent immediate hiding during setup
    this.popupSetupComplete = false;

    // Create popup
    this.createPopup();

    // Position popup
    this.positionPopup();

    // Mark setup as complete immediately after popup is created and positioned
    this.popupSetupComplete = true;

    // Add a small delay to ensure popup is fully rendered before starting translation
    setTimeout(async () => {
      if (this.isPopupOpen) {
        await this.translateText();
      }
    }, 100);
  }

  createPopup() {
    // Remove existing popup only if it exists
    if (this.translatePopup) {
      this.translatePopup.remove();
      this.translatePopup = null;
    }

    // Get theme (uses cache if available)
    this.detectedTheme = this.getDetectedTheme();

    // Create popup element
    this.translatePopup = document.createElement('div');
    this.translatePopup.className = 'alto-translate-popup';
    
    // Apply detected theme (for dark/light mode)
    this.applyTheme(this.translatePopup, this.detectedTheme);
    
    // Apply custom theme from settings
    this.applyCustomTheme(this.translatePopup);
    this.translatePopup.innerHTML = `
      <div class="alto-translate-popup-header">
        <div class="alto-translate-popup-title">Translation</div>
        <button class="alto-translate-popup-close" title="Close">×</button>
      </div>
      <div class="alto-translate-popup-content">
        <div class="alto-translate-original-text">${this.escapeHtml(this.selectedText)}</div>
        <div class="alto-translate-translated-text">
          <div class="alto-translate-loading">
            <div class="alto-translate-spinner"></div>
            Translating...
          </div>
        </div>
      </div>
      <div class="alto-translate-popup-footer">
        <button class="alto-translate-copy-btn" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-copy-icon lucide-copy" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
        <div class="alto-translate-api-badge">Loading...</div>
      </div>
    `;

    // Add event listeners
    const closeBtn = this.translatePopup.querySelector('.alto-translate-popup-close');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');

    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hidePopup();
    });
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.copyToClipboard();
    });

    // Prevent popup from closing when clicking inside it
    this.translatePopup.addEventListener('click', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });

    // Also prevent mousedown events inside popup
    this.translatePopup.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });

    // Prevent focus events from closing popup
    this.translatePopup.addEventListener('focus', (e) => {
      e.stopPropagation();
    });

    // Prevent any other events from bubbling up
    this.translatePopup.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
    });

    this.translatePopup.addEventListener('mouseleave', (e) => {
      e.stopPropagation();
    });

    // Add to document
    document.body.appendChild(this.translatePopup);
  }

  positionPopup() {
    if (!this.translatePopup || !this.selectionRange) return;

    const rect = this.selectionRange.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Position popup below selection, or above if not enough space
    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + 8;

    // Check if popup would go off-screen to the right
    const popupWidth = 300; // Approximate width
    if (left + popupWidth > window.innerWidth + scrollX) {
      left = window.innerWidth + scrollX - popupWidth - 16;
    }

    // Check if popup would go off-screen to the bottom
    const popupHeight = 150; // Approximate height
    if (top + popupHeight > window.innerHeight + scrollY) {
      top = rect.top + scrollY - popupHeight - 8;
    }

    // Ensure popup doesn't go off-screen to the left
    if (left < scrollX + 16) {
      left = scrollX + 16;
    }

    this.translatePopup.style.left = `${left}px`;
    this.translatePopup.style.top = `${top}px`;
  }

  async translateText() {
    if (!this.settings) {
      await this.loadSettings();
    }

    // MyMemory is always available; Gemini/OpenRouter need keys when those APIs are chosen in settings.

    // Prevent popup from being hidden during translation
    this.translationInProgress = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: this.selectedText,
        targetLanguage: this.settings.targetLanguage,
        sourceLanguage: this.settings.sourceLanguage
      });

      if (response?.success) {
        this.showTranslation(response);
      } else {
        this.showError(response?.error ?? 'Translation failed', response?.errorDetails ?? null);
      }
    } catch (error) {
      console.error('Translation error:', error);
      this.showError(error?.message ?? 'Failed to connect to translation service');
    } finally {
      // Add a small delay before allowing popup to be hidden again
      // TRANSLATION_PROTECTION_DELAY is defined in utils/constants.js (500ms)
      const TRANSLATION_PROTECTION_DELAY = 500; // Matches utils/constants.js
      setTimeout(() => {
        this.translationInProgress = false;
      }, TRANSLATION_PROTECTION_DELAY);
    }
  }

  showTranslation(result) {
    if (!this.translatePopup || !result?.translatedText) return;

    const translatedTextEl = this.translatePopup.querySelector('.alto-translate-translated-text');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');
    const apiBadge = this.translatePopup.querySelector('.alto-translate-api-badge');

    if (!translatedTextEl || !copyBtn || !apiBadge) return;

    // Update translated text
    translatedTextEl.innerHTML = this.escapeHtml(result.translatedText);
    
    // Apply RTL/LTR styling based on target language
    const targetLanguage = result.targetLanguage ?? 'en';
    const isRTL = this.isRTLLanguage(targetLanguage);
    
    translatedTextEl.className = `alto-translate-translated-text ${isRTL ? 'rtl' : 'ltr'}`;

    // Enable copy button
    copyBtn.disabled = false;
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-copy-icon lucide-copy" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

    // Update API badge
    const apiName = (result.api ?? 'unknown').toUpperCase();
    const isFromCache = result.fromCache === true;
    
    if (isFromCache) {
      apiBadge.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 4px;">
        <span>⚡</span>
        <span>${apiName}</span>
      </span>`;
      apiBadge.title = 'Cached translation (instant)';
      apiBadge.style.color = '#10b981'; // Green color for cache
    } else {
      apiBadge.textContent = apiName;
      apiBadge.title = 'Fresh translation';
      apiBadge.style.color = ''; // Reset to default
    }
  }

  isRTLLanguage(languageCode) {
    // RTL languages list - matches utils/languages.js RTL_LANGUAGES
    // Note: Content scripts can't use importScripts, so we maintain a local copy
    const rtlLanguages = ['ar', 'fa', 'he', 'ur'];
    return rtlLanguages.includes(languageCode);
  }

  showError(errorMessage, errorDetails = null) {
    if (!this.translatePopup || !errorMessage) return;

    const translatedTextEl = this.translatePopup.querySelector('.alto-translate-translated-text');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');
    const apiBadge = this.translatePopup.querySelector('.alto-translate-api-badge');

    if (!translatedTextEl || !copyBtn || !apiBadge) return;

    // Build error HTML with structured message
    let errorHtml = `<div class="alto-translate-error">${this.escapeHtml(errorMessage)}</div>`;
    
    // Add actionable steps if available
    if (errorDetails && errorDetails.steps && errorDetails.steps.length > 0) {
      errorHtml += '<div class="alto-translate-error-steps" style="margin-top: 8px; font-size: 12px; color: var(--alto-text-secondary, #6b7280);">';
      errorDetails.steps.forEach((step, index) => {
        errorHtml += `<div style="margin: 4px 0;">${index + 1}. ${this.escapeHtml(step)}</div>`;
      });
      errorHtml += '</div>';
    }
    
    // Add help link if available
    if (errorDetails && errorDetails.helpLink) {
      const helpLink = document.createElement('a');
      helpLink.href = errorDetails.helpLink;
      helpLink.target = '_blank';
      helpLink.className = 'alto-translate-settings-link';
      helpLink.textContent = 'Get Help';
      helpLink.style.display = 'block';
      helpLink.style.marginTop = '8px';
      translatedTextEl.innerHTML = errorHtml;
      translatedTextEl.appendChild(helpLink);
    } else {
      translatedTextEl.innerHTML = errorHtml;
    }

    // Add settings link for API key errors
    if (errorMessage.toLowerCase().includes('api key') || 
        (errorDetails && errorDetails.steps && errorDetails.steps.some(s => s.toLowerCase().includes('settings')))) {
      const settingsLink = document.createElement('a');
      settingsLink.href = '#';
      settingsLink.className = 'alto-translate-settings-link';
      settingsLink.textContent = 'Open Settings';
      settingsLink.style.display = 'block';
      settingsLink.style.marginTop = '8px';
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'openSettings' }).catch(console.error);
      });
      translatedTextEl.appendChild(settingsLink);
    }

    // Disable copy button
    copyBtn.disabled = true;
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-copy-icon lucide-copy" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

    // Update API badge
    apiBadge.textContent = 'Error';
  }

  async copyToClipboard() {
    if (!this.translatePopup) return;

    const translatedTextEl = this.translatePopup.querySelector('.alto-translate-translated-text');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');

    if (!translatedTextEl || !copyBtn) return;

    try {
      const textToCopy = translatedTextEl.textContent?.trim() ?? '';
      if (!textToCopy) {
        throw new Error('No text to copy');
      }

      await navigator.clipboard.writeText(textToCopy);
      
      // Show success feedback
      // COPY_FEEDBACK_DURATION is defined in utils/constants.js (2000ms)
      const COPY_FEEDBACK_DURATION = 2000; // Matches utils/constants.js
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = 'Copied!';
      copyBtn.style.background = '#10b981';
      
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = '';
      }, COPY_FEEDBACK_DURATION);
    } catch (error) {
      console.error('Copy failed:', error);
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = 'Copy Failed';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 2000);
    }
  }

  hidePopup() {
    // Don't hide popup during translation
    if (this.translationInProgress) {
      return;
    }

    
    // Clear any pending hide timer
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    
    if (this.translatePopup) {
      this.translatePopup.remove();
      this.translatePopup = null;
    }
    this.isPopupOpen = false;
    this.popupSetupComplete = false;
    this.translationInProgress = false;
    this.popupOpenTime = null; // Reset timing
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  handleKeydown(event) {
    // Close popup on Escape key
    if (event.key === 'Escape' && this.isPopupOpen) {
      this.hidePopup();
    }
  }

  /**
   * Cleanup method to prevent memory leaks
   * Call this when the extension is disabled or page unloads
   */
  cleanup() {
    // Clear all timers with null checks
    if (this.debounceTimer !== null && this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.autoHideTimer !== null && this.autoHideTimer !== undefined) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    if (this.hideTimer !== null && this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    // Remove event listeners with existence checks
    // Check if document/window exist (may be null in some contexts)
    if (typeof document !== 'undefined' && document) {
      if (this.handleTextSelection) {
        document.removeEventListener('mouseup', this.handleTextSelection);
      }
      if (this.handleMouseDown) {
        document.removeEventListener('mousedown', this.handleMouseDown);
      }
      if (this.handleMouseMove) {
        document.removeEventListener('mousemove', this.handleMouseMove);
      }
      if (this.handleScroll) {
        document.removeEventListener('scroll', this.handleScroll);
      }
      if (this.handleKeydown) {
        document.removeEventListener('keydown', this.handleKeydown);
      }
    }

    if (typeof window !== 'undefined' && window) {
      if (this.handleResize) {
        window.removeEventListener('resize', this.handleResize);
      }
    }

    // Remove message listener if it exists
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage && this.handleSettingsUpdate) {
      try {
        chrome.runtime.onMessage.removeListener(this.handleSettingsUpdate);
      } catch (error) {
        // Listener may not be registered, ignore error
        console.warn('Could not remove message listener:', error);
      }
    }

    // Clean up DOM elements
    this.hideIcon();
    this.hidePopup();

    // Clear all references
    this.selectedText = '';
    this.selectionRange = null;
    this.settings = null;
    this.translateIcon = null;
    this.translatePopup = null;
    this.isPopupOpen = false;
    this.popupOpenTime = null;
    this.translationInProgress = false;
    this.popupSetupComplete = false;
    this.mousePosition = { x: 0, y: 0 };
    this.detectedTheme = null;
    this.detectedThemeCache = null;
    this.themeCachePageUrl = null;
  }
}

// Initialize the extension when the script loads
let altoTranslateInstance = null;

function initializeExtension() {
  // Clean up existing instance if any
  if (altoTranslateInstance) {
    altoTranslateInstance.cleanup();
  }
  
  altoTranslateInstance = new AltoTranslate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (altoTranslateInstance) {
    altoTranslateInstance.cleanup();
    altoTranslateInstance = null;
  }
});
