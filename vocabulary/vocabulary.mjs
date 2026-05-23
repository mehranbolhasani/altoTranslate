/**
 * Vocabulary page — Motion-driven UI (bundled MV3-safe module).
 */
import { animate } from '../vendor/motion-lib.js';
import { enhanceAllSelects } from '../utils/alto-select.js';

const STORAGE_VOCAB = 'altoVocabulary';
const STORAGE_REVIEW_IDS = 'altoVocabReviewedTodayIds';
const STORAGE_REVIEW_DAY = 'altoVocabReviewCalendarDay';
const EASE_OUT = /** @type {const} */ ([0.22, 1, 0.36, 1]);
const EASE_IN = /** @type {const} */ ([0.42, 0, 1, 1]);

function localDateYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadVocabState() {
  const today = localDateYMD();
  const raw = await chrome.storage.local.get([
    STORAGE_VOCAB,
    STORAGE_REVIEW_IDS,
    STORAGE_REVIEW_DAY
  ]);
  let list = Array.isArray(raw[STORAGE_VOCAB]) ? raw[STORAGE_VOCAB] : [];
  let day = typeof raw[STORAGE_REVIEW_DAY] === 'string' ? raw[STORAGE_REVIEW_DAY] : '';
  let reviewedIds = Array.isArray(raw[STORAGE_REVIEW_IDS]) ? [...raw[STORAGE_REVIEW_IDS]] : [];

  if (day !== today) {
    reviewedIds = [];
    day = today;
    await chrome.storage.local.set({
      [STORAGE_REVIEW_IDS]: reviewedIds,
      [STORAGE_REVIEW_DAY]: day
    });
  }

  return { list, reviewedIds, today };
}

function buildQueue(list, reviewedIds) {
  const set = new Set(reviewedIds);
  return list
    .filter((e) => e && e.id && !set.has(e.id))
    .sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
}

function formatSavedAt(ts) {
  if (typeof ts !== 'number') return '—';
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  } catch {
    return '—';
  }
}

function parseHostname(url) {
  try {
    const u = new URL(url);
    return u.hostname || url;
  } catch {
    return '';
  }
}

function faviconUrlForPageUrl(pageUrl) {
  const host = parseHostname(pageUrl);
  if (!host) return '';
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(host)}`;
}

/** @type {boolean} set during init from chrome.storage.local */
let _userReduceMotion = false;

function prefersReducedMotion() {
  if (_userReduceMotion) return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** @param {unknown} control */
function stopMotion(control) {
  if (!control || typeof control !== 'object') return;
  /** @type {{ stop?: () => void; cancel?: () => void }} */
  const c = /** @type {any} */ (control);
  try {
    typeof c.stop === 'function' && c.stop();
  } catch (_) {
    /**/
  }
  try {
    typeof c.cancel === 'function' && c.cancel();
  } catch (_) {
    /**/
  }
}

class VocabularyPageApp {
  constructor() {
    this.reviewCursor = 0;
    this.filterLang = '';
    this.list = [];
    this.reviewedIds = [];
    this.reviewAnimBusy = false;
    this.pendingStorageRefresh = false;
    /**
     * `undefined` = not yet initialized; then boolean for whether the review queue had cards.
     * Used to animate empty ↔ active review states without flashing on first paint.
     */
    this._hadReviewQueue = undefined;
    this._tabAnimating = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._tableStaggerTimer = null;
    /** @type {unknown[]} */
    this._rowAnimControls = [];
    this._completeMotionBusy = false;
    /** Whether `runReviewCompleteEnterMotion` has run to completion on this page load. */
    this._completeHasShown = false;
  }

  flushPendingRefreshIfNeeded() {
    if (!this.pendingStorageRefresh) return;
    this.pendingStorageRefresh = false;
    void this.refresh();
  }

  async init() {
    try {
      const r = await chrome.storage.local.get('altoReduceMotion');
      _userReduceMotion = r.altoReduceMotion === true;
    } catch {
      _userReduceMotion = false;
    }

    this.bind();
    enhanceAllSelects();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (
        changes[STORAGE_VOCAB] ||
        changes[STORAGE_REVIEW_IDS] ||
        changes[STORAGE_REVIEW_DAY]
      ) {
        if (this.reviewAnimBusy) {
          this.pendingStorageRefresh = true;
          return;
        }
        void this.refresh();
      }
    });

    await this.refresh();

    if (!prefersReducedMotion()) {
      document.body.classList.remove('is-ready');

      const c = document.getElementById('reviewComplete');
      if (c && !c.hidden && buildQueue(this.list, this.reviewedIds).length === 0) {
        animate(c, { opacity: 0, y: 22 }, { duration: 0 });
      }

      await this.runPageIntroMotion();

      document.body.classList.add('is-ready');
    }

    if (!prefersReducedMotion() && buildQueue(this.list, this.reviewedIds).length === 0) {
      void this.runReviewCompleteEnterMotion();
    }
  }

  bind() {
    document.getElementById('tabBtnReview')?.addEventListener('click', () =>
      this.setMainTab('review')
    );
    document.getElementById('tabBtnWords')?.addEventListener('click', () =>
      this.setMainTab('words')
    );
    document.getElementById('vocabTabs')?.addEventListener('keydown', (e) =>
      this.onMainTabsKeydown(e)
    );

    document.getElementById('vocabSettingsLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    document.getElementById('reviewReveal')?.addEventListener('click', () =>
      void this.revealTranslationMotion()
    );
    document.getElementById('reviewGotIt')?.addEventListener('click', () => void this.onGotIt());
    document.getElementById('reviewAgain')?.addEventListener('click', () => void this.onReviewAgain());

    document.getElementById('langFilter')?.addEventListener('change', (e) => {
      this.filterLang = (e.target && e.target.value) || '';
      this.renderTable();
    });
  }

  /** @param {KeyboardEvent} e */
  onMainTabsKeydown(e) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const tabs = [...document.querySelectorAll('#vocabTabs [role="tab"][data-tab-target]')];
    if (tabs.length < 2) return;
    e.preventDefault();
    const idx = tabs.findIndex((btn) => btn.classList.contains('is-active'));
    const clamped = idx < 0 ? 0 : idx;
    let next = clamped;
    if (e.key === 'ArrowLeft') next = Math.max(0, clamped - 1);
    if (e.key === 'ArrowRight') next = Math.min(tabs.length - 1, clamped + 1);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    const btn = tabs[next];
    /** @type {string} */
    const target = btn?.dataset.tabTarget ?? 'review';
    this.setMainTab(target === 'words' ? 'words' : 'review');
    btn?.focus?.();
  }

  /**
   * @param {'review' | 'words'} which
   */
  async setMainTab(which) {
    const reviewBtn = document.getElementById('tabBtnReview');
    const wordsBtn = document.getElementById('tabBtnWords');
    const reviewPanel = document.getElementById('tabPanelReview');
    const wordsPanel = document.getElementById('tabPanelWords');
    if (!reviewBtn || !wordsBtn || !reviewPanel || !wordsPanel) return;

    const isWords = which === 'words';
    if (isWords && !wordsPanel.hidden) return;
    if (!isWords && !reviewPanel.hidden) return;
    if (this._tabAnimating) return;

    const applyChrome = () => {
      reviewBtn.classList.toggle('is-active', !isWords);
      wordsBtn.classList.toggle('is-active', isWords);
      reviewBtn.setAttribute('aria-selected', String(!isWords));
      wordsBtn.setAttribute('aria-selected', String(isWords));
      reviewBtn.tabIndex = isWords ? -1 : 0;
      wordsBtn.tabIndex = isWords ? 0 : -1;
    };

    if (prefersReducedMotion()) {
      applyChrome();
      reviewPanel.hidden = isWords;
      wordsPanel.hidden = !isWords;
      return;
    }

    const outgoing = isWords ? reviewPanel : wordsPanel;
    const incoming = isWords ? wordsPanel : reviewPanel;
    this._tabAnimating = true;

    try {
      await animate(
        outgoing,
        { opacity: [1, 0], y: [0, 10] },
        { duration: 0.2, ease: EASE_IN }
      ).finished;

      applyChrome();
      outgoing.hidden = true;
      incoming.hidden = false;

      await animate(
        incoming,
        { opacity: [0, 1], y: [14, 0] },
        { duration: 0.28, ease: EASE_OUT }
      ).finished;

      animate(outgoing, { opacity: 1, y: 0 }, { duration: 0 });
      animate(incoming, { opacity: 1, y: 0 }, { duration: 0 });
    } finally {
      this._tabAnimating = false;
    }
  }

  /** Debounced; used when `renderTable({ animateRows: true })` opts in. */
  scheduleTableRowsStagger() {
    if (prefersReducedMotion()) return;
    if (this._tableStaggerTimer != null) {
      clearTimeout(this._tableStaggerTimer);
    }
    this._tableStaggerTimer = setTimeout(() => {
      this._tableStaggerTimer = null;
      this.staggerTableRowsIn();
    }, 32);
  }

  staggerTableRowsIn() {
    if (prefersReducedMotion()) return;
    const wordsPanel = document.getElementById('tabPanelWords');
    if (!wordsPanel || wordsPanel.hidden) return;

    this._rowAnimControls.forEach((c) => stopMotion(c));
    this._rowAnimControls = [];

    const rows = [...document.querySelectorAll('#vocabRows tr')];
    const maxRows = 20;
    const duration = 0.14;
    const y = 3;

    rows.slice(0, maxRows).forEach((tr) => {
      const ctl = animate(
        tr,
        { opacity: [0.92, 1], y: [y, 0] },
        { duration, delay: 0, ease: EASE_OUT }
      );
      this._rowAnimControls.push(ctl);
    });
  }

  // ── Page intro (shell card presents itself) ──────────────────────────────

  async runPageIntroMotion() {
    if (prefersReducedMotion()) return;

    const shell = document.querySelector('.vocab-shell');
    const brand = document.querySelector('.vocab-brand');
    const headerText = document.querySelector('.vocab-header-text');
    const mainTitleIcon = document.querySelector('.main-title-icon');
    const heading = document.getElementById('reviewHeading');
    const tabsStrip = document.getElementById('vocabTabBar');
    const settingsLink = document.getElementById('vocabSettingsLink');
    const reveal = document.querySelector('.vocab-review-reveal');
    const face = document.querySelector('.vocab-review-card-stack .vocab-review-content');

    /** @type {Promise<unknown>[]} */
    const jobs = [];

    if (shell) {
      jobs.push(
        animate(shell, { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.35, ease: EASE_OUT }).finished
      );
    }

    await Promise.all(jobs);
    jobs.length = 0;

    if (brand) jobs.push(animate(brand, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, ease: EASE_OUT }).finished);

    if (headerText)
      jobs.push(
        animate(headerText, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, ease: EASE_OUT, delay: 0.05 }).finished
      );

    if (mainTitleIcon)
      jobs.push(
        animate(mainTitleIcon, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, ease: EASE_OUT, delay: 0.07 }).finished
      );

    if (heading && !heading.hidden)
      jobs.push(
        animate(heading, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, ease: EASE_OUT, delay: 0.09 }).finished
      );

    if (tabsStrip)
      jobs.push(
        animate(tabsStrip, { opacity: [0, 1], y: [8, 0] }, { duration: 0.26, ease: EASE_OUT, delay: 0.11 }).finished
      );

    if (settingsLink)
      jobs.push(
        animate(settingsLink, { opacity: [0, 1], scale: [0.85, 1] }, { duration: 0.24, ease: EASE_OUT, delay: 0.12 }).finished
      );

    if (face)
      jobs.push(
        animate(face, { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, ease: EASE_OUT, delay: 0.13 }).finished
      );

    if (reveal)
      jobs.push(
        animate(reveal, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, ease: EASE_OUT, delay: 0.16 }).finished
      );

    await Promise.all(jobs);
  }

  // ── Card exit / enter (no deck layers in new design) ─────────────────────

  getReviewCardAnimEl() {
    return document.querySelector('.vocab-review-card-anim');
  }

  /**
   * Exit animation: fade card face and reveal button out (slide up slightly).
   */
  async runCardExit() {
    if (prefersReducedMotion()) return;

    const root = this.getReviewCardAnimEl();
    if (!root) return;

    const face = root.querySelector('.vocab-review-card-stack .vocab-review-content');
    const reveal = root.querySelector('.vocab-review-reveal');
    if (!face && !reveal) return;

    /** @type {Promise<unknown>[]} */
    const jobs = [];
    if (face) {
      jobs.push(
        animate(face, { opacity: [null, 0], y: [null, -12], scale: [null, 0.98] }, { duration: 0.24, ease: EASE_IN }).finished
      );
    }
    if (reveal) {
      jobs.push(
        animate(reveal, { opacity: [null, 0], y: [null, -6] }, { duration: 0.2, ease: EASE_IN }).finished
      );
    }
    await Promise.all(jobs);
  }

  /**
   * Enter animation: fade card face and reveal button in (slide up into place).
   */
  async runCardEnter() {
    if (prefersReducedMotion()) return;

    const root = this.getReviewCardAnimEl();
    if (!root) return;

    const active = document.getElementById('reviewActive');
    if (!active || active.hidden) return;

    const reviewPanel = document.getElementById('tabPanelReview');
    if (!reviewPanel || reviewPanel.hidden) return;

    const face = root.querySelector('.vocab-review-card-stack .vocab-review-content');
    const reveal = root.querySelector('.vocab-review-reveal');
    if (!face) return;

    /** @type {Promise<unknown>[]} */
    const jobs = [];
    jobs.push(
      animate(face, { opacity: [0, 1], y: [12, 0], scale: [0.98, 1] }, { duration: 0.28, ease: EASE_OUT }).finished
    );
    if (reveal) {
      jobs.push(
        animate(reveal, { opacity: [0, 1], y: [6, 0] }, { duration: 0.24, ease: EASE_OUT, delay: 0.05 }).finished
      );
    }
    await Promise.all(jobs);

    /** Reset Motion offsets leaking into layout */
    animate(face, { y: 0, scale: 1 }, { duration: 0 });
    if (reveal) animate(reveal, { y: 0 }, { duration: 0 });
  }

  /**
   * Blackout → swap DOM → enter.
   * @param {() => void | Promise<void>} swapFn
   */
  async runSwapPhaseThenEnter(swapFn) {
    const card = document.getElementById('reviewCard');

    if (!card || prefersReducedMotion()) {
      await Promise.resolve(swapFn());
      await this.runCardEnter();
      return;
    }

    card.classList.add('is-review-swap-hide');
    try {
      await Promise.resolve(swapFn());
    } finally {
      card.classList.remove('is-review-swap-hide');
    }
    await this.runCardEnter();
  }

  // ── Flip reveal ──────────────────────────────────────────────────────────

  async revealTranslationMotion() {
    const flipInner = document.getElementById('reviewFlipInner');
    const answer = document.getElementById('reviewAnswer');
    const revealBtn = document.getElementById('reviewReveal');
    const trans = document.getElementById('reviewTranslation');
    if (!flipInner) return;

    if (flipInner.classList.contains('is-flipped')) return;

    if (prefersReducedMotion()) {
      flipInner.classList.add('is-flipped');
      if (answer) answer.hidden = false;
      if (revealBtn) revealBtn.hidden = true;
      if (trans) trans.hidden = false;
      return;
    }

    flipInner.classList.add('is-flipped');
    if (answer) answer.hidden = false;
    if (revealBtn) revealBtn.hidden = true;
    if (trans) trans.hidden = false;

    await animate(flipInner, { rotateY: [0, 180] }, { duration: 0.5, ease: EASE_OUT }).finished;
  }

  resetRevealUi() {
    const flipInner = document.getElementById('reviewFlipInner');
    const answer = document.getElementById('reviewAnswer');
    const revealBtn = document.getElementById('reviewReveal');
    const trans = document.getElementById('reviewTranslation');

    flipInner?.classList.remove('is-flipped');

    const dur = prefersReducedMotion() ? 0 : 0.38;
    if (flipInner) {
      animate(flipInner, { rotateY: 0 }, { duration: dur }).finished.catch(() => {
        /**/
      });
    }

    if (answer) answer.hidden = true;
    if (revealBtn) revealBtn.hidden = false;
    if (trans) trans.hidden = true;
  }

  // ── All caught up celebration ────────────────────────────────────────────

  async runReviewCompleteEnterMotion() {
    if (prefersReducedMotion()) return;
    if (this._completeHasShown) return;

    const reviewTab = document.getElementById('tabPanelReview');
    if (!reviewTab || reviewTab.hidden) return;

    const el = document.getElementById('reviewComplete');
    if (!el || el.hidden) return;
    if (this._completeMotionBusy) return;

    this._completeMotionBusy = true;
    try {
      animate(el, { opacity: 0, y: 22 }, { duration: 0 });

      await animate(el, { opacity: [0, 1], y: [22, 0] }, { duration: 0.42, ease: EASE_OUT }).finished;
    } finally {
      this._completeMotionBusy = false;
      this._completeHasShown = true;
      animate(el, { opacity: 1, y: 0 }, { duration: 0 });
    }
  }

  // ── Resume from empty (word added back to queue) ──────────────────────────

  async runReviewResumeFromEmptyMotion() {
    if (prefersReducedMotion()) return;
    const reviewTab = document.getElementById('tabPanelReview');
    if (!reviewTab || reviewTab.hidden) return;

    const active = document.getElementById('reviewActive');
    const heading = document.getElementById('reviewHeading');
    if (!active || active.hidden) return;

    /** @type {Promise<unknown>[]} */
    const jobs = [];
    if (heading && !heading.hidden) {
      jobs.push(
        animate(heading, { opacity: [0, 1], y: [12, 0] }, { duration: 0.34, ease: EASE_OUT }).finished
      );
    }
    jobs.push(
      animate(active, { opacity: [0, 1], y: [16, 0] }, { duration: 0.38, ease: EASE_OUT, delay: 0.04 }).finished
    );
    await Promise.all(jobs);
  }

  // ── Persist & refresh ────────────────────────────────────────────────────

  async persistCurrentGotItAndRefresh() {
    const queue = buildQueue(this.list, this.reviewedIds);
    if (queue.length === 0) return;
    const idx = this.reviewCursor % queue.length;
    const entry = queue[idx];
    const id = entry.id;
    if (!id) return;

    const { reviewedIds, today } = await loadVocabState();
    if (!reviewedIds.includes(id)) {
      reviewedIds.push(id);
      await chrome.storage.local.set({
        [STORAGE_REVIEW_IDS]: reviewedIds,
        [STORAGE_REVIEW_DAY]: today
      });
    }
    this.reviewCursor = 0;
    await this.refresh();
  }

  async refresh() {
    const { list, reviewedIds } = await loadVocabState();
    this.list = list;
    this.reviewedIds = reviewedIds;

    const statsEl = document.getElementById('vocabStats');
    if (statsEl) {
      statsEl.textContent = `${list.length} words saved · ${reviewedIds.length} reviewed today`;
    }

    this.updateLangFilterOptions(list);
    this.renderReview();
    this.renderTable();
  }

  updateLangFilterOptions(list) {
    const sel = document.getElementById('langFilter');
    if (!sel) return;
    const current = sel.value;
    const codes = [...new Set(list.map((e) => e.sourceLang).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All</option>';
    for (const c of codes) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    }
    if (codes.includes(current)) {
      sel.value = current;
      this.filterLang = current;
    } else {
      this.filterLang = '';
      sel.value = '';
    }
  }

  getFilteredList() {
    if (!this.filterLang) return [...this.list];
    return this.list.filter((e) => e.sourceLang === this.filterLang);
  }

  renderReview() {
    const prevHad = this._hadReviewQueue;
    const queue = buildQueue(this.list, this.reviewedIds);
    const hasQueue = queue.length > 0;
    const active = document.getElementById('reviewActive');
    const complete = document.getElementById('reviewComplete');
    const panel = document.getElementById('reviewPanel');
    const card = document.getElementById('reviewCard');

    const shouldAnimStates =
      !prefersReducedMotion() && document.body.classList.contains('is-ready');

    this.resetRevealUi();

    if (!hasQueue) {
      card?.classList.add('is-review-empty');
      if (active) active.hidden = true;
      if (complete) complete.hidden = false;
      if (panel) {
        panel.removeAttribute('aria-labelledby');
        panel.setAttribute('aria-label', "Today's review — all caught up");
      }
      this._hadReviewQueue = false;
      if (shouldAnimStates && prevHad === true && !this._completeHasShown) void this.runReviewCompleteEnterMotion();
      return;
    }

    card?.classList.remove('is-review-empty');
    if (active) active.hidden = false;
    if (complete) complete.hidden = true;
    if (panel) {
      panel.setAttribute('aria-labelledby', 'reviewHeading');
      panel.removeAttribute('aria-label');
    }

    const idx = this.reviewCursor % queue.length;
    const entry = queue[idx];
    const orig = document.getElementById('reviewOriginal');
    const roman = document.getElementById('reviewRoman');
    const trans = document.getElementById('reviewTranslation');

    if (orig) orig.textContent = entry.original || '';
    if (roman) {
      const r = entry.romanization;
      if (r && String(r).trim()) {
        roman.textContent = String(r).trim();
        roman.hidden = false;
      } else {
        roman.textContent = '';
        roman.hidden = true;
      }
    }
    if (trans) trans.textContent = entry.translation || '';

    this._hadReviewQueue = true;
    if (shouldAnimStates && prevHad === false) void this.runReviewResumeFromEmptyMotion();
  }

  // ── Button handlers ──────────────────────────────────────────────────────

  async onGotIt() {
    const queue = buildQueue(this.list, this.reviewedIds);
    if (queue.length === 0) return;
    const idx = this.reviewCursor % queue.length;
    const entry = queue[idx];
    const id = entry.id;
    if (!id) return;
    if (this.reviewAnimBusy) return;

    if (prefersReducedMotion()) {
      await this.persistCurrentGotItAndRefresh();
      return;
    }

    const anim = this.getReviewCardAnimEl();
    if (!anim) {
      await this.persistCurrentGotItAndRefresh();
      return;
    }

    this.reviewAnimBusy = true;
    try {
      await this.runCardExit();
      await this.runSwapPhaseThenEnter(async () => {
        await this.persistCurrentGotItAndRefresh();
      });
    } catch (_) {
      document.getElementById('reviewCard')?.classList.remove('is-review-swap-hide');
    } finally {
      this.reviewAnimBusy = false;
      this.flushPendingRefreshIfNeeded();
    }
  }

  async onReviewAgain() {
    const queue = buildQueue(this.list, this.reviewedIds);
    if (queue.length === 0) return;
    if (this.reviewAnimBusy) return;

    if (prefersReducedMotion()) {
      this.reviewCursor++;
      this.resetRevealUi();
      this.renderReview();
      return;
    }

    const anim = this.getReviewCardAnimEl();
    if (!anim) {
      this.reviewCursor++;
      this.resetRevealUi();
      this.renderReview();
      return;
    }

    this.reviewAnimBusy = true;
    try {
      await animate(anim, { x: [0, -10, 10, -8, 8, 0] }, { duration: 0.4, ease: 'easeInOut' }).finished;
      await this.runCardExit();

      await this.runSwapPhaseThenEnter(async () => {
        this.reviewCursor++;
        this.resetRevealUi();
        this.renderReview();
      });
    } catch (_) {
      document.getElementById('reviewCard')?.classList.remove('is-review-swap-hide');
    } finally {
      this.reviewAnimBusy = false;
      this.flushPendingRefreshIfNeeded();
    }
  }

  /**
   * Rebuild the All words table. Row Motion is skipped unless `animateRows` — avoids
   * restaggering on every delete/restore/filter/storage refresh while on this tab.
   * @param {{ animateRows?: boolean }} [opts]
   */
  renderTable(opts = {}) {
    const animateRows = opts.animateRows === true;
    const tbody = document.getElementById('vocabRows');
    if (!tbody) return;

    const rows = [...this.getFilteredList()].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    tbody.replaceChildren();

    for (const entry of rows) {
      const tr = document.createElement('tr');
      tr.dataset.id = entry.id;

      const tdOrig = document.createElement('td');
      tdOrig.className = 'vocab-cell-wrap';
      tdOrig.textContent = entry.original || '';

      const tdRom = document.createElement('td');
      tdRom.className = 'vocab-cell-clamp vocab-review-roman';
      tdRom.style.fontSize = '0.8125rem';
      tdRom.style.color = 'var(--v-muted)';
      tdRom.style.fontStyle = 'italic';
      tdRom.textContent = entry.romanization ? String(entry.romanization) : '—';

      const tdTrans = document.createElement('td');
      tdTrans.className = 'vocab-cell-wrap';
      tdTrans.textContent = entry.translation || '';

      const tdLang = document.createElement('td');
      tdLang.className = 'vocab-lang-code';
      tdLang.textContent = entry.sourceLang || '—';

      const tdSrc = document.createElement('td');
      const url = entry.sourceUrl || '';
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'vocab-source-link';
        const img = document.createElement('img');
        img.src = faviconUrlForPageUrl(url);
        img.alt = '';
        img.className = 'vocab-favicon';
        img.width = 16;
        img.height = 16;
        a.appendChild(img);
        tdSrc.appendChild(a);
      } else {
        tdSrc.textContent = '—';
      }

      const tdDate = document.createElement('td');
      tdDate.textContent = formatSavedAt(entry.savedAt);

      const tdActions = document.createElement('td');
      tdActions.className = 'vocab-td-actions';
      const actionsRow = document.createElement('div');
      actionsRow.className = 'vocab-table-actions';

      const showRestore = entry.id && this.reviewedIds.includes(entry.id);
      if (showRestore) {
        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'vocab-btn-icon vocab-btn-queue';
        restoreBtn.setAttribute('aria-label', 'Return word to today’s review queue');
        restoreBtn.title = 'Return to review';
        restoreBtn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-ccw-icon lucide-refresh-ccw"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>';
        restoreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.restoreWordToReview(entry.id);
        });
        actionsRow.appendChild(restoreBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'vocab-btn-icon';
      delBtn.setAttribute('aria-label', 'Delete entry');
      delBtn.title = 'Remove';
      delBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.deleteEntry(entry.id);
      });
      actionsRow.appendChild(delBtn);
      tdActions.appendChild(actionsRow);

      tr.appendChild(tdOrig);
      tr.appendChild(tdRom);
      tr.appendChild(tdTrans);
      tr.appendChild(tdLang);
      tr.appendChild(tdSrc);
      tr.appendChild(tdDate);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    }

    const wordsPanel = document.getElementById('tabPanelWords');
    if (
      animateRows &&
      !prefersReducedMotion() &&
      document.body.classList.contains('is-ready') &&
      wordsPanel &&
      !wordsPanel.hidden
    ) {
      this.scheduleTableRowsStagger();
    }
  }

  async deleteEntry(id) {
    if (!id) return;
    const raw = await chrome.storage.local.get([STORAGE_VOCAB, STORAGE_REVIEW_IDS]);
    let list = Array.isArray(raw[STORAGE_VOCAB]) ? raw[STORAGE_VOCAB] : [];
    list = list.filter((e) => e && e.id !== id);
    const reviewedRaw = raw[STORAGE_REVIEW_IDS];
    const reviewed = Array.isArray(reviewedRaw) ? reviewedRaw.filter((x) => x !== id) : [];
    await chrome.storage.local.set({
      [STORAGE_VOCAB]: list,
      [STORAGE_REVIEW_IDS]: reviewed
    });
    this.reviewCursor = 0;
    await this.refresh();
  }

  async restoreWordToReview(id) {
    if (!id) return;
    if (this.reviewAnimBusy) return;
    const { reviewedIds, today } = await loadVocabState();
    const next = reviewedIds.filter((x) => x !== id);
    await chrome.storage.local.set({
      [STORAGE_REVIEW_IDS]: next,
      [STORAGE_REVIEW_DAY]: today
    });
    this.reviewCursor = 0;
    await this.refresh();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new VocabularyPageApp();
  void app.init();
});
