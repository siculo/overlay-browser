// Percorso "Primo avvio" (docs/it/getting-started.md): l'overlay aperto per la
// prima volta sopra Tiny Glade, due siti aggiunti alla sua lista.
const { expect } = require('@playwright/test');
const { start, tr, hideBanner, GAME } = require('../run');

const SITES = ['https://tinyglade.com', 'https://store.steampowered.com/app/2198150/'];

module.exports = async () => {
  const o = await start('getting-started');
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  const current = $('#lists section.list.current');
  const tabs = page.locator('#tabs .tab');
  try {
    // 1. Aperto sopra il gioco: la lista di Tiny Glade, ancora vuota.
    await o.show(GAME);
    await expect(page.locator('#lists section.list.current .name')).toHaveText('Tiny Glade');
    await shot('01-empty-home', [
      { el: current.locator('.list-head'), n: 1, at: 'w' },
      { el: $('#lists section.list:not(.current) .list-head'), n: 2, at: 'w' },
    ]);

    // 2. La finestra del "+".
    await page.locator('#add-tab').click();
    await page.locator('#add-input').fill(SITES[0]);
    await shot('02-add-site', [
      { el: $('#add-tab'), n: 1, at: 's' },
      { el: $('#add-input'), n: 2, at: 'w' },
      { el: $('#add-ok'), n: 3, at: 's' },
    ]);

    // 3. Il sito nel suo tab.
    await page.locator('#add-ok').click();
    await expect(tabs).toHaveCount(1);
    await page.waitForLoadState();
    await page.waitForTimeout(6000);
    await shot('03-site-open', [
      { el: tabs.first(), n: 1, at: 'e' },
      { el: [$('#nav-back'), $('#nav-forward'), $('#nav-reload')], n: 2, at: 's' },
      { el: $('#nav-url'), n: 3, at: 's' },
      { el: $('#nav-pin'), n: 4, at: 's' },
    ]);

    // 4. Un secondo sito, dalla Home.
    await page.locator('#home-btn').click();
    await page.locator('#lists section.list.current form.add input').fill(SITES[1]);
    await page.locator('#lists section.list.current form.add button').click();
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).not.toHaveText(/store.steampowered/, { timeout: 30000 });
    await page.locator('#home-btn').click();
    await page.waitForTimeout(3000);
    const row = current.locator('.site').first();
    await shot('04-home-with-sites', [
      { el: row.locator('.info'), n: 1, at: 'w' },
      { el: row.locator('button').nth(0), n: 2, at: 'n' },
      { el: row.locator('button').nth(1), n: 3, at: 'ne' },
      { el: current.locator('form.add'), n: 4, at: 's' },
    ]);

    // 5. Il secondo sito aperto: due tab nella barra.
    await tabs.nth(1).click();
    await page.waitForTimeout(3000);
    await hideBanner(o, 'https://store.steampowered.com', tr({ it: 'Rifiuta tutti', en: 'Reject All' }));
    await shot('05-two-tabs', [
      { el: tabs.nth(0), n: 1, at: 's' },
      { el: tabs.nth(1), n: 2, at: 's' },
    ]);
  } finally {
    await o.close();
  }
};
