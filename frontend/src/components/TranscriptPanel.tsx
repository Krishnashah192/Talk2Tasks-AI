// Talk2Tasks AI — Transcript Panel (Blue & White Theme)

import { MessageSquare } from 'lucide-react';
import type { TranscriptSegment } from '../types';
import { useEffect, useRef } from 'react';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  isDemo: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const speakerColors: Record<string, string> = {
  Alex: '#2563eb',
  Priya: '#7c3aed',
  Rahul: '#059669',
};

export default function TranscriptPanel({ segments, isDemo }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments.length]);

  if (segments.length === 0) {
    return (
      <div className="card-white p-8 h-full flex flex-col items-center justify-center text-center" style={{ minHeight: 300 }}>
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-3 text-blue-500">
          <MessageSquare className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No transcript yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Start a demo or upload audio to begin capturing dialogue
        </p>
      </div>
    );
  }

  return (
    <div className="card-white p-5 flex flex-col" style={{ maxHeight: 500 }}>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          Transcript
        </h3>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          {segments.length} segments
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 420 }}>
        {segments.map((seg, i) => {
          const color = seg.speaker ? (speakerColors[seg.speaker] || '#2563eb') : '#2563eb';
          return (
            <div
              key={seg.id || i}
              className="flex gap-3 py-2 px-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-blue-50/40 hover:border-blue-200 transition-colors"
            >
              <span className="text-xs font-mono font-medium text-slate-400 shrink-0 pt-0.5" style={{ minWidth: 42 }}>
                {formatTime(seg.start_time)}
              </span>
              <div className="flex-1 min-w-0">
                {seg.speaker && (
                  <span className="text-xs font-bold mr-2" style={{ color }}>
                    {seg.speaker}:
                  </span>
                )}
                <span className="text-sm text-slate-800 leading-relaxed">{seg.text}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
