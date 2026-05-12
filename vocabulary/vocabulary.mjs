/**
 * Vocabulary page — Motion-driven UI (bundled MV3-safe module).
 */
import { animate } from '../vendor/motion-lib.js';

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
      month: 'short',
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

function prefersReducedMotion() {
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
    /** @type {ReturnType<typeof animate> | null} */
    this._floatCtlBefore = null;
    /** @type {ReturnType<typeof animate> | null} */
    this._floatCtlAfter = null;
  }

  flushPendingRefreshIfNeeded() {
    if (!this.pendingStorageRefresh) return;
    this.pendingStorageRefresh = false;
    void this.refresh();
  }

  /** @returns {{ face: Element | null; layerBefore: Element | null; layerAfter: Element | null }} */
  static deckEls(stack) {
    const face = stack?.querySelector?.('.vocab-review-content');
    const layerBefore = stack?.querySelector?.('.vocab-deck-layer--before');
    const layerAfter = stack?.querySelector?.('.vocab-deck-layer--after');
    return { face, layerBefore, layerAfter };
  }

  stopDeckFloat() {
    stopMotion(this._floatCtlBefore);
    stopMotion(this._floatCtlAfter);
    this._floatCtlBefore = null;
    this._floatCtlAfter = null;
  }

  /** Idle drift on ghost layers (paused during exit/shake paths). */
  maybeStartDeckFloat() {
    this.stopDeckFloat();
    if (prefersReducedMotion()) return;

    /** Intro adds `body.is-ready` after Motion settles; floating mid-intro fights hidden layout. */
    if (!document.body.classList.contains('is-ready')) return;

    const reviewPanel = document.getElementById('tabPanelReview');
    if (!reviewPanel || reviewPanel.hidden) return;

    const active = document.getElementById('reviewActive');
    if (!active || active.hidden || this.reviewAnimBusy) return;

    const stack = document.querySelector('.vocab-review-card-stack');
    const { layerBefore, layerAfter } = VocabularyPageApp.deckEls(stack);
    if (!layerBefore || !layerAfter) return;

    this._floatCtlBefore = animate(
      layerBefore,
      {
        transform: [
          'translate(10px, 4px) rotate(3deg)',
          'translate(10px, 10px) rotate(3deg)',
          'translate(10px, 4px) rotate(3deg)'
        ]
      },
      { duration: 5, repeat: Infinity, ease: 'easeInOut' }
    );

    this._floatCtlAfter = animate(
      layerAfter,
      {
        transform: [
          'translate(-10px, -4px) rotate(-5deg)',
          'translate(-10px, -10px) rotate(-5deg)',
          'translate(-10px, -4px) rotate(-5deg)'
        ]
      },
      { duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }
    );
  }

  async init() {
    this.bind();
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

    if (!prefersReducedMotion()) await this.runPageIntroMotion();

    document.body.classList.add('is-ready');

    if (!prefersReducedMotion()) {
      const c = document.getElementById('reviewComplete');
      if (c && !c.hidden && buildQueue(this.list, this.reviewedIds).length === 0) {
        animate(c, { opacity: 0, y: 22 }, { duration: 0 });
        const ic = c.querySelector('.vocab-review-complete-icon');
        if (ic) animate(ic, { scale: 0.88 }, { duration: 0 });
      }
    }

    queueMicrotask(() => {
      if (prefersReducedMotion()) return;
      if (buildQueue(this.list, this.reviewedIds).length > 0) return;
      void this.runReviewCompleteEnterMotion();
    });

    /** @remarks First float after DOM visible */
    queueMicrotask(() => this.maybeStartDeckFloat());
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
      if (isWords) {
        this.stopDeckFloat();
      } else queueMicrotask(() => this.maybeStartDeckFloat());
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

      if (isWords) {
        this.stopDeckFloat();
      } else queueMicrotask(() => this.maybeStartDeckFloat());
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
    /** Parallel subtle nudge — no per-row stagger (feels calmer than cascading). */
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

  async runReviewCompleteEnterMotion() {
    if (prefersReducedMotion()) return;

    const reviewTab = document.getElementById('tabPanelReview');
    if (!reviewTab || reviewTab.hidden) return;

    const el = document.getElementById('reviewComplete');
    if (!el || el.hidden) return;
    if (this._completeMotionBusy) return;

    const icon = el.querySelector('.vocab-review-complete-icon');

    this._completeMotionBusy = true;
    try {
      animate(el, { opacity: 0, y: 22 }, { duration: 0 });
      if (icon) animate(icon, { scale: 0.88 }, { duration: 0 });

      /** Parent `el` opacity fades the whole block; icon uses scale only (no nested opacity). */
      /** @type {Promise<unknown>[]} */
      const jobs = [
        animate(el, { opacity: [0, 1], y: [22, 0] }, { duration: 0.42, ease: EASE_OUT }).finished
      ];
      if (icon) {
        jobs.push(
          animate(icon, { scale: [0.88, 1] }, { duration: 0.36, ease: EASE_OUT, delay: 0.05 }).finished
        );
      }
      await Promise.all(jobs);
    } finally {
      this._completeMotionBusy = false;
      animate(el, { opacity: 1, y: 0 }, { duration: 0 });
      if (icon) animate(icon, { scale: 1 }, { duration: 0 });
    }
  }

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

  async runPageIntroMotion() {
    if (prefersReducedMotion()) return;

    const brand = document.querySelector('.vocab-brand');
    const headerText = document.querySelector('.vocab-header-text');
    const tabsStrip = document.getElementById('vocabTabBar');
    const heading = document.querySelector('.vocab-review-heading');
    const reveal = document.querySelector('.vocab-review-reveal');
    const face = document.querySelector('.vocab-review-card-stack .vocab-review-content');
    const layerBefore = document.querySelector('.vocab-deck-layer--before');
    const layerAfter = document.querySelector('.vocab-deck-layer--after');
    const d = 0.36;

    /** @type {Promise<unknown>[]} */
    const jobs = [];

    if (brand) jobs.push(animate(brand, { opacity: [0, 1], y: [8, 0] }, { duration: d, ease: EASE_OUT }).finished);

    if (headerText)
      jobs.push(
        animate(headerText, { opacity: [0, 1], y: [8, 0] }, { duration: d, ease: EASE_OUT, delay: 0.055 }).finished
      );

    if (tabsStrip)
      jobs.push(
        animate(tabsStrip, { opacity: [0, 1], y: [8, 0] }, { duration: d, ease: EASE_OUT, delay: 0.082 }).finished
      );

    if (heading && !heading.hidden)
      jobs.push(
        animate(heading, { opacity: [0, 1], y: [8, 0] }, { duration: d, ease: EASE_OUT, delay: 0.11 }).finished
      );

    if (face)
      jobs.push(
        animate(face, { opacity: [0, 1], y: [8, 0] }, { duration: 0.34, ease: EASE_OUT, delay: 0.165 }).finished
      );

    if (reveal)
      jobs.push(
        animate(reveal, { opacity: [0, 1], y: [8, 0] }, { duration: 0.34, ease: EASE_OUT, delay: 0.68 }).finished
      );

    if (layerBefore)
      jobs.push(animate(layerBefore, { opacity: [0, 0.5] }, { duration: 0.38, ease: EASE_OUT, delay: 0.52 }).finished);

    if (layerAfter)
      jobs.push(animate(layerAfter, { opacity: [0, 0.5] }, { duration: 0.38, ease: EASE_OUT, delay: 0.6 }).finished);

    await Promise.all(jobs);
  }

  getReviewCardAnimEl() {
    return document.querySelector('.vocab-review-card-anim');
  }

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

  /** @param {HTMLElement | null} [anim] */
  async runDeckExit(anim) {
    if (prefersReducedMotion()) return;
    const root = anim || this.getReviewCardAnimEl();
    if (!root) return;

    const stack = root.querySelector('.vocab-review-card-stack');
    const reveal = root.querySelector('.vocab-review-reveal');
    if (!stack) return;

    const { face, layerBefore, layerAfter } = VocabularyPageApp.deckEls(stack);
    if (!face || !layerBefore || !layerAfter || !reveal) return;

    this.stopDeckFloat();

    await Promise.all([
      animate(
        face,
        { opacity: [null, 0], x: [null, 52], y: [null, 6], scale: [null, 0.992] },
        { duration: 0.32, ease: EASE_IN }
      ).finished,
      animate(
        layerBefore,
        { opacity: [null, 0], x: [null, 76], y: [null, -2], rotate: [null, 9] },
        { duration: 0.32, ease: EASE_IN, delay: 0.055 }
      ).finished,
      animate(
        layerAfter,
        { opacity: [null, 0], x: [null, 52], y: [null, -10], rotate: [null, -14] },
        { duration: 0.32, ease: EASE_IN, delay: 0.11 }
      ).finished,
      animate(reveal, { opacity: [null, 0], x: [null, 34], y: [null, 6] }, { duration: 0.3, ease: EASE_IN, delay: 0.165 })
        .finished
    ]);
  }

  /** @returns {Promise<void>} */
  async runDeckEnter() {
    if (prefersReducedMotion()) return;

    const root = this.getReviewCardAnimEl();
    const stack = root?.querySelector('.vocab-review-card-stack');
    const reveal = root?.querySelector('.vocab-review-reveal');
    if (!stack) return Promise.resolve();

    const active = document.getElementById('reviewActive');
    if (!active || active.hidden) return Promise.resolve();

    const reviewPanel = document.getElementById('tabPanelReview');
    if (!reviewPanel || reviewPanel.hidden) return Promise.resolve();

    const { face, layerBefore, layerAfter } = VocabularyPageApp.deckEls(stack);
    if (!face || !layerBefore || !layerAfter || !reveal) return Promise.resolve();

    await Promise.all([
      animate(
        layerAfter,
        {
          opacity: [0, 0.5],
          x: [-22, -10],
          y: [12, -4],
          rotate: [-12, -5]
        },
        { duration: 0.36, ease: EASE_OUT }
      ).finished,
      animate(
        layerBefore,
        {
          opacity: [0, 0.5],
          x: [-8, 10],
          y: [16, 4],
          rotate: [-1, 3]
        },
        { duration: 0.36, ease: EASE_OUT, delay: 0.07 }
      ).finished,
      animate(
        face,
        {
          opacity: [0, 1],
          x: [-22, 0],
          y: [8, 0],
          scale: [0.993, 1]
        },
        { duration: 0.36, ease: EASE_OUT, delay: 0.135 }
      ).finished,
      animate(reveal, { opacity: [0, 1], x: [-16, 0], y: [5, 0] }, { duration: 0.34, ease: EASE_OUT, delay: 0.2 })
        .finished
    ]);

    /** Reset Motion offsets leaking into layout */
    animate(stack, { x: 0 }, { duration: 0 });
    animate(reveal, { x: 0, y: 0 }, { duration: 0 });

    this.maybeStartDeckFloat();
  }

  /**
   * @param {() => void | Promise<void>} swapFn
   * @returns {Promise<void>}
   */
  async runSwapPhaseThenEnter(swapFn) {
    const card = document.getElementById('reviewCard');

    /** @returns {Promise<void>} */
    const runDeckEnterWrapped = async () => {
      await this.runDeckEnter();
    };

    if (!card || prefersReducedMotion()) {
      await Promise.resolve(swapFn());
      await runDeckEnterWrapped();
      return;
    }

    card.classList.add('is-review-swap-hide');
    try {
      await Promise.resolve(swapFn());
    } finally {
      card.classList.remove('is-review-swap-hide');
    }
    await runDeckEnterWrapped();
  }

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

    queueMicrotask(() => this.maybeStartDeckFloat());
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
    const heading = document.getElementById('reviewHeading');
    const panel = document.getElementById('reviewPanel');
    const card = document.getElementById('reviewCard');

    const shouldAnimStates =
      !prefersReducedMotion() && document.body.classList.contains('is-ready');

    this.resetRevealUi();

    if (!hasQueue) {
      card?.classList.add('is-review-empty');
      if (active) active.hidden = true;
      if (complete) complete.hidden = false;
      if (heading) heading.hidden = true;
      if (panel) {
        panel.removeAttribute('aria-labelledby');
        panel.setAttribute('aria-label', "Today’s review — all caught up");
      }
      this._hadReviewQueue = false;
      if (shouldAnimStates && prevHad === true) void this.runReviewCompleteEnterMotion();
      return;
    }

    card?.classList.remove('is-review-empty');
    if (active) active.hidden = false;
    if (complete) complete.hidden = true;
    if (heading) heading.hidden = false;
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
    if (!anim || !anim.querySelector('.vocab-review-card-stack')) {
      await this.persistCurrentGotItAndRefresh();
      return;
    }

    this.reviewAnimBusy = true;
    try {
      await this.runDeckExit(anim);
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
    const stack = anim?.querySelector('.vocab-review-card-stack');
    if (!anim || !stack) {
      this.reviewCursor++;
      this.resetRevealUi();
      this.renderReview();
      return;
    }

    this.reviewAnimBusy = true;
    try {
      this.stopDeckFloat();
      await animate(stack, { x: [0, -10, 10, -8, 8, 0] }, { duration: 0.4, ease: 'easeInOut' }).finished;
      await this.runDeckExit(anim);

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
        const host = parseHostname(url);
        const img = document.createElement('img');
        img.src = faviconUrlForPageUrl(url);
        img.alt = '';
        img.className = 'vocab-favicon';
        img.width = 16;
        img.height = 16;
        const span = document.createElement('span');
        span.className = 'vocab-source-domain';
        span.textContent = host || url;
        a.appendChild(img);
        // a.appendChild(span);
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
