const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddy', {
  ignoreMouse: v => ipcRenderer.send('ignore-mouse', !!v),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('drag-move', { dx, dy }),
  contextMenu: () => ipcRenderer.send('context-menu'),
  quit: () => ipcRenderer.send('quit'),
  onMenu: cb => ipcRenderer.on('menu', (e, cmd) => cb(cmd)),
  saveSync: json => ipcRenderer.sendSync('save-sync', json),   // written to disk before the call returns
  loadSync: () => ipcRenderer.sendSync('load-sync'),
  settings: () => ipcRenderer.sendSync('settings-get'),
  setOnTop: v => ipcRenderer.send('settings-ontop', !!v),
  setStartup: v => ipcRenderer.send('settings-startup', !!v),
  hideHer: () => ipcRenderer.send('hide-her'),
  checkUpdate: () => ipcRenderer.send('update-check'),
  installUpdate: () => ipcRenderer.send('update-install'),
  onUpdate: cb => ipcRenderer.on('update-status', (e, u) => cb(u)),
  exportBackup: json => ipcRenderer.invoke('backup-export', json),
  importBackup: () => ipcRenderer.invoke('backup-import'),
});
