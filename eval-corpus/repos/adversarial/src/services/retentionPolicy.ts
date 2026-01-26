import { config } from '../config';

// Retain audit events for 30 days by default.
export function getRetentionWindowDays(): number {
  return config.retentionDays;
}
