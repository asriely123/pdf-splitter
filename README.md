# PDF分页器

一个运行在 Windows 上的桌面小工具：把 PDF 按自己设定的页码范围切成多个文件，切出来的文件**不带任何水印**。

## 它能做什么

- 拖入或点击选择一本 PDF，自动显示总页数
- 自由增删分段：最少 1 段、默认 1 段、最多 10 段
- 每段手动填写「起始页 – 结束页」，可以只导出书中的部分页面
- 支持「能看不能复制打印」的受限 PDF；需要密码的 PDF 会提示输入密码
- 切分完成自动列出输出文件，可一键打开输出文件夹
- 界面为淡粉色可爱风格，带拖拽动画、分段卡片、进度提示等细节，全程中文

## 当前状态

✅ 开发完成。全部 6 个阶段已完成：文档体系、应用骨架、完整界面、qpdf 接入、真实切分输出、打磨与打包交付。便携版 exe 位于 `release/PDF分页器.exe`。

## 项目结构

```
pdf分页器/
├── AGENTS.md                 # 工作指引（接手者必读）
├── README.md                 # 本文件
├── main.js                   # Electron 主进程（窗口、IPC、切分调度）
├── preload.js                # 渲染进程安全桥接（window.pdfTool）
├── assets/                   # 应用图标（淡粉双页分页图案）
├── lib/
│   └── qpdf.js               # qpdf 封装（页数/切分/命名，可独立测试）
├── renderer/                 # 界面
│   ├── index.html            # 页面结构
│   ├── style.css             # 粉色设计系统与动效
│   └── app.js                # 界面交互逻辑
├── vendor/
│   └── qpdf/                 # PDF 引擎（qpdf 12.3.2，打包内置）
├── docs/                     # 开发标准文档
│   ├── requirements.md       # 需求说明与验收标准
│   ├── technical-design.md   # 技术方案
│   ├── ui-design-spec.md     # UI 设计规范
│   ├── development-process.md# 开发流程与执行步骤
│   └── testing-acceptance.md # 测试与验收规范
├── devlog/                   # 开发日志与待办
│   ├── DEVLOG.md             # 按日期记录完成事项
│   └── TODO.md               # 待办清单
├── scripts/
│   └── generate-icon.ps1     # 图标生成脚本（可重新生成 assets/）
└── 启动pdf分页器.bat          # 双击启动（开发模式）
```

## 给开发者的快速开始

```bash
npm install        # 安装依赖（首次）
npm start          # 开发模式运行（或双击 启动pdf分页器.bat）
npm run dist       # 打包便携式单文件 exe（输出到 release/）
```

## 给使用者的说明

正式版是一个双击即用的 exe 文件，无需安装任何软件：

- 程序文件：`release/PDF分页器.exe`
- 使用说明：[docs/使用说明.md](docs/使用说明.md)
