# 开发日志

> 本文件由开发者在每次开发后自动更新：记录完成事项、遇到的问题、关键决策与下一步。

## 2026-08-09

### 完成

- 与用户确认完整需求：手动填写页码范围、自由增删分段（1–10 段，默认 1 段）、可只导出部分页面、支持受限/加密 PDF、交付单个便携 exe、不保留书签、淡粉色可爱 UI。
- 用户批准《粉色 PDF 分页器》开发计划。
- 搭建项目文档骨架：创建 `docs/`（需求、技术、设计、流程、测试五份标准文件）、`devlog/`（日志与待办）、`AGENTS.md`、`README.md`、`.gitignore`。
- 确定技术选型：Electron + 原生 HTML/CSS/JS + qpdf（打包内置），详见 `docs/technical-design.md`。
- 完成首次 git 提交：`6b1216b docs: 初始化项目骨架与开发文档`（10 个文件，557 行）。
- **阶段 1 完成**：Electron 应用骨架可运行。
  - 安装 electron 43.3.0（devDependencies，0 漏洞）。
  - 主进程 `main.js`：900×680 无边框窗口、`contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`。
  - preload 白名单通道：`window:minimize`、`window:close`、`dialog:select-pdf`。
  - 渲染页面：粉色标题栏（最小化/关闭）、居中占位界面、设计 Token 已落地。
  - 新增 `启动pdf分页器.bat`：首次运行自动装依赖，之后双击即启动。
- 实际启动验证通过：窗口标题「粉色 PDF 分页器」正常显示，进程响应正常。
- git 提交见下条。
- **阶段 2 完成**：完整界面与交互可运行（PDF 页数为演示数据）。
  - 拖拽区：点击选择/拖入高亮动画/非 PDF 抖动提示。
  - 分段卡片：增删（1–10 段）、段号徽章、实时校验（空值/非整数/越界/起始大于结束）、错误抖动与红色提示。
  - 假切分流程：逐段「处理中→完成 ✓」、粉色渐变进度条、结果卡片与虚拟文件命名。
  - 密码弹窗样式已就位（阶段 3 接入触发）；toast 轻提示组件可用。
  - 修复 CSP 拦截内联样式导致进度条不显示的问题：`style-src` 允许 `'unsafe-inline'`，脚本仍严格限制为 `'self'`。
- 实际启动验证通过：窗口正常显示，控制台无报错。
- **阶段 3 完成**：接入 qpdf，PDF 信息真实读取。
  - 下载并固定 qpdf 12.3.2（mingw64），运行文件放入 `vendor/qpdf/`，版本已回填 `docs/technical-design.md`。
  - 新增 `lib/qpdf.js`（纯 Node 模块）：spawn 异步调用、超时处理、错误分类（`need-password` / `qpdf-failed`）。
  - 主进程新增 `pdf:inspect` IPC：返回真实文件名与总页数；需要密码时返回 `needPassword`。
  - preload 新增 `inspect` 与 `getPathForFile`（拖拽文件路径获取）。
  - 渲染层：导入后真实读取页数（移除「预览模式」）；需要密码时弹出密码框，支持显示/隐藏密码、Enter 提交、错误密码红色抖动提示。
  - Node 自动化验证通过：普通 PDF 174 页 ✅；受限（禁止复制打印）PDF 免密码读取 ✅；加密 PDF 无密码 → needPassword ✅；正确密码 → 174 页 ✅；错误密码 → needPassword ✅。
- 应用启动验证通过：窗口正常，控制台无报错。
- **阶段 4 完成**：真实切分输出可用。
  - 用户反馈修复：分段卡片错误提示「请填写起始页和结束页」被下一张卡片遮挡 → 错误提示改为卡片内部换行显示，不再溢出遮挡（提交 4a2c26a）。
  - `lib/qpdf.js` 新增 `extractPages`（qpdf --pages 提取）、`sanitizeFileName`、`uniqueOutputPath`。
  - 主进程新增 `pdf:split`：逐段真实切分、进度事件推送、默认/自定义输出目录、命名与重名加序号；新增 `dialog:choose-output`、`shell:open-folder`、`shell:open-path`。
  - 渲染层：真实切分流程（逐段「处理中→完成 ✓」、进度条）、结果卡片列出输出文件（点击可直接打开）、「打开输出文件夹」可用；密码在导入后保存在内存中，切分时自动复用。
  - Node 端到端测试全部通过：普通 PDF 切 1-10 页 ✅；加密 PDF 带密码切 1-5 页 ✅；错误密码 → needPassword ✅；受限 PDF 免密码切分 ✅；重名自动 _2/_3/_4 ✅；特殊字符替换为 _ ✅。
  - 应用验证通过：窗口正常显示，控制台零报错。
  - 经验记录：`Start-Process -WindowStyle Hidden` 会连 Electron GUI 窗口一起隐藏，开发验证时需直接启动 exe 且不加 Hidden。

### 进行中

- 无（阶段 4 已验收，等待用户确认后进入阶段 5）。

### 下一步（待办详见 TODO.md）

- 阶段 5：打磨、边界与异常处理（特殊文件名、1 页 PDF、错误提示、窗口细节、回归测试）。

### 关键决策记录

- PDF 处理用 qpdf 而非 pdf-lib：qpdf 对受限/加密 PDF 支持好、切页质量与原文件一致，且许可证（Apache 2.0）适合随 exe 分发。
- 分段默认 1 段、上限 10 段（用户明确要求），可自由增删。
- 各段允许重叠、允许跳页，不做“必须覆盖全书”的限制。
- electron-builder 推迟到阶段 6 打包时再安装，阶段 1 只安装 electron，减少不必要的大依赖下载。
- 开发分支 `codex/dev` 已创建；阶段 0 的提交保留在 master。
- CSP 策略：`style-src` 含 `'unsafe-inline'`（Electron 本地应用无远程内容，风险可接受），`script-src` 保持 `'self'` 严格模式。
- 阶段 2 的 PDF 导入为预览模式（固定演示 120 页，界面有「预览模式」标记），阶段 3 接入真实 qpdf 后移除。
- qpdf 对「仅 owner 密码（无打开密码）」的受限文件默认可直接读取，无需用户输入密码；对需要打开密码的文件返回 `invalid password`，归类为 `need-password`。
- PowerShell 调用原生程序会丢弃空字符串参数，测试生成受限 PDF 时改用 Node `spawnSync` 传参。
