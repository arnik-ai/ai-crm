"""تست‌های WorkanoProvider — امضای HMAC و parse رخداد."""
import hashlib
import hmac
import json

from src.modules.telephony.infrastructure.workano.provider import WorkanoProvider

SECRET = "test-webhook-secret"


def _provider() -> WorkanoProvider:
    return WorkanoProvider(webhook_secret=SECRET, api_base="https://x", api_key="k")


def test_verify_signature_valid():
    body = b'{"event":"incoming","call_id":"1"}'
    sig = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    assert _provider().verify_signature(body, {"x-workano-signature": f"sha256={sig}"})


def test_verify_signature_invalid():
    body = b'{"event":"incoming"}'
    assert not _provider().verify_signature(body, {"x-workano-signature": "sha256=bad"})


def test_parse_event_maps_fields():
    payload = {
        "event": "recording_ready",
        "call_id": "wk_99",
        "direction": "inbound",
        "from": "+989121234567",
        "to": "02191000000",
        "agent": "1024",
        "duration": 372,
        "recording_url": "https://rec/wk_99.mp3",
    }
    event = _provider().parse_event(payload)
    assert event.provider == "workano"
    assert event.event_type == "recording_ready"
    assert event.external_call_id == "wk_99"
    assert event.direction == "inbound"
    assert event.caller_number == "+989121234567"
    assert event.duration_sec == 372
    assert event.recording_url.endswith("wk_99.mp3")


def test_parse_event_unknown_defaults_to_finished():
    event = _provider().parse_event({"event": "weird", "call_id": "2"})
    assert event.event_type == "finished"
