import type { AuditEvent } from '../../types';
import type { AuditAdapter } from './index';

export const consoleAdapter: AuditAdapter = {
  write(event: AuditEvent) {
    console.log('[audit]', event.action, event.actorId);
  },
};
