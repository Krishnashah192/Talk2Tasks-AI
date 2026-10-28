"""
Generate a sample 16kHz mono WAV file for testing Talk2Tasks audio upload.
Uses only Python standard library modules (wave, struct, math).
"""

import math
import struct
import wave
from pathlib import Path


def generate_sample_wav(output_path: str = "sample_audio/test_meeting.wav", duration_seconds: int = 5):
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    sample_rate = 16000  # 16kHz mono (standard for Whisper)
    num_samples = sample_rate * duration_seconds

    with wave.open(str(path), "w") as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)

        # Generate harmonic multi-tone sound simulating speech frequencies (200Hz - 800Hz)
        frames = bytearray()
        for i in range(num_samples):
            t = float(i) / sample_rate
            # Modulate frequency to mimic speech cadence
            freq = 300 + 150 * math.sin(2 * math.pi * 1.5 * t)
            envelope = 0.5 * (1 + math.sin(2 * math.pi * 2 * t))
            sample = 16000 * envelope * math.sin(2 * math.pi * freq * t)
            sample = max(-32768, min(32767, int(sample)))
            frames.extend(struct.pack("<h", sample))

        wav.writeframes(frames)

    print(f"Sample WAV generated successfully at: {path.resolve()} ({duration_seconds}s)")


if __name__ == "__main__":
    generate_sample_wav()
