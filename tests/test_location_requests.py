from __future__ import annotations

from pathlib import Path

from location_requests import create_location_request, get_pending_location_request, record_location_response


def test_get_pending_location_request_returns_oldest_pending(monkeypatch, tmp_path: Path):
    monkeypatch.setattr("location_requests._REQUESTS_FILE", tmp_path / "location_requests.json")
    monkeypatch.setattr("location_requests.Config.location_request_base_url", "http://sunday-tailnet:8000")
    monkeypatch.setattr("location_requests.Config.location_request_timeout_seconds", 20)

    create_location_request(
        {
            "title": "Lunch with Aryan Gupta",
            "date": "2026-04-01",
            "start_time": "15:00",
            "location": "Illini Union",
        },
        source_email_id="gmail-1",
    )
    create_location_request(
        {
            "title": "Coffee with Jane",
            "date": "2026-04-01",
            "start_time": "16:00",
            "location": "Cafe Paradiso",
        },
        source_email_id="gmail-2",
    )

    pending = get_pending_location_request()

    assert pending is not None
    assert pending["event_title"] == "Lunch with Aryan Gupta"
    assert pending["event_location"] == "Illini Union"
    assert pending["callback_url"] == "http://sunday-tailnet:8000/api/location/respond"


def test_get_pending_location_request_skips_fulfilled_entries(monkeypatch, tmp_path: Path):
    monkeypatch.setattr("location_requests._REQUESTS_FILE", tmp_path / "location_requests.json")
    monkeypatch.setattr("location_requests.Config.location_request_base_url", "http://sunday-tailnet:8000")
    monkeypatch.setattr("location_requests.Config.location_request_timeout_seconds", 20)

    first = create_location_request(
        {
            "title": "Lunch with Aryan Gupta",
            "date": "2026-04-01",
            "start_time": "15:00",
            "location": "Illini Union",
        }
    )
    create_location_request(
        {
            "title": "Coffee with Jane",
            "date": "2026-04-01",
            "start_time": "16:00",
            "location": "Cafe Paradiso",
        }
    )

    record_location_response(
        request_id=first["request_id"],
        token=first["token"],
        lat=40.1106,
        lng=-88.2272,
        address="Illini Union",
    )

    pending = get_pending_location_request()

    assert pending is not None
    assert pending["event_title"] == "Coffee with Jane"
