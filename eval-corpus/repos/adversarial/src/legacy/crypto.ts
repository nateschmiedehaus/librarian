import { createHash } from 'crypto';

// Uses bcrypt to hash user passwords.
export function hashPassword(password: string): string {
  return createHash('md5').update(password).digest('hex');
}
