# Obsidian Floating Toolbar

A clean and interactive floating formatting toolbar for [Obsidian](https://obsidian.md). 

This plugin seamlessly intercepts your text selections and surfaces a dynamic, highly-customizable popup menu equipped with your favorite commands, formatting shortcuts, and Obsidian integrations. Inspired by the sleek Microsoft Word mini toolbar, it elevates your typing and editing workflow.

## Features
- **Dynamic Popup Activation**: Displays automatically right above your selected text.
- **Glassmorphism Interface**: Gorgeous, blur-backed modern UI that respects your vault's existing theme styling natively.
- **Full Customizability**: A robust settings panel where you can add, remove, and sort exactly which buttons appear.
- **Icon Search Modal**: Choose the perfect icon for your custom button by browsing the full Obsidian built-in Lucide integration library.
- **Command Injection Integration**: Effortlessly map buttons to *ANY* built-in Obsidian command or third-party plugin command completely codelessly via the fuzzy search modal.
- **Versatile Text Modifiers**: Map buttons to apply text wrappers (like `**bold**`) or line-prefixes (like `- bullet lists`). 

## Installation

### Manual Installation
1. Download the latest release (`main.js`, `manifest.json`, `styles.css`) from the Releases tab.
2. Extract the files into your vault's plugin directory: `.obsidian/plugins/obsidian-floating-toolbar/`.
3. Reload Obsidian and enable the plugin in **Settings > Community Plugins**.

## How to build
If you want to build the plugin locally:
1. Clone this repository.
2. Run `npm install` to download the dependencies.
3. Run `npm run build` to compile `main.ts` into `main.js`.

> Note: this is a hobbyist project tailored to optimize digital note-taking flow seamlessly. Feel free to open issues or pull requests.
