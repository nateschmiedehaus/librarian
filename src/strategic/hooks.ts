/**
 * @fileoverview Agent Lifecycle and Work Process Hooks
 *
 * This module defines comprehensive hooks for intercepting and customizing
 * agent behavior at strategic points throughout the execution lifecycle.
 *
 * Hook Categories:
 * 1. Agent Invocation Hooks - Before/after agent execution
 * 2. Model Interaction Hooks - LLM request/response interception
 * 3. Tool Invocation Hooks - Tool call interception and validation
 * 4. Memory Access Hooks - Memory read/write interception
 * 5. State Transition Hooks - Agent state machine transitions
 * 6. Error Recovery Hooks - Error handling and recovery
 * 7. Task Lifecycle Hooks - Task creation/execution/completion
 * 8. Validation Gate Hooks - Gate enforcement and approval
 *
 * Design Philosophy:
 * - Every hook point allows interception, modification, or cancellation
 * - Hooks compose cleanly for complex behaviors
 * - Evidence collection integrated at every level
 * - Hooks can be scoped globally, per-agent, or per-task
 *
 * @packageDocumentation
 */

import type { Provenance, ConfidenceLevel } from './types.js';

// ============================================================================
// CORE HOOK TYPES
// ============================================================================

/**
 * When the hook executes relative to the action
 */
export type HookTiming = 'before' | 'after' | 'around';

/**
 * Scope at which the hook applies
 */
export type HookScope = 'global' | 'agent' | 'task' | 'tool';

/**
 * Priority level for hook execution order (lower = earlier)
 */
export type HookPriority = number;

/**
 * Handle returned when registering a hook (for unregistration)
 */
export interface HookHandle {
  readonly id: string;
  readonly point: string;
  readonly priority: HookPriority;
  readonly scope: HookScope;
}

/**
 * Options when registering a hook
 */
export interface HookOptions {
  /** Hook priority (lower = earlier execution). Default: 100 */
  priority?: HookPriority;

  /** Scope this hook applies to */
  scope?: HookScope;

  /** Conditions that must be true for hook to activate */
  conditions?: HookCondition[];

  /** Maximum execution time before timeout (ms) */
  timeout?: number;

  /** How to handle errors in the hook */
  errorHandling?: HookErrorHandling;

  /** Tags for categorizing hooks */
  tags?: string[];

  /** Description for documentation/debugging */
  description?: string;
}

/**
 * Condition for hook activation
 */
export interface HookCondition {
  /** Field to check (dot notation supported) */
  field: string;

  /** Comparison operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'matches' | 'exists' | 'not_exists' | 'gt' | 'lt' | 'gte' | 'lte';

  /** Value to compare against */
  value: unknown;
}

/**
 * How to handle errors in hooks
 */
export type HookErrorHandling =
  | 'swallow'    // Log and continue
  | 'propagate'  // Re-throw error
  | 'log'        // Log with warning level
  | 'fail_fast'; // Immediately abort

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Base context available to all hooks
 */
export interface HookContext {
  /** Unique execution ID */
  executionId: string;

  /** Timestamp when execution started */
  startedAt: Date;

  /** Current agent ID (if in agent context) */
  agentId?: string;

  /** Current task ID (if in task context) */
  taskId?: string;

  /** Parent context (for nested executions) */
  parentContext?: HookContext;

  /** Arbitrary metadata */
  metadata: Record<string, unknown>;

  /** Evidence collected so far */
  evidence: HookEvidence[];
}

/**
 * Evidence collected during hook execution
 */
export interface HookEvidence {
  type: HookEvidenceType;
  timestamp: Date;
  source: string;
  data: unknown;
  confidence?: ConfidenceLevel;
}

export type HookEvidenceType =
  | 'input_received'
  | 'output_produced'
  | 'tool_invoked'
  | 'tool_result'
  | 'model_request'
  | 'model_response'
  | 'state_change'
  | 'error_occurred'
  | 'decision_made'
  | 'validation_result';

/**
 * Agent-specific context
 */
export interface AgentContext extends HookContext {
  agentId: string;
  agentType: string;
  agentConfig: Record<string, unknown>;
  currentState: AgentState;
  stateHistory: StateTransition[];
  tools: ToolInfo[];
  memory: MemoryInfo;
}

/**
 * Model request/response context
 */
export interface ModelContext extends HookContext {
  modelId: string;
  modelConfig: ModelConfig;
  requestCount: number;
  totalTokens: number;
}

/**
 * Tool invocation context
 */
export interface ToolContext extends HookContext {
  toolName: string;
  toolType: string;
  toolConfig: Record<string, unknown>;
  invocationCount: number;
}

/**
 * Memory access context
 */
export interface MemoryContext extends HookContext {
  memoryType: MemoryType;
  accessType: 'read' | 'write' | 'delete';
  scope: string;
}

/**
 * Error context for recovery hooks
 */
export interface ErrorContext extends HookContext {
  error: Error;
  errorType: string;
  recoveryAttempts: number;
  lastRecoveryAction?: RecoveryAction;
}

// ============================================================================
// AGENT STATE TYPES
// ============================================================================

/**
 * Possible agent states
 */
export type AgentState =
  | 'initializing'
  | 'ready'
  | 'planning'
  | 'executing'
  | 'observing'
  | 'reflecting'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'suspended';

/**
 * Record of a state transition
 */
export interface StateTransition {
  from: AgentState;
  to: AgentState;
  trigger: string;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Valid state transitions
 */
export const AGENT_STATE_TRANSITIONS: Record<AgentState, AgentState[]> = {
  initializing: ['ready', 'failed'],
  ready: ['planning', 'executing', 'suspended', 'completed'],
  planning: ['executing', 'ready', 'failed'],
  executing: ['observing', 'waiting', 'failed', 'suspended'],
  observing: ['reflecting', 'executing', 'completed', 'failed'],
  reflecting: ['planning', 'executing', 'completed', 'failed'],
  waiting: ['executing', 'ready', 'failed', 'suspended'],
  completed: [], // Terminal state
  failed: ['ready'], // Can retry
  suspended: ['ready', 'failed'],
};

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result of agent execution
 */
export interface AgentResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
  tokensUsed: number;
  toolsInvoked: number;
  evidence: HookEvidence[];
}

/**
 * Result of model call
 */
export interface ModelResponse {
  content: string;
  role: 'assistant' | 'tool';
  toolCalls?: ToolCall[];
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Result of tool invocation
 */
export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
  metadata?: Record<string, unknown>;
}

/**
 * Memory query result
 */
export interface MemoryResult {
  id: string;
  content: unknown;
  score: number;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Recovery action to take after error
 */
export interface RecoveryAction {
  type: RecoveryActionType;
  parameters?: Record<string, unknown>;
  reason: string;
}

export type RecoveryActionType =
  | 'retry'
  | 'skip'
  | 'abort'
  | 'fallback'
  | 'escalate'
  | 'compensate'
  | 'checkpoint';

/**
 * Retry decision
 */
export interface RetryDecision {
  shouldRetry: boolean;
  delay?: number;
  strategy?: RetryStrategy;
  modifiedInput?: unknown;
}

export type RetryStrategy =
  | 'immediate'
  | 'linear_backoff'
  | 'exponential_backoff'
  | 'jitter';

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Model request
 */
export interface ModelRequest {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ToolChoice = 'auto' | 'none' | { type: 'function'; function: { name: string } };

/**
 * Tool invocation request
 */
export interface ToolInvocation {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  context: ToolContext;
}

/**
 * Memory query
 */
export interface MemoryQuery {
  type: MemoryType;
  query: string;
  filters?: MemoryFilter[];
  limit?: number;
  minScore?: number;
}

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

export interface MemoryFilter {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
  value: unknown;
}

/**
 * Memory item to store
 */
export interface MemoryItem {
  id: string;
  type: MemoryType;
  content: unknown;
  embedding?: number[];
  metadata: Record<string, unknown>;
  timestamp: Date;
  ttl?: number;
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface ToolInfo {
  name: string;
  type: string;
  enabled: boolean;
  invocationCount: number;
}

export interface MemoryInfo {
  types: MemoryType[];
  totalItems: number;
  lastAccessed?: Date;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  lastError: Error;
  totalDelay: number;
  history: RetryAttempt[];
}

export interface RetryAttempt {
  attempt: number;
  timestamp: Date;
  error: Error;
  action: RecoveryAction;
}

// ============================================================================
// AGENT LIFECYCLE HOOKS
// ============================================================================

/**
 * Hooks for agent invocation lifecycle
 */
export interface AgentInvocationHooks {
  /**
   * Called before agent begins processing.
   * Use for: Context augmentation, input validation, budget checks
   * Return modified context or void to continue unchanged
   */
  beforeAgentInvocation: (context: AgentContext) => Promise<AgentContext | void>;

  /**
   * Called after agent completes (success or failure).
   * Use for: Logging, metrics, cleanup, evidence collection
   */
  afterAgentInvocation: (context: AgentContext, result: AgentResult) => Promise<void>;

  /**
   * Wraps entire agent execution.
   * Use for: Error boundaries, timing, resource management
   */
  aroundAgentInvocation: (
    context: AgentContext,
    proceed: () => Promise<AgentResult>
  ) => Promise<AgentResult>;
}

/**
 * Hooks for model (LLM) interactions
 */
export interface ModelHooks {
  /**
   * Called before sending request to LLM.
   * Use for: Prompt modification, context injection, filtering
   */
  beforeModelCall: (request: ModelRequest, context: ModelContext) => Promise<ModelRequest | void>;

  /**
   * Called after receiving LLM response.
   * Use for: Output validation, content filtering, transformation
   */
  afterModelCall: (
    request: ModelRequest,
    response: ModelResponse,
    context: ModelContext
  ) => Promise<ModelResponse | void>;

  /**
   * Called on model errors.
   * Use for: Retry logic, fallback models, error reporting
   */
  onModelError: (
    request: ModelRequest,
    error: Error,
    context: ModelContext
  ) => Promise<ModelResponse | void>;
}

/**
 * Hooks for tool invocations
 */
export interface ToolHooks {
  /**
   * Called before tool execution.
   * Use for: Parameter validation, permission checks, sandboxing
   */
  beforeToolCall: (invocation: ToolInvocation) => Promise<ToolInvocation | void>;

  /**
   * Called after tool execution.
   * Use for: Result validation, transformation, evidence logging
   */
  afterToolCall: (
    invocation: ToolInvocation,
    result: ToolResult
  ) => Promise<ToolResult | void>;

  /**
   * Called on tool errors.
   * Use for: Error recovery, alternative tools, graceful degradation
   */
  onToolError: (
    invocation: ToolInvocation,
    error: Error
  ) => Promise<ToolResult | void>;

  /**
   * Called to select which tool to use.
   * Use for: Tool routing, load balancing, capability matching
   */
  onToolSelection: (
    available: ToolInfo[],
    request: ToolSelectionRequest
  ) => Promise<ToolInfo | void>;
}

export interface ToolSelectionRequest {
  taskType: string;
  requirements: string[];
  preferences?: Record<string, unknown>;
}

/**
 * Hooks for memory access
 */
export interface MemoryHooks {
  /**
   * Called before memory retrieval.
   * Use for: Query augmentation, access control, context filtering
   */
  beforeMemoryRetrieval: (query: MemoryQuery, context: MemoryContext) => Promise<MemoryQuery | void>;

  /**
   * Called after memory retrieval.
   * Use for: Result filtering, relevance scoring, freshness checks
   */
  afterMemoryRetrieval: (
    query: MemoryQuery,
    results: MemoryResult[],
    context: MemoryContext
  ) => Promise<MemoryResult[] | void>;

  /**
   * Called before memory storage.
   * Use for: Validation, deduplication, categorization
   */
  beforeMemoryStorage: (item: MemoryItem, context: MemoryContext) => Promise<MemoryItem | void>;

  /**
   * Called on memory consistency checks.
   * Use for: Conflict detection, merge strategies
   */
  onMemoryConflict: (
    existing: MemoryItem,
    incoming: MemoryItem,
    context: MemoryContext
  ) => Promise<MemoryItem>;
}

/**
 * Hooks for state transitions
 */
export interface StateTransitionHooks {
  /**
   * Called before state transition.
   * Use for: Validation, precondition checks, logging
   * Return false to prevent transition
   */
  beforeStateTransition: (
    from: AgentState,
    to: AgentState,
    trigger: string,
    context: AgentContext
  ) => Promise<boolean>;

  /**
   * Called after state transition.
   * Use for: Side effects, notifications, metric updates
   */
  afterStateTransition: (
    from: AgentState,
    to: AgentState,
    trigger: string,
    context: AgentContext
  ) => Promise<void>;

  /**
   * Called on invalid transition attempt.
   * Use for: Error handling, recovery suggestions
   */
  onInvalidTransition: (
    from: AgentState,
    attemptedTo: AgentState,
    reason: string,
    context: AgentContext
  ) => Promise<void>;
}

/**
 * Hooks for error recovery
 */
export interface ErrorRecoveryHooks {
  /**
   * Called on any error during agent execution.
   * Use for: Classification, logging, recovery strategy selection
   */
  onError: (error: Error, context: ErrorContext) => Promise<RecoveryAction>;

  /**
   * Called before retry attempt.
   * Use for: Strategy modification, backoff calculation
   */
  beforeRetry: (
    context: RetryContext
  ) => Promise<RetryDecision>;

  /**
   * Called when recovery fails and agent must halt.
   * Use for: Cleanup, state preservation, notification
   */
  onUnrecoverableError: (
    errors: Error[],
    context: ErrorContext
  ) => Promise<void>;
}

// ============================================================================
// WORK PROCESS HOOKS
// ============================================================================

/**
 * Task creation hooks
 */
export interface TaskCreationHooks {
  /**
   * Called before task creation.
   * Use for: Validation, template application, defaults
   */
  beforeTaskCreate: (input: TaskCreateInput) => Promise<TaskCreateInput | void>;

  /**
   * Called after task creation.
   * Use for: Notifications, dependency setup, scheduling
   */
  afterTaskCreate: (task: TaskInfo) => Promise<void>;

  /**
   * Called to decompose a task into subtasks.
   * Use for: Hierarchical decomposition, template expansion
   */
  onTaskDecompose: (
    task: TaskInfo,
    options: TaskDecomposeOptions
  ) => Promise<TaskInfo[]>;
}

export interface TaskCreateInput {
  type: string;
  title: string;
  description?: string;
  parentId?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskInfo {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: TaskStatus;
  parentId?: string;
  childIds: string[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskDecomposeOptions {
  strategy: 'template' | 'llm' | 'rules';
  maxDepth?: number;
  templateId?: string;
}

/**
 * Task execution hooks
 */
export interface TaskExecutionHooks {
  /**
   * Called when task starts execution.
   * Use for: Resource allocation, context setup
   */
  onTaskStart: (task: TaskInfo) => Promise<void>;

  /**
   * Called periodically during task execution.
   * Use for: Progress tracking, health checks, budget monitoring
   */
  onTaskProgress: (
    task: TaskInfo,
    progress: TaskProgress
  ) => Promise<ProgressAction>;

  /**
   * Called when task pauses or yields.
   * Use for: State checkpointing, resource release
   */
  onTaskPause: (task: TaskInfo, reason: string) => Promise<void>;

  /**
   * Called when task resumes.
   * Use for: State restoration, context rebuild
   */
  onTaskResume: (task: TaskInfo) => Promise<void>;
}

export interface TaskProgress {
  percentComplete: number;
  currentStep?: string;
  stepsCompleted: number;
  totalSteps: number;
  duration: number;
  resourcesUsed: ResourceUsage;
}

export interface ResourceUsage {
  tokens: number;
  toolCalls: number;
  memoryAccesses: number;
  apiCalls: number;
}

export type ProgressAction =
  | { type: 'continue' }
  | { type: 'pause'; reason: string }
  | { type: 'abort'; reason: string }
  | { type: 'checkpoint' }
  | { type: 'adjust_priority'; newPriority: number };

/**
 * Task completion hooks
 */
export interface TaskCompletionHooks {
  /**
   * Called when task completes successfully.
   * Use for: Artifact collection, metric update, promotion
   */
  onTaskComplete: (task: TaskInfo, result: TaskResult) => Promise<void>;

  /**
   * Called when task fails.
   * Use for: Error analysis, retry decision, escalation
   */
  onTaskFail: (task: TaskInfo, error: TaskError) => Promise<FailureAction>;

  /**
   * Called when task is cancelled.
   * Use for: Cleanup, compensation, notification
   */
  onTaskCancel: (task: TaskInfo, reason: string) => Promise<void>;

  /**
   * Called for post-completion verification.
   * Use for: Acceptance criteria validation, quality gates
   */
  onTaskVerify: (
    task: TaskInfo,
    result: TaskResult
  ) => Promise<VerificationResult>;
}

export interface TaskResult {
  output: unknown;
  artifacts: Artifact[];
  evidence: HookEvidence[];
  metrics: TaskMetrics;
}

export interface Artifact {
  id: string;
  type: string;
  name: string;
  path?: string;
  content?: unknown;
  metadata: Record<string, unknown>;
}

export interface TaskMetrics {
  duration: number;
  tokensUsed: number;
  toolCalls: number;
  retries: number;
  subtasksCompleted: number;
}

export interface TaskError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
  suggestedActions: RecoveryAction[];
}

export type FailureAction =
  | { type: 'retry'; delay?: number }
  | { type: 'skip' }
  | { type: 'escalate'; to: string }
  | { type: 'compensate'; actions: CompensationAction[] }
  | { type: 'abort' };

export interface CompensationAction {
  type: string;
  target: string;
  parameters: Record<string, unknown>;
}

export interface VerificationResult {
  passed: boolean;
  criteria: CriterionResult[];
  confidence: number;
  recommendations?: string[];
}

export interface CriterionResult {
  id: string;
  name: string;
  passed: boolean;
  evidence?: unknown;
  reason?: string;
}

/**
 * Priority management hooks
 */
export interface PriorityHooks {
  /**
   * Called when priority is computed.
   * Use for: Custom factor injection, override logic
   */
  onPriorityCompute: (
    task: TaskInfo,
    factors: PriorityFactorValue[]
  ) => Promise<PriorityAdjustment[]>;

  /**
   * Called when priority changes.
   * Use for: Reordering, notification, impact analysis
   */
  onPriorityChange: (
    task: TaskInfo,
    oldPriority: number,
    newPriority: number
  ) => Promise<void>;

  /**
   * Called to determine if task should be escalated.
   * Use for: SLA enforcement, deadline management
   */
  onPriorityEscalation: (task: TaskInfo) => Promise<EscalationDecision>;
}

export interface PriorityFactorValue {
  name: string;
  value: number;
  weight: number;
  explanation: string;
}

export interface PriorityAdjustment {
  factor: string;
  adjustment: number;
  reason: string;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  level?: number;
  reason?: string;
  notifyUsers?: string[];
}

/**
 * Dependency management hooks
 */
export interface DependencyHooks {
  /**
   * Called when dependency is added.
   * Use for: Cycle detection, impact analysis
   * Return false to reject the dependency
   */
  onDependencyAdd: (
    task: TaskInfo,
    dependency: TaskDependency
  ) => Promise<boolean>;

  /**
   * Called when dependency is resolved.
   * Use for: Unblocking, notification, scheduling
   */
  onDependencyResolve: (
    task: TaskInfo,
    dependency: TaskDependency
  ) => Promise<void>;

  /**
   * Called when dependency fails.
   * Use for: Cascade handling, alternative paths
   */
  onDependencyFail: (
    task: TaskInfo,
    dependency: TaskDependency,
    error: Error
  ) => Promise<DependencyFailureAction>;
}

export interface TaskDependency {
  taskId: string;
  dependsOnId: string;
  type: DependencyType;
  required: boolean;
}

export type DependencyType =
  | 'blocks'         // Must complete before
  | 'requires'       // Needs output from
  | 'suggests'       // Recommended before
  | 'related'        // Related work

export type DependencyFailureAction =
  | { type: 'fail_dependent' }
  | { type: 'skip_dependency' }
  | { type: 'find_alternative'; criteria: string }
  | { type: 'wait_for_retry' };

// ============================================================================
// VALIDATION GATE HOOKS
// ============================================================================

/**
 * Gate level (Wave0 model)
 */
export type GateLevel = 0 | 1 | 2 | 3;

/**
 * Gate capability
 */
export type GateCapability =
  | 'read'
  | 'analyze'
  | 'report'
  | 'propose'
  | 'sandbox_write'
  | 'merge';

/**
 * Gate definition
 */
export interface Gate {
  level: GateLevel;
  name: string;
  description: string;
  capabilities: GateCapability[];
  requirements: GateRequirement[];
  hooks: GateHooks;
}

export interface GateRequirement {
  type: string;
  description: string;
  validator: (context: GateContext) => Promise<boolean>;
}

/**
 * Gate context
 */
export interface GateContext extends HookContext {
  gate: Gate;
  action: GateAction;
  evidence: HookEvidence[];
  previousGateResults?: GateResult[];
}

export interface GateAction {
  type: 'read' | 'write' | 'propose' | 'merge';
  target: string;
  parameters: Record<string, unknown>;
}

export interface GateResult {
  gate: GateLevel;
  passed: boolean;
  reason?: string;
  evidence: HookEvidence[];
  timestamp: Date;
}

/**
 * Gate hooks
 */
export interface GateHooks {
  /**
   * Called before any action through the gate.
   * Use for: Permission checks, capability validation
   */
  beforeAction?: (action: GateAction, context: GateContext) => Promise<void>;

  /**
   * Called after action completes.
   * Use for: Logging, evidence collection, promotion checks
   */
  afterAction?: (action: GateAction, result: ActionResult, context: GateContext) => Promise<void>;

  /**
   * Called when a proposal is made (Gate 1+).
   * Use for: Human notification, approval routing
   */
  onProposal?: (proposal: Proposal, context: GateContext) => Promise<ProposalDecision>;

  /**
   * Called before merge (Gate 3).
   * Use for: Final validation, evidence completeness check
   */
  beforeMerge?: (pr: PullRequestInfo, evidence: HookEvidence[], context: GateContext) => Promise<void>;

  /**
   * Called when gate violation is attempted.
   * Use for: Logging, alerting, graceful degradation
   */
  onViolation?: (violation: GateViolation, context: GateContext) => Promise<ViolationResponse>;
}

export interface ActionResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  evidence: HookEvidence[];
}

export interface Proposal {
  id: string;
  type: string;
  title: string;
  description: string;
  changes: ProposedChange[];
  evidence: HookEvidence[];
  confidence: number;
}

export interface ProposedChange {
  type: 'create' | 'modify' | 'delete';
  path: string;
  before?: unknown;
  after?: unknown;
  reason: string;
}

export type ProposalDecision =
  | { type: 'approve' }
  | { type: 'reject'; reason: string }
  | { type: 'request_changes'; feedback: string[] }
  | { type: 'defer'; until: Date }
  | { type: 'escalate'; to: string };

export interface PullRequestInfo {
  id: string;
  title: string;
  description: string;
  branch: string;
  baseBranch: string;
  commits: CommitInfo[];
  changedFiles: string[];
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  timestamp: Date;
}

export interface GateViolation {
  gate: GateLevel;
  action: GateAction;
  reason: string;
  attemptedCapability: GateCapability;
}

export type ViolationResponse =
  | { type: 'deny' }
  | { type: 'downgrade'; toGate: GateLevel }
  | { type: 'request_approval'; from: string }
  | { type: 'log_and_continue' };

// ============================================================================
// STANDARD GATES
// ============================================================================

/**
 * Standard gate definitions following Wave0 model
 */
export const STANDARD_GATES: Gate[] = [
  {
    level: 0,
    name: 'read-only',
    description: 'Analysis only, no modifications',
    capabilities: ['read', 'analyze', 'report'],
    requirements: [],
    hooks: {},
  },
  {
    level: 1,
    name: 'propose-only',
    description: 'Generate proposals, humans apply',
    capabilities: ['read', 'analyze', 'report', 'propose'],
    requirements: [
      {
        type: 'human_review',
        description: 'All changes require human review',
        validator: async () => true, // Always requires review
      },
    ],
    hooks: {},
  },
  {
    level: 2,
    name: 'sandbox-write',
    description: 'Write to isolated PR branch',
    capabilities: ['read', 'analyze', 'report', 'propose', 'sandbox_write'],
    requirements: [
      {
        type: 'ci_pass',
        description: 'CI must pass before human review',
        validator: async (ctx) => {
          const evidence = ctx.evidence.find(e => e.type === 'validation_result');
          return evidence?.data === true;
        },
      },
      {
        type: 'human_review_for_merge',
        description: 'Human must approve merge',
        validator: async () => true,
      },
    ],
    hooks: {},
  },
  {
    level: 3,
    name: 'limited-autonomous',
    description: 'Merge with evidence gates',
    capabilities: ['read', 'analyze', 'report', 'propose', 'sandbox_write', 'merge'],
    requirements: [
      {
        type: 'ci_pass',
        description: 'CI must pass',
        validator: async (ctx) => {
          const evidence = ctx.evidence.find(e => e.type === 'validation_result');
          return evidence?.data === true;
        },
      },
      {
        type: 'evidence_complete',
        description: 'All required evidence must be present',
        validator: async (ctx) => ctx.evidence.length >= 3,
      },
      {
        type: 'confidence_threshold',
        description: 'Confidence must be above 0.9',
        validator: async () => true, // Implement confidence check
      },
    ],
    hooks: {},
  },
];

// ============================================================================
// APPROVAL WORKFLOW HOOKS
// ============================================================================

/**
 * Approval workflow definition
 */
export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string;
  stages: ApprovalStage[];
  escalationPolicy: EscalationPolicy;
}

export interface ApprovalStage {
  name: string;
  approvers: ApproverConfig;
  requirements: ApprovalRequirement[];
  timeout: number; // ms
  hooks: ApprovalHooks;
}

export interface ApproverConfig {
  type: 'user' | 'role' | 'team' | 'automated';
  identifiers: string[];
  minApprovals: number;
}

export interface ApprovalRequirement {
  type: string;
  description: string;
  validator: (context: ApprovalContext) => Promise<boolean>;
}

export interface EscalationPolicy {
  enabled: boolean;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  afterMs: number;
  notifyRoles: string[];
  autoApprove?: boolean;
}

/**
 * Approval hooks
 */
export interface ApprovalHooks {
  /**
   * Called when approval is requested.
   * Use for: Notification, context preparation
   */
  onApprovalRequest: (request: ApprovalRequest) => Promise<void>;

  /**
   * Called when approval is granted.
   * Use for: Logging, next stage trigger
   */
  onApprovalGranted: (approval: Approval) => Promise<void>;

  /**
   * Called when approval is denied.
   * Use for: Feedback handling, retry logic
   */
  onApprovalDenied: (denial: Denial) => Promise<DenialAction>;

  /**
   * Called when approval times out.
   * Use for: Escalation, auto-approval
   */
  onTimeout: (request: ApprovalRequest) => Promise<TimeoutAction>;
}

export interface ApprovalContext extends HookContext {
  workflow: ApprovalWorkflow;
  currentStage: ApprovalStage;
  request: ApprovalRequest;
  previousApprovals: Approval[];
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  stageName: string;
  requestedBy: string;
  requestedAt: Date;
  subject: string;
  details: unknown;
  evidence: HookEvidence[];
}

export interface Approval {
  requestId: string;
  approvedBy: string;
  approvedAt: Date;
  comments?: string;
}

export interface Denial {
  requestId: string;
  deniedBy: string;
  deniedAt: Date;
  reason: string;
  feedback?: string[];
}

export type DenialAction =
  | { type: 'retry'; afterFeedback: boolean }
  | { type: 'escalate'; to: string }
  | { type: 'abort' };

export type TimeoutAction =
  | { type: 'escalate' }
  | { type: 'auto_approve' }
  | { type: 'auto_deny' }
  | { type: 'extend'; byMs: number };

// ============================================================================
// HOOK REGISTRY INTERFACE
// ============================================================================

/**
 * All hook types combined
 */
export interface AllHooks
  extends AgentInvocationHooks,
    ModelHooks,
    ToolHooks,
    MemoryHooks,
    StateTransitionHooks,
    ErrorRecoveryHooks,
    TaskCreationHooks,
    TaskExecutionHooks,
    TaskCompletionHooks,
    PriorityHooks,
    DependencyHooks,
    GateHooks,
    ApprovalHooks {}

/**
 * Registry for managing hooks
 */
export interface HookRegistry {
  /**
   * Register a hook at a specific point.
   * Hooks are executed in priority order (lower = earlier).
   */
  register<T extends keyof AllHooks>(
    point: T,
    hook: AllHooks[T],
    options?: HookOptions
  ): HookHandle;

  /**
   * Unregister a previously registered hook.
   */
  unregister(handle: HookHandle): void;

  /**
   * Get all hooks registered at a point.
   */
  getHooks<T extends keyof AllHooks>(point: T): Array<{
    hook: AllHooks[T];
    options: HookOptions;
    handle: HookHandle;
  }>;

  /**
   * Compose multiple hooks into a single hook.
   * Execution order: first in array = first executed
   */
  compose<T extends keyof AllHooks>(
    point: T,
    hooks: AllHooks[T][]
  ): AllHooks[T];

  /**
   * Execute all hooks at a point with given arguments.
   * Note: Only call for hook points that are defined (non-optional).
   */
  execute<T extends keyof AllHooks>(
    point: T,
    ...args: unknown[]
  ): Promise<unknown>;

  /**
   * Clear all hooks (useful for testing).
   */
  clear(): void;
}

// ============================================================================
// HOOK EXECUTION UTILITIES
// ============================================================================

/**
 * Result of executing multiple hooks
 */
export interface HookExecutionResult<T> {
  success: boolean;
  result?: T;
  errors: HookExecutionError[];
  duration: number;
  hooksExecuted: number;
}

export interface HookExecutionError {
  hookId: string;
  point: string;
  error: Error;
  swallowed: boolean;
}

/**
 * Options for hook execution
 */
export interface HookExecutionOptions {
  /** Stop on first error */
  stopOnError?: boolean;

  /** Timeout for entire execution */
  timeout?: number;

  /** Context to pass to hooks */
  context?: HookContext;

  /** Whether to collect evidence */
  collectEvidence?: boolean;
}
