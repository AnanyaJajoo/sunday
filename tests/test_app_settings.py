from __future__ import annotations

from pathlib import Path

import pytest

from backend import app_settings


def test_get_app_settings_serializes_runtime_values(monkeypatch):
    monkeypatch.setattr(app_settings.Config, "target_calendar_id", "primary")
    monkeypatch.setattr(app_settings.Config, "travel_mode", "walking")
    monkeypatch.setattr(app_settings.Config, "text_email_links", True)
    monkeypatch.setattr(app_settings.Config, "work_days", ["mon", "wed", "fri"])

    settings = app_settings.get_app_settings()

    assert settings["TARGET_CALENDAR_ID"] == "primary"
    assert settings["TRAVEL_TYPE"] == "walking"
    assert settings["TEXT_EMAIL_LINKS"] is True
    assert settings["WORK_DAYS"] == "mon,wed,fri"


def test_update_app_settings_persists_and_applies_runtime_values(tmp_path, monkeypatch):
    config_path = tmp_path / "config.env"
    config_path.write_text("TARGET_CALENDAR_ID=primary\nTEXT_EMAIL_LINKS=true\n")

    monkeypatch.setattr(app_settings, "CONFIG_FILE_PATH", config_path)

    updated = app_settings.update_app_settings(
        {
            "TARGET_CALENDAR_ID": "sunday-calendar",
            "TEXT_EMAIL_LINKS": False,
            "TRAVEL_TYPE": "transit",
            "WORK_DAYS": "mon, tue, thu",
        }
    )

    contents = config_path.read_text()
    assert "TARGET_CALENDAR_ID=sunday-calendar" in contents
    assert "TEXT_EMAIL_LINKS=false" in contents
    assert "TRAVEL_TYPE=transit" in contents
    assert "WORK_DAYS=mon,tue,thu" in contents
    assert updated["TARGET_CALENDAR_ID"] == "sunday-calendar"
    assert updated["TEXT_EMAIL_LINKS"] is False
    assert app_settings.Config.target_calendar_id == "sunday-calendar"
    assert app_settings.Config.text_email_links is False
    assert app_settings.Config.travel_mode == "transit"
    assert app_settings.Config.work_days == ["mon", "tue", "thu"]


def test_update_app_settings_rejects_invalid_values():
    with pytest.raises(ValueError, match="TRAVEL_TYPE must be one of"):
        app_settings.update_app_settings({"TRAVEL_TYPE": "commuting"})
