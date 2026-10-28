// Talk2Tasks AI — Settings & System Diagnostics Page (Blue & White Theme)

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Database,
  Volume2,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Server,
  Layers,
  Terminal,
  ExternalLink,
  Sparkles,
  Globe,
} from 'lucide-react';
import type { HealthStatus } from '../types';
import * as api from '../services/api';

export default function Settings() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [checking, setChecking] = useState(false);

  // NVIDIA NIM state (User writes model name and key directly — no preset dropdown options)
  const [nvidiaKey, setNvidiaKey] = useState('');
  const [customModel, setCustomModel] = useState('meta/llama-3.3-70b-instruct');
  const [baseUrl, setBaseUrl] = useState('https://integrate.api.nvidia.com/v1');
  const [savedKeyPreview, setSavedKeyPreview] = useState<string | null>(null);
  const [savingNvidia, setSavingNvidia] = useState(false);
  const [nvidiaResult, setNvidiaResult] = useState<{
    success?: boolean;
    message?: string;
    model?: string;
    base_url?: string;
  } | null>(null);

  // Ollama state
  const [ollamaTestResult, setOllamaTestResult] = useState<string | null>(null);
  const [testingOllama, setTestingOllama] = useState(false);

  // Desktop Companion preferences
  const [desktopPrefs, setDesktopPrefs] = useState({
    autoStart: false,
    floatingCorner: 'bottom-right' as const,
    notificationFrequency: 'important_only' as const,
    clickThrough: false,
    preferredAudioDevice: 'system',
  });

  const fetchHealth = async () => {
    setChecking(true);
    try {
      const res = await api.checkHealth();
      setHealth(res);
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  };

  const loadNvidiaSettings = async () => {
    try {
      const cfg = await api.getNvidiaSettings();
      if (cfg.model) setCustomModel(cfg.model);
      if (cfg.base_url) setBaseUrl(cfg.base_url);
      if (cfg.api_key_preview) setSavedKeyPreview(cfg.api_key_preview);
      if (cfg.api_key_set) {
        setNvidiaResult({
          success: cfg.valid,
          model: cfg.model,
          base_url: cfg.base_url,
          message: cfg.valid
            ? `Connected to NVIDIA NIM (${cfg.model})`
            : cfg.error || 'NVIDIA API key configured but connection test failed',
        });
      }
    } catch (err) {
      console.error('Failed to load NVIDIA settings:', err);
    }
  };

  useEffect(() => {
    fetchHealth();
    loadNvidiaSettings();
    if (window.electronAPI) {
      window.electronAPI.getPreferences().then((prefs) => {
        if (prefs) setDesktopPrefs(prefs as any);
      }).catch(() => {});
    }
  }, []);

  const handleSaveNvidia = async () => {
    if (!nvidiaKey.trim() && !savedKeyPreview) {
      alert('Please enter your NVIDIA API key (starts with nvapi-...)');
      return;
    }
    if (!customModel.trim()) {
      alert('Please write your model name (e.g. meta/llama-3.3-70b-instruct or custom model)');
      return;
    }
    setSavingNvidia(true);
    setNvidiaResult(null);
    try {
      const keyToUse = nvidiaKey.trim() || 'KEEP_EXISTING';
      const res = await api.saveNvidiaSettings(keyToUse, customModel.trim(), baseUrl.trim());
      setNvidiaResult({
        success: res.success,
        model: res.model || customModel.trim(),
        base_url: res.base_url || baseUrl.trim(),
        message: res.message || (res.success ? `Connected to NVIDIA NIM (${res.model})` : 'Connection failed'),
      });
      if (res.success) {
        setNvidiaKey('');
        await loadNvidiaSettings();
      }
      fetchHealth();
    } catch (err: any) {
      setNvidiaResult({
        success: false,
        message: err.message || 'Failed to connect to NVIDIA NIM',
      });
    } finally {
      setSavingNvidia(false);
    }
  };

  const testOllamaConnection = async () => {
    setTestingOllama(true);
    setOllamaTestResult(null);
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name).join(', ');
        setOllamaTestResult(`Connected! Models detected: ${models || 'None yet (pull one via ollama run llama3)'}`);
      } else {
        setOllamaTestResult(`Ollama returned status ${res.status}. Ensure ollama is running.`);
      }
    } catch {
      setOllamaTestResult('Could not reach Ollama at http://localhost:11434. System will use NVIDIA NIM or local fallback.');
    } finally {
      setTestingOllama(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <SettingsIcon className="w-5 h-5" />
            </div>
            System Diagnostics & AI Provider
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Choose between free cloud-hosted open-source models (NVIDIA NIM), local offline Ollama, or deterministic fallback.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={checking}
          className="btn-secondary text-xs self-start md:self-auto py-2.5 px-4 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          Refresh Diagnostics
        </button>
      </div>

      {/* Component Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* FastAPI Card */}
        <div className="card-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Server className="w-5 h-5 text-blue-600" />
            {health ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-semibold">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> Disconnected
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">FastAPI Backend</h3>
            <p className="text-xs text-slate-500 mt-0.5">Uvicorn ASGI • Port 8000</p>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between font-medium">
            <span>Async Workers:</span>
            <span className="text-blue-600 font-semibold">Active</span>
          </div>
        </div>

        {/* Faster-Whisper Card */}
        <div className="card-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Volume2 className="w-5 h-5 text-blue-600" />
            {health?.whisper_available ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" /> Standby
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Faster-Whisper</h3>
            <p className="text-xs text-slate-500 mt-0.5">CTranslate2 Local STT</p>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between font-medium">
            <span>Model:</span>
            <span className="text-slate-800 font-semibold">{health?.whisper_model || 'base.en'}</span>
          </div>
        </div>

        {/* AI Model Card (NVIDIA NIM or Ollama) */}
        <div className="card-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
            {health?.nvidia_available ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> NIM Active
              </span>
            ) : health?.ollama_available ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ollama Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                Fallback Ready
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Active LLM Engine</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {health?.nvidia_available
                ? 'NVIDIA NIM Open-Source API'
                : health?.ollama_available
                ? 'Local Ollama'
                : 'Deterministic Fallback'}
            </p>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between font-medium">
            <span>Model:</span>
            <span className="text-slate-800 font-semibold truncate max-w-[130px]">
              {health?.nvidia_model || health?.ollama_model || 'Deterministic'}
            </span>
          </div>
        </div>

        {/* Database Card */}
        <div className="card-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Database className="w-5 h-5 text-blue-600" />
            {health?.database_ok ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Healthy
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-semibold">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> Error
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">SQLite Database</h3>
            <p className="text-xs text-slate-500 mt-0.5">aiosqlite Asynchronous</p>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between font-medium">
            <span>Schema:</span>
            <span className="text-slate-800 font-semibold">v1.0 (Indexed)</span>
          </div>
        </div>
      </div>

      {/* NVIDIA NIM Open-Source Model Configuration & Persistent Connection */}
      <div className="card-white p-6 space-y-5 border-blue-200 relative overflow-hidden bg-gradient-to-b from-blue-50/30 to-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">NVIDIA NIM Open-Source AI Connection</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  Custom Model Input
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Type your chosen open-source model name and API key. No preset limits — connect directly to any model on build.nvidia.com or your custom NIM deployment.
              </p>
            </div>
          </div>

          <a
            href="https://build.nvidia.com/models"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-xs inline-flex items-center gap-1.5 self-start md:self-auto text-blue-700 border-blue-200 hover:bg-blue-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Browse Models on build.nvidia.com
          </a>
        </div>

        {/* Free-Text Input Grid (No Dropdowns — User Types Model & Key) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Custom Model Name (Direct text input, NO dropdown options) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Model Name (Write Your Chosen Model)</span>
              <span className="text-[10px] font-semibold text-blue-600">Free-Text</span>
            </label>
            <input
              type="text"
              placeholder="e.g. meta/llama-3.3-70b-instruct or custom-model"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Write any model name (e.g. <code className="text-blue-700 font-semibold">meta/llama-3.3-70b-instruct</code>, <code className="text-blue-700 font-semibold">qwen/qwen2.5-72b-instruct</code>, <code className="text-blue-700 font-semibold">deepseek-ai/deepseek-r1</code>).
            </p>
          </div>

          {/* Base URL (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Base URL / Endpoint (Optional)</span>
              <span className="text-[10px] text-slate-400 font-normal">Default: build.nvidia.com</span>
            </label>
            <input
              type="text"
              placeholder="https://integrate.api.nvidia.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Default is standard NVIDIA integrate endpoint, or specify your enterprise NIM endpoint.
            </p>
          </div>

          {/* API Key Input */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>NVIDIA API Key (starts with <code className="text-blue-700 font-semibold">nvapi-...</code>)</span>
              {savedKeyPreview && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Key Saved: {savedKeyPreview}
                </span>
              )}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                placeholder={savedKeyPreview ? `Leave blank to keep current key (${savedKeyPreview}) or enter new key` : "nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                value={nvidiaKey}
                onChange={(e) => setNvidiaKey(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono transition-all"
              />
              <button
                onClick={handleSaveNvidia}
                disabled={savingNvidia}
                className="btn-primary text-xs whitespace-nowrap bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 py-2.5 px-5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {savingNvidia ? 'Connecting to NVIDIA...' : 'Connect to NVIDIA'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Credentials are saved securely to <code className="font-mono text-slate-700 font-semibold">data/nvidia_config.json</code> and stay permanently connected across app restarts.
            </p>
          </div>
        </div>

        {/* Live Persistent Connection Result Banner */}
        {nvidiaResult && (
          <div
            className={`p-4 rounded-xl text-xs flex items-start gap-3 font-medium transition-all ${
              nvidiaResult.success
                ? 'bg-emerald-50/90 border border-emerald-200 text-emerald-900 shadow-2xs'
                : 'bg-rose-50/90 border border-rose-200 text-rose-900 shadow-2xs'
            }`}
          >
            {nvidiaResult.success ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="space-y-0.5 flex-1">
              <div className="font-bold flex items-center gap-2">
                <span>{nvidiaResult.success ? 'Connected & Active in NVIDIA Cloud' : 'Connection Failed'}</span>
                {nvidiaResult.success && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <p className="text-xs opacity-90">{nvidiaResult.message}</p>
              {nvidiaResult.success && (
                <p className="text-[11px] text-emerald-700 pt-1">
                  Active Model: <strong>{nvidiaResult.model || customModel}</strong> • All meeting analyses and question-answering are now routed through NVIDIA NIM.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multilingual Support & Auto-Language Detection Information Card */}
      <div className="card-white p-6 space-y-3 border-blue-100 bg-gradient-to-r from-blue-50/20 via-white to-slate-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Automatic Multi-Language Support</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                99+ Languages
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Talk2Tasks AI automatically detects the spoken language during meetings with zero manual switching required.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <div className="font-bold text-slate-800">🌐 Auto-Detection STT</div>
            <div className="text-slate-500 text-[11px] mt-0.5">Faster-Whisper auto-detects English, Hindi, Spanish, French, German, Japanese, Marathi, etc.</div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <div className="font-bold text-slate-800">🗣️ Code-Switching & Hinglish</div>
            <div className="text-slate-500 text-[11px] mt-0.5">Handles natural mixed speech gracefully without losing context or dropping vernacular sentences.</div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200">
            <div className="font-bold text-slate-800">📝 Standardized English Output</div>
            <div className="text-slate-500 text-[11px] mt-0.5">Extracts structured summaries and action items in English while faithfully retaining proper names.</div>
          </div>
        </div>
      </div>

      {/* Local Ollama Diagnostic */}
      <div className="card-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Local Ollama LLM (100% Offline)</h3>
              <p className="text-xs text-slate-500">Ping localhost:11434 to check for locally installed models (e.g. llama3, phi3, mistral).</p>
            </div>
          </div>
          <button
            onClick={testOllamaConnection}
            disabled={testingOllama}
            className="btn-secondary text-xs py-2 px-3.5"
          >
            {testingOllama ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {ollamaTestResult && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono">
            {ollamaTestResult}
          </div>
        )}
      </div>

      {/* Presentation Architecture & Privacy Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Architecture Details */}
        <div className="card-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Layers className="w-5 h-5 text-blue-600" />
            Supported Open-Source Models
          </div>
          <ul className="text-xs text-slate-700 space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
              <span><strong>Meta Llama 3.3 70B:</strong> SOTA open-weights model, 128k context, ideal for lengthy multi-hour meetings.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
              <span><strong>Qwen 2.5 72B:</strong> Top ranked in structured JSON extraction and deadline attribution.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
              <span><strong>DeepSeek R1:</strong> Advanced chain-of-thought reasoning for detecting unstated blockers and decisions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
              <span><strong>Local Whisper & Engine:</strong> Speech transcription and zero-crash fallbacks remain 100% on-device.</span>
            </li>
          </ul>
        </div>

        {/* Desktop Companion Settings */}
        <div className="card-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Desktop Companion Preferences
            </div>
            {window.electronAPI?.isElectron && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Electron Active
              </span>
            )}
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Launch on Login */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Launch on Windows Startup</span>
                <span className="text-slate-500 text-[11px]">
                  Automatically open Talk2Tasks in the system tray when Windows starts. Never records automatically.
                </span>
              </div>
              <input
                type="checkbox"
                checked={desktopPrefs.autoStart}
                onChange={async (e) => {
                  const val = e.target.checked;
                  setDesktopPrefs((p) => ({ ...p, autoStart: val }));
                  if (window.electronAPI) {
                    await window.electronAPI.setAutoStart(val);
                    await window.electronAPI.savePreferences({ autoStart: val });
                  }
                }}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
            </div>

            {/* Corner position */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Default Screen Corner</span>
                <span className="text-slate-500 text-[11px]">
                  Where the floating mascot companion appears on your monitor.
                </span>
              </div>
              <select
                value={desktopPrefs.floatingCorner}
                onChange={async (e) => {
                  const val = e.target.value as any;
                  setDesktopPrefs((p) => ({ ...p, floatingCorner: val }));
                  if (window.electronAPI) {
                    await window.electronAPI.setFloatingPosition(val);
                    await window.electronAPI.savePreferences({ floatingCorner: val });
                  }
                }}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="bottom-right">Bottom Right (Default)</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>

            {/* Notification Frequency */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Notification Frequency</span>
                <span className="text-slate-500 text-[11px]">
                  Controls when the floating companion surfaces updates.
                </span>
              </div>
              <select
                value={desktopPrefs.notificationFrequency}
                onChange={async (e) => {
                  const val = e.target.value as any;
                  setDesktopPrefs((p) => ({ ...p, notificationFrequency: val }));
                  if (window.electronAPI) {
                    await window.electronAPI.savePreferences({ notificationFrequency: val });
                  }
                }}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="important_only">Important Only (Tasks, Decisions, Deadlines)</option>
                <option value="all">All Meeting Updates</option>
                <option value="quiet">Quiet Mode (No Popup Alerts)</option>
              </select>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => window.electronAPI?.toggleFloating(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition-all shadow-sm"
              >
                Open Floating Mascot Now
              </button>
            </div>
          </div>
        </div>

        {/* Privacy & Compliance */}
        <div className="card-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Zero-Cloud Local Privacy
          </div>
          <div className="space-y-3 text-xs text-slate-700">
            <p className="leading-relaxed">
              When running locally via Ollama or the built-in deterministic engine, no audio, transcripts, or summaries ever leave your computer.
            </p>
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Open-Source Flexibility
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                You can switch between local offline processing (Ollama/Fallback) and high-accuracy free open models (NVIDIA NIM) with a single click.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
