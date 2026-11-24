---
name: user-docs
description: Rigenera da zero la documentazione utente di Overlay Browser (guide Markdown con schermate e presentazione HTML) a partire dai percorsi d'uso di docs/percorsi.md. Solo quando l'utente lo chiede esplicitamente.
disable-model-invocation: true
---

# Documentazione utente: rigenerazione da zero

La documentazione utente (`docs/`) è generata dai percorsi d'uso di `docs/percorsi.md` e sta nel repository, legata alla versione dell'app. Si rigenera **da zero**, **solo su richiesta esplicita** dell'utente, e in modo **interattivo**: l'utente scioglie i dubbi e verifica il risultato. Non rigenerarla di tua iniziativa, nemmeno dopo aver cambiato l'app.

Cosa viene generato:

| Fonte | Generato | Come |
| --- | --- | --- |
| `docs/percorsi.md` (scritto dall'utente) | `docs/screenshots/paths/<id>.js` | scritto da te, uno per percorso |
| `paths/<id>.js` | `docs/it/img/<id>/*.png` | `npm run docs:screenshots -- <id>` |
| `percorsi.md` + l'app + le schermate | `docs/it/<id>.md` | scritto da te |
| le guide | `docs/it/presentazione.html` | `npm run docs:slideshow` |

Restano: `docs/screenshots/run.js`, `docs/screenshots/annotate.js`, `docs/slideshow/` (strumenti), `docs/README.md` (con l'elenco delle guide da aggiornare), `docs/percorsi.md`.

## Procedura

1. **Prima di cominciare.** Leggi `AGENTS.md`, `docs/README.md` e `docs/percorsi.md`. Controlla il branch: la documentazione va sul branch della versione che descrive (vedi *Branches and releases* in `AGENTS.md`); se non è chiaro, chiedi. Riassumi all'utente i percorsi che genererai e i dubbi che vedi già (passi ambigui, note "da decidere").
2. **Pulizia, con conferma.** Elenca cosa cancellerai (`docs/it/*.md`, `docs/it/img/`, `docs/screenshots/paths/`, `docs/it/presentazione.html`) e cancella solo dopo il sì dell'utente.
3. **Un percorso alla volta, nell'ordine del file.** Per ciascuno:
   1. Verifica nel codice (`index.html`, `main.js`, `locales/it.json`) che i passi descritti corrispondano a come l'app funziona ora: id degli elementi, testi dell'interfaccia, comportamenti. Se un passo non corrisponde, o una nota dice "da decidere", **chiedi all'utente** prima di procedere.
   2. Scrivi `docs/screenshots/paths/<id>.js` (vedi *Script delle schermate*) ed eseguilo: `npm run docs:screenshots -- <id>`.
   3. **Guarda ogni schermata** generata (leggi il file PNG). Controlla: banner dei cookie, pagine di errore, captcha, dati personali (indirizzo IP, account), numeri che coprono testo o altri riquadri, puntatore che sottolinea un elemento, caselle in uno stato diverso da quello di default. Correggi e rigenera finché non sono pulite.
   4. Scrivi `docs/it/<id>.md` (vedi *Testo delle guide*), verificando ogni affermazione sul codice: valori di default, intervalli, nomi delle sezioni e dei pulsanti esatti come in `locales/it.json`.
   5. Mostra all'utente le schermate e un riassunto della guida; passa al percorso seguente quando è d'accordo.
4. **Indice e presentazione.** Aggiorna l'elenco delle guide in `docs/README.md` (stesso ordine di `percorsi.md`). Esegui `npm run docs:slideshow` e controlla la pagina: `node docs/slideshow/preview.js <cartella temporanea>` salva il menu e la prima e l'ultima slide di ogni guida (altre slide: `<id>/<n>`) e segnala gli errori della pagina; guarda le immagini.
5. **Fine.** Riassumi cosa è cambiato rispetto alla documentazione precedente (`git status`, `git diff --stat`), i dubbi rimasti e le schermate da rivedere. Il commit lo fa l'utente, o tu se te lo chiede.

Se durante la generazione trovi un **difetto dell'app**, non correggerlo qui: segnalalo all'utente (una correzione segue le regole dei branch di `AGENTS.md`), poi rigenera le schermate interessate.

## Script delle schermate

Ogni percorso è un modulo `docs/screenshots/paths/<id>.js` che esporta una funzione `async () => {}`; `docs/screenshots/run.js` li esegue tutti o quelli indicati. Usa come esempio i moduli esistenti, se ci sono, o quelli nella storia git.

- `start('<id>', prefs)` (da `../run`): avvia l'app vera su una cartella dati temporanea, in italiano, con le preferenze `prefs` (es. `{ lists: [...] , settings: {...} }`, costruite con `site()` e `list()` di `test/e2e/helpers.js`). Restituisce l'app dei test UI (`page`, `app`, `show(app)`, `hide()`, `test()`, `inSite()`, `dir`, `close()`) più `shot(nome, marks)`, che salva `docs/it/img/<id>/<nome>.png`. Chiudi sempre con `o.close()` in un `finally`.
- `GAME` (Tiny Glade) e `BROTATO` (da `../run`): le applicazioni sopra cui aprire l'overlay, `o.show(GAME)`; `o.show(null)`: nessuna applicazione (lista Generale).
- Lo stato di partenza di un percorso ("Parte da" in `percorsi.md`) si costruisce con le preferenze, non ripetendo i percorsi precedenti.
- **Evidenziazioni**, `marks`: `[{ el, n, at, len }]` (`annotate.js`). `el`: un locator, un array di locator (un riquadro che li contiene) o un rettangolo, ad esempio di un elemento dentro la pagina di un sito con `siteRect(o, urlPrefix, selettore, testo)`; `n`: il numero (omesso se l'elemento evidenziato è uno solo); `at`: dove mettere il numero (`n`, `s`, `e`, `w`, `ne`, …); `len`: linea più lunga, per staccare il numero da altri riquadri. Numera nell'ordine in cui il testo cita gli elementi.
- Nomi delle schermate: `NN-descrizione` (`01-home-vuota`), nell'ordine in cui compaiono nella guida.
- Pagine dei siti:
  - banner dei cookie: `hideBanner(o, urlPrefix, testo)` (da `../run`) li nasconde, anche se il sito li ricrea;
  - ricerche: `settings: { searchEngine: 'duckduckgo' }` (Google risponde con un captcha, che mostra anche l'indirizzo IP);
  - siti che non esistono più o rispondono con errori: scegline altri e dillo all'utente.
- Cose che in test sono diverse dall'app vera:
  - `hideOnBlur` è disattivato (attivo farebbe sparire l'overlay durante lo script): se la casella compare in una schermata, spuntala solo nella pagina (`el.checked = true`);
  - l'opzione delle nuove versioni è nascosta: per mostrarla, `hidden = false` sull'elemento;
  - le nuove versioni non vengono controllate: si simulano con `o.test('send', 'update:available', { version, url, dismissed })`;
  - i bookmark dei browser vengono da `bookmark-stores.json` nella cartella dati (`o.dir`): crea finti profili, mai quelli dell'utente;
  - le finestre di sistema (apri/salva file) si sostituiscono dal processo principale (`app.evaluate(({ dialog }) => ...)`);
  - non registrare una combinazione di tasti vera (annulla con Esc).
- Il puntatore lasciato sopra un elemento lo sottolinea: spostalo (`page.mouse.move(990, 690)`) prima della schermata.
- Non si possono riprendere: l'area di notifica, la combinazione di tasti, il gioco dietro l'overlay (anche l'opacità), i menu nativi (menu contestuale), i login veri. Per questi passi: solo testo, oppure una soluzione decisa con l'utente.
- Gli script usano la rete (siti reali) e la finestra dell'app compare sullo schermo mentre girano.

## Testo delle guide

Struttura di `docs/it/<id>.md` (la presentazione si basa su questa struttura, vedi `docs/slideshow/build.js`):

```markdown
# <titolo della guida, come in percorsi.md>

<introduzione: a cosa serve, e da quale stato parte l'esempio; link alle guide precedenti se serve>

Nelle schermate gli elementi citati nel testo sono evidenziati in rosso; i numeri come ❶ nel testo indicano l'elemento con lo stesso numero nella schermata.

## 1. <passo>

<testo che cita gli elementi con i numeri: Clicca **+** ❶ …>

![<descrizione della schermata>](img/<id>/<NN-nome>.png)
```

- Il testo di un passo **precede** la sua schermata; nella presentazione ogni immagine diventa una slide con il testo che la precede.
- I numeri nel testo sono ❶ ❷ ❸ … (U+2776…), accanto al nome dell'elemento, e corrispondono esattamente a quelli della schermata che segue: ogni numero nel testo ha il suo riquadro e viceversa. Un elemento evidenziato da solo non ha numero.
- Seconda persona, frasi brevi, nomi dell'interfaccia in **grassetto** e identici a `locales/it.json`; tasti come Win+F10; esempi da scrivere in `codice`.
- Elementi Markdown ammessi (gli unici che la presentazione converte): paragrafi, elenchi puntati, citazioni (`>`), grassetto, corsivo, codice, link (a un'altra guida: `[titolo](<id>.md)`), immagini su una riga da sole.
- Non ripetere il README (installazione, dettagli per sistema): rimanda a `../../README-it.md`.
- Il testo alternativo di un'immagine diventa la sua didascalia nella presentazione: una frase che descrive cosa mostra.
