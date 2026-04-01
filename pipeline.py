"""
pipeline.py — Core pipeline logic shared by main.py and server.py.

Encapsulates one full pass: fetch emails → LLM parse → calendar → notify.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from calendar_manager import CalendarManager
from config import Config
from email_parser import enrich_event_details, get_calendar_readiness_issues, parse_email, summarise_parsed
from errors import ConfigurationError, TravelEstimationError
from gmail_watcher import GmailWatcher
from location_requests import create_location_request, wait_for_location_response
from messenger import send_summary
from travel_estimator import TravelEstimator

log = logging.getLogger(__name__)

_gmail: GmailWatcher | None = None
_calendar: CalendarManager | None = None
_travel: TravelEstimator | None = None
_CALENDAR_ORIGIN_LOOKBACK = timedelta(hours=6)
_WEEKDAY_INDEX = {
    "mon": 0,
    "tue": 1,
    "wed": 2,
    "thu": 3,
    "fri": 4,
    "sat": 5,
    "sun": 6,
}


def _build_gmail_thread_link(email_data: dict) -> str | None:
    """Return a Gmail web link for the source email thread when possible."""
    thread_id = (email_data.get("thread_id") or "").strip()
    if thread_id:
        return f"https://mail.google.com/mail/u/0/#all/{thread_id}"

    message_id = (email_data.get("id") or "").strip()
    if message_id:
        return f"https://mail.google.com/mail/u/0/#all/{message_id}"

    return None


def _is_location_request_enabled() -> bool:
    """Return true when the on-demand iPhone location request flow is configured."""
    if not Config.request_phone_location or not Config.location_request_base_url:
        return False

    parsed = urlparse(Config.location_request_base_url)
    return bool(parsed.scheme and parsed.netloc)


def _event_start_dt(event: dict) -> datetime | None:
    """Return the target event's start as a timezone-aware datetime."""
    try:
        start_dt = datetime.fromisoformat(f"{event['date']}T{event['start_time']}:00")
    except (KeyError, TypeError, ValueError):
        return None

    return start_dt.replace(tzinfo=ZoneInfo(Config.timezone))


def _google_event_dt(event_item: dict, edge: str) -> datetime | None:
    """Parse a Google Calendar start/end dateTime into local timezone."""
    raw = ((event_item.get(edge) or {}).get("dateTime") or "").strip()
    if not raw:
        return None

    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None

    tz = ZoneInfo(Config.timezone)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=tz)
    return parsed.astimezone(tz)


def _origin_from_address(
    address: str | None,
    lat: float | None,
    lng: float | None,
    source: str,
) -> tuple[str | None, str | None, str | None]:
    """Build a Maps origin tuple from an address and optional coordinates."""
    clean_address = (address or "").strip()
    if lat is not None and lng is not None and clean_address:
        return f"{lat},{lng}", clean_address, source
    if clean_address:
        return clean_address, clean_address, source
    return None, None, None


def _is_within_work_window(start_dt: datetime) -> bool:
    """Return true when an event start falls within the configured work schedule."""
    if not Config.default_work_location:
        return False

    configured_days = {
        _WEEKDAY_INDEX[day.lower()]
        for day in Config.work_days
        if day.lower() in _WEEKDAY_INDEX
    }
    if start_dt.weekday() not in configured_days:
        return False

    try:
        work_start = datetime.strptime(Config.workday_start_time, "%H:%M").time()
        work_end = datetime.strptime(Config.workday_end_time, "%H:%M").time()
    except ValueError:
        return False

    event_time = start_dt.timetz().replace(tzinfo=None)
    if work_start <= work_end:
        return work_start <= event_time < work_end
    return event_time >= work_start or event_time < work_end


def _default_origin_for_event(start_dt: datetime | None) -> tuple[str | None, str | None, str | None]:
    """Choose between configured work/home defaults for a target event."""
    if start_dt and _is_within_work_window(start_dt):
        work_origin = _origin_from_address(
            Config.default_work_location,
            Config.default_work_lat,
            Config.default_work_lng,
            "work",
        )
        if work_origin[0]:
            return work_origin

    home_origin = _origin_from_address(
        Config.default_home_location,
        Config.default_home_lat,
        Config.default_home_lng,
        "home",
    )
    if home_origin[0]:
        return home_origin

    return _origin_from_address(
        Config.default_work_location,
        Config.default_work_lat,
        Config.default_work_lng,
        "work",
    )


def _scheduled_origin_for_event(
    calendar: CalendarManager,
    start_dt: datetime | None,
) -> tuple[str | None, str | None, str | None]:
    """Infer origin from the latest scheduled calendar event before the target event."""
    if start_dt is None:
        return None, None, None

    events = calendar.list_events_for_day(start_dt.date().isoformat())
    best_origin: tuple[str | None, str | None, str | None] = (None, None, None)
    best_end: datetime | None = None

    for item in events:
        location = (item.get("location") or "").strip()
        if not location:
            continue

        candidate_end = _google_event_dt(item, "end")
        if candidate_end is None:
            continue

        gap = start_dt - candidate_end
        if gap.total_seconds() < 0 or gap > _CALENDAR_ORIGIN_LOOKBACK:
            continue

        if best_end is None or candidate_end > best_end:
            best_end = candidate_end
            best_origin = (location, location, "calendar_context")

    return best_origin


def _should_request_phone_location(start_dt: datetime | None) -> bool:
    """Return true when current phone location is relevant to this event."""
    if start_dt is None or not _is_location_request_enabled():
        return False

    now = datetime.now(ZoneInfo(Config.timezone))
    delta = start_dt - now
    return 0 <= delta.total_seconds() <= Config.current_location_lookahead_hours * 3600


async def _request_phone_origin_for_event(
    event: dict,
    email_data: dict,
    processing_notes: list[str],
) -> tuple[str | None, str | None]:
    """
    Request the phone's current location for one event and wait briefly for a reply.

    Returns:
        (origin_for_maps, human_readable_origin_address)
    """
    if not _is_location_request_enabled():
        return None, None

    try:
        request = create_location_request(event, source_email_id=email_data.get("id"))
        log.info("  → Waiting for phone location callback for %s", request["request_id"])
    except (ConfigurationError, ValueError, RuntimeError) as exc:
        log.warning("  → Phone location request unavailable: %s", exc)
        processing_notes.append(f"Phone location request unavailable: {exc}")
        return None, None
    except Exception as exc:
        log.warning("  → Phone location request setup failed: %s", exc)
        processing_notes.append(f"Phone location request setup failed: {exc}")
        return None, None

    response = await wait_for_location_response(
        request["request_id"],
        Config.location_request_timeout_seconds,
    )
    if response is None:
        processing_notes.append("Phone location request timed out; used fallback origin instead.")
        return None, None

    return f"{response['lat']},{response['lng']}", response.get("address")


async def _choose_travel_origin(
    event: dict,
    email_data: dict,
    calendar: CalendarManager,
    processing_notes: list[str],
) -> tuple[str | None, str | None, str | None]:
    """
    Infer the most likely travel origin for an event.

    Priority:
      1. The latest scheduled calendar event with a location before this event
      2. The phone's current location when the event is imminent
      3. Configured work location during work hours
      4. Configured home location
    """
    start_dt = _event_start_dt(event)

    try:
        scheduled_origin = _scheduled_origin_for_event(calendar, start_dt)
    except Exception as exc:
        log.warning("  → Calendar-context origin unavailable: %s", exc)
        processing_notes.append(f"Calendar-context origin unavailable: {exc}")
    else:
        if scheduled_origin[0]:
            return scheduled_origin

    if _should_request_phone_location(start_dt):
        requested_origin, requested_origin_address = await _request_phone_origin_for_event(
            event,
            email_data,
            processing_notes,
        )
        if requested_origin:
            return requested_origin, requested_origin_address, "phone_request"

    return _default_origin_for_event(start_dt)


def _get_singletons() -> tuple[GmailWatcher, CalendarManager, TravelEstimator]:
    global _gmail, _calendar, _travel
    if _gmail is None:
        _gmail = GmailWatcher()
    if _calendar is None:
        _calendar = CalendarManager()
    if _travel is None:
        _travel = TravelEstimator()
    return _gmail, _calendar, _travel


async def process_single_email(
    email_data: dict,
    gmail: GmailWatcher,
    calendar: CalendarManager,
    travel: TravelEstimator,
) -> dict:
    """
    Run the full pipeline on one email and return a result summary dict.

    Processing only counts as complete once the summary is delivered and
    the Gmail message is marked as processed.
    """
    log.info("Processing: %s", email_data.get("subject", "—"))

    parsed = await parse_email(email_data)
    parsed = enrich_event_details(parsed, email_data)
    log.info("  %s", summarise_parsed(parsed))

    calendar_status = "not_applicable"
    calendar_event_link: str | None = None
    processing_notes: list[str] = []
    travel_info: dict | None = None

    if parsed.get("has_event") and parsed.get("event"):
        readiness_issues = get_calendar_readiness_issues(parsed)
        if readiness_issues:
            calendar_status = "skipped_incomplete"
            processing_notes.append(
                "Calendar event was skipped: " + "; ".join(readiness_issues)
            )
        else:
            event = parsed["event"]
            if not event.get("is_online") and event.get("location"):
                routing_destination = event["location"]
                origin_for_maps, origin_label, origin_source = await _choose_travel_origin(
                    event,
                    email_data,
                    calendar,
                    processing_notes,
                )

                try:
                    resolved_location = await travel.resolve_destination(event["location"])
                except (ConfigurationError, TravelEstimationError) as exc:
                    log.warning("  → Exact address lookup unavailable: %s", exc)
                    processing_notes.append(f"Exact address lookup unavailable: {exc}")
                else:
                    event["location"] = resolved_location["display_location"]
                    routing_destination = resolved_location["routing_destination"]

                departure = f"{event['date']}T{event['start_time']}:00"
                try:
                    travel_info = await travel.estimate(
                        destination=routing_destination,
                        departure_time=departure,
                        origin=origin_for_maps,
                        origin_label=origin_label,
                        origin_source=origin_source,
                    )
                except (ConfigurationError, TravelEstimationError) as exc:
                    log.warning("  → Travel estimation unavailable: %s", exc)
                    processing_notes.append(f"Travel estimate unavailable: {exc}")
                else:
                    log.info("  → Travel: %d min", travel_info["travel_minutes"])
                    log.info(
                        "  → Travel origin: %s (%s)",
                        travel_info.get("origin", origin_label or origin_for_maps or "unknown"),
                        travel_info.get("origin_source", origin_source or "unknown"),
                    )

            calendar_result = calendar.create_smart_event(
                event,
                travel_info,
                source_email_id=email_data.get("id"),
            )
            calendar_status = calendar_result["status"]
            calendar_event_link = calendar_result["event"].get("htmlLink")
            log.info("  → Calendar status: %s", calendar_status)

    await send_summary(
        parsed_email=parsed,
        calendar_status=calendar_status,
        travel_info=travel_info,
        processing_notes=processing_notes,
        source_email_link=_build_gmail_thread_link(email_data),
    )
    log.info("  → Summary sent")

    gmail.mark_as_processed(email_data["id"])
    log.info("  → Gmail message marked as processed")

    return {
        "email_id": email_data.get("id"),
        "subject": email_data.get("subject"),
        "has_event": parsed.get("has_event"),
        "calendar_status": calendar_status,
        "calendar_event_link": calendar_event_link,
        "urgency": parsed.get("urgency"),
        "summary": parsed.get("summary"),
        "processing_notes": processing_notes,
    }


async def run_pipeline(max_emails: int | None = None) -> list[dict]:
    """
    Fetch new emails and run the full pipeline on each one.
    """
    gmail, calendar, travel = _get_singletons()
    email_limit = max_emails if max_emails is not None else Config.max_emails_per_cycle

    new_emails = gmail.get_new_emails(max_results=email_limit)
    if not new_emails:
        log.debug("No new emails this cycle")
        return []

    log.info("📬 %d new email(s)", len(new_emails))
    results: list[dict] = []

    for email_data in new_emails:
        try:
            results.append(await process_single_email(email_data, gmail, calendar, travel))
        except Exception as exc:
            log.error(
                "Unhandled error processing email %s: %s",
                email_data.get("id"),
                exc,
            )
            results.append(
                {
                    "email_id": email_data.get("id"),
                    "subject": email_data.get("subject"),
                    "error": str(exc),
                }
            )

    return results
