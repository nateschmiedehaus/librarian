/**
 * @fileoverview Principled Confidence Type System
 *
 * Implements the ConfidenceValue type from track-d-quantification.md.
 *
 * CORE PRINCIPLE: No arbitrary numbers. Every confidence value MUST have provenance.
 *
 * The old `placeholder(0.7, 'id')` approach was documentation theater - a labeled
 * guess is still a guess. This principled approach forces either honest uncertainty
 * (`absent`) or real provenance (`measured`, `derived`, `deterministic`, `bounded`).
 *
 * @packageDocumentation
 */

import type { CalibrationAdjustmentOptions, CalibrationReport } from './calibration.js';
import { adjustConfidenceScore } from './calibration.js';

// ============================================================================
// CONFIDENCE VALUE TYPES
// ============================================================================

/**
 * A confidence value with MANDATORY provenance.
 * Raw numbers are NOT allowed - every value must explain its origin.
 *
 * This replaces the old `QuantifiedValue` and eliminates the "placeholder" escape hatch.
 */
export type ConfidenceValue =
  | DeterministicConfidence
  | DerivedConfidence
  | MeasuredConfidence
  | BoundedConfidence
  | AbsentConfidence;

/**
 * Logically certain: 1.0 (definitely true) or 0.0 (definitely false)
 *
 * Use for: syntactic operations, parse success/failure, exact matches
 *
 * RULE: If an operation is deterministic, its confidence MUST be 1.0 or 0.0.
 * There is no uncertainty in whether a parse succeeded.
 */
export interface DeterministicConfidence {
  readonly type: 'deterministic';
  readonly value: 1.0 | 0.0;
  readonly reason: string; // "ast_parse_succeeded" / "exact_string_match"
}

/**
 * Computed from other confidence values via explicit formula.
 *
 * Use for: composed operations, pipelines, aggregations
 *
 * RULE: The formula must be mathematically valid and all inputs must be
 * ConfidenceValue (not raw numbers).
 */
export interface DerivedConfidence {
  readonly type: 'derived';
  readonly value: number; // 0.0 to 1.0, computed from formula
  readonly formula: string; // e.g., "min(step1, step2)" or "step1 * step2"
  readonly inputs: ReadonlyArray<{ name: string; confidence: ConfidenceValue }>;
}

/**
 * Empirically measured from historical outcomes.
 *
 * Use for: LLM operations after calibration, any operation with outcome data
 *
 * RULE: Must have actual measurement data. If you don't have data, use Absent.
 */
export interface MeasuredConfidence {
  readonly type: 'measured';
  readonly value: number;
  readonly measurement: {
    readonly datasetId: string;
    readonly sampleSize: number;
    readonly accuracy: number;
    readonly confidenceInterval: readonly [number, number]; // 95% CI
    readonly measuredAt: string; // ISO date
  };
}

/**
 * Range estimate with EXPLICIT basis.
 *
 * Use for: operations with theoretical bounds but no empirical data yet
 *
 * RULE: Must have citation or principled derivation. No guessing.
 */
export interface BoundedConfidence {
  readonly type: 'bounded';
  readonly low: number;
  readonly high: number;
  readonly basis: 'theoretical' | 'literature' | 'formal_analysis';
  readonly citation: string; // Paper, formal proof, or explicit reasoning
}

/**
 * Confidence is genuinely unknown.
 *
 * Use for: operations before calibration, new primitives
 *
 * RULE: System must handle operations without confidence values gracefully.
 * This is the HONEST state - we don't know yet.
 */
export interface AbsentConfidence {
  readonly type: 'absent';
  readonly reason: 'uncalibrated' | 'insufficient_data' | 'not_applicable';
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isDeterministicConfidence(value: ConfidenceValue): value is DeterministicConfidence {
  return value.type === 'deterministic';
}

export function isDerivedConfidence(value: ConfidenceValue): value is DerivedConfidence {
  return value.type === 'derived';
}

export function isMeasuredConfidence(value: ConfidenceValue): value is MeasuredConfidence {
  return value.type === 'measured';
}

export function isBoundedConfidence(value: ConfidenceValue): value is BoundedConfidence {
  return value.type === 'bounded';
}

export function isAbsentConfidence(value: ConfidenceValue): value is AbsentConfidence {
  return value.type === 'absent';
}

export function isConfidenceValue(value: unknown): value is ConfidenceValue {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown };
  return (
    candidate.type === 'deterministic' ||
    candidate.type === 'derived' ||
    candidate.type === 'measured' ||
    candidate.type === 'bounded' ||
    candidate.type === 'absent'
  );
}

// ============================================================================
// DERIVATION RULES (D1-D6)
// ============================================================================

/**
 * D1: Syntactic Operations → Deterministic
 *
 * AST parsing, regex matching, file reading - ALWAYS 1.0 or 0.0
 */
export function syntacticConfidence(success: boolean): DeterministicConfidence {
  return {
    type: 'deterministic',
    value: success ? 1.0 : 0.0,
    reason: success ? 'operation_succeeded' : 'operation_failed',
  };
}

/**
 * D2: Sequential Composition → min(steps)
 *
 * Sequential pipeline: confidence = minimum of steps (weakest link)
 */
export function sequenceConfidence(steps: ConfidenceValue[]): ConfidenceValue {
  if (steps.length === 0) {
    return { type: 'absent', reason: 'insufficient_data' };
  }

  // If any step has absent confidence, the sequence is degraded
  const values = steps.map(getNumericValue);
  if (values.some((v) => v === null)) {
    return {
      type: 'absent',
      reason: 'uncalibrated',
    };
  }

  const minValue = Math.min(...(values.filter((v): v is number => v !== null)));

  return {
    type: 'derived',
    value: minValue,
    formula: 'min(steps)',
    inputs: steps.map((s, i) => ({ name: `step_${i}`, confidence: s })),
  };
}

/**
 * D3: Parallel-All Composition → product(branches)
 *
 * All branches must succeed: confidence = product (independent AND)
 */
export function parallelAllConfidence(branches: ConfidenceValue[]): ConfidenceValue {
  if (branches.length === 0) {
    return { type: 'absent', reason: 'insufficient_data' };
  }

  const values = branches.map(getNumericValue);
  if (values.some((v) => v === null)) {
    return {
      type: 'absent',
      reason: 'uncalibrated',
    };
  }

  const product = (values.filter((v): v is number => v !== null)).reduce((a, b) => a * b, 1);

  return {
    type: 'derived',
    value: product,
    formula: 'product(branches)',
    inputs: branches.map((b, i) => ({ name: `branch_${i}`, confidence: b })),
  };
}

/**
 * D4: Parallel-Any Composition → 1 - product(1 - branches)
 *
 * Any branch can succeed: confidence = 1 - product of failures (independent OR)
 */
export function parallelAnyConfidence(branches: ConfidenceValue[]): ConfidenceValue {
  if (branches.length === 0) {
    return { type: 'absent', reason: 'insufficient_data' };
  }

  const values = branches.map(getNumericValue);
  if (values.some((v) => v === null)) {
    return {
      type: 'absent',
      reason: 'uncalibrated',
    };
  }

  const validValues = values.filter((v): v is number => v !== null);
  const failureProduct = validValues.map((v) => 1 - v).reduce((a, b) => a * b, 1);

  return {
    type: 'derived',
    value: 1 - failureProduct,
    formula: '1 - product(1 - branches)',
    inputs: branches.map((b, i) => ({ name: `branch_${i}`, confidence: b })),
  };
}

/**
 * D5: LLM Operations Before Calibration → Absent
 *
 * BEFORE any calibration data exists - be honest
 */
export function uncalibratedConfidence(): AbsentConfidence {
  return {
    type: 'absent',
    reason: 'uncalibrated',
  };
}

/**
 * D6: LLM Operations After Calibration → Measured
 *
 * AFTER calibration with real outcome data
 */
export interface CalibrationResult {
  datasetId: string;
  sampleSize: number;
  accuracy: number;
  ci95: readonly [number, number];
}

export function measuredConfidence(data: CalibrationResult): MeasuredConfidence {
  return {
    type: 'measured',
    value: data.accuracy,
    measurement: {
      datasetId: data.datasetId,
      sampleSize: data.sampleSize,
      accuracy: data.accuracy,
      confidenceInterval: data.ci95,
      measuredAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// CALIBRATION ADJUSTMENT (Track F C3)
// ============================================================================

export interface ConfidenceAdjustmentResult {
  confidence: ConfidenceValue;
  raw: number | null;
  calibrated: number | null;
  weight: number;
  status: 'uncalibrated' | 'calibrating' | 'calibrated';
  datasetId?: string;
}

export function adjustConfidenceValue(
  confidence: ConfidenceValue,
  report: CalibrationReport,
  options: CalibrationAdjustmentOptions = {}
): ConfidenceAdjustmentResult {
  const raw = getNumericValue(confidence);
  if (raw === null) {
    return {
      confidence,
      raw: null,
      calibrated: null,
      weight: 0,
      status: 'uncalibrated',
      datasetId: report.datasetId,
    };
  }

  const adjustment = adjustConfidenceScore(raw, report, options);
  const adjusted: ConfidenceValue = {
    type: 'derived',
    value: adjustment.calibrated,
    formula: `calibration_curve:${report.datasetId}`,
    inputs: [{ name: 'raw_confidence', confidence }],
  };

  return {
    confidence: adjusted,
    raw,
    calibrated: adjustment.calibrated,
    weight: adjustment.weight,
    status: resolveCalibrationStatus(report, adjustment.weight),
    datasetId: report.datasetId,
  };
}

// ============================================================================
// DEGRADATION HANDLERS
// ============================================================================

/**
 * Get the numeric value from a ConfidenceValue, or null if absent.
 */
export function getNumericValue(conf: ConfidenceValue): number | null {
  switch (conf.type) {
    case 'deterministic':
    case 'derived':
    case 'measured':
      return conf.value;
    case 'bounded':
      return (conf.low + conf.high) / 2; // Use midpoint
    case 'absent':
      return null;
  }
}

function resolveCalibrationStatus(
  report: CalibrationReport,
  weight: number
): 'uncalibrated' | 'calibrating' | 'calibrated' {
  if (report.sampleSize <= 0) return 'uncalibrated';
  if (weight >= 1) return 'calibrated';
  return 'calibrating';
}

/**
 * Get effective confidence with conservative defaults for absent values.
 *
 * Option B from the spec: Use conservative lower bound
 */
export function getEffectiveConfidence(conf: ConfidenceValue): number {
  switch (conf.type) {
    case 'deterministic':
    case 'derived':
    case 'measured':
      return conf.value;
    case 'bounded':
      return conf.low; // Conservative: use lower bound
    case 'absent':
      return 0.0; // Most conservative: treat as zero confidence
  }
}

/**
 * Select best composition when some have absent confidence.
 *
 * Option A from the spec: Degrade to equal weighting
 */
export function selectWithDegradation<T extends { confidence: ConfidenceValue; id: string }>(
  items: T[]
): T | null {
  if (items.length === 0) {
    return null;
  }

  const withConfidence = items.filter((item) => item.confidence.type !== 'absent');

  if (withConfidence.length === 0) {
    // No confidence data - all options are equally viable
    // Use deterministic selection (alphabetical by id)
    return [...items].sort((a, b) => a.id.localeCompare(b.id))[0];
  }

  // Sort by confidence (those with data)
  return [...withConfidence].sort(
    (a, b) => getEffectiveConfidence(b.confidence) - getEffectiveConfidence(a.confidence)
  )[0];
}

/**
 * Block operations that require confidence above a threshold.
 *
 * Option C from the spec: Block operations requiring confidence
 */
export interface ExecutionBlockResult {
  status: 'allowed' | 'blocked';
  effectiveConfidence: number;
  confidenceType: ConfidenceValue['type'];
  mitigation?: string;
  reason?: string;
}

export function checkConfidenceThreshold(
  conf: ConfidenceValue,
  minConfidence: number
): ExecutionBlockResult {
  const effective = getEffectiveConfidence(conf);

  if (effective >= minConfidence) {
    return {
      status: 'allowed',
      effectiveConfidence: effective,
      confidenceType: conf.type,
    };
  }

  return {
    status: 'blocked',
    effectiveConfidence: effective,
    confidenceType: conf.type,
    reason: `Confidence ${effective.toFixed(2)} below threshold ${minConfidence}`,
    mitigation:
      conf.type === 'absent'
        ? 'Run calibration suite to obtain confidence data'
        : 'Use a higher-confidence primitive',
  };
}

/**
 * Report the confidence status for user visibility.
 */
export interface ConfidenceStatusReport {
  type: ConfidenceValue['type'];
  numericValue: number | null;
  isCalibrated: boolean;
  explanation: string;
}

export function reportConfidenceStatus(conf: ConfidenceValue): ConfidenceStatusReport {
  const numericValue = getNumericValue(conf);
  const isCalibrated = conf.type === 'measured';

  let explanation: string;
  switch (conf.type) {
    case 'deterministic':
      explanation = `Logically certain (${conf.reason})`;
      break;
    case 'derived':
      explanation = `Computed via ${conf.formula} from ${conf.inputs.length} inputs`;
      break;
    case 'measured':
      explanation = `Calibrated from ${conf.measurement.sampleSize} samples (${(conf.measurement.accuracy * 100).toFixed(1)}% accuracy)`;
      break;
    case 'bounded':
      explanation = `Bounded [${conf.low}, ${conf.high}] based on ${conf.basis}: ${conf.citation}`;
      break;
    case 'absent':
      explanation = `Unknown confidence (${conf.reason})`;
      break;
  }

  return {
    type: conf.type,
    numericValue,
    isCalibrated,
    explanation,
  };
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a deterministic confidence value.
 */
export function deterministic(success: boolean, reason: string): DeterministicConfidence {
  return {
    type: 'deterministic',
    value: success ? 1.0 : 0.0,
    reason,
  };
}

/**
 * Create a bounded confidence value.
 */
export function bounded(
  low: number,
  high: number,
  basis: 'theoretical' | 'literature' | 'formal_analysis',
  citation: string
): BoundedConfidence {
  if (low > high) {
    throw new Error(`Bounded confidence: low (${low}) must be <= high (${high})`);
  }
  if (low < 0 || high > 1) {
    throw new Error(`Bounded confidence: values must be in [0, 1], got [${low}, ${high}]`);
  }
  return {
    type: 'bounded',
    low,
    high,
    basis,
    citation,
  };
}

/**
 * Create an absent confidence value.
 */
export function absent(
  reason: 'uncalibrated' | 'insufficient_data' | 'not_applicable' = 'uncalibrated'
): AbsentConfidence {
  return {
    type: 'absent',
    reason,
  };
}

// ============================================================================
// D7 BOUNDARY ENFORCEMENT UTILITIES
// ============================================================================

/**
 * Combine multiple confidence values with weights.
 *
 * D7 compliant: Produces derived confidence with full provenance.
 */
export function combinedConfidence(
  inputs: Array<{ confidence: ConfidenceValue; weight: number; name: string }>
): ConfidenceValue {
  if (inputs.length === 0) {
    return { type: 'absent', reason: 'insufficient_data' };
  }

  // Filter to only present confidences
  const presentInputs = inputs.filter(
    (i) => i.confidence.type !== 'absent'
  );

  if (presentInputs.length === 0) {
    return { type: 'absent', reason: 'uncalibrated' };
  }

  const totalWeight = presentInputs.reduce((sum, i) => sum + i.weight, 0);
  const weightedValue = presentInputs.reduce((sum, i) => {
    const value = getNumericValue(i.confidence);
    return sum + (value ?? 0) * i.weight;
  }, 0) / totalWeight;

  return {
    type: 'derived',
    value: Math.max(0, Math.min(1, weightedValue)),
    formula: 'weighted_average',
    inputs: presentInputs.map((i) => ({
      name: i.name,
      confidence: i.confidence,
    })),
  };
}

/**
 * Apply temporal decay to confidence.
 *
 * D7 compliant: Produces derived confidence with decay provenance.
 */
export function applyDecay(
  confidence: ConfidenceValue,
  ageMs: number,
  halfLifeMs: number
): ConfidenceValue {
  if (confidence.type === 'absent') return confidence;

  const currentValue = getNumericValue(confidence);
  if (currentValue === null) return confidence;

  const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);
  const decayedValue = currentValue * decayFactor;

  return {
    type: 'derived',
    value: decayedValue,
    formula: `decay(${decayFactor.toFixed(4)})`,
    inputs: [
      { name: 'original', confidence },
      {
        name: 'decay_factor',
        confidence: {
          type: 'deterministic',
          value: decayFactor >= 0.5 ? 1.0 : 0.0,
          reason: `age_${ageMs}ms_halflife_${halfLifeMs}ms`,
        },
      },
    ],
  };
}

/**
 * Compose confidence through logical AND (minimum).
 *
 * D7 compliant: Produces derived confidence.
 */
export function andConfidence(a: ConfidenceValue, b: ConfidenceValue): ConfidenceValue {
  if (a.type === 'absent') return a;
  if (b.type === 'absent') return b;

  const aVal = getNumericValue(a);
  const bVal = getNumericValue(b);
  if (aVal === null || bVal === null) {
    return { type: 'absent', reason: 'insufficient_data' };
  }

  return {
    type: 'derived',
    value: Math.min(aVal, bVal),
    formula: 'min(a, b)',
    inputs: [
      { name: 'a', confidence: a },
      { name: 'b', confidence: b },
    ],
  };
}

/**
 * Compose confidence through logical OR (maximum).
 *
 * D7 compliant: Produces derived confidence.
 */
export function orConfidence(a: ConfidenceValue, b: ConfidenceValue): ConfidenceValue {
  const aVal = getNumericValue(a);
  const bVal = getNumericValue(b);

  if (aVal !== null && bVal !== null) {
    return {
      type: 'derived',
      value: Math.max(aVal, bVal),
      formula: 'max(a, b)',
      inputs: [
        { name: 'a', confidence: a },
        { name: 'b', confidence: b },
      ],
    };
  }
  if (aVal !== null) return a;
  if (bVal !== null) return b;
  return { type: 'absent', reason: 'insufficient_data' };
}

/**
 * Check if confidence meets a minimum threshold.
 *
 * D7 compliant: Uses getEffectiveConfidence for safe extraction.
 */
export function meetsThreshold(confidence: ConfidenceValue, threshold: number): boolean {
  return getEffectiveConfidence(confidence) >= threshold;
}

/**
 * Type guard to detect raw numeric confidence violations.
 *
 * D7 enforcement: Use this to validate at runtime.
 */
export function assertConfidenceValue(
  value: unknown,
  context: string
): asserts value is ConfidenceValue {
  if (!isConfidenceValue(value)) {
    throw new Error(
      `D7_VIOLATION(${context}): Expected ConfidenceValue, got ${typeof value}. ` +
      `Raw numeric confidence is forbidden - use deterministic(), bounded(), measuredConfidence(), or absent().`
    );
  }
}
