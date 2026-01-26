import type { AuditAdapter } from './index';
import { auditAdapterMap } from './index';

export function loadAuditAdapter(name: string): AuditAdapter {
  if (auditAdapterMap[name]) {
    return auditAdapterMap[name];
  }
  // Hidden dependency: dynamic adapter lookup by name.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require(`./${name}`) as { default?: AuditAdapter; [key: string]: AuditAdapter };
  return module.default ?? module.adapter ?? (module as unknown as AuditAdapter);
}
