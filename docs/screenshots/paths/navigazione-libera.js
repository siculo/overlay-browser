// Percorso "Navigazione libera e Fissa" (docs/it/navigazione-libera.md):
// una ricerca nel tab Naviga, la pagina trovata fissata come tab della
// lista di Tiny Glade.
const { expect } = require('@playwright/test');
const { start, hideBanner, GAME } = require('../run');
const { siteRect } = require('../annotate');
const { site, list } = require('../../../test/e2e/helpers');

const WIKI = 'https://tinyglade.wiki.gg/';

module.exports = async () => {
  const o = await start('navigazione-libera', {
    // DuckDuckGo: Google risponde alle ricerche automatiche con un captcha.
    settings: { searchEngine: 'duckduckgo' },
    // La lista creata nel percorso "Primo avvio".
    lists: [list({ exe: 'tiny-glade' }, [
      site('https://tinyglade.com/', 'Tiny Glade'),
      site('https://store.steampowered.com/app/2198150/', 'Tiny Glade su Steam'),
    ], { name: 'Tiny Glade' })],
  });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  const tabs = $('#tabs .tab');
  try {
    // 1. Il tab Naviga, vuoto.
    await o.show(GAME);
    await $('#browse-btn').click();
    await expect($('#browse-suggest')).toBeVisible();
    await shot('01-naviga', [
      { el: $('#browse-btn'), n: 1, at: 's', len: 50 },
      { el: $('#nav-url'), n: 2, at: 's' },
      { el: $('#browse-suggest'), n: 3, at: 's' },
    ]);

    // 2. I risultati della ricerca.
    await $('#nav-url').fill('tiny glade wiki');
    await $('#nav-url').press('Enter');
    await expect($('#nav-url')).toHaveValue(/duckduckgo\.com/);
    await page.waitForTimeout(4000);
    await shot('02-risultati', [
      { el: $('#nav-url'), n: 1, at: 's' },
      { el: await siteRect(o, 'https://duckduckgo.com', 'a', 'Tiny Glade Wiki'), n: 2, at: 'e' },
    ]);

    // 3. La pagina trovata: Fissa.
    await o.inSite('https://duckduckgo.com', (d) =>
      [...d.querySelectorAll('a')].find((a) => a.textContent.includes('Tiny Glade Wiki')).click());
    await expect($('#nav-url')).toHaveValue(new RegExp('^' + WIKI));
    await page.waitForTimeout(3000);
    await hideBanner(o, WIKI, 'Abbiamo a cuore la tua privacy');
    await shot('03-pagina-trovata', [
      { el: $('#nav-back'), n: 1, at: 's' },
      { el: $('#nav-pin'), n: 2, at: 's' },
    ]);

    // 4. La conferma.
    await $('#nav-pin').click();
    await expect($('#dialog-ok')).toBeVisible();
    await shot('04-conferma', [{ el: $('#dialog-ok') }]);

    // 5. Il nuovo tab della lista.
    await $('#dialog-ok').click();
    await expect(tabs).toHaveCount(3);
    await expect($('#nav-pin')).toBeDisabled();
    await page.waitForTimeout(1500);
    await shot('05-fissata', [
      { el: tabs.nth(2), n: 1, at: 's' },
      { el: $('#nav-pin'), n: 2, at: 's' },
    ]);

    // 6. Il tab Naviga di nuovo vuoto.
    await $('#browse-btn').click();
    await page.waitForTimeout(1000);
    await shot('06-naviga-di-nuovo', [
      { el: $('#nav-site'), n: 1, at: 's' },
    ]);
  } finally {
    await o.close();
  }
};
