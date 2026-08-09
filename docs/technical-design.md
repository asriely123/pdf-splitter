# 技术方案（Technical Design）

## 1. 技术栈

- **Electron**：桌面应用框架（当前电脑已有 Node.js v24）。
- **界面**：原生 HTML/CSS/JavaScript，无前端框架，保证体积与维护简单。
- **PDF 处理**：qpdf（Windows 版命令行工具，Apache 2.0 许可），打包随应用分发。
- **打包**：electron-builder，产出**便携式单文件 exe**（无需安装）。

> qpdf 版本在阶段 3 实际下载时固定（从 qpdf GitHub Releases 选择最新稳定版 msvc64 构建），下载后把确切版本号回填到本文件第 5 节。

## 2. 进程架构

```
渲染进程 (renderer/)
  │  界面、交互、分段数据、校验提示
  │  ├── index.html / style.css / app.js
  │
  │  仅通过 window.pdfTool（contextBridge 暴露）调用：
  │  inspect → split → chooseOutput → openFolder → window 控制
  ▼
preload.js（contextIsolation 开启）
  │  白名单 IPC 通道，不暴露 Node 全局
  ▼
主进程 (main.js)
  │  Electron 窗口管理 + 文件对话框
  │  qpdf 子进程调用（spawn，异步）
  │  PDF 信息读取、校验、切分、命名、输出
```

安全基线：

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- 渲染进程只拿到 preload 白名单方法，不暴露 `require`、`process` 等。
- 密码只存在于主进程内存变量；不打印、不写文件。

## 3. IPC 接口定义

| 通道 | 方向 | 参数 | 返回 |
| --- | --- | --- | --- |
| `pdf:inspect` | 渲染→主 | `{ filePath, password? }` | `{ ok, fileName, pageCount }` 或 `{ ok:false, error, needPassword? }` |
| `pdf:split` | 渲染→主 | `{ filePath, password?, outputDir?, segments: [{start,end}] }` | 先发 `pdf:split-progress` 事件，最后返回 `{ ok, files:[{path,label}] }` |
| `pdf:split-progress` | 主→渲染 | 事件 | `{ index, total, label, status }`（`processing`/`done`/`error`） |
| `dialog:choose-output` | 渲染→主 | 无 | `{ ok, dir }` 或 `{ ok:false, canceled:true }` |
| `shell:open-folder` | 渲染→主 | `{ dir }` | `{ ok }` |
| `window:minimize` / `window:close` | 渲染→主 | 无 | 无 |

## 4. qpdf 集成

### 4.1 资源位置

qpdf 可执行文件与所需 DLL 放在 `vendor/qpdf/`，打包时通过 electron-builder `extraResources` 复制到资源目录。运行时路径：

- 开发模式：`<项目根>/vendor/qpdf/qpdf.exe`
- 打包后：`<exe 同目录或 resources 目录>/qpdf/qpdf.exe`（electron-builder 统一处理，主进程用 `process.resourcesPath` 拼接）

### 4.2 关键命令

获取总页数（无密码）：

```text
qpdf --show-npages <input.pdf>
```

获取总页数（带密码）：

```text
qpdf --password=<密码> --show-npages <input.pdf>
```

按范围切分：

```text
qpdf [--password=<密码>] <input.pdf> --pages <input.pdf> <start>-<end> -- <output.pdf>
```

说明：

- qpdf 默认对受限文件（仅 owner 密码、无打开密码）可直接打开；输出文件默认解密，不继承限制。
- 密码通过命令行参数传入，本地单用户工具场景可接受；不写入任何文件。
- 所有调用用 `spawn` 异步执行并捕获 stderr，失败时把 qpdf 的错误信息转成中文友好提示。

## 5. 版本锁定

- Electron：43.3.0（2026-08-09 安装）。
- qpdf：12.3.2（mingw64），运行文件位于 `vendor/qpdf/`（qpdf.exe + 4 个依赖 DLL）；下载地址：<https://github.com/qpdf/qpdf/releases/download/v12.3.2/qpdf-12.3.2-mingw64.zip>。
- electron-builder：阶段 6 安装时记录。

## 6. 输出规则

- 输出目录默认：原 PDF 同目录 `原文件名_分页结果/`。
- 文件名：`原文件名_第N段_第X-Y页.pdf`。
- 重名时追加序号：`原文件名_第N段_第X-Y页_2.pdf`（从 2 开始）。
- 非法文件名中的字符（`\ / : * ? " < > |`）在输出文件名中统一替换为 `_`；原文件路径本身不修改。

## 7. 打包配置要点（阶段 6 细化）

- electron-builder `portable` 目标（NSIS 之外的免安装单文件）。
- `extraResources` 包含 `vendor/qpdf/**`。
- 应用名「PDF分页器」；产物输出到 `release/`。
