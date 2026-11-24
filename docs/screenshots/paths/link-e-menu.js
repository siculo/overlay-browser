// Percorso "Link, nuovi tab e menu contestuale" (docs/it/link-e-menu.md):
// i link che un sito apre in un nuovo tab (dello stesso sito: nel suo tab;
// di un altro sito: la richiesta di aggiungerlo), "Apri link in un nuovo
// tab" dal menu contestuale, e le voci del menu su un'immagine e in un campo
// di testo. Il sito è il forum d'esempio (sites/forum.js); il menu
// contestuale, nativo, è disegnato dalle sue voci (contextMenu in run.js).
const { expect } = require('@playwright/test');
const { start, serveSite, contextMenu, clearMenu, menuClick, GAME, tinyGladeList } = require('../run');
const { siteRect } = require('../annotate');
const { site } = require('../../../test/e2e/helpers');
const { HOST, URL: FORUM, PAGES } = require('../sites/forum');

const TOPIC = `${FORUM}discussione`;

module.exports = async () => {
  const lists = [tinyGladeList()];
  lists[0].sites.push(site(FORUM, 'Forum di Tiny Glade'));
  const o = await start('link-e-menu', { lists });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  const tabs = $('#tabs .tab');
  const forumTab = tabs.nth(3);   // dopo i tre di Tiny Glade
  const item = (label) => $('#doc-menu .item').filter({ hasText: label });
  const loaded = (url) => expect.poll(() => page.locator('#nav-url').inputValue()).toBe(url);
  try {
    await serveSite(o, HOST, PAGES);
    await o.show(GAME);
    await forumTab.click();
    await expect.poll(() => o.inSite(FORUM, (d) => !!d.getElementById('topic'))).toBe(true);
    await page.waitForTimeout(800);

    // 1. Un link che il sito apre in un nuovo tab.
    await shot('01-link', [{ el: await siteRect(o, FORUM, '#topic') }]);

    // 2. Dello stesso sito: si apre nel tab del sito.
    await o.inSite(FORUM, (d) => d.getElementById('topic').click());
    await loaded(TOPIC);
    await page.waitForTimeout(1000);
    await shot('02-stesso-tab', [
      { el: forumTab, n: 1, at: 'e' },
      { el: $('#nav-url'), n: 2, at: 's' },
    ]);

    // 3. Di un altro sito: la richiesta di aggiungerlo alla lista.
    await o.inSite(TOPIC, (d) => d.getElementById('external').click());
    await expect($('#dialog-ok')).toBeVisible();
    await shot('03-altro-sito', [{ el: $('#dialog-ok') }]);
    await $('#dialog-cancel').click();
    await expect($('#dialog')).toBeHidden();

    // 4. Il menu contestuale di un link.
    await contextMenu(o, TOPIC, '#other');
    await shot('04-menu-link', [
      { el: item('Apri link in un nuovo tab'), n: 1, at: 'e' },
      { el: item('Copia link'), n: 2, at: 'e' },
    ]);
    await clearMenu(o);

    // 5. Apri link in un nuovo tab: la conferma.
    await menuClick(o, 'Apri link in un nuovo tab');
    await expect($('#dialog-ok')).toBeVisible();
    await shot('05-conferma-tab', [{ el: $('#dialog-ok') }]);

    // 6. Il nuovo tab, subito dopo quello del forum.
    await $('#dialog-ok').click();
    await expect(tabs).toHaveCount(5);
    await page.waitForTimeout(2500);
    await shot('06-nuovo-tab', [{ el: tabs.nth(4) }]);

    // 7. Il menu di un'immagine e del testo.
    await forumTab.click();
    await loaded(TOPIC);
    await page.waitForTimeout(800);
    await contextMenu(o, TOPIC, '#picture');
    await shot('07-menu-immagine', [{ el: item('Copia immagine') }]);
    await clearMenu(o);

    // 8. Il menu di un campo di testo.
    await contextMenu(o, TOPIC, '#reply');
    await shot('08-menu-campo', [{ el: $('#doc-menu') }]);
    await clearMenu(o);
  } finally {
    await o.close();
  }
};
