// Controllo della presentazione: la apre con l'Electron del progetto (non
// serve un browser) e salva la schermata del menu e delle slide indicate.
//   node docs/slideshow/preview.js <cartella> [<guida>/<n> ...]
// Senza slide: il menu e la prima e l'ultima slide di ogni guida. Segnala
// gli errori JavaScript della pagina.
const fs = require('fs');
const path = require('path');
const { _electron } = require('playwright');

(async () => {
  const [out, ...hashes] = process.argv.slice(2);
  if (!out) throw new Error('uso: node docs/slideshow/preview.js <cartella> [<guida>/<n> ...]');
  fs.mkdirSync(out, { recursive: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: [path.join(__dirname, 'preview', 'main.js')], env });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 1440, height: 860 });
    await page.waitForLoadState('domcontentloaded');
    const list = hashes.length ? hashes : ['', ...await page.evaluate(() =>
      DATA.guides.flatMap((g) => [`${g.id}/1`, `${g.id}/${g.slides.length}`]))];
    for (const h of list) {
      await page.evaluate((x) => { location.hash = x; }, h);
      await page.waitForTimeout(400);
      const file = path.join(out, `${h.replace('/', '-') || 'menu'}.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
    if (errors.length) { console.error('errori nella pagina:', errors); process.exitCode = 1; }
  } finally {
    await app.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
