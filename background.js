function createGoogleBookmark() {
  chrome.bookmarks.create({
    parentId: '2',
    title: 'Google',
    url: 'https://www.google.com/'
  }, (newBookmark) => {
    if (chrome.runtime.lastError) {
      console.error('Error creating bookmark:', chrome.runtime.lastError);
    } else {
      console.log('Bookmark created:', newBookmark);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createGoogleBookmark();
});

function handleGoogleTab(tab) {
  chrome.storage.sync.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab'], (options) => {
    if (!options.extensionEnabled) return;

    if (options.autoBookmark) {
      chrome.bookmarks.search({url: tab.url}, (existingBookmarks) => {
        if (existingBookmarks.length === 0) {
          chrome.bookmarks.create({
            parentId: '2',
            title: tab.title || 'Google',
            url: tab.url
          }, (newBookmark) => {
            if (chrome.runtime.lastError) {
              console.error('Error creating bookmark:', chrome.runtime.lastError);
            } else {
              console.log('Bookmark created:', newBookmark);
            }
            if (options.autoCloseTab) closeTab(tab.id);
          });
        } else {
          console.log('Bookmark already exists');
          if (options.autoCloseTab) closeTab(tab.id);
        }
      });
    } else if (options.autoCloseTab) {
      closeTab(tab.id);
    }
  });
}

function closeTab(tabId) {
  chrome.tabs.remove(tabId, () => {
    if (chrome.runtime.lastError) {
      console.error('Error closing tab:', chrome.runtime.lastError);
    } else {
      console.log('Tab closed:', tabId);
    }
  });
}

function handleTab(tab) {
  chrome.storage.sync.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab', 'rules'], (result) => {
    if (!result.extensionEnabled) return;

    const matchingRules = (result.rules || []).filter(rule => 
      rule.enabled && 
      ((rule.domain && tab.url.includes(rule.domain)) || 
      (rule.contains && tab.url.includes(rule.contains)))
    ).sort((a, b) => b.priority - a.priority);

    if (matchingRules.length > 0) {
      const rule = matchingRules[0];
      if (rule.autoExecute) {
        executeRule(rule, tab, result.autoBookmark, result.autoCloseTab);
      }
    }
  });
}

function executeRule(rule, tab, globalAutoBookmark, globalAutoCloseTab) {
  if (globalAutoBookmark) {
    chrome.bookmarks.search({url: tab.url}, existingBookmarks => {
      const bookmarkInfo = {
        title: tab.title,
        url: tab.url
      };

      if (rule.bookmarkAction === 'doNothing') {
        // Do nothing if already bookmarked, otherwise create a new bookmark
        if (existingBookmarks.length === 0) {
          chrome.bookmarks.create({
            ...bookmarkInfo,
            parentId: rule.bookmarkLocation
          }, (newBookmark) => {
            console.log('New bookmark created:', newBookmark);
          });
        } else {
          console.log('Bookmark already exists, doing nothing');
        }
      } else if (rule.bookmarkAction === 'replace') {
        // Replace the first existing bookmark or create a new one if it doesn't exist
        if (existingBookmarks.length > 0) {
          const existingBookmark = existingBookmarks[0];
          chrome.bookmarks.update(existingBookmark.id, bookmarkInfo, (updatedBookmark) => {
            console.log('Bookmark updated:', updatedBookmark);
            if (existingBookmark.parentId !== rule.bookmarkLocation) {
              chrome.bookmarks.move(updatedBookmark.id, {parentId: rule.bookmarkLocation}, (movedBookmark) => {
                console.log('Bookmark moved:', movedBookmark);
              });
            }
          });
        } else {
          chrome.bookmarks.create({
            ...bookmarkInfo,
            parentId: rule.bookmarkLocation
          }, (newBookmark) => {
            console.log('New bookmark created:', newBookmark);
          });
        }
      } else if (rule.bookmarkAction === 'duplicate') {
        // Always add a new bookmark
        chrome.bookmarks.create({
          ...bookmarkInfo,
          parentId: rule.bookmarkLocation
        }, (newBookmark) => {
          console.log('Duplicate bookmark created:', newBookmark);
        });
      }

      if (globalAutoCloseTab && rule.closeTab) {
        chrome.tabs.remove(tab.id, () => {
          console.log('Tab closed:', tab.id);
        });
      }
    });
  } else if (globalAutoCloseTab && rule.closeTab) {
    chrome.tabs.remove(tab.id, () => {
      console.log('Tab closed:', tab.id);
    });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    handleTab(tab);
  }
});
