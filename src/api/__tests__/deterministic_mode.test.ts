import { describe, it, expect } from 'vitest';
import {
  createDeterministicContext,
  stableSort,
  type DeterministicContext,
} from '../../types.js';

describe('DeterministicContext', () => {
  describe('createDeterministicContext', () => {
    it('returns a context with fixed timestamp', () => {
      const ctx = createDeterministicContext();

      expect(ctx.fixedTimestamp).toBe('2025-01-01T00:00:00.000Z');
      expect(ctx.fixedDate.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('generates sequential deterministic IDs', () => {
      const ctx = createDeterministicContext();

      const id1 = ctx.generateId();
      const id2 = ctx.generateId();
      const id3 = ctx.generateId();

      expect(id1).toBe('det-0');
      expect(id2).toBe('det-1');
      expect(id3).toBe('det-2');
    });

    it('generates IDs with prefix', () => {
      const ctx = createDeterministicContext();

      const id = ctx.generateId('fbk_');

      expect(id).toBe('fbk_det-0');
    });

    it('uses seed in ID generation when provided', () => {
      const ctx = createDeterministicContext('test-seed');

      const id1 = ctx.generateId();
      const id2 = ctx.generateId('prefix_');

      expect(id1).toBe('test-seed-0');
      expect(id2).toBe('prefix_test-seed-1');
    });

    it('returns consistent values from now() and nowDate()', () => {
      const ctx = createDeterministicContext();

      expect(ctx.now()).toBe('2025-01-01T00:00:00.000Z');
      expect(ctx.nowDate().toISOString()).toBe('2025-01-01T00:00:00.000Z');

      // Multiple calls return the same value
      expect(ctx.now()).toBe(ctx.now());
      expect(ctx.nowDate().getTime()).toBe(ctx.nowDate().getTime());
    });

    it('generates different IDs for different seeds', () => {
      const ctx1 = createDeterministicContext('seed-a');
      const ctx2 = createDeterministicContext('seed-b');

      expect(ctx1.generateId()).toBe('seed-a-0');
      expect(ctx2.generateId()).toBe('seed-b-0');
    });
  });

  describe('stableSort', () => {
    interface TestItem {
      id: string;
      score: number;
    }

    it('sorts by score descending', () => {
      const items: TestItem[] = [
        { id: 'a', score: 0.5 },
        { id: 'b', score: 0.8 },
        { id: 'c', score: 0.3 },
      ];

      const sorted = stableSort(items, (i) => i.score, (i) => i.id);

      expect(sorted.map(i => i.id)).toEqual(['b', 'a', 'c']);
    });

    it('uses ID for stable ordering on score ties', () => {
      const items: TestItem[] = [
        { id: 'c', score: 0.5 },
        { id: 'a', score: 0.5 },
        { id: 'b', score: 0.5 },
      ];

      const sorted = stableSort(items, (i) => i.score, (i) => i.id);

      // All have same score, so sorted alphabetically by ID
      expect(sorted.map(i => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('maintains stable order across multiple calls', () => {
      const items: TestItem[] = [
        { id: 'x', score: 0.7 },
        { id: 'y', score: 0.7 },
        { id: 'z', score: 0.5 },
        { id: 'a', score: 0.7 },
      ];

      const sorted1 = stableSort(items, (i) => i.score, (i) => i.id);
      const sorted2 = stableSort(items, (i) => i.score, (i) => i.id);

      // Should produce identical results
      expect(sorted1.map(i => i.id)).toEqual(sorted2.map(i => i.id));
      // a, x, y have same score (0.7), sorted alphabetically, then z (0.5)
      expect(sorted1.map(i => i.id)).toEqual(['a', 'x', 'y', 'z']);
    });

    it('does not mutate the original array', () => {
      const items: TestItem[] = [
        { id: 'b', score: 0.5 },
        { id: 'a', score: 0.8 },
      ];
      const original = [...items];

      stableSort(items, (i) => i.score, (i) => i.id);

      expect(items).toEqual(original);
    });

    it('handles empty arrays', () => {
      const items: TestItem[] = [];

      const sorted = stableSort(items, (i) => i.score, (i) => i.id);

      expect(sorted).toEqual([]);
    });

    it('handles single-element arrays', () => {
      const items: TestItem[] = [{ id: 'only', score: 0.5 }];

      const sorted = stableSort(items, (i) => i.score, (i) => i.id);

      expect(sorted).toEqual([{ id: 'only', score: 0.5 }]);
    });
  });

  describe('deterministic mode integration', () => {
    it('produces consistent results for same input', () => {
      // Simulate multiple runs with same input
      const runSimulation = () => {
        const ctx = createDeterministicContext('test-query');

        const ids = [
          ctx.generateId('cp_'),
          ctx.generateId('qry_'),
          ctx.generateId('fbk_'),
        ];

        const items = [
          { id: 'pack-c', score: 0.8 },
          { id: 'pack-a', score: 0.8 },
          { id: 'pack-b', score: 0.6 },
        ];

        const sorted = stableSort(items, (i) => i.score, (i) => i.id);

        return {
          ids,
          sorted: sorted.map(i => i.id),
          timestamp: ctx.now(),
        };
      };

      const run1 = runSimulation();
      const run2 = runSimulation();

      expect(run1.ids).toEqual(run2.ids);
      expect(run1.sorted).toEqual(run2.sorted);
      expect(run1.timestamp).toBe(run2.timestamp);
    });
  });
});

describe('deterministic mode documentation', () => {
  it('documents non-deterministic operations', () => {
    /**
     * NON-DETERMINISTIC OPERATIONS IN LIBRARIAN QUERIES
     * ===================================================
     *
     * The following operations are inherently non-deterministic and are
     * modified/skipped when deterministic=true:
     *
     * 1. LLM Synthesis (runSynthesisStage)
     *    - LLM responses vary even with same prompt
     *    - Solution: Skip synthesis, return undefined
     *
     * 2. UUID Generation (randomUUID)
     *    - Creates random identifiers
     *    - Solution: Use sequential deterministic IDs (det-0, det-1, ...)
     *
     * 3. Timestamps (Date.now, new Date())
     *    - Wall-clock time varies between runs
     *    - Solution: Use fixed epoch (2025-01-01T00:00:00.000Z)
     *
     * 4. Latency Measurement (Date.now() - startTime)
     *    - Execution time varies
     *    - Solution: Return 0 for latencyMs
     *
     * 5. Result Ordering with Tied Scores
     *    - JavaScript sort is not stable across implementations
     *    - Solution: Use stableSort with ID as tiebreaker
     *
     * OPERATIONS THAT ARE ALREADY DETERMINISTIC:
     * - Vector similarity search (same embeddings = same results)
     * - Graph traversal (same graph = same paths)
     * - Cache lookups (same key = same cached value)
     * - Confidence calculations (same inputs = same score)
     */
    expect(true).toBe(true);
  });
});
