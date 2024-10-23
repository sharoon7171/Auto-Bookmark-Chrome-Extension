// Global variables
let bookmarkFolders = [];
let undoStack = [];
let redoStack = [];
let notificationTimeout;

// DOM Elements
const elements = {
  rulesContainer: document.getElementById('rules'),
  addRuleButton: document.getElementById('addRule'),
  extensionEnabledCheckbox: document.getElementById('extensionEnabled'),
  autoBookmarkCheckbox: document.getElementById('autoBookmark'),
  autoCloseTabCheckbox: document.getElementById('autoCloseTab'),
  notification: document.getElementById('notification'),
  backupButton: document.getElementById('backupButton'),
  restoreButton: document.getElementById('restoreButton'),
  contentContainer: document.getElementById('contentContainer')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', initializePage);
elements.addRuleButton.addEventListener('click', addNewRule);
elements.backupButton.addEventListener('click', backupSettings);
elements.restoreButton.addEventListener('click', restoreSettings);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});

// Utility functions
async function loadUndoRedoStacks() {
  const result = await chrome.storage.local.get(['undoStack', 'redoStack']);
  undoStack = result.undoStack || [];
  redoStack = result.redoStack || [];
}

function saveUndoRedoStacks() {
  chrome.storage.local.set({ undoStack, redoStack });
}

function saveGlobalOptions() {
  const options = {
    extensionEnabled: elements.extensionEnabledCheckbox.checked,
    autoBookmark: elements.autoBookmarkCheckbox.checked,
    autoCloseTab: elements.autoCloseTabCheckbox.checked
  };
  chrome.storage.local.set(options, () => {
    // Notify popup about the changes
    chrome.runtime.sendMessage({ action: "optionsChanged" });
  });
}

async function loadGlobalOptions() {
  const result = await chrome.storage.local.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  elements.extensionEnabledCheckbox.checked = result.extensionEnabled ?? true;
  elements.autoBookmarkCheckbox.checked = result.autoBookmark ?? true;
  elements.autoCloseTabCheckbox.checked = result.autoCloseTab ?? false;
}

// Error handling wrapper for async functions
async function safeAsyncFunction(asyncFunction) {
  try {
    return await asyncFunction();
  } catch (error) {
    console.error('An error occurred:', error);
    showNotification('An error occurred. Please try again.', false);
  }
}

// Rule management functions
function createRuleElement(rule, index) {
  const ruleDiv = document.createElement('div');
  ruleDiv.className = 'rule-container';
  
  const titleRow = document.createElement('div');
  titleRow.className = 'rule-title-row';
  titleRow.innerHTML = `
    <span>URL Domain</span>
    <span>URL Contains</span>
    <span>Rule Priority</span>
    <span>Bookmark Folder</span>
    <span>Action</span>
    <span>Options</span>
  `;
  ruleDiv.appendChild(titleRow);

  const ruleInputRow = document.createElement('div');
  ruleInputRow.className = 'rule';
  ruleInputRow.innerHTML = `
    <input type="text" placeholder="e.g., example.com" value="${rule.domain || ''}" data-field="domain" class="selectable-input">
    <input type="text" placeholder="e.g., article, product" value="${rule.contains || ''}" data-field="contains" class="selectable-input">
    <input type="number" placeholder="0-100 (higher = more important)" value="${rule.priority || 0}" data-field="priority" min="0" max="100" class="selectable-input">
    <div class="bookmark-search">
      <input type="text" placeholder="Search bookmark folders" class="bookmark-search-input" data-field="bookmarkLocation" data-selected-id="${rule.bookmarkLocation || ''}">
      <div class="bookmark-search-results"></div>
    </div>
    <select data-field="bookmarkAction">
      <option value="doNothing" ${rule.bookmarkAction === 'doNothing' ? 'selected' : ''}>Do Nothing if Bookmarked</option>
      <option value="replace" ${rule.bookmarkAction === 'replace' ? 'selected' : ''}>Replace Bookmark</option>
      <option value="duplicate" ${rule.bookmarkAction === 'duplicate' ? 'selected' : ''}>Add Duplicate Bookmark</option>
    </select>
    <div class="rule-options">
      <label><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-field="enabled"><span>Enabled</span></label>
      <label><input type="checkbox" ${rule.autoExecute ? 'checked' : ''} data-field="autoExecute"><span>Auto</span></label>
      <label><input type="checkbox" ${rule.closeTab ? 'checked' : ''} data-field="closeTab"><span>Close Tab</span></label>
      <button class="deleteRule">Delete</button>
    </div>
  `;

  ruleInputRow.querySelectorAll('input, select').forEach(input => {
    if (input.type === 'text' || input.type === 'number') {
      input.addEventListener('input', (event) => updateRule(index, event));
    } else {
      input.addEventListener('change', (event) => updateRule(index, event));
    }
  });

  const bookmarkSearchInput = ruleInputRow.querySelector('.bookmark-search-input');
  const bookmarkSearchResults = ruleInputRow.querySelector('.bookmark-search-results');

  // Set the initial value to the folder name if it exists
  if (rule.bookmarkLocation) {
    bookmarkSearchInput.value = getFolderName(rule.bookmarkLocation);
  }

  bookmarkSearchInput.addEventListener('focus', () => {
    bookmarkSearchInput.value = ''; // Clear the input when focused
    bookmarkSearchResults.style.display = 'block';
    updateBookmarkSearchResults(bookmarkSearchResults, '');
  });

  bookmarkSearchInput.addEventListener('blur', () => {
    // Restore the folder name if no new selection was made
    setTimeout(() => {
      if (!bookmarkSearchInput.value && bookmarkSearchInput.dataset.selectedId) {
        bookmarkSearchInput.value = getFolderName(bookmarkSearchInput.dataset.selectedId);
      }
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!bookmarkSearchInput.contains(e.target) && !bookmarkSearchResults.contains(e.target)) {
      bookmarkSearchResults.style.display = 'none';
    }
  });

  ruleDiv.appendChild(ruleInputRow);
  ruleDiv.querySelector('.deleteRule').addEventListener('click', () => deleteRule(index));

  return ruleDiv;
}

function updateRule(index, event) {
  const ruleDiv = document.querySelectorAll('.rule')[index];
  const ruleInputs = ruleDiv.querySelectorAll('[data-field]');
  const newRule = Object.fromEntries(
    Array.from(ruleInputs).map(input => {
      const key = input.dataset.field;
      let value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else if (input.dataset.field === 'bookmarkLocation') {
        value = input.dataset.selectedId;
      } else {
        value = input.value;
      }
      return [key, value];
    })
  );
  
  const changedInput = event.target;
  if (changedInput && (changedInput.dataset.field === 'domain' || changedInput.dataset.field === 'contains')) {
    if (event.type === 'input') {
      const oldValue = changedInput.dataset.oldValue || '';
      const newValue = changedInput.value;
      
      if (newValue.length > oldValue.length) {
        showNotification(`Adding "${newValue}"`, true);
      } else if (newValue.length < oldValue.length) {
        const removedPart = oldValue.slice(newValue.length);
        showNotification(`"${removedPart}" is Removed`, false);
        
        // Prevent any subsequent calls to showNotification for a short period
        changedInput.dataset.notificationLock = 'true';
        setTimeout(() => {
          changedInput.dataset.notificationLock = 'false';
        }, 3100); // Slightly longer than the notification duration
      }
      
      changedInput.dataset.oldValue = newValue;
    }
  } else if (changedInput && changedInput.type === 'checkbox') {
    const status = changedInput.checked ? 'Enabled' : 'Disabled';
    showNotification(`${changedInput.dataset.field} ${status} for Rule ${index + 1}`, changedInput.checked);
  }

  // Only save the rule and show notification if not locked
  if (changedInput.dataset.notificationLock !== 'true') {
    saveRule(index, newRule);
  }
}

function saveRule(index, newRule) {
  safeAsyncFunction(async () => {
    const data = await chrome.storage.local.get('rules');
    const rules = data.rules || [];
    const oldRule = rules[index];
    undoStack.push({ action: 'update', index, oldRule });
    redoStack = [];
    rules[index] = newRule;
    await chrome.storage.local.set({rules});
    
    let changes = [];
    if (oldRule.domain !== newRule.domain) {
      changes.push(`"${newRule.domain}" is ${newRule.domain ? 'Added' : 'Removed'}`);
    }
    if (oldRule.contains !== newRule.contains) {
      changes.push(`"${newRule.contains}" is ${newRule.contains ? 'Added' : 'Removed'}`);
    }
    if (oldRule.priority !== newRule.priority) {
      changes.push(`Priority set to (${newRule.priority})`);
    }
    if (oldRule.bookmarkLocation !== newRule.bookmarkLocation) {
      changes.push(`Selected ${getFolderName(newRule.bookmarkLocation)}`);
    }
    if (oldRule.bookmarkAction !== newRule.bookmarkAction) {
      const actionFullNames = {
        'doNothing': 'Do Nothing if Bookmarked',
        'replace': 'Replace Bookmark',
        'duplicate': 'Add Duplicate Bookmark'
      };
      changes.push(`Selected ${actionFullNames[newRule.bookmarkAction]}`);
    }
    if (oldRule.enabled !== newRule.enabled) {
      changes.push(`Rule ${index + 1} ${newRule.enabled ? 'Enabled' : 'Disabled'}`);
    }
    if (oldRule.autoExecute !== newRule.autoExecute) {
      changes.push(`Auto Execution ${newRule.autoExecute ? 'Enabled' : 'Disabled'} for Rule ${index + 1}`);
    }
    if (oldRule.closeTab !== newRule.closeTab) {
      changes.push(`Auto Close ${newRule.closeTab ? 'Enabled' : 'Disabled'} for Rule ${index + 1}`);
    }
    
    let notificationMessage = changes.join(', ');
    if (notificationMessage) {
      const isEnabled = !notificationMessage.includes('Disabled');
      showNotification(notificationMessage, isEnabled);
    }
  });
}

function undo() {
  if (undoStack.length === 0) return;
  
  const action = undoStack.pop();
  chrome.storage.local.get('rules', (data) => {
    let rules = data.rules || [];
    
    if (action.action === 'update') {
      redoStack.push({ action: 'update', index: action.index, oldRule: rules[action.index] });
      rules[action.index] = action.oldRule;
    } else if (action.action === 'add') {
      redoStack.push({ action: 'delete', index: rules.length - 1 });
      rules.pop();
    } else if (action.action === 'delete') {
      redoStack.push({ action: 'add', rule: action.rule });
      rules.splice(action.index, 0, action.rule);
    }
    
    chrome.storage.local.set({rules}, displayRules);
  });
}

function redo() {
  if (redoStack.length === 0) return;
  
  const action = redoStack.pop();
  chrome.storage.local.get('rules', (data) => {
    let rules = data.rules || [];
    
    if (action.action === 'update') {
      undoStack.push({ action: 'update', index: action.index, oldRule: rules[action.index] });
      rules[action.index] = action.oldRule;
    } else if (action.action === 'add') {
      undoStack.push({ action: 'delete', index: rules.length });
      rules.push(action.rule);
    } else if (action.action === 'delete') {
      undoStack.push({ action: 'add', rule: rules[action.index] });
      rules.splice(action.index, 1);
    }
    
    chrome.storage.local.set({rules}, displayRules);
  });
}

function deleteRule(index) {
  chrome.storage.local.get('rules', ({rules}) => {
    undoStack.push({ action: 'delete', index, rule: rules[index] });
    redoStack = [];
    rules.splice(index, 1);
    chrome.storage.local.set({rules}, () => {
      displayRules();
      showNotification(`Rule ${index + 1} deleted successfully`, false);
    });
  });
}

function displayRules() {
  elements.rulesContainer.innerHTML = '';
  chrome.storage.local.get('rules', (data) => {
    const rules = data.rules || [];
    rules.forEach((rule, index) => {
      const ruleElement = createRuleElement(rule, index);
      elements.rulesContainer.appendChild(ruleElement);
    });
  });
}

function addNewRule() {
  chrome.storage.local.get('rules', ({rules = []}) => {
    const newRule = {
      domain: '',
      contains: '',
      priority: 0,
      bookmarkLocation: bookmarkFolders[0].id,
      bookmarkAction: 'doNothing',
      enabled: false,
      autoExecute: false,
      closeTab: false
    };
    undoStack.push({ action: 'add', rule: newRule });
    redoStack = [];
    rules.push(newRule);
    chrome.storage.local.set({rules}, () => {
      displayRules();
      showNotification('New rule added successfully', true);
    });
  });
}

// UI functions
function showNotification(message, isEnabled = true) {
  const activeInputs = document.querySelectorAll('input[data-notification-lock="true"]');
  if (activeInputs.length > 0) {
    return; // Don't show notification if there's an active lock
  }

  clearTimeout(notificationTimeout);
  
  elements.notification.textContent = message;
  elements.notification.classList.remove('notification-enabled', 'notification-disabled');
  elements.notification.classList.add(isEnabled ? 'notification-enabled' : 'notification-disabled');
  elements.notification.classList.remove('show');
  
  // Force a reflow
  void elements.notification.offsetWidth;
  
  elements.notification.classList.add('show');

  notificationTimeout = setTimeout(() => {
    elements.notification.classList.remove('show');
  }, 3000);
}

function handleOptionChange(optionId, optionName) {
  const checkbox = document.getElementById(optionId);
  checkbox.addEventListener('change', (e) => {
    saveGlobalOptions();
    const status = e.target.checked ? 'Enabled' : 'Disabled';
    let notificationMessage;
    switch (optionName) {
      case 'Extension':
        notificationMessage = `Extension ${status}`;
        break;
      case 'Automatic bookmarking':
        notificationMessage = `Automatic Bookmarking ${status} Globally`;
        break;
      case 'Automatic tab closing':
        notificationMessage = `Automatic Tab Closing ${status} Globally`;
        break;
      default:
        notificationMessage = `${optionName} ${status}`;
    }
    showNotification(notificationMessage, e.target.checked);
  });
}

function getFolderName(folderId) {
  const folder = bookmarkFolders.find(f => f.id === folderId);
  return folder ? folder.title : '';
}

function clearUndoRedoStacks() {
  undoStack = [];
  redoStack = [];
  saveUndoRedoStacks();
}

async function loadAndDisplayRules() {
  const data = await chrome.storage.local.get(['rules', 'extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  const rules = data.rules || [];
  elements.extensionEnabledCheckbox.checked = data.extensionEnabled ?? true;
  elements.autoBookmarkCheckbox.checked = data.autoBookmark ?? true;
  elements.autoCloseTabCheckbox.checked = data.autoCloseTab ?? false;

  elements.rulesContainer.innerHTML = '';
  rules.forEach((rule, index) => {
    const ruleElement = createRuleElement(rule, index);
    elements.rulesContainer.appendChild(ruleElement);
  });
}

// Add this function to update bookmark folders
async function updateBookmarkFolders() {
  const bookmarkTreeNodes = await chrome.bookmarks.getTree();
  bookmarkFolders = [];
  function traverseBookmarks(nodes) {
    for (const node of nodes) {
      if (node.children) {
        bookmarkFolders.push({id: node.id, title: node.title});
        traverseBookmarks(node.children);
      }
    }
  }
  traverseBookmarks(bookmarkTreeNodes);
}

// Modify the initializePage function
async function initializePage() {
  // Hide content while loading
  elements.contentContainer.style.display = 'none';

  await updateBookmarkFolders();

  await loadAndDisplayRules();
  await loadGlobalOptions();

  handleOptionChange('extensionEnabled', 'Extension');
  handleOptionChange('autoBookmark', 'Automatic bookmarking');
  handleOptionChange('autoCloseTab', 'Automatic tab closing');

  // Show content after everything is loaded
  elements.contentContainer.style.display = 'block';

  // Add listener for bookmark changes
  chrome.bookmarks.onCreated.addListener(handleBookmarkChange);
  chrome.bookmarks.onRemoved.addListener(handleBookmarkChange);
  chrome.bookmarks.onChanged.addListener(handleBookmarkChange);
  chrome.bookmarks.onMoved.addListener(handleBookmarkChange);
}

// Add this function to handle bookmark changes
async function handleBookmarkChange() {
  await updateBookmarkFolders();
  // Update all bookmark folder dropdowns
  document.querySelectorAll('.bookmark-search-input').forEach(input => {
    const resultsDiv = input.nextElementSibling;
    updateBookmarkSearchResults(resultsDiv, input.value);
  });
}

// Modify the updateBookmarkSearchResults function
function updateBookmarkSearchResults(resultsDiv, searchTerm) {
  resultsDiv.innerHTML = '';
  const lowerSearchTerm = searchTerm.toLowerCase();
  const matchingFolders = bookmarkFolders.filter(folder => 
    folder.title.toLowerCase().includes(lowerSearchTerm)
  );
  
  matchingFolders.forEach(folder => {
    const folderElement = document.createElement('div');
    folderElement.textContent = folder.title;
    folderElement.className = 'search-result';
    folderElement.addEventListener('click', () => {
      const input = resultsDiv.previousElementSibling;
      input.value = folder.title;
      input.dataset.selectedId = folder.id;
      resultsDiv.style.display = 'none';
      const ruleIndex = Array.from(document.querySelectorAll('.rule')).indexOf(resultsDiv.closest('.rule'));
      updateRule(ruleIndex, { target: input, type: 'change' });
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

// Backup and restore functions
async function backupSettings() {
  try {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart-bookmark-saver-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Settings backup created successfully', true);
  } catch (error) {
    console.error('Error creating backup:', error);
    showNotification('Error: Unable to create settings backup', false);
  }
}

async function restoreSettings() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          await chrome.storage.local.clear();
          await chrome.storage.local.set(data);
          showNotification('Settings restored successfully', true);
          loadAndDisplayRules();
          loadGlobalOptions();
        } catch (error) {
          console.error('Error parsing backup file:', error);
          showNotification('Error: Unable to restore settings', false);
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  } catch (error) {
    console.error('Error restoring settings:', error);
    showNotification('Error: Unable to restore settings', false);
  }
}

// Initialize
loadUndoRedoStacks();

// Listen for changes from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "optionsChanged") {
    loadGlobalOptions();
  }
});

// Add this function at the top level of your file
function updateGlobalOption(key, value) {
  const checkbox = document.getElementById(key);
  if (checkbox) {
    checkbox.checked = value;
    // Trigger the change event to update UI and show notification
    const event = new Event('change');
    checkbox.dispatchEvent(event);
  }
}

// Update the listener at the end of the file
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "optionsChanged") {
    updateGlobalOption(request.key, request.value);
  }
});

// Add a listener for storage changes as a backup
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    for (let [key, { newValue }] of Object.entries(changes)) {
      if (['extensionEnabled', 'autoBookmark', 'autoCloseTab'].includes(key)) {
        updateGlobalOption(key, newValue);
      }
    }
  }
});

// Add these functions and event listeners at the end of the file

function setCustomShortcut() {
  const shortcutInput = document.getElementById('customShortcut');
  const setShortcutButton = document.getElementById('setShortcut');

  let listening = false;

  setShortcutButton.addEventListener('click', () => {
    if (listening) {
      listening = false;
      setShortcutButton.textContent = 'Set Shortcut';
      return;
    }

    listening = true;
    shortcutInput.value = '';
    setShortcutButton.textContent = 'Cancel';

    const keyHandler = (e) => {
      e.preventDefault();
      const keys = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Meta');
      if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
        keys.push(e.key.toUpperCase());
      }
      shortcutInput.value = keys.join('+');
    };

    const stopListening = () => {
      listening = false;
      setShortcutButton.textContent = 'Set Shortcut';
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('keyup', stopListening);
      
      // Save the custom shortcut
      chrome.storage.local.set({ customShortcut: shortcutInput.value }, () => {
        showNotification('Custom shortcut saved successfully', true);
      });
    };

    document.addEventListener('keydown', keyHandler);
    document.addEventListener('keyup', stopListening);
  });
}

// Load the saved custom shortcut
function loadCustomShortcut() {
  chrome.storage.local.get('customShortcut', (result) => {
    if (result.customShortcut) {
      document.getElementById('customShortcut').value = result.customShortcut;
    }
  });
}

// Call these functions when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // ... (existing code)

  setCustomShortcut();
  loadCustomShortcut();
});

// Add this at the beginning of the file
function checkVersion() {
  chrome.runtime.sendMessage({ action: "getOptionsVersion" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error getting options version:", chrome.runtime.lastError);
      return;
    }
    if (response && response.version) {
      const currentVersion = new URLSearchParams(window.location.search).get('v');
      if (response.version > currentVersion) {
        window.location.href = `options.html?v=${response.version}`;
      }
    } else {
      console.warn("Received invalid response for options version");
    }
  });
}

// Call this function at the start of your initialization
document.addEventListener('DOMContentLoaded', () => {
  checkVersion();
  // Rest of your initialization code...
});
