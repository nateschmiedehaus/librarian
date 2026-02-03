/**
 * @fileoverview Orchestration Reliability Framework
 *
 * Provides reliability infrastructure for multi-agent coordination:
 *
 * 1. **Agent Health Monitoring** - Track agent progress and detect stalls
 * 2. **Failure Recovery** - Checkpoints, resume, and graceful degradation
 * 3. **Quality Assurance Hooks** - Pre-commit validation and test gates
 * 4. **Audit Trail** - Complete traceability for all orchestration actions
 *
 * Integration points:
 * - Evidence Ledger for audit trail persistence
 * - CalibrationTracker for outcome tracking
 * - OrchestrationPreset for configuration
 *
 * @packageDocumentation
 */

import type { ValidationResult, ValidationError, ValidationWarning } from './types.js';
import type { OrchestrationPreset, FailurePolicy, RetryConfig } from './work_presets.js';
import type { ConfidenceValue } from '../epistemics/confidence.js';
import type {
  IEvidenceLedger,
  EvidenceEntry,
  EvidenceId,
  SessionId,
  EvidenceProvenance,
} from '../epistemics/evidence_ledger.js';
import type { ConstructionCalibrationTracker } from '../constructions/calibration_tracker.js';

// ============================================================================
// PROGRESS METRICS
// ============================================================================

/**
 * Metrics tracking an agent's progress during execution.
 */
export interface ProgressMetrics {
  /** Total tokens used by the agent */
  tokensUsed: number;
  /** Number of tool calls made */
  toolCalls: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Timestamp of last activity */
  lastActivityAt: Date;
  /** Optional progress percentage (0-100) */
  progressPercentage?: number;
  /** Number of successful operations */
  successfulOperations?: number;
  /** Number of failed operations */
  failedOperations?: number;
}

/**
 * Resource usage statistics for an agent.
 */
export interface ResourceUsage {
  /** Memory usage in bytes */
  memoryBytes: number;
  /** CPU time in milliseconds */
  cpuMs: number;
  /** Network bytes transferred */
  networkBytes: number;
  /** Number of file operations */
  fileOperations: number;
  /** Peak concurrent operations */
  peakConcurrency: number;
}

/**
 * Actions to take when an agent times out.
 */
export type TimeoutAction =
  | 'terminate' // Force stop the agent
  | 'checkpoint' // Create a checkpoint and stop
  | 'extend' // Extend the timeout and continue
  | 'escalate'; // Escalate to human intervention

// ============================================================================
// AGENT STATE
// ============================================================================

/**
 * Possible states an agent can be in.
 */
export type AgentStatus =
  | 'idle'
  | 'running'
  | 'stalled'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'checkpointed';

/**
 * Complete state of an agent for checkpointing.
 */
export interface AgentState {
  /** Agent identifier */
  agentId: string;
  /** Current status */
  status: AgentStatus;
  /** Current task being worked on */
  currentTask: string;
  /** Progress metrics */
  metrics: ProgressMetrics;
  /** Accumulated context/memory */
  context: Record<string, unknown>;
  /** Pending operations */
  pendingOperations: PendingOperation[];
  /** Completed operations */
  completedOperations: CompletedOperation[];
  /** Configuration at time of checkpoint */
  config: Record<string, unknown>;
}

/**
 * A pending operation that hasn't completed yet.
 */
export interface PendingOperation {
  /** Operation ID */
  id: string;
  /** Operation type */
  type: string;
  /** When operation was started */
  startedAt: Date;
  /** Operation parameters */
  params: Record<string, unknown>;
  /** Retry count */
  retryCount: number;
}

/**
 * A completed operation with its result.
 */
export interface CompletedOperation {
  /** Operation ID */
  id: string;
  /** Operation type */
  type: string;
  /** When operation completed */
  completedAt: Date;
  /** Whether operation succeeded */
  success: boolean;
  /** Result or error */
  result: unknown;
  /** Duration in ms */
  durationMs: number;
}

// ============================================================================
// CHECKPOINTS AND RECOVERY
// ============================================================================

/**
 * A checkpoint capturing agent state for recovery.
 */
export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Agent ID this checkpoint is for */
  agentId: string;
  /** When checkpoint was created */
  createdAt: Date;
  /** The captured state */
  state: AgentState;
  /** Reason for checkpoint */
  reason: CheckpointReason;
  /** Hash of state for integrity verification */
  stateHash: string;
  /** Whether this checkpoint can be resumed from */
  resumable: boolean;
  /** Evidence ID if recorded to ledger */
  evidenceId?: EvidenceId;
}

/**
 * Reasons for creating a checkpoint.
 */
export type CheckpointReason =
  | 'scheduled' // Regular interval checkpoint
  | 'timeout' // Timeout triggered
  | 'error' // Error occurred
  | 'manual' // Manual request
  | 'phase_transition' // Moving to next phase
  | 'resource_limit'; // Resource limits approached

/**
 * Result of attempting to resume from a checkpoint.
 */
export interface ResumeResult {
  /** Whether resume was successful */
  success: boolean;
  /** The checkpoint that was resumed */
  checkpoint: Checkpoint;
  /** New agent state after resume */
  newState?: AgentState;
  /** Error if resume failed */
  error?: string;
  /** Operations that were recovered */
  recoveredOperations: string[];
  /** Operations that were lost */
  lostOperations: string[];
}

/**
 * Partial results salvaged from a failed agent.
 */
export interface PartialResult {
  /** Result ID */
  id: string;
  /** Type of result */
  type: string;
  /** The partial data */
  data: unknown;
  /** Completeness percentage (0-100) */
  completeness: number;
  /** Confidence in the result */
  confidence: ConfidenceValue;
  /** What's missing */
  missing: string[];
  /** Whether this is usable as-is */
  usable: boolean;
}

/**
 * Graceful degradation strategies.
 */
export type GracefulDegradation =
  | 'skip' // Skip the failed operation
  | 'fallback' // Use a fallback approach
  | 'retry' // Retry the operation
  | 'escalate'; // Escalate for human intervention

/**
 * Manual intervention request.
 */
export interface ManualInterventionRequest {
  /** Request ID */
  id: string;
  /** Agent that needs help */
  agentId: string;
  /** Reason for intervention */
  reason: string;
  /** Current agent state */
  state: AgentState;
  /** Suggested actions */
  suggestedActions: string[];
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** When request was created */
  createdAt: Date;
  /** Timeout for response */
  timeoutAt: Date;
}

// ============================================================================
// QUALITY ASSURANCE TYPES
// ============================================================================

/**
 * A code change for validation.
 */
export interface Change {
  /** File path */
  filePath: string;
  /** Type of change */
  type: 'add' | 'modify' | 'delete' | 'rename';
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
  /** Content diff if available */
  diff?: string;
  /** Previous content hash */
  previousHash?: string;
  /** New content hash */
  newHash?: string;
}

/**
 * Result of pre-commit validation.
 */
export interface CommitValidationResult {
  /** Whether commit is allowed */
  allowed: boolean;
  /** Validation checks performed */
  checks: ValidationCheck[];
  /** Blocking issues that prevent commit */
  blockingIssues: ValidationIssue[];
  /** Warnings that don't prevent commit */
  warnings: ValidationIssue[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Overall confidence in the changes */
  confidence: ConfidenceValue;
}

/**
 * A single validation check.
 */
export interface ValidationCheck {
  /** Check name */
  name: string;
  /** Check type */
  type: 'lint' | 'type_check' | 'test' | 'security' | 'coverage' | 'format' | 'custom';
  /** Whether check passed */
  passed: boolean;
  /** Duration of check in ms */
  durationMs: number;
  /** Details if failed */
  details?: string;
}

/**
 * A validation issue found during checks.
 */
export interface ValidationIssue {
  /** Issue type */
  type: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue message */
  message: string;
  /** File path if applicable */
  filePath?: string;
  /** Line number if applicable */
  line?: number;
  /** Column if applicable */
  column?: number;
  /** Rule that was violated */
  rule?: string;
  /** Suggested fix */
  fix?: string;
  /** Suggestion for improvement */
  suggestion?: string;
}

/**
 * Test execution result.
 */
export interface TestResult {
  /** Test name */
  name: string;
  /** Test file */
  file: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  /** Duration in ms */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Retry count */
  retries?: number;
}

/**
 * Result of test execution gate.
 */
export interface GateResult {
  /** Whether gate passed */
  passed: boolean;
  /** Gate name */
  gateName: string;
  /** Total tests */
  totalTests: number;
  /** Passed tests */
  passedTests: number;
  /** Failed tests */
  failedTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Coverage percentage if available */
  coveragePercentage?: number;
  /** Required coverage threshold */
  requiredCoverage?: number;
  /** Failure details */
  failures: TestResult[];
}

/**
 * An output to verify confidence for.
 */
export interface Output {
  /** Output ID */
  id: string;
  /** Output type */
  type: string;
  /** The output content */
  content: unknown;
  /** Stated confidence */
  statedConfidence: ConfidenceValue;
  /** Source/origin of the output */
  source: string;
  /** Evidence supporting the output */
  evidenceRefs: string[];
}

/**
 * Result of confidence verification.
 */
export interface ConfidenceCheck {
  /** Whether confidence is well-calibrated */
  wellCalibrated: boolean;
  /** Outputs that are over-confident */
  overconfident: Output[];
  /** Outputs that are under-confident */
  underconfident: Output[];
  /** Average stated confidence */
  averageStatedConfidence: number;
  /** Recommendations for calibration */
  recommendations: string[];
}

/**
 * Result of evidence completeness check.
 */
export interface CompletenessResult {
  /** Whether evidence is complete */
  complete: boolean;
  /** Completeness percentage */
  completenessPercentage: number;
  /** Missing evidence references */
  missingRefs: string[];
  /** Broken evidence links */
  brokenLinks: string[];
  /** Evidence quality issues */
  qualityIssues: EvidenceQualityIssue[];
}

/**
 * An issue with evidence quality.
 */
export interface EvidenceQualityIssue {
  /** Evidence reference */
  ref: string;
  /** Issue type */
  issue: 'stale' | 'low_confidence' | 'unverified' | 'conflicting';
  /** Issue description */
  description: string;
  /** Suggestion for resolution */
  suggestion: string;
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

/**
 * An action performed by an agent.
 */
export interface AgentAction {
  /** Action type */
  type: string;
  /** Action target */
  target: string;
  /** Action parameters */
  params: Record<string, unknown>;
  /** When action was performed */
  timestamp: Date;
  /** Duration of action */
  durationMs: number;
  /** Whether action succeeded */
  success: boolean;
  /** Result of action */
  result?: unknown;
  /** Error if failed */
  error?: string;
}

/**
 * A decision made during orchestration.
 */
export interface Decision {
  /** Decision ID */
  id: string;
  /** Decision type */
  type: 'routing' | 'retry' | 'escalation' | 'degradation' | 'checkpoint' | 'termination';
  /** Options that were considered */
  options: string[];
  /** Chosen option */
  chosen: string;
  /** Factors that influenced the decision */
  factors: DecisionFactor[];
  /** Confidence in the decision */
  confidence: ConfidenceValue;
}

/**
 * A factor that influenced a decision.
 */
export interface DecisionFactor {
  /** Factor name */
  name: string;
  /** Factor value */
  value: number | string | boolean;
  /** Weight of this factor */
  weight: number;
  /** How this factor influenced the decision */
  influence: 'positive' | 'negative' | 'neutral';
}

/**
 * Outcome of a task or operation.
 */
export interface Outcome {
  /** Outcome status */
  status: 'success' | 'partial_success' | 'failure' | 'cancelled';
  /** What was achieved */
  achieved: string[];
  /** What was not achieved */
  notAchieved: string[];
  /** Metrics at completion */
  metrics: ProgressMetrics;
  /** Duration in ms */
  durationMs: number;
  /** Artifacts produced */
  artifacts: string[];
  /** Follow-up actions needed */
  followUpActions: string[];
}

/**
 * Export format for audit trail.
 */
export interface AuditExport {
  /** Export ID */
  id: string;
  /** Export format version */
  version: string;
  /** When export was created */
  exportedAt: Date;
  /** Time range covered */
  timeRange: {
    from: Date;
    to: Date;
  };
  /** Session ID if scoped to session */
  sessionId?: SessionId;
  /** Agent ID if scoped to agent */
  agentId?: string;
  /** All actions in the audit */
  actions: AuditAction[];
  /** All decisions in the audit */
  decisions: AuditDecision[];
  /** All outcomes in the audit */
  outcomes: AuditOutcome[];
  /** Summary statistics */
  summary: AuditSummary;
}

/**
 * An action in the audit trail.
 */
export interface AuditAction {
  /** Agent that performed the action */
  agentId: string;
  /** The action */
  action: AgentAction;
  /** Evidence ID if recorded to ledger */
  evidenceId?: EvidenceId;
}

/**
 * A decision in the audit trail.
 */
export interface AuditDecision {
  /** Decision */
  decision: Decision;
  /** Rationale for the decision */
  rationale: string;
  /** Evidence ID if recorded to ledger */
  evidenceId?: EvidenceId;
}

/**
 * An outcome in the audit trail.
 */
export interface AuditOutcome {
  /** Task ID */
  taskId: string;
  /** Outcome */
  outcome: Outcome;
  /** Evidence ID if recorded to ledger */
  evidenceId?: EvidenceId;
}

/**
 * Summary statistics for an audit export.
 */
export interface AuditSummary {
  /** Total actions */
  totalActions: number;
  /** Successful actions */
  successfulActions: number;
  /** Failed actions */
  failedActions: number;
  /** Total decisions */
  totalDecisions: number;
  /** Total outcomes */
  totalOutcomes: number;
  /** Success rate */
  successRate: number;
  /** Average action duration */
  averageActionDurationMs: number;
  /** Unique agents involved */
  uniqueAgents: string[];
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Agent health monitoring interface.
 */
export interface AgentHealthMonitor {
  /**
   * Track progress for an agent.
   *
   * @param agentId - Agent identifier
   * @param metrics - Progress metrics to record
   */
  trackProgress(agentId: string, metrics: ProgressMetrics): void;

  /**
   * Detect if an agent has stalled.
   *
   * @param agentId - Agent identifier
   * @param thresholdMs - Stall detection threshold in milliseconds
   * @returns True if agent is stalled
   */
  detectStall(agentId: string, thresholdMs: number): boolean;

  /**
   * Get resource usage for an agent.
   *
   * @param agentId - Agent identifier
   * @returns Resource usage statistics
   */
  getResourceUsage(agentId: string): ResourceUsage;

  /**
   * Handle a timeout for an agent.
   *
   * @param agentId - Agent identifier
   * @param action - Action to take on timeout
   */
  handleTimeout(agentId: string, action: TimeoutAction): void;

  /**
   * Get current status of an agent.
   *
   * @param agentId - Agent identifier
   * @returns Agent status
   */
  getStatus(agentId: string): AgentStatus;

  /**
   * Get all tracked agents.
   *
   * @returns Array of agent IDs
   */
  getTrackedAgents(): string[];
}

/**
 * Failure recovery interface.
 */
export interface FailureRecovery {
  /**
   * Create a checkpoint for an agent.
   *
   * @param agentId - Agent identifier
   * @param state - Current agent state
   * @returns Created checkpoint
   */
  createCheckpoint(agentId: string, state: AgentState): Checkpoint;

  /**
   * Resume from a checkpoint.
   *
   * @param checkpoint - Checkpoint to resume from
   * @returns Resume result
   */
  resumeFromCheckpoint(checkpoint: Checkpoint): ResumeResult;

  /**
   * Salvage partial results from a failed agent.
   *
   * @param agentId - Agent identifier
   * @returns Array of salvaged partial results
   */
  salvagePartialResults(agentId: string): PartialResult[];

  /**
   * Trigger manual intervention for an agent.
   *
   * @param agentId - Agent identifier
   * @param reason - Reason for intervention
   */
  triggerManualIntervention(agentId: string, reason: string): void;

  /**
   * Get checkpoint history for an agent.
   *
   * @param agentId - Agent identifier
   * @returns Array of checkpoints
   */
  getCheckpoints(agentId: string): Checkpoint[];

  /**
   * Get pending intervention requests.
   *
   * @returns Array of intervention requests
   */
  getPendingInterventions(): ManualInterventionRequest[];
}

/**
 * Quality assurance hooks interface.
 */
export interface QAHooks {
  /**
   * Validate changes before commit.
   *
   * @param changes - Changes to validate
   * @returns Validation result
   */
  preCommitValidation(changes: Change[]): CommitValidationResult;

  /**
   * Execute test gate.
   *
   * @param testResults - Test results to evaluate
   * @returns Gate result
   */
  testExecutionGate(testResults: TestResult[]): GateResult;

  /**
   * Verify confidence calibration of outputs.
   *
   * @param outputs - Outputs to check
   * @returns Confidence check result
   */
  confidenceVerification(outputs: Output[]): ConfidenceCheck;

  /**
   * Check evidence completeness.
   *
   * @param evidenceRefs - Evidence references to check
   * @returns Completeness result
   */
  evidenceCompletenessCheck(evidenceRefs: string[]): CompletenessResult;
}

/**
 * Orchestration audit interface.
 */
export interface OrchestrationAudit {
  /**
   * Log an action for an agent.
   *
   * @param agentId - Agent identifier
   * @param action - Action to log
   */
  logAction(agentId: string, action: AgentAction): void;

  /**
   * Record a decision with rationale.
   *
   * @param decision - Decision made
   * @param rationale - Reason for the decision
   */
  recordDecision(decision: Decision, rationale: string): void;

  /**
   * Track an outcome for a task.
   *
   * @param taskId - Task identifier
   * @param outcome - Task outcome
   */
  trackOutcome(taskId: string, outcome: Outcome): void;

  /**
   * Export audit trail for reproducibility.
   *
   * @returns Audit export
   */
  exportForReproducibility(): AuditExport;

  /**
   * Get action history for an agent.
   *
   * @param agentId - Agent identifier
   * @returns Array of actions
   */
  getActionHistory(agentId: string): AgentAction[];

  /**
   * Get all decisions made.
   *
   * @returns Array of decision records
   */
  getDecisions(): AuditDecision[];
}

// ============================================================================
// IMPLEMENTATIONS
// ============================================================================

/**
 * In-memory implementation of agent health monitoring.
 */
export class InMemoryAgentHealthMonitor implements AgentHealthMonitor {
  private metrics: Map<string, ProgressMetrics> = new Map();
  private resourceUsage: Map<string, ResourceUsage> = new Map();
  private status: Map<string, AgentStatus> = new Map();
  private timeoutHandlers: Map<string, TimeoutAction> = new Map();

  trackProgress(agentId: string, metrics: ProgressMetrics): void {
    const existing = this.metrics.get(agentId);
    this.metrics.set(agentId, {
      ...existing,
      ...metrics,
      lastActivityAt: new Date(),
    });

    // Update status based on metrics
    if (this.status.get(agentId) !== 'running') {
      this.status.set(agentId, 'running');
    }
  }

  detectStall(agentId: string, thresholdMs: number): boolean {
    const metrics = this.metrics.get(agentId);
    if (!metrics) {
      return false;
    }

    const now = Date.now();
    const lastActivity = metrics.lastActivityAt.getTime();
    const isStalled = now - lastActivity > thresholdMs;

    if (isStalled && this.status.get(agentId) === 'running') {
      this.status.set(agentId, 'stalled');
    }

    return isStalled;
  }

  getResourceUsage(agentId: string): ResourceUsage {
    return (
      this.resourceUsage.get(agentId) ?? {
        memoryBytes: 0,
        cpuMs: 0,
        networkBytes: 0,
        fileOperations: 0,
        peakConcurrency: 0,
      }
    );
  }

  handleTimeout(agentId: string, action: TimeoutAction): void {
    this.timeoutHandlers.set(agentId, action);
    this.status.set(agentId, 'timeout');
  }

  getStatus(agentId: string): AgentStatus {
    return this.status.get(agentId) ?? 'idle';
  }

  getTrackedAgents(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Update resource usage for an agent.
   * @param agentId - Agent identifier
   * @param usage - Resource usage update
   */
  updateResourceUsage(agentId: string, usage: Partial<ResourceUsage>): void {
    const existing = this.resourceUsage.get(agentId) ?? {
      memoryBytes: 0,
      cpuMs: 0,
      networkBytes: 0,
      fileOperations: 0,
      peakConcurrency: 0,
    };
    this.resourceUsage.set(agentId, { ...existing, ...usage });
  }

  /**
   * Set agent status directly.
   * @param agentId - Agent identifier
   * @param status - New status
   */
  setStatus(agentId: string, status: AgentStatus): void {
    this.status.set(agentId, status);
  }

  /**
   * Clear tracking data for an agent.
   * @param agentId - Agent identifier
   */
  clear(agentId: string): void {
    this.metrics.delete(agentId);
    this.resourceUsage.delete(agentId);
    this.status.delete(agentId);
    this.timeoutHandlers.delete(agentId);
  }

  /**
   * Clear all tracking data.
   */
  clearAll(): void {
    this.metrics.clear();
    this.resourceUsage.clear();
    this.status.clear();
    this.timeoutHandlers.clear();
  }
}

/**
 * In-memory implementation of failure recovery.
 */
export class InMemoryFailureRecovery implements FailureRecovery {
  private checkpoints: Map<string, Checkpoint[]> = new Map();
  private interventions: ManualInterventionRequest[] = [];
  private partialResults: Map<string, PartialResult[]> = new Map();
  private nextCheckpointId = 1;
  private nextInterventionId = 1;

  private ledger?: IEvidenceLedger;

  constructor(ledger?: IEvidenceLedger) {
    this.ledger = ledger;
  }

  createCheckpoint(agentId: string, state: AgentState): Checkpoint {
    const checkpoint: Checkpoint = {
      id: `checkpoint_${this.nextCheckpointId++}`,
      agentId,
      createdAt: new Date(),
      state,
      reason: 'manual',
      stateHash: this.computeStateHash(state),
      resumable: true,
    };

    const existing = this.checkpoints.get(agentId) ?? [];
    existing.push(checkpoint);
    this.checkpoints.set(agentId, existing);

    // Record to ledger if available
    if (this.ledger) {
      this.recordCheckpointToLedger(checkpoint).catch((err) => {
        console.warn(`Failed to record checkpoint to ledger: ${err}`);
      });
    }

    return checkpoint;
  }

  resumeFromCheckpoint(checkpoint: Checkpoint): ResumeResult {
    if (!checkpoint.resumable) {
      return {
        success: false,
        checkpoint,
        error: 'Checkpoint is not resumable',
        recoveredOperations: [],
        lostOperations: checkpoint.state.pendingOperations.map((op) => op.id),
      };
    }

    // Verify state integrity
    const currentHash = this.computeStateHash(checkpoint.state);
    if (currentHash !== checkpoint.stateHash) {
      return {
        success: false,
        checkpoint,
        error: 'Checkpoint state integrity verification failed',
        recoveredOperations: [],
        lostOperations: [],
      };
    }

    const newState: AgentState = {
      ...checkpoint.state,
      status: 'running',
      metrics: {
        ...checkpoint.state.metrics,
        lastActivityAt: new Date(),
      },
    };

    return {
      success: true,
      checkpoint,
      newState,
      recoveredOperations: checkpoint.state.pendingOperations.map((op) => op.id),
      lostOperations: [],
    };
  }

  salvagePartialResults(agentId: string): PartialResult[] {
    return this.partialResults.get(agentId) ?? [];
  }

  triggerManualIntervention(agentId: string, reason: string): void {
    const checkpoints = this.checkpoints.get(agentId) ?? [];
    const latestCheckpoint = checkpoints[checkpoints.length - 1];

    const intervention: ManualInterventionRequest = {
      id: `intervention_${this.nextInterventionId++}`,
      agentId,
      reason,
      state: latestCheckpoint?.state ?? {
        agentId,
        status: 'failed',
        currentTask: 'unknown',
        metrics: {
          tokensUsed: 0,
          toolCalls: 0,
          elapsedMs: 0,
          lastActivityAt: new Date(),
        },
        context: {},
        pendingOperations: [],
        completedOperations: [],
        config: {},
      },
      suggestedActions: this.generateSuggestedActions(reason),
      priority: this.determinePriority(reason),
      createdAt: new Date(),
      timeoutAt: new Date(Date.now() + 3600000), // 1 hour timeout
    };

    this.interventions.push(intervention);
  }

  getCheckpoints(agentId: string): Checkpoint[] {
    return this.checkpoints.get(agentId) ?? [];
  }

  getPendingInterventions(): ManualInterventionRequest[] {
    return this.interventions.filter((i) => i.timeoutAt > new Date());
  }

  /**
   * Add partial results for an agent.
   * @param agentId - Agent identifier
   * @param results - Partial results to add
   */
  addPartialResults(agentId: string, results: PartialResult[]): void {
    const existing = this.partialResults.get(agentId) ?? [];
    existing.push(...results);
    this.partialResults.set(agentId, existing);
  }

  /**
   * Create a checkpoint with a specific reason.
   * @param agentId - Agent identifier
   * @param state - Agent state
   * @param reason - Reason for checkpoint
   */
  createCheckpointWithReason(
    agentId: string,
    state: AgentState,
    reason: CheckpointReason
  ): Checkpoint {
    const checkpoint = this.createCheckpoint(agentId, state);
    checkpoint.reason = reason;
    return checkpoint;
  }

  /**
   * Resolve a manual intervention request.
   * @param interventionId - Intervention ID
   */
  resolveIntervention(interventionId: string): void {
    const index = this.interventions.findIndex((i) => i.id === interventionId);
    if (index >= 0) {
      this.interventions.splice(index, 1);
    }
  }

  /**
   * Clear all data.
   */
  clearAll(): void {
    this.checkpoints.clear();
    this.interventions = [];
    this.partialResults.clear();
  }

  private computeStateHash(state: AgentState): string {
    // Simple hash based on JSON serialization
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return hash.toString(16);
  }

  private generateSuggestedActions(reason: string): string[] {
    const suggestions: string[] = [];

    if (reason.includes('timeout')) {
      suggestions.push('Increase timeout threshold');
      suggestions.push('Check for external service delays');
      suggestions.push('Resume from last checkpoint');
    } else if (reason.includes('error')) {
      suggestions.push('Review error logs');
      suggestions.push('Retry with different configuration');
      suggestions.push('Salvage partial results');
    } else if (reason.includes('stall')) {
      suggestions.push('Check for blocking operations');
      suggestions.push('Verify resource availability');
      suggestions.push('Force restart agent');
    } else {
      suggestions.push('Review agent state');
      suggestions.push('Check recent changes');
      suggestions.push('Contact support');
    }

    return suggestions;
  }

  private determinePriority(
    reason: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (reason.includes('critical') || reason.includes('security')) {
      return 'critical';
    }
    if (reason.includes('error') || reason.includes('failure')) {
      return 'high';
    }
    if (reason.includes('timeout') || reason.includes('stall')) {
      return 'medium';
    }
    return 'low';
  }

  private async recordCheckpointToLedger(checkpoint: Checkpoint): Promise<EvidenceEntry> {
    if (!this.ledger) {
      throw new Error('No ledger configured');
    }

    return this.ledger.append({
      kind: 'episode',
      payload: {
        query: `Checkpoint for agent ${checkpoint.agentId}`,
        stages: [
          {
            name: 'checkpoint_creation',
            durationMs: 0,
            success: true,
          },
        ],
        totalDurationMs: 0,
        retrievedEntities: 0,
        synthesizedResponse: false,
      },
      provenance: {
        source: 'system_observation',
        method: `checkpoint:${checkpoint.reason}`,
      },
      relatedEntries: [],
    });
  }
}

/**
 * Implementation of quality assurance hooks.
 */
export class DefaultQAHooks implements QAHooks {
  private calibrationTracker?: ConstructionCalibrationTracker;
  private ledger?: IEvidenceLedger;

  constructor(options?: {
    calibrationTracker?: ConstructionCalibrationTracker;
    ledger?: IEvidenceLedger;
  }) {
    this.calibrationTracker = options?.calibrationTracker;
    this.ledger = options?.ledger;
  }

  preCommitValidation(changes: Change[]): CommitValidationResult {
    const checks: ValidationCheck[] = [];
    const blockingIssues: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Simulate various validation checks
    for (const change of changes) {
      // Check for large changes
      if (change.linesAdded > 500) {
        warnings.push({
          type: 'large_change',
          severity: 'warning',
          message: `Large change detected: ${change.linesAdded} lines added`,
          filePath: change.filePath,
          suggestion: 'Consider breaking into smaller commits',
        });
      }

      // Check for deleted files
      if (change.type === 'delete') {
        warnings.push({
          type: 'file_deletion',
          severity: 'warning',
          message: `File deletion: ${change.filePath}`,
          filePath: change.filePath,
          suggestion: 'Verify deletion is intentional',
        });
      }
    }

    // Add basic checks
    checks.push({
      name: 'change_analysis',
      type: 'custom',
      passed: blockingIssues.length === 0,
      durationMs: 10,
    });

    const allowed = blockingIssues.length === 0;

    if (changes.length > 10) {
      suggestions.push('Consider splitting into multiple commits');
    }

    return {
      allowed,
      checks,
      blockingIssues,
      warnings,
      suggestions,
      confidence: {
        type: 'derived',
        value: allowed ? 0.9 : 0.3,
        formula: 'automated_validation_checks',
        inputs: [],
      },
    };
  }

  testExecutionGate(testResults: TestResult[]): GateResult {
    const passed = testResults.filter((t) => t.status === 'passed');
    const failed = testResults.filter((t) => t.status === 'failed');
    const skipped = testResults.filter((t) => t.status === 'skipped');

    const gatePassed = failed.length === 0;

    return {
      passed: gatePassed,
      gateName: 'test_execution',
      totalTests: testResults.length,
      passedTests: passed.length,
      failedTests: failed.length,
      skippedTests: skipped.length,
      failures: failed,
    };
  }

  confidenceVerification(outputs: Output[]): ConfidenceCheck {
    const overconfident: Output[] = [];
    const underconfident: Output[] = [];
    let totalConfidence = 0;
    let count = 0;

    for (const output of outputs) {
      const confidence = this.extractConfidenceValue(output.statedConfidence);
      if (confidence !== null) {
        totalConfidence += confidence;
        count++;

        // Check calibration based on evidence
        const evidenceCount = output.evidenceRefs.length;
        if (confidence > 0.9 && evidenceCount < 3) {
          overconfident.push(output);
        } else if (confidence < 0.5 && evidenceCount > 5) {
          underconfident.push(output);
        }
      }
    }

    const averageConfidence = count > 0 ? totalConfidence / count : 0;

    const recommendations: string[] = [];
    if (overconfident.length > 0) {
      recommendations.push(
        `${overconfident.length} outputs may be overconfident - gather more evidence`
      );
    }
    if (underconfident.length > 0) {
      recommendations.push(
        `${underconfident.length} outputs may be underconfident - review evidence`
      );
    }

    return {
      wellCalibrated: overconfident.length === 0 && underconfident.length === 0,
      overconfident,
      underconfident,
      averageStatedConfidence: averageConfidence,
      recommendations,
    };
  }

  evidenceCompletenessCheck(evidenceRefs: string[]): CompletenessResult {
    const missingRefs: string[] = [];
    const brokenLinks: string[] = [];
    const qualityIssues: EvidenceQualityIssue[] = [];

    // In a real implementation, this would check against the evidence ledger
    for (const ref of evidenceRefs) {
      // Simulate checking if reference exists
      if (ref.startsWith('missing_')) {
        missingRefs.push(ref);
      } else if (ref.startsWith('broken_')) {
        brokenLinks.push(ref);
      } else if (ref.startsWith('stale_')) {
        qualityIssues.push({
          ref,
          issue: 'stale',
          description: 'Evidence may be outdated',
          suggestion: 'Verify evidence is still valid',
        });
      }
    }

    const validRefs =
      evidenceRefs.length - missingRefs.length - brokenLinks.length;
    const completeness =
      evidenceRefs.length > 0 ? validRefs / evidenceRefs.length : 1;

    return {
      complete: completeness >= 0.95,
      completenessPercentage: completeness * 100,
      missingRefs,
      brokenLinks,
      qualityIssues,
    };
  }

  private extractConfidenceValue(confidence: ConfidenceValue): number | null {
    switch (confidence.type) {
      case 'deterministic':
      case 'derived':
      case 'measured':
        return confidence.value;
      case 'bounded':
        return (confidence.low + confidence.high) / 2;
      case 'absent':
        return null;
      default:
        return null;
    }
  }
}

/**
 * In-memory implementation of orchestration audit.
 */
export class InMemoryOrchestrationAudit implements OrchestrationAudit {
  private actions: AuditAction[] = [];
  private decisions: AuditDecision[] = [];
  private outcomes: AuditOutcome[] = [];
  private sessionId?: SessionId;
  private ledger?: IEvidenceLedger;

  constructor(options?: { sessionId?: SessionId; ledger?: IEvidenceLedger }) {
    this.sessionId = options?.sessionId;
    this.ledger = options?.ledger;
  }

  logAction(agentId: string, action: AgentAction): void {
    const auditAction: AuditAction = {
      agentId,
      action,
    };

    this.actions.push(auditAction);

    // Record to ledger if available
    if (this.ledger) {
      this.recordActionToLedger(auditAction).catch((err) => {
        console.warn(`Failed to record action to ledger: ${err}`);
      });
    }
  }

  recordDecision(decision: Decision, rationale: string): void {
    const auditDecision: AuditDecision = {
      decision,
      rationale,
    };

    this.decisions.push(auditDecision);

    // Record to ledger if available
    if (this.ledger) {
      this.recordDecisionToLedger(auditDecision).catch((err) => {
        console.warn(`Failed to record decision to ledger: ${err}`);
      });
    }
  }

  trackOutcome(taskId: string, outcome: Outcome): void {
    const auditOutcome: AuditOutcome = {
      taskId,
      outcome,
    };

    this.outcomes.push(auditOutcome);

    // Record to ledger if available
    if (this.ledger) {
      this.recordOutcomeToLedger(auditOutcome).catch((err) => {
        console.warn(`Failed to record outcome to ledger: ${err}`);
      });
    }
  }

  exportForReproducibility(): AuditExport {
    const now = new Date();
    const startTime =
      this.actions.length > 0
        ? this.actions[0].action.timestamp
        : now;
    const endTime =
      this.actions.length > 0
        ? this.actions[this.actions.length - 1].action.timestamp
        : now;

    const successfulActions = this.actions.filter((a) => a.action.success);
    const failedActions = this.actions.filter((a) => !a.action.success);
    const uniqueAgents = [
      ...new Set(this.actions.map((a) => a.agentId)),
    ];

    const totalDuration = this.actions.reduce(
      (sum, a) => sum + a.action.durationMs,
      0
    );
    const avgDuration =
      this.actions.length > 0 ? totalDuration / this.actions.length : 0;

    return {
      id: `audit_export_${Date.now()}`,
      version: '1.0.0',
      exportedAt: now,
      timeRange: {
        from: startTime,
        to: endTime,
      },
      sessionId: this.sessionId,
      actions: this.actions,
      decisions: this.decisions,
      outcomes: this.outcomes,
      summary: {
        totalActions: this.actions.length,
        successfulActions: successfulActions.length,
        failedActions: failedActions.length,
        totalDecisions: this.decisions.length,
        totalOutcomes: this.outcomes.length,
        successRate:
          this.actions.length > 0
            ? successfulActions.length / this.actions.length
            : 0,
        averageActionDurationMs: avgDuration,
        uniqueAgents,
      },
    };
  }

  getActionHistory(agentId: string): AgentAction[] {
    return this.actions
      .filter((a) => a.agentId === agentId)
      .map((a) => a.action);
  }

  getDecisions(): AuditDecision[] {
    return this.decisions;
  }

  /**
   * Clear all audit data.
   */
  clearAll(): void {
    this.actions = [];
    this.decisions = [];
    this.outcomes = [];
  }

  private async recordActionToLedger(auditAction: AuditAction): Promise<EvidenceEntry> {
    if (!this.ledger) {
      throw new Error('No ledger configured');
    }

    const entry = await this.ledger.append({
      kind: 'tool_call',
      payload: {
        toolName: auditAction.action.type,
        arguments: auditAction.action.params,
        result: auditAction.action.result,
        success: auditAction.action.success,
        durationMs: auditAction.action.durationMs,
        errorMessage: auditAction.action.error,
      },
      provenance: {
        source: 'system_observation',
        method: `orchestration_audit:action`,
        agent: {
          type: 'tool',
          identifier: auditAction.agentId,
        },
      },
      relatedEntries: [],
      sessionId: this.sessionId,
    });

    auditAction.evidenceId = entry.id;
    return entry;
  }

  private async recordDecisionToLedger(auditDecision: AuditDecision): Promise<EvidenceEntry> {
    if (!this.ledger) {
      throw new Error('No ledger configured');
    }

    const entry = await this.ledger.append({
      kind: 'claim',
      payload: {
        claim: `Decision: ${auditDecision.decision.type} - ${auditDecision.decision.chosen}`,
        category: 'behavior',
        subject: {
          type: 'system',
          identifier: 'orchestration',
        },
        supportingEvidence: [],
        knownDefeaters: [],
        confidence: auditDecision.decision.confidence,
      },
      provenance: {
        source: 'system_observation',
        method: `orchestration_audit:decision`,
      },
      relatedEntries: [],
      sessionId: this.sessionId,
      confidence: auditDecision.decision.confidence,
    });

    auditDecision.evidenceId = entry.id;
    return entry;
  }

  private async recordOutcomeToLedger(auditOutcome: AuditOutcome): Promise<EvidenceEntry> {
    if (!this.ledger) {
      throw new Error('No ledger configured');
    }

    const entry = await this.ledger.append({
      kind: 'outcome',
      payload: {
        predictionId: auditOutcome.taskId as unknown as EvidenceId,
        predicted: {
          claim: `Task ${auditOutcome.taskId} outcome`,
          confidence: { type: 'deterministic', value: 1, reason: 'observed' },
        },
        actual: {
          outcome:
            auditOutcome.outcome.status === 'success'
              ? 'correct'
              : auditOutcome.outcome.status === 'partial_success'
                ? 'partial'
                : 'incorrect',
          observation: JSON.stringify({
            achieved: auditOutcome.outcome.achieved,
            notAchieved: auditOutcome.outcome.notAchieved,
          }),
        },
        verificationMethod: 'system_observation',
      },
      provenance: {
        source: 'system_observation',
        method: `orchestration_audit:outcome`,
      },
      relatedEntries: [],
      sessionId: this.sessionId,
    });

    auditOutcome.evidenceId = entry.id;
    return entry;
  }
}

// ============================================================================
// ORCHESTRATION RELIABILITY FRAMEWORK
// ============================================================================

/**
 * Configuration for the orchestration reliability framework.
 */
export interface OrchestrationReliabilityConfig {
  /** Orchestration preset to use */
  preset: OrchestrationPreset;
  /** Evidence ledger for audit persistence */
  ledger?: IEvidenceLedger;
  /** Calibration tracker for outcome tracking */
  calibrationTracker?: ConstructionCalibrationTracker;
  /** Session ID for tracking */
  sessionId?: SessionId;
  /** Checkpoint interval in ms (default: 60000) */
  checkpointIntervalMs?: number;
  /** Enable automatic stall detection */
  autoStallDetection?: boolean;
}

/**
 * Complete orchestration reliability framework.
 *
 * Integrates health monitoring, failure recovery, quality assurance,
 * and audit trail into a cohesive system for multi-agent coordination.
 */
export class OrchestrationReliabilityFramework {
  readonly healthMonitor: AgentHealthMonitor;
  readonly failureRecovery: FailureRecovery;
  readonly qaHooks: QAHooks;
  readonly audit: OrchestrationAudit;

  private config: OrchestrationReliabilityConfig;
  private checkpointTimer?: ReturnType<typeof setInterval>;
  private stallDetectionTimer?: ReturnType<typeof setInterval>;

  constructor(config: OrchestrationReliabilityConfig) {
    this.config = config;

    // Initialize components
    this.healthMonitor = new InMemoryAgentHealthMonitor();
    this.failureRecovery = new InMemoryFailureRecovery(config.ledger);
    this.qaHooks = new DefaultQAHooks({
      calibrationTracker: config.calibrationTracker,
      ledger: config.ledger,
    });
    this.audit = new InMemoryOrchestrationAudit({
      sessionId: config.sessionId,
      ledger: config.ledger,
    });

    // Setup automatic processes
    if (config.checkpointIntervalMs) {
      this.startCheckpointTimer(config.checkpointIntervalMs);
    }

    if (config.autoStallDetection) {
      this.startStallDetection();
    }
  }

  /**
   * Start automatic checkpoint timer.
   * @param intervalMs - Interval in milliseconds
   */
  private startCheckpointTimer(intervalMs: number): void {
    this.checkpointTimer = setInterval(() => {
      for (const agentId of this.healthMonitor.getTrackedAgents()) {
        const status = this.healthMonitor.getStatus(agentId);
        if (status === 'running') {
          // Create checkpoint
          const state = this.getCurrentAgentState(agentId);
          if (state) {
            (this.failureRecovery as InMemoryFailureRecovery).createCheckpointWithReason(
              agentId,
              state,
              'scheduled'
            );
          }
        }
      }
    }, intervalMs);
  }

  /**
   * Start automatic stall detection.
   */
  private startStallDetection(): void {
    const threshold = this.config.preset.stallDetectionThresholdMs;
    const interval = this.config.preset.progressCheckIntervalMs;

    this.stallDetectionTimer = setInterval(() => {
      for (const agentId of this.healthMonitor.getTrackedAgents()) {
        if (this.healthMonitor.detectStall(agentId, threshold)) {
          this.handleStalledAgent(agentId);
        }
      }
    }, interval);
  }

  /**
   * Handle a stalled agent based on failure policy.
   * @param agentId - Agent identifier
   */
  private handleStalledAgent(agentId: string): void {
    const policy = this.config.preset.failurePolicy;

    // Log the stall as an action
    this.audit.logAction(agentId, {
      type: 'stall_detected',
      target: agentId,
      params: { policy },
      timestamp: new Date(),
      durationMs: 0,
      success: false,
      error: 'Agent stalled',
    });

    // Record the decision
    const decision: Decision = {
      id: `decision_stall_${agentId}_${Date.now()}`,
      type: 'degradation',
      options: ['skip', 'fallback', 'retry', 'escalate'],
      chosen: policy === 'retry' ? 'retry' : policy === 'continue' ? 'skip' : 'escalate',
      factors: [
        {
          name: 'failure_policy',
          value: policy,
          weight: 1,
          influence: 'neutral',
        },
      ],
      confidence: { type: 'deterministic', value: 1, reason: 'policy_driven' },
    };

    this.audit.recordDecision(decision, `Agent ${agentId} stalled, applying ${policy} policy`);

    // Take action based on policy
    switch (policy) {
      case 'retry':
        this.handleRetry(agentId);
        break;
      case 'fail_fast':
        this.healthMonitor.handleTimeout(agentId, 'terminate');
        break;
      case 'continue':
        // Just log and continue monitoring
        break;
    }
  }

  /**
   * Handle retry for a stalled agent.
   * @param agentId - Agent identifier
   */
  private handleRetry(agentId: string): void {
    const retryConfig = this.config.preset.retryConfig;
    if (!retryConfig) {
      this.healthMonitor.handleTimeout(agentId, 'escalate');
      return;
    }

    // Create checkpoint before retry
    const state = this.getCurrentAgentState(agentId);
    if (state) {
      const checkpoint = (this.failureRecovery as InMemoryFailureRecovery).createCheckpointWithReason(
        agentId,
        state,
        'error'
      );

      // Attempt resume
      const result = this.failureRecovery.resumeFromCheckpoint(checkpoint);

      if (!result.success) {
        this.failureRecovery.triggerManualIntervention(
          agentId,
          `Retry failed: ${result.error}`
        );
      }
    }
  }

  /**
   * Get current state for an agent.
   * @param agentId - Agent identifier
   */
  private getCurrentAgentState(agentId: string): AgentState | null {
    const status = this.healthMonitor.getStatus(agentId);
    const usage = this.healthMonitor.getResourceUsage(agentId);

    // Build state from available information
    const agents = this.healthMonitor.getTrackedAgents();
    if (!agents.includes(agentId)) {
      return null;
    }

    return {
      agentId,
      status,
      currentTask: 'unknown',
      metrics: {
        tokensUsed: 0,
        toolCalls: 0,
        elapsedMs: 0,
        lastActivityAt: new Date(),
      },
      context: {},
      pendingOperations: [],
      completedOperations: [],
      config: {},
    };
  }

  /**
   * Stop all automatic processes and clean up.
   */
  stop(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = undefined;
    }
    if (this.stallDetectionTimer) {
      clearInterval(this.stallDetectionTimer);
      this.stallDetectionTimer = undefined;
    }
  }

  /**
   * Export audit trail and cleanup.
   */
  exportAndCleanup(): AuditExport {
    const auditExport = this.audit.exportForReproducibility();
    this.stop();
    return auditExport;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an agent health monitor.
 */
export function createAgentHealthMonitor(): AgentHealthMonitor {
  return new InMemoryAgentHealthMonitor();
}

/**
 * Create a failure recovery handler.
 * @param ledger - Optional evidence ledger for persistence
 */
export function createFailureRecovery(ledger?: IEvidenceLedger): FailureRecovery {
  return new InMemoryFailureRecovery(ledger);
}

/**
 * Create QA hooks.
 * @param options - Optional configuration
 */
export function createQAHooks(options?: {
  calibrationTracker?: ConstructionCalibrationTracker;
  ledger?: IEvidenceLedger;
}): QAHooks {
  return new DefaultQAHooks(options);
}

/**
 * Create an orchestration audit logger.
 * @param options - Optional configuration
 */
export function createOrchestrationAudit(options?: {
  sessionId?: SessionId;
  ledger?: IEvidenceLedger;
}): OrchestrationAudit {
  return new InMemoryOrchestrationAudit(options);
}

/**
 * Create a complete orchestration reliability framework.
 * @param config - Framework configuration
 */
export function createOrchestrationReliabilityFramework(
  config: OrchestrationReliabilityConfig
): OrchestrationReliabilityFramework {
  return new OrchestrationReliabilityFramework(config);
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validate progress metrics.
 */
export function validateProgressMetrics(metrics: ProgressMetrics): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (metrics.tokensUsed < 0) {
    errors.push({
      path: 'tokensUsed',
      message: 'tokensUsed must be non-negative',
      code: 'invalid_tokens_used',
    });
  }

  if (metrics.toolCalls < 0) {
    errors.push({
      path: 'toolCalls',
      message: 'toolCalls must be non-negative',
      code: 'invalid_tool_calls',
    });
  }

  if (metrics.elapsedMs < 0) {
    errors.push({
      path: 'elapsedMs',
      message: 'elapsedMs must be non-negative',
      code: 'invalid_elapsed_ms',
    });
  }

  if (metrics.progressPercentage !== undefined) {
    if (metrics.progressPercentage < 0 || metrics.progressPercentage > 100) {
      errors.push({
        path: 'progressPercentage',
        message: 'progressPercentage must be between 0 and 100',
        code: 'invalid_progress_percentage',
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate an agent state.
 */
export function validateAgentState(state: AgentState): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!state.agentId || state.agentId.trim().length === 0) {
    errors.push({
      path: 'agentId',
      message: 'agentId is required',
      code: 'missing_agent_id',
    });
  }

  if (!state.currentTask || state.currentTask.trim().length === 0) {
    warnings.push({
      path: 'currentTask',
      message: 'currentTask is empty',
      suggestion: 'Provide a task description',
    });
  }

  const metricsResult = validateProgressMetrics(state.metrics);
  errors.push(
    ...metricsResult.errors.map((e) => ({
      ...e,
      path: `metrics.${e.path}`,
    }))
  );
  warnings.push(
    ...metricsResult.warnings.map((w) => ({
      ...w,
      path: `metrics.${w.path}`,
    }))
  );

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a checkpoint.
 */
export function validateCheckpoint(checkpoint: Checkpoint): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!checkpoint.id || checkpoint.id.trim().length === 0) {
    errors.push({
      path: 'id',
      message: 'Checkpoint id is required',
      code: 'missing_id',
    });
  }

  if (!checkpoint.stateHash || checkpoint.stateHash.trim().length === 0) {
    errors.push({
      path: 'stateHash',
      message: 'Checkpoint stateHash is required',
      code: 'missing_state_hash',
    });
  }

  const stateResult = validateAgentState(checkpoint.state);
  errors.push(
    ...stateResult.errors.map((e) => ({
      ...e,
      path: `state.${e.path}`,
    }))
  );
  warnings.push(
    ...stateResult.warnings.map((w) => ({
      ...w,
      path: `state.${w.path}`,
    }))
  );

  return { valid: errors.length === 0, errors, warnings };
}
