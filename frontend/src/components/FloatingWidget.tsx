// Talk2Tasks AI — Desktop Pet Mascot Fidget Companion
// Ultra-clean, transparent desktop widget in Blue & White modern aesthetic.
// Only the mascot is visible by default. Clicking opens the quick-action menu.
// All features (End Recording, Go to Dashboard, Live Transcribing, Pause, Ask Mascot, Hide) fully working.

import React, { useState, useEffect, useRef } from 'react';
import {
  Square,
  LayoutDashboard,
  FileText,
  Mic,
  MicOff,
  Sparkles,
  X,
  Send,
  GripHorizontal,
} from 'lucide-react';
import type { LiveAssistantNotification } from '../types';
import { askMeetingQuestion, completeLiveMeeting } from '../services/api';
import CuteMascot from './CuteMascot';

export type MascotState =
  | 'idle'
  | 'searching'
  | 'waiting_confirmation'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'important_update'
  | 'paused'
  | 'error'
  | 'ended';

interface FloatingWidgetProps {
  meetingId?: string;
  meetingTitle?: string;
  mascotState?: MascotState;
  isCapturing?: boolean;
  latestTranscript?: string;
  latestNotification?: LiveAssistantNotification | null;
  onPauseCapture?: () => void;
  onResumeCapture?: () => void;
  onStopMeeting?: () => void;
  onOpenDashboard?: (section?: string) => void;
}

export default function FloatingWidget({
  meetingId = 'current',
  meetingTitle = 'Active Meeting Session',
  mascotState: initialMascotState = 'idle',
  isCapturing: initialIsCapturing = false,
  latestTranscript: initialTranscript = '',
  latestNotification: initialNotification = null,
  onPauseCapture,
  onResumeCapture,
  onStopMeeting,
  onOpenDashboard,
}: FloatingWidgetProps) {
  const [mascotState, setMascotState] = useState<MascotState>(initialMascotState);
  const [isCapturing, setIsCapturing] = useState<boolean>(initialIsCapturing);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [latestTranscript, setLatestTranscript] = useState<string>(initialTranscript);
  const [latestNotification, setLatestNotification] = useState<LiveAssistantNotification | null>(initialNotification);
  const [isAskOpen, setIsAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string>(meetingId);

  const transcriptTimerRef = useRef<any>(null);
  const notifTimerRef = useRef<any>(null);

  // Sync props to internal state
  useEffect(() => {
    setMascotState(initialMascotState);
  }, [initialMascotState]);

  useEffect(() => {
    setIsCapturing(initialIsCapturing);
  }, [initialIsCapturing]);

  // IPC Cross-Window Synchronization (Electron)
  useEffect(() => {
    if (window.electronAPI) {
      const unsubState = window.electronAPI.onMeetingStateUpdate((state: any) => {
        if (state.meetingId) setCurrentMeetingId(state.meetingId);
        if (state.mascotState) setMascotState(state.mascotState);
        if (state.isCapturing !== undefined) setIsCapturing(state.isCapturing);

        if (state.latestTranscript) {
          setLatestTranscript(state.latestTranscript);
          if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
          transcriptTimerRef.current = setTimeout(() => {
            setLatestTranscript('');
          }, 8000);
        }

        if (state.latestNotification) {
          setLatestNotification(state.latestNotification);
          setMascotState('important_update');

          // Auto-clear notification after 4 seconds so it never stays stuck
          if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
          notifTimerRef.current = setTimeout(() => {
            setLatestNotification(null);
            setMascotState(state.isCapturing ? 'listening' : 'idle');
          }, 4000);
        }
      });

      const unsubUpdate = window.electronAPI.onShowAssistantUpdate((data: any) => {
        if (data.notification) {
          setLatestNotification(data.notification);
          setMascotState('important_update');
          if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
          notifTimerRef.current = setTimeout(() => {
            setLatestNotification(null);
            setMascotState(isCapturing ? 'listening' : 'idle');
          }, 4000);
        }
      });

      return () => {
        unsubState?.();
        unsubUpdate?.();
        if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
        if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      };
    }
  }, [isCapturing]);

  // ── Actions ────────────────────────────────────────────────────────────

  // 1. END RECORDING: Stops capture, finalizes meeting, and opens summary
  const handleEndRecording = () => {
    setIsMenuOpen(false);
    setIsCapturing(false);
    setMascotState('ended');

    // Trigger local callback if running in single-window mode
    if (onStopMeeting) {
      onStopMeeting();
    }

    // Broadcast action to main window to flush final audio chunk and finalize
    if (window.electronAPI) {
      window.electronAPI.syncMeetingState({
        action: 'end_meeting',
        mascotState: 'ended',
        isCapturing: false,
      });
      // Bring main window to front to view the finalized meeting summary
      window.electronAPI.openMainWindow('live');
    }
  };

  // 2. GO TO DASHBOARD: Focuses main window on dashboard
  const handleOpenDashboard = (route: string = 'dashboard') => {
    setIsMenuOpen(false);
    if (onOpenDashboard) {
      onOpenDashboard(route);
    }
    if (window.electronAPI) {
      window.electronAPI.openMainWindow(route);
    }
  };

  // 3. LIVE TRANSCRIBING: Toggle subtitle pill & open live assistant
  const handleLiveTranscribing = () => {
    setShowTranscript((prev) => !prev);
    if (window.electronAPI) {
      window.electronAPI.openMainWindow('live');
    }
    setIsMenuOpen(false);
  };

  // 4. PAUSE / RESUME AUDIO
  const handleTogglePause = () => {
    setIsMenuOpen(false);
    if (isCapturing) {
      onPauseCapture?.();
      setIsCapturing(false);
      setMascotState('paused');
      if (window.electronAPI) {
        window.electronAPI.syncMeetingState({ action: 'pause_capture', mascotState: 'paused', isCapturing: false });
      }
    } else {
      onResumeCapture?.();
      setIsCapturing(true);
      setMascotState('listening');
      if (window.electronAPI) {
        window.electronAPI.syncMeetingState({ action: 'resume_capture', mascotState: 'listening', isCapturing: true });
      }
    }
  };

  // 5. HIDE MASCOT
  const handleHideMascot = () => {
    setIsMenuOpen(false);
    if (window.electronAPI) {
      window.electronAPI.toggleFloating(false);
    }
  };

  // 6. ASK MASCOT
  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;

    setIsAsking(true);
    setMascotState('processing');

    try {
      const res = await askMeetingQuestion(currentMeetingId, question.trim());
      setAnswer(res.answer);
      setMascotState(isCapturing ? 'listening' : 'idle');
    } catch (err: any) {
      setAnswer('Could not reach intelligence engine. Please check backend.');
      setMascotState('error');
      setTimeout(() => setMascotState(isCapturing ? 'listening' : 'idle'), 3000);
    } finally {
      setIsAsking(false);
    }
  };

  // Dynamic bubble message above the mascot's head
  const getDynamicBubbleText = (): string => {
    if (latestNotification) {
      return latestNotification.title;
    }
    if (latestTranscript) {
      return latestTranscript.length > 35 ? latestTranscript.slice(0, 32) + '...' : latestTranscript;
    }
    if (isCapturing) {
      return 'Listening to voices...';
    }
    if (mascotState === 'paused') {
      return 'Audio Paused';
    }
    if (mascotState === 'ended') {
      return 'Meeting Finalized!';
    }
    return 'Ready & Listening';
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-end bg-transparent relative select-none font-sans overflow-visible p-2">
      {/* ── CLICK-OUTSIDE DISMISSER ───────────────────────────────────────── */}
      {(isMenuOpen || isAskOpen) && (
        <div
          className="fixed inset-0 z-0 bg-transparent"
          onClick={() => {
            setIsMenuOpen(false);
            setIsAskOpen(false);
          }}
          style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
        />
      )}

      {/* ── 1. ASK MASCOT INLINE POPOVER (BLUE & WHITE) ───────────────────── */}
      {isAskOpen && (
        <div
          className="w-[240px] mb-2 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-blue-200 shadow-2xl text-slate-800 animate-fadeIn relative z-10"
          style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-blue-100 mb-2">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Ask Mascot
            </span>
            <button
              onClick={() => {
                setIsAskOpen(false);
                setAnswer(null);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <form onSubmit={handleAskSubmit} className="flex gap-1.5">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What was decided on...?"
              className="flex-1 bg-slate-50 border border-blue-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={isAsking || !question.trim()}
              className="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {isAsking && (
            <div className="mt-2 text-[11px] text-blue-600 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
              Thinking...
            </div>
          )}

          {answer && !isAsking && (
            <div className="mt-2 pt-2 border-t border-blue-100 text-[11px] text-slate-700 leading-relaxed max-h-[90px] overflow-y-auto">
              {answer}
            </div>
          )}
        </div>
      )}

      {/* ── 2. QUICK ACTIONS MENU (BLUE & WHITE CLEAN THEME) ─────────────── */}
      {isMenuOpen && !isAskOpen && (
        <div
          className="w-[220px] mb-2 p-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-blue-200 shadow-2xl flex flex-col gap-0.5 text-slate-800 animate-fadeIn relative z-10"
          style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
        >
          {/* Option: End Recording */}
          <button
            onClick={handleEndRecording}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all text-left group"
          >
            <Square className="w-3.5 h-3.5 fill-current text-rose-500 group-hover:scale-110 transition-transform" />
            <span>End Recording</span>
          </button>

          {/* Option: Go to Dashboard */}
          <button
            onClick={() => handleOpenDashboard('dashboard')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition-all text-left group"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span>Go to Dashboard</span>
          </button>

          {/* Option: Live Transcribing */}
          <button
            onClick={handleLiveTranscribing}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 transition-all text-left group"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <div className="flex-1 flex items-center justify-between">
              <span>Live Transcribing</span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                showTranscript ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500'
              }`}>
                {showTranscript ? 'ON' : 'OFF'}
              </span>
            </div>
          </button>

          {/* Option: Pause / Resume Audio */}
          <button
            onClick={handleTogglePause}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition-all text-left group"
          >
            {isCapturing ? (
              <>
                <MicOff className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                <span>Pause Audio</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                <span>Resume Audio</span>
              </>
            )}
          </button>

          {/* Option: Ask Mascot */}
          <button
            onClick={() => setIsAskOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition-all text-left group"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span>Ask Mascot</span>
          </button>

          {/* Option: Hide Mascot */}
          <button
            onClick={handleHideMascot}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all text-left mt-0.5 border-t border-slate-100"
          >
            <X className="w-3.5 h-3.5" />
            <span>Hide Mascot</span>
          </button>
        </div>
      )}

      {/* ── 3. FLOATING LIVE TRANSCRIPTION SUBTITLE PILL ─────────────────── */}
      {latestTranscript && showTranscript && !isMenuOpen && !isAskOpen && (
        <div
          className="max-w-[260px] mb-2 px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-blue-200 text-center shadow-xl animate-fadeIn relative z-10"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <p className="text-xs font-semibold text-blue-950 line-clamp-3 leading-relaxed">
            "{latestTranscript}"
          </p>
        </div>
      )}

      {/* ── 4. NOTIFICATION PILL ─────────────────────────────────────────── */}
      {latestNotification && !latestTranscript && !isMenuOpen && !isAskOpen && (
        <div
          onClick={() => handleOpenDashboard('live')}
          className="max-w-[230px] mb-2 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer hover:bg-blue-100 transition-all animate-fadeIn relative z-10"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
          <span className="truncate">{latestNotification.title}</span>
        </div>
      )}

      {/* ── 5. THE FIDGET MASCOT ITSELF ──────────────────────────────────── */}
      <div className="flex flex-col items-center relative z-20">
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
          }}
          className="p-1 rounded-2xl hover:bg-blue-50/50 active:scale-95 transition-all outline-none border-none bg-transparent cursor-pointer relative"
          style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
          title="Click mascot for quick actions"
        >
          <CuteMascot
            state={mascotState}
            size="md"
            showMoodBubble={!isMenuOpen && !isAskOpen}
            bubbleText={getDynamicBubbleText()}
          />
        </div>

        {/* Draggable Handle Pill (Blue & White Theme) */}
        <div
          className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-sm border border-blue-200 text-[9px] font-bold tracking-wider text-slate-700 cursor-move shadow-md select-none hover:bg-blue-50 transition-colors"
          style={{ WebkitAppRegion: 'drag' } as any}
          title="Drag to move mascot anywhere on desktop"
        >
          <GripHorizontal className="w-3 h-3 text-blue-500" />
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isCapturing ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <span className="text-[9px] font-extrabold tracking-wider uppercase text-slate-800">
            {isCapturing ? 'REC' : 'READY'}
          </span>
        </div>
      </div>
    </div>
  );
}
