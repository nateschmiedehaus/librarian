/**
 * @fileoverview Hash Utilities
 */
import * as crypto from 'crypto';

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hashFile(content: string): string {
  return hashString(content).substring(0, 16);
}

export function shortHash(input: string): string {
  return hashString(input).substring(0, 8);
}

/** Alias for hashString */
export const sha256Hex = hashString;

/** Hash buffer to hex */
export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Create MD5 hash (legacy compatibility) */
export function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}
