import type { Session } from '../types';
import { getDb } from '../data/db';
import { nextId } from '../utils/id';
import { addDays, nowIso } from '../utils/date';
import { config } from '../config';
import { NotFoundError } from '../errors';

export const createSession = (userId: string, now: Date = new Date()): Session => {
  const db = getDb();
  const createdAt = nowIso(now);
  const expiresAt = addDays(now, config.sessionTtlDays);
  const session: Session = {
    token: nextId('session'),
    userId,
    createdAt,
    expiresAt,
  };
  db.sessions.push(session);
  return session;
};

export const getSession = (token: string): Session => {
  const db = getDb();
  const session = db.sessions.find((entry) => entry.token === token);
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  return session;
};

export const revokeSession = (token: string): void => {
  const db = getDb();
  db.sessions = db.sessions.filter((entry) => entry.token !== token);
};

export const isSessionExpired = (session: Session, now: Date = new Date()): boolean => {
  return new Date(session.expiresAt).getTime() < now.getTime();
};
