// Linux platform, X11 only. See index.js for the interface.
//
// - The app always runs as an X11 client (XWayland under a Wayland session):
//   native Wayland does not allow global shortcuts, keyboard hooks, choosing
//   the window position or keeping it above the others.
// - The `opacity` BrowserWindow option is not supported on Linux: the window
//   is transparent and the page applies the opacity via CSS (needs a
//   compositing window manager, otherwise the background stays opaque).
// - Focus goes through the window manager with _NET_ACTIVE_WINDOW (EWMH),
//   sent through libX11 (koffi) as a "pager" request, which window managers
//   grant even under focus stealing prevention. The window that had focus
//   before the overlay (e.g. the game) is read from the same property and
//   activated again when hiding.
//
// - The same window tells which application the overlay was opened over:
//   WM_CLASS (steam_app_<AppID> for Steam games run with Proton), title,
//   and through _NET_WM_PID the process: executable, command line (for
//   Wine/Proton the game's .exe) and environment (SteamAppId).
// - Whether the mouse cursor is hidden: from its image, through XFixes.
//
// Requests are sent to the root window: they never fail, even if the
// window they refer to no longer exists (the window manager ignores them).
// The only exception is reading the properties of the window the overlay
// was opened over, which may have been closed meanwhile: there Xlib's
// default error handler, which would end the process, is replaced by one
// that ignores errors, just for the duration of the reading.

const fs = require('fs');
const generic = require('./generic');
const { isRuntime, hostedApp } = require('./hosted');

const CLIENT_MESSAGE = 33;
const SUBSTRUCTURE_NOTIFY_MASK = 1 << 19;
const SUBSTRUCTURE_REDIRECT_MASK = 1 << 20;
const XA_CARDINAL = 6;
const XA_STRING = 31;
const XA_WM_NAME = 39;
const XA_WM_CLASS = 67;
const XA_WINDOW = 33;
const ANY_PROPERTY_TYPE = 0;
const SOURCE_PAGER = 2;   // _NET_ACTIVE_WINDOW source indication

const x11 = (() => {
  if (!process.env.DISPLAY) return null;
  try {
    const koffi = require('koffi');
    const lib = koffi.load('libX11.so.6');
    koffi.opaque('Display');
    // XClientMessageEvent, padded to the size of the XEvent union (24 longs).
    koffi.struct('XClientMessageEvent', {
      type: 'int',
      serial: 'unsigned long',
      send_event: 'int',
      display: 'Display *',
      window: 'unsigned long',
      message_type: 'unsigned long',
      format: 'int',
      data: koffi.array('long', 5),
      pad: koffi.array('long', 12),
    });
    const api = {
      koffi,
      XOpenDisplay: lib.func('Display *XOpenDisplay(const char *)'),
      XDefaultRootWindow: lib.func('unsigned long XDefaultRootWindow(Display *)'),
      XInternAtom: lib.func('unsigned long XInternAtom(Display *, const char *, int)'),
      XGetWindowProperty: lib.func('int XGetWindowProperty(Display *, unsigned long, unsigned long, long, long, int, ' +
        'unsigned long, _Out_ unsigned long *, _Out_ int *, _Out_ unsigned long *, _Out_ unsigned long *, _Out_ void **)'),
      XSendEvent: lib.func('int XSendEvent(Display *, unsigned long, int, long, XClientMessageEvent *)'),
      XFlush: lib.func('int XFlush(Display *)'),
      XFree: lib.func('int XFree(void *)'),
      XSetErrorHandler: lib.func('void *XSetErrorHandler(void *)'),
    };
    // Error handler that ignores errors (see withoutXErrors), registered once.
    const ErrorHandler = koffi.proto('int XErrorHandler(Display *, void *)');
    api.ignoreErrors = koffi.register(() => 0, koffi.pointer(ErrorHandler));
    // A connection of our own, separate from Chromium's.
    api.display = api.XOpenDisplay(null);
    if (!api.display) throw new Error(`cannot open display ${process.env.DISPLAY}`);
    api.root = api.XDefaultRootWindow(api.display);
    api.NET_ACTIVE_WINDOW = api.XInternAtom(api.display, '_NET_ACTIVE_WINDOW', 0);
    api.NET_WM_NAME = api.XInternAtom(api.display, '_NET_WM_NAME', 0);
    api.NET_WM_PID = api.XInternAtom(api.display, '_NET_WM_PID', 0);
    api.UTF8_STRING = api.XInternAtom(api.display, 'UTF8_STRING', 0);
    // XFixes, for the cursor image (see cursorState): optional.
    try {
      const xfixes = koffi.load('libXfixes.so.3');
      koffi.struct('XFixesCursorImage', {
        x: 'short', y: 'short', width: 'unsigned short', height: 'unsigned short',
        xhot: 'unsigned short', yhot: 'unsigned short', cursor_serial: 'unsigned long',
        pixels: 'void *', atom: 'unsigned long', name: 'void *',
      });
      api.XFixesGetCursorImage = xfixes.func('void *XFixesGetCursorImage(Display *)');
    } catch (err) {
      console.error('XFixes not available, cursor state unknown:', err);
    }
    return api;
  } catch (err) {
    console.error('X11 API not available, using simplified focus handling:', err);
    return null;
  }
})();

// Window that currently has focus according to the window manager (0 if none).
function activeWindow() {
  const type = [0], format = [0], count = [0], after = [0], data = [null];
  const status = x11.XGetWindowProperty(x11.display, x11.root, x11.NET_ACTIVE_WINDOW,
    0, 1, 0, XA_WINDOW, type, format, count, after, data);
  if (status !== 0 || !data[0]) return 0;
  try {
    return count[0] === 1 && format[0] === 32 ? Number(x11.koffi.decode(data[0], 'unsigned long')) : 0;
  } finally {
    x11.XFree(data[0]);
  }
}

// Runs fn with X errors ignored instead of ending the process. Only for
// requests with a reply (such as XGetWindowProperty), whose errors arrive
// while the call is still running.
function withoutXErrors(fn) {
  const previous = x11.XSetErrorHandler(x11.ignoreErrors);
  try {
    return fn();
  } finally {
    x11.XSetErrorHandler(previous);
  }
}

// Raw value of a window property: bytes for format 8, the first number for
// format 32; null if missing or if the window no longer exists.
// To be called inside withoutXErrors.
function windowProperty(xid, atom, type) {
  const actualType = [0], format = [0], count = [0], after = [0], data = [null];
  const status = x11.XGetWindowProperty(x11.display, xid, atom,
    0, 1024, 0, type, actualType, format, count, after, data);
  if (status !== 0 || !data[0]) return null;
  try {
    if (!count[0]) return null;
    // Copied before XFree (koffi.view is not allowed in Electron: external buffers).
    if (format[0] === 8) return Buffer.from(x11.koffi.decode(data[0], 'uint8_t', count[0]));
    if (format[0] === 32) return Number(x11.koffi.decode(data[0], 'unsigned long'));
    return null;
  } finally {
    x11.XFree(data[0]);
  }
}

// Programs that run Windows executables: the game is in the command line.
const WINE_LOADERS = /^(wine|wine64|wine-preloader|wine64-preloader)$/;
const baseName = (p) => p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);

// Executable, path and Steam AppID of a process, from /proc.
function processInfo(pid) {
  const read = (file) => { try { return fs.readFileSync(`/proc/${pid}/${file}`, 'utf8'); } catch { return ''; } };
  let path = null;
  try { path = fs.readlinkSync(`/proc/${pid}/exe`).replace(/ \(deleted\)$/, ''); } catch { /* process ended or not ours */ }
  if (path && WINE_LOADERS.test(baseName(path))) {
    const exe = read('cmdline').split('\0').find((arg) => /\.exe$/i.test(arg));
    if (exe) path = exe;
  }
  const env = read('environ').split('\0');
  const appId = env.find((v) => v.startsWith('SteamAppId='))?.slice('SteamAppId='.length);
  // A runtime (Java): the application from its command line.
  const args = path && isRuntime(baseName(path)) ? read('cmdline').split('\0').filter(Boolean) : [];
  return { path, args: args.length ? args : null, steamAppId: appId && appId !== '0' ? appId : null };
}

function foregroundApp() {
  if (!previousActive) return null;
  const props = withoutXErrors(() => {
    const text = (buf) => buf?.toString('utf8').replace(/\0+$/, '') || null;
    return {
      title: text(windowProperty(previousActive, x11.NET_WM_NAME, x11.UTF8_STRING)) ??
        text(windowProperty(previousActive, XA_WM_NAME, ANY_PROPERTY_TYPE)),
      // Two strings, instance and class, each ending with a null byte.
      wmClass: text(windowProperty(previousActive, XA_WM_CLASS, XA_STRING))?.split('\0') ?? [],
      pid: windowProperty(previousActive, x11.NET_WM_PID, XA_CARDINAL),
    };
  });
  if (!props.title && !props.wmClass.length && !props.pid) return null;   // window closed meanwhile
  const proc = props.pid ? processInfo(props.pid) : { path: null, args: null, steamAppId: null };
  const exe = proc.path ? baseName(proc.path) : null;
  const hosted = hostedApp(exe, proc.args, props.title);
  const fromClass = props.wmClass.map((c) => c.match(/^steam_app_(\d+)$/)?.[1]).find(Boolean);
  return {
    pid: props.pid,
    exe: hosted?.exe ?? exe,
    path: proc.path,
    ...(hosted ? { name: hosted.name } : {}),
    title: props.title,
    steamAppId: fromClass ?? proc.steamAppId,
  };
}

// Asks the window manager to activate (raise and focus) a window.
function activate(xid) {
  x11.XSendEvent(x11.display, x11.root, 0, SUBSTRUCTURE_REDIRECT_MASK | SUBSTRUCTURE_NOTIFY_MASK, {
    type: CLIENT_MESSAGE,
    serial: 0,
    send_event: 1,
    display: x11.display,
    window: xid,
    message_type: x11.NET_ACTIVE_WINDOW,
    format: 32,
    data: [SOURCE_PAGER, 0 /* CurrentTime */, 0, 0, 0],
    pad: new Array(12).fill(0),
  });
  x11.XFlush(x11.display);
}

// X11 window id of an Electron window. The handle is a buffer holding the
// id in native byte order: 4 bytes in current Chromium (x11::Window is a
// uint32), 8 bytes (unsigned long) in older versions.
function xidOf(win) {
  const handle = win.getNativeWindowHandle();
  return handle.length >= 8 ? Number(handle.readBigUInt64LE(0)) : handle.readUInt32LE(0);
}

let previousActive = 0;   // window that had focus before the overlay

function beforeShow(win) {
  const active = activeWindow();
  // Only remember a window of another application.
  if (active && active !== xidOf(win)) previousActive = active;
}

function afterShow(win) {
  win.focus();
  try {
    activate(xidOf(win));
    // The window is mapped through Chromium's own X connection: if our
    // request reaches the window manager first it is ignored, so retry.
    setTimeout(() => {
      if (!win.isDestroyed() && win.isVisible() && !win.isFocused()) activate(xidOf(win));
    }, 100);
  } catch (err) {
    console.error(err);
  }
}

function beforeHide(win) {
  // Give focus back only if the overlay had it: if the user has meanwhile
  // switched to another window, they must not be disturbed. "The overlay"
  // includes its site popups (child windows).
  const focused = [win, ...win.getChildWindows()].some((w) => !w.isDestroyed() && w.isFocused());
  if (!focused || !previousActive || previousActive === xidOf(win)) return;
  try { activate(previousActive); } catch (err) { console.error(err); }
}

// ---------- mouse cursor ----------
//
// X11 has no "cursor hidden" state: games (SDL, Wine) hide it by giving their
// window an invisible cursor. So the cursor is hidden when the image XFixes
// reports for it now has no visible pixel (ARGB, one per unsigned long).
// Not seen: a cursor hidden with XFixesHideCursor. Confinement (a pointer
// grab) is not checked: it could only be found by trying a grab, which would
// send events to the game.
function cursorState() {
  if (!x11.XFixesGetCursorImage) return null;
  const ptr = withoutXErrors(() => x11.XFixesGetCursorImage(x11.display));
  if (!ptr) return null;   // XFixes missing on the server
  try {
    const image = x11.koffi.decode(ptr, 'XFixesCursorImage');
    const n = image.width * image.height;
    const pixels = n && image.pixels ? x11.koffi.decode(image.pixels, 'unsigned long', n) : [];
    // Alpha in bits 24-31: visible if the pixel is at least 2^24.
    return { hidden: !pixels.some((p) => Number(p) >= 0x1000000), clipped: null };
  } finally {
    x11.XFree(ptr);
  }
}

// ---------- memory ----------

// PSS of a process from /proc/<pid>/smaps_rollup (Linux 4.14+), in bytes;
// null if it cannot be read (older kernel, process that is not readable).
function pssOf(pid) {
  try {
    const m = /^Pss:\s+(\d+) kB/m.exec(fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'));
    return m ? Number(m[1]) * 1024 : null;
  } catch {
    return null;
  }
}

// PSS of every process; if even one cannot be read, the working set of all
// of them (mixing the two would make the total meaningless).
function memoryUsage(metrics) {
  const pss = metrics.map((m) => pssOf(m.pid));
  if (pss.some((v) => v === null)) return generic.memoryUsage(metrics);
  return { kind: 'pss', bytes: new Map(metrics.map((m, i) => [m.pid, pss[i]])) };
}

// Data folders of the browsers, for the bookmark import: also the Snap and
// Flatpak installs, which keep them under their own folders.
function bookmarkStores() {
  const path = require('path');
  const home = require('os').homedir();
  const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  const stores = [];
  const add = (browser, engine, dir) => stores.push({ browser, engine, dir });
  add('Chrome', 'chromium', path.join(config, 'google-chrome'));
  add('Chrome', 'chromium', path.join(home, '.var/app/com.google.Chrome/config/google-chrome'));
  add('Edge', 'chromium', path.join(config, 'microsoft-edge'));
  add('Brave', 'chromium', path.join(config, 'BraveSoftware/Brave-Browser'));
  add('Brave', 'chromium', path.join(home, '.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser'));
  add('Vivaldi', 'chromium', path.join(config, 'vivaldi'));
  add('Chromium', 'chromium', path.join(config, 'chromium'));
  add('Chromium', 'chromium', path.join(home, 'snap/chromium/common/chromium'));
  add('Chromium', 'chromium', path.join(home, '.var/app/org.chromium.Chromium/config/chromium'));
  add('Opera', 'chromium', path.join(config, 'opera'));
  add('Firefox', 'firefox', path.join(home, '.mozilla/firefox'));
  add('Firefox', 'firefox', path.join(home, 'snap/firefox/common/.mozilla/firefox'));
  add('Firefox', 'firefox', path.join(home, '.var/app/org.mozilla.firefox/.mozilla/firefox'));
  add('LibreWolf', 'firefox', path.join(home, '.librewolf'));
  return stores;
}

module.exports = {
  ...generic,
  id: x11 ? 'linux-x11' : 'linux-basic',
  features: { ...generic.features, keyboardHook: true, focusRestore: !!x11, appDetect: !!x11 },
  opacity: 'css',
  configureApp(app) {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  },
  // The notification area scales the icon to its own size (usually 22-24 px):
  // the 32 px one, rather than enlarging the 16 px one.
  trayImage(small, large) { return large; },
  memoryUsage,
  bookmarkStores,
  ...(x11 ? { beforeShow, afterShow, beforeHide, foregroundApp, cursorState } : {}),
};
