// Finestra Electron che apre la presentazione indicata da DOCS_PAGE (vedi
// preview.js).
const path = require('path');
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 1440, height: 860 });
  w.loadFile(process.env.DOCS_PAGE || path.join(__dirname, '..', '..', 'it', 'slideshow.html'));
});
