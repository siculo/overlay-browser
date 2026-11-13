// Operating system abstraction.
//
// Everything that depends on the operating system lives in one module per
// platform; main.js only talks to the interface below. Each module may
// support only part of the features: what it supports is declared in
// `features`, and the app (main process and page) adapts to it.
//
// Interface of a platform module:
//
//   id                 short name, written to the log
//   features           what the module supports:
//     keyboardHook       the low-level keyboard hook (uiohook-napi) works,
//                        so the shortcut is seen even inside games that
//                        read the keyboard exclusively
//     focusRestore       focus is taken from the game when showing and
//                        given back to it when hiding
//     edgeSnap           the overlay adapts edge snapping / maximizing
//                        to the whole screen over fullscreen games
//     appDetect          foregroundApp() can tell which application
//                        (e.g. which game) the overlay was opened over
//   opacity            how the window's translucency is obtained:
//                        'native'  BrowserWindow `opacity` option
//                        'css'     transparent window + CSS opacity on the page
//                        'none'    not available
//   configureApp(app)  called at load time, before the app is ready
//                      (command line switches and the like)
//   init(win)          called once the window has been created
//   beforeShow(win)    called before the window is shown
//   afterShow(win)     called after win.show(), to bring it to the foreground
//   beforeHide(win)    called before the window is hidden
//   foregroundApp()    application whose window had focus when the overlay
//                      was last shown (read by beforeShow), or null:
//                        { pid, exe, path, title, steamAppId }
//                      exe/path: executable (for Windows games run with
//                      Wine/Proton, the game's .exe, not Wine's); title:
//                      window title; steamAppId: Steam AppID, when known.
//                      Each field may be null.
//   ownsForeground(win) true if a window of the overlay is the foreground
//                      window now, false if another one is, null if
//                      unknown: lets main.js ignore a blur that is only a
//                      keyboard focus change (see hideOnBlur)
//
// generic.js implements the interface with Electron alone: the other
// modules start from it and override what they do natively.

function load() {
  switch (process.platform) {
    case 'win32': return require('./win32');
    case 'linux': return require('./linux');
    default: return require('./generic');   // macOS has no module of its own yet
  }
}

module.exports = load();
