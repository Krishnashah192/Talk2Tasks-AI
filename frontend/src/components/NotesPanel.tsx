// Talk2Tasks AI — Notes Panel (Blue & White Theme)

import { FileText, AlertTriangle, HelpCircle } from 'lucide-react';
import type { MeetingNotes } from '../types';

interface NotesPanelProps {
  notes: MeetingNotes | null;
}

export default function NotesPanel({ notes }: NotesPanelProps) {
  if (!notes) {
    return (
      <div className="card-white p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 200 }}>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2 text-blue-500">
          <FileText className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Notes will appear after analysis</p>
        <p className="text-xs text-slate-400 mt-0.5">Automated summary, key points, blockers, and questions</p>
      </div>
    );
  }

  return (
    <div className="card-white p-5 animate-fade-in space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          Meeting Notes
        </h3>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Synthesized
        </span>
      </div>

      {/* Summary */}
      <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">Executive Summary</h4>
        <p className="text-sm leading-relaxed text-slate-800">{notes.summary}</p>
      </div>

      {/* Key Points */}
      {notes.key_points.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Highlights</h4>
          <ul className="space-y-2">
            {notes.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-blue-600" />
                <span className="leading-snug">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blockers */}
      {notes.blockers.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Blockers & Risks
          </h4>
          <ul className="space-y-1.5">
            {notes.blockers.map((b, i) => (
              <li key={i} className="text-sm px-3 py-2 rounded-xl bg-amber-50/80 text-amber-900 border border-amber-200">
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Open Questions */}
      {notes.open_questions.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-indigo-700">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" /> Open Questions
          </h4>
          <ul className="space-y-1.5">
            {notes.open_questions.map((q, i) => (
              <li key={i} className="text-sm px-3 py-2 rounded-xl bg-indigo-50/80 text-indigo-900 border border-indigo-200">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
