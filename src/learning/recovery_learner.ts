/**
 * @fileoverview Recovery Learner using Thompson Sampling
 *
 * Learns which recovery strategies work for which failure types using
 * Bayesian inference with Beta distributions. Enables the system to:
 * - Select strategies probabilistically, favoring proven winners
 * - Maintain exploration even after convergence
 * - Identify and avoid anti-patterns (consistently failing strategies)
 * - Track fitness deltas per strategy for outcome measurement
 */

import { logInfo, logDebug } from '../telemetry/logger.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Outcome of a recovery action for learning
 */
export interface RecoveryOutcome {
  /** Strategy that was executed */
  strategy: string;
  /** Type of degradation being addressed */
  degradationType: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Fitness improvement (can be negative) */
  fitnessDelta: number;
  /** Timestamp of the outcome */
  timestamp?: Date;
}

/**
 * Statistics for a (strategy, degradationType) pair
 */
export interface StrategyStats {
  /** Number of successes (alpha - 1 in Beta distribution) */
  successes: number;
  /** Number of failures (beta - 1 in Beta distribution) */
  failures: number;
  /** Mean fitness delta across all outcomes */
  meanFitnessDelta: number;
  /** Sum of fitness deltas (for computing mean) */
  totalFitnessDelta: number;
  /** Total number of trials */
  totalTrials: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Anti-pattern: a strategy that consistently fails for a degradation type
 */
export interface AntiPattern {
  strategy: string;
  degradationType: string;
  failureRate: number;
  sampleSize: number;
  recommendation: 'avoid' | 'caution';
}

/**
 * Confidence interval for success probability
 */
export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

/**
 * Serialized state for persistence
 */
export interface RecoveryLearnerState {
  version: number;
  stats: Record<string, StrategyStats>;
  antiPatterns: AntiPattern[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum samples before anti-pattern detection */
const MIN_SAMPLES_FOR_ANTIPATTERN = 10;

/** Failure rate threshold to flag as anti-pattern */
const ANTIPATTERN_FAILURE_THRESHOLD = 0.8;

/** Failure rate threshold for "caution" recommendation */
const CAUTION_FAILURE_THRESHOLD = 0.6;

/** Beta prior: weakly informative (equivalent to 2 observations) */
const PRIOR_ALPHA = 1;
const PRIOR_BETA = 1;

/** Confidence interval percentile (95%) */
const CI_PERCENTILE = 0.95;

/** Minimum exploration rate (always try untried strategies sometimes) */
const MIN_EXPLORATION_RATE = 0.1;

// ============================================================================
// BETA DISTRIBUTION UTILITIES
// ============================================================================

/**
 * Sample from a Beta distribution using the Jondeau-Rockinger algorithm
 * (simplified gamma ratio method)
 */
function sampleBeta(alpha: number, beta: number): number {
  // Use approximation for reasonable values
  if (alpha <= 0 || beta <= 0) {
    return 0.5;
  }

  // Generate two gamma samples using Marsaglia-Tsang
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);

  if (x + y === 0) {
    return 0.5;
  }

  return x / (x + y);
}

/**
 * Sample from Gamma distribution using Marsaglia-Tsang method
 */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    // Boost method for shape < 1
    const u = Math.random();
    return sampleGamma(1 + shape) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x: number;
    let v: number;

    do {
      x = gaussianRandom();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Generate standard normal random variable (Box-Muller transform)
 */
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Compute Beta distribution quantile (inverse CDF) using approximation
 */
function betaQuantile(alpha: number, beta: number, p: number): number {
  // Use Newton-Raphson approximation for Beta quantile
  // Start with mean as initial guess
  let x = alpha / (alpha + beta);

  for (let i = 0; i < 20; i++) {
    const fx = incompleteBeta(alpha, beta, x) - p;
    const dx = betaPdf(alpha, beta, x);

    if (Math.abs(dx) < 1e-10) break;

    const newX = x - fx / dx;
    if (Math.abs(newX - x) < 1e-8) break;

    x = Math.max(0.001, Math.min(0.999, newX));
  }

  return x;
}

/**
 * Regularized incomplete Beta function (approximation)
 */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Use continued fraction expansion (Lentz's algorithm)
  const bt =
    x === 0 || x === 1
      ? 0
      : Math.exp(
          logGamma(a + b) -
            logGamma(a) -
            logGamma(b) +
            a * Math.log(x) +
            b * Math.log(1 - x)
        );

  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(a, b, x)) / a;
  } else {
    return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
  }
}

/**
 * Continued fraction for incomplete Beta
 */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 100;
  const epsilon = 1e-10;

  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;

    // Even step
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    h *= d * c;

    // Odd step
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < epsilon) break;
  }

  return h;
}

/**
 * Log-Gamma function (Stirling's approximation)
 */
function logGamma(z: number): number {
  if (z < 0.5) {
    // Reflection formula
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  }

  z -= 1;
  const g = 7;
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  let x = coefficients[0];
  for (let i = 1; i < g + 2; i++) {
    x += coefficients[i] / (z + i);
  }

  const t = z + g + 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (z + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
}

/**
 * Beta PDF
 */
function betaPdf(alpha: number, beta: number, x: number): number {
  if (x <= 0 || x >= 1) return 0;

  const logB = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp(
    (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB
  );
}

// ============================================================================
// RECOVERY LEARNER
// ============================================================================

/**
 * Recovery Learner using Thompson Sampling
 *
 * Learns which recovery strategies work best for different degradation types
 * using Bayesian inference with Beta distributions.
 */
export class RecoveryLearner {
  private stats: Map<string, StrategyStats>;
  private createdAt: Date;
  private updatedAt: Date;

  constructor() {
    this.stats = new Map();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Generate key for (strategy, degradationType) pair
   */
  private getKey(strategy: string, degradationType: string): string {
    return `${strategy}::${degradationType}`;
  }

  /**
   * Get or create stats for a (strategy, degradationType) pair
   */
  private getOrCreateStats(
    strategy: string,
    degradationType: string
  ): StrategyStats {
    const key = this.getKey(strategy, degradationType);
    let stats = this.stats.get(key);

    if (!stats) {
      stats = {
        successes: 0,
        failures: 0,
        meanFitnessDelta: 0,
        totalFitnessDelta: 0,
        totalTrials: 0,
        lastUpdated: new Date(),
      };
      this.stats.set(key, stats);
    }

    return stats;
  }

  /**
   * Record the outcome of a recovery action
   */
  recordOutcome(outcome: RecoveryOutcome): void {
    const stats = this.getOrCreateStats(
      outcome.strategy,
      outcome.degradationType
    );

    // Update success/failure counts
    if (outcome.success) {
      stats.successes++;
    } else {
      stats.failures++;
    }

    // Update fitness delta tracking
    stats.totalTrials++;
    stats.totalFitnessDelta += outcome.fitnessDelta;
    stats.meanFitnessDelta = stats.totalFitnessDelta / stats.totalTrials;
    stats.lastUpdated = outcome.timestamp ?? new Date();

    this.updatedAt = new Date();

    logDebug('[learning] Outcome recorded', {
      strategy: outcome.strategy,
      degradationType: outcome.degradationType,
      success: outcome.success,
      fitnessDelta: outcome.fitnessDelta,
      totalTrials: stats.totalTrials,
    });
  }

  /**
   * Select a strategy using Thompson Sampling
   *
   * Samples from the posterior Beta distribution for each strategy
   * and returns the one with the highest sampled success probability.
   */
  selectStrategy(
    degradationType: string,
    availableStrategies: string[]
  ): string {
    if (availableStrategies.length === 0) {
      throw new Error('No strategies available');
    }

    if (availableStrategies.length === 1) {
      return availableStrategies[0];
    }

    // Check for anti-patterns and reduce their selection probability
    const antiPatterns = this.getAntiPatterns();
    const antiPatternSet = new Set(
      antiPatterns
        .filter((ap) => ap.degradationType === degradationType)
        .map((ap) => ap.strategy)
    );

    let bestStrategy = availableStrategies[0];
    let bestSample = -1;

    for (const strategy of availableStrategies) {
      const stats = this.getOrCreateStats(strategy, degradationType);

      // Compute posterior parameters (Beta distribution)
      const alpha = PRIOR_ALPHA + stats.successes;
      const beta = PRIOR_BETA + stats.failures;

      // Sample from posterior
      let sample = sampleBeta(alpha, beta);

      // Penalize anti-patterns heavily (but don't eliminate completely)
      if (antiPatternSet.has(strategy)) {
        sample *= 0.1; // 90% penalty
      }

      // If this is an untried strategy, ensure minimum exploration
      if (stats.totalTrials === 0) {
        sample = Math.max(sample, MIN_EXPLORATION_RATE);
      }

      if (sample > bestSample) {
        bestSample = sample;
        bestStrategy = strategy;
      }
    }

    logDebug('[learning] Strategy selected', {
      degradationType,
      selected: bestStrategy,
      sampledValue: bestSample,
      availableCount: availableStrategies.length,
    });

    return bestStrategy;
  }

  /**
   * Get estimated success probability for a strategy
   */
  getSuccessProbability(strategy: string, degradationType: string): number {
    const stats = this.getOrCreateStats(strategy, degradationType);

    // Posterior mean of Beta distribution
    const alpha = PRIOR_ALPHA + stats.successes;
    const beta = PRIOR_BETA + stats.failures;

    return alpha / (alpha + beta);
  }

  /**
   * Get confidence interval for success probability
   */
  getConfidenceInterval(
    strategy: string,
    degradationType: string
  ): ConfidenceInterval {
    const stats = this.getOrCreateStats(strategy, degradationType);

    const alpha = PRIOR_ALPHA + stats.successes;
    const beta = PRIOR_BETA + stats.failures;

    // Compute credible interval
    const lowerP = (1 - CI_PERCENTILE) / 2;
    const upperP = 1 - lowerP;

    return {
      lower: betaQuantile(alpha, beta, lowerP),
      upper: betaQuantile(alpha, beta, upperP),
    };
  }

  /**
   * Get statistics for a specific (strategy, degradationType) pair
   */
  getStrategyStats(
    strategy: string,
    degradationType: string
  ): StrategyStats & { successProbability: number } {
    const stats = this.getOrCreateStats(strategy, degradationType);
    return {
      ...stats,
      successProbability: this.getSuccessProbability(strategy, degradationType),
    };
  }

  /**
   * Identify anti-patterns: strategies that consistently fail
   */
  getAntiPatterns(): AntiPattern[] {
    const antiPatterns: AntiPattern[] = [];

    for (const [key, stats] of this.stats.entries()) {
      if (stats.totalTrials < MIN_SAMPLES_FOR_ANTIPATTERN) {
        continue;
      }

      const failureRate = stats.failures / stats.totalTrials;
      const [strategy, degradationType] = key.split('::');

      if (failureRate >= ANTIPATTERN_FAILURE_THRESHOLD) {
        antiPatterns.push({
          strategy,
          degradationType,
          failureRate,
          sampleSize: stats.totalTrials,
          recommendation: 'avoid',
        });
      } else if (failureRate >= CAUTION_FAILURE_THRESHOLD) {
        antiPatterns.push({
          strategy,
          degradationType,
          failureRate,
          sampleSize: stats.totalTrials,
          recommendation: 'caution',
        });
      }
    }

    return antiPatterns;
  }

  /**
   * Get all tracked strategies for a degradation type
   */
  getTrackedStrategies(degradationType: string): string[] {
    const strategies: string[] = [];

    for (const key of this.stats.keys()) {
      const [strategy, type] = key.split('::');
      if (type === degradationType) {
        strategies.push(strategy);
      }
    }

    return strategies;
  }

  /**
   * Get summary statistics across all strategies
   */
  getSummary(): {
    totalStrategies: number;
    totalOutcomes: number;
    overallSuccessRate: number;
    antiPatternCount: number;
    byDegradationType: Record<
      string,
      { strategies: number; outcomes: number; successRate: number }
    >;
  } {
    let totalOutcomes = 0;
    let totalSuccesses = 0;
    const byType: Map<
      string,
      { strategies: Set<string>; successes: number; failures: number }
    > = new Map();

    for (const [key, stats] of this.stats.entries()) {
      const [strategy, degradationType] = key.split('::');

      totalOutcomes += stats.totalTrials;
      totalSuccesses += stats.successes;

      let typeStats = byType.get(degradationType);
      if (!typeStats) {
        typeStats = { strategies: new Set(), successes: 0, failures: 0 };
        byType.set(degradationType, typeStats);
      }

      typeStats.strategies.add(strategy);
      typeStats.successes += stats.successes;
      typeStats.failures += stats.failures;
    }

    const byDegradationType: Record<
      string,
      { strategies: number; outcomes: number; successRate: number }
    > = {};

    for (const [type, stats] of byType.entries()) {
      const total = stats.successes + stats.failures;
      byDegradationType[type] = {
        strategies: stats.strategies.size,
        outcomes: total,
        successRate: total > 0 ? stats.successes / total : 0,
      };
    }

    return {
      totalStrategies: this.stats.size,
      totalOutcomes,
      overallSuccessRate:
        totalOutcomes > 0 ? totalSuccesses / totalOutcomes : 0,
      antiPatternCount: this.getAntiPatterns().filter(
        (ap) => ap.recommendation === 'avoid'
      ).length,
      byDegradationType,
    };
  }

  /**
   * Serialize learner state for persistence
   */
  serialize(): RecoveryLearnerState {
    const statsObj: Record<string, StrategyStats> = {};

    for (const [key, stats] of this.stats.entries()) {
      statsObj[key] = {
        ...stats,
        lastUpdated: stats.lastUpdated,
      };
    }

    return {
      version: 1,
      stats: statsObj,
      antiPatterns: this.getAntiPatterns(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Deserialize learner state from persistence
   */
  deserialize(state: RecoveryLearnerState): void {
    if (state.version !== 1) {
      throw new Error(`Unsupported state version: ${state.version}`);
    }

    this.stats.clear();

    for (const [key, stats] of Object.entries(state.stats)) {
      this.stats.set(key, {
        ...stats,
        lastUpdated: new Date(stats.lastUpdated),
      });
    }

    this.createdAt = new Date(state.createdAt);
    this.updatedAt = new Date(state.updatedAt);

    logInfo('[learning] Learner state restored', {
      strategiesLoaded: this.stats.size,
      createdAt: this.createdAt.toISOString(),
    });
  }

  /**
   * Reset all learned data
   */
  reset(): void {
    this.stats.clear();
    this.createdAt = new Date();
    this.updatedAt = new Date();

    logInfo('[learning] Learner reset');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new RecoveryLearner instance
 */
export function createRecoveryLearner(): RecoveryLearner {
  return new RecoveryLearner();
}
