const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, net, screen, Tray } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const fs = require('fs');
const path = require('path');

// Siti proposti al primo avvio, finché l'utente non salva un proprio elenco.
const DEFAULT_SITES = [
  'https://scmdb.net/',
  'https://erkul.games/calculator',
  'https://starcitizen.tools',
].map((url) => ({ id: crypto.randomUUID(), url, title: null }));

const DEFAULT_SHORTCUT = 'F10';
const DEFAULT_SIZE = { width: 1000, height: 700 };
const MIN_SIZE = { width: 480, height: 320 };

// ---------- preferenze ----------

// Cartella dati fissa: senza questa riga l'app pacchettizzata userebbe il
// productName ("Overlay Browser") e non troverebbe le preferenze esistenti.
app.setPath('userData', path.join(app.getPath('appData'), 'overlay-browser'));

const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');
let prefs;

function loadPrefs() {
  let loaded = {};
  try {
    loaded = JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) || {};
  } catch {
    // File assente o corrotto: si riparte dai default.
  }
  return {
    sites: Array.isArray(loaded.sites) ? loaded.sites : DEFAULT_SITES,
    window: loaded.window ?? null,
    activeTab: typeof loaded.activeTab === 'string' ? loaded.activeTab : null,
    shortcut: typeof loaded.shortcut === 'string' && loaded.shortcut ? loaded.shortcut : DEFAULT_SHORTCUT,
  };
}

function savePrefs() {
  fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
  // Scrittura su file temporaneo + rename per non lasciare il JSON a metà.
  const tmp = prefsFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2));
  fs.renameSync(tmp, prefsFile());
}

// ---------- posizione e dimensione della finestra ----------

const isNum = (n) => Number.isFinite(n);

// La finestra è interamente visibile se sta tutta dentro l'area di lavoro
// (schermo meno barra delle applicazioni) di almeno un monitor.
function isFullyVisible(b) {
  return screen.getAllDisplays().some(({ workArea: w }) =>
    b.x >= w.x && b.y >= w.y &&
    b.x + b.width <= w.x + w.width &&
    b.y + b.height <= w.y + w.height);
}

// Posizione di default: centrata sul monitor principale, ridotta se lo schermo è piccolo.
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
  // Durante il trascinamento gli eventi arrivano a raffica: si salva a fine movimento.
  const schedule = () => { clearTimeout(timer); timer = setTimeout(store, 500); };
  win.on('move', schedule);
  win.on('resize', schedule);
  win.on('close', store);
}

// ---------- titolo dei siti ----------

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

// Legge il <title> della pagina. Restituisce null se il sito non risponde
// o non ha un titolo nell'HTML (es. app che lo impostano via JavaScript).
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

// ---------- scorciatoia globale ----------

let win;
let tray;              // riferimento globale: se venisse raccolto dal GC l'icona sparirebbe
let shortcut = null;   // scorciatoia attualmente registrata

// ---------- focus (API Win32 via koffi) ----------
//
// Windows impedisce a un'app in background di prendersi il focus, e Electron
// non può ridarlo alla finestra di un'altra app. Servono le API native:
// - alla comparsa si ricorda la finestra in primo piano (es. il gioco) e ci si
//   "aggancia" temporaneamente al suo input (AttachThreadInput), condizione
//   che Windows richiede per concedere SetForegroundWindow;
// - alla scomparsa si ridà il focus a quella finestra, PRIMA di nascondersi:
//   finché l'overlay è in primo piano Windows lo consente.

const win32 = (() => {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    koffi.pointer('HWND', koffi.opaque());
    const api = {
      koffi,
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
    console.error('API Win32 non disponibili, gestione del focus semplificata:', err);
    return null;
  }
})();

let previousForeground = null;   // finestra che aveva il focus prima dell'overlay

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
    // Si ricorda solo una finestra di un'altra applicazione.
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
  // Si restituisce il focus solo se ce l'aveva l'overlay: se l'utente nel
  // frattempo è passato a un'altra finestra, non va disturbato.
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

// La scorciatoia è intercettata in due modi (vedi sotto): quando funzionano
// entrambi arrivano due eventi per la stessa pressione, e va considerato solo il primo.
let lastShortcutToggle = 0;
function toggleFromShortcut() {
  const now = Date.now();
  if (now - lastShortcutToggle < 300) return;
  lastShortcutToggle = now;
  toggleWindow();
}

// ---------- hook di tastiera a basso livello ----------
//
// globalShortcut usa RegisterHotKey di Windows, che non scatta quando in primo
// piano c'è un gioco che legge la tastiera in modo esclusivo (es. Star Citizen).
// Un hook a basso livello vede i tasti prima del gioco. L'hook osserva soltanto:
// il tasto arriva comunque anche all'applicazione in primo piano.

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

// Converte un accelerator di Electron ("Ctrl+Shift+O") in { keycode, ctrl, alt, shift, meta }.
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

let hookCombo = null;        // combinazione cercata dall'hook
let hookSuspended = false;   // true mentre l'utente registra una nuova combinazione
let hookKeyDown = false;     // evita di ripetere il toggle tenendo premuto il tasto

// Log diagnostico in userData/overlay.log: avvio, registrazione della
// scorciatoia ed errori dell'hook. Non registra mai i tasti premuti.
const logFile = () => path.join(app.getPath('userData'), 'overlay.log');
function log(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  try {
    if (fs.statSync(logFile()).size > 512 * 1024) fs.writeFileSync(logFile(), '');
  } catch { /* file non ancora creato */ }
  try { fs.appendFileSync(logFile(), line); } catch { /* ignorato */ }
}

function setHookCombo(accelerator) {
  hookCombo = accelerator ? parseAccelerator(accelerator) : null;
  hookKeyDown = false;
  log(`hook: combinazione ${accelerator || 'nessuna'} -> ${hookCombo ? 'ok' : 'non riconosciuta'}`);
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
    log('hook: avviato');
  } catch (err) {
    log(`hook: ERRORE all'avvio: ${err}`);
  }
}

// ---------- icona nell'area di notifica ----------

const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');

function updateTray() {
  if (!tray) return;
  tray.setToolTip(shortcut ? `Overlay browser (${shortcut})` : 'Overlay browser');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: win.isVisible() ? 'Nascondi' : 'Mostra', accelerator: shortcut || undefined, click: toggleWindow },
    { label: 'Home', click: () => { showWindow(); win.webContents.send('nav:home'); } },
    { type: 'separator' },
    { label: 'Esci', click: () => app.quit() },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON_PATH));
  tray.on('click', toggleWindow);
  // Le voci del menu dipendono dallo stato della finestra e dalla scorciatoia.
  win.on('show', updateTray);
  win.on('hide', updateTray);
  updateTray();
}

// register() lancia un'eccezione se l'accelerator non è valido e restituisce
// false se la combinazione è già usata da un'altra applicazione.
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
  return { ok: false, shortcut: previous, error: `Impossibile usare ${accelerator}: combinazione non valida o già in uso.` };
}

// ---------- IPC ----------

ipcMain.handle('state:load', () => ({
  sites: prefs.sites,
  activeTab: prefs.activeTab,
  shortcut,
}));
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
// Mentre l'utente registra una nuova combinazione, quella attuale va sospesa,
// altrimenti premendola si nasconderebbe la finestra invece di catturarla.
ipcMain.handle('shortcut:suspend', (_e, suspended) => {
  hookSuspended = !!suspended;
  globalShortcut.unregisterAll();
  if (!suspended && shortcut) tryRegister(shortcut);
});

// ---------- avvio ----------

// Una sola istanza: due copie si contenderebbero la scorciatoia (la seconda
// non riuscirebbe a registrarla). Se l'app è già aperta, si mostra quella.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) showWindow(); });
  app.whenReady().then(start);
}

function start() {
  prefs = loadPrefs();
  log(`avvio (versione ${app.getVersion()}, ${app.isPackaged ? 'pacchettizzata' : 'sviluppo'})`);

  win = new BrowserWindow({
    ...initialBounds(),
    minWidth: MIN_SIZE.width, minHeight: MIN_SIZE.height,
    frame: false, show: false, opacity: 0.95,
    alwaysOnTop: true,
    skipTaskbar: true,   // niente icona nella barra delle applicazioni: si usa quella nell'area di notifica
    icon: ICON_PATH,
    webPreferences: {
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.once('ready-to-show', () => win.show());
  win.loadFile('index.html');
  trackBounds(win);

  if (tryRegister(prefs.shortcut)) shortcut = prefs.shortcut;
  else if (tryRegister(DEFAULT_SHORTCUT)) shortcut = DEFAULT_SHORTCUT;
  log(`globalShortcut: ${shortcut ? `registrata ${shortcut}` : `impossibile registrare ${prefs.shortcut}`}`);
  // L'hook usa comunque la combinazione scelta, anche se globalShortcut
  // non è riuscito a registrarla (es. già usata da un'altra applicazione).
  setHookCombo(shortcut || prefs.shortcut);
  startKeyboardHook();
  createTray();
}
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try { uIOhook.stop(); } catch { /* già fermo */ }
});
app.on('window-all-closed', () => app.quit());
