// Alto Cloud API integration
// Chrome Extension compatible - no CommonJS exports

const ALTO_CLOUD_API_BASE = 'https://api.altotranslate.xyz/v1/chat/completions';

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

  // Arabic-script targets (Arabic, Persian/Farsi, Urdu)
  const arabicScriptTargets = new Set(['ar', 'fa', 'ur']);
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
  const cyrillicTargets = new Set(['ru', 'uk', 'bg', 'sr', 'mk']);
  if (cyrillicTargets.has(targetLanguage)) {
    const cjkCount = (text.match(/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length;
    if (cjkCount / len > RATIO_THRESHOLD) return true;
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabicCount / len > RATIO_THRESHOLD) return true;
    return false;
  }

  // CJK targets
  const cjkTargets = new Set(['zh', 'ja', 'ko']);
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

  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = (sourceLanguage && sourceLanguage !== 'auto')
    ? getLanguageName(sourceLanguage)
    : null;
  const systemPrompt = buildAltoCloudSystemPrompt(targetLangName, sourceLangName);

  try {
    const response = await fetch(FREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });

    // Rate limit hit
    if (response.status === 429) {
      let rateLimitMessage = 'You\'ve reached the free daily limit. Upgrade to Alto Cloud for unlimited translations.';
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          rateLimitMessage = errorData.error.message;
        }
      } catch (_) { /* ignore parse errors */ }

      return {
        success: false,
        error: rateLimitMessage,
        rateLimited: true,
        api: 'alto-free'
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Alto translation failed (${response.status})`,
        api: 'alto-free'
      };
    }

    const data = await response.json();
    const translatedText = data?.choices?.[0]?.message?.content;

    if (translatedText) {
      const cleaned = sanitizeAltoCloudTranslation(translatedText);

      return {
        success: true,
        translatedText: cleaned,
        sourceLanguage,
        targetLanguage,
        api: 'alto-free'
      };
    }

    return {
      success: false,
      error: 'Empty response from Alto',
      api: 'alto-free'
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Network error reaching Alto',
      api: 'alto-free'
    };
  }
}

async function translateWithAltoCloud(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  try {
    const targetLangName = getLanguageName(targetLanguage);
    const sourceLangName = (sourceLanguage && sourceLanguage !== 'auto')
      ? getLanguageName(sourceLanguage)
      : null;
    const systemPrompt = buildAltoCloudSystemPrompt(targetLangName, sourceLangName);

    const body = {
      model: 'auto',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    };

    const response = await fetch(ALTO_CLOUD_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const data = await response.json();
      const translatedText = data?.choices?.[0]?.message?.content;

      if (translatedText) {
        const cleaned = translatedText.trim();

        return {
          success: true,
          translatedText: cleaned,
          sourceLanguage,
          targetLanguage,
          api: 'alto-cloud'
        };
      }

      return {
        success: false,
        error: 'Invalid response format from Alto Cloud API',
        api: 'alto-cloud'
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        error: 'Invalid or expired Alto Cloud key. Visit altotranslate.xyz/dashboard to check your subscription.',
        api: 'alto-cloud'
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        error: 'Access denied. Visit altotranslate.xyz/dashboard to check your subscription.',
        api: 'alto-cloud'
      };
    }

    return {
      success: false,
      error: `Alto Cloud error (HTTP ${response.status}).`,
      api: 'alto-cloud'
    };
  } catch (error) {
    console.error('Alto Cloud API failed:', error);
    return {
      success: false,
      error: 'Network error. Check your connection.',
      api: 'alto-cloud'
    };
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
