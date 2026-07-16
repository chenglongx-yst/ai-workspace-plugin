"""FastAPI entrypoint for the Python plugin demo."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.api import router as api_router

app = FastAPI(
    title="AI-Workspace Python Plugin Demo",
    version="0.1.0",
    description="Sample FastAPI backend started by extension lifecycle hooks.",
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
        "message": "AI-Workspace Python plugin demo API",
        "extension": settings.extension_name,
        "docs": "/docs",
    }
