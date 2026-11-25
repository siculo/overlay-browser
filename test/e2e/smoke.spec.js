const { test, expect } = require('@playwright/test');
const { launch } = require('./helpers');

test('starts, shows the Home and the version at its top', async () => {
  const o = await launch();
  try {
    const { page } = o;
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#home-btn')).toHaveClass(/active/);
    const version = require('../../package.json').version;
    await expect(page.locator('#home #app-name')).toHaveText('overlay browser');
    await expect(page.locator('#home #app-logo')).toHaveJSProperty('complete', true);
    expect(await page.locator('#home #app-logo').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('#home #app-version')).toContainText(version);
    await expect(page.locator('#home #about-btn')).toBeVisible();
    await expect(page.locator('#home #app-update')).toBeHidden();
  } finally {
    await o.close();
  }
});

test('the About dialog shows version and system, opens the project links and copies the information', async () => {
  const o = await launch();
  try {
    const { page, app } = o;
    const version = require('../../package.json').version;
    const dialog = page.locator('#about-dialog');
    await expect(dialog).toBeHidden();
    await page.click('#home #about-btn');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#about-version')).toContainText(version);
    const electronVersion = await app.evaluate(() => process.versions.electron);
    await expect(page.locator('#about-system')).toContainText(`Electron ${electronVersion}`);
    await expect(page.locator('#about-update')).toBeHidden();
    await expect(page.locator('#about-close')).toBeFocused();

    // The links are opened by main.js by name (not in test mode: only logged).
    await page.click('#about-dialog a[data-link="issues"]');
    const logFile = require('path').join(o.dir, 'overlay.log');
    await expect.poll(() => require('fs').readFileSync(logFile, 'utf8')).toContain('ui: about: issues link opened');

    await app.evaluate(({ clipboard }) => clipboard.writeText(''));
    await page.click('#about-copy');
    await expect(page.locator('#about-copy')).toHaveText('Copied');
    const text = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(text).toContain(`Overlay Browser ${version}`);
    expect(text).toContain(`Electron ${electronVersion}`);

    // A newer version shows in the dialog too.
    await o.test('send', 'update:available', { version: '99.0.0', url: 'https://example.com/', dismissed: false });
    await expect(page.locator('#about-update-link')).toContainText('99.0.0');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Reopened: the copy button is back to its label.
    await page.click('#home #about-btn');
    await expect(page.locator('#about-copy')).toHaveText('Copy information');
    await page.click('#about-close');
    await expect(dialog).toBeHidden();
  } finally {
    await o.close();
  }
});

test('a newer version shows on the Home, also once its strip is closed', async () => {
  const o = await launch();
  try {
    const { page } = o;
    const update = { version: '99.0.0', url: 'https://example.com/', dismissed: false };
    await o.test('send', 'update:available', update);
    await expect(page.locator('#update')).toBeVisible();
    await expect(page.locator('#home #app-update-link')).toBeVisible();
    await expect(page.locator('#home #app-update-link')).toContainText('99.0.0');
    await o.test('send', 'update:available', { ...update, dismissed: true });
    await expect(page.locator('#update')).toBeHidden();
    await expect(page.locator('#home #app-update-link')).toBeVisible();
    await o.test('send', 'update:available', null);
    await expect(page.locator('#home #app-update')).toBeHidden();
  } finally {
    await o.close();
  }
});
