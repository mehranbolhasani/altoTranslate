/* ═══════════════════════════════════════════════════════════════════════════
   AltoSelect — lightweight custom <select> enhancer.
   Zero dependencies, ~3 KB, accessible, follows project design tokens.
   Usage: import { enhanceSelect, enhanceAllSelects } from './utils/alto-select.js'
   ═══════════════════════════════════════════════════════════════════════════ */

let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const css = document.createElement('style');
  css.textContent = `
.alto-select-wrap {
  position: relative;
  width: 100%;
}
.alto-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 400;
  padding: 0.55rem 0.75rem;
  padding-right: 0.5rem;
  border: 1px solid var(--border-input, rgba(15,23,42,0.12));
  border-radius: 8px;
  background: var(--surface-card, #ffffff);
  color: var(--text, #1a1a1a);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  text-align: left;
  line-height: 1.4;
  user-select: none;
}
.vocab-page .alto-select-trigger {
  border-color: var(--v-border, #e5e5e5);
  background: var(--v-card, #ffffff);
  color: var(--v-text, #1a1a1a);
}
.alto-select-trigger:hover {
  border-color: var(--brand, #2563eb);
}
.alto-select-trigger:focus-visible {
  border-color: var(--brand, #2563eb);
  box-shadow: 0 0 0 3px var(--brand-soft, rgba(37,99,235,0.1));
}
.alto-select-arrow {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--text-muted, #9ca3af);
  transition: transform 0.2s ease;
}
.alto-select-wrap.is-open .alto-select-arrow {
  transform: rotate(180deg);
}
.alto-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 100;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-input, rgba(15,23,42,0.12));
  border-radius: 8px;
  background: var(--surface-card, #ffffff);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.vocab-page .alto-select-dropdown {
  border-color: var(--v-border, #e5e5e5);
  background: var(--v-card, #ffffff);
}
.alto-select-wrap.is-open .alto-select-dropdown {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.alto-select-option {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text, #1a1a1a);
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;
}
.vocab-page .alto-select-option {
  color: var(--v-text, #1a1a1a);
}
.alto-select-option:hover {
  background: var(--brand-soft, rgba(37,99,235,0.06));
}
.vocab-page .alto-select-option:hover {
  background: rgba(37,99,235,0.06);
}
.alto-select-option.is-selected {
  font-weight: 600;
  color: var(--brand, #2563eb);
}
.vocab-page .alto-select-option.is-selected {
  color: var(--v-blue, #2563eb);
}
.alto-select-dropdown::-webkit-scrollbar {
  width: 4px;
}
.alto-select-dropdown::-webkit-scrollbar-track {
  background: transparent;
}
.alto-select-dropdown::-webkit-scrollbar-thumb {
  background: var(--border-input, rgba(15,23,42,0.12));
  border-radius: 4px;
}
.dark .alto-select-trigger {
  border-color: var(--border-input, rgba(255,255,255,0.12));
  background: var(--surface-card, #1c1c1c);
  color: var(--text, #f5f5f5);
}
.dark .alto-select-dropdown {
  border-color: var(--border-input, rgba(255,255,255,0.12));
  background: var(--surface-card, #1c1c1c);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.dark .alto-select-option {
  color: var(--text, #f5f5f5);
}
.dark .alto-select-option:hover {
  background: rgba(96,165,250,0.1);
}
.dark .alto-select-option.is-selected {
  color: #93c5fd;
}
.vocab-page.dark .alto-select-trigger {
  border-color: var(--v-border, #2a2a2a);
  background: var(--v-card, #1c1c1c);
  color: var(--v-text, #f5f5f5);
}
.vocab-page.dark .alto-select-dropdown {
  border-color: var(--v-border, #2a2a2a);
  background: var(--v-card, #1c1c1c);
}
.vocab-page.dark .alto-select-option {
  color: var(--v-text, #f5f5f5);
}
.vocab-page.dark .alto-select-option.is-selected {
  color: #93c5fd;
}
`;
  document.head.appendChild(css);
}

function arrowSVG() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alto-select-arrow" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
}

export function enhanceSelect(selectEl) {
  if (!selectEl || selectEl.dataset.altoEnhanced) return;
  injectStyles();

  const wrap = document.createElement('div');
  wrap.className = 'alto-select-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'alto-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', selectEl.getAttribute('aria-label') || selectEl.getAttribute('placeholder') || 'Select option');

  const triggerText = document.createElement('span');
  triggerText.textContent = selectEl.options[selectEl.selectedIndex]?.textContent || selectEl.options[0]?.textContent || '';

  const dropdown = document.createElement('div');
  dropdown.className = 'alto-select-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', trigger.getAttribute('aria-label'));

  let isOpen = false;

  function buildOptions() {
    dropdown.textContent = '';
    for (const opt of selectEl.options) {
      const item = document.createElement('div');
      item.className = 'alto-select-option';
      if (opt.selected) item.classList.add('is-selected');
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(opt.selected));
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        select(opt.value);
        close();
      });
      dropdown.appendChild(item);
    }
  }

  function select(value) {
    selectEl.value = value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    triggerText.textContent = selectEl.options[selectEl.selectedIndex]?.textContent || '';
    for (const item of dropdown.children) {
      item.classList.toggle('is-selected', item.dataset.value === value);
      item.setAttribute('aria-selected', String(item.dataset.value === value));
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    wrap.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    const active = dropdown.querySelector('.is-selected');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    wrap.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    isOpen ? close() : open();
  }

  trigger.appendChild(triggerText);
  trigger.insertAdjacentHTML('beforeend', arrowSVG());
  trigger.addEventListener('click', toggle);

  selectEl.parentNode?.insertBefore(wrap, selectEl);
  wrap.appendChild(trigger);
  wrap.appendChild(dropdown);
  selectEl.style.display = 'none';
  selectEl.dataset.altoEnhanced = 'true';

  buildOptions();

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  document.addEventListener('focusin', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); trigger.focus(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); open(); const first = dropdown.firstElementChild; if (first) first.focus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); open(); const last = dropdown.lastElementChild; if (last) last.focus(); return; }
  });

  dropdown.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const active = document.activeElement;
      if (active && active.classList.contains('alto-select-option')) {
        select(active.dataset.value);
        close();
        trigger.focus();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = document.activeElement?.nextElementSibling;
      if (next && next.classList.contains('alto-select-option')) next.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = document.activeElement?.previousElementSibling;
      if (prev && prev.classList.contains('alto-select-option')) prev.focus();
      return;
    }
  });

  const observer = new MutationObserver(() => buildOptions());
  observer.observe(selectEl, { childList: true, subtree: true });
}

export function enhanceAllSelects(container) {
  const selects = (container || document).querySelectorAll(
    'select.onboarding-select, select.settings-select, select.vocab-select, select[data-enhance]'
  );
  for (const s of selects) enhanceSelect(s);
}
