const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, screen, shell, Tray, webContents } = require('electron');
const fs = require('fs');
const path = require('path');
const platform = require('./platform');
const bookmarks = require('./bookmarks');

platform.configureApp(app);

// Low-level keyboard hook (see below), only where the platform supports it.
// Loaded here rather than with a plain require so that a missing native
// library disables the hook instead of preventing the app from starting.
const uiohook = (() => {
  if (!platform.features.keyboardHook) return null;
  try {
    return require('uiohook-napi');
  } catch (err) {
    console.error('Keyboard hook not available:', err);
    return null;
  }
})();

const DEFAULT_SHORTCUT = platform.defaultShortcut;
// Options of the Settings page: key -> default.
const DEFAULT_SETTINGS = {
  hideOnBlur: true,     // hide the overlay when it loses focus
  language: 'system',   // 'system' or the code of one of the files in locales/
  opacity: 0.95,        // window opacity, from OPACITY_RANGE.min (most transparent) to 1 (opaque)
  accent: 'amber',      // accent color of the interface, one of ACCENTS
  unloadAfter: 30,      // minutes after which the pages not in use (all but the active tab) are closed, UNLOAD_RANGE
};
const UNLOAD_RANGE = { min: 5, max: 60 };
// Names of the predefined accent colors; the colors themselves are defined by the page (index.html).
const ACCENTS = ['amber', 'orange', 'red', 'pink', 'purple', 'blue', 'cyan', 'green'];
// Below the minimum the window would be too hard to read.
const OPACITY_RANGE = { min: 0.3, max: 1 };
const DEFAULT_SIZE = { width: 1000, height: 700 };
const MIN_SIZE = { width: 480, height: 320 };

// Validity of a setting value beyond its type.
function isValidSetting(key, value) {
  if (typeof value !== typeof DEFAULT_SETTINGS[key]) return false;
  if (key === 'language') return isLanguageSetting(value);
  if (key === 'opacity') return Number.isFinite(value) && value >= OPACITY_RANGE.min && value <= OPACITY_RANGE.max;
  if (key === 'accent') return ACCENTS.includes(value);
  if (key === 'unloadAfter') {
    return Number.isInteger(value) && value >= UNLOAD_RANGE.min && value <= UNLOAD_RANGE.max;
  }
  return true;
}

// Window options for the translucency, depending on how the platform obtains it.
function opacityOptions() {
  switch (platform.opacity) {
    case 'native': return { opacity: prefs.settings.opacity };
    // The page applies the opacity itself (see 'state:load').
    case 'css': return { transparent: true, backgroundColor: '#00000000' };
    default: return {};
  }
}

// Applies a new opacity: natively here, or in the page, which has already
// done it while the user moved the slider.
function applyOpacity() {
  if (platform.opacity === 'native') win.setOpacity(prefs.settings.opacity);
}

// ---------- preferences ----------

// Fixed data folder: without this line the packaged app would use the
// productName ("Overlay Browser") and would not find the existing preferences.
app.setPath('userData', path.join(app.getPath('appData'), 'overlay-browser'));

// Same user agent as Chrome: without the app and Electron versions that
// Electron adds, some sites (Google sign-in above all) refuse the login as an
// "embedded browser".
app.userAgentFallback = app.userAgentFallback.split(' ')
  .filter((token) => !token.startsWith('Electron/') && !token.endsWith(`/${app.getVersion()}`))
  .join(' ');

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
    lists: loadLists(loaded),
    pinnedList: typeof loaded.pinnedList === 'string' ? loaded.pinnedList : null,
    // Executables whose predefined list was already loaded automatically
    // (see index.html): it is not loaded again if the list is removed.
    presetsApplied: Array.isArray(loaded.presetsApplied) ? loaded.presetsApplied.filter((x) => typeof x === 'string') : [],
    window: loaded.window ?? null,
    shortcut: typeof loaded.shortcut === 'string' && loaded.shortcut ? loaded.shortcut : DEFAULT_SHORTCUT,
    settings: loadSettings(loaded.settings),
  };
}

// Site lists: one per application (see index.html), plus the general list
// (match null), used when no application is detected, which always exists.
// Before lists existed there was a single list (`sites`, `activeTab`): its
// sites go to the general list, except those of the predefined lists (the
// old default sites), which are offered again for their game.
function loadLists(loaded) {
  let lists = Array.isArray(loaded.lists) ? loaded.lists : [];
  if (!Array.isArray(loaded.lists) && Array.isArray(loaded.sites)) {
    const preset = presetUrls();
    const sites = loaded.sites.filter((s) => !preset.has(urlKey(s?.url)));
    const activeTab = sites.some((s) => s.id === loaded.activeTab) ? loaded.activeTab : null;
    lists = [{ id: crypto.randomUUID(), name: null, match: null, sites, activeTab }];
  }
  if (!lists.some((l) => l?.match === null)) {
    lists = [{ id: crypto.randomUUID(), name: null, match: null, sites: [], activeTab: null }, ...lists];
  }
  return lists;
}

// Keeps only known keys with a valid value; the others get the default.
// A language no longer available is kept: it counts as the system one
// (see currentLanguage) and comes back if its file is restored.
function loadSettings(saved) {
  const settings = { ...DEFAULT_SETTINGS };
  // Up to 1.0 there were two delays, one for the current list's pages
  // (`unloadCurrentAfter`) and one for the other lists' (`unloadAfter`): the
  // single delay keeps the first one.
  if (saved && typeof saved === 'object' && 'unloadCurrentAfter' in saved) {
    saved = { ...saved, unloadAfter: saved.unloadCurrentAfter };
  }
  if (saved && typeof saved === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const value = saved[key];
      const ok = key === 'language' ? typeof value === 'string' : isValidSetting(key, value);
      if (ok) settings[key] = value;
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

// ---------- predefined lists ----------
//
// Ready-made site lists for known games, shipped with the app in lists/:
// index.json maps executables to list files (see lists/README.md).

const PRESETS_DIR = path.join(__dirname, 'lists');
const PRESET_FILE = /^[\w-]+\.json$/;

const readPresetFile = async (file) => JSON.parse(await fs.promises.readFile(path.join(PRESETS_DIR, file), 'utf8'));

// Same address written in different ways (e.g. with or without the final "/").
function urlKey(url) {
  try { return new URL(url).href; } catch { return null; }
}

// Addresses of all the predefined lists (for the migration of the old list).
function presetUrls() {
  const urls = new Set();
  try {
    const index = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, 'index.json'), 'utf8'));
    for (const { file } of index.lists ?? []) {
      if (typeof file !== 'string' || !PRESET_FILE.test(file)) continue;
      const data = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, file), 'utf8'));
      for (const s of data.sites ?? []) urls.add(urlKey(s?.url));
    }
  } catch (err) {
    log(`presets: cannot read the predefined lists: ${err}`);
  }
  return urls;
}

// Predefined list for an executable (normalized, see index.html), or null:
// { name, sites: [{ url, title }] }.
async function findPreset(exe) {
  let file = null;
  try {
    const index = await readPresetFile('index.json');
    file = (Array.isArray(index?.lists) ? index.lists : []).find((e) =>
      typeof e?.file === 'string' && PRESET_FILE.test(e.file) &&
      Array.isArray(e.exe) && e.exe.some((x) => String(x).toLowerCase() === exe))?.file;
    if (!file) return null;
    const data = await readPresetFile(file);
    const sites = (Array.isArray(data?.sites) ? data.sites : [])
      .filter((s) => typeof s?.url === 'string' && /^https?:\/\//i.test(s.url))
      .map((s) => ({ url: s.url, title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : null }));
    if (!sites.length) return null;
    return { name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null, sites };
  } catch (err) {
    log(`presets: cannot read ${file ?? 'index.json'}: ${err}`);
    return null;
  }
}

// ---------- global shortcut ----------

let win;
let tray;              // global reference: if garbage-collected the icon would disappear
let shortcut = null;   // currently registered shortcut

// ---------- show / hide ----------
//
// What depends on the operating system (taking focus from the game and
// giving it back) is delegated to the platform module. Its errors are only
// logged: showing and hiding the window must work in any case.

function platformCall(name) {
  try {
    platform[name](win);
  } catch (err) {
    log(`platform ${platform.id}: ERROR in ${name}: ${err?.stack || err}`);
  }
}

let shownAt = 0;   // when the overlay was last shown (for the log of hideOnBlur)

function showWindow() {
  shownAt = Date.now();
  platformCall('beforeShow');
  if (win.isMinimized()) win.restore();
  win.show();
  for (const w of hiddenPopups) if (!w.isDestroyed()) w.showInactive();
  hiddenPopups = [];
  platformCall('afterShow');
  win.webContents.send('win:visible', true);
  detectForegroundApp();
}

// ---------- application the overlay was opened over ----------
//
// The platform module remembers the window that had focus when showing
// (beforeShow); here it is turned into the application (e.g. the game),
// which the page shows on the Home. Read after showing, so as not to slow it down.

let foregroundApp = null;

function detectForegroundApp() {
  if (!platform.features.appDetect) return;
  let detected = null;
  try {
    detected = platform.foregroundApp();
  } catch (err) {
    log(`platform ${platform.id}: ERROR in foregroundApp: ${err?.stack || err}`);
  }
  // Our own windows do not count (e.g. a dialog of the overlay).
  if (detected?.pid === process.pid) detected = null;
  const key = (a) => a && `${a.path}|${a.steamAppId}`;
  if (key(detected) !== key(foregroundApp)) {
    log(`foreground app: ${detected ? `${detected.exe ?? '?'}${detected.steamAppId ? ` (Steam ${detected.steamAppId})` : ''}` : 'none'}`);
  }
  foregroundApp = detected;
  win.webContents.send('app:foreground', foregroundApp);
}

// The site popups (see 'site popups') are hidden and shown with the
// overlay: a login left halfway is found again at the next show.
let hiddenPopups = [];

function hideWindow() {
  platformCall('beforeHide');
  hiddenPopups = win.getChildWindows().filter((w) => w.isVisible());
  for (const w of hiddenPopups) w.hide();
  win.hide();
  win.webContents.send('win:visible', false);
}

function toggleWindow() {
  if (win.isVisible() && !win.isMinimized()) hideWindow();
  else showWindow();
}

// When the overlay loses focus (click on another window, Alt+Tab...) it
// hides. In that case focus is already elsewhere, so hideWindow does not move it.
//
// A blur does not always mean that another window came to the foreground:
// on Windows, a game whose input the overlay was attached to when showing
// (see platform/win32.js) can take the keyboard focus back for an instant,
// while the overlay stays in the foreground. Such a blur is ignored and the
// keyboard focus is given back to the overlay. Where the platform cannot
// tell (ownsForeground() null), every blur hides.
//
// The overlay and its site popups (see 'site popups') count as one: moving
// the focus between them is not a blur, losing it from any of them is.
// With popups open the check waits for the focus to settle, since the
// window losing it is told before the one getting it.
let lastBlurHide = 0;
let blurTimer = null;
const overlayWindows = () => [win, ...win.getChildWindows()].filter((w) => !w.isDestroyed());
const overlayFocused = () => overlayWindows().some((w) => w.isFocused());

function onOverlayBlur(blurred) {
  clearTimeout(blurTimer);
  if (win.getChildWindows().length === 0) return hideOnBlur(blurred);
  blurTimer = setTimeout(() => hideOnBlur(blurred), 100);
}

// `blurred`: the window that lost the focus, the one to give it back to.
function hideOnBlur(blurred) {
  if (!prefs.settings.hideOnBlur || !win.isVisible() || overlayFocused() || fileDialogOpen) return;
  let owns = null;
  try {
    owns = platform.ownsForeground(win);
  } catch (err) {
    log(`platform ${platform.id}: ERROR in ownsForeground: ${err?.stack || err}`);
  }
  if (owns) {
    log(`focus: blur ignored, the overlay is still in the foreground (${Date.now() - shownAt} ms after show)`);
    const target = blurred.isDestroyed() || !blurred.isVisible() ? win : blurred;
    setImmediate(() => { if (win.isVisible() && !overlayFocused()) target.focus(); });
    return;
  }
  lastBlurHide = Date.now();
  log(`focus: hidden on blur (${lastBlurHide - shownAt} ms after show)`);
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
// globalShortcut (RegisterHotKey on Windows, XGrabKey on X11) does not fire
// when the foreground app is a game reading the keyboard exclusively.
// A low-level hook (uiohook-napi: a hook on Windows, XRecord on X11) sees
// keys before the game. The hook only observes: the key still reaches the
// foreground application.

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
    combo.keycode = uiohook.UiohookKey[name] ?? null;
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
  if (!uiohook) return;
  hookCombo = accelerator ? parseAccelerator(accelerator) : null;
  hookKeyDown = false;
  log(`hook: combination ${accelerator || 'none'} -> ${hookCombo ? 'ok' : 'not recognized'}`);
}

function startKeyboardHook() {
  if (!uiohook) {
    log('hook: not available on this platform');
    return;
  }
  const { uIOhook } = uiohook;
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
  tray = new Tray(platform.trayImage(nativeImage.createFromPath(ICON_PATH)));
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

// ---------- site popups ----------
//
// What a browser opens in a tab (links with target=_blank, window.open
// without window features, Ctrl/middle click: disposition 'foreground-tab'
// or 'background-tab') opens in a tab of the overlay: the page receives the
// address ('site:open') and shows it in the tab of that site, or offers to
// add the site to the list. The windows the site explicitly asks for
// (window.open with window features, e.g. "Continue with Google": the popup
// reports the result to the page that opened it) are allowed, as child
// windows of the overlay, on top of it, without menu bar.
const TAB_DISPOSITIONS = new Set(['foreground-tab', 'background-tab']);
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (TAB_DISPOSITIONS.has(disposition)) {
      if (/^https?:/i.test(url)) win.webContents.send('site:open', url, contents.id);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: { parent: win, icon: ICON_PATH, autoHideMenuBar: true },
    };
  });
  contents.on('did-create-window', (popup) => {
    popup.removeMenu();
    popup.setAlwaysOnTop(true, 'screen-saver');
    popup.on('blur', () => onOverlayBlur(popup));
    // When the popup closes (e.g. at the end of a login) the overlay takes
    // the focus back, otherwise it would not notice the next blur.
    popup.on('closed', () => {
      if (!win.isDestroyed() && win.isVisible() && !overlayFocused()) win.focus();
    });
    log(`popup opened from ${contents.getURL()}`);
  });
});

// ---------- IPC ----------

ipcMain.handle('state:load', () => ({
  lists: prefs.lists,
  pinnedList: prefs.pinnedList,
  presetsApplied: prefs.presetsApplied,
  shortcut,
  defaultShortcut: DEFAULT_SHORTCUT,
  settings: prefs.settings,
  foregroundApp,
  i18n: i18nState(),
  // What the page must do itself depending on the platform.
  platform: {
    id: platform.id,
    features: platform.features,
    opacity: platform.opacity,   // 'css': the page applies settings.opacity itself
    opacityRange: OPACITY_RANGE,
    browserBookmarks: platform.bookmarkStores().length > 0,   // else bookmarks are imported from a file only
  },
  unloadRange: UNLOAD_RANGE,
  version: app.getVersion(),   // shown on the Settings page
}));
ipcMain.handle('settings:set', (_e, key, value) => {
  if (!(key in DEFAULT_SETTINGS) || !isValidSetting(key, value)) return;
  prefs.settings[key] = value;
  savePrefs();
  if (key === 'opacity') applyOpacity();
});
// Memory used by the app, process by process (measured by the platform
// module, see memoryUsage in platform/index.js). For each process: its type
// (Electron's: 'Browser', 'GPU', 'Tab', 'Utility'...), the bytes, the ids of
// the webContents it hosts (the page matches them with its webviews) and
// whether it hosts the overlay's own page.
// Project page, linked next to the version on the Settings page.
const REPO_URL = 'https://github.com/siculo/overlay-browser';
ipcMain.handle('repo:open', () => shell.openExternal(REPO_URL));
ipcMain.handle('memory:get', () => {
  const metrics = app.getAppMetrics();
  const { kind, bytes } = platform.memoryUsage(metrics);
  const contents = new Map();   // pid -> webContents ids
  for (const wc of webContents.getAllWebContents()) {
    const pid = wc.getOSProcessId();
    if (!contents.has(pid)) contents.set(pid, []);
    contents.get(pid).push(wc.id);
  }
  const uiId = win && !win.isDestroyed() ? win.webContents.id : null;
  return {
    kind,
    processes: metrics.map((m) => ({
      type: m.type,
      bytes: bytes.get(m.pid) ?? 0,
      contents: contents.get(m.pid) ?? [],
      ui: (contents.get(m.pid) ?? []).includes(uiId),
    })),
  };
});
// Changes the language and returns the new messages for the page.
ipcMain.handle('language:set', (_e, language) => {
  if (!isLanguageSetting(language)) return i18nState();
  prefs.settings.language = language;
  savePrefs();
  updateTray();
  return i18nState();
});
ipcMain.handle('lists:save', (_e, lists) => {
  if (!Array.isArray(lists)) return;
  prefs.lists = lists;
  savePrefs();
});
ipcMain.handle('lists:pin', (_e, id) => {
  prefs.pinnedList = typeof id === 'string' ? id : null;
  savePrefs();
});
ipcMain.handle('presets:find', (_e, exe) => (typeof exe === 'string' && exe ? findPreset(exe.toLowerCase()) : null));
ipcMain.handle('presets:applied', (_e, exe) => {
  if (typeof exe !== 'string' || !exe || prefs.presetsApplied.includes(exe)) return;
  prefs.presetsApplied.push(exe);
  savePrefs();
});
ipcMain.handle('site:title', (_e, url) => fetchTitle(url));

// ---------- bookmark import ----------
//
// The page lists the browsers' bookmark sources (see bookmarks.js) and
// reads one of them, or an HTML file chosen with the system's file dialog.
// The page only gets the ids of the sources: it cannot make the main
// process read other files.

let bookmarkSources = [];

// { sources: [{ id, browser, profile }], denied: [browser] }: denied are the
// browsers whose data the system does not let the app read.
ipcMain.handle('bookmarks:sources', () => {
  let denied = [];
  try {
    ({ sources: bookmarkSources, denied } = bookmarks.listSources(platform.bookmarkStores()));
  } catch (err) {
    log(`bookmarks: cannot list the sources: ${err?.stack || err}`);
    bookmarkSources = [];
  }
  if (denied.length) log(`bookmarks: no access to the data of ${denied.join(', ')}`);
  return { sources: bookmarkSources.map(({ id, browser, profile }) => ({ id, browser, profile })), denied };
});
ipcMain.handle('bookmarks:read', (_e, id) => {
  const source = bookmarkSources.find((s) => s.id === id);
  if (!source) return { error: true };
  try {
    return { tree: bookmarks.readSource(source) };
  } catch (err) {
    log(`bookmarks: cannot read ${source.browser} (${source.file}): ${err?.stack || err}`);
    return { error: true, denied: bookmarks.isDenied(err) };
  }
});

// While a file dialog is open the overlay has no focus, but must not hide
// (see hideOnBlur); when it closes the overlay takes the focus back.
let fileDialogOpen = false;

async function withFileDialog(show) {
  fileDialogOpen = true;
  try {
    return await show();
  } finally {
    fileDialogOpen = false;
    if (win.isVisible()) win.focus();
  }
}

ipcMain.handle('bookmarks:file', async () => {
  const result = await withFileDialog(() => dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: t('bookmarks.fileFilter'), extensions: ['html', 'htm'] },
      { name: t('bookmarks.allFiles'), extensions: ['*'] },
    ],
  }));
  if (result.canceled || !result.filePaths[0]) return null;
  const file = result.filePaths[0];
  try {
    return { name: path.basename(file), tree: bookmarks.readHtmlFile(file) };
  } catch (err) {
    log(`bookmarks: cannot read ${file}: ${err?.stack || err}`);
    return { name: path.basename(file), error: true };
  }
});

// Export: the folders chosen by the page ([{ title, sites: [{ title, url }] }])
// saved as an HTML bookmark file where the user chooses. Returns null if
// the save dialog is cancelled.
ipcMain.handle('bookmarks:export', async (_e, folders) => {
  const html = bookmarks.toHtml(folders);
  if (!html) return { error: true };
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const result = await withFileDialog(() => dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), `overlay-browser-bookmarks-${date}.html`),
    filters: [{ name: t('bookmarks.fileFilter'), extensions: ['html'] }],
  }));
  if (result.canceled || !result.filePath) return null;
  try {
    fs.writeFileSync(result.filePath, html);
    log(`bookmarks: exported to ${result.filePath}`);
    return { ok: true };
  } catch (err) {
    log(`bookmarks: cannot write ${result.filePath}: ${err?.stack || err}`);
    return { error: true };
  }
});
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
  log(`platform ${platform.id}: ${Object.entries(platform.features).map(([k, v]) => `${k}=${v}`).join(' ')} ` +
    `opacity=${platform.opacity}`);

  win = new BrowserWindow({
    ...initialBounds(),
    minWidth: MIN_SIZE.width, minHeight: MIN_SIZE.height,
    frame: false, show: false,
    ...opacityOptions(),
    ...platform.windowOptions,
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
  win.on('blur', () => onOverlayBlur(win));
  trackBounds(win);
  platform.init(win);

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
  try { uiohook?.uIOhook.stop(); } catch { /* already stopped */ }
});
app.on('window-all-closed', () => app.quit());
