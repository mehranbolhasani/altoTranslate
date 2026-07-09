// Dark Mode Detection and Application
// Supports three modes: 'light', 'dark', 'auto' (follow system preference).
// The chosen mode is persisted in localStorage (shared across all extension
// pages) so it survives reloads and stays consistent across pages.
//
// Pages with a #themeSwitcher segmented control get click handling wired up.
// Pages without it (onboarding, vocabulary) simply follow the stored choice.

var THEME_STORAGE_KEY = 'altoThemePreference';
var THEME_PREFS = ['light', 'dark', 'auto'];

function systemIsDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemIsDark() ? 'dark' : 'light';
}

function applyResolvedTheme(resolved) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function readStoredPref() {
  try {
    var v = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFS.indexOf(v) >= 0 ? v : 'auto';
  } catch (e) {
    return 'auto';
  }
}

function writeStoredPref(pref) {
  try { localStorage.setItem(THEME_STORAGE_KEY, pref); } catch (e) { /* ignore */ }
}

var currentPref = 'auto';

function applyTheme(pref) {
  currentPref = THEME_PREFS.indexOf(pref) >= 0 ? pref : 'auto';
  applyResolvedTheme(resolveTheme(currentPref));
  updateSwitcherUI();
}

function setThemePreference(pref) {
  if (THEME_PREFS.indexOf(pref) < 0) return;
  currentPref = pref;
  writeStoredPref(pref);
  applyResolvedTheme(resolveTheme(pref));
  updateSwitcherUI();
}

function updateSwitcherUI() {
  var switcher = document.getElementById('themeSwitcher');
  if (!switcher) return;
  var btns = switcher.querySelectorAll('.theme-switcher-btn');
  for (var i = 0; i < btns.length; i++) {
    var isActive = btns[i].getAttribute('data-theme') === currentPref;
    btns[i].classList.toggle('is-active', isActive);
    btns[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
}

function initThemeSwitcher() {
  var switcher = document.getElementById('themeSwitcher');
  if (!switcher || switcher.dataset.bound) return;
  switcher.dataset.bound = '1';
  switcher.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.theme-switcher-btn');
    if (!btn) return;
    setThemePreference(btn.getAttribute('data-theme'));
  });
}

// Apply immediately from storage to avoid a flash of the wrong theme.
applyTheme(readStoredPref());

document.addEventListener('DOMContentLoaded', function () {
  // Re-apply once the switcher exists in the DOM and wire up its clicks.
  applyTheme(readStoredPref());
  initThemeSwitcher();
});

// Follow the system preference live when in Auto mode.
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (currentPref === 'auto') applyResolvedTheme(resolveTheme('auto'));
  });
}
