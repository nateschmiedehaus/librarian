from typing import Iterable, Tuple

from models import Ticket
from notifications import send_assignment_notice
from policy import can_open_ticket
from rate_limit import check_rate_limit
from store import InMemoryStore, get_store
from triage import assign_ticket, classify_severity
from utils import now_iso


class TicketError(Exception):
    pass


def open_ticket(
    requester_id: str,
    title: str,
    description: str,
    tags: list[str],
    store: InMemoryStore | None = None,
) -> Ticket:
    data = store or get_store()
    check_rate_limit(requester_id, data)
    user = data.users.get(requester_id)
    if user is None:
        raise TicketError("requester not found")
    open_tickets = data.get_open_tickets_for_user(requester_id)
    allowed, reason = can_open_ticket(user, len(open_tickets))
    if not allowed:
        raise TicketError(reason)
    severity = classify_severity(title, description)
    ticket = Ticket(
        id=data.next_id("ticket"),
        title=title,
        description=description,
        severity=severity,
        status="open",
        requester_id=requester_id,
        created_at=now_iso(),
        tags=tags,
    )
    data.tickets[ticket.id] = ticket
    data.add_audit(
        action="ticket.open",
        actor_id=requester_id,
        meta={"ticket_id": ticket.id, "severity": severity},
    )
    return ticket


def assign_ticket_flow(
    ticket_id: str,
    agents: Iterable[Tuple[str, int]],
    store: InMemoryStore | None = None,
) -> dict:
    data = store or get_store()
    ticket = data.tickets.get(ticket_id)
    if ticket is None:
        raise TicketError("ticket not found")
    agent_id = assign_ticket(ticket, agents)
    data.add_audit(
        action="ticket.assign",
        actor_id=agent_id,
        meta={"ticket_id": ticket.id},
    )
    return send_assignment_notice(ticket, agent_id)


def close_ticket(
    ticket_id: str,
    actor_id: str,
    store: InMemoryStore | None = None,
) -> Ticket:
    data = store or get_store()
    ticket = data.tickets.get(ticket_id)
    if ticket is None:
        raise TicketError("ticket not found")
    ticket.status = "closed"
    data.add_audit(
        action="ticket.close",
        actor_id=actor_id,
        meta={"ticket_id": ticket.id},
    )
    return ticket
