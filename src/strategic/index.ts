/**
 * @fileoverview Strategic Knowledge Architecture Module
 *
 * This module provides the foundation for deep project understanding,
 * intelligent work management, and sophisticated verification capabilities.
 *
 * Key Components:
 *
 * 1. **Strategic Context** (types.ts)
 *    - Project Vision: Mission, pillars, constraints
 *    - Bounded Contexts: DDD-style domain separation
 *    - Quality Weights: Project-specific quality priorities
 *    - Knowledge Confidence: Epistemic humility framework
 *
 * 2. **Work Primitives** (work_primitives.ts)
 *    - Composable work items: Epic → Story → Task → Step
 *    - Evidence-based tracking
 *    - Templates for common patterns
 *    - Full traceability
 *
 * 3. **Prioritization Engine** (prioritization.ts)
 *    - Multi-factor priority computation
 *    - Transparent, explainable scoring
 *    - Dynamic rules and adjustments
 *    - Impact simulation
 *
 * 4. **Conceptual Verification** (conceptual_verification.ts)
 *    - Beyond-code error detection
 *    - Logical, theoretical, domain errors
 *    - Security model verification
 *    - Consistency checking
 *
 * Design Philosophy:
 *
 * - **Research-First**: The repo and LLM don't have all answers
 * - **Epistemic Humility**: Track confidence, acknowledge uncertainty
 * - **Evidence-Based**: Every claim should have provenance
 * - **Composable**: Building blocks that combine for any need
 * - **Transparent**: Every decision can be explained
 *
 * @packageDocumentation
 */

// ============================================================================
// STRATEGIC CONTEXT TYPES
// ============================================================================

export type {
  // Confidence and Provenance
  ConfidenceLevel,
  ConfidenceAssessment,
  ConfidenceFactor,
  Provenance,
  KnowledgeSource,
  SourceAuthority,

  // Project Vision
  ProjectVision,
  TargetUser,
  Stakeholder,
  StrategicPillar,
  Constraint,
  ConstraintException,
  AntiPattern,
  AntiPatternExample,
  SuccessCriterion,
  SuccessMetric,

  // Quality
  QualityWeights,
  CustomQualityDimension,

  // Bounded Contexts
  BoundedContext,
  ContextBoundary,
  Term,
  TermExample,
  ContextRelationship,
  ContextRelationType,
  IntegrationMechanism,
  DataFlow,
  Contract,
  ContextOwnership,
  ContextImplementation,
  ExternalDependency,
  ContextHealth,
  ContextIssue,

  // Research
  ResearchDepth,
  ResearchTrigger,
  ResearchCondition,
  ResearchQuery,
  ResearchConstraints,
  ResearchResult,
  ResearchFinding,
  ExtractedFact,
  ResearchSynthesis,
  ResearchQualityAssessment,
  QualityFactor,
  KnowledgeGap,

  // External Knowledge
  ExternalKnowledge,
  ExternalKnowledgeType,

  // Architecture Decisions
  ArchitectureDecision,
  ADRStatus,
  AlternativeConsidered,
  DecisionRisk,

  // Utilities
  ChangeRecord,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types.js';

export { DEFAULT_QUALITY_WEIGHTS } from './types.js';

// ============================================================================
// WORK PRIMITIVES
// ============================================================================

export type {
  // Core Types
  WorkPrimitiveType,
  WorkStatus,
  WorkPrimitive,
  WorkExecutionContext,
  WorkResourceEstimates,
  WorkDependencySummary,
  WorkFileReference,
  WorkEntityReference,
  WorkEpisodeReference,
  WorkToolSuggestion,
  WorkExternalDependency,

  // Acceptance Criteria
  AcceptanceCriterion,
  VerificationMethod,

  // Notes
  Note,
  NoteReference,

  // Dependencies
  WorkDependency,
  DependencyType,

  // Traceability
  WorkTraceability,
  AffectedFile,
  RequirementLink,
  ExternalRef,
  TestLink,

  // Priority
  ComputedPriority,
  PriorityLevel,
  PriorityFactor,
  PriorityOverride,

  // Impact
  ImpactAssessment,
  ImpactLevel,
  CascadeEffect,

  // Effort
  EffortEstimate,
  EffortComplexity,
  EffortSize,
  EffortBreakdown,

  // Status and Timing
  StatusChange,
  WorkTiming,
  Deadline,
  ServiceLevelAgreement,

  // Evidence
  WorkEvidence,
  EvidenceType,

  // Labels
  WorkLabel,

  // Changes
  WorkChange,
  WorkChangeType,

  // Templates
  WorkTemplate,
  SuggestedStep,
  TemplateAutoTrigger,

  // Hierarchy
  WorkHierarchy,
  WorkPath,
  WorkPathSegment,

  // Queries
  WorkQuery,
  WorkQueryOrderBy,

  // Operations
  CreateWorkInput,
  UpdateWorkInput,
  DecomposeOptions,
  TransitionOptions,

  // Reports
  WorkReport,
  WorkSummary,
  WorkMetrics,
  WorkReportIssue,
} from './work_primitives.js';

export { STANDARD_PRIORITY_FACTORS, STANDARD_LABELS } from './work_primitives.js';
export type { VerificationPlan, VerificationPlanCost } from './verification_plan.js';
export { createVerificationPlan } from './verification_plan.js';
export type {
  TechniquePrimitive,
  TechniquePrimitiveKind,
  TechniqueAbstractionLevel,
  TechniquePrimitiveContract,
  TechniqueFieldSpec,
  TechniqueFieldOrigin,
  TechniqueFieldType,
  TechniqueVerificationSpec,
  TechniqueComposition,
  TechniqueOperator,
  TechniqueOperatorType,
  TechniqueRelationship,
  TechniqueRelationshipType,
} from './techniques.js';
export type { TechniquePackage } from './technique_packages.js';
export {
  TECHNIQUE_PRIMITIVE_CATEGORIES,
  TECHNIQUE_PRIMITIVE_KINDS,
  TECHNIQUE_ABSTRACTION_LEVELS,
  TECHNIQUE_SEMANTIC_PROFILE_IDS,
  TECHNIQUE_DOMAIN_TAGS,
  TECHNIQUE_OPERATOR_TYPES,
  TECHNIQUE_RELATIONSHIP_TYPES,
  isBuiltinOperatorType,
  isCustomOperatorType,
  isBuiltinRelationshipType,
  isCustomRelationshipType,
  createTechniquePrimitive,
  normalizeTechniquePrimitive,
  createTechniqueComposition,
} from './techniques.js';
export { createTechniquePackage } from './technique_packages.js';
export {
  OPERATOR_SEMANTICS,
  RELATIONSHIP_SEMANTICS,
  getOperatorSemantics,
  getRelationshipSemantics,
  registerOperatorSemantics,
  registerRelationshipSemantics,
  lockTechniqueSemanticsRegistry,
} from './technique_semantics.js';
export {
  TECHNIQUE_SEMANTIC_PROFILES,
  getTechniqueSemanticProfile,
} from './technique_profiles.js';
export { createEpisode } from './episodes.js';

// ============================================================================
// PRIORITIZATION ENGINE
// ============================================================================

export type {
  // Configuration
  PrioritizationConfig,
  PriorityWeights,
  PriorityThresholds,
  DecayConfig,

  // Rules
  PrioritizationRule,
  RuleCondition,
  RuleEffect,

  // Computation
  PriorityComputeContext,
  DependencyGraph,
  PriorityComputation,
  AppliedRule,
  PriorityAdjustment,

  // Explanation
  PriorityExplanation,
  ExplainedFactor,
  PriorityComparison,
  WorkReference,
  PrioritySuggestion,

  // Results
  RankedWork,
  RankOptions,
  FocusRecommendation,
  PrioritySimulation,
  PriorityChange,

  // Factor Calculation
  FactorCalculator,
  FactorResult,

  // Engine Interface
  PrioritizationEngine,
} from './prioritization.js';

export {
  DEFAULT_PRIORITIZATION_CONFIG,
  BUILT_IN_RULES,
  // Factor calculators
  calculateStrategicAlignment,
  calculateUserImpact,
  calculateRiskReduction,
  calculateDependencyUnblock,
  calculateEffortValue,
  calculateTimeDecay,
  calculateMomentum,
  calculateExternalPressure,
} from './prioritization.js';

// ============================================================================
// CONCEPTUAL VERIFICATION
// ============================================================================

export type {
  // Error Types
  ConceptualErrorCategory,
  ErrorSubcategory,
  ConceptualError,
  ErrorSeverity,
  ErrorLocation,
  ErrorScope,

  // Evidence
  ConceptualEvidence,
  EvidenceType as ConceptualEvidenceType,

  // Analysis
  RootCauseAnalysis,
  ContributingFactor,
  TimelineEvent,
  Implication,

  // Fixes
  SuggestedFix,
  FixStep,

  // Detection
  DetectionMethod,
  DetectionRule,
  DetectionPattern,
  DetectionConstraint,

  // Status
  ErrorStatus,
  ErrorStatusChange,

  // Context
  VerificationContext,
  FunctionInfo,
  ModuleInfo,
  DependencyInfo,
  DocumentationInfo,
  VerificationConfig,

  // Results
  VerificationReport,
  VerificationSummary,
  CategoryBreakdown,
  VerificationTrends,
  TrendPoint,
  VerificationRecommendation,

  // Verifier Interface
  ConceptualVerifier,
  ErrorExplanation,
} from './conceptual_verification.js';

export {
  ERROR_SUBCATEGORIES,
  BUILT_IN_VERIFICATION_RULES,
} from './conceptual_verification.js';

// ============================================================================
// AGENT LIFECYCLE HOOKS
// ============================================================================

export type {
  // Core Hook Types
  HookTiming,
  HookScope,
  HookPriority,
  HookHandle,
  HookOptions,
  HookCondition,
  HookErrorHandling,

  // Context Types
  HookContext,
  HookEvidence,
  HookEvidenceType,
  AgentContext,
  ModelContext,
  ToolContext,
  MemoryContext,
  ErrorContext,

  // Agent State
  AgentState,
  StateTransition,

  // Result Types
  AgentResult,
  ModelResponse,
  ToolResult,
  MemoryResult,
  RecoveryAction,
  RecoveryActionType,
  RetryDecision,
  RetryStrategy,

  // Request Types
  ModelRequest,
  Message,
  ToolCall,
  ToolDefinition,
  ToolChoice,
  ToolInvocation,
  MemoryQuery,
  MemoryType,
  MemoryFilter,
  MemoryItem,

  // Supporting Types
  ToolInfo,
  MemoryInfo,
  ModelConfig,
  RetryContext,
  RetryAttempt,

  // Lifecycle Hooks
  AgentInvocationHooks,
  ModelHooks,
  ToolHooks,
  ToolSelectionRequest,
  MemoryHooks,
  StateTransitionHooks,
  ErrorRecoveryHooks,

  // Task Hooks
  TaskCreationHooks,
  TaskCreateInput,
  TaskInfo,
  TaskStatus,
  TaskDecomposeOptions,
  TaskExecutionHooks,
  TaskProgress,
  ResourceUsage,
  ProgressAction,
  TaskCompletionHooks,
  TaskResult,
  Artifact,
  TaskMetrics,
  TaskError,
  FailureAction,
  CompensationAction,
  VerificationResult,
  CriterionResult,

  // Priority Hooks
  PriorityHooks,
  PriorityFactorValue,
  PriorityAdjustment as HookPriorityAdjustment,
  EscalationDecision,

  // Dependency Hooks
  DependencyHooks,
  TaskDependency,
  DependencyType as HookDependencyType,
  DependencyFailureAction,

  // Gate Types
  GateLevel,
  GateCapability,
  Gate,
  GateRequirement,
  GateContext,
  GateAction,
  GateResult,
  GateHooks,
  ActionResult,
  Proposal,
  ProposedChange,
  ProposalDecision,
  PullRequestInfo as HookPullRequestInfo,
  CommitInfo,
  GateViolation,
  ViolationResponse,

  // Approval Workflow
  ApprovalWorkflow,
  ApprovalStage,
  ApproverConfig,
  ApprovalRequirement,
  EscalationPolicy,
  EscalationLevel,
  ApprovalHooks,
  ApprovalContext,
  ApprovalRequest,
  Approval,
  Denial,
  DenialAction,
  TimeoutAction,

  // Hook Registry
  AllHooks,
  HookRegistry,
  HookExecutionResult,
  HookExecutionError,
  HookExecutionOptions,
} from './hooks.js';

export { AGENT_STATE_TRANSITIONS, STANDARD_GATES } from './hooks.js';

// ============================================================================
// BUILDING BLOCKS
// ============================================================================

export type {
  // Reasoning Patterns
  ReasoningPatternType,
  ChainOfThoughtConfig,
  ThoughtStep,
  ChainOfThoughtResult,
  TreeOfThoughtConfig,
  ThoughtBranch,
  TreeOfThoughtResult,
  GraphOfThoughtConfig,
  ThoughtNode,
  GraphOfThoughtResult,
  AdaptiveGraphOfThoughtConfig,
  ReActConfig,
  ToolSpec,
  ParameterSpec,
  StopCondition,
  ReActStep,
  ReActResult,
  ReflexionConfig,
  ReflexionIteration,
  ReflexionResult,

  // Memory Systems
  MemoryTier,
  MemorySystemConfig,
  WorkingMemoryConfig,
  WorkingMemoryItem,
  EpisodicMemoryConfig,
  Episode,
  EpisodeType,
  EpisodeContext,
  EpisodeActor,
  EpisodeEvent,
  EpisodeOutcome,
  EpisodeLesson,
  SemanticMemoryConfig,
  SemanticFact,
  SemanticConcept,
  ConceptAttribute,
  ConceptExample,
  ConceptRelationship,
  ProceduralMemoryConfig,
  Procedure,
  ProcedureApplicability,
  ProcedureCondition,
  ProcedureStep,
  ProcedureParameter,
  RetryPolicy,
  AlternativeStep,
  ProcedureVariant,
  ProcedureDifference,
  ProcedureStatistics,
  MemorySearchConfig,
  ConsolidationConfig,
  ConsolidationTrigger,
  MemoryDecayConfig,

  // Tool Orchestration
  ToolOrchestrationPattern,
  ManagerPatternConfig,
  WorkerConfig,
  HandoffPatternConfig,
  HandoffAgentConfig,
  HandoffRule,
  HandoffCondition,
  ContextTransform,
  ToolSelectionConfig,
  ToolSelectionRule,
  ToolCondition,

  // Reflection & Critique
  ReflectionLoopConfig,
  ReflectionTrigger,
  Reflection,
  ExecutionSummary,
  ReflectionOutcome,
  ReflectionDeviation,
  CausalAnalysis,
  ReflectionAssumption,
  ReasoningFlaw,
  ReflectionLesson,
  ReflectionRecommendation,
  SelfCritiqueConfig,
  ConstitutionalPrinciple,
  RubricCriterion,
  RubricLevel,
  CritiqueResult,
  CriterionResult as CritiqueCriterionResult,

  // Uncertainty
  UncertaintyConfig,
  UncertaintyThresholds,
  UncertaintyActions,
  UncertaintyAction,
  ConfidenceEstimate,
  ConfidenceComponents,
  UncertaintySource,
  UncertaintySourceType,

  // Knowledge Graphs
  KnowledgeGraphConfig,
  KGEntity,
  KGRelation,
  TemporalInfo,
  KGQuery,
  KGQueryPattern,
  KGConstraint,
  KGQueryResult,
  KGPath,

  // Consensus
  ConsensusType,
  ConsensusConfig,
  WeightFunction,
  ConsensusFailureAction,
  ConsensusProposal,
  ConsensusVote,
  ConsensusResult,

  // Configuration
  AgentConfig,
  AgentConfigType,
  ReasoningConfig,
  ToolConfig,
  ReflectionConfig,
  GateConfig,
  GateOverride,
  ModelConfiguration,
} from './building_blocks.js';

export {
  DEFAULT_COT_CONFIG,
  DEFAULT_TOT_CONFIG,
  DEFAULT_GOT_CONFIG,
  DEFAULT_MEMORY_CONFIG,
  DEFAULT_UNCERTAINTY_CONFIG,
  DEFAULT_REFLECTION_CONFIG,
  DEFAULT_CRITIQUE_CONFIG,
  createStarterConfig,
} from './building_blocks.js';

// ============================================================================
// AGENT FORMULATIONS
// ============================================================================

export type {
  // Workflow Types
  WorkflowStep,
  LoopConfig,
  RetryConfig,
  OutputSpec,
  WorkflowDefinition,
  InputSpec,
  QualityGate,
  QualityCheck,
  QualityFailureAction,
  WorkflowErrorHandling,

  // Formulation Base
  AgentFormulation,
  ToolRecommendation,
  FormulationExample,

  // Code Review
  CodeReviewFormulation,
  CodeAnalyzerConfig,
  CodeReviewFocusArea,
  SeverityConfig,
  SeverityLevel,
  EscalationRule,
  ReviewReportConfig,

  // Research
  ResearchFormulation,
  ResearchSource,
  ResearchVerificationConfig,
  CitationConfig,
  ResearchDepthConfig as ResearchFormulationDepthConfig,

  // Planning
  PlanningFormulation,
  MethodDefinition,
  MethodApplicability,
  SubtaskDefinition,
  PlanningConstraint,
  ContingencyConfig,
  FailureMode,
  RecoveryStrategy as FormulationRecoveryStrategy,

  // Verification
  VerificationFormulation,
  VerificationLevel,
  CoverageConfig,
  FormalVerificationConfig,
  PropertySpec,

  // Documentation
  DocumentationFormulation,
  DocumentationType,
  DocumentationOutputConfig,
  DocumentationStyleConfig,
} from './agent_formulations.js';

export {
  CODE_REVIEW_WORKFLOW,
  CODE_REVIEW_FORMULATION,
  RESEARCH_WORKFLOW,
  RESEARCH_FORMULATION,
  PLANNING_WORKFLOW,
  PLANNING_FORMULATION,
  VERIFICATION_WORKFLOW,
  VERIFICATION_FORMULATION,
  DOCUMENTATION_WORKFLOW,
  DOCUMENTATION_FORMULATION,
  FORMULATION_REGISTRY,
  getFormulation,
  listFormulations,
  customizeFormulation,
} from './agent_formulations.js';

// ============================================================================
// INTEGRATION PATTERNS
// ============================================================================

export type {
  // MCP
  MCPServerConfig,
  MCPTransportConfig,
  MCPCapabilities,
  MCPToolCapability,
  MCPResourceCapability,
  MCPPromptCapability,
  MCPPromptArgument,
  MCPSamplingCapability,
  MCPLoggingCapability,
  MCPSecurityConfig,
  MCPAuthConfig,
  MCPRateLimitConfig,
  MCPClientConfig,
  MCPServerConnection,
  MCPRetryConfig,
  MCPToolRequest,
  MCPToolResult,
  MCPContent,
  MCPResourceRequest,
  MCPResource,
  MCPHooks,

  // Git
  GitIntegrationConfig,
  BranchStrategy,
  CommitConfig,
  CommitMessageFormat,
  PRConfig,
  GitHooksConfig,
  GitHookConfig,
  GitOperationType,
  GitOperationResult,
  GitCommitInfo,
  GitIntegrationHooks,
  PRCreateConfig,
  PullRequestInfo,
  ConflictResolution,
  WorktreeConfig,
  Worktree,

  // CI/CD
  CICDIntegrationConfig,
  CICDProvider,
  PipelineConfig,
  TriggerConfig,
  PushTrigger,
  PRTrigger,
  ScheduledTrigger,
  SelfCorrectionConfig,
  SelfCorrectionType,
  PipelineStage,
  PipelineRunResult,
  PipelineStatus,
  StageResult,
  ArtifactInfo,
  CICDHooks,
  PipelineRunConfig,
  StageContext,
  StageFailureAction,
  PipelineFailureAction,

  // Event-Driven
  EventDrivenConfig,
  EventBusConfig,
  EventRetryConfig,
  SchemaRegistryConfig,
  DeadLetterConfig,
  EventObservabilityConfig,
  AgentEvent,
  AgentEventType,
  EventSubscription,
  EventPattern,
  EventHandler,
  SubscriptionOptions,
  EventFilter,
  BatchConfig,
  EventBus,
  EventStore,

  // IDE
  IDEIntegrationConfig,
  IDEType,
  LSPConfig,
  LSPCapability,
  ExtensionConfig,
  IDEFeature,
  IDERequest,
  IDERequestType,
  DocumentInfo,
  Position,
  Range,
  IDEResponse,
  CompletionResult,
  CompletionItem,
  CompletionKind,

  // API Gateway
  APIGatewayConfig,
  APIGatewayType,
  RouteConfig,
  RouteRateLimitConfig,
  ValidationConfig,
  APIAuthConfig,
  APIRateLimitConfig,
  MiddlewareConfig,
  APIErrorConfig,
  APIRequest,
  APIUser,
  APIResponse,
  APIGatewayHooks,

  // Integration Manager
  IntegrationManagerConfig,
  GlobalIntegrationSettings,
  GlobalRetryConfig,
  IntegrationHealthCheck,
} from './integration_patterns.js';

export { createDefaultIntegrationConfig } from './integration_patterns.js';

// ============================================================================
// IMPLEMENTATION FILES (Work In Progress)
// ============================================================================
//
// The following implementation files are available in .wip format and need
// alignment with the type definitions above before they can be exported:
//
// - storage.ts.wip: SQLite storage layer for strategic knowledge
// - strategic_context.ts.wip: Strategic context manager (vision, bounded contexts)
// - work_manager.ts.wip: Work primitives manager (epic/story/task hierarchy)
// - prioritization_engine.ts.wip: Multi-factor prioritization engine
// - conceptual_verifier.ts.wip: Conceptual error detection
//
// To complete implementation, align these files with the type definitions
// exported from types.ts, work_primitives.ts, prioritization.ts, and
// conceptual_verification.ts.

// ============================================================================
// MODULE DOCUMENTATION
// ============================================================================

/**
 * # Strategic Knowledge Architecture
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   ProjectVision,
 *   BoundedContext,
 *   WorkPrimitive,
 *   ComputedPriority,
 *   ConceptualError,
 * } from './librarian/strategic';
 *
 * // Define project vision
 * const vision: ProjectVision = {
 *   mission: 'Enable developers to build better software faster',
 *   pillars: [...],
 *   qualityWeights: DEFAULT_QUALITY_WEIGHTS,
 *   // ...
 * };
 *
 * // Create work items
 * const task: WorkPrimitive = {
 *   type: 'task',
 *   title: 'Implement user authentication',
 *   // ...
 * };
 *
 * // Compute priority
 * const priority = await prioritizationEngine.computePriority(task, context);
 *
 * // Verify conceptual integrity
 * const errors = await verifier.verifyAll(verificationContext);
 * ```
 *
 * ## Research-First Philosophy
 *
 * This module is built on the principle that:
 *
 * 1. **The repository doesn't contain all relevant knowledge**
 * 2. **The LLM doesn't have all the answers**
 * 3. **Confidence must be tracked and expressed**
 * 4. **Research should be triggered automatically when uncertainty is high**
 *
 * ## Key Concepts
 *
 * ### Confidence Levels
 *
 * - **Verified** (0.9-1.0): Multiple authoritative sources, production-tested
 * - **Established** (0.7-0.9): Single authoritative source, consistent
 * - **Probable** (0.5-0.7): Inferred, RESEARCH RECOMMENDED
 * - **Speculative** (0.3-0.5): LLM inference, RESEARCH REQUIRED
 * - **Unknown** (<0.3): No information, MUST RESEARCH
 *
 * ### Work Primitive Hierarchy
 *
 * ```
 * Epic (Strategic)
 * └── Story (Tactical)
 *     └── Task (Operational)
 *         └── Step (Atomic)
 *             └── Checkpoint (Verification)
 * ```
 *
 * ### Priority Computation
 *
 * Priority is COMPUTED from multiple factors:
 * - Strategic alignment (20%)
 * - User impact (18%)
 * - Risk reduction (15%)
 * - Dependency unblock (12%)
 * - Effort/value ratio (12%)
 * - Time decay (8%)
 * - Momentum (8%)
 * - External pressure (7%)
 *
 * ### Conceptual Error Categories
 *
 * - **Logical**: Contradictions, incomplete cases
 * - **Theoretical**: Algorithm misuse, distributed fallacies
 * - **Design**: Abstraction leaks, temporal coupling
 * - **Domain**: Business rule violations, language inconsistency
 * - **Consistency**: Doc/code drift, decision drift
 * - **Security**: Trust boundary violations
 */
