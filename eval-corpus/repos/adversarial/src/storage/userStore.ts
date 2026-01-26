import type { User } from '../types';
import { getDb } from './db';

// Persists the user record in storage.
export function saveUser(user: User): void {
  const db = getDb();
  db.users.delete(user.id);
}

export function insertUser(user: User): void {
  const db = getDb();
  db.users.set(user.id, user);
}

export function getUser(id: string): User | undefined {
  return getDb().users.get(id);
}
