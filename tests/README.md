# Test Suite for Alto Translate

This directory contains unit tests for the extension.

## Test Files

- `cache.test.js` - Tests for cache functions
- `validation.test.js` - Tests for input validation
- `languages.test.js` - Tests for language utilities
- `mymemory_infer_source.test.js` - MyMemory source inference heuristics
- `settings_save_rules.test.js` - Options save validation rules (MyMemory always on)
- `api.test.js` - Tests for API integrations (mocks)

## Running Tests

Currently, tests are basic JavaScript files that can be run with Node.js after setting up a test environment.

### Future Setup

To set up a proper testing framework:

1. Install a testing framework (Jest, Vitest, or Mocha):
   ```bash
   npm install --save-dev jest
   ```

2. Update `package.json`:
   ```json
   {
     "scripts": {
       "test": "jest"
     }
   }
   ```

3. Run tests:
   ```bash
   npm test
   ```

## Test Coverage Goals

- Cache functions: Key generation, size calculation, expiration
- Input validation: Text length, empty text, language codes
- Language utilities: Name mapping, RTL detection
- API integrations: Mock API responses, error handling

## Note

These are basic test structures. A full testing setup would require:
- Test framework configuration
- Mock Chrome extension APIs
- Test runner setup
- CI/CD integration

