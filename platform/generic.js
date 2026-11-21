// Platform implemented with Electron alone: used where there is no
// dedicated module, and as the base the other modules extend.
// See index.js for the interface.

const { nativeImage } = require('electron');

module.exports = {
  id: 'generic',
  features: {
    keyboardHook: false,
    focusRestore: false,
    edgeSnap: false,
    appDetect: false,
  },
  opacity: 'none',
  windowOptions: {},
  // A bare F10 is too easy to press by mistake, and often bound in games.
  defaultShortcut: 'Super+F10',
  configureApp() {},
  init() {},
  // The 16 px icon (simplified drawing) at normal density, the 32 px one at
  // high density: the system picks the representation for its scale.
  trayImage(small, large) {
    const tray = nativeImage.createEmpty();
    tray.addRepresentation({ scaleFactor: 1, buffer: small.toPNG() });
    tray.addRepresentation({ scaleFactor: 2, buffer: large.toPNG() });
    return tray;
  },
  beforeShow() {},
  afterShow(win) { win.focus(); },
  beforeHide() {},
  foregroundApp() { return null; },
  ownsForeground() { return null; },
  bookmarkStores() { return []; },
  // Electron's values are in kilobytes.
  memoryUsage(metrics) {
    return { kind: 'workingSet', bytes: new Map(metrics.map((m) => [m.pid, m.memory.workingSetSize * 1024])) };
  },
};
