from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class User:
    id: str
    email: str
    role: str
    active: bool = True


@dataclass
class Ticket:
    id: str
    title: str
    description: str
    severity: str
    status: str
    requester_id: str
    created_at: str
    assigned_to: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class TokenRecord:
    token: str
    user_id: str
    expires_at: str


@dataclass
class AuditEvent:
    id: str
    action: str
    actor_id: str
    created_at: str
    meta: Dict[str, str] = field(default_factory=dict)
