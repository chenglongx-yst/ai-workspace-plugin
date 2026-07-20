# Spec-Kit + Superpowers + Superspec 集成设计

> 日期：2026-07-17  
> 状态：已落地（方案 A）  
> 范围：仓库级 SDD 脚手架（方案 1）+ 项目级 Superpowers skills + 本插件宪章 + feature-pipeline 编排

## 1. 目标

在本 LLM 对话插件仓库中集成三套能力，供后续功能开发走流程化 SDD：

| 工具 | 角色 |
|------|------|
| [spec-kit](https://github.com/github/spec-kit) | 规格驱动：宪章、规格、计划、任务、Cursor skills |
| [obra/superpowers](https://github.com/obra/superpowers) | Agent 工程纪律：头脑风暴、计划拆解、TDD、子代理执行、审查 |
| [superspec](https://github.com/WangX0111/superspec) | 桥接：在 spec-kit 上叠加 status / brainstorm / tasks / execute / review |

**成功标准：**

1. 仓库可提交：`.specify/`、`.cursor/skills/`（cursor-agent + feature-pipeline）、`.agents/skills/`（6 个 Superpowers + feature-pipeline）、空 `specs/`
2. `.specify/memory/constitution.md` 已按本插件原则写好
3. superspec 已安装，且能探测到项目级 Superpowers skills
4. `docs/dev-workflow.md` 可指导同事完成环境、日常命令与 feature-pipeline 用法
5. 业务代码（`application/`、`server/`）无无关大改
6. 用一句话即可触发 feature-pipeline（文档中有示例提示词）

## 2. 决策摘要

| 决策点 | 选择 |
|--------|------|
| 集成层级 | 仓库级工作流脚手架（非仅文档、非插件产品内嵌） |
| Superpowers 挂载 | 项目级 skills（`.agents/skills/`），clone 即用 |
| 落地深度 | 装好工具 + 写宪章；不写示例 feature 全流程产物 |
| 实现路径 | 官方 CLI 链路（`specify init` + `specify extension add superspec`） |
| Superpowers 纳入 | 稀疏拷贝 6 个 skills 并 pin 来源 tag/commit（不整库 submodule） |
| 日常入口 | **feature-pipeline** 编排 Skill：一句话接入，仅保留 3 个人工门禁（spec / 任务 / 验收） |
| 档位 | fast / standard（默认）/ strict |

## 3. 目录与职责

```
ai-workspace-plugin/
├── .specify/
│   ├── memory/constitution.md
│   ├── templates/
│   ├── extensions/                 # superspec（CLI 安装）
│   └── superpowers.yml             # superspec 探测状态（以官方行为为准）
├── .cursor/
│   ├── skills/speckit-*/SKILL.md   # specify init --integration cursor-agent
│   └── rules/specify-rules.mdc
├── .agents/skills/                 # 项目级 Superpowers（superspec 优先探测）
│   ├── brainstorming/
│   ├── writing-plans/
│   ├── executing-plans/
│   ├── subagent-driven-development/
│   ├── test-driven-development/
│   ├── requesting-code-review/
│   └── feature-pipeline/           # 本仓库编排入口（方案 A）
├── .cursor/skills/
│   └── feature-pipeline/SKILL.md   # 与 .agents 同步或软链说明，供 Cursor 发现
├── specs/                          # 后续功能规格；本次仅空目录 + .gitkeep
├── docs/superpowers/specs/         # 历史设计保留；新流程产物走 specs/
└── docs/dev-workflow.md            # 安装、命令顺序、版本 pin、pipeline 用法
```

| 层 | 内容 | 管理方式 |
|----|------|----------|
| spec-kit | 宪章、模板、Cursor skills | `specify` CLI |
| superspec | 桥接命令与扩展文件 | `specify extension add superspec` |
| Superpowers | 上表 6 个 skills | vendor 至 `.agents/skills/` |
| feature-pipeline | 编排：需求 → spec 门禁 → 拆分门禁 → 实现 → 验收门禁 | 本仓库手写 Skill |
| 业务代码 | `application/`、`server/` 等 | 本次不改 |

**刻意不做：** 示例 feature 的 spec/plan/tasks；用户级 `/add-plugin superpowers`；用 `.cursor/rules` 手写镜像整套流程（避免与 skills 重复）。

## 4. 安装与版本策略

### 4.1 本机前置

- Python 3.11+、Git、[uv](https://docs.astral.sh/uv/)
- `uv tool install specify-cli`（或从 spec-kit git tag 安装）

### 4.2 仓库一次性脚手架

```bash
specify init --here --force --integration cursor-agent
specify extension add superspec
# 再将 obra/superpowers 中上述 6 个 skill 目录拷贝到 .agents/skills/
```

- Cursor 集成 key 为 `cursor-agent`（不是 `cursor`）
- 默认 skills 模式，产物在 `.cursor/skills/speckit-*/SKILL.md`

### 4.3 Superpowers pin

- 只拷贝桥接所需 6 个 skill 目录
- 在 `docs/dev-workflow.md` 记录来源仓库与 tag/commit
- 升级时：更新 pin 说明并覆盖同步 `.agents/skills/`

### 4.4 升级约定

| 组件 | 方式 |
|------|------|
| specify-cli | 开发机 `specify self check` / `specify self upgrade`；仓库不锁二进制 |
| superspec | `specify extension` 官方更新流程 |
| Superpowers skills | 改 pin + 覆盖 `.agents/skills/` |

### 4.5 Git 与已有文档

- **提交：** `.specify/`（含 constitution）、`.cursor/skills/`、`specify init` 生成的 `.cursor/rules/specify-rules.mdc`（官方产物，非手写镜像流程）、`.agents/skills/`、`specs/`、`docs/dev-workflow.md`
- **保留：** `docs/superpowers/specs/` 历史设计（只读参考）
- **新功能真源：** `specs/NNN-*/`（spec.md / plan.md / tasks.md / progress.yml）

## 5. 宪章要点

写入 `.specify/memory/constitution.md`。

### 5.1 项目定位

- 名称：LLM 对话插件（AI-Workspace 产品中心插件）
- 形态：前端 iframe（`application/`）+ FastAPI Sidecar（`server/`）
- 双模式：对话桥（宿主 Dialogue SDK）与模型直连（Identity Models Token → Sidecar → 企业网关）

### 5.2 核心原则

1. **规格先行** — 新功能走 constitution → specify → superspec brainstorm → plan → tasks → execute → review；禁止无规格大改。
2. **边界清晰** — 密钥与 Models Token 解密仅在 Python Sidecar；前端只收脱敏模型列表与流式正文；不把 `productSecret` / 明文 key 写入前端或提交 git。
3. **宿主契约优先** — 依赖 Dialogue / Identity SDK 与 `ai-workspace-extension.json`；改权限或 sidecar 端口须同步配置与文档，并提示禁用再启用。
4. **可验证交付** — `/api/health`、关键 API、或最小手动验收；流式/SSE 须明确成功与失败表现。
5. **YAGNI + 小步** — 不提前抽象通用聊天框架；优先改现有 Tab/适配器/路由；任务可独立验证。

### 5.3 技术约束

| 区域 | 约定 |
|------|------|
| 前端 | `application/`：Vanilla JS + CSS；对话壳 + 双适配器 |
| 后端 | `server/`：FastAPI；配置来自 `config/server.json` |
| 扩展清单 | `ai-workspace-extension.json` 为权限/生命周期/sidecar 真源 |
| 文档 | 历史设计可留在 `docs/superpowers/specs/`；新规格进 `specs/NNN-*/` |

### 5.4 治理

- 宪章变更需人工确认后修改并 bump Version
- 与宪章冲突时：先改规格/宪章，再改代码
- 日常命令以 `docs/dev-workflow.md` 为准

### 5.5 不写入宪章

- 具体企业网关 URL、示例密钥值（只描述「配置项与宿主一致」）
- 未批准的新产品形态

## 6. 日常工作流

### 6.1 推荐入口（方案 A）：feature-pipeline

用户一句话触发，例如：「用 feature-pipeline（standard）实现：xxx」。

| 阶段 | Agent 动作 | 人工门禁 |
|------|------------|----------|
| 1 接入 | 建/选 `specs/NNN-*/`，按 spec-kit 规范写 `spec.md` | 否 |
| 2 澄清 | fast：跳过；standard：必要时短澄清；strict：强制 brainstorm | 仅有未决问题时 |
| 3 Spec 门禁 | 展示摘要，等待确认 | **是** |
| 4 拆解 | 自动 plan + superspec.tasks | **是**（确认任务列表） |
| 5 实现 | superspec.execute（增强：Superpowers） | 仅卡点/失败时；strict 更多 checkpoint |
| 6 验收 | superspec.review + 验收清单 | **是** |

档位：

| 档位 | 行为 |
|------|------|
| fast | 跳过 brainstorm；可将 plan+tasks 合并为一次确认 |
| standard（默认） | 上表 3 门禁 |
| strict | 强制 brainstorm；execute 阶段更多人工 checkpoint |

编排 Skill 须 Read 并遵循已安装的 spec-kit / superspec / Superpowers 指令，**只改编排与门禁，不重写方法论**。断点续跑：`/speckit.superspec.status` 或「继续 feature-pipeline」。

### 6.2 细控入口（可选）

仍可逐步调用官方命令：

```
/speckit.constitution            # 仅治理变更时
/speckit.specify
/speckit.superspec.brainstorm
/speckit.plan
/speckit.superspec.tasks
/speckit.superspec.execute
/speckit.superspec.review
/speckit.superspec.status
```

Cursor 实际调用名以 `.cursor/skills/` 安装结果为准，见 `docs/dev-workflow.md`。

### 6.3 Superspec ↔ Superpowers 映射

| Superspec 命令 | Superpowers skill |
|----------------|-------------------|
| brainstorm | brainstorming |
| tasks | writing-plans |
| execute | executing-plans + subagent-driven-development + test-driven-development |
| review | requesting-code-review |

探测顺序（superspec）：`.agents/skills/{name}/SKILL.md` → `~/.agents/skills/...`；未检测到则用内置降级协议。

## 7. 范围外

- 示例 feature 全流程跑通并提交产物（不写示例规格内容）
- 用户级 Cursor Marketplace Superpowers 插件
- 将旧设计文档迁入 `specs/`
- 修改业务功能代码

## 8. 实现顺序

1. 确认本机 uv + specify-cli 可用
2. `specify init --here --force --integration cursor-agent`
3. `specify extension add superspec`
4. Vendor 6 个 Superpowers skills 至 `.agents/skills/`，记录 pin
5. 编写 `constitution.md`
6. 编写 `feature-pipeline` Skill（`.agents/skills/` + `.cursor/skills/`）
7. 编写 `docs/dev-workflow.md`，README 增加指向
8. 按第 1 节成功标准自检（含 pipeline 入口说明可读）

## 9. 参考

- https://github.com/github/spec-kit
- https://github.com/obra/superpowers
- https://github.com/WangX0111/superspec
- 本仓库历史设计：`docs/superpowers/specs/2026-07-17-llm-chat-plugin-design.md`
