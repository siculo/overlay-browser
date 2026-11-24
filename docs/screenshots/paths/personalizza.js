// Percorso "Personalizzare l'overlay" (docs/it/personalizza.md): la pagina
// Impostazioni (scorciatoia, comportamento, aspetto, lingua) e l'overlay
// con colore d'accento, tab fissi e opacità cambiati.
const { expect } = require('@playwright/test');
const { start, GAME, tinyGladeList } = require('../run');

module.exports = async () => {
  const o = await start('personalizza', {
    // La lista di Tiny Glade come al termine delle guide precedenti.
    lists: [tinyGladeList()],
  });
  const { page, shot } = o;
  const $ = (sel) => page.locator(sel);
  // Porta in cima alla pagina il titolo di una sezione delle Impostazioni.
  const scrollTo = (i18n) => page.evaluate((k) => {
    const h = document.querySelector(`#settings h2[data-i18n="${k}"]`);
    h.scrollIntoView({ block: 'start' });
    h.closest('#settings').scrollTop -= 16;
  }, i18n);
  try {
    await o.show(GAME);

    // 1. La scorciatoia.
    await $('#settings-btn').click();
    await expect($('#shortcut')).not.toBeEmpty();
    // Come di default (i test lo tolgono, e attivo nasconderebbe l'overlay
    // durante lo script): solo la casella, senza cambiare l'impostazione.
    await $('#opt-hide-on-blur').evaluate((e) => { e.checked = true; });
    await shot('01-scorciatoia', [
      { el: $('#settings-btn'), n: 1, at: 's' },
      { el: $('#shortcut'), n: 2, at: 's' },
      { el: $('#shortcut-change'), n: 3, at: 's' },
      { el: $('#shortcut-reset'), n: 4, at: 's' },
    ]);

    // 2. La registrazione di una nuova combinazione (annullata con Esc).
    await $('#shortcut-change').click();
    await expect($('#shortcut-hint')).not.toBeEmpty();
    await shot('02-nuova-combinazione', [{ el: [$('#shortcut'), $('#shortcut-hint')] }]);
    await page.keyboard.press('Escape');
    await expect($('#shortcut-change')).toBeEnabled();

    // 3. Comportamento.
    await scrollTo('settings.behavior');
    await page.waitForTimeout(300);
    await shot('03-comportamento', [
      { el: $('#opt-hide-on-blur'), n: 1, at: 'w' },
      { el: $('#opt-browse-start'), n: 2, at: 's' },
      { el: $('#opt-search'), n: 3, at: 's' },
    ]);

    // 4. Aspetto e lingua.
    await scrollTo('settings.appearance');
    await page.waitForTimeout(300);
    await shot('04-aspetto', [
      { el: $('#accents'), n: 1, at: 'e' },
      { el: $('#opt-fixed-tabs'), n: 2, at: 'e' },
      { el: $('#opt-opacity'), n: 3, at: 's' },
      { el: $('#opt-language'), n: 4, at: 'e' },
    ]);

    // 5. Accento blu, tab fissi solo icona, opacità 85%.
    await $('#accents [data-accent="blue"]').click();
    await $('#opt-fixed-tabs').selectOption('icons');
    await $('#opt-opacity').fill('85');
    await $('#opt-opacity').dispatchEvent('change');
    await expect($('body')).toHaveClass(/fixed-icons/);
    await $('#tabs .tab').first().click();
    await page.waitForTimeout(5000);
    await shot('05-personalizzato', [
      { el: [$('#home-btn'), $('#browse-btn')], n: 1, at: 's', len: 50 },
      { el: $('#settings-btn'), n: 2, at: 'w' },
    ]);
  } finally {
    await o.close();
  }
};
