"""Application settings for C-drive cleaner sidecar."""

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
    skill_root: Path
    powershell_exe: str


def _default_powershell() -> str:
    for candidate in (
        os.environ.get("AIW_POWERSHELL_PATH", "").strip(),
        r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
        "powershell.exe",
    ):
        if candidate:
            return candidate
    return "powershell.exe"


def load_settings() -> AppSettings:
    extension_dir = Path(os.environ.get("AIW_EXTENSION_DIR", Path(__file__).resolve().parents[2]))
    extension_name = (
        os.environ.get("AIW_EXTENSION_ID")
        or os.environ.get("AIW_EXTENSION_NAME")
        or "c-drive-cleaner"
    )

    config_path = extension_dir / "config" / "server.json"
    host = "127.0.0.1"
    port = 18765
    skill_root = extension_dir / "vendor" / "skill-c-cleaner"
    powershell_exe = _default_powershell()

    if config_path.is_file():
        raw = json.loads(config_path.read_text(encoding="utf-8"))
        host = str(raw.get("host") or host)
        port = int(raw.get("port") or port)
        if raw.get("skillRoot"):
            skill_root = Path(str(raw["skillRoot"]))
            if not skill_root.is_absolute():
                skill_root = extension_dir / skill_root
        if raw.get("powershell"):
            powershell_exe = str(raw["powershell"]).strip() or powershell_exe

    return AppSettings(
        extension_dir=extension_dir,
        extension_name=extension_name,
        host=host,
        port=port,
        skill_root=skill_root,
        powershell_exe=powershell_exe,
    )


settings = load_settings()
