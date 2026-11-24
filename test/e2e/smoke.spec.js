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

test('opens the bundled guide in the overlay and follows the app language', async () => {
  const o = await launch();
  try {
    const { page } = o;
    const guide = page.frameLocator('#guide');
    const homeHeader = page.locator('#home-header');
    const guideButton = homeHeader.getByRole('button', { name: /^(User guide|Guida)$/ });
    await expect(homeHeader.getByRole('button', { name: 'User guide' })).toBeInViewport();
    const [header, logo, button] = await Promise.all([
      homeHeader.boundingBox(), homeHeader.locator('#app-logo').boundingBox(), guideButton.boundingBox(),
    ]);
    expect(button.x + button.width).toBeCloseTo(header.x + header.width);
    expect(button.y + button.height / 2).toBeCloseTo(logo.y + logo.height / 2);
    await guideButton.click();
    await expect(page.locator('#home')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Back to Home' })).toBeFocused();
    await expect(guide.locator('html')).toHaveAttribute('lang', 'en');
    const guideLogo = guide.locator('.brand img');
    await expect.poll(() => guideLogo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await guide.locator('#guides a[href="#getting-started"]').click();
    await guide.locator('#next').click();
    await guide.locator('#next').click();
    const screenshot = guide.locator('#slide figure img');
    await expect.poll(() => screenshot.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await screenshot.click();
    await expect(guide.locator('#zoom')).toBeVisible();
    await guide.locator('#zoom').click();
    await guide.locator('header a[href="#"]').click();
    await guide.locator('#guides a[href="#new-versions"]').click();
    await guide.locator('#next').click();
    await o.app.evaluate(({ shell }) => { shell.openExternal = async (url) => { global.guideExternalUrl = url; }; });
    await guide.locator('#slide a[href="../../README.md"]').click();
    await expect.poll(() => o.app.evaluate(() => global.guideExternalUrl))
      .toBe('https://github.com/siculo/overlay-browser/blob/main/README.md');

    await page.locator('#settings-btn').click();
    await expect(page.locator('#guide')).toBeHidden();
    await page.locator('#opt-language').selectOption('it');
    await page.locator('#opt-fixed-tabs').selectOption('icons');
    await page.locator('#home-btn').click();
    await expect(guideButton).toHaveText('Guida');
    await guideButton.click();
    await expect(guide.locator('html')).toHaveAttribute('lang', 'it');
    await expect(guide.locator('#menu')).toBeVisible();
    await guide.locator('#guides a[href="#getting-started"]').click();
    await page.getByRole('button', { name: 'Torna alla Home' }).click();
    await expect(page.locator('#guide')).toBeHidden();
    await expect(guideButton).toBeFocused();
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
