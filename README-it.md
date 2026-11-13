# Overlay Browser

[English](README.md) · **Italiano**

> L'interfaccia dell'app è in inglese. Qui sotto pulsanti e voci di menu sono riportati come appaiono nell'app, seguiti dal significato in italiano.

Una piccola finestra di browser che resta sempre in primo piano, anche sopra i giochi in modalità finestra/finestra senza bordi, e che si mostra o nasconde premendo un tasto (di default **F10**).

Utile per tenere a portata di mano siti come wiki, calcolatori o database mentre si gioca.

## Installazione

Ci sono due versioni, scegline una:

- **`Overlay Browser-Setup-x.y.z.exe`** (consigliata): la installa sul PC. Non servono permessi di amministratore e viene creato il collegamento nel menu Start.
- **`Overlay Browser-Portable-x.y.z.exe`**: non installa nulla, basta avviarla. Parte un po' più lentamente.

### Avviso "Windows ha protetto il PC"

L'eseguibile non è firmato digitalmente (la firma costa ed è un progetto tra amici), quindi al primo avvio Windows mostra un avviso blu di SmartScreen. Per proseguire:

1. clicca **Ulteriori informazioni**;
2. clicca **Esegui comunque**.

Succede solo la prima volta. Se l'antivirus segnala il file, è quasi sicuramente un falso positivo dovuto alla mancanza di firma.

## Uso

- All'avvio la finestra resta nascosta: l'app si mette in attesa nell'area di notifica. Premi **F10** per mostrarla e premilo di nuovo per nasconderla. Di default si nasconde da sola anche quando clicchi su un'altra finestra (ad esempio tornando al gioco); si può disattivare dalle Impostazioni.
- L'app **non compare nella barra delle applicazioni** né in Alt+Tab: la trovi nell'area di notifica in basso a destra, vicino all'orologio (icona nera con una finestrella bianca). Se non la vedi, clicca sulla freccia **^** e trascina l'icona sulla barra per tenerla sempre visibile.
  - **Clic** sull'icona: mostra/nasconde la finestra.
  - **Tasto destro**: menu con *Show/Hide* (Mostra/Nascondi), *Home*, *Settings* (Impostazioni) e *Quit* (Esci).
- Per **chiudere** l'app usa *Quit* (Esci) dal menu dell'icona (oppure Alt+F4 con la finestra in primo piano).
- La finestra si **sposta** trascinando la barra in alto (lo spazio libero accanto ai pulsanti) e si **ridimensiona** dai bordi. Posizione e dimensione vengono ricordate.

### Siti

- La barra in alto ha il pulsante **Home** e un pulsante per ogni sito. Se i pulsanti non ci stanno, usa le frecce ◀ ▶ o la rotella del mouse sopra la barra.
- Ogni sito funziona come una scheda: cambiando sito e tornando indietro ritrovi la pagina esattamente dove l'avevi lasciata.
- Alla riapertura dell'app viene mostrato l'ultimo sito che stavi guardando.

Dalla **Home** puoi gestire l'elenco:

- **Aggiungi** (*Add*): scrivi l'indirizzo nel campo in fondo (basta anche `example.com`) e premi *Add* (Aggiungi). Il nome viene preso automaticamente dal titolo del sito.
- **Modifica** (*Edit*): cambia l'indirizzo di un sito (Invio per salvare, Esc per annullare).
- **Rimuovi** (*Remove*): toglie il sito dall'elenco.
- Clicca sul nome di un sito per aprirlo.

### Cambiare il tasto

Apri le **Impostazioni** con il pulsante ⚙ in alto a destra (o dal menu dell'icona), sezione *Keyboard* (Tastiera):

1. clicca **Change** (Cambia);
2. premi la combinazione che preferisci, ad esempio `Ctrl+Shift+O` (Esc per annullare).

Sono ammessi i tasti F1–F24 da soli, oppure qualunque tasto insieme a Ctrl, Alt, Shift o Win. Se la combinazione è già usata da un altro programma compare un messaggio e resta quella precedente. *Reset to F10* torna al tasto di default.

> **Attenzione in gioco:** mentre giochi (ad esempio a Star Citizen) la combinazione arriva anche al gioco, oltre che all'overlay. Scegline una che nel gioco non è assegnata a nessun comando, altrimenti aprendo l'overlay attiverai anche quel comando.

> **Nota per i giochi:** alcuni giochi in schermo intero "esclusivo" coprono qualsiasi finestra. In quel caso imposta il gioco in modalità *finestra senza bordi* (borderless).

## Preferenze e disinstallazione

Siti, tasto, posizione della finestra e ultimo sito aperto sono salvati in:

```
%APPDATA%\overlay-browser\prefs.json
```

Per ripartire da zero chiudi l'app ed elimina quel file.

Per **disinstallare** la versione installata: *Impostazioni di Windows → App → App installate → Overlay Browser → Disinstalla*. La cartella `%APPDATA%\overlay-browser` va eliminata a mano se vuoi cancellare anche le preferenze. La versione portable si rimuove semplicemente cancellando il file `.exe`.

---

## Per lo sviluppo

Richiede [Node.js](https://nodejs.org/).

```sh
npm install          # installa le dipendenze
npm start            # avvia l'app in sviluppo
npm run dist         # genera installer e versione portable in dist/
npm run dist:installer
npm run dist:portable
```

In IntelliJ sono disponibili le run configuration *Electron (npm start)* e *Electron (debug main)* nella cartella `.run/`.
