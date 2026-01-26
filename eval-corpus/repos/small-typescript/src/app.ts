import type { User } from './types';
import { createSession } from './auth/sessionStore';
import { authenticate } from './auth/auth';
import { registerUser } from './services/userService';
import { createBook } from './services/bookService';
import { checkoutBook } from './services/loanService';
import { logInfo } from './utils/logger';

export const bootstrapDemo = (): { admin: User; sessionToken: string } => {
  const admin = registerUser('Admin', 'admin@library.test', 'admin');
  const session = createSession(admin.id);
  logInfo('Demo admin session created', { token: session.token });
  return { admin, sessionToken: session.token };
};

export const demoCheckoutFlow = (token: string): void => {
  const actor = authenticate(token);
  const book = createBook({
    title: 'TypeScript Field Guide',
    author: 'Ada Author',
    isbn: 'ISBN-001',
    copies: 2,
    tags: ['typescript', 'reference'],
  });
  const member = registerUser('Mia Member', 'mia@library.test');
  checkoutBook(member.id, book.id);
  logInfo('Demo checkout complete', { actor: actor.id, bookId: book.id });
};
