// Talk2Tasks AI — Decisions Panel (Blue & White Theme)

import { Scale, Check, RefreshCw, Quote } from 'lucide-react';
import type { Decision } from '../types';

interface DecisionsPanelProps {
  decisions: Decision[];
}

export default function DecisionsPanel({ decisions }: DecisionsPanelProps) {
  if (decisions.length === 0) {
    return (
      <div className="card-white p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 180 }}>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2 text-blue-500">
          <Scale className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No decisions extracted yet</p>
        <p className="text-xs text-slate-400 mt-0.5">Agreed conclusions and consensus will appear here</p>
      </div>
    );
  }

  return (
    <div className="card-white p-5 animate-fade-in space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-600" />
          Decisions Made
        </h3>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {decisions.length} recorded
        </span>
      </div>

      <div className="space-y-3">
        {decisions.map((dec) => (
          <div
            key={dec.decision_id}
            className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-blue-200 transition-colors"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {dec.confirmed ? (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-100 text-amber-700">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-snug">{dec.description}</p>
                <span className={`text-xs font-medium inline-block mt-1 ${dec.confirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {dec.confirmed ? 'Confirmed Consensus' : 'Tentative Agreement'}
                </span>
              </div>
            </div>
            {dec.source_quote && (
              <div className="mt-2.5 flex items-start gap-2 pl-7 border-l-2 border-blue-200 ml-2.5">
                <Quote className="w-3 h-3 shrink-0 mt-0.5 text-blue-400" />
                <p className="text-xs italic text-slate-600">"{dec.source_quote}"</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
