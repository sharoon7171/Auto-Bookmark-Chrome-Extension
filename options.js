document.addEventListener('DOMContentLoaded', () => {
  const extensionEnabled = document.getElementById('extensionEnabled');
  const autoBookmark = document.getElementById('autoBookmark');
  const autoCloseTab = document.getElementById('autoCloseTab');

  chrome.storage.sync.get(['extensionEnabled', 'autoBookmark', 'autoCloseTab'], (result) => {
    extensionEnabled.checked = result.extensionEnabled ?? true;
    autoBookmark.checked = result.autoBookmark ?? true;
    autoCloseTab.checked = result.autoCloseTab ?? true;
  });

  [extensionEnabled, autoBookmark, autoCloseTab].forEach(checkbox => {
    checkbox.addEventListener('change', (event) => {
      const option = event.target.id;
      const value = event.target.checked;
      chrome.storage.sync.set({ [option]: value }, () => {
        console.log(`${option} set to ${value}`);
      });
    });
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
  ruleDiv.className = 'rule';
  ruleDiv.innerHTML = `
    <input type="text" placeholder="Domain" value="${rule.domain || ''}" data-field="domain">
    <input type="text" placeholder="Contains" value="${rule.contains || ''}" data-field="contains">
    <input type="number" placeholder="Priority" value="${rule.priority || 0}" data-field="priority">
    <select data-field="bookmarkLocation">
      ${bookmarkFolders.map(folder => `<option value="${folder.id}" ${folder.id === rule.bookmarkLocation ? 'selected' : ''}>${folder.title}</option>`).join('')}
    </select>
    <select data-field="bookmarkAction">
      <option value="doNothing" ${rule.bookmarkAction === 'doNothing' ? 'selected' : ''}>Do Nothing if Bookmarked</option>
      <option value="replace" ${rule.bookmarkAction === 'replace' ? 'selected' : ''}>Replace Bookmark</option>
      <option value="duplicate" ${rule.bookmarkAction === 'duplicate' ? 'selected' : ''}>Add Duplicate Bookmark</option>
    </select>
    <label><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-field="enabled"> Enable Rule</label>
    <label><input type="checkbox" ${rule.autoExecute ? 'checked' : ''} data-field="autoExecute"> Auto Execute</label>
    <label><input type="checkbox" ${rule.closeTab ? 'checked' : ''} data-field="closeTab"> Close Tab</label>
    <button class="deleteRule">Delete Rule</button>
  `;

  ruleDiv.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', () => updateRule(index));
  });

  ruleDiv.querySelector('.deleteRule').addEventListener('click', () => deleteRule(index));

  return ruleDiv;
}

function updateRule(index) {
  chrome.storage.sync.get('rules', ({rules}) => {
    const ruleDiv = document.querySelectorAll('.rule')[index];
    rules[index] = {
      domain: ruleDiv.querySelector('[data-field="domain"]').value,
      contains: ruleDiv.querySelector('[data-field="contains"]').value,
      priority: parseInt(ruleDiv.querySelector('[data-field="priority"]').value) || 0,
      bookmarkLocation: ruleDiv.querySelector('[data-field="bookmarkLocation"]').value,
      bookmarkAction: ruleDiv.querySelector('[data-field="bookmarkAction"]').value,
      enabled: ruleDiv.querySelector('[data-field="enabled"]').checked,
      autoExecute: ruleDiv.querySelector('[data-field="autoExecute"]').checked,
      closeTab: ruleDiv.querySelector('[data-field="closeTab"]').checked
    };
    chrome.storage.sync.set({rules});
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
  rulesContainer.innerHTML = '';
  chrome.storage.sync.get('rules', ({rules = []}) => {
    rules.forEach((rule, index) => {
      rulesContainer.appendChild(createRuleElement(rule, index));
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
