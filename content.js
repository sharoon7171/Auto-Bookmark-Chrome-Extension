// Listen for the custom shortcut
document.addEventListener('keydown', (e) => {
  chrome.storage.local.get('customShortcut', (result) => {
    if (result.customShortcut) {
      const keys = result.customShortcut.split('+');
      const matchesShortcut = keys.every(key => {
        if (key === 'Ctrl') return e.ctrlKey;
        if (key === 'Alt') return e.altKey;
        if (key === 'Shift') return e.shiftKey;
        if (key === 'Meta') return e.metaKey;
        return e.key.toUpperCase() === key;
      });

      if (matchesShortcut) {
        e.preventDefault();
        chrome.runtime.sendMessage({action: "customShortcut"});
      }
    }
  });
});
