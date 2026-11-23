const { test, expect } = require('@playwright/test');
const { launch } = require('./helpers');

test('starts, shows the Home and the version at its top', async () => {
  const o = await launch();
  try {
    const { page } = o;
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#home-btn')).toHaveClass(/active/);
    const version = require('../../package.json').version;
    await expect(page.locator('#home #app-version')).toContainText(`Overlay Browser ${version}`);
    await expect(page.locator('#home #app-repo')).toBeVisible();
    await expect(page.locator('#home #app-update')).toBeHidden();
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
