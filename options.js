// Global variables
let bookmarkFolders = [];
let undoStack = [];
let redoStack = [];
let notificationTimeout;

// DOM Elements
const rulesContainer = document.getElementById('rules');
const addRuleButton = document.getElementById('addRule');
const extensionEnabledCheckbox = document.getElementById('extensionEnabled');
const autoBookmarkCheckbox = document.getElementById('autoBookmark');
const autoCloseTabCheckbox = document.getElementById('autoCloseTab');
const notification = document.getElementById('notification');

// Event Listeners
document.addEventListener('DOMContentLoaded', initializePage);
addRuleButton.addEventListener('click', addNewRule);

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
    extensionEnabled: extensionEnabledCheckbox.checked,
    autoBookmark: autoBookmarkCheckbox.checked,
    autoCloseTab: autoCloseTabCheckbox.checked
  };
  chrome.storage.local.set(options);
}

async function loadGlobalOptions() {
  const result = await chrome.storage.local.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab']);
  extensionEnabledCheckbox.checked = result.extensionEnabled ?? true;
  autoBookmarkCheckbox.checked = result.autoBookmark ?? true;
  autoCloseTabCheckbox.checked = result.autoCloseTab ?? true;
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
      <label><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-field="enabled"> Enabled</label>
      <label><input type="checkbox" ${rule.autoExecute ? 'checked' : ''} data-field="autoExecute"> Auto</label>
      <label><input type="checkbox" ${rule.closeTab ? 'checked' : ''} data-field="closeTab"> Close Tab</label>
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
  rulesContainer.innerHTML = '';
  chrome.storage.local.get('rules', (data) => {
    const rules = data.rules || [];
    rules.forEach((rule, index) => {
      const ruleElement = createRuleElement(rule, index);
      rulesContainer.appendChild(ruleElement);
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
  
  notification.textContent = message;
  notification.className = isEnabled ? 'notification-enabled' : 'notification-disabled';
  notification.classList.add('show');
  
  notification.offsetHeight; // Trigger reflow to restart the animation

  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
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
  extensionEnabledCheckbox.checked = data.extensionEnabled ?? true;
  autoBookmarkCheckbox.checked = data.autoBookmark ?? true;
  autoCloseTabCheckbox.checked = data.autoCloseTab ?? false;

  rulesContainer.innerHTML = '';
  rules.forEach((rule, index) => {
    const ruleElement = createRuleElement(rule, index);
    rulesContainer.appendChild(ruleElement);
  });
}

async function initializePage() {
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

  handleOptionChange('extensionEnabled', 'Extension');
  handleOptionChange('autoBookmark', 'Automatic bookmarking');
  handleOptionChange('autoCloseTab', 'Automatic tab closing');
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
      resultsDiv.previousElementSibling.value = folder.title;
      resultsDiv.previousElementSibling.dataset.selectedId = folder.id;
      resultsDiv.style.display = 'none';
      updateRule(Array.from(document.querySelectorAll('.rule')).indexOf(resultsDiv.closest('.rule')));
    });
    resultsDiv.appendChild(folderElement);
  });
}

// Initialize
loadUndoRedoStacks();
