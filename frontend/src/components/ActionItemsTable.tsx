// Talk2Tasks AI — Action Items Table (Blue & White Theme)

import { useState } from 'react';
import { ListChecks, Check, Edit3, Save, X, Quote, ChevronDown } from 'lucide-react';
import type { ActionItem, TaskStatus } from '../types';

interface ActionItemsTableProps {
  items: ActionItem[];
  meetingId: string;
  onUpdateTask: (taskId: string, updates: Partial<ActionItem>) => void;
}

const statusStyles: Record<TaskStatus, { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: 'bg-amber-50', color: 'text-amber-700', border: 'border-amber-200', label: 'Pending' },
  in_progress: { bg: 'bg-blue-50', color: 'text-blue-700', border: 'border-blue-200', label: 'In Progress' },
  completed: { bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200', label: 'Completed' },
  cancelled: { bg: 'bg-rose-50', color: 'text-rose-700', border: 'border-rose-200', label: 'Cancelled' },
};

export default function ActionItemsTable({ items, meetingId, onUpdateTask }: ActionItemsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ActionItem>>({});
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [showEvidence, setShowEvidence] = useState<string | null>(null);

  const filtered = filterStatus === 'all' ? items : items.filter((t) => t.status === filterStatus);

  const startEdit = (item: ActionItem) => {
    setEditingId(item.task_id);
    setEditValues({
      task_description: item.task_description,
      owner: item.owner,
      deadline: item.deadline,
    });
  };

  const saveEdit = (taskId: string) => {
    onUpdateTask(taskId, editValues);
    setEditingId(null);
    setEditValues({});
  };

  const toggleComplete = (item: ActionItem) => {
    const newStatus: TaskStatus = item.status === 'completed' ? 'pending' : 'completed';
    onUpdateTask(item.task_id, { status: newStatus });
  };

  if (items.length === 0) {
    return (
      <div className="card-white p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 180 }}>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2 text-blue-500">
          <ListChecks className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No action items extracted yet</p>
        <p className="text-xs text-slate-400 mt-0.5">Tasks with assigned owners and deadlines will appear here</p>
      </div>
    );
  }

  return (
    <div className="card-white p-5 animate-fade-in space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-blue-600" />
          Action Items & Tasks
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {items.length}
          </span>
        </h3>

        {/* Filter */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
            className="text-xs pl-2.5 pr-7 py-1.5 rounded-lg appearance-none cursor-pointer bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider">Done</th>
              <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider">Task</th>
              <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider">Owner</th>
              <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider">Deadline</th>
              <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const isEditing = editingId === item.task_id;
              const style = statusStyles[item.status] || statusStyles.pending;

              return (
                <tr
                  key={item.task_id}
                  className="transition-colors hover:bg-blue-50/30"
                >
                  <td className="py-2.5 px-2">
                    <button
                      onClick={() => toggleComplete(item)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        item.status === 'completed'
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 bg-white hover:border-blue-400'
                      }`}
                    >
                      {item.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                  <td className="py-2.5 px-2">
                    {isEditing ? (
                      <input
                        value={editValues.task_description || ''}
                        onChange={(e) => setEditValues({ ...editValues, task_description: e.target.value })}
                        className="w-full text-sm px-2.5 py-1 rounded-md bg-white border border-blue-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <div>
                        <span
                          className={`text-sm ${
                            item.status === 'completed'
                              ? 'line-through text-slate-400'
                              : 'font-medium text-slate-800'
                          }`}
                        >
                          {item.task_description}
                        </span>
                        {item.source_quote && (
                          <button
                            onClick={() => setShowEvidence(showEvidence === item.task_id ? null : item.task_id)}
                            className="ml-2 inline-flex align-middle text-slate-400 hover:text-blue-600"
                            title="Show evidence quote"
                          >
                            <Quote className="w-3 h-3" />
                          </button>
                        )}
                        {showEvidence === item.task_id && item.source_quote && (
                          <p className="text-xs italic mt-1.5 pl-2 text-slate-600 border-l-2 border-blue-300">
                            "{item.source_quote}"
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    {isEditing ? (
                      <input
                        value={editValues.owner || ''}
                        onChange={(e) => setEditValues({ ...editValues, owner: e.target.value || null })}
                        className="w-full text-sm px-2.5 py-1 rounded-md bg-white border border-blue-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Unassigned"
                      />
                    ) : (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.owner ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-400'}`}>
                        {item.owner || 'Unassigned'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    {isEditing ? (
                      <input
                        value={editValues.deadline || ''}
                        onChange={(e) => setEditValues({ ...editValues, deadline: e.target.value || null })}
                        className="w-full text-sm px-2.5 py-1 rounded-md bg-white border border-blue-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="TBD"
                      />
                    ) : (
                      <span className="text-xs font-medium text-slate-600">
                        {item.deadline || 'TBD'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${style.bg} ${style.color} ${style.border}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    {isEditing ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveEdit(item.task_id)}
                          className="p-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          title="Save"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Edit task"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confidence Bar */}
      <div className="pt-2 flex items-center gap-3 border-t border-slate-100 text-xs text-slate-500">
        <span>Extraction Confidence:</span>
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{
              width: `${(items.reduce((sum, i) => sum + i.confidence, 0) / items.length) * 100}%`,
            }}
          />
        </div>
        <span className="font-mono font-semibold text-slate-700">
          {((items.reduce((sum, i) => sum + i.confidence, 0) / items.length) * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
