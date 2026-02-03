/**
 * @fileoverview Project Management Structure Templates
 *
 * Composable templates for different project types. Each template provides:
 * - Phase definitions with clear progression
 * - Quality gates at phase boundaries
 * - Deliverables and acceptance criteria
 * - Risk mitigation and rollback strategies
 *
 * Templates:
 * 1. **FeatureDevelopment** - For new features with full lifecycle
 * 2. **BugInvestigation** - For debugging with evidence tracking
 * 3. **Refactoring** - For safe code changes with regression protection
 * 4. **Research** - For exploration with uncertainty tracking
 *
 * @packageDocumentation
 */

import type {
  WorkPrimitiveType,
  WorkStatus,
  AcceptanceCriterion,
  VerificationMethod,
  EffortComplexity,
  PriorityLevel,
  WorkEvidence,
  EvidenceType,
} from './work_primitives.js';

import type {
  ConfidenceLevel,
  ConfidenceAssessment,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types.js';

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Template types available for project management.
 */
export type ProjectTemplateType =
  | 'feature_development'
  | 'bug_investigation'
  | 'refactoring'
  | 'research';

/**
 * Base interface for all project templates.
 */
export interface ProjectTemplateBase {
  /** Unique template identifier */
  id: string;

  /** Template type */
  type: ProjectTemplateType;

  /** Human-readable name */
  name: string;

  /** Description of when to use this template */
  description: string;

  /** Version of the template */
  version: string;

  /** Tags for categorization */
  tags: string[];

  /** When this template was created */
  createdAt: string;

  /** When this template was last updated */
  updatedAt: string;
}

/**
 * Configuration for acceptance criteria templates.
 */
export interface AcceptanceCriteriaTemplate {
  /** Default criteria that apply to all instances */
  default: string[];

  /** Criteria that can be optionally added */
  optional: string[];

  /** Custom criteria placeholders */
  customPlaceholders: string[];
}

// ============================================================================
// QUALITY GATES
// ============================================================================

/**
 * Severity levels for quality gate violations.
 */
export type GateViolationSeverity = 'blocker' | 'critical' | 'major' | 'minor';

/**
 * A quality gate requirement that must be satisfied.
 */
export interface QualityGateRequirement {
  /** Unique identifier */
  id: string;

  /** Requirement description */
  description: string;

  /** Type of verification */
  verification: 'automated' | 'manual' | 'hybrid';

  /** Command for automated verification */
  command?: string;

  /** Threshold value if applicable */
  threshold?: number;

  /** Severity if this requirement fails */
  severity: GateViolationSeverity;

  /** Is this requirement mandatory? */
  mandatory: boolean;
}

/**
 * A quality gate at a phase boundary.
 */
export interface QualityGate {
  /** Gate identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Which phase this gate guards entry to */
  targetPhase: string;

  /** Requirements that must be met */
  requirements: QualityGateRequirement[];

  /** If true, all mandatory requirements must pass */
  blocking: boolean;

  /** Timeout for gate evaluation in milliseconds */
  timeoutMs?: number;

  /** Actions to take on gate failure */
  onFailure?: GateFailureAction;
}

/**
 * Actions to take when a quality gate fails.
 */
export interface GateFailureAction {
  /** Notify these parties */
  notify?: string[];

  /** Create a blocking task */
  createBlockingTask?: boolean;

  /** Escalate after this many failures */
  escalateAfterFailures?: number;

  /** Custom action description */
  customAction?: string;
}

// ============================================================================
// ROLLBACK AND RISK MANAGEMENT
// ============================================================================

/**
 * Trigger condition for rollback.
 */
export type RollbackTriggerType =
  | 'test_failure'
  | 'performance_regression'
  | 'error_rate_spike'
  | 'user_complaint'
  | 'manual_trigger'
  | 'timeout'
  | 'dependency_failure'
  | 'custom';

/**
 * A trigger that initiates rollback.
 */
export interface RollbackTrigger {
  /** Trigger type */
  type: RollbackTriggerType;

  /** Description of the trigger condition */
  description: string;

  /** Threshold value if applicable */
  threshold?: number;

  /** Time window for threshold evaluation */
  windowMs?: number;

  /** Automatic rollback or require confirmation */
  automatic: boolean;

  /** Custom condition expression */
  customCondition?: string;
}

/**
 * A step in the rollback procedure.
 */
export interface RollbackStep {
  /** Step order */
  order: number;

  /** Step description */
  description: string;

  /** Command to execute */
  command?: string;

  /** Is this step reversible */
  reversible: boolean;

  /** Verification after this step */
  verification?: string;
}

/**
 * Complete rollback procedure.
 */
export interface RollbackProcedure {
  /** Procedure identifier */
  id: string;

  /** Steps to execute */
  steps: RollbackStep[];

  /** Estimated time to complete in minutes */
  estimatedTimeMinutes: number;

  /** Data safety level */
  dataSafety: 'none' | 'partial' | 'full';

  /** Notes about the rollback */
  notes?: string;
}

// ============================================================================
// DELIVERABLES
// ============================================================================

/**
 * Type of deliverable output.
 */
export type DeliverableType =
  | 'code'
  | 'documentation'
  | 'test'
  | 'config'
  | 'report'
  | 'artifact'
  | 'decision';

/**
 * A deliverable output from a phase or template.
 */
export interface Deliverable {
  /** Deliverable identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Type of deliverable */
  type: DeliverableType;

  /** Description of the deliverable */
  description: string;

  /** Which phase produces this deliverable */
  phase: string;

  /** Is this deliverable mandatory */
  mandatory: boolean;

  /** Acceptance criteria for the deliverable */
  acceptanceCriteria: string[];

  /** File patterns for code/config deliverables */
  filePatterns?: string[];

  /** Template for the deliverable content */
  template?: string;
}

// ============================================================================
// FEATURE DEVELOPMENT TEMPLATE
// ============================================================================

/**
 * Phases for feature development.
 */
export type FeatureDevelopmentPhase =
  | 'research'
  | 'design'
  | 'implement'
  | 'test'
  | 'document';

/**
 * Feature development template configuration.
 */
export interface FeatureDevelopmentTemplate extends ProjectTemplateBase {
  type: 'feature_development';

  /** Ordered phases */
  phases: readonly FeatureDevelopmentPhase[];

  /** Quality gates between phases */
  qualityGates: QualityGate[];

  /** Triggers for automatic rollback */
  rollbackTriggers: RollbackTrigger[];

  /** Expected deliverables */
  deliverables: Deliverable[];

  /** Acceptance criteria templates */
  acceptanceCriteria: AcceptanceCriteriaTemplate;

  /** Default effort complexity */
  defaultComplexity: EffortComplexity;

  /** Feature flags configuration */
  featureFlags?: {
    /** Require feature flags for all new features */
    required: boolean;
    /** Default flag lifetime in days */
    defaultLifetimeDays: number;
    /** Naming convention pattern */
    namingPattern: string;
  };
}

// ============================================================================
// BUG INVESTIGATION TEMPLATE
// ============================================================================

/**
 * Phases for bug investigation.
 */
export type BugInvestigationPhase =
  | 'triage'
  | 'reproduce'
  | 'root_cause'
  | 'fix'
  | 'verify';

/**
 * Evidence requirement for bug investigation.
 */
export interface EvidenceRequirement {
  /** Requirement identifier */
  id: string;

  /** Description of required evidence */
  description: string;

  /** Type of evidence needed */
  type: EvidenceType;

  /** Which phase requires this evidence */
  phase: BugInvestigationPhase;

  /** Is this evidence mandatory */
  mandatory: boolean;

  /** Minimum strength required */
  minStrength: 'strong' | 'moderate' | 'weak';
}

/**
 * Rule for escalating based on confidence levels.
 */
export interface ConfidenceRule {
  /** Rule identifier */
  id: string;

  /** Description of the rule */
  description: string;

  /** Minimum confidence level to proceed */
  minConfidence: ConfidenceLevel;

  /** Action if confidence is below threshold */
  belowThresholdAction: 'block' | 'warn' | 'escalate' | 'request_review';

  /** Who to escalate to */
  escalateTo?: string[];
}

/**
 * Timeout procedure when investigation stalls.
 */
export interface TimeoutProcedure {
  /** Procedure identifier */
  id: string;

  /** Which phase this applies to */
  phase: BugInvestigationPhase;

  /** Timeout duration in minutes */
  timeoutMinutes: number;

  /** Action to take on timeout */
  action: 'escalate' | 'pause' | 'close' | 'reassign';

  /** Escalation path */
  escalationPath?: string[];

  /** Message template for timeout notification */
  notificationTemplate?: string;
}

/**
 * Bug investigation template configuration.
 */
export interface BugInvestigationTemplate extends ProjectTemplateBase {
  type: 'bug_investigation';

  /** Ordered phases */
  phases: readonly BugInvestigationPhase[];

  /** Evidence requirements per phase */
  evidenceRequirements: EvidenceRequirement[];

  /** Confidence escalation rules */
  confidenceEscalation: ConfidenceRule[];

  /** Timeout procedures per phase */
  timeoutProcedures: TimeoutProcedure[];

  /** Quality gates between phases */
  qualityGates: QualityGate[];

  /** Acceptance criteria templates */
  acceptanceCriteria: AcceptanceCriteriaTemplate;

  /** Severity-based SLA configuration */
  severitySLA?: {
    critical: { responseMinutes: number; resolutionHours: number };
    high: { responseMinutes: number; resolutionHours: number };
    medium: { responseMinutes: number; resolutionHours: number };
    low: { responseMinutes: number; resolutionHours: number };
  };
}

// ============================================================================
// REFACTORING TEMPLATE
// ============================================================================

/**
 * Phases for refactoring.
 */
export type RefactoringPhase =
  | 'impact_analysis'
  | 'safety_check'
  | 'incremental_change'
  | 'regression_test';

/**
 * Protocol for handling breaking changes.
 */
export interface BreakingChangeProtocol {
  /** Protocol identifier */
  id: string;

  /** Description of the protocol */
  description: string;

  /** Type of breaking change */
  changeType: 'api' | 'data' | 'behavior' | 'dependency';

  /** Required approval level */
  approvalLevel: 'team' | 'lead' | 'architect' | 'stakeholder';

  /** Communication requirements */
  communicationRequired: boolean;

  /** Migration path requirement */
  migrationPathRequired: boolean;

  /** Deprecation period in days */
  deprecationPeriodDays?: number;

  /** Steps to follow */
  steps: string[];
}

/**
 * Rule for safe ordering of changes.
 */
export interface OrderingRule {
  /** Rule identifier */
  id: string;

  /** Description of the rule */
  description: string;

  /** Operations that must come before */
  mustPrecede: string[];

  /** Operations that must come after */
  mustFollow: string[];

  /** Rationale for the ordering */
  rationale: string;

  /** Can this ordering be overridden */
  overridable: boolean;
}

/**
 * Coverage requirement for refactoring.
 */
export interface CoverageRequirement {
  /** Requirement identifier */
  id: string;

  /** Description of the requirement */
  description: string;

  /** Type of coverage */
  coverageType: 'line' | 'branch' | 'function' | 'statement' | 'mutation';

  /** Minimum percentage required */
  minPercentage: number;

  /** Scope of coverage check */
  scope: 'changed_files' | 'affected_modules' | 'entire_codebase';

  /** Is this requirement blocking */
  blocking: boolean;
}

/**
 * Refactoring template configuration.
 */
export interface RefactoringTemplate extends ProjectTemplateBase {
  type: 'refactoring';

  /** Ordered phases */
  phases: readonly RefactoringPhase[];

  /** Breaking change protocols */
  breakingChangeProtocols: BreakingChangeProtocol[];

  /** Rollback-safe ordering rules */
  rollbackSafeOrdering: OrderingRule[];

  /** Test coverage requirements */
  testCoverageRequirements: CoverageRequirement[];

  /** Quality gates between phases */
  qualityGates: QualityGate[];

  /** Rollback procedures */
  rollbackProcedures: RollbackProcedure[];

  /** Acceptance criteria templates */
  acceptanceCriteria: AcceptanceCriteriaTemplate;

  /** Maximum batch size for incremental changes */
  maxBatchSize?: {
    files: number;
    linesChanged: number;
  };
}

// ============================================================================
// RESEARCH/EXPLORATION TEMPLATE
// ============================================================================

/**
 * Phases for research/exploration.
 */
export type ResearchPhase =
  | 'hypothesis'
  | 'investigate'
  | 'synthesize'
  | 'report';

/**
 * Configuration for tracking uncertainty.
 */
export interface UncertaintyConfig {
  /** Initial uncertainty level */
  initialLevel: number;

  /** Threshold for requiring more investigation */
  investigationThreshold: number;

  /** Threshold for accepting conclusions */
  acceptanceThreshold: number;

  /** How uncertainty affects decisions */
  decisionPolicy: 'conservative' | 'balanced' | 'aggressive';

  /** Factors that reduce uncertainty */
  reducingFactors: string[];

  /** Factors that increase uncertainty */
  increasingFactors: string[];
}

/**
 * Configuration for documenting dead ends.
 */
export interface DeadEndConfig {
  /** Require documentation of dead ends */
  required: boolean;

  /** Template for dead end documentation */
  template: {
    approach: string;
    hypothesis: string;
    findings: string;
    whyFailed: string;
    lessonsLearned: string;
  };

  /** Minimum documentation before closing */
  minFields: string[];

  /** Tag for dead end items */
  tag: string;
}

/**
 * Configuration for knowledge capture.
 */
export interface CaptureConfig {
  /** Types of knowledge to capture */
  captureTypes: ('decision' | 'learning' | 'pattern' | 'antipattern' | 'question')[];

  /** Auto-capture threshold (confidence level) */
  autoCapturethreshold: number;

  /** Storage location for captured knowledge */
  storageLocation: string;

  /** Required metadata for captured items */
  requiredMetadata: string[];

  /** Expiration policy for captured knowledge */
  expirationDays?: number;
}

/**
 * A hypothesis to test during research.
 */
export interface HypothesisTemplate {
  /** Hypothesis statement template */
  statement: string;

  /** Variables to test */
  variables: string[];

  /** Success criteria */
  successCriteria: string[];

  /** Failure criteria */
  failureCriteria: string[];

  /** Maximum investigation time */
  timeboxMinutes?: number;
}

/**
 * Research/exploration template configuration.
 */
export interface ResearchTemplate extends ProjectTemplateBase {
  type: 'research';

  /** Ordered phases */
  phases: readonly ResearchPhase[];

  /** Uncertainty tracking configuration */
  uncertaintyTracking: UncertaintyConfig;

  /** Dead end documentation configuration */
  deadEndDocumentation: DeadEndConfig;

  /** Knowledge capture configuration */
  knowledgeCapture: CaptureConfig;

  /** Quality gates between phases */
  qualityGates: QualityGate[];

  /** Expected deliverables */
  deliverables: Deliverable[];

  /** Hypothesis templates */
  hypothesisTemplates: HypothesisTemplate[];

  /** Acceptance criteria templates */
  acceptanceCriteria: AcceptanceCriteriaTemplate;

  /** Time boxing configuration */
  timeBoxing?: {
    maxTotalHours: number;
    checkpointIntervalHours: number;
    extensionPolicy: 'none' | 'justified' | 'automatic';
  };
}

// ============================================================================
// UNION TYPE FOR ALL TEMPLATES
// ============================================================================

/**
 * Union type for all project templates.
 */
export type ProjectTemplate =
  | FeatureDevelopmentTemplate
  | BugInvestigationTemplate
  | RefactoringTemplate
  | ResearchTemplate;

// ============================================================================
// TEMPLATE CONTEXT
// ============================================================================

/**
 * Context for creating a project from a template.
 */
export interface TemplateContext {
  /** Project or work item name */
  name: string;

  /** Description */
  description?: string;

  /** Priority level */
  priority?: PriorityLevel;

  /** Initial assignee */
  assignee?: string;

  /** Tags to apply */
  tags?: string[];

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Override default phases */
  phases?: string[];

  /** Additional acceptance criteria */
  additionalCriteria?: string[];

  /** Context-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Result of creating from a template.
 */
export interface TemplateResult {
  /** Created work item ID */
  id: string;

  /** Template type used */
  templateType: ProjectTemplateType;

  /** Phases created */
  phases: string[];

  /** Quality gates applied */
  qualityGates: string[];

  /** Deliverables expected */
  deliverables: string[];

  /** Acceptance criteria */
  acceptanceCriteria: AcceptanceCriterion[];

  /** Creation timestamp */
  createdAt: string;

  /** Warnings during creation */
  warnings: string[];
}

// ============================================================================
// STANDARD TEMPLATES
// ============================================================================

/**
 * Standard feature development template.
 */
export const FEATURE_DEVELOPMENT_TEMPLATE: FeatureDevelopmentTemplate = {
  id: 'feature-development-standard',
  type: 'feature_development',
  name: 'Feature Development',
  description: 'Standard template for developing new features with full lifecycle management',
  version: '1.0.0',
  tags: ['feature', 'development', 'standard'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  phases: ['research', 'design', 'implement', 'test', 'document'] as const,

  qualityGates: [
    {
      id: 'research-to-design',
      name: 'Research Complete',
      targetPhase: 'design',
      blocking: true,
      requirements: [
        {
          id: 'requirements-documented',
          description: 'Requirements are documented and reviewed',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'feasibility-assessed',
          description: 'Technical feasibility has been assessed',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
    {
      id: 'design-to-implement',
      name: 'Design Approved',
      targetPhase: 'implement',
      blocking: true,
      requirements: [
        {
          id: 'design-reviewed',
          description: 'Design document has been reviewed',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'api-contract-defined',
          description: 'API contracts are defined',
          verification: 'manual',
          severity: 'critical',
          mandatory: false,
        },
      ],
    },
    {
      id: 'implement-to-test',
      name: 'Implementation Complete',
      targetPhase: 'test',
      blocking: true,
      requirements: [
        {
          id: 'code-compiles',
          description: 'Code compiles without errors',
          verification: 'automated',
          command: 'npm run build',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'lint-passes',
          description: 'Linting passes with no errors',
          verification: 'automated',
          command: 'npm run lint',
          severity: 'critical',
          mandatory: true,
        },
        {
          id: 'unit-tests-pass',
          description: 'Unit tests pass',
          verification: 'automated',
          command: 'npm test',
          severity: 'blocker',
          mandatory: true,
        },
      ],
    },
    {
      id: 'test-to-document',
      name: 'Testing Complete',
      targetPhase: 'document',
      blocking: true,
      requirements: [
        {
          id: 'coverage-threshold',
          description: 'Code coverage meets threshold',
          verification: 'automated',
          threshold: 80,
          severity: 'critical',
          mandatory: true,
        },
        {
          id: 'integration-tests-pass',
          description: 'Integration tests pass',
          verification: 'automated',
          severity: 'blocker',
          mandatory: true,
        },
      ],
    },
  ],

  rollbackTriggers: [
    {
      type: 'test_failure',
      description: 'Critical test failures in production',
      automatic: false,
    },
    {
      type: 'error_rate_spike',
      description: 'Error rate exceeds threshold',
      threshold: 5,
      windowMs: 300000,
      automatic: true,
    },
    {
      type: 'performance_regression',
      description: 'Response time exceeds baseline by 50%',
      threshold: 50,
      automatic: false,
    },
  ],

  deliverables: [
    {
      id: 'requirements-doc',
      name: 'Requirements Document',
      type: 'documentation',
      description: 'Documented requirements and user stories',
      phase: 'research',
      mandatory: true,
      acceptanceCriteria: [
        'User stories are complete',
        'Acceptance criteria are defined',
        'Non-functional requirements are listed',
      ],
    },
    {
      id: 'design-doc',
      name: 'Design Document',
      type: 'documentation',
      description: 'Technical design and architecture',
      phase: 'design',
      mandatory: true,
      acceptanceCriteria: [
        'Architecture diagram included',
        'API contracts defined',
        'Data models documented',
      ],
    },
    {
      id: 'feature-code',
      name: 'Feature Code',
      type: 'code',
      description: 'Implementation of the feature',
      phase: 'implement',
      mandatory: true,
      acceptanceCriteria: [
        'Code follows style guidelines',
        'No linting errors',
        'TypeScript strict mode passes',
      ],
      filePatterns: ['src/**/*.ts'],
    },
    {
      id: 'test-suite',
      name: 'Test Suite',
      type: 'test',
      description: 'Unit and integration tests',
      phase: 'test',
      mandatory: true,
      acceptanceCriteria: [
        'Unit tests for all public APIs',
        'Integration tests for main flows',
        'Coverage meets threshold',
      ],
      filePatterns: ['src/**/*.test.ts', 'tests/**/*.ts'],
    },
    {
      id: 'api-docs',
      name: 'API Documentation',
      type: 'documentation',
      description: 'Public API documentation',
      phase: 'document',
      mandatory: true,
      acceptanceCriteria: [
        'All public APIs documented',
        'Examples provided',
        'Changelog updated',
      ],
    },
  ],

  acceptanceCriteria: {
    default: [
      'All quality gates pass',
      'Code review approved',
      'Documentation complete',
      'No critical bugs',
    ],
    optional: [
      'Performance benchmarks met',
      'Accessibility requirements met',
      'Security review passed',
    ],
    customPlaceholders: [
      'Feature-specific criterion: {description}',
    ],
  },

  defaultComplexity: 'moderate',

  featureFlags: {
    required: true,
    defaultLifetimeDays: 30,
    namingPattern: 'ff_{feature_name}_{date}',
  },
};

/**
 * Standard bug investigation template.
 */
export const BUG_INVESTIGATION_TEMPLATE: BugInvestigationTemplate = {
  id: 'bug-investigation-standard',
  type: 'bug_investigation',
  name: 'Bug Investigation',
  description: 'Standard template for investigating and fixing bugs with evidence tracking',
  version: '1.0.0',
  tags: ['bug', 'investigation', 'debugging'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  phases: ['triage', 'reproduce', 'root_cause', 'fix', 'verify'] as const,

  evidenceRequirements: [
    {
      id: 'initial-report',
      description: 'Initial bug report with reproduction steps',
      type: 'log_entry',
      phase: 'triage',
      mandatory: true,
      minStrength: 'moderate',
    },
    {
      id: 'reproduction-evidence',
      description: 'Evidence that bug can be reproduced',
      type: 'screenshot',
      phase: 'reproduce',
      mandatory: true,
      minStrength: 'strong',
    },
    {
      id: 'root-cause-analysis',
      description: 'Documentation of root cause',
      type: 'manual_verification',
      phase: 'root_cause',
      mandatory: true,
      minStrength: 'strong',
    },
    {
      id: 'fix-commit',
      description: 'Commit containing the fix',
      type: 'commit',
      phase: 'fix',
      mandatory: true,
      minStrength: 'strong',
    },
    {
      id: 'verification-test',
      description: 'Test proving the fix works',
      type: 'test_pass',
      phase: 'verify',
      mandatory: true,
      minStrength: 'strong',
    },
  ],

  confidenceEscalation: [
    {
      id: 'low-confidence-triage',
      description: 'Low confidence during triage requires senior review',
      minConfidence: 'probable',
      belowThresholdAction: 'escalate',
      escalateTo: ['senior-engineer', 'tech-lead'],
    },
    {
      id: 'speculative-root-cause',
      description: 'Speculative root cause requires additional investigation',
      minConfidence: 'established',
      belowThresholdAction: 'block',
    },
    {
      id: 'fix-confidence',
      description: 'Fix must have high confidence before verification',
      minConfidence: 'established',
      belowThresholdAction: 'request_review',
    },
  ],

  timeoutProcedures: [
    {
      id: 'triage-timeout',
      phase: 'triage',
      timeoutMinutes: 60,
      action: 'escalate',
      escalationPath: ['team-lead'],
      notificationTemplate: 'Bug triage timeout: {bug_id} - {title}',
    },
    {
      id: 'reproduce-timeout',
      phase: 'reproduce',
      timeoutMinutes: 240,
      action: 'escalate',
      escalationPath: ['senior-engineer'],
      notificationTemplate: 'Unable to reproduce: {bug_id} - {title}',
    },
    {
      id: 'root-cause-timeout',
      phase: 'root_cause',
      timeoutMinutes: 480,
      action: 'pause',
      notificationTemplate: 'Root cause analysis stalled: {bug_id}',
    },
  ],

  qualityGates: [
    {
      id: 'triage-to-reproduce',
      name: 'Triage Complete',
      targetPhase: 'reproduce',
      blocking: true,
      requirements: [
        {
          id: 'severity-assigned',
          description: 'Severity level assigned',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'initial-assessment',
          description: 'Initial assessment documented',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
    {
      id: 'reproduce-to-root-cause',
      name: 'Bug Reproduced',
      targetPhase: 'root_cause',
      blocking: true,
      requirements: [
        {
          id: 'reproduction-steps',
          description: 'Clear reproduction steps documented',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'environment-documented',
          description: 'Environment details captured',
          verification: 'manual',
          severity: 'major',
          mandatory: true,
        },
      ],
    },
    {
      id: 'root-cause-to-fix',
      name: 'Root Cause Identified',
      targetPhase: 'fix',
      blocking: true,
      requirements: [
        {
          id: 'root-cause-documented',
          description: 'Root cause is documented with evidence',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'fix-approach-defined',
          description: 'Fix approach is defined',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
    {
      id: 'fix-to-verify',
      name: 'Fix Complete',
      targetPhase: 'verify',
      blocking: true,
      requirements: [
        {
          id: 'fix-implemented',
          description: 'Fix is implemented',
          verification: 'automated',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'regression-test-added',
          description: 'Regression test added',
          verification: 'automated',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
  ],

  acceptanceCriteria: {
    default: [
      'Bug is no longer reproducible',
      'Regression test added and passing',
      'Root cause documented',
      'No related regressions introduced',
    ],
    optional: [
      'Similar bugs identified and fixed',
      'Prevention measures documented',
    ],
    customPlaceholders: [
      'Bug-specific criterion: {description}',
    ],
  },

  severitySLA: {
    critical: { responseMinutes: 15, resolutionHours: 4 },
    high: { responseMinutes: 60, resolutionHours: 24 },
    medium: { responseMinutes: 240, resolutionHours: 72 },
    low: { responseMinutes: 480, resolutionHours: 168 },
  },
};

/**
 * Standard refactoring template.
 */
export const REFACTORING_TEMPLATE: RefactoringTemplate = {
  id: 'refactoring-standard',
  type: 'refactoring',
  name: 'Refactoring',
  description: 'Standard template for safe code refactoring with regression protection',
  version: '1.0.0',
  tags: ['refactoring', 'code-quality', 'maintenance'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  phases: ['impact_analysis', 'safety_check', 'incremental_change', 'regression_test'] as const,

  breakingChangeProtocols: [
    {
      id: 'api-breaking-change',
      description: 'Protocol for breaking API changes',
      changeType: 'api',
      approvalLevel: 'architect',
      communicationRequired: true,
      migrationPathRequired: true,
      deprecationPeriodDays: 90,
      steps: [
        'Document current API contract',
        'Design new API with migration path',
        'Create deprecation warnings',
        'Notify consumers',
        'Implement behind feature flag',
        'Update documentation',
        'Remove old API after deprecation period',
      ],
    },
    {
      id: 'data-breaking-change',
      description: 'Protocol for data model changes',
      changeType: 'data',
      approvalLevel: 'lead',
      communicationRequired: true,
      migrationPathRequired: true,
      steps: [
        'Analyze data impact',
        'Create migration scripts',
        'Test migration on copy',
        'Plan rollback strategy',
        'Execute migration',
        'Verify data integrity',
      ],
    },
    {
      id: 'behavior-breaking-change',
      description: 'Protocol for behavioral changes',
      changeType: 'behavior',
      approvalLevel: 'team',
      communicationRequired: false,
      migrationPathRequired: false,
      steps: [
        'Document current behavior',
        'Document new behavior',
        'Update tests to reflect new behavior',
        'Implement change',
        'Update documentation',
      ],
    },
  ],

  rollbackSafeOrdering: [
    {
      id: 'test-before-code',
      description: 'Write/update tests before changing code',
      mustPrecede: ['code_change'],
      mustFollow: [],
      rationale: 'Tests serve as safety net for refactoring',
      overridable: false,
    },
    {
      id: 'add-before-remove',
      description: 'Add new functionality before removing old',
      mustPrecede: ['remove_old'],
      mustFollow: ['add_new'],
      rationale: 'Ensures rollback is always possible',
      overridable: true,
    },
    {
      id: 'deprecate-before-remove',
      description: 'Deprecate before removing',
      mustPrecede: ['remove'],
      mustFollow: ['deprecate'],
      rationale: 'Gives consumers time to migrate',
      overridable: true,
    },
  ],

  testCoverageRequirements: [
    {
      id: 'changed-file-coverage',
      description: 'Changed files must have high coverage',
      coverageType: 'line',
      minPercentage: 90,
      scope: 'changed_files',
      blocking: true,
    },
    {
      id: 'affected-module-coverage',
      description: 'Affected modules must maintain coverage',
      coverageType: 'branch',
      minPercentage: 80,
      scope: 'affected_modules',
      blocking: true,
    },
    {
      id: 'mutation-coverage',
      description: 'Mutation testing for critical paths',
      coverageType: 'mutation',
      minPercentage: 70,
      scope: 'changed_files',
      blocking: false,
    },
  ],

  qualityGates: [
    {
      id: 'analysis-to-safety',
      name: 'Impact Analysis Complete',
      targetPhase: 'safety_check',
      blocking: true,
      requirements: [
        {
          id: 'impact-documented',
          description: 'Impact analysis documented',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'affected-areas-identified',
          description: 'All affected areas identified',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
    {
      id: 'safety-to-change',
      name: 'Safety Check Passed',
      targetPhase: 'incremental_change',
      blocking: true,
      requirements: [
        {
          id: 'baseline-tests-pass',
          description: 'All baseline tests pass',
          verification: 'automated',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'rollback-plan-ready',
          description: 'Rollback plan is ready',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
    {
      id: 'change-to-test',
      name: 'Changes Complete',
      targetPhase: 'regression_test',
      blocking: true,
      requirements: [
        {
          id: 'all-changes-committed',
          description: 'All changes committed in small batches',
          verification: 'automated',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'no-new-warnings',
          description: 'No new compiler/linter warnings',
          verification: 'automated',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
  ],

  rollbackProcedures: [
    {
      id: 'immediate-rollback',
      steps: [
        {
          order: 1,
          description: 'Revert to previous commit',
          command: 'git revert HEAD',
          reversible: true,
          verification: 'Confirm build passes',
        },
        {
          order: 2,
          description: 'Deploy previous version',
          reversible: true,
          verification: 'Confirm deployment successful',
        },
        {
          order: 3,
          description: 'Verify system health',
          reversible: false,
          verification: 'Run health checks',
        },
      ],
      estimatedTimeMinutes: 15,
      dataSafety: 'full',
      notes: 'Use for immediate rollback when issues detected',
    },
  ],

  acceptanceCriteria: {
    default: [
      'All tests pass',
      'No regression in functionality',
      'Code coverage maintained or improved',
      'No new technical debt introduced',
    ],
    optional: [
      'Performance maintained or improved',
      'Code complexity reduced',
      'Documentation updated',
    ],
    customPlaceholders: [
      'Refactoring-specific criterion: {description}',
    ],
  },

  maxBatchSize: {
    files: 10,
    linesChanged: 500,
  },
};

/**
 * Standard research template.
 */
export const RESEARCH_TEMPLATE: ResearchTemplate = {
  id: 'research-standard',
  type: 'research',
  name: 'Research/Exploration',
  description: 'Standard template for research and exploration with uncertainty tracking',
  version: '1.0.0',
  tags: ['research', 'exploration', 'spike'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  phases: ['hypothesis', 'investigate', 'synthesize', 'report'] as const,

  uncertaintyTracking: {
    initialLevel: 0.8,
    investigationThreshold: 0.5,
    acceptanceThreshold: 0.3,
    decisionPolicy: 'balanced',
    reducingFactors: [
      'authoritative_source_found',
      'reproducible_results',
      'multiple_sources_agree',
      'expert_validation',
      'practical_verification',
    ],
    increasingFactors: [
      'contradictory_sources',
      'outdated_information',
      'edge_cases_discovered',
      'scope_expansion',
      'assumptions_invalidated',
    ],
  },

  deadEndDocumentation: {
    required: true,
    template: {
      approach: 'What approach was attempted?',
      hypothesis: 'What was the hypothesis?',
      findings: 'What was discovered?',
      whyFailed: 'Why did this not work?',
      lessonsLearned: 'What can we learn from this?',
    },
    minFields: ['approach', 'whyFailed', 'lessonsLearned'],
    tag: 'dead-end',
  },

  knowledgeCapture: {
    captureTypes: ['decision', 'learning', 'pattern', 'antipattern', 'question'],
    autoCapturethreshold: 0.7,
    storageLocation: 'knowledge-base',
    requiredMetadata: ['source', 'confidence', 'date', 'context'],
    expirationDays: 365,
  },

  qualityGates: [
    {
      id: 'hypothesis-to-investigate',
      name: 'Hypothesis Defined',
      targetPhase: 'investigate',
      blocking: true,
      requirements: [
        {
          id: 'hypothesis-stated',
          description: 'Clear hypothesis stated',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'success-criteria-defined',
          description: 'Success criteria defined',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
        {
          id: 'timebox-set',
          description: 'Investigation timebox set',
          verification: 'manual',
          severity: 'major',
          mandatory: true,
        },
      ],
    },
    {
      id: 'investigate-to-synthesize',
      name: 'Investigation Complete',
      targetPhase: 'synthesize',
      blocking: false,
      requirements: [
        {
          id: 'findings-documented',
          description: 'Findings are documented',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
        {
          id: 'sources-cited',
          description: 'Sources are cited',
          verification: 'manual',
          severity: 'major',
          mandatory: true,
        },
      ],
    },
    {
      id: 'synthesize-to-report',
      name: 'Synthesis Complete',
      targetPhase: 'report',
      blocking: true,
      requirements: [
        {
          id: 'conclusions-drawn',
          description: 'Conclusions are drawn',
          verification: 'manual',
          severity: 'blocker',
          mandatory: true,
        },
        {
          id: 'uncertainty-assessed',
          description: 'Uncertainty level assessed',
          verification: 'manual',
          severity: 'critical',
          mandatory: true,
        },
      ],
    },
  ],

  deliverables: [
    {
      id: 'hypothesis-doc',
      name: 'Hypothesis Document',
      type: 'documentation',
      description: 'Documented hypothesis and investigation plan',
      phase: 'hypothesis',
      mandatory: true,
      acceptanceCriteria: [
        'Hypothesis clearly stated',
        'Variables identified',
        'Success/failure criteria defined',
      ],
    },
    {
      id: 'investigation-notes',
      name: 'Investigation Notes',
      type: 'documentation',
      description: 'Notes and findings from investigation',
      phase: 'investigate',
      mandatory: true,
      acceptanceCriteria: [
        'Sources documented',
        'Findings recorded',
        'Dead ends noted',
      ],
    },
    {
      id: 'synthesis-doc',
      name: 'Synthesis Document',
      type: 'documentation',
      description: 'Synthesized conclusions and recommendations',
      phase: 'synthesize',
      mandatory: true,
      acceptanceCriteria: [
        'Key findings summarized',
        'Conclusions drawn',
        'Confidence levels stated',
      ],
    },
    {
      id: 'research-report',
      name: 'Research Report',
      type: 'report',
      description: 'Final research report',
      phase: 'report',
      mandatory: true,
      acceptanceCriteria: [
        'Executive summary included',
        'Methodology documented',
        'Recommendations provided',
        'Next steps identified',
      ],
    },
    {
      id: 'knowledge-artifacts',
      name: 'Knowledge Artifacts',
      type: 'artifact',
      description: 'Captured knowledge items',
      phase: 'report',
      mandatory: false,
      acceptanceCriteria: [
        'Decisions documented',
        'Patterns identified',
        'Lessons learned captured',
      ],
    },
  ],

  hypothesisTemplates: [
    {
      statement: 'If we {action}, then {expected_outcome} because {reasoning}.',
      variables: ['action', 'expected_outcome', 'reasoning'],
      successCriteria: ['Outcome achieved within {threshold}'],
      failureCriteria: ['Outcome not achieved', 'Side effects observed'],
      timeboxMinutes: 240,
    },
    {
      statement: 'We believe {technology/approach} will {benefit} for {use_case}.',
      variables: ['technology/approach', 'benefit', 'use_case'],
      successCriteria: ['Benefit demonstrated', 'Use case supported'],
      failureCriteria: ['Benefit not achieved', 'Use case not supported'],
      timeboxMinutes: 480,
    },
  ],

  acceptanceCriteria: {
    default: [
      'Hypothesis tested',
      'Findings documented',
      'Uncertainty assessed',
      'Knowledge captured',
    ],
    optional: [
      'Prototype created',
      'Recommendations actionable',
      'Follow-up items identified',
    ],
    customPlaceholders: [
      'Research-specific criterion: {description}',
    ],
  },

  timeBoxing: {
    maxTotalHours: 40,
    checkpointIntervalHours: 8,
    extensionPolicy: 'justified',
  },
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * Registry of all available templates.
 */
const TEMPLATE_REGISTRY: Record<ProjectTemplateType, ProjectTemplate> = {
  feature_development: FEATURE_DEVELOPMENT_TEMPLATE,
  bug_investigation: BUG_INVESTIGATION_TEMPLATE,
  refactoring: REFACTORING_TEMPLATE,
  research: RESEARCH_TEMPLATE,
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Get a template by type.
 */
export function getTemplate(type: ProjectTemplateType): ProjectTemplate {
  return TEMPLATE_REGISTRY[type];
}

/**
 * List all available template types.
 */
export function listTemplateTypes(): ProjectTemplateType[] {
  return Object.keys(TEMPLATE_REGISTRY) as ProjectTemplateType[];
}

/**
 * Create a project from a template.
 */
export function createFromTemplate(
  templateType: ProjectTemplateType,
  context: TemplateContext
): TemplateResult {
  const template = getTemplate(templateType);
  const now = new Date().toISOString();
  const warnings: string[] = [];

  // Generate unique ID
  const id = `${templateType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Get phases (use context override or template default)
  const phases = context.phases ?? [...template.phases];

  // Get quality gates
  const qualityGates = template.qualityGates.map(g => g.id);

  // Get deliverables
  const deliverables = 'deliverables' in template
    ? template.deliverables.map(d => d.id)
    : [];

  // Build acceptance criteria
  const acceptanceCriteria: AcceptanceCriterion[] = [];

  // Add default criteria
  template.acceptanceCriteria.default.forEach((criterion, index) => {
    acceptanceCriteria.push({
      id: `default-${index}`,
      description: criterion,
      type: 'functional',
      verification: {
        type: 'manual_test',
        description: 'Manual verification required',
        automatable: false,
      },
      status: 'pending',
    });
  });

  // Add additional criteria from context
  if (context.additionalCriteria) {
    context.additionalCriteria.forEach((criterion, index) => {
      acceptanceCriteria.push({
        id: `custom-${index}`,
        description: criterion,
        type: 'custom',
        verification: {
          type: 'manual_test',
          description: 'Custom verification',
          automatable: false,
        },
        status: 'pending',
      });
    });
  }

  // Add warnings for missing optional items
  if (!context.assignee) {
    warnings.push('No assignee specified');
  }

  if (!context.priority) {
    warnings.push('No priority specified, using default');
  }

  return {
    id,
    templateType,
    phases,
    qualityGates,
    deliverables,
    acceptanceCriteria,
    createdAt: now,
    warnings,
  };
}

/**
 * Create a custom feature development template.
 */
export function createFeatureDevelopmentTemplate(
  overrides: Partial<FeatureDevelopmentTemplate> & { id: string; name: string }
): FeatureDevelopmentTemplate {
  const now = new Date().toISOString();
  return {
    ...FEATURE_DEVELOPMENT_TEMPLATE,
    ...overrides,
    type: 'feature_development',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a custom bug investigation template.
 */
export function createBugInvestigationTemplate(
  overrides: Partial<BugInvestigationTemplate> & { id: string; name: string }
): BugInvestigationTemplate {
  const now = new Date().toISOString();
  return {
    ...BUG_INVESTIGATION_TEMPLATE,
    ...overrides,
    type: 'bug_investigation',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a custom refactoring template.
 */
export function createRefactoringTemplate(
  overrides: Partial<RefactoringTemplate> & { id: string; name: string }
): RefactoringTemplate {
  const now = new Date().toISOString();
  return {
    ...REFACTORING_TEMPLATE,
    ...overrides,
    type: 'refactoring',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a custom research template.
 */
export function createResearchTemplate(
  overrides: Partial<ResearchTemplate> & { id: string; name: string }
): ResearchTemplate {
  const now = new Date().toISOString();
  return {
    ...RESEARCH_TEMPLATE,
    ...overrides,
    type: 'research',
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validate a quality gate.
 */
export function validateQualityGate(gate: QualityGate): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!gate.id || gate.id.trim().length === 0) {
    errors.push({
      path: 'id',
      message: 'Quality gate must have an id',
      code: 'missing_id',
    });
  }

  if (!gate.name || gate.name.trim().length === 0) {
    errors.push({
      path: 'name',
      message: 'Quality gate must have a name',
      code: 'missing_name',
    });
  }

  if (!gate.targetPhase || gate.targetPhase.trim().length === 0) {
    errors.push({
      path: 'targetPhase',
      message: 'Quality gate must have a target phase',
      code: 'missing_target_phase',
    });
  }

  if (!gate.requirements || gate.requirements.length === 0) {
    warnings.push({
      path: 'requirements',
      message: 'Quality gate has no requirements',
      suggestion: 'Add at least one requirement',
    });
  }

  for (let i = 0; i < (gate.requirements ?? []).length; i++) {
    const req = gate.requirements[i];
    if (!req.id) {
      errors.push({
        path: `requirements[${i}].id`,
        message: 'Requirement must have an id',
        code: 'missing_requirement_id',
      });
    }
    if (!req.description) {
      errors.push({
        path: `requirements[${i}].description`,
        message: 'Requirement must have a description',
        code: 'missing_requirement_description',
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a deliverable.
 */
export function validateDeliverable(deliverable: Deliverable): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!deliverable.id || deliverable.id.trim().length === 0) {
    errors.push({
      path: 'id',
      message: 'Deliverable must have an id',
      code: 'missing_id',
    });
  }

  if (!deliverable.name || deliverable.name.trim().length === 0) {
    errors.push({
      path: 'name',
      message: 'Deliverable must have a name',
      code: 'missing_name',
    });
  }

  if (!deliverable.phase || deliverable.phase.trim().length === 0) {
    errors.push({
      path: 'phase',
      message: 'Deliverable must have a phase',
      code: 'missing_phase',
    });
  }

  const validTypes: DeliverableType[] = ['code', 'documentation', 'test', 'config', 'report', 'artifact', 'decision'];
  if (!validTypes.includes(deliverable.type)) {
    errors.push({
      path: 'type',
      message: `Invalid deliverable type: ${deliverable.type}`,
      code: 'invalid_type',
    });
  }

  if (!deliverable.acceptanceCriteria || deliverable.acceptanceCriteria.length === 0) {
    warnings.push({
      path: 'acceptanceCriteria',
      message: 'Deliverable has no acceptance criteria',
      suggestion: 'Add acceptance criteria for clarity',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a project template.
 */
export function validateTemplate(template: ProjectTemplate): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!template.id || template.id.trim().length === 0) {
    errors.push({
      path: 'id',
      message: 'Template must have an id',
      code: 'missing_id',
    });
  }

  if (!template.name || template.name.trim().length === 0) {
    errors.push({
      path: 'name',
      message: 'Template must have a name',
      code: 'missing_name',
    });
  }

  if (!template.phases || template.phases.length === 0) {
    errors.push({
      path: 'phases',
      message: 'Template must have at least one phase',
      code: 'no_phases',
    });
  }

  // Validate quality gates
  for (let i = 0; i < (template.qualityGates ?? []).length; i++) {
    const gateResult = validateQualityGate(template.qualityGates[i]);
    errors.push(...gateResult.errors.map(e => ({
      ...e,
      path: `qualityGates[${i}].${e.path}`,
    })));
    warnings.push(...gateResult.warnings.map(w => ({
      ...w,
      path: `qualityGates[${i}].${w.path}`,
    })));
  }

  // Validate deliverables if present
  if ('deliverables' in template && template.deliverables) {
    for (let i = 0; i < template.deliverables.length; i++) {
      const delResult = validateDeliverable(template.deliverables[i]);
      errors.push(...delResult.errors.map(e => ({
        ...e,
        path: `deliverables[${i}].${e.path}`,
      })));
      warnings.push(...delResult.warnings.map(w => ({
        ...w,
        path: `deliverables[${i}].${w.path}`,
      })));
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the quality gates for a specific phase transition.
 */
export function getGatesForPhase(template: ProjectTemplate, targetPhase: string): QualityGate[] {
  return template.qualityGates.filter(g => g.targetPhase === targetPhase);
}

/**
 * Get deliverables for a specific phase.
 */
export function getDeliverablesForPhase(template: ProjectTemplate, phase: string): Deliverable[] {
  if (!('deliverables' in template)) {
    return [];
  }
  return template.deliverables.filter(d => d.phase === phase);
}

/**
 * Check if a phase has blocking gates.
 */
export function hasBlockingGatesForPhase(template: ProjectTemplate, targetPhase: string): boolean {
  return template.qualityGates.some(g => g.targetPhase === targetPhase && g.blocking);
}

/**
 * Get all mandatory requirements for a template.
 */
export function getMandatoryRequirements(template: ProjectTemplate): QualityGateRequirement[] {
  return template.qualityGates.flatMap(g =>
    g.requirements.filter(r => r.mandatory)
  );
}

/**
 * Calculate the total number of gates and requirements.
 */
export function getTemplateStats(template: ProjectTemplate): {
  phaseCount: number;
  gateCount: number;
  requirementCount: number;
  mandatoryRequirementCount: number;
  deliverableCount: number;
} {
  const requirements = template.qualityGates.flatMap(g => g.requirements);
  return {
    phaseCount: template.phases.length,
    gateCount: template.qualityGates.length,
    requirementCount: requirements.length,
    mandatoryRequirementCount: requirements.filter(r => r.mandatory).length,
    deliverableCount: 'deliverables' in template ? template.deliverables.length : 0,
  };
}

/**
 * Check if a template supports a specific phase.
 */
export function templateHasPhase(template: ProjectTemplate, phase: string): boolean {
  return template.phases.includes(phase as never);
}

/**
 * Get the next phase after a given phase.
 */
export function getNextPhase(template: ProjectTemplate, currentPhase: string): string | null {
  const index = template.phases.indexOf(currentPhase as never);
  if (index === -1 || index === template.phases.length - 1) {
    return null;
  }
  return template.phases[index + 1] as string;
}

/**
 * Get the previous phase before a given phase.
 */
export function getPreviousPhase(template: ProjectTemplate, currentPhase: string): string | null {
  const index = template.phases.indexOf(currentPhase as never);
  if (index <= 0) {
    return null;
  }
  return template.phases[index - 1] as string;
}
