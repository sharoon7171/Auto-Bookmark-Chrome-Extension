// Cache and utility functions
let bookmarkFoldersCache = null;

async function getBookmarkFolders() {
  if (bookmarkFoldersCache) return bookmarkFoldersCache;

  try {
    const bookmarkTreeNodes = await chrome.bookmarks.getTree();
    const folders = [];

    function traverseBookmarks(nodes) {
      for (const node of nodes) {
        if (node.children) {
          folders.push({ id: node.id, title: node.title });
          traverseBookmarks(node.children);
        }
      }
    }

    traverseBookmarks(bookmarkTreeNodes);
    bookmarkFoldersCache = folders;
    return folders;
  } catch (error) {
    console.error('Error fetching bookmark folders:', error);
    return [];
  }
}

// Bookmark and tab management functions
async function createBookmark(parentId, title, url) {
  try {
    const newBookmark = await chrome.bookmarks.create({ parentId, title, url });
    console.log('Bookmark created:', newBookmark);
    return newBookmark;
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return null;
  }
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    console.log('Tab closed:', tabId);
  } catch (error) {
    if (error.message.includes("Tabs cannot be edited right now")) {
      console.warn('Unable to close tab. User may be dragging a tab. Will retry in 1 second.');
      // Retry after a short delay
      setTimeout(() => closeTab(tabId), 1000);
    } else {
      console.error('Error closing tab:', error);
    }
  }
}

// Rule execution functions
async function executeRule(rule, tab, globalAutoBookmark, globalAutoCloseTab) {
  if (!globalAutoBookmark) {
    if (globalAutoCloseTab && rule.closeTab) {
      await closeTab(tab.id);
    }
    return;
  }

  const existingBookmarks = await chrome.bookmarks.search({ url: tab.url });
  const bookmarkInfo = { title: tab.title, url: tab.url };

  switch (rule.bookmarkAction) {
    case 'doNothing':
      if (existingBookmarks.length === 0) {
        await createBookmark(rule.bookmarkLocation, bookmarkInfo.title, bookmarkInfo.url);
      }
      break;
    case 'replace':
      if (existingBookmarks.length > 0) {
        const existingBookmark = existingBookmarks[0];
        await chrome.bookmarks.update(existingBookmark.id, bookmarkInfo);
        if (existingBookmark.parentId !== rule.bookmarkLocation) {
          await chrome.bookmarks.move(existingBookmark.id, { parentId: rule.bookmarkLocation });
        }
      } else {
        await createBookmark(rule.bookmarkLocation, bookmarkInfo.title, bookmarkInfo.url);
      }
      break;
    case 'duplicate':
      await createBookmark(rule.bookmarkLocation, bookmarkInfo.title, bookmarkInfo.url);
      break;
  }

  if (globalAutoCloseTab && rule.closeTab) {
    await closeTab(tab.id);
  }
}

async function executeRules(tab, isManual = false) {
  try {
    const { rules = [], extensionEnabled, autoBookmark, autoCloseTab } = await chrome.storage.local.get(['rules', 'extensionEnabled', 'autoBookmark', 'autoCloseTab']);
    
    if (!extensionEnabled && !isManual) return false;

    const matchingRules = rules.filter(rule => {
      if (!rule.enabled || (!rule?.domain && !rule?.contains)) return false;
      
      // Parse the tab URL
      let tabUrl;
      try {
        tabUrl = new URL(tab.url);
      } catch (error) {
        console.error('Invalid URL:', tab.url);
        return false;
      }

      // Normalize the domain from the rule
      const normalizedRuleDomain = rule.domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
      
      // Normalize the hostname from the tab URL
      const normalizedTabHostname = tabUrl.hostname.replace(/^www\./, '');

      // Strict domain matching
      const domainMatch = rule?.domain ? 
        normalizedTabHostname === normalizedRuleDomain : true;

      const containsMatch = rule?.contains ? tab.url.includes(rule.contains) : true;
      
      return domainMatch && containsMatch;
    }).sort((a, b) => b.priority - a.priority);

    if (matchingRules.length > 0) {
      const topRule = matchingRules[0];
      await executeRule(topRule, tab, autoBookmark || isManual, autoCloseTab);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error executing rules:', error);
    return false;
  }
}

// Event listeners
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    executeRules(tab);
  }
});

// Modify the message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "manualExecute") {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      if (tabs.length === 0) {
        console.error("No active tab found");
        sendResponse({success: false, error: "No active tab found"});
        return;
      }
      try {
        const result = await executeRules(tabs[0], true);
        sendResponse({success: result});
      } catch (error) {
        console.error("Error executing rules:", error);
        sendResponse({success: false, error: error.message});
      }
    });
    return true; // Indicates we will send a response asynchronously
  }

  if (request.action === "optionsChanged") {
    // Relay the message to all open tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        try {
          chrome.tabs.sendMessage(tab.id, request).catch(error => {
            console.warn(`Failed to send message to tab ${tab.id}:`, error);
          });
        } catch (error) {
          console.warn(`Error sending message to tab ${tab.id}:`, error);
        }
      });
    });
  }
});

// Initialization
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  getBookmarkFolders().then(() => {
    console.log('Bookmark folders fetched successfully');
  }).catch(error => {
    console.error('Failed to fetch bookmark folders:', error);
  });
});

// Storage change listener
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.backupData) {
    console.log('Backup data changed in sync storage');
  }
});

// Add this at the end of your background.js file
