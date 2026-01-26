from datetime import datetime, timezone

from config import RATE_LIMIT_PER_MINUTE
from store import InMemoryStore


class RateLimitError(Exception):
    pass


def check_rate_limit(user_id: str, store: InMemoryStore, now: datetime | None = None) -> None:
    current = now or datetime.now(timezone.utc)
    state = store.rate_limits.get(user_id)
    if state is None:
        store.rate_limits[user_id] = {
            "window_start": int(current.timestamp()),
            "count": 1,
        }
        return
    window_start = datetime.fromtimestamp(state["window_start"], timezone.utc)
    elapsed = (current - window_start).total_seconds()
    if elapsed >= 60:
        state["window_start"] = int(current.timestamp())
        state["count"] = 1
        return
    state["count"] += 1
    if state["count"] > RATE_LIMIT_PER_MINUTE:
        raise RateLimitError("rate limit exceeded")
