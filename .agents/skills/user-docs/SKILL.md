---
name: user-docs
description: Rigenera da zero la documentazione utente di Overlay Browser (guide Markdown con schermate e presentazione HTML) a partire dai percorsi d'uso di docs/percorsi.md, e la traduce nelle altre lingue dell'app. Solo quando l'utente lo chiede esplicitamente.
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
| le guide | `docs/it/slideshow.html` | `npm run docs:slideshow` |

Restano: `docs/screenshots/run.js`, `docs/screenshots/annotate.js`, `docs/slideshow/` (strumenti), `docs/README.md` (con l'elenco delle guide da aggiornare), `docs/percorsi.md`.

## Procedura

1. **Prima di cominciare.** Leggi `AGENTS.md`, `docs/README.md` e `docs/percorsi.md`. Controlla il branch: la documentazione va sul branch della versione che descrive (vedi *Branches and releases* in `AGENTS.md`); se non è chiaro, chiedi. Riassumi all'utente i percorsi che genererai e i dubbi che vedi già (passi ambigui, note "da decidere").
2. **Pulizia, con conferma.** Elenca cosa cancellerai (`docs/it/*.md`, `docs/it/img/`, `docs/screenshots/paths/`, `docs/it/slideshow.html`) e cancella solo dopo il sì dell'utente.
3. **Un percorso alla volta, nell'ordine del file.** Per ciascuno:
   1. Verifica nel codice (`index.html`, `main.js`, `locales/it.json`) che i passi descritti corrispondano a come l'app funziona ora: id degli elementi, testi dell'interfaccia, comportamenti. Se un passo non corrisponde, o una nota dice "da decidere", **chiedi all'utente** prima di procedere.
   2. Scrivi `docs/screenshots/paths/<id>.js` (vedi *Script delle schermate*) ed eseguilo: `npm run docs:screenshots -- <id>`.
   3. **Guarda ogni schermata** generata (leggi il file PNG). Controlla: banner dei cookie, pagine di errore, captcha, dati personali (indirizzo IP, account), numeri che coprono testo o altri riquadri, puntatore che sottolinea un elemento, caselle in uno stato diverso da quello di default. Correggi e rigenera finché non sono pulite.
   4. Scrivi `docs/it/<id>.md` (vedi *Testo delle guide*), verificando ogni affermazione sul codice: valori di default, intervalli, nomi delle sezioni e dei pulsanti esatti come in `locales/it.json`.
   5. Mostra all'utente le schermate e un riassunto della guida; passa al percorso seguente quando è d'accordo.
4. **Indice e presentazione.** Aggiorna l'elenco delle guide in `docs/README.md` (stesso ordine di `percorsi.md`). Esegui `npm run docs:slideshow` e controlla la pagina: `node docs/slideshow/preview.js <cartella temporanea>` salva il menu e la prima e l'ultima slide di ogni guida (altre slide: `<id>/<n>`) e segnala gli errori della pagina; guarda le immagini.
5. **Fine.** Riassumi cosa è cambiato rispetto alla documentazione precedente (`git status`, `git diff --stat`), i dubbi rimasti e le schermate da rivedere. Il commit lo fa l'utente, o tu se te lo chiede.

Se durante la generazione trovi un **difetto dell'app**, non correggerlo qui: segnalalo all'utente (una correzione segue le regole dei branch di `AGENTS.md`), poi rigenera le schermate interessate.

Dopo una rigenerazione delle guide italiane, le traduzioni sono superate: chiedi all'utente se aggiornarle subito (vedi *Traduzione*) o più avanti, e diglielo nel riepilogo.

## Traduzione

Le guide delle altre lingue (`docs/<lingua>/`: le lingue dell'app, `locales/`) sono traduzioni di quelle italiane, non si rigenerano dai percorsi: hanno gli stessi passi, le stesse immagini (rigenerate nella lingua) e gli stessi numeri negli stessi punti. Anche la traduzione si fa solo su richiesta esplicita, insieme all'utente.

1. **Schermate.** `npm run docs:screenshots -- --lang <lingua>` (tutti i percorsi superano il tempo di un comando: lanciali a gruppi). L'app parte con l'interfaccia nella lingua, e le pagine dei siti la ricevono dal locale del sistema. Controlla ogni schermata come per l'italiano, in più: nessun testo italiano rimasto (dati d'esempio, percorsi del forum), banner dei cookie nella lingua (`hideBanner` con il testo di `banner.*` in `examples/<lingua>.json`: se il banner resta, correggi lì il testo).
2. **Testi.** Traduci ogni `docs/it/<id>.md` in `docs/<lingua>/<id>.md` (stessi nomi dei file e delle immagini):
   - nomi dell'interfaccia identici a `locales/<lingua>.json`;
   - stessi numeri ❶ ❷ … negli stessi punti: controlla che la sequenza dei numeri di ogni guida sia identica a quella italiana;
   - il paragrafo della legenda: la frase `legend` di `docs/slideshow/strings.js` (senza l'HTML: il riquadro diventa *in rosso*, il numero ❶), che deve cominciare con `legendStart`: la presentazione lo riconosce da lì;
   - link alle altre guide invariati (`<id>.md`); il README della lingua (`../../README.md` per l'inglese, con le sue ancore);
   - stesso tono: seconda persona, frasi brevi.
3. **Indice e presentazione.** L'elenco della lingua in `docs/README.md`; `npm run docs:slideshow -- <lingua>` e `node docs/slideshow/preview.js <cartella> --lang <lingua>`.

**Una nuova lingua** richiede anche (le sette lingue dell'app li hanno già):
- in `docs/screenshots/run.js` il suo locale in `LOCALES`;
- `docs/screenshots/examples/<lingua>.json`, con le stesse chiavi degli altri (`tr` si ferma se ne manca una);
- i testi della presentazione in `docs/slideshow/strings.js` (anche `legend`/`legendStart`: la frase della legenda da usare identica nelle guide).

## Script delle schermate

Ogni percorso è un modulo `docs/screenshots/paths/<id>.js` che esporta una funzione `async () => {}`; `docs/screenshots/run.js` li esegue tutti o quelli indicati. Usa come esempio i moduli esistenti, se ci sono, o quelli nella storia git.

- **Nessun testo in una lingua negli script**: i testi dell'interfaccia (per trovare un pulsante, aspettare un'etichetta) con `t('chiave', params)` (da `../run`, da `locales/<lingua>.json`); i dati degli esempi (titoli dei siti, bookmark, pagine del forum, testi dei banner dei cookie) con `tr('chiave')`, da `docs/screenshots/examples/<lingua>.json` (stesse chiavi in ogni lingua: aggiungine una in tutti i file). Così lo stesso script genera le schermate di ogni lingua.
- `start('<id>', prefs)` (da `../run`): avvia l'app vera su una cartella dati temporanea, nella lingua delle schermate (`--lang`, italiano di default), con le preferenze `prefs` (es. `{ lists: [...] , settings: {...} }`, costruite con `site()` e `list()` di `test/e2e/helpers.js`). Restituisce l'app dei test UI (`page`, `app`, `show(app)`, `hide()`, `test()`, `inSite()`, `dir`, `close()`) più `shot(nome, marks)`, che salva `docs/it/img/<id>/<nome>.png`. Chiudi sempre con `o.close()` in un `finally`.
- `GAME` (Tiny Glade) e `BROTATO` (da `../run`): le applicazioni sopra cui aprire l'overlay, `o.show(GAME)`; `o.show(null)`: nessuna applicazione (lista Generale).
- Lo stato di partenza di un percorso ("Parte da" in `percorsi.md`) si costruisce con le preferenze, non ripetendo i percorsi precedenti: `tinyGladeList()` e `brotatoList()` (da `../run`) sono le liste degli esempi comuni.
- Siti che non si possono usare davvero (un login con un account, pagine sempre uguali): `serveSite(o, host, pagine)` (da `../run`) serve un sito d'esempio su un dominio riservato agli esempi (`*.example`), senza rete; le pagine sono HTML o `{ type, body }`. Il forum d'esempio dei percorsi è `docs/screenshots/sites/forum.js` (accesso con una finestra, discussioni, link, un'immagine, un campo di testo): riusalo o estendilo. Nella guida va detto che è un sito d'esempio.
- Finestre aperte dai siti (es. il login): sono finestre a sé, fuori dalla schermata. `drawPopups(o)` le disegna sopra l'overlay (evidenziabili come `'#doc-popups .popup'`), `clearPopups(o)` le toglie.
- Menu contestuale (nativo, fuori dalla schermata): `contextMenu(o, urlPrefix, selettore)` fa clic con il tasto destro su un elemento della pagina di un sito e disegna il menu con le voci vere dell'app nel punto del clic (voci evidenziabili come `'#doc-menu .item'`); `clearMenu(o)` lo toglie, `menuClick(o, voce)` esegue una voce.
- **Evidenziazioni**, `marks`: `[{ el, n, at, len }]` (`annotate.js`). `el`: un locator, un array di locator (un riquadro che li contiene) o un rettangolo, ad esempio di un elemento dentro la pagina di un sito con `siteRect(o, urlPrefix, selettore, testo)`; `n`: il numero (omesso se l'elemento evidenziato è uno solo); `at`: dove mettere il numero (`n`, `s`, `e`, `w`, `ne`, …); `len`: linea più lunga, per staccare il numero da altri riquadri. Numera nell'ordine in cui il testo cita gli elementi.
- Nomi delle schermate: `NN-descrizione` (`01-empty-home`), nell'ordine in cui compaiono nella guida.
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
- Non si possono riprendere: l'area di notifica, la combinazione di tasti, il gioco dietro l'overlay (anche l'opacità), i login veri. Per questi passi: solo testo, gli strumenti qui sopra (sito d'esempio, finestre e menu disegnati), oppure una soluzione decisa con l'utente.
- Non cliccare ciò che agisce fuori dall'app (es. "Mostra il file di log", "Scarica" di una nuova versione, link che aprono il browser del sistema): aprirebbe programmi sul sistema di chi genera.
- Un numero vicino a un bordo o tra elementi fitti può coprire testo o altri riquadri: cambia `at`/`len`, oppure usa un solo riquadro senza numeri per più elementi (`el: [a, b]`) e citali per nome nel testo.
- Per controllare molte schermate in una volta: `montage` (ImageMagick), se disponibile, le raccoglie in un foglio di miniature.
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
