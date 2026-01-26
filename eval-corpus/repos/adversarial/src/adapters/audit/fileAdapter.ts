import type { AuditEvent } from '../../types';
import type { AuditAdapter } from './index';

const buffer: AuditEvent[] = [];

export const fileAdapter: AuditAdapter = {
  write(event: AuditEvent) {
    buffer.push(event);
  },
};

export function getBufferedAudits(): AuditEvent[] {
  return buffer.slice();
}
