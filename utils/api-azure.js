// Microsoft Azure Translator API integration for translation
// Chrome Extension compatible - no CommonJS exports

// AZURE_API_BASE is defined in utils/constants.js (loaded first via importScripts)

const AZURE_SUPPORTED_LANGUAGES = new Set([
  'af', 'ar', 'am', 'az', 'bg', 'bn', 'bs', 'ca', 'cs', 'cy',
  'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fil', 'fj',
  'fr', 'fr-ca', 'ga', 'gu', 'he', 'hi', 'hr', 'ht', 'hu', 'hy',
  'id', 'is', 'it', 'iu', 'ja', 'ka', 'kk', 'km', 'kn', 'ko',
  'ku', 'ky', 'la', 'lb', 'lo', 'lt', 'lv', 'mg', 'mi', 'ml',
  'mr', 'ms', 'mt', 'my', 'nb', 'ne', 'nl', 'or', 'pa', 'pl',
  'ps', 'pt', 'pt-pt', 'ro', 'ru', 'si', 'sk', 'sl', 'sm', 'so',
  'sq', 'sr', 'sr-latn', 'sv', 'sw', 'ta', 'te', 'th', 'tl', 'to',
  'tr', 'ty', 'uk', 'ur', 'vi', 'yue', 'zh', 'zh-Hans', 'zh-Hant'
]);

function normalizeAzureLanguageCode(code) {
  if (!code || typeof code !== 'string') return '';
  const lower = code.trim().toLowerCase();
  if (!lower) return '';
  if (AZURE_SUPPORTED_LANGUAGES.has(lower)) return lower;
  const base = lower.split(/[-_]/)[0];
  if (AZURE_SUPPORTED_LANGUAGES.has(base)) return base;
  return '';
}

function azureLanguageIsSupported(code) {
  return !!normalizeAzureLanguageCode(code);
}

async function translateWithAzure(text, targetLanguage, apiKey, apiRegion, sourceLanguage = 'auto') {
  const targetLang = normalizeAzureLanguageCode(targetLanguage);
  if (!targetLang) {
    return {
      success: false,
      error: `Target language '${targetLanguage}' is not supported by Microsoft Translator`,
      api: 'azure'
    };
  }

  const params = new URLSearchParams({ 'api-version': '3.0', to: targetLang });
  if (sourceLanguage && sourceLanguage !== 'auto') {
    const srcLang = normalizeAzureLanguageCode(sourceLanguage);
    if (srcLang) params.set('from', srcLang);
  }

  const url = `${AZURE_API_BASE}&${params.toString()}`;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey
    };
    if (apiRegion && typeof apiRegion === 'string' && apiRegion.trim()) {
      headers['Ocp-Apim-Subscription-Region'] = apiRegion.trim();
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ Text: text }])
    });

    if (!response.ok) {
      const statusMessages = {
        401: 'Invalid key. Please check your Azure API key.',
        403: 'Key valid but region may be wrong — check your Azure resource region.',
        429: 'Rate limit exceeded. Please wait and try again.'
      };
      let errorMsg = statusMessages[response.status];
      if (!errorMsg) {
        let bodyText = '';
        try { bodyText = await response.text(); } catch {}
        errorMsg = `Microsoft Translator API error: HTTP ${response.status}${bodyText ? ' — ' + bodyText.slice(0, 200) : ''}`;
      }
      return { success: false, error: errorMsg, api: 'azure' };
    }

    const data = await response.json();
    const translatedText = data?.[0]?.translations?.[0]?.text;

    if (!translatedText) {
      return {
        success: false,
        error: 'Invalid response format from Microsoft Translator API',
        api: 'azure'
      };
    }

    return {
      success: true,
      translatedText,
      sourceLanguage,
      targetLanguage,
      api: 'azure'
    };
  } catch (error) {
    console.error('Azure Translator API failed:', error);
    return {
      success: false,
      error: error?.message ?? 'Microsoft Translator API is currently unavailable',
      api: 'azure'
    };
  }
}

async function validateAzureApiKey(apiKey, apiRegion) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: 'No API key provided' };
  }

  try {
    const url = `${AZURE_API_BASE}&to=de`;
    const headers = {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey.trim()
    };
    if (apiRegion && typeof apiRegion === 'string' && apiRegion.trim()) {
      headers['Ocp-Apim-Subscription-Region'] = apiRegion.trim();
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ Text: 'hello' }])
    });

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 401) {
      return { ok: false, error: 'Invalid key. Please check your Azure API key.' };
    }

    if (response.status === 403) {
      return { ok: false, error: 'Key valid but region may be wrong — check your Azure resource region.' };
    }

    let bodyText = '';
    try { bodyText = await response.text(); } catch {}
    return { ok: false, error: `Microsoft Translator API error: HTTP ${response.status}${bodyText ? ' — ' + bodyText.slice(0, 200) : ''}` };
  } catch (error) {
    return { ok: false, error: `Azure validation failed: ${error?.message ?? 'Network error'}` };
  }
}
