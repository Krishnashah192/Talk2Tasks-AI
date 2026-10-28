// Talk2Tasks AI — Dual-Source Audio Capture Service
// Seamlessly captures BOTH the user's microphone (their voice) AND system loopback (meeting participants)
// with Web Audio API mixing, independent volume metering, chunking, and header preservation.

export interface AudioCaptureConfig {
  sourceType: 'system' | 'microphone' | 'both';
  desktopSourceId?: string;
  chunkDurationMs?: number; // e.g. 5000ms for 5s slices
}

export type CaptureState = 'inactive' | 'recording' | 'paused' | 'error';

export class AudioCaptureService {
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private combinedAnalyser: AnalyserNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private sysAnalyser: AnalyserNode | null = null;
  private state: CaptureState = 'inactive';
  private chunkTimer: number | null = null;
  private animFrameId: number | null = null;
  private offsetSeconds: number = 0;
  private shouldRestartRecorder: boolean = false;
  private config: AudioCaptureConfig;

  public onChunkAvailable?: (blob: Blob, offsetSeconds: number) => void;
  public onVolumeLevel?: (level: number) => void; // Combined 0.0 to 1.0
  public onMicLevel?: (level: number) => void;    // User Voice 0.0 to 1.0
  public onSystemLevel?: (level: number) => void; // Meeting Audio 0.0 to 1.0
  public onStateChange?: (state: CaptureState) => void;
  public onError?: (error: Error) => void;

  constructor(config: AudioCaptureConfig = { sourceType: 'both', chunkDurationMs: 5000 }) {
    this.config = {
      chunkDurationMs: 5000,
      ...config,
    };
  }

  public getState(): CaptureState {
    return this.state;
  }

  public getOffsetSeconds(): number {
    return this.offsetSeconds;
  }

  /**
   * Start audio capture based on configured sources (Default: BOTH user mic + meeting system audio).
   */
  public async startCapture(): Promise<void> {
    try {
      this.offsetSeconds = 0;
      this.micStream = null;
      this.systemStream = null;

      // 1. Microphone capture (User's Voice)
      if (this.config.sourceType === 'microphone' || this.config.sourceType === 'both') {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          console.log('[AudioCapture] Microphone acquired successfully (User voice).');
        } catch (micErr) {
          console.warn('[AudioCapture] Microphone access failed or denied:', micErr);
          if (this.config.sourceType === 'microphone') {
            throw new Error('Microphone permission was denied. Please allow microphone access.');
          }
        }
      }

      // 2. System loopback audio capture (Meeting Participants' Voices)
      if (this.config.sourceType === 'system' || this.config.sourceType === 'both') {
        let sourceId = this.config.desktopSourceId;

        if (!sourceId && window.electronAPI) {
          try {
            const sources = await window.electronAPI.getDesktopSources();
            const screenSource = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
            if (screenSource) {
              sourceId = screenSource.id;
            }
          } catch (srcErr) {
            console.warn('[AudioCapture] Failed to enumerate Electron desktop sources:', srcErr);
          }
        }

        // Try Electron desktop loopback capture
        if (sourceId) {
          try {
            const desktopStream = await (navigator.mediaDevices as any).getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: sourceId,
                },
              },
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: sourceId,
                  minWidth: 1,
                  maxWidth: 1,
                  minHeight: 1,
                  maxHeight: 1,
                  maxFrameRate: 1,
                },
              },
            });

            const audioTracks = desktopStream.getAudioTracks();
            desktopStream.getVideoTracks().forEach((vt: MediaStreamTrack) => vt.stop());

            if (audioTracks.length > 0) {
              this.systemStream = new MediaStream(audioTracks);
              console.log('[AudioCapture] System loopback audio acquired successfully (Meeting participants).');
            }
          } catch (electronErr) {
            console.warn('[AudioCapture] Electron desktop loopback failed:', electronErr);
          }
        }
      }

      // Ensure at least one audio input stream is available
      if (!this.micStream && !this.systemStream) {
        throw new Error('No audio input could be initialized. Please check microphone access.');
      }

      // 3. Mix audio streams via Web Audio Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Ensure AudioContext is in running state (Chromium starts AudioContext in suspended state)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const destination = this.audioContext.createMediaStreamDestination();

      // Connect microphone stream if present
      if (this.micStream && this.micStream.getAudioTracks().length > 0) {
        const micSource = this.audioContext.createMediaStreamSource(this.micStream);
        this.micAnalyser = this.audioContext.createAnalyser();
        this.micAnalyser.fftSize = 64;
        micSource.connect(this.micAnalyser);
        micSource.connect(destination);
      }

      // Connect system audio stream if present
      if (this.systemStream && this.systemStream.getAudioTracks().length > 0) {
        const sysSource = this.audioContext.createMediaStreamSource(this.systemStream);
        this.sysAnalyser = this.audioContext.createAnalyser();
        this.sysAnalyser.fftSize = 64;
        sysSource.connect(this.sysAnalyser);
        sysSource.connect(destination);
      }

      this.mediaStream = destination.stream;

      // Combined Analyser
      this.combinedAnalyser = this.audioContext.createAnalyser();
      this.combinedAnalyser.fftSize = 64;
      const combinedSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      combinedSource.connect(this.combinedAnalyser);

      this.startVolumeMonitoring();

      // 4. MediaRecorder for standalone chunk delivery with valid EBML/opus headers per slice
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && this.state !== 'inactive') {
          const currentOffset = this.offsetSeconds;
          const durationSec = (this.config.chunkDurationMs || 5000) / 1000;
          this.offsetSeconds += durationSec;

          if (this.onChunkAvailable) {
            this.onChunkAvailable(event.data, currentOffset);
          }
        }
      };

      this.shouldRestartRecorder = false;
      this.mediaRecorder.onstop = () => {
        if (this.shouldRestartRecorder && this.state === 'recording' && this.mediaRecorder) {
          this.shouldRestartRecorder = false;
          try {
            this.mediaRecorder.start();
          } catch (e) {
            console.error('Failed to restart MediaRecorder after slice:', e);
          }
        }
      };

      // Interval slicing with full container headers per slice
      const sliceInterval = this.config.chunkDurationMs || 5000;
      this.chunkTimer = window.setInterval(() => {
        if (this.state === 'recording' && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.shouldRestartRecorder = true;
          this.mediaRecorder.stop();
        }
      }, sliceInterval);

      this.mediaRecorder.start();
      this.state = 'recording';
      this.notifyState();
    } catch (err: any) {
      this.state = 'error';
      this.notifyState();
      if (this.onError) {
        this.onError(err instanceof Error ? err : new Error(String(err)));
      }
      throw err;
    }
  }

  /**
   * Pause audio capture temporarily.
   */
  public pauseCapture(): void {
    if (this.state === 'recording') {
      if (this.chunkTimer) {
        clearInterval(this.chunkTimer);
        this.chunkTimer = null;
      }
      this.shouldRestartRecorder = false;
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
      if (this.audioContext && this.audioContext.state === 'running') {
        this.audioContext.suspend();
      }
      this.state = 'paused';
      this.notifyState();
    }
  }

  /**
   * Resume paused audio capture.
   */
  public resumeCapture(): void {
    if (this.state === 'paused') {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const sliceInterval = this.config.chunkDurationMs || 5000;
      this.chunkTimer = window.setInterval(() => {
        if (this.state === 'recording' && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.shouldRestartRecorder = true;
          this.mediaRecorder.stop();
        }
      }, sliceInterval);
      this.state = 'recording';
      this.notifyState();
    }
  }

  /**
   * Stop audio capture gracefully, ensuring the final recorded audio slice is delivered.
   * Returns the final audio Blob (if any).
   */
  public async stopCapture(): Promise<Blob | null> {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }
    this.shouldRestartRecorder = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    let finalChunk: Blob | null = null;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        finalChunk = await new Promise<Blob | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 1000);
          this.mediaRecorder!.addEventListener(
            'dataavailable',
            (event) => {
              clearTimeout(timeout);
              if (event.data && event.data.size > 0) {
                resolve(event.data);
              } else {
                resolve(null);
              }
            },
            { once: true }
          );
          try {
            this.mediaRecorder!.stop();
          } catch (e) {
            clearTimeout(timeout);
            resolve(null);
          }
        });
      } catch (e) {
        console.warn('Error retrieving final audio slice:', e);
      }
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.systemStream) {
      this.systemStream.getTracks().forEach((track) => track.stop());
      this.systemStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.state = 'inactive';
    this.notifyState();
    this.onVolumeLevel?.(0);
    this.onMicLevel?.(0);
    this.onSystemLevel?.(0);

    return finalChunk;
  }

  private startVolumeMonitoring(): void {
    const dataArray = new Uint8Array(32);

    const getAvgLevel = (analyser: AnalyserNode | null): number => {
      if (!analyser) return 0;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      return Math.min(1.0, avg / 120);
    };

    const checkVolume = () => {
      if (this.state === 'inactive') return;

      if (this.state === 'recording') {
        const comb = getAvgLevel(this.combinedAnalyser);
        const mic = getAvgLevel(this.micAnalyser);
        const sys = getAvgLevel(this.sysAnalyser);

        this.onVolumeLevel?.(comb);
        this.onMicLevel?.(mic);
        this.onSystemLevel?.(sys);
      } else if (this.state === 'paused') {
        this.onVolumeLevel?.(0);
        this.onMicLevel?.(0);
        this.onSystemLevel?.(0);
      }

      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    this.animFrameId = requestAnimationFrame(checkVolume);
  }

  private notifyState(): void {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }
}
