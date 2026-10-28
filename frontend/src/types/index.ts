// Talk2Tasks AI — TypeScript Types

export type MeetingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'error';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type AnalysisSource = 'nvidia_nim' | 'local_llm' | 'demo' | 'fallback';

export interface TranscriptSegment {
  id: string;
  start_time: number;
  end_time: number;
  text: string;
  speaker: string | null;
}

export interface MeetingNotes {
  summary: string;
  key_points: string[];
  blockers: string[];
  open_questions: string[];
}

export interface Decision {
  decision_id: string;
  description: string;
  source_quote: string | null;
  confirmed: boolean;
}

export interface ActionItem {
  task_id: string;
  task_description: string;
  owner: string | null;
  deadline: string | null;
  status: TaskStatus;
  source_quote: string | null;
  confidence: number;
}

export interface EmailDraft {
  subject: string;
  greeting: string;
  summary: string;
  decisions_text: string;
  tasks_text: string;
  next_steps: string;
  closing: string;
  full_text: string;
}

export interface Meeting {
  id: string;
  title: string;
  status: MeetingStatus;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  duration_seconds: number;
  transcript: TranscriptSegment[];
  notes: MeetingNotes | null;
  decisions: Decision[];
  action_items: ActionItem[];
  email_draft: EmailDraft | null;
  analysis_source: AnalysisSource | null;
}

export interface HealthStatus {
  status: string;
  ollama_available: boolean;
  ollama_model: string | null;
  nvidia_available?: boolean;
  nvidia_model?: string | null;
  whisper_available: boolean;
  whisper_model: string | null;
  database_ok: boolean;
}

export interface DemoData {
  chunks: TranscriptSegment[][];
  analysis: {
    notes: MeetingNotes;
    decisions: Decision[];
    action_items: ActionItem[];
    source: AnalysisSource;
  };
  email: EmailDraft;
  total_segments: number;
  total_duration: number;
}

export type DetectionConfidence = 'confirmed' | 'potential' | 'unconfirmed' | 'none';

export interface MeetingDetection {
  id?: string;
  platform: 'google_meet' | 'zoom' | 'teams' | 'webex' | 'custom';
  title: string;
  confidence: DetectionConfidence;
  process_name: string;
  window_title: string | null;
  audio_capture_method: string;
  notes: string;
}


export interface MeetingQuestionAnswer {
  answer: string;
  sources: string[];
  confidence: number;
}

export interface LiveAudioChunkResponse {
  new_segments: TranscriptSegment[];
  total_segments: number;
  duration: number;
  detected_language?: string;
  detected_language_code?: string;
  detected_language_probability?: number;
}

export interface LiveAssistantNotification {
  id: string;
  type: 'task' | 'decision' | 'deadline' | 'blocker' | 'info';
  title: string;
  message: string;
  quote?: string;
  timestamp: string;
}

