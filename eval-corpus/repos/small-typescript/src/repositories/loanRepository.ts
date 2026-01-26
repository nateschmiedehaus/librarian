import type { Loan } from '../types';
import { NotFoundError } from '../errors';
import { getDb } from '../data/db';

export const addLoan = (loan: Loan): Loan => {
  const db = getDb();
  db.loans.push(loan);
  return loan;
};

export const updateLoan = (next: Loan): Loan => {
  const db = getDb();
  const index = db.loans.findIndex((loan) => loan.id === next.id);
  if (index === -1) {
    throw new NotFoundError(`Loan not found: ${next.id}`);
  }
  db.loans[index] = next;
  return next;
};

export const listLoansByUser = (userId: string): Loan[] => {
  const db = getDb();
  return db.loans.filter((loan) => loan.userId === userId);
};

export const listOpenLoans = (): Loan[] => {
  const db = getDb();
  return db.loans.filter((loan) => !loan.returnedAt);
};

export const findLoanById = (id: string): Loan => {
  const db = getDb();
  const loan = db.loans.find((candidate) => candidate.id === id);
  if (!loan) {
    throw new NotFoundError(`Loan not found: ${id}`);
  }
  return loan;
};
