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
  if (settings.apiPreference === 'openrouter' && !String(settings.openrouterApiKey || '').trim()) {
    return { ok: false, reason: 'openrouter_key' };
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
      openrouterApiKey: ''
    }).ok,
    'MyMemory-only save should pass without keys'
  );

  assert(
    !validateSaveSettings({
      apiPreference: 'gemini',
      geminiApiKey: '',
      openrouterApiKey: ''
    }).ok,
    'Gemini preference requires key'
  );

  assert(
    validateSaveSettings({
      apiPreference: 'both',
      geminiApiKey: 'x',
      openrouterApiKey: ''
    }).ok,
    'Both with at least one key passes'
  );

  console.log('settings_save_rules tests: all passed');
}

try {
  run();
} catch (e) {
  console.error('settings_save_rules tests FAILED:', e.message);
  process.exit(1);
}
