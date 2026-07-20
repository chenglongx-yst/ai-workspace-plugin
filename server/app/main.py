"""FastAPI entrypoint for the C-drive cleaner plugin."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.api import router as api_router

app = FastAPI(
    title="AI-Workspace C-Drive Cleaner",
    version="0.3.0",
    description="Scan and clean C-drive junk via skill-c-cleaner PowerShell scripts.",
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
        "message": "AI-Workspace C-drive cleaner API",
        "extension": settings.extension_name,
        "docs": "/docs",
    }
