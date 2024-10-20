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

    const matchingRules = (result.rules || []).filter(rule => {
      if (!rule.enabled) return false;
      
      const domainMatch = rule.domain && tab.url.includes(rule.domain);
      const containsMatch = rule.contains && tab.url.includes(rule.contains);
      
      // Match if both conditions are set and met, or if only one is set and met
      return (rule.domain && rule.contains) ? (domainMatch && containsMatch) : (domainMatch || containsMatch);
    }).sort((a, b) => b.priority - a.priority);

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

function executeRules(tab, isManual = false) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['rules', 'extensionEnabled', 'autoBookmark', 'autoCloseTab'], (data) => {
      if (!data.extensionEnabled && !isManual) {
        resolve(false);
        return;
      }

      const rules = data.rules || [];
      console.log('Executing rules for URL:', tab.url);
      console.log('Available rules:', rules);

      const matchingRules = rules.filter(rule => 
        rule.enabled && ((rule.domain && tab.url.includes(rule.domain)) || 
        (rule.contains && tab.url.includes(rule.contains)))
      ).sort((a, b) => b.priority - a.priority);

      if (matchingRules.length > 0) {
        console.log('Matching rules found:', matchingRules);
        const topRule = matchingRules[0];

        if (data.autoBookmark || isManual) {
          chrome.bookmarks.search({url: tab.url}, existingBookmarks => {
            const bookmarkInfo = {
              title: tab.title,
              url: tab.url
            };

            if (topRule.bookmarkAction === 'doNothing' && existingBookmarks.length === 0) {
              chrome.bookmarks.create({
                ...bookmarkInfo,
                parentId: topRule.bookmarkLocation
              }, (newBookmark) => {
                console.log('New bookmark created:', newBookmark);
                applyCloseTab(tab, topRule, data.autoCloseTab, isManual, resolve);
              });
            } else if (topRule.bookmarkAction === 'replace') {
              if (existingBookmarks.length > 0) {
                const existingBookmark = existingBookmarks[0];
                chrome.bookmarks.update(existingBookmark.id, bookmarkInfo, (updatedBookmark) => {
                  console.log('Bookmark updated:', updatedBookmark);
                  if (existingBookmark.parentId !== topRule.bookmarkLocation) {
                    chrome.bookmarks.move(updatedBookmark.id, {parentId: topRule.bookmarkLocation}, (movedBookmark) => {
                      console.log('Bookmark moved:', movedBookmark);
                      applyCloseTab(tab, topRule, data.autoCloseTab, isManual, resolve);
                    });
                  } else {
                    applyCloseTab(tab, topRule, data.autoCloseTab, isManual, resolve);
                  }
                });
              } else {
                chrome.bookmarks.create({
                  ...bookmarkInfo,
                  parentId: topRule.bookmarkLocation
                }, (newBookmark) => {
                  console.log('New bookmark created:', newBookmark);
                  applyCloseTab(tab, topRule, data.autoCloseTab, isManual, resolve);
                });
              }
            } else if (topRule.bookmarkAction === 'duplicate') {
              chrome.bookmarks.create({
                ...bookmarkInfo,
                parentId: topRule.bookmarkLocation
              }, (newBookmark) => {
                console.log('Duplicate bookmark created:', newBookmark);
                applyCloseTab(tab, topRule, data.autoCloseTab, isManual, resolve);
              });
            } else {
              applyCloseTab(tab, topRule, data.autoCloseTab, isManual, resolve);
            }
          });
        } else {
          applyCloseTab(tab, topRule, data.autoCloseTab, isManual, resolve);
        }
      } else {
        console.log('No matching rule found');
        resolve(false);
      }
    });
  });
}

function applyCloseTab(tab, rule, globalAutoCloseTab, isManual, resolve) {
  if ((globalAutoCloseTab || isManual) && rule.closeTab) {
    chrome.tabs.remove(tab.id, () => {
      console.log('Tab closed:', tab.id);
      resolve(true);
    });
  } else {
    resolve(true);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    executeRules(tab);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "manualExecute") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      executeRules(tabs[0], true).then(result => {
        sendResponse({success: result});
      });
    });
    return true; // Indicates we will send a response asynchronously
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "apply-rules") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        executeRules(tabs[0], true).then(result => {
          if (result) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon48.png',
              title: 'Auto Bookmark',
              message: 'Rules applied successfully!'
            });
          } else {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon48.png',
              title: 'Auto Bookmark',
              message: 'No matching rules found.'
            });
          }
        });
      }
    });
  }
});
