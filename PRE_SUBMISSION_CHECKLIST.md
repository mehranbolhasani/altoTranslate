# Chrome Web Store Submission Checklist

## ✅ Completed Pre-Submission Tasks

### Code Cleanup
- [x] Removed all `console.log` statements from production code
- [x] Kept `console.error` statements for error handling (acceptable for production)
- [x] Removed development keyboard shortcut (reload-extension)
- [x] Removed development hot reload command handler
- [x] Removed debug logging statements

### Manifest.json
- [x] Verified manifest version (v3)
- [x] Verified all required permissions are minimal and justified
- [x] Verified host_permissions are correct
- [x] Verified CSP is properly configured
- [x] Verified all icon sizes are present (16, 48, 128)
- [x] Removed development commands

### Documentation
- [x] Updated CHANGELOG.md with latest changes
- [x] README.md is up to date
- [x] LICENSE file exists

### Security
- [x] No hardcoded API keys
- [x] API keys stored securely in Chrome storage
- [x] Input validation and sanitization in place
- [x] XSS protection implemented
- [x] CSP compliant

### Files to Review
- [ ] Verify icons are updated (user mentioned updating logo/icons)
- [ ] Verify hot-reload.js is not referenced (safe to leave, not loaded)
- [ ] Verify .gitignore excludes build artifacts

## 📦 Files Ready for Submission

### Required Files
- ✅ manifest.json
- ✅ background/background.js
- ✅ content/content.js
- ✅ content/content.css
- ✅ popup/popup.html
- ✅ popup/popup.js
- ✅ popup/popup.css
- ✅ options/options.html
- ✅ options/options.js
- ✅ options/options.css
- ✅ utils/*.js (all utility files)
- ✅ icons/icon16.png
- ✅ icons/icon48.png
- ✅ icons/icon128.png

### Optional Files (not included in submission)
- hot-reload.js (development only, not loaded)
- tests/ (test files, not needed for submission)
- *.code-workspace (IDE file)
- .gitignore (not needed for submission)

## 🚀 Submission Steps

1. **Create ZIP file**:
   ```bash
   # Exclude development files
   zip -r alto-translate-v1.1.0.zip . \
     -x "*.git*" \
     -x "*.code-workspace" \
     -x "hot-reload.js" \
     -x "tests/*" \
     -x "*.zip" \
     -x ".DS_Store" \
     -x "*.log"
   ```

2. **Verify ZIP contents**:
   - Check that all required files are included
   - Verify no development files are included
   - Check file sizes are reasonable

3. **Chrome Web Store Dashboard**:
   - Go to https://chrome.google.com/webstore/devconsole
   - Create new item or update existing
   - Upload ZIP file
   - Fill in store listing details:
     - Name: Alto Translate
     - Summary: A minimal Chrome extension for translating selected text
     - Description: Use README.md content
     - Category: Productivity or Utilities
     - Language: English
     - Screenshots: Prepare 1-5 screenshots (1280x800 or 640x400)
     - Promotional images: Optional
     - Privacy policy: Required (can use GitHub pages or similar)

4. **Store Listing Requirements**:
   - [ ] Extension name
   - [ ] Detailed description
   - [ ] At least one screenshot
   - [ ] Small promotional tile (440x280)
   - [ ] Privacy policy URL (required for extensions that handle user data)
   - [ ] Category selection
   - [ ] Language selection

## 📝 Privacy Policy Notes

Since the extension:
- Stores API keys (user-provided)
- Sends translation requests to external APIs
- Uses Chrome storage API

You'll need a privacy policy that states:
- API keys are stored locally in Chrome's encrypted storage
- Translation requests are sent directly to user-selected API services
- No data is collected or tracked
- No analytics or tracking code
- User data is not shared with third parties except the selected translation API

## ⚠️ Important Notes

1. **Version Number**: Current version is 1.1.0 - update if needed
2. **Icons**: User mentioned updating icons - verify they're included
3. **Testing**: Test the extension thoroughly before submission
4. **Review Time**: Chrome Web Store review typically takes 1-3 business days
5. **Updates**: After approval, updates go through same review process

## 🔍 Final Verification

Before submitting, verify:
- [ ] Extension loads without errors
- [ ] All features work correctly
- [ ] No console errors in production mode
- [ ] Settings page works correctly
- [ ] Translation works with all API options
- [ ] Icons display correctly
- [ ] No broken links or missing files
- [ ] ZIP file size is reasonable (< 10MB recommended)

