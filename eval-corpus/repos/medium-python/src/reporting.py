from datetime import datetime
from typing import Iterable, List

from config import SLA_HOURS
from models import Ticket
from notifications import send_sla_warning
from utils import hours_since


def build_sla_report(
    tickets: Iterable[Ticket],
    now: datetime | None = None,
) -> List[dict]:
    report: List[dict] = []
    for ticket in tickets:
        if ticket.status != "open":
            continue
        age_hours = hours_since(ticket.created_at, now)
        if age_hours >= SLA_HOURS:
            report.append(
                {
                    "ticket_id": ticket.id,
                    "hours_open": round(age_hours, 2),
                    "severity": ticket.severity,
                }
            )
    return report


def build_sla_notifications(
    tickets: Iterable[Ticket],
    now: datetime | None = None,
) -> List[dict]:
    notices: List[dict] = []
    for ticket in tickets:
        if ticket.status != "open":
            continue
        age_hours = hours_since(ticket.created_at, now)
        if age_hours >= SLA_HOURS:
            notices.append(send_sla_warning(ticket, age_hours))
    return notices
