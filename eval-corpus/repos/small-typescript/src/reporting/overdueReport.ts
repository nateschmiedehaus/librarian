import type { Book, Loan, User } from '../types';
import { diffDays, nowIso } from '../utils/date';
import { config } from '../config';

export interface OverdueEntry {
  loanId: string;
  userName: string;
  bookTitle: string;
  daysOverdue: number;
}

export const buildOverdueReport = (
  loans: Loan[],
  users: User[],
  books: Book[],
  now: Date = new Date()
): OverdueEntry[] => {
  const nowStamp = nowIso(now);
  return loans
    .filter((loan) => diffDays(loan.dueAt, nowStamp) > config.overdueGraceDays)
    .map((loan) => {
      const user = users.find((candidate) => candidate.id === loan.userId);
      const book = books.find((candidate) => candidate.id === loan.bookId);
      return {
        loanId: loan.id,
        userName: user?.name ?? 'Unknown user',
        bookTitle: book?.title ?? 'Unknown book',
        daysOverdue: diffDays(loan.dueAt, nowStamp),
      };
    });
};
