from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from .config import Config


class TranscriptionError(RuntimeError):
    """Raised when local speech transcription fails."""


def _normalize_transcript(text: str) -> str:
    """Collapse the model output into a clean single-line transcript."""
    parts = [line.strip() for line in text.splitlines() if line.strip()]
    return " ".join(parts).strip()


def _run_checked_command(command: list[str], label: str) -> None:
    """Run a subprocess and raise a helpful error when it fails."""
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise TranscriptionError(f"{label} is not installed or not on PATH.") from exc

    if completed.returncode == 0:
        return

    stderr = completed.stderr.strip()
    stdout = completed.stdout.strip()
    detail = stderr or stdout or f"{label} exited with status {completed.returncode}."
    raise TranscriptionError(f"{label} failed: {detail}")


def _ffmpeg_command(source: Path, destination: Path) -> list[str]:
    return [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(destination),
    ]


def _whisper_command(source: Path, output_prefix: Path) -> list[str]:
    threads = max(1, min(Config.transcription_threads, os.cpu_count() or 4))
    return [
        "whisper-cpp",
        "-m",
        Config.transcription_model_path,
        str(source),
        "-l",
        Config.transcription_language,
        "-t",
        str(threads),
        "-otxt",
        "-of",
        str(output_prefix),
        "-nt",
        "-np",
    ]


def transcribe_audio_file(source: str | Path) -> str:
    """Convert an uploaded audio file to WAV and transcribe it locally."""
    source_path = Path(source)
    if not source_path.exists():
        raise TranscriptionError(f"Audio file not found: {source_path}")

    model_path = Path(Config.transcription_model_path)
    if not model_path.exists():
        raise TranscriptionError(f"Speech model not found: {model_path}")

    with tempfile.TemporaryDirectory(prefix="sunday-transcription-") as temp_dir:
        temp_root = Path(temp_dir)
        wav_path = temp_root / "recording.wav"
        output_prefix = temp_root / "transcript"

        _run_checked_command(_ffmpeg_command(source_path, wav_path), "ffmpeg")
        _run_checked_command(_whisper_command(wav_path, output_prefix), "whisper-cpp")

        transcript_path = output_prefix.with_suffix(".txt")
        if not transcript_path.exists():
            raise TranscriptionError("whisper-cpp did not produce a transcript file.")

        transcript = _normalize_transcript(transcript_path.read_text())
        if not transcript:
            raise TranscriptionError("No speech was transcribed from the recording.")

        return transcript
