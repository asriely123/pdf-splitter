# AGENTS.md — 项目工作指引

本文件是本项目的最高层工作说明。任何接手本项目的开发者或 AI Agent，开始工作前必须先完整阅读本文件。

## 项目简介

「PDF分页器」：一个 Windows 上双击即用的单文件 exe 工具。用户拖入或选择一本 PDF 后，可自由增删分段（最少 1 段、默认 1 段、最多 10 段），每段手动填写起止页码，切分输出无水印的 PDF 文件。支持「能看不能复制打印」的受限 PDF 和需要密码打开的 PDF。界面为淡粉色可爱风格，全程中文。

## 必读文件（按顺序）

1. [README.md](README.md) — 项目介绍与目录结构
2. [docs/development-process.md](docs/development-process.md) — 开发流程与执行步骤（**最重要，先读**）
3. [docs/requirements.md](docs/requirements.md) — 需求说明、功能边界与验收标准
4. [docs/technical-design.md](docs/technical-design.md) — 技术方案：架构、qpdf 集成、IPC 接口、打包方式
5. [docs/ui-design-spec.md](docs/ui-design-spec.md) — UI 设计规范：颜色、字体、圆角、动效
6. [docs/testing-acceptance.md](docs/testing-acceptance.md) — 测试用例与交付验收规范
7. [devlog/TODO.md](devlog/TODO.md) — 当前待办清单与进度
8. [devlog/DEVLOG.md](devlog/DEVLOG.md) — 开发日志（按日期记录完成事项）

## 工作规则

- 严格按 [docs/development-process.md](docs/development-process.md) 的阶段推进：一个阶段完成并验收后才进入下一阶段，不得跨阶段批量实现。
- 每个阶段完成后：先更新 [devlog/DEVLOG.md](devlog/DEVLOG.md)（时间线）和 [devlog/TODO.md](devlog/TODO.md)（勾选待办），再创建 git 提交。
- UI 实现必须遵循 [docs/ui-design-spec.md](docs/ui-design-spec.md) 中的设计 token 与动效规范，不得随意换色或改交互。
- PDF 处理必须通过主进程调用打包的 qpdf 完成；渲染进程不接触 Node API 和文件系统，只通过 preload 暴露的安全通道通信。
- 用户输入的 PDF 密码只在内存中使用：禁止写入磁盘、日志、提交信息或任何临时文件。
- git 分支使用 `codex/` 前缀；提交信息用中文，格式为 `类型: 简述`（类型：feat / fix / docs / chore）。
- 不删除或覆盖用户未要求的文件；涉及删除、移动等破坏性操作前必须先确认。
- 遇到与文档规范冲突的情况：先停下来，向用户说明冲突，再决定如何处理。
