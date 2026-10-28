// Talk2Tasks AI — Modern Blue & White Sidebar Component

import {
  LayoutDashboard,
  Mic,
  History,
  Settings,
  BrainCircuit,
  Bot,
  Shield,
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Assistant', icon: Bot },
  { id: 'meetings', label: 'Meetings', icon: Mic },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col bg-white border-r border-slate-200 shadow-sm z-30 select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 text-white shadow-md shadow-blue-500/20">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            Talk2Tasks <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">AI</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">Local Meeting Intelligence</p>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium text-left ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs border-l-4 border-blue-600'
                  : 'text-slate-600 hover:text-blue-700 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Privacy & Engine Badge */}
      <div className="p-3 mx-3 mb-4 rounded-xl bg-blue-50/70 border border-blue-100/80">
        <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs mb-1">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>100% On-Device AI</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Audio transcription & analysis run privately on local CPU/GPU.
        </p>
      </div>
    </aside>
  );
}
