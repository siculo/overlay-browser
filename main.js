const { app, BrowserWindow, globalShortcut } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1000, height: 700,
    frame: false, show: false, opacity: 0.95,
    alwaysOnTop: true,
    webPreferences: { webviewTag: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile('index.html');

  globalShortcut.register('F10', () => {
    if (win.isVisible()) win.hide();
    else { win.show(); win.focus(); }
  });
});
app.on('window-all-closed', () => app.quit());