# C-drive cleaner Sidecar

FastAPI service that orchestrates `vendor/skill-c-cleaner` PowerShell scripts.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set AIW_EXTENSION_DIR=%CD%\..
uvicorn app.main:app --host 127.0.0.1 --port 18765 --reload
```
