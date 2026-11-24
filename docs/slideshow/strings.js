// I testi della presentazione per lingua (build.js, preview.js). Per una
// nuova lingua aggiungi qui i suoi testi.
// I testi della pagina per lingua: `file` è il nome della pagina generata;
// `legendStart`, l'inizio del paragrafo delle guide che spiega le
// evidenziazioni (uguale in ogni guida: nella presentazione è detto una volta
// sola, nel menu, con `legend`).
const STRINGS = {
  it: {
    file: 'presentazione.html',
    docTitle: 'Overlay Browser · Guida',
    subtitle: "Guida all'uso, passo per passo",
    legendStart: 'Nelle schermate gli elementi citati',
    legend: 'Nelle schermate gli elementi citati nel testo sono evidenziati da un riquadro rosso <span class="box"></span>; i numeri come <span class="num">1</span> nel testo indicano l\'elemento con lo stesso numero nella schermata.',
    menu: 'Guide', menuTitle: "Torna all'elenco delle guide (Esc)",
    prev: 'Indietro', prevTitle: 'Slide precedente (←)', next: 'Avanti', nextTitle: 'Slide successiva (→)',
    prevGuide: 'Guida precedente', nextGuide: 'Prossima guida: {title}', backToGuides: 'Torna alle guide',
    guideOf: 'Guida {n} di {total}', step: 'Passo {n}', slideOne: '1 slide', slideOther: '{count} slide',
  },
  en: {
    file: 'slideshow.html',
    docTitle: 'Overlay Browser · Guide',
    subtitle: 'User guide, step by step',
    legendStart: 'In the screenshots the elements mentioned',
    legend: 'In the screenshots the elements mentioned in the text are highlighted by a red frame <span class="box"></span>; numbers like <span class="num">1</span> in the text point to the element with the same number in the screenshot.',
    menu: 'Guides', menuTitle: 'Back to the list of guides (Esc)',
    prev: 'Back', prevTitle: 'Previous slide (←)', next: 'Next', nextTitle: 'Next slide (→)',
    prevGuide: 'Previous guide', nextGuide: 'Next guide: {title}', backToGuides: 'Back to the guides',
    guideOf: 'Guide {n} of {total}', step: 'Step {n}', slideOne: '1 slide', slideOther: '{count} slides',
  },
};
module.exports = STRINGS;
