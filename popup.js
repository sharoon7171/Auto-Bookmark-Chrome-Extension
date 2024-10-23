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
  chrome.storage.local.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab'], (result) => {
    elements.extensionEnabledToggle.checked = result.extensionEnabled ?? true;
    elements.autoBookmarkToggle.checked = result.autoBookmark ?? true;
    elements.autoCloseTabToggle.checked = result.autoCloseTab ?? false;
  });

  // Handle toggle changes
  const handleToggleChange = (toggle, storageKey) => {
    toggle.addEventListener('change', () => {
      chrome.storage.local.set({ [storageKey]: toggle.checked });
    });
  };

  ['extensionEnabled', 'autoBookmark', 'autoCloseTab'].forEach(key => 
    handleToggleChange(elements[key + 'Toggle'], key)
  );

  // Manual execute button
  elements.manualExecuteButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.runtime.sendMessage({ action: "manualExecute", url: tab.url }, (response) => {
        console.log(response?.success ? "Rules applied successfully" : "No matching rules found or error occurred");
        window.close();
      });
    });
  });

  // Open options button
  elements.openOptionsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Backup button
  elements.backupButton.addEventListener('click', () => {
    chrome.storage.local.get(null, (data) => {
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

  // Implement restore functionality here
});
