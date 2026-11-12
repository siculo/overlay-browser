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
// Opzioni della pagina Impostazioni (solo booleane per ora): chiave -> default.
const DEFAULT_SETTINGS = {
  hideOnBlur: true,   // nasconde l'overlay quando perde il focus
};
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
    settings: loadSettings(loaded.settings),
  };
}

// Tiene solo le chiavi note con il tipo giusto; le altre prendono il default.
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
  // Scrittura su file temporaneo + rename per non lasciare il JSON a metà.
  const tmp = prefsFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2));
  fs.renameSync(tmp, prefsFile());
}

// ---------- posizione e dimensione della finestra ----------

const isNum = (n) => Number.isFinite(n);

// La finestra è interamente visibile se sta tutta dentro lo schermo di almeno
// un monitor. Si usa lo schermo intero e non l'area di lavoro, perché sopra un
// gioco la finestra può legittimamente coprire anche la barra delle applicazioni.
function isFullyVisible(b) {
  return screen.getAllDisplays().some(({ bounds: w }) =>
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

// ---------- aggancio ai bordi con la barra delle applicazioni nascosta ----------
//
// Aggancio ai lati (Aero Snap) e massimizzazione usano l'area di lavoro del
// monitor, che esclude sempre la barra delle applicazioni. Se però l'overlay è
// stato aperto sopra una finestra che copre tutto il monitor (gioco a schermo
// intero o senza bordi), la barra non è visibile: in quel caso la finestra
// agganciata/massimizzata viene estesa a tutto lo schermo.

function classNameOf(hwnd) {
  const buf = Buffer.alloc(512);
  const n = win32.GetClassNameW(hwnd, buf, 256);
  return buf.toString('utf16le', 0, n * 2);
}

// true se la finestra da cui si è aperto l'overlay copre l'intero monitor.
function fullscreenAppBelow(display) {
  if (!win32 || !previousForeground || !win32.IsWindow(previousForeground)) return false;
  // Il desktop copre tutto lo schermo ma non nasconde la barra.
  if (['Progman', 'WorkerW', 'Shell_TrayWnd'].includes(classNameOf(previousForeground))) return false;
  const r = {};
  if (!win32.GetWindowRect(previousForeground, r)) return false;
  // GetWindowRect è in pixel fisici, i display di Electron in DIP.
  const dip = screen.screenToDipRect(null, { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top });
  const b = display.bounds;
  return dip.x <= b.x + 1 && dip.y <= b.y + 1 &&
    dip.x + dip.width >= b.x + b.width - 1 && dip.y + dip.height >= b.y + b.height - 1;
}

const near = (a, b, tol = 4) => Math.abs(a - b) <= tol;
const sameRect = (a, b) => a && b && near(a.x, b.x, 1) && near(a.y, b.y, 1) &&
  near(a.width, b.width, 1) && near(a.height, b.height, 1);

// Riconosce le posizioni di aggancio di Windows: metà, terzi, quarti.
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

let expandedBounds = null;   // ultimo ridimensionamento fatto da noi (evita di ripeterlo)
let restoreBounds = null;    // dimensioni da ripristinare uscendo dallo stato esteso
let lastFreeBounds = null;   // ultime dimensioni "libere", cioè non agganciate né estese
// Trascinando verso l'alto, Windows segnala la massimizzazione PRIMA della fine
// del trascinamento: quell'evento 'moved' arriva subito dopo, con le dimensioni
// intermedie, e va ignorato per non annullare lo stato appena impostato.
let ignoreMovedUntil = 0;

// Riporta un rettangolo dentro lo schermo (trascinando verso l'alto per
// massimizzare, le dimensioni "normali" possono restare in parte fuori).
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
    // Finestra estesa che si sta trascinando: non è una dimensione "libera".
    if (expandedBounds && near(bounds.width, expandedBounds.width, 1) &&
        near(bounds.height, expandedBounds.height, 1)) return;
    expandedBounds = null;
    restoreBounds = null;
    lastFreeBounds = bounds;
    return;
  }
  if (sameRect(wa, b) || !fullscreenAppBelow(display)) return;
  // Proporzione lineare dall'area di lavoro allo schermo intero: metà e
  // quarti restano tali, ma occupano anche lo spazio della barra.
  const mapX = (x) => b.x + Math.round((x - wa.x) * b.width / wa.width);
  const mapY = (y) => b.y + Math.round((y - wa.y) * b.height / wa.height);
  const x = mapX(bounds.x), y = mapY(bounds.y);
  // Da un aggancio all'altro si conservano le dimensioni di partenza.
  if (!restoreBounds) restoreBounds = lastFreeBounds;
  expandedBounds = {
    x, y,
    width: mapX(bounds.x + bounds.width) - x,
    height: mapY(bounds.y + bounds.height) - y,
  };
  win.setBounds(expandedBounds);
}

// La massimizzazione si sostituisce con un ridimensionamento a tutto schermo;
// ripetendola (es. doppio clic sulla barra) si torna alle dimensioni precedenti.
function onMaximize() {
  const normal = win.getNormalBounds();
  const display = screen.getDisplayMatching(normal);
  const b = display.bounds;
  if (sameRect(display.workArea, b) || !fullscreenAppBelow(display)) return;

  let target;
  if (restoreBounds && sameRect(normal, b)) {
    target = clampToDisplay(restoreBounds, b);   // era già a tutto schermo: si ripristina
    expandedBounds = null;
    restoreBounds = null;
  } else {
    // Se era già esteso (es. metà schermo) si conservano le dimensioni originali.
    if (!restoreBounds) restoreBounds = clampToDisplay(normal, b);
    target = { ...b };
    expandedBounds = target;
  }
  // unmaximize() è asincrono: Windows ripristina le dimensioni normali dopo la
  // chiamata e sovrascriverebbe un setBounds immediato. Si applicano quindi le
  // dimensioni a ripristino avvenuto, ricontrollando poco dopo.
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

// Sgancio all'inizio del trascinamento, come fa Windows con le finestre
// massimizzate. Al primo spostamento da uno stato esteso la finestra torna
// alle dimensioni precedenti sotto il cursore; da lì in poi è l'app a
// posizionarla seguendo il cursore, perché il ciclo di trascinamento di Windows
// continuerebbe a calcolare la posizione sulla finestra grande. L'aggancio ai
// bordi resta di Windows (dipende dalla posizione del cursore).
let unsnapDrag = null;   // { width, height, anchorX, anchorY } durante lo sgancio

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
    // Un eventuale nuovo aggancio a fine trascinamento ricorderà queste dimensioni.
    lastFreeBounds = { ...restore };
    expandedBounds = null;
    restoreBounds = null;
  }
  // Electron, se l'evento è annullato, restituisce a Windows la posizione
  // corrente della finestra: quella appena impostata qui sotto.
  e.preventDefault();
  win.setBounds({
    x: cursor.x - unsnapDrag.anchorX,
    y: cursor.y - unsnapDrag.anchorY,
    width: unsnapDrag.width,
    height: unsnapDrag.height,
  });
}

// Riserva, se lo sgancio all'inizio non è avvenuto:
// trascinando via la finestra da uno stato esteso (tutto schermo o aggancio),
// Windows non la rimpicciolisce perché per lui è una finestra normale: lo si fa
// a fine trascinamento, tornando alle dimensioni precedenti all'aggancio e
// lasciando il cursore nello stesso punto relativo della barra.
function onMoved() {
  if (unsnapDrag) {        // sgancio già gestito durante il trascinamento
    unsnapDrag = null;
    return;
  }
  if (!expandedBounds || Date.now() < ignoreMovedUntil) return;
  const cur = win.getBounds();
  const sameSize = near(cur.width, expandedBounds.width, 1) && near(cur.height, expandedBounds.height, 1);
  // Dimensioni cambiate (es. trascinata in un altro aggancio): se ne occupa
  // expandSnapToFullScreen, che conserva restoreBounds se è ancora agganciata.
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
  // Dopo la fine del ciclo di trascinamento di Windows, che altrimenti
  // potrebbe annullare il ridimensionamento.
  setTimeout(() => { if (!win.isDestroyed()) win.setBounds(final); }, 0);
}

function trackSnap() {
  let timer = null;
  // Si attende la fine dell'animazione di aggancio prima di correggere.
  const schedule = () => { clearTimeout(timer); timer = setTimeout(expandSnapToFullScreen, 300); };
  win.on('move', schedule);
  win.on('resize', schedule);
  win.on('maximize', onMaximize);
  win.on('will-move', onWillMove);
  win.on('moved', onMoved);
}

// Quando l'overlay perde il focus (clic su un'altra finestra, Alt+Tab...) si
// nasconde. Il focus in quel caso è già altrove, quindi hideWindow non lo sposta.
let lastBlurHide = 0;
function hideOnBlur() {
  if (!prefs.settings.hideOnBlur || !win.isVisible()) return;
  lastBlurHide = Date.now();
  hideWindow();
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
    { label: 'Impostazioni', click: () => { showWindow(); win.webContents.send('nav:settings'); } },
    { type: 'separator' },
    { label: 'Esci', click: () => app.quit() },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON_PATH));
  tray.on('click', () => {
    // Cliccando l'icona con l'overlay aperto, la finestra perde prima il focus
    // e si nasconde (vedi 'blur'): il clic non deve riaprirla subito dopo.
    if (!win.isVisible() && Date.now() - lastBlurHide < 500) return;
    toggleWindow();
  });
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
  settings: prefs.settings,
}));
ipcMain.handle('settings:set', (_e, key, value) => {
  if (!(key in DEFAULT_SETTINGS) || typeof value !== typeof DEFAULT_SETTINGS[key]) return;
  prefs.settings[key] = value;
  savePrefs();
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
  win.loadFile('index.html');
  win.on('blur', hideOnBlur);
  trackBounds(win);
  if (win32) trackSnap();

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
