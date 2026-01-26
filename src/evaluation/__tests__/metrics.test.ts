/**
 * @fileoverview Retrieval metrics tests for eval runner.
 */

import { describe, it, expect } from 'vitest';
import { computeRetrievalMetrics } from '../metrics.js';

describe('computeRetrievalMetrics', () => {
  it('computes precision/recall@k, MRR, and MAP', () => {
    const metrics = computeRetrievalMetrics({
      retrievedDocs: ['a', 'x', 'b', 'y', 'c'],
      relevantDocs: ['a', 'b', 'c'],
      kValues: [1, 3, 5],
    });

    expect(metrics.recallAtK[1]).toBeCloseTo(1 / 3, 5);
    expect(metrics.precisionAtK[1]).toBe(1);
    expect(metrics.recallAtK[3]).toBeCloseTo(2 / 3, 5);
    expect(metrics.precisionAtK[3]).toBeCloseTo(2 / 3, 5);
    expect(metrics.recallAtK[5]).toBe(1);
    expect(metrics.precisionAtK[5]).toBeCloseTo(0.6, 5);
    expect(metrics.mrr).toBe(1);
    expect(metrics.map).toBeCloseTo(0.755555, 5);

    // Binary nDCG sanity check
    expect(metrics.ndcgAtK[3]).toBeCloseTo(0.704, 3);
  });

  it('uses graded relevance for nDCG', () => {
    const metrics = computeRetrievalMetrics({
      retrievedDocs: ['c', 'b', 'a'],
      relevantDocs: ['a', 'b', 'c'],
      gradedRelevance: { a: 3, b: 2, c: 1 },
      kValues: [3],
    });

    expect(metrics.ndcgAtK[3]).toBeCloseTo(0.79, 3);
  });
});
