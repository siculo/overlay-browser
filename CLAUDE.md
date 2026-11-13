# Overlay Browser

Electron app for Windows and Linux (X11), with macOS planned: an overlay browser, always on top, shown/hidden with a global shortcut (F10 by default) or from the notification area icon. Meant for browsing sites (wikis, calculators) while playing.

- `main.js`: window, preferences (`userData/prefs.json`: `%APPDATA%\overlay-browser` on Windows, `~/.config/overlay-browser` on Linux), tray, shortcut (globalShortcut + `uiohook-napi` hook, required in game). Contains no OS-specific code: it goes through `platform/`.
- `platform/`: one module per OS behind a common interface (described in `platform/index.js`). Each module declares its `features` (keyboardHook, focusRestore, edgeSnap) and how translucency is obtained (`opacity`: native/css/none).
  - `win32.js`: focus and edge snapping via Win32 API (`koffi`).
  - `linux.js`: X11 only (forces `ozone-platform=x11`); focus via `_NET_ACTIVE_WINDOW` through libX11 (`koffi`); opacity via CSS on a transparent window; no edge snapping.
  - `generic.js`: Electron only; base of the other modules and fallback for systems without a module (macOS for now).
- `index.html`: Home with editable site list, tabs (one `<webview>` per site), settings. Applies the CSS opacity when `state.platform.cssOpacity` is set.
- `locales/*.json`: UI texts, one file per language (code = file name); read by `main.js` and passed to the page. Language: user setting, else first available system language, else English.
- `preload.js`: IPC bridge between the page and the main process.
- Build: `npm run dist` (electron-builder, packages for the current OS, unsigned) into `dist/`; `dist:win` (NSIS installer + portable), `dist:linux` (AppImage, built on Linux).
