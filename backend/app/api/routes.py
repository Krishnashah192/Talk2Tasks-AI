"""
Talk2Tasks AI — API Routes
All REST endpoints for the meeting intelligence platform.
"""

from __future__ import annotations

import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app import database as db
from app.schemas import (
    ActionItemUpdate,
    AnalysisResult,
    AnalysisSource,
    EmailDraft,
    HealthResponse,
    MeetingCreate,
    MeetingNotes,
    MeetingResponse,
    MeetingStatus,
    TranscriptInput,
    TranscriptSegment,
)
from app.services import demo as demo_service
from app.services import detector as detector_service
from app.services import llm as llm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./data/uploads"))
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024


# ── Health ─────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check system health: NVIDIA NIM, Ollama, Whisper, database."""
    ollama_status = await llm_service.check_ollama()
    nvidia_status = await llm_service.check_nvidia()

    # Check whisper
    from app.services import transcription

    whisper_ok = transcription.is_whisper_available()
    whisper_model = transcription.get_loaded_model_info()

    # Check DB
    db_ok = True
    try:
        await db.list_meetings()
    except Exception:
        db_ok = False

    return HealthResponse(
        status="ok" if db_ok else "degraded",
        ollama_available=ollama_status["available"] and ollama_status["model_loaded"],
        ollama_model=ollama_status["model"] if ollama_status["model_loaded"] else None,
        nvidia_available=nvidia_status["available"],
        nvidia_model=nvidia_status["model"] if nvidia_status["available"] else None,
        whisper_available=whisper_ok,
        whisper_model=whisper_model,
        database_ok=db_ok,
    )


class NvidiaConfigRequest(BaseModel):
    api_key: str
    model: Optional[str] = "meta/llama-3.3-70b-instruct"
    base_url: Optional[str] = None


@router.get("/settings/nvidia")
async def get_nvidia_settings():
    """Get current NVIDIA NIM API configuration."""
    cfg = llm_service.get_nvidia_config()
    check = await llm_service.check_nvidia()
    return {
        **cfg,
        "valid": check["available"],
        "error": check.get("error"),
    }


@router.post("/settings/nvidia")
async def update_nvidia_settings(req: NvidiaConfigRequest):
    """Save and test NVIDIA NIM API key with custom model and optional base URL."""
    llm_service.set_nvidia_config(req.api_key, req.model, req.base_url)
    check = await llm_service.check_nvidia()
    return {
        "success": check["available"],
        "model": llm_service.NVIDIA_MODEL,
        "base_url": llm_service.NVIDIA_BASE_URL,
        "error": check.get("error"),
        "message": f"Connected to NVIDIA NIM ({llm_service.NVIDIA_MODEL}) successfully!" if check["available"] else (check.get("error") or "Failed to connect to NVIDIA"),
    }


# ── Demo Mode ──────────────────────────────────────────────────────────

@router.get("/demo")
async def get_demo_data():
    """Return demo transcript chunks and analysis for offline demonstration."""
    chunks = demo_service.get_demo_chunks()
    analysis = demo_service.get_demo_analysis()
    email = demo_service.get_demo_email()

    return {
        "chunks": [[seg.model_dump() for seg in chunk] for chunk in chunks],
        "analysis": analysis.model_dump(),
        "email": email.model_dump(),
        "total_segments": sum(len(c) for c in chunks),
        "total_duration": max(
            seg.end_time for chunk in chunks for seg in chunk
        ),
    }


# ── Meetings CRUD ──────────────────────────────────────────────────────

@router.post("/meetings", response_model=MeetingResponse, status_code=201)
async def create_meeting(data: MeetingCreate):
    """Create a new meeting session."""
    meeting = await db.create_meeting(title=data.title)
    return meeting


@router.get("/meetings", response_model=list[MeetingResponse])
async def list_meetings():
    """List all meetings ordered by most recent first."""
    return await db.list_meetings()


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str):
    """Get a specific meeting by ID."""
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str):
    """Delete a meeting and its data."""
    deleted = await db.delete_meeting(meeting_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"deleted": True, "id": meeting_id}


# ── Transcript ─────────────────────────────────────────────────────────

@router.post("/meetings/{meeting_id}/transcript", response_model=MeetingResponse)
async def add_transcript(meeting_id: str, data: TranscriptInput):
    """Add or append transcript segments to a meeting."""
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Append segments (deduplicate by ID)
    existing_ids = {s.id for s in meeting.transcript}
    new_segments = [s for s in data.segments if s.id not in existing_ids]
    all_segments = meeting.transcript + new_segments

    # Update duration
    duration = max((s.end_time for s in all_segments), default=0.0)

    updated = await db.update_meeting(
        meeting_id,
        transcript=all_segments,
        status=MeetingStatus.RECORDING,
        duration_seconds=duration,
    )
    return updated


# ── Analysis ───────────────────────────────────────────────────────────

@router.post("/meetings/{meeting_id}/analyze", response_model=MeetingResponse)
async def analyze_meeting(meeting_id: str, use_demo: bool = Query(False)):
    """Analyze the meeting transcript using the local LLM or demo fallback."""
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not meeting.transcript:
        raise HTTPException(status_code=400, detail="No transcript to analyze")

    await db.update_meeting(meeting_id, status=MeetingStatus.PROCESSING)

    result: Optional[AnalysisResult] = None

    if use_demo:
        result = demo_service.get_demo_analysis()
    else:
        # Try local LLM first
        try:
            result = await llm_service.analyze_transcript(meeting.transcript)
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")

    if result is None:
        # Fallback to deterministic extraction from the actual transcript
        result = llm_service.deterministic_extract_analysis(meeting.transcript, meeting.title)

    updated = await db.update_meeting(
        meeting_id,
        status=MeetingStatus.COMPLETED,
        notes=result.notes,
        decisions=result.decisions,
        action_items=result.action_items,
        analysis_source=result.source,
    )
    return updated


# ── Task Editing ───────────────────────────────────────────────────────

@router.patch("/meetings/{meeting_id}/tasks/{task_id}")
async def update_task(meeting_id: str, task_id: str, data: ActionItemUpdate):
    """Update a specific action item within a meeting."""
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    updated_item = await db.update_task(
        meeting_id,
        task_id,
        task_description=data.task_description,
        owner=data.owner,
        deadline=data.deadline,
        status=data.status,
    )

    if not updated_item:
        raise HTTPException(status_code=404, detail="Task not found")

    return updated_item.model_dump()


# ── Email Draft ────────────────────────────────────────────────────────

@router.post("/meetings/{meeting_id}/email-draft", response_model=MeetingResponse)
async def generate_email(meeting_id: str, use_demo: bool = Query(False)):
    """Generate a follow-up email draft using the local LLM or demo."""
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    email: Optional[EmailDraft] = None

    if use_demo:
        email = demo_service.get_demo_email()
    else:
        notes = meeting.notes or MeetingNotes()
        try:
            email = await llm_service.generate_email_draft(
                meeting.title, notes, meeting.decisions, meeting.action_items
            )
        except Exception as e:
            logger.error(f"Email generation failed: {e}")

    if email is None:
        email = llm_service.deterministic_email_draft(
            title=meeting.title,
            notes=notes,
            decisions=meeting.decisions,
            action_items=meeting.action_items,
        )

    updated = await db.update_meeting(meeting_id, email_draft=email)
    return updated


# ── Audio Upload & Transcription ───────────────────────────────────────

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Upload an audio file and transcribe it using Faster-Whisper.
    Returns transcript segments.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate file extension
    allowed_extensions = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".mp4", ".wma"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(sorted(allowed_extensions))}",
        )

    # Check file size (read content_length header or read data)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Sanitize filename
    safe_name = f"{uuid.uuid4().hex[:12]}{ext}"
    file_path = UPLOAD_DIR / safe_name

    try:
        # Save uploaded file
        total_size = 0
        with open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    f.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum: {MAX_UPLOAD_SIZE // (1024*1024)} MB",
                    )
                f.write(chunk)

        # Transcribe
        from app.services import transcription

        if not transcription.is_whisper_available():
            raise HTTPException(
                status_code=503,
                detail="Faster-Whisper is not installed. Run the setup script first.",
            )

        # Ensure model is loaded
        loaded = await transcription.load_model()
        if not loaded:
            raise HTTPException(
                status_code=503,
                detail="Failed to load Whisper model. Check setup and available memory.",
            )

        segments, lang_info = await transcription.transcribe_audio_with_info(str(file_path))

        return {
            "filename": file.filename,
            "segments": [s.model_dump() for s in segments],
            "segment_count": len(segments),
            "detected_language": lang_info.get("language_name") or lang_info.get("language"),
            "detected_language_code": lang_info.get("language"),
            "detected_language_probability": lang_info.get("probability"),
        }

    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        # Clean up uploaded file
        file_path.unlink(missing_ok=True)


# ── Export ─────────────────────────────────────────────────────────────

@router.get("/meetings/{meeting_id}/export")
async def export_meeting(meeting_id: str, format: str = Query("markdown")):
    """Export meeting data as Markdown or plain text."""
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    lines = [
        f"# {meeting.title}",
        f"Created: {meeting.created_at}",
        f"Duration: {meeting.duration_seconds:.0f}s",
        "",
    ]

    # Transcript
    lines.append("## Transcript")
    if meeting.transcript:
        for seg in meeting.transcript:
            speaker = seg.speaker or "Speaker"
            lines.append(f"[{seg.start_time:.1f}s] **{speaker}**: {seg.text}")
    else:
        lines.append("_No transcript available._")
    lines.append("")

    # Notes
    if meeting.notes:
        lines.append("## Meeting Notes")
        lines.append(f"**Summary:** {meeting.notes.summary}")
        if meeting.notes.key_points:
            lines.append("\n**Key Points:**")
            for p in meeting.notes.key_points:
                lines.append(f"- {p}")
        if meeting.notes.blockers:
            lines.append("\n**Blockers:**")
            for b in meeting.notes.blockers:
                lines.append(f"- ⚠️ {b}")
        if meeting.notes.open_questions:
            lines.append("\n**Open Questions:**")
            for q in meeting.notes.open_questions:
                lines.append(f"- ❓ {q}")
        lines.append("")

    # Decisions
    if meeting.decisions:
        lines.append("## Decisions")
        for d in meeting.decisions:
            status = "✅ Confirmed" if d.confirmed else "🔄 Tentative"
            lines.append(f"- [{status}] {d.description}")
            if d.source_quote:
                lines.append(f'  > "{d.source_quote}"')
        lines.append("")

    # Action Items
    if meeting.action_items:
        lines.append("## Action Items")
        lines.append("| Task | Owner | Deadline | Status |")
        lines.append("|------|-------|----------|--------|")
        for a in meeting.action_items:
            lines.append(
                f"| {a.task_description} | {a.owner or 'Unassigned'} | {a.deadline or 'TBD'} | {a.status.value} |"
            )
        lines.append("")

    # Email Draft
    if meeting.email_draft:
        lines.append("## Follow-up Email Draft")
        lines.append(meeting.email_draft.full_text)
        lines.append("")

    # Source
    if meeting.analysis_source:
        lines.append(f"---\n_Analysis source: {meeting.analysis_source.value}_")

    content = "\n".join(lines)
    return PlainTextResponse(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{meeting.title}.md"'},
    )


# ── Live Meeting Assistant Endpoints ────────────────────────────────────

@router.get("/detect-meetings")
async def detect_live_meetings():
    """Detect potential Google Meet, Zoom, Teams, or Webex sessions."""
    detections = detector_service.detect_windows_meetings()
    return {
        "detections": [d.model_dump() for d in detections],
        "count": len(detections),
    }


class QuestionRequest(BaseModel):
    question: str


@router.post("/meetings/{meeting_id}/ask")
async def ask_meeting_question(meeting_id: str, req: QuestionRequest):
    """Answer conversational questions grounded strictly in the meeting transcript and extracted state."""
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await llm_service.answer_meeting_question(
        transcript=meeting.transcript,
        notes=meeting.notes,
        decisions=meeting.decisions,
        action_items=meeting.action_items,
        question=req.question,
    )
    return result


@router.post("/meetings/{meeting_id}/audio-stream")
async def process_live_audio_chunk(
    meeting_id: str,
    file: UploadFile = File(...),
    offset_seconds: float = Query(0.0),
):
    """
    Process an incremental audio chunk (e.g., 5-10 second slice from WASAPI loopback or mic).
    Transcribes with Faster-Whisper and appends timestamped segments to the meeting.
    """
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    from app.services import transcription

    # Save audio slice to temporary file with matching audio extension
    content_type = file.content_type or ""
    filename = file.filename or ""
    if "webm" in content_type or filename.endswith(".webm"):
        ext = ".webm"
    elif "ogg" in content_type or filename.endswith(".ogg"):
        ext = ".ogg"
    elif "mp4" in content_type or filename.endswith(".mp4"):
        ext = ".mp4"
    else:
        ext = ".wav"

    temp_dir = Path("./data/temp_chunks")
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / f"chunk_{meeting_id}_{uuid.uuid4().hex[:6]}{ext}"

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Transcribe with Faster-Whisper with automatic multi-language detection
        segments, lang_info = await transcription.transcribe_audio_with_info(str(temp_path))

        # Adjust timestamps by chunk offset
        adjusted_segments = []
        for seg in segments:
            adjusted_segments.append(
                TranscriptSegment(
                    start_time=round(seg.start_time + offset_seconds, 2),
                    end_time=round(seg.end_time + offset_seconds, 2),
                    text=seg.text,
                    speaker=seg.speaker,
                )
            )

        # Store in database
        updated = await db.add_transcript_segments(meeting_id, adjusted_segments)

        return {
            "new_segments": [s.model_dump() for s in adjusted_segments],
            "total_segments": len(updated.transcript) if updated else 0,
            "duration": updated.duration_seconds if updated else 0,
            "detected_language": lang_info.get("language_name") or lang_info.get("language"),
            "detected_language_code": lang_info.get("language"),
            "detected_language_probability": lang_info.get("probability"),
        }
    except Exception as e:
        logger.error(f"Live audio chunk transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)


@router.post("/meetings/{meeting_id}/complete-live")
async def complete_live_meeting(meeting_id: str):
    """
    Finalize a live meeting session:
    Reconciles all transcript segments, generates final notes, decisions, tasks, and follow-up email.
    """
    meeting = await db.get_meeting(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    has_transcript = bool(meeting.transcript and len(meeting.transcript) > 0)
    analyzed = None

    if has_transcript:
        try:
            analyzed = await llm_service.analyze_transcript(meeting.transcript)
        except Exception as e:
            logger.error(f"Live LLM analysis failed: {e}")
        if not analyzed:
            analyzed = llm_service.deterministic_extract_analysis(meeting.transcript, meeting.title)
    else:
        # Honest empty state: no speech was detected
        analyzed = llm_service.deterministic_extract_analysis([], meeting.title)

    # Generate follow-up email
    email = None
    if has_transcript and analyzed.notes.summary and "No speech" not in analyzed.notes.summary:
        try:
            email = await llm_service.generate_email_draft(
                notes=analyzed.notes,
                decisions=analyzed.decisions,
                action_items=analyzed.action_items,
                title=meeting.title,
            )
        except Exception as e:
            logger.error(f"Live email generation failed: {e}")

    if not email:
        email = llm_service.deterministic_email_draft(
            title=meeting.title,
            notes=analyzed.notes,
            decisions=analyzed.decisions,
            action_items=analyzed.action_items,
        )

    # Update meeting to completed
    final_meeting = await db.update_meeting(
        meeting_id=meeting_id,
        status=MeetingStatus.COMPLETED,
        notes=analyzed.notes,
        decisions=analyzed.decisions,
        action_items=analyzed.action_items,
        email_draft=email,
        analysis_source=analyzed.source,
    )

    return final_meeting
