# Percorsi d'uso

Questo file è la fonte della documentazione utente: ogni sezione descrive un percorso d'uso dell'app, da cui vengono generate la guida (`it/<id>.md`, con le schermate in `it/img/<id>/`) e la presentazione (`it/slideshow.html`). L'ordine delle sezioni è l'ordine delle guide.

La documentazione si rigenera da zero, solo su richiesta esplicita e insieme a chi la chiede, seguendo la skill `user-docs` (`.agents/skills/user-docs/SKILL.md`). Per aggiornarla a una nuova versione dell'app basta aggiungere, modificare o togliere percorsi qui, poi chiedere la rigenerazione.

Formato di ogni percorso:

```
## <id> — <titolo della guida>

Obiettivo: cosa impara chi legge.
Esempio: il gioco e i dati usati nelle schermate.
Parte da: lo stato dell'app all'inizio (quello lasciato dai percorsi precedenti, se serve).
Passi:
- un passo per riga; "(solo testo)" se non ha una schermata
Note: limiti, cose da non mostrare, dubbi da chiarire.
```

## Esempi comuni

- Il gioco principale degli esempi è **Tiny Glade** (eseguibile `tiny-glade`), il secondo **Brotato** (`Brotato.x86_64`, come su Linux). Altri giochi solo se un percorso li richiede.
- Siti reali dei giochi (sito ufficiale, pagina Steam, wiki); i bookmark sono di esempio, mai quelli dell'utente.
- I percorsi successivi partono dallo stato lasciato da quelli precedenti: la lista di Tiny Glade con il sito ufficiale, la pagina Steam e la wiki.

## getting-started — Primo avvio: i siti del tuo gioco a portata di mano

Obiettivo: aprire l'overlay sopra un gioco, aggiungere i primi siti alla sua lista, nasconderlo e riaprirlo.
Esempio: Tiny Glade; siti tinyglade.com e la pagina Steam del gioco.
Parte da: nessuna lista.
Passi:
- l'app parte nascosta nell'area di notifica, non è nella barra delle applicazioni né in Alt+Tab (solo testo)
- Win+F10 sopra il gioco: la Home con la lista del gioco, attiva e nuova, e la lista Generale tra le altre
- "+" nella barra, indirizzo, Aggiungi: il sito si apre nel suo tab, che prende il nome dalla pagina; la barra di navigazione (indietro, avanti, ricarica, indirizzo, Fissa)
- un secondo sito dal campo della Home; nome del sito per aprirlo, Modifica, Rimuovi
- passare da un tab all'altro: la pagina resta dove l'avevi lasciata
- nascondere l'overlay (combinazione o clic sul gioco) e riaprirlo sull'ultimo tab (solo testo)
Note: l'area di notifica e la combinazione di tasti non si possono riprendere.

## free-browsing — Navigazione libera: cerca, trova, fissa

Obiettivo: cercare e aprire pagine qualsiasi nel tab Naviga, e tenere quelle utili con Fissa.
Esempio: la ricerca "tiny glade wiki", la Tiny Glade Wiki.
Parte da: la lista di Tiny Glade con due siti.
Passi:
- il tab Naviga vuoto: campo indirizzo per indirizzi e ricerche, il nome del gioco proposto come esempio
- i risultati della ricerca; il motore si sceglie nelle Impostazioni
- la pagina trovata: Indietro, Fissa
- la conferma di Fissa
- la pagina diventa un tab in fondo alla lista; Fissa disattivato; Fissa anche nei tab dei siti
- il tab Naviga di nuovo vuoto; "Ritorna alla pagina iniziale"; la pagina iniziale nelle Impostazioni
- un indirizzo di un altro sito scritto in un tab di un sito si apre in Naviga, dopo una conferma (solo testo)
Note: le ricerche con DuckDuckGo (Google risponde alle ricerche automatiche con un captcha); dirlo nel testo.

## lists-per-game — Una lista per ogni gioco

Obiettivo: capire che ogni gioco (o programma) ha la sua lista, la lista Generale, scegliere una lista a mano, riordinare, rimuovere una lista.
Esempio: Tiny Glade e Brotato (Brotato Wiki, pagina Steam di Brotato).
Parte da: la lista di Tiny Glade con tre siti.
Passi:
- sopra Brotato: la sua lista nuova, Tiny Glade tra le altre liste; i siti aggiunti, con i loro tab
- di nuovo sopra Tiny Glade: i suoi tab, la sua lista attiva, Brotato tra le altre, Usa
- la lista Generale, quando non viene riconosciuta nessuna applicazione
- Usa: la lista scelta a mano, "Torna a …"
- riordinare tab e siti trascinandoli
- Rimuovi lista, con la conferma
Note: una lista viene creata con il primo sito; la Generale non si può rimuovere.

## bookmarks — Importare ed esportare i bookmark

Obiettivo: importare nelle liste i bookmark di un browser o di un file, ed esportare le liste.
Esempio: bookmark di esempio in finti profili di Google Chrome e Brave, con una cartella Giochi/Brotato e Giochi/Tiny Glade; la lista di Brotato ancora nuova.
Parte da: la lista di Tiny Glade con tre siti, l'overlay aperto sopra Brotato.
Passi:
- la sezione Bookmark in fondo alla Home: Importa, Esporta
- la finestra di importazione: Da (browser e profilo), File…, ricerca, caselle, Nella lista, Aggiungi N siti
- i siti importati nella lista
- la scheda Bookmark del "+", con i bookmark già nella lista non selezionabili
- l'esportazione: tutti i bookmark, l'elenco per lista, Esporta N siti
Note: su macOS solo da file; i browser supportati come nel README.

## customizing — Personalizzare l'overlay

Obiettivo: cambiare la combinazione di tasti, il comportamento, l'aspetto e la lingua.
Esempio: accento blu, tab fissi solo icona.
Parte da: la lista di Tiny Glade con tre siti.
Passi:
- le Impostazioni, sezione Tastiera: combinazione, Cambia, Ripristina predefinita
- la registrazione di una nuova combinazione (annullata con Esc); regole dei tasti ammessi; attenzione ai comandi del gioco
- sezione Comportamento: nascondi quando perde il focus (anche nel menu dell'icona), pagina iniziale, motore di ricerca, nuove versioni
- sezioni Aspetto e Lingua: colore d'accento, tab fissi, opacità, lingua
- l'overlay personalizzato
- le altre sezioni (Memoria, Diagnostica), rimandando alle loro guide (solo testo)
Note: non registrare davvero una combinazione (sarebbe una scorciatoia globale del sistema); l'opacità non si vede nelle schermate.

## memory — Memoria e pagine chiuse

Obiettivo: capire perché una pagina si ricarica, e controllare e liberare la memoria.
Esempio: pagine aperte nelle liste di Tiny Glade e di Brotato.
Parte da: le liste di Tiny Glade (tre siti) e Brotato (due siti).
Passi:
- perché una pagina si ricarica: chiusura delle pagine non usate, ricarica dall'ultimo indirizzo (solo testo)
- la sezione Memoria: tempo di chiusura, memoria usata, Chiudi tutte le pagine, processi dell'app, pagine per lista
- le pagine di una lista, con Chiudi per la lista e per la pagina; pagine che condividono un processo
- la memoria dopo aver chiuso le pagine di una lista
Note: le cifre sono quelle misurate durante la generazione.

## new-versions — Nuove versioni

Obiettivo: riconoscere l'avviso di una nuova versione e sapere come e quando l'app controlla.
Esempio: la versione 1.1.0 simulata.
Parte da: la lista di Tiny Glade con tre siti.
Passi:
- la striscia sotto la barra: Scarica, la ×; la versione nella Home
- la Home dopo aver chiuso la striscia
- quando controlla (all'avvio, ogni 6 ore, beta solo da una beta); l'opzione nelle Impostazioni; la versione del Microsoft Store
Note: in test l'app non controlla le versioni: la nuova versione si simula mandandola alla pagina.

## signing-in — Accedere a un sito e i cookie

Obiettivo: accedere con un account a un sito nell'overlay ed eliminare i cookie di un sito.
Esempio: un sito con "Continua con Google".
Parte da: la lista di Tiny Glade con tre siti.
Passi:
- il login apre una finestra sopra l'overlay; si nasconde e ricompare con l'overlay; chiusa, il focus torna all'overlay
- il menu "…" della barra di navigazione: Elimina i cookie del sito, con la conferma; la pagina si ricarica
- quando serve: uscire da un account, un sito che non funziona più
Note: il login vero non si può automatizzare (account reale): schermate di una pagina di prova o fatte a mano; da decidere con l'utente.

## links-and-menu — Link, nuovi tab e menu contestuale

Obiettivo: sapere cosa succede ai link che i siti aprono in un nuovo tab e usare il menu del tasto destro.
Esempio: link della Tiny Glade Wiki.
Parte da: la lista di Tiny Glade con tre siti.
Passi:
- un link che il sito apre in un nuovo tab: nel tab dello stesso sito, oppure la richiesta di aggiungerlo come nuovo sito
- tasto destro su un link: Apri link in un nuovo tab (aggiunto alla lista dopo una conferma), Copia link
- tasto destro su un'immagine o su un testo: Copia immagine, Copia, Seleziona tutto; nei campi di testo Annulla, Taglia, Incolla
Note: il menu contestuale è nativo, Playwright non lo vede: disegnarlo dalle sue voci o schermate fatte a mano; da decidere con l'utente.

## troubleshooting — Risoluzione dei problemi

Obiettivo: risolvere i problemi più comuni e raccogliere le informazioni per una segnalazione.
Esempio: nessuno in particolare.
Parte da: qualsiasi stato.
Passi:
- la combinazione non funziona: Wayland su Linux, tasti F su macOS, combinazione già usata da un altro programma (solo testo)
- l'icona nell'area di notifica non si vede (Windows, GNOME) (solo testo)
- la finestra non è trasparente (compositing su Linux) (solo testo)
- il gioco a schermo intero esclusivo copre l'overlay: finestra senza bordi (solo testo)
- la sezione Diagnostica: log dettagliato, Mostra il file di log, Svuota il log; cosa contiene il log e cosa no
Note: i dettagli per sistema sono nel README: rimandare, non ripetere.
