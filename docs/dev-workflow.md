# 开发工作流（Spec-Kit + Superpowers + Superspec）

本仓库已按方案 A 接入规格驱动开发脚手架。日常优先用 **feature-pipeline**；需要细控时再用单步 skills。

设计说明见：`docs/superpowers/specs/2026-07-17-speckit-superpowers-integration-design.md`

## 一次环境准备（本机）

1. Python 3.11+、Git、[uv](https://docs.astral.sh/uv/)
2. 安装 Specify CLI：

```bash
uv tool install specify-cli
# 已安装可检查：
specify --version
specify self check
```

仓库内脚手架（一般已完成，仅新环境或升级时再跑）：

```bash
specify init --here --force --integration cursor-agent
# superspec 社区目录默认 discovery-only，用 ZIP 安装：
specify extension add superspec --from "https://github.com/WangX0111/superspec/archive/refs/heads/main.zip"
```

项目级 Superpowers skills 位于 `.agents/skills/`（pin 见 `.agents/skills/SUPERPOWERS_PIN.yml`）。

## 推荐：feature-pipeline（方案 A）

在 Cursor Agent 中说：

```text
用 feature-pipeline 实现：<你的需求>
用 feature-pipeline（fast）做：<小改动>
用 feature-pipeline（strict）实现：<高风险改动>
继续 feature-pipeline
```

| 档位 | 你要确认的次数 | 说明 |
|------|----------------|------|
| fast | 约 2 次 | 跳过 brainstorm；可合并 plan/tasks 确认 |
| standard（默认） | 3 次 | **spec → 任务拆分 → 验收** |
| strict | 3 次 + 实现中更多卡点 | 强制 brainstorm |

产物目录：`specs/NNN-feature-slug/`（`spec.md` / `plan.md` / `tasks.md` / `progress.yml`）。

## 细控：逐步 skills

Cursor 已安装（`.cursor/skills/`）：

| Skill | 用途 |
|-------|------|
| `/speckit-constitution` | 更新宪章 |
| `/speckit-specify` | 写规格 |
| `/speckit-clarify` | 澄清（可选） |
| `/speckit-plan` | 技术计划 |
| `/speckit-tasks` | 任务列表（基础） |
| `/speckit-implement` | 实现（基础） |
| `/speckit-superspec-status` | 进度与 Superpowers 探测 |
| `/speckit-superspec-brainstorm` | 边界头脑风暴 |
| `/speckit-superspec-tasks` | 增强任务拆解 |
| `/speckit-superspec-execute` | TDD/子代理编排执行 |
| `/speckit-superspec-review` | 对照规格审查 |
| `feature-pipeline` | 一句话编排以上流程 |

宪章：`.specify/memory/constitution.md`

## 版本与升级

| 组件 | 升级方式 |
|------|----------|
| specify-cli | `specify self upgrade` |
| superspec | 重新 `--from` ZIP 或官方 extension update |
| Superpowers skills | 更新 `.agents/skills/` 后改 `SUPERPOWERS_PIN.yml` |
| feature-pipeline | 本仓库维护 `.agents/skills/feature-pipeline` 与 `.cursor/skills/feature-pipeline`（保持同步） |

当前 Superpowers pin：`d884ae04edebef577e82ff7c4e143debd0bbec99`（2026-07-17，`obra/superpowers` main）。

## 与历史文档的关系

- **新功能真源**：`specs/NNN-*/`
- **历史设计**：`docs/superpowers/specs/`（只读参考，例如 LLM 对话插件初版设计）
