const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  getPageCount,
  extractPages,
  sanitizeFileName,
  buildOutputBaseName,
  uniqueOutputPath
} = require('./lib/qpdf');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    frame: false,
    show: false,
    backgroundColor: '#FFF5F9',
    title: 'PDF分页器',
    icon: path.join(__dirname, 'assets', 'icon-256.png'),
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

// 读取 PDF 信息（总页数），支持带密码重试
ipcMain.handle('pdf:inspect', async (event, payload) => {
  const filePath = payload && payload.filePath;
  const password = payload && payload.password;
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'invalid-path' };
  }

  const result = await getPageCount(filePath, password, {
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath
  });

  if (result.ok) {
    return {
      ok: true,
      fileName: path.basename(filePath),
      pageCount: result.pageCount
    };
  }
  return {
    ok: false,
    needPassword: result.needPassword,
    error: friendlyQpdfError(result)
  };
});

// 按分段切分 PDF，逐段发送进度事件
ipcMain.handle('pdf:split', async (event, payload) => {
  const { filePath, password, outputDir, segments } = payload || {};
  if (!filePath || typeof filePath !== 'string' || !Array.isArray(segments) || segments.length === 0) {
    return { ok: false, error: '参数不正确，请重新导入 PDF' };
  }

  const sender = event.sender;
  const qpdfOptions = {
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath
  };

  const ext = path.extname(filePath);
  const baseName = (sanitizeFileName(path.basename(filePath, ext)) || '未命名').slice(0, 60);
  const dir = outputDir || path.join(path.dirname(filePath), `${baseName}_分页结果`);

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { ok: false, error: `无法创建输出文件夹：${err.message}` };
  }

  const files = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const start = Number(seg && seg.start);
    const end = Number(seg && seg.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      sender.send('pdf:split-progress', {
        index: i,
        total: segments.length,
        status: 'error',
        label: `第 ${i + 1} 段`
      });
      return { ok: false, error: `第 ${i + 1} 段页码范围不正确`, index: i };
    }

    const defaultOutBase = `${baseName}_第${i + 1}段_第${start}-${end}页`;
    const outBase = buildOutputBaseName(seg && seg.name, defaultOutBase);
    const outPath = uniqueOutputPath(dir, outBase, '.pdf');

    sender.send('pdf:split-progress', {
      index: i,
      total: segments.length,
      status: 'processing',
      label: path.basename(outPath)
    });

    const result = await extractPages({
      inputPath: filePath,
      outputPath: outPath,
      startPage: start,
      endPage: end,
      password,
      qpdfOptions
    });

    if (!result.ok) {
      sender.send('pdf:split-progress', {
        index: i,
        total: segments.length,
        status: 'error',
        label: path.basename(outPath)
      });
      return {
        ok: false,
        error: result.needPassword ? '密码不正确，无法切分' : `第 ${i + 1} 段切分失败：${friendlyQpdfError(result)}`,
        index: i,
        needPassword: result.needPassword
      };
    }

    sender.send('pdf:split-progress', {
      index: i,
      total: segments.length,
      status: 'done',
      label: path.basename(outPath)
    });
    files.push({ path: outPath, label: path.basename(outPath) });
  }

  return { ok: true, files, outputDir: dir };
});

// 选择输出文件夹
ipcMain.handle('dialog:choose-output', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: '选择输出文件夹',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  return { ok: true, dir: result.filePaths[0] };
});

// 在资源管理器中打开文件夹 / 文件
ipcMain.handle('shell:open-folder', async (event, dir) => {
  if (!dir || typeof dir !== 'string') return { ok: false, error: '路径无效' };
  const error = await shell.openPath(dir);
  return { ok: !error, error: error || undefined };
});

ipcMain.handle('shell:open-path', async (event, target) => {
  if (!target || typeof target !== 'string') return { ok: false, error: '路径无效' };
  const error = await shell.openPath(target);
  return { ok: !error, error: error || undefined };
});

function friendlyQpdfError(result) {
  switch (result.error) {
    case 'no-permission':
      return '没有写入权限，请换个文件夹试试';
    case 'file-in-use':
      return '文件正被其他程序占用，请关闭相关程序后重试';
    case 'corrupt-pdf':
      return '文件已损坏或不是有效的 PDF';
    case 'parse-error':
      return '文件内容异常，无法处理';
    default:
      return '文件可能已损坏';
  }
}
