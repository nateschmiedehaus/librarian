import { getDb } from '../storage/db';

const ENABLE_LEGACY_CLEANUP = false;

// Removes sessions that are no longer valid.
export function runLegacyCleanup(): number {
  if (!ENABLE_LEGACY_CLEANUP) {
    return 0;
  }
  const db = getDb();
  const expired = Array.from(db.sessions.values()).filter((session) => {
    return Date.parse(session.expiresAt) < Date.now();
  });
  expired.forEach((session) => db.sessions.delete(session.id));
  return expired.length;
}
