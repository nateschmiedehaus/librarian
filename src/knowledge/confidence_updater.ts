/**
 * @fileoverview Bayesian Confidence Updater
 *
 * Provides proper Bayesian updates for confidence scores based on
 * success/failure outcomes. This replaces simple delta adjustments
 * with principled probability updates.
 *
 * Key Concepts:
 * - Prior: Current confidence (P(good))
 * - Likelihood: P(outcome | good) - probability of this outcome if knowledge is good
 * - Evidence: P(outcome) - overall probability of this outcome
 * - Posterior: P(good | outcome) - updated confidence after observing outcome
 *
 * Bayes' Rule: P(good | outcome) = P(outcome | good) * P(good) / P(outcome)
 */

export interface BayesianUpdateConfig {
  // Likelihood parameters
  successLikelihoodIfGood: number;   // P(success | good) - typically 0.8-0.95
  successLikelihoodIfBad: number;    // P(success | bad) - typically 0.2-0.4

  // Update dampening to prevent extreme swings
  minConfidence: number;             // Floor (typically 0.05-0.1)
  maxConfidence: number;             // Ceiling (typically 0.9-0.95)

  // Learning rate: how quickly to update (1.0 = full Bayesian, <1 = dampened)
  learningRate: number;
}

const DEFAULT_CONFIG: BayesianUpdateConfig = {
  successLikelihoodIfGood: 0.85,    // Good knowledge succeeds 85% of the time
  successLikelihoodIfBad: 0.35,      // Bad knowledge still succeeds 35% of the time (random chance)
  minConfidence: 0.05,
  maxConfidence: 0.95,
  learningRate: 0.7,                 // Dampen updates to 70% of full Bayesian
};

/**
 * Apply Bayesian update to confidence based on observed outcome.
 *
 * @param prior - Current confidence (0 to 1)
 * @param success - Whether the outcome was a success
 * @param config - Optional configuration overrides
 * @returns Updated confidence (0 to 1)
 */
export function bayesianUpdate(
  prior: number,
  success: boolean,
  config: Partial<BayesianUpdateConfig> = {}
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Validate prior
  const safePrior = Math.max(cfg.minConfidence, Math.min(cfg.maxConfidence, prior));

  // P(outcome | good) and P(outcome | bad)
  const likelihoodIfGood = success ? cfg.successLikelihoodIfGood : (1 - cfg.successLikelihoodIfGood);
  const likelihoodIfBad = success ? cfg.successLikelihoodIfBad : (1 - cfg.successLikelihoodIfBad);

  // P(outcome) = P(outcome | good) * P(good) + P(outcome | bad) * P(bad)
  const evidence = likelihoodIfGood * safePrior + likelihoodIfBad * (1 - safePrior);

  // Avoid division by zero
  if (evidence === 0) {
    return safePrior;
  }

  // P(good | outcome) = P(outcome | good) * P(good) / P(outcome)
  const rawPosterior = (likelihoodIfGood * safePrior) / evidence;

  // Apply learning rate dampening
  const dampedPosterior = safePrior + cfg.learningRate * (rawPosterior - safePrior);

  // Clamp to valid range
  return Math.max(cfg.minConfidence, Math.min(cfg.maxConfidence, dampedPosterior));
}

/**
 * Calculate the delta for a Bayesian update (for compatibility with existing systems).
 *
 * @param prior - Current confidence (0 to 1)
 * @param success - Whether the outcome was a success
 * @param config - Optional configuration overrides
 * @returns Delta to add to confidence
 */
export function bayesianDelta(
  prior: number,
  success: boolean,
  config: Partial<BayesianUpdateConfig> = {}
): number {
  const posterior = bayesianUpdate(prior, success, config);
  return posterior - prior;
}

/**
 * Calculate expected information gain from an outcome.
 * Higher values mean the outcome was more informative.
 *
 * @param prior - Confidence before update
 * @param posterior - Confidence after update
 * @returns Information gain in bits (log base 2)
 */
export function informationGain(prior: number, posterior: number): number {
  if (prior <= 0 || prior >= 1 || posterior <= 0 || posterior >= 1) {
    return 0;
  }

  // KL divergence from prior to posterior (simplified for binary)
  const priorBad = 1 - prior;
  const posteriorBad = 1 - posterior;

  const klGood = posterior > 0 ? posterior * Math.log2(posterior / prior) : 0;
  const klBad = posteriorBad > 0 ? posteriorBad * Math.log2(posteriorBad / priorBad) : 0;

  return klGood + klBad;
}

/**
 * Batch update for multiple outcomes on the same entity.
 *
 * @param prior - Initial confidence
 * @param outcomes - Array of success/failure outcomes
 * @param config - Optional configuration overrides
 * @returns Final confidence after all updates
 */
export function batchBayesianUpdate(
  prior: number,
  outcomes: boolean[],
  config: Partial<BayesianUpdateConfig> = {}
): number {
  return outcomes.reduce((conf, success) => bayesianUpdate(conf, success, config), prior);
}

/**
 * Calculate calibration metrics for a set of predictions vs outcomes.
 * Used to assess how well confidence scores predict actual success rates.
 *
 * @param predictions - Array of [confidence, actualSuccess] pairs
 * @returns Calibration metrics
 */
export function calculateCalibration(
  predictions: Array<[number, boolean]>
): {
  brierScore: number;      // 0 = perfect, 1 = worst
  calibrationError: number; // Expected calibration error
  resolution: number;       // How much predictions differ from base rate
  reliability: number;      // How close binned predictions are to actual rates
} {
  if (predictions.length === 0) {
    return { brierScore: 0, calibrationError: 0, resolution: 0, reliability: 0 };
  }

  // Brier score: mean squared error of probabilistic predictions
  const brierScore = predictions.reduce((sum, [conf, actual]) => {
    const target = actual ? 1 : 0;
    return sum + Math.pow(conf - target, 2);
  }, 0) / predictions.length;

  // Base rate (overall success rate)
  const baseRate = predictions.filter(([, actual]) => actual).length / predictions.length;

  // Bin predictions for calibration analysis (10 bins: 0-0.1, 0.1-0.2, etc.)
  const bins: Map<number, { sum: number; count: number; successes: number }> = new Map();

  for (const [conf, actual] of predictions) {
    const binIndex = Math.min(9, Math.floor(conf * 10));
    const bin = bins.get(binIndex) || { sum: 0, count: 0, successes: 0 };
    bin.sum += conf;
    bin.count += 1;
    bin.successes += actual ? 1 : 0;
    bins.set(binIndex, bin);
  }

  // Expected Calibration Error (ECE)
  let ece = 0;
  let resolution = 0;
  let reliability = 0;

  for (const bin of bins.values()) {
    if (bin.count === 0) continue;

    const avgConf = bin.sum / bin.count;
    const actualRate = bin.successes / bin.count;
    const weight = bin.count / predictions.length;

    ece += weight * Math.abs(avgConf - actualRate);
    resolution += weight * Math.pow(actualRate - baseRate, 2);
    reliability += weight * Math.pow(avgConf - actualRate, 2);
  }

  return {
    brierScore,
    calibrationError: ece,
    resolution,
    reliability,
  };
}

/**
 * Suggest confidence recalibration based on observed outcomes.
 * Returns a calibration function that adjusts raw confidence to calibrated confidence.
 *
 * @param observations - Historical [rawConfidence, actualSuccess] pairs
 * @returns Calibration function
 */
export function createCalibrationFunction(
  observations: Array<[number, boolean]>
): (rawConfidence: number) => number {
  if (observations.length < 10) {
    // Not enough data for calibration
    return (c) => c;
  }

  // Simple isotonic regression approximation using binned averages
  const bins: Map<number, { sum: number; count: number; successes: number }> = new Map();

  for (const [conf, actual] of observations) {
    const binIndex = Math.min(9, Math.floor(conf * 10));
    const bin = bins.get(binIndex) || { sum: 0, count: 0, successes: 0 };
    bin.count += 1;
    bin.successes += actual ? 1 : 0;
    bins.set(binIndex, bin);
  }

  // Build calibration map
  const calibrationMap = new Map<number, number>();
  for (let i = 0; i < 10; i++) {
    const bin = bins.get(i);
    if (bin && bin.count >= 2) {
      calibrationMap.set(i, bin.successes / bin.count);
    } else {
      // Use linear interpolation as fallback
      calibrationMap.set(i, (i + 0.5) / 10);
    }
  }

  return (rawConfidence: number): number => {
    const binIndex = Math.min(9, Math.floor(rawConfidence * 10));
    const binStart = binIndex / 10;
    const binEnd = (binIndex + 1) / 10;

    const calibratedLow = calibrationMap.get(binIndex) ?? rawConfidence;
    const calibratedHigh = calibrationMap.get(Math.min(9, binIndex + 1)) ?? rawConfidence;

    // Linear interpolation within bin
    const t = (rawConfidence - binStart) / (binEnd - binStart);
    return calibratedLow + t * (calibratedHigh - calibratedLow);
  };
}

/**
 * Specialized configs for different types of knowledge
 */
export const CONFIDENCE_CONFIGS = {
  // Strict config for critical security or contract knowledge
  strict: {
    successLikelihoodIfGood: 0.95,
    successLikelihoodIfBad: 0.2,
    minConfidence: 0.1,
    maxConfidence: 0.9,
    learningRate: 0.9,
  } satisfies BayesianUpdateConfig,

  // Standard config for general code knowledge
  standard: DEFAULT_CONFIG,

  // Lenient config for noisy/heuristic knowledge
  lenient: {
    successLikelihoodIfGood: 0.7,
    successLikelihoodIfBad: 0.4,
    minConfidence: 0.2,
    maxConfidence: 0.8,
    learningRate: 0.5,
  } satisfies BayesianUpdateConfig,

  // Fast learning for new/recently generated knowledge
  fastLearning: {
    successLikelihoodIfGood: 0.85,
    successLikelihoodIfBad: 0.35,
    minConfidence: 0.05,
    maxConfidence: 0.95,
    learningRate: 1.0,  // Full Bayesian updates
  } satisfies BayesianUpdateConfig,
};
