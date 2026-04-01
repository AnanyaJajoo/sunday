"""
logging_utils.py — Compact colored logging for local terminal runs.
"""
from __future__ import annotations

import logging
import os
import sys
from datetime import datetime

_RESET = "\033[0m"
_DIM = "\033[2m"
_BOLD = "\033[1m"

_LEVEL_STYLES: dict[int, tuple[str, str]] = {
    logging.DEBUG: ("\033[36m", "DEBUG"),
    logging.INFO: ("\033[32m", "INFO"),
    logging.WARNING: ("\033[33m", "WARN"),
    logging.ERROR: ("\033[31m", "ERROR"),
    logging.CRITICAL: ("\033[35m", "CRIT"),
}

_LOGGER_LABELS = {
    "smart-calendar": "app",
    "pipeline": "pipeline",
    "gmail_watcher": "gmail",
    "calendar_manager": "calendar",
    "travel_estimator": "maps",
    "email_parser": "parser",
    "google_auth": "google",
    "llm_client": "llm",
    "messenger": "text",
    "server": "api",
    "day_planner": "plan",
}

_LOGGER_COLORS = {
    "app": "\033[95m",
    "pipeline": "\033[94m",
    "gmail": "\033[96m",
    "calendar": "\033[92m",
    "maps": "\033[93m",
    "parser": "\033[90m",
    "google": "\033[91m",
    "llm": "\033[35m",
    "text": "\033[92m",
    "api": "\033[96m",
    "plan": "\033[94m",
}


def _supports_color(stream) -> bool:
    """Return true when ANSI color output is appropriate for this stream."""
    if os.getenv("NO_COLOR") is not None:
        return False
    if os.getenv("TERM", "").lower() == "dumb":
        return False
    return bool(getattr(stream, "isatty", lambda: False)())


def _logger_label(name: str) -> str:
    """Convert verbose logger names into compact stable labels."""
    if name in _LOGGER_LABELS:
        return _LOGGER_LABELS[name]

    short = name.rsplit(".", 1)[-1].replace("-", "_")
    compact = short.replace("_", "")
    return compact[:8] or "app"


class PrettyLogFormatter(logging.Formatter):
    """Render compact human-friendly logs with optional ANSI styling."""

    def __init__(self, use_color: bool = True) -> None:
        super().__init__()
        self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
        level_label = self._level_label(record.levelno)
        logger_label = _logger_label(record.name)

        message = record.getMessage()
        if record.exc_info:
            message = f"{message}\n{self.formatException(record.exc_info)}"
        if record.stack_info:
            message = f"{message}\n{self.formatStack(record.stack_info)}"

        prefix_plain = f"{timestamp} | {level_label:<5} | {logger_label:<8} "
        prefix = self._style_prefix(timestamp, level_label, logger_label, record.levelno)
        return self._indent_multiline(prefix, prefix_plain, message)

    def _level_label(self, levelno: int) -> str:
        """Return a short fixed-width level label."""
        return _LEVEL_STYLES.get(levelno, ("", logging.getLevelName(levelno)))[1]

    def _style_prefix(
        self,
        timestamp: str,
        level_label: str,
        logger_label: str,
        levelno: int,
    ) -> str:
        """Style the shared log prefix."""
        if not self.use_color:
            return f"{timestamp} | {level_label:<5} | {logger_label:<8} "

        level_color = _LEVEL_STYLES.get(levelno, ("", ""))[0]
        if not level_color:
            level_color = _LEVEL_STYLES[logging.INFO][0]
        logger_color = _LOGGER_COLORS.get(logger_label, "\033[90m")
        return (
            f"{_DIM}{timestamp}{_RESET} | "
            f"{level_color}{level_label:<5}{_RESET} | "
            f"{logger_color}{_BOLD}{logger_label:<8}{_RESET} "
        )

    @staticmethod
    def _indent_multiline(prefix: str, prefix_plain: str, message: str) -> str:
        """Indent multi-line log bodies under the first line."""
        lines = message.splitlines() or [""]
        if len(lines) == 1:
            return f"{prefix}{lines[0]}"

        continuation_prefix = " " * len(prefix_plain)
        remainder = "\n".join(f"{continuation_prefix}{line}" for line in lines[1:])
        return f"{prefix}{lines[0]}\n{remainder}"


def setup_logging(log_level: str, *, force: bool = False) -> None:
    """Configure project logging with compact terminal formatting."""
    root = logging.getLogger()
    level = getattr(logging, log_level.upper(), logging.INFO)
    root.setLevel(level)

    if force or not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(PrettyLogFormatter(use_color=_supports_color(sys.stderr)))
        root.handlers = [handler]

    # Keep third-party noise out of the local terminal.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("googleapiclient.discovery_cache").setLevel(logging.ERROR)
    logging.getLogger("google_auth_oauthlib.flow").setLevel(logging.WARNING)
