const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    frame: false,
    show: false,
    backgroundColor: '#FFF5F9',
    title: '粉色 PDF 分页器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 窗口控制：最小化 / 关闭
ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

// 选择 PDF 文件（阶段 2 拖拽区「点击选择」使用）
ipcMain.handle('dialog:select-pdf', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: '选择 PDF 文件',
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  return {
    ok: true,
    filePath: result.filePaths[0],
    fileName: path.basename(result.filePaths[0])
  };
});
