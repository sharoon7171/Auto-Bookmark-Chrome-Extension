// Listen for the custom shortcut
document.addEventListener('keydown', (e) => {
  // Send a message to the background script to check the shortcut
  chrome.runtime.sendMessage({
    action: "checkShortcut",
    event: {
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      key: e.key
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (response && response.matchesShortcut) {
      e.preventDefault();
      chrome.runtime.sendMessage({action: "customShortcut"});
    }
  });
});

// Listen for messages from the background script
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source != window) return;

  if (event.data.type && (event.data.type == "FROM_EXTENSION")) {
    if (event.data.action === "shortcutMatched") {
      // Shortcut matched, prevent default behavior
      event.preventDefault();
      // Notify the background script to execute rules
      window.postMessage({
        type: "FROM_PAGE",
        action: "customShortcut"
      }, "*");
    }
  }
}, false);
