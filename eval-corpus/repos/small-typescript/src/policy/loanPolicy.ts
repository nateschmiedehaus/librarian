import type { Book, Loan, User } from '../types';
import { config } from '../config';
import { isPast } from '../utils/date';

export interface LoanDecision {
  allowed: boolean;
  reason?: string;
}

export const canCheckout = (
  user: User,
  book: Book,
  openLoans: Loan[],
  now: Date
): LoanDecision => {
  if (!user.active) {
    return { allowed: false, reason: 'User is inactive' };
  }
  if (book.copiesAvailable <= 0) {
    return { allowed: false, reason: 'No copies available' };
  }
  if (openLoans.length >= config.maxConcurrentLoans) {
    return { allowed: false, reason: 'User has too many active loans' };
  }
  const hasOverdue = openLoans.some((loan) => isPast(loan.dueAt, now));
  if (hasOverdue) {
    return { allowed: false, reason: 'User has overdue loans' };
  }
  return { allowed: true };
};
