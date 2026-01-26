from datetime import datetime, timedelta, timezone


def now_iso(now: datetime | None = None) -> str:
    stamp = now or datetime.now(timezone.utc)
    return stamp.isoformat()


def add_minutes(iso_stamp: str, minutes: int) -> str:
    base = datetime.fromisoformat(iso_stamp)
    return (base + timedelta(minutes=minutes)).isoformat()


def hours_since(iso_stamp: str, now: datetime | None = None) -> float:
    base = datetime.fromisoformat(iso_stamp)
    current = now or datetime.now(timezone.utc)
    return (current - base).total_seconds() / 3600.0
