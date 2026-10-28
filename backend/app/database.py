"""
Talk2Tasks AI — SQLite Database Layer
Async SQLite storage for meetings, transcripts, analysis results.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiosqlite

from app.schemas import (
    ActionItem,
    AnalysisSource,
    Decision,
    EmailDraft,
    MeetingNotes,
    MeetingResponse,
    MeetingStatus,
    TaskStatus,
    TranscriptSegment,
)

DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/talk2tasks.db")


async def get_db_path() -> str:
    """Ensure data directory exists and return database path."""
    db_path = Path(DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return str(db_path)


async def init_db():
    """Create tables if they don't exist."""
    db_path = await get_db_path()
    async with aiosqlite.connect(db_path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'idle',
                is_demo INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                duration_seconds REAL NOT NULL DEFAULT 0.0,
                transcript_json TEXT NOT NULL DEFAULT '[]',
                notes_json TEXT,
                decisions_json TEXT NOT NULL DEFAULT '[]',
                action_items_json TEXT NOT NULL DEFAULT '[]',
                email_draft_json TEXT,
                analysis_source TEXT
            )
        """)
        await db.commit()


async def create_meeting(title: str, is_demo: bool = False) -> MeetingResponse:
    """Create a new meeting record."""
    db_path = await get_db_path()
    meeting_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """INSERT INTO meetings (id, title, status, is_demo, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (meeting_id, title, MeetingStatus.IDLE.value, int(is_demo), now, now),
        )
        await db.commit()

    return MeetingResponse(
        id=meeting_id,
        title=title,
        status=MeetingStatus.IDLE,
        is_demo=is_demo,
        created_at=now,
        updated_at=now,
    )


async def get_meeting(meeting_id: str) -> Optional[MeetingResponse]:
    """Retrieve a meeting by ID."""
    db_path = await get_db_path()
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return _row_to_meeting(row)


async def list_meetings() -> list[MeetingResponse]:
    """List all meetings ordered by creation time descending."""
    db_path = await get_db_path()
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM meetings ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [_row_to_meeting(row) for row in rows]


async def update_meeting(
    meeting_id: str,
    *,
    status: Optional[MeetingStatus] = None,
    transcript: Optional[list[TranscriptSegment]] = None,
    notes: Optional[MeetingNotes] = None,
    decisions: Optional[list[Decision]] = None,
    action_items: Optional[list[ActionItem]] = None,
    email_draft: Optional[EmailDraft] = None,
    analysis_source: Optional[AnalysisSource] = None,
    duration_seconds: Optional[float] = None,
) -> Optional[MeetingResponse]:
    """Update specific fields of a meeting."""
    db_path = await get_db_path()
    now = datetime.now(timezone.utc).isoformat()

    updates = ["updated_at = ?"]
    values: list = [now]

    if status is not None:
        updates.append("status = ?")
        values.append(status.value)
    if transcript is not None:
        updates.append("transcript_json = ?")
        values.append(json.dumps([s.model_dump() for s in transcript]))
    if notes is not None:
        updates.append("notes_json = ?")
        values.append(json.dumps(notes.model_dump()))
    if decisions is not None:
        updates.append("decisions_json = ?")
        values.append(json.dumps([d.model_dump() for d in decisions]))
    if action_items is not None:
        updates.append("action_items_json = ?")
        values.append(json.dumps([a.model_dump() for a in action_items]))
    if email_draft is not None:
        updates.append("email_draft_json = ?")
        values.append(json.dumps(email_draft.model_dump()))
    if analysis_source is not None:
        updates.append("analysis_source = ?")
        values.append(analysis_source.value)
    if duration_seconds is not None:
        updates.append("duration_seconds = ?")
        values.append(duration_seconds)

    values.append(meeting_id)

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            f"UPDATE meetings SET {', '.join(updates)} WHERE id = ?",
            values,
        )
        await db.commit()

    return await get_meeting(meeting_id)


async def update_task(meeting_id: str, task_id: str, **kwargs) -> Optional[ActionItem]:
    """Update a specific task within a meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        return None

    updated_item = None
    for item in meeting.action_items:
        if item.task_id == task_id:
            for key, value in kwargs.items():
                if value is not None and hasattr(item, key):
                    setattr(item, key, value)
            updated_item = item
            break

    if updated_item:
        await update_meeting(meeting_id, action_items=meeting.action_items)

    return updated_item


async def add_transcript_segments(
    meeting_id: str,
    new_segments: list[TranscriptSegment],
) -> Optional[MeetingResponse]:
    """Append new transcript segments to an existing meeting."""
    meeting = await get_meeting(meeting_id)
    if not meeting:
        return None

    existing_ids = {s.id for s in meeting.transcript}
    unique_new = [s for s in new_segments if s.id not in existing_ids]
    all_segments = meeting.transcript + unique_new
    duration = max((s.end_time for s in all_segments), default=meeting.duration_seconds)

    return await update_meeting(
        meeting_id,
        transcript=all_segments,
        status=MeetingStatus.RECORDING,
        duration_seconds=duration,
    )


async def delete_meeting(meeting_id: str) -> bool:
    """Delete a meeting and its data."""
    db_path = await get_db_path()
    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
        await db.commit()
        return cursor.rowcount > 0


def _row_to_meeting(row) -> MeetingResponse:
    """Convert a database row to a MeetingResponse."""
    transcript_data = json.loads(row["transcript_json"] or "[]")
    transcript = [TranscriptSegment(**s) for s in transcript_data]

    notes_data = json.loads(row["notes_json"]) if row["notes_json"] else None
    notes = MeetingNotes(**notes_data) if notes_data else None

    decisions_data = json.loads(row["decisions_json"] or "[]")
    decisions = [Decision(**d) for d in decisions_data]

    action_items_data = json.loads(row["action_items_json"] or "[]")
    action_items = [ActionItem(**a) for a in action_items_data]

    email_data = json.loads(row["email_draft_json"]) if row["email_draft_json"] else None
    email_draft = EmailDraft(**email_data) if email_data else None

    analysis_source = (
        AnalysisSource(row["analysis_source"]) if row["analysis_source"] else None
    )

    return MeetingResponse(
        id=row["id"],
        title=row["title"],
        status=MeetingStatus(row["status"]),
        is_demo=bool(row["is_demo"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        duration_seconds=row["duration_seconds"],
        transcript=transcript,
        notes=notes,
        decisions=decisions,
        action_items=action_items,
        email_draft=email_draft,
        analysis_source=analysis_source,
    )
