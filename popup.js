document.addEventListener('DOMContentLoaded', async function() {
  const manualExecuteButton = document.getElementById('manualExecute');
  const openOptionsButton = document.getElementById('openOptions');
  const extensionEnabledToggle = document.getElementById('extensionEnabled');
  const autoBookmarkToggle = document.getElementById('autoBookmark');
  const autoCloseTabToggle = document.getElementById('autoCloseTab');

  // Load current settings
  const result = await chrome.storage.sync.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  extensionEnabledToggle.checked = result.extensionEnabled ?? true;
  autoBookmarkToggle.checked = result.autoBookmark ?? true;
  autoCloseTabToggle.checked = result.autoCloseTab ?? false;

  // Handle toggle changes
  function handleToggleChange(toggleId, storageKey) {
    const toggle = document.getElementById(toggleId);
    toggle.addEventListener('change', function() {
      chrome.storage.sync.set({ [storageKey]: this.checked }, function() {
        console.log(`${storageKey} is set to ${this.checked}`);
      });
    });
  }

  handleToggleChange('extensionEnabled', 'extensionEnabled');
  handleToggleChange('autoBookmark', 'autoBookmark');
  handleToggleChange('autoCloseTab', 'autoCloseTab');

  manualExecuteButton.addEventListener('click', async function() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const response = await chrome.runtime.sendMessage({action: "manualExecute", url: tabs[0].url});
    if (response && response.success) {
      console.log("Rules applied successfully");
    } else {
      console.log("No matching rules found or error occurred");
    }
    window.close(); // Close the popup after sending the message
  });

  openOptionsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});
