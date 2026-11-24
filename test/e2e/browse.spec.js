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

test('"Open link in new tab" over an application whose list does not exist yet creates it', async () => {
  o = await launch({ show: false });
  const { page } = o;
  await o.show({ exe: 'newgame', name: 'New Game' });
  await page.locator('#browse-btn').click();
  await page.locator('#nav-url').fill(server.url('/From'));
  await page.locator('#nav-url').press('Enter');
  expect(await o.inSite(server.url('/From'), (d) => d.title)).toBe('From');

  // What main.js sends for the context menu's "Open link in new tab".
  const id = await o.contentsId(server.url('/From'));
  await o.test('send', 'site:openNew', server.url('/Linked'), id);
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialog-ok').click();
  await expect(tabs(page)).toHaveText(['Linked']);
  await expect.poll(() => o.savedPrefs().lists.find((l) => l.match?.exe === 'newgame')?.sites.map((s) => s.url))
    .toEqual([server.url('/Linked')]);

  // A link already in the list shows its tab, without asking.
  await page.locator('#browse-btn').click();
  await o.test('send', 'site:openNew', server.url('/Linked'), id);
  await expect(tabs(page).first()).toHaveClass(/active/);
  await expect(page.locator('#dialog')).toBeHidden();
  await expect(tabs(page)).toHaveCount(1);
});

test('an address typed while the start page is still loading is opened', async () => {
  o = await launch({ prefs: { settings: { browseStart: server.url('/Slow?delay=3000') } } });
  const { page } = o;
  await page.locator('#browse-btn').click();
  await page.locator('#nav-url').fill(server.url('/Typed'));
  // Enter moves focus to the loading webview. Playwright's press() can
  // time out even after the guest has finished navigating to /Typed.
  await page.locator('#nav-url').dispatchEvent('keydown', { key: 'Enter' });
  expect(await o.inSite(server.url('/Typed'), (d) => d.title)).toBe('Typed');
  // The start page arriving later does not replace it.
  await page.waitForTimeout(3500);
  await expect(page.locator('#nav-url')).toHaveValue(server.url('/Typed'));
});

test('the tab of the page shown in Browse is highlighted, also after an in-page navigation', async () => {
  const known = site(server.url('/Known/'), 'Known');
  o = await launch({ prefs: { lists: [list(null, [site(server.url('/A'), 'A'), known])] } });
  const { page } = o;
  await page.locator('#browse-btn').click();
  await page.locator('#nav-url').fill(server.url('/Start'));
  await page.locator('#nav-url').press('Enter');
  expect(await o.inSite(server.url('/Start'), (d) => d.title)).toBe('Start');
  await expect(page.locator('#nav-pin')).toBeEnabled();
  await expect(page.locator('#tabs .tab.match')).toHaveCount(0);

  // pushState to the tab's address (without the final "/", with a fragment).
  await o.inSite(server.url('/Start'), () => { history.pushState({}, '', '/Known#part'); });
  await expect(page.locator('#tabs .tab.match')).toHaveText('Known');
  await expect(page.locator('#nav-pin')).toBeDisabled();
});

test('in a site tab the address is editable and the site home button works after Browse', async () => {
  const a = site(server.url('/A'), 'A');
  o = await launch({ prefs: { lists: [list(null, [a])] } });
  const { page } = o;
  // Browse without a start page: its "back to the start page" button.
  await page.locator('#browse-btn').click();
  await tabs(page).first().click();
  await expect(page.locator('#nav-url')).toHaveValue(server.url('/A'));
  await expect(page.locator('#nav-url')).toBeEditable();
  await expect(page.locator('#nav-site')).toBeEnabled();

  await o.inSite(server.url('/A'), () => { location.href = '/Deeper'; });
  await expect(page.locator('#nav-url')).toHaveValue(server.url('/Deeper'));
  await page.locator('#nav-site').click();
  await expect(page.locator('#nav-url')).toHaveValue(server.url('/A'));
});

test('an address typed in a site tab opens there on the same host, in Browse on another after confirming', async () => {
  const a = site(server.url('/A'), 'A');
  o = await launch({ prefs: { lists: [list(null, [a], { activeTab: a.id })] } });
  const { page } = o;
  const url = page.locator('#nav-url');
  expect(await o.inSite(server.url('/A'), (d) => d.title)).toBe('A');

  // Same host: the tab's page goes there, without asking.
  await url.fill(server.url('/Same'));
  await url.press('Enter');
  await expect(url).toHaveValue(server.url('/Same'));
  await expect(page.locator('#dialog')).toBeHidden();
  await expect(tabs(page).first()).toHaveClass(/active/);

  // Another host (localhost instead of 127.0.0.1): asks; cancelled, nothing
  // opens and the typed text stays.
  const other = server.url('/Other').replace('127.0.0.1', 'localhost');
  await url.fill(other);
  await url.press('Enter');
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialog-cancel').click();
  await expect(url).toHaveValue(other);
  await expect(tabs(page).first()).toHaveClass(/active/);

  // Confirmed: it opens in Browse, the site tab keeps its page.
  await url.press('Enter');
  await page.locator('#dialog-ok').click();
  await expect(page.locator('#browse-btn')).toHaveClass(/active/);
  await expect.poll(() => o.contentsId(other)).not.toBeNull();
  await tabs(page).first().click();
  await expect(url).toHaveValue(server.url('/Same'));
});
