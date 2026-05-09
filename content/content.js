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
    /** When true, outside-click scroll/resize dismissal is disabled (persisted in chrome.storage.local). */
    this.popupPinned = false;

    // Bind methods to preserve context
    this.handleTextSelection = this.handleTextSelection.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleRuntimeMessage = this.handleRuntimeMessage.bind(this);
    
    this.init();
  }

  async init() {
    // Load settings
    await this.loadSettings();
    await this.refreshPopupPinnedFromStorage();

    // Detect webpage theme (with caching)
    this.detectedTheme = this.getDetectedTheme();
    
    // Add event listeners
    document.addEventListener('mouseup', this.handleTextSelection);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('scroll', this.handleScroll, true);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeydown);
    
    // Listen for settings changes
    chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
    
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

  handleRuntimeMessage(request /* , sender, sendResponse */) {
    if (!request?.action) return;

    if (request.action === 'settingsUpdated') {
      this.loadSettings();
      return;
    }

    if (request.action === 'triggerTranslateShortcut') {
      void this.runTranslateShortcutFromCommand().catch((err) => {
        console.warn('Alto Translate: shortcut failed', err);
      });
      return;
    }
  }

  /** True when focus is in a field where Alt+A should not steal translation (typing surfaces). */
  isFocusInTypingSurface() {
    const el = document.activeElement;
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    if ((document.designMode || '').toLowerCase() === 'on') return true;
    return false;
  }

  /** Same as clicking the floating icon — chrome.commands (default Alt+A). */
  async runTranslateShortcutFromCommand() {
    if (!this.settings) {
      await this.loadSettings();
    }

    if (this.isFocusInTypingSurface()) {
      return;
    }

    const sel = window.getSelection();
    if (!sel?.rangeCount) return;

    const raw = sel.toString().trim();
    if (!raw || raw.length < 2) return;

    if (this.settings?.disableInputFields === true && this.isSelectionInInputField()) {
      return;
    }

    try {
      this.selectedText = raw;
      this.selectionRange = sel.getRangeAt(0).cloneRange();
      this.hideIcon();
      await this.hidePopupForNewTranslation();
      await this.showPopup();
    } catch (err) {
      console.warn('Alto Translate: shortcut translation failed', err);
    }
  }

  /** Close popup between shortcut runs without blocking on translation state. */
  async hidePopupForNewTranslation() {
    if (!this.translatePopup) {
      this.isPopupOpen = false;
      return;
    }
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.translatePopup.parentNode) {
      this.translatePopup.remove();
      this.translatePopup = null;
    }
    this.isPopupOpen = false;
    this.popupSetupComplete = false;
    this.translationInProgress = false;
    this.popupOpenTime = null;
  }

  async refreshPopupPinnedFromStorage() {
    try {
      const stored = await chrome.storage.local.get('altoTranslatePopupPinned');
      this.popupPinned = stored.altoTranslatePopupPinned === true;
    } catch (err) {
      console.warn('Alto Translate: could not load pin preference', err);
      this.popupPinned = false;
    }
  }

  syncPinToggleButton(pinBtn) {
    if (!pinBtn) return;
    const pinned = !!this.popupPinned;
    pinBtn.classList.toggle('is-pinned', pinned);
    pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    pinBtn.title = pinned
      ? 'Unpin (outside click / scroll / resize closes)'
      : 'Pin — keep popup when clicking outside, scrolling, or resizing';
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
      if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
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
      if (element instanceof HTMLElement && element.isContentEditable) {
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
      if (element instanceof HTMLElement && element.isContentEditable) {
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
      
      if (this.popupPinned) {
        return;
      }

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
        if (this.popupPinned) {
          return;
        }
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
    if (this.popupPinned && this.isPopupOpen) {
      return;
    }
    // Hide popup on scroll, but keep icon visible
    if (this.isPopupOpen && !this.translationInProgress) {
      this.hidePopup();
    }
  }

  handleResize() {
    if (this.popupPinned && this.isPopupOpen) {
      if (this.translatePopup?.isConnected) {
        this.scheduleAlignPopupToSelection();
      }
      return;
    }
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
          this.hidePopup(true);
          return;
        }
      }
      
      // Also check using the helper method for other cases
      if (this.isSelectionInInputField()) {
        this.hideIcon();
        this.hidePopup(true);
        return;
      }
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Collapsed / tiny selection — keep pinned translation visible on harmless clicks
    if (!selectedText || selectedText.length < 2) {
      if (!this.popupPinned) {
        this.hidePopup(false);
      }
      this.hideIcon();
      return;
    }

    // Popup open + same passage — ignore selection churn (mouseup from pin/close/etc. bubbles to document).
    // Must not depend on pin: unpin triggers the same churn and would otherwise force-close the popup.
    if (
      this.isPopupOpen &&
      this.translatePopup?.isConnected &&
      selectedText === this.selectedText
    ) {
      return;
    }

    // Opening a genuinely new passage replaces any existing popup (including pinned)
    this.hidePopup(true);

    // Same selection as last time → keep existing floating icon only
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

  /**
   * @param {number} leftVp
   * @param {number} topVp
   * @param {number} boxW
   * @param {number} boxH
   * @param {number} pad
   * @returns {{ leftVp: number, topVp: number }}
   */
  clampFloatingBoxViewport(leftVp, topVp, boxW, boxH, pad = 10) {
    const maxLeftV = Math.max(pad, window.innerWidth - boxW - pad);
    const maxTopV = Math.max(pad, window.innerHeight - boxH - pad);
    return {
      leftVp: Math.min(Math.max(leftVp, pad), maxLeftV),
      topVp: Math.min(Math.max(topVp, pad), maxTopV)
    };
  }

  /** Double rAF so width/height reflect layout after theme and content apply. */
  scheduleAlignPopupToSelection() {
    if (!this.translatePopup?.isConnected || !this.selectionRange) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.alignPopupToSelection());
    });
  }

  alignPopupToSelection() {
    const popup = this.translatePopup;
    if (!popup?.isConnected || !this.selectionRange) return;

    let anchor = this.selectionRange.getBoundingClientRect();
    if (anchor.width < 1 && anchor.height < 1) {
      const cx = this.mousePosition.x;
      const cy = this.mousePosition.y;
      anchor = new DOMRect(Math.max(0, cx - 1), Math.max(0, cy - 1), 2, 2);
    }

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const gap = 8;
    const pad = 10;

    const br = popup.getBoundingClientRect();
    let w = Math.ceil(br.width);
    let h = Math.ceil(br.height);
    if (!w || w < 50) w = 320;
    if (!h || h < 50) h = 180;

    let leftVp = anchor.left;
    let topVp = anchor.bottom + gap;

    if (topVp + h > window.innerHeight - pad) {
      topVp = anchor.top - gap - h;
    }
    if (leftVp + w > window.innerWidth - pad) {
      leftVp = anchor.right - w;
    }

    const clamped = this.clampFloatingBoxViewport(leftVp, topVp, w, h, pad);
    popup.style.left = `${clamped.leftVp + scrollX}px`;
    popup.style.top = `${clamped.topVp + scrollY}px`;
  }

  positionIcon() {
    if (!this.translateIcon || !this.selectionRange) return;

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const iconSize = 24;
    const pad = 10;

    let leftVp = this.mousePosition.x + pad;
    let topVp = this.mousePosition.y - pad;

    if (leftVp + iconSize > window.innerWidth - pad) {
      leftVp = this.mousePosition.x - iconSize - pad;
    }

    if (topVp + iconSize > window.innerHeight - pad) {
      topVp = this.mousePosition.y - iconSize - pad;
    }

    const clamped = this.clampFloatingBoxViewport(leftVp, topVp, iconSize, iconSize, pad);
    this.translateIcon.style.left = `${clamped.leftVp + scrollX}px`;
    this.translateIcon.style.top = `${clamped.topVp + scrollY}px`;
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
    await this.createPopup();

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

  async createPopup() {
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
    await this.applyCustomTheme(this.translatePopup);

    this.translatePopup.innerHTML = `
      <div class="alto-translate-popup-header">
        <div class="alto-translate-popup-title">Translation</div>
        <div class="alto-translate-popup-header-actions">
          <button type="button" class="alto-translate-popup-pin" aria-pressed="false" title="Pin popup">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1 .65-3.93 2 2 0 0 1 3.32 1.32l2.66 11.54a3 3 0 1 1-9.94 3.94L9 10.76z"/></svg>
          </button>
          <button type="button" class="alto-translate-popup-close" title="Close">×</button>
        </div>
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

    const pinBtn = this.translatePopup.querySelector('.alto-translate-popup-pin');
    const closeBtn = this.translatePopup.querySelector('.alto-translate-popup-close');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');

    this.syncPinToggleButton(pinBtn);

    if (pinBtn) {
      pinBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (this.hideTimer) {
          clearTimeout(this.hideTimer);
          this.hideTimer = null;
        }
        this.popupPinned = !this.popupPinned;
        try {
          await chrome.storage.local.set({ altoTranslatePopupPinned: this.popupPinned });
        } catch (err) {
          console.warn('Alto Translate: pin save failed', err);
        }
        this.syncPinToggleButton(pinBtn);
      });
      pinBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
    }

    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hidePopup(true);
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

    // Prevent document-level mouseup (selection debounce) when interacting with the popup
    this.translatePopup.addEventListener('mouseup', (e) => {
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
    this.scheduleAlignPopupToSelection();
  }

  /**
   * Nearest block-like ancestor for excerpting surrounding text (sentence context).
   * @param {Range} range
   * @returns {HTMLElement}
   */
  getSnippetContainer(range) {
    if (!range || typeof Range === 'undefined') {
      return document.body;
    }
    const blockTags = new Set([
      'P',
      'LI',
      'TD',
      'TH',
      'DIV',
      'SECTION',
      'ARTICLE',
      'BLOCKQUOTE',
      'PRE',
      'HEADER',
      'FOOTER',
      'ASIDE',
      'MAIN',
      'FIGCAPTION',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6'
    ]);
    let el = range.commonAncestorContainer;
    if (el.nodeType === Node.TEXT_NODE) {
      el = el.parentElement;
    }
    if (!el || el.nodeType !== Node.ELEMENT_NODE) {
      return document.body;
    }

    const maxSnippetSourceChars = 12000;
    let cur = el;
    let fallbackLarge = document.body;

    while (cur && cur !== document.body) {
      if (blockTags.has(cur.tagName)) {
        fallbackLarge = cur;
        const len = (cur.textContent || '').length;
        if (len <= maxSnippetSourceChars) {
          return cur;
        }
      }
      cur = cur.parentElement;
    }

    return fallbackLarge instanceof HTMLElement ? fallbackLarge : document.body;
  }

  /**
   * @param {Range} range
   * @returns {string|null}
   */
  getContextSnippetFromRange(range) {
    if (!range || typeof buildTranslationContextSnippet !== 'function') {
      return null;
    }
    try {
      const container = this.getSnippetContainer(range);
      const rangeBefore = document.createRange();
      rangeBefore.selectNodeContents(container);
      rangeBefore.setEnd(range.startContainer, range.startOffset);
      const before = rangeBefore.toString();

      const rangeAfter = document.createRange();
      rangeAfter.selectNodeContents(container);
      rangeAfter.setStart(range.endContainer, range.endOffset);
      const after = rangeAfter.toString();

      const rawSelected = range.toString();
      return buildTranslationContextSnippet(before, rawSelected, after, {});
    } catch (err) {
      console.warn('Alto Translate: context snippet failed', err);
      return null;
    }
  }

  async translateText() {
    if (!this.settings) {
      await this.loadSettings();
    }

    // MyMemory is always available; Gemini/OpenRouter need keys when those APIs are chosen in settings.

    // Prevent popup from being hidden during translation
    this.translationInProgress = true;

    try {
      const contextSnippet = this.selectionRange
        ? this.getContextSnippetFromRange(this.selectionRange)
        : null;

      /** @type {Record<string, string>} */
      const msg = {
        action: 'translate',
        text: this.selectedText,
        targetLanguage: this.settings.targetLanguage,
        sourceLanguage: this.settings.sourceLanguage
      };
      if (contextSnippet) {
        msg.contextSnippet = contextSnippet;
      }

      const response = await chrome.runtime.sendMessage(msg);

      if (!this.translatePopup?.isConnected) {
        return;
      }

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

    this.scheduleAlignPopupToSelection();
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

    this.scheduleAlignPopupToSelection();
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

  /**
   * @param {boolean} [force] - When true, dismiss even if pinned (Close, Escape, new selection, cleanup).
   */
  hidePopup(force = false) {
    if (!force) {
      if (this.popupPinned) {
        return;
      }
      if (this.translationInProgress) {
        return;
      }
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
    if (force) {
      this.translationInProgress = false;
    }
    this.popupOpenTime = null; // Reset timing
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  handleKeydown(event) {
    // Close popup on Escape key (even when pinned)
    if (event.key === 'Escape' && this.isPopupOpen) {
      this.hidePopup(true);
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
        window.removeEventListener('scroll', this.handleScroll, true);
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
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage && this.handleRuntimeMessage) {
      try {
        chrome.runtime.onMessage.removeListener(this.handleRuntimeMessage);
      } catch (error) {
        // Listener may not be registered, ignore error
        console.warn('Could not remove message listener:', error);
      }
    }

    // Clean up DOM elements
    this.hideIcon();
    this.hidePopup(true);

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
