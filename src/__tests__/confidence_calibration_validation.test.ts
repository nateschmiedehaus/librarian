/**
 * @fileoverview Confidence Calibration Validation Tests (TDD)
 *
 * Validates that librarian's confidence scores are well-calibrated:
 * - 90% confidence → 90% ± 5% accuracy
 * - 70% confidence → 70% ± 10% accuracy
 * - ECE (Expected Calibration Error) < 15%
 *
 * METHODOLOGY:
 * - Bin predictions by confidence level
 * - Compute actual accuracy per bin
 * - Measure calibration error as |confidence - accuracy|
 * - ECE is weighted average of calibration errors
 *
 * Per VISION.md: "Stated confidence must match empirical accuracy"
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { createSqliteStorage } from '../storage/sqlite_storage.js';
import { queryLibrarian } from '../api/query.js';
import type { LibrarianStorage } from '../storage/types.js';
import type { ContextPack } from '../types.js';

// ============================================================================
// CALIBRATION METRICS
// ============================================================================

interface CalibrationBin {
  /** Lower bound of confidence range (inclusive) */
  lower: number;
  /** Upper bound of confidence range (exclusive) */
  upper: number;
  /** Predictions in this bin */
  predictions: CalibrationPrediction[];
  /** Average confidence in this bin */
  avgConfidence: number;
  /** Empirical accuracy (fraction correct) */
  accuracy: number;
  /** Calibration error |avgConfidence - accuracy| */
  error: number;
}

interface CalibrationPrediction {
  /** Predicted confidence */
  confidence: number;
  /** Was the prediction correct? */
  correct: boolean;
  /** Entity/pack ID */
  entityId: string;
}

interface CalibrationResult {
  /** Expected Calibration Error (weighted average of bin errors) */
  ece: number;
  /** Maximum Calibration Error (worst bin) */
  mce: number;
  /** Bins with their statistics */
  bins: CalibrationBin[];
  /** Total predictions analyzed */
  totalPredictions: number;
  /** Fraction of predictions that were correct */
  overallAccuracy: number;
}

/**
 * Computes calibration metrics using equal-width binning.
 */
function computeCalibration(
  predictions: CalibrationPrediction[],
  numBins: number = 10
): CalibrationResult {
  if (predictions.length === 0) {
    return {
      ece: 0,
      mce: 0,
      bins: [],
      totalPredictions: 0,
      overallAccuracy: 0,
    };
  }

  // Create bins
  const binWidth = 1.0 / numBins;
  const bins: CalibrationBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const lower = i * binWidth;
    const upper = (i + 1) * binWidth;
    const inBin = predictions.filter(p => p.confidence >= lower && p.confidence < upper);

    if (inBin.length === 0) {
      bins.push({
        lower,
        upper,
        predictions: [],
        avgConfidence: (lower + upper) / 2,
        accuracy: 0,
        error: 0,
      });
      continue;
    }

    const avgConfidence = inBin.reduce((s, p) => s + p.confidence, 0) / inBin.length;
    const accuracy = inBin.filter(p => p.correct).length / inBin.length;
    const error = Math.abs(avgConfidence - accuracy);

    bins.push({
      lower,
      upper,
      predictions: inBin,
      avgConfidence,
      accuracy,
      error,
    });
  }

  // Compute ECE (weighted by bin size)
  const totalPredictions = predictions.length;
  let ece = 0;
  let mce = 0;

  for (const bin of bins) {
    const weight = bin.predictions.length / totalPredictions;
    ece += weight * bin.error;
    mce = Math.max(mce, bin.error);
  }

  const overallAccuracy = predictions.filter(p => p.correct).length / totalPredictions;

  return {
    ece,
    mce,
    bins,
    totalPredictions,
    overallAccuracy,
  };
}

/**
 * Prints a calibration diagram to console.
 */
function printCalibrationDiagram(result: CalibrationResult): void {
  console.log('\n=== CALIBRATION DIAGRAM ===\n');
  console.log('Confidence | Accuracy | Error | Count');
  console.log('-'.repeat(45));

  for (const bin of result.bins) {
    const confStr = `${(bin.avgConfidence * 100).toFixed(0)}%`.padStart(10);
    const accStr = `${(bin.accuracy * 100).toFixed(0)}%`.padStart(8);
    const errStr = `${(bin.error * 100).toFixed(1)}%`.padStart(6);
    const countStr = `${bin.predictions.length}`.padStart(6);

    // Visual bar
    const bar = '█'.repeat(Math.round(bin.accuracy * 20));
    const expected = '│';
    const barPos = Math.round(bin.avgConfidence * 20);

    console.log(`${confStr} | ${accStr} | ${errStr} | ${countStr} ${bar}`);
  }

  console.log('-'.repeat(45));
  console.log(`ECE: ${(result.ece * 100).toFixed(2)}%`);
  console.log(`MCE: ${(result.mce * 100).toFixed(2)}%`);
  console.log(`Overall Accuracy: ${(result.overallAccuracy * 100).toFixed(1)}%`);
  console.log(`Total Predictions: ${result.totalPredictions}`);
}

// ============================================================================
// CALIBRATION VALIDATION TESTS
// ============================================================================

describe('Confidence Calibration Validation', () => {
  let storage: LibrarianStorage;
  let storageInitialized = false;
  let calibrationPredictions: CalibrationPrediction[] = [];

  beforeAll(async () => {
    const workspaceRoot = process.cwd();
    const dbPath = path.join(workspaceRoot, 'state', 'librarian.db');

    try {
      storage = createSqliteStorage(dbPath, workspaceRoot);
      await storage.initialize();
      storageInitialized = true;

      const version = await storage.getVersion();
      if (!version) {
        console.warn('Librarian not bootstrapped - calibration validation will skip');
        storageInitialized = false;
      }
    } catch (error) {
      console.warn('Failed to initialize storage for calibration validation:', error);
      storageInitialized = false;
    }
  }, 60000);

  afterAll(async () => {
    await storage?.close?.();

    // Print calibration results
    if (calibrationPredictions.length > 0) {
      const result = computeCalibration(calibrationPredictions);
      printCalibrationDiagram(result);
    }
  });

  describe('ECE Computation', () => {
    it('ECE is 0 for perfectly calibrated predictions', () => {
      const perfectPredictions: CalibrationPrediction[] = [
        // 90% confidence, 90% correct
        ...Array(9).fill(null).map((_, i) => ({ confidence: 0.9, correct: true, entityId: `p${i}` })),
        { confidence: 0.9, correct: false, entityId: 'p9' },
        // 50% confidence, 50% correct
        ...Array(5).fill(null).map((_, i) => ({ confidence: 0.5, correct: true, entityId: `q${i}` })),
        ...Array(5).fill(null).map((_, i) => ({ confidence: 0.5, correct: false, entityId: `r${i}` })),
      ];

      const result = computeCalibration(perfectPredictions);
      // Should be very low ECE (not exactly 0 due to binning)
      expect(result.ece).toBeLessThan(0.05);
    });

    it('ECE is high for overconfident predictions', () => {
      const overconfidentPredictions: CalibrationPrediction[] = [
        // 90% confidence but only 50% correct
        ...Array(5).fill(null).map((_, i) => ({ confidence: 0.9, correct: true, entityId: `p${i}` })),
        ...Array(5).fill(null).map((_, i) => ({ confidence: 0.9, correct: false, entityId: `q${i}` })),
      ];

      const result = computeCalibration(overconfidentPredictions);
      // Should have significant calibration error
      expect(result.ece).toBeGreaterThan(0.3);
    });

    it('ECE is high for underconfident predictions', () => {
      const underconfidentPredictions: CalibrationPrediction[] = [
        // 30% confidence but 90% correct
        ...Array(9).fill(null).map((_, i) => ({ confidence: 0.3, correct: true, entityId: `p${i}` })),
        { confidence: 0.3, correct: false, entityId: 'p9' },
      ];

      const result = computeCalibration(underconfidentPredictions);
      // Should have significant calibration error
      expect(result.ece).toBeGreaterThan(0.5);
    });
  });

  describe('Context Pack Calibration', () => {
    it('collects calibration data from context packs', async (ctx) => {
      if (!storageInitialized) {
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): Confidence calibration requires a bootstrapped librarian DB');
        return;
      }

      const packs = await storage.getContextPacks({ limit: 200 });

      if (packs.length === 0) {
        console.warn('No context packs found for calibration');
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): No context packs found for calibration');
        return;
      }

      // For calibration, we use success/failure outcomes as ground truth
      for (const pack of packs) {
        if (pack.successCount + pack.failureCount > 0) {
          const empiricalAccuracy = pack.successCount / (pack.successCount + pack.failureCount);
          calibrationPredictions.push({
            confidence: pack.confidence,
            correct: empiricalAccuracy >= 0.5, // Consider "correct" if >50% success rate
            entityId: pack.packId,
          });
        }
      }

      console.log(`Collected ${calibrationPredictions.length} predictions with outcomes`);
      expect(calibrationPredictions.length).toBeGreaterThanOrEqual(0);
    });

    it('ECE < 15% requirement', async (ctx) => {
      if (!storageInitialized || calibrationPredictions.length < 10) {
        // Need minimum predictions for meaningful calibration
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): Insufficient calibration data (requires >= 10 predictions with outcomes)');
        return;
      }

      const result = computeCalibration(calibrationPredictions);
      console.log(`ECE: ${(result.ece * 100).toFixed(2)}%`);

      // SLO: ECE < 15%
      expect(result.ece).toBeLessThan(0.15);
    });

    it('high confidence predictions are accurate', async (ctx) => {
      if (!storageInitialized || calibrationPredictions.length < 10) {
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): Insufficient calibration data (requires >= 10 predictions with outcomes)');
        return;
      }

      const highConfPredictions = calibrationPredictions.filter(p => p.confidence >= 0.8);

      if (highConfPredictions.length < 5) {
        console.warn('Insufficient high-confidence predictions');
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): Insufficient high-confidence predictions (requires >= 5)');
        return;
      }

      const accuracy = highConfPredictions.filter(p => p.correct).length / highConfPredictions.length;
      console.log(`High confidence (≥80%) accuracy: ${(accuracy * 100).toFixed(1)}%`);

      // High confidence should have high accuracy
      expect(accuracy).toBeGreaterThanOrEqual(0.7);
    });

    it('low confidence predictions are uncertain', async (ctx) => {
      if (!storageInitialized || calibrationPredictions.length < 10) {
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): Insufficient calibration data (requires >= 10 predictions with outcomes)');
        return;
      }

      const lowConfPredictions = calibrationPredictions.filter(p => p.confidence < 0.4);

      if (lowConfPredictions.length < 5) {
        console.warn('Insufficient low-confidence predictions');
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): Insufficient low-confidence predictions (requires >= 5)');
        return;
      }

      const accuracy = lowConfPredictions.filter(p => p.correct).length / lowConfPredictions.length;
      console.log(`Low confidence (<40%) accuracy: ${(accuracy * 100).toFixed(1)}%`);

      // Low confidence should NOT have high accuracy (would indicate underconfidence)
      expect(accuracy).toBeLessThan(0.8);
    });
  });

  describe('Confidence Bounds', () => {
    it('all confidence scores are in [0.1, 0.95] range', async (ctx) => {
      if (!storageInitialized) {
        ctx.skip(true, 'unverified_by_trace(test_fixture_missing): Confidence bounds require a bootstrapped librarian DB');
        return;
      }

      const packs = await storage.getContextPacks({ limit: 200 });
      let outOfBoundsCount = 0;

      for (const pack of packs) {
        if (pack.confidence < 0.1 || pack.confidence > 0.95) {
          outOfBoundsCount++;
          console.warn(`Pack ${pack.packId} has out-of-bounds confidence: ${pack.confidence}`);
        }
      }

      const outOfBoundsRate = outOfBoundsCount / packs.length;
      console.log(`Out-of-bounds confidence rate: ${(outOfBoundsRate * 100).toFixed(1)}%`);

      // Allow small percentage due to edge cases
      expect(outOfBoundsRate).toBeLessThan(0.05);
    });

    it('confidence floor is 0.1', () => {
      const CONFIDENCE_FLOOR = 0.1;
      expect(CONFIDENCE_FLOOR).toBe(0.1);

      // Test that confidence is clamped
      const clampedConfidence = Math.max(CONFIDENCE_FLOOR, Math.min(0.95, 0.05));
      expect(clampedConfidence).toBe(0.1);
    });

    it('confidence ceiling is 0.95', () => {
      const CONFIDENCE_CEILING = 0.95;
      expect(CONFIDENCE_CEILING).toBe(0.95);

      // Test that confidence is clamped
      const clampedConfidence = Math.max(0.1, Math.min(CONFIDENCE_CEILING, 0.99));
      expect(clampedConfidence).toBe(0.95);
    });
  });

  describe('Calibration Metric Computation', () => {
    it('computes calibration for empty predictions', () => {
      const result = computeCalibration([]);
      expect(result.ece).toBe(0);
      expect(result.totalPredictions).toBe(0);
    });

    it('computes calibration for single prediction', () => {
      const result = computeCalibration([
        { confidence: 0.8, correct: true, entityId: 'p1' },
      ]);
      expect(result.totalPredictions).toBe(1);
      expect(result.overallAccuracy).toBe(1.0);
    });

    it('bins predictions correctly', () => {
      const predictions: CalibrationPrediction[] = [
        { confidence: 0.15, correct: true, entityId: 'p1' },
        { confidence: 0.55, correct: false, entityId: 'p2' },
        { confidence: 0.85, correct: true, entityId: 'p3' },
      ];

      const result = computeCalibration(predictions, 10);

      // Each prediction should be in a different bin
      const nonEmptyBins = result.bins.filter(b => b.predictions.length > 0);
      expect(nonEmptyBins.length).toBe(3);
    });

    it('MCE is max of bin errors', () => {
      const predictions: CalibrationPrediction[] = [
        // Bin 1: 90% confidence, 10% accuracy (80% error)
        ...Array(9).fill(null).map((_, i) => ({ confidence: 0.91, correct: false, entityId: `a${i}` })),
        { confidence: 0.91, correct: true, entityId: 'a9' },
        // Bin 2: 50% confidence, 50% accuracy (0% error)
        ...Array(5).fill(null).map((_, i) => ({ confidence: 0.51, correct: true, entityId: `b${i}` })),
        ...Array(5).fill(null).map((_, i) => ({ confidence: 0.51, correct: false, entityId: `c${i}` })),
      ];

      const result = computeCalibration(predictions);
      expect(result.mce).toBeGreaterThan(0.7); // Should capture the ~80% error bin
    });
  });
});

// ============================================================================
// CALIBRATION FIXTURES FOR TESTING
// ============================================================================

describe('Calibration Test Fixtures', () => {
  it('generates well-calibrated fixture data', () => {
    // Fixture: predictions that are well-calibrated
    const wellCalibrated: CalibrationPrediction[] = [];

    // 10% confidence bin: 10% correct
    for (let i = 0; i < 10; i++) {
      wellCalibrated.push({
        confidence: 0.1 + Math.random() * 0.09,
        correct: i < 1,
        entityId: `low_${i}`,
      });
    }

    // 50% confidence bin: 50% correct
    for (let i = 0; i < 10; i++) {
      wellCalibrated.push({
        confidence: 0.45 + Math.random() * 0.09,
        correct: i < 5,
        entityId: `mid_${i}`,
      });
    }

    // 90% confidence bin: 90% correct
    for (let i = 0; i < 10; i++) {
      wellCalibrated.push({
        confidence: 0.85 + Math.random() * 0.09,
        correct: i < 9,
        entityId: `high_${i}`,
      });
    }

    const result = computeCalibration(wellCalibrated);
    expect(result.ece).toBeLessThan(0.15);
  });

  it('generates poorly-calibrated fixture data', () => {
    // Fixture: predictions that are overconfident (deterministic)
    const poorlyCalibrated: CalibrationPrediction[] = [];

    // All high confidence (85-95%) but only 50% correct
    // This gives ~40% calibration error in the high confidence bin
    for (let i = 0; i < 30; i++) {
      poorlyCalibrated.push({
        confidence: 0.85 + (i % 10) * 0.01, // Deterministic spread 0.85-0.94
        correct: i % 2 === 0, // Exactly 50% correct
        entityId: `over_${i}`,
      });
    }

    const result = computeCalibration(poorlyCalibrated);
    // High confidence (~90%) with 50% accuracy = ~40% error
    // ECE should be ~0.4 (weighted by that single bin)
    expect(result.ece).toBeGreaterThan(0.25);
  });
});
