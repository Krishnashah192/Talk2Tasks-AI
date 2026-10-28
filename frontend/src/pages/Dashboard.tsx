// Talk2Tasks AI — Dashboard Page (Main View)

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Square, Upload, Zap, Clock, Activity,
  AlertCircle, CheckCircle2, Cpu, Wifi, WifiOff, Bot,
} from 'lucide-react';
import type {
  Meeting, HealthStatus, TranscriptSegment, DemoData,
  MeetingNotes, Decision, ActionItem, EmailDraft, AnalysisSource,
} from '../types';
import * as api from '../services/api';
import TranscriptPanel from '../components/TranscriptPanel';
import NotesPanel from '../components/NotesPanel';
import DecisionsPanel from '../components/DecisionsPanel';
import ActionItemsTable from '../components/ActionItemsTable';
import EmailEditor from '../components/EmailEditor';

type DemoState = 'idle' | 'playing' | 'paused' | 'completed';

interface DashboardProps {
  onDetectLive?: () => void;
}

export default function Dashboard({ onDetectLive }: DashboardProps) {

  // ── State ─────────────────────────────────────────────────────────
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [title, setTitle] = useState('');

  // Demo state
  const [demoState, setDemoState] = useState<DemoState>('idle');
  const [demoData, setDemoData] = useState<DemoData | null>(null);
  const [demoChunkIndex, setDemoChunkIndex] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [demoSpeed, setDemoSpeed] = useState(1);

  // Analysis
  const [notes, setNotes] = useState<MeetingNotes | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timers
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  // ── Health Check ──────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const h = await api.checkHealth();
        setHealth(h);
      } catch {
        setHealth(null);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Demo Playback ─────────────────────────────────────────────────
  const startDemo = useCallback(async () => {
    setError(null);
    try {
      let data = demoData;
      if (!data) {
        data = await api.getDemoData();
        setDemoData(data);
      }

      // Create meeting
      const m = await api.createMeeting(title || 'Product Launch Sync — Demo');
      setMeeting(m);
      setTranscript([]);
      setNotes(null);
      setDecisions([]);
      setActionItems([]);
      setEmailDraft(null);
      setAnalysisSource(null);
      setDemoChunkIndex(0);
      setDemoState('playing');
      setElapsedTime(0);

      // Start elapsed timer
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => {
        setElapsedTime((t) => t + 1);
      }, 1000);
    } catch (e: any) {
      setError(e.message || 'Failed to start demo');
    }
  }, [demoData, title]);

  // Advance demo chunks
  useEffect(() => {
    if (demoState !== 'playing' || !demoData) return;

    if (demoChunkIndex >= demoData.chunks.length) {
      // Demo complete
      setDemoState('completed');
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      // Apply deterministic analysis
      setNotes(demoData.analysis.notes);
      setDecisions(demoData.analysis.decisions);
      setActionItems(demoData.analysis.action_items);
      setEmailDraft(demoData.email);
      setAnalysisSource('demo');

      // Save to backend
      if (meeting) {
        api.addTranscript(meeting.id, transcript.concat(...demoData.chunks.slice(demoChunkIndex)))
          .then(() => api.analyzeMeeting(meeting.id, true))
          .then(() => api.generateEmail(meeting.id, true))
          .catch(() => {});
      }
      return;
    }

    const delay = (3000 / demoSpeed);
    demoTimerRef.current = setTimeout(() => {
      const newSegments = demoData.chunks[demoChunkIndex];
      setTranscript((prev) => [...prev, ...newSegments]);
      setDemoChunkIndex((i) => i + 1);

      // Save to backend incrementally
      if (meeting) {
        api.addTranscript(meeting.id, newSegments).catch(() => {});
      }
    }, delay);

    return () => {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    };
  }, [demoState, demoChunkIndex, demoData, demoSpeed, meeting]);

  const pauseDemo = () => {
    setDemoState('paused');
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
  };

  const resumeDemo = () => {
    setDemoState('playing');
    elapsedTimerRef.current = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);
  };

  const restartDemo = () => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setDemoState('idle');
    setTranscript([]);
    setNotes(null);
    setDecisions([]);
    setActionItems([]);
    setEmailDraft(null);
    setAnalysisSource(null);
    setDemoChunkIndex(0);
    setElapsedTime(0);
    setMeeting(null);
  };

  // ── Audio Upload ──────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      // Create meeting
      const m = await api.createMeeting(title || file.name.replace(/\.[^.]+$/, ''));
      setMeeting(m);

      setUploadProgress('Transcribing audio (this may take a moment)...');
      const result = await api.transcribeAudio(file);

      setTranscript(result.segments);
      setUploadProgress('');

      // Save transcript
      await api.addTranscript(m.id, result.segments);

      // Auto-analyze
      setIsAnalyzing(true);
      setUploadProgress('Analyzing transcript...');
      const analyzed = await api.analyzeMeeting(m.id);
      setMeeting(analyzed);
      setNotes(analyzed.notes);
      setDecisions(analyzed.decisions);
      setActionItems(analyzed.action_items);
      setAnalysisSource(analyzed.analysis_source);

      // Generate email
      const withEmail = await api.generateEmail(m.id);
      setEmailDraft(withEmail.email_draft);
      setMeeting(withEmail);

    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Manual Analysis ───────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!meeting || transcript.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const analyzed = await api.analyzeMeeting(meeting.id);
      setMeeting(analyzed);
      setNotes(analyzed.notes);
      setDecisions(analyzed.decisions);
      setActionItems(analyzed.action_items);
      setAnalysisSource(analyzed.analysis_source);

      const withEmail = await api.generateEmail(meeting.id);
      setEmailDraft(withEmail.email_draft);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Task Update ───────────────────────────────────────────────────
  const handleUpdateTask = async (taskId: string, updates: Partial<ActionItem>) => {
    if (!meeting) return;
    try {
      await api.updateTask(meeting.id, taskId, updates);
      setActionItems((prev) =>
        prev.map((item) => (item.task_id === taskId ? { ...item, ...updates } : item))
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Email Regenerate ──────────────────────────────────────────────
  const handleRegenerateEmail = async () => {
    if (!meeting) return;
    setIsRegenerating(true);
    try {
      const result = await api.generateEmail(meeting.id);
      setEmailDraft(result.email_draft);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  // ── Format helpers ────────────────────────────────────────────────
  const formatElapsed = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const isDemo = demoState !== 'idle' || meeting?.is_demo;
  const isActive = demoState === 'playing' || demoState === 'paused' || isUploading;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Meeting Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">
            Capture, transcribe, and analyze meetings with local AI
          </p>
        </div>

        {/* Health Indicators */}
        <div className="flex items-center gap-3">
          {health ? (
            <>
              {health.nvidia_available ? (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  <Cpu className="w-3.5 h-3.5" />
                  NVIDIA NIM ({health.nvidia_model?.split('/').pop()})
                </div>
              ) : health.ollama_available ? (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  <Cpu className="w-3.5 h-3.5" />
                  Ollama ({health.ollama_model})
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  <Cpu className="w-3.5 h-3.5" />
                  Offline AI Fallback Ready
                </div>
              )}
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border ${
                health.whisper_available
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <Activity className="w-3.5 h-3.5" />
                Whisper {health.whisper_available ? 'Ready' : 'N/A'}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              Backend Offline
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="text-sm flex-1 text-rose-900 font-medium">{error}</p>
          <button onClick={() => setError(null)} className="text-xs px-2.5 py-1 rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200 font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Demo Badge */}
      {isDemo && (
        <div className="flex items-center justify-center">
          <span className="text-xs font-semibold px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            ⚡ Simulated Demo Mode — Pre-recorded dialogue
          </span>
        </div>
      )}

      {/* Controls Bar */}
      <div className="card-white p-5">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title (e.g. Q4 Strategy Review)..."
            disabled={isActive}
            className="flex-1 min-w-[200px] text-sm px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
          />

          {/* Demo Controls */}
          {demoState === 'idle' && !isUploading && (
            <button onClick={startDemo} className="btn-primary">
              <Zap className="w-4 h-4" />
              Start Demo
            </button>
          )}
          {demoState === 'playing' && (
            <button onClick={pauseDemo} className="btn-secondary">
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {demoState === 'paused' && (
            <button onClick={resumeDemo} className="btn-primary">
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          {demoState !== 'idle' && (
            <button onClick={restartDemo} className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all flex items-center gap-1.5">
              <Square className="w-4 h-4" />
              Restart
            </button>
          )}

          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.m4a,.ogg,.flac,.webm,.mp4,.wma"
            onChange={handleUpload}
            className="hidden"
            id="audio-upload"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isActive || isUploading}
            className="btn-secondary"
          >
            <Upload className="w-4 h-4" />
            Upload Audio
          </button>

          {/* Detect Live Meeting Button */}
          {onDetectLive && (
            <button
              onClick={onDetectLive}
              disabled={isActive || isUploading}
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
            >
              <Bot className="w-4 h-4" />
              Detect Live Meeting
            </button>
          )}

          {/* Speed Control */}
          {demoState !== 'idle' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Speed:</span>
              <select
                value={demoSpeed}
                onChange={(e) => setDemoSpeed(Number(e.target.value))}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          )}

          {/* Timer */}
          {(demoState !== 'idle' || isUploading) && (
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
              <Clock className="w-4 h-4" />
              {formatElapsed(elapsedTime)}
            </div>
          )}

          {/* Status */}
          {demoState === 'completed' && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Analysis Complete
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="mt-3 flex items-center gap-3 text-slate-600 text-sm font-medium">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>{uploadProgress}</span>
          </div>
        )}
      </div>

      {/* Analysis Source Badge */}
      {analysisSource && (
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
            analysisSource === 'local_llm'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : analysisSource === 'demo'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {analysisSource === 'local_llm' ? '🤖 Analyzed by Local LLM' :
             analysisSource === 'demo' ? '⚡ Deterministic Demo Results' :
             '⚠️ Fallback Results — LLM Unavailable'}
          </span>
        </div>
      )}

      {/* Analyze Button (for uploaded audio) */}
      {meeting && transcript.length > 0 && !notes && !isAnalyzing && demoState === 'idle' && (
        <button onClick={runAnalysis} className="btn-primary">
          <Zap className="w-4 h-4" />
          Analyze Transcript
        </button>
      )}
      {isAnalyzing && (
        <div className="flex items-center gap-3">
          <div className="spinner" />
          <span className="text-sm" style={{ color: '#94a3b8' }}>Analyzing with local AI...</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <TranscriptPanel segments={transcript} isDemo={!!isDemo} />
          <NotesPanel notes={notes} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <DecisionsPanel decisions={decisions} />
          <ActionItemsTable
            items={actionItems}
            meetingId={meeting?.id || ''}
            onUpdateTask={handleUpdateTask}
          />
        </div>
      </div>

      {/* Email Draft */}
      <EmailEditor
        email={emailDraft}
        onRegenerate={handleRegenerateEmail}
        isRegenerating={isRegenerating}
      />
    </div>
  );
}
