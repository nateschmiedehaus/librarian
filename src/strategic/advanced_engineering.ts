/**
 * @fileoverview Advanced Software Engineering Techniques
 *
 * This module incorporates state-of-the-art software engineering research:
 *
 * 1. **Lightweight Formal Methods** - Design-by-contract enforcement
 * 2. **Advanced Testing Techniques** - Metamorphic testing, fuzzing, property-based testing
 * 3. **AI-Assisted Development** - Code review, refactoring suggestions, test generation
 * 4. **Reliability Patterns** - Circuit breakers, bulkheads, retry policies, chaos engineering
 * 5. **Performance Engineering** - Continuous profiling, regression detection, capacity modeling
 *
 * Design Philosophy:
 * - Evidence-based quality through formal verification
 * - Proactive reliability through chaos engineering
 * - AI augmentation for developer productivity
 * - Continuous performance optimization
 *
 * @packageDocumentation
 */

import type { ConfidenceAssessment } from './types.js';

// ============================================================================
// LIGHTWEIGHT FORMAL METHODS
// ============================================================================

/**
 * Precondition specification for design-by-contract
 */
export interface Precondition<T> {
  /** Unique name for this precondition */
  name: string;
  /** Description of what this precondition validates */
  description: string;
  /** The check function */
  check: (input: T) => boolean;
  /** Error message when violated */
  errorMessage: string;
  /** Severity of violation */
  severity: 'error' | 'warning';
  /** Whether to throw on violation or just log */
  mode: 'strict' | 'permissive';
}

/**
 * Postcondition specification for design-by-contract
 */
export interface Postcondition<T, R> {
  /** Unique name for this postcondition */
  name: string;
  /** Description of what this postcondition validates */
  description: string;
  /** The check function - receives both input and output */
  check: (input: T, output: R) => boolean;
  /** Error message when violated */
  errorMessage: string;
  /** Severity of violation */
  severity: 'error' | 'warning';
  /** Whether to throw on violation or just log */
  mode: 'strict' | 'permissive';
}

/**
 * Class invariant specification for design-by-contract
 */
export interface Invariant<T> {
  /** Unique name for this invariant */
  name: string;
  /** Description of what this invariant validates */
  description: string;
  /** The check function */
  check: (state: T) => boolean;
  /** Error message when violated */
  errorMessage: string;
  /** When to check this invariant */
  checkpoints: InvariantCheckpoint[];
}

/**
 * When to validate invariants
 */
export type InvariantCheckpoint =
  | 'before_method'
  | 'after_method'
  | 'on_state_change'
  | 'periodic';

/**
 * Complete contract specification for a function
 */
export interface Contract<T, R> {
  /** Function identifier */
  functionId: string;
  /** Description of the contract */
  description: string;
  /** All preconditions that must hold */
  preconditions: Precondition<T>[];
  /** All postconditions that must hold */
  postconditions: Postcondition<T, R>[];
  /** Class/module invariants to check */
  invariants?: Invariant<unknown>[];
  /** Whether to enable contract checking */
  enabled: boolean;
  /** Behavior when contract is violated */
  onViolation: ContractViolationBehavior;
}

/**
 * How to handle contract violations
 */
export type ContractViolationBehavior =
  | { type: 'throw' }
  | { type: 'log'; level: 'error' | 'warn' | 'info' }
  | { type: 'callback'; handler: (violation: ContractViolation) => void }
  | { type: 'aggregate'; destination: ContractViolation[] };

/**
 * Record of a contract violation
 */
export interface ContractViolation {
  contractId: string;
  violationType: 'precondition' | 'postcondition' | 'invariant';
  conditionName: string;
  message: string;
  severity: 'error' | 'warning';
  timestamp: string;
  input?: unknown;
  output?: unknown;
  stackTrace?: string;
}

/**
 * Contract enforcement interface
 */
export interface ContractEnforcement {
  /** Define a precondition check */
  definePrecondition<T>(
    name: string,
    check: (input: T) => boolean,
    options?: Partial<Omit<Precondition<T>, 'name' | 'check'>>
  ): Precondition<T>;

  /** Define a postcondition check */
  definePostcondition<T, R>(
    name: string,
    check: (input: T, output: R) => boolean,
    options?: Partial<Omit<Postcondition<T, R>, 'name' | 'check'>>
  ): Postcondition<T, R>;

  /** Define a class/module invariant */
  defineInvariant<T>(
    name: string,
    check: (state: T) => boolean,
    options?: Partial<Omit<Invariant<T>, 'name' | 'check'>>
  ): Invariant<T>;

  /** Wrap a function with contract enforcement */
  enforceContract<T, R>(
    fn: (input: T) => R,
    contract: Contract<T, R>
  ): (input: T) => R;

  /** Get all recorded violations */
  getViolations(): ContractViolation[];

  /** Clear recorded violations */
  clearViolations(): void;
}

// ============================================================================
// ADVANCED TESTING TECHNIQUES
// ============================================================================

/**
 * Metamorphic relation for testing
 * Based on Chen et al.'s metamorphic testing research
 */
export interface MetamorphicRelation<T, R> {
  /** Unique name for this relation */
  name: string;
  /** Description of the metamorphic property */
  description: string;
  /** Transform the input to create a follow-up test case */
  transformInput: (input: T) => T;
  /** Verify the relation between original and transformed outputs */
  verifyRelation: (originalOutput: R, transformedOutput: R, originalInput: T, transformedInput: T) => boolean;
  /** Categories/tags for this relation */
  categories: string[];
}

/**
 * Result of a metamorphic test execution
 */
export interface MetamorphicTestResult<T, R> {
  relationName: string;
  originalInput: T;
  transformedInput: T;
  originalOutput: R;
  transformedOutput: R;
  relationHolds: boolean;
  executionTimeMs: number;
  error?: string;
}

/**
 * Complete metamorphic test specification
 */
export interface MetamorphicTest<T, R> {
  /** The metamorphic relation being tested */
  relation: MetamorphicRelation<T, R>;
  /** Source inputs to use */
  sourceInputs: T[];
  /** The function under test */
  functionUnderTest: (input: T) => R;
  /** Configuration options */
  config: MetamorphicTestConfig;
}

export interface MetamorphicTestConfig {
  /** Maximum time for each test case in ms */
  timeoutMs: number;
  /** Whether to continue on failure */
  continueOnFailure: boolean;
  /** Number of transformations to apply per input */
  transformationsPerInput: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Fuzzing configuration for security and robustness testing
 */
export interface FuzzConfig {
  /** Target function/endpoint identifier */
  target: string;
  /** Input schema for the fuzzer */
  inputSchema: FuzzInputSchema;
  /** Mutation strategies to use */
  mutationStrategies: MutationStrategy[];
  /** Corpus of seed inputs */
  seedCorpus: unknown[];
  /** Maximum iterations */
  maxIterations: number;
  /** Time limit in seconds */
  timeLimitSeconds: number;
  /** Coverage-guided fuzzing enabled */
  coverageGuided: boolean;
  /** Crash detection configuration */
  crashDetection: CrashDetectionConfig;
}

export interface FuzzInputSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'custom';
  properties?: Record<string, FuzzInputSchema>;
  items?: FuzzInputSchema;
  constraints?: FuzzConstraint[];
  customGenerator?: () => unknown;
}

export interface FuzzConstraint {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'enum' | 'custom';
  value: unknown;
}

export type MutationStrategy =
  | 'bitflip'
  | 'byteflip'
  | 'arithmetic'
  | 'interesting_values'
  | 'dictionary'
  | 'splice'
  | 'havoc'
  | 'custom';

export interface CrashDetectionConfig {
  /** Detect exceptions */
  detectExceptions: boolean;
  /** Detect hangs (timeout) */
  detectHangs: boolean;
  hangTimeoutMs: number;
  /** Detect memory issues */
  detectMemoryIssues: boolean;
  memoryLimitMb: number;
  /** Custom crash detectors */
  customDetectors?: CrashDetector[];
}

export interface CrashDetector {
  name: string;
  detect: (result: unknown, error?: Error) => boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Fuzzing setup and results
 */
export interface FuzzingSetup {
  config: FuzzConfig;
  status: 'ready' | 'running' | 'completed' | 'failed';
  results: FuzzingResult[];
  coverage: FuzzingCoverage;
  startedAt?: string;
  completedAt?: string;
}

export interface FuzzingResult {
  iteration: number;
  input: unknown;
  output?: unknown;
  error?: string;
  isCrash: boolean;
  crashType?: string;
  executionTimeMs: number;
  coverageDelta: number;
}

export interface FuzzingCoverage {
  linesCovered: number;
  totalLines: number;
  branchesCovered: number;
  totalBranches: number;
  uniqueCrashes: number;
  corpusSize: number;
}

/**
 * Property-based test specification
 * Based on QuickCheck-style testing
 */
export interface PropertyTest<T> {
  /** Name of the property being tested */
  name: string;
  /** Description of the property */
  description: string;
  /** Generator for test inputs */
  generator: Generator<T>;
  /** The property that must hold */
  property: (value: T) => boolean | Promise<boolean>;
  /** Configuration */
  config: PropertyTestConfig;
}

export interface Generator<T> {
  /** Generate a random value */
  generate: (size: number, rng: RandomGenerator) => T;
  /** Shrink a value to find minimal counterexample */
  shrink: (value: T) => Iterable<T>;
  /** Filter generated values */
  filter?: (value: T) => boolean;
  /** Map generated values */
  map?: <U>(fn: (value: T) => U) => Generator<U>;
}

export interface RandomGenerator {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
  nextBoolean(): boolean;
  nextString(length: number): string;
  pick<T>(array: T[]): T;
}

export interface PropertyTestConfig {
  /** Number of test cases to generate */
  numTests: number;
  /** Maximum size parameter for generators */
  maxSize: number;
  /** Maximum shrink iterations */
  maxShrinks: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Timeout per test case in ms */
  timeoutMs: number;
  /** Verbose output */
  verbose: boolean;
}

export interface PropertyTestResult<T> {
  property: string;
  passed: boolean;
  numTests: number;
  numShrinks: number;
  counterexample?: T;
  shrunkCounterexample?: T;
  error?: string;
  seed: number;
  executionTimeMs: number;
}

/**
 * Advanced testing interface
 */
export interface AdvancedTesting {
  /** Create a metamorphic relation */
  metamorphicRelation<T, R>(
    name: string,
    transform: (input: T) => T,
    verify: (r1: R, r2: R) => boolean,
    options?: Partial<Omit<MetamorphicRelation<T, R>, 'name' | 'transformInput' | 'verifyRelation'>>
  ): MetamorphicRelation<T, R>;

  /** Run metamorphic tests */
  runMetamorphicTest<T, R>(test: MetamorphicTest<T, R>): MetamorphicTestResult<T, R>[];

  /** Configure fuzzing for a target */
  fuzzingConfig(target: string, config: Partial<FuzzConfig>): FuzzingSetup;

  /** Run fuzzing session */
  runFuzzing(setup: FuzzingSetup): Promise<FuzzingSetup>;

  /** Create a property-based test */
  propertyBasedTest<T>(
    name: string,
    generator: Generator<T>,
    property: (value: T) => boolean
  ): PropertyTest<T>;

  /** Run property-based tests */
  runPropertyTest<T>(test: PropertyTest<T>): Promise<PropertyTestResult<T>>;
}

// ============================================================================
// AI-ASSISTED DEVELOPMENT
// ============================================================================

/**
 * Context for AI assistance
 */
export interface AIContext {
  /** Project information */
  project: ProjectContext;
  /** Code context */
  code: CodeContext;
  /** Developer preferences */
  preferences: DeveloperPreferences;
  /** Historical patterns */
  history: HistoricalContext;
}

export interface ProjectContext {
  language: string;
  framework?: string;
  dependencies: string[];
  codingStandards?: string[];
  testingFramework?: string;
}

export interface CodeContext {
  currentFile: string;
  currentFunction?: string;
  surroundingCode: string;
  imports: string[];
  exports: string[];
  callers?: string[];
  callees?: string[];
}

export interface DeveloperPreferences {
  codeStyle: 'concise' | 'verbose' | 'balanced';
  commentLevel: 'minimal' | 'moderate' | 'extensive';
  testingStyle: 'unit' | 'integration' | 'both';
  documentationFormat: 'jsdoc' | 'tsdoc' | 'markdown';
}

export interface HistoricalContext {
  recentChanges: CodeChange[];
  commonPatterns: string[];
  knownIssues: string[];
  teamConventions: string[];
}

export interface CodeChange {
  file: string;
  type: 'add' | 'modify' | 'delete';
  timestamp: string;
  author?: string;
  description?: string;
}

/**
 * Refactoring suggestion from AI
 */
export interface RefactoringSuggestion {
  id: string;
  type: RefactoringType;
  description: string;
  rationale: string;
  impact: RefactoringImpact;
  location: CodeLocation;
  beforeCode: string;
  afterCode: string;
  confidence: number;
  references?: string[];
}

export type RefactoringType =
  | 'extract_method'
  | 'extract_variable'
  | 'inline_method'
  | 'inline_variable'
  | 'rename'
  | 'move_method'
  | 'decompose_conditional'
  | 'consolidate_conditional'
  | 'replace_magic_number'
  | 'introduce_parameter_object'
  | 'remove_dead_code'
  | 'simplify_boolean'
  | 'extract_interface'
  | 'pull_up_method'
  | 'push_down_method'
  | 'replace_inheritance_with_delegation'
  | 'custom';

export interface RefactoringImpact {
  complexity: 'decrease' | 'neutral' | 'increase';
  readability: 'improve' | 'neutral' | 'degrade';
  testability: 'improve' | 'neutral' | 'degrade';
  breakingChange: boolean;
  affectedFiles: string[];
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large';
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

/**
 * Guideline for code review
 */
export interface ReviewGuideline {
  id: string;
  name: string;
  description: string;
  category: ReviewCategory;
  severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info';
  patterns: ReviewPattern[];
  autoFixable: boolean;
  references?: string[];
}

export type ReviewCategory =
  | 'correctness'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'reliability'
  | 'style'
  | 'documentation'
  | 'testing';

export interface ReviewPattern {
  type: 'regex' | 'ast' | 'semantic' | 'custom';
  pattern: string | object;
  explanation: string;
}

/**
 * Result of AI code review
 */
export interface CodeReviewResult {
  reviewId: string;
  timestamp: string;
  files: FileReviewResult[];
  summary: ReviewSummary;
  overallScore: number;
  recommendations: ReviewRecommendation[];
}

export interface FileReviewResult {
  file: string;
  issues: ReviewIssue[];
  suggestions: string[];
  score: number;
}

export interface ReviewIssue {
  id: string;
  guideline: string;
  category: ReviewCategory;
  severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info';
  message: string;
  location: CodeLocation;
  suggestion?: string;
  autoFix?: string;
}

export interface ReviewSummary {
  totalIssues: number;
  byCategory: Record<ReviewCategory, number>;
  bySeverity: Record<string, number>;
  coverage: number;
  complexity: number;
}

export interface ReviewRecommendation {
  priority: number;
  title: string;
  description: string;
  category: ReviewCategory;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Coverage target for test generation
 */
export interface CoverageTarget {
  type: 'line' | 'branch' | 'function' | 'statement';
  target: number;
  exclude?: string[];
  focusAreas?: string[];
}

/**
 * Generated test from AI
 */
export interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  code: string;
  targetFunction: string;
  coverage: TestCoverage;
  assertions: GeneratedAssertion[];
  setup?: string;
  teardown?: string;
  mocks?: GeneratedMock[];
  confidence: number;
}

export interface TestCoverage {
  lines: number[];
  branches: number[];
  functions: string[];
  expectedCoverage: number;
}

export interface GeneratedAssertion {
  type: 'equality' | 'truthy' | 'throws' | 'resolves' | 'rejects' | 'matches' | 'custom';
  description: string;
  code: string;
}

export interface GeneratedMock {
  target: string;
  type: 'function' | 'module' | 'class';
  implementation: string;
}

/**
 * Audience for documentation
 */
export type DocumentationAudience =
  | 'developer'
  | 'architect'
  | 'operator'
  | 'end_user'
  | 'stakeholder';

/**
 * Generated documentation from AI
 */
export interface GeneratedDocumentation {
  id: string;
  type: 'api' | 'guide' | 'tutorial' | 'reference' | 'architecture';
  title: string;
  audience: DocumentationAudience;
  content: string;
  sections: DocumentationSection[];
  codeExamples: CodeExample[];
  diagrams?: DocumentationDiagram[];
  metadata: DocumentationMetadata;
}

export interface DocumentationSection {
  title: string;
  content: string;
  level: number;
  subsections?: DocumentationSection[];
}

export interface CodeExample {
  title: string;
  language: string;
  code: string;
  explanation?: string;
}

export interface DocumentationDiagram {
  type: 'sequence' | 'class' | 'flowchart' | 'er' | 'architecture';
  title: string;
  content: string;
  format: 'mermaid' | 'plantuml' | 'ascii';
}

export interface DocumentationMetadata {
  generatedAt: string;
  sourceFiles: string[];
  confidence: number;
  reviewRequired: boolean;
}

/**
 * AI assistance interface
 */
export interface AIAssistance {
  /** Suggest refactorings for code */
  suggestRefactoring(code: string, context: AIContext): Promise<RefactoringSuggestion[]>;

  /** Review code against guidelines */
  reviewCode(diff: string, guidelines: ReviewGuideline[]): Promise<CodeReviewResult>;

  /** Generate tests for code */
  generateTests(code: string, coverage: CoverageTarget): Promise<GeneratedTest[]>;

  /** Synthesize documentation */
  synthesizeDocumentation(code: string, audience: DocumentationAudience): Promise<GeneratedDocumentation>;

  /** Explain code */
  explainCode(code: string, detail: 'brief' | 'detailed' | 'comprehensive'): Promise<string>;

  /** Suggest fixes for issues */
  suggestFixes(issues: ReviewIssue[]): Promise<Map<string, string>>;
}

// ============================================================================
// RELIABILITY PATTERNS
// ============================================================================

/**
 * Circuit breaker configuration
 * Based on Michael Nygard's "Release It!" patterns
 */
export interface CircuitBreakerConfig {
  /** Name for this circuit breaker */
  name: string;
  /** Failure threshold to trip the circuit */
  failureThreshold: number;
  /** Time window for counting failures (ms) */
  failureWindowMs: number;
  /** Time to wait before attempting reset (ms) */
  resetTimeoutMs: number;
  /** Number of successful calls to close the circuit */
  successThreshold: number;
  /** Types of errors that should trip the circuit */
  tripOnErrors: ErrorMatcher[];
  /** Fallback behavior when circuit is open */
  fallback?: CircuitFallback;
  /** Event handlers */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onTrip?: (error: Error) => void;
  onReset?: () => void;
}

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface ErrorMatcher {
  type: 'class' | 'message' | 'code' | 'custom';
  match: string | ((error: Error) => boolean);
}

export interface CircuitFallback {
  type: 'value' | 'function' | 'throw';
  value?: unknown;
  fn?: (error: Error) => unknown;
  error?: Error;
}

/**
 * Circuit breaker instance
 */
export interface CircuitBreaker {
  /** Get current state */
  getState(): CircuitState;

  /** Execute a function with circuit breaker protection */
  execute<T>(fn: () => T | Promise<T>): Promise<T>;

  /** Get circuit breaker metrics */
  getMetrics(): CircuitBreakerMetrics;

  /** Manually trip the circuit */
  trip(): void;

  /** Manually reset the circuit */
  reset(): void;

  /** Check if circuit is available for calls */
  isAvailable(): boolean;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  rejections: number;
  lastFailureTime?: string;
  lastSuccessTime?: string;
  tripCount: number;
}

/**
 * Bulkhead configuration for resource isolation
 */
export interface BulkheadConfig {
  /** Name for this bulkhead */
  name: string;
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Maximum queue size for waiting requests */
  maxQueue: number;
  /** Queue timeout in ms */
  queueTimeoutMs: number;
  /** Priority function for queue ordering */
  priority?: (request: unknown) => number;
  /** Behavior when limits are reached */
  onReject: BulkheadRejection;
}

export type BulkheadRejection =
  | { type: 'throw'; error?: Error }
  | { type: 'fallback'; value: unknown }
  | { type: 'callback'; fn: () => unknown };

/**
 * Bulkhead instance
 */
export interface Bulkhead {
  /** Execute a function with bulkhead protection */
  execute<T>(fn: () => T | Promise<T>, priority?: number): Promise<T>;

  /** Get current metrics */
  getMetrics(): BulkheadMetrics;

  /** Check if execution slot is available */
  isAvailable(): boolean;

  /** Get queue length */
  getQueueLength(): number;
}

export interface BulkheadMetrics {
  maxConcurrent: number;
  currentConcurrent: number;
  queueSize: number;
  maxQueue: number;
  rejections: number;
  completedExecutions: number;
  averageExecutionTimeMs: number;
}

/**
 * Retry policy configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in ms */
  baseDelayMs: number;
  /** Maximum delay between retries in ms */
  maxDelayMs: number;
  /** Backoff strategy */
  backoffStrategy: BackoffStrategy;
  /** Jitter to add randomness to delays */
  jitter: JitterStrategy;
  /** Errors that should trigger a retry */
  retryOn: ErrorMatcher[];
  /** Errors that should not be retried */
  doNotRetryOn?: ErrorMatcher[];
  /** Callback before each retry */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export type BackoffStrategy =
  | { type: 'fixed' }
  | { type: 'linear'; increment: number }
  | { type: 'exponential'; multiplier: number }
  | { type: 'fibonacci' }
  | { type: 'custom'; calculate: (attempt: number, baseDelay: number) => number };

export type JitterStrategy =
  | { type: 'none' }
  | { type: 'full'; factor: number }
  | { type: 'equal'; factor: number }
  | { type: 'decorrelated' };

/**
 * Retry policy instance
 */
export interface RetryPolicy {
  /** Execute a function with retry policy */
  execute<T>(fn: () => T | Promise<T>): Promise<T>;

  /** Get retry metrics */
  getMetrics(): RetryMetrics;
}

export interface RetryMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  retriedExecutions: number;
  averageAttemptsPerExecution: number;
}

/**
 * Chaos engineering experiment configuration
 */
export interface ChaosConfig {
  /** Experiment name */
  name: string;
  /** Description of what the experiment tests */
  description: string;
  /** Hypothesis about system behavior */
  hypothesis: string;
  /** Faults to inject */
  faults: ChaosFault[];
  /** Steady state metrics to monitor */
  steadyStateMetrics: SteadyStateMetric[];
  /** Duration of the experiment in seconds */
  durationSeconds: number;
  /** Percentage of traffic to affect */
  blastRadius: number;
  /** Safety controls */
  safetyControls: SafetyControl[];
  /** Schedule for the experiment */
  schedule?: ExperimentSchedule;
}

export interface ChaosFault {
  type: FaultType;
  target: FaultTarget;
  parameters: Record<string, unknown>;
  probability: number;
}

export type FaultType =
  | 'latency'
  | 'error'
  | 'timeout'
  | 'memory_pressure'
  | 'cpu_pressure'
  | 'network_partition'
  | 'disk_full'
  | 'process_kill'
  | 'dns_failure'
  | 'custom';

export interface FaultTarget {
  type: 'service' | 'endpoint' | 'host' | 'container' | 'pod' | 'region';
  selector: string;
  percentage?: number;
}

export interface SteadyStateMetric {
  name: string;
  query: string;
  comparison: 'equals' | 'greater_than' | 'less_than' | 'within_range';
  threshold: number | [number, number];
  tolerance: number;
}

export interface SafetyControl {
  type: 'abort_threshold' | 'duration_limit' | 'manual_kill' | 'circuit_breaker';
  parameters: Record<string, unknown>;
}

export interface ExperimentSchedule {
  type: 'once' | 'recurring';
  startTime?: string;
  recurrence?: string;
  maintenanceWindow?: [string, string];
}

/**
 * Chaos experiment instance
 */
export interface ChaosExperiment {
  /** Get experiment configuration */
  getConfig(): ChaosConfig;

  /** Start the experiment */
  start(): Promise<void>;

  /** Stop the experiment */
  stop(): Promise<void>;

  /** Get current status */
  getStatus(): ExperimentStatus;

  /** Get experiment results */
  getResults(): ExperimentResults;

  /** Check if hypothesis held */
  evaluateHypothesis(): HypothesisEvaluation;
}

export interface ExperimentStatus {
  state: 'pending' | 'running' | 'completed' | 'aborted' | 'failed';
  startedAt?: string;
  completedAt?: string;
  currentFaults: string[];
  metricsSnapshot: Record<string, number>;
}

export interface ExperimentResults {
  experimentId: string;
  config: ChaosConfig;
  status: ExperimentStatus;
  metricTimeSeries: Record<string, Array<{ timestamp: string; value: number }>>;
  faultEvents: FaultEvent[];
  hypothesisHeld: boolean;
  findings: string[];
  recommendations: string[];
}

export interface FaultEvent {
  timestamp: string;
  faultType: FaultType;
  target: string;
  action: 'injected' | 'removed';
  impact?: string;
}

export interface HypothesisEvaluation {
  hypothesis: string;
  held: boolean;
  confidence: number;
  evidence: string[];
  deviations: MetricDeviation[];
}

export interface MetricDeviation {
  metric: string;
  expected: number;
  actual: number;
  deviation: number;
  withinTolerance: boolean;
}

/**
 * Reliability patterns interface
 */
export interface ReliabilityPatterns {
  /** Create a circuit breaker */
  circuitBreaker(config: CircuitBreakerConfig): CircuitBreaker;

  /** Create a bulkhead for resource isolation */
  bulkhead(config: BulkheadConfig): Bulkhead;

  /** Create a retry policy */
  retryPolicy(config: RetryConfig): RetryPolicy;

  /** Create a chaos experiment */
  chaosExperiment(config: ChaosConfig): ChaosExperiment;

  /** Combine multiple reliability patterns */
  compose(name: string, patterns: Array<CircuitBreaker | Bulkhead | RetryPolicy>): ComposedResilience;
}

export interface ComposedResilience {
  /** Execute with all composed patterns */
  execute<T>(fn: () => T | Promise<T>): Promise<T>;

  /** Get combined metrics */
  getMetrics(): Record<string, unknown>;
}

// ============================================================================
// PERFORMANCE ENGINEERING
// ============================================================================

/**
 * Continuous profiling configuration
 */
export interface ProfileConfig {
  /** Target to profile */
  target: string;
  /** Profile types to collect */
  profileTypes: ProfileType[];
  /** Sampling rate (0-1) */
  samplingRate: number;
  /** Duration per profile in seconds */
  profileDurationSeconds: number;
  /** Interval between profiles in seconds */
  intervalSeconds: number;
  /** Storage configuration */
  storage: ProfileStorageConfig;
  /** Labels to attach to profiles */
  labels: Record<string, string>;
  /** Alerting thresholds */
  alertThresholds?: ProfileAlertThreshold[];
}

export type ProfileType =
  | 'cpu'
  | 'heap'
  | 'allocs'
  | 'goroutine'
  | 'block'
  | 'mutex'
  | 'wall';

export interface ProfileStorageConfig {
  type: 'local' | 's3' | 'gcs' | 'remote';
  endpoint?: string;
  retentionDays: number;
  compression: boolean;
}

export interface ProfileAlertThreshold {
  profileType: ProfileType;
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
  severity: 'warning' | 'critical';
}

/**
 * Continuous profile instance
 */
export interface ContinuousProfile {
  /** Get configuration */
  getConfig(): ProfileConfig;

  /** Start profiling */
  start(): void;

  /** Stop profiling */
  stop(): void;

  /** Get current status */
  getStatus(): ProfileStatus;

  /** Get recent profiles */
  getProfiles(filter: ProfileFilter): ProfileData[];

  /** Analyze profiles for issues */
  analyze(): ProfileAnalysis;

  /** Compare two profile periods */
  compare(baseline: ProfileFilter, comparison: ProfileFilter): ProfileComparison;
}

export interface ProfileStatus {
  running: boolean;
  profilesCollected: number;
  lastProfileAt?: string;
  errors: string[];
}

export interface ProfileFilter {
  profileTypes?: ProfileType[];
  startTime?: string;
  endTime?: string;
  labels?: Record<string, string>;
  limit?: number;
}

export interface ProfileData {
  id: string;
  type: ProfileType;
  timestamp: string;
  durationMs: number;
  samples: number;
  labels: Record<string, string>;
  data: string;
}

export interface ProfileAnalysis {
  hotspots: Hotspot[];
  memoryIssues: MemoryIssue[];
  concurrencyIssues: ConcurrencyIssue[];
  recommendations: string[];
}

export interface Hotspot {
  location: string;
  type: ProfileType;
  percentage: number;
  samples: number;
  callStack: string[];
}

export interface MemoryIssue {
  type: 'leak' | 'excessive_allocation' | 'fragmentation';
  location: string;
  impact: string;
  evidence: string;
}

export interface ConcurrencyIssue {
  type: 'contention' | 'deadlock_risk' | 'excessive_goroutines';
  location: string;
  impact: string;
  evidence: string;
}

export interface ProfileComparison {
  baseline: ProfileSummary;
  comparison: ProfileSummary;
  differences: ProfileDifference[];
  regressions: ProfileRegression[];
  improvements: ProfileImprovement[];
}

export interface ProfileSummary {
  period: [string, string];
  profileCount: number;
  averageMetrics: Record<string, number>;
}

export interface ProfileDifference {
  metric: string;
  baselineValue: number;
  comparisonValue: number;
  changePercent: number;
  significance: 'high' | 'medium' | 'low';
}

export interface ProfileRegression {
  metric: string;
  location: string;
  changePercent: number;
  impact: 'critical' | 'major' | 'minor';
  recommendation: string;
}

export interface ProfileImprovement {
  metric: string;
  location: string;
  changePercent: number;
  impact: 'critical' | 'major' | 'minor';
}

/**
 * Performance baseline
 */
export interface PerformanceBaseline {
  id: string;
  name: string;
  createdAt: string;
  metrics: BaselineMetric[];
  environment: string;
  version: string;
  commitHash?: string;
}

export interface BaselineMetric {
  name: string;
  type: 'latency' | 'throughput' | 'resource' | 'custom';
  unit: string;
  percentiles: Record<string, number>;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  sampleCount: number;
}

/**
 * Current performance metrics
 */
export interface PerformanceMetrics {
  timestamp: string;
  metrics: MetricMeasurement[];
  environment: string;
  version: string;
}

export interface MetricMeasurement {
  name: string;
  type: 'latency' | 'throughput' | 'resource' | 'custom';
  unit: string;
  value: number;
  percentile?: number;
  sampleCount: number;
}

/**
 * Regression detection result
 */
export interface RegressionResult {
  hasRegression: boolean;
  regressions: PerformanceRegression[];
  improvements: PerformanceImprovement[];
  unchanged: string[];
  confidence: number;
  methodology: RegressionMethodology;
}

export interface PerformanceRegression {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  significance: number;
  severity: 'critical' | 'major' | 'minor';
  possibleCauses: string[];
}

export interface PerformanceImprovement {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  significance: number;
}

export interface RegressionMethodology {
  algorithm: 'percentage_change' | 'statistical' | 'ml_based';
  threshold: number;
  confidenceLevel: number;
  minimumSamples: number;
}

/**
 * Growth model for capacity planning
 */
export interface GrowthModel {
  type: 'linear' | 'exponential' | 'polynomial' | 'custom';
  parameters: Record<string, number>;
  seasonality?: SeasonalityConfig;
}

export interface SeasonalityConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  amplitude: number;
  phase: number;
}

/**
 * Capacity model result
 */
export interface CapacityModel {
  currentCapacity: ResourceCapacity;
  projectedGrowth: GrowthProjection[];
  bottlenecks: CapacityBottleneck[];
  recommendations: CapacityRecommendation[];
  scalingPlan: ScalingPlan;
}

export interface ResourceCapacity {
  resource: string;
  currentUsage: number;
  maxCapacity: number;
  utilizationPercent: number;
  headroom: number;
}

export interface GrowthProjection {
  timestamp: string;
  projectedUsage: number;
  confidenceInterval: [number, number];
  capacityExhausted: boolean;
}

export interface CapacityBottleneck {
  resource: string;
  currentUtilization: number;
  projectedExhaustion: string;
  impact: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface CapacityRecommendation {
  action: string;
  resource: string;
  timing: string;
  estimatedCost?: number;
  impact: string;
  priority: number;
}

export interface ScalingPlan {
  shortTerm: ScalingAction[];
  mediumTerm: ScalingAction[];
  longTerm: ScalingAction[];
}

export interface ScalingAction {
  timestamp: string;
  action: 'scale_up' | 'scale_out' | 'optimize' | 'migrate';
  resource: string;
  from: number;
  to: number;
  estimatedCost?: number;
  rationale: string;
}

/**
 * Performance engineering interface
 */
export interface PerformanceEngineering {
  /** Set up continuous profiling */
  profileContinuously(target: string, config: ProfileConfig): ContinuousProfile;

  /** Detect performance regressions */
  detectRegression(baseline: PerformanceBaseline, current: PerformanceMetrics): RegressionResult;

  /** Model capacity requirements */
  modelCapacity(historical: PerformanceMetrics[], growth: GrowthModel): CapacityModel;

  /** Create a performance baseline */
  createBaseline(name: string, metrics: PerformanceMetrics): PerformanceBaseline;

  /** Analyze performance trends */
  analyzeTrends(metrics: PerformanceMetrics[]): TrendAnalysis;
}

export interface TrendAnalysis {
  trends: MetricTrend[];
  anomalies: MetricAnomaly[];
  seasonalPatterns: SeasonalPattern[];
  predictions: MetricPrediction[];
}

export interface MetricTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  changeRate: number;
  confidence: number;
}

export interface MetricAnomaly {
  metric: string;
  timestamp: string;
  expectedValue: number;
  actualValue: number;
  severity: 'high' | 'medium' | 'low';
}

export interface SeasonalPattern {
  metric: string;
  pattern: 'daily' | 'weekly' | 'monthly';
  peakTime: string;
  troughTime: string;
  amplitude: number;
}

export interface MetricPrediction {
  metric: string;
  timestamp: string;
  predictedValue: number;
  confidenceInterval: [number, number];
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a precondition
 */
export function createPrecondition<T>(
  name: string,
  check: (input: T) => boolean,
  options: Partial<Omit<Precondition<T>, 'name' | 'check'>> = {}
): Precondition<T> {
  return {
    name,
    check,
    description: options.description ?? `Precondition: ${name}`,
    errorMessage: options.errorMessage ?? `Precondition '${name}' violated`,
    severity: options.severity ?? 'error',
    mode: options.mode ?? 'strict',
  };
}

/**
 * Creates a postcondition
 */
export function createPostcondition<T, R>(
  name: string,
  check: (input: T, output: R) => boolean,
  options: Partial<Omit<Postcondition<T, R>, 'name' | 'check'>> = {}
): Postcondition<T, R> {
  return {
    name,
    check,
    description: options.description ?? `Postcondition: ${name}`,
    errorMessage: options.errorMessage ?? `Postcondition '${name}' violated`,
    severity: options.severity ?? 'error',
    mode: options.mode ?? 'strict',
  };
}

/**
 * Creates an invariant
 */
export function createInvariant<T>(
  name: string,
  check: (state: T) => boolean,
  options: Partial<Omit<Invariant<T>, 'name' | 'check'>> = {}
): Invariant<T> {
  return {
    name,
    check,
    description: options.description ?? `Invariant: ${name}`,
    errorMessage: options.errorMessage ?? `Invariant '${name}' violated`,
    checkpoints: options.checkpoints ?? ['before_method', 'after_method'],
  };
}

/**
 * Creates a contract
 */
export function createContract<T, R>(
  functionId: string,
  options: Partial<Omit<Contract<T, R>, 'functionId'>> = {}
): Contract<T, R> {
  return {
    functionId,
    description: options.description ?? `Contract for ${functionId}`,
    preconditions: options.preconditions ?? [],
    postconditions: options.postconditions ?? [],
    invariants: options.invariants,
    enabled: options.enabled ?? true,
    onViolation: options.onViolation ?? { type: 'throw' },
  };
}

/**
 * Creates a contract enforcement implementation
 */
export function createContractEnforcement(): ContractEnforcement {
  const violations: ContractViolation[] = [];

  return {
    definePrecondition<T>(
      name: string,
      check: (input: T) => boolean,
      options?: Partial<Omit<Precondition<T>, 'name' | 'check'>>
    ): Precondition<T> {
      return createPrecondition(name, check, options);
    },

    definePostcondition<T, R>(
      name: string,
      check: (input: T, output: R) => boolean,
      options?: Partial<Omit<Postcondition<T, R>, 'name' | 'check'>>
    ): Postcondition<T, R> {
      return createPostcondition(name, check, options);
    },

    defineInvariant<T>(
      name: string,
      check: (state: T) => boolean,
      options?: Partial<Omit<Invariant<T>, 'name' | 'check'>>
    ): Invariant<T> {
      return createInvariant(name, check, options);
    },

    enforceContract<T, R>(
      fn: (input: T) => R,
      contract: Contract<T, R>
    ): (input: T) => R {
      if (!contract.enabled) {
        return fn;
      }

      return (input: T): R => {
        // Check preconditions
        for (const pre of contract.preconditions) {
          if (!pre.check(input)) {
            const violation: ContractViolation = {
              contractId: contract.functionId,
              violationType: 'precondition',
              conditionName: pre.name,
              message: pre.errorMessage,
              severity: pre.severity,
              timestamp: new Date().toISOString(),
              input,
            };
            handleViolation(violation, contract.onViolation, violations);
          }
        }

        // Execute function
        const output = fn(input);

        // Check postconditions
        for (const post of contract.postconditions) {
          if (!post.check(input, output)) {
            const violation: ContractViolation = {
              contractId: contract.functionId,
              violationType: 'postcondition',
              conditionName: post.name,
              message: post.errorMessage,
              severity: post.severity,
              timestamp: new Date().toISOString(),
              input,
              output,
            };
            handleViolation(violation, contract.onViolation, violations);
          }
        }

        return output;
      };
    },

    getViolations(): ContractViolation[] {
      return [...violations];
    },

    clearViolations(): void {
      violations.length = 0;
    },
  };
}

function handleViolation(
  violation: ContractViolation,
  behavior: ContractViolationBehavior,
  violations: ContractViolation[]
): void {
  violations.push(violation);

  switch (behavior.type) {
    case 'throw':
      throw new Error(`Contract violation: ${violation.message}`);
    case 'log':
      console[behavior.level](`Contract violation: ${violation.message}`, violation);
      break;
    case 'callback':
      behavior.handler(violation);
      break;
    case 'aggregate':
      behavior.destination.push(violation);
      break;
  }
}

/**
 * Creates a metamorphic relation
 */
export function createMetamorphicRelation<T, R>(
  name: string,
  transformInput: (input: T) => T,
  verifyRelation: (r1: R, r2: R, i1: T, i2: T) => boolean,
  options: Partial<Omit<MetamorphicRelation<T, R>, 'name' | 'transformInput' | 'verifyRelation'>> = {}
): MetamorphicRelation<T, R> {
  return {
    name,
    transformInput,
    verifyRelation,
    description: options.description ?? `Metamorphic relation: ${name}`,
    categories: options.categories ?? [],
  };
}

/**
 * Creates a circuit breaker configuration with defaults
 */
export function createCircuitBreakerConfig(
  name: string,
  options: Partial<Omit<CircuitBreakerConfig, 'name'>> = {}
): CircuitBreakerConfig {
  return {
    name,
    failureThreshold: options.failureThreshold ?? 5,
    failureWindowMs: options.failureWindowMs ?? 60000,
    resetTimeoutMs: options.resetTimeoutMs ?? 30000,
    successThreshold: options.successThreshold ?? 3,
    tripOnErrors: options.tripOnErrors ?? [{ type: 'class', match: 'Error' }],
    fallback: options.fallback,
    onStateChange: options.onStateChange,
    onTrip: options.onTrip,
    onReset: options.onReset,
  };
}

/**
 * Creates a bulkhead configuration with defaults
 */
export function createBulkheadConfig(
  name: string,
  options: Partial<Omit<BulkheadConfig, 'name'>> = {}
): BulkheadConfig {
  return {
    name,
    maxConcurrent: options.maxConcurrent ?? 10,
    maxQueue: options.maxQueue ?? 100,
    queueTimeoutMs: options.queueTimeoutMs ?? 30000,
    priority: options.priority,
    onReject: options.onReject ?? { type: 'throw' },
  };
}

/**
 * Creates a retry configuration with defaults
 */
export function createRetryConfig(
  options: Partial<RetryConfig> = {}
): RetryConfig {
  return {
    maxAttempts: options.maxAttempts ?? 3,
    baseDelayMs: options.baseDelayMs ?? 1000,
    maxDelayMs: options.maxDelayMs ?? 30000,
    backoffStrategy: options.backoffStrategy ?? { type: 'exponential', multiplier: 2 },
    jitter: options.jitter ?? { type: 'full', factor: 0.5 },
    retryOn: options.retryOn ?? [{ type: 'class', match: 'Error' }],
    doNotRetryOn: options.doNotRetryOn,
    onRetry: options.onRetry,
  };
}

/**
 * Creates a chaos experiment configuration
 */
export function createChaosConfig(
  name: string,
  hypothesis: string,
  options: Partial<Omit<ChaosConfig, 'name' | 'hypothesis'>> = {}
): ChaosConfig {
  return {
    name,
    hypothesis,
    description: options.description ?? `Chaos experiment: ${name}`,
    faults: options.faults ?? [],
    steadyStateMetrics: options.steadyStateMetrics ?? [],
    durationSeconds: options.durationSeconds ?? 300,
    blastRadius: options.blastRadius ?? 0.1,
    safetyControls: options.safetyControls ?? [
      { type: 'abort_threshold', parameters: { threshold: 0.5 } },
      { type: 'duration_limit', parameters: { maxSeconds: 600 } },
      { type: 'manual_kill', parameters: {} },
    ],
    schedule: options.schedule,
  };
}

/**
 * Creates a profile configuration with defaults
 */
export function createProfileConfig(
  target: string,
  options: Partial<Omit<ProfileConfig, 'target'>> = {}
): ProfileConfig {
  return {
    target,
    profileTypes: options.profileTypes ?? ['cpu', 'heap'],
    samplingRate: options.samplingRate ?? 0.1,
    profileDurationSeconds: options.profileDurationSeconds ?? 30,
    intervalSeconds: options.intervalSeconds ?? 60,
    storage: options.storage ?? {
      type: 'local',
      retentionDays: 30,
      compression: true,
    },
    labels: options.labels ?? {},
    alertThresholds: options.alertThresholds,
  };
}

/**
 * Creates a performance baseline
 */
export function createPerformanceBaseline(
  name: string,
  metrics: PerformanceMetrics,
  options: Partial<Omit<PerformanceBaseline, 'name' | 'metrics' | 'id' | 'createdAt'>> = {}
): PerformanceBaseline {
  return {
    id: `baseline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    createdAt: new Date().toISOString(),
    metrics: metrics.metrics.map(m => ({
      name: m.name,
      type: m.type,
      unit: m.unit,
      percentiles: m.percentile ? { [`p${m.percentile}`]: m.value } : { p50: m.value },
      mean: m.value,
      stdDev: 0,
      min: m.value,
      max: m.value,
      sampleCount: m.sampleCount,
    })),
    environment: options.environment ?? metrics.environment,
    version: options.version ?? metrics.version,
    commitHash: options.commitHash,
  };
}

/**
 * Detects performance regression between baseline and current metrics
 */
export function detectPerformanceRegression(
  baseline: PerformanceBaseline,
  current: PerformanceMetrics,
  options: Partial<RegressionMethodology> = {}
): RegressionResult {
  const methodology: RegressionMethodology = {
    algorithm: options.algorithm ?? 'percentage_change',
    threshold: options.threshold ?? 0.1,
    confidenceLevel: options.confidenceLevel ?? 0.95,
    minimumSamples: options.minimumSamples ?? 30,
  };

  const regressions: PerformanceRegression[] = [];
  const improvements: PerformanceImprovement[] = [];
  const unchanged: string[] = [];

  for (const currentMetric of current.metrics) {
    const baselineMetric = baseline.metrics.find(m => m.name === currentMetric.name);
    if (!baselineMetric) continue;

    const baselineValue = baselineMetric.mean;
    const currentValue = currentMetric.value;
    const changePercent = ((currentValue - baselineValue) / baselineValue) * 100;

    // Determine if change is significant
    const isSignificant = Math.abs(changePercent) > methodology.threshold * 100;

    if (!isSignificant) {
      unchanged.push(currentMetric.name);
    } else if (changePercent > 0) {
      // Higher is worse for latency, better for throughput
      const isRegression = currentMetric.type === 'latency' || currentMetric.type === 'resource';
      if (isRegression) {
        regressions.push({
          metric: currentMetric.name,
          baselineValue,
          currentValue,
          changePercent,
          significance: Math.abs(changePercent) / 100,
          severity: changePercent > 50 ? 'critical' : changePercent > 20 ? 'major' : 'minor',
          possibleCauses: generatePossibleCauses(currentMetric.type, changePercent),
        });
      } else {
        improvements.push({
          metric: currentMetric.name,
          baselineValue,
          currentValue,
          changePercent,
          significance: Math.abs(changePercent) / 100,
        });
      }
    } else {
      // Lower is better for latency, worse for throughput
      const isImprovement = currentMetric.type === 'latency' || currentMetric.type === 'resource';
      if (isImprovement) {
        improvements.push({
          metric: currentMetric.name,
          baselineValue,
          currentValue,
          changePercent,
          significance: Math.abs(changePercent) / 100,
        });
      } else {
        regressions.push({
          metric: currentMetric.name,
          baselineValue,
          currentValue,
          changePercent,
          significance: Math.abs(changePercent) / 100,
          severity: Math.abs(changePercent) > 50 ? 'critical' : Math.abs(changePercent) > 20 ? 'major' : 'minor',
          possibleCauses: generatePossibleCauses(currentMetric.type, changePercent),
        });
      }
    }
  }

  return {
    hasRegression: regressions.length > 0,
    regressions,
    improvements,
    unchanged,
    confidence: methodology.confidenceLevel,
    methodology,
  };
}

function generatePossibleCauses(metricType: string, changePercent: number): string[] {
  const causes: string[] = [];

  switch (metricType) {
    case 'latency':
      causes.push('Increased database query complexity');
      causes.push('Network congestion or latency');
      causes.push('Resource contention');
      if (changePercent > 30) {
        causes.push('Potential memory pressure');
        causes.push('Garbage collection overhead');
      }
      break;
    case 'throughput':
      causes.push('Resource bottleneck');
      causes.push('Inefficient algorithm');
      causes.push('Lock contention');
      break;
    case 'resource':
      causes.push('Memory leak');
      causes.push('Inefficient data structures');
      causes.push('Cache miss rate increase');
      break;
    default:
      causes.push('Code change');
      causes.push('Configuration change');
  }

  return causes;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default fuzzing configuration
 */
export const DEFAULT_FUZZ_CONFIG: Omit<FuzzConfig, 'target' | 'inputSchema' | 'seedCorpus'> = {
  mutationStrategies: ['bitflip', 'arithmetic', 'havoc'],
  maxIterations: 10000,
  timeLimitSeconds: 300,
  coverageGuided: true,
  crashDetection: {
    detectExceptions: true,
    detectHangs: true,
    hangTimeoutMs: 5000,
    detectMemoryIssues: true,
    memoryLimitMb: 512,
  },
};

/**
 * Default property test configuration
 */
export const DEFAULT_PROPERTY_TEST_CONFIG: PropertyTestConfig = {
  numTests: 100,
  maxSize: 100,
  maxShrinks: 100,
  timeoutMs: 5000,
  verbose: false,
};

/**
 * Default review guidelines
 */
export const DEFAULT_REVIEW_GUIDELINES: ReviewGuideline[] = [
  {
    id: 'no-console-log',
    name: 'No Console Logs',
    description: 'Console logs should not be committed to production code',
    category: 'maintainability',
    severity: 'minor',
    patterns: [{ type: 'regex', pattern: 'console\\.log', explanation: 'Found console.log statement' }],
    autoFixable: true,
  },
  {
    id: 'no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: 'Secrets should never be hardcoded in source code',
    category: 'security',
    severity: 'critical',
    patterns: [
      { type: 'regex', pattern: 'password\\s*=\\s*["\'][^"\']+["\']', explanation: 'Potential hardcoded password' },
      { type: 'regex', pattern: 'api_?key\\s*=\\s*["\'][^"\']+["\']', explanation: 'Potential hardcoded API key' },
    ],
    autoFixable: false,
  },
  {
    id: 'prefer-const',
    name: 'Prefer Const',
    description: 'Use const for variables that are never reassigned',
    category: 'style',
    severity: 'info',
    patterns: [{ type: 'semantic', pattern: { type: 'variable-never-reassigned' }, explanation: 'Variable could be const' }],
    autoFixable: true,
  },
  {
    id: 'no-any',
    name: 'No Any Type',
    description: 'Avoid using the any type in TypeScript',
    category: 'maintainability',
    severity: 'major',
    patterns: [{ type: 'regex', pattern: ':\\s*any\\b', explanation: 'Found any type annotation' }],
    autoFixable: false,
  },
  {
    id: 'async-await-error-handling',
    name: 'Async/Await Error Handling',
    description: 'Async functions should have proper error handling',
    category: 'reliability',
    severity: 'major',
    patterns: [{ type: 'ast', pattern: { type: 'async-without-try-catch' }, explanation: 'Async function without error handling' }],
    autoFixable: false,
  },
];

/**
 * Standard metamorphic relations for common scenarios
 */
export const STANDARD_METAMORPHIC_RELATIONS = {
  /** For search functions: permuting input should not change results */
  permutationInvariance: <T extends unknown[]>(name: string = 'Permutation Invariance') =>
    createMetamorphicRelation<T, unknown>(
      name,
      (input) => [...input].sort(() => Math.random() - 0.5) as T,
      (r1, r2) => JSON.stringify(r1) === JSON.stringify(r2),
      { description: 'Output should be invariant to input permutation', categories: ['search', 'set'] }
    ),

  /** For sorting functions: sorting twice should give same result */
  idempotence: <T>(name: string = 'Idempotence') =>
    createMetamorphicRelation<T, T>(
      name,
      (input) => input,
      (r1, r2) => JSON.stringify(r1) === JSON.stringify(r2),
      { description: 'Applying function twice should give same result', categories: ['sorting', 'transformation'] }
    ),

  /** For aggregation: adding zero should not change result */
  identityElement: (name: string = 'Identity Element') =>
    createMetamorphicRelation<number[], number>(
      name,
      (input) => [...input, 0],
      (r1, r2) => r1 === r2,
      { description: 'Adding identity element should not change result', categories: ['aggregation', 'math'] }
    ),
};
