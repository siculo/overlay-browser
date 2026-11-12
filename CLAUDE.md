# Overlay Browser

App Electron per Windows: un browser in overlay, sempre in primo piano, che si mostra/nasconde con una scorciatoia globale (default F10) o dall'icona nell'area di notifica. Pensata per consultare siti (wiki, calcolatori) mentre si gioca a Star Citizen.

- `main.js`: finestra, preferenze (`%APPDATA%\overlay-browser\prefs.json`), tray, scorciatoia (globalShortcut + hook `uiohook-napi`, necessario in gioco), focus via API Win32 (`koffi`).
- `index.html`: Home con elenco siti modificabile, tab (un `<webview>` per sito), impostazioni.
- `preload.js`: ponte IPC tra pagina e processo principale.
- Build: `npm run dist` (electron-builder, installer NSIS + portable, non firmati) in `dist/`.
