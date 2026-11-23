// Helpers of the UI tests: the app started on a temporary data folder
// (OVERLAY_TEST_DIR, see main.js) with the given preferences, and a local
// web server with test pages, so that no test depends on the network.
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Preferences of a test: English, the overlay does not hide when it loses
// the focus (the test windows may take it), plus what the test gives.
function testPrefs({ settings, ...rest } = {}) {
  return {
    settings: { language: 'en', hideOnBlur: false, checkUpdates: false, verboseLog: true, ...settings },
    ...rest,
  };
}

// Starts the app. `dir`: data folder to reuse (to restart the app on the
// same preferences), otherwise a new one with `prefs`.
async function launch({ prefs, dir, foregroundApp = null, show = true } = {}) {
  if (!dir) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-e2e-'));
    fs.writeFileSync(path.join(dir, 'prefs.json'), JSON.stringify(testPrefs(prefs)));
  }
  const env = { ...process.env, OVERLAY_TEST_DIR: dir };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [ROOT], env });
  const page = await app.firstWindow();
  // Errors of the overlay's page fail the test when the app is closed
  // (a broken script often leaves the page apparently working).
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  await page.waitForLoadState('domcontentloaded');
  const overlay = {
    app, page, dir, pageErrors,
    // Shows the overlay as the shortcut does, opened over `fgApp`
    // ({ exe, name, title }, null = no application).
    async show(fgApp = foregroundApp) {
      await app.evaluate((_e, a) => { global.overlayTest.foregroundApp = a; global.overlayTest.show(); }, fgApp);
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
    },
    hide: () => app.evaluate(() => global.overlayTest.hide()),
    // The preferences as saved on disk.
    savedPrefs: () => JSON.parse(fs.readFileSync(path.join(dir, 'prefs.json'), 'utf8')),
    // Runs `fn(document)` in the page of a site's webview (the one whose
    // address starts with `urlPrefix`, waited for up to 10 s once loaded),
    // from the main process. Returns what `fn` returns (it must be
    // serializable).
    async inSite(urlPrefix, fn) {
      return app.evaluate(async ({ webContents }, { prefix, code }) => {
        for (let i = 0; i < 100; i++) {
          const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().startsWith(prefix));
          if (wc && !wc.isLoading()) return wc.executeJavaScript(`(${code})(document)`);
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`no webview on ${prefix}`);
      }, { prefix: urlPrefix, code: fn.toString() });
    },
    async close({ keepDir = false } = {}) {
      await app.close();
      if (!keepDir) fs.rmSync(dir, { recursive: true, force: true });
      expect(pageErrors, 'errors in the overlay page').toEqual([]);
    },
  };
  if (show) await overlay.show();
  return overlay;
}

// Local web server: GET /<name> returns a page titled <name>, with links
// and scripts given by the query: ?blank=/<other> adds a target=_blank
// link (#blank), ?open=/<other> a button that calls window.open (#open).
// /icon.png is a favicon.
const ICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

async function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/icon.png' || url.pathname === '/favicon.ico') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(ICON);
      return;
    }
    const name = decodeURIComponent(url.pathname.slice(1)) || 'index';
    const blank = url.searchParams.get('blank');
    const open = url.searchParams.get('open');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><title>${name}</title><link rel="icon" href="/icon.png"></head>
<body><h1 id="name">${name}</h1>
${blank ? `<a id="blank" href="${blank}" target="_blank">blank</a>` : ''}
${open ? `<button id="open" onclick="window.open('${open}')">open</button>` : ''}
</body></html>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, url: (p) => base + p, close: () => new Promise((r) => server.close(r)) };
}

// A list as saved in the preferences.
let nextId = 0;
const site = (url, title = null) => ({ id: `site-${++nextId}`, url, title });
// It opens on the Home unless `activeTab` says otherwise.
const list = (match, sites, extra = {}) => ({ id: `list-${++nextId}`, name: null, match, sites, activeTab: ':home', ...extra });

module.exports = { launch, startServer, site, list, testPrefs };
