"""
Talk2Tasks AI — LLM Service (Local Ollama & Free NVIDIA NIM Open-Source Models)
Supports:
1. NVIDIA NIM API (Free trial on build.nvidia.com for Llama 3.3 70B, Qwen 2.5 72B, DeepSeek R1)
2. Local Ollama (100% offline, private)
3. Fallback deterministic heuristic engine (0 external dependencies)
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

import httpx

from app.schemas import (
    ActionItem,
    AnalysisResult,
    AnalysisSource,
    Decision,
    EmailDraft,
    MeetingNotes,
    TaskStatus,
    TranscriptSegment,
)

logger = logging.getLogger(__name__)

# ── Ollama Config ─────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
REQUEST_TIMEOUT = 120.0

# ── NVIDIA NIM Config (build.nvidia.com or custom NIM endpoint) ───────────────
NVIDIA_CONFIG_FILE = Path("./data/nvidia_config.json")

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")


def _load_saved_nvidia_config():
    """Load previously saved NVIDIA NIM settings from data/nvidia_config.json."""
    global NVIDIA_API_KEY, NVIDIA_MODEL, NVIDIA_BASE_URL
    try:
        if NVIDIA_CONFIG_FILE.exists():
            data = json.loads(NVIDIA_CONFIG_FILE.read_text(encoding="utf-8"))
            if data.get("api_key"):
                NVIDIA_API_KEY = data["api_key"].strip()
            if data.get("model"):
                NVIDIA_MODEL = data["model"].strip()
            if data.get("base_url"):
                NVIDIA_BASE_URL = data["base_url"].strip()
            logger.info(f"Loaded persistent NVIDIA config: model={NVIDIA_MODEL}, url={NVIDIA_BASE_URL}")
    except Exception as e:
        logger.warning(f"Could not load NVIDIA config file: {e}")


# Auto-load on module import
_load_saved_nvidia_config()


def set_nvidia_config(
    api_key: str,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
):
    """Update runtime NVIDIA API configuration and persist to disk."""
    global NVIDIA_API_KEY, NVIDIA_MODEL, NVIDIA_BASE_URL
    if api_key and api_key.strip() and api_key.strip() != "KEEP_EXISTING":
        NVIDIA_API_KEY = api_key.strip()
    if model and model.strip():
        NVIDIA_MODEL = model.strip()
    if base_url and base_url.strip():
        NVIDIA_BASE_URL = base_url.strip().rstrip("/")

    # Persist to disk so credentials survive backend/app restarts
    try:
        NVIDIA_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        NVIDIA_CONFIG_FILE.write_text(
            json.dumps(
                {
                    "api_key": NVIDIA_API_KEY,
                    "model": NVIDIA_MODEL,
                    "base_url": NVIDIA_BASE_URL,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        logger.info(f"Persisted NVIDIA configuration to {NVIDIA_CONFIG_FILE}")
    except Exception as e:
        logger.error(f"Failed to persist NVIDIA config: {e}")


def get_nvidia_config() -> dict:
    """Return current NVIDIA configuration."""
    masked_key = ""
    if NVIDIA_API_KEY:
        masked_key = f"nvapi-...{NVIDIA_API_KEY[-4:]}" if len(NVIDIA_API_KEY) > 8 else "Configured"
    return {
        "api_key_set": bool(NVIDIA_API_KEY),
        "api_key_preview": masked_key,
        "model": NVIDIA_MODEL,
        "base_url": NVIDIA_BASE_URL,
    }


async def check_nvidia() -> dict:
    """Check if NVIDIA NIM API key and model connection is valid and responsive."""
    result = {
        "available": False,
        "model": NVIDIA_MODEL,
        "base_url": NVIDIA_BASE_URL,
        "error": None,
    }

    if not NVIDIA_API_KEY:
        result["error"] = "No NVIDIA API key configured. Please enter your key in Settings."
        return result

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Attempt to query /models endpoint
            try:
                resp = await client.get(f"{NVIDIA_BASE_URL}/models", headers=headers)
                if resp.status_code == 200:
                    result["available"] = True
                    return result
                elif resp.status_code in (401, 403):
                    result["error"] = f"Authentication failed ({resp.status_code}): Invalid NVIDIA API key."
                    return result
            except Exception:
                pass

            # 2. Fallback: Test minimal chat completion with the user's specific model
            test_payload = {
                "model": NVIDIA_MODEL,
                "messages": [{"role": "user", "content": "hello"}],
                "max_tokens": 5,
            }
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers=headers,
                json=test_payload,
            )
            if resp.status_code == 200:
                result["available"] = True
            elif resp.status_code in (401, 403):
                result["error"] = "Invalid NVIDIA API key or unauthorized."
            elif resp.status_code == 404:
                result["error"] = f"Model '{NVIDIA_MODEL}' not found on endpoint {NVIDIA_BASE_URL}."
            else:
                err_text = resp.text[:120]
                result["error"] = f"NVIDIA API responded with status {resp.status_code}: {err_text}"
    except Exception as e:
        result["error"] = f"Connection failed: {str(e)}"

    return result


async def check_ollama() -> dict:
    """Check if Ollama is running and the configured model is available."""
    result = {
        "available": False,
        "model": OLLAMA_MODEL,
        "model_loaded": False,
        "error": None,
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                result["available"] = True
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
                model_base = OLLAMA_MODEL.split(":")[0]
                result["model_loaded"] = any(
                    m.startswith(model_base) for m in models
                )
            else:
                result["error"] = f"Ollama returned status {resp.status_code}"
    except httpx.ConnectError:
        result["error"] = "Cannot connect to Ollama. Is it running?"
    except Exception as e:
        result["error"] = str(e)

    return result


async def _query_nvidia(prompt: str, system_prompt: str = "") -> Optional[str]:
    """Query NVIDIA NIM API for open-source model inference."""
    if not NVIDIA_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            headers = {
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            }
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            payload = {
                "model": NVIDIA_MODEL,
                "messages": messages,
                "temperature": 0.2,
                "top_p": 0.9,
                "max_tokens": 2048,
            }

            logger.info(f"Sending prompt to NVIDIA NIM model: {NVIDIA_MODEL}")
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )

            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return content
            else:
                logger.error(f"NVIDIA NIM error {resp.status_code}: {resp.text}")
                return None
    except Exception as e:
        logger.error(f"NVIDIA NIM query failed: {e}")
        return None


async def _query_ollama(prompt: str, system_prompt: str = "") -> Optional[str]:
    """Send a prompt to Ollama and return the response text."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "system": system_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.9,
                    "num_predict": 2048,
                },
            }
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response", "")
            else:
                logger.error(f"Ollama error: {resp.status_code} {resp.text}")
                return None
    except Exception as e:
        logger.error(f"Ollama query failed: {e}")
        return None


async def _query_llm(prompt: str, system_prompt: str = "") -> tuple[Optional[str], Optional[AnalysisSource]]:
    """
    Unified router:
    1. Tries NVIDIA NIM if API key is present.
    2. Tries local Ollama if running.
    3. Returns (None, None) for fallback.
    """
    if NVIDIA_API_KEY:
        res = await _query_nvidia(prompt, system_prompt)
        if res:
            return res, AnalysisSource.NVIDIA_NIM

    ollama_status = await check_ollama()
    if ollama_status["available"]:
        res = await _query_ollama(prompt, system_prompt)
        if res:
            return res, AnalysisSource.LOCAL_LLM

    return None, None


def _extract_json(text: str) -> Optional[dict]:
    """Try to extract a JSON object from LLM response text."""
    if not text:
        return None

    # Clean potential DeepSeek reasoning tags <think> ... </think>
    text_clean = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()

    # Try direct parse
    try:
        return json.loads(text_clean)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in markdown
    patterns = [
        r"```json\s*([\s\S]*?)\s*```",
        r"```\s*([\s\S]*?)\s*```",
        r"\{[\s\S]*\}",
    ]
    for pattern in patterns:
        match = re.search(pattern, text_clean)
        if match:
            try:
                candidate = match.group(1) if match.lastindex else match.group(0)
                return json.loads(candidate)
            except (json.JSONDecodeError, IndexError):
                continue

    return None


async def analyze_transcript(
    segments: list[TranscriptSegment],
) -> Optional[AnalysisResult]:
    """
    Analyze meeting transcript using NVIDIA NIM or local Ollama LLM.
    Returns structured analysis or None for deterministic fallback.
    """
    transcript_text = "\n".join(
        f"[{s.start_time:.1f}s - {s.end_time:.1f}s] {s.speaker or 'Speaker'}: {s.text}"
        for s in segments
    )

    system_prompt = """You are an expert meeting intelligence assistant with comprehensive multi-language support.
You can understand meeting transcripts in ANY language (including English, Hindi, Hinglish, Spanish, French, German, Japanese, Mandarin, Marathi, Gujarati, etc., and mixed/code-switched conversations).

CRITICAL EXTRACTION GUIDELINES:
1. SUMMARY & CONCLUSION:
   - Provide a clear, executive 2-3 sentence summary capturing the meeting's primary objective and final conclusion/trajectory.
2. CONCLUSIONS & DECISIONS:
   - Capture EVERY confirmed conclusion, decision, agreement, consensus, architectural choice, or approval.
   - Look for triggers: "decided", "decision", "conclusion", "agreed", "consensus", "approved", "finalized", "chosen", "will go with", "moving forward with", "faisla", "tay hua", "nishkarsh".
   - Include the exact source quote and mark confirmed=true for agreed items.
3. ACTION ITEMS & DEADLINES:
   - Detect EVERY task, commitment, assignment, or deliverable (e.g. 'I will do X', 'Rahul, please handle Y', 'Amit is assigned to Z', 'Hum kal tak frontend finish karenge').
   - Extract the explicit OWNER (who is responsible). If not named, infer from the speaker.
   - Extract the DEADLINE: Actively extract explicit and relative dates/timeframes ('Friday EOD', 'Tomorrow 5 PM', 'Next Monday', 'Before release', 'Kal tak', 'Parso'). Do NOT leave deadline as null if any timeframe was mentioned!
   - Assign confidence float (0.85 to 1.0) based on directness of commitment.
4. KEY POINTS: 3-6 distinct bullet takeaways.
5. BLOCKERS: Any obstacles, delays, dependencies, or risks raised.
6. OPEN QUESTIONS: Unresolved topics needing follow-up.

Write clean, professional English output while preserving native names and project terms.
You MUST respond with ONLY valid JSON, no markdown intro, no conversation."""

    prompt = f"""Analyze this meeting transcript and return a JSON object with this exact structure:

{{
  "summary": "Concise 2-3 sentence executive summary of the meeting and overall conclusion",
  "key_points": ["Key takeaway 1", "Key takeaway 2"],
  "blockers": ["Obstacle or delay mentioned (or empty if none)"],
  "open_questions": ["Unresolved question (or empty if none)"],
  "decisions": [
    {{
      "description": "Clear conclusion or decision reached (e.g. 'Deploy beta release on Monday')",
      "source_quote": "Exact verbatim quote from discussion",
      "confirmed": true
    }}
  ],
  "action_items": [
    {{
      "task_description": "Specific action item or task to complete (e.g. 'Complete OAuth2 backend endpoints')",
      "owner": "Name of responsible person (e.g. Rahul, Amit) or null",
      "deadline": "Extracted deadline (e.g. 'Friday EOD', 'Tomorrow 5 PM', 'Next Monday') or null",
      "source_quote": "Exact verbatim quote from transcript",
      "confidence": 0.95
    }}
  ]
}}

TRANSCRIPT:
{transcript_text}

Respond with ONLY the JSON object:"""

    response, source = await _query_llm(prompt, system_prompt)
    if not response or not source:
        return None

    data = _extract_json(response)
    if not data:
        logger.error(f"Failed to parse LLM response as JSON. Raw: {response[:300]}")
        return None

    try:
        notes = MeetingNotes(
            summary=data.get("summary", ""),
            key_points=data.get("key_points", []),
            blockers=data.get("blockers", []),
            open_questions=data.get("open_questions", []),
        )

        decisions = []
        for d in data.get("decisions", []):
            decisions.append(
                Decision(
                    description=d.get("description", ""),
                    source_quote=d.get("source_quote"),
                    confirmed=d.get("confirmed", False),
                )
            )

        action_items = []
        for a in data.get("action_items", []):
            action_items.append(
                ActionItem(
                    task_description=a.get("task_description", ""),
                    owner=a.get("owner"),
                    deadline=a.get("deadline"),
                    source_quote=a.get("source_quote"),
                    confidence=min(max(float(a.get("confidence", 0.8)), 0.0), 1.0),
                )
            )

        return AnalysisResult(
            notes=notes,
            decisions=decisions,
            action_items=action_items,
            source=source,
        )
    except Exception as e:
        logger.error(f"Failed to parse structured analysis: {e}")
        return None


async def generate_email_draft(
    notes: MeetingNotes,
    decisions: list[Decision],
    action_items: list[ActionItem],
    title: str = "Meeting",
) -> Optional[EmailDraft]:
    """Generate follow-up email using LLM."""
    decisions_text = "\n".join(
        f"- {d.description} ({'Confirmed' if d.confirmed else 'Tentative'})"
        for d in decisions
    ) or "No decisions recorded."

    tasks_text = "\n".join(
        f"- {a.task_description} -> Owner: {a.owner or 'Unassigned'}, Deadline: {a.deadline or 'TBD'}"
        for a in action_items
    ) or "No action items."

    prompt = f"""Write a professional follow-up email for a meeting titled "{title}".

Meeting Summary: {notes.summary}

Key Decisions:
{decisions_text}

Action Items:
{tasks_text}

Open Questions:
{chr(10).join('- ' + q for q in notes.open_questions) if notes.open_questions else 'None'}

Write a clear, professional email. Return ONLY a JSON object:
{{
  "subject": "Email subject line",
  "greeting": "Hi team,",
  "summary": "Brief recap paragraph",
  "decisions_text": "Decisions section",
  "tasks_text": "Action items section",
  "next_steps": "Next steps section",
  "closing": "Best regards,\\nTeam"
}}"""

    response, _ = await _query_llm(prompt)
    if not response:
        return None

    data = _extract_json(response)
    if not data:
        return None

    try:
        email = EmailDraft(
            subject=data.get("subject", f"Follow-up: {title}"),
            greeting=data.get("greeting", "Hi team,"),
            summary=data.get("summary", notes.summary),
            decisions_text=data.get("decisions_text", decisions_text),
            tasks_text=data.get("tasks_text", tasks_text),
            next_steps=data.get("next_steps", ""),
            closing=data.get("closing", "Best regards"),
        )
        email.full_text = (
            f"Subject: {email.subject}\n\n"
            f"{email.greeting}\n\n"
            f"{email.summary}\n\n"
            f"Decisions:\n{email.decisions_text}\n\n"
            f"Action Items:\n{email.tasks_text}\n\n"
            f"Next Steps:\n{email.next_steps}\n\n"
            f"{email.closing}"
        )
        return email
    except Exception as e:
        logger.error(f"Failed to build email draft: {e}")
        return None


async def answer_meeting_question(
    transcript: list[TranscriptSegment],
    notes: Optional[MeetingNotes],
    decisions: list[Decision],
    action_items: list[ActionItem],
    question: str,
) -> dict:
    """
    Answer conversational questions about the ongoing meeting grounded in current transcript and state.
    Supports queries like:
    - 'What has been discussed so far?'
    - 'What are Rahul's tasks?'
    - 'What deadlines were set?'
    - 'What was decided about the budget?'
    """
    if not transcript:
        return {
            "answer": "No transcript has been captured yet. Start speaking or streaming audio to record meeting discussion.",
            "citations": [],
        }

    # Build grounded context
    recent_segments = transcript[-40:]  # Most recent context
    transcript_text = "\n".join(
        f"[{s.start_time:.1f}s] {s.speaker or 'Speaker'}: {s.text}"
        for s in recent_segments
    )

    decisions_text = "\n".join(f"- {d.description} ({'Confirmed' if d.confirmed else 'Tentative'})" for d in decisions) or "None recorded yet."
    tasks_text = "\n".join(f"- {a.task_description} (Owner: {a.owner or 'Unassigned'}, Due: {a.deadline or 'TBD'})" for a in action_items) or "None recorded yet."

    system_prompt = """You are a helpful, accurate, and concise AI meeting companion with full multi-language support.
You can understand speech, transcripts, and questions in any language (including English, Hindi, Hinglish, Spanish, French, German, Japanese, etc.).
Answer the user's question based STRICTLY and ONLY on the provided meeting transcript, decisions, and action items.
Do not hallucinate or make assumptions. If something was not mentioned, say 'That was not mentioned in the discussion so far.'
Keep answers direct (2-4 sentences). Answer in clear English or in the language asked by the user."""

    prompt = f"""MEETING CONTEXT:
Summary: {notes.summary if notes else 'Ongoing discussion'}

Confirmed Decisions:
{decisions_text}

Action Items:
{tasks_text}

Recent Transcript Excerpt:
{transcript_text}

USER QUESTION:
{question}

Provide a concise, grounded answer based only on the above context:"""

    response, source = await _query_llm(prompt, system_prompt)

    if response:
        # Clean potential think tags
        cleaned = re.sub(r"<think>[\s\S]*?</think>", "", response).strip()
        citations = []
        # Find matching quotes
        for seg in reversed(recent_segments):
            for word in question.lower().split():
                if len(word) > 4 and word in seg.text.lower():
                    citations.append(f'"{seg.text}" ({seg.start_time:.0f}s)')
                    break
            if len(citations) >= 2:
                break
        return {
            "answer": cleaned,
            "citations": citations[:2],
            "sources": citations[:2],
            "confidence": 0.95,
        }

    # Deterministic Fallback Q&A
    q_lower = question.lower()
    citations = []

    # Check for owner/task queries
    if "task" in q_lower or "action" in q_lower or "todo" in q_lower or "who" in q_lower:
        matching_tasks = []
        for t in action_items:
            if not t.owner or t.owner.lower() in q_lower or "all" in q_lower or "what" in q_lower:
                matching_tasks.append(f"{t.task_description} (Owner: {t.owner or 'Unassigned'}, Due: {t.deadline or 'TBD'})")
        if matching_tasks:
            cits = [t.source_quote for t in action_items if t.source_quote][:2]
            return {
                "answer": f"Here are the identified action items:\n" + "\n".join(f"• {m}" for m in matching_tasks[:4]),
                "citations": cits,
                "sources": cits,
                "confidence": 0.90,
            }

    # Check for decision queries
    if "decision" in q_lower or "decided" in q_lower or "agree" in q_lower:
        if decisions:
            cits = [d.source_quote for d in decisions if d.source_quote][:2]
            return {
                "answer": "Here are the confirmed decisions so far:\n" + "\n".join(f"• {d.description}" for d in decisions[:4]),
                "citations": cits,
                "sources": cits,
                "confidence": 0.90,
            }

    # General recap
    if "summary" in q_lower or "discuss" in q_lower or "so far" in q_lower or "what" in q_lower:
        if notes and notes.summary:
            cits = [s.text for s in recent_segments[-2:]]
            return {
                "answer": f"Meeting summary so far: {notes.summary}",
                "citations": cits,
                "sources": cits,
                "confidence": 0.85,
            }

    # Keyword search across transcript
    matched_quotes = []
    keywords = [w for w in re.findall(r"\w+", q_lower) if len(w) > 3 and w not in ('what', 'when', 'where', 'which', 'about', 'have', 'been', 'meeting')]
    for seg in reversed(transcript):
        if any(kw in seg.text.lower() for kw in keywords):
            matched_quotes.append(f'[{seg.speaker or "Speaker"} at {seg.start_time:.0f}s]: "{seg.text}"')
            if len(matched_quotes) >= 3:
                break

    if matched_quotes:
        return {
            "answer": f"Here is what was mentioned regarding your query:\n" + "\n".join(f"• {m}" for m in matched_quotes),
            "citations": matched_quotes[:2],
            "sources": matched_quotes[:2],
            "confidence": 0.80,
        }

    return {
        "answer": f"The topic '{question}' was not explicitly identified in the transcript segments recorded so far.",
        "citations": [],
        "sources": [],
        "confidence": 0.50,
    }


def deterministic_extract_analysis(
    segments: list[TranscriptSegment],
    title: str = "Meeting",
) -> AnalysisResult:
    """
    Extract notes, decisions, and action items deterministically from actual transcript segments.
    Never hallucinates or injects fake canned data.
    """
    if not segments:
        return AnalysisResult(
            notes=MeetingNotes(
                summary="No speech or spoken conversation was detected during this meeting session.",
                key_points=[],
                blockers=[],
                open_questions=[],
            ),
            decisions=[],
            action_items=[],
            source=AnalysisSource.FALLBACK,
        )

    full_text = " ".join(s.text.strip() for s in segments if s.text.strip())
    if not full_text:
        return AnalysisResult(
            notes=MeetingNotes(
                summary="No speech or spoken conversation was detected during this meeting session.",
                key_points=[],
                blockers=[],
                open_questions=[],
            ),
            decisions=[],
            action_items=[],
            source=AnalysisSource.FALLBACK,
        )

    # Extract sentences
    sentences = [s.strip() for s in re.split(r"[.!?]+", full_text) if len(s.strip()) > 5]

    decisions: list[Decision] = []
    action_items: list[ActionItem] = []
    blockers: list[str] = []
    open_questions: list[str] = []

    # Detect questions
    for seg in segments:
        if "?" in seg.text:
            open_questions.append(seg.text.strip())

    for idx, sent in enumerate(sentences):
        lower = sent.lower()

        # 1. Enhanced Decision & Conclusion detection (Multilingual & English)
        decision_triggers = (
            "conclusion", "conclude", "decided", "decision", "agree", "agreed",
            "consensus", "approved", "finalized", "chosen", "will go with",
            "moving forward with", "resolved", "resolution", "settled on",
            "verdict", "outcome", "faisla", "nishkarsh", "tay hua", "tay kiya",
            "final ho gaya", "we conclude", "in conclusion"
        )
        if any(w in lower for w in decision_triggers):
            # Clean conclusion prefix if present
            clean_desc = re.sub(r"^(?:so|therefore|in conclusion|finally|overall),?\s*", "", sent, flags=re.IGNORECASE).strip()
            decisions.append(
                Decision(
                    decision_id=f"dec_{len(decisions)+1:03d}",
                    description=clean_desc,
                    source_quote=sent,
                    confirmed=True,
                )
            )

        # 2. Enhanced Action Item & Deadline detection (Multilingual & English)
        task_triggers = (
            "will", "going to", "shall", "assigned", "responsible", "action item",
            "task", "todo", "take care of", "follow up", "needs to", "has to",
            "must", "please", "karega", "karenge", "karna hai", "dekh lena",
            "zimmadari", "deliver", "review", "complete", "finish", "deploy", "implement"
        )
        if any(w in lower for w in task_triggers):
            # Try to identify owner (from speaker or sentence context)
            owner = None
            owner_match = re.search(r"\b([A-Z][a-z]{2,15})\s+(?:will|is assigned|to handle|must|shall|karega)\b", sent)
            if owner_match:
                owner = owner_match.group(1).title()
            else:
                for seg in segments:
                    if sent in seg.text and seg.speaker:
                        owner = seg.speaker
                        break

            # Try to extract comprehensive deadline
            deadline = None
            deadline_match = re.search(
                r"\b(?:by|due(?: on)?|before|deadline(?: is)?|target(?: date)?)\s+([A-Za-z0-9]+(?:\s+(?:eod|pm|am|morning|evening|week|days?|hours?|[A-Za-z0-9]+)){0,3})",
                sent,
                re.IGNORECASE,
            )
            if deadline_match:
                deadline = deadline_match.group(1).strip().title()
            elif "tomorrow" in lower:
                deadline = "Tomorrow"
            elif "eod" in lower:
                deadline = "End of Day"
            elif "kal tak" in lower:
                deadline = "Tomorrow (Kal Tak)"

            action_items.append(
                ActionItem(
                    task_id=f"task_{len(action_items)+1:03d}",
                    task_description=sent,
                    owner=owner,
                    deadline=deadline,
                    status=TaskStatus.PENDING,
                    source_quote=sent,
                    confidence=0.90 if (owner or deadline) else 0.82,
                )
            )

        # 3. Blocker detection
        elif any(w in lower for w in ("blocked", "blocker", "waiting on", "delay", "issue", "problem", "stuck", "obstacle")):
            blockers.append(sent)

    # Build summary
    summary_sentences = sentences[:3] if len(sentences) >= 3 else sentences
    summary = ". ".join(summary_sentences) + "." if summary_sentences else f"Recorded discussion for {title}."

    notes = MeetingNotes(
        summary=summary,
        key_points=sentences[:5],
        blockers=blockers[:3],
        open_questions=open_questions[:3],
    )

    return AnalysisResult(
        notes=notes,
        decisions=decisions,
        action_items=action_items,
        source=AnalysisSource.FALLBACK,
    )


def deterministic_email_draft(
    title: str,
    notes: MeetingNotes,
    decisions: list[Decision],
    action_items: list[ActionItem],
) -> EmailDraft:
    """Generate follow-up email from extracted notes without hallucinating."""
    if not notes.summary or "No speech" in notes.summary:
        return EmailDraft(
            subject=f"Meeting Recap: {title} (No Speech Detected)",
            greeting="Hi team,",
            summary="No spoken conversation was detected or recorded during this meeting session.",
            decisions_text="None recorded.",
            tasks_text="None recorded.",
            next_steps="Please verify that your audio device or system loopback was active and unmuted.",
            closing="Best regards",
            full_text=(
                f"Subject: Meeting Recap: {title} (No Speech Detected)\n\n"
                "Hi team,\n\n"
                "No spoken conversation was detected or recorded during this meeting session.\n\n"
                "Please verify that your microphone or audio device is active and unmuted for future meetings.\n\n"
                "Best regards"
            ),
        )

    decisions_text = "\n".join(f"• {d.description}" for d in decisions) if decisions else "No formal decisions recorded."
    tasks_text = "\n".join(
        f"• {a.task_description} (Owner: {a.owner or 'Unassigned'}, Due: {a.deadline or 'TBD'})"
        for a in action_items
    ) if action_items else "No action items assigned."

    next_steps = "\n".join(f"• {b}" for b in notes.blockers) if notes.blockers else "Continue scheduled project milestones."

    subject = f"Follow-up: {title} — Summary & Action Items"
    full_text = (
        f"Subject: {subject}\n\n"
        "Hi team,\n\n"
        f"Thanks for your time in today's {title}. Here is a summary of our discussion:\n\n"
        f"{notes.summary}\n\n"
        f"Key Decisions:\n{decisions_text}\n\n"
        f"Action Items:\n{tasks_text}\n\n"
        f"Next Steps & Blockers:\n{next_steps}\n\n"
        "Best regards"
    )

    return EmailDraft(
        subject=subject,
        greeting="Hi team,",
        summary=notes.summary,
        decisions_text=decisions_text,
        tasks_text=tasks_text,
        next_steps=next_steps,
        closing="Best regards",
        full_text=full_text,
    )



