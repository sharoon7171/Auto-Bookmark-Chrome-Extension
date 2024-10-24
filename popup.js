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
    contentContainer: document.getElementById('contentContainer')
  };

  // Hide content initially
  elements.contentContainer.style.display = 'none';

  // Load current settings
  safeAsyncFunction(async () => {
    await loadSettings();
    // Show content after settings are loaded
    elements.contentContainer.style.display = 'block';
  });

  // Handle toggle changes
  const handleToggleChange = (toggle, storageKey) => {
    toggle.addEventListener('change', () => {
      safeAsyncFunction(async () => {
        await chrome.storage.local.set({ [storageKey]: toggle.checked });
        // Notify options page about the change immediately
        chrome.runtime.sendMessage({ 
          action: "optionsChanged", 
          key: storageKey, 
          value: toggle.checked 
        });
      });
    });
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
  elements.openOptionsButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "getOptionsVersion" }, (response) => {
      chrome.runtime.openOptionsPage(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const optionsTab = tabs[0];
          chrome.tabs.update(optionsTab.id, { url: `options.html?v=${response.version}` });
        });
      });
    });
  });

  // Listen for changes from options page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "optionsChanged") {
      safeAsyncFunction(loadSettings);
    }
  });

  const bookmarkSearchInput = document.querySelector('.bookmark-search-input');
  const bookmarkSearchResults = document.querySelector('.bookmark-search-results');

  bookmarkSearchInput.addEventListener('input', () => {
    const searchTerm = bookmarkSearchInput.value.toLowerCase();
    updateBookmarkSearchResults(bookmarkSearchResults, searchTerm);
  });

  // Function to update search results
  function updateBookmarkSearchResults(resultsDiv, searchTerm) {
    resultsDiv.innerHTML = '';
    const matchingFolders = bookmarkFolders.filter(folder => 
      folder.title.toLowerCase().includes(searchTerm)
    );

    matchingFolders.forEach(folder => {
      const folderElement = document.createElement('div');
      folderElement.textContent = folder.title;
      folderElement.className = 'search-result';
      folderElement.addEventListener('click', () => {
        bookmarkSearchInput.value = folder.title;
        resultsDiv.style.display = 'none';
      });
      resultsDiv.appendChild(folderElement);
    });

    if (matchingFolders.length === 0) {
      const noResultElement = document.createElement('div');
      noResultElement.textContent = 'No matching folders found';
      noResultElement.className = 'search-result no-result';
      resultsDiv.appendChild(noResultElement);
    }
  }
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
