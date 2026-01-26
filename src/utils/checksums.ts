import { createHash } from 'node:crypto';

export function computeChecksum16(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

