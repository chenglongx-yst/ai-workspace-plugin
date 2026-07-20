# C盘清理插件

AI-Workspace 产品中心插件：扫描 C 盘垃圾并支持安全清理 / 深度清理，缓解磁盘压力。

界面参考「扫描摘要 → C盘概况 → 分类 → 详情勾选 → 一键/深度清理」。

## 架构

```
iframe (application/)  →  FastAPI Sidecar (server/)  →  vendor/skill-c-cleaner/*.ps1
```

## 能力

| 操作 | 说明 |
|------|------|
| 打开自动扫描 | `POST /api/scan` → `plugin-quick-scan.ps1` |
| 安全清理 | 勾选安全分类后一键清理 → `plugin-clean-safe.ps1 -ReallyDelete` |
| 深度清理 | 预览 + confirmToken → `plugin-clean-deep.ps1 -ReallyDelete` |

下载目录等谨慎项默认不勾选，且不会走安全清理 API。

## 配置（`config/server.json`）

```json
{
  "host": "127.0.0.1",
  "port": 18765,
  "skillRoot": "vendor/skill-c-cleaner"
}
```

## 安装与启用

1. 产品中心 → 添加应用 → 选择本目录  
2. 首次 `onInstall` 会创建 Python venv  
3. 启用并打开应用（需 Windows + PowerShell）  
4. 部分系统目录清理可能需要管理员权限  

## 本地仅调 Python

```bash
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set AIW_EXTENSION_DIR=..
uvicorn app.main:app --host 127.0.0.1 --port 18765 --reload
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/disk` | 磁盘概况 |
| POST | `/api/scan` | 扫描 |
| POST | `/api/clean/safe` | 安全清理 |
| POST | `/api/clean/deep/preview` | 深度预览 + token |
| POST | `/api/clean/deep` | 深度执行 |

## 参考

- 设计：`docs/superpowers/specs/2026-07-17-c-drive-cleaner-plugin-design.md`
- 计划：`docs/superpowers/plans/2026-07-17-c-drive-cleaner-plugin.md`
- 工作流：`docs/dev-workflow.md`
- Skill 来源：https://github.com/niuhai/skill-c-cleaner（见 `vendor/skill-c-cleaner/PIN.yml`）
