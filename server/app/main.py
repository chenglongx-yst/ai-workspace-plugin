"""FastAPI entrypoint for the LLM chat plugin."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.api import router as api_router

app = FastAPI(
    title="AI-Workspace LLM Chat Plugin",
    version="0.2.0",
    description="Dialogue bridge shell + Models Token direct chat via Python Sidecar.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "AI-Workspace LLM chat plugin API",
        "extension": settings.extension_name,
        "docs": "/docs",
    }
