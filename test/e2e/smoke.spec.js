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
    await expect(page.locator('#home #app-repo')).toBeVisible();
    await expect(page.locator('#home #app-update')).toBeHidden();
  } finally {
    await o.close();
  }
});

// The native reading of the cursor (platform.cursorState), which the
// shortcut uses: here the cursor is the desktop's, visible. Unknown on macOS.
test('the platform reads the state of the mouse cursor', async () => {
  const o = await launch();
  try {
    const cursor = await o.test('platformCursor');
    if (process.platform === 'darwin') {
      expect(cursor).toBeNull();
    } else {
      expect(cursor).toMatchObject({ hidden: false });
      // Linux: confinement not checked (null).
      if (process.platform === 'linux') expect(cursor.clipped).toBeNull();
      else expect(typeof cursor.clipped).toBe('boolean');
    }
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
