const { contextBridge, ipcRenderer, webUtils } = require('electron');

// 渲染进程只能通过 window.pdfTool 访问这些白名单方法
contextBridge.exposeInMainWorld('pdfTool', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  selectPdf: () => ipcRenderer.invoke('dialog:select-pdf'),
  inspect: (payload) => ipcRenderer.invoke('pdf:inspect', payload),
  split: (payload) => ipcRenderer.invoke('pdf:split', payload),
  chooseOutput: () => ipcRenderer.invoke('dialog:choose-output'),
  openFolder: (dir) => ipcRenderer.invoke('shell:open-folder', dir),
  openPath: (target) => ipcRenderer.invoke('shell:open-path', target),
  onSplitProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pdf:split-progress', listener);
    return () => ipcRenderer.removeListener('pdf:split-progress', listener);
  },
  getPathForFile: (file) => webUtils.getPathForFile(file)
});
