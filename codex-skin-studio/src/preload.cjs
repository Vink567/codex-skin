const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skinStudio', {
  pickTheme: () => ipcRenderer.invoke('theme:pick'),
  importPaths: (paths) => ipcRenderer.invoke('theme:import-paths', paths),
  apply: (settings) => ipcRenderer.invoke('skin:apply', settings),
  launch: () => ipcRenderer.invoke('skin:launch'),
  restore: () => ipcRenderer.invoke('skin:restore'),
  status: () => ipcRenderer.invoke('skin:status')
});
