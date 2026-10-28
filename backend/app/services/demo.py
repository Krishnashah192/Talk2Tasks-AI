"""
Talk2Tasks AI — Demo Service
Deterministic demo mode with a scripted product-launch meeting.
Works entirely offline without Ollama, Whisper, or any cloud API.
"""

from __future__ import annotations

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

# ── Scripted Demo Transcript ─────────────────────────────────────────

DEMO_TRANSCRIPT_CHUNKS: list[list[TranscriptSegment]] = [
    # Chunk 1: Opening (0-15s)
    [
        TranscriptSegment(
            id="d001",
            start_time=0.0,
            end_time=5.2,
            text="Alright everyone, thanks for joining. Let's kick off the product launch sync. We have a lot to cover today.",
            speaker="Alex",
        ),
        TranscriptSegment(
            id="d002",
            start_time=5.5,
            end_time=10.8,
            text="Sure, I've got updates on the landing page. We made good progress this week on the design side.",
            speaker="Priya",
        ),
        TranscriptSegment(
            id="d003",
            start_time=11.0,
            end_time=15.0,
            text="Great, and I have the QA testing plan ready to share with the team.",
            speaker="Rahul",
        ),
    ],
    # Chunk 2: Landing page discussion (15-35s)
    [
        TranscriptSegment(
            id="d004",
            start_time=15.5,
            end_time=22.0,
            text="So the main priority is getting the landing page live before the launch. Priya, can you finish the remaining UI components by Thursday?",
            speaker="Alex",
        ),
        TranscriptSegment(
            id="d005",
            start_time=22.5,
            end_time=28.0,
            text="Yes, I'll finish the UI implementation by Thursday afternoon. The hero section and the pricing cards are almost done.",
            speaker="Priya",
        ),
        TranscriptSegment(
            id="d006",
            start_time=28.5,
            end_time=35.0,
            text="Perfect. Rahul, can you do a thorough review of the landing page on Friday morning before we go live?",
            speaker="Alex",
        ),
    ],
    # Chunk 3: Review and mobile (35-55s)
    [
        TranscriptSegment(
            id="d007",
            start_time=35.5,
            end_time=40.0,
            text="Absolutely, I'll block Friday morning for the full review. I'll test all the interactive elements and the form submissions.",
            speaker="Rahul",
        ),
        TranscriptSegment(
            id="d008",
            start_time=40.5,
            end_time=47.0,
            text="One thing we need to decide — are we supporting mobile layout for the initial launch, or can that come in a follow-up sprint?",
            speaker="Alex",
        ),
        TranscriptSegment(
            id="d009",
            start_time=47.5,
            end_time=55.0,
            text="I think we should include mobile for launch. I can handle the responsive layout alongside the main UI work. It won't add more than half a day.",
            speaker="Priya",
        ),
    ],
    # Chunk 4: Testing and checklist (55-75s)
    [
        TranscriptSegment(
            id="d010",
            start_time=55.5,
            end_time=62.0,
            text="That sounds good. So we're agreed — mobile responsive layout is included in the initial launch. Priya takes that on.",
            speaker="Alex",
        ),
        TranscriptSegment(
            id="d011",
            start_time=62.5,
            end_time=69.0,
            text="Rahul, can you also prepare a testing checklist so we have a standard process for launch verification?",
            speaker="Alex",
        ),
        TranscriptSegment(
            id="d012",
            start_time=69.5,
            end_time=75.0,
            text="Sure, I can put together the checklist. I'm not sure when I'll have it done though — maybe early next week?",
            speaker="Rahul",
        ),
    ],
    # Chunk 5: Closing and next meeting (75-95s)
    [
        TranscriptSegment(
            id="d013",
            start_time=75.5,
            end_time=82.0,
            text="That's fine. No hard deadline on the checklist, but sooner is better. We'll track it as a to-do.",
            speaker="Alex",
        ),
        TranscriptSegment(
            id="d014",
            start_time=82.5,
            end_time=88.0,
            text="One open question — have we finalized the analytics integration? I wasn't sure if we're using Plausible or PostHog.",
            speaker="Priya",
        ),
        TranscriptSegment(
            id="d015",
            start_time=88.5,
            end_time=95.0,
            text="Good point, we haven't decided yet. Let's table that for the next meeting. Speaking of which, let's reconvene Monday at 10 AM. Thanks everyone!",
            speaker="Alex",
        ),
    ],
]

# Flatten for full transcript
DEMO_FULL_TRANSCRIPT: list[TranscriptSegment] = [
    seg for chunk in DEMO_TRANSCRIPT_CHUNKS for seg in chunk
]

# ── Deterministic Analysis Results ───────────────────────────────────

DEMO_NOTES = MeetingNotes(
    summary=(
        "Product launch sync meeting with Alex, Priya, and Rahul. "
        "The team discussed landing page completion, mobile layout support, "
        "QA review scheduling, and testing checklist preparation. "
        "Key deadlines were set for Thursday and Friday."
    ),
    key_points=[
        "Landing page UI completion is the top priority for launch.",
        "Mobile responsive layout will be included in the initial launch.",
        "Full QA review is scheduled for Friday morning.",
        "A testing checklist will be created for launch verification.",
        "Next team meeting is scheduled for Monday at 10 AM.",
    ],
    blockers=[
        "Analytics integration decision is pending (Plausible vs PostHog).",
    ],
    open_questions=[
        "Which analytics platform should be used — Plausible or PostHog?",
        "When exactly will Rahul complete the testing checklist?",
    ],
)

DEMO_DECISIONS = [
    Decision(
        decision_id="dec_001",
        description="Mobile responsive layout will be included in the initial product launch.",
        source_quote="I think we should include mobile for launch. I can handle the responsive layout alongside the main UI work.",
        confirmed=True,
    ),
    Decision(
        decision_id="dec_002",
        description="Full QA review of the landing page will happen Friday morning before go-live.",
        source_quote="Rahul, can you do a thorough review of the landing page on Friday morning before we go live?",
        confirmed=True,
    ),
    Decision(
        decision_id="dec_003",
        description="Analytics integration decision is deferred to the next meeting.",
        source_quote="Let's table that for the next meeting.",
        confirmed=True,
    ),
    Decision(
        decision_id="dec_004",
        description="Team will reconvene Monday at 10 AM.",
        source_quote="Let's reconvene Monday at 10 AM.",
        confirmed=True,
    ),
]

DEMO_ACTION_ITEMS = [
    ActionItem(
        task_id="task_001",
        task_description="Finish the landing page UI implementation (hero section and pricing cards).",
        owner="Priya",
        deadline="Thursday afternoon",
        status=TaskStatus.PENDING,
        source_quote="Yes, I'll finish the UI implementation by Thursday afternoon.",
        confidence=0.96,
    ),
    ActionItem(
        task_id="task_002",
        task_description="Conduct a full QA review of the landing page (interactive elements and form submissions).",
        owner="Rahul",
        deadline="Friday morning",
        status=TaskStatus.PENDING,
        source_quote="Absolutely, I'll block Friday morning for the full review.",
        confidence=0.95,
    ),
    ActionItem(
        task_id="task_003",
        task_description="Complete the mobile responsive layout for the landing page.",
        owner="Priya",
        deadline="Thursday (alongside main UI work)",
        status=TaskStatus.PENDING,
        source_quote="I can handle the responsive layout alongside the main UI work.",
        confidence=0.92,
    ),
    ActionItem(
        task_id="task_004",
        task_description="Prepare a testing checklist for launch verification.",
        owner="Rahul",
        deadline=None,
        status=TaskStatus.PENDING,
        source_quote="Sure, I can put together the checklist. I'm not sure when I'll have it done though — maybe early next week?",
        confidence=0.80,
    ),
]

DEMO_EMAIL = EmailDraft(
    subject="Follow-up: Product Launch Sync — Action Items & Decisions",
    greeting="Hi team,",
    summary=(
        "Thanks for today's product launch sync. Here's a recap of what we discussed and the next steps."
    ),
    decisions_text=(
        "• Mobile responsive layout will be included in the initial launch (Priya to handle).\n"
        "• Full QA review scheduled for Friday morning before go-live.\n"
        "• Analytics integration decision deferred to next meeting.\n"
        "• Next meeting: Monday at 10 AM."
    ),
    tasks_text=(
        "• Priya — Finish landing page UI by Thursday afternoon.\n"
        "• Priya — Complete mobile responsive layout by Thursday.\n"
        "• Rahul — Full QA review of landing page on Friday morning.\n"
        "• Rahul — Prepare testing checklist (timeline TBD)."
    ),
    next_steps=(
        "1. Priya completes UI + mobile layout by Thursday.\n"
        "2. Rahul reviews the page Friday morning.\n"
        "3. We decide on analytics (Plausible vs PostHog) at Monday's meeting.\n"
        "4. Launch after Friday review if all checks pass."
    ),
    closing="Let me know if I missed anything. See you all on Monday!\n\nBest,\nAlex",
    full_text="",  # Will be composed below
)

DEMO_EMAIL.full_text = (
    f"Subject: {DEMO_EMAIL.subject}\n\n"
    f"{DEMO_EMAIL.greeting}\n\n"
    f"{DEMO_EMAIL.summary}\n\n"
    f"Key Decisions:\n{DEMO_EMAIL.decisions_text}\n\n"
    f"Action Items:\n{DEMO_EMAIL.tasks_text}\n\n"
    f"Next Steps:\n{DEMO_EMAIL.next_steps}\n\n"
    f"{DEMO_EMAIL.closing}"
)


def get_demo_analysis() -> AnalysisResult:
    """Return the deterministic demo analysis result."""
    return AnalysisResult(
        notes=DEMO_NOTES,
        decisions=DEMO_DECISIONS,
        action_items=DEMO_ACTION_ITEMS,
        source=AnalysisSource.DEMO,
    )


def get_demo_email() -> EmailDraft:
    """Return the deterministic demo email draft."""
    return DEMO_EMAIL


def get_demo_chunks() -> list[list[TranscriptSegment]]:
    """Return the demo transcript in timed chunks for progressive rendering."""
    return DEMO_TRANSCRIPT_CHUNKS


def get_demo_full_transcript() -> list[TranscriptSegment]:
    """Return the full demo transcript."""
    return DEMO_FULL_TRANSCRIPT
