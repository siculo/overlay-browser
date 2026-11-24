// Percorso "Importare ed esportare i bookmark" (docs/it/importa-bookmark.md):
// i bookmark di Brotato importati da un browser nella sua lista, il "+" con
// i bookmark, l'export delle liste in un file.
// I bookmark sono di esempio: finti profili di browser nella cartella dati
// temporanea (bookmark-stores.json, come nei test), mai quelli veri.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { start, BROTATO, tinyGladeList } = require('../run');

const url = (name, u) => ({ type: 'url', name, url: u });
const folder = (name, children) => ({ type: 'folder', name, children });

// Profili Chromium: { browser: { profilo: { bar, other } } }.
const BROWSERS = {
  'Google Chrome': {
    Personale: {
      bar: [
        folder('Giochi', [
          folder('Brotato', [
            url('Brotato Wiki', 'https://brotato.wiki.spellsandguns.com/'),
            url('Brotato su Steam', 'https://store.steampowered.com/app/1942280/'),
            url('r/brotato', 'https://www.reddit.com/r/brotato/'),
          ]),
          folder('Tiny Glade', [
            url('Tiny Glade', 'https://tinyglade.com/'),
            url('Tiny Glade Wiki', 'https://tinyglade.wiki.gg/'),
          ]),
        ]),
        url('YouTube', 'https://www.youtube.com/'),
        url('Wikipedia', 'https://it.wikipedia.org/'),
      ],
      other: [url('Meteo', 'https://www.ilmeteo.it/')],
    },
  },
  Brave: {
    'Persona 1': { bar: [url('GitHub', 'https://github.com/')], other: [] },
  },
};

function writeStores(dir) {
  const stores = Object.entries(BROWSERS).map(([browser, profiles]) => {
    const store = path.join(dir, 'browsers', browser);
    const info = {};
    Object.entries(profiles).forEach(([name, { bar, other }], i) => {
      const id = i ? `Profile ${i}` : 'Default';
      info[id] = { name };
      fs.mkdirSync(path.join(store, id), { recursive: true });
      fs.writeFileSync(path.join(store, id, 'Bookmarks'), JSON.stringify({ roots: {
        bookmark_bar: folder('Barra', bar), other: folder('Altro', other),
      } }));
    });
    fs.writeFileSync(path.join(store, 'Local State'), JSON.stringify({ profile: { info_cache: info } }));
    return { browser, engine: 'chromium', dir: store };
  });
  fs.writeFileSync(path.join(dir, 'bookmark-stores.json'), JSON.stringify(stores));
}

module.exports = async () => {
  const o = await start('importa-bookmark', {
    // La lista di Tiny Glade come al termine delle guide precedenti.
    lists: [tinyGladeList()],
  });
  writeStores(o.dir);
  const { page, app, shot } = o;
  const $ = (sel) => page.locator(sel);
  const tabs = $('#tabs .tab');
  const current = $('#lists section.list.current');
  const folderRow = (name) => $('#bm-tree .bm-row.folder').filter({ has: page.locator('.title', { hasText: new RegExp(`^${name}$`) }) });
  try {
    // 1. La sezione Bookmark della Home.
    await o.show(BROTATO);
    await expect(current.locator('.name')).toHaveText('Brotato');
    await shot('01-sezione-bookmark', [
      { el: $('#import-btn'), n: 1, at: 's' },
      { el: $('#export-btn'), n: 2, at: 's' },
    ]);

    // 2. La finestra di importazione: cartelle aperte fino a Brotato.
    await $('#import-btn').click();
    await expect($('#bm-tree')).toContainText('Barra');
    const chrome = await $('#bm-source option').filter({ hasText: 'Chrome' }).first().getAttribute('value');
    await $('#bm-source').selectOption(chrome);
    await expect($('#bm-tree')).toContainText('YouTube');
    for (const name of ['Barra dei preferiti', 'Giochi']) {
      if (await folderRow(name).locator('.twisty').textContent() === '▸') await folderRow(name).click();
    }
    await folderRow('Brotato').click();
    await folderRow('Brotato').locator('input').click();
    await expect($('#add-ok')).toHaveText('Aggiungi 3 siti');
    await page.mouse.move(990, 690);
    await shot('02-importa', [
      { el: $('#bm-source'), n: 1, at: 'n' },
      { el: $('#bm-file'), n: 2, at: 'e' },
      { el: $('#bm-search'), n: 3, at: 'e' },
      { el: folderRow('Brotato'), n: 4, at: 'e' },
      { el: $('#add-list-pick'), n: 5, at: 'w' },
      { el: $('#add-ok'), n: 6, at: 's' },
    ]);

    // 3. I siti importati nella lista di Brotato.
    await $('#add-ok').click();
    await expect($('#add-dialog')).toBeHidden();
    await expect(current.locator('.site')).toHaveCount(3);
    await page.waitForTimeout(1500);
    await shot('03-importati', [
      { el: [current.locator('.site').first(), current.locator('.site').last()] },
    ]);

    // 4. Il "+" con la scheda Bookmark: i siti già nella lista.
    await $('#add-tab').click();
    await $('#add-tab-bm').click();
    await $('#bm-search').fill('brotato');
    await expect($('#bm-tree')).toContainText('r/brotato');
    await page.waitForTimeout(500);
    await shot('04-piu-bookmark', [
      { el: $('#add-tab-bm'), n: 1, at: 'e' },
      { el: $('#bm-search'), n: 2, at: 'e' },
      { el: $('#bm-tree .bm-row.disabled').first(), n: 3, at: 'e' },
    ]);
    await $('#add-cancel').click();

    // 5. L'esportazione (salvata in un file temporaneo: la finestra di
    //    sistema è sostituita).
    const file = path.join(o.dir, 'export.html');
    await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, file);
    await $('#home-btn').click();
    await $('#export-btn').click();
    await expect($('#export-dialog')).toBeVisible();
    await page.waitForTimeout(500);
    await shot('05-esporta', [
      { el: $('#ex-all'), n: 1, at: 'w' },
      { el: $('#ex-tree'), n: 2, at: 'e' },
      { el: $('#export-ok'), n: 3, at: 's' },
    ]);
    await $('#export-ok').click();
    await expect.poll(() => fs.existsSync(file)).toBe(true);
  } finally {
    await o.close();
  }
};
