// Evidenziazioni delle schermate: un riquadro rosso attorno a ogni elemento
// citato nel testo e, se gli elementi sono più di uno, un numero collegato
// al riquadro da una linea (la legenda è nel testo della guida).
// Disegnate in un livello sopra la pagina dell'overlay, tolto dopo la
// schermata: le posizioni sono quelle vere degli elementi.

const PAD = 5;        // margine tra l'elemento e il riquadro
const GAP = 22;       // distanza tra il riquadro e il numero
const R = 12;         // raggio del numero
const COLOR = '#e5262b';

// marks: [{ el, n, at }]
//   el: locator Playwright, o array di locator (riquadro che li contiene tutti)
//   n:  numero dell'etichetta (omesso = solo riquadro)
//   at: dove mettere il numero: 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
async function annotate(page, marks) {
  const boxes = [];
  for (const m of marks) {
    const els = Array.isArray(m.el) ? m.el : [m.el];
    const rects = [];
    for (const e of els) {
      const b = await e.boundingBox();
      if (!b) throw new Error(`elemento da evidenziare non visibile: ${e}`);
      rects.push(b);
    }
    const x = Math.min(...rects.map((r) => r.x));
    const y = Math.min(...rects.map((r) => r.y));
    const x2 = Math.max(...rects.map((r) => r.x + r.width));
    const y2 = Math.max(...rects.map((r) => r.y + r.height));
    boxes.push({ x: x - PAD, y: y - PAD, w: x2 - x + 2 * PAD, h: y2 - y + 2 * PAD, n: m.n, at: m.at || 's' });
  }
  await page.evaluate(({ boxes, GAP, R, COLOR }) => {
    const W = innerWidth, H = innerHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const parts = [];
    for (const b of boxes) {
      parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8" fill="none" stroke="${COLOR}" stroke-width="3"/>`);
      if (b.n == null) continue;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const dx = b.at.includes('e') ? 1 : b.at.includes('w') ? -1 : 0;
      const dy = b.at.includes('s') ? 1 : b.at.includes('n') ? -1 : 0;
      // Punto del bordo del riquadro da cui parte la linea.
      const ex = cx + dx * b.w / 2, ey = cy + dy * b.h / 2;
      const len = GAP + R;
      const k = dx && dy ? Math.SQRT1_2 : 1;
      const bx = clamp(ex + dx * len * k, R + 2, W - R - 2);
      const by = clamp(ey + dy * len * k, R + 2, H - R - 2);
      parts.push(`<line x1="${ex}" y1="${ey}" x2="${bx}" y2="${by}" stroke="${COLOR}" stroke-width="2.5"/>`);
      parts.push(`<circle cx="${bx}" cy="${by}" r="${R}" fill="${COLOR}" stroke="#fff" stroke-width="2"/>`);
      parts.push(`<text x="${bx}" y="${by}" fill="#fff" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="central">${b.n}</text>`);
    }
    const layer = document.createElement('div');
    layer.id = 'doc-annotations';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    layer.innerHTML = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
    document.body.append(layer);
  }, { boxes, GAP, R, COLOR });
}

async function clearAnnotations(page) {
  await page.evaluate(() => document.getElementById('doc-annotations')?.remove());
}

module.exports = { annotate, clearAnnotations };
