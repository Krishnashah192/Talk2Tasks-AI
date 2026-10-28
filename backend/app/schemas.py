"""
Talk2Tasks AI — Pydantic Schemas
Structured models for meetings, transcripts, tasks, decisions, and emails.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────

class MeetingStatus(str, Enum):
    IDLE = "idle"
    RECORDING = "recording"
    PAUSED = "paused"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AnalysisSource(str, Enum):
    LOCAL_LLM = "local_llm"
    NVIDIA_NIM = "nvidia_nim"
    DEMO = "demo"
    FALLBACK = "fallback"


# ── Transcript ─────────────────────────────────────────────────────────

class TranscriptSegment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    start_time: float
    end_time: float
    text: str
    speaker: Optional[str] = None


class TranscriptInput(BaseModel):
    segments: list[TranscriptSegment]


# ── Notes ──────────────────────────────────────────────────────────────

class MeetingNotes(BaseModel):
    summary: str = ""
    key_points: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)


# ── Decisions ──────────────────────────────────────────────────────────

class Decision(BaseModel):
    decision_id: str = Field(default_factory=lambda: f"dec_{uuid.uuid4().hex[:6]}")
    description: str
    source_quote: Optional[str] = None
    confirmed: bool = False


# ── Action Items ───────────────────────────────────────────────────────

class ActionItem(BaseModel):
    task_id: str = Field(default_factory=lambda: f"task_{uuid.uuid4().hex[:6]}")
    task_description: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    source_quote: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ActionItemUpdate(BaseModel):
    task_description: Optional[str] = None
    owner: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[TaskStatus] = None


# ── Email Draft ────────────────────────────────────────────────────────

class EmailDraft(BaseModel):
    subject: str = ""
    greeting: str = ""
    summary: str = ""
    decisions_text: str = ""
    tasks_text: str = ""
    next_steps: str = ""
    closing: str = ""
    full_text: str = ""


# ── Meeting ────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class MeetingResponse(BaseModel):
    id: str
    title: str
    status: MeetingStatus
    is_demo: bool = False
    created_at: str
    updated_at: str
    duration_seconds: float = 0.0
    transcript: list[TranscriptSegment] = Field(default_factory=list)
    notes: Optional[MeetingNotes] = None
    decisions: list[Decision] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list)
    email_draft: Optional[EmailDraft] = None
    analysis_source: Optional[AnalysisSource] = None


class AnalysisResult(BaseModel):
    notes: MeetingNotes
    decisions: list[Decision]
    action_items: list[ActionItem]
    source: AnalysisSource


class HealthResponse(BaseModel):
    status: str
    ollama_available: bool
    ollama_model: Optional[str] = None
    nvidia_available: bool = False
    nvidia_model: Optional[str] = None
    whisper_available: bool
    whisper_model: Optional[str] = None
    database_ok: bool
