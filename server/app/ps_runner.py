"""Run vendor PowerShell scripts and return parsed JSON."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.config import settings


def run_ps_json(script_name: str, args: list[str] | None = None, timeout: int = 600) -> dict[str, Any]:
    script = settings.skill_root / script_name
    if not script.is_file():
        raise HTTPException(status_code=500, detail=f"Script not found: {script}")

    cmd = [
        settings.powershell_exe,
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script),
    ]
    if args:
        cmd.extend(args)

    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout,
            cwd=str(settings.skill_root),
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail=f"PowerShell timeout: {script_name}") from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start PowerShell: {exc}") from exc

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()

    # Scripts print a single JSON object; take the last non-empty line starting with {
    json_line = ""
    for line in reversed(stdout.splitlines()):
        s = line.strip()
        if s.startswith("{") and s.endswith("}"):
            json_line = s
            break

    if not json_line:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "PowerShell did not return JSON",
                "exitCode": completed.returncode,
                "stdoutTail": stdout[-2000:],
                "stderrTail": stderr[-2000:],
            },
        )

    try:
        return json.loads(json_line)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Invalid JSON from {script_name}: {exc}", "raw": json_line[:1000]},
        ) from exc


def skill_root_ok() -> bool:
    return (settings.skill_root / "plugin-quick-scan.ps1").is_file()
