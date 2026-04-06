# Sticky Lupin Reader

Sticky-note style popup reader for text-heavy web novel pages.

This repository is a no-build Chrome extension MVP. It loads as an unpacked extension immediately, without Node, pnpm, or a separate bundler.

## What it does

- Opens a compact popup UI from the extension icon.
- Keeps quick bookmarks for web novel sites.
- Extracts the main text from the current tab and re-renders it inside the popup.
- Stores recent pages and reader preferences locally.
- Uses site adapters for Munpia and Novelpia before falling back to generic extraction heuristics.

## Current stack

- Manifest V3
- Plain HTML / CSS / JavaScript
- `chrome.scripting` for on-demand extraction
- `chrome.storage.local` for local persistence

## File structure

```text
manifest.json
popup.html
popup.css
popup.js
```

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder:

   `C:\Users\GS002\Documents\codex\popup`

## How to use

1. Click the extension icon.
2. Use `Read Current Tab` to extract the current page.
3. Switch between `Home`, `Reader`, and `Settings`.
4. Add your own bookmarks from the popup form.

## State restore

- The popup closes when you click outside it, but the reading session is restored on reopen.
- The extension saves:
  - the current reader view
  - the last extracted chapter
  - recent pages
  - reader settings
  - the scroll position for each popup view

## Notes

- The extractor uses explicit site adapters first, then falls back to generic content heuristics.
- Browser internal pages such as `chrome://` cannot be read.
- Some sites may need additional selectors if their DOM structure changes.

## Next improvements

- Add explicit per-site adapter files instead of keeping selectors inline.
- Add bookmark editing and deletion.
- Improve chapter title detection.
- Migrate to React or WXT after a Node runtime is available.
