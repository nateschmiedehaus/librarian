export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  active: boolean;
  role: UserRole;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
  metadata?: Record<string, string>;
}
