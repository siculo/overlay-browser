// Genera le schermate della documentazione utente (docs/<lingua>/img/<guida>/).
//   npm run docs:screenshots                         tutti i percorsi, in italiano
//   npm run docs:screenshots -- <nome> ...           solo i percorsi indicati (paths/<nome>.js)
//   npm run docs:screenshots -- --lang en [<nome>]   in un'altra lingua
// Ogni percorso avvia l'app vera su una cartella dati temporanea (come i
// test UI, test/e2e/helpers.js) con l'interfaccia nella lingua scelta; anche
// le pagine dei siti la ricevono (locale del sistema per Chromium). Usa la
// rete: i siti mostrati sono reali.
//
// Gli script dei percorsi non contengono testi in una lingua: quelli
// dell'interfaccia vengono da locales/<lingua>.json (t()), quelli degli
// esempi (titoli dei siti, bookmark, il forum) sono dati per lingua (tr()).
const fs = require('fs');
const path = require('path');
const { launch, site, list } = require('../../test/e2e/helpers');
const { annotate, clearAnnotations } = require('./annotate');

const DOCS = path.join(__dirname, '..');
const ROOT = path.join(DOCS, '..');

// La lingua delle schermate: scelta da --lang (vedi sotto), italiano se no.
let LANG = 'it';
const lang = () => LANG;
// Locale del sistema per Chromium, per lingua: decide la lingua chiesta ai
// siti (Accept-Language, navigator.language).
const LOCALES = { it: 'it_IT', en: 'en_US', fr: 'fr_FR', de: 'de_DE', es: 'es_ES', pt: 'pt_PT', ru: 'ru_RU' };

// I testi dell'interfaccia nella lingua delle schermate, come li mostra
// l'app (locales/<lingua>.json, con i segnaposto {nome}).
let messages = null;
function t(key, params = {}) {
  messages ??= JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', `${LANG}.json`), 'utf8'));
  const text = messages[key];
  if (text === undefined) throw new Error(`testo mancante in locales/${LANG}.json: ${key}`);
  return text.replace(/\{(\w+)\}/g, (m, name) => params[name] ?? m);
}
// Un testo degli esempi nella lingua delle schermate: tr({ it: '…', en: '…' }).
function tr(texts) {
  if (!(LANG in texts)) throw new Error(`esempio senza la lingua ${LANG}: ${JSON.stringify(texts)}`);
  return texts[LANG];
}
// Il gioco sopra cui si apre l'overlay negli esempi (simulato).
const GAME = { exe: 'tiny-glade', name: 'Tiny Glade', title: 'Tiny Glade' };
// Il secondo gioco degli esempi (eseguibile come su Linux).
const BROTATO = { exe: 'Brotato.x86_64', name: 'Brotato', title: 'Brotato' };

// Le liste degli esempi come le lasciano i primi percorsi (vedi "Esempi
// comuni" in docs/percorsi.md), per lo stato di partenza degli altri:
// start(id, { lists: [tinyGladeList()] }).
const tinyGladeList = () => list({ exe: 'tiny-glade' }, [
  site('https://tinyglade.com/', 'Tiny Glade'),
  site('https://store.steampowered.com/app/2198150/', tr({ it: 'Tiny Glade su Steam', en: 'Tiny Glade on Steam' })),
  site('https://tinyglade.wiki.gg/', 'Tiny Glade Wiki'),
], { name: 'Tiny Glade' });
const brotatoList = () => list({ exe: 'brotato.x86_64' }, [
  site('https://brotato.wiki.spellsandguns.com/', 'Brotato Wiki'),
  site('https://store.steampowered.com/app/1942280/', tr({ it: 'Brotato su Steam', en: 'Brotato on Steam' })),
], { name: 'Brotato' });

// Avvia l'app con le preferenze `prefs` (più la lingua) e restituisce
// l'app (helpers.launch) con shot(nome, marks): schermata della finestra con
// le evidenziazioni `marks` (vedi annotate.js), salvata in
// docs/<lingua>/img/<guide>/<nome>.png (`guide`: il nome della guida,
// docs/<lingua>/<guide>.md).
async function start(guide, { settings, ...prefs } = {}) {
  const dir = path.join(DOCS, LANG, 'img', guide);
  fs.mkdirSync(dir, { recursive: true });
  const o = await launch({ prefs: { settings: { language: LANG, ...settings }, ...prefs }, show: false });
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
// banner dei cookie: gli elementi figli del body che contengono `text` (il
// testo del banner, che dipende dalla lingua: es. tr({ it: …, en: … })),
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


// Serve un sito d'esempio sul dominio `host` (https), senza rete: `pages`
// mappa i percorsi (es. '/') al loro HTML, o a { type, body } per gli altri
// tipi di file (es. un'immagine SVG). Le richieste agli altri domini
// passano normalmente. Per i percorsi che hanno bisogno di un sito che non
// si può usare davvero (es. un login con un account); usa un dominio
// riservato agli esempi (`.example`) e dillo nel testo della guida.
async function serveSite(o, host, pages) {
  await o.app.evaluate(({ session, net }, { host, pages }) => {
    session.defaultSession.protocol.handle('https', (req) => {
      const url = new URL(req.url);
      if (url.hostname !== host) return net.fetch(req, { bypassCustomProtocolHandlers: true });
      const p = pages[url.pathname];
      const { type, body } = typeof p === 'string' ? { type: 'text/html; charset=utf-8', body: p } : p ?? {};
      return new Response(body ?? 'Pagina non trovata', {
        status: body ? 200 : 404,
        headers: { 'content-type': type ?? 'text/plain; charset=utf-8' },
      });
    });
  }, { host, pages });
}

// Le finestre aperte dai siti (es. il login) sono finestre a sé, fuori dalla
// schermata dell'overlay: le disegna sopra la pagina dell'overlay, centrate,
// con una barra del titolo, finché non si chiama clearPopups(). Restituisce
// quante ne ha disegnate; le evidenziazioni le trovano come '#doc-popups .popup'.
async function drawPopups(o) {
  const popups = await o.app.evaluate(async ({ BrowserWindow }) => {
    const out = [];
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.getParentWindow() || !w.isVisible()) continue;
      const img = await w.capturePage();
      const { width, height } = img.getSize();
      out.push({ src: img.toDataURL(), width, height, title: w.getTitle() });
    }
    return out;
  });
  await o.page.evaluate((popups) => {
    document.getElementById('doc-popups')?.remove();
    const layer = document.createElement('div');
    layer.id = 'doc-popups';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;display:flex;align-items:center;justify-content:center;gap:24px';
    for (const p of popups) {
      const win = document.createElement('div');
      win.className = 'popup';
      win.style.cssText = 'background:#2b2b2b;border:1px solid #555;border-radius:8px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.6)';
      const bar = document.createElement('div');
      bar.textContent = p.title;
      bar.style.cssText = 'padding:6px 12px;font:13px system-ui,sans-serif;color:#ddd;background:#333;border-bottom:1px solid #444';
      const img = document.createElement('img');
      img.src = p.src;
      img.style.cssText = `display:block;width:${p.width}px;height:${p.height}px`;
      win.append(bar, img);
      layer.append(win);
    }
    document.body.append(layer);
  }, popups);
  await o.page.waitForTimeout(200);
  return popups.length;
}

const clearPopups = (o) => o.page.evaluate(() => document.getElementById('doc-popups')?.remove());

// Il menu contestuale è nativo: non compare nelle schermate. contextMenu()
// fa clic con il tasto destro al centro dell'elemento `selector` della
// pagina del sito (indirizzo che inizia con `urlPrefix`); il menu che l'app
// costruisce non viene mostrato ma registrato (come nei test UI), e disegnato
// sopra la pagina dell'overlay nel punto del clic, con le sue voci vere,
// finché non si chiama clearMenu(). Le voci si evidenziano con
// '#doc-menu .item' (filter({ hasText })); menuClick(o, voce) le esegue.
async function contextMenu(o, urlPrefix, selector) {
  const count = await o.app.evaluate(({ Menu }) => {
    if (!global.docMenus) {
      global.docMenus = [];
      const build = Menu.buildFromTemplate.bind(Menu);
      Menu.buildFromTemplate = (template) => {
        const menu = build(template);
        menu.popup = () => { global.docMenus.push(template); };
        return menu;
      };
    }
    return global.docMenus.length;
  });
  const point = await o.inSite(urlPrefix, new Function('d', `const r = d.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };`));
  await o.app.evaluate(({ webContents }, { prefix, x, y }) => {
    const wc = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().startsWith(prefix));
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 });
  }, { prefix: urlPrefix, ...point });
  let items = null;
  for (let i = 0; i < 50 && !items; i++) {
    items = await o.app.evaluate((_e, n) => (global.docMenus.length > n
      ? global.docMenus.at(-1).map((i) => (i.type === 'separator' ? { separator: true }
        : { label: i.label, enabled: i.enabled !== false, accelerator: i.accelerator ?? '' }))
      : null), count);
    if (!items) await o.page.waitForTimeout(100);
  }
  if (!items) throw new Error(`nessun menu contestuale su ${selector}`);
  const view = await o.page.locator('#views webview:visible').boundingBox();
  await o.page.evaluate(({ items, x, y }) => {
    document.getElementById('doc-menu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'doc-menu';
    menu.style.cssText = 'position:fixed;z-index:2147483646;min-width:220px;padding:4px 0;background:#f6f6f6;color:#1e1e1e;'
      + 'border:1px solid #bdbdbd;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.35);font:13px system-ui,sans-serif;pointer-events:none';
    const key = (a) => a.replace('CmdOrCtrl', 'Ctrl');
    for (const i of items) {
      const row = document.createElement('div');
      if (i.separator) {
        row.style.cssText = 'height:1px;margin:4px 0;background:#d6d6d6';
      } else {
        row.className = 'item';
        row.style.cssText = `display:flex;gap:24px;padding:5px 14px;${i.enabled ? '' : 'color:#9a9a9a'}`;
        row.innerHTML = '<span style="flex:1"></span><span style="color:#777"></span>';
        row.children[0].textContent = i.label;
        row.children[1].textContent = key(i.accelerator);
      }
      menu.append(row);
    }
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(x, innerWidth - r.width - 4)}px`;
    menu.style.top = `${Math.min(y, innerHeight - r.height - 4)}px`;
  }, { items, x: view.x + point.x, y: view.y + point.y });
  return items;
}

const clearMenu = (o) => o.page.evaluate(() => document.getElementById('doc-menu')?.remove());

// Esegue la voce `label` dell'ultimo menu contestuale registrato.
const menuClick = (o, label) => o.app.evaluate((_e, l) => global.docMenus.at(-1).find((i) => i.label === l).click(), label);

module.exports = { start, lang, t, tr, hideBanner, serveSite, drawPopups, clearPopups, contextMenu, clearMenu, menuClick, GAME, BROTATO, tinyGladeList, brotatoList };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const at = args.indexOf('--lang');
    if (at >= 0) [, LANG] = args.splice(at, 2);
    if (!LOCALES[LANG] || !fs.existsSync(path.join(ROOT, 'locales', `${LANG}.json`))) throw new Error(`lingua sconosciuta: ${LANG}`);
    // La lingua del sistema per Chromium (pagine dei siti), ereditata
    // dall'app avviata da helpers.launch.
    process.env.LANG = process.env.LC_ALL = `${LOCALES[LANG]}.UTF-8`;
    process.env.LANGUAGE = `${LOCALES[LANG]}:${LANG}`;
    console.log(`lingua: ${LANG}`);
    const dir = path.join(__dirname, 'paths');
    const all = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
    const names = args.length ? args : all;
    for (const name of names) {
      if (!all.includes(name)) throw new Error(`percorso sconosciuto: ${name} (disponibili: ${all.join(', ')})`);
      console.log(name);
      await require(path.join(dir, name))();
    }
  })().catch((err) => { console.error(err); process.exit(1); });
}
