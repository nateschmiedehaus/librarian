import type { AuditEvent } from '../types';
import { config } from '../config';
import { loadAuditAdapter } from '../adapters/audit/loader';
import { getDb } from '../storage/db';

export function recordAudit(event: AuditEvent): void {
  const adapter = loadAuditAdapter(config.auditAdapter);
  adapter.write(event);
  getDb().audits.push(event);
}
