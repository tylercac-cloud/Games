const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddy', {
  ignoreMouse: v => ipcRenderer.send('ignore-mouse', !!v),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('drag-move', { dx, dy }),
  contextMenu: () => ipcRenderer.send('context-menu'),
  quit: () => ipcRenderer.send('quit'),
  onMenu: cb => ipcRenderer.on('menu', (e, cmd) => cb(cmd)),
});
