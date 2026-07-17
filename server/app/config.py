"""Application settings loaded from environment and config files."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from app.demo_constants import DEMO_CLIENT_CONFIG_ENTRY, DEMO_PRODUCT_SECRET

DEFAULT_MODEL_BASE_URL = "https://token.longshine.com/v1"
DEFAULT_CHAT_COMPLETIONS_PATH = "/chat/completions"


@dataclass(frozen=True)
class AppSettings:
    extension_dir: Path
    extension_name: str
    host: str
    port: int
    product_secret: str
    product_secret_source: str
    model_base_url: str
    chat_completions_path: str

    @property
    def chat_completions_url(self) -> str:
        base = self.model_base_url.rstrip("/")
        path = self.chat_completions_path if self.chat_completions_path.startswith("/") else f"/{self.chat_completions_path}"
        return f"{base}{path}"


def load_settings() -> AppSettings:
    extension_dir = Path(os.environ.get("AIW_EXTENSION_DIR", Path(__file__).resolve().parents[2]))
    extension_name = (
        os.environ.get("AIW_EXTENSION_ID")
        or os.environ.get("AIW_EXTENSION_NAME")
        or "third-party-integration-demo-python"
    )

    config_path = extension_dir / "config" / "server.json"
    host = "127.0.0.1"
    port = 18765
    product_secret = ""
    product_secret_source = "none"
    model_base_url = DEFAULT_MODEL_BASE_URL
    chat_completions_path = DEFAULT_CHAT_COMPLETIONS_PATH

    if config_path.is_file():
        raw = json.loads(config_path.read_text(encoding="utf-8"))
        host = str(raw.get("host") or host)
        port = int(raw.get("port") or port)
        file_secret = str(raw.get("productSecret") or "").strip()
        if file_secret:
            product_secret = file_secret
            product_secret_source = "config/server.json"
        if raw.get("modelBaseUrl"):
            model_base_url = str(raw["modelBaseUrl"]).strip().rstrip("/")
        if raw.get("chatCompletionsPath"):
            chat_completions_path = str(raw["chatCompletionsPath"]).strip() or chat_completions_path

    env_secret = (
        os.environ.get("AIW_DEMO_PRODUCT_SECRET", "").strip()
        or os.environ.get("AIW_IDENTITY_PRODUCT_SECRET", "").strip()
    )
    if env_secret:
        product_secret = env_secret
        product_secret_source = "env"

    if not product_secret:
        product_secret = DEMO_PRODUCT_SECRET
        product_secret_source = "demo_default"

    return AppSettings(
        extension_dir=extension_dir,
        extension_name=extension_name,
        host=host,
        port=port,
        product_secret=product_secret,
        product_secret_source=product_secret_source,
        model_base_url=model_base_url,
        chat_completions_path=chat_completions_path,
    )


settings = load_settings()
CLIENT_CONFIG_HINT = DEMO_CLIENT_CONFIG_ENTRY
