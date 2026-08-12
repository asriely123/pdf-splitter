const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeFileName,
  buildOutputBaseName
} = require('../lib/qpdf');

test('自定义名称留空时使用默认文件名', () => {
  const fallback = '原文件_第1段_第1-10页';
  assert.equal(buildOutputBaseName('', fallback), fallback);
  assert.equal(buildOutputBaseName('   ', fallback), fallback);
  assert.equal(buildOutputBaseName('.pdf', fallback), fallback);
});

test('自定义名称可带或不带 pdf 扩展名', () => {
  assert.equal(buildOutputBaseName('第一章', '默认名'), '第一章');
  assert.equal(buildOutputBaseName('第一章.pdf', '默认名'), '第一章');
  assert.equal(buildOutputBaseName('第一章.PDF  ', '默认名'), '第一章');
  assert.equal(buildOutputBaseName('第一章.pdf.', '默认名'), '第一章');
  assert.equal(buildOutputBaseName('第一章.pdf.pdf', '默认名'), '第一章');
});

test('Windows 非法字符、尾部句点和保留名会被安全处理', () => {
  assert.equal(sanitizeFileName('章节一：说明?/草稿.'), '章节一：说明__草稿');
  assert.equal(buildOutputBaseName('CON', '默认名'), 'CON_');
  assert.equal(buildOutputBaseName('LPT1.pdf', '默认名'), 'LPT1_');
});

test('自定义名称受最大长度限制', () => {
  assert.equal(buildOutputBaseName('一'.repeat(120), '默认名').length, 100);
});

test('相同名称继续由 uniqueOutputPath 追加序号', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { uniqueOutputPath } = require('../lib/qpdf');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-splitter-naming-'));

  try {
    fs.writeFileSync(path.join(dir, '第一章.pdf'), 'occupied');
    fs.writeFileSync(path.join(dir, '第一章_2.pdf'), 'occupied');
    assert.equal(uniqueOutputPath(dir, '第一章', '.pdf'), path.join(dir, '第一章_3.pdf'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
