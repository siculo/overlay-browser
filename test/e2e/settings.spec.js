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
  await o.close({ keepDir: true });
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

test('the shortcut is shown with the name of the Super key on this OS', async () => {
  o = await launch({ prefs: { shortcut: 'Super+F10' } });
  const { page } = o;
  await page.locator('#settings-btn').click();
  const label = { win32: 'Win+F10', darwin: 'Cmd+F10' }[process.platform] ?? 'Super+F10';
  await expect(page.locator('#shortcut')).toHaveText(label);
  // Only the label: the saved accelerator stays the one Electron reads.
  expect(await o.app.evaluate(() => global.overlayTest.prefs().shortcut)).toBe('Super+F10');
});

test('after recording a new shortcut the keyboard hook works again', async () => {
  o = await launch();
  const { page } = o;
  await page.locator('#settings-btn').click();
  await page.locator('#shortcut-change').click();
  await expect.poll(async () => (await o.test('hook')).suspended).toBe(true);
  // A key without modifiers other than F keys is refused: still recording.
  await page.keyboard.press('KeyQ');
  await expect(page.locator('#shortcut-hint')).not.toBeEmpty();
  await page.keyboard.press('Control+Alt+Shift+F9');
  await expect(page.locator('#shortcut-change')).toBeEnabled();
  // Whether or not another application holds the combination, the hook
  // is no longer suspended (it stayed off until restart, 0aa4e43).
  const hook = await o.test('hook');
  expect(hook.suspended).toBe(false);
  // Not on macOS, which has no keyboard hook.
  if (hook.available) expect(hook.combo).toBeTruthy();
});

test('Esc cancels the recording of the shortcut and resumes the hook', async () => {
  o = await launch();
  const { page } = o;
  await page.locator('#settings-btn').click();
  const before = await page.locator('#shortcut').textContent();
  await page.locator('#shortcut-change').click();
  await expect.poll(async () => (await o.test('hook')).suspended).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#shortcut')).toHaveText(before);
  expect((await o.test('hook')).suspended).toBe(false);
});
