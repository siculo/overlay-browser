// Finestra Electron che apre la presentazione (vedi preview.js).
const path = require('path');
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 1440, height: 860 });
  w.loadFile(path.join(__dirname, '..', '..', 'it', 'presentazione.html'));
});
