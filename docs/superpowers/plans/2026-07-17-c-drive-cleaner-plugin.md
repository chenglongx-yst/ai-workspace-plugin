# C 盘清理插件 Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** 将本仓库从 LLM 对话插件转型为 C 盘扫描/清理插件（对齐设计文档）。

**Architecture:** iframe UI → FastAPI Sidecar → vendor/skill-c-cleaner PowerShell。

**Tech Stack:** Vanilla JS/CSS, FastAPI, PowerShell, AI-Workspace extension sidecar.

## Global Constraints

- Windows + PowerShell；默认不自动删除
- 深度清理需 confirmToken；去掉 dialogue/identity
- 遵守 skill 安全红线

---

### Task 1: Vendor + 配置/清单

- [x] vendor/skill-c-cleaner + PIN
- [ ] 更新 ai-workspace-extension.json、config/server.json、runtime 名称
- [ ] 更新 README

### Task 2: Sidecar API

- [ ] 简化 config（去掉 models）
- [ ] powershell runner + disk/scan/clean endpoints
- [ ] deep clean 非交互包装（因 clean-deep.ps1 含 Read-Host）

### Task 3: Frontend UI

- [ ] 重写 index.html / app.css / app.js（截图结构）
- [ ] 移除对话 SDK 引用（可保留文件但不引用）

### Task 4: 验收

- [ ] /api/health、本地扫描（可 mock/短类别）、UI 联调说明
