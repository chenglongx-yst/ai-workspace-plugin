# Python 后端（FastAPI）

本目录是 **真正的 Python 项目**，由扩展生命周期脚本在「启用」时启动。

## 本地开发

```bash
cd examples/third-party-integration-demo-python/server
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 18765 --reload
```

打开 http://127.0.0.1:18765/docs 查看 OpenAPI。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `AIW_EXTENSION_DIR` | 扩展根目录（`onActivate` 自动注入） |
| `AIW_EXTENSION_NAME` | manifest `name` |

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/info` | Python / 平台信息 |
| POST | `/api/echo` | 回显 JSON |
| POST | `/api/validate-token-header` | 校验 iframe 传来的 Bearer Token |

端口与 host 读取上级 `config/server.json`。
