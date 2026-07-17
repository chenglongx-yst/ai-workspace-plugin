"""HTTP API routes: health, models list, OpenAI-compatible chat proxy."""

from __future__ import annotations

import json
import platform
import sys
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Literal

import httpx
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import CLIENT_CONFIG_HINT, settings
from app.demo_constants import DEMO_PRODUCT_SECRET
from app.identity_crypto import (
    list_available_models,
    resolve_api_key_for_model,
    summarize_models_payload,
    verify_models_token,
)

router = APIRouter(prefix="/api", tags=["llm"])


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=100_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    model: str = Field(min_length=1, max_length=200)
    stream: bool = True
    temperature: float | None = Field(default=None, ge=0, le=2)


def _require_product_secret() -> str:
    secret = (settings.product_secret or "").strip()
    if not secret:
        raise HTTPException(
            status_code=500,
            detail=(
                "productSecret 未配置。Demo 约定密钥为 "
                f"「{DEMO_PRODUCT_SECRET}」：请在 config/server.json 设置 productSecret，"
                f"并与 client config「{CLIENT_CONFIG_HINT}」一致。"
            ),
        )
    return secret


def _extract_models_token(
    authorization: str | None,
    x_identity_models_token: str | None,
) -> str:
    if x_identity_models_token and x_identity_models_token.strip():
        return x_identity_models_token.strip()
    if authorization:
        token = authorization.strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
        if token:
            return token
    return ""


def _decrypt_models_payload(token: str) -> dict[str, Any]:
    secret = _require_product_secret()
    try:
        return verify_models_token(token, secret)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=401,
            detail=(
                f"Invalid models token: {exc}. "
                f"确认签发与解密使用同一密钥。Demo 约定：client config 配置 {CLIENT_CONFIG_HINT}，"
                f"本服务 productSecret={DEMO_PRODUCT_SECRET!r}（来源: {settings.product_secret_source}）。"
            ),
        ) from exc


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
        "extensionDir": str(settings.extension_dir),
        "productSecretConfigured": bool(settings.product_secret.strip()),
        "productSecretSource": settings.product_secret_source,
        "clientConfigHint": CLIENT_CONFIG_HINT,
        "modelBaseUrl": settings.model_base_url,
        "chatCompletionsUrl": settings.chat_completions_url,
    }


@router.get("/models")
def list_models(
    authorization: str | None = Header(default=None),
    x_identity_models_token: str | None = Header(default=None, alias="X-Identity-Models-Token"),
    x_identity_version: str | None = Header(default=None, alias="X-Identity-Version"),
) -> dict[str, Any]:
    if x_identity_version is not None and x_identity_version != "1":
        raise HTTPException(status_code=401, detail="X-Identity-Version must be 1")

    token = _extract_models_token(authorization, x_identity_models_token)
    if not token:
        raise HTTPException(status_code=401, detail="Missing X-Identity-Models-Token or Authorization")

    payload = _decrypt_models_payload(token)
    models = list_available_models(payload)
    summary = summarize_models_payload(payload)
    return {
        "ok": True,
        "models": models,
        "defaultModel": models[0] if models else None,
        "chatCompletionsUrl": settings.chat_completions_url,
        **summary,
    }


async def _upstream_chat_stream(
    url: str,
    api_key: str,
    body: dict[str, Any],
) -> AsyncIterator[str]:
    timeout = httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            json=body,
        ) as resp:
            if resp.status_code >= 400:
                err_text = (await resp.aread()).decode("utf-8", errors="replace")
                yield f"data: {json.dumps({'error': err_text, 'status': resp.status_code}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            async for line in resp.aiter_lines():
                if not line:
                    continue
                if line.startswith("data:"):
                    yield f"{line}\n\n"
                else:
                    # Some gateways send raw JSON lines
                    yield f"data: {line}\n\n"


@router.post("/chat")
async def chat(
    body: ChatRequest,
    authorization: str | None = Header(default=None),
    x_identity_models_token: str | None = Header(default=None, alias="X-Identity-Models-Token"),
    x_identity_version: str | None = Header(default=None, alias="X-Identity-Version"),
) -> Any:
    if x_identity_version is not None and x_identity_version != "1":
        raise HTTPException(status_code=401, detail="X-Identity-Version must be 1")

    token = _extract_models_token(authorization, x_identity_models_token)
    if not token:
        raise HTTPException(status_code=401, detail="Missing X-Identity-Models-Token or Authorization")

    payload = _decrypt_models_payload(token)
    try:
        api_key = resolve_api_key_for_model(payload, body.model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    upstream_body: dict[str, Any] = {
        "model": body.model,
        "messages": [{"role": m.role, "content": m.content} for m in body.messages],
        "stream": body.stream,
    }
    if body.temperature is not None:
        upstream_body["temperature"] = body.temperature

    url = settings.chat_completions_url

    if body.stream:
        return StreamingResponse(
            _upstream_chat_stream(url, api_key, upstream_body),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    timeout = httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=upstream_body,
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Upstream error {resp.status_code}: {resp.text}")
        return resp.json()
