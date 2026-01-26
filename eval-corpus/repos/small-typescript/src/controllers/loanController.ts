import type { Loan, User } from '../types';
import { requireRole } from '../auth/auth';
import { checkoutBook, returnBook, listOverdueLoans } from '../services/loanService';
import { buildOverdueReport } from '../reporting/overdueReport';
import { getDb } from '../data/db';

export const checkout = (actor: User, bookId: string): Loan => {
  requireRole(actor, ['member', 'librarian', 'admin']);
  return checkoutBook(actor.id, bookId);
};

export const checkin = (actor: User, loanId: string): Loan => {
  requireRole(actor, ['librarian', 'admin']);
  return returnBook(loanId);
};

export const overdueReport = (actor: User): ReturnType<typeof buildOverdueReport> => {
  requireRole(actor, ['librarian', 'admin']);
  const db = getDb();
  const overdueLoans = listOverdueLoans();
  return buildOverdueReport(overdueLoans, db.users, db.books);
};
