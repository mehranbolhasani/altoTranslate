// Run: node tests/selection_context.test.js

const {
  buildTranslationContextSnippet,
  clampContextSnippetForApi,
  findSnippetExpandedStart,
  DEFAULT_SELECTION_CONTEXT_CHARS
} = require('../utils/selection_context.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(v, label) {
  if (!v) throw new Error(`${label}: expected truthy`);
}

function assertNull(v, label) {
  if (v !== null) throw new Error(`${label}: expected null`);
}

function run() {
  assertEqual(
    findSnippetExpandedStart('First sentence. Second word.', 26),
    16,
    'sentence start after prior period'
  );

  assertTruthy(buildTranslationContextSnippet('Before. ', 'it', ' was here.'), 'has context snippet');
  const s = buildTranslationContextSnippet('Before. ', 'it', ' was here.');
  if (!s.includes('it') || !s.includes('Before')) {
    throw new Error('snippet should contain selection and before text');
  }

  assertTruthy(
    buildTranslationContextSnippet('x'.repeat(50) + '. ', 'ab', ' ' + 'y'.repeat(80)),
    'minAround expands short sentence span'
  );

  assertNull(buildTranslationContextSnippet('', 'hello', ''), 'no neighbours');
  assertNull(buildTranslationContextSnippet(' ', 'x', ' '), 'selection single char after trim');

  const capped = clampContextSnippetForApi('a'.repeat(DEFAULT_SELECTION_CONTEXT_CHARS + 40));
  assertEqual(capped.length, DEFAULT_SELECTION_CONTEXT_CHARS + 1, 'ellipsis appended'); // unicode ellipsis

  console.log('selection_context tests: all passed');
}

try {
  run();
} catch (e) {
  console.error('selection_context tests FAILED:', e.message);
  process.exit(1);
}
