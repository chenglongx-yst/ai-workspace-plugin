---
name: feature-pipeline
description: >-
  Orchestrate end-to-end feature delivery for this repo: requirement → spec gate →
  plan/tasks gate → implement → acceptance gate. Use when the user wants to
  implement a feature/requirement via feature-pipeline, SDD pipeline, or asks to
  run the automated spec-kit + superspec flow (fast/standard/strict).
---

# Feature Pipeline（方案 A 编排入口）

将本仓库已安装的 **spec-kit + superspec + Superpowers** 串成一条管线。  
**只改编排与人工门禁**；方法论以各 skill / 扩展原文为准，不要重写其流程。

## When to use

- 用户说「用 feature-pipeline 实现…」「按 SDD 做…」「走自动化需求流程…」
- 用户给出功能需求并希望从规格写到实现验收

## Modes

Parse mode from user message; default **standard**.

| Mode | Behavior |
|------|----------|
| **fast** | Skip brainstorm. May merge plan+tasks into **one** confirmation gate before implement. |
| **standard** | Optional short clarify/brainstorm when ambiguous. Gates: **spec** → **tasks** → **acceptance**. |
| **strict** | Always run superspec brainstorm. More human checkpoints during execute. |

## Hard gates (do not skip)

1. **Spec gate** — After `spec.md` is ready, summarize and **stop**. Wait for explicit user approval (or requested edits).
2. **Tasks gate** — After plan + tasks are ready, show task list and **stop**. Wait for approval. (In **fast**, this may be the only pre-implement gate if combined with a brief spec summary already approved in the same turn — still require explicit OK before coding.)
3. **Acceptance gate** — After implement + review, present acceptance checklist and **stop**. Wait for pass / fix requests.

Never auto-approve gates. Never start coding before the tasks gate passes.

## Prerequisites (read first)

1. `.specify/memory/constitution.md` — obey trust boundaries and constraints
2. Existing feature dir if resuming: `specs/NNN-*/` + `progress.yml` if present
3. Cursor skills under `.cursor/skills/` (invoke by following their SKILL.md):
   - `speckit-specify`, `speckit-plan`, `speckit-tasks` (optional fallback)
   - `speckit-superspec-status`, `speckit-superspec-brainstorm`, `speckit-superspec-tasks`, `speckit-superspec-execute`, `speckit-superspec-review`
4. Superpowers under `.agents/skills/` (superspec detects these):
   - `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `requesting-code-review`

If interrupted, run status first (`speckit-superspec-status`) and resume from the incomplete phase.

## Pipeline steps

### 0. Intake

- Extract requirement text and mode
- Create or select `specs/NNN-feature-slug/` (use spec-kit scripts / specify conventions already in `.specify/scripts`)
- Announce: feature id, mode, next gate

### 1. Specify

- Follow `.cursor/skills/speckit-specify/SKILL.md` with the requirement
- Write/update `specs/NNN-*/spec.md`
- Ensure alignment with constitution (especially secrets / host SDK)

### 2. Clarify / Brainstorm

- **fast**: skip
- **standard**: if open questions or high ambiguity, follow `speckit-superspec-brainstorm` (or ask one question at a time); fold answers into `spec.md`
- **strict**: always run `speckit-superspec-brainstorm`

### 3. SPEC GATE ⏸

Present:

- Feature path
- Goal / user stories summary
- Key requirements & edge cases
- Open questions (must be empty or explicitly deferred)

Ask: 「请确认 spec（OK / 要改的点）」. **Wait.**

### 4. Plan + Tasks

- Follow `speckit-plan` → `specs/NNN-*/plan.md`
- Prefer `speckit-superspec-tasks` over plain `speckit-tasks` → `specs/NNN-*/tasks.md`
- Respect Superpowers `writing-plans` if superspec invokes it

### 5. TASKS GATE ⏸

Present prioritized task list, markers (`[TDD]`, `[REVIEW]`, etc.), and out-of-scope.  
Ask: 「请确认任务拆分（OK / 要改的点）」. **Wait.**

### 6. Execute

- Follow `speckit-superspec-execute`
- **strict**: honor every human checkpoint in that skill
- **standard/fast**: only stop on failures, blocked decisions, or skill-mandated checkpoints
- Do not expand scope beyond approved tasks

### 7. Review

- Follow `speckit-superspec-review`
- Map findings to severity; fix Critical before acceptance gate when straightforward

### 8. ACCEPTANCE GATE ⏸

Present:

- What changed (files)
- How to verify (`/api/health`, manual UI steps, etc.)
- Residual risks / follow-ups

Ask: 「验收是否通过？（通过 / 问题列表）」. **Wait.**  
On failure, fix and re-run review as needed, then re-open acceptance gate.

## Output locations (non-negotiable)

| Artifact | Path |
|----------|------|
| Spec / plan / tasks / progress | `specs/NNN-*/` |
| Constitution | `.specify/memory/constitution.md` |
| Historical designs only | `docs/superpowers/specs/` (do not put new feature truth there) |

## Example triggers

```text
用 feature-pipeline 实现：模型直连支持停止生成
用 feature-pipeline（fast）做：健康检查返回版本号
用 feature-pipeline（strict）实现：对话桥断线重连提示
继续 feature-pipeline
```

## Anti-patterns

- Skipping gates because the change "looks small"
- Writing code during specify/plan phases
- Creating a separate design doc under `docs/superpowers/specs/` instead of `specs/NNN-*/spec.md` for new work
- Putting secrets into frontend or committing them
