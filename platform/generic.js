// Platform implemented with Electron alone: used where there is no
// dedicated module, and as the base the other modules extend.
// See index.js for the interface.

module.exports = {
  id: 'generic',
  features: {
    keyboardHook: false,
    focusRestore: false,
    edgeSnap: false,
  },
  opacity: 'none',
  configureApp() {},
  init() {},
  beforeShow() {},
  afterShow(win) { win.focus(); },
  beforeHide() {},
};
