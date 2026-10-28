// Talk2Tasks AI — Secure Electron Preload Script
// Strictly enforces Context Isolation and disables Node.js integration in renderers.

const { contextBridge, ipcRenderer } = require('electron');

// Whitelisted IPC channels and strict method mapping
contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  getWindowType: () => ipcRenderer.invoke('get-window-type'),
  minimizeMain: () => ipcRenderer.invoke('minimize-main'),
  hideMain: () => ipcRenderer.invoke('hide-main'),
  closeMain: () => ipcRenderer.invoke('close-main'),
  openMainWindow: (route) => ipcRenderer.invoke('open-main-window', route),

  // Floating widget controls
  toggleFloating: (show) => ipcRenderer.invoke('toggle-floating', show),
  setFloatingPosition: (corner) => ipcRenderer.invoke('set-floating-position', corner),
  setClickThrough: (enabled) => ipcRenderer.invoke('set-click-through', enabled),
  getFloatingState: () => ipcRenderer.invoke('get-floating-state'),

  // Meeting & Audio detection
  detectMeetings: () => ipcRenderer.invoke('detect-meetings'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  // Preferences & Auto-start
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (prefs) => ipcRenderer.invoke('save-preferences', prefs),
  getAutoStart: () => ipcRenderer.invoke('get-autostart'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),

  // Cross-window Event Sync
  syncMeetingState: (state) => ipcRenderer.send('sync-meeting-state', state),
  onMeetingStateUpdate: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('meeting-state-update', handler);
    return () => ipcRenderer.removeListener('meeting-state-update', handler);
  },

  onShowAssistantUpdate: (callback) => {
    const handler = (_event, update) => callback(update);
    ipcRenderer.on('show-assistant-update', handler);
    return () => ipcRenderer.removeListener('show-assistant-update', handler);
  },
});
