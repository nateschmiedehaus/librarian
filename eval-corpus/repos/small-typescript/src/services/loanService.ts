import type { Loan } from '../types';
import { addDays, nowIso } from '../utils/date';
import { config } from '../config';
import { PolicyError, RateLimitError, ValidationError } from '../errors';
import { addLoan, findLoanById, listLoansByUser, listOpenLoans, updateLoan } from '../repositories/loanRepository';
import { findUserById } from '../repositories/userRepository';
import { getBook, adjustCopies } from './bookService';
import { canCheckout } from '../policy/loanPolicy';
import { checkRateLimit } from '../policy/rateLimiter';
import { sendLoanReceipt } from './notificationService';
import { recordAudit } from './auditService';
import { nextId } from '../utils/id';

export const checkoutBook = (userId: string, bookId: string, now: Date = new Date()): Loan => {
  if (checkRateLimit(userId, now)) {
    throw new RateLimitError('Too many checkout attempts');
  }

  const user = findUserById(userId);
  const book = getBook(bookId);
  const openLoans = listLoansByUser(userId).filter((loan) => !loan.returnedAt);
  const decision = canCheckout(user, book, openLoans, now);

  if (!decision.allowed) {
    throw new PolicyError(decision.reason ?? 'Checkout blocked');
  }

  if (openLoans.some((loan) => loan.bookId === bookId)) {
    throw new ValidationError('User already has this book checked out');
  }

  const loan: Loan = {
    id: nextId('loan'),
    userId: user.id,
    bookId: book.id,
    loanedAt: nowIso(now),
    dueAt: addDays(now, config.maxLoanDays),
  };

  addLoan(loan);
  adjustCopies(book.id, -1);
  sendLoanReceipt(user, book, loan.dueAt);
  recordAudit('loan.checkout', user.id, { loanId: loan.id, bookId: book.id });
  return loan;
};

export const returnBook = (loanId: string, now: Date = new Date()): Loan => {
  const loan = findLoanById(loanId);
  if (loan.returnedAt) {
    throw new ValidationError('Loan already returned');
  }

  const next: Loan = { ...loan, returnedAt: nowIso(now) };
  updateLoan(next);
  adjustCopies(loan.bookId, 1);
  recordAudit('loan.return', loan.userId, { loanId: loan.id, bookId: loan.bookId });
  return next;
};

export const listOverdueLoans = (now: Date = new Date()): Loan[] => {
  return listOpenLoans().filter((loan) => new Date(loan.dueAt).getTime() < now.getTime());
};
