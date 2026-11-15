const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveLists: (lists) => ipcRenderer.invoke('lists:save', lists),
  pinList: (id) => ipcRenderer.invoke('lists:pin', id),
  findPreset: (exe) => ipcRenderer.invoke('presets:find', exe),
  presetApplied: (exe) => ipcRenderer.invoke('presets:applied', exe),
  fetchTitle: (url) => ipcRenderer.invoke('site:title', url),
  bookmarkSources: () => ipcRenderer.invoke('bookmarks:sources'),
  readBookmarks: (id) => ipcRenderer.invoke('bookmarks:read', id),
  openBookmarkFile: () => ipcRenderer.invoke('bookmarks:file'),
  setShortcut: (accelerator) => ipcRenderer.invoke('shortcut:set', accelerator),
  suspendShortcut: (suspended) => ipcRenderer.invoke('shortcut:suspend', suspended),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  setLanguage: (language) => ipcRenderer.invoke('language:set', language),
  memory: () => ipcRenderer.invoke('memory:get'),
  openRepo: () => ipcRenderer.invoke('repo:open'),
  onHome: (callback) => ipcRenderer.on('nav:home', () => callback()),
  onSettings: (callback) => ipcRenderer.on('nav:settings', () => callback()),
  onForegroundApp: (callback) => ipcRenderer.on('app:foreground', (_e, app) => callback(app)),
  onOpenSite: (callback) => ipcRenderer.on('site:open', (_e, url, contentsId) => callback(url, contentsId)),
  onVisible:(callback) => ipcRenderer.on('win:visible', (_e, visible) => callback(visible)),
});
