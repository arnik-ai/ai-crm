"""تست‌های SimotelProvider — احراز هویت توکن و parse رویدادها."""
import json

from src.modules.telephony.infrastructure.simotel.provider import SimotelProvider

TOKEN = "secret-token"


def _provider() -> SimotelProvider:
    return SimotelProvider(
        webhook_token=TOKEN,
        api_base="https://pbx.test/api",
        api_token="api-tok",
    )


# ---------- احراز هویت ----------
def test_token_in_body_valid():
    body = json.dumps({"event_name": "IncomingCall", "token": TOKEN}).encode()
    assert _provider().verify_signature(body, {})


def test_token_in_body_invalid():
    body = json.dumps({"event_name": "IncomingCall", "token": "wrong"}).encode()
    assert not _provider().verify_signature(body, {})


def test_token_in_header_valid():
    assert _provider().verify_signature(b"{}", {"x-simotel-token": TOKEN})


def test_no_token_configured_allows_dev():
    p = SimotelProvider(webhook_token="", api_base="https://x", api_token="")
    assert p.verify_signature(b"{}", {})


# ---------- parse رویدادها ----------
def test_parse_incoming_call():
    payload = {"event_name": "IncomingCall", "number": "+989121234567",
               "unique_id": "1610782193.391", "entry_point": "2000"}
    event = _provider().parse_event(payload)
    assert event.provider == "simotel"
    assert event.event_type == "incoming"
    assert event.direction == "inbound"
    assert event.caller_number == "+989121234567"
    assert event.external_call_id == "1610782193.391"


def test_parse_outgoing_call():
    payload = {"event_name": "OutgoingCall", "number": "02191000000",
               "unique_id": "abc.1", "exit_point": "1024"}
    event = _provider().parse_event(payload)
    assert event.event_type == "outgoing"
    assert event.direction == "outbound"
    assert event.callee_number == "02191000000"


def test_parse_cdr_answered_with_record_triggers_recording_ready():
    payload = {
        "event_name": "CDRQueue", "unique_id": "1610782193.391",
        "src": "992", "dst": "993", "billsec": "31",
        "disposition": "ANSWERED", "record": "20210116_1610782193.391.mp3",
        "starttime": "1610782193", "endtime": "1610782224",
    }
    event = _provider().parse_event(payload)
    assert event.event_type == "recording_ready"
    assert event.duration_sec == 31
    assert event.recording_url.endswith("20210116_1610782193.391.mp3")
    assert event.started_at is not None


def test_parse_cdr_not_answered_is_missed():
    payload = {"event_name": "CDRQueue", "unique_id": "x.1", "src": "1",
               "dst": "2", "disposition": "NO ANSWER", "record": ""}
    event = _provider().parse_event(payload)
    assert event.event_type == "missed"


def test_parse_cdr_answered_no_record_is_finished():
    payload = {"event_name": "CDRQueue", "unique_id": "x.2", "src": "1",
               "dst": "2", "disposition": "ANSWERED", "record": "", "billsec": "10"}
    event = _provider().parse_event(payload)
    assert event.event_type == "finished"


def test_parse_unknown_event_defaults_finished():
    event = _provider().parse_event({"event_name": "Weird", "unique_id": "z"})
    assert event.event_type == "finished"
