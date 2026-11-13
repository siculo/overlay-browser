// Windows platform: focus and edge snapping through the Win32 API (koffi).
// See index.js for the interface.

const { screen } = require('electron');
const generic = require('./generic');

// ---------- Win32 API ----------
//
// Windows prevents a background app from taking focus, and Electron cannot
// give it back to another app's window. Native APIs are needed:
// - when showing, remember the foreground window (e.g. the game) and
//   temporarily attach to its input (AttachThreadInput), a condition
//   Windows requires before granting SetForegroundWindow;
// - when hiding, give focus back to that window BEFORE hiding: Windows
//   allows it as long as the overlay is in the foreground.

const win32 = (() => {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    koffi.pointer('HWND', koffi.opaque());
    koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    return {
      koffi,
      GetWindowRect: user32.func('bool __stdcall GetWindowRect(HWND, _Out_ RECT *)'),
      GetClassNameW: user32.func('int __stdcall GetClassNameW(HWND, _Out_ uint8_t *, int)'),
      GetForegroundWindow: user32.func('HWND __stdcall GetForegroundWindow()'),
      SetForegroundWindow: user32.func('bool __stdcall SetForegroundWindow(HWND)'),
      BringWindowToTop: user32.func('bool __stdcall BringWindowToTop(HWND)'),
      IsWindow: user32.func('bool __stdcall IsWindow(HWND)'),
      GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(HWND, _Out_ uint32_t *)'),
      AttachThreadInput: user32.func('bool __stdcall AttachThreadInput(uint32_t, uint32_t, bool)'),
      GetCurrentThreadId: kernel32.func('uint32_t __stdcall GetCurrentThreadId()'),
    };
  } catch (err) {
    console.error('Win32 API not available, using simplified focus handling:', err);
    return null;
  }
})();

let previousForeground = null;   // window that had focus before the overlay

const hwndOf = (w) => win32.koffi.decode(w.getNativeWindowHandle(), 'HWND');
const sameHwnd = (a, b) => a && b && win32.koffi.address(a) === win32.koffi.address(b);
function processOf(hwnd) {
  const pid = [0];
  win32.GetWindowThreadProcessId(hwnd, pid);
  return pid[0];
}

function forceForeground(hwnd) {
  const fg = win32.GetForegroundWindow();
  const fgThread = fg ? win32.GetWindowThreadProcessId(fg, null) : 0;
  const ourThread = win32.GetCurrentThreadId();
  const attach = fgThread && fgThread !== ourThread;
  if (attach) win32.AttachThreadInput(ourThread, fgThread, true);
  try {
    win32.BringWindowToTop(hwnd);
    win32.SetForegroundWindow(hwnd);
  } finally {
    if (attach) win32.AttachThreadInput(ourThread, fgThread, false);
  }
}

function beforeShow() {
  const fg = win32.GetForegroundWindow();
  // Only remember a window belonging to another application.
  if (fg && processOf(fg) !== process.pid) previousForeground = fg;
}

function afterShow(win) {
  try { forceForeground(hwndOf(win)); } catch (err) { console.error(err); }
  win.focus();
}

function beforeHide(win) {
  // Give focus back only if the overlay had it: if the user has meanwhile
  // switched to another window, they must not be disturbed.
  if (win.isFocused() && previousForeground && win32.IsWindow(previousForeground) &&
      !sameHwnd(previousForeground, hwndOf(win))) {
    try { win32.SetForegroundWindow(previousForeground); } catch (err) { console.error(err); }
  }
}

// ---------- edge snapping with the taskbar hidden ----------
//
// Side snapping (Aero Snap) and maximizing use the monitor's work area, which
// always excludes the taskbar. If however the overlay was opened over a window
// covering the whole monitor (fullscreen or borderless game), the taskbar is
// not visible: in that case the snapped/maximized window is extended to the
// whole screen.

let win;   // the overlay window, set by init()

function classNameOf(hwnd) {
  const buf = Buffer.alloc(512);
  const n = win32.GetClassNameW(hwnd, buf, 256);
  return buf.toString('utf16le', 0, n * 2);
}

// true if the window the overlay was opened from covers the whole monitor.
function fullscreenAppBelow(display) {
  if (!previousForeground || !win32.IsWindow(previousForeground)) return false;
  // The desktop covers the whole screen but does not hide the taskbar.
  if (['Progman', 'WorkerW', 'Shell_TrayWnd'].includes(classNameOf(previousForeground))) return false;
  const r = {};
  if (!win32.GetWindowRect(previousForeground, r)) return false;
  // GetWindowRect is in physical pixels, Electron displays in DIP.
  const dip = screen.screenToDipRect(null, { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top });
  const b = display.bounds;
  return dip.x <= b.x + 1 && dip.y <= b.y + 1 &&
    dip.x + dip.width >= b.x + b.width - 1 && dip.y + dip.height >= b.y + b.height - 1;
}

const near = (a, b, tol = 4) => Math.abs(a - b) <= tol;
const sameRect = (a, b) => a && b && near(a.x, b.x, 1) && near(a.y, b.y, 1) &&
  near(a.width, b.width, 1) && near(a.height, b.height, 1);

// Recognizes Windows snap positions: halves, thirds, quarters.
function isSnapped(bounds, wa) {
  const fracs = [1, 1 / 2, 1 / 3, 2 / 3];
  const wOk = fracs.some((f) => near(bounds.width, wa.width * f));
  const hOk = [1, 1 / 2].some((f) => near(bounds.height, wa.height * f));
  const inside = bounds.x >= wa.x - 4 && bounds.y >= wa.y - 4 &&
    bounds.x + bounds.width <= wa.x + wa.width + 4 && bounds.y + bounds.height <= wa.y + wa.height + 4;
  const edges = [
    near(bounds.x, wa.x), near(bounds.y, wa.y),
    near(bounds.x + bounds.width, wa.x + wa.width), near(bounds.y + bounds.height, wa.y + wa.height),
  ].filter(Boolean).length;
  return wOk && hOk && inside && edges >= 2;
}

let expandedBounds = null;   // last resize done by us (avoids repeating it)
let restoreBounds = null;    // size to restore when leaving the extended state
let lastFreeBounds = null;   // last "free" size, i.e. neither snapped nor extended
// When dragging upwards, Windows reports the maximize BEFORE the drag ends:
// that 'moved' event arrives right after, with the intermediate size, and
// must be ignored so as not to undo the state just set.
let ignoreMovedUntil = 0;

// Brings a rectangle back inside the screen (when dragging upwards to
// maximize, the "normal" size may stay partly outside).
function clampToDisplay(r, b) {
  const width = Math.min(r.width, b.width), height = Math.min(r.height, b.height);
  return {
    x: Math.min(Math.max(r.x, b.x), b.x + b.width - width),
    y: Math.min(Math.max(r.y, b.y), b.y + b.height - height),
    width, height,
  };
}

function expandSnapToFullScreen() {
  if (win.isDestroyed() || !win.isVisible() || win.isMinimized() || win.isMaximized()) return;
  const bounds = win.getBounds();
  if (sameRect(bounds, expandedBounds)) return;
  const display = screen.getDisplayMatching(bounds);
  const wa = display.workArea, b = display.bounds;
  if (!isSnapped(bounds, wa)) {
    // Extended window being dragged: not a "free" size.
    if (expandedBounds && near(bounds.width, expandedBounds.width, 1) &&
        near(bounds.height, expandedBounds.height, 1)) return;
    expandedBounds = null;
    restoreBounds = null;
    lastFreeBounds = bounds;
    return;
  }
  if (sameRect(wa, b) || !fullscreenAppBelow(display)) return;
  // Linear mapping from the work area to the whole screen: halves and
  // quarters stay so, but also take up the taskbar's space.
  const mapX = (x) => b.x + Math.round((x - wa.x) * b.width / wa.width);
  const mapY = (y) => b.y + Math.round((y - wa.y) * b.height / wa.height);
  const x = mapX(bounds.x), y = mapY(bounds.y);
  // Moving from one snap to another keeps the original size.
  if (!restoreBounds) restoreBounds = lastFreeBounds;
  expandedBounds = {
    x, y,
    width: mapX(bounds.x + bounds.width) - x,
    height: mapY(bounds.y + bounds.height) - y,
  };
  win.setBounds(expandedBounds);
}

// Maximizing is replaced by a resize to the whole screen; doing it again
// (e.g. double-click on the bar) goes back to the previous size.
function onMaximize() {
  const normal = win.getNormalBounds();
  const display = screen.getDisplayMatching(normal);
  const b = display.bounds;
  if (sameRect(display.workArea, b) || !fullscreenAppBelow(display)) return;

  let target;
  if (restoreBounds && sameRect(normal, b)) {
    target = clampToDisplay(restoreBounds, b);   // was already fullscreen: restore
    expandedBounds = null;
    restoreBounds = null;
  } else {
    // If it was already extended (e.g. half screen) keep the original size.
    if (!restoreBounds) restoreBounds = clampToDisplay(normal, b);
    target = { ...b };
    expandedBounds = target;
  }
  // unmaximize() is asynchronous: Windows restores the normal size after the
  // call and would overwrite an immediate setBounds. So the size is applied
  // once the restore has happened, checking again shortly after.
  const apply = () => {
    if (win.isDestroyed() || win.isMaximized()) return;
    if (!sameRect(win.getBounds(), target)) win.setBounds(target);
  };
  ignoreMovedUntil = Date.now() + 500;
  win.once('unmaximize', () => setTimeout(apply, 0));
  win.unmaximize();
  setTimeout(apply, 100);
  setTimeout(apply, 300);
}

// Unsnap at the start of the drag, as Windows does with maximized windows.
// On the first move from an extended state the window goes back to its
// previous size under the cursor; from then on the app positions it following
// the cursor, because Windows' drag loop would keep computing the position
// for the large window. Edge snapping is still left to Windows (it depends on
// the cursor position).
let unsnapDrag = null;   // { width, height, anchorX, anchorY } while unsnapping

function onWillMove(e) {
  const cursor = screen.getCursorScreenPoint();
  if (!unsnapDrag) {
    if (!expandedBounds || !restoreBounds || Date.now() < ignoreMovedUntil) return;
    const cur = win.getBounds();
    if (!sameRect(cur, expandedBounds)) return;
    const restore = restoreBounds;
    const fx = (cursor.x - cur.x) / cur.width;
    unsnapDrag = {
      width: restore.width,
      height: restore.height,
      anchorX: Math.round(fx * restore.width),
      anchorY: Math.min(cursor.y - cur.y, restore.height - 10),
    };
    // A possible new snap at the end of the drag will remember this size.
    lastFreeBounds = { ...restore };
    expandedBounds = null;
    restoreBounds = null;
  }
  // If the event is cancelled, Electron hands Windows the window's current
  // position: the one set just below.
  e.preventDefault();
  win.setBounds({
    x: cursor.x - unsnapDrag.anchorX,
    y: cursor.y - unsnapDrag.anchorY,
    width: unsnapDrag.width,
    height: unsnapDrag.height,
  });
}

// Fallback, if the unsnap at the start did not happen:
// when dragging the window away from an extended state (fullscreen or snap),
// Windows does not shrink it because to Windows it is a normal window: it is
// done at the end of the drag, going back to the pre-snap size and keeping
// the cursor at the same relative point of the bar.
function onMoved() {
  if (unsnapDrag) {        // unsnap already handled during the drag
    unsnapDrag = null;
    return;
  }
  if (!expandedBounds || Date.now() < ignoreMovedUntil) return;
  const cur = win.getBounds();
  const sameSize = near(cur.width, expandedBounds.width, 1) && near(cur.height, expandedBounds.height, 1);
  // Size changed (e.g. dragged into another snap): handled by
  // expandSnapToFullScreen, which keeps restoreBounds if still snapped.
  if (!sameSize) {
    expandedBounds = null;
    return;
  }
  if (near(cur.x, expandedBounds.x, 1) && near(cur.y, expandedBounds.y, 1)) return;

  const restore = restoreBounds;
  expandedBounds = null;
  restoreBounds = null;
  if (!restore) return;
  const cursor = screen.getCursorScreenPoint();
  const fx = (cursor.x - cur.x) / cur.width;
  const offY = Math.min(cursor.y - cur.y, restore.height - 10);
  const target = {
    x: Math.round(cursor.x - fx * restore.width),
    y: Math.round(cursor.y - offY),
    width: restore.width,
    height: restore.height,
  };
  const final = clampToDisplay(target, screen.getDisplayNearestPoint(cursor).bounds);
  // After Windows' drag loop has ended, which could otherwise undo the resize.
  setTimeout(() => { if (!win.isDestroyed()) win.setBounds(final); }, 0);
}

function trackSnap() {
  let timer = null;
  // Wait for the snap animation to finish before correcting.
  const schedule = () => { clearTimeout(timer); timer = setTimeout(expandSnapToFullScreen, 300); };
  win.on('move', schedule);
  win.on('resize', schedule);
  win.on('maximize', onMaximize);
  win.on('will-move', onWillMove);
  win.on('moved', onMoved);
}

// ---------- module ----------

module.exports = win32 ? {
  ...generic,
  id: 'win32',
  features: { keyboardHook: true, focusRestore: true, edgeSnap: true },
  opacity: 'native',
  init(w) {
    win = w;
    trackSnap();
  },
  beforeShow,
  afterShow,
  beforeHide,
} : {
  // Without the native API only the parts that do not need it remain.
  ...generic,
  id: 'win32-basic',
  features: { ...generic.features, keyboardHook: true },
  opacity: 'native',
};
