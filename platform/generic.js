// Platform implemented with Electron alone: used where there is no
// dedicated module, and as the base the other modules extend.
// See index.js for the interface.

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
  trayImage(image) { return image; },
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
