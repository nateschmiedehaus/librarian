from datetime import datetime, timezone

from config import ALLOWED_ROLES, TOKEN_TTL_MINUTES
from models import TokenRecord, User
from store import get_store
from utils import add_minutes, now_iso


class AuthError(Exception):
    pass


class AuthorizationError(Exception):
    pass


def create_token(user_id: str, now: datetime | None = None) -> TokenRecord:
    stamp = now_iso(now)
    token = f"tok_{user_id}_{stamp.replace(':', '')}"
    expires_at = add_minutes(stamp, TOKEN_TTL_MINUTES)
    record = TokenRecord(token=token, user_id=user_id, expires_at=expires_at)
    store = get_store()
    store.tokens[token] = record
    return record


def authenticate(token: str, now: datetime | None = None) -> User:
    store = get_store()
    record = store.tokens.get(token)
    if record is None:
        raise AuthError("token not found")
    current = now or datetime.now(timezone.utc)
    if current > datetime.fromisoformat(record.expires_at):
        raise AuthError("token expired")
    user = store.users.get(record.user_id)
    if user is None or not user.active:
        raise AuthError("inactive user")
    return user


def require_role(user: User, allowed: list[str]) -> None:
    if user.role not in ALLOWED_ROLES:
        raise AuthorizationError("unknown role")
    if user.role not in allowed:
        raise AuthorizationError("role not permitted")
