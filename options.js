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
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});

// Functions
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
  chrome.storage.local.set(options);
}

async function loadGlobalOptions() {
  const result = await chrome.storage.local.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  elements.extensionEnabledCheckbox.checked = result.extensionEnabled ?? true;
  elements.autoBookmarkCheckbox.checked = result.autoBookmark ?? true;
  elements.autoCloseTabCheckbox.checked = result.autoCloseTab ?? false;
}

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
      <label><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-field="enabled"><span>Enabled</span></label>
      <label><input type="checkbox" ${rule.autoExecute ? 'checked' : ''} data-field="autoExecute"><span>Auto</span></label>
      <label><input type="checkbox" ${rule.closeTab ? 'checked' : ''} data-field="closeTab"><span>Close Tab</span></label>
      <button class="deleteRule">Delete</button>
    </div>
  `;

  ruleInputRow.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', () => updateRule(index));
    if (input.type === 'text' || input.type === 'number') {
      input.addEventListener('input', () => updateRule(index));
    }
  });

  const bookmarkSearchInput = ruleInputRow.querySelector('.bookmark-search-input');
  const bookmarkSearchResults = ruleInputRow.querySelector('.bookmark-search-results');

  bookmarkSearchInput.addEventListener('focus', () => {
    bookmarkSearchResults.style.display = 'block';
    bookmarkSearchInput.value = ''; // Clear the input when focused
    updateBookmarkSearchResults(bookmarkSearchResults, '');
  });

  bookmarkSearchInput.addEventListener('input', () => {
    updateBookmarkSearchResults(bookmarkSearchResults, bookmarkSearchInput.value);
  });

  document.addEventListener('click', (e) => {
    if (!bookmarkSearchInput.contains(e.target) && !bookmarkSearchResults.contains(e.target)) {
      bookmarkSearchResults.style.display = 'none';
      // Restore the original value if no selection was made
      bookmarkSearchInput.value = getFolderName(bookmarkSearchInput.dataset.selectedId);
    }
  });

  ruleDiv.appendChild(ruleInputRow);
  ruleDiv.querySelector('.deleteRule').addEventListener('click', () => deleteRule(index));

  return ruleDiv;
}

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
  
  chrome.storage.local.get('rules', (data) => {
    const rules = data.rules || [];
    const oldRule = rules[index];
    undoStack.push({ action: 'update', index, oldRule });
    redoStack = [];
    rules[index] = rule;
    chrome.storage.local.set({rules}, () => {
      console.log('Rule updated:', rule);
      showNotification('Rule updated', true);
    });
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
      showNotification('Rule deleted', false);
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
      showNotification('New rule added', true);
    });
  });
}

function showNotification(message, isEnabled = true) {
  clearTimeout(notificationTimeout);
  
  elements.notification.textContent = message;
  elements.notification.className = isEnabled ? 'notification-enabled' : 'notification-disabled';
  elements.notification.classList.add('show');
  
  elements.notification.offsetHeight; // Trigger reflow to restart the animation

  notificationTimeout = setTimeout(() => {
    elements.notification.classList.remove('show');
  }, 3000);
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

async function initializePage() {
  // Hide content while loading
  elements.contentContainer.style.display = 'none';

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

  await loadAndDisplayRules();
  await loadGlobalOptions();

  handleOptionChange('extensionEnabled', 'Extension');
  handleOptionChange('autoBookmark', 'Automatic bookmarking');
  handleOptionChange('autoCloseTab', 'Automatic tab closing');

  // Show content after everything is loaded
  elements.contentContainer.style.display = 'block';
}

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
      const input = resultsDiv.previousElementSibling;
      input.value = folder.title;
      input.dataset.selectedId = folder.id;
      resultsDiv.style.display = 'none';
      updateRule(Array.from(document.querySelectorAll('.rule')).indexOf(resultsDiv.closest('.rule')));
    });
    resultsDiv.appendChild(folderElement);
  });
}

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
    showNotification('Backup file downloaded successfully', true);
  } catch (error) {
    console.error('Error creating backup:', error);
    showNotification('Error creating backup', false);
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
          showNotification('Error restoring settings: Invalid backup file', false);
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  } catch (error) {
    console.error('Error restoring settings:', error);
    showNotification('Error restoring settings', false);
  }
}

// Initialize
loadUndoRedoStacks();
