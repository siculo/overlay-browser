// Genera la presentazione della documentazione utente: una pagina HTML
// (docs/it/presentazione.html) con un menu delle guide e, per ogni guida,
// le sue slide, ricavate dai file .md:
//   - il titolo e l'introduzione della guida: la prima slide;
//   - in ogni sezione (##), ogni immagine con il testo che la precede: una
//     slide; il testo dopo l'ultima immagine (o di una sezione senza
//     immagini): una slide di solo testo.
// Le guide e il loro ordine sono quelli dei percorsi (docs/percorsi.md);
// un percorso senza la sua guida è segnalato e saltato.
// La pagina non ha bisogno di un server: le immagini sono quelle di
// docs/it/img/, accanto alla pagina.
//   npm run docs:slideshow
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..');
const LANG = 'it';
const OUT = path.join(DOCS, LANG, 'presentazione.html');

// Il paragrafo che spiega le evidenziazioni, uguale in ogni guida: nella
// presentazione è detto una volta sola, nel menu.
const LEGEND = /^Nelle schermate gli elementi citati/;

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Testo in linea: grassetto, corsivo, codice, link, numeri ❶…❿ (cerchi rossi
// come nelle schermate). I link a un'altra guida (x.md) portano alla sua
// prima slide.
function inline(text) {
  const codes = [];
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (_m, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      const guide = href.match(/^([\w-]+)\.md$/);
      return guide
        ? `<a href="#${guide[1]}">${label}</a>`
        : `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/[❶-❿]/g, (c) => `<span class="num">${c.charCodeAt(0) - 0x2775}</span>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => `<code>${codes[i]}</code>`);
}

// Blocchi di una guida: { type: 'h1'|'h2'|'p'|'ul'|'quote'|'img', ... }.
function blocks(md) {
  const out = [];
  for (const chunk of md.split(/\n\s*\n/)) {
    const text = chunk.trim();
    if (!text) continue;
    const lines = text.split('\n');
    let m;
    if ((m = text.match(/^# (.+)$/))) out.push({ type: 'h1', text: m[1] });
    else if ((m = text.match(/^## (.+)$/))) out.push({ type: 'h2', text: m[1] });
    else if ((m = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) out.push({ type: 'img', alt: m[1], src: m[2] });
    else if (lines.every((l) => /^\s*[-*] |^\s{2,}\S/.test(l))) {
      // Elenco: ogni voce può continuare sulle righe seguenti.
      const items = [];
      for (const l of lines) {
        if (/^\s*[-*] /.test(l)) items.push(l.replace(/^\s*[-*] /, ''));
        else items[items.length - 1] += ' ' + l.trim();
      }
      out.push({ type: 'ul', items });
    } else if (lines.every((l) => l.startsWith('>'))) {
      out.push({ type: 'quote', text: lines.map((l) => l.replace(/^>\s?/, '')).join(' ') });
    } else out.push({ type: 'p', text: lines.join(' ') });
  }
  return out;
}

const toHtml = (b) => {
  if (b.type === 'p') return `<p>${inline(b.text)}</p>`;
  if (b.type === 'ul') return `<ul>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
  if (b.type === 'quote') return `<blockquote>${inline(b.text)}</blockquote>`;
  throw new Error(`blocco inatteso: ${b.type}`);
};

// Le slide di una guida.
function guide(id, md) {
  const bs = blocks(md);
  const title = bs.find((b) => b.type === 'h1')?.text ?? id;
  const slides = [];
  let heading = null;     // titolo della sezione corrente (null: introduzione)
  let pending = [];       // testo non ancora in una slide
  const flush = (image = null) => {
    if (!pending.length && !image) return;
    slides.push({ heading, html: pending.map(toHtml).join(''), image });
    pending = [];
  };
  let intro = '';
  for (const b of bs) {
    if (b.type === 'h1') continue;
    if (b.type === 'h2') {
      flush();
      heading = b.text;
      continue;
    }
    if (b.type === 'img') {
      flush({ src: b.src, alt: b.alt });
      continue;
    }
    if (b.type === 'p' && LEGEND.test(b.text)) continue;
    if (heading === null && b.type === 'p' && !intro) intro = b.text;
    pending.push(b);
  }
  flush();
  // La prima slide (introduzione) ha per titolo quello della guida.
  if (slides[0] && slides[0].heading === null) slides[0].intro = true;
    // La descrizione nel menu, senza link: la scheda della guida è già un link.
  return { id, title, intro: inline(intro.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')), slides };
}

// Le guide nell'ordine dei percorsi: le sezioni "## <id> — <titolo>".
const percorsi = fs.readFileSync(path.join(DOCS, 'percorsi.md'), 'utf8');
const ids = [...percorsi.matchAll(/^## ([\w-]+) — /gm)].map((m) => m[1]);
const guides = ids.filter((id) => {
  if (fs.existsSync(path.join(DOCS, LANG, `${id}.md`))) return true;
  console.warn(`percorso senza guida, saltato: ${id}`);
  return false;
}).map((id) => guide(id, fs.readFileSync(path.join(DOCS, LANG, `${id}.md`), 'utf8')));
for (const g of guides) {
  for (const s of g.slides) {
    if (s.image && !fs.existsSync(path.join(DOCS, LANG, s.image.src))) throw new Error(`${g.id}: immagine mancante ${s.image.src}`);
  }
}

const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const data = JSON.stringify({ guides }).replace(/</g, '\\u003c');
fs.writeFileSync(OUT, template.replace('/*DATA*/null', data));
console.log(`${path.relative(process.cwd(), OUT)}: ${guides.length} guide, ${guides.reduce((n, g) => n + g.slides.length, 0)} slide`);
