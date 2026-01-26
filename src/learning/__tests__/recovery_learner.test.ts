/**
 * @fileoverview Tests for Recovery Learner
 *
 * Comprehensive tests for Thompson Sampling-based strategy learning.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RecoveryLearner,
  createRecoveryLearner,
  type RecoveryOutcome,
} from '../recovery_learner.js';

// ============================================================================
// HELPERS
// ============================================================================

function recordOutcomes(
  learner: RecoveryLearner,
  strategy: string,
  degradationType: string,
  successRate: number,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    learner.recordOutcome({
      strategy,
      degradationType,
      success: Math.random() < successRate,
      fitnessDelta: successRate > 0.5 ? 0.05 : -0.02,
    });
  }
}

function countSelections(
  learner: RecoveryLearner,
  degradationType: string,
  strategies: string[],
  iterations: number
): Map<string, number> {
  const selections = new Map<string, number>();
  for (const s of strategies) {
    selections.set(s, 0);
  }

  for (let i = 0; i < iterations; i++) {
    const selected = learner.selectStrategy(degradationType, strategies);
    selections.set(selected, (selections.get(selected) || 0) + 1);
  }

  return selections;
}

// ============================================================================
// TESTS
// ============================================================================

describe('RecoveryLearner', () => {
  let learner: RecoveryLearner;

  beforeEach(() => {
    learner = createRecoveryLearner();
  });

  describe('basic functionality', () => {
    it('creates a new learner', () => {
      expect(learner).toBeDefined();
    });

    it('records outcomes correctly', () => {
      learner.recordOutcome({
        strategy: 'strategy_a',
        degradationType: 'low_confidence',
        success: true,
        fitnessDelta: 0.05,
      });

      const stats = learner.getStrategyStats('strategy_a', 'low_confidence');
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(0);
      expect(stats.totalTrials).toBe(1);
      expect(stats.meanFitnessDelta).toBe(0.05);
    });

    it('tracks both successes and failures', () => {
      learner.recordOutcome({
        strategy: 'test',
        degradationType: 'test_type',
        success: true,
        fitnessDelta: 0.1,
      });
      learner.recordOutcome({
        strategy: 'test',
        degradationType: 'test_type',
        success: false,
        fitnessDelta: -0.05,
      });

      const stats = learner.getStrategyStats('test', 'test_type');
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(1);
      expect(stats.totalTrials).toBe(2);
    });
  });

  describe('strategy selection', () => {
    it('selects from available strategies', () => {
      const strategies = ['strategy_a', 'strategy_b', 'strategy_c'];
      const selected = learner.selectStrategy('test_type', strategies);
      expect(strategies).toContain(selected);
    });

    it('returns single strategy when only one available', () => {
      const selected = learner.selectStrategy('test_type', ['only_one']);
      expect(selected).toBe('only_one');
    });

    it('throws error when no strategies available', () => {
      expect(() => learner.selectStrategy('test_type', [])).toThrow(
        'No strategies available'
      );
    });
  });

  describe('Thompson Sampling convergence', () => {
    it('converges to best strategy over time', () => {
      const strategies = ['strategy_a', 'strategy_b'];

      // Strategy A: 80% success rate
      for (let i = 0; i < 50; i++) {
        learner.recordOutcome({
          strategy: 'strategy_a',
          degradationType: 'test_type',
          success: i < 40, // 80%
          fitnessDelta: i < 40 ? 0.05 : -0.02,
        });
      }

      // Strategy B: 30% success rate
      for (let i = 0; i < 50; i++) {
        learner.recordOutcome({
          strategy: 'strategy_b',
          degradationType: 'test_type',
          success: i < 15, // 30%
          fitnessDelta: i < 15 ? 0.05 : -0.02,
        });
      }

      // After learning, should strongly prefer strategy A
      const selections = countSelections(learner, 'test_type', strategies, 100);

      expect(selections.get('strategy_a')!).toBeGreaterThan(60);
      expect(selections.get('strategy_b')!).toBeLessThan(40);
    });

    it('maintains exploration even after convergence', () => {
      // Train moderately on one strategy (not too heavily to allow exploration)
      for (let i = 0; i < 30; i++) {
        learner.recordOutcome({
          strategy: 'proven_winner',
          degradationType: 'test',
          success: true,
          fitnessDelta: 0.1,
        });
      }

      // Should still occasionally explore due to Thompson sampling variance
      const selections = countSelections(
        learner,
        'test',
        ['proven_winner', 'untried'],
        200 // More samples to increase chance of exploration
      );

      // Untried strategy should be selected at least sometimes
      // Thompson sampling naturally explores due to sampling variance
      // With 200 trials, even low-probability events should occur
      expect(selections.get('untried')!).toBeGreaterThanOrEqual(1);
    });
  });

  describe('success probability estimation', () => {
    it('computes accurate success probability estimates', () => {
      // Record known outcomes: 70 successes, 30 failures
      for (let i = 0; i < 70; i++) {
        learner.recordOutcome({
          strategy: 'strategy_70',
          degradationType: 'test',
          success: true,
          fitnessDelta: 0.02,
        });
      }
      for (let i = 0; i < 30; i++) {
        learner.recordOutcome({
          strategy: 'strategy_70',
          degradationType: 'test',
          success: false,
          fitnessDelta: -0.01,
        });
      }

      const estimate = learner.getSuccessProbability('strategy_70', 'test');
      // With prior of (1,1) and 70/30 observations, posterior is (71, 31)
      // Expected: 71/102 ≈ 0.696
      expect(estimate).toBeGreaterThan(0.65);
      expect(estimate).toBeLessThan(0.75);
    });

    it('returns prior estimate for unknown strategies', () => {
      const estimate = learner.getSuccessProbability('never_tried', 'unknown_type');
      // Prior is (1,1), so mean is 0.5
      expect(estimate).toBeCloseTo(0.5, 1);
    });
  });

  describe('confidence intervals', () => {
    it('computes confidence interval', () => {
      // Add some data
      for (let i = 0; i < 50; i++) {
        learner.recordOutcome({
          strategy: 'test_strategy',
          degradationType: 'test',
          success: i < 35, // 70% success
          fitnessDelta: 0.01,
        });
      }

      const ci = learner.getConfidenceInterval('test_strategy', 'test');
      expect(ci.lower).toBeLessThan(ci.upper);
      expect(ci.lower).toBeGreaterThan(0);
      expect(ci.upper).toBeLessThan(1);
    });

    it('returns wide interval for unknown strategies', () => {
      const ci = learner.getConfidenceInterval('unknown', 'unknown');
      // Prior (1,1) should have wide interval
      expect(ci.upper - ci.lower).toBeGreaterThan(0.5);
    });

    it('narrows interval with more data', () => {
      const ciInitial = learner.getConfidenceInterval('strategy', 'type');
      const widthInitial = ciInitial.upper - ciInitial.lower;

      // Add lots of data
      for (let i = 0; i < 100; i++) {
        learner.recordOutcome({
          strategy: 'strategy',
          degradationType: 'type',
          success: i < 60,
          fitnessDelta: 0.01,
        });
      }

      const ciFinal = learner.getConfidenceInterval('strategy', 'type');
      const widthFinal = ciFinal.upper - ciFinal.lower;

      expect(widthFinal).toBeLessThan(widthInitial);
    });
  });

  describe('anti-pattern detection', () => {
    it('identifies consistently failing strategies', () => {
      // Record many failures for bad_strategy (>80% failure rate)
      for (let i = 0; i < 20; i++) {
        learner.recordOutcome({
          strategy: 'bad_strategy',
          degradationType: 'test_type',
          success: i < 2, // Only 10% success
          fitnessDelta: -0.05,
        });
      }

      const antiPatterns = learner.getAntiPatterns();
      const badPattern = antiPatterns.find(
        (ap) =>
          ap.strategy === 'bad_strategy' && ap.degradationType === 'test_type'
      );

      expect(badPattern).toBeDefined();
      expect(badPattern!.recommendation).toBe('avoid');
      expect(badPattern!.failureRate).toBeGreaterThan(0.8);
    });

    it('does not flag successful strategies as anti-patterns', () => {
      // Record many successes
      for (let i = 0; i < 20; i++) {
        learner.recordOutcome({
          strategy: 'good_strategy',
          degradationType: 'test_type',
          success: i < 18, // 90% success
          fitnessDelta: 0.05,
        });
      }

      const antiPatterns = learner.getAntiPatterns();
      const goodPattern = antiPatterns.find(
        (ap) => ap.strategy === 'good_strategy'
      );

      expect(goodPattern).toBeUndefined();
    });

    it('requires minimum samples before flagging', () => {
      // Record few failures (below threshold)
      for (let i = 0; i < 5; i++) {
        learner.recordOutcome({
          strategy: 'new_strategy',
          degradationType: 'test_type',
          success: false,
          fitnessDelta: -0.05,
        });
      }

      const antiPatterns = learner.getAntiPatterns();
      const pattern = antiPatterns.find(
        (ap) => ap.strategy === 'new_strategy'
      );

      // Should not flag with only 5 samples (min is 10)
      expect(pattern).toBeUndefined();
    });

    it('deprioritizes anti-patterns in selection', () => {
      // Mark strategy as anti-pattern
      for (let i = 0; i < 30; i++) {
        learner.recordOutcome({
          strategy: 'always_fails',
          degradationType: 'specific_issue',
          success: false,
          fitnessDelta: -0.1,
        });
      }

      // Selection should almost never pick anti-pattern
      const strategies = ['always_fails', 'unknown_strategy'];
      const selections = countSelections(
        learner,
        'specific_issue',
        strategies,
        50
      );

      const antiPatternCount = selections.get('always_fails') || 0;
      expect(antiPatternCount).toBeLessThan(10); // Very rare selection
    });
  });

  describe('fitness delta tracking', () => {
    it('tracks mean fitness improvement per strategy', () => {
      // Strategy A gives +5% fitness on average
      for (let i = 0; i < 50; i++) {
        learner.recordOutcome({
          strategy: 'strategy_a',
          degradationType: 'test',
          success: true,
          fitnessDelta: 0.04 + Math.random() * 0.02, // 4-6%
        });
      }

      // Strategy B gives +1% fitness on average
      for (let i = 0; i < 50; i++) {
        learner.recordOutcome({
          strategy: 'strategy_b',
          degradationType: 'test',
          success: true,
          fitnessDelta: 0.005 + Math.random() * 0.01, // 0.5-1.5%
        });
      }

      const statsA = learner.getStrategyStats('strategy_a', 'test');
      const statsB = learner.getStrategyStats('strategy_b', 'test');

      expect(statsA.meanFitnessDelta).toBeGreaterThan(statsB.meanFitnessDelta);
      expect(statsA.meanFitnessDelta).toBeGreaterThan(0.03);
      expect(statsB.meanFitnessDelta).toBeLessThan(0.02);
    });
  });

  describe('persistence', () => {
    it('serializes state correctly', () => {
      // Record some outcomes
      learner.recordOutcome({
        strategy: 'test_strategy',
        degradationType: 'test_type',
        success: true,
        fitnessDelta: 0.05,
      });

      const state = learner.serialize();

      expect(state.version).toBe(1);
      expect(state.stats).toBeDefined();
      expect(Object.keys(state.stats)).toHaveLength(1);
      expect(state.createdAt).toBeDefined();
      expect(state.updatedAt).toBeDefined();
    });

    it('deserializes state correctly', () => {
      // Record outcomes
      for (let i = 0; i < 30; i++) {
        learner.recordOutcome({
          strategy: 'good_strategy',
          degradationType: 'test',
          success: i < 22, // ~73% success
          fitnessDelta: 0.03,
        });
      }

      // Save state
      const savedState = learner.serialize();

      // Create new learner and restore
      const restoredLearner = createRecoveryLearner();
      restoredLearner.deserialize(savedState);

      // Verify stats match
      const originalStats = learner.getStrategyStats('good_strategy', 'test');
      const restoredStats = restoredLearner.getStrategyStats(
        'good_strategy',
        'test'
      );

      expect(restoredStats.successes).toBe(originalStats.successes);
      expect(restoredStats.failures).toBe(originalStats.failures);
      expect(restoredStats.totalTrials).toBe(originalStats.totalTrials);
    });

    it('preserves selection behavior after restore', () => {
      // Train learner
      for (let i = 0; i < 50; i++) {
        learner.recordOutcome({
          strategy: 'good',
          degradationType: 'test',
          success: i < 40,
          fitnessDelta: 0.05,
        });
        learner.recordOutcome({
          strategy: 'bad',
          degradationType: 'test',
          success: i < 10,
          fitnessDelta: -0.02,
        });
      }

      // Save and restore
      const savedState = learner.serialize();
      const restoredLearner = createRecoveryLearner();
      restoredLearner.deserialize(savedState);

      // Both should prefer 'good'
      const originalSelections = countSelections(
        learner,
        'test',
        ['good', 'bad'],
        50
      );
      const restoredSelections = countSelections(
        restoredLearner,
        'test',
        ['good', 'bad'],
        50
      );

      // Both should prefer good strategy
      expect(originalSelections.get('good')!).toBeGreaterThan(25);
      expect(restoredSelections.get('good')!).toBeGreaterThan(25);
    });
  });

  describe('summary statistics', () => {
    it('computes summary correctly', () => {
      // Add outcomes for multiple strategies and types
      recordOutcomes(learner, 'strategy_a', 'type_1', 0.8, 20);
      recordOutcomes(learner, 'strategy_b', 'type_1', 0.4, 15);
      recordOutcomes(learner, 'strategy_c', 'type_2', 0.6, 25);

      const summary = learner.getSummary();

      expect(summary.totalStrategies).toBe(3);
      expect(summary.totalOutcomes).toBe(60);
      expect(summary.overallSuccessRate).toBeGreaterThan(0);
      expect(summary.byDegradationType).toHaveProperty('type_1');
      expect(summary.byDegradationType).toHaveProperty('type_2');
      expect(summary.byDegradationType['type_1'].strategies).toBe(2);
      expect(summary.byDegradationType['type_2'].strategies).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all learned data', () => {
      // Add some data
      recordOutcomes(learner, 'strategy', 'type', 0.7, 30);

      expect(learner.getSummary().totalOutcomes).toBe(30);

      learner.reset();

      expect(learner.getSummary().totalOutcomes).toBe(0);
      expect(learner.getSummary().totalStrategies).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles negative fitness deltas', () => {
      learner.recordOutcome({
        strategy: 'harmful',
        degradationType: 'test',
        success: false,
        fitnessDelta: -0.2,
      });

      const stats = learner.getStrategyStats('harmful', 'test');
      expect(stats.meanFitnessDelta).toBe(-0.2);
    });

    it('handles zero fitness deltas', () => {
      learner.recordOutcome({
        strategy: 'neutral',
        degradationType: 'test',
        success: true,
        fitnessDelta: 0,
      });

      const stats = learner.getStrategyStats('neutral', 'test');
      expect(stats.meanFitnessDelta).toBe(0);
    });

    it('handles strategies with special characters', () => {
      learner.recordOutcome({
        strategy: 'strategy:with::colons',
        degradationType: 'type::with::colons',
        success: true,
        fitnessDelta: 0.1,
      });

      // Should handle correctly despite :: being the separator
      const stats = learner.getStrategyStats(
        'strategy:with::colons',
        'type::with::colons'
      );
      expect(stats.successes).toBe(1);
    });
  });
});
