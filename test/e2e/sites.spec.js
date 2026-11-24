// Site lists and tabs: adding sites, the tab following its page, the list
// of the application the overlay is opened over, persistence.
const { test, expect } = require('@playwright/test');
const { launch, startServer, site, list } = require('./helpers');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.close(); });

let o;
test.afterEach(async () => { await o?.close(); o = null; });

const tabs = (page) => page.locator('#tabs .tab');

test('a site added with "+" opens in a tab named after its page, and is kept', async () => {
  o = await launch();
  const { page } = o;
  await page.locator('#add-tab').click();
  await expect(page.locator('#add-dialog')).toBeVisible();
  await page.locator('#add-input').fill(server.url('/Wiki'));
  await page.locator('#add-ok').click();
  await expect(page.locator('#add-dialog')).toBeHidden();

  await expect(tabs(page)).toHaveCount(1);
  await expect(tabs(page).first()).toHaveClass(/active/);
  await expect(tabs(page).first()).toHaveText('Wiki');
  await expect(tabs(page).first().locator('img.favicon')).toHaveAttribute('src', /^data:image\/png/);
  expect(await o.inSite(server.url('/Wiki'), (d) => d.title)).toBe('Wiki');
  await expect(page.locator('#nav-url')).toHaveValue(server.url('/Wiki'));

  // Saved in the general list, and still there after a restart.
  await expect.poll(() => o.savedPrefs().lists.find((l) => l.match === null)?.sites.map((s) => s.title))
    .toEqual(['Wiki']);
  await o.close({ keepDir: true });
  o = await launch({ dir: o.dir });
  await expect(tabs(o.page)).toHaveText(['Wiki']);
  // The list opens on its last tab.
  await expect(tabs(o.page).first()).toHaveClass(/active/);
});

test('an address that is not http(s) is refused', async () => {
  o = await launch();
  const { page } = o;
  await page.locator('#add-tab').click();
  await page.locator('#add-input').fill('ftp://files.example.com/');
  await page.locator('#add-ok').click();
  await expect(page.locator('#add-error')).not.toBeEmpty();
  await expect(page.locator('#add-dialog')).toBeVisible();
  await page.locator('#add-cancel').click();
  await expect(page.locator('#add-dialog')).toBeHidden();
  await expect(tabs(page)).toHaveCount(0);
});

// normalizeUrl used to take text with spaces as the host
// https://not%20an%20address/.
test('text with spaces is not taken as an address', async () => {
  o = await launch();
  const { page } = o;
  await page.locator('#add-tab').click();
  await page.locator('#add-input').fill('not an address');
  await page.locator('#add-ok').click();
  await expect(page.locator('#add-error')).not.toBeEmpty();
});

test('each application has its own list, created with its first site', async () => {
  o = await launch({
    prefs: { lists: [list(null, [site(server.url('/General'), 'General')])] },
    show: false,
  });
  const { page } = o;
  const game = { exe: 'MyGame.exe', name: 'My Game', title: 'My Game window' };

  await o.show(game);
  // New, still empty list of the game: current, on the Home.
  const current = page.locator('#lists section.list.current');
  await expect(current.locator('.name')).toHaveText('My Game');
  await expect(current.locator('.detail')).toContainText('mygame');
  await expect(tabs(page)).toHaveCount(0);

  await current.locator('form.add input').fill(server.url('/GameWiki'));
  await current.locator('form.add button[type=submit]').click();
  await expect(tabs(page)).toHaveText(['GameWiki']);
  await expect.poll(() => o.savedPrefs().lists.find((l) => l.match?.exe === 'mygame')?.name).toBe('My Game');

  // Over no application: the general list.
  await o.hide();
  await o.show(null);
  await expect(tabs(page)).toHaveText(['General']);
  await o.hide();
  await o.show(game);
  await expect(tabs(page)).toHaveText(['GameWiki']);
});

// Disabled with the predefined lists (PRESETS_ENABLED in main.js).
test.skip('the predefined list of a known game is loaded the first time', async () => {
  o = await launch({ show: false, presets: true });
  await o.show({ exe: 'StarCitizen.exe', name: 'Star Citizen' });
  const expected = require('../../lists/star-citizen.json').sites.length;
  await expect(tabs(o.page)).toHaveCount(expected);
  await expect.poll(() => o.savedPrefs().presetsApplied).toEqual(['starcitizen']);
});

test('with the predefined lists disabled, none is loaded or offered', async () => {
  const sc = { exe: 'StarCitizen.exe', name: 'Star Citizen' };
  // First time over the game: nothing is loaded.
  o = await launch({ show: false });
  await o.show(sc);
  await o.page.waitForTimeout(500);   // time for the lookup's answer
  await expect(tabs(o.page)).toHaveCount(0);
  await expect(o.page.locator('#preset')).toBeHidden();
  expect(o.savedPrefs().presetsApplied ?? []).toEqual([]);
  await o.close();

  // Loaded before and then removed: not offered on the Home.
  o = await launch({ show: false, prefs: { presetsApplied: ['starcitizen'] } });
  await o.show(sc);
  await o.page.waitForTimeout(500);
  await expect(o.page.locator('#preset')).toBeHidden();
});

test('a target=_blank link to the same site opens in its tab, to another site asks first', async () => {
  // localhost and 127.0.0.1 are two different sites.
  const other = server.url('/Other').replace('127.0.0.1', 'localhost');
  const next = `/Next?blank=${encodeURIComponent(other)}`;
  const start = server.url(`/Start?blank=${encodeURIComponent(next)}`);
  o = await launch({ prefs: { lists: [list(null, [site(start, 'Start')])] } });
  const { page } = o;
  await tabs(page).first().click();
  await expect(page.locator('#nav-url')).toHaveValue(start);

  // Same site: the tab goes to the link.
  await o.inSite(start, (d) => d.getElementById('blank').click());
  await expect(page.locator('#nav-url')).toHaveValue(server.url(next));
  await expect(tabs(page)).toHaveCount(1);

  // Another site: added as a new tab after a confirmation.
  await o.inSite(server.url('/Next'), (d) => d.getElementById('blank').click());
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialog-ok').click();
  await expect(tabs(page)).toHaveText(['Start', 'Other']);
  await expect(tabs(page).nth(1)).toHaveClass(/active/);
});
