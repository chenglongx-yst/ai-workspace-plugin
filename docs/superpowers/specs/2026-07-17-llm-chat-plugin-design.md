# LLM 对话插件设计

> 日期：2026-07-17  
> 状态：已批准，进入实现

## 目标

在现有 AI-Workspace 产品中心插件上，提供主流对话 UI，支持：

1. **对话桥 Tab**：经 `window.aiworkspace.dialogue` 与宿主 LLM 对话，并 `setModel` 切换模型  
2. **模型直连 Tab**：`getModelsToken()` → Python Sidecar 解密 → 调用企业网关补全 API

## 架构

- 共用聊天壳（消息列表 / 输入 / 模型下拉）+ 双适配器  
- 去掉原 Demo 三卡片  
- Path B 密钥仅在 Python 进程内使用，前端只收脱敏模型列表与流式正文

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

实际请求：`{modelBaseUrl}{chatCompletionsPath}` → `https://token.longshine.com/v1/chat/completions`

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/models` | 头带 Models Token → 返回 permittedModels（无明文 key） |
| POST | `/api/chat` | body: `{ messages, model, stream? }` → SSE 或 JSON |

## 前端

- Tab：对话桥 / 模型直连  
- 补全 `aiw-dialogue.js` 全量方法与 stream  
- 直连：Identity `getModelsToken` + fetch SSE
