document.addEventListener('DOMContentLoaded', function() {
  const manualExecuteButton = document.getElementById('manualExecute');
  const openOptionsButton = document.getElementById('openOptions');

  manualExecuteButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.runtime.sendMessage({action: "manualExecute", url: tabs[0].url});
      window.close(); // Close the popup after sending the message
    });
  });

  openOptionsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});
