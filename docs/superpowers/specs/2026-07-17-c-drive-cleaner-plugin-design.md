# C 盘清理插件设计

> 日期：2026-07-17  
> 状态：已实现（首版）  
> 范围：将本仓库从 LLM 对话插件转型为 C 盘垃圾扫描/清理插件（方案 1）

## 1. 目标

在 AI-Workspace 产品中心提供插件：开启后扫描用户 **C 盘**垃圾，展示可释放空间，支持用户勾选后进行 **安全清理** 与 **深度清理**，缓解 C 盘压力。

界面风格与结构参考用户提供的「C盘垃圾回收大师」截图（浅蓝圆角卡片、Hero 摘要、概况、分类、详情、底栏双按钮）。

### 成功标准

1. 打开插件自动扫描，展示可释放总量与分类明细  
2. 用户可勾选分类，一键执行安全清理；深度清理需二次确认  
3. 扫描/清理经 Sidecar 调用内嵌 `skill-c-cleaner` PowerShell 脚本  
4. 无对话桥 / Identity / 模型直连依赖  
5. 遵守 skill 安全红线，默认不自动删除  

## 2. 决策摘要

| 决策点 | 选择 |
|--------|------|
| 落点 | 改造当前仓库（替换 LLM 对话能力） |
| 能力深度 | 扫描 + 安全清理 + 深度清理（二次确认） |
| 执行架构 | FastAPI Sidecar 编排 + vendor 内嵌 skill 脚本 |
| AI 顾问 | 首版不做（纯清理 UI） |
| 实现路径 | Sidecar 编排 + 内嵌 skill（方案 1） |

## 3. 架构

```
┌─────────────────────────────────────────────┐
│ AI-Workspace 产品中心 · iframe              │
│ application/  清理 UI（对齐截图）            │
└───────────────────┬─────────────────────────┘
                    │ HTTP 127.0.0.1
┌───────────────────▼─────────────────────────┐
│ server/ FastAPI Sidecar                     │
│  /api/disk · /api/scan · /api/clean/*       │
└───────────────────┬─────────────────────────┘
                    │ PowerShell
┌───────────────────▼─────────────────────────┐
│ vendor/skill-c-cleaner/                     │
│  analyze.ps1 · cleaners/clean-safe.ps1      │
│  cleaners/clean-deep.ps1                    │
└─────────────────────────────────────────────┘
```

| 层 | 职责 |
|----|------|
| UI | 单页清理界面；自动扫描；勾选；一键/深度清理 |
| Sidecar | 调脚本、解析 JSON、汇总、确认令牌与门禁 |
| Vendor skill | 只读扫描 + 安全/深度清理脚本 |

相对现状：移除对话桥、Identity、Models Token、双 Tab 对话 UI；保留扩展清单、sidecar、`shell` 权限与生命周期钩子。

## 4. UI 结构

自上而下对齐参考截图：

1. **Hero**：扫描状态 + 可释放空间大数字 +「一键清理」+ 吉祥物占位  
2. **C 盘概况**：总量/已用、可用、垃圾占用  
3. **分类条**：系统缓存、临时文件、下载文件、日志文件、回收站、其他垃圾（与 skill 扫描结果映射）  
4. **垃圾详情**：可展开列表、勾选、「全部展开」「重新扫描」  
5. **底栏**：「深度清理」|「立即清理 N GB」

### 交互

- 打开插件 → 自动扫描（显示进度）→「垃圾扫描完成」  
- 「一键清理」/「立即清理」= 对已勾选项走安全清理 API  
- 「深度清理」= 弹窗展示风险摘要 → 二次确认 → 深度清理 API  
- 未勾选任何项时主操作按钮禁用  

视觉：浅蓝/白圆角卡片风；首版可用简洁插画占位替代 3D 吉祥物。

## 5. API 与安全

### 5.1 Sidecar API

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/disk` | C 盘总量 / 已用 / 可用 |
| POST | `/api/scan` | 扫描；返回分类汇总与可释放总量（支持进度：轮询或 SSE） |
| POST | `/api/clean/safe` | `{ categoryIds[], confirm: true }` → `clean-safe.ps1` |
| POST | `/api/clean/deep` | 先取风险摘要 + `confirmToken`；再带 token 执行 → `clean-deep.ps1` |

具体请求/响应 JSON 字段在实现计划中按 skill 的 `-OutputFormat json` 对齐。

### 5.2 安全门禁

1. 默认不自动删除；清理必须显式确认  
2. 深度清理：一次性 `confirmToken`，过期作废  
3. 遵守 skill 红线（不删系统还原点、不关休眠/页面文件、不碰 WinSxS ResetBase、不删 Program Files、不删用户文档/桌面/下载整目录、不触碰企业安全软件）  
4. 若 `safety/` 快照脚本可用则清理前调用；否则日志警告  
5. UI 只展示摘要与可控操作，不提供绕过门禁的批量危险删除  

### 5.3 扩展清单

- `displayName`：如「C盘清理」  
- 去掉：`dialogue`、`identity`、`identityModels`  
- 保留：`shell`、`sidecar`、`network`；按需 `storage`  
- 平台说明：Windows 10/11 + PowerShell 5.1+  

## 6. Vendor 与依赖

- 来源：https://github.com/niuhai/skill-c-cleaner  
- 放入：`vendor/skill-c-cleaner/`（记录 pin commit）  
- Sidecar 通过绝对路径调用 `pwsh`/`powershell` 执行脚本  
- `onInstall`：确保 Python venv；校验 PowerShell 可用  

## 7. 范围外（首版）

- 对话桥 / AI 顾问文案引擎  
- 迁移到其他盘、定时清理  
- 非 C 盘扫描  
- 像素级复刻 3D 吉祥物素材（可用占位）  

## 8. 实现顺序（批准后）

1. 用 feature-pipeline / 实现计划拆任务  
2. Vendor skill + pin  
3. 改造 Sidecar API（去掉模型相关）  
4. 重做 `application/` UI  
5. 调整 `ai-workspace-extension.json` 与产品中心文案  
6. 更新 README；手动验收扫描/勾选/安全清理/深度确认  

## 9. 参考

- UI 参考图：会话附件截图  
- Skill：https://github.com/niuhai/skill-c-cleaner  
- 对接文档：`d:\YST_project\ai-work-space\ai-workspace\docs\external-apis\outbound\third-party-integration-architecture-and-sdk.md`  
- 本仓库既有 sidecar 形态：`server/`、`ai-workspace-extension.json`  
