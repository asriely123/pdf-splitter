const { contextBridge, ipcRenderer } = require('electron');

// 渲染进程只能通过 window.pdfTool 访问这些白名单方法
contextBridge.exposeInMainWorld('pdfTool', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  selectPdf: () => ipcRenderer.invoke('dialog:select-pdf')
});
