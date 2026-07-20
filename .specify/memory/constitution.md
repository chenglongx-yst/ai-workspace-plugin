# LLM 对话插件 Constitution

## Project Identity

- **Name**: LLM 对话插件（AI-Workspace 产品中心插件）
- **Shape**: 前端 iframe（`application/`）+ FastAPI Sidecar（`server/`）
- **Modes**:
  - **对话桥**：经宿主 `window.aiworkspace.dialogue` 建会话、发消息、流式输出、`setModel`
  - **模型直连**：`getModelsToken()` → Sidecar 解密 → 企业网关补全 API

## Core Principles

### I. Spec-First

新功能必须走规格驱动流程后再改代码：constitution（治理变更时）→ specify →（按需）brainstorm → plan → tasks → execute → review。  
日常推荐入口：`feature-pipeline`（见 `docs/dev-workflow.md`）。禁止无规格的大范围改动。

### II. Clear Trust Boundaries

- Models Token 解密与密钥材料仅允许存在于 Python Sidecar（`server/`）
- 前端只接收脱敏模型列表与流式正文；不得在前端持有或日志打印明文 key / `productSecret`
- 不把密钥或明文 token 提交进 git

### III. Host Contract First

依赖宿主 Dialogue / Identity SDK 与扩展清单 `ai-workspace-extension.json`（权限、生命周期、sidecar 端口为真源）。  
变更权限、端口或密钥配置后，必须同步文档，并提醒：**禁用再启用**扩展。

### IV. Verifiable Delivery

每次交付须有可检查手段：至少覆盖 `/api/health`、相关 API 行为，或一份最小手动验收清单。  
涉及流式 / SSE 时，须写明成功与失败时的用户可见表现。

### V. YAGNI and Small Steps

不提前抽象「通用聊天框架」。优先在现有 Tab、适配器、路由上增量修改。  
任务应可独立验证；避免无关重构。

## Technical Constraints

| Area | Convention |
|------|------------|
| Frontend | `application/`：Vanilla JS + CSS；共用聊天壳 + 双适配器 |
| Backend | `server/`：FastAPI；运行时配置来自 `config/server.json` |
| Extension manifest | `ai-workspace-extension.json` |
| Spec artifacts | 新功能：`specs/NNN-*/`；历史设计可参考 `docs/superpowers/specs/` |

## Development Workflow

1. **推荐**：用 `feature-pipeline`（fast / standard / strict）从需求一句话跑到验收
2. **细控**：逐步使用 `/speckit-*` 与 `/speckit-superspec-*` skills
3. 断点续跑：`/speckit-superspec-status` 或「继续 feature-pipeline」
4. 详细命令与环境：`docs/dev-workflow.md`

## Governance

- 本宪章优先于临时约定与口头偏好
- 修改宪章须人工确认，并 bump Version / Last Amended
- 实现与宪章冲突时：先改规格或宪章，再改代码
- PR / 审查应核对是否违反信任边界与宿主契约

**Version**: 1.0.0 | **Ratified**: 2026-07-17 | **Last Amended**: 2026-07-17
