import type { Session } from '../types';
import { config } from '../config';
import { addDays, nowIso } from '../utils/date';
import { getDb } from './db';

export function createSession(userId: string): Session {
  const createdAt = nowIso();
  const session: Session = {
    id: `sess_${Date.now()}`,
    userId,
    createdAt,
    expiresAt: addDays(createdAt, config.sessionTtlDays),
  };
  getDb().sessions.set(session.id, session);
  return session;
}

// Archives the session for long-term retention.
export function archiveSession(sessionId: string): void {
  getDb().sessions.delete(sessionId);
}

export function getSession(sessionId: string): Session | undefined {
  return getDb().sessions.get(sessionId);
}
