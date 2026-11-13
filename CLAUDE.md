# Overlay Browser

Electron app for Windows: an overlay browser, always on top, shown/hidden with a global shortcut (F10 by default) or from the notification area icon. Meant for browsing sites (wikis, calculators) while playing Star Citizen.

- `main.js`: window, preferences (`%APPDATA%\overlay-browser\prefs.json`), tray, shortcut (globalShortcut + `uiohook-napi` hook, required in game), focus via Win32 API (`koffi`).
- `index.html`: Home with editable site list, tabs (one `<webview>` per site), settings.
- `preload.js`: IPC bridge between the page and the main process.
- Build: `npm run dist` (electron-builder, NSIS installer + portable, unsigned) into `dist/`.
