/**
 * @fileoverview Conceptual Verification System
 *
 * Beyond code analysis: detecting logical, theoretical, design,
 * and domain errors that static analysis cannot catch.
 *
 * This system operates at the level of IDEAS, not just CODE.
 *
 * Categories of conceptual errors:
 * 1. LOGICAL - Contradictions, circular reasoning, incomplete cases
 * 2. THEORETICAL - Algorithm misuse, distributed systems fallacies
 * 3. DESIGN - Abstraction leaks, responsibility misplacement
 * 4. DOMAIN - Business rule violations, model misalignment
 * 5. ARCHITECTURAL - Layer violations, dependency inversions
 * 6. CONSISTENCY - Documentation vs code drift
 *
 * Key Principle: These errors are often invisible to compilers
 * and linters but can cause serious problems in production.
 */

import type {
  ConfidenceAssessment,
  Provenance,
  BoundedContext,
  Term,
  ProjectVision,
  ArchitectureDecision,
} from './types.js';

// ============================================================================
// ERROR TAXONOMY
// ============================================================================

/**
 * Categories of conceptual errors
 */
export type ConceptualErrorCategory =
  | 'logical'           // Contradictions, circular logic
  | 'theoretical'       // Misapplied CS theory
  | 'design'            // Architectural/design issues
  | 'domain'            // Business logic errors
  | 'consistency'       // Documentation/code drift
  | 'security_model'    // Security assumption violations
  | 'performance_model' // Performance assumption errors
  | 'data_model'        // Data integrity issues
  | 'integration'       // API contract violations
  | 'temporal';         // Race conditions, ordering issues

/**
 * Subcategories for detailed classification
 */
export interface ErrorSubcategory {
  category: ConceptualErrorCategory;
  subcategory: string;
  description: string;
  examples: string[];
  commonCauses: string[];
  detectionDifficulty: 'easy' | 'moderate' | 'hard' | 'very_hard';
}

/**
 * Comprehensive error subcategory definitions
 */
export const ERROR_SUBCATEGORIES: ErrorSubcategory[] = [
  // === LOGICAL ===
  {
    category: 'logical',
    subcategory: 'contradiction',
    description: 'Two statements that cannot both be true',
    examples: [
      'Requirement A says "must support offline" but Requirement B says "real-time sync required"',
      'Function claims to never return null but has a return null path',
    ],
    commonCauses: ['Incomplete requirements gathering', 'Multiple authors without coordination'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'logical',
    subcategory: 'circular_dependency',
    description: 'Conceptual circular reasoning (not just code imports)',
    examples: [
      'Module A needs B to initialize, B needs C, C needs A',
      'Business rule depends on itself for validation',
    ],
    commonCauses: ['Organic growth without architecture review', 'Rushed implementation'],
    detectionDifficulty: 'easy',
  },
  {
    category: 'logical',
    subcategory: 'incomplete_cases',
    description: 'Not all possible cases are handled',
    examples: [
      'Switch statement missing cases',
      'API only handles success path',
      'Edge cases not considered',
    ],
    commonCauses: ['Happy path focus', 'Time pressure', 'Lack of testing'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'logical',
    subcategory: 'invalid_assumption',
    description: 'Code assumes something that is not guaranteed',
    examples: [
      'Assuming array is sorted without verification',
      'Assuming user input is valid',
      'Assuming network calls succeed',
    ],
    commonCauses: ['Implicit contracts', 'Developer optimism', 'Incomplete documentation'],
    detectionDifficulty: 'hard',
  },

  // === THEORETICAL ===
  {
    category: 'theoretical',
    subcategory: 'algorithm_misapplication',
    description: 'Using an algorithm inappropriately for the problem',
    examples: [
      'Using O(n²) algorithm where O(n log n) exists',
      'Using synchronous algorithm for inherently async problem',
      'Using in-memory sort for data exceeding memory',
    ],
    commonCauses: ['Lack of CS knowledge', 'Premature optimization in wrong direction'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'theoretical',
    subcategory: 'distributed_fallacy',
    description: 'Violating distributed systems principles',
    examples: [
      'Assuming network is reliable',
      'Assuming latency is zero',
      'Assuming bandwidth is infinite',
      'Assuming topology is constant',
      'Assuming clocks are synchronized',
    ],
    commonCauses: ['Single-machine mindset', 'Lack of distributed systems experience'],
    detectionDifficulty: 'hard',
  },
  {
    category: 'theoretical',
    subcategory: 'concurrency_error',
    description: 'Incorrect concurrent/parallel programming',
    examples: [
      'Race condition in shared state',
      'Deadlock potential',
      'Missing synchronization',
      'ABA problem',
    ],
    commonCauses: ['Sequential thinking', 'Incomplete understanding of memory model'],
    detectionDifficulty: 'very_hard',
  },
  {
    category: 'theoretical',
    subcategory: 'cap_theorem_violation',
    description: 'Expecting impossible CAP combinations',
    examples: [
      'Claiming system is fully CP and fully AP',
      'Not defining behavior during partition',
    ],
    commonCauses: ['Marketing over engineering', 'Lack of theoretical foundation'],
    detectionDifficulty: 'moderate',
  },

  // === DESIGN ===
  {
    category: 'design',
    subcategory: 'abstraction_leak',
    description: 'Implementation details exposed through abstraction',
    examples: [
      'Database-specific errors propagating to UI',
      'Internal data structures in public API',
      'Platform-specific behavior in cross-platform code',
    ],
    commonCauses: ['Rushed implementation', 'Incomplete abstraction design'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'design',
    subcategory: 'responsibility_misplacement',
    description: 'Code doing work that belongs elsewhere',
    examples: [
      'UI layer doing business validation',
      'Data layer making business decisions',
      'Utility class containing business logic',
    ],
    commonCauses: ['Convenience over correctness', 'Lack of clear boundaries'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'design',
    subcategory: 'interface_violation',
    description: 'Not honoring interface contracts',
    examples: [
      'Throwing exceptions not in contract',
      'Returning null when contract forbids',
      'Side effects in query methods',
    ],
    commonCauses: ['Incomplete interface documentation', 'Lack of contract testing'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'design',
    subcategory: 'temporal_coupling',
    description: 'Hidden order-of-operation dependencies',
    examples: [
      'Must call init() before use()',
      'Setup must complete before operation',
      'Configuration must be loaded first',
    ],
    commonCauses: ['Stateful design', 'Missing initialization guards'],
    detectionDifficulty: 'hard',
  },

  // === DOMAIN ===
  {
    category: 'domain',
    subcategory: 'business_rule_violation',
    description: 'Code violates business requirements',
    examples: [
      'Allowing negative quantities',
      'Processing expired subscriptions',
      'Bypassing required approvals',
    ],
    commonCauses: ['Requirements misunderstanding', 'Incomplete domain knowledge'],
    detectionDifficulty: 'hard',
  },
  {
    category: 'domain',
    subcategory: 'model_misalignment',
    description: 'Code model does not match domain model',
    examples: [
      'Using inheritance where composition is domain-appropriate',
      'Missing domain concepts in code',
      'Over-engineering simple domain concepts',
    ],
    commonCauses: ['Developer-centric thinking', 'Lack of domain expert involvement'],
    detectionDifficulty: 'hard',
  },
  {
    category: 'domain',
    subcategory: 'language_inconsistency',
    description: 'Code uses different terms than ubiquitous language',
    examples: [
      'Code says "user" but domain says "customer"',
      'Code says "delete" but domain says "archive"',
      'Synonyms used inconsistently',
    ],
    commonCauses: ['Multiple developers', 'Evolution without refactoring'],
    detectionDifficulty: 'easy',
  },
  {
    category: 'domain',
    subcategory: 'context_boundary_violation',
    description: 'Crossing bounded context without translation',
    examples: [
      'Directly using another context\'s types',
      'Sharing domain objects across contexts',
      'Implicit coupling between contexts',
    ],
    commonCauses: ['Convenience', 'Lack of DDD understanding'],
    detectionDifficulty: 'moderate',
  },

  // === CONSISTENCY ===
  {
    category: 'consistency',
    subcategory: 'doc_code_drift',
    description: 'Documentation does not match code behavior',
    examples: [
      'API docs describe old behavior',
      'README has outdated setup instructions',
      'Comments describe wrong logic',
    ],
    commonCauses: ['Documentation not updated with code', 'Separate authorship'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'consistency',
    subcategory: 'decision_implementation_drift',
    description: 'Implementation does not match ADR',
    examples: [
      'ADR says use library X, code uses Y',
      'ADR says pattern A, code uses B',
    ],
    commonCauses: ['ADRs not updated', 'Implementation changed after ADR'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'consistency',
    subcategory: 'test_reality_drift',
    description: 'Tests do not reflect actual usage',
    examples: [
      'Tests use mocks that behave differently than real system',
      'Tests pass but production fails',
      'Test data unrealistic',
    ],
    commonCauses: ['Over-mocking', 'Test isolation vs integration balance'],
    detectionDifficulty: 'hard',
  },

  // === SECURITY MODEL ===
  {
    category: 'security_model',
    subcategory: 'trust_boundary_violation',
    description: 'Untrusted input reaches trusted operation',
    examples: [
      'User input in SQL without sanitization',
      'Client-provided data used in security decisions',
      'External data not validated before use',
    ],
    commonCauses: ['Trust confusion', 'Missing input validation'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'security_model',
    subcategory: 'privilege_assumption',
    description: 'Assuming higher privileges than warranted',
    examples: [
      'Assuming admin access in user context',
      'Missing authorization checks',
      'Horizontal privilege escalation possible',
    ],
    commonCauses: ['Happy path development', 'Missing threat modeling'],
    detectionDifficulty: 'hard',
  },
  {
    category: 'security_model',
    subcategory: 'secret_exposure',
    description: 'Sensitive data in insecure location',
    examples: [
      'Secrets in logs',
      'Keys in error messages',
      'PII in URLs',
    ],
    commonCauses: ['Debug code in production', 'Logging without filtering'],
    detectionDifficulty: 'moderate',
  },

  // === DATA MODEL ===
  {
    category: 'data_model',
    subcategory: 'integrity_violation',
    description: 'Data integrity rules not enforced',
    examples: [
      'Foreign key without constraint',
      'Denormalized data without sync',
      'Orphaned records possible',
    ],
    commonCauses: ['Performance optimization trade-offs', 'Incomplete modeling'],
    detectionDifficulty: 'moderate',
  },
  {
    category: 'data_model',
    subcategory: 'schema_mismatch',
    description: 'Code assumes different schema than exists',
    examples: [
      'Nullable field treated as required',
      'Type mismatch (string vs int)',
      'Missing migration',
    ],
    commonCauses: ['Schema evolution', 'Multiple environments'],
    detectionDifficulty: 'moderate',
  },

  // === TEMPORAL ===
  {
    category: 'temporal',
    subcategory: 'race_condition',
    description: 'Behavior depends on timing',
    examples: [
      'Check-then-act without atomicity',
      'Double-checked locking (broken)',
      'File operations without locking',
    ],
    commonCauses: ['Sequential thinking', 'Missing atomicity'],
    detectionDifficulty: 'very_hard',
  },
  {
    category: 'temporal',
    subcategory: 'ordering_assumption',
    description: 'Assuming events arrive in order',
    examples: [
      'Message B processed before message A',
      'Out-of-order network packets',
      'Clock skew issues',
    ],
    commonCauses: ['Synchronous thinking', 'Lack of ordering mechanisms'],
    detectionDifficulty: 'hard',
  },
];

// ============================================================================
// CONCEPTUAL ERROR
// ============================================================================

/**
 * A detected conceptual error
 */
export interface ConceptualError {
  id: string;
  category: ConceptualErrorCategory;
  subcategory: string;
  severity: ErrorSeverity;

  // What's wrong
  title: string;
  description: string;
  explanation: string;          // Detailed explanation of the issue

  // Where (conceptual errors may span multiple locations)
  locations: ErrorLocation[];
  scope: ErrorScope;

  // Evidence
  evidence: ConceptualEvidence[];

  // Analysis
  rootCause?: RootCauseAnalysis;
  implications: Implication[];
  relatedErrors: string[];

  // Resolution
  suggestedFix: SuggestedFix;
  alternativeFixes?: SuggestedFix[];
  preventionGuidance: string;

  // Confidence
  confidence: ConfidenceAssessment;
  detectionMethod: DetectionMethod;

  // Status
  status: ErrorStatus;
  statusHistory: ErrorStatusChange[];

  // Metadata
  detectedAt: string;
  detectedBy: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export type ErrorSeverity =
  | 'critical'      // Will cause failures in production
  | 'major'         // High likelihood of issues
  | 'minor'         // May cause issues under certain conditions
  | 'warning'       // Best practice violation, potential future issue
  | 'info';         // Informational, consider improving

export interface ErrorLocation {
  type: 'file' | 'function' | 'class' | 'module' | 'concept' |
        'decision' | 'requirement' | 'interface' | 'configuration';
  identifier: string;           // File path, function name, etc.
  displayName?: string;
  startLine?: number;
  endLine?: number;
  context?: string;             // Surrounding code/text for context
}

export type ErrorScope =
  | 'local'         // Affects single function/file
  | 'module'        // Affects entire module
  | 'context'       // Affects bounded context
  | 'cross_context' // Spans multiple contexts
  | 'system';       // System-wide impact

// ============================================================================
// EVIDENCE
// ============================================================================

export interface ConceptualEvidence {
  id: string;
  type: EvidenceType;
  content: string;
  source: string;               // Where this evidence comes from
  strength: 'strong' | 'moderate' | 'weak';
  relevance: number;            // 0-1
  extractedAt: string;
  verifiedBy?: string;
}

export type EvidenceType =
  | 'code_snippet'
  | 'documentation_excerpt'
  | 'decision_record'
  | 'requirement_text'
  | 'test_result'
  | 'log_entry'
  | 'external_reference'
  | 'pattern_match'
  | 'inference';

// ============================================================================
// ROOT CAUSE ANALYSIS
// ============================================================================

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: ContributingFactor[];
  timeline?: TimelineEvent[];
  confidence: number;
}

export interface ContributingFactor {
  factor: string;
  influence: 'high' | 'medium' | 'low';
  addressable: boolean;
  suggestedAction?: string;
}

export interface TimelineEvent {
  description: string;
  timestamp?: string;
  reference?: string;
}

// ============================================================================
// IMPLICATIONS
// ============================================================================

export interface Implication {
  type: 'functional' | 'performance' | 'security' | 'maintainability' |
        'reliability' | 'scalability' | 'cost' | 'compliance';
  description: string;
  likelihood: 'certain' | 'likely' | 'possible' | 'unlikely';
  severity: 'critical' | 'high' | 'medium' | 'low';
  conditions?: string[];        // When this implication applies
}

// ============================================================================
// SUGGESTED FIX
// ============================================================================

export interface SuggestedFix {
  id: string;
  title: string;
  description: string;
  approach: 'refactor' | 'rewrite' | 'add' | 'remove' | 'modify' | 'document';

  // Implementation guidance
  steps: FixStep[];
  codeExample?: string;

  // Effort and risk
  effort: 'trivial' | 'small' | 'medium' | 'large' | 'significant';
  risk: 'none' | 'low' | 'medium' | 'high';
  riskMitigation?: string;

  // Dependencies
  prerequisites?: string[];
  blockedBy?: string[];         // Other errors that should be fixed first

  // Validation
  validationCriteria: string[];
  testingGuidance?: string;

  // Confidence
  confidence: number;
  source: 'automated' | 'pattern' | 'expert' | 'research';
}

export interface FixStep {
  order: number;
  description: string;
  file?: string;
  codeChange?: string;
  verification?: string;
}

// ============================================================================
// DETECTION
// ============================================================================

export type DetectionMethod =
  | 'static_analysis'       // Detected by code analysis
  | 'pattern_match'         // Detected by pattern matching
  | 'llm_reasoning'         // Detected by LLM analysis
  | 'constraint_check'      // Detected by constraint verification
  | 'consistency_check'     // Detected by comparing sources
  | 'manual_report'         // Reported by human
  | 'test_failure'          // Detected through test execution
  | 'production_incident';  // Discovered in production

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  category: ConceptualErrorCategory;
  subcategory: string;

  // Detection configuration
  method: DetectionMethod;
  patterns?: DetectionPattern[];
  constraints?: DetectionConstraint[];
  llmPrompt?: string;

  // Output configuration
  defaultSeverity: ErrorSeverity;
  defaultScope: ErrorScope;

  // Control
  enabled: boolean;
  priority: number;             // Order of execution

  // Metadata
  createdAt: string;
  createdBy: string;
  lastUpdated: string;
  falsePositiveRate?: number;   // Tracked over time
  usageCount: number;
}

export interface DetectionPattern {
  type: 'regex' | 'ast' | 'semantic' | 'graph';
  pattern: string;
  target: 'code' | 'comments' | 'docs' | 'config' | 'all';
  extract?: string[];           // What to extract from match
}

export interface DetectionConstraint {
  type: 'must_have' | 'must_not_have' | 'requires' | 'forbids';
  subject: string;
  predicate: string;
  object?: string;
}

// ============================================================================
// STATUS TRACKING
// ============================================================================

export type ErrorStatus =
  | 'detected'          // Just found
  | 'triaged'           // Reviewed and prioritized
  | 'acknowledged'      // Accepted as valid issue
  | 'in_progress'       // Being fixed
  | 'fixed'             // Fix implemented
  | 'verified'          // Fix verified
  | 'wont_fix'          // Intentionally not fixing
  | 'false_positive'    // Not actually an error
  | 'deferred';         // Postponed

export interface ErrorStatusChange {
  from: ErrorStatus;
  to: ErrorStatus;
  at: string;
  by: string;
  reason?: string;
}

// ============================================================================
// VERIFICATION CONTEXT
// ============================================================================

/**
 * Context provided to verification rules
 */
export interface VerificationContext {
  // Project understanding
  projectVision?: ProjectVision;
  boundedContexts: BoundedContext[];
  decisions: ArchitectureDecision[];

  // Code knowledge
  functions: FunctionInfo[];
  modules: ModuleInfo[];
  dependencies: DependencyInfo[];

  // Documentation
  documentation: DocumentationInfo[];

  // Previous errors
  existingErrors: ConceptualError[];

  // Configuration
  config: VerificationConfig;
}

export interface FunctionInfo {
  id: string;
  name: string;
  filePath: string;
  signature: string;
  purpose?: string;
  content: string;
  startLine: number;
  endLine: number;
  calls: string[];
  calledBy: string[];
}

export interface ModuleInfo {
  id: string;
  path: string;
  purpose?: string;
  exports: string[];
  imports: string[];
  context?: string;             // Bounded context
}

export interface DependencyInfo {
  fromId: string;
  toId: string;
  type: 'import' | 'call' | 'extends' | 'implements';
  strength: number;             // 0-1
}

export interface DocumentationInfo {
  path: string;
  type: 'readme' | 'api_doc' | 'comment' | 'adr' | 'design_doc';
  content: string;
  relatedCode: string[];
}

export interface VerificationConfig {
  enabledCategories: ConceptualErrorCategory[];
  severityThreshold: ErrorSeverity;
  maxErrorsPerCategory: number;
  includeInfoLevel: boolean;
  customRules: DetectionRule[];
}

// ============================================================================
// VERIFICATION RESULTS
// ============================================================================

export interface VerificationReport {
  id: string;
  generatedAt: string;
  duration: number;             // Milliseconds

  // Summary
  summary: VerificationSummary;

  // Errors found
  errors: ConceptualError[];

  // Breakdown
  byCategory: Record<ConceptualErrorCategory, CategoryBreakdown>;
  byScope: Record<ErrorScope, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byContext: Record<string, number>;

  // Trends (if historical data available)
  trends?: VerificationTrends;

  // Recommendations
  recommendations: VerificationRecommendation[];

  // Metadata
  rulesExecuted: number;
  rulesSkipped: number;
  confidence: number;
}

export interface VerificationSummary {
  totalErrors: number;
  criticalCount: number;
  majorCount: number;
  newSinceLastRun: number;
  resolvedSinceLastRun: number;
  overallHealth: 'healthy' | 'warning' | 'unhealthy' | 'critical';
  healthScore: number;          // 0-100
}

export interface CategoryBreakdown {
  count: number;
  critical: number;
  major: number;
  minor: number;
  topSubcategories: { subcategory: string; count: number }[];
}

export interface VerificationTrends {
  errorCountHistory: TrendPoint[];
  categoryHistory: Record<string, TrendPoint[]>;
  healthScoreHistory: TrendPoint[];
  velocityTrend: 'improving' | 'stable' | 'degrading';
}

export interface TrendPoint {
  timestamp: string;
  value: number;
}

export interface VerificationRecommendation {
  priority: 'immediate' | 'soon' | 'consider';
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
  relatedErrors: string[];
}

// ============================================================================
// VERIFIER INTERFACE
// ============================================================================

/**
 * Conceptual Verifier interface
 */
export interface ConceptualVerifier {
  /**
   * Run all verification rules
   */
  verifyAll(context: VerificationContext): Promise<VerificationReport>;

  /**
   * Verify specific categories
   */
  verifyCategories(
    categories: ConceptualErrorCategory[],
    context: VerificationContext
  ): Promise<ConceptualError[]>;

  /**
   * Verify a specific bounded context
   */
  verifyContext(
    contextId: string,
    context: VerificationContext
  ): Promise<ConceptualError[]>;

  /**
   * Verify consistency between code and documentation
   */
  verifyConsistency(context: VerificationContext): Promise<ConceptualError[]>;

  /**
   * Verify architecture decision compliance
   */
  verifyDecisions(context: VerificationContext): Promise<ConceptualError[]>;

  /**
   * Verify domain model alignment
   */
  verifyDomainModel(context: VerificationContext): Promise<ConceptualError[]>;

  /**
   * Verify distributed systems patterns
   */
  verifyDistributedPatterns(context: VerificationContext): Promise<ConceptualError[]>;

  /**
   * Verify security model
   */
  verifySecurityModel(context: VerificationContext): Promise<ConceptualError[]>;

  /**
   * Verify logical consistency
   */
  verifyLogicalConsistency(context: VerificationContext): Promise<ConceptualError[]>;

  /**
   * Add a custom detection rule
   */
  addRule(rule: Omit<DetectionRule, 'id' | 'createdAt' | 'usageCount'>): Promise<DetectionRule>;

  /**
   * Get explanation for an error
   */
  explainError(errorId: string): Promise<ErrorExplanation>;

  /**
   * Acknowledge an error (mark as reviewed)
   */
  acknowledgeError(
    errorId: string,
    by: string,
    note?: string
  ): Promise<void>;

  /**
   * Mark error as false positive
   */
  markFalsePositive(
    errorId: string,
    by: string,
    reason: string
  ): Promise<void>;

  /**
   * Mark error as resolved
   */
  resolveError(
    errorId: string,
    by: string,
    resolution: string,
    evidence?: string
  ): Promise<void>;
}

export interface ErrorExplanation {
  error: ConceptualError;
  detailedExplanation: string;
  whyItMatters: string;
  realWorldExamples: string[];
  relatedConcepts: string[];
  furtherReading: string[];
}

// ============================================================================
// BUILT-IN VERIFICATION RULES
// ============================================================================

/**
 * Built-in rules for common conceptual errors
 */
export const BUILT_IN_VERIFICATION_RULES: Partial<DetectionRule>[] = [
  // === DISTRIBUTED SYSTEMS ===
  {
    name: 'Network Reliability Assumption',
    description: 'Detects code that assumes network calls always succeed',
    category: 'theoretical',
    subcategory: 'distributed_fallacy',
    method: 'pattern_match',
    patterns: [
      {
        type: 'semantic',
        pattern: 'fetch|http|axios|request without catch|retry|timeout',
        target: 'code',
        extract: ['function', 'file'],
      },
    ],
    defaultSeverity: 'major',
    defaultScope: 'module',
    enabled: true,
    priority: 1,
  },

  // === SECURITY ===
  {
    name: 'Trust Boundary Violation',
    description: 'Detects user input flowing to sensitive operations without validation',
    category: 'security_model',
    subcategory: 'trust_boundary_violation',
    method: 'static_analysis',
    constraints: [
      {
        type: 'forbids',
        subject: 'user_input',
        predicate: 'flows_to',
        object: 'sql_query',
      },
      {
        type: 'forbids',
        subject: 'user_input',
        predicate: 'flows_to',
        object: 'shell_command',
      },
    ],
    defaultSeverity: 'critical',
    defaultScope: 'module',
    enabled: true,
    priority: 1,
  },

  // === DOMAIN ===
  {
    name: 'Ubiquitous Language Violation',
    description: 'Detects code using terms different from defined domain language',
    category: 'domain',
    subcategory: 'language_inconsistency',
    method: 'consistency_check',
    defaultSeverity: 'minor',
    defaultScope: 'context',
    enabled: true,
    priority: 3,
  },

  // === CONSISTENCY ===
  {
    name: 'Documentation Drift',
    description: 'Detects documentation that contradicts code behavior',
    category: 'consistency',
    subcategory: 'doc_code_drift',
    method: 'llm_reasoning',
    llmPrompt: `Compare the following documentation and code.
Identify any inconsistencies where the documentation describes different behavior
than what the code actually does. Be specific about the discrepancy.`,
    defaultSeverity: 'minor',
    defaultScope: 'module',
    enabled: true,
    priority: 2,
  },

  // === DESIGN ===
  {
    name: 'Temporal Coupling Detection',
    description: 'Detects hidden order-of-operation dependencies',
    category: 'design',
    subcategory: 'temporal_coupling',
    method: 'static_analysis',
    patterns: [
      {
        type: 'semantic',
        pattern: 'init|setup|configure called before other methods',
        target: 'code',
      },
    ],
    defaultSeverity: 'minor',
    defaultScope: 'module',
    enabled: true,
    priority: 2,
  },

  // === LOGICAL ===
  {
    name: 'Incomplete Error Handling',
    description: 'Detects code paths that may throw unhandled exceptions',
    category: 'logical',
    subcategory: 'incomplete_cases',
    method: 'static_analysis',
    defaultSeverity: 'major',
    defaultScope: 'local',
    enabled: true,
    priority: 1,
  },
];
