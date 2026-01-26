/**
 * @fileoverview Prebuilt Agent Formulations
 *
 * This module provides ready-to-use agent configurations for common use cases:
 *
 * 1. **Code Review Agent** - Multi-stage code analysis and review
 * 2. **Research Agent** - Agentic RAG with iterative retrieval
 * 3. **Planning Agent** - HTN-based hierarchical planning
 * 4. **Verification Agent** - Multi-level code verification
 * 5. **Documentation Agent** - Automated documentation generation
 * 6. **Refactoring Agent** - Safe code transformation
 * 7. **Bug Fix Agent** - Diagnosis and repair
 * 8. **Test Generation Agent** - Comprehensive test creation
 *
 * Each formulation includes:
 * - Complete workflow definition
 * - Stage configurations
 * - Tool requirements
 * - Quality gates
 * - Output specifications
 *
 * @packageDocumentation
 */

import type { Provenance, ConfidenceLevel } from './types.js';
import type {
  AgentConfig,
  ReasoningPatternType,
  ChainOfThoughtConfig,
  TreeOfThoughtConfig,
  ReActConfig,
  MemorySystemConfig,
  ReflectionLoopConfig,
  SelfCritiqueConfig,
  UncertaintyConfig,
  ToolSelectionConfig,
  DEFAULT_MEMORY_CONFIG,
  DEFAULT_UNCERTAINTY_CONFIG,
  DEFAULT_REFLECTION_CONFIG,
  DEFAULT_CRITIQUE_CONFIG,
} from './building_blocks.js';

// ============================================================================
// WORKFLOW PRIMITIVES
// ============================================================================

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Step identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** What this step does */
  action: string;

  /** Description for logging/debugging */
  description?: string;

  /** Can this step run in parallel with siblings? */
  parallel: boolean;

  /** Sub-steps (for compound steps) */
  substeps?: WorkflowStep[];

  /** Is this step recursive? */
  recursive?: boolean;

  /** Condition for executing this step */
  conditional?: string;

  /** Loop configuration */
  loop?: LoopConfig;

  /** Required tools for this step */
  requiredTools?: string[];

  /** Expected outputs */
  outputs?: OutputSpec[];

  /** Timeout for this step (ms) */
  timeout?: number;

  /** Retry configuration */
  retry?: RetryConfig;
}

export interface LoopConfig {
  /** Loop condition */
  condition: string;

  /** Maximum iterations */
  maxIterations: number;

  /** Break conditions */
  breakConditions?: string[];
}

export interface RetryConfig {
  maxAttempts: number;
  backoffType: 'none' | 'linear' | 'exponential';
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface OutputSpec {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition {
  /** Workflow identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Version */
  version: string;

  /** Description */
  description: string;

  /** Workflow steps */
  steps: WorkflowStep[];

  /** Global timeout (ms) */
  timeout?: number;

  /** Input specification */
  inputs: InputSpec[];

  /** Output specification */
  outputs: OutputSpec[];

  /** Quality gates */
  qualityGates?: QualityGate[];

  /** Error handling */
  errorHandling: WorkflowErrorHandling;
}

export interface InputSpec {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  validation?: string;
}

export interface QualityGate {
  name: string;
  description: string;
  afterStep: string;
  check: QualityCheck;
  onFailure: QualityFailureAction;
}

export interface QualityCheck {
  type: 'threshold' | 'presence' | 'custom';
  metric?: string;
  threshold?: number;
  customCheck?: string;
}

export type QualityFailureAction =
  | { type: 'abort'; message: string }
  | { type: 'retry'; maxAttempts: number }
  | { type: 'warn'; message: string }
  | { type: 'skip' };

export type WorkflowErrorHandling =
  | { type: 'fail_fast' }
  | { type: 'continue_on_error'; logLevel: string }
  | { type: 'retry'; config: RetryConfig }
  | { type: 'fallback'; fallbackWorkflow: string };

// ============================================================================
// AGENT FORMULATION BASE
// ============================================================================

/**
 * Base agent formulation
 */
export interface AgentFormulation {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Version */
  version: string;

  /** Description */
  description: string;

  /** Tags for categorization */
  tags: string[];

  /** Workflow definition */
  workflow: WorkflowDefinition;

  /** Agent configuration */
  config: AgentConfig;

  /** Required capabilities */
  requiredCapabilities: string[];

  /** Recommended tools */
  recommendedTools: ToolRecommendation[];

  /** Example usage */
  examples?: FormulationExample[];

  /** Known limitations */
  limitations?: string[];
}

export interface ToolRecommendation {
  name: string;
  purpose: string;
  required: boolean;
  alternatives?: string[];
}

export interface FormulationExample {
  name: string;
  input: unknown;
  expectedOutput: unknown;
  description: string;
}

// ============================================================================
// CODE REVIEW AGENT
// ============================================================================

/**
 * Code Review Agent Formulation
 *
 * Multi-stage code review with parallel analysis:
 * Code Input → [Style, Security, Performance, Design] → Aggregation → Report
 */
export interface CodeReviewFormulation extends AgentFormulation {
  /** Analyzer configurations */
  analyzers: CodeAnalyzerConfig[];

  /** Review focus areas */
  focusAreas: CodeReviewFocusArea[];

  /** Severity configuration */
  severityConfig: SeverityConfig;

  /** Report configuration */
  reportConfig: ReviewReportConfig;
}

export interface CodeAnalyzerConfig {
  id: string;
  name: string;
  enabled: boolean;
  weight: number;
  config: Record<string, unknown>;
}

export type CodeReviewFocusArea =
  | 'style'
  | 'security'
  | 'performance'
  | 'design'
  | 'logic'
  | 'maintainability'
  | 'testability'
  | 'documentation';

export interface SeverityConfig {
  levels: SeverityLevel[];
  defaultLevel: string;
  escalationRules: EscalationRule[];
}

export interface SeverityLevel {
  id: string;
  name: string;
  priority: number;
  color: string;
  requiresAction: boolean;
}

export interface EscalationRule {
  condition: string;
  fromLevel: string;
  toLevel: string;
}

export interface ReviewReportConfig {
  format: 'markdown' | 'json' | 'html';
  includeSuggestions: boolean;
  includeExamples: boolean;
  maxIssuesPerCategory: number;
  groupBy: 'severity' | 'category' | 'file';
}

/**
 * Code Review Workflow Definition
 */
export const CODE_REVIEW_WORKFLOW: WorkflowDefinition = {
  id: 'code-review-workflow',
  name: 'Code Review',
  version: '1.0.0',
  description: 'Multi-stage code review with parallel analysis',
  inputs: [
    { name: 'code', type: 'string', required: true, description: 'Code to review' },
    { name: 'context', type: 'object', required: false, description: 'Additional context' },
    { name: 'focusAreas', type: 'array', required: false, description: 'Areas to focus on' },
  ],
  outputs: [
    { name: 'report', type: 'CodeReviewReport', required: true, description: 'Review report' },
    { name: 'issues', type: 'array', required: true, description: 'Found issues' },
    { name: 'suggestions', type: 'array', required: false, description: 'Improvement suggestions' },
  ],
  steps: [
    {
      id: 'parse',
      name: 'Parse Code',
      action: 'Parse code into AST and extract metadata',
      parallel: false,
      requiredTools: ['ast_parser'],
      outputs: [
        { name: 'ast', type: 'AST', required: true },
        { name: 'metadata', type: 'CodeMetadata', required: true },
      ],
    },
    {
      id: 'analyze',
      name: 'Analyze Code',
      action: 'Run all enabled analyzers in parallel',
      parallel: true,
      substeps: [
        {
          id: 'style',
          name: 'Style Analysis',
          action: 'Check code style and formatting',
          parallel: true,
          requiredTools: ['linter'],
        },
        {
          id: 'security',
          name: 'Security Analysis',
          action: 'Scan for security vulnerabilities',
          parallel: true,
          requiredTools: ['security_scanner'],
        },
        {
          id: 'performance',
          name: 'Performance Analysis',
          action: 'Identify performance issues',
          parallel: true,
          requiredTools: ['performance_profiler'],
        },
        {
          id: 'design',
          name: 'Design Analysis',
          action: 'Check design patterns and architecture',
          parallel: true,
        },
        {
          id: 'logic',
          name: 'Logic Analysis',
          action: 'Verify logical correctness',
          parallel: true,
        },
      ],
    },
    {
      id: 'aggregate',
      name: 'Aggregate Findings',
      action: 'Combine and deduplicate findings from all analyzers',
      parallel: false,
      outputs: [
        { name: 'allIssues', type: 'array', required: true },
      ],
    },
    {
      id: 'prioritize',
      name: 'Prioritize Issues',
      action: 'Rank issues by severity and impact',
      parallel: false,
      outputs: [
        { name: 'prioritizedIssues', type: 'array', required: true },
      ],
    },
    {
      id: 'suggest',
      name: 'Generate Suggestions',
      action: 'Create fix suggestions for issues',
      parallel: false,
      conditional: 'config.includeSuggestions',
      outputs: [
        { name: 'suggestions', type: 'array', required: false },
      ],
    },
    {
      id: 'report',
      name: 'Generate Report',
      action: 'Format and output final review report',
      parallel: false,
      outputs: [
        { name: 'report', type: 'CodeReviewReport', required: true },
      ],
    },
  ],
  qualityGates: [
    {
      name: 'Parse Success',
      description: 'Code must parse successfully',
      afterStep: 'parse',
      check: { type: 'presence', metric: 'ast' },
      onFailure: { type: 'abort', message: 'Failed to parse code' },
    },
    {
      name: 'Analysis Complete',
      description: 'At least 80% of analyzers must complete',
      afterStep: 'analyze',
      check: { type: 'threshold', metric: 'analyzerCompletionRate', threshold: 0.8 },
      onFailure: { type: 'warn', message: 'Some analyzers failed' },
    },
  ],
  errorHandling: { type: 'continue_on_error', logLevel: 'warn' },
  timeout: 300000, // 5 minutes
};

/**
 * Default Code Review Agent Configuration
 */
export const CODE_REVIEW_FORMULATION: CodeReviewFormulation = {
  id: 'code-review-agent',
  name: 'Code Review Agent',
  version: '1.0.0',
  description: 'Comprehensive code review with multi-dimensional analysis',
  tags: ['code', 'review', 'quality', 'security'],
  workflow: CODE_REVIEW_WORKFLOW,
  config: {
    version: '1.0',
    id: 'code-review-config',
    name: 'Code Review Agent Config',
    description: 'Configuration for code review agent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agentType: 'code_review',
    reasoning: {
      primaryPattern: 'chain-of-thought',
      patternConfig: {
        type: 'chain-of-thought',
        maxSteps: 8,
        stepValidation: true,
        intermediateEvaluation: true,
      },
    },
    memory: {
      working: { enabled: true, maxItems: 50, maxTokens: 8000, evictionStrategy: 'relevance', persistent: false },
      episodic: { enabled: true, backend: 'sqlite', maxEpisodes: 500, retentionPeriod: 7 * 24 * 60 * 60 * 1000, indexing: { temporal: true, contextual: true, semantic: false } },
      semantic: { enabled: true, backend: 'sqlite', maxFacts: 5000, consistencyChecking: true, contradictionResolution: 'recency' },
      procedural: { enabled: true, backend: 'sqlite', maxProcedures: 100, learningEnabled: true, recommendationThreshold: 0.75 },
      search: { defaultLimit: 10, minScore: 0.5, crossTierSearch: true, timeout: 5000 },
      consolidation: { enabled: true, triggers: [{ type: 'item_count', value: 50 }], strategy: 'importance' },
      decay: { enabled: true, function: 'exponential', halfLife: 3 * 24 * 60 * 60 * 1000, removalThreshold: 0.1, preserveImportant: true },
    },
    tools: {
      enabledTools: ['ast_parser', 'linter', 'security_scanner', 'grep', 'read_file'],
      toolConfigs: {},
      orchestration: 'manager',
      orchestrationConfig: {
        type: 'manager',
        managerId: 'code-review-manager',
        workers: [
          { id: 'style-analyzer', name: 'Style Analyzer', capabilities: ['lint', 'format'], priority: 1, maxConcurrent: 1, timeout: 30000 },
          { id: 'security-analyzer', name: 'Security Analyzer', capabilities: ['security_scan'], priority: 1, maxConcurrent: 1, timeout: 60000 },
          { id: 'performance-analyzer', name: 'Performance Analyzer', capabilities: ['profile'], priority: 2, maxConcurrent: 1, timeout: 60000 },
        ],
        dispatchStrategy: 'capability_match',
        aggregationStrategy: 'merge',
        errorHandling: 'skip_failed',
      },
      selection: { strategy: 'auto', retryOnFailure: true, maxRetries: 2 },
    },
    reflection: {
      loop: { enabled: true, triggers: [{ type: 'completion' }], depth: 'shallow', maxReflections: 1, storeInMemory: true },
      critique: { enabled: true, method: 'rubric', maxRevisions: 1, qualityThreshold: 0.7 },
    },
    uncertainty: {
      enabled: true,
      method: 'self_reported',
      thresholds: { low: 0.4, medium: 0.7, high: 0.9 },
      actions: {
        onLowConfidence: { type: 'flag', message: 'Low confidence in this finding' },
        onMediumConfidence: { type: 'continue' },
        onConflict: { type: 'flag', message: 'Conflicting analysis results' },
      },
    },
    gates: { level: 1 },
    model: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', temperature: 0.3, maxTokens: 4096 },
  },
  requiredCapabilities: ['code_analysis', 'pattern_matching'],
  recommendedTools: [
    { name: 'ast_parser', purpose: 'Parse code into AST', required: true },
    { name: 'linter', purpose: 'Check code style', required: false, alternatives: ['eslint', 'pylint'] },
    { name: 'security_scanner', purpose: 'Scan for vulnerabilities', required: false },
  ],
  analyzers: [
    { id: 'style', name: 'Style Analyzer', enabled: true, weight: 0.15, config: {} },
    { id: 'security', name: 'Security Analyzer', enabled: true, weight: 0.25, config: {} },
    { id: 'performance', name: 'Performance Analyzer', enabled: true, weight: 0.20, config: {} },
    { id: 'design', name: 'Design Analyzer', enabled: true, weight: 0.20, config: {} },
    { id: 'logic', name: 'Logic Analyzer', enabled: true, weight: 0.20, config: {} },
  ],
  focusAreas: ['style', 'security', 'performance', 'design', 'logic'],
  severityConfig: {
    levels: [
      { id: 'critical', name: 'Critical', priority: 1, color: 'red', requiresAction: true },
      { id: 'major', name: 'Major', priority: 2, color: 'orange', requiresAction: true },
      { id: 'minor', name: 'Minor', priority: 3, color: 'yellow', requiresAction: false },
      { id: 'info', name: 'Info', priority: 4, color: 'blue', requiresAction: false },
    ],
    defaultLevel: 'info',
    escalationRules: [
      { condition: 'securityVulnerability', fromLevel: 'minor', toLevel: 'major' },
      { condition: 'dataLeak', fromLevel: 'major', toLevel: 'critical' },
    ],
  },
  reportConfig: {
    format: 'markdown',
    includeSuggestions: true,
    includeExamples: true,
    maxIssuesPerCategory: 10,
    groupBy: 'severity',
  },
  limitations: [
    'Cannot execute code - static analysis only',
    'May miss context-dependent issues',
    'Security analysis is not exhaustive',
  ],
};

// ============================================================================
// RESEARCH AGENT
// ============================================================================

/**
 * Research Agent Formulation
 *
 * Agentic RAG with iterative retrieval and verification:
 * Query → Plan → Retrieve (iterative) → Reason → Verify → Report
 */
export interface ResearchFormulation extends AgentFormulation {
  /** Research sources */
  sources: ResearchSource[];

  /** Verification configuration */
  verificationConfig: ResearchVerificationConfig;

  /** Citation configuration */
  citationConfig: CitationConfig;

  /** Depth configuration */
  depthConfig: ResearchDepthConfig;
}

export interface ResearchSource {
  id: string;
  name: string;
  type: 'web' | 'database' | 'file' | 'api' | 'knowledge_graph';
  priority: number;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface ResearchVerificationConfig {
  enabled: boolean;
  methods: ('cross_reference' | 'source_authority' | 'fact_check' | 'consensus')[];
  minSources: number;
  conflictResolution: 'majority' | 'authority' | 'recency' | 'manual';
}

export interface CitationConfig {
  style: 'inline' | 'footnote' | 'endnote';
  format: 'apa' | 'mla' | 'chicago' | 'custom';
  includeAccessDate: boolean;
  verifyLinks: boolean;
}

export interface ResearchDepthConfig {
  maxIterations: number;
  confidenceThreshold: number;
  maxSources: number;
  exploreBreadth: number; // How many tangential topics to explore
}

/**
 * Research Workflow Definition
 */
export const RESEARCH_WORKFLOW: WorkflowDefinition = {
  id: 'research-workflow',
  name: 'Research',
  version: '1.0.0',
  description: 'Agentic RAG with iterative retrieval and verification',
  inputs: [
    { name: 'query', type: 'string', required: true, description: 'Research query' },
    { name: 'context', type: 'object', required: false, description: 'Additional context' },
    { name: 'depth', type: 'string', required: false, description: 'Research depth: shallow, medium, deep' },
  ],
  outputs: [
    { name: 'report', type: 'ResearchReport', required: true, description: 'Research report' },
    { name: 'findings', type: 'array', required: true, description: 'Key findings' },
    { name: 'sources', type: 'array', required: true, description: 'Source citations' },
    { name: 'gaps', type: 'array', required: false, description: 'Knowledge gaps identified' },
  ],
  steps: [
    {
      id: 'decompose',
      name: 'Decompose Query',
      action: 'Break query into sub-questions',
      parallel: false,
      outputs: [
        { name: 'subQuestions', type: 'array', required: true },
      ],
    },
    {
      id: 'plan',
      name: 'Create Research Plan',
      action: 'Plan research strategy and source priority',
      parallel: false,
      outputs: [
        { name: 'researchPlan', type: 'ResearchPlan', required: true },
      ],
    },
    {
      id: 'retrieve',
      name: 'Iterative Retrieval',
      action: 'Retrieve information with feedback loop',
      parallel: false,
      loop: {
        condition: 'confidence < threshold && iterations < max',
        maxIterations: 5,
        breakConditions: ['allQuestionsAnswered', 'noNewInformation'],
      },
      outputs: [
        { name: 'retrievedInfo', type: 'array', required: true },
      ],
    },
    {
      id: 'reason',
      name: 'Synthesize Findings',
      action: 'Reason over retrieved information',
      parallel: false,
      outputs: [
        { name: 'synthesis', type: 'string', required: true },
        { name: 'findings', type: 'array', required: true },
      ],
    },
    {
      id: 'verify',
      name: 'Verify Facts',
      action: 'Cross-reference and fact-check key claims',
      parallel: true,
      conditional: 'config.verificationEnabled',
      outputs: [
        { name: 'verifiedClaims', type: 'array', required: true },
        { name: 'unverifiedClaims', type: 'array', required: false },
      ],
    },
    {
      id: 'identify_gaps',
      name: 'Identify Gaps',
      action: 'Note unanswered questions and knowledge gaps',
      parallel: false,
      outputs: [
        { name: 'gaps', type: 'array', required: false },
      ],
    },
    {
      id: 'report',
      name: 'Generate Report',
      action: 'Create formatted research report',
      parallel: false,
      outputs: [
        { name: 'report', type: 'ResearchReport', required: true },
      ],
    },
  ],
  qualityGates: [
    {
      name: 'Sufficient Sources',
      description: 'Must have minimum number of sources',
      afterStep: 'retrieve',
      check: { type: 'threshold', metric: 'sourceCount', threshold: 3 },
      onFailure: { type: 'retry', maxAttempts: 2 },
    },
    {
      name: 'Verification Threshold',
      description: 'Key claims must be verified',
      afterStep: 'verify',
      check: { type: 'threshold', metric: 'verificationRate', threshold: 0.7 },
      onFailure: { type: 'warn', message: 'Some claims could not be verified' },
    },
  ],
  errorHandling: { type: 'continue_on_error', logLevel: 'warn' },
  timeout: 600000, // 10 minutes
};

/**
 * Default Research Agent Configuration
 */
export const RESEARCH_FORMULATION: ResearchFormulation = {
  id: 'research-agent',
  name: 'Research Agent',
  version: '1.0.0',
  description: 'Agentic RAG with iterative retrieval and fact verification',
  tags: ['research', 'rag', 'retrieval', 'verification'],
  workflow: RESEARCH_WORKFLOW,
  config: {
    version: '1.0',
    id: 'research-config',
    name: 'Research Agent Config',
    description: 'Configuration for research agent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agentType: 'research',
    reasoning: {
      primaryPattern: 'react',
      patternConfig: {
        type: 'react',
        maxIterations: 10,
        tools: [],
        observationProcessing: 'structured',
        stopConditions: [
          { type: 'confidence_threshold', value: 0.85 },
          { type: 'max_iterations' },
        ],
      },
    },
    memory: {
      working: { enabled: true, maxItems: 100, maxTokens: 16000, evictionStrategy: 'relevance', persistent: false },
      episodic: { enabled: true, backend: 'sqlite', maxEpisodes: 1000, retentionPeriod: 30 * 24 * 60 * 60 * 1000, indexing: { temporal: true, contextual: true, semantic: true } },
      semantic: { enabled: true, backend: 'knowledge_graph', maxFacts: 20000, consistencyChecking: true, contradictionResolution: 'confidence' },
      procedural: { enabled: true, backend: 'sqlite', maxProcedures: 200, learningEnabled: true, recommendationThreshold: 0.7 },
      search: { defaultLimit: 20, minScore: 0.4, crossTierSearch: true, timeout: 10000 },
      consolidation: { enabled: true, triggers: [{ type: 'time_interval', value: 1800000 }], strategy: 'importance' },
      decay: { enabled: true, function: 'exponential', halfLife: 14 * 24 * 60 * 60 * 1000, removalThreshold: 0.05, preserveImportant: true },
    },
    tools: {
      enabledTools: ['web_search', 'web_fetch', 'read_file', 'grep', 'knowledge_graph_query'],
      toolConfigs: {},
      orchestration: 'manager',
      orchestrationConfig: {
        type: 'manager',
        managerId: 'research-manager',
        workers: [
          { id: 'searcher', name: 'Search Agent', capabilities: ['search', 'retrieve'], priority: 1, maxConcurrent: 3, timeout: 30000 },
          { id: 'reader', name: 'Reader Agent', capabilities: ['read', 'summarize'], priority: 2, maxConcurrent: 2, timeout: 60000 },
          { id: 'verifier', name: 'Verifier Agent', capabilities: ['verify', 'fact_check'], priority: 3, maxConcurrent: 2, timeout: 45000 },
        ],
        dispatchStrategy: 'capability_match',
        aggregationStrategy: 'llm_synthesize',
        errorHandling: 'skip_failed',
      },
      selection: { strategy: 'conditional', retryOnFailure: true, maxRetries: 3 },
    },
    reflection: {
      loop: { enabled: true, triggers: [{ type: 'low_confidence', threshold: 0.6 }, { type: 'completion' }], depth: 'medium', maxReflections: 2, storeInMemory: true },
      critique: { enabled: true, method: 'constitutional', maxRevisions: 2, qualityThreshold: 0.75, principles: [
        { id: 'accuracy', name: 'Accuracy', description: 'Information must be accurate and verified', severity: 'blocking' },
        { id: 'citation', name: 'Citation', description: 'All facts must be properly cited', severity: 'warning' },
        { id: 'completeness', name: 'Completeness', description: 'Research should be comprehensive', severity: 'suggestion' },
      ] },
    },
    uncertainty: {
      enabled: true,
      method: 'hybrid',
      thresholds: { low: 0.3, medium: 0.6, high: 0.85 },
      actions: {
        onLowConfidence: { type: 'research', query: 'Find additional sources to verify this claim' },
        onMediumConfidence: { type: 'flag', message: 'Medium confidence - additional verification recommended' },
        onConflict: { type: 'research', query: 'Resolve conflicting information from sources' },
      },
    },
    knowledgeGraph: {
      enabled: true,
      backend: 'sqlite',
      maxEntities: 10000,
      maxRelationships: 50000,
      inferenceEnabled: true,
      temporalEnabled: true,
      validateConsistency: true,
    },
    gates: { level: 0 },
    model: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', temperature: 0.5, maxTokens: 8192 },
  },
  requiredCapabilities: ['web_search', 'text_processing', 'reasoning'],
  recommendedTools: [
    { name: 'web_search', purpose: 'Search the web for information', required: true },
    { name: 'web_fetch', purpose: 'Fetch and read web pages', required: true },
    { name: 'knowledge_graph_query', purpose: 'Query knowledge graphs', required: false },
  ],
  sources: [
    { id: 'web', name: 'Web Search', type: 'web', priority: 1, config: {}, enabled: true },
    { id: 'kg', name: 'Knowledge Graph', type: 'knowledge_graph', priority: 2, config: {}, enabled: true },
    { id: 'docs', name: 'Documentation', type: 'file', priority: 3, config: {}, enabled: true },
  ],
  verificationConfig: {
    enabled: true,
    methods: ['cross_reference', 'source_authority'],
    minSources: 2,
    conflictResolution: 'authority',
  },
  citationConfig: {
    style: 'inline',
    format: 'custom',
    includeAccessDate: true,
    verifyLinks: false,
  },
  depthConfig: {
    maxIterations: 5,
    confidenceThreshold: 0.85,
    maxSources: 20,
    exploreBreadth: 2,
  },
  limitations: [
    'Cannot access paywalled content',
    'Web search may have rate limits',
    'Knowledge may be outdated',
  ],
};

// ============================================================================
// PLANNING AGENT
// ============================================================================

/**
 * Planning Agent Formulation
 *
 * HTN-based hierarchical planning:
 * Goals → Decompose (HTN) → Select Methods → Plan → Validate → Execute
 */
export interface PlanningFormulation extends AgentFormulation {
  /** Method library */
  methodLibrary: MethodDefinition[];

  /** Planning constraints */
  constraints: PlanningConstraint[];

  /** Contingency configuration */
  contingencyConfig: ContingencyConfig;
}

export interface MethodDefinition {
  id: string;
  name: string;
  description: string;
  applicability: MethodApplicability[];
  preconditions: string[];
  effects: string[];
  subtasks: SubtaskDefinition[];
}

export interface MethodApplicability {
  taskType: string;
  conditions: string[];
}

export interface SubtaskDefinition {
  id: string;
  type: 'primitive' | 'compound';
  name: string;
  parameters: string[];
}

export interface PlanningConstraint {
  id: string;
  type: 'temporal' | 'resource' | 'dependency' | 'custom';
  description: string;
  constraint: string;
}

export interface ContingencyConfig {
  enabled: boolean;
  failureModes: FailureMode[];
  recoveryStrategies: RecoveryStrategy[];
}

export interface FailureMode {
  id: string;
  description: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
}

export interface RecoveryStrategy {
  failureModeId: string;
  strategy: string;
  steps: string[];
}

/**
 * Planning Workflow Definition
 */
export const PLANNING_WORKFLOW: WorkflowDefinition = {
  id: 'planning-workflow',
  name: 'Planning',
  version: '1.0.0',
  description: 'HTN-based hierarchical task planning',
  inputs: [
    { name: 'goal', type: 'string', required: true, description: 'Goal to achieve' },
    { name: 'context', type: 'object', required: false, description: 'Current state and constraints' },
    { name: 'resources', type: 'array', required: false, description: 'Available resources' },
  ],
  outputs: [
    { name: 'plan', type: 'Plan', required: true, description: 'Generated plan' },
    { name: 'tasks', type: 'array', required: true, description: 'Ordered task list' },
    { name: 'contingencies', type: 'array', required: false, description: 'Contingency plans' },
  ],
  steps: [
    {
      id: 'analyze-goal',
      name: 'Analyze Goal',
      action: 'Understand goal and extract requirements',
      parallel: false,
      outputs: [
        { name: 'requirements', type: 'array', required: true },
        { name: 'constraints', type: 'array', required: true },
      ],
    },
    {
      id: 'decompose',
      name: 'HTN Decomposition',
      action: 'Decompose goal into task hierarchy',
      parallel: false,
      recursive: true,
      outputs: [
        { name: 'taskNetwork', type: 'TaskNetwork', required: true },
      ],
    },
    {
      id: 'select-methods',
      name: 'Select Methods',
      action: 'Choose methods for compound tasks',
      parallel: false,
      outputs: [
        { name: 'methodSelections', type: 'array', required: true },
      ],
    },
    {
      id: 'order',
      name: 'Order Tasks',
      action: 'Establish execution ordering',
      parallel: false,
      outputs: [
        { name: 'orderedTasks', type: 'array', required: true },
      ],
    },
    {
      id: 'allocate',
      name: 'Allocate Resources',
      action: 'Assign resources to tasks',
      parallel: false,
      conditional: 'resources.length > 0',
      outputs: [
        { name: 'resourceAllocations', type: 'array', required: false },
      ],
    },
    {
      id: 'validate',
      name: 'Validate Plan',
      action: 'Check plan feasibility and constraints',
      parallel: false,
      outputs: [
        { name: 'validationResult', type: 'ValidationResult', required: true },
      ],
    },
    {
      id: 'contingencies',
      name: 'Plan Contingencies',
      action: 'Create contingency plans for failures',
      parallel: false,
      conditional: 'config.contingencyEnabled',
      outputs: [
        { name: 'contingencies', type: 'array', required: false },
      ],
    },
  ],
  qualityGates: [
    {
      name: 'Decomposition Complete',
      description: 'All compound tasks must be decomposed',
      afterStep: 'decompose',
      check: { type: 'custom', customCheck: 'allTasksDecomposed' },
      onFailure: { type: 'retry', maxAttempts: 3 },
    },
    {
      name: 'Plan Valid',
      description: 'Plan must pass validation',
      afterStep: 'validate',
      check: { type: 'presence', metric: 'validationResult.valid' },
      onFailure: { type: 'abort', message: 'Plan validation failed' },
    },
  ],
  errorHandling: { type: 'retry', config: { maxAttempts: 3, backoffType: 'exponential', initialDelayMs: 1000, maxDelayMs: 10000 } },
  timeout: 180000, // 3 minutes
};

/**
 * Default Planning Agent Configuration
 */
export const PLANNING_FORMULATION: PlanningFormulation = {
  id: 'planning-agent',
  name: 'Planning Agent',
  version: '1.0.0',
  description: 'HTN-based hierarchical task planning with contingencies',
  tags: ['planning', 'htn', 'task', 'decomposition'],
  workflow: PLANNING_WORKFLOW,
  config: {
    version: '1.0',
    id: 'planning-config',
    name: 'Planning Agent Config',
    description: 'Configuration for planning agent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agentType: 'planning',
    reasoning: {
      primaryPattern: 'tree-of-thought',
      patternConfig: {
        type: 'tree-of-thought',
        branchingFactor: 3,
        maxDepth: 5,
        searchStrategy: 'best-first',
        pruningThreshold: 0.4,
        evaluationMethod: 'self',
      },
    },
    memory: {
      working: { enabled: true, maxItems: 30, maxTokens: 6000, evictionStrategy: 'priority', persistent: false },
      episodic: { enabled: true, backend: 'sqlite', maxEpisodes: 300, retentionPeriod: 14 * 24 * 60 * 60 * 1000, indexing: { temporal: true, contextual: true, semantic: false } },
      semantic: { enabled: true, backend: 'sqlite', maxFacts: 3000, consistencyChecking: true, contradictionResolution: 'recency' },
      procedural: { enabled: true, backend: 'sqlite', maxProcedures: 300, learningEnabled: true, recommendationThreshold: 0.8 },
      search: { defaultLimit: 10, minScore: 0.5, crossTierSearch: true, timeout: 5000 },
      consolidation: { enabled: true, triggers: [{ type: 'item_count', value: 30 }], strategy: 'frequency' },
      decay: { enabled: true, function: 'linear', removalThreshold: 0.2, preserveImportant: true },
    },
    tools: {
      enabledTools: ['task_decomposer', 'constraint_solver', 'resource_allocator'],
      toolConfigs: {},
      orchestration: 'pipeline',
      orchestrationConfig: {
        type: 'manager',
        managerId: 'planning-manager',
        workers: [],
        dispatchStrategy: 'llm_decided',
        aggregationStrategy: 'merge',
        errorHandling: 'fail_fast',
      },
      selection: { strategy: 'auto', retryOnFailure: true, maxRetries: 2 },
    },
    reflection: {
      loop: { enabled: true, triggers: [{ type: 'completion' }], depth: 'deep', maxReflections: 1, storeInMemory: true },
      critique: { enabled: true, method: 'rubric', maxRevisions: 2, qualityThreshold: 0.8 },
    },
    uncertainty: {
      enabled: true,
      method: 'self_reported',
      thresholds: { low: 0.4, medium: 0.7, high: 0.9 },
      actions: {
        onLowConfidence: { type: 'ask_user', question: 'Multiple approaches possible. Which do you prefer?' },
        onMediumConfidence: { type: 'continue' },
        onConflict: { type: 'ask_user', question: 'Conflicting constraints detected. Please clarify.' },
      },
    },
    gates: { level: 1 },
    model: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', temperature: 0.4, maxTokens: 4096 },
  },
  requiredCapabilities: ['reasoning', 'decomposition', 'constraint_satisfaction'],
  recommendedTools: [
    { name: 'task_decomposer', purpose: 'Decompose compound tasks', required: true },
    { name: 'constraint_solver', purpose: 'Validate constraints', required: false },
  ],
  methodLibrary: [
    {
      id: 'sequential',
      name: 'Sequential Execution',
      description: 'Execute tasks one after another',
      applicability: [{ taskType: '*', conditions: ['ordered_execution'] }],
      preconditions: ['all_tasks_defined'],
      effects: ['tasks_completed_in_order'],
      subtasks: [],
    },
    {
      id: 'parallel',
      name: 'Parallel Execution',
      description: 'Execute independent tasks concurrently',
      applicability: [{ taskType: '*', conditions: ['no_dependencies'] }],
      preconditions: ['tasks_independent'],
      effects: ['tasks_completed'],
      subtasks: [],
    },
  ],
  constraints: [
    { id: 'temporal', type: 'temporal', description: 'Task ordering constraints', constraint: 'ordered' },
    { id: 'resource', type: 'resource', description: 'Resource availability', constraint: 'available' },
  ],
  contingencyConfig: {
    enabled: true,
    failureModes: [
      { id: 'task_failure', description: 'Task execution fails', probability: 0.1, impact: 'medium' },
      { id: 'resource_unavailable', description: 'Required resource unavailable', probability: 0.05, impact: 'high' },
    ],
    recoveryStrategies: [
      { failureModeId: 'task_failure', strategy: 'retry', steps: ['retry_task', 'use_alternative'] },
      { failureModeId: 'resource_unavailable', strategy: 'substitute', steps: ['find_alternative_resource'] },
    ],
  },
  limitations: [
    'Cannot handle real-time dynamic changes',
    'Limited to predefined method library',
  ],
};

// ============================================================================
// VERIFICATION AGENT
// ============================================================================

/**
 * Verification Agent Formulation
 *
 * Multi-level verification with optional formal methods:
 * Code → Tests → Execute → Analyze → Prove (optional) → Report
 */
export interface VerificationFormulation extends AgentFormulation {
  /** Verification levels */
  levels: VerificationLevel[];

  /** Coverage configuration */
  coverageConfig: CoverageConfig;

  /** Formal verification config */
  formalConfig?: FormalVerificationConfig;

  /** Property specifications */
  properties: PropertySpec[];
}

export interface VerificationLevel {
  id: string;
  name: string;
  order: number;
  required: boolean;
  tools: string[];
}

export interface CoverageConfig {
  lineThreshold: number;
  branchThreshold: number;
  functionThreshold: number;
  enforceThresholds: boolean;
}

export interface FormalVerificationConfig {
  enabled: boolean;
  prover: 'lean4' | 'coq' | 'z3' | 'dafny';
  timeout: number;
  proofLevel: 'partial' | 'complete';
}

export interface PropertySpec {
  id: string;
  name: string;
  type: 'invariant' | 'precondition' | 'postcondition' | 'temporal';
  expression: string;
  description: string;
}

/**
 * Verification Workflow Definition
 */
export const VERIFICATION_WORKFLOW: WorkflowDefinition = {
  id: 'verification-workflow',
  name: 'Verification',
  version: '1.0.0',
  description: 'Multi-level code verification',
  inputs: [
    { name: 'code', type: 'string', required: true, description: 'Code to verify' },
    { name: 'specifications', type: 'array', required: false, description: 'Property specifications' },
    { name: 'levels', type: 'array', required: false, description: 'Verification levels to apply' },
  ],
  outputs: [
    { name: 'report', type: 'VerificationReport', required: true, description: 'Verification report' },
    { name: 'coverage', type: 'CoverageReport', required: true, description: 'Coverage metrics' },
    { name: 'issues', type: 'array', required: false, description: 'Found issues' },
    { name: 'proofs', type: 'array', required: false, description: 'Formal proofs (if enabled)' },
  ],
  steps: [
    {
      id: 'parse',
      name: 'Parse Code',
      action: 'Parse and understand code structure',
      parallel: false,
    },
    {
      id: 'generate-tests',
      name: 'Generate Tests',
      action: 'Generate test cases from code and specs',
      parallel: false,
    },
    {
      id: 'static-analysis',
      name: 'Static Analysis',
      action: 'Run static analyzers',
      parallel: true,
    },
    {
      id: 'execute-tests',
      name: 'Execute Tests',
      action: 'Run test suite',
      parallel: false,
    },
    {
      id: 'analyze-coverage',
      name: 'Analyze Coverage',
      action: 'Compute coverage metrics',
      parallel: false,
    },
    {
      id: 'formal-verify',
      name: 'Formal Verification',
      action: 'Apply formal methods',
      parallel: false,
      conditional: 'config.formalEnabled',
    },
    {
      id: 'report',
      name: 'Generate Report',
      action: 'Create verification report',
      parallel: false,
    },
  ],
  qualityGates: [
    {
      name: 'Tests Pass',
      description: 'All tests must pass',
      afterStep: 'execute-tests',
      check: { type: 'threshold', metric: 'testPassRate', threshold: 1.0 },
      onFailure: { type: 'abort', message: 'Tests failed' },
    },
    {
      name: 'Coverage Met',
      description: 'Coverage thresholds must be met',
      afterStep: 'analyze-coverage',
      check: { type: 'threshold', metric: 'coverageScore', threshold: 0.8 },
      onFailure: { type: 'warn', message: 'Coverage threshold not met' },
    },
  ],
  errorHandling: { type: 'continue_on_error', logLevel: 'warn' },
  timeout: 600000, // 10 minutes
};

/**
 * Default Verification Agent Configuration
 */
export const VERIFICATION_FORMULATION: VerificationFormulation = {
  id: 'verification-agent',
  name: 'Verification Agent',
  version: '1.0.0',
  description: 'Multi-level code verification with optional formal methods',
  tags: ['verification', 'testing', 'formal', 'coverage'],
  workflow: VERIFICATION_WORKFLOW,
  config: {
    version: '1.0',
    id: 'verification-config',
    name: 'Verification Agent Config',
    description: 'Configuration for verification agent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agentType: 'verification',
    reasoning: {
      primaryPattern: 'chain-of-thought',
      patternConfig: {
        type: 'chain-of-thought',
        maxSteps: 12,
        stepValidation: true,
        intermediateEvaluation: true,
      },
    },
    memory: {
      working: { enabled: true, maxItems: 40, maxTokens: 8000, evictionStrategy: 'relevance', persistent: false },
      episodic: { enabled: true, backend: 'sqlite', maxEpisodes: 500, retentionPeriod: 14 * 24 * 60 * 60 * 1000, indexing: { temporal: true, contextual: true, semantic: false } },
      semantic: { enabled: true, backend: 'sqlite', maxFacts: 5000, consistencyChecking: true, contradictionResolution: 'recency' },
      procedural: { enabled: true, backend: 'sqlite', maxProcedures: 150, learningEnabled: true, recommendationThreshold: 0.75 },
      search: { defaultLimit: 10, minScore: 0.5, crossTierSearch: true, timeout: 5000 },
      consolidation: { enabled: true, triggers: [{ type: 'item_count', value: 40 }], strategy: 'importance' },
      decay: { enabled: true, function: 'exponential', halfLife: 7 * 24 * 60 * 60 * 1000, removalThreshold: 0.1, preserveImportant: true },
    },
    tools: {
      enabledTools: ['test_runner', 'coverage_analyzer', 'static_analyzer', 'test_generator'],
      toolConfigs: {},
      orchestration: 'pipeline',
      orchestrationConfig: {
        type: 'manager',
        managerId: 'verification-manager',
        workers: [],
        dispatchStrategy: 'capability_match',
        aggregationStrategy: 'merge',
        errorHandling: 'skip_failed',
      },
      selection: { strategy: 'auto', retryOnFailure: true, maxRetries: 2 },
    },
    reflection: {
      loop: { enabled: true, triggers: [{ type: 'error' }, { type: 'completion' }], depth: 'medium', maxReflections: 2, storeInMemory: true },
      critique: { enabled: true, method: 'rubric', maxRevisions: 1, qualityThreshold: 0.85 },
    },
    uncertainty: {
      enabled: true,
      method: 'self_reported',
      thresholds: { low: 0.3, medium: 0.7, high: 0.9 },
      actions: {
        onLowConfidence: { type: 'flag', message: 'Verification incomplete - manual review recommended' },
        onMediumConfidence: { type: 'continue' },
        onConflict: { type: 'flag', message: 'Conflicting verification results' },
      },
    },
    gates: { level: 2 },
    model: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', temperature: 0.2, maxTokens: 4096 },
  },
  requiredCapabilities: ['code_analysis', 'test_execution', 'coverage_analysis'],
  recommendedTools: [
    { name: 'test_runner', purpose: 'Execute test suites', required: true },
    { name: 'coverage_analyzer', purpose: 'Compute coverage metrics', required: true },
    { name: 'test_generator', purpose: 'Generate test cases', required: false },
  ],
  levels: [
    { id: 'syntax', name: 'Syntax Check', order: 1, required: true, tools: ['parser'] },
    { id: 'type', name: 'Type Check', order: 2, required: true, tools: ['type_checker'] },
    { id: 'lint', name: 'Lint', order: 3, required: false, tools: ['linter'] },
    { id: 'unit-test', name: 'Unit Tests', order: 4, required: true, tools: ['test_runner'] },
    { id: 'coverage', name: 'Coverage', order: 5, required: true, tools: ['coverage_analyzer'] },
  ],
  coverageConfig: {
    lineThreshold: 0.8,
    branchThreshold: 0.7,
    functionThreshold: 0.9,
    enforceThresholds: false,
  },
  properties: [
    { id: 'no-nulls', name: 'No Null Returns', type: 'postcondition', expression: 'result !== null', description: 'Functions should not return null' },
  ],
  limitations: [
    'Cannot verify runtime behavior fully',
    'Formal verification may timeout on complex code',
  ],
};

// ============================================================================
// DOCUMENTATION AGENT
// ============================================================================

/**
 * Documentation Agent Formulation
 *
 * Multi-agent documentation generation:
 * Code → Read → Search → Write → Verify → Output
 */
export interface DocumentationFormulation extends AgentFormulation {
  /** Documentation types to generate */
  documentationTypes: DocumentationType[];

  /** Output configuration */
  outputConfig: DocumentationOutputConfig;

  /** Style configuration */
  styleConfig: DocumentationStyleConfig;
}

export type DocumentationType =
  | 'api'
  | 'architecture'
  | 'tutorial'
  | 'howto'
  | 'explanation'
  | 'reference'
  | 'readme'
  | 'changelog';

export interface DocumentationOutputConfig {
  format: 'markdown' | 'html' | 'rst' | 'asciidoc';
  outputDir: string;
  singleFile: boolean;
  includeTableOfContents: boolean;
  includeDiagrams: boolean;
}

export interface DocumentationStyleConfig {
  tone: 'formal' | 'casual' | 'technical';
  audienceLevel: 'beginner' | 'intermediate' | 'expert';
  includeExamples: boolean;
  maxExamplesPerSection: number;
}

/**
 * Documentation Workflow Definition
 */
export const DOCUMENTATION_WORKFLOW: WorkflowDefinition = {
  id: 'documentation-workflow',
  name: 'Documentation',
  version: '1.0.0',
  description: 'Multi-agent documentation generation',
  inputs: [
    { name: 'codebase', type: 'string', required: true, description: 'Path to codebase' },
    { name: 'types', type: 'array', required: false, description: 'Documentation types to generate' },
    { name: 'existingDocs', type: 'string', required: false, description: 'Path to existing docs' },
  ],
  outputs: [
    { name: 'documentation', type: 'Documentation', required: true, description: 'Generated documentation' },
    { name: 'files', type: 'array', required: true, description: 'Generated files' },
  ],
  steps: [
    {
      id: 'read',
      name: 'Read Codebase',
      action: 'Extract code context and structure',
      parallel: false,
    },
    {
      id: 'search',
      name: 'Discover Patterns',
      action: 'Find patterns, APIs, and relationships',
      parallel: false,
    },
    {
      id: 'plan',
      name: 'Plan Structure',
      action: 'Plan documentation structure',
      parallel: false,
    },
    {
      id: 'write',
      name: 'Generate Content',
      action: 'Write documentation sections',
      parallel: true,
    },
    {
      id: 'verify',
      name: 'Verify Accuracy',
      action: 'Check documentation accuracy',
      parallel: false,
    },
    {
      id: 'format',
      name: 'Format Output',
      action: 'Apply formatting and styling',
      parallel: false,
    },
  ],
  qualityGates: [
    {
      name: 'Code Parsed',
      description: 'Codebase must be successfully parsed',
      afterStep: 'read',
      check: { type: 'presence', metric: 'codeContext' },
      onFailure: { type: 'abort', message: 'Failed to parse codebase' },
    },
  ],
  errorHandling: { type: 'continue_on_error', logLevel: 'warn' },
  timeout: 900000, // 15 minutes
};

/**
 * Default Documentation Agent Configuration
 */
export const DOCUMENTATION_FORMULATION: DocumentationFormulation = {
  id: 'documentation-agent',
  name: 'Documentation Agent',
  version: '1.0.0',
  description: 'Automated documentation generation from code',
  tags: ['documentation', 'api', 'readme', 'technical-writing'],
  workflow: DOCUMENTATION_WORKFLOW,
  config: {
    version: '1.0',
    id: 'documentation-config',
    name: 'Documentation Agent Config',
    description: 'Configuration for documentation agent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agentType: 'documentation',
    reasoning: {
      primaryPattern: 'chain-of-thought',
      patternConfig: {
        type: 'chain-of-thought',
        maxSteps: 10,
        stepValidation: true,
        intermediateEvaluation: false,
      },
    },
    memory: {
      working: { enabled: true, maxItems: 60, maxTokens: 12000, evictionStrategy: 'relevance', persistent: false },
      episodic: { enabled: true, backend: 'sqlite', maxEpisodes: 200, retentionPeriod: 7 * 24 * 60 * 60 * 1000, indexing: { temporal: false, contextual: true, semantic: true } },
      semantic: { enabled: true, backend: 'hybrid', maxFacts: 8000, consistencyChecking: false, contradictionResolution: 'recency' },
      procedural: { enabled: true, backend: 'sqlite', maxProcedures: 50, learningEnabled: true, recommendationThreshold: 0.7 },
      search: { defaultLimit: 15, minScore: 0.4, crossTierSearch: true, timeout: 5000 },
      consolidation: { enabled: true, triggers: [{ type: 'item_count', value: 50 }], strategy: 'importance' },
      decay: { enabled: true, function: 'exponential', halfLife: 3 * 24 * 60 * 60 * 1000, removalThreshold: 0.15, preserveImportant: true },
    },
    tools: {
      enabledTools: ['code_reader', 'pattern_detector', 'markdown_formatter', 'diagram_generator'],
      toolConfigs: {},
      orchestration: 'manager',
      orchestrationConfig: {
        type: 'manager',
        managerId: 'doc-manager',
        workers: [
          { id: 'reader', name: 'Reader Agent', capabilities: ['read', 'parse'], priority: 1, maxConcurrent: 1, timeout: 60000 },
          { id: 'searcher', name: 'Searcher Agent', capabilities: ['search', 'pattern'], priority: 2, maxConcurrent: 1, timeout: 45000 },
          { id: 'writer', name: 'Writer Agent', capabilities: ['write', 'format'], priority: 3, maxConcurrent: 3, timeout: 120000 },
          { id: 'verifier', name: 'Verifier Agent', capabilities: ['verify', 'check'], priority: 4, maxConcurrent: 1, timeout: 60000 },
        ],
        dispatchStrategy: 'capability_match',
        aggregationStrategy: 'merge',
        errorHandling: 'skip_failed',
      },
      selection: { strategy: 'auto', retryOnFailure: true, maxRetries: 2 },
    },
    reflection: {
      loop: { enabled: true, triggers: [{ type: 'completion' }], depth: 'shallow', maxReflections: 1, storeInMemory: false },
      critique: { enabled: true, method: 'rubric', maxRevisions: 2, qualityThreshold: 0.75 },
    },
    uncertainty: {
      enabled: true,
      method: 'self_reported',
      thresholds: { low: 0.4, medium: 0.7, high: 0.85 },
      actions: {
        onLowConfidence: { type: 'flag', message: 'Documentation may be incomplete - review recommended' },
        onMediumConfidence: { type: 'continue' },
        onConflict: { type: 'flag', message: 'Inconsistent code patterns detected' },
      },
    },
    gates: { level: 1 },
    model: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', temperature: 0.5, maxTokens: 8192 },
  },
  requiredCapabilities: ['code_reading', 'text_generation', 'formatting'],
  recommendedTools: [
    { name: 'code_reader', purpose: 'Read and parse code', required: true },
    { name: 'pattern_detector', purpose: 'Find code patterns', required: false },
    { name: 'diagram_generator', purpose: 'Generate diagrams', required: false },
  ],
  documentationTypes: ['api', 'readme', 'architecture'],
  outputConfig: {
    format: 'markdown',
    outputDir: './docs',
    singleFile: false,
    includeTableOfContents: true,
    includeDiagrams: false,
  },
  styleConfig: {
    tone: 'technical',
    audienceLevel: 'intermediate',
    includeExamples: true,
    maxExamplesPerSection: 3,
  },
  limitations: [
    'May miss undocumented behavior',
    'Examples are generated, not tested',
  ],
};

// ============================================================================
// FORMULATION REGISTRY
// ============================================================================

/**
 * Registry of all available formulations
 */
export const FORMULATION_REGISTRY: Record<string, AgentFormulation> = {
  'code-review': CODE_REVIEW_FORMULATION,
  'research': RESEARCH_FORMULATION,
  'planning': PLANNING_FORMULATION,
  'verification': VERIFICATION_FORMULATION,
  'documentation': DOCUMENTATION_FORMULATION,
};

/**
 * Get a formulation by ID
 */
export function getFormulation(id: string): AgentFormulation | undefined {
  return FORMULATION_REGISTRY[id];
}

/**
 * List all available formulations
 */
export function listFormulations(): Array<{ id: string; name: string; description: string; tags: string[] }> {
  return Object.entries(FORMULATION_REGISTRY).map(([id, formulation]) => ({
    id,
    name: formulation.name,
    description: formulation.description,
    tags: formulation.tags,
  }));
}

/**
 * Create a customized formulation based on an existing one
 */
export function customizeFormulation(
  baseId: string,
  customizations: Partial<AgentFormulation>
): AgentFormulation {
  const base = getFormulation(baseId);
  if (!base) {
    throw new Error(`Unknown formulation: ${baseId}`);
  }

  return {
    ...base,
    ...customizations,
    id: customizations.id || `${base.id}-custom`,
    config: {
      ...base.config,
      ...(customizations.config || {}),
    } as AgentConfig,
  };
}
