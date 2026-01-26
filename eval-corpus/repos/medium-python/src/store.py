from typing import Dict, List

from models import AuditEvent, Ticket, TokenRecord, User
from utils import now_iso


class InMemoryStore:
    def __init__(self) -> None:
        self.users: Dict[str, User] = {}
        self.tickets: Dict[str, Ticket] = {}
        self.tokens: Dict[str, TokenRecord] = {}
        self.audits: List[AuditEvent] = []
        self.rate_limits: Dict[str, Dict[str, int]] = {}
        self._id_counter = 0

    def next_id(self, prefix: str) -> str:
        self._id_counter += 1
        return f"{prefix}-{self._id_counter:04d}"

    def add_audit(self, action: str, actor_id: str, meta: Dict[str, str]) -> AuditEvent:
        audit = AuditEvent(
            id=self.next_id("audit"),
            action=action,
            actor_id=actor_id,
            created_at=now_iso(),
            meta=meta,
        )
        self.audits.append(audit)
        return audit

    def get_open_tickets_for_user(self, user_id: str) -> List[Ticket]:
        return [
            ticket
            for ticket in self.tickets.values()
            if ticket.requester_id == user_id and ticket.status == "open"
        ]


_STORE: InMemoryStore | None = None


def get_store() -> InMemoryStore:
    global _STORE
    if _STORE is None:
        _STORE = InMemoryStore()
    return _STORE
