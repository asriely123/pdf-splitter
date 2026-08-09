// 阶段 4：真实切分输出（qpdf --pages）

const MAX_SEGMENTS = 10;
const MIN_SEGMENTS = 1;

const state = {
  filePath: null,
  fileName: null,
  totalPages: 0,
  password: null,
  outputDir: null,
  segments: [],
  splitting: false
};

const els = {
  dropzone: document.getElementById('dropzone'),
  fileInfo: document.getElementById('file-info'),
  fileName: document.getElementById('file-name'),
  filePages: document.getElementById('file-pages'),
  btnChangeFile: document.getElementById('btn-change-file'),
  segmentList: document.getElementById('segment-list'),
  segmentCount: document.getElementById('segment-count'),
  emptyTip: document.getElementById('empty-tip'),
  btnAddSegment: document.getElementById('btn-add-segment'),
  outputDir: document.getElementById('output-dir'),
  btnChooseOutput: document.getElementById('btn-choose-output'),
  btnSplit: document.getElementById('btn-split'),
  progressWrap: document.getElementById('progress-wrap'),
  progressBar: document.getElementById('progress-bar'),
  progressText: document.getElementById('progress-text'),
  resultCard: document.getElementById('result-card'),
  resultList: document.getElementById('result-list'),
  btnOpenFolder: document.getElementById('btn-open-folder'),
  toast: document.getElementById('toast'),
  passwordOverlay: document.getElementById('password-overlay'),
  passwordInput: document.getElementById('password-input'),
  passwordError: document.getElementById('password-error'),
  btnTogglePassword: document.getElementById('btn-toggle-password'),
  btnPasswordCancel: document.getElementById('btn-password-cancel'),
  btnPasswordOk: document.getElementById('btn-password-ok')
};

let toastTimer = null;
let splitCards = [];

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2500);
}

// ---------- 导入与读取 ----------

function importFile(filePath, fileName) {
  state.filePath = filePath;
  state.fileName = fileName;
  state.totalPages = 0;
  state.password = null;
  state.outputDir = null;
  state.segments = [];
  state.splitting = false;

  els.fileName.textContent = fileName;
  els.filePages.textContent = '正在读取页数…';
  els.fileInfo.classList.remove('hidden');
  els.emptyTip.classList.add('hidden');
  els.btnAddSegment.classList.add('hidden');
  els.resultCard.classList.add('hidden');
  els.progressWrap.classList.add('hidden');
  els.btnSplit.disabled = true;
  els.btnSplit.textContent = '开始切分';
  els.outputDir.textContent = '默认：与原 PDF 同目录';

  renderSegments();
  inspectFile();
}

async function inspectFile(password) {
  const result = await window.pdfTool.inspect({
    filePath: state.filePath,
    password: password || undefined
  });

  if (result.ok) {
    state.password = password || state.password;
    finishImport(result.pageCount);
    return;
  }
  if (result.needPassword) {
    openPasswordModal();
    return;
  }
  toast('无法读取这个 PDF，请确认文件没有损坏', true);
  resetFileState();
}

function finishImport(pageCount) {
  state.totalPages = pageCount;
  state.segments = [{ id: Date.now(), start: 1, end: pageCount }];
  els.filePages.textContent = `共 ${pageCount} 页`;
  els.btnAddSegment.classList.remove('hidden');
  els.btnSplit.disabled = false;
  renderSegments();
  toast('导入成功');
}

function resetFileState() {
  state.filePath = null;
  state.fileName = null;
  state.totalPages = 0;
  state.password = null;
  state.outputDir = null;
  state.segments = [];
  els.fileInfo.classList.add('hidden');
  els.emptyTip.classList.remove('hidden');
  els.btnAddSegment.classList.add('hidden');
  els.btnSplit.disabled = true;
  els.btnSplit.textContent = '开始切分';
  els.resultCard.classList.add('hidden');
  els.progressWrap.classList.add('hidden');
  els.outputDir.textContent = '默认：与原 PDF 同目录';
  renderSegments();
}

// ---------- 密码弹窗 ----------

function openPasswordModal() {
  els.passwordInput.value = '';
  els.passwordError.classList.add('hidden');
  els.passwordInput.classList.remove('invalid');
  els.passwordOverlay.classList.remove('hidden');
  setTimeout(() => els.passwordInput.focus(), 60);
}

function closePasswordModal() {
  els.passwordOverlay.classList.add('hidden');
}

async function submitPassword() {
  const password = els.passwordInput.value;
  if (!password) {
    showPasswordError('请输入密码');
    return;
  }

  const result = await window.pdfTool.inspect({
    filePath: state.filePath,
    password
  });

  if (result.ok) {
    state.password = password;
    closePasswordModal();
    finishImport(result.pageCount);
    return;
  }
  if (result.needPassword) {
    showPasswordError('密码不正确，请重试');
    els.passwordInput.select();
    return;
  }
  closePasswordModal();
  toast('无法读取这个 PDF，请确认文件没有损坏', true);
  resetFileState();
}

function showPasswordError(message) {
  els.passwordError.textContent = message;
  els.passwordError.classList.remove('hidden');
  els.passwordInput.classList.add('invalid');
  els.passwordInput.classList.add('shake');
  setTimeout(() => els.passwordInput.classList.remove('shake'), 350);
}

// ---------- 分段渲染 ----------

function renderSegments() {
  els.segmentList.innerHTML = '';
  state.segments.forEach((segment, index) => {
    els.segmentList.appendChild(createSegmentCard(segment, index));
  });
  updateSegmentMeta();
}

function createSegmentCard(segment, index) {
  const card = document.createElement('div');
  card.className = 'segment-card';
  card.dataset.id = segment.id;

  const badge = document.createElement('span');
  badge.className = 'segment-badge';
  badge.textContent = index + 1;

  const fields = document.createElement('div');
  fields.className = 'segment-fields';

  const startGroup = document.createElement('div');
  startGroup.className = 'field-group';
  const startLabel = document.createElement('label');
  startLabel.textContent = '起始页';
  const startInput = document.createElement('input');
  startInput.type = 'number';
  startInput.className = 'page-input start-input';
  startInput.min = '1';
  startInput.value = segment.start;
  startInput.placeholder = '页码';
  startGroup.append(startLabel, startInput);

  const dash = document.createElement('span');
  dash.className = 'dash';
  dash.textContent = '至';

  const endGroup = document.createElement('div');
  endGroup.className = 'field-group';
  const endLabel = document.createElement('label');
  endLabel.textContent = '结束页';
  const endInput = document.createElement('input');
  endInput.type = 'number';
  endInput.className = 'page-input end-input';
  endInput.min = '1';
  endInput.value = segment.end;
  endInput.placeholder = '页码';
  endGroup.append(endLabel, endInput);

  fields.append(startGroup, dash, endGroup);

  const status = document.createElement('span');
  status.className = 'segment-status';
  status.textContent = '等待中';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.title = '删除这一段';
  removeBtn.textContent = '✕';

  const errorEl = document.createElement('p');
  errorEl.className = 'input-error hidden';

  card.append(badge, fields, status, removeBtn, errorEl);

  const validate = () => {
    const start = startInput.value.trim();
    const end = endInput.value.trim();
    let message = '';

    if (start === '' || end === '') {
      message = '请填写起始页和结束页';
    } else if (!/^\d+$/.test(start) || !/^\d+$/.test(end)) {
      message = '页码需为整数';
    } else {
      const s = Number(start);
      const e = Number(end);
      if (s < 1) message = '起始页不能小于 1';
      else if (e > state.totalPages) message = `结束页不能超过 ${state.totalPages}`;
      else if (s > e) message = '起始页不能大于结束页';
    }

    const invalid = message !== '';
    startInput.classList.toggle('invalid', invalid);
    endInput.classList.toggle('invalid', invalid);
    errorEl.textContent = message;
    errorEl.classList.toggle('hidden', !message);
    return { valid: !invalid, message };
  };

  startInput.addEventListener('input', () => {
    if (startInput.classList.contains('invalid')) validate();
  });
  endInput.addEventListener('input', () => {
    if (endInput.classList.contains('invalid')) validate();
  });
  startInput.addEventListener('blur', () => validate());
  endInput.addEventListener('blur', () => validate());

  removeBtn.addEventListener('click', () => {
    if (state.segments.length <= MIN_SEGMENTS) return;
    state.segments = state.segments.filter((s) => s.id !== segment.id);
    card.classList.add('removing');
    setTimeout(() => {
      card.remove();
      updateSegmentMeta();
      renumberBadges();
    }, 200);
  });

  return card;
}

function updateSegmentMeta() {
  const count = state.segments.length;
  els.segmentCount.textContent = `${count} / ${MAX_SEGMENTS} 段`;
  els.btnAddSegment.classList.toggle('hidden', count >= MAX_SEGMENTS || !state.fileName);
  document.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.disabled = count <= MIN_SEGMENTS;
  });
}

function renumberBadges() {
  document.querySelectorAll('.segment-badge').forEach((badge, index) => {
    badge.textContent = index + 1;
  });
}

function addSegment() {
  if (state.segments.length >= MAX_SEGMENTS || !state.fileName) return;
  const segment = { id: Date.now(), start: '', end: '' };
  state.segments.push(segment);
  const card = createSegmentCard(segment, state.segments.length - 1);
  els.segmentList.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  updateSegmentMeta();
  const startInput = card.querySelector('.start-input');
  if (startInput) startInput.focus();
}

// ---------- 校验 ----------

function validateAllSegments() {
  let firstInvalid = null;
  document.querySelectorAll('.segment-card').forEach((card) => {
    const startInput = card.querySelector('.start-input');
    const endInput = card.querySelector('.end-input');
    const errorEl = card.querySelector('.input-error');

    let message = '';
    const start = startInput.value.trim();
    const end = endInput.value.trim();

    if (start === '' || end === '') {
      message = '请填写起始页和结束页';
    } else if (!/^\d+$/.test(start) || !/^\d+$/.test(end)) {
      message = '页码需为整数';
    } else {
      const s = Number(start);
      const e = Number(end);
      if (s < 1) message = '起始页不能小于 1';
      else if (e > state.totalPages) message = `结束页不能超过 ${state.totalPages}`;
      else if (s > e) message = '起始页不能大于结束页';
    }

    const invalid = message !== '';
    startInput.classList.toggle('invalid', invalid);
    endInput.classList.toggle('invalid', invalid);
    errorEl.textContent = message;
    errorEl.classList.toggle('hidden', !message);

    if (invalid && !firstInvalid) {
      firstInvalid = { card, startInput, endInput };
    }
  });
  return firstInvalid;
}

function collectSegmentsFromDom() {
  return [...document.querySelectorAll('.segment-card')].map((card) => ({
    start: Number(card.querySelector('.start-input').value.trim()),
    end: Number(card.querySelector('.end-input').value.trim())
  }));
}

function setSplittingUi(splitting) {
  els.btnChangeFile.disabled = splitting;
  els.btnChooseOutput.disabled = splitting;
  els.btnAddSegment.disabled = splitting;
  document.querySelectorAll('.segment-card').forEach((card) => {
    card.classList.toggle('splitting', splitting);
  });
}

// ---------- 切分 ----------

async function runRealSplit() {
  state.splitting = true;
  els.btnSplit.disabled = true;
  els.btnSplit.textContent = '正在切分…';
  setSplittingUi(true);
  els.progressWrap.classList.remove('hidden');
  els.resultCard.classList.add('hidden');
  els.progressBar.style.width = '0%';
  els.progressBar.classList.remove('error');
  els.progressText.textContent = '准备中…';

  splitCards = [...document.querySelectorAll('.segment-card')];
  splitCards.forEach((card) => {
    const status = card.querySelector('.segment-status');
    status.classList.remove('processing', 'done', 'error');
    status.textContent = '等待中';
  });

  const result = await window.pdfTool.split({
    filePath: state.filePath,
    password: state.password || undefined,
    outputDir: state.outputDir || undefined,
    segments: collectSegmentsFromDom()
  });

  state.splitting = false;
  setSplittingUi(false);
  els.btnSplit.disabled = false;

  if (result.ok) {
    state.outputDir = result.outputDir;
    els.outputDir.textContent = result.outputDir;
    els.progressText.textContent = '全部完成';
    els.btnSplit.textContent = '再次切分';
    renderResult(result.files, result.outputDir);
  } else {
    els.progressText.textContent = '切分失败';
    els.btnSplit.textContent = '再次尝试';
    toast(result.error || '切分失败，请重试', true);
  }
}

function handleSplitProgress(payload) {
  const card = splitCards[payload.index];
  if (!card) return;
  const status = card.querySelector('.segment-status');

  if (payload.status === 'processing') {
    els.progressBar.classList.remove('error');
    status.classList.add('processing');
    status.textContent = '处理中…';
    els.progressText.textContent = `正在切分第 ${payload.index + 1}/${payload.total} 段…`;
  } else if (payload.status === 'done') {
    status.classList.remove('processing');
    status.classList.add('done');
    status.textContent = '完成 ✓';
    els.progressBar.style.width = `${Math.round(((payload.index + 1) / payload.total) * 100)}%`;
  } else if (payload.status === 'error') {
    status.classList.remove('processing');
    status.classList.add('error');
    status.textContent = '失败';
    els.progressBar.classList.add('error');
  }
}

function renderResult(files, outputDir) {
  els.resultList.innerHTML = '';
  files.forEach((file) => {
    const li = document.createElement('li');
    li.textContent = file.label;
    li.title = `点击打开：${file.path}`;
    li.addEventListener('click', () => {
      window.pdfTool.openPath(file.path);
    });
    els.resultList.appendChild(li);
  });
  els.resultCard.classList.remove('hidden');
  els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- 事件绑定 ----------

els.dropzone.addEventListener('click', async () => {
  const result = await window.pdfTool.selectPdf();
  if (result.ok) {
    importFile(result.filePath, result.fileName);
  }
});

els.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    els.dropzone.click();
  }
});

['dragenter', 'dragover'].forEach((eventName) => {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('dragging');
  });
});

els.dropzone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  if (!/\.pdf$/i.test(file.name)) {
    els.dropzone.classList.add('shake');
    toast('请拖入 PDF 文件', true);
    setTimeout(() => els.dropzone.classList.remove('shake'), 350);
    return;
  }
  const filePath = window.pdfTool.getPathForFile(file);
  if (!filePath) {
    toast('无法获取文件路径，请点击选择文件', true);
    return;
  }
  importFile(filePath, file.name);
});

els.btnChangeFile.addEventListener('click', () => {
  resetFileState();
  els.dropzone.click();
});

els.btnAddSegment.addEventListener('click', addSegment);

els.btnSplit.addEventListener('click', () => {
  if (!state.fileName) return;
  const firstInvalid = validateAllSegments();
  if (firstInvalid) {
    firstInvalid.card.classList.add('shake');
    setTimeout(() => firstInvalid.card.classList.remove('shake'), 350);
    (firstInvalid.startInput.value.trim() === '' ? firstInvalid.startInput : firstInvalid.endInput).focus();
    toast('有分段填写不正确，请检查红色提示', true);
    return;
  }
  runRealSplit();
});

els.btnChooseOutput.addEventListener('click', async () => {
  const result = await window.pdfTool.chooseOutput();
  if (result.ok) {
    state.outputDir = result.dir;
    els.outputDir.textContent = result.dir;
    toast('已选择输出文件夹');
  }
});

els.btnOpenFolder.addEventListener('click', async () => {
  if (!state.outputDir) return;
  const result = await window.pdfTool.openFolder(state.outputDir);
  if (!result.ok) toast('打开文件夹失败', true);
});

els.btnPasswordOk.addEventListener('click', submitPassword);
els.btnPasswordCancel.addEventListener('click', () => {
  closePasswordModal();
  resetFileState();
});
els.passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitPassword();
});
els.btnTogglePassword.addEventListener('click', () => {
  const isPassword = els.passwordInput.type === 'password';
  els.passwordInput.type = isPassword ? 'text' : 'password';
});

window.pdfTool.onSplitProgress(handleSplitProgress);

document.getElementById('btn-minimize').addEventListener('click', () => window.pdfTool.minimize());
document.getElementById('btn-close').addEventListener('click', () => window.pdfTool.close());

// 初始状态
renderSegments();
