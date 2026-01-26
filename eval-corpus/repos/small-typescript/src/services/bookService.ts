import type { Book } from '../types';
import { addBook, findBookById, searchBooksByTag, updateBook } from '../repositories/bookRepository';
import { nextId } from '../utils/id';
import { nowIso } from '../utils/date';
import { DEFAULT_TAGS } from '../constants';
import { ValidationError } from '../errors';

export const createBook = (payload: {
  title: string;
  author: string;
  isbn: string;
  copies: number;
  tags?: string[];
}): Book => {
  if (payload.copies <= 0) {
    throw new ValidationError('copies must be positive');
  }
  const book: Book = {
    id: nextId('book'),
    title: payload.title,
    author: payload.author,
    isbn: payload.isbn,
    copiesTotal: payload.copies,
    copiesAvailable: payload.copies,
    tags: payload.tags && payload.tags.length > 0 ? payload.tags : DEFAULT_TAGS,
    createdAt: nowIso(),
  };
  return addBook(book);
};

export const adjustCopies = (bookId: string, delta: number): Book => {
  const book = findBookById(bookId);
  const nextAvailable = book.copiesAvailable + delta;
  if (nextAvailable < 0 || nextAvailable > book.copiesTotal) {
    throw new ValidationError('copiesAvailable out of range');
  }
  const next = { ...book, copiesAvailable: nextAvailable };
  return updateBook(next);
};

export const getBook = (bookId: string): Book => findBookById(bookId);

export const searchByTag = (tag: string): Book[] => searchBooksByTag(tag);
