// Schermate del percorso "Primo avvio" (docs/it/primo-avvio.md).
// Avvia l'app vera con una cartella dati temporanea (come i test UI),
// la apre sopra Tiny Glade (simulato) e salva le schermate in docs/it/img/.
// Usa la rete: i siti mostrati sono reali.
//   npm run docs:screenshots
const path = require('path');
const { expect } = require('@playwright/test');
const { launch } = require('../../test/e2e/helpers');
const { annotate, clearAnnotations } = require('./annotate');

const OUT = path.join(__dirname, '..', 'it', 'img');
const GAME = { exe: 'tiny-glade', name: 'Tiny Glade', title: 'Tiny Glade' };
const SITES = ['https://tinyglade.com', 'https://store.steampowered.com/app/2198150/'];

(async () => {
  const o = await launch({ prefs: { settings: { language: 'it' } }, show: false });
  const { page } = o;
  // Schermata con le evidenziazioni `marks` (vedi annotate.js).
  const shot = async (name, marks = []) => {
    await page.waitForTimeout(500);
    await annotate(page, marks);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    await clearAnnotations(page);
    console.log(name);
  };
  const $ = (sel) => page.locator(sel);
  const current = $('#lists section.list.current');
  const tabs = page.locator('#tabs .tab');
  try {
    // 1. Aperto sopra il gioco: la lista di Tiny Glade, ancora vuota.
    await o.show(GAME);
    await expect(page.locator('#lists section.list.current .name')).toHaveText('Tiny Glade');
    await shot('01-home-vuota', [
      { el: current.locator('.list-head'), n: 1, at: 'w' },
      { el: $('#lists section.list:not(.current) .list-head'), n: 2, at: 'w' },
    ]);

    // 2. La finestra del "+".
    await page.locator('#add-tab').click();
    await page.locator('#add-input').fill(SITES[0]);
    await shot('02-aggiungi-sito', [
      { el: $('#add-tab'), n: 1, at: 's' },
      { el: $('#add-input'), n: 2, at: 'w' },
      { el: $('#add-ok'), n: 3, at: 's' },
    ]);

    // 3. Il sito nel suo tab.
    await page.locator('#add-ok').click();
    await expect(tabs).toHaveCount(1);
    await page.waitForLoadState();
    await page.waitForTimeout(6000);
    await shot('03-sito-aperto', [
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
    await shot('04-home-con-siti', [
      { el: row.locator('.info'), n: 1, at: 'w' },
      { el: row.locator('button').nth(0), n: 2, at: 'n' },
      { el: row.locator('button').nth(1), n: 3, at: 'ne' },
      { el: current.locator('form.add'), n: 4, at: 's' },
    ]);

    // 5. Il secondo sito aperto: due tab nella barra.
    await tabs.nth(1).click();
    await page.waitForTimeout(3000);
    // Il banner dei cookie di Steam copre la pagina: nascosto (solo per la schermata).
    await o.inSite('https://store.steampowered.com', async (d) => {
      for (let i = 0; i < 50 && !d.querySelector('#rejectAllButton'); i++) await new Promise((r) => setTimeout(r, 200));
      let e = d.querySelector('#rejectAllButton');
      while (e && e.parentElement !== d.body) e = e.parentElement;
      e?.remove();
    });
    await page.waitForTimeout(1500);
    await shot('05-due-tab', [
      { el: tabs.nth(0), n: 1, at: 's' },
      { el: tabs.nth(1), n: 2, at: 's' },
    ]);
  } finally {
    await o.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
