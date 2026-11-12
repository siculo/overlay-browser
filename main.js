const { app, BrowserWindow, globalShortcut, ipcMain, net, screen } = require('electron');
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
let shortcut = null;   // scorciatoia attualmente registrata

function toggleWindow() {
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
}

// register() lancia un'eccezione se l'accelerator non è valido e restituisce
// false se la combinazione è già usata da un'altra applicazione.
function tryRegister(accelerator) {
  try {
    return globalShortcut.register(accelerator, toggleWindow);
  } catch {
    return false;
  }
}

function setShortcut(accelerator) {
  const previous = shortcut;
  globalShortcut.unregisterAll();
  if (tryRegister(accelerator)) {
    shortcut = accelerator;
    prefs.shortcut = accelerator;
    savePrefs();
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
  globalShortcut.unregisterAll();
  if (!suspended && shortcut) tryRegister(shortcut);
});

// ---------- avvio ----------

app.whenReady().then(() => {
  prefs = loadPrefs();

  win = new BrowserWindow({
    ...initialBounds(),
    minWidth: MIN_SIZE.width, minHeight: MIN_SIZE.height,
    frame: false, show: false, opacity: 0.95,
    alwaysOnTop: true,
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
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
