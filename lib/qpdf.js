const { spawn } = require('child_process');
const fs = require('fs');
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
  if (text.includes('permission denied') || text.includes('access is denied')) {
    return { ok: false, error: 'no-permission', detail: stderr };
  }
  if (
    text.includes('unable to open') ||
    text.includes('invalid argument') ||
    text.includes('being used') ||
    text.includes('sharing violation')
  ) {
    return { ok: false, error: 'file-in-use', detail: stderr };
  }
  if (text.includes('not a pdf') || text.includes('damaged') || text.includes('corrupt')) {
    return { ok: false, error: 'corrupt-pdf', detail: stderr };
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

async function extractPages({ inputPath, outputPath, startPage, endPage, password, qpdfOptions = {} }) {
  const args = [];
  if (password) args.push(`--password=${password}`);
  args.push(inputPath, '--pages', inputPath, `${startPage}-${endPage}`, '--', outputPath);

  const result = await runQpdf(args, qpdfOptions);
  if (result.code === 0) {
    return { ok: true };
  }
  return classifyQpdfError(result.stderr);
}

function sanitizeFileName(name) {
  const cleaned = String(name || '')
    .replace(/[\x00-\x1f\\/:*?"<>|]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
    return `${cleaned}_`;
  }
  return cleaned;
}

function buildOutputBaseName(customName, defaultName, maxLength = 100) {
  const fallback = (sanitizeFileName(defaultName) || '未命名').slice(0, maxLength);
  if (typeof customName !== 'string') return fallback;

  const withoutExtension = customName
    .trim()
    .replace(/[. ]+$/g, '')
    .replace(/(?:\.pdf)+$/i, '')
    .trim();
  const safeName = sanitizeFileName(withoutExtension).slice(0, maxLength);
  return safeName || fallback;
}

function uniqueOutputPath(dir, base, ext) {
  let candidate = path.join(dir, base + ext);
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}_${n}${ext}`);
    n += 1;
  }
  return candidate;
}

module.exports = {
  getPageCount,
  extractPages,
  runQpdf,
  resolveQpdfPath,
  sanitizeFileName,
  buildOutputBaseName,
  uniqueOutputPath
};
