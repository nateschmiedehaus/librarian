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
  type CitationEvidenceRef,
  type CitationInput,
  type CitationAccuracyInput,
  type CitationAccuracyResult,
  computeCitationAccuracy,
} from './citation_accuracy.js';

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

export {
  type GroundTruthCategory,
  type GroundTruthDifficulty,
  type EvidenceRef,
  type CorrectAnswer,
  type GroundTruthQuery,
  type RepoManifest,
  type EvalCorpus,
  type EvalQueryInput,
  type RetrievalResult,
  type SynthesisResult,
  type EvalPipeline,
  type EvalOptions,
  type QueryEvalResult,
  type RetrievalEvalResult,
  type SynthesisEvalResult,
  type EvalReport,
  type EvalMetrics,
  type CategoryMetrics,
  type RegressionReport,
  type RegressionEntry,
  type EvalRunnerDependencies,
  DEFAULT_EVAL_K_VALUES,
  EvalRunner,
  createEvalRunner,
} from './runner.js';

export {
  type QualityDashboard,
  type DashboardSummary,
  buildQualityDashboard,
  renderQualityDashboardMarkdown,
} from './dashboard.js';
