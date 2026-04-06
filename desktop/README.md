# Sticky Lupin Reader

Compact Electron desktop reader with a memo-inspired single-pane shell and an embedded browser view.

## Release

- Current version: `0.2.5`
- Windows portable build output:
  - `release\Sticky Lupin Reader-0.2.5-windows.exe`
- Unpacked app output:
  - `release\win-unpacked\`

## Included

- Frameless memo-style window
- Embedded `webview` browser with persistent session partition
- Double-click collapse / expand on the top strip
- Drag the same top strip to move the window
- Always-on-top toggle from the top strip context menu
- Hidden bookmark, history, and settings drawers
- Compact pastel-yellow single-tone reading surface
- Per-page CSS flattening with Kakao login icon exceptions
- Custom avant-garde app icon in `assets/sticky-lupin.ico`

## Shortcuts

- `Ctrl+B`: bookmarks
- `Ctrl+H`: recent pages
- `Ctrl+,`: settings
- `Ctrl+R`: reload
- `Alt+Left`: back
- `Alt+Right`: forward
- `Ctrl+Shift+P`: always on top
- `Esc`: close drawers

## Structure

```text
desktop/
  main.ts
  main.js
  preload.ts
  preload.js
  package.json
  tsconfig.json
  install.cmd
  run.cmd
  release.cmd
  types/
    sticky-desktop.d.ts
  assets/
    sticky-lupin.ico
    sticky-lupin.png
    sticky-lupin.svg
  scripts/
    generate-icon.ps1
  renderer/
    app.js
    index.html
    styles.css
```

## Run

1. From `C:\Users\GS002\Documents\codex\desktop`, install dependencies:

   ```cmd
   install.cmd
   ```

2. Start the app:

   ```cmd
   run.cmd
   ```

## Build

1. From `C:\Users\GS002\Documents\codex\desktop`, run:

   ```cmd
   release.cmd
   ```

2. The portable executable will be created in:

   ```text
   C:\Users\GS002\Documents\codex\desktop\release
   ```

## Notes

- TypeScript is now the source of truth for the Electron entry layer:
  - `main.ts`
  - `preload.ts`
- `npm start` and `release.cmd` both run `npm run build:ts` first.
- The app uses the persistent webview partition `persist:sticky-lupin-reader`.
- Dev session data, caches, and logs are redirected into `.runtime/`.
- Portable release data is stored next to the exe in `StickyLupinReader-data\`.
- App and packaged release now use `assets/sticky-lupin.ico`.
