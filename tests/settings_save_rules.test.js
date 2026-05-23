// Mirrors options save validation: MyMemory always on — no "at least one API" gate.
// Run: node tests/settings_save_rules.test.js

/**
 * Same rules as OptionsManager.validateSettings (api-specific keys only).
 * @param {object} settings
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateSaveSettings(settings) {
  if (settings.apiPreference === 'gemini' && !String(settings.geminiApiKey || '').trim()) {
    return { ok: false, reason: 'gemini_key' };
  }
  if (settings.apiPreference === 'deepl' && !String(settings.deeplApiKey || '').trim()) {
    return { ok: false, reason: 'deepl_key' };
  }
  if (settings.apiPreference === 'azure' && !String(settings.azureApiKey || '').trim()) {
    return { ok: false, reason: 'azure_key' };
  }
  return { ok: true };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(
    validateSaveSettings({
      apiPreference: 'libretranslate',
      geminiApiKey: '',
      deeplApiKey: '',
      azureApiKey: ''
    }).ok,
    'MyMemory-only save should pass without keys'
  );

  assert(
    !validateSaveSettings({
      apiPreference: 'gemini',
      geminiApiKey: '',
      deeplApiKey: '',
      azureApiKey: ''
    }).ok,
    'Gemini preference requires key'
  );

  assert(
    !validateSaveSettings({
      apiPreference: 'deepl',
      geminiApiKey: '',
      deeplApiKey: '',
      azureApiKey: ''
    }).ok,
    'DeepL preference requires key'
  );

  assert(
    !validateSaveSettings({
      apiPreference: 'azure',
      geminiApiKey: '',
      deeplApiKey: '',
      azureApiKey: ''
    }).ok,
    'Azure preference requires key'
  );

  assert(
    validateSaveSettings({
      apiPreference: 'both',
      geminiApiKey: 'x',
      deeplApiKey: '',
      azureApiKey: ''
    }).ok,
    'Both with at least one key passes'
  );

  assert(
    validateSaveSettings({
      apiPreference: 'both',
      geminiApiKey: '',
      deeplApiKey: 'x',
      azureApiKey: ''
    }).ok,
    'Both with DeepL key passes'
  );

  assert(
    validateSaveSettings({
      apiPreference: 'both',
      geminiApiKey: '',
      deeplApiKey: '',
      azureApiKey: 'x'
    }).ok,
    'Both with Azure key passes'
  );

  console.log('settings_save_rules tests: all passed');
}

try {
  run();
} catch (e) {
  console.error('settings_save_rules tests FAILED:', e.message);
  process.exit(1);
}
