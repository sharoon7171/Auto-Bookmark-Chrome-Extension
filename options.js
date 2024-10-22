document.addEventListener('DOMContentLoaded', () => {
  loadGlobalOptions();
  
  handleOptionChange('extensionEnabled', 'Extension');
  handleOptionChange('autoBookmark', 'Automatic bookmarking');
  handleOptionChange('autoCloseTab', 'Automatic tab closing');

  [extensionEnabled, autoBookmark, autoCloseTab].forEach(checkbox => {
    checkbox.addEventListener('change', (event) => {
      const option = event.target.id;
      const value = event.target.checked;
      chrome.storage.sync.set({ [option]: value }, () => {
        console.log(`${option} set to ${value}`);
      });
    });
  });

  loadGlobalOptions();
  
  document.getElementById('extensionEnabled').addEventListener('change', (e) => {
    saveGlobalOptions();
    showNotification(`Extension ${e.target.checked ? 'enabled' : 'disabled'}`, e.target.checked);
  });
  
  document.getElementById('autoBookmark').addEventListener('change', (e) => {
    saveGlobalOptions();
    showNotification(`Automatic bookmarking ${e.target.checked ? 'enabled' : 'disabled'}`, e.target.checked);
  });
  
  document.getElementById('autoCloseTab').addEventListener('change', (e) => {
    saveGlobalOptions();
    showNotification(`Automatic tab closing ${e.target.checked ? 'enabled' : 'disabled'}`, e.target.checked);
  });
});

let bookmarkFolders = [];

// Add these variables at the top of your file
let undoStack = [];
let redoStack = [];

// Load undo/redo stacks from storage
function loadUndoRedoStacks() {
  chrome.storage.local.get(['undoStack', 'redoStack'], (result) => {
    undoStack = result.undoStack || [];
    redoStack = result.redoStack || [];
  });
}

// Save undo/redo stacks to storage
function saveUndoRedoStacks() {
  chrome.storage.local.set({ undoStack, redoStack });
}

// Call this function when the options page loads
loadUndoRedoStacks();

function saveGlobalOptions() {
  const extensionEnabled = document.getElementById('extensionEnabled').checked;
  const autoBookmark = document.getElementById('autoBookmark').checked;
  const autoCloseTab = document.getElementById('autoCloseTab').checked;
  
  chrome.storage.sync.set({ extensionEnabled, autoBookmark, autoCloseTab });
}

function loadGlobalOptions() {
  chrome.storage.sync.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab'], (result) => {
    document.getElementById('extensionEnabled').checked = result.extensionEnabled ?? true;
    document.getElementById('autoBookmark').checked = result.autoBookmark ?? true;
    document.getElementById('autoCloseTab').checked = result.autoCloseTab ?? true;
  });
}

function createRuleElement(rule, index) {
  const ruleDiv = document.createElement('div');
  ruleDiv.className = 'rule-container';
  
  // Add the title row
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

  // Create the rule input row
  const ruleInputRow = document.createElement('div');
  ruleInputRow.className = 'rule';
  ruleInputRow.innerHTML = `
    <input type="text" placeholder="e.g., example.com" value="${rule.domain || ''}" data-field="domain">
    <input type="text" placeholder="e.g., article, product" value="${rule.contains || ''}" data-field="contains">
    <input type="number" placeholder="0-100 (higher = more important)" value="${rule.priority || 0}" data-field="priority" min="0" max="100">
    <div class="bookmark-search">
      <input type="text" placeholder="Search bookmark folders" class="bookmark-search-input" data-field="bookmarkLocation" value="${getFolderName(rule.bookmarkLocation)}" data-selected-id="${rule.bookmarkLocation || ''}">
      <div class="bookmark-search-results"></div>
    </div>
    <select data-field="bookmarkAction">
      <option value="doNothing" ${rule.bookmarkAction === 'doNothing' ? 'selected' : ''}>Do Nothing if Bookmarked</option>
      <option value="replace" ${rule.bookmarkAction === 'replace' ? 'selected' : ''}>Replace Bookmark</option>
      <option value="duplicate" ${rule.bookmarkAction === 'duplicate' ? 'selected' : ''}>Add Duplicate Bookmark</option>
    </select>
    <div class="rule-options">
      <label class="toggle">
        <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-field="enabled">
        <span class="slider"></span>
        <span class="toggle-label">Enable</span>
      </label>
      <label class="toggle">
        <input type="checkbox" ${rule.autoExecute ? 'checked' : ''} data-field="autoExecute">
        <span class="slider"></span>
        <span class="toggle-label">Auto</span>
      </label>
      <label class="toggle">
        <input type="checkbox" ${rule.closeTab ? 'checked' : ''} data-field="closeTab">
        <span class="slider"></span>
        <span class="toggle-label">Close</span>
      </label>
      <button class="deleteRule">Delete</button>
    </div>
  `;
  ruleDiv.appendChild(ruleInputRow);

  const searchInput = ruleInputRow.querySelector('.bookmark-search-input');
  const searchResults = ruleInputRow.querySelector('.bookmark-search-results');

  function updateSearchResults() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredFolders = bookmarkFolders.filter(folder => 
      folder.title.toLowerCase().includes(searchTerm)
    );
    searchResults.innerHTML = filteredFolders.map(folder => 
      `<div class="search-result" data-id="${folder.id}">${folder.title}</div>`
    ).join('');
    searchResults.style.display = filteredFolders.length > 0 ? 'block' : 'none';
  }

  searchInput.addEventListener('focus', () => {
    updateSearchResults();
    searchResults.style.display = 'block';
  });

  searchInput.addEventListener('input', updateSearchResults);

  searchResults.addEventListener('click', (e) => {
    if (e.target.classList.contains('search-result')) {
      const folderId = e.target.dataset.id;
      const folderName = e.target.textContent;
      searchInput.value = folderName;
      searchInput.dataset.selectedId = folderId;
      searchResults.style.display = 'none';
      updateRule(index);
    }
  });

  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!ruleDiv.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });

  ruleDiv.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', () => {
      updateRule(index);
      // Show notification for the changed option
      const fieldName = input.dataset.field;
      const value = input.type === 'checkbox' ? input.checked : input.value;
      showRuleNotification(fieldName, value);
    });
  });

  ruleDiv.querySelector('.deleteRule').addEventListener('click', () => deleteRule(index));

  return ruleDiv;
}

// Modify the updateRule function
function updateRule(index) {
  const ruleDiv = document.querySelectorAll('.rule')[index];
  const rule = {};
  ruleDiv.querySelectorAll('[data-field]').forEach(input => {
    if (input.type === 'checkbox') {
      rule[input.dataset.field] = input.checked;
    } else if (input.dataset.field === 'bookmarkLocation') {
      rule[input.dataset.field] = input.dataset.selectedId;
    } else {
      rule[input.dataset.field] = input.value;
    }
  });
  
  chrome.storage.sync.get('rules', (data) => {
    const rules = data.rules || [];
    const oldRule = rules[index];
    undoStack.push({ action: 'update', index, oldRule });
    redoStack = [];
    rules[index] = rule;
    chrome.storage.sync.set({rules}, () => {
      console.log('Rule updated:', rule);
    });
  });
}

// Add these functions for undo and redo
function undo() {
  if (undoStack.length === 0) return;
  
  const action = undoStack.pop();
  chrome.storage.sync.get('rules', (data) => {
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
    
    chrome.storage.sync.set({rules}, displayRules);
  });
}

function redo() {
  if (redoStack.length === 0) return;
  
  const action = redoStack.pop();
  chrome.storage.sync.get('rules', (data) => {
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
    
    chrome.storage.sync.set({rules}, displayRules);
  });
}

function deleteRule(index) {
  chrome.storage.sync.get('rules', ({rules}) => {
    undoStack.push({ action: 'delete', index, rule: rules[index] });
    redoStack = [];
    rules.splice(index, 1);
    chrome.storage.sync.set({rules}, () => {
      displayRules();
      showNotification('Rule deleted', false);
    });
  });
}

function displayRules() {
  const rulesContainer = document.getElementById('rules');
  rulesContainer.innerHTML = ''; // Clear existing rules

  chrome.storage.sync.get('rules', (data) => {
    const rules = data.rules || [];
    rules.forEach((rule, index) => {
      const ruleElement = createRuleElement(rule, index);
      rulesContainer.appendChild(ruleElement);
    });
  });
}

document.getElementById('addRule').addEventListener('click', () => {
  chrome.storage.sync.get('rules', ({rules = []}) => {
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
    chrome.storage.sync.set({rules}, () => {
      displayRules();
      showNotification('New rule added', true);
    });
  });
});

document.querySelectorAll('#globalOptions input').forEach(input => {
  input.addEventListener('change', saveGlobalOptions);
});

chrome.bookmarks.getTree(bookmarkTreeNodes => {
  function traverseBookmarks(nodes) {
    for (let node of nodes) {
      if (node.children) {
        bookmarkFolders.push({id: node.id, title: node.title});
        traverseBookmarks(node.children);
      }
    }
  }
  traverseBookmarks(bookmarkTreeNodes);
  loadGlobalOptions();
  displayRules();
});

let notificationTimeout;

function showNotification(message, isEnabled = true) {
    clearTimeout(notificationTimeout);
    
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = isEnabled ? 'notification-enabled' : 'notification-disabled';
    notification.classList.add('show');
    
    // Trigger reflow to restart the animation
    notification.offsetHeight;

    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 3000); // Display for 3 seconds
}

function handleOptionChange(optionId, optionName) {
  const checkbox = document.getElementById(optionId);
  checkbox.addEventListener('change', (e) => {
    saveGlobalOptions();
    const status = e.target.checked ? 'enabled' : 'disabled';
    showNotification(`${optionName} ${status}`, e.target.checked);
  });
}

function getFolderName(folderId) {
  const folder = bookmarkFolders.find(f => f.id === folderId);
  return folder ? folder.title : '';
}

// Add event listener for Ctrl+Z (undo) and Ctrl+Y (redo)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});

// Add this function to clear undo/redo stacks
function clearUndoRedoStacks() {
  undoStack = [];
  redoStack = [];
  saveUndoRedoStacks();
}

// Call this function when applying changes or when the user confirms they want to clear the history
document.getElementById('applyChanges').addEventListener('click', clearUndoRedoStacks);

// Function to load and display rules
function loadAndDisplayRules() {
  chrome.storage.sync.get(['rules', 'extensionEnabled', 'autoBookmark', 'autoCloseTab'], (data) => {
    const rules = data.rules || [];
    const extensionEnabled = data.extensionEnabled ?? true;
    const autoBookmark = data.autoBookmark ?? true;
    const autoCloseTab = data.autoCloseTab ?? false;

    // Set global options
    document.getElementById('extensionEnabled').checked = extensionEnabled;
    document.getElementById('autoBookmark').checked = autoBookmark;
    document.getElementById('autoCloseTab').checked = autoCloseTab;

    // Display rules
    const rulesContainer = document.getElementById('rules');
    rulesContainer.innerHTML = ''; // Clear existing rules
    rules.forEach((rule, index) => {
      const ruleElement = createRuleElement(rule, index);
      rulesContainer.appendChild(ruleElement);
    });
  });
}

// Function to initialize the page
function initializePage() {
  // Load bookmark folders
  chrome.bookmarks.getTree(bookmarkTreeNodes => {
    function traverseBookmarks(nodes) {
      for (let node of nodes) {
        if (node.children) {
          bookmarkFolders.push({id: node.id, title: node.title});
          traverseBookmarks(node.children);
        }
      }
    }
    traverseBookmarks(bookmarkTreeNodes);

    // After loading bookmark folders, load and display rules
    loadAndDisplayRules();
  });

  // Set up event listeners
  document.getElementById('addRule').addEventListener('click', addNewRule);
  document.querySelectorAll('#globalOptions input').forEach(input => {
    input.addEventListener('change', saveGlobalOptions);
  });

  // Set up undo/redo keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    } else if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  });
}

// Call initializePage when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Add this new function to show notifications for rule changes
function showRuleNotification(fieldName, value) {
  let message;
  let isEnabled = true;

  switch (fieldName) {
    case 'domain':
      message = `URL Domain ${value ? 'added' : 'removed'}`;
      isEnabled = !!value;
      break;
    case 'contains':
      message = `URL Contains ${value ? 'added' : 'removed'}`;
      isEnabled = !!value;
      break;
    case 'priority':
      message = `Rule Priority set to ${value}`;
      isEnabled = true;
      break;
    case 'bookmarkLocation':
      message = `Bookmark Folder updated`;
      isEnabled = true;
      break;
    case 'bookmarkAction':
      message = `Bookmark Action set to "${value}"`;
      isEnabled = true;
      break;
    case 'enabled':
      message = `Rule ${value ? 'enabled' : 'disabled'}`;
      isEnabled = value;
      break;
    case 'autoExecute':
      message = `Auto Execute ${value ? 'enabled' : 'disabled'}`;
      isEnabled = value;
      break;
    case 'closeTab':
      message = `Close Tab ${value ? 'enabled' : 'disabled'}`;
      isEnabled = value;
      break;
    default:
      message = `Rule option updated`;
      isEnabled = true;
  }
  showNotification(message, isEnabled);
}

