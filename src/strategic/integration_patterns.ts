/**
 * @fileoverview Integration Patterns for Agentic Systems
 *
 * This module defines patterns for integrating agents with external systems:
 *
 * 1. **Model Context Protocol (MCP)** - De facto standard for agent-tool integration
 * 2. **Git Integration** - Version control workflows and hooks
 * 3. **CI/CD Integration** - Pipeline hooks and automation
 * 4. **Event-Driven Architecture** - Async agent communication
 * 5. **IDE Integration** - Editor and LSP patterns
 * 6. **API Gateway** - Request routing and authorization
 *
 * Design Philosophy:
 * - Standard protocols over custom solutions
 * - Evidence collection at every integration point
 * - Graceful degradation on failures
 * - Observable by default
 *
 * @packageDocumentation
 */

import type { Provenance } from './types.js';
import type { HookEvidence, HookContext } from './hooks.js';

// ============================================================================
// MODEL CONTEXT PROTOCOL (MCP)
// ============================================================================

/**
 * MCP Server configuration
 * Based on MCP Specification 2025-11-25
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;

  /** Server version */
  version: string;

  /** Transport configuration */
  transport: MCPTransportConfig;

  /** Capabilities offered by this server */
  capabilities: MCPCapabilities;

  /** Security configuration */
  security: MCPSecurityConfig;

  /** Initialization options */
  initOptions?: Record<string, unknown>;
}

export type MCPTransportConfig =
  | { type: 'stdio' }
  | { type: 'http'; port: number; host?: string }
  | { type: 'websocket'; url: string }
  | { type: 'sse'; url: string };

export interface MCPCapabilities {
  /** Available tools */
  tools?: MCPToolCapability[];

  /** Available resources */
  resources?: MCPResourceCapability[];

  /** Available prompts */
  prompts?: MCPPromptCapability[];

  /** Sampling support */
  sampling?: MCPSamplingCapability;

  /** Logging support */
  logging?: MCPLoggingCapability;
}

export interface MCPToolCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface MCPResourceCapability {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPromptCapability {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPSamplingCapability {
  maxTokens?: number;
  supportedModels?: string[];
}

export interface MCPLoggingCapability {
  levels: ('debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency')[];
}

export interface MCPSecurityConfig {
  /** Authentication configuration */
  auth?: MCPAuthConfig;

  /** Allowed operations (allowlist) */
  allowlist?: string[];

  /** Rate limiting */
  rateLimit?: MCPRateLimitConfig;

  /** Audit logging */
  auditEnabled: boolean;

  /** Sandbox mode */
  sandboxed: boolean;
}

export type MCPAuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; tokenValidator: string }
  | { type: 'api_key'; keyHeader: string }
  | { type: 'oauth2'; clientId: string; authUrl: string; tokenUrl: string };

export interface MCPRateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
}

/**
 * MCP Client configuration
 */
export interface MCPClientConfig {
  /** Servers to connect to */
  servers: MCPServerConnection[];

  /** Default timeout for requests */
  timeout: number;

  /** Retry configuration */
  retry: MCPRetryConfig;

  /** Capability discovery */
  discoverCapabilities: boolean;
}

export interface MCPServerConnection {
  name: string;
  transport: MCPTransportConfig;
  auth?: MCPAuthConfig;
  enabled: boolean;
}

export interface MCPRetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * MCP Tool invocation
 */
export interface MCPToolRequest {
  name: string;
  arguments: Record<string, unknown>;
  timeout?: number;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

export type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; uri: string; text?: string; blob?: string; mimeType?: string };

/**
 * MCP Resource access
 */
export interface MCPResourceRequest {
  uri: string;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  contents: MCPContent[];
}

/**
 * MCP Integration hooks
 */
export interface MCPHooks {
  /** Called before tool invocation */
  beforeToolInvoke?: (request: MCPToolRequest) => Promise<MCPToolRequest | void>;

  /** Called after tool invocation */
  afterToolInvoke?: (request: MCPToolRequest, result: MCPToolResult) => Promise<void>;

  /** Called on tool error */
  onToolError?: (request: MCPToolRequest, error: Error) => Promise<MCPToolResult | void>;

  /** Called before resource access */
  beforeResourceAccess?: (request: MCPResourceRequest) => Promise<MCPResourceRequest | void>;

  /** Called on connection state change */
  onConnectionChange?: (serverName: string, connected: boolean) => Promise<void>;
}

// ============================================================================
// GIT INTEGRATION
// ============================================================================

/**
 * Git integration configuration
 */
export interface GitIntegrationConfig {
  /** Repository root path */
  repoPath: string;

  /** Branch strategy */
  branchStrategy: BranchStrategy;

  /** Commit configuration */
  commitConfig: CommitConfig;

  /** PR configuration */
  prConfig: PRConfig;

  /** Hooks configuration */
  hooks: GitHooksConfig;
}

export interface BranchStrategy {
  /** Main branch name */
  mainBranch: string;

  /** Development branch name */
  developBranch?: string;

  /** Branch naming pattern for agent work */
  agentBranchPattern: string;

  /** Use worktrees for isolation */
  useWorktrees: boolean;

  /** Auto-cleanup merged branches */
  autoCleanup: boolean;
}

export interface CommitConfig {
  /** Commit message format */
  messageFormat: CommitMessageFormat;

  /** Sign commits */
  signCommits: boolean;

  /** Include evidence in commit */
  includeEvidence: boolean;

  /** Co-author for agent commits */
  coAuthor?: string;
}

export type CommitMessageFormat = 'conventional' | 'semantic' | 'custom';

export interface PRConfig {
  /** PR title template */
  titleTemplate: string;

  /** PR body template */
  bodyTemplate: string;

  /** Auto-assign reviewers */
  autoAssignReviewers: boolean;

  /** Required reviewers */
  requiredReviewers?: string[];

  /** Labels to apply */
  labels?: string[];

  /** Draft by default */
  draftByDefault: boolean;
}

export interface GitHooksConfig {
  /** Pre-commit hooks */
  preCommit: GitHookConfig[];

  /** Post-commit hooks */
  postCommit: GitHookConfig[];

  /** Pre-push hooks */
  prePush: GitHookConfig[];

  /** Post-merge hooks */
  postMerge: GitHookConfig[];
}

export interface GitHookConfig {
  name: string;
  enabled: boolean;
  command?: string;
  script?: string;
  timeout: number;
  continueOnFailure: boolean;
}

/**
 * Git operation types
 */
export type GitOperationType =
  | 'clone'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'commit'
  | 'branch'
  | 'checkout'
  | 'merge'
  | 'rebase'
  | 'reset'
  | 'stash'
  | 'tag';

/**
 * Git operation result
 */
export interface GitOperationResult {
  operation: GitOperationType;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  affectedFiles?: string[];
  commit?: GitCommitInfo;
}

export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: Date;
  parents: string[];
}

/**
 * Git integration hooks
 */
export interface GitIntegrationHooks {
  /** Before any git operation */
  beforeOperation?: (operation: GitOperationType, args: Record<string, unknown>) => Promise<boolean>;

  /** After any git operation */
  afterOperation?: (result: GitOperationResult) => Promise<void>;

  /** Before commit */
  beforeCommit?: (message: string, files: string[]) => Promise<{ message: string; files: string[] } | void>;

  /** After commit */
  afterCommit?: (commit: GitCommitInfo) => Promise<void>;

  /** Before PR creation */
  beforePRCreate?: (config: PRCreateConfig) => Promise<PRCreateConfig | void>;

  /** After PR creation */
  afterPRCreate?: (pr: PullRequestInfo) => Promise<void>;

  /** On merge conflict */
  onMergeConflict?: (conflictingFiles: string[]) => Promise<ConflictResolution>;
}

export interface PRCreateConfig {
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  draft: boolean;
  labels?: string[];
  reviewers?: string[];
}

export interface PullRequestInfo {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  baseBranch: string;
  headBranch: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  labels: string[];
  reviewers: string[];
}

export type ConflictResolution =
  | { type: 'abort' }
  | { type: 'ours' }
  | { type: 'theirs' }
  | { type: 'manual'; instructions: string }
  | { type: 'auto_resolve'; strategy: string };

/**
 * Worktree management
 */
export interface WorktreeConfig {
  /** Base path for worktrees */
  basePath: string;

  /** Naming pattern */
  namePattern: string;

  /** Auto-cleanup after completion */
  autoCleanup: boolean;

  /** Max concurrent worktrees */
  maxConcurrent: number;
}

export interface Worktree {
  path: string;
  branch: string;
  commit: string;
  taskId?: string;
  createdAt: Date;
}

// ============================================================================
// CI/CD INTEGRATION
// ============================================================================

/**
 * CI/CD integration configuration
 */
export interface CICDIntegrationConfig {
  /** CI/CD provider */
  provider: CICDProvider;

  /** Pipeline configuration */
  pipeline: PipelineConfig;

  /** Trigger configuration */
  triggers: TriggerConfig;

  /** Self-correction configuration */
  selfCorrection: SelfCorrectionConfig;
}

export type CICDProvider =
  | 'github_actions'
  | 'gitlab_ci'
  | 'jenkins'
  | 'circleci'
  | 'azure_devops'
  | 'custom';

export interface PipelineConfig {
  /** Pipeline file path */
  configPath: string;

  /** Default timeout per stage */
  stageTimeout: number;

  /** Parallel execution */
  parallelExecution: boolean;

  /** Artifact retention */
  artifactRetention: number;
}

export interface TriggerConfig {
  /** Trigger on push */
  onPush: PushTrigger;

  /** Trigger on PR */
  onPullRequest: PRTrigger;

  /** Scheduled triggers */
  scheduled?: ScheduledTrigger[];

  /** Manual triggers */
  manual: boolean;
}

export interface PushTrigger {
  enabled: boolean;
  branches: string[];
  paths?: string[];
  ignorePaths?: string[];
}

export interface PRTrigger {
  enabled: boolean;
  types: ('opened' | 'synchronize' | 'reopened' | 'closed')[];
  baseBranches?: string[];
}

export interface ScheduledTrigger {
  cron: string;
  timezone?: string;
  branches: string[];
}

export interface SelfCorrectionConfig {
  enabled: boolean;
  maxAttempts: number;
  allowedFixes: SelfCorrectionType[];
  requireApproval: boolean;
  timeout: number;
}

export type SelfCorrectionType =
  | 'lint_fix'
  | 'format_fix'
  | 'type_fix'
  | 'test_fix'
  | 'dependency_update'
  | 'config_fix';

/**
 * Pipeline stage types
 */
export type PipelineStage =
  | 'checkout'
  | 'install'
  | 'lint'
  | 'typecheck'
  | 'test'
  | 'build'
  | 'security_scan'
  | 'deploy_staging'
  | 'deploy_production'
  | 'cleanup';

/**
 * Pipeline run result
 */
export interface PipelineRunResult {
  id: string;
  status: PipelineStatus;
  stages: StageResult[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  triggeredBy: string;
  commit: string;
  branch: string;
  artifacts?: ArtifactInfo[];
}

export type PipelineStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped';

export interface StageResult {
  stage: PipelineStage;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  logs?: string;
  error?: string;
  artifacts?: ArtifactInfo[];
}

export interface ArtifactInfo {
  name: string;
  path: string;
  size: number;
  type: string;
  url?: string;
}

/**
 * CI/CD integration hooks
 */
export interface CICDHooks {
  /** Before pipeline run */
  beforePipelineRun?: (config: PipelineRunConfig) => Promise<PipelineRunConfig | void>;

  /** After pipeline run */
  afterPipelineRun?: (result: PipelineRunResult) => Promise<void>;

  /** Before stage */
  beforeStage?: (stage: PipelineStage, context: StageContext) => Promise<void>;

  /** After stage */
  afterStage?: (stage: PipelineStage, result: StageResult) => Promise<void>;

  /** On stage failure */
  onStageFailure?: (stage: PipelineStage, error: Error) => Promise<StageFailureAction>;

  /** On pipeline failure */
  onPipelineFailure?: (result: PipelineRunResult) => Promise<PipelineFailureAction>;
}

export interface PipelineRunConfig {
  branch: string;
  commit: string;
  stages: PipelineStage[];
  environment?: Record<string, string>;
}

export interface StageContext {
  pipelineId: string;
  stage: PipelineStage;
  previousResults: StageResult[];
  environment: Record<string, string>;
}

export type StageFailureAction =
  | { type: 'retry'; maxRetries: number }
  | { type: 'skip' }
  | { type: 'abort' }
  | { type: 'self_correct'; correctionType: SelfCorrectionType };

export type PipelineFailureAction =
  | { type: 'notify'; channels: string[] }
  | { type: 'rollback' }
  | { type: 'self_correct' }
  | { type: 'escalate'; to: string };

// ============================================================================
// EVENT-DRIVEN ARCHITECTURE
// ============================================================================

/**
 * Event-driven architecture configuration
 */
export interface EventDrivenConfig {
  /** Event bus configuration */
  bus: EventBusConfig;

  /** Event schema registry */
  schemaRegistry?: SchemaRegistryConfig;

  /** Dead letter queue */
  deadLetterQueue: DeadLetterConfig;

  /** Observability */
  observability: EventObservabilityConfig;
}

export interface EventBusConfig {
  /** Bus type */
  type: 'memory' | 'redis' | 'kafka' | 'rabbitmq' | 'sqs' | 'pubsub';

  /** Connection configuration */
  connection?: Record<string, unknown>;

  /** Default TTL for events */
  defaultTTL: number;

  /** Retry configuration */
  retry: EventRetryConfig;
}

export interface EventRetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoff: 'linear' | 'exponential';
}

export interface SchemaRegistryConfig {
  enabled: boolean;
  url?: string;
  validateOnPublish: boolean;
  validateOnConsume: boolean;
}

export interface DeadLetterConfig {
  enabled: boolean;
  maxSize: number;
  retentionPeriod: number;
  alertThreshold: number;
}

export interface EventObservabilityConfig {
  tracing: boolean;
  metrics: boolean;
  logging: boolean;
  samplingRate: number;
}

/**
 * Agent event definition
 */
export interface AgentEvent {
  /** Unique event ID */
  id: string;

  /** Event type */
  type: AgentEventType;

  /** Event timestamp */
  timestamp: Date;

  /** Source agent ID */
  source: string;

  /** Event payload */
  payload: unknown;

  /** Correlation ID for tracking related events */
  correlationId?: string;

  /** Causation ID (ID of event that caused this one) */
  causationId?: string;

  /** Event metadata */
  metadata?: Record<string, unknown>;

  /** Schema version */
  schemaVersion?: string;
}

export type AgentEventType =
  // Task events
  | 'task.created'
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  // Tool events
  | 'tool.invoked'
  | 'tool.succeeded'
  | 'tool.failed'
  // Agent events
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.state_changed'
  | 'agent.error'
  // Evidence events
  | 'evidence.collected'
  | 'evidence.verified'
  // Decision events
  | 'decision.made'
  | 'decision.approved'
  | 'decision.rejected'
  // Approval events
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  // Integration events
  | 'git.commit'
  | 'git.push'
  | 'git.pr_created'
  | 'git.pr_merged'
  | 'ci.started'
  | 'ci.completed'
  | 'ci.failed'
  // Custom events
  | `custom.${string}`;

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  pattern: EventPattern;
  handler: EventHandler;
  options: SubscriptionOptions;
}

export type EventPattern =
  | string                    // Exact match
  | { prefix: string }        // Prefix match
  | { regex: string }         // Regex match
  | { types: AgentEventType[] }; // Multiple types

export type EventHandler = (event: AgentEvent) => Promise<void>;

export interface SubscriptionOptions {
  /** Filter events */
  filter?: EventFilter;

  /** Batch events */
  batch?: BatchConfig;

  /** Concurrency limit */
  concurrency?: number;

  /** Timeout per event */
  timeout?: number;

  /** Error handling */
  onError?: 'retry' | 'dlq' | 'ignore';
}

export interface EventFilter {
  sources?: string[];
  correlationIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface BatchConfig {
  maxSize: number;
  maxWait: number;
}

/**
 * Event bus interface
 */
export interface EventBus {
  /** Publish an event */
  publish(event: AgentEvent): Promise<void>;

  /** Publish multiple events */
  publishBatch(events: AgentEvent[]): Promise<void>;

  /** Subscribe to events */
  subscribe(pattern: EventPattern, handler: EventHandler, options?: SubscriptionOptions): EventSubscription;

  /** Unsubscribe */
  unsubscribe(subscriptionId: string): void;

  /** Request-response pattern */
  request(event: AgentEvent, timeout: number): Promise<AgentEvent>;

  /** Get subscription count */
  getSubscriptionCount(): number;

  /** Get pending event count */
  getPendingCount(): Promise<number>;
}

/**
 * Event sourcing support
 */
export interface EventStore {
  /** Append event to stream */
  append(streamId: string, event: AgentEvent): Promise<void>;

  /** Read events from stream */
  read(streamId: string, fromPosition?: number, count?: number): Promise<AgentEvent[]>;

  /** Subscribe to stream */
  subscribe(streamId: string, handler: EventHandler): EventSubscription;

  /** Get current position */
  getPosition(streamId: string): Promise<number>;

  /** Create snapshot */
  createSnapshot(streamId: string, state: unknown, position: number): Promise<void>;

  /** Load snapshot */
  loadSnapshot(streamId: string): Promise<{ state: unknown; position: number } | null>;
}

// ============================================================================
// IDE INTEGRATION
// ============================================================================

/**
 * IDE integration configuration
 */
export interface IDEIntegrationConfig {
  /** IDE type */
  type: IDEType;

  /** LSP configuration */
  lsp?: LSPConfig;

  /** Extension configuration */
  extension?: ExtensionConfig;

  /** Features to enable */
  features: IDEFeature[];
}

export type IDEType =
  | 'vscode'
  | 'jetbrains'
  | 'neovim'
  | 'emacs'
  | 'sublime'
  | 'atom'
  | 'generic_lsp';

export interface LSPConfig {
  /** Server command */
  command: string;

  /** Server arguments */
  args?: string[];

  /** Initialization options */
  initializationOptions?: Record<string, unknown>;

  /** Supported capabilities */
  capabilities: LSPCapability[];
}

export type LSPCapability =
  | 'completion'
  | 'hover'
  | 'definition'
  | 'references'
  | 'rename'
  | 'formatting'
  | 'diagnostics'
  | 'code_actions'
  | 'code_lens'
  | 'signature_help';

export interface ExtensionConfig {
  /** Extension ID */
  id: string;

  /** Extension version */
  version: string;

  /** Settings */
  settings: Record<string, unknown>;
}

export type IDEFeature =
  | 'inline_suggestions'
  | 'chat_panel'
  | 'code_actions'
  | 'diagnostics'
  | 'hover_info'
  | 'refactoring'
  | 'test_generation'
  | 'documentation';

/**
 * IDE request types
 */
export interface IDERequest {
  type: IDERequestType;
  document: DocumentInfo;
  position?: Position;
  range?: Range;
  context?: Record<string, unknown>;
}

export type IDERequestType =
  | 'completion'
  | 'hover'
  | 'definition'
  | 'references'
  | 'rename'
  | 'format'
  | 'code_action'
  | 'diagnostic'
  | 'explain'
  | 'suggest_fix'
  | 'generate_tests';

export interface DocumentInfo {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

/**
 * IDE response types
 */
export interface IDEResponse {
  type: IDERequestType;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export interface CompletionResult {
  items: CompletionItem[];
  isIncomplete: boolean;
}

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  filterText?: string;
  sortText?: string;
}

export type CompletionKind =
  | 'text'
  | 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'interface'
  | 'module'
  | 'property'
  | 'unit'
  | 'value'
  | 'enum'
  | 'keyword'
  | 'snippet'
  | 'color'
  | 'file'
  | 'reference'
  | 'folder'
  | 'constant'
  | 'struct'
  | 'event'
  | 'operator'
  | 'type_parameter';

// ============================================================================
// API GATEWAY
// ============================================================================

/**
 * API Gateway configuration
 */
export interface APIGatewayConfig {
  /** Gateway type */
  type: APIGatewayType;

  /** Routes */
  routes: RouteConfig[];

  /** Authentication */
  auth: APIAuthConfig;

  /** Rate limiting */
  rateLimit: APIRateLimitConfig;

  /** Middleware */
  middleware: MiddlewareConfig[];

  /** Error handling */
  errorHandling: APIErrorConfig;
}

export type APIGatewayType =
  | 'express'
  | 'fastify'
  | 'koa'
  | 'hono'
  | 'aws_api_gateway'
  | 'kong'
  | 'custom';

export interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
  handler: string;
  auth?: boolean;
  rateLimit?: RouteRateLimitConfig;
  validation?: ValidationConfig;
  timeout?: number;
}

export interface RouteRateLimitConfig {
  requests: number;
  window: number;
  scope: 'global' | 'user' | 'ip';
}

export interface ValidationConfig {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

export interface APIAuthConfig {
  type: 'none' | 'api_key' | 'bearer' | 'oauth2' | 'custom';
  config: Record<string, unknown>;
}

export interface APIRateLimitConfig {
  enabled: boolean;
  defaultLimit: number;
  window: number;
  keyGenerator?: string;
  skipList?: string[];
}

export interface MiddlewareConfig {
  name: string;
  order: number;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface APIErrorConfig {
  includeStack: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customHandler?: string;
}

/**
 * API request/response types
 */
export interface APIRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
  body?: unknown;
  user?: APIUser;
  timestamp: Date;
}

export interface APIUser {
  id: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, unknown>;
}

export interface APIResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
}

/**
 * API Gateway hooks
 */
export interface APIGatewayHooks {
  /** Before request processing */
  beforeRequest?: (request: APIRequest) => Promise<APIRequest | void>;

  /** After response */
  afterResponse?: (request: APIRequest, response: APIResponse) => Promise<void>;

  /** On error */
  onError?: (request: APIRequest, error: Error) => Promise<APIResponse>;

  /** On authentication */
  onAuth?: (request: APIRequest) => Promise<APIUser | null>;

  /** On rate limit exceeded */
  onRateLimitExceeded?: (request: APIRequest) => Promise<APIResponse>;
}

// ============================================================================
// INTEGRATION MANAGER
// ============================================================================

/**
 * Unified integration manager configuration
 */
export interface IntegrationManagerConfig {
  /** MCP configuration */
  mcp?: MCPClientConfig;

  /** Git configuration */
  git?: GitIntegrationConfig;

  /** CI/CD configuration */
  cicd?: CICDIntegrationConfig;

  /** Event-driven configuration */
  events?: EventDrivenConfig;

  /** IDE configuration */
  ide?: IDEIntegrationConfig;

  /** API Gateway configuration */
  api?: APIGatewayConfig;

  /** Global settings */
  global: GlobalIntegrationSettings;
}

export interface GlobalIntegrationSettings {
  /** Enable all integrations */
  enabled: boolean;

  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /** Timeout for operations */
  defaultTimeout: number;

  /** Retry configuration */
  retryConfig: GlobalRetryConfig;

  /** Evidence collection */
  collectEvidence: boolean;
}

export interface GlobalRetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Integration health check result
 */
export interface IntegrationHealthCheck {
  integration: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  lastCheck: Date;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Create default integration manager configuration
 */
export function createDefaultIntegrationConfig(): IntegrationManagerConfig {
  return {
    global: {
      enabled: true,
      logLevel: 'info',
      defaultTimeout: 30000,
      retryConfig: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      },
      collectEvidence: true,
    },
    git: {
      repoPath: '.',
      branchStrategy: {
        mainBranch: 'main',
        agentBranchPattern: 'agent/{taskId}',
        useWorktrees: false,
        autoCleanup: true,
      },
      commitConfig: {
        messageFormat: 'conventional',
        signCommits: false,
        includeEvidence: true,
        coAuthor: 'AI Agent <agent@example.com>',
      },
      prConfig: {
        titleTemplate: '[Agent] {title}',
        bodyTemplate: '## Summary\n{summary}\n\n## Changes\n{changes}\n\n## Evidence\n{evidence}',
        autoAssignReviewers: false,
        draftByDefault: true,
      },
      hooks: {
        preCommit: [],
        postCommit: [],
        prePush: [],
        postMerge: [],
      },
    },
    events: {
      bus: {
        type: 'memory',
        defaultTTL: 3600000,
        retry: {
          maxRetries: 3,
          initialDelay: 100,
          maxDelay: 5000,
          backoff: 'exponential',
        },
      },
      deadLetterQueue: {
        enabled: true,
        maxSize: 1000,
        retentionPeriod: 86400000,
        alertThreshold: 100,
      },
      observability: {
        tracing: true,
        metrics: true,
        logging: true,
        samplingRate: 1.0,
      },
    },
  };
}
