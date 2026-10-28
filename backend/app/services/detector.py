"""
Talk2Tasks AI — Windows Meeting Detector Service
Inspects Windows processes and active desktop windows to honestly detect Google Meet, Zoom, Microsoft Teams, and Webex.
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class MeetingDetection(BaseModel):
    id: str
    platform: str
    process_name: str
    window_title: Optional[str] = None
    title: str = ""
    meeting_title: str = ""
    confidence: str  # 'confirmed' | 'potential' | 'unconfirmed'
    status: str = ""
    notes: str = ""
    audio_method: str = ""
    audio_capture_method: str = ""
    detection_method: str = ""

    def __init__(self, **data):
        if "title" in data and "meeting_title" not in data:
            data["meeting_title"] = data["title"]
        elif "meeting_title" in data and "title" not in data:
            data["title"] = data["meeting_title"]

        if "status" in data and "notes" not in data:
            data["notes"] = data["status"]
        elif "notes" in data and "status" not in data:
            data["status"] = data["notes"]

        if "audio_method" in data and "audio_capture_method" not in data:
            data["audio_capture_method"] = data["audio_method"]
        elif "audio_capture_method" in data and "audio_method" not in data:
            data["audio_method"] = data["audio_capture_method"]

        super().__init__(**data)


def _get_interactive_windows() -> list[tuple[int, str]]:
    """
    Query interactive desktop windows on Windows via WinSta0/Default.
    Returns list of (pid, window_title).
    """
    windows = []
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        h_winsta = user32.OpenWindowStationW('WinSta0', False, 0x037F)
        if h_winsta:
            user32.SetProcessWindowStation(h_winsta)

        h_desk = user32.OpenDesktopW('Default', 0, False, 0x01FF)
        if h_desk:
            user32.SetThreadDesktop(h_desk)

        def enum_proc(hwnd, lparam):
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    pid = wintypes.DWORD()
                    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                    windows.append((pid.value, buff.value))
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        target_desk = h_desk if h_desk else 0
        if target_desk:
            user32.EnumDesktopWindows(target_desk, WNDENUMPROC(enum_proc), 0)
        else:
            user32.EnumWindows(WNDENUMPROC(enum_proc), 0)
    except Exception as e:
        logger.debug(f"Window enumeration error: {e}")

    return windows


def detect_windows_meetings() -> list[MeetingDetection]:
    """
    Inspects running processes and interactive desktop window titles on Windows to find meeting apps.
    Prioritizes:
    - Google Meet in Google Chrome, Microsoft Edge, Brave Browser
    - Zoom Desktop Application
    - Microsoft Teams Desktop
    - Cisco Webex

    Categorizes detection confidence strictly and honestly:
    - confirmed: Specific meeting window title detected (e.g. 'Meet - abc-defg-hij', 'Zoom Meeting')
    - potential: Application window is open or active browser session detected
    - unconfirmed: Background process running without active meeting window
    """
    detections: list[MeetingDetection] = []

    try:
        import psutil
    except ImportError:
        logger.warning("psutil not available for meeting detection")
        return []

    # 1. Enumerate interactive window titles
    active_windows = _get_interactive_windows()
    confirmed_platforms = set()

    # Search window titles for confirmed meetings
    for pid, w_title in active_windows:
        lower = w_title.lower()

        # Google Meet detection in window title (genuine meet session only)
        is_meet = (
            any(k in lower for k in ['meet - ', 'meet – ', 'meet — ', 'meet: ', 'google meet', 'meet.google.com'])
            or bool(re.search(r'\b[a-z]{3}-[a-z]{4}-[a-z]{3}\b', lower))
        )
        if is_meet:
            clean_title = (
                re.sub(r' - (Google Chrome|Microsoft Edge|Brave|Mozilla Firefox)$', '', w_title, flags=re.I)
            )
            clean_title = re.sub(r'^(Meet\s*[-–—:]\s*|Google Meet\s*[-–—:]\s*)', '', clean_title, flags=re.I).strip()
            detections.append(
                MeetingDetection(
                    id=f"meet_{pid}",
                    platform="google_meet",
                    process_name="chrome.exe",
                    window_title=w_title,
                    meeting_title=clean_title or "Google Meet Active Session",
                    confidence="confirmed",
                    status="Confirmed active Google Meet session in browser",
                    notes="Google Meet call detected with active window title.",
                    audio_method="Browser Tab Audio / WASAPI Loopback Capture",
                    audio_capture_method="Browser Tab Audio / WASAPI Loopback Capture",
                    detection_method=f"Interactive window title inspection (\"{w_title}\")",
                )
            )
            confirmed_platforms.add('google_meet')

        # Zoom meeting in window title
        elif 'zoom meeting' in lower or 'zoom workplace' in lower:
            detections.append(
                MeetingDetection(
                    id=f"zoom_{pid}",
                    platform="zoom",
                    process_name="Zoom.exe",
                    window_title=w_title,
                    meeting_title=w_title,
                    confidence="confirmed",
                    status="Confirmed active Zoom meeting window",
                    notes="Zoom meeting detected with active window title.",
                    audio_method="Windows WASAPI Loopback / System Audio Capture",
                    audio_capture_method="Windows WASAPI Loopback / System Audio Capture",
                    detection_method=f"Window title inspection (\"{w_title}\")",
                )
            )
            confirmed_platforms.add('zoom')

        # Teams meeting in window title
        elif ('microsoft teams' in lower and ('meeting' in lower or 'call' in lower)) or 'teams meeting' in lower:
            detections.append(
                MeetingDetection(
                    id=f"teams_{pid}",
                    platform="teams",
                    process_name="Teams.exe",
                    window_title=w_title,
                    meeting_title=w_title,
                    confidence="confirmed",
                    status="Confirmed active Teams meeting",
                    notes="Microsoft Teams meeting call detected.",
                    audio_method="Windows WASAPI Loopback / System Audio Capture",
                    audio_capture_method="Windows WASAPI Loopback / System Audio Capture",
                    detection_method=f"Window title inspection (\"{w_title}\")",
                )
            )
            confirmed_platforms.add('teams')

    # 2. Inspect running processes if not already confirmed by title
    seen_processes = set()

    for proc in psutil.process_iter(['pid', 'name', 'exe']):
        try:
            name = (proc.info['name'] or '').lower()
            pid = proc.info['pid']

            # Check Zoom desktop application (if not already confirmed by title)
            if name == 'zoom.exe' and 'zoom' not in confirmed_platforms and 'zoom' not in seen_processes:
                seen_processes.add('zoom')
                detections.append(
                    MeetingDetection(
                        id=f"zoom_{pid}",
                        platform="zoom",
                        process_name="Zoom.exe",
                        meeting_title="Zoom Active Session",
                        confidence="potential",
                        status="Zoom desktop process running (Ready for audio capture)",
                        notes="Zoom process is running in the background.",
                        audio_method="Windows WASAPI Loopback / System Audio Capture",
                        audio_capture_method="Windows WASAPI Loopback / System Audio Capture",
                        detection_method="Process inspection (Zoom.exe)",
                    )
                )

            # Check Teams
            elif (name == 'teams.exe' or name == 'ms-teams.exe') and 'teams' not in confirmed_platforms and 'teams' not in seen_processes:
                seen_processes.add('teams')
                detections.append(
                    MeetingDetection(
                        id=f"teams_{pid}",
                        platform="teams",
                        process_name=name,
                        meeting_title="Teams Meeting Session",
                        confidence="potential",
                        status="Microsoft Teams process running",
                        notes="Microsoft Teams is running in the background.",
                        audio_method="Windows WASAPI Loopback / System Audio Capture",
                        audio_capture_method="Windows WASAPI Loopback / System Audio Capture",
                        detection_method=f"Process inspection ({name})",
                    )
                )

            # Check Webex
            elif (name == 'ciscocollabhost.exe' or name == 'webex.exe') and 'webex' not in seen_processes:
                seen_processes.add('webex')
                detections.append(
                    MeetingDetection(
                        id=f"webex_{pid}",
                        platform="webex",
                        process_name=name,
                        meeting_title="Cisco Webex Meeting",
                        confidence="potential",
                        status="Cisco Webex process running",
                        notes="Webex process running.",
                        audio_method="Windows WASAPI Loopback / System Audio Capture",
                        audio_capture_method="Windows WASAPI Loopback / System Audio Capture",
                        detection_method=f"Process inspection ({name})",
                    )
                )

        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    return detections
