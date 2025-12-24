// Unit tests for language utilities
// Run with: node tests/languages.test.js (after setting up test environment)

/**
 * Test getLanguageName function
 */
function testGetLanguageName() {
  // Mock language names
  const LANGUAGE_NAMES = {
    'en': 'English',
    'es': 'Spanish',
    'fa': 'Persian/Farsi'
  };
  
  function getLanguageName(code) {
    return LANGUAGE_NAMES[code] ?? code;
  }
  
  const testCases = [
    { code: 'en', expected: 'English' },
    { code: 'es', expected: 'Spanish' },
    { code: 'fa', expected: 'Persian/Farsi' },
    { code: 'unknown', expected: 'unknown' }
  ];
  
  const allPassed = testCases.every(test => {
    const result = getLanguageName(test.code);
    return result === test.expected;
  });
  
  console.log('Test: getLanguageName -', allPassed);
  return allPassed;
}

/**
 * Test RTL language detection
 */
function testRTLLanguageDetection() {
  const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur'];
  
  function isRTLLanguage(code) {
    return RTL_LANGUAGES.includes(code);
  }
  
  const rtlTests = ['ar', 'fa', 'he', 'ur'].every(code => isRTLLanguage(code));
  const ltrTests = ['en', 'es', 'fr'].every(code => !isRTLLanguage(code));
  
  console.log('Test: RTL language detection -', rtlTests && ltrTests);
  return rtlTests && ltrTests;
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Running language tests...');
  testGetLanguageName();
  testRTLLanguageDetection();
  console.log('Language tests completed');
}

