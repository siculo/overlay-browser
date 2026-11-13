# Overlay Browser

Electron app for Windows and Linux (X11), with macOS planned: an overlay browser, always on top, shown/hidden with a global shortcut (F10 by default) or from the notification area icon. Meant for browsing sites (wikis, calculators) while playing.

- `main.js`: window, preferences (`userData/prefs.json`: `%APPDATA%\overlay-browser` on Windows, `~/.config/overlay-browser` on Linux), tray, shortcut (globalShortcut + `uiohook-napi` hook, required in game). Contains no OS-specific code: it goes through `platform/`.
- `platform/`: one module per OS behind a common interface (described in `platform/index.js`). Each module declares its `features` (keyboardHook, focusRestore, edgeSnap, appDetect) and how translucency is obtained (`opacity`: native/css/none).
  - `win32.js`: focus, edge snapping and foreground app detection (executable, window title) via Win32 API (`koffi`).
  - `linux.js`: X11 only (forces `ozone-platform=x11`); focus via `_NET_ACTIVE_WINDOW` through libX11 (`koffi`); foreground app from the window properties (`WM_CLASS`, `_NET_WM_PID`) and `/proc` (Wine/Proton `.exe`, Steam AppID); opacity via CSS on a transparent window; no edge snapping.
  - `generic.js`: Electron only; base of the other modules and fallback for systems without a module (macOS for now).
- Site lists (`prefs.lists`): one per application, matched on the normalized executable (`{ exe }`; `{ title }` if unknown; `null` = general list, used when nothing is detected, always present and not removable), created only when the first site is added. The current list is the one chosen by hand (`prefs.pinnedList`) or else the one of the app the overlay was opened over (`foregroundApp()`, sent by `main.js` at every show). The old single list (`sites`) is migrated to the general list, without the sites of the predefined lists.
- `lists/`: predefined lists shipped with the app (`index.json` maps executables to files, see `lists/README.md`); offered on the Home when the app has no list yet.
- `index.html`: Home with all site lists (current one first, others collapsible; edit sites, use a list, remove a list), tabs of the current list (one `<webview>` per site, kept when switching lists), settings (including window opacity, `settings.opacity`, applied by the page via CSS when `state.platform.opacity === 'css'`, natively by `main.js` otherwise, hidden when `'none'`).
- `locales/*.json`: UI texts, one file per language (code = file name); read by `main.js` and passed to the page. Language: user setting, else first available system language, else English.
- `preload.js`: IPC bridge between the page and the main process.
- Build: `npm run dist` (electron-builder, packages for the current OS, unsigned) into `dist/`; `dist:win` (NSIS installer + portable), `dist:linux` (AppImage, built on Linux).
