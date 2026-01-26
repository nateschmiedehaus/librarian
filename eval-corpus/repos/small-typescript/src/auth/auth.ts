import type { Role, User } from '../types';
import { AuthError } from '../errors';
import { getSession, isSessionExpired } from './sessionStore';
import { findUserById } from '../repositories/userRepository';
import { roleAllows } from './roles';

export const authenticate = (token: string): User => {
  const session = getSession(token);
  if (isSessionExpired(session)) {
    throw new AuthError('Session expired');
  }
  const user = findUserById(session.userId);
  if (!user.active) {
    throw new AuthError('User inactive');
  }
  return user;
};

export const requireRole = (user: User, allowed: Role[]): void => {
  if (!roleAllows(user.role, allowed)) {
    throw new AuthError(`Role ${user.role} cannot perform this action`);
  }
};
