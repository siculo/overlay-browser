# Overlay Browser

**English** · [Italiano](README-it.md)

A small browser window that always stays on top, even over games running in windowed/borderless windowed mode, and that you show or hide with a key combination (**Win+F10** by default, **Cmd+Shift+Space** on macOS).

Handy for keeping sites like wikis, calculators or databases within reach while you play.

## Installation

Download the file for your system from the [**Releases**](https://github.com/siculo/overlay-browser/releases) page (the latest one is at the top).

On Windows there are two versions, pick one:

- **`Overlay Browser-Setup-x.y.z.exe`** (recommended): installs it on your PC. No administrator rights are needed, and a Start menu shortcut is created.
- **`Overlay Browser-Portable-x.y.z.exe`**: installs nothing, just run it. It starts up a bit more slowly.

### "Windows protected your PC" warning

The executable is not digitally signed (signing costs money and this is a project among friends), so on first launch Windows shows a blue SmartScreen warning. To continue:

1. click **More info**;
2. click **Run anyway**.

This only happens the first time. If your antivirus flags the file, it is almost certainly a false positive caused by the missing signature.

### Linux

On Linux there is **`Overlay Browser-x.y.z-x86_64.AppImage`**: make it executable (`chmod +x`, or *Properties → Permissions*) and run it. Some distributions need the `libfuse2` package to run AppImages.

- An **X11** session is required. Under Wayland the app runs through XWayland, but the shortcut is not seen while a native Wayland window is active.
- The window's translucency requires a compositing window manager (Cinnamon, KDE, GNOME, and Xfce with compositing enabled): without one the window stays opaque.
- The notification area icon uses AppIndicator: on GNOME the *AppIndicator and KStatusNotifierItem Support* extension is needed. In some environments clicking the icon opens the menu instead of showing the window: use the *Show/Hide* item.

### macOS

On macOS there is **`Overlay Browser-x.y.z-arm64.dmg`** (Apple Silicon) or **`-x64.dmg`** (Intel): open it and drag the app into *Applications*. The app is not signed by an Apple developer, so on first launch macOS refuses to open it: go to *System Settings → Privacy & Security* and click **Open Anyway** (or run `xattr -dr com.apple.quarantine "/Applications/Overlay Browser.app"` in the Terminal).

- The app has no Dock icon: it lives in the **menu bar**, at the top right. Clicking the icon opens its menu.
- The window also appears over fullscreen apps and games, without taking the active application's place: when it hides, the keyboard goes back to the game.
- The default combination is **Cmd+Shift+Space**. If you choose a function key, remember that by default F1–F12 control brightness, volume and so on: press them together with **fn**, or enable *System Settings → Keyboard → Use F1, F2, etc. keys as standard function keys*.

## Usage

- On startup the window stays hidden: the app waits in the notification area. Press **Win+F10** (Super+F10 on Linux, Cmd+Shift+Space on macOS) to show it and press it again to hide it. By default it also hides itself when you click on another window (for example when going back to the game); this can be turned off in the Settings.
- The app **does not appear in the taskbar** or in Alt+Tab: you'll find it in the notification area at the bottom right, next to the clock (black icon with a small white window). If you can't see it, click the **^** arrow and drag the icon onto the taskbar to keep it always visible.
  - **Click** the icon: shows/hides the window.
  - **Right-click**: menu with *Show/Hide*, *Home*, *Settings* and *Quit*.
- To **close** the app use *Quit* from the icon menu (or Alt+F4 while the window is in the foreground).
- **Move** the window by dragging the top bar (the empty space next to the buttons) and **resize** it from the edges. Position and size are remembered.

### Sites

- The top bar has the fixed tabs **Home**, **Browse** and **Settings**, one tab per site, and the **+** button to add a site. If the tabs don't fit, use the ◀ ▶ arrows or the mouse wheel over the bar. Tabs can be reordered by dragging them. In the Settings (*Appearance*) you can choose whether the fixed tabs show their icon and name or the icon only.
- Each site works like a tab: when you switch to another site and come back, you'll find the page exactly where you left it.
- Pages you are not looking at are closed after a while to free memory (30 minutes by default, from 5 to 60 in the Settings): opening the tab again reloads the last address visited.
- When the overlay is reopened, the last tab you were viewing is shown.

From the **Home** page you can manage the list:

- **Add**: type the address in the field at the bottom (`example.com` is enough) and press *Add*. The name is taken automatically from the site's title.
- **Edit**: change a site's address (Enter to save, Esc to cancel).
- **Remove**: removes the site from the list.
- Click a site's name to open it.

### Free browsing

The **Browse** tab opens any page without adding it to the list. In its address field type an address (`example.com` is enough) or any text to search for it, with Google by default: the search engine (Google, Bing, DuckDuckGo, Brave Search, Ecosia, Startpage, or a custom search address with `%s` in place of the searched text) and a start page can be chosen in the Settings.

**Pin**, in the navigation bar of the Browse tab and of the sites' tabs, turns the open page, with its history, into a new tab of the list. If the page is already one of the list's tabs, that tab is highlighted.

Use **−** or **+** in the **…** menu to change the page zoom. Click the percentage to return to 100%. The keyboard shortcuts are **Ctrl++**, **Ctrl+-**, and **Ctrl+0** (also with **⌘** on macOS).

### Bookmarks

- **Import**: *Import bookmarks…*, in the *Bookmarks* section at the end of the Home, or the *Bookmarks* tab of the **+** dialog, adds sites from a browser's bookmarks (Chrome, Edge, Brave, Opera, Vivaldi, Chromium, Firefox, LibreWolf and other similar browsers; Firefox can stay open) or from an HTML bookmark file exported by any browser. Choose bookmarks and folders with the checkboxes, or find them with the search; sites already in the list are skipped. On macOS bookmarks can only be imported from a file: export them from the browser first.
- **Export**: *Export bookmarks…* saves the sites of the lists to an HTML bookmark file, with one folder per list, that any browser can import.

### Changing the key

Open the **Settings** tab (or *Settings* from the icon menu), *Keyboard* section:

1. click **Change**;
2. press the combination you prefer, for example `Ctrl+Shift+O` (Esc to cancel).

Keys F1–F24 are allowed on their own, or any key together with Ctrl, Alt, Shift or Win (Super on Linux, Cmd on macOS). If the combination is already used by another program a message appears and the previous one is kept. *Reset to default* goes back to the default combination.

### Transparency

The window is slightly translucent, so you can glimpse the game behind it. To change how much, open the **Settings**, *Appearance* section, and move the *Window opacity* slider (from 30% to 100%, i.e. opaque). The change applies immediately.

### Language

The app uses the system language, if it is among the available ones (English, Italian, French, German, Portuguese, Russian and Spanish); otherwise it uses English. To pick another one open the **Settings**, *Language* section: you can choose *System language* or one of the app's languages. The change applies immediately.

> **Careful in game:** while you play (for example Star Citizen) the combination also reaches the game, not just the overlay. Pick one that isn't bound to any command in the game, otherwise opening the overlay will also trigger that command.

> **Note for games:** some games in "exclusive" fullscreen cover any window. In that case set the game to *borderless windowed* mode.

## Preferences and uninstalling

Sites, key, language, window position and last opened site are saved in:

```
%APPDATA%\overlay-browser\prefs.json         (Windows)
~/.config/overlay-browser/prefs.json         (Linux)
~/Library/Application Support/overlay-browser/prefs.json   (macOS)
```

The version installed from the **Microsoft Store** keeps its preferences in its own package folder instead, where Windows redirects `%APPDATA%`:

```
%LOCALAPPDATA%\Packages\FabrizioDiGiuseppe.overlaybrowser_<id>\LocalCache\Roaming\overlay-browser\prefs.json
```

So the Store version and the installer/portable version do not share sites and settings: when switching from one to the other you start from scratch (or copy `prefs.json` by hand, with the app closed).

To start from scratch, close the app and delete that file.

To **uninstall** the installed version: *Windows Settings → Apps → Installed apps → Overlay Browser → Uninstall*. The `%APPDATA%\overlay-browser` folder must be deleted manually if you also want to remove the preferences; the Store version removes its preferences together with the app. The portable version is removed by simply deleting the `.exe` file, the AppImage by deleting the `.AppImage` file, the macOS app by dragging it from *Applications* to the Trash.

---

## Development

Requires [Node.js](https://nodejs.org/).

```sh
npm install          # install dependencies
npm start            # run the app in development
npm run dist         # build the packages for the current system in dist/
npm run dist:win     # Windows: installer and portable version
npm run dist:installer
npm run dist:portable
npm run dist:linux   # Linux: AppImage (must be built on Linux)
npm run dist:mac     # macOS: DMG for Apple Silicon and Intel (must be built on macOS)
```

Everything that depends on the operating system lives in `platform/`, one module per system (`win32.js`, `linux.js`, `darwin.js`, and `generic.js` with Electron alone, used for the other systems). Each module declares in `features` which functions it supports; the interface is described in `platform/index.js`.

Interface texts live in `locales/`, one JSON file per language (the file name is the language code, e.g. `it.json`). To add a language, copy `en.json` and translate its values: the app picks it up automatically. Missing keys fall back to English.

In IntelliJ, the *Electron (npm start)* and *Electron (debug main)* run configurations are available in the `.run/` folder.
