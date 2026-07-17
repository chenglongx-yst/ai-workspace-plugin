# LLM 对话插件

AI-Workspace 产品中心插件：主流对话 UI，支持 **对话桥** 与 **模型直连** 两种模式。

## 能力

| Tab | 路径 | 说明 |
| --- | --- | --- |
| **对话桥** | `window.aiworkspace.dialogue` | 建会话、发消息、流式输出、`setModel` 切换模型 |
| **模型直连** | `getModelsToken()` → Python 解密 → 企业网关 | 调 `https://token.longshine.com/v1/chat/completions`（可配置） |

```
┌─────────────────────────────────────────────────────────┐
│  AI-Workspace 产品中心 · iframe (aion-asset://)          │
│  application/  对话 UI + Identity / Dialogue SDK         │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP
┌───────────────────────────▼─────────────────────────────┐
│  server/ FastAPI Sidecar                                 │
│  解密 Models Token → 直连 modelBaseUrl/chat/completions  │
└─────────────────────────────────────────────────────────┘
```

## 配置（`config/server.json`）

```json
{
  "host": "127.0.0.1",
  "port": 18765,
  "productSecret": "1234",
  "modelBaseUrl": "https://token.longshine.com/v1",
  "chatCompletionsPath": "/chat/completions"
}
```

- `productSecret` 须与宿主 client config 一致：`ai.workspace.third.platform.secret=third-party-integration-demo-python:1234`
- 修改端口或密钥后需 **禁用再启用** 扩展

## 安装与启用

1. **产品中心 → 我的应用 → 添加应用 → 插件应用**，选择本目录
2. 首次安装会执行 `onInstall`（创建 venv 并 pip 安装，可能超过 1 分钟）
3. 卡片 **启用** → 打开应用
4. 确认已 SSO 登录

## 本地仅调 Python

```bash
cd server
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 18765 --reload
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/info` | 服务信息（含网关地址） |
| GET | `/api/models` | 头带 `X-Identity-Models-Token` → 模型列表（无明文 key） |
| POST | `/api/chat` | `{ messages, model, stream }` → SSE / JSON |

## 参考

- 设计文档：`docs/superpowers/specs/2026-07-17-llm-chat-plugin-design.md`
- 对接文档：`docs/external-apis/outbound/third-party-integration-architecture-and-sdk.md`
- Models Token 解密：`docs/external-apis/outbound/third-party-identity-token-server-decrypt.md`
