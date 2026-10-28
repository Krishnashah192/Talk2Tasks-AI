// Talk2Tasks AI — Email Draft Editor (Blue & White Theme)

import { useState } from 'react';
import { Mail, Copy, Download, RefreshCw, Check } from 'lucide-react';
import type { EmailDraft } from '../types';

interface EmailEditorProps {
  email: EmailDraft | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export default function EmailEditor({ email, onRegenerate, isRegenerating }: EmailEditorProps) {
  const [editedText, setEditedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!email) {
    return (
      <div className="card-white p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 180 }}>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2 text-blue-500">
          <Mail className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Follow-up email will appear after analysis</p>
        <p className="text-xs text-slate-400 mt-0.5">Automated stakeholder draft ready to copy or export</p>
      </div>
    );
  }

  const displayText = editedText ?? email.full_text;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([displayText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-follow-up-email.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card-white p-5 animate-fade-in space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-600" />
          Follow-up Email Draft
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
          <button
            onClick={handleCopy}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <Download className="w-3.5 h-3.5" />
            Export TXT
          </button>
        </div>
      </div>

      <textarea
        value={displayText}
        onChange={(e) => setEditedText(e.target.value)}
        rows={14}
        className="w-full text-sm leading-relaxed p-4 rounded-xl resize-y bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
      />
    </div>
  );
}
