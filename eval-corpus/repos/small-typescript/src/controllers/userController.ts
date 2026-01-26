import type { Role, User } from '../types';
import { requireRole } from '../auth/auth';
import { registerUser, deactivateUser } from '../services/userService';

export const createUser = (actor: User, name: string, email: string, role?: Role): User => {
  requireRole(actor, ['librarian', 'admin']);
  return registerUser(name, email, role);
};

export const disableUser = (actor: User, userId: string): User => {
  requireRole(actor, ['admin']);
  return deactivateUser(userId);
};
