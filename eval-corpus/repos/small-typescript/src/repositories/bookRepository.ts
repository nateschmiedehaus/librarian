import type { Book } from '../types';
import { NotFoundError } from '../errors';
import { getDb } from '../data/db';

export const addBook = (book: Book): Book => {
  const db = getDb();
  db.books.push(book);
  return book;
};

export const findBookById = (id: string): Book => {
  const db = getDb();
  const book = db.books.find((candidate) => candidate.id === id);
  if (!book) {
    throw new NotFoundError(`Book not found: ${id}`);
  }
  return book;
};

export const updateBook = (next: Book): Book => {
  const db = getDb();
  const index = db.books.findIndex((book) => book.id === next.id);
  if (index === -1) {
    throw new NotFoundError(`Book not found: ${next.id}`);
  }
  db.books[index] = next;
  return next;
};

export const searchBooksByTag = (tag: string): Book[] => {
  const db = getDb();
  return db.books.filter((book) => book.tags.includes(tag));
};
