# Auto Bookmark Chrome Extension

## Table of Contents
- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Technical Details](#technical-details)

## Introduction

The **Auto Bookmark Chrome Extension** is a powerful tool designed to enhance your browsing experience by automating the process of bookmarking websites. It allows users to create custom rules for automatically bookmarking pages based on specific domains or URL contents, with options to replace existing bookmarks or add duplicates.

## Features

### 1. Global Options

- **Enable/Disable Extension**: Toggle the entire extension on or off.
- **Enable Automatic Bookmarking**: Turn on/off the automatic bookmarking feature globally.
- **Enable Automatic Tab Closing**: Automatically close tabs after bookmarking (if enabled in the rule).

### 2. Custom Bookmarking Rules

Users can create multiple rules with the following options:

- **URL Domain**: Specify a domain to match (e.g., "google.com").
- **URL Contains**: Define specific text that should be present in the URL.
- **Priority**: Set the priority for rules (higher numbers take precedence).
- **Bookmark Location**: Choose the folder where bookmarks should be saved.
- **Bookmark Action**:
  - *Do Nothing*: Only create a bookmark if it doesn't exist.
  - *Replace*: Update and move existing bookmarks.
  - *Add Duplicate*: Always create a new bookmark.
- **Enable/Disable Rule**: Toggle individual rules on or off.
- **Auto Execute**: Automatically apply the rule when a matching page is loaded.
- **Close Tab**: Close the tab after bookmarking (if global option is enabled).

### 3. Rule Management

- Add new rules
- Edit existing rules
- Delete rules

## Installation

1. Download the extension files or clone the repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the extension directory.

## Usage

1. Click on the extension icon to open the options page.
2. Configure global options as desired.
3. Create and manage bookmarking rules.
4. Browse the web - the extension will automatically apply your rules.

## Configuration

### Global Options

- **Enable Extension**: Master switch for the entire extension.
- **Enable Automatic Bookmarking**: Must be on for automatic bookmarking to occur.
- **Enable Automatic Tab Closing**: Allows tabs to be closed after bookmarking.

### Creating a Rule

1. Click "Add New Rule" on the options page.
2. Fill in the rule details:
   - **Domain** or **Contains**: Specify URL matching criteria.
   - **Priority**: Set the rule's priority (higher numbers take precedence).
   - **Bookmark Location**: Choose the destination folder.
   - **Bookmark Action**: Select the desired behavior.
   - **Enable Rule**: Toggle the rule on/off.
   - **Auto Execute**: Enable/disable automatic execution.
   - **Close Tab**: Choose whether to close the tab after bookmarking.
3. Save the rule.

## Technical Details

### `background.js`

#### `handleTab(tab)`
- Triggered when a tab is updated.
- Retrieves all rules and global settings from storage.
- Filters and sorts rules based on URL match and priority.
- Executes the highest priority matching rule.

#### `executeRule(rule, tab, globalAutoBookmark, globalAutoCloseTab)`
- Implements the logic for each bookmark action:
  - **Do Nothing**: Creates a bookmark only if it doesn't exist.
  - **Replace**: Updates existing bookmark or creates a new one, moving to the specified location.
  - **Add Duplicate**: Always creates a new bookmark.
- Respects global settings for automatic bookmarking and tab closing.

### `options.js`

#### `saveGlobalOptions()`
- Saves global extension settings to Chrome storage.

#### `loadGlobalOptions()`
- Loads and applies global settings from Chrome storage.

#### `createRuleElement(rule, index)`
- Generates the HTML for displaying a rule in the options page.

#### `updateRule(index)`
- Saves changes made to a rule in the options page.

#### `deleteRule(index)`
- Removes a rule from storage and updates the display.

#### `displayRules()`
- Populates the options page with all saved rules.

These functions work together to provide a seamless and customizable bookmarking experience, allowing users to automate their bookmark management based on their browsing habits and preferences.
