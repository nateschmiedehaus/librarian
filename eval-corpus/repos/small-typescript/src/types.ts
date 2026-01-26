export type Role = 'member' | 'librarian' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  copiesTotal: number;
  copiesAvailable: number;
  tags: string[];
  createdAt: string;
}

export interface Loan {
  id: string;
  userId: string;
  bookId: string;
  loanedAt: string;
  dueAt: string;
  returnedAt?: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
  meta: Record<string, unknown>;
}

export interface RateLimitState {
  windowStart: number;
  count: number;
}
