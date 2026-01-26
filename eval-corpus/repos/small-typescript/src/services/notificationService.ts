import type { Book, User } from '../types';
import { logInfo } from '../utils/logger';

export const sendLoanReceipt = (user: User, book: Book, dueAt: string): void => {
  logInfo('Sent loan receipt', {
    userId: user.id,
    email: user.email,
    bookId: book.id,
    dueAt,
  });
};

export const sendOverdueNotice = (user: User, book: Book, daysOverdue: number): void => {
  logInfo('Sent overdue notice', {
    userId: user.id,
    email: user.email,
    bookId: book.id,
    daysOverdue,
  });
};
