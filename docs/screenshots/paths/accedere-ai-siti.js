// Percorso "Accedere a un sito e i cookie" (docs/it/accedere-ai-siti.md):
// l'accesso a un sito con un account, nella finestra che il sito apre sopra
// l'overlay, poi l'eliminazione dei cookie del sito, che fa uscire
// dall'account. Il login vero non si può automatizzare: il sito è un forum
// d'esempio (forum.example, sites/forum.js) servito dallo script, il cui accesso funziona
// come quelli veri (window.open con le dimensioni della finestra, che
// comunica il risultato alla pagina che l'ha aperta).
const { expect } = require('@playwright/test');
const { start, serveSite, drawPopups, clearPopups, GAME, tinyGladeList } = require('../run');
const { siteRect } = require('../annotate');
const { site } = require('../../../test/e2e/helpers');

const { HOST, URL: FORUM, PAGES } = require('../sites/forum');

module.exports = async () => {
  const forum = site(FORUM, 'Forum di Tiny Glade');
  const lists = [tinyGladeList()];
  lists[0].sites.push(forum);
  const o = await start('accedere-ai-siti', { lists });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  const tab = $('#tabs .tab').filter({ hasText: 'Forum' });
  const popupCount = () => o.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().filter((w) => w.getParentWindow()).length);
  try {
    await serveSite(o, HOST, PAGES);
    await o.show(GAME);

    // 1. Il forum, senza accesso.
    await tab.click();
    await expect.poll(() => o.inSite(FORUM, (d) => !!d.getElementById('login'))).toBe(true);
    await page.waitForTimeout(800);
    const loginButton = () => siteRect(o, FORUM, '#login');
    await shot('01-forum', [{ el: await loginButton() }]);

    // 2. La finestra di accesso, sopra l'overlay.
    await o.inSite(FORUM, (d) => d.getElementById('login').click());
    await expect.poll(popupCount).toBe(1);
    await page.waitForTimeout(1500);
    await drawPopups(o);
    await shot('02-finestra-accesso', [{ el: $('#doc-popups .popup') }]);
    await clearPopups(o);

    // 3. L'accesso fatto: la finestra si chiude, la pagina mostra l'utente.
    await o.app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.getParentWindow());
      return w.webContents.executeJavaScript("document.getElementById('ok').click()");
    });
    await expect.poll(popupCount).toBe(0);
    await expect.poll(() => o.inSite(FORUM, (d) => d.getElementById('account').textContent)).toContain('Giocatore');
    await page.waitForTimeout(800);
    await shot('03-accesso-fatto', [{ el: await siteRect(o, FORUM, '#account') }]);

    // 4. Il menu "…": eliminare i cookie del sito.
    await $('#nav-more').click();
    await expect($('#nav-cookies')).toBeVisible();
    // Un solo riquadro: nell'angolo un numero coprirebbe "Fissa" o il menu.
    await shot('04-menu', [{ el: [$('#nav-more'), $('#nav-cookies')] }]);

    // 5. La conferma.
    await $('#nav-cookies').click();
    await expect($('#dialog-ok')).toBeVisible();
    await shot('05-conferma', [{ el: $('#dialog-ok') }]);

    // 6. Dopo l'eliminazione: la pagina ricaricata, senza accesso.
    await $('#dialog-ok').click();
    await expect.poll(() => o.inSite(FORUM, (d) => !!d.getElementById('login'))).toBe(true);
    await page.waitForTimeout(800);
    await shot('06-uscito', [{ el: await loginButton() }]);
  } finally {
    await o.close();
  }
};
