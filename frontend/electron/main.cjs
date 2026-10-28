// Talk2Tasks AI — Electron Main Process
// Manages the Main Dashboard Window, Floating Assistant Widget, System Tray, and IPC Bridge.

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, desktopCapturer, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let floatingWindow = null;
let tray = null;
let isQuitting = false;
let backendProcess = null;

// ── Backend Process Supervisor ─────────────────────────────────────────
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8000/', (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureBackendRunning() {
  const isHealthy = await checkBackendHealth();
  if (isHealthy) {
    console.log('[Electron] FastAPI backend already running at http://127.0.0.1:8000');
    return;
  }

  console.log('[Electron] Starting local Python FastAPI backend...');
  const projectRoot = path.resolve(__dirname, '..', '..');
  const pythonExe = path.join(projectRoot, 'backend', 'venv', 'Scripts', 'python.exe');
  const backendDir = path.join(projectRoot, 'backend');

  if (fs.existsSync(pythonExe)) {
    backendProcess = spawn(
      pythonExe,
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
      {
        cwd: backendDir,
        stdio: 'ignore',
        windowsHide: true,
      }
    );

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkBackendHealth()) {
        console.log('[Electron] FastAPI backend successfully launched and ready!');
        break;
      }
    }
  } else {
    console.warn('[Electron] Python virtual environment not found at:', pythonExe);
  }
}

function stopBackendProcess() {
  if (backendProcess) {
    try {
      console.log('[Electron] Shutting down managed backend process...');
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], { windowsHide: true });
    } catch (e) {
      // ignore
    }
    backendProcess = null;
  }
}

// ── Preferences Management ─────────────────────────────────────────────
const PREFS_PATH = path.join(app.getPath('userData'), 'talk2tasks_prefs.json');

function loadPreferences() {
  const defaults = {
    floatingPosition: 'bottom-right',
    floatingX: null,
    floatingY: null,
    showFloatingOnStart: true,
    autoStart: false,
    clickThrough: false,
    notificationFrequency: 'important',
    audioDevice: 'default',
  };
  try {
    if (fs.existsSync(PREFS_PATH)) {
      const saved = JSON.parse(fs.readFileSync(PREFS_PATH, 'utf-8'));
      return { ...defaults, ...saved };
    }
  } catch (err) {
    console.error('Failed to load preferences:', err);
  }
  return defaults;
}

function savePreferences(newPrefs) {
  try {
    const current = loadPreferences();
    const merged = { ...current, ...newPrefs };
    fs.writeFileSync(PREFS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('Failed to save preferences:', err);
    return loadPreferences();
  }
}

// ── Window Positioning Helpers ─────────────────────────────────────────
function getCornerCoordinates(corner, width = 280, height = 440) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const padding = 20;

  switch (corner) {
    case 'top-left':
      return { x: workArea.x + padding, y: workArea.y + padding };
    case 'top-right':
      return { x: workArea.x + workArea.width - width - padding, y: workArea.y + padding };
    case 'bottom-left':
      return { x: workArea.x + padding, y: workArea.y + workArea.height - height - padding };
    case 'bottom-right':
    default:
      return { x: workArea.x + workArea.width - width - padding, y: workArea.y + workArea.height - height - padding };
  }
}

// ── Create Main Dashboard Window ───────────────────────────────────────
function createMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const iconPath = path.join(__dirname, 'app_icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    title: 'Talk2Tasks AI — Meeting Intelligence',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#f8fafc',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  const devUrl = 'http://localhost:5173';
  const prodPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (process.env.NODE_ENV === 'development' || !fs.existsSync(prodPath)) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(prodPath);
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log(`[MainWindow FailLoad] ${desc} (${code}) ${url}`);
  });

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    log(`[MainWindow Console] ${message} (${sourceId}:${line})`);
  });

  // Handle external link openings securely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Minimize to tray when closing window (if tray active)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Create Floating Assistant Window ───────────────────────────────────
function createFloatingWindow() {
  if (floatingWindow) {
    floatingWindow.show();
    floatingWindow.focus();
    return;
  }

  const prefs = loadPreferences();
  let coords;

  if (prefs.floatingX != null && prefs.floatingY != null) {
    coords = { x: prefs.floatingX, y: prefs.floatingY };
  } else {
    coords = getCornerCoordinates(prefs.floatingPosition || 'bottom-right', 280, 440);
  }

  floatingWindow = new BrowserWindow({
    width: 280,
    height: 440,
    x: coords.x,
    y: coords.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Keep on top of all windows
  floatingWindow.setAlwaysOnTop(true, 'screen-saver');

  floatingWindow.once('ready-to-show', () => {
    if (floatingWindow) {
      floatingWindow.show();
      floatingWindow.focus();
    }
  });

  const devUrl = 'http://localhost:5173/?view=floating#floating';
  const prodPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (process.env.NODE_ENV === 'development' || !fs.existsSync(prodPath)) {
    floatingWindow.loadURL(devUrl);
  } else {
    floatingWindow.loadFile(prodPath, { query: { view: 'floating' }, hash: 'floating' });
  }

  floatingWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log(`[FloatingWindow FailLoad] ${desc} (${code}) ${url}`);
  });

  floatingWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    log(`[FloatingWindow Console] ${message} (${sourceId}:${line})`);
  });

  // Save position on drag/move
  floatingWindow.on('moved', () => {
    if (!floatingWindow) return;
    const [x, y] = floatingWindow.getPosition();
    savePreferences({ floatingX: x, floatingY: y });
  });

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
}

// ── System Tray Management ─────────────────────────────────────────────
function createTray() {
  try {
    const pngPath = path.join(__dirname, 'tray_icon.png');
    const appIconPath = path.join(__dirname, 'app_icon.png');
    const trayIconPath = fs.existsSync(pngPath) ? pngPath : appIconPath;

    if (!fs.existsSync(trayIconPath)) {
      console.warn('Tray icon not found at:', trayIconPath);
      return;
    }

    const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Talk2Tasks AI — Local Meeting Intelligence');
    updateTrayMenu();

    tray.on('double-click', () => {
      createMainWindow();
    });
  } catch (trayErr) {
    console.warn('Tray creation skipped/failed:', trayErr);
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const prefs = loadPreferences();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Talk2Tasks AI',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show Dashboard',
      click: () => createMainWindow(),
    },
    {
      label: floatingWindow && floatingWindow.isVisible() ? 'Hide Floating Assistant' : 'Show Floating Assistant',
      click: () => {
        if (floatingWindow && floatingWindow.isVisible()) {
          floatingWindow.hide();
        } else {
          createFloatingWindow();
        }
        updateTrayMenu();
      },
    },
    {
      label: 'Snap Assistant to',
      submenu: [
        {
          label: 'Bottom-Right (Default)',
          click: () => snapAssistant('bottom-right'),
        },
        {
          label: 'Bottom-Left',
          click: () => snapAssistant('bottom-left'),
        },
        {
          label: 'Top-Right',
          click: () => snapAssistant('top-right'),
        },
        {
          label: 'Top-Left',
          click: () => snapAssistant('top-left'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Launch on Windows Startup',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        savePreferences({ autoStart: item.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Talk2Tasks AI',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function snapAssistant(corner) {
  const coords = getCornerCoordinates(corner);
  if (!floatingWindow) {
    savePreferences({ floatingPosition: corner, floatingX: coords.x, floatingY: coords.y });
    createFloatingWindow();
  } else {
    floatingWindow.setPosition(coords.x, coords.y, true);
    savePreferences({ floatingPosition: corner, floatingX: coords.x, floatingY: coords.y });
  }
}

// ── IPC Handlers ───────────────────────────────────────────────────────
function setupIpcHandlers() {
  ipcMain.handle('get-window-type', (event) => {
    if (floatingWindow && event.sender.id === floatingWindow.webContents.id) {
      return 'floating';
    }
    return 'main';
  });

  ipcMain.handle('minimize-main', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('hide-main', () => {
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.handle('close-main', () => {
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.handle('open-main-window', (_event, route) => {
    createMainWindow();
    if (route && mainWindow) {
      mainWindow.webContents.send('navigate-to-route', route);
    }
  });

  ipcMain.handle('toggle-floating', (_event, show) => {
    if (show) {
      createFloatingWindow();
    } else if (floatingWindow) {
      floatingWindow.hide();
    }
    updateTrayMenu();
  });

  ipcMain.handle('set-floating-position', (_event, corner) => {
    snapAssistant(corner);
  });

  ipcMain.handle('set-click-through', (_event, enabled) => {
    if (floatingWindow) {
      floatingWindow.setIgnoreMouseEvents(enabled, { forward: true });
      savePreferences({ clickThrough: enabled });
    }
  });

  ipcMain.handle('get-floating-state', () => {
    return {
      visible: floatingWindow ? floatingWindow.isVisible() : false,
      prefs: loadPreferences(),
    };
  });

  ipcMain.handle('get-preferences', () => {
    return loadPreferences();
  });

  ipcMain.handle('save-preferences', (_event, prefs) => {
    return savePreferences(prefs);
  });

  ipcMain.handle('get-autostart', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('set-autostart', (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    savePreferences({ autoStart: Boolean(enabled) });
    updateTrayMenu();
    return Boolean(enabled);
  });

  // Windows Desktop Sources for Audio Capture
  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 160, height: 90 },
      });
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
      }));
    } catch (err) {
      console.error('Failed to get desktop sources:', err);
      return [];
    }
  });

  // Detect Live Meetings via window titles
  ipcMain.handle('detect-meetings', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 80, height: 45 },
      });

      const detections = [];

      for (const s of sources) {
        const title = s.name.trim();
        const lower = title.toLowerCase();

        // 1. Genuine Google Meet detection (Specific Meet window title or meeting code)
        const isGoogleMeet =
          lower.startsWith('meet - ') ||
          lower.startsWith('meet – ') ||
          lower.startsWith('meet — ') ||
          lower.startsWith('meet: ') ||
          lower.includes(' meet - ') ||
          lower.includes(' meet – ') ||
          lower.includes(' meet — ') ||
          lower.includes('google meet') ||
          lower.includes('meet.google.com') ||
          /\b[a-z]{3}-[a-z]{4}-[a-z]{3}\b/.test(lower);

        if (isGoogleMeet) {
          const cleanMeetingTitle = title
            .replace(/( - Google Chrome| - Microsoft Edge| - Brave| - Mozilla Firefox)$/gi, '')
            .replace(/^(Meet\s*[-–—:]\s*|Google Meet\s*[-–—:]\s*)/gi, '')
            .trim() || 'Google Meet Active Session';

          detections.push({
            id: s.id,
            platform: 'google_meet',
            windowTitle: title,
            meetingTitle: cleanMeetingTitle,
            title: cleanMeetingTitle,
            confidence: 'confirmed',
            processName: 'chrome.exe',
            status: 'Confirmed active Google Meet call detected',
            notes: 'Active Google Meet session detected in browser.',
            audioMethod: 'Desktop WASAPI Loopback Capture',
            audioCaptureMethod: 'Desktop WASAPI Loopback Capture',
          });
        }

        // 2. Zoom detection (only actual meeting windows)
        else if (lower.includes('zoom meeting') || lower.includes('zoom workplace')) {
          const cleanZoomTitle = title.replace(/(Zoom Meeting|Zoom Workplace)/gi, '').trim() || 'Zoom Active Meeting';
          detections.push({
            id: s.id,
            platform: 'Zoom',
            windowTitle: title,
            meetingTitle: cleanZoomTitle,
            title: cleanZoomTitle,
            confidence: 'confirmed',
            processName: 'Zoom.exe',
            status: 'Confirmed active Zoom meeting window',
            notes: 'Active Zoom meeting session detected.',
            audioMethod: 'Desktop WASAPI Loopback Capture',
            audioCaptureMethod: 'Desktop WASAPI Loopback Capture',
          });
        }

        // 3. Microsoft Teams detection (only actual meetings/calls)
        else if (
          (lower.includes('microsoft teams') && (lower.includes('meeting') || lower.includes('call') || lower.includes('|'))) ||
          lower.includes('teams meeting')
        ) {
          const cleanTeamsTitle = title.replace(/(\| Microsoft Teams|Microsoft Teams)/gi, '').trim() || 'Teams Meeting';
          detections.push({
            id: s.id,
            platform: 'Microsoft Teams',
            windowTitle: title,
            meetingTitle: cleanTeamsTitle,
            title: cleanTeamsTitle,
            confidence: 'confirmed',
            processName: 'Teams.exe',
            status: 'Confirmed active Teams meeting',
            notes: 'Active Microsoft Teams call detected.',
            audioMethod: 'Desktop WASAPI Loopback Capture',
            audioCaptureMethod: 'Desktop WASAPI Loopback Capture',
          });
        }

        // 4. Cisco Webex detection
        else if (lower.includes('webex meeting') || lower.includes('cisco webex meeting')) {
          detections.push({
            id: s.id,
            platform: 'Cisco Webex',
            windowTitle: title,
            meetingTitle: title,
            title: title,
            confidence: 'confirmed',
            processName: 'CiscoCollabHost.exe',
            status: 'Confirmed active Webex meeting',
            notes: 'Active Webex call detected.',
            audioMethod: 'Desktop WASAPI Loopback Capture',
            audioCaptureMethod: 'Desktop WASAPI Loopback Capture',
          });
        }
      }

      return detections;
    } catch (err) {
      console.error('Error during meeting detection:', err);
      return [];
    }
  });

  // Cross-Window State Synchronization
  ipcMain.on('sync-meeting-state', (_event, state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('meeting-state-update', state);
    }
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('meeting-state-update', state);
    }
  });

  ipcMain.on('broadcast-assistant-update', (_event, update) => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('show-assistant-update', update);
    }
  });
}

// ── App Lifecycle ──────────────────────────────────────────────────────
const logFile = path.join(__dirname, 'electron.log');
function log(msg) {
  try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`); } catch (_) {}
}

log('main.cjs loaded, requesting single instance lock...');
const gotTheLock = app.requestSingleInstanceLock();
log(`gotTheLock result: ${gotTheLock}`);

if (!gotTheLock) {
  log('Could not get single instance lock, calling app.quit()');
  app.quit();
} else {
  app.on('second-instance', () => {
    log('second-instance event received - restoring windows to foreground');
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      // On Windows, forcing alwaysOnTop momentarily brings the window to the true foreground
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
          mainWindow.focus();
        }
      }, 100);
    }
    if (!floatingWindow || floatingWindow.isDestroyed()) {
      createFloatingWindow();
    } else {
      floatingWindow.show();
      floatingWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    log('app.whenReady reached!');
    // Automatically ensure Python FastAPI backend is running
    await ensureBackendRunning();
    log('backend checked');

    setupIpcHandlers();
    log('creating main window...');
    createMainWindow();
    log('main window created, creating tray...');
    createTray();
    log('tray created');

    // Optionally auto-open floating assistant if user preference says so
    const prefs = loadPreferences();
    log(`prefs.showFloatingOnStart: ${prefs.showFloatingOnStart}`);
    if (prefs.showFloatingOnStart) {
      log('creating floating window (fidget mascot)...');
      createFloatingWindow();
      log('floating window created!');
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('before-quit', () => {
    log('app before-quit event');
    isQuitting = true;
  });

  app.on('will-quit', () => {
    log('app will-quit event');
    stopBackendProcess();
  });

  app.on('quit', (_event, exitCode) => {
    log(`app quit event with code: ${exitCode}`);
  });

  process.on('uncaughtException', (err) => {
    log(`UNCAUGHT EXCEPTION: ${err ? (err.stack || err.message || err) : 'unknown'}`);
  });

  process.on('unhandledRejection', (reason) => {
    log(`UNHANDLED REJECTION: ${reason}`);
  });

  app.on('render-process-gone', (_event, _webContents, details) => {
    log(`RENDER PROCESS GONE: ${details.reason} (exitCode: ${details.exitCode})`);
  });

  app.on('window-all-closed', () => {
    // Keep app alive in tray if not explicit quit
    if (process.platform !== 'darwin' && isQuitting) {
      app.quit();
    }
  });
}
