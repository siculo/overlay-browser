// Percorso "Memoria e pagine chiuse" (docs/it/memoria.md): la chiusura
// delle pagine non usate e la sezione Memoria delle Impostazioni, con le
// pagine aperte delle liste di Tiny Glade e di Brotato.
const { expect } = require('@playwright/test');
const { start, hideBanner, GAME, BROTATO } = require('../run');
const { site, list } = require('../../../test/e2e/helpers');

module.exports = async () => {
  const o = await start('memoria', {
    // Le liste come al termine delle guide precedenti.
    lists: [
      list({ exe: 'tiny-glade' }, [
        site('https://tinyglade.com/', 'Tiny Glade'),
        site('https://store.steampowered.com/app/2198150/', 'Tiny Glade su Steam'),
        site('https://tinyglade.wiki.gg/', 'Tiny Glade Wiki'),
      ], { name: 'Tiny Glade' }),
      list({ exe: 'brotato.x86_64' }, [
        site('https://brotato.wiki.spellsandguns.com/', 'Brotato Wiki'),
        site('https://store.steampowered.com/app/1942280/', 'Brotato su Steam'),
      ], { name: 'Brotato' }),
    ],
  });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  const tabs = $('#tabs .tab');
  const group = (name) => $('#memory-table tr.group').filter({ hasText: name });
  // Apre uno dopo l'altro i tab della lista attiva.
  const openTabs = async (n) => {
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(3000);
    }
  };
  try {
    // Pagine aperte in entrambe le liste.
    await o.show(BROTATO);
    await openTabs(2);
    await o.hide();
    await o.show(GAME);
    await openTabs(3);

    // 1. La chiusura delle pagine non usate.
    await $('#settings-btn').click();
    await page.evaluate(() => {
      const h = document.querySelector('#settings h2[data-i18n="settings.memory"]');
      h.scrollIntoView({ block: 'start' });
      h.closest('#settings').scrollTop -= 16;
    });
    await expect(group('Tiny Glade')).toBeVisible();
    await page.waitForTimeout(2500);
    await shot('01-memoria', [
      { el: $('#opt-unload'), n: 1, at: 'n' },
      { el: $('#memory-total'), n: 2, at: 'w' },
      { el: $('#memory-close-all'), n: 3, at: 'n' },
      { el: [$('#memory-table tr').first(), $('#memory-table tr.own-end')], n: 4, at: 'w' },
      { el: [group('Tiny Glade'), group('Brotato')], n: 5, at: 'w' },
    ]);

    // 2. Il gruppo di Tiny Glade aperto: una riga per pagina.
    await group('Tiny Glade').click();
    await page.mouse.move(990, 690);   // il puntatore sottolineerebbe il nome del gruppo
    await expect($('#memory-table tr.in-group').first()).toBeVisible();
    await page.waitForTimeout(2500);
    await shot('02-pagine', [
      { el: group('Tiny Glade').locator('button'), n: 1, at: 'e' },
      { el: $('#memory-table tr.in-group button').first(), n: 2, at: 'e' },
    ]);

    // 3. Le pagine di Brotato chiuse.
    await group('Brotato').locator('button').click();
    await page.mouse.move(990, 690);
    await expect(group('Brotato')).toHaveCount(0);
    await page.waitForTimeout(2500);
    await shot('03-chiuse');
  } finally {
    await o.close();
  }
};
