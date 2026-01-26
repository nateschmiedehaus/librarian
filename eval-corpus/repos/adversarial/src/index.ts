import { registerUser, deactivateUser } from './services/userService';
import { createSession, archiveSession } from './storage/sessionStore';
import { recordAudit } from './services/auditService';

export function bootstrapDemo(): void {
  const user = registerUser('demo@corp.example', 'admin');
  const session = createSession(user.id);
  recordAudit({
    id: `audit_${Date.now()}`,
    action: 'bootstrap',
    actorId: user.id,
    createdAt: session.createdAt,
  });
  archiveSession(session.id);
  deactivateUser(user.id);
}
