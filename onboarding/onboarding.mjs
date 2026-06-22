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
    this.selectedLanguage = 'en';
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
    $('screen3NextBtn')?.addEventListener('click', () => this.finishOnboarding());

    document.querySelectorAll('.onboarding-chip').forEach((chip) => {
      chip.addEventListener('click', () => this.selectLangChip(chip.dataset.lang));
    });

    $('targetLanguageSelect')?.addEventListener('change', (e) => {
      this.selectLang(e.target.value);
    });

    document.addEventListener('keydown', (e) => this.handleKeydown(e));
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
    const dotMap = { 1: 1, 2: 2, 3: 3 };
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

  // ── Screen 3 → finish onboarding ───────────────────────────────────────

  async finishOnboarding() {
    this._busy = true;
    try {
      await chrome.storage.local.set({ altoOnboardingCompleted: true });
    } catch (e) {
      console.error('Failed to mark onboarding complete', e);
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

  // ── Skip setup — save current selections and close tab ─────────────────

  async skipSetup() {
    if (this._busy) return;
    this._busy = true;
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: {
          targetLanguage: this.selectedLanguage
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
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OnboardingWizard();
});
