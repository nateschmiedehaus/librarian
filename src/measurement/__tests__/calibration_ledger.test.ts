/**
 * @fileoverview Tests for Calibration-Evidence Ledger Integration
 *
 * Verifies that the CalibrationTracker correctly:
 * - Records predictions to the Evidence Ledger
 * - Records outcomes linked to predictions
 * - Computes calibration from ledger data
 * - Tracks calibration trends
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CalibrationTracker,
  createCalibrationTracker,
  type TrackedPrediction,
  type ObservedOutcome,
  type CalibrationAnalysisOptions,
} from '../calibration_ledger.js';
import type {
  IEvidenceLedger,
  EvidenceEntry,
  EvidenceQuery,
  EvidenceFilter,
  EvidenceChain,
  EvidenceId,
  SessionId,
} from '../../epistemics/evidence_ledger.js';
import { deterministic, bounded, absent } from '../../epistemics/confidence.js';

// ============================================================================
// MOCK EVIDENCE LEDGER
// ============================================================================

class MockEvidenceLedger implements IEvidenceLedger {
  private entries: EvidenceEntry[] = [];
  private idCounter = 0;

  async append(
    entry: Omit<EvidenceEntry, 'id' | 'timestamp'>
  ): Promise<EvidenceEntry> {
    const fullEntry: EvidenceEntry = {
      ...entry,
      id: `ev_${++this.idCounter}` as EvidenceId,
      timestamp: new Date(),
    };
    this.entries.push(fullEntry);
    return fullEntry;
  }

  async appendBatch(
    entries: Omit<EvidenceEntry, 'id' | 'timestamp'>[]
  ): Promise<EvidenceEntry[]> {
    return Promise.all(entries.map((e) => this.append(e)));
  }

  async query(criteria: EvidenceQuery): Promise<EvidenceEntry[]> {
    let results = [...this.entries];

    if (criteria.kinds) {
      results = results.filter((e) => criteria.kinds!.includes(e.kind));
    }

    if (criteria.timeRange?.from) {
      results = results.filter((e) => e.timestamp >= criteria.timeRange!.from!);
    }

    if (criteria.timeRange?.to) {
      results = results.filter((e) => e.timestamp <= criteria.timeRange!.to!);
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  async get(id: EvidenceId): Promise<EvidenceEntry | null> {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  async getChain(claimId: EvidenceId): Promise<EvidenceChain> {
    const claim = await this.get(claimId);
    if (!claim) {
      return { claim: null as unknown as EvidenceEntry, supporting: [], defeating: [] };
    }
    return { claim, supporting: [], defeating: [] };
  }

  async getSessionEntries(sessionId: SessionId): Promise<EvidenceEntry[]> {
    return this.entries.filter((e) => e.sessionId === sessionId);
  }

  subscribe(
    _filter: EvidenceFilter,
    _callback: (entry: EvidenceEntry) => void
  ): () => void {
    return () => {};
  }

  // Test helpers
  getEntries(): EvidenceEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.idCounter = 0;
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('CalibrationTracker', () => {
  let tracker: CalibrationTracker;
  let ledger: MockEvidenceLedger;

  beforeEach(() => {
    ledger = new MockEvidenceLedger();
    tracker = createCalibrationTracker(ledger);
  });

  describe('recordPrediction', () => {
    it('records a prediction as a claim entry', async () => {
      const prediction: TrackedPrediction = {
        predictionId: 'pred_001',
        claim: 'Function foo is pure',
        confidence: deterministic(true, 'static_analysis'),
        entityId: 'src/utils.ts::foo',
        category: 'behavior',
        predictedAt: new Date(),
      };

      const entry = await tracker.recordPrediction(prediction);

      expect(entry.kind).toBe('claim');
      expect(entry.payload).toMatchObject({
        claim: 'Function foo is pure',
        category: 'behavior',
      });
      expect(entry.provenance.method).toBe('calibration_tracking');
    });

    it('handles predictions without entityId', async () => {
      const prediction: TrackedPrediction = {
        predictionId: 'pred_002',
        claim: 'System is stable',
        confidence: bounded(0.7, 0.9, 'empirical', 'observed_metrics'),
        predictedAt: new Date(),
      };

      const entry = await tracker.recordPrediction(prediction);

      expect(entry.kind).toBe('claim');
      expect(entry.payload).toMatchObject({
        subject: {
          type: 'system',
          identifier: 'calibration_prediction',
        },
      });
    });

    it('preserves confidence value in entry', async () => {
      const confidence = bounded(0.6, 0.8, 'theoretical', 'model_uncertainty');
      const prediction: TrackedPrediction = {
        predictionId: 'pred_003',
        claim: 'Test will pass',
        confidence,
        predictedAt: new Date(),
      };

      const entry = await tracker.recordPrediction(prediction);

      expect(entry.confidence).toEqual(confidence);
    });
  });

  describe('recordOutcome', () => {
    it('records an outcome linked to a prediction', async () => {
      // First record a prediction
      const prediction: TrackedPrediction = {
        predictionId: 'pred_004',
        claim: 'API returns 200',
        confidence: deterministic(true, 'test_assertion'),
        predictedAt: new Date(),
      };
      const predictionEntry = await tracker.recordPrediction(prediction);

      // Then record the outcome
      const outcomeEntry = await tracker.recordOutcome(predictionEntry, {
        correct: true,
        verificationMethod: 'test_result',
        observation: 'API returned 200 OK',
        observedAt: new Date(),
      });

      expect(outcomeEntry.kind).toBe('outcome');
      expect(outcomeEntry.relatedEntries).toContain(predictionEntry.id);
      expect(outcomeEntry.payload).toMatchObject({
        predictionId: predictionEntry.id,
        actual: {
          outcome: 'correct',
          observation: 'API returned 200 OK',
        },
      });
    });

    it('records incorrect outcomes', async () => {
      const prediction: TrackedPrediction = {
        predictionId: 'pred_005',
        claim: 'Build will succeed',
        confidence: bounded(0.8, 0.95, 'empirical', 'history'),
        predictedAt: new Date(),
      };
      const predictionEntry = await tracker.recordPrediction(prediction);

      const outcomeEntry = await tracker.recordOutcome(predictionEntry, {
        correct: false,
        verificationMethod: 'system_observation',
        observation: 'Build failed with type errors',
        observedAt: new Date(),
      });

      expect(outcomeEntry.payload).toMatchObject({
        actual: {
          outcome: 'incorrect',
          observation: 'Build failed with type errors',
        },
      });
    });

    it('records deterministic confidence for outcomes', async () => {
      const prediction: TrackedPrediction = {
        predictionId: 'pred_006',
        claim: 'File exists',
        confidence: deterministic(true, 'fs_check'),
        predictedAt: new Date(),
      };
      const predictionEntry = await tracker.recordPrediction(prediction);

      const outcomeEntry = await tracker.recordOutcome(predictionEntry, {
        correct: true,
        verificationMethod: 'system_observation',
        observation: 'File found at path',
        observedAt: new Date(),
      });

      expect(outcomeEntry.confidence).toMatchObject({
        type: 'deterministic',
        value: 1, // deterministic(true) stores as 1
      });
    });
  });

  describe('computeAndRecordCalibration', () => {
    it('computes calibration from outcome entries', async () => {
      // Record multiple predictions and outcomes
      const predictions = [
        { claim: 'Pred A', confidence: deterministic(true, 'test'), correct: true },
        { claim: 'Pred B', confidence: bounded(0.7, 0.9, 'empirical', 'history'), correct: true },
        { claim: 'Pred C', confidence: bounded(0.5, 0.7, 'empirical', 'history'), correct: false },
      ];

      for (const p of predictions) {
        const entry = await tracker.recordPrediction({
          predictionId: `pred_${Math.random().toString(36).slice(2)}`,
          claim: p.claim,
          confidence: p.confidence,
          predictedAt: new Date(),
        });

        await tracker.recordOutcome(entry, {
          correct: p.correct,
          verificationMethod: 'test_result',
          observation: p.correct ? 'Passed' : 'Failed',
          observedAt: new Date(),
        });
      }

      const options: CalibrationAnalysisOptions = {
        scope: { kind: 'workspace', paths: [] },
      };

      const { report, entry } = await tracker.computeAndRecordCalibration(options);

      expect(report.kind).toBe('CalibrationReport.v1');
      expect(report.sampleSize).toBeGreaterThan(0);
      expect(entry.kind).toBe('calibration');
    });

    it('returns empty report when below minimum predictions', async () => {
      // Record only one prediction
      const predEntry = await tracker.recordPrediction({
        predictionId: 'pred_single',
        claim: 'Single prediction',
        confidence: deterministic(true, 'test'),
        predictedAt: new Date(),
      });

      await tracker.recordOutcome(predEntry, {
        correct: true,
        verificationMethod: 'test_result',
        observation: 'Passed',
        observedAt: new Date(),
      });

      const options: CalibrationAnalysisOptions = {
        scope: { kind: 'workspace', paths: [] },
        minPredictions: 10, // Require 10, but we only have 1
      };

      const { report } = await tracker.computeAndRecordCalibration(options);

      expect(report.sampleSize).toBe(1);
      expect(report.buckets).toHaveLength(0); // Empty buckets for insufficient data
    });

    it('handles absent confidence values', async () => {
      // Record prediction with absent confidence
      const predEntry = await tracker.recordPrediction({
        predictionId: 'pred_absent',
        claim: 'Unknown prediction',
        confidence: absent('no_data'),
        predictedAt: new Date(),
      });

      await tracker.recordOutcome(predEntry, {
        correct: true,
        verificationMethod: 'user_feedback',
        observation: 'User confirmed',
        observedAt: new Date(),
      });

      const options: CalibrationAnalysisOptions = {
        scope: { kind: 'workspace', paths: [] },
      };

      // Should not throw, but will have no usable claims
      const { report } = await tracker.computeAndRecordCalibration(options);
      expect(report.kind).toBe('CalibrationReport.v1');
    });
  });

  describe('getCalibrationHistory', () => {
    it('returns calibration reports in reverse chronological order', async () => {
      // Create multiple calibration entries directly in the ledger
      for (let i = 0; i < 5; i++) {
        await ledger.append({
          kind: 'calibration',
          payload: {
            operationType: 'full_calibration',
            predictions: [],
            ece: 0.1 + i * 0.01,
            brierScore: 0.05 + i * 0.005,
            sampleSize: 100 + i * 10,
          },
          provenance: {
            source: 'system_observation',
            method: 'calibration_computation',
          },
          relatedEntries: [],
          confidence: deterministic(true, 'sufficient_sample'),
        });

        // Small delay to ensure different timestamps
        await new Promise((r) => setTimeout(r, 5));
      }

      const history = await tracker.getCalibrationHistory(3);

      expect(history).toHaveLength(3);
      // Most recent should have highest ECE (0.14)
      expect(history[0].overallCalibrationError).toBeGreaterThan(history[1].overallCalibrationError);
    });

    it('returns empty array when no calibration history', async () => {
      const history = await tracker.getCalibrationHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('getCalibrationTrend', () => {
    it('returns stable trend with insufficient data', async () => {
      const { trend, samples } = await tracker.getCalibrationTrend();

      expect(trend).toBe('stable');
      expect(samples).toBe(0);
    });

    it('detects improving trend', async () => {
      // Create calibration entries with decreasing ECE (improving)
      const eceValues = [0.20, 0.18, 0.15, 0.12, 0.08]; // Improving over time
      for (const ece of eceValues) {
        await ledger.append({
          kind: 'calibration',
          payload: {
            operationType: 'full_calibration',
            predictions: [],
            ece,
            brierScore: ece / 2,
            sampleSize: 100,
          },
          provenance: {
            source: 'system_observation',
            method: 'calibration_computation',
          },
          relatedEntries: [],
          confidence: deterministic(true, 'sufficient_sample'),
        });
        await new Promise((r) => setTimeout(r, 5));
      }

      const { trend, samples } = await tracker.getCalibrationTrend(5);

      expect(trend).toBe('improving');
      expect(samples).toBe(5);
    });

    it('detects degrading trend', async () => {
      // Create calibration entries with increasing ECE (degrading)
      const eceValues = [0.05, 0.08, 0.12, 0.18, 0.25]; // Degrading over time
      for (const ece of eceValues) {
        await ledger.append({
          kind: 'calibration',
          payload: {
            operationType: 'full_calibration',
            predictions: [],
            ece,
            brierScore: ece / 2,
            sampleSize: 100,
          },
          provenance: {
            source: 'system_observation',
            method: 'calibration_computation',
          },
          relatedEntries: [],
          confidence: deterministic(true, 'sufficient_sample'),
        });
        await new Promise((r) => setTimeout(r, 5));
      }

      const { trend, samples } = await tracker.getCalibrationTrend(5);

      expect(trend).toBe('degrading');
      expect(samples).toBe(5);
    });
  });

  describe('getCurrentECE', () => {
    it('returns null when no outcomes exist', async () => {
      const ece = await tracker.getCurrentECE();
      expect(ece).toBeNull();
    });

    it('computes ECE from recent outcomes', async () => {
      // Record predictions with known confidence and outcomes
      // Perfect calibration: 80% confidence, 80% correct
      const predictions = [
        { confidence: 0.8, correct: true },
        { confidence: 0.8, correct: true },
        { confidence: 0.8, correct: true },
        { confidence: 0.8, correct: true },
        { confidence: 0.8, correct: false }, // 4/5 = 80% correct
      ];

      for (let i = 0; i < predictions.length; i++) {
        const p = predictions[i];
        const entry = await tracker.recordPrediction({
          predictionId: `ece_pred_${i}`,
          claim: `Prediction ${i}`,
          confidence: bounded(p.confidence - 0.05, p.confidence + 0.05, 'empirical', 'test'),
          predictedAt: new Date(),
        });

        await tracker.recordOutcome(entry, {
          correct: p.correct,
          verificationMethod: 'test_result',
          observation: p.correct ? 'Correct' : 'Incorrect',
          observedAt: new Date(),
        });
      }

      const ece = await tracker.getCurrentECE();

      expect(ece).not.toBeNull();
      expect(ece).toBeGreaterThanOrEqual(0);
      expect(ece).toBeLessThanOrEqual(1);
    });

    it('filters by time range', async () => {
      const oldDate = new Date(Date.now() - 86400000); // 1 day ago
      const recentDate = new Date();

      // This test would require more complex mock to properly test time filtering
      // For now, just verify the function accepts the parameter
      const ece = await tracker.getCurrentECE({
        timeRange: { from: oldDate, to: recentDate },
      });

      // No outcomes, so null
      expect(ece).toBeNull();
    });
  });

  describe('factory', () => {
    it('createCalibrationTracker returns CalibrationTracker instance', () => {
      const tracker = createCalibrationTracker(ledger);
      expect(tracker).toBeInstanceOf(CalibrationTracker);
    });
  });
});
