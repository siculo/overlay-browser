// Percorso "Navigazione libera e Fissa" (docs/it/free-browsing.md):
// una ricerca nel tab Naviga, la pagina trovata fissata come tab della
// lista di Tiny Glade.
const { expect } = require('@playwright/test');
const { start, tr, hideBanner, GAME } = require('../run');
const { siteRect } = require('../annotate');
const { site, list } = require('../../../test/e2e/helpers');

const WIKI = 'https://tinyglade.wiki.gg/';

module.exports = async () => {
  const o = await start('free-browsing', {
    // DuckDuckGo: Google risponde alle ricerche automatiche con un captcha.
    settings: { searchEngine: 'duckduckgo' },
    // La lista creata nel percorso "Primo avvio".
    lists: [list({ exe: 'tiny-glade' }, [
      site('https://tinyglade.com/', 'Tiny Glade'),
      site('https://store.steampowered.com/app/2198150/', tr({ it: 'Tiny Glade su Steam', en: 'Tiny Glade on Steam' })),
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
    await shot('01-browse', [
      { el: $('#browse-btn'), n: 1, at: 's', len: 50 },
      { el: $('#nav-url'), n: 2, at: 's' },
      { el: $('#browse-suggest'), n: 3, at: 's' },
    ]);

    // 2. I risultati della ricerca.
    await $('#nav-url').fill('tiny glade wiki');
    await $('#nav-url').press('Enter');
    await expect($('#nav-url')).toHaveValue(/duckduckgo\.com/);
    await page.waitForTimeout(4000);
    await shot('02-results', [
      { el: $('#nav-url'), n: 1, at: 's' },
      { el: await siteRect(o, 'https://duckduckgo.com', 'a', 'Tiny Glade Wiki'), n: 2, at: 'e' },
    ]);

    // 3. La pagina trovata: Fissa.
    await o.inSite('https://duckduckgo.com', (d) =>
      [...d.querySelectorAll('a')].find((a) => a.textContent.includes('Tiny Glade Wiki')).click());
    await expect($('#nav-url')).toHaveValue(new RegExp('^' + WIKI));
    await page.waitForTimeout(3000);
    await hideBanner(o, WIKI, tr({ it: 'Abbiamo a cuore la tua privacy', en: 'We value your privacy' }));
    await shot('03-page-found', [
      { el: $('#nav-back'), n: 1, at: 's' },
      { el: $('#nav-pin'), n: 2, at: 's' },
    ]);

    // 4. La conferma.
    await $('#nav-pin').click();
    await expect($('#dialog-ok')).toBeVisible();
    await shot('04-confirm', [{ el: $('#dialog-ok') }]);

    // 5. Il nuovo tab della lista.
    await $('#dialog-ok').click();
    await expect(tabs).toHaveCount(3);
    await expect($('#nav-pin')).toBeDisabled();
    await page.waitForTimeout(1500);
    await shot('05-pinned', [
      { el: tabs.nth(2), n: 1, at: 's' },
      { el: $('#nav-pin'), n: 2, at: 's' },
    ]);

    // 6. Il tab Naviga di nuovo vuoto.
    await $('#browse-btn').click();
    await page.waitForTimeout(1000);
    await shot('06-browse-again', [
      { el: $('#nav-site'), n: 1, at: 's' },
    ]);
  } finally {
    await o.close();
  }
};
