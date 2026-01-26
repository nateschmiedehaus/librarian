/**
 * @fileoverview Multi-Component Reward Signal for Evolution
 *
 * Solves the problem where baseline fitness of 0% gives emitters 0 reward
 * regardless of improvement. Provides meaningful gradient signal even from
 * zero baseline through multiple reward components.
 *
 * Reward Components:
 * - Fitness improvement (60%): Primary signal for actual improvement
 * - Novelty bonus (20%): Encourages exploration of new behavior space
 * - Coverage bonus (10%): Rewards filling empty archive cells
 * - Cost efficiency (10%): Penalizes wasteful resource usage
 */

import { logDebug } from '../telemetry/logger.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Resource usage for cost efficiency calculation
 */
export interface ResourceUsage {
  /** Tokens consumed */
  tokens: number;
  /** Time in milliseconds */
  time: number;
}

/**
 * Input for computing reward
 */
export interface RewardInput {
  /** Fitness before the action */
  fitnessBefore: number;
  /** Fitness after the action */
  fitnessAfter: number;
  /** Novelty score from behavior descriptor distance */
  novelty?: number;
  /** Behavior descriptor for novelty calculation */
  behaviorDescriptor?: number[];
  /** Coverage contribution (0-1) */
  coverageContribution?: number;
  /** Resources used */
  resourcesUsed: ResourceUsage;
}

/**
 * Detailed reward breakdown
 */
export interface RewardResult {
  /** Total combined reward */
  total: number;
  /** Breakdown by component */
  components: {
    /** Fitness improvement component (clamped to ≥0) */
    fitnessImprovement: number;
    /** Novelty bonus component */
    novelty: number;
    /** Coverage bonus component */
    coverage: number;
    /** Efficiency bonus component */
    efficiency: number;
  };
  /** Raw fitness delta (can be negative) */
  rawFitnessDelta: number;
}

/**
 * Configuration for reward calculation
 */
export interface RewardConfig {
  /** Weight for fitness improvement (default: 0.6) */
  fitnessWeight: number;
  /** Weight for novelty bonus (default: 0.2) */
  noveltyWeight: number;
  /** Weight for coverage bonus (default: 0.1) */
  coverageWeight: number;
  /** Weight for efficiency bonus (default: 0.1) */
  efficiencyWeight: number;
  /** Expected average token usage for normalization */
  expectedTokens: number;
  /** Expected average time usage for normalization */
  expectedTime: number;
}

/**
 * Population member for novelty calculation
 */
export interface PopulationMember {
  behavior: number[];
}

/**
 * Archive interface for novelty and coverage calculation
 */
export interface Archive {
  /** Get population for k-nearest neighbor novelty calculation */
  getPopulation(): PopulationMember[];
  /** Check if a cell is empty */
  isCellEmpty?(behavior: number[]): boolean;
  /** Get empty cell indices */
  getEmptyCells?(): number[][];
}

/**
 * Emitter reward input (convenience type)
 */
export interface EmitterRewardInput {
  /** The emitter being evaluated */
  emitter: unknown;
  /** Offspring produced */
  offspring: {
    fitness: number;
    behavior: number[];
  };
  /** Parent individual */
  parent: {
    fitness: number;
    behavior: number[];
  };
  /** Resources used */
  resourcesUsed?: ResourceUsage;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: RewardConfig = {
  fitnessWeight: 0.6,
  noveltyWeight: 0.2,
  coverageWeight: 0.1,
  efficiencyWeight: 0.1,
  expectedTokens: 1000,
  expectedTime: 5000,
};

/** Number of neighbors for k-nearest novelty calculation */
const K_NEIGHBORS = 5;

// ============================================================================
// REWARD SIGNAL CALCULATOR
// ============================================================================

/**
 * Calculates multi-component reward signals for evolution.
 *
 * Solves the zero-baseline problem by providing positive reward
 * for novelty, coverage, and efficiency even when fitness doesn't improve.
 */
export class RewardSignalCalculator {
  private readonly config: RewardConfig;
  private readonly archive: Archive | null;
  private historicalUsage: ResourceUsage[] = [];

  constructor(options?: { archive?: Archive; config?: Partial<RewardConfig> }) {
    this.archive = options?.archive ?? null;
    this.config = { ...DEFAULT_CONFIG, ...options?.config };
  }

  /**
   * Compute multi-component reward
   */
  compute(input: RewardInput): RewardResult {
    // 1. Fitness improvement component (clamped to >= 0)
    const rawFitnessDelta = input.fitnessAfter - input.fitnessBefore;
    const fitnessImprovement = Math.max(0, rawFitnessDelta);
    const fitnessComponent = fitnessImprovement * this.config.fitnessWeight;

    // 2. Novelty component
    let noveltyComponent = 0;
    if (input.novelty !== undefined) {
      noveltyComponent = input.novelty * this.config.noveltyWeight;
    } else if (input.behaviorDescriptor && this.archive) {
      const novelty = this.computeNovelty(input.behaviorDescriptor);
      noveltyComponent = novelty * this.config.noveltyWeight;
    }

    // 3. Coverage component
    let coverageComponent = 0;
    if (input.coverageContribution !== undefined) {
      coverageComponent = input.coverageContribution * this.config.coverageWeight;
    } else if (input.behaviorDescriptor && this.archive?.isCellEmpty) {
      const fillsEmpty = this.archive.isCellEmpty(input.behaviorDescriptor);
      coverageComponent = (fillsEmpty ? 1 : 0) * this.config.coverageWeight;
    }

    // 4. Efficiency component
    const efficiency = this.computeEfficiency(input.resourcesUsed);
    const efficiencyComponent = efficiency * this.config.efficiencyWeight;

    // Total reward
    const total =
      fitnessComponent + noveltyComponent + coverageComponent + efficiencyComponent;

    const result: RewardResult = {
      total,
      components: {
        fitnessImprovement: fitnessComponent,
        novelty: noveltyComponent,
        coverage: coverageComponent,
        efficiency: efficiencyComponent,
      },
      rawFitnessDelta,
    };

    logDebug('[reward] Computed reward', {
      total: result.total,
      fitnessImprovement: fitnessComponent,
      novelty: noveltyComponent,
      coverage: coverageComponent,
      efficiency: efficiencyComponent,
    });

    return result;
  }

  /**
   * Compute reward for an emitter (convenience method)
   */
  computeForEmitter(input: EmitterRewardInput): RewardResult {
    return this.compute({
      fitnessBefore: input.parent.fitness,
      fitnessAfter: input.offspring.fitness,
      behaviorDescriptor: input.offspring.behavior,
      resourcesUsed: input.resourcesUsed ?? { tokens: 500, time: 2000 },
    });
  }

  /**
   * Compute novelty as mean distance to k-nearest neighbors
   */
  private computeNovelty(behavior: number[]): number {
    if (!this.archive) return 0;

    // Handle empty behavior descriptor
    if (behavior.length === 0) return 0;

    const population = this.archive.getPopulation();
    if (population.length === 0) return 1; // Everything is novel in empty archive

    // Filter population members with matching dimensions
    const validPopulation = population.filter(
      (member) => member.behavior.length === behavior.length
    );
    if (validPopulation.length === 0) return 0.5; // Neutral novelty for incompatible dimensions

    // Compute distances to all valid population members
    const distances = validPopulation.map((member) =>
      this.euclideanDistance(behavior, member.behavior)
    );

    // Sort and take k nearest
    distances.sort((a, b) => a - b);
    const kNearest = distances.slice(0, Math.min(K_NEIGHBORS, distances.length));

    // Mean distance (normalized to [0, 1] assuming behavior space is [0, 1]^n)
    if (kNearest.length === 0) return 0;
    const meanDistance = kNearest.reduce((sum, d) => sum + d, 0) / kNearest.length;

    // Normalize by dimension (max possible distance in unit hypercube)
    const maxDistance = Math.sqrt(behavior.length);
    if (maxDistance === 0) return 0;

    return Math.min(1, meanDistance / maxDistance);
  }

  /**
   * Compute efficiency based on resource usage
   */
  private computeEfficiency(usage: ResourceUsage): number {
    // Compute expected values from history or defaults
    const expectedTokens =
      this.historicalUsage.length > 0
        ? this.getHistoricalMean('tokens')
        : this.config.expectedTokens;
    const expectedTime =
      this.historicalUsage.length > 0
        ? this.getHistoricalMean('time')
        : this.config.expectedTime;

    // Efficiency is higher when usage is below expected
    const tokenEfficiency = expectedTokens / Math.max(usage.tokens, 1);
    const timeEfficiency = expectedTime / Math.max(usage.time, 1);

    // Combined efficiency, clamped to [0, 1]
    // Using sigmoid-like transformation to avoid extreme values
    const rawEfficiency = (tokenEfficiency + timeEfficiency) / 2;

    return Math.min(1, 1 / (1 + Math.exp(-2 * (rawEfficiency - 1))));
  }

  /**
   * Record historical resource usage for normalization
   */
  recordHistoricalUsage(usage: ResourceUsage): void {
    this.historicalUsage.push(usage);

    // Keep only last 100 samples
    if (this.historicalUsage.length > 100) {
      this.historicalUsage.shift();
    }
  }

  /**
   * Get historical mean for a resource type
   */
  private getHistoricalMean(field: keyof ResourceUsage): number {
    if (this.historicalUsage.length === 0) {
      return field === 'tokens'
        ? this.config.expectedTokens
        : this.config.expectedTime;
    }

    const sum = this.historicalUsage.reduce((acc, u) => acc + u[field], 0);
    return sum / this.historicalUsage.length;
  }

  /**
   * Euclidean distance between two vectors
   */
  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return Infinity;
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<RewardConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a reward signal calculator
 */
export function createRewardSignalCalculator(
  options?: { archive?: Archive; config?: Partial<RewardConfig> }
): RewardSignalCalculator {
  return new RewardSignalCalculator(options);
}
