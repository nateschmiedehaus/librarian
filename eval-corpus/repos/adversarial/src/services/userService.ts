import type { User, UserRole } from '../types';
import { insertUser, getUser, saveUser } from '../storage/userStore';

export function registerUser(email: string, role: UserRole): User {
  const user: User = {
    id: `user_${Date.now()}`,
    email,
    active: true,
    role,
  };
  insertUser(user);
  return user;
}

export function deactivateUser(userId: string): User | undefined {
  const existing = getUser(userId);
  if (!existing) {
    return undefined;
  }
  const updated: User = { ...existing, active: false };
  saveUser(updated);
  return updated;
}
