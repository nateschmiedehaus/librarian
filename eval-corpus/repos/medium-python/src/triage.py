from typing import Iterable, Tuple

from config import SEVERITY_WEIGHTS
from models import Ticket


KEYWORDS = {
    "critical": ["outage", "data loss", "breach"],
    "high": ["failure", "crash", "error"],
    "medium": ["latency", "slow", "timeout"],
}


def classify_severity(title: str, description: str) -> str:
    haystack = f"{title} {description}".lower()
    for severity, words in KEYWORDS.items():
        if any(word in haystack for word in words):
            return severity
    return "low"


def compute_priority(severity: str, age_hours: float) -> float:
    weight = SEVERITY_WEIGHTS.get(severity, 1)
    return weight + (age_hours / 24.0)


def assign_ticket(ticket: Ticket, agents: Iterable[Tuple[str, int]]) -> str:
    best = min(agents, key=lambda item: item[1])
    ticket.assigned_to = best[0]
    return best[0]
