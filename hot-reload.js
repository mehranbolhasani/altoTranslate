// Hot reload script for development
// Add this to your background.js for development only

if (process?.env?.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
  // Watch for file changes and reload extension
  chrome.runtime.onInstalled.addListener(() => {
  });

  // Listen for messages from content scripts to reload
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reload') {
      chrome.runtime.reload();
    }
  });
}
