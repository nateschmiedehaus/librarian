/**
 * @fileoverview Strategic Knowledge Types
 *
 * Core types for the Strategic Knowledge Architecture:
 * - Project Vision and Strategic Context
 * - Bounded Contexts (DDD)
 * - Quality Dimensions
 * - Research and Knowledge Confidence
 *
 * These types form the foundation for deep project understanding
 * beyond just code indexing.
 */

// ============================================================================
// CONFIDENCE AND PROVENANCE
// ============================================================================

/**
 * Knowledge confidence levels with clear semantic meaning.
 * These are NOT arbitrary - each level has specific implications
 * for how the knowledge should be used.
 */
export type ConfidenceLevel =
  | 'verified'      // 0.9-1.0: Multiple authoritative sources, production-tested
  | 'established'   // 0.7-0.9: Single authoritative source, consistent
  | 'probable'      // 0.5-0.7: Inferred from patterns, RESEARCH RECOMMENDED
  | 'speculative'   // 0.3-0.5: LLM inference, RESEARCH REQUIRED
  | 'unknown';      // <0.3: No information, MUST RESEARCH

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  score: number;                // 0.0 - 1.0
  factors: ConfidenceFactor[];
  lastAssessed: string;         // ISO timestamp
  assessedBy: 'human' | 'automated' | 'llm' | 'system';
}

export interface ConfidenceFactor {
  name: string;
  contribution: number;         // How much this affects confidence
  evidence: string;
  quality: 'strong' | 'moderate' | 'weak';
}

/**
 * Provenance tracks where knowledge came from.
 * Critical for research-first architecture.
 */
export interface Provenance {
  sources: KnowledgeSource[];
  derivedFrom?: string[];       // IDs of knowledge this was derived from
  createdAt: string;
  createdBy: string;
  lastVerified?: string;
  verificationMethod?: 'manual' | 'automated' | 'cross-reference' | 'production';
}

export interface KnowledgeSource {
  type: 'code' | 'documentation' | 'external_url' | 'research_paper' |
        'expert_input' | 'llm_inference' | 'pattern_detection' | 'user_input';
  identifier: string;           // URL, file path, paper DOI, etc.
  title?: string;
  author?: string;
  publishedAt?: string;
  retrievedAt: string;
  authority: SourceAuthority;
  relevanceScore: number;       // 0-1, how relevant to this knowledge
}

export type SourceAuthority =
  | 'authoritative'   // Official docs, RFCs, peer-reviewed
  | 'expert'          // Recognized expert, major conference
  | 'community'       // Well-regarded community content
  | 'unverified';     // Unknown quality

// ============================================================================
// PROJECT VISION AND STRATEGY
// ============================================================================

/**
 * ProjectVision captures the high-level "why" of a project.
 * This is the most strategic level of understanding.
 */
export interface ProjectVision {
  id: string;
  version: number;              // Incremented on changes

  // Core Identity
  name: string;
  mission: string;              // One-sentence purpose (max 100 chars)
  problemStatement: string;     // What problem does this solve? (paragraph)
  valueProposition: string;     // Why choose this over alternatives?

  // Target Audience
  targetUsers: TargetUser[];
  stakeholders: Stakeholder[];

  // Strategic Direction
  pillars: StrategicPillar[];   // 3-5 core strategic themes
  constraints: Constraint[];     // Non-negotiables
  antiPatterns: AntiPattern[];   // What this project explicitly avoids
  successCriteria: SuccessCriterion[];

  // Quality Model (project-specific weights)
  qualityWeights: QualityWeights;

  // Temporal
  horizon: 'short' | 'medium' | 'long';  // Planning horizon
  roadmapPhase?: string;        // Current roadmap phase

  // Confidence and Provenance
  confidence: ConfidenceAssessment;
  provenance: Provenance;

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
  reviewedBy?: string;
}

export interface TargetUser {
  persona: string;              // e.g., "Backend Developer"
  description: string;
  needs: string[];
  painPoints: string[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  technicalLevel: 'novice' | 'intermediate' | 'expert';
}

export interface Stakeholder {
  role: string;                 // e.g., "Engineering Manager"
  interests: string[];
  successMetrics: string[];
  communicationPreference: 'detailed' | 'summary' | 'metrics-only';
}

export interface StrategicPillar {
  id: string;
  name: string;                 // e.g., "Developer Experience"
  description: string;
  priority: 1 | 2 | 3;          // 1 = highest
  rationale: string;            // Why this is important
  metrics: SuccessMetric[];
  relatedContexts: string[];    // Bounded context IDs
  relatedFiles: string[];       // Key implementation files
  confidence: ConfidenceAssessment;
}

export interface Constraint {
  id: string;
  type: 'technical' | 'business' | 'regulatory' | 'resource' | 'time';
  name: string;
  description: string;
  severity: 'hard' | 'soft';    // Hard = absolutely must follow
  rationale: string;
  source?: string;              // Where this constraint comes from
  expiresAt?: string;           // Some constraints are temporary
  exceptions: ConstraintException[];
}

export interface ConstraintException {
  context: string;              // When the exception applies
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rationale: string;
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  whyBad: string;               // Specific reasons to avoid
  alternatives: string[];       // What to do instead
  examples: AntiPatternExample[];
}

export interface AntiPatternExample {
  bad: string;                  // Example of what NOT to do
  good: string;                 // Example of what TO do
  explanation: string;
}

export interface SuccessCriterion {
  id: string;
  name: string;
  description: string;
  metric: SuccessMetric;
  weight: number;               // How important (0-1)
  evaluation: 'automated' | 'manual' | 'hybrid';
}

export interface SuccessMetric {
  name: string;
  type: 'quantitative' | 'qualitative' | 'boolean';
  currentValue?: number | string | boolean;
  targetValue: number | string | boolean;
  unit?: string;
  direction: 'higher-better' | 'lower-better' | 'target' | 'boolean';
  measuredAt?: string;
  measurementMethod: string;
}

// ============================================================================
// QUALITY DIMENSIONS
// ============================================================================

/**
 * Quality weights define how the project values different quality attributes.
 * Sum should be ~1.0 but doesn't have to be exact.
 */
export interface QualityWeights {
  // Core Engineering (typically ~0.4 total)
  correctness: number;          // Bug-free, meets requirements
  reliability: number;          // Consistent, predictable behavior
  security: number;             // Protection from threats
  performance: number;          // Speed, efficiency

  // Maintainability (typically ~0.3 total)
  readability: number;          // Code clarity
  testability: number;          // Ease of testing
  modularity: number;           // Good separation of concerns
  extensibility: number;        // Ease of adding features

  // Operational (typically ~0.2 total)
  observability: number;        // Logging, monitoring
  deployability: number;        // CI/CD, infrastructure
  documentation: number;        // Docs quality

  // User-Facing (typically ~0.1 total)
  userExperience: number;       // End-user satisfaction
  accessibility: number;        // Accessible to all users

  // Project-specific custom dimensions
  custom: CustomQualityDimension[];
}

export interface CustomQualityDimension {
  name: string;
  weight: number;
  description: string;
  measurementCriteria: string[];
}

/**
 * Default quality weights - can be customized per project
 */
export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  correctness: 0.15,
  reliability: 0.10,
  security: 0.10,
  performance: 0.08,
  readability: 0.10,
  testability: 0.08,
  modularity: 0.07,
  extensibility: 0.05,
  observability: 0.07,
  deployability: 0.05,
  documentation: 0.05,
  userExperience: 0.05,
  accessibility: 0.05,
  custom: [],
};

// ============================================================================
// BOUNDED CONTEXTS (DDD)
// ============================================================================

/**
 * BoundedContext represents a semantic boundary where terms have specific meanings.
 * Critical for preventing "Big Ball of Mud" in agentic systems.
 */
export interface BoundedContext {
  id: string;
  name: string;                 // e.g., "Authentication", "Billing"
  description: string;

  // Boundaries
  boundaries: ContextBoundary;

  // Language (DDD Ubiquitous Language)
  ubiquitousLanguage: Term[];

  // Relationships with other contexts
  relationships: ContextRelationship[];

  // Ownership and governance
  ownership: ContextOwnership;

  // Technical details
  implementation: ContextImplementation;

  // Health and quality
  health: ContextHealth;

  // Confidence and provenance
  confidence: ConfidenceAssessment;
  provenance: Provenance;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ContextBoundary {
  directories: string[];        // Directories that belong here
  entryPoints: string[];        // Public API files
  internalModules: string[];    // Private implementation
  excludedPaths: string[];      // Explicitly not part of this context

  // Conceptual boundaries
  responsibilities: string[];   // What this context is responsible for
  notResponsibleFor: string[]; // Explicit exclusions
}

export interface Term {
  term: string;
  definition: string;
  examples: TermExample[];
  aliases: string[];            // Other names for same concept
  notToBe: string[];            // Terms this is NOT (disambiguation)
  relatedTerms: string[];
  source?: string;              // Where this term is defined
}

export interface TermExample {
  usage: string;
  context: string;
  codeExample?: string;
}

export interface ContextRelationship {
  targetContextId: string;
  type: ContextRelationType;
  description: string;
  integrationMechanism: IntegrationMechanism;
  dataFlows: DataFlow[];
  contracts: Contract[];
}

export type ContextRelationType =
  | 'upstream'              // This context depends on target
  | 'downstream'            // Target depends on this context
  | 'partnership'           // Mutual collaboration
  | 'shared-kernel'         // Shared code/models
  | 'customer-supplier'     // Clear provider/consumer
  | 'conformist'            // Must adapt to target's model
  | 'anticorruption-layer'  // Translation layer between
  | 'separate-ways';        // No integration

export interface IntegrationMechanism {
  type: 'api' | 'events' | 'shared-db' | 'files' | 'queue' | 'none';
  protocol?: string;            // REST, gRPC, etc.
  format?: string;              // JSON, protobuf, etc.
  location?: string;            // Where integration happens
}

export interface DataFlow {
  name: string;
  direction: 'in' | 'out' | 'bidirectional';
  dataType: string;
  frequency: 'real-time' | 'batch' | 'on-demand' | 'scheduled';
  sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
}

export interface Contract {
  type: 'api' | 'event' | 'schema';
  name: string;
  version: string;
  location: string;             // File path or URL
  breaking: boolean;            // Would changes be breaking?
  consumers: string[];          // Who depends on this
}

export interface ContextOwnership {
  team?: string;
  owners: string[];             // Primary contacts
  decisionAuthority: 'team' | 'architect' | 'consensus' | 'product';
  escalationPath: string[];
  communicationChannels: string[];
}

export interface ContextImplementation {
  primaryLanguage: string;
  frameworks: string[];
  patterns: string[];           // Design patterns used
  datastores: string[];
  externalDependencies: ExternalDependency[];
}

export interface ExternalDependency {
  name: string;
  version: string;
  type: 'library' | 'service' | 'api' | 'database';
  critical: boolean;            // Is this a critical dependency?
  lastUpdated?: string;
  knownIssues?: string[];
}

export interface ContextHealth {
  overallScore: number;         // 0-100
  dimensions: {
    codeQuality: number;
    testCoverage: number;
    documentation: number;
    dependencyHealth: number;
    boundaryIntegrity: number;  // Are boundaries being respected?
  };
  issues: ContextIssue[];
  lastAssessed: string;
}

export interface ContextIssue {
  type: 'boundary-violation' | 'dependency-issue' | 'documentation-gap' |
        'test-coverage' | 'language-inconsistency' | 'performance';
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  location?: string;
  suggestedFix?: string;
}

// ============================================================================
// RESEARCH AND EXTERNAL KNOWLEDGE
// ============================================================================

/**
 * Research depth determines how thorough investigation should be.
 * Matches stakes to effort.
 */
export type ResearchDepth =
  | 'quick'        // 1-2 sources, <1 min, low-stakes
  | 'standard'     // 3-5 sources, <5 min, typical decisions
  | 'thorough'     // 5-10 sources, <15 min, important decisions
  | 'exhaustive';  // Unlimited, critical/irreversible decisions

/**
 * Research trigger defines when research should happen.
 */
export interface ResearchTrigger {
  id: string;
  name: string;
  condition: ResearchCondition;
  urgency: 'blocking' | 'recommended' | 'opportunistic';
  suggestedDepth: ResearchDepth;
  rationale: string;
}

export type ResearchCondition =
  | { type: 'confidence_below'; threshold: number }
  | { type: 'knowledge_age_exceeds'; days: number }
  | { type: 'concept_unknown' }
  | { type: 'version_drift'; dependency: string }
  | { type: 'security_relevant' }
  | { type: 'performance_critical' }
  | { type: 'breaking_change' }
  | { type: 'external_dependency_changed' }
  | { type: 'manual_request' };

/**
 * Research query for external knowledge retrieval.
 */
export interface ResearchQuery {
  id: string;
  question: string;
  context: string;              // Why we need to know
  depth: ResearchDepth;
  domains: string[];            // e.g., ['security', 'performance']
  constraints: ResearchConstraints;
  relatedWorkId?: string;       // Work item this research supports
  requestedAt: string;
  requestedBy: string;
}

export interface ResearchConstraints {
  maxAge?: string;              // e.g., '2 years'
  sourceTypes?: KnowledgeSource['type'][];
  minAuthority?: SourceAuthority;
  requiredSources?: string[];   // Must include these sources
  excludedSources?: string[];   // Must not use these sources
  languages?: string[];         // Programming languages if relevant
  platforms?: string[];         // Platforms if relevant
}

/**
 * Research result from external knowledge retrieval.
 */
export interface ResearchResult {
  id: string;
  query: ResearchQuery;
  status: 'complete' | 'partial' | 'failed' | 'in_progress';

  // Findings
  findings: ResearchFinding[];
  synthesis: ResearchSynthesis;

  // Quality assessment
  quality: ResearchQualityAssessment;

  // Gaps and follow-ups
  gaps: KnowledgeGap[];
  followUpQueries: string[];
  recommendations: string[];

  // Metadata
  completedAt: string;
  durationMs: number;
  sourcesConsulted: number;
}

export interface ResearchFinding {
  id: string;
  source: KnowledgeSource;
  content: string;
  relevance: number;            // 0-1
  confidence: number;           // 0-1
  supports?: string;            // What claim this supports
  contradicts?: string;         // What claim this contradicts
  extractedFacts: ExtractedFact[];
}

export interface ExtractedFact {
  statement: string;
  confidence: number;
  type: 'fact' | 'opinion' | 'recommendation' | 'warning' | 'example';
  applicability: 'general' | 'context-specific';
}

export interface ResearchSynthesis {
  summary: string;              // Main takeaways (1-2 paragraphs)
  keyFindings: string[];        // Bullet points of key findings
  consensus: string;            // What sources agree on
  disagreements: string[];      // Where sources differ
  confidence: number;           // Overall confidence in synthesis
  limitations: string[];        // Caveats and limitations
}

export interface ResearchQualityAssessment {
  sourceAuthority: number;      // 0-1
  recency: number;              // 0-1
  relevance: number;            // 0-1
  consensus: number;            // 0-1
  practicalValidation: number;  // 0-1
  overall: number;              // Weighted combination
  factors: QualityFactor[];
}

export interface QualityFactor {
  name: string;
  score: number;
  weight: number;
  evidence: string;
}

export interface KnowledgeGap {
  area: string;
  description: string;
  severity: 'critical' | 'important' | 'nice-to-have';
  impact: string;               // What we can't do without this
  suggestedQueries: string[];
  blocking: boolean;            // Does this block progress?
}

// ============================================================================
// EXTERNAL KNOWLEDGE STORAGE
// ============================================================================

/**
 * External knowledge that has been retrieved and stored.
 */
export interface ExternalKnowledge {
  id: string;
  type: ExternalKnowledgeType;

  // Content
  title: string;
  summary: string;
  fullContent?: string;
  extractedFacts: ExtractedFact[];

  // Source
  source: KnowledgeSource;

  // Quality and trust
  reliability: SourceAuthority;
  confidence: ConfidenceAssessment;

  // Applicability
  applicableDomains: string[];
  applicableContexts: string[];  // Bounded contexts
  applicableVersions?: string[]; // Software versions

  // Relationships
  relatedKnowledge: string[];
  supersedes?: string[];        // Older knowledge this replaces
  supersededBy?: string;        // Newer knowledge that replaces this

  // Usage tracking
  usedInDecisions: string[];    // ADR IDs
  usedInWork: string[];         // Work item IDs
  accessCount: number;
  lastAccessed?: string;

  // Lifecycle
  retrievedAt: string;
  expiresAt?: string;           // When to re-verify
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export type ExternalKnowledgeType =
  | 'api_documentation'
  | 'research_paper'
  | 'best_practice'
  | 'security_advisory'
  | 'standard_specification'
  | 'tutorial'
  | 'case_study'
  | 'benchmark'
  | 'changelog'
  | 'blog_post'
  | 'conference_talk'
  | 'book_excerpt';

// ============================================================================
// ARCHITECTURE DECISION RECORDS
// ============================================================================

/**
 * Architecture Decision Record (ADR) for tracking decisions.
 */
export interface ArchitectureDecision {
  id: string;
  title: string;
  status: ADRStatus;

  // Context
  context: string;              // Why this decision is needed
  drivers: string[];            // Forces that drive this decision
  constraints: string[];        // Constraints affecting the decision

  // Decision
  decision: string;             // What we decided
  rationale: string;            // Why we decided this
  alternatives: AlternativeConsidered[];

  // Consequences
  positiveConsequences: string[];
  negativeConsequences: string[];
  neutralConsequences: string[];
  risks: DecisionRisk[];

  // Traceability
  affectedContexts: string[];   // Bounded contexts
  affectedFiles: string[];
  relatedDecisions: string[];   // Other ADR IDs
  supersedes?: string;          // ADR this replaces
  supersededBy?: string;        // ADR that replaces this

  // Research
  researchConducted: string[];  // Research result IDs
  externalKnowledge: string[];  // External knowledge IDs

  // Confidence
  confidence: ConfidenceAssessment;

  // Governance
  proposedBy: string;
  proposedAt: string;
  reviewedBy: string[];
  approvedBy?: string;
  approvedAt?: string;
  implementedAt?: string;
  reviewSchedule?: string;      // When to re-evaluate
}

export type ADRStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'deprecated'
  | 'superseded';

export interface AlternativeConsidered {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  whyRejected: string;
}

export interface DecisionRisk {
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic change tracking
 */
export interface ChangeRecord {
  changedAt: string;
  changedBy: string;
  changeType: 'create' | 'update' | 'delete';
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}
