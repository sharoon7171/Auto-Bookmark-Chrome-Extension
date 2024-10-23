document.addEventListener('DOMContentLoaded', async function() {
  const manualExecuteButton = document.getElementById('manualExecute');
  const openOptionsButton = document.getElementById('openOptions');
  const extensionEnabledToggle = document.getElementById('extensionEnabled');
  const autoBookmarkToggle = document.getElementById('autoBookmark');
  const autoCloseTabToggle = document.getElementById('autoCloseTab');

  // Load current settings
  const result = await chrome.storage.local.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  extensionEnabledToggle.checked = result.extensionEnabled ?? true;
  autoBookmarkToggle.checked = result.autoBookmark ?? true;
  autoCloseTabToggle.checked = result.autoCloseTab ?? false;

  // Handle toggle changes
  function handleToggleChange(toggle, storageKey) {
    toggle.addEventListener('change', function() {
      chrome.storage.local.set({ [storageKey]: this.checked }, function() {
        console.log(`${storageKey} is set to ${this.checked}`);
      });
    });
  }

  handleToggleChange(extensionEnabledToggle, 'extensionEnabled');
  handleToggleChange(autoBookmarkToggle, 'autoBookmark');
  handleToggleChange(autoCloseTabToggle, 'autoCloseTab');

  manualExecuteButton.addEventListener('click', async function() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const response = await chrome.runtime.sendMessage({action: "manualExecute", url: tabs[0].url});
    console.log(response && response.success ? "Rules applied successfully" : "No matching rules found or error occurred");
    window.close(); // Close the popup after sending the message
  });

  openOptionsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});
