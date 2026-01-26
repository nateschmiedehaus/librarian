import { describe, it, expect } from 'vitest';
import type { LibrarianStorage } from '../../storage/types.js';
import { bounded } from '../confidence.js';
import { computeCalibrationCurve, buildCalibrationReport } from '../calibration.js';
import { createClaimOutcomeTracker } from '../outcomes.js';

class MockStorage implements Pick<LibrarianStorage, 'getState' | 'setState'> {
  private state = new Map<string, string>();

  async getState(key: string): Promise<string | null> {
    return this.state.get(key) ?? null;
  }

  async setState(key: string, value: string): Promise<void> {
    this.state.set(key, value);
  }
}

describe('calibration curves', () => {
  it('computes bucket accuracy and ECE from samples', () => {
    const curve = computeCalibrationCurve(
      [
        { confidence: 0.05, outcome: 0 },
        { confidence: 0.15, outcome: 1 },
        { confidence: 0.25, outcome: 1 },
        { confidence: 0.85, outcome: 0 },
        { confidence: 0.95, outcome: 1 },
      ],
      { bucketCount: 5 }
    );

    expect(curve.sampleSize).toBe(5);
    expect(curve.ece).toBeCloseTo(0.47, 4);
    expect(curve.mce).toBeCloseTo(0.75, 4);
    expect(curve.overconfidenceRatio).toBeCloseTo(0.4, 4);

    const bucketLow = curve.buckets.find((bucket) => bucket.confidenceBucket === 0.2);
    const bucketHigh = curve.buckets.find((bucket) => bucket.confidenceBucket === 1.0);

    expect(bucketLow?.sampleSize).toBe(2);
    expect(bucketLow?.statedMean).toBeCloseTo(0.1, 4);
    expect(bucketLow?.empiricalAccuracy).toBeCloseTo(0.5, 4);
    expect(bucketLow?.standardError).toBeCloseTo(0.3536, 4);

    expect(bucketHigh?.sampleSize).toBe(2);
    expect(bucketHigh?.statedMean).toBeCloseTo(0.9, 4);
    expect(bucketHigh?.empiricalAccuracy).toBeCloseTo(0.5, 4);

    const report = buildCalibrationReport('dataset_test', curve, new Date('2026-01-26T00:00:00Z'));
    expect(report.datasetId).toBe('dataset_test');
    expect(report.calibrationCurve.get(0.2)).toBeCloseTo(0.5, 4);
    expect(report.adjustments.get('[0.00, 0.20)')).toMatchObject({
      raw: 0.1,
      calibrated: 0.5,
    });
  });

  it('computes and stores calibration reports from claim outcomes', async () => {
    const storage = new MockStorage();
    const tracker = createClaimOutcomeTracker(storage as unknown as LibrarianStorage);

    const { record: claimA } = await tracker.recordClaim({
      claim: 'endpoint returns 200',
      claimType: 'behavioral',
      statedConfidence: bounded(0.6, 0.8, 'theoretical', 'static_analysis'),
      category: 'behavior',
    });
    const { record: claimB } = await tracker.recordClaim({
      claim: 'error handling is correct',
      claimType: 'behavioral',
      statedConfidence: bounded(0.2, 0.4, 'theoretical', 'static_analysis'),
      category: 'behavior',
    });

    await tracker.recordOutcome({
      claimId: claimA.id,
      outcome: 'correct',
      verifiedBy: 'automated_test',
      observation: 'integration test passed',
    });
    await tracker.recordOutcome({
      claimId: claimB.id,
      outcome: 'incorrect',
      verifiedBy: 'automated_test',
      observation: 'test failed',
    });

    const { report, snapshot } = await tracker.computeCalibrationReport({
      datasetId: 'outcome_dataset',
      bucketCount: 2,
      claimType: 'behavioral',
      category: 'behavior',
    });

    expect(report.sampleSize).toBe(2);
    expect(report.expectedCalibrationError).toBeCloseTo(0.3, 4);
    expect(report.maximumCalibrationError).toBeCloseTo(0.3, 4);
    expect(snapshot.datasetId).toBe('outcome_dataset');
    expect(snapshot.bucketCount).toBe(2);

    const history = await tracker.listCalibrationReports(5);
    expect(history.length).toBe(1);
    expect(history[0]?.expectedCalibrationError).toBeCloseTo(0.3, 4);
  });
});
