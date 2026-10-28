// Talk2Tasks AI — Root Application

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import LiveAssistant from './pages/LiveAssistant';
import Meetings from './pages/Meetings';
import History from './pages/History';
import Settings from './pages/Settings';

export default function App() {
  const [activePage, setActivePage] = useState<string>('dashboard');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex">
      {/* Sidebar Navigation */}
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
        {activePage === 'dashboard' && (
          <Dashboard onDetectLive={() => setActivePage('live')} />
        )}
        {activePage === 'live' && (
          <LiveAssistant
            onNavigateToHistory={() => setActivePage('history')}
            onOpenFloating={() => window.electronAPI?.toggleFloating(true)}
          />
        )}
        {activePage === 'meetings' && (
          <Meetings
            onStartMeeting={(_title, _mode) => {
              setActivePage('dashboard');
            }}
          />
        )}
        {activePage === 'history' && <History />}
        {activePage === 'settings' && <Settings />}
      </main>
    </div>
  );
}

