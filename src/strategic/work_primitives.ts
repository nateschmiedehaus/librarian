/**
 * @fileoverview Work Primitives System
 *
 * Modular, composable building blocks for any agentic task.
 * Designed as "legos" that can represent any work structure
 * from simple tasks to complex multi-phase projects.
 *
 * Key Design Principles:
 * - Atomic: Each primitive has a single, clear purpose
 * - Composable: Primitives combine to form any work structure
 * - Traceable: Full audit trail of changes and decisions
 * - Prioritized: Every item has computed priority
 * - Evidence-based: Progress tracked through verifiable evidence
 */

import type {
  ConfidenceAssessment,
  Provenance,
  KnowledgeSource,
} from './types.js';

// ============================================================================
// WORK PRIMITIVE TYPES
// ============================================================================

/**
 * The fundamental types of work primitives.
 * Each has specific semantics and use cases.
 */
export type WorkPrimitiveType =
  // Hierarchical Work Items
  | 'epic'          // Strategic: Large initiative spanning multiple stories
  | 'story'         // Tactical: User-facing value delivery
  | 'task'          // Operational: Concrete implementation work
  | 'step'          // Atomic: Single, indivisible action
  | 'checkpoint'    // Verification: Quality gate

  // Special Work Items
  | 'research'      // Discovery: Investigation before implementation
  | 'decision'      // Choice: Recorded decision point (lightweight ADR)
  | 'spike'         // Exploration: Time-boxed learning
  | 'debt'          // Technical: Known improvement needed
  | 'incident'      // Reactive: Issue requiring response
  | 'maintenance'   // Routine: Regular upkeep work
  | 'experiment';   // Trial: Hypothesis testing

/**
 * Work status represents the lifecycle state of a work item.
 */
export type WorkStatus =
  | 'draft'         // Being defined, not ready for work
  | 'backlog'       // Ready but not prioritized
  | 'ready'         // Prioritized, dependencies met, ready to start
  | 'in_progress'   // Actively being worked
  | 'blocked'       // Waiting on external dependency
  | 'review'        // Work complete, awaiting verification
  | 'done'          // Completed and verified
  | 'cancelled'     // Intentionally abandoned
  | 'superseded'    // Replaced by another work item
  | 'deferred';     // Postponed to future

// ============================================================================
// CORE WORK PRIMITIVE
// ============================================================================

/**
 * WorkPrimitive is the base type for all work items.
 * Every field is intentional and serves a specific purpose.
 */
export interface WorkPrimitive {
  id: string;
  type: WorkPrimitiveType;
  version: number;              // Incremented on each change

  // === CONTENT ===
  title: string;                // Concise, action-oriented (max 100 chars)
  description: string;          // Full description with context
  acceptanceCriteria: AcceptanceCriterion[];
  notes: Note[];                // Additional context, learnings

  // === HIERARCHY ===
  parentId: string | null;      // Parent work item
  childIds: string[];           // Child work items
  siblingOrder: number;         // Order among siblings

  // === DEPENDENCIES ===
  dependencies: WorkDependency[];

  // === TRACEABILITY ===
  traceability: WorkTraceability;

  // === PRIORITIZATION ===
  priority: ComputedPriority;
  impact: ImpactAssessment;
  effort: EffortEstimate;

  // === STATUS ===
  status: WorkStatus;
  statusHistory: StatusChange[];

  // === ASSIGNMENT ===
  assignee?: string;
  reviewers: string[];
  watchers: string[];

  // === TIMING ===
  timing: WorkTiming;

  // === EVIDENCE ===
  evidence: WorkEvidence[];

  // === TAGS AND METADATA ===
  tags: string[];
  labels: WorkLabel[];
  metadata: Record<string, unknown>;

  // === EXECUTION CONTEXT ===
  executionContext?: WorkExecutionContext;
  estimates?: WorkResourceEstimates;
  dependencySummary?: WorkDependencySummary;

  // === CONFIDENCE ===
  confidence: ConfidenceAssessment;

  // === AUDIT ===
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  changeHistory: WorkChange[];
}

export interface WorkExecutionContext {
  relevantFiles: WorkFileReference[];
  relevantEntities: WorkEntityReference[];
  priorExamples: WorkEpisodeReference[];
  suggestedTools: WorkToolSuggestion[];
}

export interface WorkFileReference {
  path: string;
  source: 'related_files' | 'snippet';
  packId?: string;
}

export interface WorkEntityReference {
  id: string;
  type: 'function' | 'module' | 'pattern' | 'decision' | 'change' | 'similar_task' | 'unknown';
  packId?: string;
}

export interface WorkEpisodeReference {
  id: string;
  summary?: string;
}

export interface WorkToolSuggestion {
  id: string;
  description: string;
  command?: string;
}

export interface WorkResourceEstimates {
  tokenBudget: { min: number; max: number; confidence: number };
  stepCount: { min: number; max: number };
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'unknown';
}

export interface WorkDependencySummary {
  blockedBy: string[];
  enables: string[];
  external: WorkExternalDependency[];
}

export interface WorkExternalDependency {
  type: DependencyType;
  targetId: string;
  description?: string;
}

// ============================================================================
// ACCEPTANCE CRITERIA
// ============================================================================

export interface AcceptanceCriterion {
  id: string;
  description: string;
  type: 'functional' | 'non-functional' | 'documentation' | 'test' | 'custom';
  verification: VerificationMethod;
  status: 'pending' | 'met' | 'not-met' | 'waived';
  evidence?: string;            // How we verified this
  waivedReason?: string;
  waivedBy?: string;
}

export interface VerificationMethod {
  type: 'automated_test' | 'manual_test' | 'code_review' |
        'user_validation' | 'metric' | 'deployment' | 'other';
  description: string;
  automatable: boolean;
  command?: string;             // For automated verification
}

// ============================================================================
// NOTES
// ============================================================================

export interface Note {
  id: string;
  type: 'context' | 'learning' | 'blocker' | 'risk' | 'decision' | 'question' | 'answer';
  content: string;
  author: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  references: NoteReference[];
}

export interface NoteReference {
  type: 'work' | 'file' | 'commit' | 'external' | 'decision';
  id: string;
  title?: string;
}

// ============================================================================
// DEPENDENCIES
// ============================================================================

export interface WorkDependency {
  id: string;
  targetId: string;             // ID of the work item or external resource
  type: DependencyType;
  status: 'pending' | 'met' | 'blocked' | 'waived';
  description?: string;
  addedAt: string;
  addedBy: string;
  metAt?: string;
  waivedReason?: string;
  waivedBy?: string;
}

export type DependencyType =
  // Work dependencies
  | 'blocks'            // This must complete before target can start
  | 'blocked_by'        // Cannot start until target completes
  | 'related_to'        // Informational relationship

  // External dependencies
  | 'requires_decision' // Needs a decision to be made
  | 'requires_research' // Needs research to complete
  | 'requires_approval' // Needs sign-off
  | 'requires_resource' // Needs external resource
  | 'requires_deployment'; // Needs something deployed

// ============================================================================
// TRACEABILITY
// ============================================================================

export interface WorkTraceability {
  // Files
  affectedFiles: AffectedFile[];

  // Bounded Contexts
  affectedContexts: string[];

  // Decisions
  linkedDecisions: string[];    // ADR IDs

  // Requirements
  linkedRequirements: RequirementLink[];

  // Research
  linkedResearch: string[];     // Research result IDs

  // External References
  externalRefs: ExternalRef[];

  // Commits
  linkedCommits: string[];

  // Tests
  linkedTests: TestLink[];
}

export interface AffectedFile {
  path: string;
  changeType: 'create' | 'modify' | 'delete' | 'move' | 'unknown';
  confidence: number;           // How sure we are this file is affected
  reason?: string;
}

export interface RequirementLink {
  id: string;
  type: 'implements' | 'partially_implements' | 'related_to';
  source: string;               // Where the requirement comes from
}

export interface ExternalRef {
  system: string;               // e.g., 'jira', 'github', 'notion'
  id: string;
  url?: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  lastSyncedAt?: string;
}

export interface TestLink {
  testPath: string;
  testName?: string;
  type: 'unit' | 'integration' | 'e2e' | 'manual';
  status: 'pending' | 'passing' | 'failing' | 'skipped';
  lastRunAt?: string;
}

// ============================================================================
// PRIORITY
// ============================================================================

/**
 * ComputedPriority is calculated, not manually assigned.
 * This ensures consistency and prevents arbitrary prioritization.
 */
export interface ComputedPriority {
  level: PriorityLevel;
  score: number;                // 0-100, used for ranking
  factors: PriorityFactor[];
  computedAt: string;
  override?: PriorityOverride;
  explanation: string;          // Human-readable explanation
}

export type PriorityLevel =
  | 'critical'      // Must do immediately, blocking business
  | 'high'          // Should do soon, significant impact
  | 'medium'        // Normal priority
  | 'low'           // Nice to have
  | 'backlog';      // Future consideration

export interface PriorityFactor {
  name: string;
  weight: number;               // How much this factor matters (0-1)
  rawScore: number;             // Score before weighting (0-100)
  weightedScore: number;        // After weighting
  evidence: string[];           // Why this score
  dataQuality: 'measured' | 'estimated' | 'inferred' | 'default';
}

export interface PriorityOverride {
  level: PriorityLevel;
  reason: string;
  by: string;
  at: string;
  expiresAt?: string;           // Override can be temporary
}

/**
 * Standard priority factors used in computation.
 */
export const STANDARD_PRIORITY_FACTORS = {
  strategicAlignment: {
    name: 'Strategic Alignment',
    weight: 0.20,
    description: 'How well this aligns with strategic pillars',
  },
  userImpact: {
    name: 'User Impact',
    weight: 0.18,
    description: 'Number and severity of users affected',
  },
  riskReduction: {
    name: 'Risk Reduction',
    weight: 0.15,
    description: 'Security, stability, or compliance improvement',
  },
  dependencyUnblock: {
    name: 'Dependency Unblock',
    weight: 0.12,
    description: 'How many other items this unblocks',
  },
  effortValue: {
    name: 'Effort/Value Ratio',
    weight: 0.12,
    description: 'ROI: impact relative to effort',
  },
  timeDecay: {
    name: 'Time Decay',
    weight: 0.08,
    description: 'Age penalty for old items',
  },
  momentum: {
    name: 'Momentum',
    weight: 0.08,
    description: 'Related work recently completed',
  },
  externalPressure: {
    name: 'External Pressure',
    weight: 0.07,
    description: 'Customer requests, compliance deadlines',
  },
} as const;

// ============================================================================
// IMPACT ASSESSMENT
// ============================================================================

export interface ImpactAssessment {
  userImpact: ImpactLevel;
  technicalImpact: ImpactLevel;
  businessImpact: ImpactLevel;
  riskLevel: ImpactLevel;

  // Detailed analysis
  affectedUserCount: number | 'all' | 'subset' | 'none' | 'unknown';
  affectedUserSegments: string[];
  reversibility: 'trivial' | 'easy' | 'moderate' | 'difficult' | 'irreversible';

  // Cascade analysis
  cascadeEffects: CascadeEffect[];

  // Confidence in assessment
  confidence: number;
  assessmentMethod: 'automated' | 'manual' | 'hybrid';
  assessedAt: string;
  assessedBy: string;
}

export type ImpactLevel = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'critical';

export interface CascadeEffect {
  targetId: string;
  targetType: 'file' | 'module' | 'context' | 'service' | 'api' | 'data';
  targetName: string;
  effectType: 'breaking' | 'behavioral' | 'performance' | 'visual' | 'data';
  probability: number;          // 0-1
  severity: number;             // 0-1
  description: string;
  mitigation?: string;
}

// ============================================================================
// EFFORT ESTIMATION
// ============================================================================

export interface EffortEstimate {
  complexity: EffortComplexity;
  size: EffortSize;

  // Detailed breakdown
  breakdown?: EffortBreakdown;

  // Confidence
  confidenceLevel: number;      // 0-1
  uncertaintyFactors: string[]; // What makes this estimate uncertain

  // Comparison
  similarWorkIds?: string[];    // Similar completed work for reference
  estimatedAt: string;
  estimatedBy: string;
}

export type EffortComplexity =
  | 'trivial'       // Simple, well-understood, no unknowns
  | 'simple'        // Straightforward, few decisions
  | 'moderate'      // Some complexity, requires thought
  | 'complex'       // Multiple interconnected parts
  | 'heroic';       // Significant unknowns, high risk

export type EffortSize =
  | 'xs'            // < 1 hour
  | 's'             // 1-4 hours
  | 'm'             // 4-8 hours (1 day)
  | 'l'             // 2-3 days
  | 'xl';           // > 3 days (should decompose)

export interface EffortBreakdown {
  implementation: number;       // Percentage
  testing: number;
  documentation: number;
  review: number;
  deployment: number;
  other: number;
}

// ============================================================================
// STATUS AND TIMING
// ============================================================================

export interface StatusChange {
  from: WorkStatus;
  to: WorkStatus;
  at: string;
  by: string;
  reason?: string;
  automated: boolean;
}

export interface WorkTiming {
  // Planning
  targetStartDate?: string;
  targetEndDate?: string;
  deadline?: Deadline;

  // Actual
  actualStartedAt?: string;
  actualCompletedAt?: string;

  // Time tracking
  timeSpentMinutes?: number;
  estimatedRemainingMinutes?: number;

  // SLA
  sla?: ServiceLevelAgreement;
}

export interface Deadline {
  date: string;
  type: 'hard' | 'soft' | 'target';
  reason: string;
  consequences?: string;        // What happens if missed
  source?: string;              // Where this deadline comes from
}

export interface ServiceLevelAgreement {
  responseTimeMinutes?: number;
  resolutionTimeMinutes?: number;
  status: 'within' | 'at_risk' | 'breached';
  breachedAt?: string;
}

// ============================================================================
// EVIDENCE
// ============================================================================

/**
 * Evidence provides verifiable proof of work completion.
 */
export interface WorkEvidence {
  id: string;
  type: EvidenceType;
  description: string;
  reference: string;            // Commit SHA, test ID, URL, etc.
  timestamp: string;
  verifiedBy: string;
  automated: boolean;
  strength: 'strong' | 'moderate' | 'weak';
  metadata?: Record<string, unknown>;
}

export type EvidenceType =
  | 'commit'                    // Code committed
  | 'test_pass'                 // Tests passing
  | 'review_approved'           // Code review approved
  | 'deployed'                  // Deployed to environment
  | 'user_validated'            // User confirmed it works
  | 'metric_achieved'           // Target metric reached
  | 'documentation_updated'     // Docs updated
  | 'screenshot'                // Visual evidence
  | 'log_entry'                 // System log showing completion
  | 'manual_verification';      // Human verified

// ============================================================================
// LABELS AND TAGS
// ============================================================================

export interface WorkLabel {
  key: string;
  value: string;
  color?: string;
  description?: string;
}

/**
 * Standard label keys for consistency.
 */
export const STANDARD_LABELS = {
  area: 'The functional area this work belongs to',
  component: 'The technical component affected',
  sprint: 'Sprint or iteration',
  milestone: 'Project milestone',
  source: 'Where this work originated',
  assignmentType: 'How this was assigned (auto, manual, triage)',
} as const;

// ============================================================================
// WORK CHANGES (AUDIT)
// ============================================================================

export interface WorkChange {
  id: string;
  timestamp: string;
  by: string;
  type: WorkChangeType;
  field?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export type WorkChangeType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'unassigned'
  | 'dependency_added'
  | 'dependency_removed'
  | 'evidence_added'
  | 'note_added'
  | 'criterion_met'
  | 'linked'
  | 'unlinked';

// ============================================================================
// WORK TEMPLATES
// ============================================================================

/**
 * Templates provide pre-configured work primitives for common patterns.
 */
export interface WorkTemplate {
  id: string;
  name: string;
  description: string;
  type: WorkPrimitiveType;
  category: string;             // Grouping for templates

  // Template content
  titlePattern: string;         // e.g., "Fix: {issue}"
  descriptionTemplate: string;  // Markdown with placeholders
  defaultAcceptanceCriteria: string[];
  suggestedSteps: SuggestedStep[];

  // Defaults
  defaultTags: string[];
  defaultLabels: WorkLabel[];
  defaultPriority: PriorityLevel;
  defaultEffort: EffortComplexity;

  // Automation
  autoCreateWhen?: TemplateAutoTrigger[];
  autoDecompose?: boolean;      // Automatically create child items

  // Metadata
  createdAt: string;
  createdBy: string;
  usageCount: number;
  lastUsedAt?: string;
}

export interface SuggestedStep {
  title: string;
  type: WorkPrimitiveType;
  description?: string;
  optional: boolean;
  condition?: string;           // When to include this step
}

export interface TemplateAutoTrigger {
  type: 'file_created' | 'test_failed' | 'dependency_outdated' |
        'security_alert' | 'performance_regression' | 'manual';
  condition: string;
  priority: PriorityLevel;
}

// ============================================================================
// WORK HIERARCHY
// ============================================================================

/**
 * WorkHierarchy represents a tree view of work items.
 */
export interface WorkHierarchy {
  root: WorkPrimitive;
  children: WorkHierarchy[];
  depth: number;
  totalDescendants: number;
  completedDescendants: number;
  blockedDescendants: number;
}

/**
 * WorkPath represents the path from root to a specific work item.
 */
export interface WorkPath {
  segments: WorkPathSegment[];
}

export interface WorkPathSegment {
  id: string;
  title: string;
  type: WorkPrimitiveType;
  status: WorkStatus;
}

// ============================================================================
// WORK QUERIES
// ============================================================================

export interface WorkQuery {
  // Filters
  types?: WorkPrimitiveType[];
  statuses?: WorkStatus[];
  priorities?: PriorityLevel[];
  tags?: string[];
  labels?: Partial<WorkLabel>[];
  assignees?: string[];
  contexts?: string[];          // Bounded context IDs
  files?: string[];             // Affected files

  // Hierarchy
  parentId?: string | null;     // null = top-level only
  includeChildren?: boolean;
  maxDepth?: number;

  // Priority
  minPriorityScore?: number;
  maxEffort?: EffortComplexity;

  // Time
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  dueBefore?: string;

  // Search
  searchText?: string;
  searchFields?: ('title' | 'description' | 'notes')[];

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  orderBy?: WorkQueryOrderBy;
  orderDirection?: 'asc' | 'desc';
}

export type WorkQueryOrderBy =
  | 'priority'
  | 'created'
  | 'updated'
  | 'due'
  | 'effort'
  | 'title';

// ============================================================================
// WORK OPERATIONS
// ============================================================================

export interface CreateWorkInput {
  type: WorkPrimitiveType;
  title: string;
  description?: string;
  parentId?: string;
  templateId?: string;
  acceptanceCriteria?: string[];
  tags?: string[];
  labels?: WorkLabel[];
  affectedFiles?: string[];
  affectedContexts?: string[];
  assignee?: string;
  targetStartDate?: string;
  targetEndDate?: string;
}

export interface UpdateWorkInput {
  title?: string;
  description?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  tags?: string[];
  labels?: WorkLabel[];
  assignee?: string | null;
  reviewers?: string[];
  timing?: Partial<WorkTiming>;
}

export interface DecomposeOptions {
  maxDepth?: number;
  targetGranularity?: WorkPrimitiveType;
  includeCheckpoints?: boolean;
  useTemplates?: boolean;
  preserveExisting?: boolean;   // Don't replace existing children
}

export interface TransitionOptions {
  reason?: string;
  evidence?: Omit<WorkEvidence, 'id' | 'timestamp'>;
  skipValidation?: boolean;
  force?: boolean;              // Override blocked transitions
}

// ============================================================================
// WORK REPORTS
// ============================================================================

export interface WorkReport {
  generatedAt: string;
  scope: WorkQuery;

  // Summary
  summary: WorkSummary;

  // Breakdown
  byType: Record<WorkPrimitiveType, number>;
  byStatus: Record<WorkStatus, number>;
  byPriority: Record<PriorityLevel, number>;
  byContext: Record<string, number>;
  byAssignee: Record<string, number>;

  // Metrics
  metrics: WorkMetrics;

  // Issues
  issues: WorkReportIssue[];
}

export interface WorkSummary {
  totalItems: number;
  openItems: number;
  completedItems: number;
  blockedItems: number;
  overdueItems: number;
  unassignedItems: number;
}

export interface WorkMetrics {
  averageCompletionTimeMs: number;
  averageBlockedTimeMs: number;
  completionRate: number;       // Completed / total created
  velocityTrend: 'increasing' | 'stable' | 'decreasing';
  blockageRate: number;         // How often items get blocked
}

export interface WorkReportIssue {
  type: 'stale' | 'blocked_long' | 'no_progress' | 'missing_criteria' |
        'unassigned_high_priority' | 'deadline_risk';
  severity: 'high' | 'medium' | 'low';
  workIds: string[];
  description: string;
  suggestion: string;
}
