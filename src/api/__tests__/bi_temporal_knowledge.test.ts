import { describe, it, expect } from 'vitest';
import { BiTemporalKnowledgeStore } from '../bi_temporal_knowledge.js';

describe('bi-temporal knowledge store', () => {
  it('returns facts for current snapshot', () => {
    const store = new BiTemporalKnowledgeStore();
    const now = new Date().toISOString();
    store.recordFact({
      claim: 'Login uses JWT',
      subject: 'auth',
      validTime: { start: now, end: 'now' },
      transactionTime: { recorded: now },
      evidence: [{ id: 'ev1' }],
      confidence: 0.6,
    });

    const results = store.current('login');
    expect(results.length).toBe(1);
  });

  it('filters by valid time', () => {
    const store = new BiTemporalKnowledgeStore();
    const start = '2026-01-01T00:00:00.000Z';
    const end = '2026-01-10T00:00:00.000Z';
    store.recordFact({
      claim: 'Legacy auth in place',
      subject: 'auth',
      validTime: { start, end },
      transactionTime: { recorded: start },
      evidence: [{ id: 'ev2' }],
      confidence: 0.4,
    });

    expect(store.asOfValidTime('auth', '2026-01-05T00:00:00.000Z').length).toBe(1);
    expect(store.asOfValidTime('auth', '2026-01-15T00:00:00.000Z').length).toBe(0);
  });

  it('diffs knowledge between transaction times', () => {
    const store = new BiTemporalKnowledgeStore();
    store.recordFact({
      claim: 'Login uses JWT',
      subject: 'auth',
      validTime: { start: '2026-01-01T00:00:00.000Z', end: 'now' },
      transactionTime: { recorded: '2026-01-02T00:00:00.000Z' },
      evidence: [{ id: 'ev3' }],
      confidence: 0.6,
    });
    store.recordFact({
      claim: 'Login uses sessions',
      subject: 'auth',
      validTime: { start: '2026-01-03T00:00:00.000Z', end: 'now' },
      transactionTime: { recorded: '2026-01-04T00:00:00.000Z' },
      evidence: [{ id: 'ev4' }],
      confidence: 0.5,
    });

    const diff = store.knowledgeDiff(
      'login',
      '2026-01-02T12:00:00.000Z',
      '2026-01-05T00:00:00.000Z'
    );

    expect(diff.added.length).toBe(1);
    expect(diff.removed.length).toBe(0);
  });
});
