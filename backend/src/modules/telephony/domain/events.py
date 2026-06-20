"""مدل دامنه‌ی رخداد تلفنی — خنثی نسبت به Provider."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

EventType = Literal["incoming", "outgoing", "missed", "finished", "recording_ready"]
Direction = Literal["inbound", "outbound"]


class TelephonyEvent(BaseModel):
    """رخداد نرمال‌شده که از هر Provider به دامنه تحویل می‌شود."""

    provider: str
    event_type: EventType
    external_call_id: str
    direction: Direction
    caller_number: str
    callee_number: str
    agent_extension: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: Optional[int] = None
    recording_url: Optional[str] = None
    raw: dict = {}
