from models import Ticket


def send_assignment_notice(ticket: Ticket, agent_id: str) -> dict:
    return {
        "kind": "assignment",
        "ticket_id": ticket.id,
        "agent_id": agent_id,
        "severity": ticket.severity,
    }


def send_sla_warning(ticket: Ticket, hours_open: float) -> dict:
    return {
        "kind": "sla_warning",
        "ticket_id": ticket.id,
        "hours_open": round(hours_open, 2),
        "severity": ticket.severity,
    }
