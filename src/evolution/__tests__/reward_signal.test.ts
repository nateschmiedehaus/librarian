/**
 * @fileoverview Tests for Reward Signal Calculator
 *
 * Tests the multi-component reward system that provides meaningful
 * gradient signal even when baseline fitness is zero.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RewardSignalCalculator,
  createRewardSignalCalculator,
  type Archive,
  type PopulationMember,
} from '../reward_signal.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

class TestArchive implements Archive {
  private population: PopulationMember[] = [];
  private emptyCells: number[][] = [];

  setPopulation(members: PopulationMember[]): void {
    this.population = members;
  }

  setEmptyCells(cells: number[][]): void {
    this.emptyCells = cells;
  }

  getPopulation(): PopulationMember[] {
    return this.population;
  }

  isCellEmpty(behavior: number[]): boolean {
    // Simple cell mapping: floor each dimension to nearest 0.1
    const cell = behavior.map((b) => Math.floor(b * 10) / 10);

    for (const emptyCell of this.emptyCells) {
      if (
        emptyCell.length === cell.length &&
        emptyCell.every((v, i) => Math.abs(v - cell[i]) < 0.05)
      ) {
        return true;
      }
    }
    return false;
  }

  getEmptyCells(): number[][] {
    return this.emptyCells;
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('RewardSignalCalculator', () => {
  let calculator: RewardSignalCalculator;
  let archive: TestArchive;

  beforeEach(() => {
    archive = new TestArchive();
    calculator = createRewardSignalCalculator({ archive });
  });

  describe('multi-component reward', () => {
    it('computes combined reward correctly', () => {
      const reward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        novelty: 0.5,
        coverageContribution: 0.2,
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      // Verify non-zero reward
      expect(reward.total).toBeGreaterThan(0);

      // Check fitness component: 0.6 * 0.1 = 0.06
      expect(reward.components.fitnessImprovement).toBeCloseTo(0.06, 2);

      // Check novelty component: 0.2 * 0.5 = 0.10
      expect(reward.components.novelty).toBeCloseTo(0.10, 2);

      // Check coverage component: 0.1 * 0.2 = 0.02
      expect(reward.components.coverage).toBeCloseTo(0.02, 2);
    });

    it('all components sum to total', () => {
      const reward = calculator.compute({
        fitnessBefore: 0.2,
        fitnessAfter: 0.35,
        novelty: 0.7,
        coverageContribution: 0.4,
        resourcesUsed: { tokens: 500, time: 2000 },
      });

      const componentSum =
        reward.components.fitnessImprovement +
        reward.components.novelty +
        reward.components.coverage +
        reward.components.efficiency;

      expect(componentSum).toBeCloseTo(reward.total, 4);
    });
  });

  describe('zero baseline handling', () => {
    it('provides meaningful reward even from 0% baseline', () => {
      const reward = calculator.compute({
        fitnessBefore: 0,
        fitnessAfter: 0.05, // Small improvement
        novelty: 0.3,
        coverageContribution: 0.1,
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      expect(reward.total).toBeGreaterThan(0);
      // Fitness component: 0.6 * 0.05 = 0.03
      expect(reward.components.fitnessImprovement).toBeCloseTo(0.03, 2);
    });

    it('distinguishes between no improvement and degradation', () => {
      const noChange = calculator.compute({
        fitnessBefore: 0,
        fitnessAfter: 0,
        novelty: 0.5,
        coverageContribution: 0.2,
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      const degraded = calculator.compute({
        fitnessBefore: 0.1,
        fitnessAfter: 0.05,
        novelty: 0.5,
        coverageContribution: 0.2,
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      // No change gets 0 for fitness component
      expect(noChange.components.fitnessImprovement).toBe(0);

      // Degradation also gets 0 (clamped), not negative
      expect(degraded.components.fitnessImprovement).toBe(0);

      // But raw delta captures the negative value
      expect(degraded.rawFitnessDelta).toBeLessThan(0);
    });

    it('still provides reward from other components when fitness degrades', () => {
      const reward = calculator.compute({
        fitnessBefore: 0.5,
        fitnessAfter: 0.3, // Degraded
        novelty: 0.8, // But novel
        coverageContribution: 0.5, // And good coverage
        resourcesUsed: { tokens: 500, time: 2000 },
      });

      // Total should still be positive due to novelty and coverage
      expect(reward.total).toBeGreaterThan(0);
      expect(reward.components.novelty).toBeGreaterThan(0);
      expect(reward.components.coverage).toBeGreaterThan(0);
    });
  });

  describe('novelty bonus', () => {
    it('rewards exploration of new behavior space', () => {
      archive.setPopulation([
        { behavior: [0.1, 0.2, 0.3] },
        { behavior: [0.15, 0.25, 0.35] },
      ]);

      const novelReward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.3,
        behaviorDescriptor: [0.9, 0.8, 0.7], // Very different
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      const familiarReward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.3,
        behaviorDescriptor: [0.12, 0.22, 0.32], // Similar to archive
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      expect(novelReward.components.novelty).toBeGreaterThan(
        familiarReward.components.novelty
      );
    });

    it('returns high novelty for empty archive', () => {
      archive.setPopulation([]);

      const reward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.3,
        behaviorDescriptor: [0.5, 0.5, 0.5],
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      // Everything is novel in empty archive
      expect(reward.components.novelty).toBeCloseTo(0.2, 1); // 0.2 weight * 1.0 novelty
    });

    it('computes novelty as distance to k-nearest neighbors', () => {
      archive.setPopulation([
        { behavior: [0, 0, 0] },
        { behavior: [1, 1, 1] },
        { behavior: [0.5, 0.5, 0.5] },
      ]);

      const reward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.3,
        behaviorDescriptor: [0.5, 0.5, 0.5], // Exactly matches one
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      // Should have low novelty (matches existing)
      expect(reward.components.novelty).toBeLessThan(0.1);
    });
  });

  describe('coverage bonus', () => {
    it('rewards filling empty archive cells', () => {
      archive.setEmptyCells([
        [0, 0],
        [0, 0.1],
        [0.1, 0],
        [0.1, 0.1],
      ]);

      const fillsEmpty = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.3,
        behaviorDescriptor: [0.05, 0.05], // Maps to empty [0, 0]
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      expect(fillsEmpty.components.coverage).toBeCloseTo(0.1, 2); // 0.1 weight * 1.0
    });

    it('no coverage bonus for already filled cells', () => {
      archive.setEmptyCells([
        [0.5, 0.5], // Only this cell is empty
      ]);

      const noFill = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.3,
        behaviorDescriptor: [0.15, 0.25], // Maps to [0.1, 0.2] - not empty
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      expect(noFill.components.coverage).toBe(0);
    });

    it('accepts explicit coverage contribution', () => {
      const reward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.3,
        coverageContribution: 0.7,
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      expect(reward.components.coverage).toBeCloseTo(0.07, 2); // 0.1 * 0.7
    });
  });

  describe('cost efficiency', () => {
    it('penalizes high resource usage', () => {
      const efficient = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        novelty: 0.5,
        coverageContribution: 0.2,
        resourcesUsed: { tokens: 100, time: 1000 },
      });

      const wasteful = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        novelty: 0.5,
        coverageContribution: 0.2,
        resourcesUsed: { tokens: 10000, time: 60000 },
      });

      expect(efficient.components.efficiency).toBeGreaterThan(
        wasteful.components.efficiency
      );
    });

    it('normalizes cost based on historical distribution', () => {
      // Record historical resource usage
      calculator.recordHistoricalUsage({ tokens: 500, time: 3000 });
      calculator.recordHistoricalUsage({ tokens: 600, time: 3500 });
      calculator.recordHistoricalUsage({ tokens: 550, time: 3200 });

      const belowAvg = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        novelty: 0.5,
        resourcesUsed: { tokens: 300, time: 2000 }, // Below avg
      });

      const aboveAvg = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        novelty: 0.5,
        resourcesUsed: { tokens: 900, time: 5000 }, // Above avg
      });

      expect(belowAvg.components.efficiency).toBeGreaterThan(
        aboveAvg.components.efficiency
      );
    });
  });

  describe('emitter integration', () => {
    it('provides gradient signal to emitter optimization', () => {
      const reward1 = calculator.computeForEmitter({
        emitter: {},
        offspring: { fitness: 0.1, behavior: [0.5, 0.5] },
        parent: { fitness: 0.05, behavior: [0.4, 0.4] },
      });

      const reward2 = calculator.computeForEmitter({
        emitter: {},
        offspring: { fitness: 0.15, behavior: [0.6, 0.5] },
        parent: { fitness: 0.1, behavior: [0.5, 0.5] },
      });

      // Both should be positive (improvement happened)
      expect(reward1.total).toBeGreaterThan(0);
      expect(reward2.total).toBeGreaterThan(0);
    });

    it('works without archive', () => {
      const calcNoArchive = createRewardSignalCalculator();

      const reward = calcNoArchive.computeForEmitter({
        emitter: {},
        offspring: { fitness: 0.2, behavior: [0.5, 0.5] },
        parent: { fitness: 0.1, behavior: [0.4, 0.4] },
        resourcesUsed: { tokens: 500, time: 2000 },
      });

      expect(reward.total).toBeGreaterThan(0);
      // Novelty should be 0 without archive
      expect(reward.components.novelty).toBe(0);
    });
  });

  describe('configuration', () => {
    it('uses custom weights', () => {
      const customCalc = createRewardSignalCalculator({
        config: {
          fitnessWeight: 0.9,
          noveltyWeight: 0.05,
          coverageWeight: 0.025,
          efficiencyWeight: 0.025,
        },
      });

      const reward = customCalc.compute({
        fitnessBefore: 0.0,
        fitnessAfter: 0.1,
        novelty: 1.0, // Max novelty
        coverageContribution: 1.0, // Max coverage
        resourcesUsed: { tokens: 100, time: 1000 },
      });

      // Fitness should dominate with 0.9 weight
      expect(reward.components.fitnessImprovement).toBeCloseTo(0.09, 2);
      // Novelty much smaller with 0.05 weight
      expect(reward.components.novelty).toBeCloseTo(0.05, 2);
    });

    it('exposes configuration', () => {
      const config = calculator.getConfig();
      expect(config.fitnessWeight).toBe(0.6);
      expect(config.noveltyWeight).toBe(0.2);
      expect(config.coverageWeight).toBe(0.1);
      expect(config.efficiencyWeight).toBe(0.1);
    });
  });

  describe('edge cases', () => {
    it('handles zero resource usage', () => {
      const reward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        novelty: 0.5,
        resourcesUsed: { tokens: 0, time: 0 },
      });

      // Should not crash, efficiency calculation handles zeros
      expect(reward.total).toBeGreaterThan(0);
    });

    it('handles very large fitness improvement', () => {
      const reward = calculator.compute({
        fitnessBefore: 0.0,
        fitnessAfter: 1.0,
        novelty: 0.5,
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      // Fitness component: 0.6 * 1.0 = 0.6
      expect(reward.components.fitnessImprovement).toBeCloseTo(0.6, 2);
    });

    it('handles empty behavior descriptor', () => {
      archive.setPopulation([{ behavior: [] }]);

      const reward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        behaviorDescriptor: [],
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      expect(reward.total).toBeGreaterThan(0);
    });

    it('handles mismatched behavior dimensions', () => {
      archive.setPopulation([{ behavior: [0.1, 0.2, 0.3] }]);

      const reward = calculator.compute({
        fitnessBefore: 0.3,
        fitnessAfter: 0.4,
        behaviorDescriptor: [0.5, 0.5], // Different dimension
        resourcesUsed: { tokens: 1000, time: 5000 },
      });

      // Should handle gracefully
      expect(reward.total).toBeGreaterThan(0);
    });
  });
});
