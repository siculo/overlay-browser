const { test, expect } = require('@playwright/test');
const { launch } = require('./helpers');

test('starts, shows the Home and the version', async () => {
  const o = await launch();
  try {
    const { page } = o;
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#home-btn')).toHaveClass(/active/);
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings')).toBeVisible();
    const version = require('../../package.json').version;
    await expect(page.locator('#app-version')).toContainText(version);
  } finally {
    await o.close();
  }
});
