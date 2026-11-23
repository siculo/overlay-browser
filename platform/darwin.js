// macOS platform. See index.js for the interface.
//
// - The overlay is a panel (BrowserWindow `type: 'panel'`, an NSPanel with
//   NSWindowStyleMaskNonactivatingPanel): it takes the keyboard without
//   activating the app, so the game stays the active application while the
//   overlay is open and gets the keyboard back by itself when it is hidden.
//   A panel is also the only kind of window shown over fullscreen apps,
//   which on macOS live in a Space of their own.
// - The app has no Dock icon (LSUIElement in the packaged app, app.dock.hide()
//   when run from the sources): the menu bar icon is used instead.
// - The keyboard hook is not used: globalShortcut (RegisterEventHotKey)
//   also works over fullscreen games, while uiohook-napi would require the
//   Accessibility permission.
// - The application the overlay was opened over is the frontmost one
//   (NSWorkspace, through the Objective-C runtime with koffi). Window titles
//   would require the Screen Recording permission: the app's name is used
//   as title instead.
// - The overlay stays just below the menus (topLevel), not at the
//   screen saver level: the menus of the menu bar open over it.
// - Memory is the physical footprint of each process (proc_pid_rusage), the
//   value shown by Activity Monitor.

const { app, Menu } = require('electron');
const generic = require('./generic');
const { hostedApp } = require('./hosted');

// ---------- Objective-C runtime ----------

const objc = (() => {
  try {
    const koffi = require('koffi');
    const lib = koffi.load('/usr/lib/libobjc.A.dylib');
    // objc_msgSend must be called with the exact prototype of the method:
    // one declaration per return type.
    return {
      getClass: lib.func('void *objc_getClass(const char *)'),
      sel: lib.func('void *sel_registerName(const char *)'),
      send: lib.func('objc_msgSend', 'void *', ['void *', 'void *']),
      sendInt: lib.func('objc_msgSend', 'int', ['void *', 'void *']),
      sendString: lib.func('objc_msgSend', 'const char *', ['void *', 'void *']),
      poolPush: lib.func('void *objc_autoreleasePoolPush()'),
      poolPop: lib.func('void objc_autoreleasePoolPop(void *)'),
    };
  } catch (err) {
    console.error('Objective-C runtime not available, application detection disabled:', err);
    return null;
  }
})();

// Frontmost application: { pid, exe, path, title }, or null.
function frontmostApp() {
  const { getClass, sel, send, sendInt, sendString } = objc;
  // The returned objects are autoreleased: freed when the pool is popped,
  // after their strings have been copied into JavaScript.
  const pool = objc.poolPush();
  try {
    const running = send(send(getClass('NSWorkspace'), sel('sharedWorkspace')), sel('frontmostApplication'));
    if (!running) return null;
    const text = (nsString) => (nsString ? sendString(nsString, sel('UTF8String')) : null);
    const url = send(running, sel('executableURL'));
    const path = url ? text(send(url, sel('path'))) : null;
    return {
      pid: sendInt(running, sel('processIdentifier')),
      exe: path ? path.slice(path.lastIndexOf('/') + 1) : null,
      path,
      title: text(send(running, sel('localizedName'))),
    };
  } finally {
    objc.poolPop(pool);
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';   // exists, but belongs to another user
  }
}

let previousApp = null;   // application that was frontmost when the overlay was shown

function beforeShow() {
  const front = frontmostApp();
  // Only remember another application.
  if (front && front.pid !== process.pid) previousApp = front;
}

function foregroundApp() {
  if (!previousApp || !isRunning(previousApp.pid)) return null;
  // The app's name is also its title (the window title is not read).
  // A runtime (Java): the application from its name only (the command line is not read).
  const hosted = hostedApp(previousApp.exe, null, previousApp.title);
  return {
    ...previousApp,
    exe: hosted?.exe ?? previousApp.exe,
    name: hosted?.name ?? previousApp.title,
    steamAppId: null,   // not readable from another process
  };
}

// ---------- memory ----------

const libSystem = (() => {
  try {
    const koffi = require('koffi');
    const lib = koffi.load('/usr/lib/libSystem.B.dylib');
    return { proc_pid_rusage: lib.func('int proc_pid_rusage(int, int, _Out_ uint8_t *)') };
  } catch (err) {
    console.error('libproc not available:', err);
    return null;
  }
})();

const RUSAGE_INFO_V2 = 2;
const PHYS_FOOTPRINT_OFFSET = 72;   // ri_phys_footprint in struct rusage_info_v2

// Physical footprint of a process in bytes, null if it cannot be read.
function footprintOf(pid) {
  const buf = Buffer.alloc(256);   // larger than rusage_info_v2
  if (libSystem.proc_pid_rusage(pid, RUSAGE_INFO_V2, buf) !== 0) return null;
  return Number(buf.readBigUInt64LE(PHYS_FOOTPRINT_OFFSET));
}

// Footprint of every process; if even one cannot be read, the working set
// of all of them (mixing the two would make the total meaningless).
function memoryUsage(metrics) {
  const footprint = libSystem ? metrics.map((m) => footprintOf(m.pid)) : [null];
  if (footprint.some((v) => v === null)) return generic.memoryUsage(metrics);
  return { kind: 'footprint', bytes: new Map(metrics.map((m, i) => [m.pid, footprint[i]])) };
}

// ---------- module ----------

module.exports = {
  ...generic,
  id: objc ? 'darwin' : 'darwin-basic',
  features: { ...generic.features, focusRestore: true, appDetect: !!objc },
  opacity: 'native',
  windowOptions: { type: 'panel' },
  // Just below the menus (NSPopUpMenuWindowLevel, 101), so that the menus of
  // the menu bar and the context menus of other apps open over the overlay;
  // still above the menu bar (24) and the Dock (20).
  topLevel: ['pop-up-menu', -1],
  // F1–F12 are media keys by default (F10 mutes the volume).
  defaultShortcut: 'Command+Shift+Space',
  configureApp() {
    app.dock?.hide();
  },
  init() {
    // Without the Edit menu the standard shortcuts (Cmd+C, Cmd+V, Cmd+A...)
    // do not work in text fields. No Window menu: Cmd+W would close the
    // overlay, and with it the app.
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]));
  },
  // The panel becomes the key window when shown, without activating the app.
  afterShow() {},
  memoryUsage,
  // No bookmarkStores: macOS does not let an app read other apps' data
  // (the browsers' too) without Full Disk Access. Bookmarks are imported
  // from an HTML file exported by the browser.
  ...(objc ? { beforeShow, foregroundApp } : {}),
};
