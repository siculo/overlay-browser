# Documentazione utente

Guide per percorsi d'uso, con le schermate dell'app vera.

Le guide sono disponibili in tutte le lingue dell’app. Le guide italiane si generano dai percorsi. Le traduzioni riprendono gli stessi passaggi con le schermate rigenerate nella lingua di ciascuna guida.

La fonte è l'elenco dei percorsi, [percorsi.md](percorsi.md): le guide, le schermate e la presentazione si rigenerano da zero a partire da lì, solo su richiesta esplicita e insieme a chi la chiede, seguendo la skill `user-docs` (`.agents/skills/user-docs/SKILL.md`, collegata in `.claude/skills/`). Per una nuova versione dell'app: aggiorna i percorsi, poi chiedi la rigenerazione.

## Italiano

- [Primo avvio: i siti del tuo gioco a portata di mano](it/getting-started.md)
- [Navigazione libera: cerca, trova, fissa](it/free-browsing.md)
- [Una lista per ogni gioco](it/lists-per-game.md)
- [Importare ed esportare i bookmark](it/bookmarks.md)
- [Personalizzare l'overlay](it/customizing.md)
- [Memoria e pagine chiuse](it/memory.md)
- [Nuove versioni](it/new-versions.md)
- [Accedere a un sito e i cookie](it/signing-in.md)
- [Link, nuovi tab e menu contestuale](it/links-and-menu.md)
- [Risoluzione dei problemi](it/troubleshooting.md)

Le stesse guide come presentazione: [it/slideshow.html](it/slideshow.html) (da aprire nel browser, anche senza server).

## English

- [Getting started: your game's sites at hand](en/getting-started.md)
- [Free browsing: search, find, pin](en/free-browsing.md)
- [One list per game](en/lists-per-game.md)
- [Importing and exporting bookmarks](en/bookmarks.md)
- [Customizing the overlay](en/customizing.md)
- [Memory and closed pages](en/memory.md)
- [New versions](en/new-versions.md)
- [Signing in to a site and cookies](en/signing-in.md)
- [Links, new tabs and the context menu](en/links-and-menu.md)
- [Troubleshooting](en/troubleshooting.md)

The same guides as a slideshow: [en/slideshow.html](en/slideshow.html).

## Français

- [Premiers pas : les sites de ton jeu à portée de main](fr/getting-started.md)
- [Navigation libre : chercher, trouver, épingler](fr/free-browsing.md)
- [Une liste par jeu](fr/lists-per-game.md)
- [Importer et exporter les favoris](fr/bookmarks.md)
- [Personnaliser l’overlay](fr/customizing.md)
- [Mémoire et pages fermées](fr/memory.md)
- [Nouvelles versions](fr/new-versions.md)
- [Se connecter à un site et les cookies](fr/signing-in.md)
- [Liens, nouveaux onglets et menu contextuel](fr/links-and-menu.md)
- [Résolution des problèmes](fr/troubleshooting.md)

Les mêmes guides en diaporama : [fr/slideshow.html](fr/slideshow.html).

## Deutsch

- [Erste Schritte – die Websites zu deinem Spiel griffbereit](de/getting-started.md)
- [Freies Surfen – suchen, finden, anheften](de/free-browsing.md)
- [Eine Liste pro Spiel](de/lists-per-game.md)
- [Lesezeichen importieren und exportieren](de/bookmarks.md)
- [Overlay anpassen](de/customizing.md)
- [Speicher und geschlossene Seiten](de/memory.md)
- [Neue Versionen](de/new-versions.md)
- [Bei einer Website anmelden und Cookies löschen](de/signing-in.md)
- [Links, neue Tabs und das Kontextmenü](de/links-and-menu.md)
- [Probleme beheben](de/troubleshooting.md)

Dieselben Anleitungen als Präsentation ([de/slideshow.html](de/slideshow.html)).

## Español

- [Primeros pasos para tener a mano los sitios de tu juego](es/getting-started.md)
- [Navegación libre para buscar, encontrar y fijar páginas](es/free-browsing.md)
- [Una lista por juego](es/lists-per-game.md)
- [Importar y exportar marcadores](es/bookmarks.md)
- [Personaliza el overlay](es/customizing.md)
- [Memoria y páginas cerradas](es/memory.md)
- [Nuevas versiones](es/new-versions.md)
- [Iniciar sesión en un sitio y eliminar sus cookies](es/signing-in.md)
- [Enlaces, pestañas nuevas y menú contextual](es/links-and-menu.md)
- [Solución de problemas](es/troubleshooting.md)

Las mismas guías en una presentación ([es/slideshow.html](es/slideshow.html)).

## Português (Brasil)

- [Primeiros passos para ter os sites do seu jogo à mão](pt/getting-started.md)
- [Navegação livre para pesquisar, encontrar e fixar páginas](pt/free-browsing.md)
- [Uma lista por jogo](pt/lists-per-game.md)
- [Importar e exportar favoritos](pt/bookmarks.md)
- [Personalize o overlay](pt/customizing.md)
- [Memória e páginas fechadas](pt/memory.md)
- [Novas versões](pt/new-versions.md)
- [Entrar em um site e excluir seus cookies](pt/signing-in.md)
- [Links, novas abas e menu de contexto](pt/links-and-menu.md)
- [Solução de problemas](pt/troubleshooting.md)

Os mesmos guias em uma apresentação ([pt/slideshow.html](pt/slideshow.html)).

## Русский

- [Первые шаги: сайты вашей игры под рукой](ru/getting-started.md)
- [Свободный просмотр: поиск и закрепление страниц](ru/free-browsing.md)
- [У каждой игры свой список](ru/lists-per-game.md)
- [Импорт и экспорт закладок](ru/bookmarks.md)
- [Настройка оверлея](ru/customizing.md)
- [Память и закрытие страниц](ru/memory.md)
- [Новые версии](ru/new-versions.md)
- [Вход на сайт и удаление cookie](ru/signing-in.md)
- [Ссылки, новые вкладки и контекстное меню](ru/links-and-menu.md)
- [Устранение неполадок](ru/troubleshooting.md)

Те же руководства в виде презентации ([ru/slideshow.html](ru/slideshow.html)).

## Presentazione

La presentazione di ogni lingua (`<lingua>/slideshow.html`) è generata dalle sue guide da `slideshow/build.js` con il modello `slideshow/template.html` e i testi di `slideshow/strings.js` (non va modificata a mano):

```sh
npm run docs:slideshow          # italiano
npm run docs:slideshow -- en    # inglese
```

Le guide e il loro ordine sono quelli di `percorsi.md` (un percorso senza la sua guida è segnalato e saltato). Ogni guida diventa una serie di slide: il titolo e l'introduzione, poi, per ogni sezione, ogni immagine con il testo che la precede, e il testo dopo l'ultima immagine come slide di solo testo. Si naviga con i pulsanti o con la tastiera (frecce, Fine/Inizio, Esc per il menu); ogni slide ha il suo indirizzo (`#getting-started/3`). Va rigenerata quando si cambia una guida. Per controllarla senza aprire un browser: `node docs/slideshow/preview.js <cartella> [--lang en]` salva le schermate del menu e delle slide.

## Schermate

Le schermate (`<lingua>/img/<guida>/`, una cartella per guida) sono generate da script Playwright (`screenshots/`), che avviano l'app su una cartella dati temporanea, come i test UI (`test/e2e/helpers.js`), e la aprono sopra un gioco simulato (Tiny Glade):

```sh
npm run docs:screenshots                        # tutti i percorsi
npm run docs:screenshots -- free-browsing  # solo quelli indicati
npm run docs:screenshots -- --lang en           # in inglese (docs/en/img/)
```

Ogni percorso è un modulo in `screenshots/paths/` (stesso nome della guida); `screenshots/run.js` li lancia e fornisce `start()` (l'app avviata, in italiano, con `shot()` per le schermate) e `hideBanner()` (nasconde i banner dei cookie dei siti, solo per le schermate).

Gli elementi citati nel testo sono evidenziati da `screenshots/annotate.js`: un riquadro rosso attorno a ogni elemento e, se sono più di uno, un numero collegato al riquadro, che nel testo compare accanto al nome dell'elemento come ❶ ❷ ❸ (cifre su cerchio pieno, U+2776…). Ogni schermata dichiara i suoi elementi (`shot(nome, [{ el, n, at, len }])`; `el` può essere anche un elemento dentro la pagina di un sito, con `siteRect()`), quindi se l'interfaccia cambia le evidenziazioni seguono gli elementi.

I bookmark delle schermate sono di esempio, in finti profili di browser creati nella cartella dati temporanea: quelli veri non vengono mai letti.

Le schermate di siti reali usano la rete. I siti esterni possono mostrare contenuti in inglese se non offrono una traduzione. La finestra compare sullo schermo mentre lo script gira. Le ricerche usano DuckDuckGo, perché Google risponde alle ricerche automatiche con un captcha. Riguarda sempre le schermate generate prima di salvarle, perché i siti cambiano (banner dei cookie, pagine che non esistono più).
