import type { Role, User } from '../types';
import { addUser, findUserByEmail, findUserById, listActiveUsers, updateUser } from '../repositories/userRepository';
import { nextId } from '../utils/id';
import { nowIso } from '../utils/date';
import { ValidationError } from '../errors';

export const registerUser = (name: string, email: string, role: Role = 'member'): User => {
  const existing = findUserByEmail(email);
  if (existing) {
    throw new ValidationError('Email already registered');
  }
  const user: User = {
    id: nextId('user'),
    name,
    email,
    role,
    active: true,
    createdAt: nowIso(),
  };
  return addUser(user);
};

export const deactivateUser = (userId: string): User => {
  const user = findUserById(userId);
  const next = { ...user, active: false };
  return updateUser(next);
};

export const listActive = (): User[] => listActiveUsers();
