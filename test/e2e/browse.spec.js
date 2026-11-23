// Free browsing tab: addresses, searches, Pin; popups opened by the sites.
const { test, expect } = require('@playwright/test');
const { launch, startServer, site, list } = require('./helpers');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.close(); });

let o;
test.afterEach(async () => { await o?.close(); o = null; });

const tabs = (page) => page.locator('#tabs .tab');

test('Browse opens an address, Pin turns the page into a tab of the list', async () => {
  o = await launch();
  const { page } = o;
  await page.locator('#browse-btn').click();
  await expect(page.locator('#browse-btn')).toHaveClass(/active/);
  await page.locator('#nav-url').fill(server.url('/Found'));
  await page.locator('#nav-url').press('Enter');
  expect(await o.inSite(server.url('/Found'), (d) => d.title)).toBe('Found');

  await expect(page.locator('#nav-pin')).toBeEnabled();
  await page.locator('#nav-pin').click();
  await page.locator('#dialog-ok').click();
  await expect(tabs(page)).toHaveText(['Found']);
  await expect(tabs(page).first()).toHaveClass(/active/);
  // On the address of a tab of the list, Pin is disabled.
  await expect(page.locator('#nav-pin')).toBeDisabled();
  await expect.poll(() => o.savedPrefs().lists[0].sites.map((s) => s.url)).toEqual([server.url('/Found')]);
});

test('Browse searches text with the chosen engine', async () => {
  o = await launch({ prefs: { settings: { searchEngine: 'custom', searchCustom: server.url('/search?q=%s') } } });
  const { page } = o;
  await page.locator('#browse-btn').click();
  await page.locator('#nav-url').fill('wiki of my game');
  await page.locator('#nav-url').press('Enter');
  await expect(page.locator('#nav-url')).toHaveValue(server.url('/search?q=wiki%20of%20my%20game'));
});

test('a window.open with features opens a popup window above the overlay', async () => {
  const start = server.url(`/Login?open=${encodeURIComponent('/Popup')}`);
  o = await launch({ prefs: { lists: [list(null, [site(start, 'Login')])] } });
  const { page, app } = o;
  await tabs(page).first().click();
  await expect(page.locator('#nav-url')).toHaveValue(start);
  // A popup with window features, as "Continue with Google" does.
  await o.inSite(start, () => { window.open('/Popup', 'login', 'width=400,height=300'); });
  const popup = () => app.evaluate(({ BrowserWindow }) => {
    const [main] = BrowserWindow.getAllWindows().filter((w) => !w.getParentWindow());
    const child = main.getChildWindows()[0];
    return child && { visible: child.isVisible(), onTop: child.isAlwaysOnTop(), url: child.webContents.getURL() };
  });
  await expect.poll(popup).toEqual({ visible: true, onTop: true, url: server.url('/Popup') });

  // Hidden and shown again with the overlay.
  await o.hide();
  await expect.poll(async () => (await popup()).visible).toBe(false);
  await o.show();
  await expect.poll(async () => (await popup()).visible).toBe(true);
});
