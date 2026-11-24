# Documentazione utente

Guide per percorsi d'uso, con le schermate dell'app vera.

## Italiano

- [Primo avvio: i siti del tuo gioco a portata di mano](it/primo-avvio.md)
- [Navigazione libera: cerca, trova, fissa](it/navigazione-libera.md)
- [Una lista per ogni gioco](it/liste-per-gioco.md)
- [Importare ed esportare i bookmark](it/importa-bookmark.md)
- [Personalizzare l'overlay](it/personalizza.md)
- [Memoria e pagine chiuse](it/memoria.md)
- [Nuove versioni](it/nuove-versioni.md)

## Schermate

Le schermate (`it/img/<guida>/`, una cartella per guida) sono generate da script Playwright (`screenshots/`), che avviano l'app su una cartella dati temporanea, come i test UI (`test/e2e/helpers.js`), e la aprono sopra un gioco simulato (Tiny Glade):

```sh
npm run docs:screenshots                        # tutti i percorsi
npm run docs:screenshots -- navigazione-libera  # solo quelli indicati
```

Ogni percorso è un modulo in `screenshots/paths/` (stesso nome della guida); `screenshots/run.js` li lancia e fornisce `start()` (l'app avviata, in italiano, con `shot()` per le schermate) e `hideBanner()` (nasconde i banner dei cookie dei siti, solo per le schermate).

Gli elementi citati nel testo sono evidenziati da `screenshots/annotate.js`: un riquadro rosso attorno a ogni elemento e, se sono più di uno, un numero collegato al riquadro, che nel testo compare accanto al nome dell'elemento come ❶ ❷ ❸ (cifre su cerchio pieno, U+2776…). Ogni schermata dichiara i suoi elementi (`shot(nome, [{ el, n, at, len }])`; `el` può essere anche un elemento dentro la pagina di un sito, con `siteRect()`), quindi se l'interfaccia cambia le evidenziazioni seguono gli elementi.

I bookmark delle schermate sono di esempio, in finti profili di browser creati nella cartella dati temporanea: quelli veri non vengono mai letti.

Usano la rete: i siti mostrati sono reali. La finestra compare sullo schermo mentre lo script gira. Le ricerche usano DuckDuckGo, perché Google risponde alle ricerche automatiche con un captcha. Riguarda sempre le schermate generate prima di salvarle, perché i siti cambiano (banner dei cookie, pagine che non esistono più).
