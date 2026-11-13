const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, net, screen, Tray } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const fs = require('fs');
const path = require('path');

// Sites offered on first launch, until the user saves their own list.
const DEFAULT_SITES = [
  'https://scmdb.net/',
  'https://erkul.games/calculator',
  'https://starcitizen.tools',
].map((url) => ({ id: crypto.randomUUID(), url, title: null }));

const DEFAULT_SHORTCUT = 'F10';
// Options of the Settings page: key -> default.
const DEFAULT_SETTINGS = {
  hideOnBlur: true,     // hide the overlay when it loses focus
  language: 'system',   // 'system' or the code of one of the files in locales/
};
const DEFAULT_SIZE = { width: 1000, height: 700 };
const MIN_SIZE = { width: 480, height: 320 };

// ---------- preferences ----------

// Fixed data folder: without this line the packaged app would use the
// productName ("Overlay Browser") and would not find the existing preferences.
app.setPath('userData', path.join(app.getPath('appData'), 'overlay-browser'));

const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');
let prefs;

function loadPrefs() {
  let loaded = {};
  try {
    loaded = JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) || {};
  } catch {
    // Missing or corrupted file: start over from the defaults.
  }
  return {
    sites: Array.isArray(loaded.sites) ? loaded.sites : DEFAULT_SITES,
    window: loaded.window ?? null,
    activeTab: typeof loaded.activeTab === 'string' ? loaded.activeTab : null,
    shortcut: typeof loaded.shortcut === 'string' && loaded.shortcut ? loaded.shortcut : DEFAULT_SHORTCUT,
    settings: loadSettings(loaded.settings),
  };
}

// Keeps only known keys with the right type; the others get the default.
function loadSettings(saved) {
  const settings = { ...DEFAULT_SETTINGS };
  if (saved && typeof saved === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof saved[key] === typeof DEFAULT_SETTINGS[key]) settings[key] = saved[key];
    }
  }
  return settings;
}

function savePrefs() {
  fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
  // Write to a temporary file + rename, so the JSON is never left half-written.
  const tmp = prefsFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2));
  fs.renameSync(tmp, prefsFile());
}

// ---------- localization ----------
//
// Each file in locales/ is a language: the file name is its code (e.g. "it")
// and the content maps message keys to text, with {name} placeholders.
// Missing keys fall back to English.

const FALLBACK_LANGUAGE = 'en';

const locales = (() => {
  const dir = path.join(__dirname, 'locales');
  const out = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      out[path.basename(file, '.json')] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (err) {
      console.error(`Invalid locale file ${file}:`, err);
    }
  }
  return out;
})();

// First system language available in the app (exact tag, e.g. "pt-BR", then
// the base language, e.g. "pt"); English if none is available.
function systemLanguage() {
  for (const tag of app.getPreferredSystemLanguages()) {
    const exact = Object.keys(locales).find((code) => code.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const base = tag.split('-')[0].toLowerCase();
    if (locales[base]) return base;
  }
  return FALLBACK_LANGUAGE;
}

const isLanguageSetting = (v) => v === 'system' || Object.hasOwn(locales, v);

function currentLanguage() {
  const chosen = prefs.settings.language;
  return chosen !== 'system' && Object.hasOwn(locales, chosen) ? chosen : systemLanguage();
}

// Messages of the current language, completed with the English ones.
const currentMessages = () => ({ ...locales[FALLBACK_LANGUAGE], ...locales[currentLanguage()] });

function t(key, params = {}) {
  const text = currentMessages()[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => params[name] ?? m);
}

// Everything the page needs to translate itself and build the language list.
function i18nState() {
  return {
    language: currentLanguage(),
    system: systemLanguage(),
    languages: Object.keys(locales).sort().map((code) => ({ code, name: locales[code]['language.name'] || code })),
    messages: currentMessages(),
  };
}

// ---------- window position and size ----------

const isNum = (n) => Number.isFinite(n);

// The window is fully visible if it lies entirely within the screen of at
// least one monitor. The whole screen is used rather than the work area,
// because over a game the window may legitimately cover the taskbar too.
function isFullyVisible(b) {
  return screen.getAllDisplays().some(({ bounds: w }) =>
    b.x >= w.x && b.y >= w.y &&
    b.x + b.width <= w.x + w.width &&
    b.y + b.height <= w.y + w.height);
}

// Default position: centered on the primary monitor, shrunk if the screen is small.
function defaultBounds() {
  const w = screen.getPrimaryDisplay().workArea;
  const width = Math.max(MIN_SIZE.width, Math.min(DEFAULT_SIZE.width, w.width));
  const height = Math.max(MIN_SIZE.height, Math.min(DEFAULT_SIZE.height, w.height));
  return {
    x: w.x + Math.round((w.width - width) / 2),
    y: w.y + Math.round((w.height - height) / 2),
    width, height,
  };
}

function initialBounds() {
  const b = prefs.window;
  if (b && [b.x, b.y, b.width, b.height].every(isNum) &&
      b.width >= MIN_SIZE.width && b.height >= MIN_SIZE.height &&
      isFullyVisible(b)) {
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  return defaultBounds();
}

function trackBounds(win) {
  let timer = null;
  const store = () => {
    clearTimeout(timer);
    timer = null;
    if (win.isDestroyed() || win.isMinimized() || win.isMaximized()) return;
    prefs.window = win.getBounds();
    savePrefs();
  };
  // While dragging, events arrive in bursts: save once the movement ends.
  const schedule = () => { clearTimeout(timer); timer = setTimeout(store, 500); };
  win.on('move', schedule);
  win.on('resize', schedule);
  win.on('close', store);
}

// ---------- site titles ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Reads the page's <title>. Returns null if the site does not respond
// or has no title in the HTML (e.g. apps that set it via JavaScript).
async function fetchTitle(url) {
  try {
    const res = await net.fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = m && decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    return title || null;
  } catch {
    return null;
  }
}

// ---------- global shortcut ----------

let win;
let tray;              // global reference: if garbage-collected the icon would disappear
let shortcut = null;   // currently registered shortcut

// ---------- focus (Win32 API via koffi) ----------
//
// Windows prevents a background app from taking focus, and Electron cannot
// give it back to another app's window. Native APIs are needed:
// - when showing, remember the foreground window (e.g. the game) and
//   temporarily attach to its input (AttachThreadInput), a condition
//   Windows requires before granting SetForegroundWindow;
// - when hiding, give focus back to that window BEFORE hiding: Windows
//   allows it as long as the overlay is in the foreground.

const win32 = (() => {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    koffi.pointer('HWND', koffi.opaque());
    koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    const api = {
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
    return api;
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

function showWindow() {
  if (win32) {
    const fg = win32.GetForegroundWindow();
    // Only remember a window belonging to another application.
    if (fg && processOf(fg) !== process.pid) previousForeground = fg;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  if (win32) {
    try { forceForeground(hwndOf(win)); } catch (err) { console.error(err); }
  }
  win.focus();
}

function hideWindow() {
  // Give focus back only if the overlay had it: if the user has meanwhile
  // switched to another window, they must not be disturbed.
  if (win32 && win.isFocused() && previousForeground && win32.IsWindow(previousForeground) &&
      !sameHwnd(previousForeground, hwndOf(win))) {
    try { win32.SetForegroundWindow(previousForeground); } catch (err) { console.error(err); }
  }
  win.hide();
}

function toggleWindow() {
  if (win.isVisible() && !win.isMinimized()) hideWindow();
  else showWindow();
}

// ---------- edge snapping with the taskbar hidden ----------
//
// Side snapping (Aero Snap) and maximizing use the monitor's work area, which
// always excludes the taskbar. If however the overlay was opened over a window
// covering the whole monitor (fullscreen or borderless game), the taskbar is
// not visible: in that case the snapped/maximized window is extended to the
// whole screen.

function classNameOf(hwnd) {
  const buf = Buffer.alloc(512);
  const n = win32.GetClassNameW(hwnd, buf, 256);
  return buf.toString('utf16le', 0, n * 2);
}

// true if the window the overlay was opened from covers the whole monitor.
function fullscreenAppBelow(display) {
  if (!win32 || !previousForeground || !win32.IsWindow(previousForeground)) return false;
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

// When the overlay loses focus (click on another window, Alt+Tab...) it
// hides. In that case focus is already elsewhere, so hideWindow does not move it.
let lastBlurHide = 0;
function hideOnBlur() {
  if (!prefs.settings.hideOnBlur || !win.isVisible()) return;
  lastBlurHide = Date.now();
  hideWindow();
}

// The shortcut is intercepted in two ways (see below): when both work, two
// events arrive for the same key press, and only the first must count.
let lastShortcutToggle = 0;
function toggleFromShortcut() {
  const now = Date.now();
  if (now - lastShortcutToggle < 300) return;
  lastShortcutToggle = now;
  toggleWindow();
}

// ---------- low-level keyboard hook ----------
//
// globalShortcut uses Windows' RegisterHotKey, which does not fire when the
// foreground app is a game reading the keyboard exclusively (e.g. Star Citizen).
// A low-level hook sees keys before the game. The hook only observes: the key
// still reaches the foreground application.

const MODIFIER_NAMES = {
  ctrl: 'ctrl', control: 'ctrl', commandorcontrol: 'ctrl', cmdorctrl: 'ctrl',
  alt: 'alt', option: 'alt', altgr: 'alt',
  shift: 'shift',
  super: 'meta', meta: 'meta', cmd: 'meta', command: 'meta',
};
const ACCEL_KEYS = {
  space: 'Space', tab: 'Tab', enter: 'Enter', return: 'Enter', backspace: 'Backspace',
  insert: 'Insert', delete: 'Delete', home: 'Home', end: 'End',
  pageup: 'PageUp', pagedown: 'PageDown', escape: 'Escape', esc: 'Escape',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
  ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash', '`': 'Backquote',
  numadd: 'NumpadAdd', numsub: 'NumpadSubtract', nummult: 'NumpadMultiply',
  numdiv: 'NumpadDivide', numdec: 'NumpadDecimal',
};

// Converts an Electron accelerator ("Ctrl+Shift+O") into { keycode, ctrl, alt, shift, meta }.
function parseAccelerator(accelerator) {
  const combo = { keycode: null, ctrl: false, alt: false, shift: false, meta: false };
  for (const part of accelerator.split('+')) {
    const p = part.trim().toLowerCase();
    if (MODIFIER_NAMES[p]) { combo[MODIFIER_NAMES[p]] = true; continue; }
    let name = ACCEL_KEYS[p];
    if (!name && /^[a-z0-9]$/.test(p)) name = p.toUpperCase();
    if (!name && /^f([1-9]|1\d|2[0-4])$/.test(p)) name = p.toUpperCase();
    if (!name && /^num\d$/.test(p)) name = 'Numpad' + p.slice(3);
    combo.keycode = UiohookKey[name] ?? null;
  }
  return combo.keycode === null ? null : combo;
}

let hookCombo = null;        // combination the hook looks for
let hookSuspended = false;   // true while the user records a new combination
let hookKeyDown = false;     // avoids repeating the toggle while the key is held down

// Diagnostic log in userData/overlay.log: startup, shortcut registration
// and hook errors. Never records the keys pressed.
const logFile = () => path.join(app.getPath('userData'), 'overlay.log');
function log(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  try {
    if (fs.statSync(logFile()).size > 512 * 1024) fs.writeFileSync(logFile(), '');
  } catch { /* file not created yet */ }
  try { fs.appendFileSync(logFile(), line); } catch { /* ignored */ }
}

function setHookCombo(accelerator) {
  hookCombo = accelerator ? parseAccelerator(accelerator) : null;
  hookKeyDown = false;
  log(`hook: combination ${accelerator || 'none'} -> ${hookCombo ? 'ok' : 'not recognized'}`);
}

function startKeyboardHook() {
  uIOhook.on('keydown', (e) => {
    const c = hookCombo;
    if (!c || hookSuspended || e.keycode !== c.keycode) return;
    if (e.ctrlKey !== c.ctrl || e.altKey !== c.alt || e.shiftKey !== c.shift || e.metaKey !== c.meta) return;
    if (hookKeyDown) return;
    hookKeyDown = true;
    toggleFromShortcut();
  });
  uIOhook.on('keyup', (e) => {
    if (hookCombo && e.keycode === hookCombo.keycode) hookKeyDown = false;
  });
  try {
    uIOhook.start();
    log('hook: started');
  } catch (err) {
    log(`hook: ERROR on start: ${err}`);
  }
}

// ---------- notification area icon ----------

const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');

function updateTray() {
  if (!tray) return;
  tray.setToolTip(shortcut ? `Overlay browser (${shortcut})` : 'Overlay browser');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t(win.isVisible() ? 'tray.hide' : 'tray.show'), accelerator: shortcut || undefined, click: toggleWindow },
    { label: t('tray.home'), click: () => { showWindow(); win.webContents.send('nav:home'); } },
    { label: t('tray.settings'), click: () => { showWindow(); win.webContents.send('nav:settings'); } },
    { type: 'separator' },
    { label: t('tray.quit'), click: () => app.quit() },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON_PATH));
  tray.on('click', () => {
    // Clicking the icon while the overlay is open, the window first loses
    // focus and hides (see 'blur'): the click must not reopen it right after.
    if (!win.isVisible() && Date.now() - lastBlurHide < 500) return;
    toggleWindow();
  });
  // Menu items depend on the window state and on the shortcut.
  win.on('show', updateTray);
  win.on('hide', updateTray);
  updateTray();
}

// register() throws if the accelerator is invalid and returns false if the
// combination is already used by another application.
function tryRegister(accelerator) {
  try {
    return globalShortcut.register(accelerator, toggleFromShortcut);
  } catch {
    return false;
  }
}

function setShortcut(accelerator) {
  const previous = shortcut;
  globalShortcut.unregisterAll();
  if (tryRegister(accelerator)) {
    shortcut = accelerator;
    setHookCombo(accelerator);
    prefs.shortcut = accelerator;
    savePrefs();
    updateTray();
    return { ok: true, shortcut };
  }
  if (previous) tryRegister(previous);
  return { ok: false, shortcut: previous, error: t('shortcut.error', { accelerator }) };
}

// ---------- IPC ----------

ipcMain.handle('state:load', () => ({
  sites: prefs.sites,
  activeTab: prefs.activeTab,
  shortcut,
  settings: prefs.settings,
  i18n: i18nState(),
}));
ipcMain.handle('settings:set', (_e, key, value) => {
  if (!(key in DEFAULT_SETTINGS) || typeof value !== typeof DEFAULT_SETTINGS[key]) return;
  if (key === 'language' && !isLanguageSetting(value)) return;
  prefs.settings[key] = value;
  savePrefs();
});
// Changes the language and returns the new messages for the page.
ipcMain.handle('language:set', (_e, language) => {
  if (!isLanguageSetting(language)) return i18nState();
  prefs.settings.language = language;
  savePrefs();
  updateTray();
  return i18nState();
});
ipcMain.handle('sites:save', (_e, sites) => {
  if (!Array.isArray(sites)) return;
  prefs.sites = sites;
  savePrefs();
});
ipcMain.handle('tab:setActive', (_e, id) => {
  prefs.activeTab = typeof id === 'string' ? id : null;
  savePrefs();
});
ipcMain.handle('site:title', (_e, url) => fetchTitle(url));
ipcMain.handle('shortcut:set', (_e, accelerator) => setShortcut(String(accelerator)));
// While the user records a new combination, the current one must be
// suspended, otherwise pressing it would hide the window instead of capturing it.
ipcMain.handle('shortcut:suspend', (_e, suspended) => {
  hookSuspended = !!suspended;
  globalShortcut.unregisterAll();
  if (!suspended && shortcut) tryRegister(shortcut);
});

// ---------- startup ----------

// Single instance: two copies would compete for the shortcut (the second
// could not register it). If the app is already open, show that one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) showWindow(); });
  app.whenReady().then(start);
}

function start() {
  prefs = loadPrefs();
  log(`startup (version ${app.getVersion()}, ${app.isPackaged ? 'packaged' : 'development'}, ` +
    `language ${currentLanguage()}, system languages ${app.getPreferredSystemLanguages().join(',') || 'none'})`);

  win = new BrowserWindow({
    ...initialBounds(),
    minWidth: MIN_SIZE.width, minHeight: MIN_SIZE.height,
    frame: false, show: false, opacity: 0.95,
    alwaysOnTop: true,
    skipTaskbar: true,   // no taskbar icon: the notification area icon is used instead
    icon: ICON_PATH,
    webPreferences: {
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile('index.html');
  win.on('blur', hideOnBlur);
  trackBounds(win);
  if (win32) trackSnap();

  if (tryRegister(prefs.shortcut)) shortcut = prefs.shortcut;
  else if (tryRegister(DEFAULT_SHORTCUT)) shortcut = DEFAULT_SHORTCUT;
  log(`globalShortcut: ${shortcut ? `registered ${shortcut}` : `cannot register ${prefs.shortcut}`}`);
  // The hook uses the chosen combination anyway, even if globalShortcut
  // could not register it (e.g. already used by another application).
  setHookCombo(shortcut || prefs.shortcut);
  startKeyboardHook();
  createTray();
}
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try { uIOhook.stop(); } catch { /* already stopped */ }
});
app.on('window-all-closed', () => app.quit());
