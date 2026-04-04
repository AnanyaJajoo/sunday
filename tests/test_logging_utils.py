from __future__ import annotations

import logging

from backend.logging_utils import PrettyLogFormatter


def test_pretty_log_formatter_compacts_logger_names_without_color():
    formatter = PrettyLogFormatter(use_color=False)
    record = logging.makeLogRecord(
        {
            "name": "smart-calendar",
            "levelno": logging.INFO,
            "msg": "Smart Calendar starting",
            "created": 1_775_081_061.0,
        }
    )

    rendered = formatter.format(record)

    assert " | INFO  | app      Smart Calendar starting" in rendered


def test_pretty_log_formatter_indents_multiline_messages():
    formatter = PrettyLogFormatter(use_color=False)
    record = logging.makeLogRecord(
        {
            "name": "pipeline",
            "levelno": logging.WARNING,
            "msg": "Travel estimate unavailable\nGoogle Maps returned ZERO_RESULTS",
            "created": 1_775_081_061.0,
        }
    )

    rendered = formatter.format(record)
    lines = rendered.splitlines()
    prefix = lines[0].split("Travel estimate unavailable")[0]

    assert lines[0].endswith("Travel estimate unavailable")
    assert lines[1].startswith(" " * len(prefix))
