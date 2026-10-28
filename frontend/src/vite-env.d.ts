/// <reference types="vite/client" />

export interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface ElectronPreferences {
  autoStart: boolean;
  floatingCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  clickThrough: boolean;
  notificationFrequency: 'all' | 'important_only' | 'quiet';
  preferredAudioDevice: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  getWindowType: () => Promise<'main' | 'floating'>;
  minimizeMain: () => Promise<boolean>;
  hideMain: () => Promise<boolean>;
  openMainWindow: (route?: string) => Promise<boolean>;
  toggleFloating: (show?: boolean) => Promise<boolean>;
  setFloatingPosition: (corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => Promise<boolean>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  detectMeetings: () => Promise<Array<{
    platform: string;
    title: string;
    confidence: string;
    processName: string;
    windowTitle: string | null;
    audioCaptureMethod: string;
    notes: string;
  }>>;
  getDesktopSources: () => Promise<DesktopSource[]>;
  getPreferences: () => Promise<ElectronPreferences>;
  savePreferences: (prefs: Partial<ElectronPreferences>) => Promise<ElectronPreferences>;
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<boolean>;
  syncMeetingState: (state: any) => Promise<boolean>;
  onMeetingStateUpdate: (callback: (state: any) => void) => () => void;
  onShowAssistantUpdate: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
