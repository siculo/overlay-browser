// Settings page: options applied at once and saved.
const { test, expect } = require('@playwright/test');
const { launch } = require('./helpers');

let o;
test.afterEach(async () => { await o?.close(); o = null; });

test('accent color, fixed tabs and language are applied and kept', async () => {
  o = await launch();
  const { page } = o;
  await page.locator('#settings-btn').click();

  await page.locator('#accents [data-accent="blue"]').click();
  await expect(page.locator('#accents [data-accent="blue"]')).toHaveAttribute('aria-checked', 'true');
  const accent = () => o.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  const blue = await accent();
  expect(blue).not.toBe('');

  await page.locator('#opt-fixed-tabs').selectOption('icons');
  await expect(page.locator('body')).toHaveClass(/fixed-icons/);

  await page.locator('#opt-language').selectOption('it');
  const it = require('../../locales/it.json');
  await expect(page.locator('#home-btn .label')).toHaveText(it['bar.home']);

  await expect.poll(() => o.savedPrefs().settings).toMatchObject({ accent: 'blue', fixedTabs: 'icons', language: 'it' });
  await o.app.close();
  o = await launch({ dir: o.dir });
  await expect(o.page.locator('body')).toHaveClass(/fixed-icons/);
  await expect(o.page.locator('#home-btn .label')).toHaveText(it['bar.home']);
  await expect.poll(accent).toBe(blue);
});

test('the "hide when it loses focus" option reaches the main process', async () => {
  o = await launch({ prefs: { settings: { hideOnBlur: false } } });
  const { page, app } = o;
  await page.locator('#settings-btn').click();
  await expect(page.locator('#opt-hide-on-blur')).not.toBeChecked();
  await page.locator('#opt-hide-on-blur').check();
  await expect.poll(() => o.savedPrefs().settings.hideOnBlur).toBe(true);
  expect(await app.evaluate(() => global.overlayTest.prefs().settings.hideOnBlur)).toBe(true);
});

test('invalid values in the preferences file fall back to the defaults', async () => {
  o = await launch({ prefs: { settings: { accent: 'nope', opacity: 5, unloadAfter: 1000, fixedTabs: 42 } } });
  expect(await o.app.evaluate(() => global.overlayTest.prefs().settings)).toMatchObject({
    accent: 'amber', opacity: 0.95, unloadAfter: 30, fixedTabs: 'labels',
  });
  await expect(o.page.locator('#home')).toBeVisible();
});
