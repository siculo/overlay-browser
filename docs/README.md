# Documentazione utente

Guide per percorsi d'uso, con le schermate dell'app vera.

## Italiano

- [Primo avvio: i siti del tuo gioco a portata di mano](it/primo-avvio.md)

## Schermate

Le schermate (`it/img/`) sono generate da script Playwright (`screenshots/`), che avviano l'app su una cartella dati temporanea, come i test UI (`test/e2e/helpers.js`), e la aprono sopra un gioco simulato (Tiny Glade):

```sh
npm run docs:screenshots
```

Gli elementi citati nel testo sono evidenziati da `screenshots/annotate.js`: un riquadro rosso attorno a ogni elemento e, se sono più di uno, un numero collegato al riquadro, che nel testo compare accanto al nome dell'elemento come ❶ ❷ ❸ (cifre su cerchio pieno, U+2776…). Ogni schermata dichiara i suoi elementi (`shot(nome, [{ el, n, at }])`), quindi se l'interfaccia cambia le evidenziazioni seguono gli elementi.

Usano la rete: i siti mostrati sono reali. La finestra compare sullo schermo mentre lo script gira. Riguarda sempre le schermate generate prima di salvarle, perché i siti cambiano (banner dei cookie, pagine che non esistono più).
