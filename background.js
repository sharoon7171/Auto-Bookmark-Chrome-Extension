// Cache for bookmark folders
let bookmarkFoldersCache = null;

// Function to get bookmark folders
async function getBookmarkFolders() {
  if (bookmarkFoldersCache) return bookmarkFoldersCache;

  const bookmarkTreeNodes = await chrome.bookmarks.getTree();
  const folders = [];

  function traverseBookmarks(nodes) {
    for (let node of nodes) {
      if (node.children) {
        folders.push({ id: node.id, title: node.title });
        traverseBookmarks(node.children);
      }
    }
  }

  traverseBookmarks(bookmarkTreeNodes);
  bookmarkFoldersCache = folders;
  return folders;
}

// Function to create a bookmark
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

// Function to close a tab
async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    console.log('Tab closed:', tabId);
  } catch (error) {
    console.error('Error closing tab:', error);
  }
}

// Function to execute a rule
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

// Function to execute rules
async function executeRules(tab, isManual = false) {
  const data = await chrome.storage.sync.get(['rules', 'extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  
  if (!data.extensionEnabled && !isManual) return false;

  const rules = data.rules || [];
  const matchingRules = rules.filter(rule => {
    if (!rule.enabled) return false;
    
    // Only consider rules with non-empty domain or contains fields
    if (!rule.domain && !rule.contains) return false;
    
    const url = new URL(tab.url);
    const domainMatch = rule.domain ? url.hostname === rule.domain || url.hostname.endsWith('.' + rule.domain) : true;
    const containsMatch = rule.contains ? tab.url.includes(rule.contains) : true;
    
    return domainMatch && containsMatch;
  }).sort((a, b) => b.priority - a.priority);

  if (matchingRules.length > 0) {
    const topRule = matchingRules[0];
    await executeRule(topRule, tab, data.autoBookmark || isManual, data.autoCloseTab);
    return true;
  }

  return false;
}

// Event listeners
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    executeRules(tab);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "manualExecute") {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      const result = await executeRules(tabs[0], true);
      sendResponse({success: result});
    });
    return true; // Indicates we will send a response asynchronously
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "apply-rules") {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
      const result = await executeRules(tabs[0], true);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Auto Bookmark',
        message: result ? 'Rules applied successfully!' : 'No matching rules found.'
      });
    }
  }
});

// Initialize bookmark folders cache
getBookmarkFolders();
