import type { User, Book } from '../types';
import { requireRole } from '../auth/auth';
import { createBook, adjustCopies, searchByTag } from '../services/bookService';

export const addBook = (actor: User, payload: {
  title: string;
  author: string;
  isbn: string;
  copies: number;
  tags?: string[];
}): Book => {
  requireRole(actor, ['librarian', 'admin']);
  return createBook(payload);
};

export const updateInventory = (actor: User, bookId: string, delta: number): Book => {
  requireRole(actor, ['librarian', 'admin']);
  return adjustCopies(bookId, delta);
};

export const findByTag = (actor: User, tag: string): Book[] => {
  requireRole(actor, ['member', 'librarian', 'admin']);
  return searchByTag(tag);
};
