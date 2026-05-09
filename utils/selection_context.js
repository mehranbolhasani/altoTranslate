// Builds a bounded snippet around the user's selection for LLM prompts (disambiguation only).
// Chrome extension: globals; Node tests: module.exports gate at bottom.

/** @typedef {{ maxChars?: number, minAround?: number }} SelectionContextOptions */

var DEFAULT_SELECTION_CONTEXT_CHARS = 512;
var DEFAULT_SELECTION_CONTEXT_MIN_AROUND = 100;

/**
 * Expand index left to sentence-ish start (newline or after .!? + spaces).
 * @param {string} s
 * @param {number} selStart
 * @returns {number}
 */
function findSnippetExpandedStart(s, selStart) {
  var best = 0;
  var i = selStart - 1;
  while (i >= 0) {
    if (s.charCodeAt(i) === 10) {
      best = i + 1;
      break;
    }
    var ch = s[i];
    if (ch === '.' || ch === '!' || ch === '?') {
      var j = i + 1;
      while (j < selStart && /\s/u.test(s[j])) j++;
      best = j;
      break;
    }
    i--;
  }
  return Math.min(best, selStart);
}

/**
 * Expand index right to sentence-ish end.
 * @param {string} s
 * @param {number} selEnd
 * @returns {number}
 */
function findSnippetExpandedEnd(s, selEnd) {
  var j = selEnd;
  while (j < s.length) {
    if (s.charCodeAt(j) === 10) return j;
    var ch = s[j];
    if (ch === '.' || ch === '!' || ch === '?') {
      var k = j + 1;
      while (k < s.length && /\s/u.test(s[k])) k++;
      return k;
    }
    j++;
  }
  return s.length;
}

/**
 * @param {string} s
 * @param {number} selStart
 * @param {number} selEnd
 * @param {number} minAround
 * @param {number} maxChars
 */
function snippetClampWithMinAround(s, selStart, selEnd, minAround, maxChars) {
  var start = Math.max(0, selStart - minAround);
  var end = Math.min(s.length, selEnd + minAround);
  if (end - start > maxChars) {
    var mid = Math.floor((selStart + selEnd) / 2);
    var half = Math.floor(maxChars / 2);
    start = Math.max(0, mid - half);
    end = Math.min(s.length, start + maxChars);
    start = Math.max(0, end - maxChars);
  }
  return { start: start, end: end };
}

/**
 * Build a snippet embedding the selection for API context only.
 *
 * @param {string} before - Text before selection in container
 * @param {string} selected - Selected text from DOM range (may include inner whitespace vs trim)
 * @param {string} after - Text after selection in container
 * @param {SelectionContextOptions} [options]
 * @returns {string|null}
 */
function buildTranslationContextSnippet(before, selected, after, options) {
  var maxChars =
    options && options.maxChars !== undefined ? options.maxChars : DEFAULT_SELECTION_CONTEXT_CHARS;
  var minAround =
    options && options.minAround !== undefined ? options.minAround : DEFAULT_SELECTION_CONTEXT_MIN_AROUND;

  var b = before == null ? '' : String(before);
  var sel = selected == null ? '' : String(selected);
  var a = after == null ? '' : String(after);

  if (sel.trim().length < 2) return null;

  var full = b + sel + a;
  var selStart = b.length;
  var selEnd = selStart + sel.length;

  if (b.trim().length === 0 && a.trim().length === 0) {
    return null;
  }

  var start = findSnippetExpandedStart(full, selStart);
  var end = findSnippetExpandedEnd(full, selEnd);

  var span = full.slice(start, end);
  var minWindow = Math.min(sel.length + 2 * minAround, maxChars);
  if ((end - start) < minWindow) {
    var fb = snippetClampWithMinAround(full, selStart, selEnd, minAround, maxChars);
    start = Math.min(start, fb.start);
    end = Math.max(end, fb.end);
    span = full.slice(start, end);
  }

  if (span.length > maxChars) {
    var relativeMid = Math.floor((selStart + selEnd) / 2 - start);
    var halfMc = Math.floor(maxChars / 2);
    var s0 = Math.max(0, relativeMid - halfMc);
    var s1 = Math.min(span.length, s0 + maxChars);
    s0 = Math.max(0, s1 - maxChars);
    start += s0;
    span = span.slice(s0, s1);
  }

  var out = span.replace(/\u00a0/g, ' ').trim();
  if (!out) return null;
  return out;
}

/** Truncate snippet for prompts (never throws). */
function clampContextSnippetForApi(snippet, cap) {
  var c = cap !== undefined ? cap : DEFAULT_SELECTION_CONTEXT_CHARS;
  var s = typeof snippet !== 'string' ? '' : snippet.trim();
  if (!s) return '';
  if (s.length <= c) return s;
  return s.slice(0, c).trimEnd() + '\u2026';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildTranslationContextSnippet,
    clampContextSnippetForApi,
    findSnippetExpandedStart,
    findSnippetExpandedEnd,
    DEFAULT_SELECTION_CONTEXT_CHARS,
    DEFAULT_SELECTION_CONTEXT_MIN_AROUND
  };
}
