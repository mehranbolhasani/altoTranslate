// Regression tests for MyMemory source inference (Node)
// Run: node tests/mymemory_infer_source.test.js

const { inferMyMemorySourceLanguage } = require('../utils/mymemory_infer_source.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function run() {
  assertEqual(inferMyMemorySourceLanguage('Hello world'), 'en', 'Latin default');
  assertEqual(inferMyMemorySourceLanguage('سلام'), 'ar', 'Arabic script');
  assertEqual(inferMyMemorySourceLanguage('سلام گل'), 'fa', 'Persian-specific letters');
  assertEqual(inferMyMemorySourceLanguage('Привет'), 'ru', 'Cyrillic');
  assertEqual(inferMyMemorySourceLanguage('你好'), 'zh', 'Chinese');
  assertEqual(inferMyMemorySourceLanguage('こんにちは'), 'ja', 'Japanese');
  assertEqual(inferMyMemorySourceLanguage('안녕'), 'ko', 'Korean');
  assertEqual(inferMyMemorySourceLanguage('שלום'), 'he', 'Hebrew');
  assertEqual(inferMyMemorySourceLanguage('สวัสดี'), 'th', 'Thai');
  console.log('mymemory_infer_source tests: all passed');
}

try {
  run();
} catch (e) {
  console.error('mymemory_infer_source tests FAILED:', e.message);
  process.exit(1);
}
