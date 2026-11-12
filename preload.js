const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveSites: (sites) => ipcRenderer.invoke('sites:save', sites),
  setActiveTab: (id) => ipcRenderer.invoke('tab:setActive', id),
  fetchTitle: (url) => ipcRenderer.invoke('site:title', url),
  setShortcut: (accelerator) => ipcRenderer.invoke('shortcut:set', accelerator),
  suspendShortcut: (suspended) => ipcRenderer.invoke('shortcut:suspend', suspended),
});
