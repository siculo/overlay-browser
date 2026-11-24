// Percorso "Nuove versioni" (docs/it/nuove-versioni.md): una nuova versione
// segnalata nella Home e nella striscia sotto la barra. In test l'app non
// controlla le versioni: la nuova versione è mandata alla pagina come farebbe
// main.js (update:available), come nel test smoke.spec.js.
const { expect } = require('@playwright/test');
const { start, GAME, tinyGladeList } = require('../run');

const UPDATE = { version: '1.1.0', url: 'https://github.com/siculo/overlay-browser/releases', dismissed: false };

module.exports = async () => {
  const o = await start('nuove-versioni', {
    lists: [tinyGladeList()],
  });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  try {
    await o.show(GAME);

    // 1. La striscia e la versione nella Home.
    await o.test('send', 'update:available', UPDATE);
    await expect($('#update')).toBeVisible();
    await shot('01-nuova-versione', [
      { el: $('#update-msg'), n: 1, at: 's' },
      { el: $('#update-open'), n: 2, at: 's' },
      { el: $('#update-close'), n: 3, at: 's' },
      { el: $('#app-update-link'), n: 4, at: 's' },
    ]);

    // 2. La striscia chiusa: la versione resta nella Home.
    await o.test('send', 'update:available', { ...UPDATE, dismissed: true });
    await expect($('#update')).toBeHidden();
    await shot('02-striscia-chiusa', [{ el: $('#app-update-link') }]);

    // 3. L'opzione nelle Impostazioni.
    await $('#settings-btn').click();
    await page.evaluate(() => {
      const h = document.querySelector('#settings h2[data-i18n="settings.behavior"]');
      h.scrollIntoView({ block: 'start' });
      h.closest('#settings').scrollTop -= 16;
    });
    // In test l'opzione è nascosta (nessun controllo delle versioni):
    // mostrata come nell'app, attiva come di default.
    await page.evaluate(() => {
      document.getElementById('check-updates-setting').hidden = false;
      document.getElementById('opt-check-updates').checked = true;
      // Come di default (i test lo tolgono): solo la casella.
      document.getElementById('opt-hide-on-blur').checked = true;
    });
    await page.waitForTimeout(300);
    await shot('03-opzione', [{ el: $('#check-updates-setting') }]);
  } finally {
    await o.close();
  }
};
