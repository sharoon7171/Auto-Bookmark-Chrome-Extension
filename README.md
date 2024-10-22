<!DOCTYPE html>
<html>
<head>
  <title>Auto Bookmark Options</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Auto Bookmark</h1>
  <div id="notification"></div>
  <div id="globalOptions">
    <label><input type="checkbox" id="extensionEnabled"> Enable Extension</label>
    <label><input type="checkbox" id="autoBookmark"> Enable Automatic Bookmarking</label>
    <label><input type="checkbox" id="autoCloseTab"> Enable Automatic Tab Closing</label>
  </div>
  <h2>Rules</h2>
  <div class="rules-container" id="rules"></div>
  <button id="addRule">Add New Rule</button>
  <button id="backupSettings">Backup Settings</button>
  <button id="restoreSettings">Restore Settings</button>
  <input type="file" id="restoreFile" style="display: none;">
  <h2>How to Use</h2>
  <div id="howToUseSection">
    <h3>1. Creating Rules</h3>
    <p>Click "Add New Rule" and fill in the following:</p>
    <ul>
      <li><strong>URL Domain:</strong> e.g., "example.com" for matching specific websites</li>
      <li><strong>URL Contains:</strong> e.g., "article" to match URLs containing this word</li>
      <li><strong>Rule Priority:</strong> Higher numbers take precedence (0-100)</li>
      <li><strong>Bookmark Folder:</strong> Select where to save the bookmark</li>
      <li><strong>Action:</strong> Choose how to handle existing bookmarks</li>
    </ul>
    <p>Toggle options:</p>
    <ul>
      <li><strong>Enable:</strong> Activate or deactivate the rule</li>
      <li><strong>Auto:</strong> Apply rule automatically when visiting matching pages</li>
      <li><strong>Close:</strong> Close the tab after bookmarking</li>
    </ul>

    <h3>2. Global Options</h3>
    <p>Use the checkboxes at the top to:</p>
    <ul>
      <li>Enable/disable the entire extension</li>
      <li>Turn on/off automatic bookmarking for all rules</li>
      <li>Enable/disable automatic tab closing for all rules</li>
    </ul>

    <h3>3. Examples</h3>
    <p><strong>News Articles:</strong> Domain "news.com", Contains "article", save to "News" folder, Auto-execute and close tab.</p>
    <p><strong>Shopping:</strong> Domain "amazon.com", Contains "product", save to "Shopping" folder, Don't auto-execute.</p>
    <p><strong>Research:</strong> Contains "pdf" or "research", save to "Research" folder, High priority.</p>

    <h3>4. Manual Execution</h3>
    <p>Click the extension icon and use the "Apply Rules" button to manually execute rules for the current page.</p>

    <h3>5. Keyboard Shortcut</h3>
    <p>Use the keyboard shortcut (set in Chrome's extension settings) to quickly apply rules to the current page.</p>

    <h3>6. Backup and Restore</h3>
    <p>Use the "Backup Settings" and "Restore Settings" buttons to save or load your configuration.</p>
  </div>
  <h2>Keyboard Shortcut</h2>
  <div id="shortcutSection">
    <p>To set up a custom keyboard shortcut for quick access:</p>
    <ol>
      <li>Go to Chrome's Extensions page (chrome://extensions)</li>
      <li>Click on the menu icon (hamburger menu) in the top left</li>
      <li>Select "Keyboard shortcuts" from the menu</li>
      <li>Find "Auto Bookmark" in the list</li>
      <li>Set your desired shortcut for "Apply bookmarking rules"</li>
    </ol>
    <p>Recommended shortcut: Ctrl+Shift+B (Windows/Linux) or Command+Shift+B (Mac)</p>
  </div>
  
  <div class="credits">
    <p>Developed by Sharoon</p>
    <p>Contact: <a href="https://wa.me/923124094969" target="_blank">WhatsApp</a></p>
    <p><a href="https://github.com/sharoon7171/Auto-Bookmark-Chrome-Extension" target="_blank">GitHub Repository</a></p>
  </div>
  
  <script src="options.js"></script>
</body>
</html>

