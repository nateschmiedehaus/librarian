/**
 * @fileoverview Tests for Stage Calibration Wiring
 *
 * Verifies that:
 * 1. Stage calibration can be initialized
 * 2. Predictions can be recorded from stage runners
 * 3. Outcomes can be recorded and linked to predictions
 * 4. Batch outcome recording works for queries
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initStageCalibration,
  isStageCalibrationEnabled,
  recordStagePrediction,
  recordStageOutcome,
  recordQueryOutcomes,
  getPendingOutcomeStats,
  getStageCalibration,
  getStagePredictionCounts,
  resetStageCalibration,
} from '../stage_calibration.js';

describe('Stage Calibration Wiring', () => {
  beforeEach(() => {
    // Initialize calibration without ledger for testing
    initStageCalibration();
  });

  afterEach(() => {
    resetStageCalibration();
  });

  describe('initialization', () => {
    it('should enable stage calibration after initialization', () => {
      expect(isStageCalibrationEnabled()).toBe(true);
    });
  });

  describe('prediction recording', () => {
    it('should record a prediction and return prediction ID', () => {
      const result = recordStagePrediction(
        'test-stage',
        0.75,
        'Test prediction claim',
        { stageId: 'test-stage', queryIntent: 'test query' }
      );

      expect(result.predictionId).toBeDefined();
      expect(result.predictionId).toContain('test-stage');
      expect(result.recorded).toBe(true);
    });

    it('should track predictions in pending outcomes', () => {
      recordStagePrediction(
        'test-stage',
        0.75,
        'Test prediction claim',
        { stageId: 'test-stage' }
      );

      const stats = getPendingOutcomeStats();
      expect(stats.pendingCount).toBe(1);
    });

    it('should track predictions by query ID', () => {
      const queryId = 'query-123';
      recordStagePrediction(
        'test-stage',
        0.75,
        'Test claim 1',
        { stageId: 'test-stage' },
        queryId
      );
      recordStagePrediction(
        'another-stage',
        0.80,
        'Test claim 2',
        { stageId: 'another-stage' },
        queryId
      );

      const stats = getPendingOutcomeStats();
      expect(stats.pendingCount).toBe(2);
      expect(stats.queriesWithPending).toBe(1);
    });
  });

  describe('outcome recording', () => {
    it('should record outcome for a prediction', () => {
      const { predictionId } = recordStagePrediction(
        'test-stage',
        0.75,
        'Test prediction claim',
        { stageId: 'test-stage' }
      );

      recordStageOutcome(predictionId, true, 'test_result');

      const stats = getPendingOutcomeStats();
      expect(stats.pendingCount).toBe(0);
    });

    it('should record batch outcomes for a query', () => {
      const queryId = 'query-456';
      recordStagePrediction('stage-1', 0.75, 'Claim 1', { stageId: 'stage-1' }, queryId);
      recordStagePrediction('stage-2', 0.80, 'Claim 2', { stageId: 'stage-2' }, queryId);
      recordStagePrediction('stage-3', 0.85, 'Claim 3', { stageId: 'stage-3' }, queryId);

      expect(getPendingOutcomeStats().pendingCount).toBe(3);

      recordQueryOutcomes(queryId, true, 'user_feedback');

      expect(getPendingOutcomeStats().pendingCount).toBe(0);
    });
  });

  describe('calibration tracking', () => {
    it('should track predictions by construction/stage', () => {
      recordStagePrediction('refactoring-safety-stage', 0.75, 'Safe refactoring', { stageId: 'refactoring-safety-stage' });
      recordStagePrediction('refactoring-safety-stage', 0.80, 'Another safe refactoring', { stageId: 'refactoring-safety-stage' });
      recordStagePrediction('security-audit-stage', 0.70, 'No vulnerabilities', { stageId: 'security-audit-stage' });

      const counts = getStagePredictionCounts();
      expect(counts.get('refactoring-safety-stage')?.total).toBe(2);
      expect(counts.get('security-audit-stage')?.total).toBe(1);
    });

    it('should return calibration report for a stage', () => {
      // Record predictions and outcomes
      for (let i = 0; i < 15; i++) {
        const { predictionId } = recordStagePrediction(
          'calibration-test-stage',
          0.75,
          `Prediction ${i}`,
          { stageId: 'calibration-test-stage' }
        );
        recordStageOutcome(predictionId, i < 12, 'test_result'); // 80% success
      }

      const report = getStageCalibration('calibration-test-stage');
      expect(report).not.toBeNull();
      expect(report?.sampleCount).toBe(15);
    });
  });

  describe('edge cases', () => {
    it('should handle outcome for unknown prediction gracefully', () => {
      // Should not throw
      recordStageOutcome('unknown-prediction-id', true, 'test_result');
    });

    it('should handle query outcomes for unknown query gracefully', () => {
      // Should not throw
      recordQueryOutcomes('unknown-query-id', true, 'user_feedback');
    });
  });
});
