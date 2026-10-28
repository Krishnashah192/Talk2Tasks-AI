// Talk2Tasks AI — API Service Layer

import type {
  Meeting,
  HealthStatus,
  DemoData,
  TranscriptSegment,
  ActionItem,
  MeetingDetection,
  MeetingQuestionAnswer,
  LiveAudioChunkResponse,
} from '../types';

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? 'http://127.0.0.1:8000/api'
    : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }

  // Handle text responses (export)
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('text/')) {
    return (await res.text()) as unknown as T;
  }

  return res.json();
}

// ── Health ─────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/health');
}

// ── Demo ──────────────────────────────────────────────────────────────

export async function getDemoData(): Promise<DemoData> {
  return request<DemoData>('/demo');
}

// ── Meetings ──────────────────────────────────────────────────────────

export async function createMeeting(title: string): Promise<Meeting> {
  return request<Meeting>('/meetings', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function listMeetings(): Promise<Meeting[]> {
  return request<Meeting[]>('/meetings');
}

export async function getMeeting(id: string): Promise<Meeting> {
  return request<Meeting>(`/meetings/${id}`);
}

export async function deleteMeeting(id: string): Promise<void> {
  return request(`/meetings/${id}`, { method: 'DELETE' });
}

// ── Transcript ────────────────────────────────────────────────────────

export async function addTranscript(
  meetingId: string,
  segments: TranscriptSegment[]
): Promise<Meeting> {
  return request<Meeting>(`/meetings/${meetingId}/transcript`, {
    method: 'POST',
    body: JSON.stringify({ segments }),
  });
}

// ── Analysis ──────────────────────────────────────────────────────────

export async function analyzeMeeting(
  meetingId: string,
  useDemo: boolean = false
): Promise<Meeting> {
  return request<Meeting>(
    `/meetings/${meetingId}/analyze?use_demo=${useDemo}`,
    { method: 'POST' }
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────

export async function updateTask(
  meetingId: string,
  taskId: string,
  updates: Partial<ActionItem>
): Promise<ActionItem> {
  return request<ActionItem>(`/meetings/${meetingId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ── Email ─────────────────────────────────────────────────────────────

export async function generateEmail(
  meetingId: string,
  useDemo: boolean = false
): Promise<Meeting> {
  return request<Meeting>(
    `/meetings/${meetingId}/email-draft?use_demo=${useDemo}`,
    { method: 'POST' }
  );
}

// ── Transcribe ────────────────────────────────────────────────────────

export async function transcribeAudio(
  file: File
): Promise<{ filename: string; segments: TranscriptSegment[]; segment_count: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

// ── Export ─────────────────────────────────────────────────────────────

export async function exportMeeting(meetingId: string): Promise<string> {
  return request<string>(`/meetings/${meetingId}/export`);
}

// ── NVIDIA NIM Settings ────────────────────────────────────────────────

export interface NvidiaSettingsResponse {
  api_key_set: boolean;
  api_key_preview?: string;
  model: string;
  base_url: string;
  valid?: boolean;
  success?: boolean;
  error?: string | null;
  message?: string;
}

export async function getNvidiaSettings(): Promise<NvidiaSettingsResponse> {
  return request<NvidiaSettingsResponse>('/settings/nvidia');
}

export async function saveNvidiaSettings(
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<NvidiaSettingsResponse> {
  return request<NvidiaSettingsResponse>('/settings/nvidia', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey, model, base_url: baseUrl }),
  });
}

// ── Live Meeting Companion ─────────────────────────────────────────────

export async function detectMeetings(): Promise<{ detections: MeetingDetection[]; count: number }> {
  return request<{ detections: MeetingDetection[]; count: number }>('/detect-meetings');
}

export async function askMeetingQuestion(
  meetingId: string,
  question: string
): Promise<MeetingQuestionAnswer> {
  return request<MeetingQuestionAnswer>(`/meetings/${meetingId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export async function sendAudioChunk(
  meetingId: string,
  audioBlob: Blob,
  offsetSeconds: number = 0.0
): Promise<LiveAudioChunkResponse> {
  const formData = new FormData();
  let filename = 'chunk.wav';
  if (audioBlob.type.includes('webm')) {
    filename = 'chunk.webm';
  } else if (audioBlob.type.includes('ogg')) {
    filename = 'chunk.ogg';
  } else if (audioBlob.type.includes('mp4')) {
    filename = 'chunk.mp4';
  }
  formData.append('file', audioBlob, filename);

  const res = await fetch(`${API_BASE}/meetings/${meetingId}/audio-stream?offset_seconds=${offsetSeconds}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Chunk transcription failed: ${res.status}`);
  }

  return res.json();
}

export async function completeLiveMeeting(meetingId: string): Promise<Meeting> {
  return request<Meeting>(`/meetings/${meetingId}/complete-live`, {
    method: 'POST',
  });
}

