import type { AuditEvent, Book, Loan, Session, User } from '../types';

export interface DbState {
  users: User[];
  books: Book[];
  loans: Loan[];
  sessions: Session[];
  audits: AuditEvent[];
}

const db: DbState = {
  users: [],
  books: [],
  loans: [],
  sessions: [],
  audits: [],
};

export const getDb = (): DbState => db;
