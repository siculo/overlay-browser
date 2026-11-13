# Overlay Browser

**English** · [Italiano](README-it.md)

A small browser window that always stays on top, even over games running in windowed/borderless windowed mode, and that you show or hide with a single key (**F10** by default).

Handy for keeping sites like wikis, calculators or databases within reach while you play.

## Installation

There are two versions, pick one:

- **`Overlay Browser-Setup-x.y.z.exe`** (recommended): installs it on your PC. No administrator rights are needed, and a Start menu shortcut is created.
- **`Overlay Browser-Portable-x.y.z.exe`**: installs nothing, just run it. It starts up a bit more slowly.

### "Windows protected your PC" warning

The executable is not digitally signed (signing costs money and this is a project among friends), so on first launch Windows shows a blue SmartScreen warning. To continue:

1. click **More info**;
2. click **Run anyway**.

This only happens the first time. If your antivirus flags the file, it is almost certainly a false positive caused by the missing signature.

## Usage

- On startup the window stays hidden: the app waits in the notification area. Press **F10** to show it and press it again to hide it. By default it also hides itself when you click on another window (for example when going back to the game); this can be turned off in the Settings.
- The app **does not appear in the taskbar** or in Alt+Tab: you'll find it in the notification area at the bottom right, next to the clock (black icon with a small white window). If you can't see it, click the **^** arrow and drag the icon onto the taskbar to keep it always visible.
  - **Click** the icon: shows/hides the window.
  - **Right-click**: menu with *Show/Hide*, *Home*, *Settings* and *Quit*.
- To **close** the app use *Quit* from the icon menu (or Alt+F4 while the window is in the foreground).
- **Move** the window by dragging the top bar (the empty space next to the buttons) and **resize** it from the edges. Position and size are remembered.

### Sites

- The top bar has the **Home** button and one button per site. If the buttons don't fit, use the ◀ ▶ arrows or the mouse wheel over the bar.
- Each site works like a tab: when you switch to another site and come back, you'll find the page exactly where you left it.
- When the app is reopened, the last site you were viewing is shown.

From the **Home** page you can manage the list:

- **Add**: type the address in the field at the bottom (`example.com` is enough) and press *Add*. The name is taken automatically from the site's title.
- **Edit**: change a site's address (Enter to save, Esc to cancel).
- **Remove**: removes the site from the list.
- Click a site's name to open it.

### Changing the key

Open the **Settings** with the ⚙ button at the top right (or from the icon menu), *Keyboard* section:

1. click **Change**;
2. press the combination you prefer, for example `Ctrl+Shift+O` (Esc to cancel).

Keys F1–F24 are allowed on their own, or any key together with Ctrl, Alt, Shift or Win. If the combination is already used by another program a message appears and the previous one is kept. *Reset to F10* goes back to the default key.

> **Careful in game:** while you play (for example Star Citizen) the combination also reaches the game, not just the overlay. Pick one that isn't bound to any command in the game, otherwise opening the overlay will also trigger that command.

> **Note for games:** some games in "exclusive" fullscreen cover any window. In that case set the game to *borderless windowed* mode.

## Preferences and uninstalling

Sites, key, window position and last opened site are saved in:

```
%APPDATA%\overlay-browser\prefs.json
```

To start from scratch, close the app and delete that file.

To **uninstall** the installed version: *Windows Settings → Apps → Installed apps → Overlay Browser → Uninstall*. The `%APPDATA%\overlay-browser` folder must be deleted manually if you also want to remove the preferences. The portable version is removed by simply deleting the `.exe` file.

---

## Development

Requires [Node.js](https://nodejs.org/).

```sh
npm install          # install dependencies
npm start            # run the app in development
npm run dist         # build installer and portable version in dist/
npm run dist:installer
npm run dist:portable
```

In IntelliJ, the *Electron (npm start)* and *Electron (debug main)* run configurations are available in the `.run/` folder.
