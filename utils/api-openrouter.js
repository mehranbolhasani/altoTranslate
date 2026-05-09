// OpenRouter API integration for translation
// Chrome Extension compatible - no CommonJS exports

// Import language utilities and constants (must be loaded before this script via importScripts)
// OPENROUTER_API_BASE, OPENROUTER_FREE_MODEL_CANDIDATES, TRANSLATION_MAX_OUTPUT_TOKENS from constants.js

/** Brief pause before trying the next free model after 429 (shared provider pools). */
const OPENROUTER_429_RETRY_DELAY_MS = 600;

function delayMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Whether to try another free-tier model instead of treating the error as final.
 * @param {number} status
 * @param {string} message
 */
function isOpenRouterTransientModelFailure(status, message) {
  const m = (message || '').toLowerCase();
  if (status === 404) return true;
  if (status === 400 && (m.includes('model') || m.includes('endpoint') || m.includes('not found'))) {
    return true;
  }
  return false;
}

/**
 * Lightweight key check — tries catalog free models until one succeeds.
 * @param {string} apiKey
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
async function validateOpenRouterApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { success: false, error: 'OpenRouter API key is empty' };
  }

  const candidates = OPENROUTER_FREE_MODEL_CANDIDATES || [];
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { success: false, error: 'No OpenRouter free models configured' };
  }

  let lastDetail = '';

  for (const model of candidates) {
    try {
      const testResponse = await fetch(OPENROUTER_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://alto-translate-extension.com',
          'X-Title': 'Alto Translate Extension'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
          temperature: 0
        })
      });

      if (testResponse.ok) {
        return {
          success: true,
          message: `OpenRouter API key is valid (reachable model: ${model})`
        };
      }

      const errorData = await testResponse.json().catch(() => ({}));
      const errMsg =
        errorData?.error?.message ??
        errorData?.message ??
        testResponse.statusText ??
        '';

      lastDetail = `${testResponse.status} - ${errMsg}`;

      if (testResponse.status === 401 || testResponse.status === 403) {
        let msg = `OpenRouter API key validation failed: ${lastDetail}`;
        if (testResponse.status === 401) {
          msg +=
            '\n\nPossible solutions:\n1. Check if your API key is correct\n2. Ensure your OpenRouter account is active\n3. Verify API key permissions';
        } else {
          msg +=
            '\n\nYour API key may not have permission to use OpenRouter. Please check account settings.';
        }
        return { success: false, error: msg };
      }

      if (testResponse.status === 429) {
        console.warn(`OpenRouter validate: 429 on ${model} — trying next candidate after ${OPENROUTER_429_RETRY_DELAY_MS}ms`);
        await delayMs(OPENROUTER_429_RETRY_DELAY_MS);
        continue;
      }

      if (isOpenRouterTransientModelFailure(testResponse.status, errMsg)) {
        continue;
      }

      continue;
    } catch (e) {
      lastDetail = e?.message || String(e);
    }
  }

  return {
    success: false,
    error:
      hint429Append(
        lastDetail,
        `OpenRouter API key could not reach any configured free models. Last error: ${lastDetail}\n\n` +
          'Check your internet connection and try again later, or reinstall after an Alto Translate update (model catalog refreshes periodically).'
      )
  };
}

function hint429Append(lastDetail, baseError) {
  const d = String(lastDetail || '');
  if (!/\b429\b/.test(d)) return baseError;
  return (
    baseError +
    '\n\nTip: openrouter.ai "unlimited" credits does not bypass limits on shared free `:free` models.' +
    ' HTTP 429 with "Provider returned error" usually means that model\'s host throttled you (busy pool), not a bad API key.' +
    ' Wait 60–120s and retry, pick another Alto API (Gemini/MyMemory), or use a paid OpenRouter route.'
  );
}

/**
 * OpenRouter user prompt (with optional page context for disambiguation).
 * @param {string|null|undefined} rawContext
 */
function buildOpenRouterTranslationPrompt(text, targetLanguage, sourceLanguage, rawContext) {
  const targetLangName = getLanguageName(targetLanguage);
  const sourceLangName = sourceLanguage === 'auto' ? 'auto-detect' : getLanguageName(sourceLanguage);

  const capped =
    rawContext && typeof rawContext === 'string' && typeof clampContextSnippetForApi === 'function'
      ? clampContextSnippetForApi(rawContext)
      : '';

  if (capped) {
    if (sourceLanguage === 'auto') {
      return (
        `Surrounding context (reference only; helps disambiguate — do not reply with a translation of the whole context):\n${capped}\n\n` +
        `Translate ONLY the following segment to ${targetLangName}. ` +
        `Output only the translated text of that segment with no quotes and no extra explanation:\n\n${text}`
      );
    }
    return (
      `Surrounding context (reference only; helps disambiguate — do not reply with a translation of the whole context):\n${capped}\n\n` +
      `Translate ONLY the following segment from ${sourceLangName} to ${targetLangName}. ` +
      `Output only the translated text of that segment with no quotes and no extra explanation:\n\n${text}`
    );
  }

  return sourceLanguage === 'auto'
    ? `Translate the following text to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`
    : `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, nothing else:\n\n${text}`;
}

/**
 * Translate text using OpenRouter API (tries free-tier catalog models in order).
 * @returns {Promise<Object>}
 */
async function translateWithOpenRouter(text, targetLanguage, apiKey, sourceLanguage = 'auto', contextSnippet = null) {
  const prompt = buildOpenRouterTranslationPrompt(text, targetLanguage, sourceLanguage, contextSnippet);
  const candidates = OPENROUTER_FREE_MODEL_CANDIDATES || [];

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      success: false,
      error: 'No OpenRouter free models configured',
      api: 'openrouter'
    };
  }

  let lastMessage = '';

  for (const model of candidates) {
    const requestBody = {
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: TRANSLATION_MAX_OUTPUT_TOKENS
    };

    try {
      const response = await fetch(OPENROUTER_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://alto-translate-extension.com',
          'X-Title': 'Alto Translate Extension'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message ?? errorData?.message ?? response.statusText ?? '';
        lastMessage = `OpenRouter API error: ${response.status} - ${msg}`;

        if (response.status === 401 || response.status === 403) {
          const statusMessages = {
            401: ' (Invalid API key)',
            403: ' (API key may be invalid or restricted)'
          };
          return {
            success: false,
            error: `${lastMessage}${statusMessages[response.status] ?? ''}`,
            api: 'openrouter'
          };
        }

        if (response.status === 429) {
          console.warn(
            `OpenRouter translate: 429 on ${model} — next candidate after ${OPENROUTER_429_RETRY_DELAY_MS}ms (free-tier provider throttle)`
          );
          lastMessage = `OpenRouter API error: ${response.status} - ${msg}`;
          await delayMs(OPENROUTER_429_RETRY_DELAY_MS);
          continue;
        }

        if (isOpenRouterTransientModelFailure(response.status, msg)) {
          console.warn(`OpenRouter: skipping model ${model} — ${response.status} ${msg}`);
          continue;
        }

        console.warn(`OpenRouter: model ${model} failed — ${lastMessage}`);
        continue;
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message;

      if (!message?.content) {
        lastMessage = 'Invalid response format from OpenRouter API (empty content)';
        continue;
      }

      const translatedText = message.content.trim();

      return {
        success: true,
        translatedText,
        sourceLanguage: sourceLanguage,
        targetLanguage,
        api: 'openrouter',
        usage: data.usage || null,
        openRouterModel: model
      };
    } catch (error) {
      console.error(`OpenRouter translation error (${model}):`, error);
      lastMessage = error?.message ?? 'OpenRouter translation failed';
      continue;
    }
  }

  const baseErr = lastMessage || 'All configured OpenRouter free models failed — try again later.';
  return {
    success: false,
    error: hint429Append(lastMessage, baseErr),
    api: 'openrouter'
  };
}
