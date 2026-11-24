# Documentazione utente

Guide per percorsi d'uso, con le schermate dell'app vera.

Le guide sono in italiano e in inglese: le italiane si generano dai percorsi, le altre lingue sono loro traduzioni, con le schermate rigenerate nella lingua.

La fonte è l'elenco dei percorsi, [percorsi.md](percorsi.md): le guide, le schermate e la presentazione si rigenerano da zero a partire da lì, solo su richiesta esplicita e insieme a chi la chiede, seguendo la skill `user-docs` (`.agents/skills/user-docs/SKILL.md`, collegata in `.claude/skills/`). Per una nuova versione dell'app: aggiorna i percorsi, poi chiedi la rigenerazione.

## Italiano

- [Primo avvio: i siti del tuo gioco a portata di mano](it/primo-avvio.md)
- [Navigazione libera: cerca, trova, fissa](it/navigazione-libera.md)
- [Una lista per ogni gioco](it/liste-per-gioco.md)
- [Importare ed esportare i bookmark](it/importa-bookmark.md)
- [Personalizzare l'overlay](it/personalizza.md)
- [Memoria e pagine chiuse](it/memoria.md)
- [Nuove versioni](it/nuove-versioni.md)
- [Accedere a un sito e i cookie](it/accedere-ai-siti.md)
- [Link, nuovi tab e menu contestuale](it/link-e-menu.md)
- [Risoluzione dei problemi](it/problemi.md)

Le stesse guide come presentazione: [it/presentazione.html](it/presentazione.html) (da aprire nel browser, anche senza server).

## English

- [Getting started: your game's sites at hand](en/primo-avvio.md)
- [Free browsing: search, find, pin](en/navigazione-libera.md)
- [One list per game](en/liste-per-gioco.md)
- [Importing and exporting bookmarks](en/importa-bookmark.md)
- [Customizing the overlay](en/personalizza.md)
- [Memory and closed pages](en/memoria.md)
- [New versions](en/nuove-versioni.md)
- [Signing in to a site and cookies](en/accedere-ai-siti.md)
- [Links, new tabs and the context menu](en/link-e-menu.md)
- [Troubleshooting](en/problemi.md)

The same guides as a slideshow: [en/slideshow.html](en/slideshow.html).

## Presentazione

La presentazione di ogni lingua (`it/presentazione.html`, `en/slideshow.html`) è generata dalle sue guide da `slideshow/build.js` con il modello `slideshow/template.html` e i testi di `slideshow/strings.js` (non va modificata a mano):

```sh
npm run docs:slideshow          # italiano
npm run docs:slideshow -- en    # inglese
```

Le guide e il loro ordine sono quelli di `percorsi.md` (un percorso senza la sua guida è segnalato e saltato). Ogni guida diventa una serie di slide: il titolo e l'introduzione, poi, per ogni sezione, ogni immagine con il testo che la precede, e il testo dopo l'ultima immagine come slide di solo testo. Si naviga con i pulsanti o con la tastiera (frecce, Fine/Inizio, Esc per il menu); ogni slide ha il suo indirizzo (`#primo-avvio/3`). Va rigenerata quando si cambia una guida. Per controllarla senza aprire un browser: `node docs/slideshow/preview.js <cartella> [--lang en]` salva le schermate del menu e delle slide.

## Schermate

Le schermate (`<lingua>/img/<guida>/`, una cartella per guida) sono generate da script Playwright (`screenshots/`), che avviano l'app su una cartella dati temporanea, come i test UI (`test/e2e/helpers.js`), e la aprono sopra un gioco simulato (Tiny Glade):

```sh
npm run docs:screenshots                        # tutti i percorsi
npm run docs:screenshots -- navigazione-libera  # solo quelli indicati
npm run docs:screenshots -- --lang en           # in inglese (docs/en/img/)
```

Ogni percorso è un modulo in `screenshots/paths/` (stesso nome della guida); `screenshots/run.js` li lancia e fornisce `start()` (l'app avviata, in italiano, con `shot()` per le schermate) e `hideBanner()` (nasconde i banner dei cookie dei siti, solo per le schermate).

Gli elementi citati nel testo sono evidenziati da `screenshots/annotate.js`: un riquadro rosso attorno a ogni elemento e, se sono più di uno, un numero collegato al riquadro, che nel testo compare accanto al nome dell'elemento come ❶ ❷ ❸ (cifre su cerchio pieno, U+2776…). Ogni schermata dichiara i suoi elementi (`shot(nome, [{ el, n, at, len }])`; `el` può essere anche un elemento dentro la pagina di un sito, con `siteRect()`), quindi se l'interfaccia cambia le evidenziazioni seguono gli elementi.

I bookmark delle schermate sono di esempio, in finti profili di browser creati nella cartella dati temporanea: quelli veri non vengono mai letti.

Usano la rete: i siti mostrati sono reali. La finestra compare sullo schermo mentre lo script gira. Le ricerche usano DuckDuckGo, perché Google risponde alle ricerche automatiche con un captcha. Riguarda sempre le schermate generate prima di salvarle, perché i siti cambiano (banner dei cookie, pagine che non esistono più).
