import type { User } from '../types';
import { NotFoundError } from '../errors';
import { getDb } from '../data/db';

export const addUser = (user: User): User => {
  const db = getDb();
  db.users.push(user);
  return user;
};

export const findUserById = (id: string): User => {
  const db = getDb();
  const user = db.users.find((candidate) => candidate.id === id);
  if (!user) {
    throw new NotFoundError(`User not found: ${id}`);
  }
  return user;
};

export const findUserByEmail = (email: string): User | undefined => {
  const db = getDb();
  return db.users.find((candidate) => candidate.email === email);
};

export const listActiveUsers = (): User[] => {
  const db = getDb();
  return db.users.filter((user) => user.active);
};

export const updateUser = (next: User): User => {
  const db = getDb();
  const index = db.users.findIndex((user) => user.id === next.id);
  if (index === -1) {
    throw new NotFoundError(`User not found: ${next.id}`);
  }
  db.users[index] = next;
  return next;
};
