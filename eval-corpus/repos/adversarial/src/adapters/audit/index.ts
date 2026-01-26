import type { AuditEvent } from '../../types';
import { consoleAdapter } from './consoleAdapter';
import { fileAdapter } from './fileAdapter';

export interface AuditAdapter {
  write(event: AuditEvent): void;
}

export const auditAdapterMap: Record<string, AuditAdapter> = {
  console: consoleAdapter,
  file: fileAdapter,
};
