// Genera le schermate della documentazione utente (docs/it/img/<guida>/).
//   npm run docs:screenshots              tutti i percorsi
//   npm run docs:screenshots -- <nome>    solo i percorsi indicati (paths/<nome>.js)
// Ogni percorso avvia l'app vera su una cartella dati temporanea (come i
// test UI, test/e2e/helpers.js) con l'interfaccia in italiano. Usa la rete:
// i siti mostrati sono reali.
const fs = require('fs');
const path = require('path');
const { launch } = require('../../test/e2e/helpers');
const { annotate, clearAnnotations } = require('./annotate');

const OUT = path.join(__dirname, '..', 'it', 'img');
// Il gioco sopra cui si apre l'overlay negli esempi (simulato).
const GAME = { exe: 'tiny-glade', name: 'Tiny Glade', title: 'Tiny Glade' };

// Avvia l'app con le preferenze `prefs` (più l'italiano) e restituisce
// l'app (helpers.launch) con shot(nome, marks): schermata della finestra con
// le evidenziazioni `marks` (vedi annotate.js), salvata in
// OUT/<guide>/<nome>.png (`guide`: il nome della guida, docs/it/<guide>.md).
async function start(guide, { settings, ...prefs } = {}) {
  const dir = path.join(OUT, guide);
  fs.mkdirSync(dir, { recursive: true });
  const o = await launch({ prefs: { settings: { language: 'it', ...settings }, ...prefs }, show: false });
  o.shot = async (name, marks = []) => {
    await o.page.waitForTimeout(500);
    await annotate(o.page, marks);
    await o.page.screenshot({ path: path.join(dir, `${name}.png`) });
    await clearAnnotations(o.page);
    console.log(`  ${name}`);
  };
  return o;
}

// Nasconde nella pagina del sito (indirizzo che inizia con `urlPrefix`) il
// banner dei cookie: gli elementi figli del body che contengono `text`,
// aspettati fino a 10 s, e anche quelli ricreati in seguito (alcuni banner
// si ricreano se tolti). Solo per la schermata: copre la pagina, e accettare
// o rifiutare i cookie non è il soggetto della guida.
async function hideBanner(o, urlPrefix, text) {
  const done = await o.inSite(urlPrefix, new Function('d', `return (async () => {
    const hide = () => {
      let found = false;
      for (const e of d.body.children) {
        if (!e.textContent.includes(${JSON.stringify(text)})) continue;
        e.style.setProperty('display', 'none', 'important');
        found = true;
      }
      return found;
    };
    for (let i = 0; i < 50 && !hide(); i++) await new Promise((r) => setTimeout(r, 200));
    setInterval(hide, 100);
    return hide();
  })()`));
  if (!done) console.warn(`  banner non trovato: ${urlPrefix} "${text}"`);
  await o.page.waitForTimeout(500);
}

module.exports = { start, hideBanner, GAME };

if (require.main === module) {
  (async () => {
    const dir = path.join(__dirname, 'paths');
    const all = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
    const names = process.argv.length > 2 ? process.argv.slice(2) : all;
    for (const name of names) {
      if (!all.includes(name)) throw new Error(`percorso sconosciuto: ${name} (disponibili: ${all.join(', ')})`);
      console.log(name);
      await require(path.join(dir, name))();
    }
  })().catch((err) => { console.error(err); process.exit(1); });
}
