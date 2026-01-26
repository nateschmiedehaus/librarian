export type Urgency = 'blocking' | 'background';

export interface ContextBudget {
  maxFiles: number;
  maxTokens: number;
  maxDepth: number;
}

export interface KnowledgeItem {
  id: string;
  packId?: string;
  path?: string;
  summary: string;
  confidence: number;
  relatedFiles: string[];
  kind: 'context_pack' | 'module' | 'function' | 'pattern';
}

export interface BlindSpot {
  area: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface RelevanceRequest {
  intent: string;
  hints?: string[];
  budget: ContextBudget;
  urgency: Urgency;
}

export interface RelevanceResult {
  tiers: {
    essential: KnowledgeItem[];
    contextual: KnowledgeItem[];
    reference: KnowledgeItem[];
  };
  explanations: Map<string, string>;
  blindSpots: BlindSpot[];
  confidence: number;
}

export interface PatternMatch {
  id: string;
  summary: string;
  file: string;
  occurrences: number;
}

export interface ExampleMatch {
  id: string;
  file: string;
  snippet: string;
  confidence: number;
}

export interface BlastRadius {
  directDependents: number;
  transitiveDependents: number;
  riskLevel: 'low' | 'medium' | 'high';
  affectedFiles: string[];
}

export interface Outcome {
  success: boolean;
  reason?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Constraint Engine
// ---------------------------------------------------------------------------

export interface ProposedChange {
  file: string;
  before?: string;
  after?: string;
  addImport?: string;
}

export interface FileChange {
  file: string;
  before: string;
  after: string;
}

export interface Constraint {
  id: string;
  type: 'explicit' | 'inferred' | 'historical';
  rule: string;
  severity: 'error' | 'warning' | 'info';
  scope: string[];
  confidence: number;
  source: ConstraintSource;
}

export interface ConstraintSource {
  type: 'adr' | 'eslint' | 'tsconfig' | 'pattern' | 'boundary';
  location?: string;
  evidence?: {
    conforming: number;
    violating: number;
  };
}

export interface Violation {
  constraint: Constraint;
  location: { file: string; line?: number };
  explanation: string;
  confidence: number;
  suggestion?: string;
  autoFixable: boolean;
  autoFix?: () => FileChange;
}

export interface Warning {
  constraint: Constraint;
  location: { file: string; line?: number };
  explanation: string;
  confidence: number;
  suggestion?: string;
}

export interface ValidationResult {
  violations: Violation[];
  warnings: Warning[];
  blocking: boolean;
  proceedReason?: string;
}

export interface BatchValidationResult {
  results: Array<{ file: string; result: ValidationResult }>;
  blocking: boolean;
  summary: string;
}

export interface Explanation {
  constraintId: string;
  reason: string;
  source: ConstraintSource;
}

export interface ExceptionResult {
  granted: boolean;
  reason: string;
  expiresAt?: string;
}

export interface Boundary {
  layer: string;
  directories: string[];
  allowedDependencies: string[];
  violations: string[];
}

export interface InferredConstraint {
  constraint: Constraint;
  examples: string[];
}

export interface DriftReport {
  changed: boolean;
  details: string[];
}

export interface ConstraintSuggestion {
  rule: string;
  evidence: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Meta-Knowledge Engine
// ---------------------------------------------------------------------------

export interface QualifiedKnowledge {
  entityId: string;
  freshness: {
    indexedAt: Date;
    modifiedSince: boolean;
    commitsBehind: number;
    score: number;
  };
  coverage: {
    hasEntities: boolean;
    hasRelationships: boolean;
    hasTestMapping: boolean;
    hasOwnership: boolean;
    score: number;
  };
  reliability: {
    usageCount: number;
    successRate: number;
    lastFailure?: Date;
    trend: 'improving' | 'stable' | 'degrading';
    score: number;
  };
  confidence: number;
}

export interface ProceedDecision {
  proceed: boolean;
  blockers?: Array<{
    reason: string;
    resolution: 'reindex' | 'wait' | 'manual';
    estimatedTime?: number;
  }>;
  warnings?: string[];
  confidence: number;
}

export interface ConfidenceReport {
  overall: number;
  dimensions: {
    freshness: number;
    coverage: number;
    reliability: number;
  };
  breakdown: Array<{
    file: string;
    confidence: number;
    issues: string[];
  }>;
  recommendations: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: string[];
  mitigations: string[];
}

export interface FailureHistory {
  failures: Array<{ intent: string; reason: string; timestamp: string }>;
  summary: string;
}

export interface Expert {
  id: string;
  name: string;
  scope: string[];
  confidence: number;
  reason: string;
}

export interface TaskOutcome {
  intent: string;
  success: boolean;
  reason?: string;
  packsUsed?: string[];
  timestamp: string;
}

export interface TaskFailure {
  packsUsed: string[];
  failureReason?: string;
  failureType?: string;
}

export interface Attribution {
  knowledgeCaused: boolean;
  confidence: number;
  evidence: string;
  suspiciousPacks: Array<{ packId: string; score: number }>;
  recommendation: string;
}

export interface ThresholdAlert {
  kind: 'freshness' | 'coverage' | 'reliability';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------------------
// Unified Agent Interface
// ---------------------------------------------------------------------------

export type AgentQuestion =
  | { type: 'context'; intent: string; scope?: string[] }
  | { type: 'patterns'; for: string }
  | { type: 'examples'; of: string }
  | { type: 'impact'; of: string[] }
  | { type: 'allowed'; action: ProposedChange }
  | { type: 'confidence'; in: string[] }
  | { type: 'risks'; in: string[] }
  | { type: 'experts'; for: string[] }
  | { type: 'history'; similar_to: string }
  | { type: 'tests'; for: string[] }
  | { type: 'explain'; constraint: string }
  // TDD-specific questions
  | { type: 'discover_tests'; scope: string[] }
  | { type: 'analyze_coverage'; files: string[] }
  | { type: 'generate_tests'; target: string; style?: TddTestStyle }
  | { type: 'find_test_patterns'; in: string[] }
  | { type: 'analyze_mocks'; for: string }
  | { type: 'suggest_properties'; for: string }
  | { type: 'check_isolation'; tests: string[] }
  | { type: 'prioritize_tests'; changedFiles: string[]; strategy?: TddPrioritizationStrategy }
  | { type: 'tdd_guidance'; phase: TddPhase }
  | { type: 'analyze_mutations'; file: string }
  | { type: 'suggest_fixtures'; for: string[] };

// TDD-specific types for agent questions
export type TddTestStyle = {
  framework?: 'vitest' | 'jest' | 'mocha';
  pattern?: 'arrange-act-assert' | 'given-when-then';
  asyncStyle?: 'async-await' | 'promises';
};

export type TddPrioritizationStrategy =
  | 'affected-first'
  | 'fast-first'
  | 'flaky-last'
  | 'coverage-based'
  | 'risk-based';

export type TddPhase = 'red' | 'green' | 'refactor' | 'complete';

export type AgentAction =
  | { type: 'reindex'; scope: string[] }
  | { type: 'suggest_constraint'; rule: string; evidence: string[]; confidence: number }
  | { type: 'report_confusion'; area: string; details: string }
  | { type: 'request_exception'; violation: Violation; reason: string }
  // TDD-specific actions
  | { type: 'run_tests'; scope: string[]; options?: TddTestRunOptions }
  | { type: 'record_test_outcome'; test: string; passed: boolean; duration: number }
  | { type: 'update_test_mapping'; source: string; tests: string[] }
  | { type: 'mark_flaky'; test: string; evidence: string[] };

export interface TddTestRunOptions {
  watch?: boolean;
  coverage?: boolean;
  bail?: boolean;
  timeout?: number;
  filter?: string;
}

export interface AgentAnswer {
  answer: unknown;
  confidence: number;
  reasoning: string;
  caveats: string[];
  followUp?: AgentQuestion[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
}
