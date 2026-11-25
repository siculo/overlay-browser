# Overlay Browser

A browser made for gaming: it stays on top of the game, opens and closes with a key combination (**Win+F10** by default, **Super+F10** on Linux, **Cmd+Shift+Space** on macOS) and remembers each game's sites.

Keep wikis, calculators, maps and databases within reach while you play, without leaving the game: when you hide the overlay the keyboard goes back to the game, and the pages stay where you left them.

## Installation

Download the file for your system from the [**Releases**](https://github.com/siculo/overlay-browser/releases) page (the latest one is at the top).

### Windows

There are two versions, pick one:

- **`Overlay Browser-Setup-x.y.z.exe`** (recommended): installs it on your PC. No administrator rights are needed, and a Start menu shortcut is created.
- **`Overlay Browser-Portable-x.y.z.exe`**: installs nothing, just run it. It starts up a bit more slowly.

The executable is not digitally signed (signing costs money and this is a project among friends), so on first launch Windows shows a blue SmartScreen warning, *"Windows protected your PC"*. Click **More info**, then **Run anyway**. This only happens the first time. If your antivirus flags the file, it is almost certainly a false positive caused by the missing signature.

### Linux

Download **`Overlay Browser-x.y.z-x86_64.AppImage`**, make it executable (`chmod +x`, or *Properties → Permissions*) and run it. Some distributions need the `libfuse2` package to run AppImages.

- An **X11** session is required. Under Wayland the app runs through XWayland, but the key combination is not seen while a native Wayland window is active.
- The window's translucency requires a compositing window manager (Cinnamon, KDE, GNOME, and Xfce with compositing enabled): without one the window stays opaque.
- The notification area icon uses AppIndicator: on GNOME the *AppIndicator and KStatusNotifierItem Support* extension is needed. In some environments clicking the icon opens the menu instead of showing the window: use the *Show/Hide* item.

### macOS

Download **`Overlay Browser-x.y.z-arm64.dmg`** (Apple Silicon) or **`-x64.dmg`** (Intel), open it and drag the app into *Applications*. The app is not signed by an Apple developer, so on first launch macOS refuses to open it: go to *System Settings → Privacy & Security* and click **Open Anyway** (or run `xattr -dr com.apple.quarantine "/Applications/Overlay Browser.app"` in the Terminal).

- The app has no Dock icon: it lives in the **menu bar**, at the top right. Clicking the icon opens its menu.
- The window also appears over fullscreen apps and games, without taking the active application's place: when it hides, the keyboard goes back to the game.
- If you choose a function key as the combination, remember that by default F1–F12 control brightness, volume and so on: press them together with **fn**, or enable *System Settings → Keyboard → Use F1, F2, etc. keys as standard function keys*.

## Getting started

- On startup the window stays hidden: the app waits in the notification area (the menu bar on macOS). Press the key combination to show the overlay and press it again to hide it. By default it also hides when you click another window, for example when you go back to the game.
- The app **does not appear in the taskbar** or in Alt+Tab. On Windows its icon is in the notification area, next to the clock: if you can't see it, click the **^** arrow and drag the icon onto the taskbar to keep it always visible.
  - **Click** the icon: shows or hides the overlay.
  - **Right-click**: menu with *Show/Hide*, *Home*, *Settings*, *Hide the overlay when it loses focus* and *Quit*.
- To **close** the app use *Quit* from the icon menu (or Alt+F4 while the overlay is in the foreground).
- **Move** the window by dragging the top bar (the empty space next to the tabs) and **resize** it from the edges. Position and size are remembered.

> **Careful in game:** while you play the key combination also reaches the game, not just the overlay. Pick one that isn't bound to any command in the game, otherwise opening the overlay will also trigger that command.

> **Exclusive fullscreen:** some games in "exclusive" fullscreen cover any window. In that case set the game to *borderless windowed* mode.

## Sites and lists

Each game (more generally, each application) has its **own list of sites**. When you open the overlay over a game, you get that game's tabs; over another game, its own. The **General** list is used when no application is detected, for example over the desktop.

- A game's list is created when you add its first site, and is named after the game.
- The overlay always reopens the list on the last tab you used, with the page where you left it.
- To use another list regardless of the game, click **Use** next to it on the Home: it stays in use until you choose **Back to …**.

### Tabs

The top bar has the fixed tabs **Home**, **Browse** and **Settings**, then one tab per site of the list, and the **+** button to add a site. If the tabs don't fit, use the ◀ ▶ arrows or the mouse wheel over the bar. Tabs can be reordered by dragging them.

- A tab takes its name and icon from its site's page.
- Each tab keeps its page: when you switch to another tab and come back, you'll find the page exactly where you left it.
- Pages you are not looking at are closed after a while to free memory (30 minutes by default, from 5 to 60 in the Settings): opening the tab again reloads the last address visited.

### Managing the lists

**Add a site** with the **+** button, typing its address (`example.com` is enough), or from the field at the bottom of the list on the Home.

The **Home** shows the current list first, then the other ones (click a list to expand it). For each site you can:

- click its name to open it;
- **Edit** its address (Enter to save, Esc to cancel);
- **Remove** it from the list;
- drag it to change its position.

**Remove list** deletes a list together with its sites.

### Browsing

- In the address bar type an address or any text to search for it. In a site's tab, an address of the same site opens in the tab, while another site opens in the **Browse** tab.
- The **Browse** tab opens any page without adding it to a list. The search engine (Google, Bing, DuckDuckGo, Brave Search, Ecosia, Startpage, or a custom search address with `%s` in place of the searched text) and a start page can be chosen in the Settings.
- **Pin** turns the open page, with its history, into a new tab of the list. If the page is already one of the list's tabs, that tab is highlighted.
- Links that a page opens in a new tab open in the list's tab of the same site; if the list has no tab for that site, the overlay asks whether to add it. Right-click a link for **Open link in new tab**.
- Sign-in windows, such as "Sign in with Google", open in a window over the overlay.
- The **…** menu, next to the address, has the page zoom (**−**, **+**, click the percentage to return to 100%; also **Ctrl++**, **Ctrl+-** and **Ctrl+0**, with **⌘** on macOS) and **Delete cookies** for the site, to sign out or start over on it.

### Bookmarks

The *Bookmarks* section at the end of the Home imports and exports sites:

- **Import bookmarks…** adds sites to a list from a browser's bookmarks (Chrome, Edge, Brave, Opera, Vivaldi, Chromium, Firefox, LibreWolf and other similar browsers; Firefox can stay open) or from an HTML bookmark file exported by any browser. Choose bookmarks and folders with the checkboxes, or find them with the search; sites already in the list are skipped. The *Bookmarks* tab of the **+** dialog does the same for the current list. On macOS bookmarks can only be imported from a file: export them from the browser first.
- **Export bookmarks…** saves the sites to an HTML bookmark file, with one folder per list, that any browser can import.

## Settings

Open the **Settings** tab (or *Settings* from the icon menu).

- **Keyboard**: click **Change** and press the combination you prefer, for example `Ctrl+Shift+O` (Esc to cancel). Keys F1–F24 are allowed on their own, or any key together with Ctrl, Alt, Shift or Win (Super on Linux, Cmd on macOS). If the combination is already used by another program a message appears and the previous one is kept. *Reset to default* goes back to the default combination.
- **Behavior**: hide the overlay when it loses focus; check for new versions; start page and search engine of the Browse tab.
- **Appearance**: accent color; fixed tabs with icon and name, or icon only; **window opacity** (from 30% to 100%, i.e. opaque), to glimpse the game behind the overlay.
- **Language**: the app uses the system language if it is available (English, French, German, Italian, Portuguese, Russian, Spanish), otherwise English; you can choose another one here.
- **Memory**: after how long unused pages are closed, and the memory used by the app and by each open page, with buttons to close them.
- **Diagnostics**: the detailed log, useful to report a problem. The log never contains the addresses of the sites or anything about your browsing.

Changes apply immediately.

### New versions

The app checks GitHub for a newer version at startup and then every 6 hours. When there is one, a strip below the navigation bar tells you, with a button that opens its download page. It can be turned off in the Settings (*Behavior*). The Microsoft Store version is updated by the Store instead.

## Preferences and uninstalling

Lists, sites, settings and window position are saved in:

```
%APPDATA%\overlay-browser\prefs.json                       (Windows)
~/.config/overlay-browser/prefs.json                       (Linux)
~/Library/Application Support/overlay-browser/prefs.json   (macOS)
```

The same folder holds the log, `overlay.log`, and the browsing data (cookies, cache). To start from scratch, close the app and delete the folder.

The version installed from the **Microsoft Store** keeps its data in its own package folder instead, where Windows redirects `%APPDATA%`:

```
%LOCALAPPDATA%\Packages\FabrizioDiGiuseppe.overlaybrowser_<id>\LocalCache\Roaming\overlay-browser\
```

So the Store version and the installer/portable version do not share sites and settings: when switching from one to the other you start from scratch (or copy `prefs.json` by hand, with the app closed).

To **uninstall**:

- installed version: *Windows Settings → Apps → Installed apps → Overlay Browser → Uninstall*; delete the `%APPDATA%\overlay-browser` folder too if you also want to remove the preferences;
- Store version: uninstall it like any other app, its data is removed with it;
- portable version: delete the `.exe` file;
- Linux: delete the `.AppImage` file;
- macOS: drag the app from *Applications* to the Trash.

---

## Development

Requires [Node.js](https://nodejs.org/).

```sh
npm install          # install dependencies
npm start            # run the app in development
npm test             # unit tests and UI tests (see test/README.md)
npm run dist         # build the packages for the current system in dist/
npm run dist:win     # Windows: installer and portable version (dist:installer, dist:portable)
npm run dist:store   # Windows: AppX package for the Microsoft Store
npm run dist:linux   # Linux: AppImage (must be built on Linux)
npm run dist:mac     # macOS: DMG for Apple Silicon and Intel (must be built on macOS)
```

Everything that depends on the operating system lives in `platform/`, one module per system (`win32.js`, `linux.js`, `darwin.js`, and `generic.js` with Electron alone, used for the other systems). Each module declares in `features` which functions it supports; the interface is described in `platform/index.js`. A description of the whole code, for developers and AI agents, is in [`AGENTS.md`](AGENTS.md).

Interface texts live in `locales/`, one JSON file per language (the file name is the language code, e.g. `it.json`). To add a language, copy `en.json` and translate its values: the app picks it up automatically. Missing keys fall back to English.

In IntelliJ, the *Electron (npm start)* and *Electron (debug main)* run configurations are available in the `.run/` folder.

## License

[Apache License 2.0](LICENSE).
