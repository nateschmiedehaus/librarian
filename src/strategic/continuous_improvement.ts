/**
 * @fileoverview Continuous Improvement Framework
 *
 * Provides self-improving mechanisms for templates and processes through:
 *
 * 1. **Outcome Tracking**: Record and analyze decision and process outcomes
 * 2. **Feedback Loops**: Collect, aggregate, and learn from feedback
 * 3. **Failure Learning**: Categorize failures, perform root cause analysis
 * 4. **Benchmarking**: Track baselines, trends, and detect regressions
 * 5. **Template Evolution**: Version, deprecate, and track template adoption
 *
 * Design Philosophy:
 *
 * - **Evidence-Based**: All improvements backed by tracked outcomes
 * - **Epistemic Humility**: Confidence tracked for all metrics
 * - **Transparent**: Every improvement opportunity is explainable
 * - **Self-Correcting**: System learns from its own failures
 *
 * @packageDocumentation
 */

import type { ConfidenceValue } from '../epistemics/confidence.js';
import { absent, bounded, deterministic } from '../epistemics/confidence.js';

// ============================================================================
// TIME RANGE AND COMMON TYPES
// ============================================================================

/**
 * Time range for filtering and aggregation.
 */
export interface TimeRange {
  /** Start of the time range (ISO timestamp) */
  start: string;
  /** End of the time range (ISO timestamp) */
  end: string;
}

/**
 * Trend direction for metrics.
 */
export type Trend = 'improving' | 'stable' | 'degrading' | 'insufficient_data';

/**
 * Severity levels for issues and failures.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Priority levels for improvements.
 */
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'backlog';

// ============================================================================
// OUTCOME TRACKING
// ============================================================================

/**
 * Outcome of a decision.
 */
export interface Outcome {
  /** Unique outcome identifier */
  id: string;
  /** Whether the decision achieved its goal */
  success: boolean;
  /** Quality score from 0 to 1 */
  quality: number;
  /** Time taken to see the outcome (milliseconds) */
  timeToOutcomeMs: number;
  /** Side effects observed */
  sideEffects: SideEffect[];
  /** User satisfaction if collected */
  userSatisfaction?: number;
  /** Additional metrics specific to this outcome */
  metrics: Record<string, number>;
  /** Evidence supporting this outcome assessment */
  evidence: string[];
  /** When the outcome was recorded */
  recordedAt: string;
  /** Notes or observations */
  notes?: string;
}

/**
 * Side effect from a decision or process.
 */
export interface SideEffect {
  /** Type of side effect */
  type: 'positive' | 'negative' | 'neutral';
  /** Description of the side effect */
  description: string;
  /** Impact magnitude from 0 to 1 */
  impact: number;
  /** Whether this was anticipated */
  anticipated: boolean;
}

/**
 * Process execution metrics.
 */
export interface ProcessMetrics {
  /** Total execution time in milliseconds */
  durationMs: number;
  /** Resource utilization (CPU, memory, etc.) */
  resourceUsage: ResourceUsage;
  /** Number of steps completed */
  stepsCompleted: number;
  /** Number of steps that failed */
  stepsFailed: number;
  /** Number of retries needed */
  retryCount: number;
  /** Error rate (0 to 1) */
  errorRate: number;
  /** Throughput if applicable */
  throughput?: number;
  /** Custom metrics */
  custom: Record<string, number>;
}

/**
 * Resource usage metrics.
 */
export interface ResourceUsage {
  /** Peak CPU percentage */
  cpuPeakPercent?: number;
  /** Average CPU percentage */
  cpuAvgPercent?: number;
  /** Peak memory in bytes */
  memoryPeakBytes?: number;
  /** Average memory in bytes */
  memoryAvgBytes?: number;
  /** Tokens consumed (for LLM operations) */
  tokensConsumed?: number;
  /** API calls made */
  apiCalls?: number;
}

/**
 * An opportunity for improvement.
 */
export interface ImprovementOpportunity {
  /** Unique identifier */
  id: string;
  /** Type of improvement */
  type: ImprovementType;
  /** Title describing the opportunity */
  title: string;
  /** Detailed description */
  description: string;
  /** Priority level */
  priority: Priority;
  /** Estimated impact (0 to 1) */
  estimatedImpact: number;
  /** Estimated effort to implement */
  estimatedEffort: EffortEstimate;
  /** Supporting evidence */
  evidence: string[];
  /** Confidence in this opportunity */
  confidence: ConfidenceValue;
  /** Suggested actions */
  suggestedActions: string[];
  /** Related metrics */
  relatedMetrics: string[];
  /** When this was identified */
  identifiedAt: string;
  /** Status of the opportunity */
  status: OpportunityStatus;
}

/**
 * Types of improvement opportunities.
 */
export type ImprovementType =
  | 'performance'
  | 'quality'
  | 'reliability'
  | 'efficiency'
  | 'user_experience'
  | 'process'
  | 'automation'
  | 'documentation';

/**
 * Status of an improvement opportunity.
 */
export type OpportunityStatus =
  | 'identified'
  | 'validated'
  | 'in_progress'
  | 'implemented'
  | 'rejected'
  | 'deferred';

/**
 * Effort estimate for an improvement.
 */
export interface EffortEstimate {
  /** T-shirt size */
  size: 'xs' | 's' | 'm' | 'l' | 'xl';
  /** Estimated hours */
  hoursEstimate: number;
  /** Confidence in the estimate */
  confidence: ConfidenceValue;
}

/**
 * Trend point for time series data.
 */
export interface TrendPoint {
  /** Timestamp */
  timestamp: string;
  /** Value at this point */
  value: number;
  /** Sample size if aggregated */
  sampleSize?: number;
}

/**
 * Outcome tracker interface for recording and analyzing outcomes.
 */
export interface OutcomeTracker {
  /** Record the outcome of a decision */
  recordDecisionOutcome(decisionId: string, outcome: Outcome): void;
  /** Record metrics from a process execution */
  recordProcessOutcome(processId: string, metrics: ProcessMetrics): void;
  /** Get improvement opportunities based on tracked data */
  getImprovementOpportunities(): ImprovementOpportunity[];
  /** Calculate trend direction for a metric */
  calculateTrendDirection(metricName: string, window: number): Trend;
  /** Get all outcomes for a decision */
  getOutcomesForDecision(decisionId: string): Outcome[];
  /** Get all metrics for a process */
  getMetricsForProcess(processId: string): ProcessMetrics[];
  /** Get trend data for a metric */
  getTrendData(metricName: string, range: TimeRange): TrendPoint[];
}

// ============================================================================
// FEEDBACK LOOPS
// ============================================================================

/**
 * Source of feedback.
 */
export interface FeedbackSource {
  /** Type of source */
  type: 'user' | 'system' | 'automated' | 'review' | 'monitoring';
  /** Identifier of the source */
  sourceId: string;
  /** Name or description */
  name: string;
  /** Reliability score (0 to 1) */
  reliability: number;
}

/**
 * Individual feedback item.
 */
export interface Feedback {
  /** Unique identifier */
  id: string;
  /** Subject of the feedback (what it's about) */
  subject: FeedbackSubject;
  /** Type of feedback */
  type: FeedbackType;
  /** Sentiment */
  sentiment: 'positive' | 'negative' | 'neutral';
  /** Rating if applicable (1-5) */
  rating?: number;
  /** Free-form content */
  content: string;
  /** Structured tags */
  tags: string[];
  /** When the feedback was given */
  timestamp: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Subject of feedback.
 */
export interface FeedbackSubject {
  /** Type of subject */
  type: 'template' | 'process' | 'decision' | 'output' | 'feature' | 'general';
  /** Identifier of the subject */
  subjectId: string;
  /** Version if applicable */
  version?: string;
}

/**
 * Types of feedback.
 */
export type FeedbackType =
  | 'bug_report'
  | 'feature_request'
  | 'improvement_suggestion'
  | 'praise'
  | 'complaint'
  | 'question'
  | 'rating'
  | 'observation';

/**
 * Aggregated feedback over a time range.
 */
export interface AggregatedFeedback {
  /** Time range of aggregation */
  timeRange: TimeRange;
  /** Total feedback count */
  totalCount: number;
  /** Counts by sentiment */
  bySentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  /** Counts by type */
  byType: Record<FeedbackType, number>;
  /** Average rating */
  averageRating: number | null;
  /** Most common tags */
  topTags: Array<{ tag: string; count: number }>;
  /** Sentiment trend */
  sentimentTrend: Trend;
  /** Representative samples */
  samples: Feedback[];
}

/**
 * Insight derived from feedback analysis.
 */
export interface Insight {
  /** Unique identifier */
  id: string;
  /** Category of insight */
  category: InsightCategory;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Severity/importance */
  importance: Severity;
  /** Supporting feedback IDs */
  supportingFeedback: string[];
  /** Confidence in this insight */
  confidence: ConfidenceValue;
  /** Suggested actions */
  suggestedActions: string[];
  /** When the insight was generated */
  generatedAt: string;
}

/**
 * Categories of insights.
 */
export type InsightCategory =
  | 'pattern'
  | 'anomaly'
  | 'trend'
  | 'correlation'
  | 'gap'
  | 'opportunity';

/**
 * Suggested process change.
 */
export interface ProcessChange {
  /** Unique identifier */
  id: string;
  /** Type of change */
  type: ProcessChangeType;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Impact assessment */
  impact: {
    scope: 'narrow' | 'moderate' | 'wide';
    risk: Severity;
    benefit: number;
  };
  /** Prerequisites */
  prerequisites: string[];
  /** Affected components */
  affectedComponents: string[];
  /** Supporting evidence */
  evidence: string[];
  /** Priority */
  priority: Priority;
  /** Status */
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
}

/**
 * Types of process changes.
 */
export type ProcessChangeType =
  | 'add_step'
  | 'remove_step'
  | 'modify_step'
  | 'reorder'
  | 'add_gate'
  | 'remove_gate'
  | 'modify_threshold'
  | 'add_automation'
  | 'configuration';

/**
 * Feedback loop interface for collecting and analyzing feedback.
 */
export interface FeedbackLoop {
  /** Collect feedback from a source */
  collectFeedback(source: FeedbackSource, feedback: Feedback): void;
  /** Aggregate feedback over a time range */
  aggregateFeedback(timeRange: TimeRange): AggregatedFeedback;
  /** Generate insights from collected feedback */
  generateInsights(): Insight[];
  /** Suggest process changes based on feedback */
  suggestProcessChanges(): ProcessChange[];
  /** Get feedback for a specific subject */
  getFeedbackForSubject(subjectId: string): Feedback[];
  /** Get trending topics from feedback */
  getTrendingTopics(limit: number): Array<{ topic: string; count: number; trend: Trend }>;
}

// ============================================================================
// FAILURE LEARNING
// ============================================================================

/**
 * A recorded failure.
 */
export interface Failure {
  /** Unique identifier */
  id: string;
  /** Type of failure */
  type: FailureType;
  /** Title/summary */
  title: string;
  /** Detailed description */
  description: string;
  /** Severity */
  severity: Severity;
  /** When the failure occurred */
  occurredAt: string;
  /** Duration of impact */
  impactDurationMs?: number;
  /** Affected components */
  affectedComponents: string[];
  /** Error messages or codes */
  errorDetails: ErrorDetail[];
  /** Stack trace if available */
  stackTrace?: string;
  /** Context at time of failure */
  context: Record<string, unknown>;
  /** Whether this has been resolved */
  resolved: boolean;
  /** Resolution details */
  resolution?: FailureResolution;
}

/**
 * Types of failures.
 */
export type FailureType =
  | 'crash'
  | 'timeout'
  | 'validation_error'
  | 'resource_exhaustion'
  | 'dependency_failure'
  | 'data_corruption'
  | 'logic_error'
  | 'configuration_error'
  | 'external_service_failure'
  | 'unknown';

/**
 * Error detail.
 */
export interface ErrorDetail {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Resolution of a failure.
 */
export interface FailureResolution {
  /** How the failure was resolved */
  method: 'fix' | 'workaround' | 'rollback' | 'ignore' | 'escalate';
  /** Description of the resolution */
  description: string;
  /** Who resolved it */
  resolvedBy: string;
  /** When it was resolved */
  resolvedAt: string;
  /** Time to resolution in milliseconds */
  timeToResolutionMs: number;
}

/**
 * Category of a failure for analysis.
 */
export interface FailureCategory {
  /** Primary category */
  primary: string;
  /** Secondary category */
  secondary?: string;
  /** Tags */
  tags: string[];
  /** Confidence in categorization */
  confidence: ConfidenceValue;
}

/**
 * Root cause of a failure.
 */
export interface RootCause {
  /** Category of root cause */
  category: RootCauseCategory;
  /** Description */
  description: string;
  /** Contributing factors */
  contributingFactors: ContributingFactor[];
  /** Timeline of events leading to failure */
  timeline: TimelineEvent[];
  /** Confidence in this analysis */
  confidence: ConfidenceValue;
  /** Recommendations to prevent recurrence */
  recommendations: string[];
  /** Related past failures */
  relatedFailures: string[];
}

/**
 * Categories of root causes.
 */
export type RootCauseCategory =
  | 'human_error'
  | 'process_gap'
  | 'design_flaw'
  | 'resource_limitation'
  | 'external_dependency'
  | 'environmental'
  | 'unknown';

/**
 * Factor contributing to a failure.
 */
export interface ContributingFactor {
  /** Description */
  description: string;
  /** Contribution weight (0 to 1) */
  weight: number;
  /** Whether this was the primary cause */
  isPrimary: boolean;
  /** Evidence */
  evidence: string[];
}

/**
 * Event in a failure timeline.
 */
export interface TimelineEvent {
  /** Timestamp */
  timestamp: string;
  /** Description */
  description: string;
  /** Type of event */
  type: 'precursor' | 'trigger' | 'propagation' | 'detection' | 'response';
  /** Significance */
  significance: Severity;
}

/**
 * Action to prevent future failures.
 */
export interface Action {
  /** Unique identifier */
  id: string;
  /** Type of action */
  type: ActionType;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Priority */
  priority: Priority;
  /** Assigned to */
  assignedTo?: string;
  /** Due date */
  dueDate?: string;
  /** Status */
  status: ActionStatus;
  /** Related failure IDs */
  relatedFailures: string[];
  /** Expected effectiveness (0 to 1) */
  expectedEffectiveness: number;
  /** Completion details */
  completion?: {
    completedAt: string;
    completedBy: string;
    notes?: string;
  };
}

/**
 * Types of preventive actions.
 */
export type ActionType =
  | 'code_fix'
  | 'process_change'
  | 'monitoring'
  | 'documentation'
  | 'training'
  | 'automation'
  | 'configuration'
  | 'testing';

/**
 * Status of an action.
 */
export type ActionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'verified'
  | 'cancelled';

/**
 * Pattern detected in failures.
 */
export interface FailurePattern {
  /** Unique identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Description */
  description: string;
  /** Number of occurrences */
  occurrenceCount: number;
  /** Failures matching this pattern */
  matchingFailures: string[];
  /** First occurrence */
  firstOccurrence: string;
  /** Last occurrence */
  lastOccurrence: string;
  /** Pattern signature (for matching) */
  signature: PatternSignature;
  /** Trend */
  trend: Trend;
  /** Recommended prevention */
  recommendedPrevention: string[];
  /** Confidence */
  confidence: ConfidenceValue;
}

/**
 * Signature for matching failure patterns.
 */
export interface PatternSignature {
  /** Error codes that match */
  errorCodes?: string[];
  /** Component patterns */
  componentPatterns?: string[];
  /** Message patterns (regex) */
  messagePatterns?: string[];
  /** Context key-value patterns */
  contextPatterns?: Record<string, unknown>;
}

/**
 * Failure learning interface.
 */
export interface FailureLearning {
  /** Categorize a failure */
  categorizeFailure(failure: Failure): FailureCategory;
  /** Perform root cause analysis */
  performRootCauseAnalysis(failure: Failure): RootCause;
  /** Track preventive actions for a failure */
  trackPreventiveActions(failure: Failure, actions: Action[]): void;
  /** Detect patterns in failures */
  detectFailurePatterns(): FailurePattern[];
  /** Record a new failure */
  recordFailure(failure: Failure): void;
  /** Get all failures */
  getFailures(filter?: FailureFilter): Failure[];
  /** Get actions for a failure */
  getActionsForFailure(failureId: string): Action[];
  /** Update action status */
  updateActionStatus(actionId: string, status: ActionStatus): void;
}

/**
 * Filter for querying failures.
 */
export interface FailureFilter {
  /** Time range */
  timeRange?: TimeRange;
  /** Severity levels */
  severities?: Severity[];
  /** Failure types */
  types?: FailureType[];
  /** Only resolved or unresolved */
  resolved?: boolean;
  /** Component filter */
  components?: string[];
}

// ============================================================================
// BENCHMARKING
// ============================================================================

/**
 * Baseline for a metric.
 */
export interface Baseline {
  /** Metric name */
  metricName: string;
  /** Baseline value */
  value: number;
  /** When established */
  establishedAt: string;
  /** How the baseline was determined */
  method: BaselineMethod;
  /** Sample size used to establish */
  sampleSize?: number;
  /** Valid until (if applicable) */
  validUntil?: string;
  /** Notes */
  notes?: string;
}

/**
 * Method for establishing a baseline.
 */
export type BaselineMethod =
  | 'historical_average'
  | 'percentile_target'
  | 'industry_standard'
  | 'manual_target'
  | 'best_observed';

/**
 * Comparison result against baseline.
 */
export interface Comparison {
  /** Metric name */
  metricName: string;
  /** Current value */
  currentValue: number;
  /** Baseline value */
  baselineValue: number;
  /** Absolute difference */
  difference: number;
  /** Percentage change */
  percentageChange: number;
  /** Whether this is better, same, or worse */
  status: ComparisonStatus;
  /** Statistical significance */
  significance: StatisticalSignificance;
  /** When comparison was made */
  comparedAt: string;
}

/**
 * Status of a comparison.
 */
export type ComparisonStatus = 'better' | 'same' | 'worse';

/**
 * Statistical significance of a comparison.
 */
export interface StatisticalSignificance {
  /** Is the difference statistically significant */
  isSignificant: boolean;
  /** P-value if calculated */
  pValue?: number;
  /** Confidence interval */
  confidenceInterval?: [number, number];
  /** Sample size */
  sampleSize: number;
}

/**
 * Alert from regression detection.
 */
export interface Alert {
  /** Unique identifier */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Severity */
  severity: Severity;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Metric that triggered the alert */
  metricName: string;
  /** Current value */
  currentValue: number;
  /** Threshold value */
  thresholdValue: number;
  /** Baseline value */
  baselineValue?: number;
  /** When triggered */
  triggeredAt: string;
  /** Status */
  status: AlertStatus;
  /** Acknowledged by */
  acknowledgedBy?: string;
  /** Acknowledged at */
  acknowledgedAt?: string;
  /** Resolution */
  resolution?: string;
}

/**
 * Types of alerts.
 */
export type AlertType =
  | 'regression'
  | 'anomaly'
  | 'threshold_breach'
  | 'trend_warning';

/**
 * Status of an alert.
 */
export type AlertStatus =
  | 'active'
  | 'acknowledged'
  | 'investigating'
  | 'resolved'
  | 'false_positive';

/**
 * Benchmark system interface.
 */
export interface BenchmarkSystem {
  /** Set a baseline for a metric */
  setBaseline(metricName: string, value: number, method?: BaselineMethod): void;
  /** Compare current value to baseline */
  compareToBaseline(metricName: string, current: number): Comparison;
  /** Track a metric value over time */
  trackTrend(metricName: string, value: number): TrendPoint;
  /** Check for regressions and return alerts */
  alertOnRegression(threshold: number): Alert[];
  /** Get the baseline for a metric */
  getBaseline(metricName: string): Baseline | null;
  /** Get all baselines */
  getAllBaselines(): Baseline[];
  /** Get trend data */
  getTrend(metricName: string, range: TimeRange): TrendPoint[];
  /** Get active alerts */
  getActiveAlerts(): Alert[];
  /** Acknowledge an alert */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void;
  /** Resolve an alert */
  resolveAlert(alertId: string, resolution: string): void;
}

// ============================================================================
// TEMPLATE EVOLUTION
// ============================================================================

/**
 * A change to a template.
 */
export interface Change {
  /** Type of change */
  type: ChangeType;
  /** Description */
  description: string;
  /** What was affected */
  affected: string;
  /** Before state (if applicable) */
  before?: unknown;
  /** After state (if applicable) */
  after?: unknown;
  /** Rationale */
  rationale: string;
  /** Breaking change */
  breaking: boolean;
}

/**
 * Types of changes.
 */
export type ChangeType =
  | 'addition'
  | 'removal'
  | 'modification'
  | 'deprecation'
  | 'bugfix'
  | 'performance'
  | 'refactor';

/**
 * Version of a template.
 */
export interface Version {
  /** Version string (semver) */
  version: string;
  /** Template ID */
  templateId: string;
  /** Changes in this version */
  changes: Change[];
  /** Release notes */
  releaseNotes: string;
  /** Created at */
  createdAt: string;
  /** Created by */
  createdBy: string;
  /** Status */
  status: VersionStatus;
  /** Previous version */
  previousVersion?: string;
  /** Deprecation info */
  deprecation?: DeprecationInfo;
  /** Adoption metrics */
  adoptionMetrics?: AdoptionMetrics;
}

/**
 * Status of a version.
 */
export type VersionStatus =
  | 'draft'
  | 'beta'
  | 'released'
  | 'deprecated'
  | 'retired';

/**
 * Deprecation information.
 */
export interface DeprecationInfo {
  /** When deprecated */
  deprecatedAt: string;
  /** Reason for deprecation */
  reason: string;
  /** When support will end */
  sunsetDate?: string;
  /** Alternative to use */
  alternative?: string;
}

/**
 * Migration path from one version to another.
 */
export interface MigrationPath {
  /** Source version */
  fromVersion: string;
  /** Target version */
  toVersion: string;
  /** Migration steps */
  steps: MigrationStep[];
  /** Estimated effort */
  effort: EffortEstimate;
  /** Risks */
  risks: MigrationRisk[];
  /** Automated migration available */
  automated: boolean;
  /** Automation script/function if available */
  automationRef?: string;
}

/**
 * A step in a migration.
 */
export interface MigrationStep {
  /** Order */
  order: number;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Can be automated */
  canAutomate: boolean;
  /** Required */
  required: boolean;
}

/**
 * Risk in a migration.
 */
export interface MigrationRisk {
  /** Description */
  description: string;
  /** Likelihood */
  likelihood: Severity;
  /** Impact */
  impact: Severity;
  /** Mitigation */
  mitigation: string;
}

/**
 * Metrics about adoption of a version.
 */
export interface AdoptionMetrics {
  /** Total users/instances using this version */
  totalAdoptions: number;
  /** Adoption rate (new adoptions per day) */
  adoptionRate: number;
  /** Retention rate (users staying on this version) */
  retentionRate: number;
  /** Migration rate (users migrating from this version) */
  migrationRate: number;
  /** Success rate (successful usage) */
  successRate: number;
  /** Average satisfaction rating */
  satisfactionRating?: number;
  /** Last updated */
  updatedAt: string;
}

/**
 * Template evolution interface.
 */
export interface TemplateEvolution {
  /** Create a new version of a template */
  versionTemplate(templateId: string, changes: Change[]): Version;
  /** Deprecate a version with migration path */
  deprecateVersion(versionId: string, migrationPath: MigrationPath): void;
  /** Track adoption of a version */
  trackAdoption(versionId: string): AdoptionMetrics;
  /** Get all versions of a template */
  getVersions(templateId: string): Version[];
  /** Get the latest version of a template */
  getLatestVersion(templateId: string): Version | null;
  /** Get migration path between versions */
  getMigrationPath(fromVersion: string, toVersion: string): MigrationPath | null;
  /** Get adoption history */
  getAdoptionHistory(versionId: string, range: TimeRange): Array<{ date: string; count: number }>;
  /** Compare two versions */
  compareVersions(versionA: string, versionB: string): VersionComparison;
}

/**
 * Comparison between two versions.
 */
export interface VersionComparison {
  /** Version A */
  versionA: string;
  /** Version B */
  versionB: string;
  /** All changes between versions */
  changes: Change[];
  /** Breaking changes */
  breakingChanges: Change[];
  /** Migration required */
  migrationRequired: boolean;
  /** Recommended version */
  recommendedVersion: string;
  /** Recommendation rationale */
  rationale: string;
}

// ============================================================================
// FACTORY IMPLEMENTATIONS
// ============================================================================

/**
 * In-memory outcome tracker implementation.
 */
class InMemoryOutcomeTracker implements OutcomeTracker {
  private decisionOutcomes = new Map<string, Outcome[]>();
  private processMetrics = new Map<string, ProcessMetrics[]>();
  private metricTrends = new Map<string, TrendPoint[]>();

  recordDecisionOutcome(decisionId: string, outcome: Outcome): void {
    const outcomes = this.decisionOutcomes.get(decisionId) ?? [];
    outcomes.push(outcome);
    this.decisionOutcomes.set(decisionId, outcomes);

    // Track quality metric
    this.addMetricPoint(`decision.${decisionId}.quality`, outcome.quality, outcome.recordedAt);
    this.addMetricPoint(`decision.${decisionId}.success`, outcome.success ? 1 : 0, outcome.recordedAt);
  }

  recordProcessOutcome(processId: string, metrics: ProcessMetrics): void {
    const allMetrics = this.processMetrics.get(processId) ?? [];
    allMetrics.push(metrics);
    this.processMetrics.set(processId, allMetrics);

    const timestamp = new Date().toISOString();
    this.addMetricPoint(`process.${processId}.duration`, metrics.durationMs, timestamp);
    this.addMetricPoint(`process.${processId}.errorRate`, metrics.errorRate, timestamp);
    if (metrics.throughput !== undefined) {
      this.addMetricPoint(`process.${processId}.throughput`, metrics.throughput, timestamp);
    }
  }

  getImprovementOpportunities(): ImprovementOpportunity[] {
    const opportunities: ImprovementOpportunity[] = [];
    const now = new Date().toISOString();

    // Analyze decision outcomes for patterns
    for (const [decisionId, outcomes] of this.decisionOutcomes) {
      if (outcomes.length < 5) continue;

      const recentOutcomes = outcomes.slice(-10);
      const successRate = recentOutcomes.filter(o => o.success).length / recentOutcomes.length;
      const avgQuality = recentOutcomes.reduce((sum, o) => sum + o.quality, 0) / recentOutcomes.length;

      if (successRate < 0.7) {
        opportunities.push({
          id: `opp-dec-${decisionId}-${Date.now()}`,
          type: 'quality',
          title: `Low success rate for decision ${decisionId}`,
          description: `Decision ${decisionId} has a success rate of ${(successRate * 100).toFixed(1)}%`,
          priority: successRate < 0.5 ? 'high' : 'medium',
          estimatedImpact: 1 - successRate,
          estimatedEffort: { size: 'm', hoursEstimate: 8, confidence: absent('uncalibrated') },
          evidence: [`${recentOutcomes.length} recent outcomes analyzed`],
          confidence: bounded(0.6, 0.8, 'theoretical', 'Statistical analysis of outcomes'),
          suggestedActions: ['Review decision criteria', 'Analyze failure cases'],
          relatedMetrics: [`decision.${decisionId}.success`],
          identifiedAt: now,
          status: 'identified',
        });
      }

      if (avgQuality < 0.6) {
        opportunities.push({
          id: `opp-qual-${decisionId}-${Date.now()}`,
          type: 'quality',
          title: `Low quality for decision ${decisionId}`,
          description: `Decision ${decisionId} has average quality of ${(avgQuality * 100).toFixed(1)}%`,
          priority: avgQuality < 0.4 ? 'high' : 'medium',
          estimatedImpact: 1 - avgQuality,
          estimatedEffort: { size: 'm', hoursEstimate: 12, confidence: absent('uncalibrated') },
          evidence: [`Average quality from ${recentOutcomes.length} outcomes`],
          confidence: bounded(0.5, 0.75, 'theoretical', 'Quality trend analysis'),
          suggestedActions: ['Investigate quality factors', 'Add quality gates'],
          relatedMetrics: [`decision.${decisionId}.quality`],
          identifiedAt: now,
          status: 'identified',
        });
      }
    }

    // Analyze process metrics for inefficiencies
    for (const [processId, metrics] of this.processMetrics) {
      if (metrics.length < 5) continue;

      const recentMetrics = metrics.slice(-10);
      const avgErrorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;
      const avgRetries = recentMetrics.reduce((sum, m) => sum + m.retryCount, 0) / recentMetrics.length;

      if (avgErrorRate > 0.1) {
        opportunities.push({
          id: `opp-err-${processId}-${Date.now()}`,
          type: 'reliability',
          title: `High error rate in process ${processId}`,
          description: `Process ${processId} has error rate of ${(avgErrorRate * 100).toFixed(1)}%`,
          priority: avgErrorRate > 0.2 ? 'urgent' : 'high',
          estimatedImpact: avgErrorRate,
          estimatedEffort: { size: 'l', hoursEstimate: 16, confidence: absent('uncalibrated') },
          evidence: [`${recentMetrics.length} recent executions analyzed`],
          confidence: bounded(0.7, 0.9, 'theoretical', 'Error rate statistical analysis'),
          suggestedActions: ['Add error handling', 'Improve validation'],
          relatedMetrics: [`process.${processId}.errorRate`],
          identifiedAt: now,
          status: 'identified',
        });
      }

      if (avgRetries > 2) {
        opportunities.push({
          id: `opp-retry-${processId}-${Date.now()}`,
          type: 'efficiency',
          title: `High retry count in process ${processId}`,
          description: `Process ${processId} averages ${avgRetries.toFixed(1)} retries`,
          priority: avgRetries > 5 ? 'high' : 'medium',
          estimatedImpact: Math.min(avgRetries / 10, 0.5),
          estimatedEffort: { size: 'm', hoursEstimate: 8, confidence: absent('uncalibrated') },
          evidence: [`Average from ${recentMetrics.length} executions`],
          confidence: bounded(0.6, 0.85, 'theoretical', 'Retry pattern analysis'),
          suggestedActions: ['Investigate transient failures', 'Optimize retry strategy'],
          relatedMetrics: [`process.${processId}.duration`],
          identifiedAt: now,
          status: 'identified',
        });
      }
    }

    return opportunities;
  }

  calculateTrendDirection(metricName: string, window: number): Trend {
    const points = this.metricTrends.get(metricName);
    if (!points || points.length < window) {
      return 'insufficient_data';
    }

    const recentPoints = points.slice(-window);
    if (recentPoints.length < 2) {
      return 'insufficient_data';
    }

    // Calculate linear regression slope
    const n = recentPoints.length;
    const xMean = (n - 1) / 2;
    const yMean = recentPoints.reduce((sum, p) => sum + p.value, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (recentPoints[i].value - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const normalizedSlope = slope / (yMean || 1);

    // Determine trend based on slope magnitude
    if (Math.abs(normalizedSlope) < 0.01) {
      return 'stable';
    }
    return normalizedSlope > 0 ? 'improving' : 'degrading';
  }

  getOutcomesForDecision(decisionId: string): Outcome[] {
    return this.decisionOutcomes.get(decisionId) ?? [];
  }

  getMetricsForProcess(processId: string): ProcessMetrics[] {
    return this.processMetrics.get(processId) ?? [];
  }

  getTrendData(metricName: string, range: TimeRange): TrendPoint[] {
    const points = this.metricTrends.get(metricName) ?? [];
    const start = new Date(range.start).getTime();
    const end = new Date(range.end).getTime();
    return points.filter(p => {
      const time = new Date(p.timestamp).getTime();
      return time >= start && time <= end;
    });
  }

  private addMetricPoint(metricName: string, value: number, timestamp: string): void {
    const points = this.metricTrends.get(metricName) ?? [];
    points.push({ timestamp, value });
    this.metricTrends.set(metricName, points);
  }
}

/**
 * In-memory feedback loop implementation.
 */
class InMemoryFeedbackLoop implements FeedbackLoop {
  private feedback: Feedback[] = [];
  private sources = new Map<string, FeedbackSource>();

  collectFeedback(source: FeedbackSource, feedback: Feedback): void {
    this.sources.set(source.sourceId, source);
    this.feedback.push(feedback);
  }

  aggregateFeedback(timeRange: TimeRange): AggregatedFeedback {
    const start = new Date(timeRange.start).getTime();
    const end = new Date(timeRange.end).getTime();

    const filtered = this.feedback.filter(f => {
      const time = new Date(f.timestamp).getTime();
      return time >= start && time <= end;
    });

    const bySentiment = { positive: 0, negative: 0, neutral: 0 };
    const byType: Record<FeedbackType, number> = {
      bug_report: 0,
      feature_request: 0,
      improvement_suggestion: 0,
      praise: 0,
      complaint: 0,
      question: 0,
      rating: 0,
      observation: 0,
    };

    const tagCounts = new Map<string, number>();
    let ratingSum = 0;
    let ratingCount = 0;

    for (const f of filtered) {
      bySentiment[f.sentiment]++;
      byType[f.type]++;

      for (const tag of f.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }

      if (f.rating !== undefined) {
        ratingSum += f.rating;
        ratingCount++;
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate sentiment trend
    const halfPoint = Math.floor(filtered.length / 2);
    let sentimentTrend: Trend = 'stable';
    if (filtered.length >= 10) {
      const firstHalf = filtered.slice(0, halfPoint);
      const secondHalf = filtered.slice(halfPoint);

      const firstPositiveRate = firstHalf.filter(f => f.sentiment === 'positive').length / firstHalf.length;
      const secondPositiveRate = secondHalf.filter(f => f.sentiment === 'positive').length / secondHalf.length;

      const diff = secondPositiveRate - firstPositiveRate;
      if (diff > 0.1) sentimentTrend = 'improving';
      else if (diff < -0.1) sentimentTrend = 'degrading';
    } else {
      sentimentTrend = 'insufficient_data';
    }

    return {
      timeRange,
      totalCount: filtered.length,
      bySentiment,
      byType,
      averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
      topTags,
      sentimentTrend,
      samples: filtered.slice(0, 5),
    };
  }

  generateInsights(): Insight[] {
    const insights: Insight[] = [];
    const now = new Date().toISOString();

    if (this.feedback.length < 10) {
      return insights;
    }

    // Find negative feedback patterns
    const negativeFeedback = this.feedback.filter(f => f.sentiment === 'negative');
    const tagGroups = new Map<string, Feedback[]>();

    for (const f of negativeFeedback) {
      for (const tag of f.tags) {
        const group = tagGroups.get(tag) ?? [];
        group.push(f);
        tagGroups.set(tag, group);
      }
    }

    for (const [tag, group] of tagGroups) {
      if (group.length >= 3) {
        insights.push({
          id: `insight-${tag}-${Date.now()}`,
          category: 'pattern',
          title: `Recurring negative feedback about "${tag}"`,
          description: `${group.length} negative feedback items mention "${tag}"`,
          importance: group.length >= 5 ? 'high' : 'medium',
          supportingFeedback: group.map(f => f.id),
          confidence: bounded(0.6, 0.85, 'theoretical', 'Pattern frequency analysis'),
          suggestedActions: [`Investigate "${tag}" issues`, 'Prioritize improvements'],
          generatedAt: now,
        });
      }
    }

    // Find rating drops
    const withRatings = this.feedback.filter(f => f.rating !== undefined);
    if (withRatings.length >= 20) {
      const recent = withRatings.slice(-10);
      const older = withRatings.slice(-20, -10);

      const recentAvg = recent.reduce((sum, f) => sum + (f.rating ?? 0), 0) / recent.length;
      const olderAvg = older.reduce((sum, f) => sum + (f.rating ?? 0), 0) / older.length;

      if (recentAvg < olderAvg - 0.5) {
        insights.push({
          id: `insight-rating-drop-${Date.now()}`,
          category: 'trend',
          title: 'Rating decline detected',
          description: `Average rating dropped from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)}`,
          importance: 'high',
          supportingFeedback: recent.map(f => f.id),
          confidence: bounded(0.7, 0.9, 'theoretical', 'Statistical trend analysis'),
          suggestedActions: ['Investigate recent changes', 'Review negative feedback'],
          generatedAt: now,
        });
      }
    }

    return insights;
  }

  suggestProcessChanges(): ProcessChange[] {
    const changes: ProcessChange[] = [];
    const now = new Date();

    // Analyze feature requests
    const featureRequests = this.feedback.filter(f => f.type === 'feature_request');
    const featureGroups = new Map<string, Feedback[]>();

    for (const f of featureRequests) {
      for (const tag of f.tags) {
        const group = featureGroups.get(tag) ?? [];
        group.push(f);
        featureGroups.set(tag, group);
      }
    }

    for (const [tag, group] of featureGroups) {
      if (group.length >= 3) {
        changes.push({
          id: `change-${tag}-${Date.now()}`,
          type: 'add_step',
          title: `Consider adding "${tag}" capability`,
          description: `${group.length} users have requested "${tag}" functionality`,
          impact: {
            scope: group.length >= 5 ? 'wide' : 'moderate',
            risk: 'medium',
            benefit: Math.min(group.length / 10, 1),
          },
          prerequisites: [],
          affectedComponents: [],
          evidence: group.map(f => f.id),
          priority: group.length >= 5 ? 'high' : 'medium',
          status: 'proposed',
        });
      }
    }

    // Analyze bug reports for process improvements
    const bugReports = this.feedback.filter(f => f.type === 'bug_report');
    if (bugReports.length >= 5) {
      changes.push({
        id: `change-validation-${Date.now()}`,
        type: 'add_gate',
        title: 'Strengthen validation based on bug reports',
        description: `${bugReports.length} bug reports suggest validation gaps`,
        impact: {
          scope: 'wide',
          risk: 'low',
          benefit: Math.min(bugReports.length / 20, 0.5),
        },
        prerequisites: ['Bug report analysis'],
        affectedComponents: [],
        evidence: bugReports.map(f => f.id),
        priority: bugReports.length >= 10 ? 'high' : 'medium',
        status: 'proposed',
      });
    }

    return changes;
  }

  getFeedbackForSubject(subjectId: string): Feedback[] {
    return this.feedback.filter(f => f.subject.subjectId === subjectId);
  }

  getTrendingTopics(limit: number): Array<{ topic: string; count: number; trend: Trend }> {
    // Get recent feedback (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = this.feedback.filter(f => new Date(f.timestamp).getTime() > weekAgo);
    const older = this.feedback.filter(f => {
      const time = new Date(f.timestamp).getTime();
      return time <= weekAgo && time > weekAgo - 7 * 24 * 60 * 60 * 1000;
    });

    const recentCounts = new Map<string, number>();
    const olderCounts = new Map<string, number>();

    for (const f of recent) {
      for (const tag of f.tags) {
        recentCounts.set(tag, (recentCounts.get(tag) ?? 0) + 1);
      }
    }

    for (const f of older) {
      for (const tag of f.tags) {
        olderCounts.set(tag, (olderCounts.get(tag) ?? 0) + 1);
      }
    }

    const topics: Array<{ topic: string; count: number; trend: Trend }> = [];
    for (const [topic, count] of recentCounts) {
      const oldCount = olderCounts.get(topic) ?? 0;
      let trend: Trend = 'stable';

      if (oldCount === 0 && count > 0) {
        trend = 'improving';
      } else if (oldCount > 0) {
        const change = (count - oldCount) / oldCount;
        if (change > 0.2) trend = 'improving';
        else if (change < -0.2) trend = 'degrading';
      }

      topics.push({ topic, count, trend });
    }

    return topics.sort((a, b) => b.count - a.count).slice(0, limit);
  }
}

/**
 * In-memory failure learning implementation.
 */
class InMemoryFailureLearning implements FailureLearning {
  private failures: Failure[] = [];
  private actions = new Map<string, Action[]>();
  private rootCauses = new Map<string, RootCause>();

  recordFailure(failure: Failure): void {
    this.failures.push(failure);
  }

  categorizeFailure(failure: Failure): FailureCategory {
    const tags: string[] = [];

    // Extract tags from error details
    for (const error of failure.errorDetails) {
      if (error.code.includes('TIMEOUT')) tags.push('timeout');
      if (error.code.includes('OOM') || error.code.includes('MEMORY')) tags.push('memory');
      if (error.code.includes('AUTH')) tags.push('authentication');
      if (error.code.includes('VALIDATION')) tags.push('validation');
    }

    // Determine primary category based on type
    const categoryMap: Record<FailureType, string> = {
      crash: 'system',
      timeout: 'performance',
      validation_error: 'data',
      resource_exhaustion: 'infrastructure',
      dependency_failure: 'external',
      data_corruption: 'data',
      logic_error: 'application',
      configuration_error: 'configuration',
      external_service_failure: 'external',
      unknown: 'unknown',
    };

    return {
      primary: categoryMap[failure.type],
      secondary: failure.affectedComponents[0],
      tags,
      confidence: bounded(0.6, 0.85, 'theoretical', 'Pattern-based categorization'),
    };
  }

  performRootCauseAnalysis(failure: Failure): RootCause {
    const existingRootCause = this.rootCauses.get(failure.id);
    if (existingRootCause) {
      return existingRootCause;
    }

    // Build timeline
    const timeline: TimelineEvent[] = [
      {
        timestamp: failure.occurredAt,
        description: `Failure detected: ${failure.title}`,
        type: 'detection',
        significance: failure.severity,
      },
    ];

    // Determine root cause category based on patterns
    let category: RootCauseCategory = 'unknown';
    const contributingFactors: ContributingFactor[] = [];

    if (failure.type === 'configuration_error') {
      category = 'process_gap';
      contributingFactors.push({
        description: 'Configuration not validated before deployment',
        weight: 0.7,
        isPrimary: true,
        evidence: ['Configuration error type'],
      });
    } else if (failure.type === 'resource_exhaustion' || failure.type === 'timeout') {
      category = 'resource_limitation';
      contributingFactors.push({
        description: failure.type === 'timeout'
          ? 'Operation exceeded time limits, possibly due to resource constraints'
          : 'Resource limits not properly set or monitored',
        weight: 0.6,
        isPrimary: true,
        evidence: [`${failure.type} type`],
      });
    } else if (failure.type === 'external_service_failure' || failure.type === 'dependency_failure') {
      category = 'external_dependency';
      contributingFactors.push({
        description: 'External dependency failure without proper fallback',
        weight: 0.8,
        isPrimary: true,
        evidence: ['Dependency failure type'],
      });
    } else if (failure.type === 'logic_error') {
      category = 'design_flaw';
      contributingFactors.push({
        description: 'Logic error in implementation',
        weight: 0.7,
        isPrimary: true,
        evidence: ['Logic error type'],
      });
    }

    // Find related failures
    const relatedFailures = this.failures
      .filter(f => f.id !== failure.id && f.type === failure.type)
      .slice(-5)
      .map(f => f.id);

    const rootCause: RootCause = {
      category,
      description: `${failure.type} in ${failure.affectedComponents.join(', ')}`,
      contributingFactors,
      timeline,
      confidence: bounded(0.4, 0.7, 'theoretical', 'Automated root cause analysis'),
      recommendations: this.generateRecommendations(failure, category),
      relatedFailures,
    };

    this.rootCauses.set(failure.id, rootCause);
    return rootCause;
  }

  trackPreventiveActions(failure: Failure, actions: Action[]): void {
    const existing = this.actions.get(failure.id) ?? [];
    this.actions.set(failure.id, [...existing, ...actions]);
  }

  detectFailurePatterns(): FailurePattern[] {
    const patterns: FailurePattern[] = [];
    const typeGroups = new Map<FailureType, Failure[]>();

    // Group by type
    for (const failure of this.failures) {
      const group = typeGroups.get(failure.type) ?? [];
      group.push(failure);
      typeGroups.set(failure.type, group);
    }

    // Create patterns for types with multiple occurrences
    for (const [type, failures] of typeGroups) {
      if (failures.length >= 3) {
        const sorted = failures.sort((a, b) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
        );

        patterns.push({
          id: `pattern-${type}-${Date.now()}`,
          name: `Recurring ${type} failures`,
          description: `${failures.length} failures of type ${type}`,
          occurrenceCount: failures.length,
          matchingFailures: failures.map(f => f.id),
          firstOccurrence: sorted[0].occurredAt,
          lastOccurrence: sorted[sorted.length - 1].occurredAt,
          signature: {
            errorCodes: [...new Set(failures.flatMap(f => f.errorDetails.map(e => e.code)))],
            componentPatterns: [...new Set(failures.flatMap(f => f.affectedComponents))],
          },
          trend: this.calculateFailureTrend(failures),
          recommendedPrevention: this.generatePreventionForType(type),
          confidence: bounded(0.6, 0.85, 'theoretical', 'Pattern frequency analysis'),
        });
      }
    }

    // Group by component
    const componentGroups = new Map<string, Failure[]>();
    for (const failure of this.failures) {
      for (const component of failure.affectedComponents) {
        const group = componentGroups.get(component) ?? [];
        group.push(failure);
        componentGroups.set(component, group);
      }
    }

    for (const [component, failures] of componentGroups) {
      if (failures.length >= 3) {
        const sorted = failures.sort((a, b) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
        );

        patterns.push({
          id: `pattern-component-${component}-${Date.now()}`,
          name: `Failures in ${component}`,
          description: `${failures.length} failures affecting ${component}`,
          occurrenceCount: failures.length,
          matchingFailures: failures.map(f => f.id),
          firstOccurrence: sorted[0].occurredAt,
          lastOccurrence: sorted[sorted.length - 1].occurredAt,
          signature: {
            componentPatterns: [component],
          },
          trend: this.calculateFailureTrend(failures),
          recommendedPrevention: [`Review ${component} implementation`, 'Add targeted tests'],
          confidence: bounded(0.5, 0.75, 'theoretical', 'Component failure clustering'),
        });
      }
    }

    return patterns;
  }

  getFailures(filter?: FailureFilter): Failure[] {
    let result = [...this.failures];

    if (filter) {
      if (filter.timeRange) {
        const start = new Date(filter.timeRange.start).getTime();
        const end = new Date(filter.timeRange.end).getTime();
        result = result.filter(f => {
          const time = new Date(f.occurredAt).getTime();
          return time >= start && time <= end;
        });
      }

      if (filter.severities) {
        result = result.filter(f => filter.severities!.includes(f.severity));
      }

      if (filter.types) {
        result = result.filter(f => filter.types!.includes(f.type));
      }

      if (filter.resolved !== undefined) {
        result = result.filter(f => f.resolved === filter.resolved);
      }

      if (filter.components) {
        result = result.filter(f =>
          f.affectedComponents.some(c => filter.components!.includes(c))
        );
      }
    }

    return result;
  }

  getActionsForFailure(failureId: string): Action[] {
    return this.actions.get(failureId) ?? [];
  }

  updateActionStatus(actionId: string, status: ActionStatus): void {
    for (const actions of this.actions.values()) {
      const action = actions.find(a => a.id === actionId);
      if (action) {
        action.status = status;
        return;
      }
    }
  }

  private generateRecommendations(failure: Failure, category: RootCauseCategory): string[] {
    const recommendations: string[] = [];

    switch (category) {
      case 'process_gap':
        recommendations.push('Add validation step before deployment');
        recommendations.push('Create runbook for configuration changes');
        break;
      case 'resource_limitation':
        recommendations.push('Implement resource monitoring and alerting');
        recommendations.push('Set up auto-scaling or circuit breakers');
        break;
      case 'external_dependency':
        recommendations.push('Implement fallback mechanism');
        recommendations.push('Add retry logic with exponential backoff');
        break;
      case 'design_flaw':
        recommendations.push('Review and refactor affected code');
        recommendations.push('Add comprehensive test coverage');
        break;
      default:
        recommendations.push('Investigate and document root cause');
        recommendations.push('Add monitoring for early detection');
    }

    return recommendations;
  }

  private generatePreventionForType(type: FailureType): string[] {
    const preventions: Record<FailureType, string[]> = {
      crash: ['Add crash recovery mechanisms', 'Implement graceful degradation'],
      timeout: ['Optimize slow operations', 'Add timeout handling'],
      validation_error: ['Strengthen input validation', 'Add schema validation'],
      resource_exhaustion: ['Implement resource limits', 'Add cleanup routines'],
      dependency_failure: ['Add circuit breakers', 'Implement fallbacks'],
      data_corruption: ['Add data integrity checks', 'Implement transaction handling'],
      logic_error: ['Increase test coverage', 'Add assertion checks'],
      configuration_error: ['Validate configurations', 'Use configuration schemas'],
      external_service_failure: ['Add health checks', 'Implement retry strategies'],
      unknown: ['Improve error logging', 'Add better diagnostics'],
    };

    return preventions[type];
  }

  private calculateFailureTrend(failures: Failure[]): Trend {
    if (failures.length < 5) return 'insufficient_data';

    const sorted = failures.sort((a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    // Count failures in first and second half of the period
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    // Compare frequencies
    const firstDuration = new Date(firstHalf[firstHalf.length - 1].occurredAt).getTime() -
      new Date(firstHalf[0].occurredAt).getTime();
    const secondDuration = new Date(secondHalf[secondHalf.length - 1].occurredAt).getTime() -
      new Date(secondHalf[0].occurredAt).getTime();

    const firstRate = firstDuration > 0 ? firstHalf.length / firstDuration : 0;
    const secondRate = secondDuration > 0 ? secondHalf.length / secondDuration : 0;

    if (firstRate === 0 && secondRate === 0) return 'stable';
    if (firstRate === 0) return 'degrading';
    if (secondRate === 0) return 'improving';

    const change = (secondRate - firstRate) / firstRate;
    if (change > 0.2) return 'degrading';
    if (change < -0.2) return 'improving';
    return 'stable';
  }
}

/**
 * In-memory benchmark system implementation.
 */
class InMemoryBenchmarkSystem implements BenchmarkSystem {
  private baselines = new Map<string, Baseline>();
  private trends = new Map<string, TrendPoint[]>();
  private alerts: Alert[] = [];

  setBaseline(metricName: string, value: number, method: BaselineMethod = 'manual_target'): void {
    this.baselines.set(metricName, {
      metricName,
      value,
      establishedAt: new Date().toISOString(),
      method,
    });
  }

  compareToBaseline(metricName: string, current: number): Comparison {
    const baseline = this.baselines.get(metricName);
    if (!baseline) {
      return {
        metricName,
        currentValue: current,
        baselineValue: current,
        difference: 0,
        percentageChange: 0,
        status: 'same',
        significance: { isSignificant: false, sampleSize: 1 },
        comparedAt: new Date().toISOString(),
      };
    }

    const difference = current - baseline.value;
    const percentageChange = baseline.value !== 0
      ? (difference / baseline.value) * 100
      : (current === 0 ? 0 : 100);

    // Determine status (assuming higher is better for now)
    let status: ComparisonStatus = 'same';
    if (Math.abs(percentageChange) > 5) {
      status = difference > 0 ? 'better' : 'worse';
    }

    // Calculate basic significance
    const trendPoints = this.trends.get(metricName) ?? [];
    const sampleSize = Math.min(trendPoints.length, 30);

    return {
      metricName,
      currentValue: current,
      baselineValue: baseline.value,
      difference,
      percentageChange,
      status,
      significance: {
        isSignificant: Math.abs(percentageChange) > 10 && sampleSize >= 10,
        sampleSize,
      },
      comparedAt: new Date().toISOString(),
    };
  }

  trackTrend(metricName: string, value: number): TrendPoint {
    const points = this.trends.get(metricName) ?? [];
    const point: TrendPoint = {
      timestamp: new Date().toISOString(),
      value,
    };
    points.push(point);
    this.trends.set(metricName, points);
    return point;
  }

  alertOnRegression(threshold: number): Alert[] {
    const newAlerts: Alert[] = [];
    const now = new Date().toISOString();

    for (const [metricName, baseline] of this.baselines) {
      const points = this.trends.get(metricName);
      if (!points || points.length === 0) continue;

      const recentPoints = points.slice(-5);
      const avgRecent = recentPoints.reduce((sum, p) => sum + p.value, 0) / recentPoints.length;

      const percentageChange = baseline.value !== 0
        ? ((avgRecent - baseline.value) / baseline.value) * 100
        : 0;

      // Check if regression exceeds threshold (assuming lower is worse)
      if (percentageChange < -threshold) {
        const alert: Alert = {
          id: `alert-${metricName}-${Date.now()}`,
          type: 'regression',
          severity: Math.abs(percentageChange) > threshold * 2 ? 'high' : 'medium',
          title: `Regression detected in ${metricName}`,
          description: `${metricName} has dropped ${Math.abs(percentageChange).toFixed(1)}% below baseline`,
          metricName,
          currentValue: avgRecent,
          thresholdValue: baseline.value * (1 - threshold / 100),
          baselineValue: baseline.value,
          triggeredAt: now,
          status: 'active',
        };

        // Check if similar alert already exists
        const existingAlert = this.alerts.find(
          a => a.metricName === metricName && a.status === 'active'
        );

        if (!existingAlert) {
          this.alerts.push(alert);
          newAlerts.push(alert);
        }
      }
    }

    return newAlerts;
  }

  getBaseline(metricName: string): Baseline | null {
    return this.baselines.get(metricName) ?? null;
  }

  getAllBaselines(): Baseline[] {
    return Array.from(this.baselines.values());
  }

  getTrend(metricName: string, range: TimeRange): TrendPoint[] {
    const points = this.trends.get(metricName) ?? [];
    const start = new Date(range.start).getTime();
    const end = new Date(range.end).getTime();

    return points.filter(p => {
      const time = new Date(p.timestamp).getTime();
      return time >= start && time <= end;
    });
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => a.status === 'active');
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  resolveAlert(alertId: string, resolution: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolution = resolution;
    }
  }
}

/**
 * In-memory template evolution implementation.
 */
class InMemoryTemplateEvolution implements TemplateEvolution {
  private versions = new Map<string, Version[]>();
  private migrationPaths = new Map<string, MigrationPath>();
  private adoptionHistory = new Map<string, Array<{ date: string; count: number }>>();

  versionTemplate(templateId: string, changes: Change[]): Version {
    const existingVersions = this.versions.get(templateId) ?? [];
    const latestVersion = existingVersions[existingVersions.length - 1];

    const newVersionNumber = this.incrementVersion(latestVersion?.version ?? '0.0.0', changes);

    const version: Version = {
      version: newVersionNumber,
      templateId,
      changes,
      releaseNotes: this.generateReleaseNotes(changes),
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      status: 'draft',
      previousVersion: latestVersion?.version,
    };

    existingVersions.push(version);
    this.versions.set(templateId, existingVersions);

    return version;
  }

  deprecateVersion(versionId: string, migrationPath: MigrationPath): void {
    for (const versions of this.versions.values()) {
      const version = versions.find(v => v.version === versionId);
      if (version) {
        version.status = 'deprecated';
        version.deprecation = {
          deprecatedAt: new Date().toISOString(),
          reason: 'Newer version available',
          alternative: migrationPath.toVersion,
        };

        const pathKey = `${migrationPath.fromVersion}->${migrationPath.toVersion}`;
        this.migrationPaths.set(pathKey, migrationPath);
        return;
      }
    }
  }

  trackAdoption(versionId: string): AdoptionMetrics {
    const history = this.adoptionHistory.get(versionId) ?? [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Increment today's count
    const todayEntry = history.find(h => h.date === today);
    if (todayEntry) {
      todayEntry.count++;
    } else {
      history.push({ date: today, count: 1 });
    }
    this.adoptionHistory.set(versionId, history);

    // Calculate metrics
    const totalAdoptions = history.reduce((sum, h) => sum + h.count, 0);
    const recentDays = 7;
    const recentHistory = history.filter(h => {
      const date = new Date(h.date);
      return now.getTime() - date.getTime() < recentDays * 24 * 60 * 60 * 1000;
    });
    const adoptionRate = recentHistory.reduce((sum, h) => sum + h.count, 0) / recentDays;

    return {
      totalAdoptions,
      adoptionRate,
      retentionRate: 0.9, // Placeholder
      migrationRate: 0.1, // Placeholder
      successRate: 0.95, // Placeholder
      updatedAt: new Date().toISOString(),
    };
  }

  getVersions(templateId: string): Version[] {
    return this.versions.get(templateId) ?? [];
  }

  getLatestVersion(templateId: string): Version | null {
    const versions = this.versions.get(templateId);
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1];
  }

  getMigrationPath(fromVersion: string, toVersion: string): MigrationPath | null {
    const pathKey = `${fromVersion}->${toVersion}`;
    return this.migrationPaths.get(pathKey) ?? null;
  }

  getAdoptionHistory(versionId: string, range: TimeRange): Array<{ date: string; count: number }> {
    const history = this.adoptionHistory.get(versionId) ?? [];
    const start = new Date(range.start).getTime();
    const end = new Date(range.end).getTime();

    return history.filter(h => {
      const time = new Date(h.date).getTime();
      return time >= start && time <= end;
    });
  }

  compareVersions(versionA: string, versionB: string): VersionComparison {
    // Find all changes between versions
    const allChanges: Change[] = [];
    const breakingChanges: Change[] = [];

    for (const versions of this.versions.values()) {
      let inRange = false;
      for (const version of versions) {
        if (version.version === versionA) inRange = true;
        if (inRange && version.version !== versionA) {
          allChanges.push(...version.changes);
          breakingChanges.push(...version.changes.filter(c => c.breaking));
        }
        if (version.version === versionB) break;
      }
    }

    return {
      versionA,
      versionB,
      changes: allChanges,
      breakingChanges,
      migrationRequired: breakingChanges.length > 0,
      recommendedVersion: versionB,
      rationale: breakingChanges.length > 0
        ? `${breakingChanges.length} breaking changes require migration`
        : 'Safe to upgrade without breaking changes',
    };
  }

  private incrementVersion(current: string, changes: Change[]): string {
    const [major, minor, patch] = current.split('.').map(Number);

    const hasBreaking = changes.some(c => c.breaking);
    const hasFeature = changes.some(c => c.type === 'addition');

    if (hasBreaking) {
      return `${major + 1}.0.0`;
    } else if (hasFeature) {
      return `${major}.${minor + 1}.0`;
    } else {
      return `${major}.${minor}.${patch + 1}`;
    }
  }

  private generateReleaseNotes(changes: Change[]): string {
    const sections: string[] = [];

    const breaking = changes.filter(c => c.breaking);
    const additions = changes.filter(c => c.type === 'addition' && !c.breaking);
    const fixes = changes.filter(c => c.type === 'bugfix');
    const other = changes.filter(c => !c.breaking && c.type !== 'addition' && c.type !== 'bugfix');

    if (breaking.length > 0) {
      sections.push('**Breaking Changes:**');
      breaking.forEach(c => sections.push(`- ${c.description}`));
    }

    if (additions.length > 0) {
      sections.push('**New Features:**');
      additions.forEach(c => sections.push(`- ${c.description}`));
    }

    if (fixes.length > 0) {
      sections.push('**Bug Fixes:**');
      fixes.forEach(c => sections.push(`- ${c.description}`));
    }

    if (other.length > 0) {
      sections.push('**Other Changes:**');
      other.forEach(c => sections.push(`- ${c.description}`));
    }

    return sections.join('\n');
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new outcome tracker.
 */
export function createOutcomeTracker(): OutcomeTracker {
  return new InMemoryOutcomeTracker();
}

/**
 * Create a new feedback loop.
 */
export function createFeedbackLoop(): FeedbackLoop {
  return new InMemoryFeedbackLoop();
}

/**
 * Create a new failure learning system.
 */
export function createFailureLearning(): FailureLearning {
  return new InMemoryFailureLearning();
}

/**
 * Create a new benchmark system.
 */
export function createBenchmarkSystem(): BenchmarkSystem {
  return new InMemoryBenchmarkSystem();
}

/**
 * Create a new template evolution tracker.
 */
export function createTemplateEvolution(): TemplateEvolution {
  return new InMemoryTemplateEvolution();
}

// ============================================================================
// INTEGRATION HOOKS
// ============================================================================

/**
 * Configuration for continuous improvement integration.
 */
export interface ContinuousImprovementConfig {
  /** Enable outcome tracking */
  trackOutcomes: boolean;
  /** Enable feedback collection */
  collectFeedback: boolean;
  /** Enable failure learning */
  learnFromFailures: boolean;
  /** Enable benchmarking */
  enableBenchmarks: boolean;
  /** Enable template evolution */
  trackEvolution: boolean;
  /** Minimum sample size for trend analysis */
  minSampleSize: number;
  /** Regression alert threshold percentage */
  regressionThreshold: number;
  /** Trend window size (number of data points) */
  trendWindow: number;
}

/**
 * Default configuration for continuous improvement.
 */
export const DEFAULT_CONTINUOUS_IMPROVEMENT_CONFIG: ContinuousImprovementConfig = {
  trackOutcomes: true,
  collectFeedback: true,
  learnFromFailures: true,
  enableBenchmarks: true,
  trackEvolution: true,
  minSampleSize: 5,
  regressionThreshold: 10,
  trendWindow: 20,
};

/**
 * Integrated continuous improvement system.
 */
export interface ContinuousImprovementSystem {
  /** Outcome tracker */
  outcomeTracker: OutcomeTracker;
  /** Feedback loop */
  feedbackLoop: FeedbackLoop;
  /** Failure learning */
  failureLearning: FailureLearning;
  /** Benchmark system */
  benchmarkSystem: BenchmarkSystem;
  /** Template evolution */
  templateEvolution: TemplateEvolution;
  /** Configuration */
  config: ContinuousImprovementConfig;
  /** Get all improvement opportunities across systems */
  getAllOpportunities(): ImprovementOpportunity[];
  /** Get all active alerts */
  getAllAlerts(): Alert[];
  /** Generate a comprehensive improvement report */
  generateReport(): ImprovementReport;
}

/**
 * Comprehensive improvement report.
 */
export interface ImprovementReport {
  /** Report generation timestamp */
  generatedAt: string;
  /** Period covered */
  period: TimeRange;
  /** Summary statistics */
  summary: {
    totalOutcomes: number;
    avgSuccessRate: number;
    totalFeedback: number;
    feedbackSentiment: Trend;
    totalFailures: number;
    unresolvedFailures: number;
    activeAlerts: number;
    opportunities: number;
  };
  /** Top improvement opportunities */
  topOpportunities: ImprovementOpportunity[];
  /** Active alerts */
  activeAlerts: Alert[];
  /** Key insights */
  insights: Insight[];
  /** Failure patterns */
  failurePatterns: FailurePattern[];
  /** Trend summary */
  trends: Array<{
    metric: string;
    trend: Trend;
    change: number;
  }>;
}

/**
 * Create an integrated continuous improvement system.
 */
export function createContinuousImprovementSystem(
  config: Partial<ContinuousImprovementConfig> = {}
): ContinuousImprovementSystem {
  const fullConfig = { ...DEFAULT_CONTINUOUS_IMPROVEMENT_CONFIG, ...config };

  const outcomeTracker = createOutcomeTracker();
  const feedbackLoop = createFeedbackLoop();
  const failureLearning = createFailureLearning();
  const benchmarkSystem = createBenchmarkSystem();
  const templateEvolution = createTemplateEvolution();

  return {
    outcomeTracker,
    feedbackLoop,
    failureLearning,
    benchmarkSystem,
    templateEvolution,
    config: fullConfig,

    getAllOpportunities(): ImprovementOpportunity[] {
      return outcomeTracker.getImprovementOpportunities();
    },

    getAllAlerts(): Alert[] {
      return benchmarkSystem.getActiveAlerts();
    },

    generateReport(): ImprovementReport {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const period: TimeRange = {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      };

      const opportunities = outcomeTracker.getImprovementOpportunities();
      const alerts = benchmarkSystem.getActiveAlerts();
      const insights = feedbackLoop.generateInsights();
      const patterns = failureLearning.detectFailurePatterns();
      const aggregatedFeedback = feedbackLoop.aggregateFeedback(period);
      const failures = failureLearning.getFailures({ timeRange: period });

      return {
        generatedAt: now.toISOString(),
        period,
        summary: {
          totalOutcomes: 0, // Would need to track this
          avgSuccessRate: 0, // Would need to calculate
          totalFeedback: aggregatedFeedback.totalCount,
          feedbackSentiment: aggregatedFeedback.sentimentTrend,
          totalFailures: failures.length,
          unresolvedFailures: failures.filter(f => !f.resolved).length,
          activeAlerts: alerts.length,
          opportunities: opportunities.length,
        },
        topOpportunities: opportunities
          .sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, backlog: 4 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          })
          .slice(0, 5),
        activeAlerts: alerts,
        insights,
        failurePatterns: patterns,
        trends: [],
      };
    },
  };
}
