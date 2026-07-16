"""HTTP API routes for the Python plugin demo."""

from __future__ import annotations

import platform
import sys
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter(prefix="/api", tags=["demo"])


class EchoRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class EchoResponse(BaseModel):
    echo: str
    received_at: str
    extension_name: str


class ProfileSummary(BaseModel):
    has_authorization: bool
    authorization_preview: str | None
    server_time: str


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "third-party-integration-demo-python"}


@router.get("/info")
def info() -> dict[str, Any]:
    return {
        "extensionName": settings.extension_name,
        "pythonVersion": sys.version.split()[0],
        "platform": platform.platform(),
        "serverTime": datetime.now(timezone.utc).isoformat(),
        "host": settings.host,
        "port": settings.port,
        "extensionDir": str(settings.extension_dir),
    }


@router.post("/echo", response_model=EchoResponse)
def echo(body: EchoRequest) -> EchoResponse:
    return EchoResponse(
        echo=body.message,
        received_at=datetime.now(timezone.utc).isoformat(),
        extension_name=settings.extension_name,
    )


@router.get("/profile-summary", response_model=ProfileSummary)
def profile_summary(authorization: str | None = Header(default=None)) -> ProfileSummary:
    token = authorization.strip() if authorization else ""
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    preview = None
    if token:
        preview = token[:12] + "…" if len(token) > 12 else token

    return ProfileSummary(
        has_authorization=bool(token),
        authorization_preview=preview,
        server_time=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/validate-token-header")
def validate_token_header(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = authorization.strip() if authorization else ""
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if len(token) < 16:
        raise HTTPException(status_code=400, detail="Token looks too short for this demo")
    return {
        "ok": True,
        "tokenLength": len(token),
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }
