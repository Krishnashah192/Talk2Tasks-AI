"""
Talk2Tasks AI — FastAPI Application Entry Point
Local meeting intelligence platform. No cloud APIs required.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env if present
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Also try .env.example as defaults
    example_path = Path(__file__).parent.parent / ".env.example"
    if example_path.exists():
        load_dotenv(example_path)

from app.api.routes import router
from app.database import init_db

# ── Logging ────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("talk2tasks")


# ── Lifespan ───────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("═══════════════════════════════════════════════")
    logger.info("  Talk2Tasks AI — Starting up")
    logger.info("  Local Meeting Intelligence Platform")
    logger.info("═══════════════════════════════════════════════")

    # Initialize database
    await init_db()
    logger.info("✓ Database initialized")

    # Check Ollama (don't block startup)
    from app.services.llm import check_ollama

    ollama_status = await check_ollama()
    if ollama_status["available"]:
        if ollama_status["model_loaded"]:
            logger.info(f"✓ Ollama available — model '{ollama_status['model']}' ready")
        else:
            logger.warning(
                f"⚠ Ollama running but model '{ollama_status['model']}' not found. "
                f"Run: ollama pull {ollama_status['model']}"
            )
    else:
        logger.warning("⚠ Ollama not available — LLM features will use fallback mode")

    # Check Whisper (don't load model yet — lazy load)
    from app.services.transcription import is_whisper_available

    if is_whisper_available():
        logger.info("✓ Faster-Whisper installed (model will load on first use)")
    else:
        logger.warning("⚠ Faster-Whisper not installed — audio transcription unavailable")

    logger.info("═══════════════════════════════════════════════")
    logger.info("  ✓ Backend ready at http://localhost:8000")
    logger.info("  ✓ API docs at http://localhost:8000/docs")
    logger.info("  ✓ Demo mode always available")
    logger.info("═══════════════════════════════════════════════")

    yield

    logger.info("Talk2Tasks AI — Shutting down")


# ── App ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Talk2Tasks AI",
    description="Local meeting intelligence platform — No cloud APIs required.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for local React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "null",
    ],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)


@app.get("/")
async def root():
    return {
        "app": "Talk2Tasks AI",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
