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

// Global variables
let bookmarkFolders = [];
let undoStack = [];
let redoStack = [];
let notificationTimeout;

// Load undo/redo stacks from storage
async function loadUndoRedoStacks() {
  const result = await chrome.storage.local.get(['undoStack', 'redoStack']);
  undoStack = result.undoStack || [];
  redoStack = result.redoStack || [];
}

// Save undo/redo stacks to storage
function saveUndoRedoStacks() {
  chrome.storage.local.set({ undoStack, redoStack });
}

// Save global options
function saveGlobalOptions() {
  const extensionEnabled = document.getElementById('extensionEnabled').checked;
  const autoBookmark = document.getElementById('autoBookmark').checked;
  const autoCloseTab = document.getElementById('autoCloseTab').checked;
  
  chrome.storage.sync.set({ extensionEnabled, autoBookmark, autoCloseTab });
}

// Load global options
async function loadGlobalOptions() {
  const result = await chrome.storage.sync.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  document.getElementById('extensionEnabled').checked = result.extensionEnabled ?? true;
  document.getElementById('autoBookmark').checked = result.autoBookmark ?? true;
  document.getElementById('autoCloseTab').checked = result.autoCloseTab ?? true;
}

// Create rule element
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
      <label><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-field="enabled"> Enabled</label>
      <label><input type="checkbox" ${rule.autoExecute ? 'checked' : ''} data-field="autoExecute"> Auto</label>
      <label><input type="checkbox" ${rule.closeTab ? 'checked' : ''} data-field="closeTab"> Close Tab</label>
      <button class="deleteRule">Delete</button>
    </div>
  `;

  // Add event listeners for all inputs to save instantly
  ruleInputRow.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', () => updateRule(index));
    if (input.type === 'text' || input.type === 'number') {
      input.addEventListener('input', () => updateRule(index));
    }
  });

  // Add bookmark search functionality
  const bookmarkSearchInput = ruleInputRow.querySelector('.bookmark-search-input');
  const bookmarkSearchResults = ruleInputRow.querySelector('.bookmark-search-results');

  bookmarkSearchInput.addEventListener('focus', () => {
    bookmarkSearchResults.style.display = 'block';
    updateBookmarkSearchResults(bookmarkSearchResults, bookmarkSearchInput.value);
  });

  bookmarkSearchInput.addEventListener('input', () => {
    updateBookmarkSearchResults(bookmarkSearchResults, bookmarkSearchInput.value);
  });

  document.addEventListener('click', (e) => {
    if (!bookmarkSearchInput.contains(e.target) && !bookmarkSearchResults.contains(e.target)) {
      bookmarkSearchResults.style.display = 'none';
    }
  });

  ruleDiv.appendChild(ruleInputRow);

  // Add event listener for delete button
  ruleDiv.querySelector('.deleteRule').addEventListener('click', () => deleteRule(index));

  return ruleDiv;
}

// Update rule
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
      showNotification('Rule updated', true);
    });
  });
}

// Undo function
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

// Redo function
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

// Delete rule
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

// Display rules
function displayRules() {
  const rulesContainer = document.getElementById('rules');
  rulesContainer.innerHTML = '';

  chrome.storage.sync.get('rules', (data) => {
    const rules = data.rules || [];
    rules.forEach((rule, index) => {
      const ruleElement = createRuleElement(rule, index);
      rulesContainer.appendChild(ruleElement);
    });
  });
}

// Add new rule
function addNewRule() {
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
}

// Show notification
function showNotification(message, isEnabled = true) {
  clearTimeout(notificationTimeout);
  
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = isEnabled ? 'notification-enabled' : 'notification-disabled';
  notification.classList.add('show');
  
  notification.offsetHeight; // Trigger reflow to restart the animation

  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Handle option change
function handleOptionChange(optionId, optionName) {
  const checkbox = document.getElementById(optionId);
  checkbox.addEventListener('change', (e) => {
    saveGlobalOptions();
    const status = e.target.checked ? 'enabled' : 'disabled';
    showNotification(`${optionName} ${status}`, e.target.checked);
  });
}

// Get folder name
function getFolderName(folderId) {
  const folder = bookmarkFolders.find(f => f.id === folderId);
  return folder ? folder.title : '';
}

// Clear undo/redo stacks
function clearUndoRedoStacks() {
  undoStack = [];
  redoStack = [];
  saveUndoRedoStacks();
}

// Load and display rules
async function loadAndDisplayRules() {
  const data = await chrome.storage.sync.get(['rules', 'extensionEnabled', 'autoBookmark', 'autoCloseTab']);
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
  rulesContainer.innerHTML = '';
  rules.forEach((rule, index) => {
    const ruleElement = createRuleElement(rule, index);
    rulesContainer.appendChild(ruleElement);
  });
}

// Initialize page
async function initializePage() {
  // Load bookmark folders
  const bookmarkTreeNodes = await chrome.bookmarks.getTree();
  function traverseBookmarks(nodes) {
    for (let node of nodes) {
      if (node.children) {
        bookmarkFolders.push({id: node.id, title: node.title});
        traverseBookmarks(node.children);
      }
    }
  }
  traverseBookmarks(bookmarkTreeNodes);

  // Load and display rules
  await loadAndDisplayRules();

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

  document.getElementById('backupSettings').addEventListener('click', backupSettings);
  document.getElementById('restoreSettings').addEventListener('click', () => {
    document.getElementById('restoreFile').click();
  });
  document.getElementById('restoreFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      restoreSettings(file);
    }
  });
}

// Call initializePage when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Show rule notification
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

// Load undo/redo stacks when the page loads
loadUndoRedoStacks();

function updateBookmarkSearchResults(resultsDiv, searchTerm) {
  resultsDiv.innerHTML = '';
  const matchingFolders = bookmarkFolders.filter(folder => 
    folder.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  matchingFolders.forEach(folder => {
    const folderElement = document.createElement('div');
    folderElement.textContent = folder.title;
    folderElement.className = 'search-result';
    folderElement.addEventListener('click', () => {
      resultsDiv.previousElementSibling.value = folder.title;
      resultsDiv.previousElementSibling.dataset.selectedId = folder.id;
      resultsDiv.style.display = 'none';
      updateRule(Array.from(document.querySelectorAll('.rule')).indexOf(resultsDiv.closest('.rule')));
    });
    resultsDiv.appendChild(folderElement);
  });
}

// Backup settings
function backupSettings() {
  chrome.storage.sync.get(null, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auto_bookmark_settings.json';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Settings backed up successfully', true);
  });
}

// Restore settings
function restoreSettings(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const settings = JSON.parse(event.target.result);
      chrome.storage.sync.set(settings, () => {
        loadAndDisplayRules();
        showNotification('Settings restored successfully', true);
      });
    } catch (error) {
      showNotification('Error restoring settings: Invalid file', false);
    }
  };
  reader.readAsText(file);
}
