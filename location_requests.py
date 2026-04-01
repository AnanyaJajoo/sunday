"""
location_requests.py — One-time phone location request flow.

Creates short-lived backend location requests, lets an iPhone Shortcut poll
for the next pending request, and stores the returned GPS fix as the latest
live location.
"""
from __future__ import annotations

import asyncio
import json
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

from config import Config
from errors import ConfigurationError
from location_state import update_location
from state_store import get_state_dir, get_state_file

_REQUESTS_FILE = get_state_file("location_requests.json")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso8601(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _load_requests() -> list[dict]:
    if not _REQUESTS_FILE.exists():
        return []

    try:
        data = json.loads(_REQUESTS_FILE.read_text())
    except (OSError, ValueError):
        return []

    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


def _save_requests(requests: list[dict]) -> None:
    get_state_dir(create=True)
    _REQUESTS_FILE.write_text(json.dumps(requests, indent=2))


def _prune_requests(requests: list[dict]) -> list[dict]:
    cutoff = _utc_now() - timedelta(days=1)
    kept: list[dict] = []
    for request in requests:
        created_at = _parse_iso8601(request.get("created_at"))
        if created_at and created_at >= cutoff:
            kept.append(request)
    return kept


def _callback_url() -> str:
    if not Config.location_request_base_url:
        raise ConfigurationError(
            "LOCATION_REQUEST_BASE_URL must be configured when REQUEST_PHONE_LOCATION=true."
        )
    return f"{Config.location_request_base_url}/api/location/respond"


def create_location_request(event: dict, source_email_id: str | None = None) -> dict:
    """Create and persist a one-time request for the phone's current location."""
    now = _utc_now()
    request = {
        "request_id": str(uuid.uuid4()),
        "token": secrets.token_urlsafe(18),
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=Config.location_request_timeout_seconds + 60)).isoformat(),
        "status": "pending",
        "source_email_id": source_email_id,
        "event_title": event.get("title", ""),
        "event_date": event.get("date", ""),
        "event_start_time": event.get("start_time", ""),
        "event_location": event.get("location", ""),
        "callback_url": _callback_url(),
    }

    requests = _prune_requests(_load_requests())
    requests.append(request)
    _save_requests(requests)
    return request


def get_pending_location_request() -> dict | None:
    """Return the oldest still-pending location request, if one exists."""
    requests = _prune_requests(_load_requests())
    now = _utc_now()
    updated = False

    for request in requests:
        expires_at = _parse_iso8601(request.get("expires_at"))
        if expires_at and expires_at < now and request.get("status") == "pending":
            request["status"] = "expired"
            updated = True
            continue

        if request.get("status") != "pending":
            continue

        if updated:
            _save_requests(requests)

        return {
            "request_id": request["request_id"],
            "token": request["token"],
            "event_title": request.get("event_title", ""),
            "event_date": request.get("event_date", ""),
            "event_start_time": request.get("event_start_time", ""),
            "event_location": request.get("event_location", ""),
            "callback_url": request.get("callback_url", ""),
            "created_at": request.get("created_at", ""),
            "expires_at": request.get("expires_at", ""),
        }

    if updated:
        _save_requests(requests)
    return None


def record_location_response(
    request_id: str,
    token: str,
    lat: float,
    lng: float,
    address: str | None = None,
) -> dict:
    """Record a phone location response for a pending request."""
    requests = _prune_requests(_load_requests())

    for request in requests:
        if request.get("request_id") != request_id:
            continue
        if request.get("token") != token:
            raise PermissionError("Invalid location request token.")

        location = update_location(lat, lng, address)
        request["status"] = "fulfilled"
        request["responded_at"] = _utc_now().isoformat()
        request["location"] = location
        _save_requests(requests)
        return {"request": request, "location": location}

    raise LookupError("Location request not found.")


def get_location_response(request_id: str) -> dict | None:
    """Return a fulfilled location response, if present."""
    for request in _load_requests():
        if request.get("request_id") == request_id and request.get("status") == "fulfilled":
            location = request.get("location")
            if isinstance(location, dict):
                return location
    return None


async def wait_for_location_response(
    request_id: str,
    timeout_seconds: int,
    poll_interval_seconds: float = 1.0,
) -> dict | None:
    """Wait briefly for the phone to fulfill a one-time location request."""
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        response = get_location_response(request_id)
        if response is not None:
            return response
        await asyncio.sleep(min(poll_interval_seconds, max(0.1, deadline - time.monotonic())))
    return None
