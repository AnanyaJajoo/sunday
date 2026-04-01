from __future__ import annotations

import pytest

from errors import MessagingDeliveryError
from messenger import format_summary, send_summary


def test_format_summary_for_event_is_informal_and_includes_email_link(monkeypatch):
    monkeypatch.setattr("messenger.Config.timezone", "America/Chicago")

    message = format_summary(
        parsed_email={
            "has_event": True,
            "summary": "Meet Aryan for lunch at the Union at 3 PM.",
            "event": {
                "date": "2099-04-01",
                "start_time": "15:00",
                "location": "1401 W Green St, Urbana, IL 61801",
                "is_online": False,
            },
        },
        travel_info={"departure_time": "2:35 PM"},
        source_email_link="https://mail.google.com/mail/u/0/#all/thread-123",
    )

    assert "reminder: Meet Aryan for lunch at the Union at 3 PM!" in message
    assert "location: 1401 W Green St, Urbana, IL 61801" in message
    assert "time: Apr 1 at 3:00 p.m." in message
    assert "leave by: 2:35 p.m." in message
    assert "original email: https://mail.google.com/mail/u/0/#all/thread-123" in message


@pytest.mark.anyio
async def test_send_summary_requires_configured_channel(monkeypatch):
    monkeypatch.setattr("messenger.Config.telegram_token", "")
    monkeypatch.setattr("messenger.Config.telegram_chat_id", "")
    monkeypatch.setattr("messenger.Config.imessage_enabled", False)

    with pytest.raises(MessagingDeliveryError):
        await send_summary({"summary": "Hello", "urgency": "none", "can_wait": True})
