// Operations on the site pages: context menu, cookies, tabs' width.
const { test, expect } = require('@playwright/test');
const { launch, startServer, site, list } = require('./helpers');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.close(); });

let o;
test.afterEach(async () => { await o?.close(); o = null; });

const tabs = (page) => page.locator('#tabs .tab');

// Replaces the native menu: the context menus (the menus shown with
// popup(), not the tray's) are recorded with their labels and clicks in
// global.testMenus instead of being shown.
const recordMenus = (app) => app.evaluate(({ Menu }) => {
  global.testMenus = [];
  const build = Menu.buildFromTemplate.bind(Menu);
  Menu.buildFromTemplate = (template) => {
    const menu = build(template);
    menu.popup = () => { global.testMenus.push(template); };
    return menu;
  };
});
const lastMenuLabels = (app) => app.evaluate(() => global.testMenus.at(-1)?.map((i) => i.label ?? '-') ?? null);

// Right click at the center of the element `selector` of a site page.
async function rightClick(o, urlPrefix, selector) {
  const { x, y } = await o.inSite(urlPrefix, new Function('d', `const r = d.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };`));
  await o.app.evaluate(({ webContents }, { prefix, x, y }) => {
    const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().startsWith(prefix));
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 });
  }, { prefix: urlPrefix, x, y });
}

test('context menu of a link: "Open link in new tab" adds it after the tab it comes from', async () => {
  const start = server.url(`/Start?blank=${encodeURIComponent('/Linked')}`);
  const a = site(start, 'Start');
  o = await launch({ prefs: { lists: [list(null, [a, site(server.url('/Last'), 'Last')], { activeTab: a.id })] } });
  const { page, app } = o;
  await expect(page.locator('#nav-url')).toHaveValue(start);
  await recordMenus(app);

  await rightClick(o, start, '#blank');
  await expect.poll(() => lastMenuLabels(app)).toEqual(['Open link in new tab', 'Copy link', '-', 'Copy', 'Select All']);
  await rightClick(o, start, '#name');
  await expect.poll(() => lastMenuLabels(app)).toEqual(['Copy', 'Select All']);

  // The click on the item of the link's menu.
  await app.evaluate(() => global.testMenus.at(-2)[0].click());
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialog-ok').click();
  await expect(tabs(page)).toHaveText(['Start', 'Linked', 'Last']);
  await expect(tabs(page).nth(1)).toHaveClass(/active/);
});

test('context menu of the overlay page: only on text fields and selections', async () => {
  o = await launch();
  const { page, app } = o;
  await recordMenus(app);
  await page.locator('#add-tab').click();
  await page.locator('#add-input').click({ button: 'right' });
  await expect.poll(() => lastMenuLabels(app)).toEqual(['Undo', 'Redo', '-', 'Cut', 'Copy', 'Paste', 'Select All']);
  await page.locator('#add-cancel').click();
  const count = await app.evaluate(() => global.testMenus.length);
  // A button without text: on macOS a right click selects the word under
  // the pointer, and a selection has its menu.
  await page.locator('#add-tab').click({ button: 'right' });
  await page.waitForTimeout(300);
  expect(await app.evaluate(() => global.testMenus.length)).toBe(count);
});

test('"Delete the cookies" removes those of the page\'s domain only', async () => {
  const a = site(server.url('/A'), 'A');
  o = await launch({ prefs: { lists: [list(null, [a], { activeTab: a.id })] } });
  const { page, app } = o;
  await o.inSite(server.url('/A'), (d) => { d.cookie = 'mine=1; max-age=3600'; });
  // A cookie of another site (localhost), set from the main process.
  await app.evaluate(({ session }, url) => session.defaultSession.cookies.set({ url, name: 'other', value: '1', expirationDate: Date.now() / 1000 + 3600 }),
    server.base.replace('127.0.0.1', 'localhost'));
  const names = () => app.evaluate(async ({ session }) => (await session.defaultSession.cookies.get({})).map((c) => c.name).sort());
  await expect.poll(names).toEqual(['mine', 'other']);

  await page.locator('#nav-more').click();
  await expect(page.locator('#nav-cookies')).toContainText('127.0.0.1');
  await page.locator('#nav-cookies').click();
  await page.locator('#dialog-ok').click();
  await expect.poll(names).toEqual(['other']);
});

test('tabs have the same width, which does not change with the title', async () => {
  const sites = ['A', 'A much longer name of a site', 'C'].map((n) => site(server.url('/' + n.replaceAll(' ', '-')), n));
  o = await launch({ prefs: { lists: [list(null, sites, { activeTab: sites[1].id })] } });
  const { page } = o;
  const widths = () => tabs(page).evaluateAll((ts) => ts.map((t) => Math.round(t.getBoundingClientRect().width)));
  await expect(tabs(page)).toHaveCount(3);
  // Laid out (the tabs can be measured before the window is).
  await expect.poll(async () => Math.min(...await widths())).toBeGreaterThan(0);
  const before = await widths();
  expect(new Set(before).size).toBe(1);
  await o.inSite(sites[1].url, (d) => { d.title = 'X'; });
  await expect(tabs(page).nth(1)).toHaveText('X');
  expect(await widths()).toEqual(before);
});

test('with many tabs they shrink and the scroll arrows appear', async () => {
  const sites = Array.from({ length: 30 }, (_, i) => site(server.url(`/S${i}`), `Site ${i}`));
  o = await launch({ prefs: { lists: [list(null, sites)] } });
  const { page } = o;
  await expect(page.locator('#right')).toBeVisible();
  await expect(page.locator('#left')).toBeDisabled();
  const w = await tabs(page).first().evaluate((t) => t.getBoundingClientRect().width);
  expect(w).toBeGreaterThanOrEqual(63);
  expect(w).toBeLessThan(300);
  await page.locator('#right').click();
  await expect(page.locator('#left')).toBeEnabled();
});
