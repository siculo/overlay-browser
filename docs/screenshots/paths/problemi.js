// Percorso "Risoluzione dei problemi" (docs/it/problemi.md): quasi tutto
// testo; le schermate sono della sezione Diagnostica delle Impostazioni
// (log dettagliato, mostrare e svuotare il log). "Mostra il file di log" non
// viene cliccato: aprirebbe il gestore dei file del sistema.
const { expect } = require('@playwright/test');
const { start, GAME, tinyGladeList } = require('../run');

module.exports = async () => {
  const o = await start('problemi', { lists: [tinyGladeList()] });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  try {
    await o.show(GAME);
    await $('#settings-btn').click();
    await page.evaluate(() => {
      const h = document.querySelector('#settings h2[data-i18n="settings.diagnostics"]');
      h.scrollIntoView({ block: 'start' });
      h.closest('#settings').scrollTop -= 16;
    });
    await expect($('#opt-verbose-log')).toBeChecked();
    await page.mouse.move(990, 690);
    await page.waitForTimeout(500);

    // 1. La sezione Diagnostica, con il log dettagliato attivo.
    await shot('01-diagnostica', [
      { el: $('#opt-verbose-log'), n: 1, at: 'w' },
      { el: $('#show-log'), n: 2, at: 's' },
      { el: $('#clear-log'), n: 3, at: 's' },
    ]);

    // 2. Svuotare il log: la conferma (il log della cartella temporanea).
    await $('#clear-log').click();
    await expect($('#dialog-ok')).toBeVisible();
    await shot('02-svuota', [{ el: $('#dialog-ok') }]);
    await $('#dialog-ok').click();
    await expect($('#log-hint')).not.toBeEmpty();
  } finally {
    await o.close();
  }
};
