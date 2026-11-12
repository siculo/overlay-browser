const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  loadSites: () => ipcRenderer.invoke('sites:load'),
  saveSites: (sites) => ipcRenderer.invoke('sites:save', sites),
  fetchTitle: (url) => ipcRenderer.invoke('site:title', url),
});
