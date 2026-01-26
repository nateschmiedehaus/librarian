/**
 * @fileoverview Calibration-Evidence Ledger Integration
 *
 * Bridges the calibration system with the Evidence Ledger for:
 * - Recording calibration events as evidence
 * - Querying historical calibration data
 * - Tracking outcome predictions for recalibration
 *
 * @packageDocumentation
 */

import type {
  IEvidenceLedger,
  CalibrationEvidence,
  OutcomeEvidence,
  EvidenceEntry,
} from '../epistemics/evidence_ledger.js';
import type { ConfidenceValue } from '../epistemics/confidence.js';
import { deterministic, bounded, absent } from '../epistemics/confidence.js';
import type {
  CalibrationReport,
  CalibrationClaim,
  CalibrationInput,
  Scope,
} from './calibration.js';
import { computeCalibrationReport, validateCalibration } from './calibration.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A prediction to be tracked for calibration.
 */
export interface TrackedPrediction {
  /** Unique prediction ID */
  predictionId: string;
  /** What was predicted */
  claim: string;
  /** Stated confidence */
  confidence: ConfidenceValue;
  /** Entity this prediction is about */
  entityId?: string;
  /** Category for segmented analysis */
  category?: string;
  /** When the prediction was made */
  predictedAt: Date;
}

/**
 * An observed outcome for a prediction.
 */
export interface ObservedOutcome {
  /** ID of the prediction this outcome is for */
  predictionId: string;
  /** Was the prediction correct? */
  correct: boolean;
  /** How the outcome was verified */
  verificationMethod: 'user_feedback' | 'test_result' | 'system_observation';
  /** Description of what was observed */
  observation: string;
  /** When the outcome was observed */
  observedAt: Date;
}

/**
 * Options for calibration analysis.
 */
export interface CalibrationAnalysisOptions {
  /** Scope of the analysis */
  scope: Scope;
  /** Time range for analysis */
  timeRange?: {
    from?: Date;
    to?: Date;
  };
  /** Minimum predictions required for analysis */
  minPredictions?: number;
  /** Category filter */
  category?: string;
}

// ============================================================================
// CALIBRATION TRACKER
// ============================================================================

/**
 * Tracks predictions and outcomes through the Evidence Ledger for calibration.
 *
 * INVARIANT: All predictions and outcomes are recorded to the ledger
 * INVARIANT: Calibration reports are derived from ledger data
 */
export class CalibrationTracker {
  constructor(private ledger: IEvidenceLedger) {}

  /**
   * Record a prediction for tracking.
   */
  async recordPrediction(prediction: TrackedPrediction): Promise<EvidenceEntry> {
    const confidenceValue = this.getNumericConfidence(prediction.confidence);

    return this.ledger.append({
      kind: 'claim',
      payload: {
        claim: prediction.claim,
        category: 'behavior',
        subject: {
          type: prediction.entityId ? 'function' : 'system',
          identifier: prediction.entityId ?? 'calibration_prediction',
        },
        supportingEvidence: [],
        knownDefeaters: [],
        confidence: prediction.confidence,
      },
      provenance: {
        source: 'system_observation',
        method: 'calibration_tracking',
      },
      relatedEntries: [],
      confidence: prediction.confidence,
    });
  }

  /**
   * Record an observed outcome for a prediction.
   */
  async recordOutcome(
    predictionEntry: EvidenceEntry,
    outcome: Omit<ObservedOutcome, 'predictionId'>
  ): Promise<EvidenceEntry> {
    const confidenceValue = predictionEntry.confidence ?? absent('uncalibrated');

    return this.ledger.append({
      kind: 'outcome',
      payload: {
        predictionId: predictionEntry.id,
        predicted: {
          claim: (predictionEntry.payload as { claim?: string }).claim ?? '',
          confidence: confidenceValue,
        },
        actual: {
          outcome: outcome.correct ? 'correct' : 'incorrect',
          observation: outcome.observation,
        },
        verificationMethod: outcome.verificationMethod,
      } satisfies OutcomeEvidence,
      provenance: {
        source: 'system_observation',
        method: outcome.verificationMethod,
      },
      relatedEntries: [predictionEntry.id],
      confidence: deterministic(true, 'observed_outcome'),
    });
  }

  /**
   * Compute calibration from ledger data and record the report.
   */
  async computeAndRecordCalibration(
    options: CalibrationAnalysisOptions
  ): Promise<{ report: CalibrationReport; entry: EvidenceEntry }> {
    // Get outcome entries from ledger
    const outcomes = await this.ledger.query({
      kinds: ['outcome'],
      timeRange: options.timeRange,
    });

    // Convert to calibration claims
    const claims: CalibrationClaim[] = [];

    for (const entry of outcomes) {
      const payload = entry.payload as OutcomeEvidence;

      // Skip if we can't extract confidence
      const confidence = this.getNumericConfidence(payload.predicted.confidence);
      if (confidence === null) continue;

      // Apply category filter
      const relatedClaim = await this.ledger.get(payload.predictionId);
      if (options.category && relatedClaim) {
        const claimPayload = relatedClaim.payload as { category?: string };
        if (claimPayload.category !== options.category) continue;
      }

      claims.push({
        claimId: payload.predictionId,
        confidence,
        correct: payload.actual.outcome === 'correct',
        entityId: relatedClaim
          ? (relatedClaim.payload as { subject?: { identifier?: string } }).subject?.identifier
          : undefined,
        category: relatedClaim
          ? (relatedClaim.payload as { category?: string }).category
          : undefined,
      });
    }

    // Check minimum predictions
    if (options.minPredictions && claims.length < options.minPredictions) {
      const emptyReport = this.createEmptyReport(options.scope, claims.length);
      const entry = await this.recordCalibrationReport(emptyReport);
      return { report: emptyReport, entry };
    }

    // Get previous report for trend analysis
    const previousReports = await this.ledger.query({
      kinds: ['calibration'],
      limit: 1,
    });

    const previousReport =
      previousReports.length > 0
        ? this.extractReportFromEntry(previousReports[0])
        : undefined;

    // Compute calibration
    const report = computeCalibrationReport({
      claims,
      scope: options.scope,
      previousReport,
    });

    // Record to ledger
    const entry = await this.recordCalibrationReport(report);

    return { report, entry };
  }

  /**
   * Get calibration history from the ledger.
   */
  async getCalibrationHistory(limit = 10): Promise<CalibrationReport[]> {
    const entries = await this.ledger.query({
      kinds: ['calibration'],
      limit,
    });

    return entries.map((e) => this.extractReportFromEntry(e));
  }

  /**
   * Get calibration trend (improving/stable/degrading).
   */
  async getCalibrationTrend(
    windowSize = 5
  ): Promise<{ trend: 'improving' | 'stable' | 'degrading'; samples: number }> {
    const history = await this.getCalibrationHistory(windowSize);

    if (history.length < 2) {
      return { trend: 'stable', samples: history.length };
    }

    // Calculate trend from error values
    // History is in reverse chronological order (newest first)
    // firstHalf = more recent entries, secondHalf = older entries
    const errors = history.map((r) => r.overallCalibrationError);
    const firstHalf = errors.slice(0, Math.floor(errors.length / 2));
    const secondHalf = errors.slice(Math.floor(errors.length / 2));

    const avgRecent = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgOlder = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // Positive delta means older errors were higher (improving)
    // Negative delta means recent errors are higher (degrading)
    const delta = avgOlder - avgRecent;

    if (delta > 0.02) {
      return { trend: 'improving', samples: history.length };
    } else if (delta < -0.02) {
      return { trend: 'degrading', samples: history.length };
    }
    return { trend: 'stable', samples: history.length };
  }

  /**
   * Get Expected Calibration Error (ECE) from recent data.
   */
  async getCurrentECE(options?: { timeRange?: { from?: Date; to?: Date } }): Promise<number | null> {
    const outcomes = await this.ledger.query({
      kinds: ['outcome'],
      timeRange: options?.timeRange,
      limit: 1000,
    });

    if (outcomes.length === 0) return null;

    // Compute ECE directly from outcomes
    let totalError = 0;
    let count = 0;

    for (const entry of outcomes) {
      const payload = entry.payload as OutcomeEvidence;
      const confidence = this.getNumericConfidence(payload.predicted.confidence);
      if (confidence === null) continue;

      const correct = payload.actual.outcome === 'correct' ? 1 : 0;
      totalError += Math.abs(confidence - correct);
      count++;
    }

    return count > 0 ? totalError / count : null;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async recordCalibrationReport(report: CalibrationReport): Promise<EvidenceEntry> {
    const validation = validateCalibration(report);

    return this.ledger.append({
      kind: 'calibration',
      payload: {
        operationType: 'full_calibration',
        predictions: report.buckets.map((b) => ({
          predicted: b.statedMean,
          actual: b.empiricalAccuracy > 0.5,
        })),
        ece: report.overallCalibrationError,
        brierScore: this.computeBrierScore(report),
        sampleSize: report.sampleSize,
      } satisfies CalibrationEvidence,
      provenance: {
        source: 'system_observation',
        method: 'calibration_computation',
      },
      relatedEntries: [],
      confidence: report.sampleSize >= 50
        ? deterministic(true, 'sufficient_sample')
        : bounded(0.5, 0.9, 'theoretical', 'small_sample_size'),
    });
  }

  private computeBrierScore(report: CalibrationReport): number {
    // Brier score approximation from buckets
    let score = 0;
    let total = 0;

    for (const bucket of report.buckets) {
      if (bucket.sampleSize === 0) continue;
      const accuracy = bucket.empiricalAccuracy;
      const stated = bucket.statedMean;
      // Brier = (prediction - outcome)^2
      score += bucket.sampleSize * Math.pow(stated - accuracy, 2);
      total += bucket.sampleSize;
    }

    return total > 0 ? score / total : 0;
  }

  private getNumericConfidence(conf: ConfidenceValue): number | null {
    switch (conf.type) {
      case 'deterministic':
      case 'derived':
      case 'measured':
        return conf.value;
      case 'bounded':
        return (conf.low + conf.high) / 2;
      case 'absent':
        return null;
    }
  }

  private extractReportFromEntry(entry: EvidenceEntry): CalibrationReport {
    const payload = entry.payload as CalibrationEvidence;
    return {
      kind: 'CalibrationReport.v1',
      schemaVersion: 1,
      generatedAt: entry.timestamp.toISOString(),
      scope: { kind: 'workspace', paths: [] },
      sampleSize: payload.sampleSize,
      overallCalibrationError: payload.ece,
      buckets: [],
      overconfidentBuckets: [],
      underconfidentBuckets: [],
    };
  }

  private createEmptyReport(scope: Scope, sampleSize: number): CalibrationReport {
    return {
      kind: 'CalibrationReport.v1',
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      scope,
      sampleSize,
      overallCalibrationError: 0,
      buckets: [],
      overconfidentBuckets: [],
      underconfidentBuckets: [],
    };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a calibration tracker that uses the Evidence Ledger.
 */
export function createCalibrationTracker(ledger: IEvidenceLedger): CalibrationTracker {
  return new CalibrationTracker(ledger);
}
