"""Application settings loaded from environment and config files."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AppSettings:
    extension_dir: Path
    extension_name: str
    host: str
    port: int


def load_settings() -> AppSettings:
    extension_dir = Path(os.environ.get("AIW_EXTENSION_DIR", Path(__file__).resolve().parents[2]))
    extension_name = os.environ.get("AIW_EXTENSION_NAME", "third-party-integration-demo-python")

    config_path = extension_dir / "config" / "server.json"
    host = "127.0.0.1"
    port = 18765
    if config_path.is_file():
        raw = json.loads(config_path.read_text(encoding="utf-8"))
        host = str(raw.get("host") or host)
        port = int(raw.get("port") or port)

    return AppSettings(
        extension_dir=extension_dir,
        extension_name=extension_name,
        host=host,
        port=port,
    )


settings = load_settings()
