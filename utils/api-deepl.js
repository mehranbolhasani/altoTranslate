// DeepL API integration for translation
// Chrome Extension compatible - no CommonJS exports

// DEEPL_API_BASE is defined in utils/constants.js (loaded first via importScripts)

const DEEPL_SUPPORTED_LANGUAGES = new Set([
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr',
  'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl',
  'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'zh'
]);

const DEEPL_COUNTRY_VARIANTS = {
  'en-gb': 'EN-GB',
  'en-us': 'EN-US',
  'pt-br': 'PT-BR',
  'pt-pt': 'PT-PT'
};

function normalizeDeeplLanguageCode(code) {
  if (!code || typeof code !== 'string') return '';
  const lower = code.trim().toLowerCase();
  if (!lower) return '';
  const matched = Object.keys(DEEPL_COUNTRY_VARIANTS).find(k => k === lower);
  if (matched) return DEEPL_COUNTRY_VARIANTS[matched];
  const base = lower.split(/[-_]/)[0];
  if (DEEPL_SUPPORTED_LANGUAGES.has(base)) return base.toUpperCase();
  return '';
}

function deeplLanguageIsSupported(code) {
  return !!normalizeDeeplLanguageCode(code);
}

async function translateWithDeepL(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  const targetLang = normalizeDeeplLanguageCode(targetLanguage);
  if (!targetLang) {
    return {
      success: false,
      error: `Target language '${targetLanguage}' is not supported by DeepL`,
      api: 'deepl'
    };
  }

  const body = { text: [text], target_lang: targetLang };
  if (sourceLanguage && sourceLanguage !== 'auto') {
    const srcLang = normalizeDeeplLanguageCode(sourceLanguage);
    if (srcLang) body.source_lang = srcLang;
  }

  try {
    const response = await fetch(DEEPL_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const statusMessages = {
        403: 'Invalid API key.',
        456: 'Character quota exceeded.'
      };
      let errorMsg = statusMessages[response.status];
      if (!errorMsg) {
        let bodyText = '';
        try { bodyText = await response.text(); } catch {}
        errorMsg = `DeepL API error: HTTP ${response.status}${bodyText ? ' — ' + bodyText.slice(0, 200) : ''}`;
      }
      return { success: false, error: errorMsg, api: 'deepl' };
    }

    const data = await response.json();
    const translatedText = data?.translations?.[0]?.text;

    if (!translatedText) {
      return {
        success: false,
        error: 'Invalid response format from DeepL API',
        api: 'deepl'
      };
    }

    return {
      success: true,
      translatedText,
      sourceLanguage,
      targetLanguage,
      api: 'deepl'
    };
  } catch (error) {
    console.error('DeepL API failed:', error);
    return {
      success: false,
      error: error?.message ?? 'DeepL API is currently unavailable',
      api: 'deepl'
    };
  }
}

async function validateDeepLApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: 'No API key provided' };
  }

  try {
    const response = await fetch(DEEPL_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${apiKey.trim()}`
      },
      body: JSON.stringify({ text: ['hello'], target_lang: 'DE' })
    });

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 403) {
      return { ok: false, error: 'Invalid API key.' };
    }

    if (response.status === 456) {
      return { ok: false, error: 'Character quota exceeded.' };
    }

    let bodyText = '';
    try { bodyText = await response.text(); } catch {}
    return { ok: false, error: `DeepL API error: HTTP ${response.status}${bodyText ? ' — ' + bodyText.slice(0, 200) : ''}` };
  } catch (error) {
    return { ok: false, error: `DeepL validation failed: ${error?.message ?? 'Network error'}` };
  }
}
