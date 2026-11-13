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
// Only requests to the root window are sent: they never fail, even if the
// window they refer to no longer exists (the window manager ignores them),
// so Xlib's default error handler, which would end the process, is never
// triggered.

const generic = require('./generic');

const CLIENT_MESSAGE = 33;
const SUBSTRUCTURE_NOTIFY_MASK = 1 << 19;
const SUBSTRUCTURE_REDIRECT_MASK = 1 << 20;
const XA_WINDOW = 33;
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
    };
    // A connection of our own, separate from Chromium's.
    api.display = api.XOpenDisplay(null);
    if (!api.display) throw new Error(`cannot open display ${process.env.DISPLAY}`);
    api.root = api.XDefaultRootWindow(api.display);
    api.NET_ACTIVE_WINDOW = api.XInternAtom(api.display, '_NET_ACTIVE_WINDOW', 0);
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
  // switched to another window, they must not be disturbed.
  if (!win.isFocused() || !previousActive || previousActive === xidOf(win)) return;
  try { activate(previousActive); } catch (err) { console.error(err); }
}

module.exports = {
  ...generic,
  id: x11 ? 'linux-x11' : 'linux-basic',
  features: { ...generic.features, keyboardHook: true, focusRestore: !!x11 },
  opacity: 'css',
  configureApp(app) {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  },
  ...(x11 ? { beforeShow, afterShow, beforeHide } : {}),
};
