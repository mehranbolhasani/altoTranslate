// Alto Cloud API integration
// Chrome Extension compatible - no CommonJS exports

const ALTO_CLOUD_API_BASE = 'https://api.altotranslate.xyz/v1/chat/completions';

const ALTO_CHUNK_MAX_CHARS = 400;   // chunk target size; below this, no chunking happens at all
const ALTO_CHUNK_MAX_COUNT = 8;     // hard cap on number of chunks for very long selections
const ALTO_RETRY_MODEL = 'google/gemini-2.5-flash'; // forced model for contamination retry

/**
 * Build a tight system prompt for Alto Cloud translation.
 * Explicit source/target language and a hard list of forbidden output types.
 * @param {string} targetLangName - Human-readable target language name
 * @param {string|null} sourceLangName - Human-readable source language name, or null if auto
 * @returns {string}
 */
function buildAltoCloudSystemPrompt(targetLangName, sourceLangName) {
  const direction = sourceLangName
    ? `from ${sourceLangName} to ${targetLangName}`
    : `to ${targetLangName}`;
  return (
    `You are a translation engine. Translate the user's text ${direction}. ` +
    `Output ONLY the translated text. ` +
    `Do not add explanations, transliterations, romanizations, parentheses, ` +
    `commentary, or notes of any kind. ` +
    `Do not switch to any language other than ${targetLangName} at any point. ` +
    `Translate ALL common nouns, adjectives, and verbs -- including words like "humans", ` +
    `"designer", "system", "mind" -- even if they look familiar in English. ` +
    `Only preserve: proper names (people, places), acronyms (AI, URL, API), ` +
    `brand names, and inline code. ` +
    `Every other word must be translated to ${targetLangName}.`
  );
}

/**
 * Detect a Latin-alphabet word in non-Latin-script output that is neither an
 * acronym (ALL CAPS) nor a proper noun (Title Case) -- i.e. a plain lowercase
 * or irregularly-cased word, which in a target language like Persian, Arabic,
 * Hebrew, Russian, or Chinese should not exist except as an intentionally
 * preserved acronym or name. Catches loanword contamination that has no
 * accented characters (e.g. "teknoloj", "resultados", "puede").
 *
 * URLs, emails, and bare domains are masked out first so they are never
 * mistaken for stray words.
 *
 * False positives are acceptable and expected (e.g. "iPhone", "eBay" style
 * mixed-case brand names) -- the caller only uses this to trigger a silent
 * best-effort retry, never to reject or error.
 *
 * @param {string} text
 * @returns {boolean}
 */
function hasSuspiciousLowercaseLatinWord(text) {
  if (!text) return false;

  const masked = text
    .replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, ' ')
    .replace(/\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?\b/g, ' ');

  const words = masked.match(/[A-Za-z]{3,}/g) || [];

  return words.some((word) => {
    const isAllCaps = word === word.toUpperCase();
    const isTitleCase = /^[A-Z][a-z]+$/.test(word);
    return !isAllCaps && !isTitleCase;
  });
}

/**
 * Detect likely language contamination in a translation result.
 * Returns true if the output contains a significant number of characters
 * from a script that does not belong to the target language.
 *
 * Only checks language pairs where the target script is well-defined
 * (e.g. RTL scripts like Arabic/Persian/Hebrew, CJK, Cyrillic).
 * Latin-target languages are not checked -- false positives too high
 * (proper nouns, loanwords, code snippets all use Latin).
 *
 * @param {string} text - Translated text to check
 * @param {string} targetLanguage - ISO 639-1 target language code
 * @returns {boolean} true if contamination detected
 */
function hasScriptContamination(text, targetLanguage) {
  if (!text || !targetLanguage) return false;

  const len = text.length;
  if (len < 10) return false;

  const RATIO_THRESHOLD = 0.03;

  const arabicScriptTargets = new Set(['ar', 'fa', 'ur']);
  const cyrillicTargets = new Set(['ru', 'uk', 'bg', 'sr', 'mk']);
  const cjkTargets = new Set(['zh', 'ja', 'ko']);
  const nonLatinTargets = new Set([
    ...arabicScriptTargets, 'he', ...cyrillicTargets, ...cjkTargets
  ]);

  if (nonLatinTargets.has(targetLanguage) && hasSuspiciousLowercaseLatinWord(text)) {
    return true;
  }

  // Arabic-script targets (Arabic, Persian/Farsi, Urdu)
  if (arabicScriptTargets.has(targetLanguage)) {
    // Any CJK character is unambiguous contamination
    const cjkCount = (text.match(/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length;
    if (cjkCount > 0) return true;
    // Even a single accented Latin character (é, ú, í, khó etc.) signals drift --
    // Arabic-script output never legitimately contains accented Latin
    const accentedLatinCount = (text.match(/[À-ÖØ-öø-ÿ]/g) || []).length;
    if (accentedLatinCount > 0) return true;
    return false;
  }

  // Hebrew target
  if (targetLanguage === 'he') {
    const cjkCount = (text.match(/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length;
    if (cjkCount > 0) return true;
    const accentedLatinCount = (text.match(/[À-ÖØ-öø-ÿ]/g) || []).length;
    if (accentedLatinCount > 0) return true;
    return false;
  }

  // Cyrillic targets (Russian, Ukrainian, Bulgarian, etc.)
  if (cyrillicTargets.has(targetLanguage)) {
    const cjkCount = (text.match(/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length;
    if (cjkCount / len > RATIO_THRESHOLD) return true;
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabicCount / len > RATIO_THRESHOLD) return true;
    return false;
  }

  // CJK targets
  if (cjkTargets.has(targetLanguage)) {
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabicCount / len > RATIO_THRESHOLD) return true;
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
    if (cyrillicCount / len > RATIO_THRESHOLD) return true;
    return false;
  }

  return false;
}

/**
 * Sanitize the raw translation string returned by Alto Cloud / Alto Free.
 * Strips common LLM output artifacts without altering the translated text:
 *   - leading/trailing whitespace and blank lines
 *   - a single pair of wrapping quotes ("...", '...', "...", '...', «...»)
 *   - markdown code fences (```[lang]\n...\n```)
 * Iterates so a response wrapped in both a fence and quotes is fully unwrapped.
 * @param {string} text - Raw model output
 * @returns {string} Cleaned translation text
 */
function sanitizeAltoCloudTranslation(text) {
  if (text == null) return '';
  let out = String(text);

  let changed = true;
  while (changed) {
    changed = false;

    const trimmed = out.trim();
    if (trimmed !== out) {
      out = trimmed;
      changed = true;
    }

    // Strip markdown code fences: ```[lang]\n ... \n```
    const fence = out.match(/^```[^\n`]*\n?([\s\S]*?)\n?```$/);
    if (fence) {
      out = fence[1];
      changed = true;
      continue;
    }

    // Strip one matching pair of wrapping quotes
    if (out.length >= 2) {
      const open = out[0];
      const close = out[out.length - 1];
      const closers = {
        '"': '"',
        '\u201C': '\u201D',
        '\'': '\'',
        '\u2018': '\u2019',
        '«': '»'
      };
      if (closers[open] !== undefined && closers[open] === close) {
        out = out.slice(1, -1);
        changed = true;
        continue;
      }
    }
  }

  return out.trim();
}

/**
 * Split text into paragraph-aware chunks, each roughly under maxChunkChars,
 * capped at maxChunks total. Returns [{ text, joinAfter }] where joinAfter is
 * the separator to insert after this chunk when reassembling translated output
 * ('' for the last chunk).
 */
function chunkText(text, { maxChunkChars = ALTO_CHUNK_MAX_CHARS, maxChunks = ALTO_CHUNK_MAX_COUNT } = {}) {
  const trimmed = (text || '').trim();
  if (trimmed.length <= maxChunkChars) {
    return [{ text: trimmed, joinAfter: '' }];
  }

  const paragraphs = trimmed.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const rawChunks = []; // { text, isParagraphEnd }

  paragraphs.forEach((para) => {
    if (para.length <= maxChunkChars) {
      rawChunks.push({ text: para, isParagraphEnd: true });
      return;
    }

    // Simple sentence split -- good enough, doesn't need to be perfect NLP
    const sentences = para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [para];

    let current = '';
    sentences.forEach((sentence) => {
      const trimmedSentence = sentence.trim();
      const candidate = current ? `${current} ${trimmedSentence}` : trimmedSentence;
      if (candidate.length > maxChunkChars && current) {
        rawChunks.push({ text: current, isParagraphEnd: false });
        current = trimmedSentence;
      } else {
        current = candidate;
      }
    });
    if (current) rawChunks.push({ text: current, isParagraphEnd: true });
  });

  // Hard cap: merge smallest adjacent pair until under the limit
  while (rawChunks.length > maxChunks) {
    let smallestIdx = 0;
    let smallestCombinedLen = Infinity;
    for (let i = 0; i < rawChunks.length - 1; i++) {
      const combinedLen = rawChunks[i].text.length + rawChunks[i + 1].text.length;
      if (combinedLen < smallestCombinedLen) {
        smallestCombinedLen = combinedLen;
        smallestIdx = i;
      }
    }
    const a = rawChunks[smallestIdx];
    const b = rawChunks[smallestIdx + 1];
    const joiner = a.isParagraphEnd ? '\n\n' : ' ';
    rawChunks.splice(smallestIdx, 2, {
      text: `${a.text}${joiner}${b.text}`,
      isParagraphEnd: b.isParagraphEnd
    });
  }

  return rawChunks.map((chunk, idx) => ({
    text: chunk.text,
    joinAfter: idx === rawChunks.length - 1 ? '' : (chunk.isParagraphEnd ? '\n\n' : ' ')
  }));
}

/**
 * Low-level single-request helper. Both the free and cloud paths, and the chunk
 * retry logic, funnel through this. Handles fetch, 429 handling, sanitization,
 * and status-code error mapping via a caller-supplied errorMessages object.
 */
async function performAltoTranslationRequest({ endpoint, authHeader, text, targetLanguage, sourceLanguage, model = 'auto', errorMessages }) {
  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = (sourceLanguage && sourceLanguage !== 'auto')
    ? getLanguageName(sourceLanguage)
    : null;
  const systemPrompt = buildAltoCloudSystemPrompt(targetLangName, sourceLangName);

  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });

    if (response.status === 429) {
      let rateLimitMessage = "You've reached the free daily limit. Upgrade to Alto Cloud for unlimited translations.";
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) rateLimitMessage = errorData.error.message;
      } catch (_) { /* ignore parse errors */ }
      return { success: false, error: rateLimitMessage, rateLimited: true };
    }

    if (!response.ok) {
      const msg = errorMessages?.[response.status] ?? (errorMessages?.default?.(response.status) ?? `Alto error (HTTP ${response.status}).`);
      return { success: false, error: msg };
    }

    const data = await response.json();
    const translatedText = data?.choices?.[0]?.message?.content;
    if (!translatedText) {
      return { success: false, error: 'Empty response from Alto' };
    }

    return { success: true, translatedText: sanitizeAltoCloudTranslation(translatedText) };
  } catch (error) {
    return { success: false, error: error?.message || 'Network error reaching Alto' };
  }
}

/**
 * Wrap a single chunk translation with up to 3 attempts (auto + 2 forced-Gemini
 * retries) on contamination. Never surfaces contamination as an error -- if all
 * attempts are still flagged, returns the last result as best effort.
 */
async function translateChunkWithRetry({ endpoint, authHeader, text, targetLanguage, sourceLanguage, errorMessages }) {
  const MAX_ATTEMPTS = 3; // original 'auto' attempt + up to 2 forced-Gemini retries
  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = attempt === 1 ? 'auto' : ALTO_RETRY_MODEL;

    const result = await performAltoTranslationRequest({
      endpoint, authHeader, text, targetLanguage, sourceLanguage, model, errorMessages
    });

    // Real errors (rate limit, auth, network) propagate immediately -- never retry these
    if (!result.success) return result;

    lastResult = result;

    const contaminated = hasScriptContamination(result.translatedText, targetLanguage);
    console.log(`[Alto] contamination check — attempt: ${attempt}/${MAX_ATTEMPTS}, target: ${targetLanguage}, flagged: ${contaminated}`);

    if (!contaminated) return result; // clean -- done, no further attempts needed

    if (attempt < MAX_ATTEMPTS) {
      console.log(`[Alto] Contamination on attempt ${attempt}, retrying with forced Gemini (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
    }
  }

  // All attempts exhausted -- return the last result as best effort, even if still flagged.
  // This should be extremely rare given how unlikely repeated contamination is across
  // independent generations against the same reliable model.
  console.log('[Alto] Contamination persisted after all retry attempts — returning best-effort result');
  return lastResult;
}

/**
 * Orchestrate chunking + parallel per-chunk translation + reassembly. This is
 * what translateWithAltoCloud and translateWithAltoFree call. Short inputs
 * (<= ALTO_CHUNK_MAX_CHARS) take the fast path: a single request, no chunking
 * overhead and no behavior change vs. pre-refactor.
 */
async function translateLongText({ endpoint, authHeader, text, targetLanguage, sourceLanguage, apiLabel, errorMessages }) {
  const chunks = chunkText(text);

  if (chunks.length === 1) {
    const result = await translateChunkWithRetry({
      endpoint, authHeader, text: chunks[0].text, targetLanguage, sourceLanguage, errorMessages
    });
    if (!result.success) return { ...result, api: apiLabel };
    return {
      success: true,
      translatedText: result.translatedText,
      sourceLanguage,
      targetLanguage,
      api: apiLabel
    };
  }

  const results = await Promise.all(
    chunks.map((c) => translateChunkWithRetry({
      endpoint, authHeader, text: c.text, targetLanguage, sourceLanguage, errorMessages
    }))
  );

  const firstFailure = results.find((r) => !r.success);
  if (firstFailure) return { ...firstFailure, api: apiLabel };

  const translatedText = results
    .map((r, idx) => r.translatedText + (chunks[idx].joinAfter || ''))
    .join('');

  return { success: true, translatedText, sourceLanguage, targetLanguage, api: apiLabel };
}

/**
 * Translate text using the Alto free tier (no API key required).
 * Hits /v1/free/chat/completions on the VPS -- rate-limited to 100 req/day per IP.
 * Returns { success, translatedText, sourceLanguage, targetLanguage, api }
 * On rate limit: returns { success: false, error, rateLimited: true }
 * @param {string} text
 * @param {string} targetLanguage
 * @param {string} sourceLanguage
 * @returns {Promise<Object>}
 */
async function translateWithAltoFree(text, targetLanguage, sourceLanguage = 'auto') {
  const FREE_ENDPOINT = 'https://api.altotranslate.xyz/v1/free/chat/completions';

  const errorMessages = {
    default: (status) => `Alto translation failed (${status})`
  };

  // upgradeUrl is attached by background.js on rate-limited responses -- do not
  // add it here, the contract is preserved via the rateLimited flag passthrough.
  return translateLongText({
    endpoint: FREE_ENDPOINT,
    authHeader: null,
    text,
    targetLanguage,
    sourceLanguage,
    apiLabel: 'alto-free',
    errorMessages
  });
}

async function translateWithAltoCloud(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  const errorMessages = {
    401: 'Invalid or expired Alto Cloud key. Visit altotranslate.xyz/dashboard to check your subscription.',
    403: 'Access denied. Visit altotranslate.xyz/dashboard to check your subscription.',
    default: (status) => `Alto Cloud error (HTTP ${status}).`
  };

  try {
    return await translateLongText({
      endpoint: ALTO_CLOUD_API_BASE,
      authHeader: `Bearer ${apiKey}`,
      text,
      targetLanguage,
      sourceLanguage,
      apiLabel: 'alto-cloud',
      errorMessages
    });
  } catch (error) {
    console.error('Alto Cloud API failed:', error);
    return { success: false, error: 'Network error. Check your connection.', api: 'alto-cloud' };
  }
}

async function validateAltoCloudKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: 'No API key provided' };
  }

  try {
    const response = await fetch(ALTO_CLOUD_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'system', content: buildAltoCloudSystemPrompt('Spanish', 'English') },
          { role: 'user', content: 'hi' }
        ]
      })
    });

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 401) {
      return { ok: false, error: 'Invalid or expired key.' };
    }

    if (response.status === 403) {
      return { ok: false, error: 'Access denied — check your subscription.' };
    }

    return { ok: false, error: `Could not validate (HTTP ${response.status}).` };
  } catch (error) {
    return { ok: false, error: `Alto Cloud validation failed: ${error?.message ?? 'Network error'}` };
  }
}
