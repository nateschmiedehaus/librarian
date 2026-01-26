from typing import Tuple

from config import MAX_OPEN_TICKETS
from models import User


def can_open_ticket(user: User, open_tickets: int) -> Tuple[bool, str]:
    if not user.active:
        return False, "inactive user"
    if user.role == "guest":
        return False, "guest role cannot open tickets"
    if open_tickets >= MAX_OPEN_TICKETS:
        return False, "too many open tickets"
    return True, "allowed"
