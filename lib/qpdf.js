const { spawn } = require('child_process');
const path = require('path');

// qpdf 封装：不依赖 Electron，可在 Node 下直接测试

function resolveQpdfPath(options = {}) {
  const { isPackaged = false, resourcesPath = '' } = options;
  const base = isPackaged ? resourcesPath : path.join(__dirname, '..');
  return path.join(base, 'vendor', 'qpdf', 'qpdf.exe');
}

function runQpdf(args, qpdfOptions = {}, timeoutMs = 60000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(resolveQpdfPath(qpdfOptions), args, { windowsHide: true });
    } catch (err) {
      resolve({ code: -1, stdout: '', stderr: String((err && err.message) || err) });
      return;
    }

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, stdout, stderr: 'timeout' });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err.message || err) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function classifyQpdfError(stderr) {
  const text = stderr.toLowerCase();
  if (text.includes('password') || text.includes('encrypted')) {
    return { ok: false, needPassword: true, error: 'need-password', detail: stderr };
  }
  return { ok: false, error: 'qpdf-failed', detail: stderr };
}

async function getPageCount(filePath, password, qpdfOptions = {}) {
  const args = [];
  if (password) args.push(`--password=${password}`);
  args.push('--show-npages', filePath);

  const result = await runQpdf(args, qpdfOptions);
  if (result.code === 0) {
    const pageCount = Number.parseInt(result.stdout.trim(), 10);
    if (Number.isInteger(pageCount) && pageCount > 0) {
      return { ok: true, pageCount };
    }
    return { ok: false, error: 'parse-error', detail: result.stdout };
  }
  return classifyQpdfError(result.stderr);
}

module.exports = { getPageCount, runQpdf, resolveQpdfPath };
