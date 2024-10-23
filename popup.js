// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Error handling wrapper for async functions
async function safeAsyncFunction(asyncFunction) {
  try {
    return await asyncFunction();
  } catch (error) {
    console.error('An error occurred:', error);
    // You might want to show this error to the user in a more user-friendly way
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    manualExecuteButton: document.getElementById('manualExecute'),
    openOptionsButton: document.getElementById('openOptions'),
    extensionEnabledToggle: document.getElementById('extensionEnabled'),
    autoBookmarkToggle: document.getElementById('autoBookmark'),
    autoCloseTabToggle: document.getElementById('autoCloseTab'),
    backupButton: document.getElementById('backupButton'),
    restoreButton: document.getElementById('restoreButton')
  };

  // Load current settings
  safeAsyncFunction(loadSettings);

  // Handle toggle changes
  const handleToggleChange = (toggle, storageKey) => {
    toggle.addEventListener('change', debounce(() => {
      safeAsyncFunction(async () => {
        await chrome.storage.local.set({ [storageKey]: toggle.checked });
        // Notify options page about the change immediately
        chrome.runtime.sendMessage({ 
          action: "optionsChanged", 
          key: storageKey, 
          value: toggle.checked 
        });
      });
    }, 300)); // 300ms debounce
  };

  // Use Object.entries() to iterate over the toggle elements
  Object.entries({
    extensionEnabled: 'extensionEnabledToggle',
    autoBookmark: 'autoBookmarkToggle',
    autoCloseTab: 'autoCloseTabToggle'
  }).forEach(([key, elementKey]) => handleToggleChange(elements[elementKey], key));

  // Manual execute button
  elements.manualExecuteButton.addEventListener('click', () => {
    safeAsyncFunction(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.runtime.sendMessage({ action: "manualExecute", url: tab.url });
      console.log(response?.success ? "Rules applied successfully" : "No matching rules found or error occurred");
      window.close();
    });
  });

  // Open options button
  elements.openOptionsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Backup button
  elements.backupButton.addEventListener('click', () => {
    safeAsyncFunction(async () => {
      const data = await chrome.storage.local.get(null);
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smart-bookmark-saver-backup.json';
      a.click();
      URL.revokeObjectURL(url);
      console.log('Backup file downloaded successfully');
    });
  });

  // TODO: Implement restore functionality here
  // elements.restoreButton.addEventListener('click', () => {
  //   // Add restore functionality
  // });

  // Listen for changes from options page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "optionsChanged") {
      safeAsyncFunction(loadSettings);
    }
  });
});

async function loadSettings() {
  const result = await chrome.storage.local.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  const elements = {
    extensionEnabledToggle: document.getElementById('extensionEnabled'),
    autoBookmarkToggle: document.getElementById('autoBookmark'),
    autoCloseTabToggle: document.getElementById('autoCloseTab')
  };
  elements.extensionEnabledToggle.checked = result.extensionEnabled ?? true;
  elements.autoBookmarkToggle.checked = result.autoBookmark ?? true;
  elements.autoCloseTabToggle.checked = result.autoCloseTab ?? false;
}
