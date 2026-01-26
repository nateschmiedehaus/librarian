/**
 * @fileoverview Evaluation Module for Librarian
 *
 * Provides systematic evaluation capabilities:
 * - Retrieval quality metrics (precision, recall, F1, nDCG, MRR, MAP)
 * - Confidence calibration assessment
 * - Latency and throughput tracking
 * - Quality grading and recommendations
 *
 * @packageDocumentation
 */

export {
  // Types
  type MetricType,
  type EvaluationQuery,
  type QueryEvaluationResult,
  type EvaluationReport,
  type AggregateMetric,
  type EvaluationSummary,
  type EvaluationConfig,

  // Constants
  DEFAULT_EVAL_CONFIG,

  // Class
  EvaluationHarness,

  // Factory
  createEvaluationHarness,
} from './harness.js';
