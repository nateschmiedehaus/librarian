import type { AuditEvent, Session, User } from '../types';

export interface DbState {
  users: Map<string, User>;
  sessions: Map<string, Session>;
  audits: AuditEvent[];
}

const db: DbState = {
  users: new Map(),
  sessions: new Map(),
  audits: [],
};

export function getDb(): DbState {
  return db;
}
