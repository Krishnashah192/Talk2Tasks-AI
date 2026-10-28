// Talk2Tasks AI — Meeting History Page (Blue & White Theme)

import { useState, useEffect } from 'react';
import {
  History as HistoryIcon,
  Search,
  Trash2,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { Meeting } from '../types';
import * as api from '../services/api';

interface HistoryProps {
  onSelectMeeting?: (meetingId: string) => void;
}

export default function History({ onSelectMeeting }: HistoryProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'demo' | 'real'>('all');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const data = await api.listMeetings();
      setMeetings(data);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting recording and analysis?')) return;
    try {
      await api.deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      if (selectedMeeting?.id === id) setSelectedMeeting(null);
    } catch (err) {
      alert('Failed to delete meeting: ' + err);
    }
  };

  const handleExport = async (meeting: Meeting, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportingId(meeting.id);
    try {
      const markdown = await api.exportMeeting(meeting.id);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.toLowerCase().replace(/\s+/g, '_')}_summary.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err);
    } finally {
      setExportingId(null);
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.notes?.summary && m.notes.summary.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType =
      filterType === 'all'
        ? true
        : filterType === 'demo'
        ? m.is_demo
        : !m.is_demo;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <HistoryIcon className="w-5 h-5" />
            </div>
            Meeting History & Archives
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Review past transcripts, AI-extracted action items, decisions, and export reports.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search meetings or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64 shadow-sm"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:border-blue-500 shadow-sm"
          >
            <option value="all">All Sources</option>
            <option value="demo">Demo Runs</option>
            <option value="real">Real Audio</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="card-white p-12 text-center text-slate-500 flex flex-col items-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium">Loading meeting records...</p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="card-white p-12 text-center text-slate-500">
          <FileText className="w-12 h-12 mx-auto text-blue-300 mb-3" />
          <h3 className="text-base font-bold text-slate-800">No meetings found</h3>
          <p className="text-sm text-slate-500 mt-1">
            {searchTerm ? 'Try adjusting your search criteria.' : 'Start a live session or run a demo from the Dashboard.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMeetings.map((m) => {
            const dateStr = new Date(m.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const minutes = Math.floor(m.duration_seconds / 60);
            const seconds = Math.floor(m.duration_seconds % 60);
            const durationStr = `${minutes}m ${seconds}s`;

            return (
              <div
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className="card-white p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
                style={{ minHeight: '220px' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                        m.is_demo
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {m.is_demo ? 'Interactive Demo' : 'Live / Upload'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3" />
                      {dateStr}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 truncate" title={m.title}>
                    {m.title}
                  </h3>

                  {m.notes?.summary ? (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {m.notes.summary}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-2">
                      Transcript recorded ({m.transcript?.length || 0} segments). Analysis pending.
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {durationStr}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {m.action_items?.length || 0} Tasks
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleExport(m, e)}
                      title="Download Markdown Report"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-700 transition"
                    >
                      <Download className={`w-4 h-4 ${exportingId === m.id ? 'animate-bounce' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(m.id, e)}
                      title="Delete record"
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card-white w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border-slate-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{selectedMeeting.title}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedMeeting.transcript?.length || 0} segments
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ID: {selectedMeeting.id} • Created: {new Date(selectedMeeting.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedMeeting(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary */}
              {selectedMeeting.notes && (
                <div>
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                    Executive Summary
                  </h4>
                  <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-sm text-slate-800 leading-relaxed">
                    {selectedMeeting.notes.summary}
                  </div>
                </div>
              )}

              {/* Action items */}
              {selectedMeeting.action_items && selectedMeeting.action_items.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                    Action Items ({selectedMeeting.action_items.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedMeeting.action_items.map((t) => (
                      <div
                        key={t.task_id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{t.task_description}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>Owner: <strong className="text-slate-700">{t.owner || 'Unassigned'}</strong></span>
                            <span>Due: <strong className="text-slate-700">{t.deadline || 'None'}</strong></span>
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {selectedMeeting.decisions && selectedMeeting.decisions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2">
                    Decisions Agreed Upon ({selectedMeeting.decisions.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedMeeting.decisions.map((d) => (
                      <div
                        key={d.decision_id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-medium text-slate-800"
                      >
                        {d.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript Preview */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Full Transcript ({selectedMeeting.transcript?.length || 0} segments)
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  {selectedMeeting.transcript?.map((s) => (
                    <div key={s.id} className="text-xs">
                      <span className="font-bold text-blue-600 mr-2">[{s.speaker || 'Speaker'}]:</span>
                      <span className="text-slate-800">{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                onClick={(e) => handleExport(selectedMeeting, e)}
                className="btn-primary text-xs py-2 px-4 shadow-sm"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Export Markdown Report
              </button>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
