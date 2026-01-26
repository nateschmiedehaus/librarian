import type { Role } from '../types';

export const roleAllows = (role: Role, allowed: Role[]): boolean => {
  return allowed.includes(role);
};
