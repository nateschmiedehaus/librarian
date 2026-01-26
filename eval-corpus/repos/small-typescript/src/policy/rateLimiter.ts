import type { RateLimitState } from '../types';
import { config } from '../config';

const limiterState = new Map<string, RateLimitState>();

export const checkRateLimit = (userId: string, now: Date = new Date()): boolean => {
  const current = limiterState.get(userId);
  const nowMs = now.getTime();
  const windowStart = current?.windowStart ?? nowMs;
  const elapsed = nowMs - windowStart;

  if (!current || elapsed > 60_000) {
    limiterState.set(userId, { windowStart: nowMs, count: 1 });
    return false;
  }

  const nextCount = current.count + 1;
  limiterState.set(userId, { windowStart, count: nextCount });
  return nextCount > config.rateLimitPerMinute;
};
