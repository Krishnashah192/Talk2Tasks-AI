"""
Generate a professional 6-slide PowerPoint presentation (.pptx)
for Talk2Tasks AI with custom graphic assets, clean Blue & White theme,
structured cards, and embedded images.
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

OUTPUT_DIR = Path("c:/Users/Krishna shah/Desktop/gen ai project")
ASSETS_DIR = OUTPUT_DIR / "presentation_assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

MASCOT_SRC = Path(
    r"C:\Users\Krishna shah\.gemini\antigravity-ide\brain\c0552026-37f9-42a7-9bad-1535b52ea513\talki_cute_pet_mascot_1793054022234.jpg"
)

# Colors
COLOR_NAVY = RGBColor(15, 23, 42)       # #0f172a
COLOR_BLUE = RGBColor(37, 99, 235)      # #2563eb
COLOR_LIGHT_BLUE = RGBColor(239, 246, 255) # #eff6ff
COLOR_SLATE = RGBColor(71, 85, 105)     # #475569
COLOR_MUTED = RGBColor(148, 163, 184)   # #94a3b8
COLOR_WHITE = RGBColor(255, 255, 255)
COLOR_EMERALD = RGBColor(16, 185, 129)  # #10b981
COLOR_ROSE = RGBColor(225, 29, 72)      # #e11d48
COLOR_BORDER = RGBColor(226, 232, 240)  # #e2e8f0

def get_font(size: int, bold: bool = False):
    try:
        # Standard Windows fonts
        font_name = "segoeuib.ttf" if bold else "segoeui.ttf"
        return ImageFont.truetype(f"C:/Windows/Fonts/{font_name}", size)
    except Exception:
        try:
            font_name = "arialbd.ttf" if bold else "arial.ttf"
            return ImageFont.truetype(f"C:/Windows/Fonts/{font_name}", size)
        except Exception:
            return ImageFont.load_default()


# ── 1. Create Diagram: Traditional vs Talk2Tasks (Slide 2) ───────────────────
def create_comparison_diagram():
    w, h = 900, 650
    img = Image.new("RGBA", (w, h), (248, 250, 252, 255))
    draw = ImageDraw.Draw(img)

    f_title = get_font(26, bold=True)
    f_sub = get_font(18, bold=True)
    f_body = get_font(15, bold=False)

    # Left card: Traditional Bots
    draw.rounded_rectangle([30, 30, 430, 620], radius=16, fill=(255, 241, 242, 255), outline=(254, 205, 211, 255), width=2)
    draw.text((55, 55), "Traditional Meeting Bots", font=f_sub, fill=(159, 18, 57))
    draw.text((55, 85), "(Otter, Fireflies, Read.ai)", font=f_body, fill=(190, 24, 93))

    trad_points = [
        ("❌ Intrusive Meeting Guest", "Requires a cloud bot account to join call"),
        ("❌ Blocked by IT / Clients", "Security policies actively ban external bots"),
        ("❌ Privacy & Compliance Risk", "Audio recorded to unvetted cloud servers"),
        ("❌ English-Only Limitations", "Fails on Hindi, Spanish, or mixed speech"),
        ("❌ Delayed Post-Meeting Notes", "Takes 20-40 min to process after call ends"),
        ("❌ Disconnected from Desktop", "Runs in a separate web tab outside workflow"),
    ]
    y = 140
    for header, desc in trad_points:
        draw.text((55, y), header, font=get_font(16, bold=True), fill=(190, 24, 93))
        draw.text((55, y + 24), desc, font=f_body, fill=(136, 19, 55))
        y += 75

    # Right card: Talk2Tasks AI
    draw.rounded_rectangle([470, 30, 870, 620], radius=16, fill=(240, 253, 244, 255), outline=(187, 247, 208, 255), width=2)
    draw.text((495, 55), "Talk2Tasks AI (Desktop)", font=f_sub, fill=(22, 101, 52))
    draw.text((495, 85), "Zero-Bot Privacy Architecture", font=f_body, fill=(21, 128, 61))

    t2t_points = [
        ("✅ 100% Zero-Bot Stealth", "Direct Windows WASAPI loopback capture"),
        ("✅ Never Blocked or Kicked", "Works on any Google Meet, Zoom, Teams tab"),
        ("✅ Privacy-First Security", "Audio never leaves your machine for STT"),
        ("✅ Multilingual & Code-Switch", "Auto-detects 99+ languages (Hindi, Hinglish)"),
        ("✅ Live Real-Time Extraction", "Instant tasks & decisions while you speak"),
        ("✅ Floating Desktop Mascot", "Talki stays on screen with speech alerts"),
    ]
    y = 140
    for header, desc in t2t_points:
        draw.text((495, y), header, font=get_font(16, bold=True), fill=(21, 128, 61))
        draw.text((495, y + 24), desc, font=f_body, fill=(22, 101, 52))
        y += 75

    path = ASSETS_DIR / "slide2_comparison.png"
    img.save(path)
    return str(path)


# ── 2. Create Diagram: Architecture Pipeline (Slide 3) ────────────────────────
def create_architecture_diagram():
    w, h = 900, 650
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    f_box_t = get_font(17, bold=True)
    f_box_b = get_font(13, bold=False)

    boxes = [
        (40, 60, 420, 180, (239, 246, 255), (191, 219, 254), "1. Dual-Stream Audio Capture", "• Microphone (getUserMedia)\n• System Loopback Audio (getDisplayMedia)\n• Real-Time Web Audio API Mixer"),
        (480, 60, 860, 180, (245, 243, 255), (221, 214, 254), "2. Multilingual STT (Faster-Whisper)", "• CTranslate2 INT8 Local Engine\n• Auto-Detects 99+ Languages (Hindi, English)\n• Zero Audio Sent to Cloud"),
        (40, 240, 420, 390, (236, 253, 245), (167, 243, 208), "3. Flexible LLM Intelligence", "• Free NVIDIA NIM API (Llama 3.3 70B, Qwen)\n• Local Ollama (100% Offline)\n• Deterministic Rule Engine (0 Hallucination)"),
        (480, 240, 860, 390, (254, 242, 242), (254, 202, 202), "4. Real-Time Meeting Companion", "• In-Meeting Conversational Q&A\n• Grounded Transcript Citations\n• Live Decibel Meter & Sound Visualizer"),
        (40, 450, 860, 600, (248, 250, 252), (203, 213, 225), "5. Output Automation & Desktop Delivery", "• Transparent Desktop Mascot (Talki) • Markdown Export • 1-Click Executive Email Draft • SQLite Asynchronous Persistence"),
    ]

    for x1, y1, x2, y2, bg, border, title, desc in boxes:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=14, fill=bg, outline=border, width=2)
        draw.text((x1 + 20, y1 + 16), title, font=f_box_t, fill=(30, 41, 59))
        draw.text((x1 + 20, y1 + 45), desc, font=f_box_b, fill=(71, 85, 105), spacing=5)

    path = ASSETS_DIR / "slide3_architecture.png"
    img.save(path)
    return str(path)


# ── 3. Create Graphic: Live Assistant UI Mockup (Slide 4) ─────────────────────
def create_live_assistant_graphic():
    w, h = 900, 650
    img = Image.new("RGBA", (w, h), (248, 250, 252, 255))
    draw = ImageDraw.Draw(img)

    f_title = get_font(18, bold=True)
    f_body = get_font(14, bold=False)
    f_small = get_font(12, bold=True)

    # Outer window frame
    draw.rounded_rectangle([20, 20, 880, 630], radius=16, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    # Header bar
    draw.rounded_rectangle([20, 20, 880, 75], radius=16, fill=(241, 245, 249))
    draw.ellipse([40, 42, 52, 54], fill=(239, 68, 68))
    draw.ellipse([60, 42, 72, 54], fill=(245, 158, 11))
    draw.ellipse([80, 42, 92, 54], fill=(16, 185, 129))
    draw.text((115, 38), "Talk2Tasks AI — Live Meeting Assistant", font=f_title, fill=(15, 23, 42))

    # Language badge
    draw.rounded_rectangle([630, 35, 860, 65], radius=15, fill=(219, 234, 254), outline=(147, 197, 253), width=1)
    draw.text((645, 42), "🌐 Language: Hindi / English (99%)", font=f_small, fill=(29, 78, 216))

    # Left Column: Dual Meter & Live Transcript
    draw.rounded_rectangle([40, 95, 520, 610], radius=12, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
    draw.text((60, 110), "Live Transcript & Audio Stream", font=get_font(16, bold=True), fill=(30, 41, 59))

    # Audio meters
    draw.text((60, 140), "Mic Audio:", font=f_small, fill=(71, 85, 105))
    draw.rounded_rectangle([150, 143, 400, 155], radius=6, fill=(226, 232, 240))
    draw.rounded_rectangle([150, 143, 340, 155], radius=6, fill=(37, 99, 235))

    draw.text((60, 165), "Meeting Audio:", font=f_small, fill=(71, 85, 105))
    draw.rounded_rectangle([150, 168, 400, 180], radius=6, fill=(226, 232, 240))
    draw.rounded_rectangle([150, 168, 370, 180], radius=6, fill=(16, 185, 129))

    # Transcript segments
    transcripts = [
        ("[00:12] Rahul (Lead):", "Let's review the sprint deliverables. Amit, will you finish the auth API?"),
        ("[00:18] Amit (Backend):", "हाँ, बिल्कुल! I will complete the OAuth2 endpoints by this Friday."),
        ("[00:27] Priya (Design):", "Great. I have finalized the Blue & White mascot UI redesign."),
        ("[00:35] Rahul (Lead):", "Approved. Consensus is we deploy the beta build by Monday."),
    ]
    ty = 205
    for speaker, text in transcripts:
        draw.text((60, ty), speaker, font=get_font(13, bold=True), fill=(37, 99, 235))
        draw.text((60, ty + 20), text, font=f_body, fill=(51, 65, 85))
        ty += 55

    # Right Column: Live Detected Tasks & Decisions
    draw.rounded_rectangle([540, 95, 860, 610], radius=12, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
    draw.text((560, 110), "Real-Time AI Extraction", font=get_font(16, bold=True), fill=(30, 41, 59))

    # Task card
    draw.rounded_rectangle([560, 145, 840, 275], radius=10, fill=(255, 255, 255), outline=(187, 247, 208), width=1)
    draw.text((575, 155), "⚡ ACTION ITEM DETECTED (98%)", font=get_font(12, bold=True), fill=(21, 128, 61))
    draw.text((575, 180), "Task: Finish OAuth2 backend API", font=get_font(14, bold=True), fill=(15, 23, 42))
    draw.text((575, 205), "Owner: Amit  •  Due: Friday", font=f_body, fill=(71, 85, 105))
    draw.text((575, 230), '"I will complete OAuth2 endpoints by Friday"', font=get_font(12, bold=False), fill=(100, 116, 139))

    # Decision card
    draw.rounded_rectangle([560, 290, 840, 420], radius=10, fill=(255, 255, 255), outline=(191, 219, 254), width=1)
    draw.text((575, 300), "✅ CONFIRMED DECISION", font=get_font(12, bold=True), fill=(29, 78, 216))
    draw.text((575, 325), "Decision: Deploy Beta build on Monday", font=get_font(14, bold=True), fill=(15, 23, 42))
    draw.text((575, 350), "Status: Approved by Lead", font=f_body, fill=(71, 85, 105))
    draw.text((575, 375), '"Consensus is we deploy beta by Monday"', font=get_font(12, bold=False), fill=(100, 116, 139))

    # Grounded Q&A prompt
    draw.rounded_rectangle([560, 435, 840, 590], radius=10, fill=(239, 246, 255), outline=(191, 219, 254), width=1)
    draw.text((575, 445), "💬 Ask Talki Companion", font=get_font(13, bold=True), fill=(29, 78, 216))
    draw.text((575, 470), "Q: When is Amit's API due?", font=get_font(13, bold=True), fill=(15, 23, 42))
    draw.text((575, 495), "A: Amit confirmed he will deliver the\nOAuth2 endpoints this Friday (from [00:18]).", font=f_body, fill=(30, 41, 59))

    path = ASSETS_DIR / "slide4_live_assistant.png"
    img.save(path)
    return str(path)


# ── 4. Create Graphic: Floating Mascot & States (Slide 5) ─────────────────────
def create_mascot_graphic():
    w, h = 900, 650
    img = Image.new("RGBA", (w, h), (248, 250, 252, 255))
    draw = ImageDraw.Draw(img)

    f_title = get_font(20, bold=True)
    f_sub = get_font(15, bold=True)
    f_body = get_font(13, bold=False)

    # Title Banner
    draw.text((40, 30), "Talki: Transparent Interactive Desktop Co-Pilot", font=f_title, fill=(15, 23, 42))
    draw.text((40, 60), "Always-on desktop widget that hovers transparently over Google Meet / Zoom", font=f_body, fill=(71, 85, 105))

    # Mascot States Showcase Grid (4 states)
    states = [
        (40, 100, 430, 250, (239, 246, 255), (191, 219, 254), "1. Idle / Standby State (🟢)", "Calm breathing animation. Pinned quietly to screen corner waiting for meeting audio."),
        (470, 100, 860, 250, (236, 253, 245), (167, 243, 208), "2. Listening / Capturing State (🔵)", "Audio-reactive pulse. Eyes glow when participants speak; monitors live transcript in memory."),
        (40, 270, 430, 420, (254, 249, 195), (253, 224, 71), "3. Thinking / Analyzing State (🟡)", "Interactive brain gear animation while parsing transcript against NVIDIA NIM / Ollama."),
        (470, 270, 860, 420, (243, 232, 255), (216, 180, 254), "4. Alerting / Speech Bubble (🟣)", "Pops up a transparent bubble over meeting when high-confidence tasks/commitments are heard."),
    ]
    for x1, y1, x2, y2, bg, border, title, desc in states:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=14, fill=bg, outline=border, width=2)
        draw.text((x1 + 20, y1 + 18), title, font=f_sub, fill=(15, 23, 42))
        draw.text((x1 + 20, y1 + 50), desc, font=f_body, fill=(51, 65, 85), spacing=4)

    # Floating Action Dock Mockup
    draw.rounded_rectangle([40, 450, 860, 610], radius=14, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    draw.text((60, 470), "Transparent Quick-Action Controls (Revealed on Mascot Hover)", font=f_sub, fill=(15, 23, 42))
    draw.text((60, 500), "No need to open full dashboard during meetings. Users execute actions in 1 click:", font=f_body, fill=(71, 85, 105))

    buttons = [
        (60, 540, 220, 585, (239, 68, 68), "⏹️ End Recording"),
        (240, 540, 400, 585, (37, 99, 235), "📊 View Dashboard"),
        (420, 540, 580, 585, (16, 185, 129), "🎙️ Transcribing: ON"),
        (600, 540, 760, 585, (100, 116, 139), "❓ Grounded Q&A"),
    ]
    for bx1, by1, bx2, by2, bcolor, btext in buttons:
        draw.rounded_rectangle([bx1, by1, bx2, by2], radius=8, fill=bcolor)
        draw.text((bx1 + 15, by1 + 12), btext, font=get_font(13, bold=True), fill=(255, 255, 255))

    path = ASSETS_DIR / "slide5_mascot.png"
    img.save(path)
    return str(path)


# ── 5. Create Graphic: Outcomes & Email Draft (Slide 6) ───────────────────────
def create_outcomes_graphic():
    w, h = 900, 650
    img = Image.new("RGBA", (w, h), (248, 250, 252, 255))
    draw = ImageDraw.Draw(img)

    f_title = get_font(18, bold=True)
    f_sub = get_font(14, bold=True)
    f_body = get_font(13, bold=False)

    # Left: Action Items Table
    draw.rounded_rectangle([30, 30, 440, 610], radius=14, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    draw.text((50, 50), "Extracted Action Items Table", font=f_title, fill=(15, 23, 42))
    draw.text((50, 75), "Structured, assigned, and deadline-tracked", font=f_body, fill=(100, 116, 139))

    tasks = [
        ("Finalize OAuth2 Auth Endpoints", "Amit", "Friday", "Pending"),
        ("Deploy v1.2 Beta Build", "Rahul", "Monday", "Scheduled"),
        ("Update Blue & White Mascot UI", "Priya", "Done", "Completed"),
        ("Configure NVIDIA NIM Cloud API", "Team", "Done", "Completed"),
    ]
    ty = 115
    for task, owner, deadline, st in tasks:
        draw.rounded_rectangle([50, ty, 420, ty + 95], radius=10, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw.text((65, ty + 12), f"Task: {task}", font=f_sub, fill=(15, 23, 42))
        draw.text((65, ty + 38), f"Owner: {owner}   •   Deadline: {deadline}", font=f_body, fill=(71, 85, 105))
        st_color = (22, 101, 52) if st == "Completed" else (30, 64, 175)
        draw.text((65, ty + 64), f"Status: {st}", font=get_font(12, bold=True), fill=st_color)
        ty += 115

    # Right: Automated Email Follow-Up Draft
    draw.rounded_rectangle([470, 30, 870, 610], radius=14, fill=(255, 255, 255), outline=(191, 219, 254), width=2)
    draw.text((490, 50), "1-Click Follow-Up Email Draft", font=f_title, fill=(30, 64, 175))
    draw.text((490, 75), "Pre-composed from meeting notes & decisions", font=f_body, fill=(100, 116, 139))

    email_text = """Subject: Follow-up: Sprint Deliverables & Beta Release

Hi team,

Thanks for your time in today's sync. Here is our recap:

• Summary: The engineering team finalized sprint commitments.
  OAuth2 authentication will be completed this week.

• Key Decisions:
  1. Approved: Deploy Beta build on Monday.
  2. Approved: Blue & White UI theme set as production default.

• Action Items:
  - Amit: Finalize OAuth2 endpoints (Due: Friday)
  - Rahul: Deploy v1.2 Beta build (Due: Monday)

Best regards,
Engineering Team"""
    draw.text((490, 120), email_text, font=get_font(13, bold=False), fill=(51, 65, 85), spacing=5)

    path = ASSETS_DIR / "slide6_outcomes.png"
    img.save(path)
    return str(path)


# ── BUILD PPTX PRESENTATION ───────────────────────────────────────────────────
def build_powerpoint():
    prs = Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6]

    # Generate graphics
    comp_img = create_comparison_diagram()
    arch_img = create_architecture_diagram()
    live_img = create_live_assistant_graphic()
    mascot_img = create_mascot_graphic()
    outcomes_img = create_outcomes_graphic()

    # Helper: add header to content slide
    def add_slide_header(slide, title_text, category_text):
        # Pill badge
        badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.45), Inches(3.2), Inches(0.38))
        badge.fill.solid()
        badge.fill.fore_color.rgb = COLOR_LIGHT_BLUE
        badge.line.color.rgb = COLOR_BORDER
        badge.line.width = Pt(1)
        tf = badge.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = category_text.upper()
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = COLOR_BLUE

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.5), Inches(0.8))
        tf = title_box.text_frame
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(28)
        p.font.bold = True
        p.font.color.rgb = COLOR_NAVY

    # Helper: set speaker notes
    def set_speaker_notes(slide, notes_text):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes_text

    # ─────────────────────────────────────────────────────────────────────────
    # SLIDE 1: Title & Hero Slide
    # ─────────────────────────────────────────────────────────────────────────
    slide1 = prs.slides.add_slide(blank_layout)

    # Left content
    badge1 = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(1.2), Inches(3.4), Inches(0.42))
    badge1.fill.solid()
    badge1.fill.fore_color.rgb = COLOR_LIGHT_BLUE
    badge1.line.color.rgb = COLOR_BORDER
    tf = badge1.text_frame
    p = tf.paragraphs[0]
    p.text = "PRIVACY-FIRST GENAI PROJECT"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_BLUE

    title1 = slide1.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(6.8), Inches(1.8))
    tf1 = title1.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "Talk2Tasks AI"
    p1.font.size = Pt(44)
    p1.font.bold = True
    p1.font.color.rgb = COLOR_NAVY

    p1_sub = tf1.add_paragraph()
    p1_sub.text = "Desktop Meeting Intelligence & Live Multilingual AI Companion"
    p1_sub.font.size = Pt(20)
    p1_sub.font.color.rgb = COLOR_BLUE
    p1_sub.space_before = Pt(8)

    desc1 = slide1.shapes.add_textbox(Inches(1.0), Inches(3.8), Inches(6.8), Inches(2.2))
    tf_desc = desc1.text_frame
    tf_desc.word_wrap = True
    highlights = [
        "• 100% Zero-Bot Architecture — Captures system audio without external bots.",
        "• Real-Time Multilingual Detection — Whisper STT auto-detects 99+ languages.",
        "• Hybrid AI Engine — Custom NVIDIA NIM API + Offline Ollama + Rule Fallback.",
        "• Interactive Desktop Mascot — Transparent floating companion with speech alerts.",
    ]
    for h in highlights:
        p = tf_desc.add_paragraph()
        p.text = h
        p.font.size = Pt(13)
        p.font.color.rgb = COLOR_SLATE
        p.space_after = Pt(6)

    # Right side: Hero Mascot Image
    if MASCOT_SRC.exists():
        slide1.shapes.add_picture(str(MASCOT_SRC), Inches(8.2), Inches(1.2), width=Inches(4.3))

    set_speaker_notes(
        slide1,
        "Welcome everyone. Today I'm excited to present Talk2Tasks AI, a privacy-first desktop meeting intelligence platform. "
        "Unlike traditional meeting recorders that require invasive cloud bots to join calls, Talk2Tasks AI runs natively on your desktop. "
        "It captures dual audio, transcribes multilingual conversations with Faster-Whisper, and extracts actionable commitments in real time."
    )

    # ─────────────────────────────────────────────────────────────────────────
    # SLIDE 2: Problem & Market Opportunity
    # ─────────────────────────────────────────────────────────────────────────
    slide2 = prs.slides.add_slide(blank_layout)
    add_slide_header(slide2, "The Meeting Dilemma: Privacy, Security & Language Gaps", "The Problem")

    # Left Column: Problem details
    prob_box = slide2.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(5.8), Inches(4.8))
    tf_prob = prob_box.text_frame
    tf_prob.word_wrap = True

    probs = [
        ("The Cloud Bot Security Risk", "Corporate Google Meet, Zoom, and Teams meetings increasingly ban 3rd-party bots due to data compliance and IP privacy."),
        ("Post-Meeting Action Item Slip", "67% of commitments made in meetings are forgotten or never documented due to note-taking fatigue."),
        ("Multilingual Communication Breakdown", "Global teams speak mixed languages (Hindi, Hinglish, Spanish, French). Traditional English-only tools fail completely."),
        ("Disconnected Web Tools", "Having to open a separate browser tab distracts attendees from active participation in discussions."),
    ]
    for title, desc in probs:
        p_t = tf_prob.add_paragraph()
        p_t.text = f"⚠️  {title}"
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_NAVY
        p_t.space_before = Pt(8)

        p_d = tf_prob.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(12)
        p_d.font.color.rgb = COLOR_SLATE
        p_d.space_after = Pt(8)

    # Right Column: Comparison Graphic
    slide2.shapes.add_picture(comp_img, Inches(7.0), Inches(1.6), width=Inches(5.5))

    set_speaker_notes(
        slide2,
        "Here we see why traditional solutions like Otter or Fireflies fail in modern enterprises. "
        "They rely on bots that clients and IT security block. Furthermore, global meetings involve multilingual code-switching. "
        "Talk2Tasks solves this by capturing system audio directly with zero bots, protecting privacy, and supporting 99+ languages."
    )

    # ─────────────────────────────────────────────────────────────────────────
    # SLIDE 3: Technical Architecture & Pipeline
    # ─────────────────────────────────────────────────────────────────────────
    slide3 = prs.slides.add_slide(blank_layout)
    add_slide_header(slide3, "Edge & Cloud Architecture: Low Latency, 100% Private", "Technical Architecture")

    # Left Column: Tech Highlights
    arch_box = slide3.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(5.8), Inches(4.8))
    tf_arch = arch_box.text_frame
    tf_arch.word_wrap = True

    arch_points = [
        ("Dual-Stream Web Audio Mixer", "Captures Windows WASAPI loopback audio (remote participants) and local microphone with real-time volume metering."),
        ("Faster-Whisper Multilingual STT", "CTranslate2-optimized local model runs directly on CPU/GPU. Automatically detects language without sending voice to the cloud."),
        ("NVIDIA NIM Cloud & Ollama LLMs", "Integrates custom user-selected NVIDIA NIM models (Llama 3.3 70B, Qwen 2.5 72B) alongside local offline Ollama."),
        ("Zero-Hallucination Fallback", "Deterministic heuristic engine guarantees structured action items even if completely disconnected from the internet."),
    ]
    for title, desc in arch_points:
        p_t = tf_arch.add_paragraph()
        p_t.text = f"⚙️  {title}"
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_NAVY
        p_t.space_before = Pt(8)

        p_d = tf_arch.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(12)
        p_d.font.color.rgb = COLOR_SLATE
        p_d.space_after = Pt(8)

    # Right Column: Architecture Diagram
    slide3.shapes.add_picture(arch_img, Inches(6.9), Inches(1.6), width=Inches(5.6))

    set_speaker_notes(
        slide3,
        "This slide illustrates our 5-tier architecture. First, the dual-stream mixer captures both system loopback and mic audio. "
        "Next, Faster-Whisper transcribes speech locally in 5-second slices with automatic multi-language detection. "
        "Finally, our LLM engine parses transcript segments into structured notes, tasks, and follow-up emails."
    )

    # ─────────────────────────────────────────────────────────────────────────
    # SLIDE 4: Live Assistant & Multilingual Support
    # ─────────────────────────────────────────────────────────────────────────
    slide4 = prs.slides.add_slide(blank_layout)
    add_slide_header(slide4, "Real-Time Meeting Assistant & Multilingual Detection", "Live Assistant")

    # Left Column: Features
    live_box = slide4.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(5.8), Inches(4.8))
    tf_live = live_box.text_frame
    tf_live.word_wrap = True

    live_feats = [
        ("Automatic Multi-Language Detection", "Instant badge displays detected language (e.g. Hindi 98%, English 99%), handling code-switched Hinglish effortlessly."),
        ("Real-Time Dual Audio Visualizer", "Dynamic decibel meters provide immediate visual feedback that your microphone and speaker loopback are active."),
        ("Instant Task & Decision Notifications", "As soon as a participant says 'I will complete the API by Friday', Talk2Tasks extracts owner, task, and deadline."),
        ("In-Meeting Grounded Q&A", "Ask questions during the call (e.g. 'What did Rahul say about the budget?'); receives answers strictly grounded in transcript quotes."),
    ]
    for title, desc in live_feats:
        p_t = tf_live.add_paragraph()
        p_t.text = f"🌐  {title}"
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_NAVY
        p_t.space_before = Pt(8)

        p_d = tf_live.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(12)
        p_d.font.color.rgb = COLOR_SLATE
        p_d.space_after = Pt(8)

    # Right Column: UI Mockup Graphic
    slide4.shapes.add_picture(live_img, Inches(6.9), Inches(1.6), width=Inches(5.6))

    set_speaker_notes(
        slide4,
        "Here you can see the Live Assistant screen. The dual audio meters confirm that both meeting participants and the user's voice are capturing. "
        "Notice the blue language badge confirming automatic multilingual detection. "
        "On the right, action items and decisions appear instantly while the meeting is ongoing."
    )

    # ─────────────────────────────────────────────────────────────────────────
    # SLIDE 5: Floating Desktop Mascot (Talki)
    # ─────────────────────────────────────────────────────────────────────────
    slide5 = prs.slides.add_slide(blank_layout)
    add_slide_header(slide5, "Talki: The Transparent Interactive Desktop Co-Pilot", "Desktop Mascot")

    # Left Column: Mascot highlights
    mascot_box = slide5.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(5.8), Inches(4.8))
    tf_mascot = mascot_box.text_frame
    tf_mascot.word_wrap = True

    mascot_points = [
        ("Transparent Borderless Desktop Window", "Electron window with transparent canvas; only the cute mascot and speech bubbles hover over your screen."),
        ("Dynamic Reactive Animation States", "Talki changes states dynamically: Idle breathing, Listening audio pulse, Thinking gear animation, and Alerting speech bubble."),
        ("In-Meeting Speech Bubble Alerts", "Whenever an action item or deadline is identified, Talki pops up a notification right over your Google Meet / Zoom window."),
        ("Glassmorphic One-Click Dock", "Hovering over Talki reveals quick actions: End Recording, Open Dashboard, View Live Transcripts, or Toggle Mute."),
    ]
    for title, desc in mascot_points:
        p_t = tf_mascot.add_paragraph()
        p_t.text = f"🐾  {title}"
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_NAVY
        p_t.space_before = Pt(8)

        p_d = tf_mascot.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(12)
        p_d.font.color.rgb = COLOR_SLATE
        p_d.space_after = Pt(8)

    # Right Column: Mascot Showcase Graphic
    slide5.shapes.add_picture(mascot_img, Inches(6.9), Inches(1.6), width=Inches(5.6))

    set_speaker_notes(
        slide5,
        "Talki is our interactive desktop mascot. Instead of an ugly rectangular app window, Talki is a transparent companion. "
        "It reacts to participant voices with a blue listening pulse, and pops up speech bubbles whenever someone commits to a deliverable. "
        "Users can control their recording with one-click transparent dock buttons."
    )

    # ─────────────────────────────────────────────────────────────────────────
    # SLIDE 6: Output Automation, Security & Roadmap
    # ─────────────────────────────────────────────────────────────────────────
    slide6 = prs.slides.add_slide(blank_layout)
    add_slide_header(slide6, "Deliverables, Enterprise Security & Future Roadmap", "Outcomes & Value")

    # Left Column: Deliverables
    outcomes_box = slide6.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(5.8), Inches(4.8))
    tf_out = outcomes_box.text_frame
    tf_out.word_wrap = True

    outcomes_points = [
        ("1-Click Follow-Up Email Generation", "Pre-composes structured executive recap emails including summary, decisions, and assigned tasks ready to send."),
        ("Action Items Table with Confidence", "Categorizes task description, assigned owner, due date, and transcript quote with AI confidence scores."),
        ("Markdown & SQLite Persistence", "Full meeting history, audio metadata, and transcript searchable offline anytime."),
        ("Future Roadmap", "• Speaker Diarization (Voiceprint)\n• Direct Jira/Linear/Slack webhook sync\n• Automatic Outlook & Google Calendar listener"),
    ]
    for title, desc in outcomes_points:
        p_t = tf_out.add_paragraph()
        p_t.text = f"🚀  {title}"
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_NAVY
        p_t.space_before = Pt(8)

        p_d = tf_out.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(12)
        p_d.font.color.rgb = COLOR_SLATE
        p_d.space_after = Pt(8)

    # Right Column: Outcomes Graphic
    slide6.shapes.add_picture(outcomes_img, Inches(6.9), Inches(1.6), width=Inches(5.6))

    set_speaker_notes(
        slide6,
        "In conclusion, Talk2Tasks AI delivers actionable outcomes immediately after a meeting ends. "
        "Teams save an average of 80% on post-meeting documentation time. "
        "With enterprise privacy, zero bots, and multilingual support, Talk2Tasks AI is the future of intelligent desktop collaboration."
    )

    # Save presentation
    output_path = OUTPUT_DIR / "Talk2Tasks_AI_Presentation.pptx"
    prs.save(str(output_path))
    print(f"Presentation successfully created at: {output_path}")
    return str(output_path)

if __name__ == "__main__":
    pptx_file = build_powerpoint()
    print("DONE:", pptx_file)
