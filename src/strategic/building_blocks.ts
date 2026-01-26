/**
 * @fileoverview Technical and Conceptual Building Blocks for Agentic Systems
 *
 * This module provides composable primitives for building sophisticated agent systems:
 *
 * 1. **Reasoning Patterns** - Chain-of-Thought, Tree-of-Thought, Graph-of-Thought
 * 2. **Memory Systems** - Episodic, Semantic, Procedural memory tiers
 * 3. **Tool Orchestration** - Manager, Handoff, and Selection patterns
 * 4. **State Machines** - Agent state management
 * 5. **Reflection & Critique** - Self-improvement mechanisms
 * 6. **Uncertainty Quantification** - Confidence estimation
 * 7. **Knowledge Graphs** - Structured knowledge representation
 * 8. **Consensus Mechanisms** - Multi-agent agreement
 * 9. **Configuration Schemas** - Shareable config formats
 *
 * Design Philosophy:
 * - Each building block is independent and composable
 * - Strong typing for compile-time safety
 * - Configuration-driven for easy customization
 * - Shareable configs via JSON/YAML format
 *
 * @packageDocumentation
 */

import type { Provenance, ConfidenceLevel, ConfidenceAssessment } from './types.js';

// ============================================================================
// REASONING PATTERNS
// ============================================================================

/**
 * Available reasoning pattern types
 */
export type ReasoningPatternType =
  | 'chain-of-thought'
  | 'tree-of-thought'
  | 'graph-of-thought'
  | 'adaptive-graph-of-thought'
  | 'self-consistency'
  | 'react'
  | 'reflexion';

// ----------------------------------------------------------------------------
// Chain-of-Thought (CoT)
// ----------------------------------------------------------------------------

/**
 * Chain-of-Thought: Linear step-by-step reasoning
 * Best for: Straightforward problems with clear progression
 */
export interface ChainOfThoughtConfig {
  type: 'chain-of-thought';

  /** Maximum number of reasoning steps */
  maxSteps: number;

  /** Validate each step before proceeding */
  stepValidation: boolean;

  /** Evaluate intermediate conclusions */
  intermediateEvaluation: boolean;

  /** Prompt template for reasoning */
  promptTemplate?: string;

  /** Temperature for generation */
  temperature?: number;
}

export interface ThoughtStep {
  stepNumber: number;
  thought: string;
  reasoning: string;
  conclusion: string;
  confidence: number;
  evidence?: string[];
}

export interface ChainOfThoughtResult {
  steps: ThoughtStep[];
  finalAnswer: string;
  confidence: number;
  totalTokens: number;
  duration: number;
}

// ----------------------------------------------------------------------------
// Tree-of-Thought (ToT)
// ----------------------------------------------------------------------------

/**
 * Tree-of-Thought: Branching exploration of solution space
 * Best for: Problems with multiple valid approaches
 */
export interface TreeOfThoughtConfig {
  type: 'tree-of-thought';

  /** Number of branches to explore at each node */
  branchingFactor: number;

  /** Maximum tree depth */
  maxDepth: number;

  /** Search strategy */
  searchStrategy: 'breadth-first' | 'depth-first' | 'best-first';

  /** Score threshold for pruning branches */
  pruningThreshold: number;

  /** Evaluation method for branches */
  evaluationMethod: 'self' | 'voting' | 'external';

  /** Number of evaluations per branch (for voting) */
  evaluationsPerBranch?: number;
}

export interface ThoughtBranch {
  id: string;
  parentId: string | null;
  depth: number;
  thought: string;
  reasoning: string;
  score: number;
  isSelected: boolean;
  isPruned: boolean;
  children: string[]; // Child IDs
}

export interface TreeOfThoughtResult {
  root: string; // Root branch ID
  branches: Map<string, ThoughtBranch>;
  selectedPath: string[]; // Path of selected branch IDs
  finalAnswer: string;
  confidence: number;
  exploredBranches: number;
  prunedBranches: number;
  duration: number;
}

// ----------------------------------------------------------------------------
// Graph-of-Thought (GoT)
// ----------------------------------------------------------------------------

/**
 * Graph-of-Thought: DAG-based reasoning with subproblem merging
 * Best for: Complex problems with overlapping substructures
 */
export interface GraphOfThoughtConfig {
  type: 'graph-of-thought';

  /** Decomposition strategy */
  decompositionStrategy: 'recursive' | 'parallel' | 'hybrid';

  /** Enable caching of subproblem solutions */
  cacheEnabled: boolean;

  /** Maximum subproblems to solve in parallel */
  maxParallelism: number;

  /** Merge strategy for combining solutions */
  mergeStrategy: 'weighted' | 'voting' | 'llm';
}

export interface ThoughtNode {
  id: string;
  type: 'problem' | 'subproblem' | 'solution' | 'merge';
  content: string;
  dependencies: string[]; // Node IDs this depends on
  result?: unknown;
  confidence?: number;
  cached?: boolean;
}

export interface GraphOfThoughtResult {
  nodes: Map<string, ThoughtNode>;
  edges: Array<{ from: string; to: string }>;
  rootId: string;
  solutionId: string;
  finalAnswer: string;
  confidence: number;
  cacheHits: number;
  duration: number;
}

// ----------------------------------------------------------------------------
// Adaptive Graph-of-Thought (AGoT)
// ----------------------------------------------------------------------------

/**
 * Adaptive Graph-of-Thought: Test-time adaptive reasoning
 * Dynamically adjusts strategy based on problem complexity
 */
export interface AdaptiveGraphOfThoughtConfig {
  type: 'adaptive-graph-of-thought';

  /** Complexity estimation method */
  complexityEstimator: 'heuristic' | 'model' | 'hybrid';

  /** Adaptation threshold for switching strategies */
  adaptationThreshold: number;

  /** Available strategies to switch between */
  availableStrategies: ReasoningPatternType[];

  /** Learning rate for adaptation */
  learningRate?: number;
}

// ----------------------------------------------------------------------------
// ReAct Pattern
// ----------------------------------------------------------------------------

/**
 * ReAct: Reasoning + Acting interleaved
 * Best for: Tasks requiring tool use and reasoning
 */
export interface ReActConfig {
  type: 'react';

  /** Maximum action iterations */
  maxIterations: number;

  /** Available tools/actions */
  tools: ToolSpec[];

  /** Observation processing */
  observationProcessing: 'raw' | 'summarized' | 'structured';

  /** Stop conditions */
  stopConditions: StopCondition[];
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, ParameterSpec>;
  returnType: string;
}

export interface ParameterSpec {
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface StopCondition {
  type: 'answer_found' | 'max_iterations' | 'confidence_threshold' | 'custom';
  value?: unknown;
}

export interface ReActStep {
  iteration: number;
  thought: string;
  action?: { tool: string; input: Record<string, unknown> };
  observation?: string;
  isTerminal: boolean;
}

export interface ReActResult {
  steps: ReActStep[];
  finalAnswer: string;
  confidence: number;
  toolsUsed: string[];
  duration: number;
}

// ----------------------------------------------------------------------------
// Reflexion Pattern
// ----------------------------------------------------------------------------

/**
 * Reflexion: Self-reflection and improvement
 * Best for: Iterative refinement tasks
 */
export interface ReflexionConfig {
  type: 'reflexion';

  /** Maximum reflection iterations */
  maxIterations: number;

  /** Memory type for storing reflections */
  memoryType: 'episodic' | 'sliding_window' | 'summarized';

  /** Window size for sliding window memory */
  windowSize?: number;

  /** Reflection depth */
  reflectionDepth: 'shallow' | 'medium' | 'deep';
}

export interface ReflexionIteration {
  attempt: number;
  action: unknown;
  result: unknown;
  reflection: string;
  lessonLearned: string;
  improved: boolean;
}

export interface ReflexionResult {
  iterations: ReflexionIteration[];
  finalResult: unknown;
  totalReflections: number;
  improvementRate: number;
  duration: number;
}

// ============================================================================
// MEMORY SYSTEMS
// ============================================================================

/**
 * Memory tier types
 */
export type MemoryTier = 'working' | 'episodic' | 'semantic' | 'procedural';

// ----------------------------------------------------------------------------
// Memory System Configuration
// ----------------------------------------------------------------------------

/**
 * Complete memory system configuration
 */
export interface MemorySystemConfig {
  /** Working memory config */
  working: WorkingMemoryConfig;

  /** Episodic memory config */
  episodic: EpisodicMemoryConfig;

  /** Semantic memory config */
  semantic: SemanticMemoryConfig;

  /** Procedural memory config */
  procedural: ProceduralMemoryConfig;

  /** Cross-memory search config */
  search: MemorySearchConfig;

  /** Consolidation config (short-term to long-term) */
  consolidation: ConsolidationConfig;

  /** Decay config */
  decay: MemoryDecayConfig;
}

// ----------------------------------------------------------------------------
// Working Memory
// ----------------------------------------------------------------------------

/**
 * Working Memory: Active context for current task
 */
export interface WorkingMemoryConfig {
  enabled: boolean;

  /** Maximum items in working memory */
  maxItems: number;

  /** Maximum tokens in working memory */
  maxTokens: number;

  /** Eviction strategy when full */
  evictionStrategy: 'lru' | 'priority' | 'relevance';

  /** Persistence between sessions */
  persistent: boolean;
}

export interface WorkingMemoryItem {
  id: string;
  type: 'context' | 'intermediate' | 'reference';
  content: unknown;
  priority: number;
  addedAt: Date;
  accessedAt: Date;
  accessCount: number;
  tokens: number;
}

// ----------------------------------------------------------------------------
// Episodic Memory
// ----------------------------------------------------------------------------

/**
 * Episodic Memory: Records specific experiences
 * "What happened, when, and in what context"
 */
export interface EpisodicMemoryConfig {
  enabled: boolean;

  /** Storage backend */
  backend: 'sqlite' | 'vector' | 'hybrid';

  /** Maximum episodes to store */
  maxEpisodes: number;

  /** Episode retention period (ms) */
  retentionPeriod: number;

  /** Index configuration */
  indexing: {
    temporal: boolean;
    contextual: boolean;
    semantic: boolean;
  };
}

export interface Episode {
  id: string;
  timestamp: Date;
  type: EpisodeType;
  context: EpisodeContext;
  actors: EpisodeActor[];
  events: EpisodeEvent[];
  outcome: EpisodeOutcome;
  lessons: EpisodeLesson[];
  embedding?: number[];
  metadata: Record<string, unknown>;
}

export type EpisodeType =
  | 'task_execution'
  | 'error_recovery'
  | 'user_interaction'
  | 'discovery'
  | 'decision'
  | 'learning';

export interface EpisodeContext {
  taskId?: string;
  agentId?: string;
  environment: string;
  state: Record<string, unknown>;
}

export interface EpisodeActor {
  id: string;
  type: 'agent' | 'user' | 'system' | 'tool';
  role: string;
}

export interface EpisodeEvent {
  order: number;
  timestamp: Date;
  type: string;
  description: string;
  data?: unknown;
}

export interface EpisodeOutcome {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export interface EpisodeLesson {
  insight: string;
  confidence: number;
  applicability: string[];
}

// ----------------------------------------------------------------------------
// Semantic Memory
// ----------------------------------------------------------------------------

/**
 * Semantic Memory: Stores facts, concepts, and relationships
 * "What we know independent of specific experiences"
 */
export interface SemanticMemoryConfig {
  enabled: boolean;

  /** Storage backend */
  backend: 'sqlite' | 'vector' | 'knowledge_graph' | 'hybrid';

  /** Maximum facts to store */
  maxFacts: number;

  /** Consistency checking enabled */
  consistencyChecking: boolean;

  /** Automatic contradiction resolution */
  contradictionResolution: 'manual' | 'recency' | 'confidence' | 'voting';
}

export interface SemanticFact {
  id: string;
  statement: string;
  confidence: ConfidenceLevel;
  provenance: Provenance;
  validFrom?: Date;
  validUntil?: Date;
  contradicts?: string[]; // IDs of contradicted facts
  supports?: string[]; // IDs of supporting facts
  embedding?: number[];
  metadata: Record<string, unknown>;
}

export interface SemanticConcept {
  id: string;
  name: string;
  definition: string;
  attributes: ConceptAttribute[];
  examples: ConceptExample[];
  relationships: ConceptRelationship[];
  embedding?: number[];
}

export interface ConceptAttribute {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface ConceptExample {
  description: string;
  isPositive: boolean;
  context?: string;
}

export interface ConceptRelationship {
  type: 'is_a' | 'has_a' | 'part_of' | 'related_to' | 'opposite_of' | 'custom';
  targetConceptId: string;
  strength: number;
  bidirectional: boolean;
  customType?: string;
}

// ----------------------------------------------------------------------------
// Procedural Memory
// ----------------------------------------------------------------------------

/**
 * Procedural Memory: Encodes how to do things
 * "Skills, procedures, and execution strategies"
 */
export interface ProceduralMemoryConfig {
  enabled: boolean;

  /** Storage backend */
  backend: 'sqlite' | 'json';

  /** Maximum procedures to store */
  maxProcedures: number;

  /** Learning from execution feedback */
  learningEnabled: boolean;

  /** Success rate threshold for procedure recommendation */
  recommendationThreshold: number;
}

export interface Procedure {
  id: string;
  name: string;
  description: string;
  version: number;
  applicability: ProcedureApplicability[];
  preconditions: ProcedureCondition[];
  postconditions: ProcedureCondition[];
  steps: ProcedureStep[];
  variants: ProcedureVariant[];
  statistics: ProcedureStatistics;
  metadata: Record<string, unknown>;
}

export interface ProcedureApplicability {
  taskType: string;
  conditions: string[];
  priority: number;
}

export interface ProcedureCondition {
  description: string;
  check: string; // Expression or function name
  required: boolean;
}

export interface ProcedureStep {
  order: number;
  action: string;
  description: string;
  parameters: ProcedureParameter[];
  expectedOutcome: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  alternatives?: AlternativeStep[];
}

export interface ProcedureParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'none' | 'linear' | 'exponential';
  initialDelay: number;
}

export interface AlternativeStep {
  condition: string;
  step: ProcedureStep;
}

export interface ProcedureVariant {
  id: string;
  name: string;
  parentProcedureId: string;
  differences: ProcedureDifference[];
  applicability: ProcedureApplicability[];
}

export interface ProcedureDifference {
  type: 'step_modified' | 'step_added' | 'step_removed' | 'parameter_changed';
  stepOrder?: number;
  details: unknown;
}

export interface ProcedureStatistics {
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastExecuted?: Date;
  lastSucceeded?: Date;
}

// ----------------------------------------------------------------------------
// Memory Search & Consolidation
// ----------------------------------------------------------------------------

export interface MemorySearchConfig {
  /** Default search limit */
  defaultLimit: number;

  /** Minimum similarity score */
  minScore: number;

  /** Cross-tier search enabled */
  crossTierSearch: boolean;

  /** Search timeout (ms) */
  timeout: number;
}

export interface ConsolidationConfig {
  enabled: boolean;

  /** Trigger conditions */
  triggers: ConsolidationTrigger[];

  /** Consolidation strategy */
  strategy: 'importance' | 'frequency' | 'recency' | 'hybrid';
}

export interface ConsolidationTrigger {
  type: 'time_interval' | 'item_count' | 'importance_threshold';
  value: number;
}

export interface MemoryDecayConfig {
  enabled: boolean;

  /** Decay function */
  function: 'exponential' | 'linear' | 'step';

  /** Half-life for exponential decay (ms) */
  halfLife?: number;

  /** Minimum score before removal */
  removalThreshold: number;

  /** Items to preserve regardless of decay */
  preserveImportant: boolean;
}

// ============================================================================
// TOOL ORCHESTRATION PATTERNS
// ============================================================================

/**
 * Tool orchestration pattern types
 */
export type ToolOrchestrationPattern = 'manager' | 'handoff' | 'parallel' | 'pipeline';

// ----------------------------------------------------------------------------
// Manager Pattern
// ----------------------------------------------------------------------------

/**
 * Manager Pattern: Central orchestrator invokes specialized tools/agents
 */
export interface ManagerPatternConfig {
  type: 'manager';

  /** Manager agent ID */
  managerId: string;

  /** Worker agents/tools */
  workers: WorkerConfig[];

  /** Dispatch strategy */
  dispatchStrategy: 'round_robin' | 'capability_match' | 'load_balanced' | 'llm_decided';

  /** Aggregation strategy */
  aggregationStrategy: 'merge' | 'select_best' | 'voting' | 'llm_synthesize';

  /** Error handling */
  errorHandling: 'fail_fast' | 'skip_failed' | 'retry' | 'fallback';
}

export interface WorkerConfig {
  id: string;
  name: string;
  capabilities: string[];
  priority: number;
  maxConcurrent: number;
  timeout: number;
}

// ----------------------------------------------------------------------------
// Handoff Pattern
// ----------------------------------------------------------------------------

/**
 * Handoff Pattern: Peer agents transfer control to specialists
 */
export interface HandoffPatternConfig {
  type: 'handoff';

  /** Participating agents */
  agents: HandoffAgentConfig[];

  /** Handoff rules */
  rules: HandoffRule[];

  /** Context preservation strategy */
  contextPreservation: 'full' | 'summary' | 'selective';
}

export interface HandoffAgentConfig {
  id: string;
  name: string;
  expertise: string[];
  canHandoffTo: string[]; // Agent IDs
}

export interface HandoffRule {
  from: string | '*'; // Agent ID or wildcard
  to: string;
  condition: HandoffCondition;
  priority: number;
  contextTransform?: ContextTransform;
}

export interface HandoffCondition {
  type: 'keyword' | 'intent' | 'capability' | 'confidence' | 'custom';
  value: unknown;
  operator?: 'equals' | 'contains' | 'gt' | 'lt';
}

export interface ContextTransform {
  include: string[];
  exclude: string[];
  summarize: boolean;
  maxTokens?: number;
}

// ----------------------------------------------------------------------------
// Tool Selection
// ----------------------------------------------------------------------------

/**
 * Tool selection configuration
 */
export interface ToolSelectionConfig {
  /** Selection strategy */
  strategy: 'forced' | 'auto' | 'conditional' | 'fallback_chain';

  /** Forced tool (for 'forced' strategy) */
  forcedTool?: string;

  /** Conditional rules (for 'conditional' strategy) */
  conditionalRules?: ToolSelectionRule[];

  /** Fallback chain (for 'fallback_chain' strategy) */
  fallbackChain?: string[];

  /** Retry on tool failure */
  retryOnFailure: boolean;

  /** Maximum retries */
  maxRetries: number;
}

export interface ToolSelectionRule {
  condition: ToolCondition;
  tool: string;
  priority: number;
}

export interface ToolCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists';
  value: unknown;
}

// ============================================================================
// REFLECTION & CRITIQUE
// ============================================================================

// ----------------------------------------------------------------------------
// Reflection Loop
// ----------------------------------------------------------------------------

/**
 * Reflection loop configuration
 */
export interface ReflectionLoopConfig {
  enabled: boolean;

  /** Reflection triggers */
  triggers: ReflectionTrigger[];

  /** Reflection depth */
  depth: 'shallow' | 'medium' | 'deep';

  /** Maximum reflections per task */
  maxReflections: number;

  /** Store reflections in memory */
  storeInMemory: boolean;
}

export interface ReflectionTrigger {
  type: 'error' | 'low_confidence' | 'unexpected_result' | 'periodic' | 'completion';
  threshold?: number;
  interval?: number;
}

export interface Reflection {
  id: string;
  timestamp: Date;
  trigger: ReflectionTrigger;

  // Extrospection (what happened)
  execution: ExecutionSummary;
  outcomes: ReflectionOutcome[];
  deviations: ReflectionDeviation[];

  // Introspection (why it happened)
  causalAnalysis: CausalAnalysis;
  assumptions: ReflectionAssumption[];
  flaws: ReasoningFlaw[];

  // Synthesis
  lessons: ReflectionLesson[];
  recommendations: ReflectionRecommendation[];
  confidence: number;
}

export interface ExecutionSummary {
  taskId: string;
  steps: string[];
  duration: number;
  toolsUsed: string[];
  errorsEncountered: string[];
}

export interface ReflectionOutcome {
  type: 'success' | 'partial' | 'failure';
  description: string;
  expected: unknown;
  actual: unknown;
}

export interface ReflectionDeviation {
  expected: string;
  actual: string;
  impact: 'low' | 'medium' | 'high';
  explanation?: string;
}

export interface CausalAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  chain: string[];
  confidence: number;
}

export interface ReflectionAssumption {
  assumption: string;
  wasCorrect: boolean;
  impact: string;
}

export interface ReasoningFlaw {
  type: 'logical' | 'factual' | 'procedural' | 'contextual';
  description: string;
  location: string;
  severity: 'minor' | 'moderate' | 'severe';
}

export interface ReflectionLesson {
  insight: string;
  applicability: string[];
  confidence: number;
}

export interface ReflectionRecommendation {
  action: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
}

// ----------------------------------------------------------------------------
// Self-Critique
// ----------------------------------------------------------------------------

/**
 * Self-critique configuration
 */
export interface SelfCritiqueConfig {
  enabled: boolean;

  /** Critique method */
  method: 'constitutional' | 'rubric' | 'comparison' | 'multi_agent';

  /** Constitutional principles (for 'constitutional' method) */
  principles?: ConstitutionalPrinciple[];

  /** Rubric criteria (for 'rubric' method) */
  rubric?: RubricCriterion[];

  /** Number of critics (for 'multi_agent' method) */
  criticCount?: number;

  /** Revision iterations */
  maxRevisions: number;

  /** Quality threshold to pass */
  qualityThreshold: number;
}

export interface ConstitutionalPrinciple {
  id: string;
  name: string;
  description: string;
  severity: 'blocking' | 'warning' | 'suggestion';
  examples?: {
    violation: string;
    compliant: string;
  };
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  levels: RubricLevel[];
}

export interface RubricLevel {
  score: number;
  description: string;
  indicators: string[];
}

export interface CritiqueResult {
  passed: boolean;
  overallScore: number;
  criteriaResults: CriterionResult[];
  suggestions: string[];
  mustRevise: boolean;
}

export interface CriterionResult {
  criterionId: string;
  score: number;
  feedback: string;
  evidence?: string;
}

// ============================================================================
// UNCERTAINTY QUANTIFICATION
// ============================================================================

/**
 * Uncertainty quantification configuration
 */
export interface UncertaintyConfig {
  enabled: boolean;

  /** Estimation method */
  method: 'self_reported' | 'ensemble' | 'calibrated' | 'hybrid';

  /** Calibration data size */
  calibrationSize?: number;

  /** Confidence thresholds */
  thresholds: UncertaintyThresholds;

  /** Actions on uncertainty levels */
  actions: UncertaintyActions;
}

export interface UncertaintyThresholds {
  /** Below this, definitely uncertain */
  low: number;

  /** Below this, somewhat uncertain */
  medium: number;

  /** Above this, confident */
  high: number;
}

export interface UncertaintyActions {
  /** Action when confidence is low */
  onLowConfidence: UncertaintyAction;

  /** Action when confidence is medium */
  onMediumConfidence: UncertaintyAction;

  /** Action when sources conflict */
  onConflict: UncertaintyAction;
}

export type UncertaintyAction =
  | { type: 'continue' }
  | { type: 'flag'; message: string }
  | { type: 'research'; query: string }
  | { type: 'ask_user'; question: string }
  | { type: 'abort'; reason: string };

export interface ConfidenceEstimate {
  overall: number;
  components: ConfidenceComponents;
  sources: UncertaintySource[];
  explanation: string;
  recommendations: string[];
}

export interface ConfidenceComponents {
  /** Quality of retrieved context */
  retrieval: number;

  /** LLM output confidence */
  generation: number;

  /** Reasoning path confidence */
  reasoning: number;

  /** Evidence support level */
  grounding: number;
}

export interface UncertaintySource {
  type: UncertaintySourceType;
  severity: number;
  description: string;
  mitigation?: string;
}

export type UncertaintySourceType =
  | 'knowledge_gap'
  | 'ambiguous_input'
  | 'conflicting_evidence'
  | 'out_of_distribution'
  | 'temporal_uncertainty'
  | 'model_limitation';

// ============================================================================
// KNOWLEDGE GRAPHS
// ============================================================================

/**
 * Knowledge graph configuration
 */
export interface KnowledgeGraphConfig {
  enabled: boolean;

  /** Storage backend */
  backend: 'sqlite' | 'neo4j' | 'in_memory';

  /** Maximum entities */
  maxEntities: number;

  /** Maximum relationships */
  maxRelationships: number;

  /** Inference enabled */
  inferenceEnabled: boolean;

  /** Temporal tracking enabled */
  temporalEnabled: boolean;

  /** Consistency validation */
  validateConsistency: boolean;
}

export interface KGEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  temporal?: TemporalInfo;
  provenance: Provenance;
  confidence: number;
  embedding?: number[];
}

export interface KGRelation {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, unknown>;
  confidence: number;
  temporal?: TemporalInfo;
  provenance: Provenance;
  bidirectional: boolean;
}

export interface TemporalInfo {
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface KGQuery {
  /** Query pattern */
  pattern: KGQueryPattern;

  /** Constraints */
  constraints: KGConstraint[];

  /** Maximum hops for traversal */
  maxHops: number;

  /** Include inferred relationships */
  includeInferred: boolean;

  /** Return format */
  returnFormat: 'entities' | 'relations' | 'subgraph' | 'paths';
}

export interface KGQueryPattern {
  type: 'entity' | 'relation' | 'path' | 'subgraph';
  entityTypes?: string[];
  relationTypes?: string[];
  startEntity?: string;
  endEntity?: string;
}

export interface KGConstraint {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'in';
  value: unknown;
}

export interface KGQueryResult {
  entities: KGEntity[];
  relations: KGRelation[];
  paths?: KGPath[];
  inferred: number;
  duration: number;
}

export interface KGPath {
  entities: string[]; // Entity IDs
  relations: string[]; // Relation IDs
  length: number;
  confidence: number;
}

// ============================================================================
// CONSENSUS MECHANISMS
// ============================================================================

/**
 * Consensus protocol types
 */
export type ConsensusType =
  | 'majority'
  | 'supermajority'
  | 'unanimous'
  | 'weighted'
  | 'evidence_weighted'
  | 'hierarchical'
  | 'auction'
  | 'debate';

/**
 * Consensus configuration
 */
export interface ConsensusConfig {
  /** Protocol type */
  type: ConsensusType;

  /** Minimum participants */
  minParticipants: number;

  /** Quorum percentage (0-1) */
  quorum: number;

  /** Timeout for reaching consensus (ms) */
  timeout: number;

  /** Supermajority threshold (for 'supermajority') */
  supermajorityThreshold?: number;

  /** Weight function (for 'weighted') */
  weightFunction?: WeightFunction;

  /** Escalation on failure */
  onFailure: ConsensusFailureAction;
}

export type WeightFunction = 'expertise' | 'confidence' | 'historical_accuracy' | 'custom';

export type ConsensusFailureAction =
  | { type: 'retry'; maxRetries: number }
  | { type: 'escalate'; to: string }
  | { type: 'default'; value: unknown }
  | { type: 'abort' };

export interface ConsensusProposal {
  id: string;
  proposerId: string;
  content: unknown;
  deadline: Date;
  requiredQuorum: number;
}

export interface ConsensusVote {
  participantId: string;
  proposalId: string;
  decision: 'approve' | 'reject' | 'abstain';
  confidence: number;
  reasoning: string;
  evidence?: unknown[];
  weight?: number;
}

export interface ConsensusResult {
  proposalId: string;
  reached: boolean;
  decision?: 'approved' | 'rejected';
  votes: ConsensusVote[];
  participation: number;
  consensusStrength: number;
  dissent?: string[];
}

// ============================================================================
// SHAREABLE CONFIGURATION FORMAT
// ============================================================================

/**
 * Complete agent configuration - designed for easy sharing
 * Can be serialized to JSON or YAML
 */
export interface AgentConfig {
  /** Configuration format version */
  version: '1.0';

  /** Unique identifier for this config */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this config is for */
  description: string;

  /** Author/creator of this config */
  author?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Agent type this config applies to */
  agentType: AgentConfigType;

  /** Reasoning configuration */
  reasoning: ReasoningConfig;

  /** Memory configuration */
  memory: MemorySystemConfig;

  /** Tool configuration */
  tools: ToolConfig;

  /** Reflection configuration */
  reflection: ReflectionConfig;

  /** Uncertainty configuration */
  uncertainty: UncertaintyConfig;

  /** Knowledge graph configuration */
  knowledgeGraph?: KnowledgeGraphConfig;

  /** Consensus configuration (for multi-agent) */
  consensus?: ConsensusConfig;

  /** Gate/permission configuration */
  gates: GateConfig;

  /** Model configuration */
  model: ModelConfiguration;

  /** Custom extensions */
  extensions?: Record<string, unknown>;
}

export type AgentConfigType =
  | 'general'
  | 'code_review'
  | 'research'
  | 'planning'
  | 'verification'
  | 'documentation'
  | 'custom';

export interface ReasoningConfig {
  /** Primary reasoning pattern */
  primaryPattern: ReasoningPatternType;

  /** Pattern-specific configuration */
  patternConfig:
    | ChainOfThoughtConfig
    | TreeOfThoughtConfig
    | GraphOfThoughtConfig
    | AdaptiveGraphOfThoughtConfig
    | ReActConfig
    | ReflexionConfig;

  /** Fallback patterns */
  fallbackPatterns?: ReasoningPatternType[];
}

export interface ToolConfig {
  /** Enabled tools */
  enabledTools: string[];

  /** Tool-specific configs */
  toolConfigs: Record<string, Record<string, unknown>>;

  /** Orchestration pattern */
  orchestration: ToolOrchestrationPattern;

  /** Orchestration config */
  orchestrationConfig:
    | ManagerPatternConfig
    | HandoffPatternConfig;

  /** Selection config */
  selection: ToolSelectionConfig;
}

export interface ReflectionConfig {
  /** Reflection loop */
  loop: ReflectionLoopConfig;

  /** Self-critique */
  critique: SelfCritiqueConfig;
}

export interface GateConfig {
  /** Current gate level */
  level: 0 | 1 | 2 | 3;

  /** Custom gate overrides */
  overrides?: Partial<GateOverride>[];
}

export interface GateOverride {
  level: 0 | 1 | 2 | 3;
  additionalCapabilities?: string[];
  removedCapabilities?: string[];
  additionalRequirements?: string[];
}

export interface ModelConfiguration {
  /** Model provider */
  provider: 'anthropic' | 'openai' | 'google' | 'local' | 'custom';

  /** Model ID */
  modelId: string;

  /** Temperature */
  temperature: number;

  /** Max tokens */
  maxTokens: number;

  /** Top P */
  topP?: number;

  /** Frequency penalty */
  frequencyPenalty?: number;

  /** Presence penalty */
  presencePenalty?: number;

  /** Custom parameters */
  customParams?: Record<string, unknown>;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default Chain-of-Thought config
 */
export const DEFAULT_COT_CONFIG: ChainOfThoughtConfig = {
  type: 'chain-of-thought',
  maxSteps: 10,
  stepValidation: true,
  intermediateEvaluation: false,
  temperature: 0.7,
};

/**
 * Default Tree-of-Thought config
 */
export const DEFAULT_TOT_CONFIG: TreeOfThoughtConfig = {
  type: 'tree-of-thought',
  branchingFactor: 3,
  maxDepth: 4,
  searchStrategy: 'best-first',
  pruningThreshold: 0.3,
  evaluationMethod: 'self',
};

/**
 * Default Graph-of-Thought config
 */
export const DEFAULT_GOT_CONFIG: GraphOfThoughtConfig = {
  type: 'graph-of-thought',
  decompositionStrategy: 'hybrid',
  cacheEnabled: true,
  maxParallelism: 4,
  mergeStrategy: 'weighted',
};

/**
 * Default Memory System config
 */
export const DEFAULT_MEMORY_CONFIG: MemorySystemConfig = {
  working: {
    enabled: true,
    maxItems: 20,
    maxTokens: 4000,
    evictionStrategy: 'relevance',
    persistent: false,
  },
  episodic: {
    enabled: true,
    backend: 'sqlite',
    maxEpisodes: 1000,
    retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
    indexing: {
      temporal: true,
      contextual: true,
      semantic: true,
    },
  },
  semantic: {
    enabled: true,
    backend: 'hybrid',
    maxFacts: 10000,
    consistencyChecking: true,
    contradictionResolution: 'confidence',
  },
  procedural: {
    enabled: true,
    backend: 'sqlite',
    maxProcedures: 500,
    learningEnabled: true,
    recommendationThreshold: 0.7,
  },
  search: {
    defaultLimit: 10,
    minScore: 0.5,
    crossTierSearch: true,
    timeout: 5000,
  },
  consolidation: {
    enabled: true,
    triggers: [
      { type: 'time_interval', value: 3600000 }, // 1 hour
      { type: 'item_count', value: 100 },
    ],
    strategy: 'importance',
  },
  decay: {
    enabled: true,
    function: 'exponential',
    halfLife: 7 * 24 * 60 * 60 * 1000, // 7 days
    removalThreshold: 0.1,
    preserveImportant: true,
  },
};

/**
 * Default Uncertainty config
 */
export const DEFAULT_UNCERTAINTY_CONFIG: UncertaintyConfig = {
  enabled: true,
  method: 'hybrid',
  thresholds: {
    low: 0.3,
    medium: 0.6,
    high: 0.85,
  },
  actions: {
    onLowConfidence: { type: 'flag', message: 'Low confidence - verification recommended' },
    onMediumConfidence: { type: 'continue' },
    onConflict: { type: 'research', query: 'Resolve conflicting information' },
  },
};

/**
 * Default Reflection Loop config
 */
export const DEFAULT_REFLECTION_CONFIG: ReflectionLoopConfig = {
  enabled: true,
  triggers: [
    { type: 'error' },
    { type: 'low_confidence', threshold: 0.5 },
    { type: 'completion' },
  ],
  depth: 'medium',
  maxReflections: 3,
  storeInMemory: true,
};

/**
 * Default Self-Critique config
 */
export const DEFAULT_CRITIQUE_CONFIG: SelfCritiqueConfig = {
  enabled: true,
  method: 'rubric',
  maxRevisions: 2,
  qualityThreshold: 0.8,
  rubric: [
    {
      id: 'accuracy',
      name: 'Accuracy',
      description: 'Factual correctness of the output',
      weight: 0.3,
      levels: [
        { score: 0, description: 'Major factual errors', indicators: ['incorrect facts', 'hallucinations'] },
        { score: 0.5, description: 'Minor inaccuracies', indicators: ['small errors', 'imprecise'] },
        { score: 1, description: 'Fully accurate', indicators: ['verified', 'precise'] },
      ],
    },
    {
      id: 'completeness',
      name: 'Completeness',
      description: 'Coverage of all relevant aspects',
      weight: 0.25,
      levels: [
        { score: 0, description: 'Missing major aspects', indicators: ['incomplete', 'gaps'] },
        { score: 0.5, description: 'Partial coverage', indicators: ['some aspects covered'] },
        { score: 1, description: 'Comprehensive', indicators: ['all aspects', 'thorough'] },
      ],
    },
    {
      id: 'clarity',
      name: 'Clarity',
      description: 'Clear and understandable output',
      weight: 0.2,
      levels: [
        { score: 0, description: 'Confusing', indicators: ['unclear', 'ambiguous'] },
        { score: 0.5, description: 'Mostly clear', indicators: ['some unclear parts'] },
        { score: 1, description: 'Crystal clear', indicators: ['easy to understand', 'well-structured'] },
      ],
    },
    {
      id: 'relevance',
      name: 'Relevance',
      description: 'Addresses the actual question/task',
      weight: 0.25,
      levels: [
        { score: 0, description: 'Off-topic', indicators: ['unrelated', 'tangential'] },
        { score: 0.5, description: 'Partially relevant', indicators: ['some relevant content'] },
        { score: 1, description: 'Directly relevant', indicators: ['on-point', 'focused'] },
      ],
    },
  ],
};

/**
 * Create a minimal starter config
 */
export function createStarterConfig(
  name: string,
  agentType: AgentConfigType = 'general'
): AgentConfig {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    id: `config-${Date.now()}`,
    name,
    description: `${agentType} agent configuration`,
    createdAt: now,
    updatedAt: now,
    agentType,
    reasoning: {
      primaryPattern: 'chain-of-thought',
      patternConfig: DEFAULT_COT_CONFIG,
    },
    memory: DEFAULT_MEMORY_CONFIG,
    tools: {
      enabledTools: [],
      toolConfigs: {},
      orchestration: 'manager',
      orchestrationConfig: {
        type: 'manager',
        managerId: 'main',
        workers: [],
        dispatchStrategy: 'capability_match',
        aggregationStrategy: 'merge',
        errorHandling: 'retry',
      },
      selection: {
        strategy: 'auto',
        retryOnFailure: true,
        maxRetries: 2,
      },
    },
    reflection: {
      loop: DEFAULT_REFLECTION_CONFIG,
      critique: DEFAULT_CRITIQUE_CONFIG,
    },
    uncertainty: DEFAULT_UNCERTAINTY_CONFIG,
    gates: {
      level: 1, // Propose-only by default
    },
    model: {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      maxTokens: 4096,
    },
  };
}
