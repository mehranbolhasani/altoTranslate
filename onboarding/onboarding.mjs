import { animate } from '../vendor/motion-lib.js';
import { enhanceAllSelects } from '../utils/alto-select.js';

const EASE_OUT = [0.22, 1, 0.36, 1];
const EASE_IN = [0.42, 0, 1, 1];

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

class OnboardingWizard {
  constructor() {
    this.currentScreen = 1;
    this.settings = {};
    this.selectedEngine = 'libretranslate';
    this.selectedLanguage = 'en';
    this.apiProvider = null;
    this.apiKeyValid = false;
    this._reduceMotion = false;
    this._goToBusy = false;
    this.languageNames = null;
    this._busy = false;
    this.init();
  }

  shouldReduceMotion() {
    return prefersReducedMotion() || this._reduceMotion;
  }

  async init() {
    try {
      const r = await chrome.storage.local.get('altoReduceMotion');
      this._reduceMotion = r.altoReduceMotion === true;
    } catch {}

    await this.loadSettings();
    await this.loadLanguages();
    this.preselectLanguage();
    this.syncEngineUI();
    this.bindEvents();
    enhanceAllSelects();

    if (!this.shouldReduceMotion()) {
      document.body.classList.remove('is-ready');
      await this.runPageIntroMotion();
      document.body.classList.add('is-ready');
    }

    this.updateScreen(1);
  }

  async runPageIntroMotion() {
    if (this.shouldReduceMotion()) return;

    const shell = document.querySelector('.onboarding-shell');

    const jobs = [];
    if (shell) {
      jobs.push(
        animate(shell, { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.35, ease: EASE_OUT }).finished
      );
    }
    await Promise.all(jobs);
    jobs.length = 0;

    const header = document.querySelector('.onboarding-header');
    const screen = document.querySelector('.onboarding-screen.is-active');

    if (header) {
      jobs.push(
        animate(header, { opacity: [0, 1], y: [-4, 0] }, { duration: 0.2, ease: EASE_OUT, delay: 0.02 }).finished
      );
    }

    if (screen) {
      const heading = screen.querySelector('.onboarding-screen-headline');
      const subhead = screen.querySelector('.onboarding-screen-subhead');
      const body = screen.querySelector('.onboarding-screen-body');
      const nav = screen.querySelector('.onboarding-nav');

      if (heading) jobs.push(
        animate(heading, { opacity: [0, 1], y: [8, 0] }, { duration: 0.24, ease: EASE_OUT }).finished
      );
      if (subhead) jobs.push(
        animate(subhead, { opacity: [0, 1], y: [6, 0] }, { duration: 0.2, ease: EASE_OUT, delay: 0.04 }).finished
      );
      if (body) jobs.push(
        animate(body, { opacity: [0, 1], y: [4, 0] }, { duration: 0.2, ease: EASE_OUT, delay: 0.07 }).finished
      );
      if (nav) jobs.push(
        animate(nav, { opacity: [0, 1], y: [6, 0] }, { duration: 0.22, ease: EASE_OUT, delay: 0.11 }).finished
      );
    }

    await Promise.all(jobs);
  }

  async loadSettings() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (resp?.success) {
        this.settings = resp.settings;
        this.selectedLanguage = this.settings.targetLanguage || 'en';
        this.selectedEngine = this.settings.apiPreference || 'libretranslate';
      }
    } catch (e) {
      console.error('loadSettings', e);
    }
  }

  async loadLanguages() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getLanguages' });
      if (resp?.success) this.languageNames = resp.languages;
    } catch (e) {
      console.error('loadLanguages', e);
    }
  }

  preselectLanguage() {
    const uiLocale = chrome.i18n.getUILanguage();
    const code = uiLocale.split('-')[0];
    let pick = 'en';
    if (this.languageNames && this.languageNames[code]) pick = code;

    const POPULAR = ['en', 'es', 'fr', 'de', 'zh', 'ar'];
    const isPopular = POPULAR.includes(pick);

    document.querySelectorAll('.onboarding-chip').forEach((c) => {
      c.classList.toggle('is-selected', c.dataset.lang === (isPopular ? pick : ''));
    });

    const sel = document.getElementById('targetLanguageSelect');
    if (sel) {
      if (isPopular) {
        sel.value = pick;
        this.hideOtherDropdown();
      } else {
        sel.value = pick;
        this.showOtherDropdown();
      }
    }

    this.selectedLanguage = pick;
  }

  // ── Event binding ──────────────────────────────────────────────────────

  bindEvents() {
    const $ = (id) => document.getElementById(id);

    $('screen1NextBtn')?.addEventListener('click', () => this.goTo(2));
    $('skipToEndBtn')?.addEventListener('click', () => this.skipSetup());
    $('skipBtn')?.addEventListener('click', () => this.skipSetup());

    $('screen2BackBtn')?.addEventListener('click', () => this.goTo(1));
    $('screen2NextBtn')?.addEventListener('click', () => this.onScreen2Next());

    $('screen3BackBtn')?.addEventListener('click', () => this.goTo(2));
    $('screen3NextBtn')?.addEventListener('click', () => this.onScreen3Next());

    $('screen35BackBtn')?.addEventListener('click', () => this.goTo(3));
    $('screen35NextBtn')?.addEventListener('click', () => this.onScreen35Next());

    $('screen4BackBtn')?.addEventListener('click', () => this.goTo(3));
    $('screen4NextBtn')?.addEventListener('click', () => this.goTo(5));

    $('screen5BackBtn')?.addEventListener('click', () => this.goTo(4));
    $('screen5DoneBtn')?.addEventListener('click', () => this.onDone());

    document.querySelectorAll('.onboarding-chip').forEach((chip) => {
      chip.addEventListener('click', () => this.selectLangChip(chip.dataset.lang));
    });

    $('targetLanguageSelect')?.addEventListener('change', (e) => {
      this.selectLang(e.target.value);
    });

    document.querySelectorAll('.onboarding-api-card').forEach((card) => {
      card.addEventListener('click', () => this.selectEngine(card.dataset.engine));
    });

    $('toggleApiKey')?.addEventListener('click', () => this.toggleKeyVisibility());
    $('validateApiKeyBtn')?.addEventListener('click', () => this.validateKey());
    $('skipApiKeyBtn')?.addEventListener('click', () => this.skipKey());
    $('apiKeyInput')?.addEventListener('input', () => {
      this.apiKeyValid = false;
      $('screen35NextBtn').disabled = true;
      $('validationResult').textContent = '';
    });

    $('sandbox')?.addEventListener('mouseup', () => this.handleSandbox());

    document.addEventListener('keydown', (e) => this.handleKeydown(e));

    $('getKeyBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const urls = {
        'deepl': 'https://www.deepl.com/en/your-account/keys',
        'azure': 'https://portal.azure.com',
        'gemini': 'https://aistudio.google.com/apikey',
        'alto-cloud': 'https://altotranslate.xyz/pricing'
      };
      chrome.tabs.create({ url: urls[this.apiProvider] || 'https://aistudio.google.com/apikey' });
    });

    $('openDashboardBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://altotranslate.xyz/dashboard' });
    });
  }

  // ── Language selection ─────────────────────────────────────────────────

  showOtherDropdown() {
    const wrap = document.getElementById('onboardingOtherLangWrap');
    if (wrap) wrap.classList.remove('is-hidden');
  }

  hideOtherDropdown() {
    const wrap = document.getElementById('onboardingOtherLangWrap');
    if (wrap) wrap.classList.add('is-hidden');
  }

  selectLangChip(code) {
    document.querySelectorAll('.onboarding-chip').forEach((c) => {
      c.classList.toggle('is-selected', c.dataset.lang === code);
    });

    if (!code) {
      this.showOtherDropdown();
      this.selectedLanguage = this.selectedLanguage || 'it';
      return;
    }

    this.hideOtherDropdown();
    const sel = document.getElementById('targetLanguageSelect');
    if (sel) sel.value = code;
    this.selectedLanguage = code;
  }

  selectLang(code) {
    document.querySelectorAll('.onboarding-chip').forEach((c) => {
      c.classList.toggle('is-selected', c.dataset.lang === '');
    });
    this.showOtherDropdown();
    this.selectedLanguage = code;
  }

  // ── Engine selection ───────────────────────────────────────────────────

  updateEngineUI(engine) {
    document.querySelectorAll('.onboarding-api-card').forEach((c) => {
      c.classList.toggle('is-selected', c.dataset.engine === engine);
    });
    const radio = document.querySelector(`.onboarding-api-card[data-engine="${engine}"] .onboarding-api-card-radio`);
    if (radio) radio.checked = true;
    this.selectedEngine = engine;
  }

  syncEngineUI() {
    const cards = document.querySelectorAll('.onboarding-api-card');
    const engine = this.selectedEngine;
    const match = [...cards].some((c) => c.dataset.engine === engine);
    this.updateEngineUI(match ? engine : 'libretranslate');
  }

  async selectEngine(engine) {
    this.updateEngineUI(engine);
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { apiPreference: engine }
      });
    } catch (e) {
      console.error('Failed to save engine preference', e);
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  async goTo(num) {
    const current = document.querySelector('.onboarding-screen.is-active');
    const next = document.querySelector(`[data-screen="${num}"]`);
    if (!current || !next || current === next) return;
    if (this._goToBusy) return;

    this._goToBusy = true;
    try {
      if (this.shouldReduceMotion()) {
        current.classList.remove('is-active');
        next.classList.add('is-active');
        this.currentScreen = num;
        this.updateDots(num);
        this.focusScreen(num);
        return;
      }

      await animate(
        current,
        { opacity: [null, 0], y: [null, 6] },
        { duration: 0.16, ease: EASE_IN }
      ).finished;

      current.classList.remove('is-active');
      current.style.opacity = '';
      current.style.transform = '';

      next.classList.add('is-active');
      next.style.opacity = '0';
      next.style.transform = 'translateY(8px)';

      await animate(
        next,
        { opacity: [0, 1], y: [8, 0] },
        { duration: 0.24, ease: EASE_OUT }
      ).finished;

      next.style.opacity = '';
      next.style.transform = '';

      this.currentScreen = num;
      this.updateDots(num);
      this.focusScreen(num);
    } finally {
      this._goToBusy = false;
    }
  }

  focusScreen(num) {
    const screen = document.querySelector(`[data-screen="${num}"]`);
    if (screen) {
      const h1 = screen.querySelector('h1');
      if (h1) {
        if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
    }
  }

  updateScreen(num) {
    this.currentScreen = num;
    this.updateDots(num);
  }

  updateDots(screen) {
    const dotMap = { 1: 1, 2: 2, 3: 3, '3-5': 3, 4: 4, 5: 5 };
    const active = dotMap[screen] || 1;

    document.querySelectorAll('.onboarding-dot').forEach((dot, i) => {
      const n = i + 1;
      dot.classList.toggle('is-active', n === active);
      dot.classList.toggle('is-done', n < active);
    });

    const bar = document.querySelector('.onboarding-progress');
    if (bar) bar.setAttribute('aria-valuenow', active);
  }

  // ── Screen 2 → save target language ────────────────────────────────────

  async onScreen2Next() {
    this._busy = true;
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { targetLanguage: this.selectedLanguage }
      });
      this.goTo(3);
    } catch (e) {
      console.error('Failed to save language', e);
      this.goTo(3);
    } finally {
      this._busy = false;
    }
  }

  // ── Screen 3 → save engine preference ──────────────────────────────────

  async onScreen3Next() {
    this._busy = true;
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { apiPreference: this.selectedEngine }
      });
    } catch (e) {
      console.error('Failed to save engine', e);
    } finally {
      this._busy = false;
    }

    if (this.selectedEngine === 'libretranslate') {
      this.goTo(4);
    } else {
      this.setupApiScreen(this.selectedEngine);
      this.goTo('3-5');
    }
  }

  // ── Screen 3.5 — API key setup ─────────────────────────────────────────

  setupApiScreen(provider) {
    this.apiProvider = provider;
    this.apiKeyValid = false;

    const headline = document.getElementById('apiKeyHeadline');
    const step1 = document.getElementById('providerNameStep1');
    const step2 = document.querySelector('.onboarding-step:nth-child(2)');
    const step3 = document.querySelector('.onboarding-step:nth-child(3)');
    const getBtn = document.getElementById('getKeyBtn');
    const keyInput = document.getElementById('apiKeyInput');
    const validateBtn = document.getElementById('validateApiKeyBtn');
    const nextBtn = document.getElementById('screen35NextBtn');
    const result = document.getElementById('validationResult');
    const regionWrap = document.getElementById('apiRegionWrap');
    const regionInput = document.getElementById('apiRegionInput');

    const configs = {
      deepl: {
        headline: "Let's connect your DeepL key",
        step1: 'Click the button below to open DeepL in a new tab.',
        step2: 'Sign up free and copy your Authentication Key.',
        step3: 'Paste it here and hit Validate.',
        placeholder: 'Paste your DeepL key',
        showRegion: false
      },
      azure: {
        headline: "Let's connect your Microsoft Translator key",
        step1: 'Click the button below to open the Azure portal in a new tab.',
        step2: 'Create a free Translator resource and copy your key.',
        step3: 'Paste your key and your Azure region, then hit Validate.',
        placeholder: 'Paste your Azure key',
        showRegion: true
      },
      gemini: {
        headline: "Let's connect your Gemini key",
        step1: 'Click the button below to open Google AI Studio in a new tab.',
        step2: 'Create a free key and copy it.',
        step3: 'Paste it here and hit Validate.',
        placeholder: 'AIza...',
        showRegion: false
      },
      'alto-cloud': {
        headline: "Connect your Alto Cloud key",
        step1: 'Visit altotranslate.xyz/pricing and subscribe.',
        step2: 'Sign in at altotranslate.xyz/dashboard and copy your key.',
        step3: 'Paste it below and hit Validate.',
        placeholder: 'alto-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        showRegion: false
      }
    };

    const cfg = configs[provider] || configs.gemini;
    if (headline) headline.textContent = cfg.headline;
    if (step1) step1.textContent = cfg.step1;
    if (step2) step2.textContent = cfg.step2;
    if (step3) step3.textContent = cfg.step3;
    if (getBtn) getBtn.textContent = 'Get my key →';
    if (keyInput) keyInput.placeholder = cfg.placeholder;

    // Show dashboard button only for alto-cloud
    const dashboardBtn = document.getElementById('openDashboardBtn');
    if (dashboardBtn) {
      dashboardBtn.classList.toggle('is-hidden', provider !== 'alto-cloud');
    }

    // Use text input (not password) for alto-cloud
    if (keyInput) {
      keyInput.type = provider === 'alto-cloud' ? 'text' : 'password';
    }

    if (regionWrap) regionWrap.classList.toggle('is-hidden', !cfg.showRegion);
    if (regionInput) regionInput.value = '';

    if (keyInput) keyInput.value = '';
    if (keyInput) keyInput.classList.remove('onboarding-api-key-valid', 'onboarding-api-key-invalid');
    if (nextBtn) nextBtn.disabled = true;
    if (result) result.textContent = '';
    if (validateBtn) validateBtn.disabled = false;
    if (validateBtn) validateBtn.textContent = 'Validate';
  }

  toggleKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const btn = document.getElementById('toggleApiKey');
    if (!input || !btn) return;

    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
      input.type = 'password';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  }

  async validateKey() {
    const input = document.getElementById('apiKeyInput');
    const result = document.getElementById('validationResult');
    const validateBtn = document.getElementById('validateApiKeyBtn');
    const nextBtn = document.getElementById('screen35NextBtn');

    const key = input?.value?.trim();
    if (!key) {
      if (result) {
        result.textContent = 'Please paste your API key first.';
        result.className = 'onboarding-validation-result onboarding-validation-result--error';
      }
      return;
    }

    if (validateBtn) {
      validateBtn.disabled = true;
      validateBtn.textContent = 'Validating…';
    }
    if (result) {
      result.textContent = 'Checking…';
      result.className = 'onboarding-validation-result';
    }

    try {
      const msg = {
        action: 'validateApiKey',
        apiKey: key,
        apiType: this.apiProvider
      };
      if (this.apiProvider === 'azure') {
        const regionInput = document.getElementById('apiRegionInput');
        msg.apiRegion = regionInput?.value?.trim() || '';
      }
      const resp = await chrome.runtime.sendMessage(msg);

      if (resp?.success) {
        this.apiKeyValid = true;
        if (input) {
          input.classList.remove('onboarding-api-key-invalid');
          input.classList.add('onboarding-api-key-valid');
        }
        if (result) {
          result.textContent = 'Key works. You\u2019re good.';
          result.className = 'onboarding-validation-result onboarding-validation-result--success';
        }
        if (nextBtn) nextBtn.disabled = false;
      } else {
        this.apiKeyValid = false;
        if (input) {
          input.classList.remove('onboarding-api-key-valid');
          input.classList.add('onboarding-api-key-invalid');
        }
        if (result) {
          result.textContent = resp?.error || 'Validation failed.';
          result.className = 'onboarding-validation-result onboarding-validation-result--error';
        }
        if (nextBtn) nextBtn.disabled = true;
      }
    } catch (e) {
      if (result) {
        result.textContent = 'Network error. Check your connection.';
        result.className = 'onboarding-validation-result onboarding-validation-result--error';
      }
      if (nextBtn) nextBtn.disabled = true;
    } finally {
      if (validateBtn) {
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validate';
      }
    }
  }

  async skipKey() {
    this._busy = true;
    try {
      this.selectedEngine = 'libretranslate';
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { apiPreference: 'libretranslate' }
      });
      this.goTo(4);
    } catch (e) {
      console.error('skipKey', e);
      this.goTo(4);
    } finally {
      this._busy = false;
    }
  }

  async onScreen35Next() {
    if (!this.apiKeyValid) return;

    const input = document.getElementById('apiKeyInput');
    const regionInput = document.getElementById('apiRegionInput');
    const key = input?.value?.trim() || '';
    const region = regionInput?.value?.trim() || '';

    const keyFields = {
      'gemini': 'geminiApiKey',
      'deepl': 'deeplApiKey',
      'azure': 'azureApiKey',
      'alto-cloud': 'apiKey_alto'
    };
    const keyField = keyFields[this.apiProvider] || 'geminiApiKey';

    const settings = { [keyField]: key, apiPreference: this.apiProvider };
    if (this.apiProvider === 'azure' && region) {
      settings.azureRegion = region;
    }

    this._busy = true;
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings
      });
      this.goTo(4);
    } catch (e) {
      console.error('Failed to save API key', e);
      this.goTo(4);
    } finally {
      this._busy = false;
    }
  }

  // ── Screen 4 — Sandbox (Try it out) ────────────────────────────────────

  async handleSandbox() {
    const sel = window.getSelection();
    const text = sel?.toString()?.trim();
    if (!text) return;

    const sandbox = document.getElementById('sandbox');
    if (!sandbox || !sandbox.contains(sel.anchorNode)) return;

    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'translate',
        text,
        targetLanguage: this.selectedLanguage,
        sourceLanguage: 'es'
      });

      if (resp?.success) {
        const transEl = document.getElementById('sandboxTranslation');
        if (transEl) {
          transEl.textContent = resp.translatedText;
          transEl.hidden = false;
          if (!this.shouldReduceMotion()) {
            animate(transEl, { opacity: [0, 1], y: [8, 0] }, { duration: 0.26, ease: EASE_OUT }).finished.catch(() => {});
          }
        }

        const badge = document.getElementById('sandboxBadge');
        if (badge && this.languageNames) {
          const src = this.languageNames['es'] || 'ES';
          const tgt = this.languageNames[this.selectedLanguage] || this.selectedLanguage.toUpperCase();
          badge.textContent = `ALTO · ${src} → ${tgt}`;
          badge.hidden = false;
          if (!this.shouldReduceMotion()) {
            animate(badge, { opacity: [0, 1], y: [4, 0] }, { duration: 0.2, ease: EASE_OUT, delay: 0.04 }).finished.catch(() => {});
          }
        }

        const confirmEl = document.getElementById('sandboxConfirm');
        if (confirmEl) {
          confirmEl.classList.add('is-visible');
          if (!this.shouldReduceMotion()) {
            animate(confirmEl, { opacity: [0, 1], y: [6, 0] }, { duration: 0.26, ease: EASE_OUT, delay: 0.08 }).finished.catch(() => {});
          }
        }
      }
    } catch (e) {
      // silent — sandbox failure doesn't block flow
    }
  }

  // ── Skip setup — save current selections and close tab ─────────────────

  async skipSetup() {
    if (this._busy) return;
    this._busy = true;
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: {
          targetLanguage: this.selectedLanguage,
          apiPreference: this.selectedEngine
        }
      });
      await chrome.storage.local.set({ altoOnboardingCompleted: true });
    } catch (e) {
      console.error('skipSetup', e);
    } finally {
      this._busy = false;
    }

    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) chrome.tabs.remove(tab.id);
    } catch {
      window.close();
    }
  }

  // ── Screen 5 — Done ────────────────────────────────────────────────────

  async onDone() {
    this._busy = true;
    try {
      const vocabToggle = document.getElementById('toggleVocabulary');
      if (vocabToggle) {
        await chrome.storage.local.set({ altoSaveToVocabulary: vocabToggle.checked });
      }

      await chrome.storage.local.set({
        altoOnboardingCompleted: true
      });
    } catch (e) {
      console.error('Failed to save final state', e);
    } finally {
      this._busy = false;
    }

    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) chrome.tabs.remove(tab.id);
    } catch {
      window.close();
    }
  }

  // ── Keyboard ──────────────────────────────────────────────────────────

  handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.skipSetup();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const active = document.activeElement;
      // Don't intercept Enter in text inputs, selects, or buttons (let them handle it)
      if (active && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(active.tagName)) return;

      e.preventDefault();
      const screen = this.currentScreen;
      switch (screen) {
        case 1: document.getElementById('screen1NextBtn')?.click(); break;
        case 2: document.getElementById('screen2NextBtn')?.click(); break;
        case 3: document.getElementById('screen3NextBtn')?.click(); break;
        case '3-5': document.getElementById('screen35NextBtn')?.click(); break;
        case 4: document.getElementById('screen4NextBtn')?.click(); break;
        case 5: document.getElementById('screen5DoneBtn')?.click(); break;
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OnboardingWizard();
});
