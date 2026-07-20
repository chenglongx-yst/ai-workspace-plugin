"""C-drive cleaner HTTP API."""

from __future__ import annotations

import platform
import secrets
import sys
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.ps_runner import run_ps_json, skill_root_ok

router = APIRouter(prefix="/api", tags=["cleaner"])

CATEGORY_META = {
    "system_cache": {"name": "系统缓存", "description": "系统运行产生的缓存文件"},
    "temp_files": {"name": "临时文件", "description": "用户与应用临时目录"},
    "downloads": {"name": "下载文件", "description": "下载文件夹占用（默认不清理）"},
    "log_files": {"name": "日志文件", "description": "Windows 错误报告等日志残留"},
    "recycle_bin": {"name": "回收站", "description": "回收站中的已删除文件"},
    "other_junk": {"name": "其他垃圾", "description": "预读取等其它可关注占用"},
}

# confirmToken -> { items, expires_at }
_deep_tokens: dict[str, dict[str, Any]] = {}
_TOKEN_TTL_SEC = 300


def enrich_scan(data: dict[str, Any]) -> dict[str, Any]:
    cats = []
    for raw in data.get("categories") or []:
        cid = str(raw.get("id") or "")
        meta = CATEGORY_META.get(cid, {})
        cats.append(
            {
                **raw,
                "name": meta.get("name") or cid,
                "description": meta.get("description") or "",
            }
        )
    data["categories"] = cats
    return data


class SafeCleanRequest(BaseModel):
    categoryIds: list[str] = Field(default_factory=list)
    confirm: bool = False
    preview: bool = False


class DeepPreviewRequest(BaseModel):
    items: list[str] = Field(default_factory=lambda: ["update_cache", "winsxs", "hibernate"])


class DeepCleanRequest(BaseModel):
    confirmToken: str = Field(min_length=8)
    confirm: bool = False


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.extension_name}


@router.get("/info")
def info() -> dict[str, Any]:
    return {
        "extensionName": settings.extension_name,
        "pythonVersion": sys.version.split()[0],
        "platform": platform.platform(),
        "serverTime": datetime.now(timezone.utc).isoformat(),
        "host": settings.host,
        "port": settings.port,
        "skillRoot": str(settings.skill_root),
        "skillReady": skill_root_ok(),
    }


@router.get("/disk")
def disk() -> dict[str, Any]:
    """Lightweight disk stats via quick scan payload (disk section only)."""
    data = enrich_scan(run_ps_json("plugin-quick-scan.ps1", timeout=180))
    return {"ok": True, "disk": data.get("disk"), "scannedAt": data.get("scannedAt")}


@router.post("/scan")
def scan() -> dict[str, Any]:
    if not skill_root_ok():
        raise HTTPException(status_code=500, detail="skill-c-cleaner vendor scripts missing")
    return enrich_scan(run_ps_json("plugin-quick-scan.ps1", timeout=300))


@router.post("/clean/safe")
def clean_safe(body: SafeCleanRequest) -> dict[str, Any]:
    if not body.categoryIds:
        raise HTTPException(status_code=400, detail="categoryIds required")
    # Never clean downloads via safe API
    blocked = {"downloads"}
    ids = [c for c in body.categoryIds if c and c.lower() not in blocked]
    if not ids:
        raise HTTPException(status_code=400, detail="No cleanable categories selected")

    if not body.preview and not body.confirm:
        raise HTTPException(status_code=400, detail="confirm=true required to execute")

    args = ["-CategoryIds", ",".join(ids)]
    if body.confirm and not body.preview:
        args.append("-ReallyDelete")

    return run_ps_json("plugin-clean-safe.ps1", args=args, timeout=600)


@router.post("/clean/deep/preview")
def clean_deep_preview(body: DeepPreviewRequest) -> dict[str, Any]:
    items = [i for i in body.items if i]
    if not items:
        raise HTTPException(status_code=400, detail="items required")
    # Exclude restore_limit from default executable set
    preview = run_ps_json(
        "plugin-clean-deep.ps1",
        args=["-Items", ",".join(items)],
        timeout=600,
    )
    token = secrets.token_urlsafe(24)
    _deep_tokens[token] = {
        "items": items,
        "expires_at": time.time() + _TOKEN_TTL_SEC,
        "previewFreedBytes": preview.get("freedBytes", 0),
    }
    return {
        "ok": True,
        "confirmToken": token,
        "expiresInSec": _TOKEN_TTL_SEC,
        "preview": preview,
        "warnings": [
            "深度清理可能影响系统更新缓存、组件存储或休眠功能。",
            "请确认已保存工作，并了解操作不可轻易回滚。",
        ],
    }


@router.post("/clean/deep")
def clean_deep(body: DeepCleanRequest) -> dict[str, Any]:
    if not body.confirm:
        raise HTTPException(status_code=400, detail="confirm=true required")
    entry = _deep_tokens.pop(body.confirmToken, None)
    if not entry:
        raise HTTPException(status_code=400, detail="invalid or expired confirmToken")
    if time.time() > float(entry["expires_at"]):
        raise HTTPException(status_code=400, detail="confirmToken expired")

    items = entry["items"]
    return run_ps_json(
        "plugin-clean-deep.ps1",
        args=["-Items", ",".join(items), "-ReallyDelete"],
        timeout=900,
    )
