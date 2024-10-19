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
    <span>Domain</span>
    <span>Contains</span>
    <span>Priority</span>
    <span>Bookmark Folder</span>
    <span>Action</span>
    <span>Options</span>
  `;
  ruleDiv.appendChild(titleRow);

  // Create the rule input row
  const ruleInputRow = document.createElement('div');
  ruleInputRow.className = 'rule';
  ruleInputRow.innerHTML = `
    <input type="text" placeholder="Domain" value="${rule.domain || ''}" data-field="domain">
    <input type="text" placeholder="Contains" value="${rule.contains || ''}" data-field="contains">
    <input type="number" placeholder="Priority" value="${rule.priority || 0}" data-field="priority">
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
      <label><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-field="enabled"> Enable</label>
      <label><input type="checkbox" ${rule.autoExecute ? 'checked' : ''} data-field="autoExecute"> Auto</label>
      <label><input type="checkbox" ${rule.closeTab ? 'checked' : ''} data-field="closeTab"> Close</label>
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
    input.addEventListener('change', () => updateRule(index));
  });

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
  
  chrome.storage.sync.get('rules', (data) => {
    const rules = data.rules || [];
    rules[index] = rule;
    chrome.storage.sync.set({rules}, () => {
      console.log('Rule updated:', rule);
    });
  });
}

function deleteRule(index) {
  chrome.storage.sync.get('rules', ({rules}) => {
    rules.splice(index, 1);
    chrome.storage.sync.set({rules}, displayRules);
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
    rules.push({
      domain: '',
      contains: '',
      priority: 0,
      bookmarkLocation: bookmarkFolders[0].id,
      bookmarkAction: 'doNothing',
      enabled: true,
      autoExecute: true,
      closeTab: false
    });
    chrome.storage.sync.set({rules}, displayRules);
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

function showNotification(message) {
  clearTimeout(notificationTimeout);
  
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = message.includes('enabled') ? 'notification-enabled' : 'notification-disabled';
  notification.style.display = 'block';

  notificationTimeout = setTimeout(() => {
    notification.style.display = 'none';
  }, 2000); // Display for 2 seconds
}

function handleOptionChange(optionId, optionName) {
  const checkbox = document.getElementById(optionId);
  checkbox.addEventListener('change', (e) => {
    saveGlobalOptions();
    const status = e.target.checked ? 'enabled' : 'disabled';
    showNotification(`${optionName} ${status}`);
  });
}

function getFolderName(folderId) {
  const folder = bookmarkFolders.find(f => f.id === folderId);
  return folder ? folder.title : '';
}
