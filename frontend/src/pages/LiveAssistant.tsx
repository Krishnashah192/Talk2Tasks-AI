// Talk2Tasks AI — Live Meeting Assistant Dashboard
// Blue & White Theme: Dual-source audio capture (User Mic + Meeting System Audio),
// instant non-blocking End Recording, real-time audio visualizers, and Mascot sync.

import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Search,
  Sparkles,
  Bot,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Volume2,
  FileText,
  ListTodo,
  CheckSquare,
  RefreshCw,
  Layers,
  Download,
  Laptop,
  Radio,
  User,
  Users,
  Globe,
} from 'lucide-react';
import type {
  Meeting,
  TranscriptSegment,
  Decision,
  ActionItem,
  MeetingNotes,
  MeetingDetection,
  LiveAssistantNotification,
  MeetingQuestionAnswer,
} from '../types';
import {
  createMeeting,
  detectMeetings,
  sendAudioChunk,
  askMeetingQuestion,
  completeLiveMeeting,
  exportMeeting,
} from '../services/api';
import { AudioCaptureService, AudioCaptureConfig } from '../services/audioCapture';
import CuteMascot from '../components/CuteMascot';

interface LiveAssistantProps {
  onOpenFloating?: () => void;
  onNavigateToHistory?: () => void;
}

export default function LiveAssistant({ onOpenFloating, onNavigateToHistory }: LiveAssistantProps) {
  // ── Detection State ──────────────────────────────────────────────────
  const [isScanning, setIsScanning] = useState(false);
  const [detections, setDetections] = useState<MeetingDetection[]>([]);
  const [selectedDetection, setSelectedDetection] = useState<MeetingDetection | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [scanPerformed, setScanPerformed] = useState(false);

  // ── Audio Source & Consent (Default: BOTH User Mic + Meeting System Audio) ──
  const [audioSourceType, setAudioSourceType] = useState<'system' | 'microphone' | 'both'>('both');
  const [desktopSources, setDesktopSources] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDesktopSourceId, setSelectedDesktopSourceId] = useState<string>('');
  const [consentConfirmed, setConsentConfirmed] = useState(true);

  // ── Active Session State ─────────────────────────────────────────────
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [systemLevel, setSystemLevel] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [notifications, setNotifications] = useState<LiveAssistantNotification[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizedMeeting, setFinalizedMeeting] = useState<Meeting | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'tasks' | 'notes' | 'ask'>('transcript');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  // ── Grounded Q&A State ───────────────────────────────────────────────
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<MeetingQuestionAnswer | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────
  const audioServiceRef = useRef<AudioCaptureService | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const activeMeetingRef = useRef<Meeting | null>(null);

  useEffect(() => {
    activeMeetingRef.current = activeMeeting;
  }, [activeMeeting]);

  // Load available desktop sources if running in Electron
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getDesktopSources().then((sources) => {
        setDesktopSources(sources);
        if (sources.length > 0) {
          const screenSource = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
          setSelectedDesktopSourceId(screenSource.id);
        }
      });
    }
  }, []);

  // Timer runner
  useEffect(() => {
    if (isCapturing) {
      timerIntervalRef.current = window.setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isCapturing]);

  // Auto-scroll transcript
  useEffect(() => {
    if (activeTab === 'transcript') {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMeeting?.transcript, activeTab]);

  // Automatically scan on page mount
  useEffect(() => {
    handleScanMeetings();
  }, []);

  // ── STEP 1: DETECT LIVE MEETINGS ──────────────────────────────────────
  const handleScanMeetings = async () => {
    setIsScanning(true);
    setScanPerformed(true);
    try {
      let found: MeetingDetection[] = [];

      if (window.electronAPI) {
        try {
          const electronDetections = await window.electronAPI.detectMeetings();
            found = electronDetections.map((d: any) => ({
              id: d.id || `${d.processName}_${Math.random().toString(36).substring(7)}`,
              platform: (d.platform.toLowerCase().includes('meet') ? 'google_meet' : d.platform.toLowerCase()) as any,
              title: d.title || d.meetingTitle,
              confidence: d.confidence as any,
              process_name: d.processName || 'browser',
              window_title: d.windowTitle || d.title,
              status: d.status,
              notes: d.notes || '',
              audio_capture_method: d.audioCaptureMethod || d.audioMethod || 'Windows WASAPI Loopback Capture',
              detection_method: d.detectionMethod || 'Process & Window inspection',
            }));
        } catch (e) {
          console.warn('Electron window scanner error:', e);
        }
      }

      if (found.length === 0) {
        try {
          const res = await detectMeetings();
          if (res.detections && res.detections.length > 0) {
            found = res.detections;
          }
        } catch (apiErr) {
          console.warn('Backend process scan fallback error:', apiErr);
        }
      }

      setDetections(found);
      if (found.length > 0) {
        setSelectedDetection(found[0]);
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // ── STEP 2: START MEETING & DUAL AUDIO CAPTURE ────────────────────────
  const handleStartLiveAssistant = async () => {
    const meetingTitle = selectedDetection
      ? selectedDetection.title
      : customTitle.trim() || 'Live Meeting Session';

    try {
      // 1. Create meeting in SQLite backend
      const newMeeting = await createMeeting(meetingTitle);
      setActiveMeeting(newMeeting);
      activeMeetingRef.current = newMeeting;
      setIsSessionActive(true);
      setDurationSeconds(0);
      setNotifications([]);
      setFinalizedMeeting(null);

      // 2. Launch Electron Floating Mascot Companion
      if (window.electronAPI) {
        await window.electronAPI.toggleFloating(true);
        window.electronAPI.syncMeetingState({
          meetingId: newMeeting.id,
          mascotState: 'listening',
          isCapturing: true,
        });
      } else if (onOpenFloating) {
        onOpenFloating();
      }

      // 3. Initialize Audio Capture Service with Dual Audio by default
      const config: AudioCaptureConfig = {
        sourceType: audioSourceType,
        desktopSourceId: selectedDesktopSourceId || undefined,
        chunkDurationMs: 5000, // 5-second slices
      };

      const audioService = new AudioCaptureService(config);
      audioServiceRef.current = audioService;

      audioService.onVolumeLevel = (lvl) => setVolumeLevel(lvl);
      audioService.onMicLevel = (lvl) => setMicLevel(lvl);
      audioService.onSystemLevel = (lvl) => setSystemLevel(lvl);

      audioService.onStateChange = (st) => {
        setIsCapturing(st === 'recording');
      };

      audioService.onChunkAvailable = async (blob, offsetSec) => {
        try {
          const currentMeeting = activeMeetingRef.current || newMeeting;
          const chunkRes = await sendAudioChunk(currentMeeting.id, blob, offsetSec);
          if (chunkRes.detected_language) {
            const probText = chunkRes.detected_language_probability
              ? ` (${Math.round(chunkRes.detected_language_probability * 100)}%)`
              : '';
            setDetectedLanguage(`${chunkRes.detected_language}${probText}`);
          }

          if (chunkRes.new_segments && chunkRes.new_segments.length > 0) {
            setActiveMeeting((prev) => {
              if (!prev) return null;
              const merged = [...prev.transcript, ...chunkRes.new_segments];
              const updated = {
                ...prev,
                transcript: merged,
                duration_seconds: chunkRes.duration || prev.duration_seconds,
              };
              activeMeetingRef.current = updated;
              return updated;
            });

            generateLiveNotifications(chunkRes.new_segments);

            // Sync latest transcript text to floating mascot bubble
            if (window.electronAPI) {
              const latestSeg = chunkRes.new_segments[chunkRes.new_segments.length - 1];
              window.electronAPI.syncMeetingState({
                latestTranscript: latestSeg.text,
                isCapturing: true,
                mascotState: 'listening',
              });
            }
          }
        } catch (chunkErr) {
          console.warn('Chunk transcription error:', chunkErr);
        }
      };

      audioService.onError = (err) => {
        console.error('Audio capture error:', err);
      };

      await audioService.startCapture();
      setIsCapturing(true);

      addNotification({
        id: `start-${Date.now()}`,
        type: 'info',
        title: 'Meeting Recording Started',
        message: audioSourceType === 'both'
          ? 'Dual audio active: capturing your microphone voice and meeting participants.'
          : `Listening to ${audioSourceType} audio.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err: any) {
      console.error('Failed to start live assistant:', err);
      alert(`Could not start meeting assistant: ${err.message}`);
    }
  };

  // Inspect incoming segments for action items / decisions / deadlines / conclusions
  const generateLiveNotifications = (segments: TranscriptSegment[]) => {
    const fullChunkText = segments.map((s) => s.text).join(' ');
    const lower = fullChunkText.toLowerCase();

    // 1. Conclusion & Decision Triggers (Multilingual & English)
    const conclusionTriggers = [
      'conclusion', 'conclude', 'decided', 'decision', 'agree', 'agreed',
      'consensus', 'approved', 'finalized', 'chosen', 'will go with',
      'moving forward with', 'resolved', 'outcome', 'faisla', 'nishkarsh', 'tay hua'
    ];
    if (conclusionTriggers.some((w) => lower.includes(w))) {
      addNotification({
        id: `dec-${Date.now()}`,
        type: 'decision',
        title: 'Conclusion / Decision Identified',
        message: 'The team reached an agreement, consensus, or key project conclusion.',
        quote: fullChunkText.slice(0, 130),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // 2. Deadline Triggers
    const deadlineRegex = /\b(?:by|due(?: on)?|before|deadline|target date)\s+([A-Za-z0-9]+(?:\s+(?:eod|pm|am|morning|evening|week|days?|hours?|[A-Za-z0-9]+)){0,3})/i;
    const deadlineMatch = fullChunkText.match(deadlineRegex);
    if (deadlineMatch || lower.includes('tomorrow') || lower.includes('eod') || lower.includes('kal tak')) {
      const deadlineStr = deadlineMatch ? deadlineMatch[0] : (lower.includes('tomorrow') ? 'due tomorrow' : 'target deadline');
      addNotification({
        id: `dl-${Date.now()}`,
        type: 'deadline',
        title: 'Target Deadline Mentioned',
        message: `Timeframe commitment detected: "${deadlineStr}"`,
        quote: fullChunkText.slice(0, 130),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // 3. Action Item & Task Triggers
    const taskTriggers = [
      'action item', 'will do', 'will finish', 'will complete', 'will deploy',
      'assigned to', 'take care of', 'follow up', 'needs to', 'responsible for',
      'todo', 'karenge', 'karna hai', 'dekh lega', 'zimmadari'
    ];
    if (taskTriggers.some((w) => lower.includes(w))) {
      addNotification({
        id: `task-${Date.now()}`,
        type: 'task',
        title: 'Action Item / Task Detected',
        message: 'A task deliverable or ownership commitment was verbalized.',
        quote: fullChunkText.slice(0, 130),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  const addNotification = (notif: LiveAssistantNotification) => {
    setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
    if (window.electronAPI) {
      window.electronAPI.syncMeetingState({
        latestNotification: notif,
        mascotState: notif.type === 'task' || notif.type === 'decision' ? 'important_update' : 'listening',
      });
    }
  };

  // ── PAUSE / RESUME AUDIO ──────────────────────────────────────────────
  const handleTogglePause = () => {
    if (!audioServiceRef.current) return;
    if (isCapturing) {
      audioServiceRef.current.pauseCapture();
      setIsCapturing(false);
      if (window.electronAPI) {
        window.electronAPI.syncMeetingState({ mascotState: 'paused', isCapturing: false });
      }
    } else {
      audioServiceRef.current.resumeCapture();
      setIsCapturing(true);
      if (window.electronAPI) {
        window.electronAPI.syncMeetingState({ mascotState: 'listening', isCapturing: true });
      }
    }
  };

  // ── END RECORDING & FINALIZATION (GRACEFUL & ACCURATE) ──────────────
  const handleEndMeeting = async () => {
    const targetMeeting = activeMeetingRef.current || activeMeeting;
    if (!targetMeeting) return;

    setIsFinalizing(true);

    // 1. Gracefully stop audio capture and capture final spoken words
    if (audioServiceRef.current) {
      try {
        const finalChunk = await audioServiceRef.current.stopCapture();
        if (finalChunk && finalChunk.size > 0) {
          try {
            const chunkRes = await sendAudioChunk(
              targetMeeting.id,
              finalChunk,
              audioServiceRef.current.getOffsetSeconds()
            );
            if (chunkRes.new_segments && chunkRes.new_segments.length > 0) {
              setActiveMeeting((prev) => {
                if (!prev) return null;
                const merged = [...prev.transcript, ...chunkRes.new_segments];
                const updated = {
                  ...prev,
                  transcript: merged,
                  duration_seconds: chunkRes.duration || prev.duration_seconds,
                };
                activeMeetingRef.current = updated;
                return updated;
              });
            }
          } catch (chunkErr) {
            console.warn('Final audio chunk processing error:', chunkErr);
          }
        }
      } catch (e) {
        console.warn('Error stopping audio capture:', e);
      }
      audioServiceRef.current = null;
    }
    setIsCapturing(false);

    // 2. Finalize meeting in SQLite backend
    try {
      const finalResult = await completeLiveMeeting(targetMeeting.id);
      setFinalizedMeeting(finalResult);
      setActiveMeeting(finalResult);
      activeMeetingRef.current = finalResult;
      setIsSessionActive(false);

      if (window.electronAPI) {
        window.electronAPI.syncMeetingState({
          mascotState: 'ended',
          isCapturing: false,
          latestNotification: {
            id: `end-${Date.now()}`,
            type: 'info',
            title: 'Meeting Successfully Finalized',
            message: 'All tasks, notes, and follow-up email are saved.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        });
      }
    } catch (err: any) {
      console.error('Failed to complete live meeting:', err);
      // Fallback: Show meeting as completed with current transcript
      setFinalizedMeeting(targetMeeting);
      setIsSessionActive(false);
    } finally {
      setIsFinalizing(false);
    }
  };

  // ── LISTEN FOR ACTIONS FROM FLOATING MASCOT ───────────────────────────
  useEffect(() => {
    if (window.electronAPI) {
      const unsub = window.electronAPI.onMeetingStateUpdate((state: any) => {
        if (state.action === 'end_meeting') {
          handleEndMeeting();
        } else if (state.action === 'pause_capture') {
          if (audioServiceRef.current && isCapturing) {
            handleTogglePause();
          }
        } else if (state.action === 'resume_capture') {
          if (audioServiceRef.current && !isCapturing) {
            handleTogglePause();
          }
        }
      });
      return unsub;
    }
  }, [isCapturing]);

  // ── GROUNDED Q&A ──────────────────────────────────────────────────────
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = activeMeetingRef.current || activeMeeting;
    if (!questionInput.trim() || !target || isAsking) return;

    setIsAsking(true);
    try {
      const answer = await askMeetingQuestion(target.id, questionInput.trim());
      setCurrentAnswer(answer);
    } catch (err: any) {
      setCurrentAnswer({
        answer: 'Failed to retrieve answer: ' + err.message,
        sources: [],
        confidence: 0,
      });
    } finally {
      setIsAsking(false);
    }
  };

  // ── EXPORT MARKDOWN ──────────────────────────────────────────────────
  const handleExport = async () => {
    const target = finalizedMeeting || activeMeetingRef.current || activeMeeting;
    if (!target) return;
    try {
      const markdown = await exportMeeting(target.id);
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${target.title.replace(/\s+/g, '_')}_summary.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export meeting notes.');
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn font-sans">
      {/* ── HEADER (BLUE & WHITE THEME) ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-blue-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center">
              <CuteMascot
                state={isCapturing ? 'listening' : isSessionActive ? 'idle' : 'waiting_confirmation'}
                size="sm"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Live Meeting Assistant
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Dual Audio AI
                </span>
              </h1>
              <p className="text-slate-500 text-sm mt-0.5 font-medium">
                Captures both your microphone voice & meeting participants with on-device Faster-Whisper intelligence.
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions in header */}
        <div className="flex items-center gap-3">
          {window.electronAPI && (
            <button
              onClick={() => window.electronAPI?.toggleFloating(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 flex items-center gap-2 transition-all shadow-xs"
            >
              <Bot className="w-4 h-4 text-blue-600" />
              Show Mascot Companion
            </button>
          )}

          {isSessionActive && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-emerald-700">
                {formatTimer(durationSeconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── PRE-MEETING SETUP: DETECTION & SOURCE CARD ────────────────── */}
      {!isSessionActive && !finalizedMeeting && (
        <div className="space-y-6">
          {/* Hero Scan Banner */}
          <div className="p-6 rounded-2xl bg-white border border-blue-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                Detect Active Meetings
              </h2>
              <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                Automatically scans for Google Meet (Chrome / Edge / Brave), Zoom, Microsoft Teams, and Webex calls.
              </p>
            </div>

            <button
              onClick={handleScanMeetings}
              disabled={isScanning}
              className="px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-2.5 transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning Processes...' : 'Detect Active Call'}
            </button>
          </div>

          {/* Detection Results */}
          {scanPerformed && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Detected Meeting Calls ({detections.length})
              </h3>

              {detections.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2 shadow-xs">
                  <Laptop className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-800 font-semibold">
                    No active video calls detected automatically.
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    You can start recording right away by choosing a title and audio source below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detections.map((d, idx) => {
                    const isSelected = selectedDetection?.id === d.id || selectedDetection?.title === d.title;
                    return (
                      <div
                        key={d.id || idx}
                        onClick={() => setSelectedDetection(d)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 shadow-md shadow-blue-500/10'
                            : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {d.platform.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Confirmed
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 mt-2.5 truncate">
                          {d.title}
                        </h4>

                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                          <p className="truncate">
                            <span className="font-semibold text-slate-700">Process:</span> {d.process_name}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                            {d.notes}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Setup & Audio Options (Blue & White Card) */}
          <div className="p-6 rounded-2xl bg-white border border-blue-100 shadow-sm space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Meeting Session Title
              </label>
              <input
                type="text"
                value={selectedDetection ? selectedDetection.title : customTitle}
                onChange={(e) => {
                  setSelectedDetection(null);
                  setCustomTitle(e.target.value);
                }}
                placeholder="e.g. Sprint Sync / Architecture Review"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Audio Source Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Audio Capture Mode (Captures Your Voice + Meeting Voices)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Option: Dual Mixed Audio (RECOMMENDED) */}
                <div
                  onClick={() => setAudioSourceType('both')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    audioSourceType === 'both'
                      ? 'bg-blue-50 border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-xs text-slate-900">Dual Audio (Recommended)</span>
                    </div>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                      BEST
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Captures <strong>both your microphone</strong> (your voice) AND <strong>system speakers</strong> (meeting participants).
                  </p>
                </div>

                {/* Option: Microphone Only */}
                <div
                  onClick={() => setAudioSourceType('microphone')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    audioSourceType === 'microphone'
                      ? 'bg-blue-50 border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs text-slate-900">Microphone Only</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Records only what you say through your connected microphone.
                  </p>
                </div>

                {/* Option: System Loopback Only */}
                <div
                  onClick={() => setAudioSourceType('system')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    audioSourceType === 'system'
                      ? 'bg-blue-50 border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs text-slate-900">System Audio (Speakers)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Records only remote meeting attendees speaking through your computer.
                  </p>
                </div>
              </div>
            </div>

            {/* Target Screen / Window for Electron System Capture */}
            {window.electronAPI && desktopSources.length > 0 && (audioSourceType === 'system' || audioSourceType === 'both') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Desktop Audio Source (Select your screen or meeting window)
                </label>
                <select
                  value={selectedDesktopSourceId}
                  onChange={(e) => setSelectedDesktopSourceId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                >
                  {desktopSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Privacy & Consent Banner */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>100% Private On-Device Recording:</strong> All audio is sliced and transcribed locally using Faster-Whisper. Nothing is sent to cloud surveillance servers.
              </p>
            </div>

            {/* Start Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleStartLiveAssistant}
                className="px-8 py-3.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 flex items-center gap-2.5 transition-all"
              >
                <Radio className="w-5 h-5 animate-pulse" />
                Start Assistant & Audio Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE MEETING SESSION SCREEN ──────────────────────────────── */}
      {isSessionActive && activeMeeting && (
        <div className="space-y-6">
          {/* Active Control Bar (Clean Blue & White Card) */}
          <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-md flex flex-col lg:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <CuteMascot state={isCapturing ? 'listening' : 'paused'} size="sm" />
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isCapturing ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
                  <h2 className="text-base font-bold text-slate-900 truncate max-w-sm">
                    {activeMeeting.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {formatTimer(durationSeconds)}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-emerald-700">
                    {isCapturing ? 'Recording Voice & Meeting' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dual Audio Activity Visualizers (Your Voice + Meeting Audio) */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              {/* Mic Visualizer (User's Voice) */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-slate-700 text-[11px]">Your Mic:</span>
                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.max(8, micLevel * 100))}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold px-1.5 rounded ${micLevel > 0.15 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}>
                  {micLevel > 0.15 ? 'Speaking' : 'Idle'}
                </span>
              </div>

              {/* System Loopback Visualizer (Meeting Participants) */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-slate-700 text-[11px]">Meeting:</span>
                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.max(8, systemLevel * 100))}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold px-1.5 rounded ${systemLevel > 0.15 ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`}>
                  {systemLevel > 0.15 ? 'Active' : 'Idle'}
                </span>
              </div>

              {/* Multilingual Live Detection Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 font-semibold shadow-2xs">
                <Globe className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                <span>{detectedLanguage ? `Language: ${detectedLanguage}` : '🌐 Auto-Detecting Language...'}</span>
              </div>
            </div>

            {/* Pause & Prominent End Recording Buttons */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
              <button
                onClick={handleTogglePause}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
              >
                {isCapturing ? <MicOff className="w-4 h-4 text-amber-600" /> : <Mic className="w-4 h-4 text-blue-600" />}
                {isCapturing ? 'Pause Audio' : 'Resume Audio'}
              </button>

              {/* Prominent High-Visibility END RECORDING Button */}
              <button
                onClick={handleEndMeeting}
                disabled={isFinalizing}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                {isFinalizing ? 'Finalizing Meeting...' : 'End Recording'}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'transcript'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              Live Transcript ({activeMeeting.transcript.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'tasks'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Tasks & Decisions ({activeMeeting.action_items.length + activeMeeting.decisions.length})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'notes'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Assistant Feed ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('ask')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'ask'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Bot className="w-4 h-4" />
              Ask AI Question
            </button>
          </div>

          {/* ── TAB CONTENT: TRANSCRIPT ─────────────────────────────────── */}
          {activeTab === 'transcript' && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 min-h-[360px] max-h-[500px] overflow-y-auto">
              {activeMeeting.transcript.length === 0 ? (
                <div className="text-center py-20 text-slate-400 space-y-3">
                  <Mic className="w-8 h-8 mx-auto text-blue-600 animate-bounce" />
                  <p className="text-sm font-medium text-slate-600">
                    Listening to spoken audio... Faster-Whisper will stream live transcript segments here.
                  </p>
                </div>
              ) : (
                activeMeeting.transcript.map((seg, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 flex items-start gap-3">
                    <span className="text-[11px] font-mono text-blue-700 font-bold px-2 py-0.5 rounded bg-blue-100 shrink-0">
                      {formatTimer(Math.floor(seg.start_time))}
                    </span>
                    <div className="flex-1">
                      {seg.speaker && (
                        <span className="text-xs font-bold text-slate-700 mr-2">
                          {seg.speaker}:
                        </span>
                      )}
                      <span className="text-sm text-slate-800 font-medium leading-relaxed">{seg.text}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {/* ── TAB CONTENT: DECISIONS & TASKS ─────────────────────────── */}
          {activeTab === 'tasks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Decisions Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Confirmed Decisions ({activeMeeting.decisions.length})
                </h3>
                {activeMeeting.decisions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center font-medium">
                    No decisions extracted yet. Decisions will be extracted live as agreements are reached.
                  </p>
                ) : (
                  activeMeeting.decisions.map((d, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <p className="font-semibold text-slate-800">{d.description}</p>
                      {d.source_quote && (
                        <p className="text-[11px] text-slate-500 italic">"{d.source_quote}"</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Action Items Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-blue-600" />
                  Action Items & Deadlines ({activeMeeting.action_items.length})
                </h3>
                {activeMeeting.action_items.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center font-medium">
                    No tasks detected yet. Commitments made during speech are recorded automatically.
                  </p>
                ) : (
                  activeMeeting.action_items.map((a, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{a.task_description}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-700">
                          {a.owner || 'Unassigned'}
                        </span>
                      </div>
                      {a.deadline && (
                        <p className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" /> Due: {a.deadline}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── TAB CONTENT: ASSISTANT FEED ────────────────────────────── */}
          {activeTab === 'notes' && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 max-h-[460px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10 font-medium">
                  Feed active. Key moments, decisions, and deadlines will appear here.
                </p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-800">{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                    </div>
                    <p className="text-slate-700">{n.message}</p>
                    {n.quote && (
                      <p className="text-[11px] text-slate-500 italic border-l-2 border-blue-400 pl-2">
                        "{n.quote}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── TAB CONTENT: GROUNDED Q&A ───────────────────────────────── */}
          {activeTab === 'ask' && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <form onSubmit={handleAskQuestion} className="flex gap-2">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="e.g. What were the next steps agreed upon?"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={isAsking || !questionInput.trim()}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isAsking ? 'Thinking...' : 'Ask AI'}
                </button>
              </form>

              {currentAnswer && (
                <div className="p-5 rounded-xl bg-blue-50/70 border border-blue-200 text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" /> Grounded Intelligence Answer
                    </span>
                    <span className="text-[10px] text-blue-700 font-mono font-bold">
                      Confidence: {Math.round(currentAnswer.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-slate-800 leading-relaxed font-medium">{currentAnswer.answer}</p>
                  {currentAnswer.sources && currentAnswer.sources.length > 0 && (
                    <div className="pt-2 border-t border-blue-200/60">
                      <p className="text-[11px] text-slate-500 uppercase font-bold">Supporting Transcript Quote:</p>
                      <p className="text-xs text-slate-600 italic mt-0.5">"{currentAnswer.sources[0]}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FINALIZED MEETING REVIEW SCREEN (BLUE & WHITE CARD) ────────── */}
      {finalizedMeeting && (
        <div className="p-8 rounded-2xl bg-white border border-blue-200 space-y-6 shadow-xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {finalizedMeeting.title}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Session duration: {formatTimer(finalizedMeeting.duration_seconds || durationSeconds)} • Saved to local database.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4 text-blue-600" />
                Export Markdown
              </button>

              <button
                onClick={() => {
                  setFinalizedMeeting(null);
                  setActiveMeeting(null);
                  setIsSessionActive(false);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                Start New Session
              </button>
            </div>
          </div>

          {/* Executive Summary */}
          {finalizedMeeting.notes && (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Executive Summary</h3>
              <p className="text-sm text-slate-800 leading-relaxed font-medium">{finalizedMeeting.notes.summary}</p>
            </div>
          )}

          {/* Key Decisions */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Key Decisions</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {finalizedMeeting.decisions?.length || 0} identified
              </span>
            </h3>
            {finalizedMeeting.decisions && finalizedMeeting.decisions.length > 0 ? (
              <ul className="space-y-2">
                {finalizedMeeting.decisions.map((d, i) => (
                  <li key={i} className="text-sm text-slate-800 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{d.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">No formal decisions recorded in this session.</p>
            )}
          </div>

          {/* Action Items */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Action Items & Tasks</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {finalizedMeeting.action_items?.length || 0} assigned
              </span>
            </h3>
            {finalizedMeeting.action_items && finalizedMeeting.action_items.length > 0 ? (
              <div className="space-y-2">
                {finalizedMeeting.action_items.map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.task_description}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-medium">
                        <span>👤 Owner: {item.owner || 'Unassigned'}</span>
                        <span>📅 Due: {item.deadline || 'TBD'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {item.status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No action items detected.</p>
            )}
          </div>

          {/* Follow-up Email Draft */}
          {finalizedMeeting.email_draft && (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Follow-up Email Draft</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(finalizedMeeting.email_draft!.full_text);
                    alert('Follow-up email copied to clipboard!');
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Copy to Clipboard
                </button>
              </div>
              <p className="text-xs font-bold text-blue-900">Subject: {finalizedMeeting.email_draft.subject}</p>
              <pre className="text-xs text-slate-700 font-sans whitespace-pre-wrap bg-white p-4 rounded-xl border border-slate-200 leading-relaxed">
                {finalizedMeeting.email_draft.full_text}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
