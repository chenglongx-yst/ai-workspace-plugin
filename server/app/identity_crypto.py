"""Decrypt and verify AI-Workspace Identity / Models Tokens.

Crypto must match:
  AI-Workspace identityTokenCrypto.ts
  docs/external-apis/outbound/third-party-identity-token-server-decrypt.md
"""

from __future__ import annotations

import base64
import hashlib
import json
import time
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

WIRE_VERSION = 1
IV_LENGTH = 12
AUTH_TAG_LENGTH = 16
EXPECTED_AUD = "ai-workspace-platform"
EXPECTED_ISS = "ai-workspace"


def derive_aes_key(product_secret: str) -> bytes:
    return hashlib.sha256(product_secret.encode("utf-8")).digest()


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def decrypt_wire_token(wire_token: str, product_secret: str) -> str:
    wire = b64url_decode(wire_token.strip())
    min_len = 1 + IV_LENGTH + AUTH_TAG_LENGTH + 1
    if len(wire) < min_len:
        raise ValueError("Invalid identity token: truncated wire payload.")
    if wire[0] != WIRE_VERSION:
        raise ValueError(f"Unsupported wire version: {wire[0]}")

    iv = wire[1 : 1 + IV_LENGTH]
    auth_tag = wire[-AUTH_TAG_LENGTH:]
    ciphertext = wire[1 + IV_LENGTH : -AUTH_TAG_LENGTH]

    aesgcm = AESGCM(derive_aes_key(product_secret))
    plain_bytes = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
    return plain_bytes.decode("utf-8")


def _validate_common(payload: dict[str, Any], skew_seconds: int = 60) -> None:
    now = int(time.time())
    if payload.get("v") != 1:
        raise ValueError("Invalid payload version")
    if payload.get("iss") != EXPECTED_ISS:
        raise ValueError("Invalid issuer")
    if payload.get("aud") != EXPECTED_AUD:
        raise ValueError("Invalid audience")
    if int(payload.get("exp", 0)) <= now - skew_seconds:
        raise ValueError("Token expired")


def verify_user_token(wire_token: str, product_secret: str, skew_seconds: int = 60) -> dict[str, Any]:
    payload = json.loads(decrypt_wire_token(wire_token, product_secret))
    _validate_common(payload, skew_seconds=skew_seconds)
    union_id = (payload.get("user") or {}).get("unionId") or ""
    if not str(union_id).strip():
        raise ValueError("Missing unionId")
    return payload


def verify_models_token(wire_token: str, product_secret: str, skew_seconds: int = 60) -> dict[str, Any]:
    payload = json.loads(decrypt_wire_token(wire_token, product_secret))
    _validate_common(payload, skew_seconds=skew_seconds)
    if "permittedModels" not in payload and "keyModels" not in payload:
        raise ValueError("Not a Models Token payload (missing permittedModels/keyModels)")
    return payload


def redact_key(key: str | None) -> str:
    if not key or not isinstance(key, str):
        return "—"
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}…{key[-4:]} (len={len(key)})"


def summarize_models_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Safe summary for API responses — never returns full API keys."""
    key_models_raw = payload.get("keyModels") or []
    key_models: list[dict[str, Any]] = []
    if isinstance(key_models_raw, list):
        for entry in key_models_raw:
            if not isinstance(entry, dict):
                continue
            specs = entry.get("modelSpecs") or {}
            key_models.append(
                {
                    "id": entry.get("id"),
                    "name": entry.get("name"),
                    "models": entry.get("models") or [],
                    "keyPreview": redact_key(entry.get("key") if isinstance(entry.get("key"), str) else None),
                    "modelSpecsKeys": list(specs.keys()) if isinstance(specs, dict) else [],
                }
            )

    return {
        "exp": payload.get("exp"),
        "permittedModels": payload.get("permittedModels") or [],
        "keyModelsCount": len(key_models),
        "keyModels": key_models,
        "note": "Full API keys are decrypted in-process only; this response uses keyPreview.",
    }


def resolve_api_key_for_model(payload: dict[str, Any], model: str) -> str:
    """Pick keyModels[].key that covers the requested model name."""
    model = (model or "").strip()
    key_models = payload.get("keyModels") or []
    if not isinstance(key_models, list):
        raise ValueError("Invalid keyModels in models token")

    if model:
        for entry in key_models:
            if not isinstance(entry, dict):
                continue
            models = entry.get("models") or []
            key = entry.get("key")
            if isinstance(key, str) and key.strip() and isinstance(models, list) and model in models:
                return key.strip()

    for entry in key_models:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key")
        if isinstance(key, str) and key.strip():
            return key.strip()

    raise ValueError(f"No API key found for model {model!r}")


def list_available_models(payload: dict[str, Any]) -> list[str]:
    permitted = payload.get("permittedModels") or []
    names: list[str] = []
    seen: set[str] = set()

    if isinstance(permitted, list):
        for m in permitted:
            name = str(m).strip()
            if name and name not in seen:
                seen.add(name)
                names.append(name)

    key_models = payload.get("keyModels") or []
    if isinstance(key_models, list):
        for entry in key_models:
            if not isinstance(entry, dict):
                continue
            models = entry.get("models") or []
            if isinstance(models, list):
                for m in models:
                    name = str(m).strip()
                    if name and name not in seen:
                        seen.add(name)
                        names.append(name)

    return names
