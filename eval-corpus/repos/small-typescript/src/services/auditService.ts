import type { AuditEvent } from '../types';
import { getDb } from '../data/db';
import { nextId } from '../utils/id';
import { nowIso } from '../utils/date';

export const recordAudit = (
  action: string,
  actorId: string,
  meta: Record<string, unknown> = {}
): AuditEvent => {
  const db = getDb();
  const event: AuditEvent = {
    id: nextId('audit'),
    action,
    actorId,
    createdAt: nowIso(),
    meta,
  };
  db.audits.push(event);
  return event;
};
