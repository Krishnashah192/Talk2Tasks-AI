# 🎙️ Talk2Tasks AI — Fully Local Meeting Intelligence & Floating Desktop Companion

> **Open-Source, On-Device AI Meeting Assistant & Windows Desktop Companion**  
> Converts meeting speech into searchable transcripts, executive notes, confirmed decisions, action items, deadlines, and follow-up email drafts — **100% locally with zero cloud dependencies**.
>
> **Now featuring the Floating Desktop Meeting Companion:** An always-on-top, draggable mascot widget that listens to live meetings (Google Meet, Zoom, Teams, Webex), captures system loopback & microphone audio, and provides real-time notifications and grounded Q&A.

---

## ⚡ Quick Start on Windows

### 🚀 1-Click Launch (Native Desktop Executable)
Simply double-click:
- **`Talk2Tasks AI.exe`** in the project folder, or
- **`Talk2Tasks AI`** desktop shortcut on your Windows Desktop!

> **What it does automatically:**
> 1. Silently launches the Python FastAPI backend on `http://127.0.0.1:8000`.
> 2. Launches the Electron desktop shell with the **Cute Cyber-Pet Companion ("Kiko")** and **Meeting Intelligence Dashboard**.
> 3. Cleanly shuts down background services when you exit the app.

---

### Alternative Launch Options
- **Batch Launcher:** Double-click `start.bat` or `scripts\start_desktop.bat`
- **PowerShell:** `powershell -ExecutionPolicy Bypass -File scripts\start_desktop.ps1`
- **Browser Only:** `powershell -ExecutionPolicy Bypass -File scripts\start.ps1` (opens `http://localhost:5173`)


### Diagnostic Verification
To test and verify all Python libraries, Faster-Whisper, SQLite database, and frontend:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify_setup.ps1
```

---

## 🌟 Key Features

### 1. Dual-Window Desktop Architecture
- **Main Dashboard Window (1280x850):** Full meeting control center, live transcript streaming, task manager, decision ledger, notes editor, email composer, and SQLite meeting history.
- **Floating Mascot Widget (340x460):** Frameless, translucent, always-on-top companion featuring "Talki" the animated robot mascot. Draggable anywhere, snap-to-corner (`top-left`, `top-right`, `bottom-left`, `bottom-right`), click-through mode, and unobtrusive update notifications.
- **Windows System Tray Integration:** Minimizes cleanly to the Windows notification tray for background operation during meetings.
- **Optional Launch-on-Login:** User-controlled autostart preference configured in Settings.

### 2. Live Meeting Detection
- Inspects Windows processes and window metadata to identify potential meeting applications:
  - **Google Meet** running in Chrome, Edge, or Brave.
  - **Zoom Desktop Application** (`Zoom.exe`).
  - **Microsoft Teams Desktop** (`Teams.exe` / `ms-teams.exe`).
  - **Cisco Webex** (`webex.exe` / `ciscocollabhost.exe`).
- Categorizes detections honestly: `confirmed`, `potential`, `unconfirmed`, or `none`.
- Manual meeting naming fallback for custom or unlisted tools.

### 3. Windows Audio Capture (WASAPI Loopback & Microphone)
- **System Playback Audio:** Captures computer audio output (remote meeting attendees) via Windows WASAPI loopback.
- **Microphone Capture:** Captures local speaker voice via connected mic.
- **Dual Mixed Audio:** Mixes both streams in real-time via Web Audio API for complete meeting coverage.
- **Consent & Transparency Notice:** Explicit user confirmation required before any audio capture begins; live volume metering and unambiguous glowing recording indicator.

### 4. Incremental Local Speech-to-Text & AI Intelligence
- **Faster-Whisper:** Slices audio into rolling chunks and transcribes locally on CPU with int8 quantization (zero external API keys).
- **Local LLM or Free Open Models:**
  - **Ollama:** Llama 3, Mistral, or Phi-3 on `http://localhost:11434`.
  - **NVIDIA NIM (Free Open Models):** Free API keys for Meta Llama 3.3 70B, Qwen 2.5 72B, or DeepSeek R1.
  - **Deterministic Heuristic Engine:** 100% offline, guaranteed zero-crash fallback engine for offline demonstrations.
- **Grounded Conversational Q&A:** Ask questions about the current meeting (e.g., *"What did Sarah promise to deliver by Friday?"* or *"What are all pending decisions?"*) and receive concise answers grounded in transcript citations.

### 5. Automatic Meeting Reconciliation & Follow-up
- Ending a meeting triggers comprehensive reconciliation:
  1. Stops and flushes all audio buffers.
  2. Finalizes the full timestamped transcript.
  3. Extracts executive summary, key points, blockers, and open questions.
  4. Identifies confirmed vs. tentative decisions with source quotes.
  5. Extracts action items with owners, deadlines, and confidence scores.
  6. Composes an executive follow-up email draft.
  7. Persists everything into SQLite history and allows 1-click Markdown export.

---

## 🏛️ System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │              Windows Desktop Environment               │
               └───────────────────────────┬────────────────────────────┘
                                           │
                      ┌────────────────────┴────────────────────┐
                      ▼                                         ▼
         ┌─────────────────────────┐               ┌─────────────────────────┐
         │  Electron Main Process  │               │  React 19 Frontend UI   │
         │  - System Tray          │◄─────────────►│  - Main Dashboard       │
         │  - Context Isolation    │  IPC Bridge   │  - Floating Mascot      │
         │  - Process Detector     │  (Preload)    │  - WASAPI Audio Capture │
         │  - Autostart / Prefs    │               │  - Realtime Visualizer  │
         └─────────────────────────┘               └────────────┬────────────┘
                                                                │ HTTP / REST
                                                                ▼
                                                   ┌─────────────────────────┐
                                                   │  FastAPI Python Server  │
                                                   │  - /api/detect-meetings │
                                                   │  - /api/audio-stream    │
                                                   │  - /api/meetings/{id}/ask│
                                                   │  - /api/complete-live   │
                                                   └────────────┬────────────┘
                                                                │
                 ┌──────────────────────────────────────────────┼──────────────────────────────┐
                 ▼                                              ▼                              ▼
    ┌─────────────────────────┐                    ┌─────────────────────────┐    ┌─────────────────────────┐
    │     Faster-Whisper      │                    │     Local LLM / NIM     │    │     SQLite Database     │
    │  - int8 quantized CPU   │                    │  - Ollama (Llama 3)     │    │  - aiosqlite async      │
    │  - Rolling chunk audio  │                    │  - NVIDIA NIM (Free API)│    │  - Complete history     │
    │  - Timestamped segments │                    │  - Deterministic Engine │    │  - Tasks & decisions    │
    └─────────────────────────┘                    └─────────────────────────┘    └─────────────────────────┘
```

---

## 📁 Repository Structure

```text
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py         # REST API endpoints (live stream, detection, Q&A, meetings)
│   │   ├── services/
│   │   │   ├── detector.py       # Windows process & window title inspector
│   │   │   ├── transcription.py  # Faster-Whisper local STT pipeline
│   │   │   ├── llm.py            # Local LLM, NVIDIA NIM, and grounded meeting Q&A
│   │   │   └── demo.py           # Preloaded multi-speaker meeting dataset
│   │   ├── database.py           # aiosqlite SQLite database CRUD operations
│   │   ├── schemas.py            # Pydantic data models
│   │   └── main.py               # FastAPI application root & CORS middleware
│   ├── requirements.txt          # Python dependencies
│   └── test_integration.py      # 13-point end-to-end integration test suite
├── frontend/
│   ├── electron/
│   │   ├── main.cjs              # Electron main process (dual windows, tray, IPC)
│   │   ├── preload.cjs           # Secure context-isolated preload script
│   │   ├── tray_icon.png         # 32x32 system tray icon
│   │   └── app_icon.png          # 256x256 application icon
│   ├── src/
│   │   ├── components/
│   │   │   ├── FloatingWidget.tsx # Floating mascot widget ("Talki")
│   │   │   ├── ActionItemsTable.tsx
│   │   │   ├── DecisionsPanel.tsx
│   │   │   ├── NotesPanel.tsx
│   │   │   └── Sidebar.tsx       # Navigation bar with Live Assistant item
│   │   ├── pages/
│   │   │   ├── LiveAssistant.tsx # Live Meeting Assistant session view
│   │   │   ├── Dashboard.tsx     # Main meeting dashboard
│   │   │   ├── History.tsx       # Meeting history & SQLite archive
│   │   │   └── Settings.tsx      # Audio, model, and desktop companion preferences
│   │   ├── services/
│   │   │   ├── audioCapture.ts   # Web Audio + WASAPI loopback & mic service
│   │   │   └── api.ts            # Typed API fetch client
│   │   └── types/                # TypeScript interfaces
│   ├── package.json              # Electron & React dependencies + build target
│   └── vite.config.ts            # Vite bundler configuration
├── scripts/
│   ├── setup.ps1                 # Windows environment installer
│   ├── verify_setup.ps1          # Diagnostic and health verification
│   ├── start.ps1                 # Unified web launcher
│   ├── start_desktop.ps1         # Unified Electron desktop launcher
│   └── create_icons.py           # PNG icon generator
├── start.bat                     # 1-click web launcher
├── start_desktop.bat             # 1-click desktop companion launcher
├── PROJECT_PRESENTATION.md       # Comprehensive evaluation and presentation guide
└── README.md                     # Project documentation
```

---

## 🔒 Security & Privacy Best Practices

1. **Electron Context Isolation:** `contextIsolation: true` and `nodeIntegration: false` are enforced on all renderer processes.
2. **Narrow Preload Surface:** Renderer code only accesses specific IPC methods through `window.electronAPI`; arbitrary filesystem access or shell execution is strictly disallowed.
3. **No Silent Recording:** Audio capture cannot start without explicit user interaction and acknowledgment of meeting recording consent.
4. **Zero Cloud Leakage:** In default mode, all transcription and reasoning occur on the local CPU/GPU. No meeting data is sent to cloud surveillance.

---

## 📄 License
This project is open-source under the MIT License.
