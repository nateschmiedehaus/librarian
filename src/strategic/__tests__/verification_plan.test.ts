import { describe, it, expect, vi } from 'vitest';
import { createVerificationPlan } from '../verification_plan.js';

describe('createVerificationPlan', () => {
  it('defaults timestamps to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T02:00:00.000Z'));

    const plan = createVerificationPlan({
      id: 'vp-1',
      target: 'claim-123',
      methods: [
        {
          type: 'automated_test',
          description: 'Run unit tests',
          automatable: true,
          command: 'npm test',
        },
      ],
      expectedObservations: ['tests pass'],
    });

    expect(plan.createdAt).toBe('2026-01-19T02:00:00.000Z');
    expect(plan.updatedAt).toBe('2026-01-19T02:00:00.000Z');

    vi.useRealTimers();
  });
});
