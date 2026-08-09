// 阶段 2：静态 UI 与交互（PDF 读取为演示数据，阶段 3 接入真实 qpdf）

const DEMO_TOTAL_PAGES = 120;
const MAX_SEGMENTS = 10;
const MIN_SEGMENTS = 1;

const state = {
  fileName: null,
  totalPages: DEMO_TOTAL_PAGES,
  segments: [],
  splitting: false
};

const els = {
  dropzone: document.getElementById('dropzone'),
  fileInfo: document.getElementById('file-info'),
  fileName: document.getElementById('file-name'),
  filePages: document.getElementById('file-pages'),
  demoTag: document.getElementById('demo-tag'),
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
  toast: document.getElementById('toast')
};

let toastTimer = null;

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2500);
}

function baseName(fileName) {
  return fileName.replace(/\.pdf$/i, '');
}

function makeOutputName(segment, index) {
  return `${baseName(state.fileName)}_第${index}段_第${segment.start}-${segment.end}页.pdf`;
}

// ---------- 导入 ----------

function importFile(fileName) {
  state.fileName = fileName;
  state.segments = [{ id: Date.now(), start: 1, end: state.totalPages }];
  state.splitting = false;

  els.fileName.textContent = fileName;
  els.filePages.textContent = `共 ${state.totalPages} 页`;
  els.fileInfo.classList.remove('hidden');
  els.demoTag.classList.remove('hidden');
  els.emptyTip.classList.add('hidden');
  els.btnAddSegment.classList.remove('hidden');
  els.resultCard.classList.add('hidden');
  els.progressWrap.classList.add('hidden');
  els.btnSplit.disabled = false;
  els.btnSplit.textContent = '开始切分';

  renderSegments();
  toast('已导入 PDF（预览模式）');
}

function resetFileState() {
  state.fileName = null;
  state.segments = [];
  els.fileInfo.classList.add('hidden');
  els.emptyTip.classList.remove('hidden');
  els.btnAddSegment.classList.add('hidden');
  els.btnSplit.disabled = true;
  els.resultCard.classList.add('hidden');
  els.progressWrap.classList.add('hidden');
  renderSegments();
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

  const readValue = () => ({
    start: startInput.value.trim(),
    end: endInput.value.trim()
  });

  const validate = (showMessage = true) => {
    const { start, end } = readValue();
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

// ---------- 校验与切分 ----------

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFakeSplit() {
  state.splitting = true;
  els.btnSplit.disabled = true;
  els.btnSplit.textContent = '正在切分…';
  els.btnAddSegment.disabled = true;
  els.progressWrap.classList.remove('hidden');
  els.resultCard.classList.add('hidden');
  els.progressBar.style.width = '0%';

  const cards = [...document.querySelectorAll('.segment-card')];
  const total = cards.length;

  for (let i = 0; i < total; i++) {
    const card = cards[i];
    const status = card.querySelector('.segment-status');

    status.classList.remove('done');
    status.classList.add('processing');
    status.textContent = '处理中…';
    els.progressText.textContent = `正在切分第 ${i + 1}/${total} 段…`;
    await delay(700);

    status.classList.remove('processing');
    status.classList.add('done');
    status.textContent = '完成 ✓';
    els.progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
    await delay(250);
  }

  els.progressText.textContent = '全部完成';
  state.splitting = false;
  els.btnSplit.disabled = false;
  els.btnSplit.textContent = '再次切分';
  els.btnAddSegment.disabled = false;

  renderResult();
}

function renderResult() {
  els.resultList.innerHTML = '';
  state.segments.forEach((segment, index) => {
    const li = document.createElement('li');
    li.textContent = makeOutputName(segment, index + 1);
    els.resultList.appendChild(li);
  });
  els.resultCard.classList.remove('hidden');
  els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- 事件绑定 ----------

els.dropzone.addEventListener('click', async () => {
  const result = await window.pdfTool.selectPdf();
  if (result.ok) {
    importFile(result.fileName);
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
  importFile(file.name);
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
  runFakeSplit();
});

els.btnChooseOutput.addEventListener('click', () => {
  toast('自定义输出目录将在阶段 4 接入');
});

els.btnOpenFolder.addEventListener('click', () => {
  toast('打开输出文件夹将在阶段 4 接入');
});

document.getElementById('btn-minimize').addEventListener('click', () => window.pdfTool.minimize());
document.getElementById('btn-close').addEventListener('click', () => window.pdfTool.close());

// 初始状态
renderSegments();
