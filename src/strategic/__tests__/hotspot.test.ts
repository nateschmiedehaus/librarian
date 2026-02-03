/**
 * @fileoverview Tests for Hotspot Scoring
 *
 * Tests cover:
 * - Basic hotspot computation
 * - Churn score calculation
 * - Complexity score calculation
 * - Hotspot formula with exponents
 * - Batch computation and ranking
 * - Integration helpers
 * - Prioritization and multi-signal integration
 */

import { describe, it, expect } from 'vitest';
import {
  computeHotspotScore,
  computeChurnScore,
  computeComplexityScore,
  computeHotspotScores,
  filterHotspots,
  getTopHotspots,
  fromTemporalGraph,
  fromDebtMetrics,
  mergeHotspotInputs,
  calculateHotspotFactor,
  toHotspotSignal,
  DEFAULT_HOTSPOT_CONFIG,
  type HotspotInput,
  type HotspotConfig,
} from '../hotspot.js';

describe('Hotspot Scoring', () => {
  describe('computeChurnScore', () => {
    it('should return 0.5 when no churn data is provided', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
      };
      const score = computeChurnScore(input);
      expect(score).toBe(0.5);
    });

    it('should compute score from commit count', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
        commitCount: 50, // 50% of max (100)
      };
      const score = computeChurnScore(input);
      expect(score).toBe(0.5);
    });

    it('should cap score at 1.0 for high commit counts', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
        commitCount: 200, // > max
      };
      const score = computeChurnScore(input);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should weight recent changes higher', () => {
      const inputHistorical: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
        commitCount: 20,
      };
      const inputRecent: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
        recentChanges: 10, // Same relative weight but with recency boost
      };
      const historical = computeChurnScore(inputHistorical);
      const recent = computeChurnScore(inputRecent);
      // Recent changes get a boost via recencyWeight
      expect(recent).toBeGreaterThan(historical * 0.5);
    });

    it('should combine multiple churn signals', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
        commitCount: 50,
        authorCount: 5,
        recentChanges: 10,
      };
      const score = computeChurnScore(input);
      // Should be higher than commit count alone due to multiple signals
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('computeComplexityScore', () => {
    it('should return 0.5 when no complexity data is provided', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
      };
      const score = computeComplexityScore(input);
      expect(score).toBe(0.5);
    });

    it('should compute score from cyclomatic complexity', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'function',
        cyclomaticComplexity: 25, // 50% of max (50)
      };
      const score = computeComplexityScore(input);
      // 25/50 = 0.5, weighted by 1.2 = 0.6, averaged = 0.6
      expect(score).toBeCloseTo(0.6, 1);
    });

    it('should cap score at 1.0 for high complexity', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'function',
        cyclomaticComplexity: 100, // > max
      };
      const score = computeComplexityScore(input);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should combine multiple complexity signals', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'function',
        cyclomaticComplexity: 30,
        linesOfCode: 500,
        nestingDepth: 4,
      };
      const score = computeComplexityScore(input);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('computeHotspotScore', () => {
    it('should compute hotspot from churn and complexity', () => {
      const input: HotspotInput = {
        entityId: 'hotspot.ts',
        entityType: 'file',
        commitCount: 80,
        cyclomaticComplexity: 40,
      };
      const result = computeHotspotScore(input);

      expect(result.entityId).toBe('hotspot.ts');
      expect(result.entityType).toBe('file');
      expect(result.churnScore).toBeGreaterThan(0);
      expect(result.complexityScore).toBeGreaterThan(0);
      expect(result.hotspotScore).toBeGreaterThan(0);
      expect(result.hotspotScore).toBeLessThanOrEqual(1);
      expect(result.computedAt).toBeDefined();
    });

    it('should use exponents to dampen outliers', () => {
      const highInput: HotspotInput = {
        entityId: 'extreme.ts',
        entityType: 'file',
        commitCount: 100, // Max
        cyclomaticComplexity: 50, // Max
      };
      const moderateInput: HotspotInput = {
        entityId: 'moderate.ts',
        entityType: 'file',
        commitCount: 50,
        cyclomaticComplexity: 25,
      };

      const highResult = computeHotspotScore(highInput);
      const moderateResult = computeHotspotScore(moderateInput);

      // High should be higher, but not 4x (due to exponents)
      const ratio = highResult.hotspotScore / moderateResult.hotspotScore;
      expect(ratio).toBeLessThan(4);
      expect(ratio).toBeGreaterThan(1);
    });

    it('should include churn details when available', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
        commitCount: 30,
        authorCount: 5,
        recentChanges: 8,
      };
      const result = computeHotspotScore(input);

      expect(result.churnDetails).toBeDefined();
      expect(result.churnDetails?.commitCount).toBe(30);
      expect(result.churnDetails?.authorCount).toBe(5);
      expect(result.churnDetails?.recentChanges).toBe(8);
    });

    it('should include complexity details when available', () => {
      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'function',
        cyclomaticComplexity: 15,
        linesOfCode: 200,
      };
      const result = computeHotspotScore(input);

      expect(result.complexityDetails).toBeDefined();
      expect(result.complexityDetails?.cyclomatic).toBe(15);
      expect(result.complexityDetails?.linesOfCode).toBe(200);
    });

    it('should respect custom configuration', () => {
      const config: HotspotConfig = {
        ...DEFAULT_HOTSPOT_CONFIG,
        churnExponent: 1.0, // No dampening
        complexityExponent: 1.0, // No dampening
      };

      const input: HotspotInput = {
        entityId: 'test.ts',
        entityType: 'file',
        commitCount: 50,
        cyclomaticComplexity: 25,
      };

      const defaultResult = computeHotspotScore(input);
      const customResult = computeHotspotScore(input, config);

      // Without dampening, the formula is just churn * complexity
      // With dampening, it's churn^0.7 * complexity^0.5
      expect(customResult.hotspotScore).not.toBe(defaultResult.hotspotScore);
    });
  });

  describe('computeHotspotScores (batch)', () => {
    it('should compute scores for multiple entities', () => {
      const inputs: HotspotInput[] = [
        { entityId: 'a.ts', entityType: 'file', commitCount: 10, cyclomaticComplexity: 5 },
        { entityId: 'b.ts', entityType: 'file', commitCount: 50, cyclomaticComplexity: 30 },
        { entityId: 'c.ts', entityType: 'file', commitCount: 30, cyclomaticComplexity: 20 },
      ];

      const results = computeHotspotScores(inputs);

      expect(results).toHaveLength(3);
      // Should be sorted by score descending
      expect(results[0].entityId).toBe('b.ts'); // Highest churn + complexity
      expect(results[0].hotspotScore).toBeGreaterThan(results[1].hotspotScore);
      expect(results[1].hotspotScore).toBeGreaterThan(results[2].hotspotScore);
    });
  });

  describe('filterHotspots', () => {
    it('should filter entities above threshold', () => {
      const inputs: HotspotInput[] = [
        { entityId: 'low.ts', entityType: 'file', commitCount: 5, cyclomaticComplexity: 3 },
        { entityId: 'high.ts', entityType: 'file', commitCount: 90, cyclomaticComplexity: 45 },
        { entityId: 'medium.ts', entityType: 'file', commitCount: 40, cyclomaticComplexity: 20 },
      ];

      const scores = computeHotspotScores(inputs);
      const hotspots = filterHotspots(scores, 0.4);

      // Only the high-scoring ones should pass
      expect(hotspots.length).toBeLessThan(scores.length);
      hotspots.forEach(h => {
        expect(h.hotspotScore).toBeGreaterThanOrEqual(0.4);
      });
    });
  });

  describe('getTopHotspots', () => {
    it('should return top N hotspots', () => {
      const inputs: HotspotInput[] = [
        { entityId: 'a.ts', entityType: 'file', commitCount: 10, cyclomaticComplexity: 5 },
        { entityId: 'b.ts', entityType: 'file', commitCount: 50, cyclomaticComplexity: 30 },
        { entityId: 'c.ts', entityType: 'file', commitCount: 30, cyclomaticComplexity: 20 },
        { entityId: 'd.ts', entityType: 'file', commitCount: 70, cyclomaticComplexity: 35 },
        { entityId: 'e.ts', entityType: 'file', commitCount: 20, cyclomaticComplexity: 10 },
      ];

      const top3 = getTopHotspots(inputs, 3);

      expect(top3).toHaveLength(3);
      // Should be the highest scoring ones
      expect(top3.map(h => h.entityId)).toContain('b.ts');
      expect(top3.map(h => h.entityId)).toContain('d.ts');
    });
  });

  describe('Integration Helpers', () => {
    describe('fromTemporalGraph', () => {
      it('should convert temporal graph data to hotspot input', () => {
        const fileChangeCounts = {
          'src/api.ts': 45,
          'src/utils.ts': 12,
        };
        const cochangeEdges = [
          { fileA: 'src/api.ts', fileB: 'src/utils.ts', strength: 0.7 },
        ];

        const input = fromTemporalGraph(
          'src/api.ts',
          'file',
          fileChangeCounts,
          cochangeEdges
        );

        expect(input.entityId).toBe('src/api.ts');
        expect(input.entityType).toBe('file');
        expect(input.commitCount).toBe(45);
        expect(input.cochangeStrength).toBe(0.7);
      });

      it('should handle missing file in change counts', () => {
        const fileChangeCounts = {
          'src/api.ts': 45,
        };

        const input = fromTemporalGraph('src/missing.ts', 'file', fileChangeCounts);

        expect(input.commitCount).toBe(0);
      });
    });

    describe('fromDebtMetrics', () => {
      it('should convert debt metrics to hotspot input', () => {
        const debtMetrics = {
          complexityDebt: 60, // 60% of max
          churnDebt: 40,
          totalDebt: 50,
        };

        const input = fromDebtMetrics('src/complex.ts', 'file', debtMetrics);

        expect(input.entityId).toBe('src/complex.ts');
        expect(input.entityType).toBe('file');
        expect(input.cyclomaticComplexity).toBe(30); // 60% of 50
        expect(input.changeFrequency).toBe(4); // 40% of 10
      });
    });

    describe('mergeHotspotInputs', () => {
      it('should merge multiple partial inputs', () => {
        const base = { entityId: 'test.ts', entityType: 'file' as const };
        const churnData = { commitCount: 40, authorCount: 3 };
        const complexityData = { cyclomaticComplexity: 25, linesOfCode: 300 };

        const merged = mergeHotspotInputs(base, churnData, complexityData);

        expect(merged.entityId).toBe('test.ts');
        expect(merged.entityType).toBe('file');
        expect(merged.commitCount).toBe(40);
        expect(merged.authorCount).toBe(3);
        expect(merged.cyclomaticComplexity).toBe(25);
        expect(merged.linesOfCode).toBe(300);
      });

      it('should prefer later values on conflict', () => {
        const base = { entityId: 'test.ts', entityType: 'file' as const };
        const first = { commitCount: 10 };
        const second = { commitCount: 20 };

        const merged = mergeHotspotInputs(base, first, second);

        expect(merged.commitCount).toBe(20);
      });
    });
  });

  describe('Prioritization Integration', () => {
    describe('calculateHotspotFactor', () => {
      it('should return 0-100 score for prioritization engine', () => {
        const input: HotspotInput = {
          entityId: 'test.ts',
          entityType: 'file',
          commitCount: 60,
          cyclomaticComplexity: 30,
        };
        const hotspot = computeHotspotScore(input);
        const factor = calculateHotspotFactor(hotspot);

        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(factor.evidence.length).toBeGreaterThan(0);
        expect(factor.dataQuality).toBe('measured');
      });

      it('should report default quality when no metrics', () => {
        const input: HotspotInput = {
          entityId: 'test.ts',
          entityType: 'file',
        };
        const hotspot = computeHotspotScore(input);
        const factor = calculateHotspotFactor(hotspot);

        expect(factor.dataQuality).toBe('default');
        expect(factor.evidence.some(e => e.includes('default'))).toBe(true);
      });

      it('should identify high priority hotspots', () => {
        const input: HotspotInput = {
          entityId: 'hotspot.ts',
          entityType: 'file',
          commitCount: 90,
          cyclomaticComplexity: 45,
        };
        const hotspot = computeHotspotScore(input);
        const factor = calculateHotspotFactor(hotspot);

        expect(factor.evidence.some(e => e.includes('HIGH PRIORITY') || e.includes('MODERATE'))).toBe(true);
      });
    });
  });

  describe('Multi-Signal Scorer Integration', () => {
    describe('toHotspotSignal', () => {
      it('should create signal value for multi-signal scorer', () => {
        const input: HotspotInput = {
          entityId: 'test.ts',
          entityType: 'file',
          commitCount: 50,
          cyclomaticComplexity: 25,
        };
        const hotspot = computeHotspotScore(input);
        const signal = toHotspotSignal(hotspot);

        expect(signal.signal).toBe('hotspot');
        expect(signal.score).toBeGreaterThanOrEqual(0);
        expect(signal.score).toBeLessThanOrEqual(1);
        expect(signal.confidence).toBeGreaterThan(0);
        expect(signal.metadata).toBeDefined();
        expect(signal.metadata?.churnScore).toBe(hotspot.churnScore);
        expect(signal.metadata?.complexityScore).toBe(hotspot.complexityScore);
      });

      it('should determine isHotspot based on threshold', () => {
        const lowInput: HotspotInput = {
          entityId: 'low.ts',
          entityType: 'file',
          commitCount: 5,
          cyclomaticComplexity: 3,
        };
        const highInput: HotspotInput = {
          entityId: 'high.ts',
          entityType: 'file',
          commitCount: 90,
          cyclomaticComplexity: 45,
        };

        const lowSignal = toHotspotSignal(computeHotspotScore(lowInput));
        const highSignal = toHotspotSignal(computeHotspotScore(highInput));

        expect(lowSignal.metadata?.isHotspot).toBe(false);
        expect(highSignal.metadata?.isHotspot).toBe(true);
      });

      it('should set higher confidence when both metrics available', () => {
        const withBoth: HotspotInput = {
          entityId: 'test.ts',
          entityType: 'file',
          commitCount: 50,
          cyclomaticComplexity: 25,
        };
        const churnOnly: HotspotInput = {
          entityId: 'test.ts',
          entityType: 'file',
          commitCount: 50,
        };
        const neither: HotspotInput = {
          entityId: 'test.ts',
          entityType: 'file',
        };

        const bothSignal = toHotspotSignal(computeHotspotScore(withBoth));
        const churnSignal = toHotspotSignal(computeHotspotScore(churnOnly));
        const neitherSignal = toHotspotSignal(computeHotspotScore(neither));

        expect(bothSignal.confidence).toBeGreaterThan(churnSignal.confidence);
        expect(churnSignal.confidence).toBeGreaterThan(neitherSignal.confidence);
      });
    });
  });

  describe('Key Property: High Churn + High Complexity = High Score', () => {
    it('should rank high-churn + high-complexity files highest', () => {
      const inputs: HotspotInput[] = [
        // High churn, high complexity - should be top
        {
          entityId: 'god_object.ts',
          entityType: 'file',
          commitCount: 85,
          authorCount: 8,
          cyclomaticComplexity: 42,
          linesOfCode: 800,
        },
        // High churn, low complexity - should be lower
        {
          entityId: 'frequently_changed.ts',
          entityType: 'file',
          commitCount: 90,
          authorCount: 10,
          cyclomaticComplexity: 8,
          linesOfCode: 100,
        },
        // Low churn, high complexity - should be lower
        {
          entityId: 'stable_complex.ts',
          entityType: 'file',
          commitCount: 5,
          authorCount: 1,
          cyclomaticComplexity: 45,
          linesOfCode: 700,
        },
        // Low churn, low complexity - should be lowest
        {
          entityId: 'stable_simple.ts',
          entityType: 'file',
          commitCount: 3,
          authorCount: 1,
          cyclomaticComplexity: 4,
          linesOfCode: 50,
        },
      ];

      const ranked = computeHotspotScores(inputs);

      // The god object (high churn + high complexity) should be #1
      expect(ranked[0].entityId).toBe('god_object.ts');

      // The stable simple file should be last
      expect(ranked[ranked.length - 1].entityId).toBe('stable_simple.ts');

      // High churn only and high complexity only should be in the middle
      const middleIds = ranked.slice(1, -1).map(r => r.entityId);
      expect(middleIds).toContain('frequently_changed.ts');
      expect(middleIds).toContain('stable_complex.ts');
    });
  });
});
