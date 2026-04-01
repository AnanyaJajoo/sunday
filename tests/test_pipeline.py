from __future__ import annotations

import pytest

from errors import MessagingDeliveryError, TravelEstimationError
from pipeline import process_single_email


class _FakeGmail:
    def __init__(self):
        self.processed_ids = []

    def mark_as_processed(self, message_id: str) -> None:
        self.processed_ids.append(message_id)


class _FakeCalendar:
    def __init__(self):
        self.last_event = None

    def create_smart_event(self, parsed_event, travel_info=None, source_email_id=None):
        del travel_info, source_email_id
        self.last_event = parsed_event
        return {
            "status": "created",
            "event": {"htmlLink": "https://calendar.google.com/event"},
        }


class _FakeTravel:
    def __init__(self):
        self.last_estimate_args = None

    async def resolve_destination(self, destination):
        if destination == "Illini Union":
            return {
                "formatted_address": "1401 W Green St, Urbana, IL 61801",
                "display_location": "Illini Union (1401 W Green St, Urbana, IL 61801)",
                "routing_destination": "1401 W Green St, Urbana, IL 61801",
            }
        return {
            "formatted_address": destination,
            "display_location": destination,
            "routing_destination": destination,
        }

    async def estimate(
        self,
        destination,
        departure_time=None,
        origin=None,
        origin_label=None,
        origin_source=None,
    ):
        self.last_estimate_args = {
            "destination": destination,
            "departure_time": departure_time,
            "origin": origin,
            "origin_label": origin_label,
            "origin_source": origin_source,
        }
        return {"travel_minutes": 25, "departure_time": "1:20 PM"}


class _ResolveDeniedTravel(_FakeTravel):
    async def resolve_destination(self, destination):
        del destination
        raise TravelEstimationError("Google Maps could not resolve destination 'Illini Union': REQUEST_DENIED.")


class _EstimateDeniedTravel(_FakeTravel):
    async def estimate(
        self,
        destination,
        departure_time=None,
        origin=None,
        origin_label=None,
        origin_source=None,
    ):
        del destination, departure_time, origin, origin_label, origin_source
        raise TravelEstimationError(
            "Google Maps could not estimate travel for destination 'Illini Union': REQUEST_DENIED."
        )


@pytest.mark.anyio
async def test_process_single_email_marks_processed_after_success(monkeypatch):
    send_kwargs = {}

    async def fake_parse_email(email_data):
        del email_data
        return {
            "has_event": True,
            "needs_response": False,
            "urgency": "low",
            "summary": "Weekly sync",
            "event": {
                "title": "Weekly Sync",
                "date": "2026-04-02",
                "start_time": "14:00",
                "end_time": "15:00",
                "is_online": True,
            },
            "action_items": [],
            "can_wait": True,
        }

    async def fake_send_summary(**kwargs):
        send_kwargs.update(kwargs)
        return None

    monkeypatch.setattr("pipeline.parse_email", fake_parse_email)
    monkeypatch.setattr("pipeline.send_summary", fake_send_summary)

    gmail = _FakeGmail()
    result = await process_single_email(
        {"id": "gmail-1", "thread_id": "thread-1", "subject": "hello"},
        gmail,
        _FakeCalendar(),
        _FakeTravel(),
    )

    assert gmail.processed_ids == ["gmail-1"]
    assert result["calendar_status"] == "created"
    assert send_kwargs["source_email_link"] == "https://mail.google.com/mail/u/0/#all/thread-1"


@pytest.mark.anyio
async def test_process_single_email_leaves_message_unprocessed_on_summary_failure(monkeypatch):
    async def fake_parse_email(email_data):
        del email_data
        return {
            "has_event": False,
            "needs_response": False,
            "urgency": "none",
            "summary": "FYI",
            "event": None,
            "action_items": [],
            "can_wait": True,
        }

    async def fake_send_summary(**kwargs):
        raise MessagingDeliveryError("boom")

    monkeypatch.setattr("pipeline.parse_email", fake_parse_email)
    monkeypatch.setattr("pipeline.send_summary", fake_send_summary)

    gmail = _FakeGmail()

    with pytest.raises(MessagingDeliveryError):
        await process_single_email(
            {"id": "gmail-2", "subject": "hello"},
            gmail,
            _FakeCalendar(),
            _FakeTravel(),
        )

    assert gmail.processed_ids == []


@pytest.mark.anyio
async def test_process_single_email_enriches_missing_title_and_end_time(monkeypatch):
    async def fake_parse_email(email_data):
        del email_data
        return {
            "has_event": True,
            "needs_response": False,
            "urgency": "low",
            "summary": "Aryan Gupta wants to meet for lunch today",
            "event": {
                "title": None,
                "date": "2026-04-01",
                "start_time": "15:00",
                "end_time": None,
                "location": "Illini Union",
                "is_online": False,
            },
            "action_items": ["Meet Aryan Gupta for lunch at Illini Union at 3:00 PM"],
            "can_wait": True,
        }

    async def fake_send_summary(**kwargs):
        del kwargs
        return None

    monkeypatch.setattr("pipeline.parse_email", fake_parse_email)
    monkeypatch.setattr("pipeline.send_summary", fake_send_summary)

    calendar = _FakeCalendar()
    gmail = _FakeGmail()

    result = await process_single_email(
        {
            "id": "gmail-3",
            "thread_id": "thread-3",
            "from": "Aryan Gupta <aryan05g@gmail.com>",
            "to": "User <me@example.com>",
            "account_email": "me@example.com",
            "subject": "",
            "body": "hey meet me for lunch at the illini union at 3:00 pm today",
        },
        gmail,
        calendar,
        _FakeTravel(),
    )

    assert result["calendar_status"] == "created"
    assert calendar.last_event["title"] == "Lunch with Aryan Gupta"
    assert calendar.last_event["end_time"] == "16:00"
    assert calendar.last_event["location"] == "Illini Union (1401 W Green St, Urbana, IL 61801)"


@pytest.mark.anyio
async def test_process_single_email_adds_other_party_names_to_generic_event_title(monkeypatch):
    async def fake_parse_email(email_data):
        del email_data
        return {
            "has_event": True,
            "needs_response": False,
            "urgency": "low",
            "summary": "Lunch meeting at Illini Union today",
            "event": {
                "title": "Lunch meeting",
                "date": "2026-04-01",
                "start_time": "15:00",
                "end_time": "16:00",
                "location": "Illini Union",
                "is_online": False,
            },
            "action_items": [],
            "can_wait": True,
        }

    async def fake_send_summary(**kwargs):
        del kwargs
        return None

    monkeypatch.setattr("pipeline.parse_email", fake_parse_email)
    monkeypatch.setattr("pipeline.send_summary", fake_send_summary)

    calendar = _FakeCalendar()
    gmail = _FakeGmail()

    result = await process_single_email(
        {
            "id": "gmail-3b",
            "thread_id": "thread-3b",
            "from": "Aryan Gupta <aryan05g@gmail.com>",
            "to": "User <me@example.com>",
            "account_email": "me@example.com",
            "subject": "",
            "body": "hey meet me for lunch at the illini union at 3:00 pm today",
        },
        gmail,
        calendar,
        _FakeTravel(),
    )

    assert result["calendar_status"] == "created"
    assert calendar.last_event["title"] == "Lunch meeting with Aryan Gupta"


@pytest.mark.anyio
async def test_process_single_email_still_creates_event_when_exact_address_lookup_fails(monkeypatch):
    async def fake_parse_email(email_data):
        del email_data
        return {
            "has_event": True,
            "needs_response": False,
            "urgency": "low",
            "summary": "Lunch today",
            "event": {
                "title": "Lunch with Aryan Gupta",
                "date": "2026-04-01",
                "start_time": "15:00",
                "end_time": "16:00",
                "location": "Illini Union",
                "is_online": False,
            },
            "action_items": [],
            "can_wait": True,
        }

    async def fake_send_summary(**kwargs):
        del kwargs
        return None

    monkeypatch.setattr("pipeline.parse_email", fake_parse_email)
    monkeypatch.setattr("pipeline.send_summary", fake_send_summary)

    calendar = _FakeCalendar()
    gmail = _FakeGmail()

    result = await process_single_email(
        {"id": "gmail-4", "thread_id": "thread-4", "body": "lunch"},
        gmail,
        calendar,
        _ResolveDeniedTravel(),
    )

    assert result["calendar_status"] == "created"
    assert calendar.last_event["location"] == "Illini Union"
    assert any("Exact address lookup unavailable" in note for note in result["processing_notes"])


@pytest.mark.anyio
async def test_process_single_email_still_creates_event_when_travel_estimate_fails(monkeypatch):
    async def fake_parse_email(email_data):
        del email_data
        return {
            "has_event": True,
            "needs_response": False,
            "urgency": "low",
            "summary": "Lunch today",
            "event": {
                "title": "Lunch with Aryan Gupta",
                "date": "2026-04-01",
                "start_time": "15:00",
                "end_time": "16:00",
                "location": "Illini Union",
                "is_online": False,
            },
            "action_items": [],
            "can_wait": True,
        }

    async def fake_send_summary(**kwargs):
        del kwargs
        return None

    monkeypatch.setattr("pipeline.parse_email", fake_parse_email)
    monkeypatch.setattr("pipeline.send_summary", fake_send_summary)

    calendar = _FakeCalendar()
    gmail = _FakeGmail()

    result = await process_single_email(
        {"id": "gmail-5", "thread_id": "thread-5", "body": "lunch"},
        gmail,
        calendar,
        _EstimateDeniedTravel(),
    )

    assert result["calendar_status"] == "created"
    assert any("Travel estimate unavailable" in note for note in result["processing_notes"])


@pytest.mark.anyio
async def test_process_single_email_requests_phone_location_and_uses_reply(monkeypatch):
    requested_messages: list[str] = []

    async def fake_parse_email(email_data):
        del email_data
        return {
            "has_event": True,
            "needs_response": False,
            "urgency": "low",
            "summary": "Lunch today",
            "event": {
                "title": "Lunch with Aryan Gupta",
                "date": "2026-04-01",
                "start_time": "15:00",
                "end_time": "16:00",
                "location": "Illini Union",
                "is_online": False,
            },
            "action_items": [],
            "can_wait": True,
        }

    async def fake_send_summary(**kwargs):
        del kwargs
        return None

    async def fake_send_phone_location_request(message):
        requested_messages.append(message)
        return None

    async def fake_wait_for_location_response(request_id, timeout_seconds):
        del request_id, timeout_seconds
        return {
            "lat": 40.1106,
            "lng": -88.2272,
            "address": "Illini Union",
        }

    monkeypatch.setattr("pipeline.parse_email", fake_parse_email)
    monkeypatch.setattr("pipeline.send_summary", fake_send_summary)
    monkeypatch.setattr("pipeline.send_phone_location_request", fake_send_phone_location_request)
    monkeypatch.setattr("pipeline.wait_for_location_response", fake_wait_for_location_response)
    monkeypatch.setattr(
        "pipeline.create_location_request",
        lambda event, source_email_id=None: {
            "request_id": "req-1",
            "token": "token-1",
            "event_title": event["title"],
            "event_location": event["location"],
            "event_start_time": event["start_time"],
            "callback_url": "http://192.168.1.10:8000/api/location/respond",
        },
    )
    monkeypatch.setattr(
        "pipeline.format_location_request_message",
        lambda request: f"SUNDAY_LOCATION_REQUEST {request['request_id']}",
    )
    monkeypatch.setattr("pipeline.Config.request_phone_location", True)
    monkeypatch.setattr("pipeline.Config.location_request_base_url", "http://192.168.1.10:8000")

    calendar = _FakeCalendar()
    gmail = _FakeGmail()
    travel = _FakeTravel()

    result = await process_single_email(
        {"id": "gmail-6", "thread_id": "thread-6", "body": "lunch"},
        gmail,
        calendar,
        travel,
    )

    assert result["calendar_status"] == "created"
    assert requested_messages == ["SUNDAY_LOCATION_REQUEST req-1"]
    assert travel.last_estimate_args["origin"] == "40.1106,-88.2272"
