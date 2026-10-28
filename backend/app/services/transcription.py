"""
Talk2Tasks AI — Transcription Service (Faster-Whisper)
Lazy-loaded local speech-to-text using CTranslate2-backed Whisper.

License: faster-whisper is MIT licensed.
         CTranslate2 is MIT licensed.
         Whisper model weights are MIT licensed (OpenAI).
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

from app.schemas import TranscriptSegment

logger = logging.getLogger(__name__)

# ── Module-level state (lazy loaded) ──────────────────────────────────

_model = None
_model_size: Optional[str] = None
_is_available = False


def get_whisper_config() -> dict:
    """Return current whisper configuration."""
    model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
    device = os.getenv("WHISPER_DEVICE", "auto")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "auto")

    # Auto-detect device
    if device == "auto":
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"

    # Auto-select compute type
    if compute_type == "auto":
        compute_type = "float16" if device == "cuda" else "int8"

    return {
        "model_size": model_size,
        "device": device,
        "compute_type": compute_type,
    }


def is_whisper_available() -> bool:
    """Check if Faster-Whisper is importable."""
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def get_loaded_model_info() -> Optional[str]:
    """Return the currently loaded model name, or None."""
    return _model_size if _model is not None else None


async def load_model(model_size: Optional[str] = None) -> bool:
    """
    Lazy-load the Faster-Whisper model.
    Downloads the model on first call if not cached.
    Returns True if the model loaded successfully.
    """
    global _model, _model_size, _is_available

    if _model is not None and (model_size is None or model_size == _model_size):
        return True

    if not is_whisper_available():
        logger.warning("faster-whisper is not installed")
        return False

    config = get_whisper_config()
    size = model_size or config["model_size"]
    device = config["device"]
    compute_type = config["compute_type"]

    try:
        from faster_whisper import WhisperModel

        logger.info(
            f"Loading Faster-Whisper model '{size}' on {device} ({compute_type})..."
        )
        _model = WhisperModel(size, device=device, compute_type=compute_type)
        _model_size = size
        _is_available = True
        logger.info(f"Faster-Whisper model '{size}' loaded successfully.")
        return True

    except Exception as e:
        logger.error(f"Failed to load Faster-Whisper model '{size}': {e}")
        _model = None
        _model_size = None
        _is_available = False

        # If GPU failed, retry with CPU
        if device == "cuda":
            logger.info("Retrying with CPU...")
            try:
                from faster_whisper import WhisperModel

                _model = WhisperModel(size, device="cpu", compute_type="int8")
                _model_size = size
                _is_available = True
                logger.info(f"Faster-Whisper model '{size}' loaded on CPU (int8).")
                return True
            except Exception as e2:
                logger.error(f"CPU fallback also failed: {e2}")
                return False
        return False


# Human-friendly mapping for Whisper detected languages
LANGUAGE_DISPLAY_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "mr": "Marathi",
    "ta": "Tamil",
    "te": "Telugu",
    "gu": "Gujarati",
    "bn": "Bengali",
    "pa": "Punjabi",
    "ur": "Urdu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "nl": "Dutch",
    "tr": "Turkish",
    "pl": "Polish",
    "sv": "Swedish",
    "id": "Indonesian",
    "vi": "Vietnamese",
}


def get_language_name(code: Optional[str]) -> str:
    """Return readable name for language code."""
    if not code:
        return "Auto-Detect"
    return LANGUAGE_DISPLAY_NAMES.get(code.lower(), code.upper())


async def transcribe_audio_with_info(
    file_path: str,
    language: Optional[str] = None,
) -> tuple[list[TranscriptSegment], dict]:
    """
    Transcribe an audio file and return both structured segments and detected language details.

    Args:
        file_path: Path to the audio file (WAV, MP3, M4A, WebM, etc.).
        language: Language code or None for automatic multi-language detection.

    Returns:
        tuple of (List[TranscriptSegment], dict of language info)
    """
    if _model is None:
        loaded = await load_model()
        if not loaded:
            raise RuntimeError(
                "Faster-Whisper model is not loaded. "
                "Run setup to download the model, or check that faster-whisper is installed."
            )

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    if path.stat().st_size == 0:
        raise ValueError("Audio file is empty (0 bytes).")

    try:
        # None language triggers Faster-Whisper's built-in multi-language detector
        segments_gen, info = _model.transcribe(
            str(path),
            language=language,
            beam_size=2,
            vad_filter=False,
        )

        detected_lang = info.language or "unknown"
        detected_name = get_language_name(detected_lang)
        detected_prob = round(float(info.language_probability or 0.0), 3)

        logger.info(
            f"Multi-language STT: detected={detected_name} ({detected_lang}), "
            f"probability={detected_prob:.2f}, "
            f"duration={info.duration:.1f}s"
        )

        transcript_segments: list[TranscriptSegment] = []
        for seg in segments_gen:
            text = seg.text.strip()
            if text:
                transcript_segments.append(
                    TranscriptSegment(
                        start_time=round(seg.start, 2),
                        end_time=round(seg.end, 2),
                        text=text,
                        speaker=None,
                    )
                )

        if not transcript_segments:
            logger.warning("Transcription produced no text segments.")

        info_dict = {
            "language": detected_lang,
            "language_name": detected_name,
            "probability": detected_prob,
            "duration": round(float(info.duration or 0.0), 2),
        }

        return transcript_segments, info_dict

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise RuntimeError(f"Transcription failed: {e}") from e


async def transcribe_audio(
    file_path: str,
    language: Optional[str] = None,
) -> list[TranscriptSegment]:
    """
    Transcribe an audio file and return structured segments.
    Default language=None enables automatic multi-language detection (99+ languages).
    """
    segments, _ = await transcribe_audio_with_info(file_path, language=language)
    return segments

