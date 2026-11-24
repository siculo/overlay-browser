// Percorso "Una lista per ogni gioco" (docs/it/lists-per-game.md): le liste
// di Tiny Glade e di Brotato, la lista Generale, una lista scelta a mano,
// tab riordinati, una lista rimossa.
const { expect } = require('@playwright/test');
const { start, t, GAME, BROTATO, tinyGladeList } = require('../run');

const SITES = ['https://brotato.wiki.spellsandguns.com/', 'https://store.steampowered.com/app/1942280/'];

module.exports = async () => {
  const o = await start('lists-per-game', {
    // La lista di Tiny Glade come al termine delle guide precedenti.
    lists: [tinyGladeList()],
  });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  const tabs = $('#tabs .tab');
  const current = $('#lists section.list.current');
  const other = (name) => $('#lists section.list:not(.current)').filter({ has: page.locator('.list-head .name', { hasText: name }) });
  try {
    // 1. Sopra Brotato: la sua lista, nuova.
    await o.show(BROTATO);
    await expect(current.locator('.name')).toHaveText('Brotato');
    await shot('01-brotato-new', [
      { el: current.locator('.list-head'), n: 1, at: 'w' },
      { el: current.locator('form.add'), n: 2, at: 's' },
      { el: other('Tiny Glade').locator('.list-head'), n: 3, at: 'w' },
    ]);

    // 2. Due siti nella lista di Brotato.
    for (const url of SITES) {
      await current.locator('form.add input').fill(url);
      await current.locator('form.add button').click();
      await $('#home-btn').click();
    }
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).not.toHaveText(/store\.steampowered/, { timeout: 30000 });
    await tabs.first().click();
    await page.waitForTimeout(4000);
    await shot('02-brotato-wiki', [{ el: [tabs.nth(0), tabs.nth(1)] }]);

    // 3. Di nuovo sopra Tiny Glade: i suoi tab.
    await o.hide();
    await o.show(GAME);
    await expect(tabs).toHaveCount(3);
    await $('#home-btn').click();
    await page.waitForTimeout(1500);
    await shot('03-tiny-glade', [
      { el: [tabs.nth(0), tabs.nth(2)], n: 1, at: 's' },
      { el: current.locator('.list-head'), n: 2, at: 'w' },
      { el: other('Brotato').locator('.list-head'), n: 3, at: 'w' },
      { el: other('Brotato').locator('.list-head button', { hasText: t('lists.use') }), n: 4, at: 's' },
    ]);

    // 4. Nessun gioco: la lista Generale.
    await o.hide();
    await o.show(null);
    await $('#home-btn').click();
    await expect(current.locator('.name')).toHaveText(t('lists.general'));
    await shot('04-general', [{ el: current.locator('.list-head') }]);

    // 5. Una lista scelta a mano: Usa.
    await o.hide();
    await o.show(GAME);
    await $('#home-btn').click();
    await other('Brotato').locator('.list-head button', { hasText: t('lists.use') }).click();
    await page.mouse.move(990, 690);   // il puntatore sottolineerebbe il nome di una lista
    await expect($('#pinned')).toBeVisible();
    await expect(current.locator('.name')).toHaveText('Brotato');
    await page.waitForTimeout(1500);
    await shot('05-chosen-by-hand', [
      { el: $('#pinned'), n: 1, at: 's' },
      { el: [tabs.nth(0), tabs.nth(1)], n: 2, at: 's' },
    ]);
    await $('#pinned-restore').click();
    await expect(current.locator('.name')).toHaveText('Tiny Glade');

    // 6. Tab riordinati trascinandoli: la Wiki trascinata verso sinistra.
    await page.waitForTimeout(1000);
    const from = await tabs.nth(2).boundingBox();
    const to = await tabs.nth(0).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(from.x + from.width / 2 + (to.x + 20 - from.x - from.width / 2) * i / 10, from.y + from.height / 2);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(400);
    await shot('06-drag', [{ el: tabs.filter({ hasText: 'Wiki' }) }]);
    await page.mouse.up();
    await expect(tabs.first()).toHaveText(/Wiki/);

    // 7. Rimuovere una lista.
    await page.waitForTimeout(800);
    await other('Brotato').locator('.list-head button', { hasText: t('lists.remove') }).click();
    await expect($('#dialog-ok')).toBeVisible();
    await shot('07-remove-list', [{ el: $('#dialog-ok') }]);
    await $('#dialog-ok').click();
    await expect(other('Brotato')).toHaveCount(0);
  } finally {
    await o.close();
  }
};
