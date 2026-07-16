# 三方集成 Demo（Python 全栈插件应用）

比 `third-party-integration-demo` 更完整的示例：**FastAPI Python 后端** + **iframe 壳层前端**（Identity / Dialogue 桥接）。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  AI-Workspace 产品中心 · ExtensionAppTabPanel (iframe)   │
│  application/index.html  ← aion-asset:// 壳层 UI         │
│    · aiw-identity.js / aiw-dialogue.js                   │
│    · fetch → http://127.0.0.1:18765/api/*                │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP (CORS)
┌───────────────────────────▼─────────────────────────────┐
│  server/  FastAPI + uvicorn（Python 项目）               │
│  由 AI-Workspace 声明式 Sidecar 托管、健康检查与停止       │
└─────────────────────────────────────────────────────────┘
```

**为何不是纯 Python 页面？**  
Identity / Dialogue 桥只能注入 **aion-asset:// iframe 壳层**，不能直接注入 `http://localhost` 页面。因此采用业界常见的 **壳层 + 本地 API** 模式：壳层拿 Token，Python 提供业务 API。

## 目录结构

```
third-party-integration-demo-python/
├── ai-workspace-extension.json
├── config/server.json          # host / port（JS 与 Python 共用）
├── scripts/
│   ├── onInstall.js            # python -m venv && pip install
│   ├── activate.js             # Sidecar 启动前检查
│   ├── deactivate.js           # Sidecar 停止前清理
│   └── sidecar.js              # 宿主管理的 Python 进程包装器
├── server/                     # Python 项目根
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       └── routes/api.py
└── application/                # iframe 壳层（非 Python，但对接桥接）
    ├── index.html
    └── app.js
```

## 快速开始

### 1. 开发模式（可选扫描 examples/）

```bash
node scripts/dev-bootstrap.mjs launch start --extensions
```

或 `AI_WORKSPACE_EXTENSIONS_PATH=./examples bun start`。默认 `bun start` **不会**扫描 `examples/`。

重启客户端后，扩展会出现在 **产品中心 → 我的应用**（或通过下方安装流程添加）。

### 2. 产品中心安装

**产品中心 → 我的应用 → 添加应用 → 插件应用**，选择本文件夹 / zip / Git。

首次安装会跑 `onInstall`：创建 `server/.venv` 并 `pip install -r requirements.txt`（使用宿主 bundled Python，需联网下载依赖）。**首次 pip 安装可能超过 1 分钟**，manifest 已将 `lifecycle.timeoutMs` 设为 5 分钟，请耐心等待安装完成，不要重复点击。

### 3. 启用并打开

1. 卡片点击 **启用**（触发 `onActivate` → 启动 Python）
2. 点击卡片打开应用
3. SSO 登录；Identity 需配置 client config：

   ```
   ai.workspace.third.platform.secret=third-party-integration-demo-python:your-dev-secret
   ```

### 4. 仅调试 Python（不经过宿主）

```bash
cd server && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 18765 --reload
```

## 启动命令配置

| 配置项 | 位置 | 说明 |
| --- | --- | --- |
| **HTTP 端口** | `config/server.json` → `port` | 默认 `18765` |
| **绑定地址** | `config/server.json` → `host` | 默认 `127.0.0.1` |
| **Python 启动命令** | `sidecar.command` + `scripts/sidecar.js` | 宿主通过 `@aiw/node` 启动包装器，再运行 venv Python |
| **依赖安装** | `scripts/onInstall.js` | `pip install -r server/requirements.txt` |
| **iframe 入口** | `contributes/product-center-apps.json` | `application/index.html` |

修改端口后需 **禁用再启用** 扩展，或重启客户端。

## 权限说明

manifest 声明 `shell: true`，用于安装依赖与启动本地 Python 进程；启用前用户会在产品中心卡片确认。

## 参考

- 纯 HTML 最小版：`examples/third-party-integration-demo/`
- 集成文档：`docs/external-apis/outbound/third-party-integration-architecture-and-sdk.md`
