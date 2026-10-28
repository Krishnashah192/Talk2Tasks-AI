// Talk2Tasks AI — Meetings Hub Component (Blue & White Theme)

import { useState } from 'react';
import { Mic, Upload, Play, Sparkles, AlertCircle } from 'lucide-react';
import * as api from '../services/api';

interface MeetingsProps {
  onStartMeeting: (title: string, mode: 'demo' | 'upload') => void;
}

export default function Meetings({ onStartMeeting }: MeetingsProps) {
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleStartDemo = () => {
    const meetingTitle = title.trim() || 'Sprint Planning & Product Launch';
    onStartMeeting(meetingTitle, 'demo');
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setStatusMessage('Transcribing audio locally using Faster-Whisper...');

    try {
      const res = await api.transcribeAudio(selectedFile);
      const meetingTitle = title.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
      const newMeeting = await api.createMeeting(meetingTitle);
      await api.addTranscript(newMeeting.id, res.segments);
      setStatusMessage('Transcription complete! Loading meeting...');
      setTimeout(() => {
        onStartMeeting(meetingTitle, 'upload');
      }, 500);
    } catch (err: any) {
      alert('Error during audio transcription: ' + (err.message || err));
      setStatusMessage('');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Mic className="w-5 h-5" />
          </div>
          Start New Meeting Session
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Convert audio discussions into structured action items, decisions, and follow-ups — 100% locally.
        </p>
      </div>

      {/* Meeting Title Input */}
      <div className="card-white p-6 space-y-3">
        <label className="block text-sm font-bold text-slate-800">
          Meeting Title / Subject
        </label>
        <input
          type="text"
          placeholder="e.g. Q3 Strategic Planning & Roadmap Review"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium transition-all"
        />
      </div>

      {/* Two Entry Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Live Simulation / College Demo Mode */}
        <div className="card-white p-6 flex flex-col justify-between border-blue-200 shadow-md relative overflow-hidden bg-gradient-to-b from-blue-50/30 to-white">
          <div className="absolute top-4 right-4">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              Recommended for Presentation
            </span>
          </div>

          <div className="space-y-4 mt-2">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">Live Synthetic Simulation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Streams real-time simulated meeting dialogue with 3 distinct speakers (Alex, Priya, Rahul),
              illustrating chunk-by-chunk transcription and structured LLM extraction without waiting.
            </p>

            <ul className="text-xs text-slate-700 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                No microphone or external audio file required
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Demonstrates 100% offline fallback capability
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Extracts tasks, decisions, and auto-generates follow-up email
              </li>
            </ul>
          </div>

          <button
            onClick={handleStartDemo}
            className="btn-primary mt-6 w-full justify-center text-sm py-3 shadow-md"
          >
            <Play className="w-4 h-4 mr-1" />
            Launch Interactive Demo Session
          </button>
        </div>

        {/* Option 2: Upload Audio File */}
        <div className="card-white p-6 flex flex-col justify-between border-slate-200">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">Upload Prerecorded Audio</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload any WAV, MP3, M4A, or FLAC audio file. Processed locally on your machine via
              Faster-Whisper (ctranslate2 engine) with zero cloud dependencies.
            </p>

            <div className="pt-2">
              <input
                type="file"
                accept=".wav,.mp3,.m4a,.flac,.ogg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border file:border-blue-200 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {selectedFile && (
                <p className="text-xs font-semibold text-emerald-700 mt-2 flex items-center gap-1.5">
                  ✓ Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>

            {statusMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                {statusMessage}
              </div>
            )}
          </div>

          <button
            onClick={handleFileUpload}
            disabled={!selectedFile || isUploading}
            className="btn-secondary mt-6 w-full justify-center text-sm py-3 disabled:opacity-50"
          >
            <Upload className="w-4 h-4 mr-1" />
            {isUploading ? 'Transcribing with Faster-Whisper...' : 'Process Audio File'}
          </button>
        </div>
      </div>
    </div>
  );
}
