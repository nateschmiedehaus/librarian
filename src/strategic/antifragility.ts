/**
 * @fileoverview Anti-Fragility Patterns for Systems That Improve From Stress
 *
 * Based on Nassim Nicholas Taleb's concept of antifragility - systems that
 * gain from disorder rather than merely resist it.
 *
 * This module provides five key components:
 *
 * 1. **Stress-Driven Improvement** - Learn and strengthen from stress events
 * 2. **Optionality Preservation** - Maintain flexibility through reversible decisions
 * 3. **Barbell Strategy** - Balance ultra-safe core with experimental edges
 * 4. **Via Negativa** - Improve by removing fragilities
 * 5. **Skin in the Game** - Accountability through ownership
 *
 * Design Philosophy:
 * - Antifragile systems don't just survive stress; they use it to improve
 * - Small, regular stressors build resilience (hormesis)
 * - Preserve optionality until the last responsible moment
 * - Subtraction often beats addition for system improvement
 * - Those who bear consequences make better decisions
 *
 * @packageDocumentation
 */

import type { ConfidenceAssessment, ConfidenceLevel } from './types.js';

// ============================================================================
// STRESS-DRIVEN IMPROVEMENT
// ============================================================================

/**
 * Types of stress events that systems can experience
 */
export type StressEventType =
  | 'load_spike'        // Sudden increase in traffic/load
  | 'failure'           // Component or service failure
  | 'attack'            // Security attack or probe
  | 'chaos_experiment'  // Deliberate chaos engineering
  | 'resource_exhaustion' // CPU, memory, disk limits hit
  | 'dependency_failure'  // External service outage
  | 'data_corruption'     // Data integrity issues
  | 'network_partition';  // Network connectivity issues

/**
 * Represents a stress event experienced by the system
 */
export interface StressEvent {
  /** Unique identifier for the stress event */
  id: string;

  /** Type of stress event */
  type: StressEventType;

  /** Severity of the stress (0.0-1.0, where 1.0 is catastrophic) */
  severity: number;

  /** Components affected by this stress event */
  affectedComponents: string[];

  /** When the stress event occurred */
  timestamp: Date;

  /** Duration of the stress event in milliseconds */
  durationMs: number;

  /** How the stress was resolved, if resolved */
  resolution?: Resolution;

  /** Whether this was a deliberate test or organic stress */
  deliberate: boolean;

  /** Metrics captured during the event */
  metrics: StressMetrics;

  /** Root cause if identified */
  rootCause?: string;

  /** Related previous stress events */
  relatedEvents: string[];
}

/**
 * Resolution details for a stress event
 */
export interface Resolution {
  /** How the stress was resolved */
  method: 'automatic' | 'manual' | 'self-healed' | 'degraded_mode' | 'rollback' | 'escalated';

  /** When the resolution occurred */
  resolvedAt: Date;

  /** Who or what resolved it */
  resolvedBy: string;

  /** Actions taken to resolve */
  actionsTaken: string[];

  /** Whether the resolution was successful */
  successful: boolean;

  /** Time to detect the issue in milliseconds */
  timeToDetectMs: number;

  /** Time to resolve in milliseconds */
  timeToResolveMs: number;
}

/**
 * Metrics captured during a stress event
 */
export interface StressMetrics {
  /** Error rate during the event (0.0-1.0) */
  errorRate: number;

  /** Latency percentiles during the event */
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;

  /** Throughput during the event (requests per second) */
  throughput: number;

  /** Resource utilization during the event (0.0-1.0) */
  cpuUtilization: number;
  memoryUtilization: number;

  /** Custom metrics relevant to the event */
  customMetrics: Record<string, number>;
}

/**
 * Analysis of how the system responded to stress
 */
export interface ResponseAnalysis {
  /** ID of the stress event analyzed */
  eventId: string;

  /** Overall response quality score (0.0-1.0) */
  responseQuality: number;

  /** Classification of the response */
  classification: ResponseClassification;

  /** Strengths demonstrated during the event */
  strengths: ResponseStrength[];

  /** Weaknesses exposed during the event */
  weaknesses: ResponseWeakness[];

  /** Patterns observed in the response */
  patterns: ResponsePattern[];

  /** Comparison to baseline/expected behavior */
  baselineComparison: BaselineComparison;

  /** Confidence in this analysis */
  confidence: ConfidenceAssessment;
}

/**
 * How the system's response is classified
 */
export type ResponseClassification =
  | 'antifragile'   // System improved from the stress
  | 'resilient'     // System absorbed the stress without degradation
  | 'robust'        // System recovered quickly
  | 'fragile'       // System degraded significantly
  | 'catastrophic'; // System failed completely

/**
 * A strength demonstrated during stress response
 */
export interface ResponseStrength {
  /** Description of the strength */
  description: string;

  /** Component or pattern that provided this strength */
  source: string;

  /** How much this contributed to the response (0.0-1.0) */
  contribution: number;

  /** Whether this can be replicated to other areas */
  replicable: boolean;
}

/**
 * A weakness exposed during stress response
 */
export interface ResponseWeakness {
  /** Description of the weakness */
  description: string;

  /** Component or area with the weakness */
  location: string;

  /** Impact severity of this weakness (0.0-1.0) */
  impactSeverity: number;

  /** Whether this is a single point of failure */
  isSinglePointOfFailure: boolean;

  /** Suggested remediation */
  suggestedFix?: string;
}

/**
 * Patterns observed in stress response
 */
export interface ResponsePattern {
  /** Name of the pattern */
  name: string;

  /** Type of pattern */
  type: 'positive' | 'negative' | 'neutral';

  /** How often this pattern has been observed */
  occurrenceCount: number;

  /** Description of the pattern */
  description: string;

  /** Related patterns */
  relatedPatterns: string[];
}

/**
 * Comparison of response to baseline behavior
 */
export interface BaselineComparison {
  /** Whether baseline exists for comparison */
  hasBaseline: boolean;

  /** Deviation from baseline (-1.0 to 1.0, positive is better) */
  deviation: number;

  /** Specific metrics compared */
  metricComparisons: MetricComparison[];

  /** Whether this response should become the new baseline */
  shouldUpdateBaseline: boolean;
}

/**
 * Comparison of a specific metric to baseline
 */
export interface MetricComparison {
  /** Name of the metric */
  metricName: string;

  /** Baseline value */
  baselineValue: number;

  /** Observed value during stress */
  observedValue: number;

  /** Percentage change from baseline */
  percentageChange: number;

  /** Whether the change is within acceptable bounds */
  withinBounds: boolean;
}

/**
 * An improvement generated from stress analysis
 */
export interface Improvement {
  /** Unique identifier */
  id: string;

  /** Title of the improvement */
  title: string;

  /** Detailed description */
  description: string;

  /** Type of improvement */
  type: ImprovementType;

  /** Priority of the improvement */
  priority: 'critical' | 'high' | 'medium' | 'low';

  /** Estimated effort to implement */
  estimatedEffort: EffortEstimate;

  /** Expected impact on antifragility (0.0-1.0) */
  expectedImpact: number;

  /** Components affected */
  affectedComponents: string[];

  /** Stress events that motivated this improvement */
  motivatingEvents: string[];

  /** Implementation steps */
  implementationSteps: ImplementationStep[];

  /** How to verify the improvement */
  verificationCriteria: string[];

  /** Status of the improvement */
  status: ImprovementStatus;

  /** When the improvement was identified */
  identifiedAt: Date;

  /** When the improvement was implemented, if applicable */
  implementedAt?: Date;
}

/**
 * Types of improvements that can be generated
 */
export type ImprovementType =
  | 'redundancy'       // Add redundancy to remove SPOF
  | 'circuit_breaker'  // Add circuit breaker patterns
  | 'bulkhead'         // Add bulkhead isolation
  | 'timeout'          // Add or adjust timeouts
  | 'retry'            // Add or improve retry logic
  | 'cache'            // Add or improve caching
  | 'monitoring'       // Improve monitoring and alerting
  | 'capacity'         // Increase capacity or improve scaling
  | 'degradation'      // Add graceful degradation
  | 'documentation'    // Improve runbooks and documentation
  | 'testing'          // Add chaos/stress tests
  | 'architecture';    // Architectural changes

/**
 * Effort estimate for an improvement
 */
export interface EffortEstimate {
  /** Estimated hours of work */
  hours: number;

  /** Confidence in the estimate */
  confidence: 'high' | 'medium' | 'low';

  /** Skills required */
  requiredSkills: string[];

  /** Whether external dependencies are needed */
  hasExternalDependencies: boolean;
}

/**
 * A step in implementing an improvement
 */
export interface ImplementationStep {
  /** Order of the step */
  order: number;

  /** Description of the step */
  description: string;

  /** Whether this step is optional */
  optional: boolean;

  /** Estimated time for this step in hours */
  estimatedHours: number;

  /** Dependencies on other steps */
  dependsOn: number[];
}

/**
 * Status of an improvement
 */
export type ImprovementStatus =
  | 'identified'   // Just identified
  | 'prioritized'  // Prioritized for implementation
  | 'in_progress'  // Currently being implemented
  | 'implemented'  // Implemented but not verified
  | 'verified'     // Verified as effective
  | 'rejected'     // Rejected as not needed or not feasible
  | 'deferred';    // Deferred to a later time

/**
 * Metrics tracking how a system is strengthening over time
 */
export interface StrengtheningMetrics {
  /** System being tracked */
  systemId: string;

  /** Time period covered */
  periodStart: Date;
  periodEnd: Date;

  /** Number of stress events experienced */
  stressEventCount: number;

  /** Distribution of stress event types */
  eventTypeDistribution: Record<StressEventType, number>;

  /** Average response quality over time */
  averageResponseQuality: number;

  /** Trend in response quality (-1 to 1, positive is improving) */
  responseQualityTrend: number;

  /** Number of improvements implemented */
  improvementsImplemented: number;

  /** Number of improvements verified as effective */
  improvementsVerified: number;

  /** Mean time to detect issues */
  meanTimeToDetectMs: number;

  /** Trend in MTTD (-1 to 1, negative means faster detection) */
  mttdTrend: number;

  /** Mean time to resolve issues */
  meanTimeToResolveMs: number;

  /** Trend in MTTR (-1 to 1, negative means faster resolution) */
  mttrTrend: number;

  /** Recurring patterns identified */
  recurringPatterns: RecurringPattern[];

  /** Overall antifragility score (0.0-1.0) */
  antifragilityScore: number;

  /** Confidence in these metrics */
  confidence: ConfidenceAssessment;
}

/**
 * A recurring pattern in stress responses
 */
export interface RecurringPattern {
  /** Description of the pattern */
  description: string;

  /** Number of occurrences */
  occurrences: number;

  /** Trend (increasing, decreasing, stable) */
  trend: 'increasing' | 'decreasing' | 'stable';

  /** Impact on system health */
  impact: 'positive' | 'negative' | 'neutral';

  /** Whether action has been taken */
  addressedByImprovement?: string;
}

/**
 * Interface for stress-driven improvement system
 */
export interface StressResponse {
  /** Record a stress event */
  recordStressEvent(event: Omit<StressEvent, 'id'>): StressEvent;

  /** Analyze how the system responded to an event */
  analyzeResponse(eventId: string): ResponseAnalysis;

  /** Generate improvement recommendations from analysis */
  generateImprovement(analysis: ResponseAnalysis): Improvement[];

  /** Track how a system is strengthening over time */
  trackStrengthening(systemId: string, periodDays?: number): StrengtheningMetrics;

  /** Get all stress events for a system */
  getStressEvents(systemId: string): StressEvent[];

  /** Get all improvements for a system */
  getImprovements(systemId: string): Improvement[];
}

// ============================================================================
// OPTIONALITY PRESERVATION
// ============================================================================

/**
 * Represents a decision that may affect optionality
 */
export interface Decision {
  /** Unique identifier */
  id: string;

  /** Short description of the decision */
  description: string;

  /** Whether the decision can be reversed */
  reversible: boolean;

  /** Cost to reverse the decision, if reversible */
  reversalCost?: Cost;

  /** Available alternatives to this decision */
  alternatives: Alternative[];

  /** Deadline by which the decision must be made */
  deadline?: Date;

  /** Context in which this decision is being made */
  context: DecisionContext;

  /** Who or what is making the decision */
  decisionMaker: string;

  /** When the decision was made */
  madeAt?: Date;

  /** The chosen alternative, if decided */
  chosenAlternative?: string;
}

/**
 * Cost associated with an action
 */
export interface Cost {
  /** Monetary cost if applicable */
  monetary?: number;

  /** Time cost in hours */
  timeHours: number;

  /** Complexity of the action (0.0-1.0) */
  complexity: number;

  /** Risk level of the action */
  risk: 'low' | 'medium' | 'high' | 'critical';

  /** Additional costs that are hard to quantify */
  intangibleCosts: string[];
}

/**
 * An alternative option for a decision
 */
export interface Alternative {
  /** Unique identifier */
  id: string;

  /** Name of the alternative */
  name: string;

  /** Description of what this alternative entails */
  description: string;

  /** Pros of this alternative */
  pros: string[];

  /** Cons of this alternative */
  cons: string[];

  /** Estimated cost of this alternative */
  cost: Cost;

  /** Whether this alternative is reversible */
  reversible: boolean;

  /** How long this alternative remains viable */
  viabilityWindow?: Date;

  /** Constraints on this alternative */
  constraints: string[];
}

/**
 * Context for a decision
 */
export interface DecisionContext {
  /** Domain or area of the decision */
  domain: string;

  /** Current constraints */
  constraints: string[];

  /** Relevant prior decisions */
  priorDecisions: string[];

  /** Stakeholders affected */
  stakeholders: string[];

  /** Urgency level */
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Score indicating how reversible a decision is
 */
export interface ReversibilityScore {
  /** Overall reversibility (0.0-1.0, 1.0 is fully reversible) */
  score: number;

  /** Classification of reversibility */
  classification: ReversibilityClassification;

  /** Factors affecting reversibility */
  factors: ReversibilityFactor[];

  /** Recommendations for preserving optionality */
  recommendations: string[];

  /** Window within which reversal is feasible */
  reversalWindow?: Date;
}

/**
 * Classification of how reversible a decision is
 */
export type ReversibilityClassification =
  | 'fully_reversible'     // Can be completely undone
  | 'mostly_reversible'    // Can be mostly undone with some residual effects
  | 'partially_reversible' // Can be partially undone
  | 'one_way_door'         // Cannot be undone without significant consequences
  | 'irreversible';        // Cannot be undone at all

/**
 * A factor affecting reversibility
 */
export interface ReversibilityFactor {
  /** Name of the factor */
  name: string;

  /** Impact on reversibility (0.0-1.0, higher means more reversible) */
  impact: number;

  /** Description of how this factor affects reversibility */
  description: string;

  /** Whether this factor can be mitigated */
  mitigatable: boolean;
}

/**
 * Represents an option that can be preserved
 */
export interface Option {
  /** Unique identifier */
  id: string;

  /** Name of the option */
  name: string;

  /** Description of what this option provides */
  description: string;

  /** Current value of the option */
  currentValue: OptionValue;

  /** Cost to preserve this option */
  preservationCost: Cost;

  /** When this option expires if not exercised */
  expirationDate?: Date;

  /** Context in which this option is relevant */
  context: string;

  /** Dependencies of this option */
  dependencies: string[];

  /** Whether this option is currently preserved */
  preserved: boolean;

  /** Actions required to exercise this option */
  exerciseRequirements: string[];
}

/**
 * Value assessment for an option
 */
export interface OptionValue {
  /** Estimated monetary value if quantifiable */
  monetaryValue?: number;

  /** Strategic value (0.0-1.0) */
  strategicValue: number;

  /** Time value - how value changes over time */
  timeDecay: 'increasing' | 'stable' | 'decreasing';

  /** Uncertainty in the value estimate */
  uncertainty: 'low' | 'medium' | 'high';

  /** Scenarios where this option is valuable */
  valuableScenarios: string[];

  /** Probability of needing this option (0.0-1.0) */
  exerciseProbability: number;
}

/**
 * Interface for optionality management
 */
export interface OptionalityManager {
  /** Assess how reversible a decision is */
  assessReversibility(decision: Decision): ReversibilityScore;

  /** Identify available options in a context */
  identifyOptions(context: DecisionContext): Option[];

  /** Preserve an option by paying its preservation cost */
  preserveOption(optionId: string, cost: Cost): void;

  /** Evaluate the value of an option */
  evaluateOptionValue(optionId: string): OptionValue;

  /** Get all preserved options */
  getPreservedOptions(): Option[];

  /** Recommend which options to preserve */
  recommendPreservation(budget: Cost): Option[];
}

// ============================================================================
// BARBELL STRATEGY
// ============================================================================

/**
 * Item that can be categorized for barbell allocation
 */
export interface Item {
  /** Unique identifier */
  id: string;

  /** Name of the item */
  name: string;

  /** Description */
  description: string;

  /** Risk level (0.0-1.0) */
  riskLevel: number;

  /** Potential upside (0.0-1.0) */
  potentialUpside: number;

  /** Potential downside (0.0-1.0) */
  potentialDownside: number;

  /** Category of the item */
  category: string;

  /** Current allocation if any */
  currentAllocation?: number;

  /** Dependencies */
  dependencies: string[];
}

/**
 * Budget for barbell allocation
 */
export interface Budget {
  /** Total budget available */
  total: number;

  /** Unit of the budget */
  unit: 'dollars' | 'hours' | 'points' | 'percentage';

  /** Minimum allocation for conservative */
  conservativeMinimum: number;

  /** Maximum allocation for experimental */
  experimentalMaximum: number;

  /** Constraints on allocation */
  constraints: AllocationConstraint[];
}

/**
 * Constraint on budget allocation
 */
export interface AllocationConstraint {
  /** Type of constraint */
  type: 'min_items' | 'max_items' | 'must_include' | 'must_exclude' | 'ratio';

  /** Value of the constraint */
  value: number | string | string[];

  /** Category this constraint applies to */
  category?: 'conservative' | 'experimental';

  /** Description of the constraint */
  description: string;
}

/**
 * Allocation following barbell strategy
 */
export interface BarbellAllocation {
  /** Percentage allocated to conservative items (typically 80-90%) */
  conservativePercentage: number;

  /** Percentage allocated to experimental items (typically 10-20%) */
  experimentalPercentage: number;

  /** Items in the conservative allocation */
  conservativeItems: AllocatedItem[];

  /** Items in the experimental allocation */
  experimentalItems: AllocatedItem[];

  /** Total allocated */
  totalAllocated: number;

  /** Unallocated budget */
  unallocated: number;

  /** Explanation of the allocation */
  rationale: string;

  /** Risk metrics for the allocation */
  riskMetrics: AllocationRiskMetrics;
}

/**
 * An item with its allocation
 */
export interface AllocatedItem extends Item {
  /** Amount allocated to this item */
  allocation: number;

  /** Percentage of total this represents */
  percentageOfTotal: number;

  /** Rationale for this allocation */
  allocationRationale: string;
}

/**
 * Risk metrics for an allocation
 */
export interface AllocationRiskMetrics {
  /** Maximum potential loss */
  maxPotentialLoss: number;

  /** Maximum potential gain */
  maxPotentialGain: number;

  /** Expected value */
  expectedValue: number;

  /** Variance in outcomes */
  variance: number;

  /** Tail risk (probability of extreme loss) */
  tailRisk: number;
}

/**
 * Protection for core components
 */
export interface Protection {
  /** Components being protected */
  protectedComponents: string[];

  /** Protection mechanisms in place */
  mechanisms: ProtectionMechanism[];

  /** Coverage level (0.0-1.0) */
  coverageLevel: number;

  /** Cost of maintaining protection */
  maintenanceCost: Cost;

  /** Last verification date */
  lastVerified: Date;

  /** Issues with current protection */
  issues: ProtectionIssue[];
}

/**
 * A mechanism providing protection
 */
export interface ProtectionMechanism {
  /** Type of protection */
  type: 'redundancy' | 'backup' | 'failover' | 'isolation' | 'rate_limiting' | 'monitoring' | 'access_control';

  /** Description of the mechanism */
  description: string;

  /** Components this protects */
  protects: string[];

  /** Effectiveness (0.0-1.0) */
  effectiveness: number;

  /** Cost to maintain */
  cost: Cost;
}

/**
 * An issue with protection
 */
export interface ProtectionIssue {
  /** Description of the issue */
  description: string;

  /** Severity of the issue */
  severity: 'critical' | 'major' | 'minor';

  /** Components affected */
  affectedComponents: string[];

  /** Suggested remediation */
  remediation: string;
}

/**
 * Scope for experimentation
 */
export interface Scope {
  /** Allowed areas for experimentation */
  allowedAreas: string[];

  /** Forbidden areas */
  forbiddenAreas: string[];

  /** Maximum blast radius */
  maxBlastRadius: number;

  /** Required safeguards */
  requiredSafeguards: string[];

  /** Rollback requirements */
  rollbackRequirements: RollbackRequirement[];
}

/**
 * Requirement for rollback capability
 */
export interface RollbackRequirement {
  /** What must be rollbackable */
  target: string;

  /** Maximum time to rollback in minutes */
  maxTimeMinutes: number;

  /** Verification method */
  verification: string;
}

/**
 * Configuration for an experiment
 */
export interface ExperimentConfig {
  /** Unique identifier */
  id: string;

  /** Name of the experiment */
  name: string;

  /** Description */
  description: string;

  /** Hypothesis being tested */
  hypothesis: string;

  /** Success criteria */
  successCriteria: string[];

  /** Failure criteria (when to abort) */
  failureCriteria: string[];

  /** Maximum duration */
  maxDurationHours: number;

  /** Resources allocated */
  allocatedResources: number;

  /** Safeguards in place */
  safeguards: string[];

  /** Rollback plan */
  rollbackPlan: string;

  /** Monitoring requirements */
  monitoring: ExperimentMonitoring;

  /** Current status */
  status: ExperimentStatus;
}

/**
 * Monitoring for an experiment
 */
export interface ExperimentMonitoring {
  /** Metrics to watch */
  metrics: string[];

  /** Alert thresholds */
  alertThresholds: Record<string, number>;

  /** Check frequency in seconds */
  checkFrequencySeconds: number;

  /** Who to notify on issues */
  notificationTargets: string[];
}

/**
 * Status of an experiment
 */
export type ExperimentStatus =
  | 'planned'      // Experiment is planned
  | 'running'      // Experiment is active
  | 'paused'       // Experiment is paused
  | 'completed'    // Experiment finished successfully
  | 'aborted'      // Experiment was aborted
  | 'failed';      // Experiment failed

/**
 * Interface for barbell strategy management
 */
export interface BarbellStrategy {
  /** Categorize an item as ultra-safe or experimental */
  categorizeRisk(item: Item): 'ultra_safe' | 'moderate' | 'experimental';

  /** Allocate resources following barbell strategy */
  allocateResources(items: Item[], budget: Budget): BarbellAllocation;

  /** Set up protection for core components */
  protectCore(coreComponents: string[]): Protection;

  /** Enable experimentation within safe bounds */
  enableExperimentation(scope: Scope): ExperimentConfig;

  /** Get current allocation */
  getCurrentAllocation(): BarbellAllocation;

  /** Rebalance allocation */
  rebalance(newBudget: Budget): BarbellAllocation;
}

// ============================================================================
// VIA NEGATIVA (IMPROVEMENT BY SUBTRACTION)
// ============================================================================

/**
 * Represents a system that can be analyzed for fragilities
 */
export interface System {
  /** Unique identifier */
  id: string;

  /** Name of the system */
  name: string;

  /** Components of the system */
  components: SystemComponent[];

  /** Dependencies between components */
  dependencies: SystemDependency[];

  /** External dependencies */
  externalDependencies: ExternalSystemDependency[];

  /** Complexity metrics */
  complexityMetrics: ComplexityMetrics;

  /** Last analyzed date */
  lastAnalyzed?: Date;
}

/**
 * A component within a system
 */
export interface SystemComponent {
  /** Unique identifier */
  id: string;

  /** Name of the component */
  name: string;

  /** Type of component */
  type: 'service' | 'library' | 'database' | 'queue' | 'cache' | 'external_api' | 'config' | 'other';

  /** Criticality (0.0-1.0) */
  criticality: number;

  /** Lines of code or size metric */
  size: number;

  /** Age in days */
  ageInDays: number;

  /** Change frequency (changes per week) */
  changeFrequency: number;

  /** Bug density (bugs per KLOC) */
  bugDensity: number;

  /** Test coverage (0.0-1.0) */
  testCoverage: number;

  /** Documentation coverage (0.0-1.0) */
  documentationCoverage: number;

  /** Owner of the component */
  owner?: string;
}

/**
 * Dependency between system components
 */
export interface SystemDependency {
  /** Source component */
  from: string;

  /** Target component */
  to: string;

  /** Type of dependency */
  type: 'imports' | 'calls' | 'inherits' | 'configures' | 'data_flow';

  /** Strength of coupling (0.0-1.0) */
  couplingStrength: number;

  /** Whether this is a circular dependency */
  isCircular: boolean;
}

/**
 * External dependency of the system
 */
export interface ExternalSystemDependency {
  /** Name of the external system */
  name: string;

  /** Version if applicable */
  version?: string;

  /** Criticality (0.0-1.0) */
  criticality: number;

  /** Whether alternatives exist */
  hasAlternatives: boolean;

  /** Last update date */
  lastUpdated?: Date;

  /** Known vulnerabilities */
  vulnerabilities: number;

  /** License type */
  license?: string;

  /** Maintenance status */
  maintenanceStatus: 'active' | 'maintenance_mode' | 'deprecated' | 'abandoned';
}

/**
 * Complexity metrics for a system
 */
export interface ComplexityMetrics {
  /** Cyclomatic complexity */
  cyclomaticComplexity: number;

  /** Cognitive complexity */
  cognitiveComplexity: number;

  /** Number of dependencies */
  dependencyCount: number;

  /** Depth of dependency tree */
  dependencyDepth: number;

  /** Coupling between components */
  coupling: number;

  /** Cohesion within components */
  cohesion: number;

  /** Technical debt ratio */
  technicalDebtRatio: number;
}

/**
 * A fragility identified in a system
 */
export interface Fragility {
  /** Unique identifier */
  id: string;

  /** Type of fragility */
  type: FragilityType;

  /** Description of the fragility */
  description: string;

  /** Components affected */
  affectedComponents: string[];

  /** Severity (0.0-1.0) */
  severity: number;

  /** Likelihood of causing issues (0.0-1.0) */
  likelihood: number;

  /** Potential impact description */
  potentialImpact: string;

  /** Root causes */
  rootCauses: string[];

  /** Evidence for this fragility */
  evidence: FragilityEvidence[];

  /** How long this fragility has existed */
  ageInDays?: number;

  /** Whether this is increasing in severity */
  trending: 'worsening' | 'stable' | 'improving';

  /** Remediation options */
  remediationOptions: RemediationOption[];
}

/**
 * Types of fragilities
 */
export type FragilityType =
  | 'single_point_of_failure'  // No redundancy
  | 'tight_coupling'           // Excessive coupling
  | 'hidden_dependency'        // Undocumented dependency
  | 'complexity'               // Excessive complexity
  | 'technical_debt'           // Accumulated debt
  | 'outdated_dependency'      // Old external dependency
  | 'missing_tests'            // Lack of test coverage
  | 'missing_monitoring'       // Lack of observability
  | 'documentation_gap'        // Missing documentation
  | 'security_vulnerability'   // Security issue
  | 'performance_bottleneck'   // Performance issue
  | 'resource_exhaustion_risk' // Risk of resource exhaustion
  | 'cascade_failure_risk';    // Risk of cascading failures

/**
 * Evidence supporting a fragility finding
 */
export interface FragilityEvidence {
  /** Type of evidence */
  type: 'metric' | 'incident' | 'code_analysis' | 'dependency_scan' | 'manual_review';

  /** Description of the evidence */
  description: string;

  /** When this evidence was collected */
  collectedAt: Date;

  /** Source of the evidence */
  source: string;

  /** Confidence in this evidence (0.0-1.0) */
  confidence: number;
}

/**
 * Option for remediating a fragility
 */
export interface RemediationOption {
  /** Description of the remediation */
  description: string;

  /** Type of remediation */
  type: 'remove' | 'replace' | 'refactor' | 'add_safeguard' | 'document' | 'monitor';

  /** Estimated effort */
  effort: EffortEstimate;

  /** Expected risk reduction (0.0-1.0) */
  expectedRiskReduction: number;

  /** Prerequisites for this remediation */
  prerequisites: string[];

  /** Potential side effects */
  sideEffects: string[];
}

/**
 * Represents a removal action (via negativa)
 */
export interface Removal {
  /** Unique identifier */
  id: string;

  /** What is being removed */
  target: string;

  /** Type of removal */
  type: 'code' | 'dependency' | 'feature' | 'component' | 'configuration' | 'process';

  /** Reason for removal */
  reason: string;

  /** Associated fragility if any */
  associatedFragility?: string;

  /** Expected simplification benefit */
  expectedBenefit: SimplificationBenefit;

  /** Dependencies on what's being removed */
  dependents: string[];

  /** Migration path for dependents */
  migrationPath?: string;

  /** Status of the removal */
  status: RemovalStatus;
}

/**
 * Benefit expected from simplification
 */
export interface SimplificationBenefit {
  /** Lines of code removed */
  linesRemoved: number;

  /** Dependencies removed */
  dependenciesRemoved: number;

  /** Complexity reduction */
  complexityReduction: number;

  /** Maintenance burden reduction (hours per month) */
  maintenanceReduction: number;

  /** Risk reduction (0.0-1.0) */
  riskReduction: number;

  /** Cognitive load reduction (qualitative) */
  cognitiveLoadReduction: 'significant' | 'moderate' | 'minimal';
}

/**
 * Status of a removal
 */
export type RemovalStatus =
  | 'proposed'    // Removal has been proposed
  | 'approved'    // Removal has been approved
  | 'in_progress' // Removal is in progress
  | 'completed'   // Removal has been completed
  | 'verified'    // Removal has been verified as safe
  | 'rejected'    // Removal was rejected
  | 'rolled_back'; // Removal was rolled back

/**
 * Safety check for a removal
 */
export interface RemovalSafetyCheck {
  /** Whether the removal is safe */
  safe: boolean;

  /** Confidence in the safety assessment (0.0-1.0) */
  confidence: number;

  /** Risks identified */
  risks: RemovalRisk[];

  /** Required mitigations before proceeding */
  requiredMitigations: string[];

  /** Recommended testing before removal */
  recommendedTests: string[];

  /** Rollback capability assessment */
  rollbackCapability: 'full' | 'partial' | 'none';

  /** Blast radius if something goes wrong */
  blastRadius: 'minimal' | 'moderate' | 'significant' | 'catastrophic';
}

/**
 * Risk associated with a removal
 */
export interface RemovalRisk {
  /** Description of the risk */
  description: string;

  /** Severity of the risk */
  severity: 'critical' | 'major' | 'minor';

  /** Likelihood of occurring (0.0-1.0) */
  likelihood: number;

  /** Mitigation for this risk */
  mitigation?: string;
}

/**
 * Metrics tracking simplification progress
 */
export interface SimplificationMetrics {
  /** System being tracked */
  systemId: string;

  /** Time period */
  periodStart: Date;
  periodEnd: Date;

  /** Fragilities at start */
  fragilityCountStart: number;

  /** Fragilities at end */
  fragilityCountEnd: number;

  /** Fragilities removed */
  fragilitiesRemoved: number;

  /** Complexity at start */
  complexityStart: ComplexityMetrics;

  /** Complexity at end */
  complexityEnd: ComplexityMetrics;

  /** Removals completed */
  removalsCompleted: number;

  /** Lines of code removed */
  linesRemoved: number;

  /** Dependencies removed */
  dependenciesRemoved: number;

  /** Incidents before and after */
  incidentsBefore: number;
  incidentsAfter: number;

  /** Overall simplification score (0.0-1.0) */
  simplificationScore: number;

  /** Confidence in metrics */
  confidence: ConfidenceAssessment;
}

/**
 * Interface for via negativa analysis
 */
export interface ViaNegativa {
  /** Identify fragilities in a system */
  identifyFragilities(system: System): Fragility[];

  /** Prioritize fragilities for removal */
  prioritizeRemoval(fragilities: Fragility[]): Fragility[];

  /** Track simplification progress */
  trackSimplification(systemId: string, periodDays?: number): SimplificationMetrics;

  /** Validate that a removal is safe */
  validateRemoval(removal: Removal): RemovalSafetyCheck;

  /** Propose removals based on fragility analysis */
  proposeRemovals(fragilities: Fragility[]): Removal[];

  /** Get simplification recommendations */
  getRecommendations(system: System): SimplificationRecommendation[];
}

/**
 * Recommendation for simplification
 */
export interface SimplificationRecommendation {
  /** Priority of the recommendation */
  priority: 'critical' | 'high' | 'medium' | 'low';

  /** Type of simplification */
  type: 'remove' | 'consolidate' | 'replace' | 'refactor';

  /** Description */
  description: string;

  /** Target of the simplification */
  target: string;

  /** Expected benefit */
  expectedBenefit: SimplificationBenefit;

  /** Effort required */
  effort: EffortEstimate;

  /** Prerequisites */
  prerequisites: string[];
}

// ============================================================================
// SKIN IN THE GAME (ACCOUNTABILITY SYSTEM)
// ============================================================================

/**
 * Ownership of an artifact
 */
export interface Ownership {
  /** Artifact being owned */
  artifactId: string;

  /** Owner of the artifact */
  ownerId: string;

  /** Type of ownership */
  type: OwnershipType;

  /** When ownership was assigned */
  assignedAt: Date;

  /** Who assigned the ownership */
  assignedBy: string;

  /** Whether ownership is currently active */
  active: boolean;

  /** Responsibilities that come with ownership */
  responsibilities: string[];

  /** Metrics tracked for this ownership */
  metrics: OwnershipMetrics;

  /** History of ownership transfers */
  history: OwnershipTransfer[];
}

/**
 * Type of ownership
 */
export type OwnershipType =
  | 'primary'    // Main owner with full responsibility
  | 'secondary'  // Backup owner
  | 'reviewer'   // Must review changes
  | 'consulted'  // Should be consulted on changes
  | 'informed';  // Should be informed of changes

/**
 * Metrics for an ownership relationship
 */
export interface OwnershipMetrics {
  /** Time since ownership assigned */
  tenureDays: number;

  /** Number of changes made */
  changesMade: number;

  /** Number of issues created */
  issuesCreated: number;

  /** Number of issues resolved */
  issuesResolved: number;

  /** Average time to respond to issues */
  avgResponseTimeHours: number;

  /** Quality score for owned artifacts (0.0-1.0) */
  qualityScore: number;
}

/**
 * Record of an ownership transfer
 */
export interface OwnershipTransfer {
  /** Previous owner */
  fromOwner: string;

  /** New owner */
  toOwner: string;

  /** When the transfer occurred */
  transferredAt: Date;

  /** Reason for transfer */
  reason: string;

  /** Who approved the transfer */
  approvedBy: string;
}

/**
 * Quality metrics for an author
 */
export interface QualityMetrics {
  /** Author being measured */
  authorId: string;

  /** Time period for metrics */
  periodStart: Date;
  periodEnd: Date;

  /** Total artifacts authored */
  totalArtifacts: number;

  /** Average quality score (0.0-1.0) */
  averageQuality: number;

  /** Bug rate (bugs per artifact) */
  bugRate: number;

  /** Rework rate (times artifacts needed revision) */
  reworkRate: number;

  /** Review feedback incorporation rate (0.0-1.0) */
  feedbackIncorporationRate: number;

  /** Code review acceptance rate (0.0-1.0) */
  reviewAcceptanceRate: number;

  /** Documentation completeness (0.0-1.0) */
  documentationCompleteness: number;

  /** Test coverage for authored code (0.0-1.0) */
  testCoverage: number;

  /** Breakdown by artifact type */
  breakdownByType: Record<string, QualityBreakdown>;

  /** Trend over time */
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Quality breakdown for a specific artifact type
 */
export interface QualityBreakdown {
  /** Number of artifacts */
  count: number;

  /** Average quality */
  averageQuality: number;

  /** Issues found */
  issuesFound: number;

  /** Issues resolved */
  issuesResolved: number;
}

/**
 * Feedback on an artifact
 */
export interface Feedback {
  /** Unique identifier */
  id: string;

  /** Type of feedback */
  type: FeedbackType;

  /** Sentiment of the feedback */
  sentiment: 'positive' | 'neutral' | 'negative';

  /** Content of the feedback */
  content: string;

  /** Severity if applicable */
  severity?: 'critical' | 'major' | 'minor' | 'suggestion';

  /** Who provided the feedback */
  providedBy: string;

  /** When the feedback was provided */
  providedAt: Date;

  /** Whether the feedback has been addressed */
  addressed: boolean;

  /** Response to the feedback */
  response?: FeedbackResponse;

  /** Impact on quality score */
  qualityImpact: number;
}

/**
 * Type of feedback
 */
export type FeedbackType =
  | 'bug_report'       // Bug in the artifact
  | 'code_review'      // Code review comments
  | 'user_complaint'   // User reported issue
  | 'performance'      // Performance issue
  | 'security'         // Security issue
  | 'documentation'    // Documentation issue
  | 'design'           // Design issue
  | 'praise'           // Positive feedback
  | 'suggestion';      // Improvement suggestion

/**
 * Response to feedback
 */
export interface FeedbackResponse {
  /** Content of the response */
  content: string;

  /** Who responded */
  respondedBy: string;

  /** When the response was made */
  respondedAt: Date;

  /** Action taken */
  actionTaken: 'fixed' | 'wont_fix' | 'deferred' | 'investigating' | 'acknowledged';

  /** Time to respond in hours */
  responseTimeHours: number;
}

/**
 * Reputation score for an author
 */
export interface ReputationScore {
  /** Author being scored */
  authorId: string;

  /** Overall reputation score (0.0-1.0) */
  overall: number;

  /** Components of the reputation */
  components: ReputationComponent[];

  /** Confidence in the score */
  confidence: 'high' | 'medium' | 'low';

  /** History of score changes */
  history: ReputationChange[];

  /** Badges earned */
  badges: Badge[];

  /** Current level */
  level: ReputationLevel;

  /** Last updated */
  lastUpdated: Date;
}

/**
 * Component of a reputation score
 */
export interface ReputationComponent {
  /** Name of the component */
  name: string;

  /** Score for this component (0.0-1.0) */
  score: number;

  /** Weight in overall reputation */
  weight: number;

  /** Description of what this measures */
  description: string;
}

/**
 * Record of a reputation change
 */
export interface ReputationChange {
  /** When the change occurred */
  changedAt: Date;

  /** Previous score */
  previousScore: number;

  /** New score */
  newScore: number;

  /** Reason for change */
  reason: string;

  /** Event that triggered the change */
  triggeringEvent: string;
}

/**
 * Badge earned by an author
 */
export interface Badge {
  /** Badge identifier */
  id: string;

  /** Badge name */
  name: string;

  /** Description of how it was earned */
  description: string;

  /** When it was earned */
  earnedAt: Date;

  /** Category of badge */
  category: 'quality' | 'reliability' | 'responsiveness' | 'collaboration' | 'expertise';

  /** Rarity of the badge */
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

/**
 * Level in the reputation system
 */
export interface ReputationLevel {
  /** Level number */
  level: number;

  /** Level name */
  name: string;

  /** Points required for this level */
  pointsRequired: number;

  /** Privileges at this level */
  privileges: string[];

  /** Points needed for next level */
  pointsToNextLevel: number;
}

/**
 * Interface for accountability system
 */
export interface AccountabilitySystem {
  /** Assign ownership of an artifact */
  assignOwnership(artifactId: string, ownerId: string, type?: OwnershipType): Ownership;

  /** Track quality metrics for an author */
  trackAuthorQuality(authorId: string, periodDays?: number): QualityMetrics;

  /** Route feedback to the appropriate owner */
  routeFeedback(artifactId: string, feedback: Omit<Feedback, 'id'>): Feedback;

  /** Calculate reputation score for an author */
  calculateReputation(authorId: string): ReputationScore;

  /** Get ownership for an artifact */
  getOwnership(artifactId: string): Ownership | undefined;

  /** Transfer ownership */
  transferOwnership(artifactId: string, newOwnerId: string, reason: string): Ownership;

  /** Get all feedback for an artifact */
  getFeedback(artifactId: string): Feedback[];

  /** Get top contributors */
  getTopContributors(count?: number): ReputationScore[];
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new stress event
 */
export function createStressEvent(
  input: Omit<StressEvent, 'id'>
): StressEvent {
  return {
    id: `stress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...input,
  };
}

/**
 * Create a new improvement
 */
export function createImprovement(
  input: Omit<Improvement, 'id' | 'identifiedAt' | 'status'>
): Improvement {
  return {
    id: `improvement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'identified',
    identifiedAt: new Date(),
    ...input,
  };
}

/**
 * Create a new decision
 */
export function createDecision(
  input: Omit<Decision, 'id'>
): Decision {
  return {
    id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...input,
  };
}

/**
 * Create a new option
 */
export function createOption(
  input: Omit<Option, 'id'>
): Option {
  return {
    id: `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...input,
  };
}

/**
 * Create a barbell allocation
 */
export function createBarbellAllocation(
  items: Item[],
  budget: Budget,
  conservativeRatio: number = 0.85
): BarbellAllocation {
  const experimentalRatio = 1 - conservativeRatio;

  // Categorize items by risk
  const categorized = items.map(item => ({
    item,
    category: item.riskLevel < 0.3 ? 'conservative' as const :
              item.riskLevel > 0.7 ? 'experimental' as const : 'moderate' as const
  }));

  const conservativeItems = categorized.filter(c => c.category === 'conservative');
  const experimentalItems = categorized.filter(c => c.category === 'experimental');

  const conservativeBudget = budget.total * conservativeRatio;
  const experimentalBudget = budget.total * experimentalRatio;

  // Allocate within each category
  const allocatedConservative: AllocatedItem[] = conservativeItems.map((c, i) => ({
    ...c.item,
    allocation: conservativeBudget / Math.max(conservativeItems.length, 1),
    percentageOfTotal: conservativeRatio / Math.max(conservativeItems.length, 1),
    allocationRationale: 'Low-risk item suitable for conservative allocation',
  }));

  const allocatedExperimental: AllocatedItem[] = experimentalItems.map((c, i) => ({
    ...c.item,
    allocation: experimentalBudget / Math.max(experimentalItems.length, 1),
    percentageOfTotal: experimentalRatio / Math.max(experimentalItems.length, 1),
    allocationRationale: 'High-risk, high-reward item for experimental allocation',
  }));

  const totalAllocated = allocatedConservative.reduce((sum, i) => sum + i.allocation, 0) +
                         allocatedExperimental.reduce((sum, i) => sum + i.allocation, 0);

  const conservativePct = Math.round(conservativeRatio * 100 * 100) / 100;
  const experimentalPct = Math.round(experimentalRatio * 100 * 100) / 100;

  return {
    conservativePercentage: conservativePct,
    experimentalPercentage: experimentalPct,
    conservativeItems: allocatedConservative,
    experimentalItems: allocatedExperimental,
    totalAllocated,
    unallocated: budget.total - totalAllocated,
    rationale: `Barbell allocation with ${conservativePct}% conservative / ${experimentalPct}% experimental split`,
    riskMetrics: calculateAllocationRiskMetrics(allocatedConservative, allocatedExperimental),
  };
}

/**
 * Calculate risk metrics for an allocation
 */
function calculateAllocationRiskMetrics(
  conservative: AllocatedItem[],
  experimental: AllocatedItem[]
): AllocationRiskMetrics {
  const maxLossConservative = conservative.reduce((sum, i) => sum + i.allocation * i.potentialDownside, 0);
  const maxLossExperimental = experimental.reduce((sum, i) => sum + i.allocation * i.potentialDownside, 0);

  const maxGainConservative = conservative.reduce((sum, i) => sum + i.allocation * i.potentialUpside, 0);
  const maxGainExperimental = experimental.reduce((sum, i) => sum + i.allocation * i.potentialUpside, 0);

  const expectedValue = (maxGainConservative + maxGainExperimental) - (maxLossConservative + maxLossExperimental);

  return {
    maxPotentialLoss: maxLossConservative + maxLossExperimental,
    maxPotentialGain: maxGainConservative + maxGainExperimental,
    expectedValue,
    variance: Math.abs(maxGainExperimental - maxLossExperimental),
    tailRisk: maxLossExperimental / (maxLossConservative + maxLossExperimental + 0.001),
  };
}

/**
 * Create a fragility
 */
export function createFragility(
  input: Omit<Fragility, 'id'>
): Fragility {
  return {
    id: `fragility-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...input,
  };
}

/**
 * Create a removal proposal
 */
export function createRemoval(
  input: Omit<Removal, 'id' | 'status'>
): Removal {
  return {
    id: `removal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'proposed',
    ...input,
  };
}

/**
 * Create an ownership assignment
 */
export function createOwnership(
  artifactId: string,
  ownerId: string,
  assignedBy: string,
  type: OwnershipType = 'primary'
): Ownership {
  return {
    artifactId,
    ownerId,
    type,
    assignedAt: new Date(),
    assignedBy,
    active: true,
    responsibilities: getDefaultResponsibilities(type),
    metrics: {
      tenureDays: 0,
      changesMade: 0,
      issuesCreated: 0,
      issuesResolved: 0,
      avgResponseTimeHours: 0,
      qualityScore: 0.5,
    },
    history: [],
  };
}

/**
 * Get default responsibilities for an ownership type
 */
function getDefaultResponsibilities(type: OwnershipType): string[] {
  switch (type) {
    case 'primary':
      return [
        'Maintain code quality',
        'Review and approve changes',
        'Respond to issues within SLA',
        'Document changes and decisions',
        'Ensure test coverage',
      ];
    case 'secondary':
      return [
        'Act as backup owner',
        'Review changes when requested',
        'Step in during primary owner absence',
      ];
    case 'reviewer':
      return [
        'Review all changes before merge',
        'Provide constructive feedback',
      ];
    case 'consulted':
      return [
        'Provide expertise when consulted',
        'Review major architectural changes',
      ];
    case 'informed':
      return [
        'Stay informed of major changes',
        'Raise concerns if any',
      ];
  }
}

/**
 * Create feedback
 */
export function createFeedback(
  artifactId: string,
  input: Omit<Feedback, 'id' | 'addressed'>
): Feedback {
  return {
    id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    addressed: false,
    ...input,
  };
}

// ============================================================================
// CONFIDENCE ASSESSMENT HELPERS
// ============================================================================

/**
 * Create a confidence assessment
 */
export function createConfidenceAssessment(
  score: number,
  factors: Array<{ name: string; contribution: number; evidence: string }>
): ConfidenceAssessment {
  const level: ConfidenceLevel =
    score >= 0.9 ? 'verified' :
    score >= 0.7 ? 'established' :
    score >= 0.5 ? 'probable' :
    score >= 0.3 ? 'speculative' : 'unknown';

  return {
    level,
    score,
    factors: factors.map(f => ({
      ...f,
      quality: f.contribution >= 0.7 ? 'strong' as const : f.contribution >= 0.4 ? 'moderate' as const : 'weak' as const,
    })),
    lastAssessed: new Date().toISOString(),
    assessedBy: 'system',
  };
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Stress response configuration for high-reliability systems
 */
export const HIGH_RELIABILITY_STRESS_CONFIG = Object.freeze({
  minSeverityToRecord: 0.1,
  autoAnalyzeThreshold: 0.5,
  requiredResolutionTime: {
    critical: 15, // minutes
    high: 60,
    medium: 240,
    low: 1440,
  },
  requiredMetrics: [
    'errorRate',
    'latencyP99Ms',
    'throughput',
    'cpuUtilization',
    'memoryUtilization',
  ],
  chaosExperimentsEnabled: true,
  learningLoopEnabled: true,
});

/**
 * Stress response configuration for standard systems
 */
export const STANDARD_STRESS_CONFIG = Object.freeze({
  minSeverityToRecord: 0.3,
  autoAnalyzeThreshold: 0.7,
  requiredResolutionTime: {
    critical: 60,
    high: 240,
    medium: 1440,
    low: 10080,
  },
  requiredMetrics: [
    'errorRate',
    'latencyP95Ms',
    'throughput',
  ],
  chaosExperimentsEnabled: false,
  learningLoopEnabled: true,
});

/**
 * Barbell strategy configuration for conservative approach
 */
export const CONSERVATIVE_BARBELL_CONFIG = Object.freeze({
  conservativeRatio: 0.90,
  experimentalRatio: 0.10,
  conservativeRiskThreshold: 0.2,
  experimentalRiskThreshold: 0.8,
  requiredSafeguards: [
    'circuit_breaker',
    'rollback_capability',
    'monitoring',
    'alerting',
  ],
  experimentMaxBlastRadius: 0.05,
});

/**
 * Barbell strategy configuration for balanced approach
 */
export const BALANCED_BARBELL_CONFIG = Object.freeze({
  conservativeRatio: 0.85,
  experimentalRatio: 0.15,
  conservativeRiskThreshold: 0.3,
  experimentalRiskThreshold: 0.7,
  requiredSafeguards: [
    'rollback_capability',
    'monitoring',
  ],
  experimentMaxBlastRadius: 0.10,
});

/**
 * Barbell strategy configuration for aggressive approach
 */
export const AGGRESSIVE_BARBELL_CONFIG = Object.freeze({
  conservativeRatio: 0.80,
  experimentalRatio: 0.20,
  conservativeRiskThreshold: 0.4,
  experimentalRiskThreshold: 0.6,
  requiredSafeguards: [
    'rollback_capability',
  ],
  experimentMaxBlastRadius: 0.15,
});

/**
 * Via negativa configuration for thorough simplification
 */
export const THOROUGH_SIMPLIFICATION_CONFIG = Object.freeze({
  fragilityThresholds: {
    critical: 0.8,
    high: 0.6,
    medium: 0.4,
    low: 0.2,
  },
  complexityThresholds: {
    maxCyclomaticComplexity: 10,
    maxCognitiveComplexity: 15,
    maxDependencyDepth: 5,
    maxCoupling: 0.3,
  },
  minimumTestCoverage: 0.8,
  minimumDocCoverage: 0.6,
  maxDependencyAge: 365, // days
  requireRemovalVerification: true,
  allowedBlastRadius: 'minimal' as const,
});

/**
 * Via negativa configuration for standard simplification
 */
export const STANDARD_SIMPLIFICATION_CONFIG = Object.freeze({
  fragilityThresholds: {
    critical: 0.9,
    high: 0.7,
    medium: 0.5,
    low: 0.3,
  },
  complexityThresholds: {
    maxCyclomaticComplexity: 15,
    maxCognitiveComplexity: 25,
    maxDependencyDepth: 8,
    maxCoupling: 0.5,
  },
  minimumTestCoverage: 0.6,
  minimumDocCoverage: 0.4,
  maxDependencyAge: 730, // days
  requireRemovalVerification: true,
  allowedBlastRadius: 'moderate' as const,
});

/**
 * Accountability configuration for strict governance
 */
export const STRICT_ACCOUNTABILITY_CONFIG = Object.freeze({
  requiredOwnership: true,
  maxOwnershipTenure: 365, // days before mandatory review
  responseTimeSLA: {
    critical: 1, // hours
    high: 4,
    medium: 24,
    low: 72,
  },
  minimumQualityScore: 0.7,
  feedbackRequired: true,
  reputationEnabled: true,
  badgesEnabled: true,
});

/**
 * Accountability configuration for standard governance
 */
export const STANDARD_ACCOUNTABILITY_CONFIG = Object.freeze({
  requiredOwnership: true,
  maxOwnershipTenure: 730,
  responseTimeSLA: {
    critical: 4,
    high: 24,
    medium: 72,
    low: 168,
  },
  minimumQualityScore: 0.5,
  feedbackRequired: false,
  reputationEnabled: true,
  badgesEnabled: true,
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate antifragility score from strengthening metrics
 */
export function calculateAntifragilityScore(metrics: StrengtheningMetrics): number {
  const responseQualityWeight = 0.3;
  const improvementWeight = 0.2;
  const mttdWeight = 0.15;
  const mttrWeight = 0.15;
  const trendWeight = 0.2;

  const improvementRatio = metrics.improvementsVerified / Math.max(metrics.improvementsImplemented, 1);
  const mttdScore = Math.max(0, 1 - (metrics.meanTimeToDetectMs / 60000)); // Normalize to minutes
  const mttrScore = Math.max(0, 1 - (metrics.meanTimeToResolveMs / 300000)); // Normalize to 5 minutes
  const trendScore = (metrics.responseQualityTrend + 1) / 2; // Normalize -1 to 1 to 0 to 1

  return (
    metrics.averageResponseQuality * responseQualityWeight +
    improvementRatio * improvementWeight +
    mttdScore * mttdWeight +
    mttrScore * mttrWeight +
    trendScore * trendWeight
  );
}

/**
 * Classify response based on quality score
 */
export function classifyResponse(qualityScore: number): ResponseClassification {
  if (qualityScore >= 0.9) return 'antifragile';
  if (qualityScore >= 0.75) return 'resilient';
  if (qualityScore >= 0.5) return 'robust';
  if (qualityScore >= 0.25) return 'fragile';
  return 'catastrophic';
}

/**
 * Calculate reversibility score for a decision
 */
export function calculateReversibilityScore(decision: Decision): ReversibilityScore {
  const factors: ReversibilityFactor[] = [];
  let totalScore = 0;

  // Base reversibility
  if (decision.reversible) {
    factors.push({
      name: 'Inherent reversibility',
      impact: 0.8,
      description: 'Decision is inherently reversible',
      mitigatable: false,
    });
    totalScore += 0.4;
  } else {
    factors.push({
      name: 'Inherent irreversibility',
      impact: 0.2,
      description: 'Decision is inherently irreversible',
      mitigatable: false,
    });
  }

  // Reversal cost
  if (decision.reversalCost) {
    const costFactor = 1 - Math.min(decision.reversalCost.complexity, 1);
    factors.push({
      name: 'Reversal cost',
      impact: costFactor,
      description: `Complexity of reversal: ${decision.reversalCost.complexity}`,
      mitigatable: true,
    });
    totalScore += costFactor * 0.3;
  }

  // Alternatives available
  const alternativesFactor = Math.min(decision.alternatives.length / 3, 1);
  factors.push({
    name: 'Available alternatives',
    impact: alternativesFactor,
    description: `${decision.alternatives.length} alternatives available`,
    mitigatable: false,
  });
  totalScore += alternativesFactor * 0.3;

  const finalScore = Math.min(totalScore, 1);

  return {
    score: finalScore,
    classification: getReversibilityClassification(finalScore),
    factors,
    recommendations: generateReversibilityRecommendations(decision, finalScore),
    reversalWindow: decision.reversalCost?.risk === 'low' ?
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined,
  };
}

/**
 * Get reversibility classification from score
 */
function getReversibilityClassification(score: number): ReversibilityClassification {
  if (score >= 0.9) return 'fully_reversible';
  if (score >= 0.7) return 'mostly_reversible';
  if (score >= 0.4) return 'partially_reversible';
  if (score >= 0.2) return 'one_way_door';
  return 'irreversible';
}

/**
 * Generate recommendations for improving reversibility
 */
function generateReversibilityRecommendations(decision: Decision, score: number): string[] {
  const recommendations: string[] = [];

  if (score < 0.5) {
    recommendations.push('Consider implementing feature flags to enable gradual rollout');
    recommendations.push('Create a rollback plan before proceeding');
  }

  if (!decision.reversible && decision.alternatives.length === 0) {
    recommendations.push('Identify alternative approaches before committing');
  }

  if (decision.deadline && new Date(decision.deadline).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    recommendations.push('Consider requesting deadline extension to allow for more careful evaluation');
  }

  if (decision.reversalCost && decision.reversalCost.risk === 'high') {
    recommendations.push('Implement safeguards to reduce reversal risk');
  }

  return recommendations;
}

/**
 * Prioritize fragilities by risk and impact
 */
export function prioritizeFragilities(fragilities: Fragility[]): Fragility[] {
  return [...fragilities].sort((a, b) => {
    // Calculate risk score (severity * likelihood)
    const riskA = a.severity * a.likelihood;
    const riskB = b.severity * b.likelihood;

    // Higher risk first
    if (riskB !== riskA) return riskB - riskA;

    // For equal risk, prioritize worsening trends
    if (a.trending === 'worsening' && b.trending !== 'worsening') return -1;
    if (b.trending === 'worsening' && a.trending !== 'worsening') return 1;

    // For equal trend, prioritize SPOFs
    if (a.type === 'single_point_of_failure' && b.type !== 'single_point_of_failure') return -1;
    if (b.type === 'single_point_of_failure' && a.type !== 'single_point_of_failure') return 1;

    return 0;
  });
}

/**
 * Calculate reputation score from quality metrics
 */
export function calculateReputationFromQuality(metrics: QualityMetrics): number {
  const qualityWeight = 0.35;
  const bugRateWeight = 0.20;
  const reworkWeight = 0.15;
  const feedbackWeight = 0.15;
  const testCoverageWeight = 0.15;

  const bugScore = Math.max(0, 1 - metrics.bugRate);
  const reworkScore = Math.max(0, 1 - metrics.reworkRate);

  return (
    metrics.averageQuality * qualityWeight +
    bugScore * bugRateWeight +
    reworkScore * reworkWeight +
    metrics.feedbackIncorporationRate * feedbackWeight +
    metrics.testCoverage * testCoverageWeight
  );
}

/**
 * Get reputation level from score
 */
export function getReputationLevel(score: number): ReputationLevel {
  if (score >= 0.9) {
    return {
      level: 5,
      name: 'Distinguished',
      pointsRequired: 9000,
      privileges: ['Can approve critical changes', 'Mentorship access', 'Architecture decisions'],
      pointsToNextLevel: 0,
    };
  }
  if (score >= 0.75) {
    return {
      level: 4,
      name: 'Senior',
      pointsRequired: 7500,
      privileges: ['Can approve changes', 'Code review authority', 'Ownership assignment'],
      pointsToNextLevel: Math.round((0.9 - score) * 10000),
    };
  }
  if (score >= 0.6) {
    return {
      level: 3,
      name: 'Established',
      pointsRequired: 6000,
      privileges: ['Independent work', 'Peer review', 'Documentation authority'],
      pointsToNextLevel: Math.round((0.75 - score) * 10000),
    };
  }
  if (score >= 0.4) {
    return {
      level: 2,
      name: 'Contributing',
      pointsRequired: 4000,
      privileges: ['Supervised changes', 'Feedback submission'],
      pointsToNextLevel: Math.round((0.6 - score) * 10000),
    };
  }
  return {
    level: 1,
    name: 'Newcomer',
    pointsRequired: 0,
    privileges: ['Learning access', 'Observation'],
    pointsToNextLevel: Math.round((0.4 - score) * 10000),
  };
}

/**
 * Type guard for stress event type
 */
export function isValidStressEventType(type: string): type is StressEventType {
  return [
    'load_spike',
    'failure',
    'attack',
    'chaos_experiment',
    'resource_exhaustion',
    'dependency_failure',
    'data_corruption',
    'network_partition',
  ].includes(type);
}

/**
 * Type guard for fragility type
 */
export function isValidFragilityType(type: string): type is FragilityType {
  return [
    'single_point_of_failure',
    'tight_coupling',
    'hidden_dependency',
    'complexity',
    'technical_debt',
    'outdated_dependency',
    'missing_tests',
    'missing_monitoring',
    'documentation_gap',
    'security_vulnerability',
    'performance_bottleneck',
    'resource_exhaustion_risk',
    'cascade_failure_risk',
  ].includes(type);
}
