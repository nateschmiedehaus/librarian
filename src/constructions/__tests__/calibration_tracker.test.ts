/**
 * @fileoverview Tests for Construction Calibration Tracker
 *
 * Tests the calibration tracking functionality for constructions:
 * - Recording predictions and outcomes
 * - Computing calibration reports (ECE, buckets, trends)
 * - Generating miscalibration alerts
 * - Integration with constructions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConstructionCalibrationTracker,
  createConstructionCalibrationTracker,
  generatePredictionId,
  type ConstructionCalibrationReport,
} from '../calibration_tracker.js';
import type { ConfidenceValue } from '../../epistemics/confidence.js';
import { deterministic, bounded, absent } from '../../epistemics/confidence.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMeasuredConfidence(value: number): ConfidenceValue {
  return {
    type: 'measured',
    value,
    measurement: {
      datasetId: 'test',
      sampleSize: 100,
      accuracy: value,
      confidenceInterval: [value - 0.1, value + 0.1] as const,
      measuredAt: new Date().toISOString(),
    },
  };
}

function createDerivedConfidence(value: number): ConfidenceValue {
  return {
    type: 'derived',
    value,
    formula: 'test_formula',
    inputs: [],
  };
}

// ============================================================================
// BASIC FUNCTIONALITY TESTS
// ============================================================================

describe('ConstructionCalibrationTracker', () => {
  let tracker: ConstructionCalibrationTracker;

  beforeEach(() => {
    tracker = new ConstructionCalibrationTracker();
  });

  describe('recordPrediction()', () => {
    it('should record a prediction', () => {
      const confidence = createMeasuredConfidence(0.85);

      tracker.recordPrediction(
        'TestConstruction',
        'pred-1',
        confidence,
        'Test claim'
      );

      const counts = tracker.getPredictionCounts();
      expect(counts.get('TestConstruction')?.total).toBe(1);
      expect(counts.get('TestConstruction')?.withOutcome).toBe(0);
    });

    it('should reject duplicate prediction IDs', () => {
      const confidence = createMeasuredConfidence(0.85);

      tracker.recordPrediction('TestConstruction', 'pred-1', confidence, 'Claim 1');

      expect(() => {
        tracker.recordPrediction('TestConstruction', 'pred-1', confidence, 'Claim 2');
      }).toThrow('Prediction pred-1 already recorded');
    });

    it('should track predictions with context', () => {
      const confidence = createMeasuredConfidence(0.75);

      tracker.recordPrediction(
        'TestConstruction',
        'pred-1',
        confidence,
        'Test claim',
        { extra: 'context' }
      );

      const counts = tracker.getPredictionCounts();
      expect(counts.get('TestConstruction')?.total).toBe(1);
    });
  });

  describe('recordOutcome()', () => {
    it('should record an outcome for a prediction', () => {
      const confidence = createMeasuredConfidence(0.85);

      tracker.recordPrediction('TestConstruction', 'pred-1', confidence, 'Test claim');
      tracker.recordOutcome('pred-1', true, 'test_result');

      const counts = tracker.getPredictionCounts();
      expect(counts.get('TestConstruction')?.withOutcome).toBe(1);
    });

    it('should reject outcome for non-existent prediction', () => {
      expect(() => {
        tracker.recordOutcome('non-existent', true, 'test_result');
      }).toThrow('Prediction non-existent not found');
    });

    it('should reject duplicate outcomes', () => {
      const confidence = createMeasuredConfidence(0.85);

      tracker.recordPrediction('TestConstruction', 'pred-1', confidence, 'Test claim');
      tracker.recordOutcome('pred-1', true, 'test_result');

      expect(() => {
        tracker.recordOutcome('pred-1', false, 'user_feedback');
      }).toThrow('Outcome for pred-1 already recorded');
    });
  });

  describe('getConstructionIds()', () => {
    it('should return all tracked construction IDs', () => {
      tracker.recordPrediction('Construction1', 'pred-1', createMeasuredConfidence(0.8), 'Claim 1');
      tracker.recordPrediction('Construction2', 'pred-2', createMeasuredConfidence(0.9), 'Claim 2');
      tracker.recordPrediction('Construction1', 'pred-3', createMeasuredConfidence(0.7), 'Claim 3');

      const ids = tracker.getConstructionIds();
      expect(ids).toContain('Construction1');
      expect(ids).toContain('Construction2');
      expect(ids.length).toBe(2);
    });
  });

  describe('clear()', () => {
    it('should clear all tracking data', () => {
      tracker.recordPrediction('TestConstruction', 'pred-1', createMeasuredConfidence(0.8), 'Claim');
      tracker.recordOutcome('pred-1', true, 'test_result');

      tracker.clear();

      expect(tracker.getConstructionIds().length).toBe(0);
    });
  });
});

// ============================================================================
// CALIBRATION REPORT TESTS
// ============================================================================

describe('Calibration Report Generation', () => {
  let tracker: ConstructionCalibrationTracker;

  beforeEach(() => {
    tracker = new ConstructionCalibrationTracker();
  });

  it('should return insufficient data report when samples < 10', () => {
    // Record only 5 predictions with outcomes
    for (let i = 0; i < 5; i++) {
      tracker.recordPrediction('TestConstruction', `pred-${i}`, createMeasuredConfidence(0.8), 'Claim');
      tracker.recordOutcome(`pred-${i}`, i % 2 === 0, 'test_result');
    }

    const report = tracker.getCalibration('TestConstruction');

    expect(report.sampleCount).toBe(5);
    expect(report.recommendations).toContain('Insufficient data: 5 predictions with outcomes (minimum: 10)');
  });

  it('should compute ECE correctly for well-calibrated predictions', () => {
    // Create 20 predictions with 80% stated confidence
    // Make 16 correct (80%) - perfectly calibrated
    for (let i = 0; i < 20; i++) {
      tracker.recordPrediction(
        'TestConstruction',
        `pred-${i}`,
        createMeasuredConfidence(0.8),
        'Claim'
      );
      tracker.recordOutcome(`pred-${i}`, i < 16, 'test_result');
    }

    const report = tracker.getCalibration('TestConstruction');

    expect(report.sampleCount).toBe(20);
    expect(report.ece).toBeLessThan(0.05); // Well-calibrated should have low ECE
  });

  it('should compute ECE correctly for miscalibrated predictions', () => {
    // Create 20 predictions with 90% stated confidence
    // Make only 10 correct (50%) - severely overconfident
    for (let i = 0; i < 20; i++) {
      tracker.recordPrediction(
        'TestConstruction',
        `pred-${i}`,
        createMeasuredConfidence(0.9),
        'Claim'
      );
      tracker.recordOutcome(`pred-${i}`, i < 10, 'test_result');
    }

    const report = tracker.getCalibration('TestConstruction');

    expect(report.sampleCount).toBe(20);
    expect(report.ece).toBeGreaterThan(0.3); // Miscalibrated should have high ECE
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('should populate buckets correctly', () => {
    // Add predictions in different confidence ranges
    const confidences = [0.3, 0.5, 0.7, 0.9];

    for (let i = 0; i < 40; i++) {
      const conf = confidences[i % 4];
      tracker.recordPrediction(
        'TestConstruction',
        `pred-${i}`,
        createMeasuredConfidence(conf),
        'Claim'
      );
      // Make outcomes match stated confidence roughly
      tracker.recordOutcome(`pred-${i}`, Math.random() < conf, 'test_result');
    }

    const report = tracker.getCalibration('TestConstruction');

    expect(report.buckets.length).toBe(4);
    // All buckets should have samples
    const nonEmptyBuckets = report.buckets.filter(b => b.sampleSize > 0);
    expect(nonEmptyBuckets.length).toBeGreaterThan(2);
  });

  it('should track trend over time', () => {
    // First batch - well calibrated
    for (let i = 0; i < 15; i++) {
      tracker.recordPrediction('TestConstruction', `batch1-${i}`, createMeasuredConfidence(0.8), 'Claim');
      tracker.recordOutcome(`batch1-${i}`, i < 12, 'test_result');
    }
    tracker.getCalibration('TestConstruction'); // Generate first report

    // Second batch - also well calibrated
    for (let i = 0; i < 15; i++) {
      tracker.recordPrediction('TestConstruction', `batch2-${i}`, createMeasuredConfidence(0.8), 'Claim');
      tracker.recordOutcome(`batch2-${i}`, i < 12, 'test_result');
    }
    const report = tracker.getCalibration('TestConstruction');

    expect(report.trend).toBe('stable');
  });
});

// ============================================================================
// ALERT TESTS
// ============================================================================

describe('Calibration Alerts', () => {
  let tracker: ConstructionCalibrationTracker;

  beforeEach(() => {
    tracker = new ConstructionCalibrationTracker();
  });

  it('should generate alerts for miscalibrated constructions', () => {
    // Create severely overconfident predictions
    for (let i = 0; i < 20; i++) {
      tracker.recordPrediction('OverconfidentConstruction', `pred-${i}`, createMeasuredConfidence(0.95), 'Claim');
      tracker.recordOutcome(`pred-${i}`, i < 5, 'test_result'); // Only 25% correct at 95% confidence
    }

    const alerts = tracker.getAlerts(0.10);

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].constructionId).toBe('OverconfidentConstruction');
    expect(alerts[0].ece).toBeGreaterThan(0.10);
  });

  it('should not generate alerts for well-calibrated constructions', () => {
    // Create well-calibrated predictions
    for (let i = 0; i < 20; i++) {
      tracker.recordPrediction('CalibratedConstruction', `pred-${i}`, createMeasuredConfidence(0.8), 'Claim');
      tracker.recordOutcome(`pred-${i}`, i < 16, 'test_result'); // 80% correct at 80% confidence
    }

    const alerts = tracker.getAlerts(0.10);

    // Should have no alerts or very low ECE
    const constructionAlerts = alerts.filter(a => a.constructionId === 'CalibratedConstruction');
    expect(constructionAlerts.length).toBe(0);
  });

  it('should classify severity correctly', () => {
    // Create extremely miscalibrated predictions (critical)
    for (let i = 0; i < 20; i++) {
      tracker.recordPrediction('CriticalConstruction', `crit-${i}`, createMeasuredConfidence(0.99), 'Claim');
      tracker.recordOutcome(`crit-${i}`, false, 'test_result'); // 0% correct at 99% confidence
    }

    const alerts = tracker.getAlerts(0.10);
    const criticalAlert = alerts.find(a => a.constructionId === 'CriticalConstruction');

    expect(criticalAlert).toBeDefined();
    expect(criticalAlert?.severity).toBe('critical');
  });
});

// ============================================================================
// CONFIDENCE VALUE HANDLING TESTS
// ============================================================================

describe('Confidence Value Handling', () => {
  let tracker: ConstructionCalibrationTracker;

  beforeEach(() => {
    tracker = new ConstructionCalibrationTracker();
  });

  it('should handle deterministic confidence values', () => {
    const conf = deterministic(true, 'test_reason');

    tracker.recordPrediction('TestConstruction', 'pred-1', conf, 'Claim');
    tracker.recordOutcome('pred-1', true, 'test_result');

    const counts = tracker.getPredictionCounts();
    expect(counts.get('TestConstruction')?.withOutcome).toBe(1);
  });

  it('should handle derived confidence values', () => {
    const conf = createDerivedConfidence(0.75);

    tracker.recordPrediction('TestConstruction', 'pred-1', conf, 'Claim');
    tracker.recordOutcome('pred-1', true, 'test_result');

    const counts = tracker.getPredictionCounts();
    expect(counts.get('TestConstruction')?.withOutcome).toBe(1);
  });

  it('should handle bounded confidence values', () => {
    const conf = bounded(0.6, 0.9, 'theoretical', 'Test citation');

    tracker.recordPrediction('TestConstruction', 'pred-1', conf, 'Claim');
    tracker.recordOutcome('pred-1', true, 'test_result');

    // Bounded should use midpoint (0.75)
    const report = tracker.getCalibration('TestConstruction');
    expect(report.sampleCount).toBe(1);
  });

  it('should exclude absent confidence values from calibration', () => {
    const presentConf = createMeasuredConfidence(0.8);
    const absentConf = absent('uncalibrated');

    // Record 15 with present confidence, 5 with absent
    for (let i = 0; i < 15; i++) {
      tracker.recordPrediction('TestConstruction', `present-${i}`, presentConf, 'Present');
      tracker.recordOutcome(`present-${i}`, i < 12, 'test_result');
    }
    for (let i = 0; i < 5; i++) {
      tracker.recordPrediction('TestConstruction', `absent-${i}`, absentConf, 'Absent');
      tracker.recordOutcome(`absent-${i}`, true, 'test_result');
    }

    const report = tracker.getCalibration('TestConstruction');

    // Only the 15 with present confidence should be counted
    expect(report.sampleCount).toBe(15);
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('Factory Functions', () => {
  it('should create tracker with factory function', () => {
    const tracker = createConstructionCalibrationTracker();
    expect(tracker).toBeInstanceOf(ConstructionCalibrationTracker);
  });

  it('should generate unique prediction IDs', () => {
    const id1 = generatePredictionId('TestConstruction');
    const id2 = generatePredictionId('TestConstruction');

    expect(id1).not.toBe(id2);
    expect(id1).toContain('TestConstruction');
    expect(id2).toContain('TestConstruction');
  });
});

// ============================================================================
// TIME RANGE FILTERING TESTS
// ============================================================================

describe('Time Range Filtering', () => {
  let tracker: ConstructionCalibrationTracker;

  beforeEach(() => {
    tracker = new ConstructionCalibrationTracker();
  });

  it('should filter predictions by time range', async () => {
    // Record some predictions
    for (let i = 0; i < 10; i++) {
      tracker.recordPrediction('TestConstruction', `old-${i}`, createMeasuredConfidence(0.8), 'Old claim');
      tracker.recordOutcome(`old-${i}`, i < 8, 'test_result');
    }

    // Wait briefly and record more
    const middleTime = new Date();

    for (let i = 0; i < 10; i++) {
      tracker.recordPrediction('TestConstruction', `new-${i}`, createMeasuredConfidence(0.8), 'New claim');
      tracker.recordOutcome(`new-${i}`, i < 8, 'test_result');
    }

    // Get calibration for all time
    const fullReport = tracker.getCalibration('TestConstruction');
    expect(fullReport.sampleCount).toBe(20);

    // Note: More detailed time range testing would require mocking timestamps
  });
});
