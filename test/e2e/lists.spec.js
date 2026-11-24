// Site lists: preferences file, names, predefined lists, lists chosen by
// hand, closing tabs.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { launch, startServer, site, list } = require('./helpers');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.close(); });

let o;
test.afterEach(async () => { await o?.close(); o = null; });

const tabs = (page) => page.locator('#tabs .tab');
const current = (page) => page.locator('#lists section.list.current');

test('a corrupted preferences file: the app starts on the defaults and saves a valid one', async () => {
  o = await launch({ prefsText: '{"lists": [ {"id": "x", "sit' });
  const { page } = o;
  await expect(page.locator('#home')).toBeVisible();
  // The language is the system's again: the general list in any of them.
  const names = fs.readdirSync(path.join(__dirname, '..', '..', 'locales'))
    .map((f) => require(`../../locales/${f}`)['lists.general']);
  expect(names).toContain(await current(page).locator('.name').textContent());
  await current(page).locator('form.add input').fill(server.url('/First'));
  await current(page).locator('form.add button[type=submit]').click();
  await expect(tabs(page)).toHaveText(['First']);
  await expect.poll(() => o.savedPrefs().lists.flatMap((l) => l.sites.map((s) => s.title))).toEqual(['First']);
});

test('a list named after a window title takes the application name, a predefined one keeps its name', async () => {
  o = await launch({
    show: false,
    prefs: {
      lists: [
        list(null, []),
        list({ exe: 'idea' }, [site(server.url('/A'), 'A')], { name: 'my-project – Main.java' }),
        list({ exe: 'starcitizen' }, [site(server.url('/B'), 'B')], { name: 'My SC sites' }),
      ],
      presetsApplied: ['starcitizen'],
    },
  });
  const { page } = o;
  await o.show({ exe: 'idea', name: 'IntelliJ IDEA', title: 'my-project – Main.java' });
  await expect(current(page).locator('.name')).toHaveText('IntelliJ IDEA');
  await expect.poll(() => o.savedPrefs().lists[1].name).toBe('IntelliJ IDEA');

  await o.hide();
  await o.show({ exe: 'StarCitizen.exe', name: 'Star Citizen' });
  await expect(current(page).locator('.name')).toHaveText('My SC sites');
});

// Disabled with the predefined lists (PRESETS_ENABLED in main.js).
test.skip('a removed predefined list is only offered on the Home', async () => {
  o = await launch({ show: false, presets: true, prefs: { presetsApplied: ['starcitizen'] } });
  const { page } = o;
  const sc = { exe: 'StarCitizen.exe', name: 'Star Citizen' };
  await o.show(sc);
  await expect(page.locator('#preset')).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);

  // Declined: no longer offered in this session.
  await page.locator('#preset-dismiss').click();
  await expect(page.locator('#preset')).toBeHidden();
  await o.hide();
  await o.show(sc);
  await expect(page.locator('#preset')).toBeHidden();

  // Offered again after a restart, and loaded on request.
  await o.close({ keepDir: true });
  o = await launch({ dir: o.dir, show: false, presets: true });
  await o.show(sc);
  await expect(o.page.locator('#preset')).toBeVisible();
  await o.page.locator('#preset-use').click();
  const expected = require('../../lists/star-citizen.json').sites.length;
  await expect(tabs(o.page)).toHaveCount(expected);
  await expect(o.page.locator('#preset')).toBeHidden();
});

test('"Use" and "Back to" keep the Home shown; a list opened by the application resumes its last tab', async () => {
  const general = site(server.url('/General'), 'General');
  const game = site(server.url('/Game'), 'Game');
  const other = site(server.url('/Other'), 'Other');
  o = await launch({
    show: false,
    prefs: {
      lists: [
        list(null, [general], { activeTab: general.id }),
        list({ exe: 'game' }, [game], { name: 'Game', activeTab: game.id }),
        list({ exe: 'other' }, [other], { name: 'Other', activeTab: other.id }),
      ],
    },
  });
  const { page } = o;
  await o.show({ exe: 'game', name: 'Game' });
  await expect(tabs(page)).toHaveText(['Game']);
  await expect(tabs(page).first()).toHaveClass(/active/);
  // The page's favicon arriving redraws the Home: a click on "Use" just
  // then would land on a button already replaced.
  await expect(tabs(page).first().locator('img.favicon')).toBeVisible();

  await page.locator('#home-btn').click();
  await page.locator('#lists section.list:not(.current)', { hasText: 'General' }).locator('.list-head button', { hasText: 'Use' }).click();
  await expect(tabs(page)).toHaveText(['General']);
  await expect(page.locator('#home-btn')).toHaveClass(/active/);
  await expect(page.locator('#pinned')).toBeVisible();

  await page.locator('#pinned-restore').click();
  await expect(tabs(page)).toHaveText(['Game']);
  await expect(page.locator('#home-btn')).toHaveClass(/active/);

  // Opened over another application: its list, on its last tab.
  await o.hide();
  await o.show({ exe: 'other', name: 'Other' });
  await expect(tabs(page)).toHaveText(['Other']);
  await expect(tabs(page).first()).toHaveClass(/active/);
});

test('closing the active tab opens the next one, else the previous one, else Browse', async () => {
  const [a, b, c] = ['A', 'B', 'C'].map((n) => site(server.url('/' + n), n));
  o = await launch({ prefs: { lists: [list(null, [a, b, c], { activeTab: b.id })] } });
  const { page } = o;
  const close = async (name) => {
    await tabs(page).filter({ hasText: name }).locator('.close').click();
    await page.locator('#dialog-ok').click();
    await expect(page.locator('#dialog')).toBeHidden();
    await expect(tabs(page).filter({ hasText: name })).toHaveCount(0);
  };
  await expect(tabs(page).nth(1)).toHaveClass(/active/);
  await close('B');
  await expect(tabs(page)).toHaveText(['A', 'C']);
  await expect(tabs(page).filter({ hasText: 'C' })).toHaveClass(/active/);
  await close('C');
  await expect(tabs(page).filter({ hasText: 'A' })).toHaveClass(/active/);
  await close('A');
  await expect(tabs(page)).toHaveCount(0);
  await expect(page.locator('#browse-btn')).toHaveClass(/active/);
});

test('the site name follows its page title only on the site address', async () => {
  const doc = site(server.url('/Doc'), 'Doc');
  o = await launch({ prefs: { lists: [list(null, [doc], { activeTab: doc.id })] } });
  const { page } = o;
  const tab = tabs(page).first();
  await expect(tab).toHaveText('Doc');

  await o.inSite(server.url('/Doc'), (d) => { d.title = 'Renamed doc'; });
  await expect(tab).toHaveText('Renamed doc');
  // Query and fragment do not matter.
  await o.inSite(server.url('/Doc'), () => { history.pushState({}, '', '/Doc?tab=1#x'); document.title = 'Renamed again'; });
  await expect(tab).toHaveText('Renamed again');
  // Another page reached from the site does not rename it.
  await o.inSite(server.url('/Doc'), () => { location.href = '/Elsewhere'; });
  await expect(page.locator('#nav-url')).toHaveValue(server.url('/Elsewhere'));
  await page.waitForTimeout(500);
  await expect(tab).toHaveText('Renamed again');
  await expect.poll(() => o.savedPrefs().lists[0].sites[0].title).toBe('Renamed again');
});

test('no bar button keeps the focus when the tab changes by itself', async () => {
  const g = site(server.url('/G'), 'G');
  o = await launch({ show: false, prefs: { lists: [list(null, []), list({ exe: 'game' }, [g], { name: 'Game', activeTab: g.id })] } });
  const { page } = o;
  await o.show(null);
  await page.locator('#settings-btn').click();
  // Focus on a bar button (as with the Tab key).
  await page.locator('#settings-btn').focus();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('settings-btn');
  await o.hide();
  await o.show({ exe: 'game', name: 'Game' });
  await expect(tabs(page).first()).toHaveClass(/active/);
  expect(await page.evaluate(() => !!document.activeElement?.closest('#bar'))).toBe(false);
});
