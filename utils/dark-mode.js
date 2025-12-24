// Dark Mode Detection and Application
// This script handles automatic dark mode detection based on system preferences

/**
 * Check for dark mode preference and apply it to the document
 * Detects system color scheme preference and adds/removes 'dark' class accordingly
 */
function applyDarkMode() {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Toggle dark mode manually
 * Switches between light and dark mode by toggling the 'dark' class
 */
function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
}

// Apply dark mode on page load
document.addEventListener('DOMContentLoaded', function() {
  applyDarkMode();
  
  // Add manual toggle button functionality
  const toggleBtn = document.getElementById('toggleDarkMode');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleDarkMode);
  }
});

// Also apply immediately in case DOMContentLoaded already fired
applyDarkMode();

// Listen for changes in color scheme preference
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDarkMode);
}

