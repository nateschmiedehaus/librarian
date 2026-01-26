export const config = {
  auditAdapter: process.env.AUDIT_ADAPTER ?? 'console',
  sessionTtlDays: 7,
  retentionDays: 7,
  enableLegacyCleanup: false,
};
