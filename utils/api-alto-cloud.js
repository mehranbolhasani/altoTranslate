// Alto Cloud API integration
// Chrome Extension compatible - no CommonJS exports

const ALTO_CLOUD_API_BASE = 'https://api.altotranslate.xyz/v1/chat/completions';

async function translateWithAltoCloud(text, targetLanguage, apiKey, sourceLanguage = 'auto') {
  try {
    const targetLangName = getLanguageName(targetLanguage);
    const systemPrompt = `Translate the following text to ${targetLangName}. Return only the translated text, no explanations.`;

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
        return {
          success: true,
          translatedText: translatedText.trim(),
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
          { role: 'system', content: 'Translate the following text to Spanish. Return only the translated text, no explanations.' },
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
