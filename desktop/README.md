# Sticky Lupin Reader

Compact Electron desktop reader with a memo-inspired single-pane shell and an embedded browser view.

## Release

- Current version: `0.3.6`
- Windows portable build output:
  - `release\Sticky Lupin Reader-0.3.6-windows.exe`
- Unpacked app output:
  - `release\win-unpacked\`

## Included

- Frameless memo-style window
- Embedded reader surface backed by `WebContentsView` with persistent session partition
- Reader visibility is held behind the memo-colored stage until ambient CSS is applied
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
    renderer-dom.d.ts
    renderer-site.d.ts
    renderer-state.d.ts
    sticky-desktop.d.ts
  assets/
    sticky-lupin.ico
    sticky-lupin.png
    sticky-lupin.svg
  scripts/
    generate-icon.ps1
  renderer/
    core-utils.ts
    app.js
    app.ts
    index.html
    navigation-state.ts
    reader-controller.ts
    site-actions.ts
    site-config.ts
    site-theme.ts
    styles.css
    ui-panels.ts
    reader-runtime.ts
    window-drag.ts
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

   This now runs a pre-release verification step first:

   ```cmd
   npm run verify:release
   ```

   The app must launch, report a ready window, and exit cleanly before packaging continues.

2. The portable executable will be created in:

   ```text
   C:\Users\GS002\Documents\codex\desktop\release
   ```

## Notes

- TypeScript is now the source of truth for the Electron entry layer:
  - `main.ts`
  - `preload.ts`
- Shared renderer ambient types live in:
  - `types/renderer-site.d.ts`
  - `types/renderer-state.d.ts`
  - `types/renderer-dom.d.ts`
- Renderer TypeScript sources are split and typechecked:
  - entry: `renderer/app.ts`
  - split runtime files:
    - `renderer/core-utils.ts`
    - `renderer/navigation-state.ts`
    - `renderer/reader-controller.ts`
    - `renderer/ui-panels.ts`
    - `renderer/site-actions.ts`
    - `renderer/site-config.ts`
    - `renderer/site-theme.ts`
    - `renderer/reader-runtime.ts`
    - `renderer/window-drag.ts`
  - generated browser scripts:
    - `renderer/app.js`
    - `renderer/reader-runtime.js`
- `npm start` and `release.cmd` both run `npm run build:ts` first.
- `release.cmd` now runs `npm run verify:release` before packaging.
- The app uses the persistent reader partition `persist:sticky-lupin-reader`.
- Dev session data, caches, and logs are redirected into `.runtime/`.
- Release verification uses a separate temporary runtime root in `.runtime-release-verify/`.
- Portable release data is stored next to the exe in `StickyLupinReader-data\`.
- App and packaged release now use `assets/sticky-lupin.ico`.
