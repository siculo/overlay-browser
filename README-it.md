# Overlay Browser

[English](README.md) · **Italiano**

Una piccola finestra di browser che resta sempre in primo piano, anche sopra i giochi in modalità finestra/finestra senza bordi, e che si mostra o nasconde premendo una combinazione di tasti (di default **Win+F10**, **Cmd+Shift+Spazio** su macOS).

Utile per tenere a portata di mano siti come wiki, calcolatori o database mentre si gioca.

## Installazione

Scarica il file per il tuo sistema dalla pagina delle [**Release**](https://github.com/siculo/overlay-browser/releases) (la più recente è in cima).

Su Windows ci sono due versioni, scegline una:

- **`Overlay Browser-Setup-x.y.z.exe`** (consigliata): la installa sul PC. Non servono permessi di amministratore e viene creato il collegamento nel menu Start.
- **`Overlay Browser-Portable-x.y.z.exe`**: non installa nulla, basta avviarla. Parte un po' più lentamente.

### Avviso "Windows ha protetto il PC"

L'eseguibile non è firmato digitalmente (la firma costa ed è un progetto tra amici), quindi al primo avvio Windows mostra un avviso blu di SmartScreen. Per proseguire:

1. clicca **Ulteriori informazioni**;
2. clicca **Esegui comunque**.

Succede solo la prima volta. Se l'antivirus segnala il file, è quasi sicuramente un falso positivo dovuto alla mancanza di firma.

### Linux

Su Linux c'è **`Overlay Browser-x.y.z-x86_64.AppImage`**: rendilo eseguibile (`chmod +x`, oppure *Proprietà → Permessi*) e avvialo. Alcune distribuzioni richiedono il pacchetto `libfuse2` per eseguire le AppImage.

- Serve una sessione **X11**. Sotto Wayland l'app gira tramite XWayland, ma la scorciatoia non viene vista mentre è attiva una finestra Wayland nativa.
- La trasparenza della finestra richiede un window manager con compositing (Cinnamon, KDE, GNOME e Xfce con il compositing attivo): senza, la finestra resta opaca.
- L'icona nell'area di notifica usa AppIndicator: su GNOME serve l'estensione *AppIndicator and KStatusNotifierItem Support*. In alcuni ambienti il clic sull'icona apre il menu invece di mostrare la finestra: usa la voce *Mostra/Nascondi*.

### macOS

Su macOS c'è **`Overlay Browser-x.y.z-arm64.dmg`** (Apple Silicon) oppure **`-x64.dmg`** (Intel): aprilo e trascina l'app in *Applicazioni*. L'app non è firmata da uno sviluppatore Apple, quindi al primo avvio macOS si rifiuta di aprirla: vai in *Impostazioni di Sistema → Privacy e sicurezza* e fai clic su **Apri comunque** (oppure esegui `xattr -dr com.apple.quarantine "/Applications/Overlay Browser.app"` nel Terminale).

- L'app non ha un'icona nel Dock: sta nella **barra dei menu**, in alto a destra. Il clic sull'icona apre il suo menu.
- La finestra compare anche sopra le app e i giochi a schermo intero, senza prendere il posto dell'applicazione attiva: quando si nasconde, la tastiera torna al gioco.
- La combinazione di default è **Cmd+Shift+Spazio**. Se scegli un tasto funzione, ricorda che di default F1–F12 regolano luminosità, volume e così via: premili insieme a **fn**, oppure attiva *Impostazioni di Sistema → Tastiera → Usa i tasti F1, F2 ecc. come tasti funzione standard*.

## Uso

- All'avvio la finestra resta nascosta: l'app si mette in attesa nell'area di notifica. Premi **Win+F10** (Super+F10 su Linux, Cmd+Shift+Spazio su macOS) per mostrarla e premi di nuovo la combinazione per nasconderla. Di default si nasconde da sola anche quando clicchi su un'altra finestra (ad esempio tornando al gioco); si può disattivare dalle Impostazioni.
- L'app **non compare nella barra delle applicazioni** né in Alt+Tab: la trovi nell'area di notifica in basso a destra, vicino all'orologio (icona nera con una finestrella bianca). Se non la vedi, clicca sulla freccia **^** e trascina l'icona sulla barra per tenerla sempre visibile.
  - **Clic** sull'icona: mostra/nasconde la finestra.
  - **Tasto destro**: menu con *Mostra/Nascondi*, *Home*, *Impostazioni* ed *Esci*.
- Per **chiudere** l'app usa *Esci* dal menu dell'icona (oppure Alt+F4 con la finestra in primo piano).
- La finestra si **sposta** trascinando la barra in alto (lo spazio libero accanto ai pulsanti) e si **ridimensiona** dai bordi. Posizione e dimensione vengono ricordate.

### Siti

- La barra in alto ha i tab fissi **Home**, **Naviga** e **Impostazioni**, un tab per ogni sito e il pulsante **+** per aggiungere un sito. Se i tab non ci stanno, usa le frecce ◀ ▶ o la rotella del mouse sopra la barra. I tab si riordinano trascinandoli. Nelle Impostazioni (*Aspetto*) puoi scegliere se i tab fissi mostrano icona e nome o solo l'icona.
- Ogni sito funziona come una scheda: cambiando sito e tornando indietro ritrovi la pagina esattamente dove l'avevi lasciata.
- Le pagine che non stai guardando vengono chiuse dopo un po' per liberare memoria (di default 30 minuti, da 5 a 60 nelle Impostazioni): riaprendo il tab si ricarica l'ultimo indirizzo visitato.
- Alla riapertura dell'overlay viene mostrato l'ultimo tab che stavi guardando.

Dalla **Home** puoi gestire l'elenco:

- **Aggiungi**: scrivi l'indirizzo nel campo in fondo (basta anche `example.com`) e premi *Aggiungi*. Il nome viene preso automaticamente dal titolo del sito.
- **Modifica**: cambia l'indirizzo di un sito (Invio per salvare, Esc per annullare).
- **Rimuovi**: toglie il sito dall'elenco.
- Clicca sul nome di un sito per aprirlo.

### Navigazione libera

Il tab **Naviga** apre qualsiasi pagina senza aggiungerla all'elenco. Nel suo campo indirizzo scrivi un indirizzo (basta anche `example.com`) oppure un testo qualsiasi per cercarlo, di default con Google: il motore di ricerca (Google, Bing, DuckDuckGo, Brave Search, Ecosia, Startpage, oppure un indirizzo di ricerca personalizzato con `%s` al posto del testo cercato) e una pagina iniziale si scelgono nelle Impostazioni.

**Fissa**, nella barra di navigazione del tab Naviga e dei tab dei siti, trasforma la pagina aperta, con la sua cronologia, in un nuovo tab della lista. Se la pagina è già uno dei tab della lista, quel tab viene evidenziato.

Usa **−** o **+** nel menu **…** per regolare lo zoom della pagina. Fai clic sulla percentuale per tornare al 100%. Le scorciatoie sono **Ctrl++**, **Ctrl+-** e **Ctrl+0** (anche con **⌘** su macOS).

### Bookmark

- **Importa**: *Importa bookmark…*, nella sezione *Bookmark* in fondo alla Home, oppure la scheda *Bookmark* della finestra del **+**, aggiunge siti dai bookmark di un browser (Chrome, Edge, Brave, Opera, Vivaldi, Chromium, Firefox, LibreWolf e altri browser simili; Firefox può restare aperto) oppure da un file HTML di bookmark esportato da qualsiasi browser. Scegli bookmark e cartelle con le caselle, o trovali con la ricerca; i siti già presenti nella lista vengono saltati. Su macOS i bookmark si importano solo da file: esportali prima dal browser.
- **Esporta**: *Esporta bookmark…* salva i siti delle liste in un file HTML di bookmark, con una cartella per lista, che qualsiasi browser può importare.

### Cambiare il tasto

Apri il tab **Impostazioni** (o *Impostazioni* dal menu dell'icona), sezione *Tastiera*:

1. clicca **Cambia**;
2. premi la combinazione che preferisci, ad esempio `Ctrl+Shift+O` (Esc per annullare).

Sono ammessi i tasti F1–F24 da soli, oppure qualunque tasto insieme a Ctrl, Alt, Shift o Win (Super su Linux, Cmd su macOS). Se la combinazione è già usata da un altro programma compare un messaggio e resta quella precedente. *Ripristina predefinita* torna alla combinazione di default.

### Trasparenza

La finestra è leggermente trasparente, così si intravede il gioco dietro. Per regolarla apri le **Impostazioni**, sezione *Aspetto*, e sposta il cursore *Opacità della finestra* (dal 30% al 100%, cioè opaca). La modifica si applica subito.

### Lingua

L'app usa la lingua del sistema, se è tra quelle disponibili (italiano, inglese, francese, portoghese, russo, spagnolo e tedesco); altrimenti usa l'inglese. Per sceglierne un'altra apri le **Impostazioni**, sezione *Lingua*: puoi scegliere *Lingua di sistema* oppure una delle lingue dell'app. La modifica si applica subito.

> **Attenzione in gioco:** mentre giochi (ad esempio a Star Citizen) la combinazione arriva anche al gioco, oltre che all'overlay. Scegline una che nel gioco non è assegnata a nessun comando, altrimenti aprendo l'overlay attiverai anche quel comando.

> **Nota per i giochi:** alcuni giochi in schermo intero "esclusivo" coprono qualsiasi finestra. In quel caso imposta il gioco in modalità *finestra senza bordi* (borderless).

## Preferenze e disinstallazione

Siti, tasto, lingua, posizione della finestra e ultimo sito aperto sono salvati in:

```
%APPDATA%\overlay-browser\prefs.json         (Windows)
~/.config/overlay-browser/prefs.json         (Linux)
~/Library/Application Support/overlay-browser/prefs.json   (macOS)
```

Per ripartire da zero chiudi l'app ed elimina quel file.

Per **disinstallare** la versione installata: *Impostazioni di Windows → App → App installate → Overlay Browser → Disinstalla*. La cartella `%APPDATA%\overlay-browser` va eliminata a mano se vuoi cancellare anche le preferenze. La versione portable si rimuove semplicemente cancellando il file `.exe`, l'AppImage cancellando il file `.AppImage`, l'app per macOS trascinandola da *Applicazioni* nel Cestino.

---

## Per lo sviluppo

Richiede [Node.js](https://nodejs.org/).

```sh
npm install          # installa le dipendenze
npm start            # avvia l'app in sviluppo
npm run dist         # genera i pacchetti per il sistema corrente in dist/
npm run dist:win     # Windows: installer e versione portable
npm run dist:installer
npm run dist:portable
npm run dist:linux   # Linux: AppImage (va generata su Linux)
npm run dist:mac     # macOS: DMG per Apple Silicon e Intel (va generato su macOS)
```

Tutto ciò che dipende dal sistema operativo è in `platform/`, un modulo per sistema (`win32.js`, `linux.js`, `darwin.js`, e `generic.js` con il solo Electron, usato per gli altri sistemi). Ogni modulo dichiara in `features` quali funzionalità supporta; l'interfaccia è descritta in `platform/index.js`.

I testi dell'interfaccia sono in `locales/`, un file JSON per lingua (il nome del file è il codice della lingua, ad esempio `it.json`). Per aggiungere una lingua basta copiare `en.json` e tradurne i valori: l'app la rileva da sola. Le chiavi mancanti vengono prese dall'inglese.

In IntelliJ sono disponibili le run configuration *Electron (npm start)* e *Electron (debug main)* nella cartella `.run/`.

### Link simbolici su Windows

Il repository contiene link simbolici: `.claude/skills/user-docs` punta a `.agents/skills/user-docs`, la skill che rigenera la documentazione utente (`docs/`), condivisa tra i coding agent. Su Windows, Git li crea come link veri solo se `core.symlinks` è attivo e se il sistema permette di creare link simbolici (la *Modalità sviluppatore* attiva, oppure Git eseguito come amministratore); altrimenti al posto del link c'è un file di testo che contiene il percorso. Prima di clonare, attiva la *Modalità sviluppatore* (*Impostazioni → Sistema → Per sviluppatori*), poi:

```sh
git clone -c core.symlinks=true https://github.com/siculo/overlay-browser.git
```

In un clone esistente (con la *Modalità sviluppatore* attiva): `git config core.symlinks true`, poi cancella il file `.claude/skills/user-docs` e ricrealo come link con `git checkout -- .claude/skills/user-docs`.
