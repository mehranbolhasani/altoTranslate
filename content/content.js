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
    
    // Add event listeners
    document.addEventListener('mouseup', this.handleTextSelection);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeydown);
    
    // Listen for settings changes
    chrome.runtime.onMessage.addListener(this.handleSettingsUpdate);
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
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  handleMouseMove(event) {
    // Track mouse position for icon positioning
    this.mousePosition = { x: event.clientX, y: event.clientY };
    
    // Don't move the icon once it's created - it should stay in place
    // The icon position is set when it's first created based on mouse position
  }

  handleTextSelection(event) {
    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Debounce the selection to avoid showing icon on accidental selections
    this.debounceTimer = setTimeout(() => {
      this.processTextSelection();
      this.debounceTimer = null;
    }, 300);
  }

  handleMouseDown(event) {
    // Don't hide popup during setup
    if (!this.popupSetupComplete) {
      console.log('Alto Translate: Ignoring mousedown during popup setup');
      return;
    }

    // Don't hide popup during translation
    if (this.translationInProgress) {
      console.log('Alto Translate: Ignoring mousedown during translation');
      return;
    }

    // Add a minimum time before popup can be hidden (prevent immediate hiding)
    if (this.isPopupOpen && this.popupOpenTime) {
      const timeSinceOpen = Date.now() - this.popupOpenTime;
      if (timeSinceOpen < 2000) { // 2 seconds minimum
        console.log('Alto Translate: Popup too new, ignoring mousedown');
        return;
      }
    }

    // Don't hide popup immediately - let the user interact with it
    // Only hide if clicking on a completely different element
    if (this.isPopupOpen && this.translatePopup && 
        !this.translatePopup.contains(event.target) && 
        !this.translateIcon?.contains(event.target)) {
      
      // Check if the click is on the selected text or nearby
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const clickX = event.clientX;
        const clickY = event.clientY;
        
        // If click is near the selected text, don't hide popup
        if (clickX >= rect.left - 100 && clickX <= rect.right + 100 &&
            clickY >= rect.top - 100 && clickY <= rect.bottom + 100) {
          console.log('Alto Translate: Click near selected text, keeping popup open');
          return;
        }
      }
      
      console.log('Alto Translate: Click outside popup, scheduling hide');
      // Add a longer delay to prevent immediate hiding
      const hideTimer = setTimeout(() => {
        if (this.isPopupOpen && this.translatePopup && 
            !this.translatePopup.contains(event.target) && !this.translationInProgress) {
          this.hidePopup();
        }
      }, 1000);
      
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

  processTextSelection() {
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

  showIcon() {
    if (!this.selectionRange) return;

    // Remove existing icon
    this.hideIcon();

    // Create icon element
    this.translateIcon = document.createElement('div');
    this.translateIcon.className = 'alto-translate-icon';
    this.translateIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-option-icon lucide-option" viewBox="0 0 24 24"><path d="M3 3h6l6 18h6M14 3h7"/></svg>';
    this.translateIcon.title = 'Translate with Alto Translate';

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

    // Auto-hide after 10 seconds if not clicked (increased from 5 seconds)
    this.autoHideTimer = setTimeout(() => {
      if (this.translateIcon && !this.isPopupOpen) {
        this.hideIcon();
      }
      this.autoHideTimer = null;
    }, 10000);
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
      console.log('Alto Translate: Popup already open or no text selected');
      return;
    }

    console.log('Alto Translate: Showing popup for text:', this.selectedText);
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
        console.log('Alto Translate: Starting translation...');
        await this.translateText();
      } else {
        console.log('Alto Translate: Popup was closed before translation started');
      }
    }, 100);
  }

  createPopup() {
    // Remove existing popup only if it exists
    if (this.translatePopup) {
      this.translatePopup.remove();
      this.translatePopup = null;
    }

    // Create popup element
    this.translatePopup = document.createElement('div');
    this.translatePopup.className = 'alto-translate-popup';
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

    if (!this.settings || (!this.settings.geminiApiKey && !this.settings.openrouterApiKey && !this.settings.libretranslateEnabled)) {
      this.showError('Please configure your API keys or enable MyMemory API in the extension settings.');
      return;
    }

    // Prevent popup from being hidden during translation
    this.translationInProgress = true;
    console.log('Alto Translate: Translation in progress, popup protected from hiding');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: this.selectedText,
        targetLanguage: this.settings.targetLanguage,
        sourceLanguage: this.settings.sourceLanguage
      });

      if (response.success) {
        this.showTranslation(response);
      } else {
        this.showError(response.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      this.showError('Failed to connect to translation service');
    } finally {
      // Add a small delay before allowing popup to be hidden again
      // This prevents immediate hiding due to events that might fire right after translation
      setTimeout(() => {
        this.translationInProgress = false;
        console.log('Alto Translate: Translation completed, popup can be hidden again');
      }, 500); // 500ms delay to prevent immediate hiding
    }
  }

  showTranslation(result) {
    if (!this.translatePopup) return;

    const translatedTextEl = this.translatePopup.querySelector('.alto-translate-translated-text');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');
    const apiBadge = this.translatePopup.querySelector('.alto-translate-api-badge');

    // Update translated text
    translatedTextEl.innerHTML = this.escapeHtml(result.translatedText);
    
    // Apply RTL/LTR styling based on target language
    const targetLanguage = result.targetLanguage;
    const isRTL = this.isRTLLanguage(targetLanguage);
    
    translatedTextEl.className = `alto-translate-translated-text ${isRTL ? 'rtl' : 'ltr'}`;

    // Enable copy button
    copyBtn.disabled = false;
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-copy-icon lucide-copy" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

    // Update API badge
    apiBadge.textContent = result.api.toUpperCase();
  }

  isRTLLanguage(languageCode) {
    const rtlLanguages = ['ar', 'fa', 'he', 'ur'];
    return rtlLanguages.includes(languageCode);
  }

  showError(errorMessage) {
    if (!this.translatePopup) return;

    const translatedTextEl = this.translatePopup.querySelector('.alto-translate-translated-text');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');
    const apiBadge = this.translatePopup.querySelector('.alto-translate-api-badge');

    // Show error
    translatedTextEl.innerHTML = `<div class="alto-translate-error">${this.escapeHtml(errorMessage)}</div>`;

    // Disable copy button
    copyBtn.disabled = true;
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-copy-icon lucide-copy" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

    // Update API badge
    apiBadge.textContent = 'Error';

    // Add settings link if it's an API key error
    if (errorMessage.includes('API key')) {
      const settingsLink = document.createElement('a');
      settingsLink.href = '#';
      settingsLink.className = 'alto-translate-settings-link';
      settingsLink.textContent = 'Open Settings';
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'openSettings' });
      });
      translatedTextEl.appendChild(settingsLink);
    }
  }

  async copyToClipboard() {
    if (!this.translatePopup) return;

    const translatedTextEl = this.translatePopup.querySelector('.alto-translate-translated-text');
    const copyBtn = this.translatePopup.querySelector('.alto-translate-copy-btn');

    try {
      const textToCopy = translatedTextEl.textContent.trim();
      await navigator.clipboard.writeText(textToCopy);
      
      // Show success feedback
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = 'Copied!';
      copyBtn.style.background = '#10b981';
      
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = '';
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      copyBtn.innerHTML = 'Copy Failed';
      setTimeout(() => {
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="lucide lucide-copy-icon lucide-copy" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
      }, 2000);
    }
  }

  hidePopup() {
    // Don't hide popup during translation
    if (this.translationInProgress) {
      console.log('Alto Translate: Preventing popup hide during translation');
      return;
    }

    console.log('Alto Translate: Hiding popup');
    
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
    // Clear all timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    // Remove event listeners
    document.removeEventListener('mouseup', this.handleTextSelection);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('keydown', this.handleKeydown);
    chrome.runtime.onMessage.removeListener(this.handleSettingsUpdate);

    // Clean up DOM elements
    this.hideIcon();
    this.hidePopup();

    // Clear references
    this.selectedText = '';
    this.selectionRange = null;
    this.settings = null;
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
