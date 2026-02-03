/**
 * @fileoverview Knowledge Management and Organizational Learning System
 *
 * This module provides a comprehensive knowledge management infrastructure for
 * organizational learning, including:
 *
 * - **Knowledge Types**: Decision records (ADRs), operational runbooks,
 *   domain knowledge, technical patterns, lessons learned, recipes, and glossaries
 * - **Knowledge Graph**: Searchable graph with relation types and gap detection
 * - **Staleness Tracking**: Automatic detection of stale knowledge with refresh scheduling
 * - **Learning Infrastructure**: Feedback collection, usage tracking, and improvement suggestions
 * - **Contradiction Detection**: Find conflicting knowledge items
 * - **Evidence Ledger Integration**: Connect to epistemic foundations
 *
 * Design Philosophy:
 * - Evidence-based: Every knowledge item has confidence and provenance
 * - Self-healing: Automatic staleness detection and refresh scheduling
 * - Learning-oriented: Track feedback and usage to improve knowledge quality
 * - Graph-aware: Understand relationships between knowledge items
 *
 * @packageDocumentation
 */

import type { ConfidenceValue } from '../epistemics/confidence.js';
import { getNumericValue, absent, bounded, deterministic } from '../epistemics/confidence.js';
import type { EvidenceId, IEvidenceLedger, EvidenceEntry } from '../epistemics/evidence_ledger.js';
import { createEvidenceId } from '../epistemics/evidence_ledger.js';

// ============================================================================
// KNOWLEDGE ITEM TYPES
// ============================================================================

/**
 * The type of knowledge item. Each type has specific semantics and use cases.
 *
 * - `decision`: Why something was decided (Architecture Decision Records)
 * - `operational`: How to operate (runbooks, playbooks)
 * - `domain`: Business domain knowledge
 * - `technical`: Code patterns, integrations, architecture
 * - `lesson`: Lessons learned from experience
 * - `recipe`: How-to guides and tutorials
 * - `glossary`: Term definitions and ubiquitous language
 */
export type KnowledgeType =
  | 'decision'
  | 'operational'
  | 'domain'
  | 'technical'
  | 'lesson'
  | 'recipe'
  | 'glossary';

/**
 * Information about knowledge staleness and refresh scheduling.
 *
 * Knowledge can become stale over time as the system evolves.
 * This tracks when knowledge was last verified and how urgent
 * refresh is needed.
 */
export interface StalenessInfo {
  /** When this knowledge was last verified as accurate */
  lastVerified: Date;
  /** Maximum number of days before knowledge is considered stale */
  maxAgeDays: number;
  /** Whether the knowledge is currently considered stale */
  isStale: boolean;
  /** Priority for refreshing this knowledge */
  refreshPriority: 'high' | 'medium' | 'low';
}

/**
 * Statistics about feedback received for a knowledge item.
 */
export interface FeedbackStats {
  /** Number of times marked as helpful */
  helpfulCount: number;
  /** Number of times marked as not helpful */
  unhelpfulCount: number;
  /** Total number of times this knowledge was accessed */
  accessCount: number;
  /** Average rating if numeric ratings are used (0-5) */
  averageRating?: number;
  /** Last time feedback was received */
  lastFeedbackAt?: Date;
}

/**
 * Base interface for all knowledge items.
 *
 * Every knowledge item has:
 * - Unique identifier and type classification
 * - Title and content
 * - Tags for categorization
 * - Confidence value from epistemics
 * - Evidence references for provenance
 * - Temporal metadata
 * - Staleness tracking
 * - Feedback statistics
 */
export interface KnowledgeItem {
  /** Unique identifier for this knowledge item */
  id: string;
  /** Type of knowledge */
  type: KnowledgeType;
  /** Human-readable title */
  title: string;
  /** Main content of the knowledge item */
  content: string;
  /** Tags for categorization and search */
  tags: string[];
  /** Confidence in this knowledge from epistemics */
  confidence: ConfidenceValue;
  /** References to supporting evidence in the Evidence Ledger */
  evidenceRefs: string[];
  /** When this knowledge was created */
  createdAt: Date;
  /** When this knowledge was last updated */
  updatedAt: Date;
  /** Who authored this knowledge */
  author: string;
  /** Staleness information */
  staleness: StalenessInfo;
  /** Feedback statistics */
  feedback: FeedbackStats;
}

// ============================================================================
// DECISION KNOWLEDGE
// ============================================================================

/**
 * An alternative that was considered in a decision.
 */
export interface DecisionAlternative {
  /** Name of the alternative */
  name: string;
  /** Description of the alternative */
  description: string;
  /** Pros of this alternative */
  pros: string[];
  /** Cons of this alternative */
  cons: string[];
  /** Why this alternative was not chosen */
  whyRejected?: string;
}

/**
 * Decision knowledge captures why something was decided (ADRs).
 *
 * This extends KnowledgeItem with decision-specific fields:
 * - Context for why the decision was needed
 * - Alternatives that were considered
 * - Outcome of the decision (if implemented)
 * - Supersession tracking
 */
export interface DecisionKnowledge extends KnowledgeItem {
  type: 'decision';
  /** Context explaining why this decision was needed */
  decisionContext: string;
  /** Alternatives that were considered */
  alternatives: DecisionAlternative[];
  /** Outcome after implementing the decision */
  outcome?: string;
  /** ID of decision that supersedes this one */
  supersededBy?: string;
}

// ============================================================================
// OPERATIONAL KNOWLEDGE
// ============================================================================

/**
 * A single step in a runbook.
 */
export interface RunbookStep {
  /** Order of this step in the runbook (1-indexed) */
  order: number;
  /** Action to perform */
  action: string;
  /** What should happen after this step */
  expectedOutcome: string;
  /** How to rollback if this step fails */
  rollback?: string;
  /** Warnings to be aware of */
  warnings?: string[];
}

/**
 * Operational knowledge captures how to operate systems (runbooks).
 *
 * This extends KnowledgeItem with operational-specific fields:
 * - Step-by-step runbook instructions
 * - Usage tracking (when last used)
 * - Success rate tracking
 */
export interface OperationalKnowledge extends KnowledgeItem {
  type: 'operational';
  /** Steps to execute in the runbook */
  runbookSteps: RunbookStep[];
  /** When this runbook was last used */
  lastUsed?: Date;
  /** Historical success rate (0-1) */
  successRate?: number;
}

// ============================================================================
// DOMAIN KNOWLEDGE
// ============================================================================

/**
 * Domain knowledge captures business domain concepts.
 *
 * This extends KnowledgeItem with domain-specific fields:
 * - Bounded context association (DDD)
 * - Related terms for navigation
 * - Business owner for governance
 */
export interface DomainKnowledge extends KnowledgeItem {
  type: 'domain';
  /** Bounded context this knowledge belongs to */
  boundedContext?: string;
  /** Related domain terms */
  relatedTerms: string[];
  /** Business owner responsible for this domain knowledge */
  businessOwner?: string;
}

// ============================================================================
// TECHNICAL KNOWLEDGE
// ============================================================================

/**
 * Technical knowledge captures code patterns and integrations.
 *
 * This extends KnowledgeItem with technical-specific fields:
 * - Code examples
 * - Language and framework context
 * - Affected components
 */
export interface TechnicalKnowledge extends KnowledgeItem {
  type: 'technical';
  /** Code examples demonstrating the pattern */
  codeExamples: string[];
  /** Programming language this applies to */
  language?: string;
  /** Framework or library context */
  framework?: string;
  /** Components affected by this pattern */
  affectedComponents: string[];
}

// ============================================================================
// LESSON KNOWLEDGE
// ============================================================================

/**
 * Lesson knowledge captures lessons learned from experience.
 *
 * This extends KnowledgeItem with lesson-specific fields:
 * - Incident or event that prompted the lesson
 * - Impact assessment
 * - Recommendations for the future
 */
export interface LessonKnowledge extends KnowledgeItem {
  type: 'lesson';
  /** Incident or event that prompted this lesson */
  incident?: string;
  /** Impact level of the original event */
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  /** Recommendations for the future */
  recommendations: string[];
  /** Date when the lesson was learned */
  learnedAt: Date;
}

// ============================================================================
// RECIPE KNOWLEDGE
// ============================================================================

/**
 * Recipe step for how-to guides.
 */
export interface RecipeStep {
  /** Order of this step (1-indexed) */
  order: number;
  /** Title of the step */
  title: string;
  /** Instructions for this step */
  instructions: string;
  /** Code snippet if applicable */
  code?: string;
  /** Tips for this step */
  tips?: string[];
}

/**
 * Recipe knowledge captures how-to guides.
 *
 * This extends KnowledgeItem with recipe-specific fields:
 * - Prerequisites
 * - Step-by-step instructions
 * - Expected duration
 * - Difficulty level
 */
export interface RecipeKnowledge extends KnowledgeItem {
  type: 'recipe';
  /** Prerequisites before starting */
  prerequisites: string[];
  /** Step-by-step instructions */
  steps: RecipeStep[];
  /** Expected duration to complete */
  estimatedDuration?: string;
  /** Difficulty level */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// ============================================================================
// GLOSSARY KNOWLEDGE
// ============================================================================

/**
 * Glossary knowledge captures term definitions.
 *
 * This extends KnowledgeItem with glossary-specific fields:
 * - The term being defined
 * - Aliases (synonyms)
 * - Examples of usage
 * - Disambiguation from similar terms
 */
export interface GlossaryKnowledge extends KnowledgeItem {
  type: 'glossary';
  /** The term being defined */
  term: string;
  /** Aliases or synonyms */
  aliases: string[];
  /** Examples of correct usage */
  usageExamples: string[];
  /** Terms this is NOT (disambiguation) */
  notToBe: string[];
}

// ============================================================================
// KNOWLEDGE RELATIONS
// ============================================================================

/**
 * Type of relationship between knowledge items.
 *
 * - `relates_to`: General relationship
 * - `supersedes`: This item supersedes/replaces another
 * - `depends_on`: This item depends on another
 * - `contradicts`: This item contradicts another
 * - `elaborates`: This item elaborates on another
 */
export type KnowledgeRelationType =
  | 'relates_to'
  | 'supersedes'
  | 'depends_on'
  | 'contradicts'
  | 'elaborates';

/**
 * A relationship between two knowledge items.
 */
export interface KnowledgeRelation {
  /** ID of the source knowledge item */
  fromId: string;
  /** ID of the target knowledge item */
  toId: string;
  /** Type of relationship */
  type: KnowledgeRelationType;
  /** Optional description of the relationship */
  description?: string;
  /** Confidence in this relationship */
  confidence?: ConfidenceValue;
  /** When this relationship was created */
  createdAt?: Date;
}

// ============================================================================
// KNOWLEDGE GAP
// ============================================================================

/**
 * A detected gap in knowledge coverage.
 */
export interface KnowledgeGapItem {
  /** Area where knowledge is missing */
  area: string;
  /** Importance of filling this gap */
  importance: 'critical' | 'high' | 'medium' | 'low';
  /** Suggested actions to fill the gap */
  suggestedActions: string[];
  /** Related knowledge items that hint at the gap */
  relatedItems?: string[];
  /** When this gap was detected */
  detectedAt?: Date;
}

// ============================================================================
// KNOWLEDGE IMPROVEMENT
// ============================================================================

/**
 * A suggested improvement to knowledge.
 */
export interface KnowledgeImprovement {
  /** ID of the knowledge item to improve */
  itemId: string;
  /** Type of improvement */
  improvementType: 'update' | 'merge' | 'split' | 'archive' | 'elaborate';
  /** Description of the suggested improvement */
  suggestion: string;
  /** Reason for the improvement */
  reason: string;
  /** Priority of the improvement */
  priority: 'high' | 'medium' | 'low';
  /** Confidence that this improvement is needed */
  confidence: ConfidenceValue;
}

// ============================================================================
// CONTRADICTION
// ============================================================================

/**
 * A detected contradiction between knowledge items.
 */
export interface Contradiction {
  /** ID of the first knowledge item */
  itemAId: string;
  /** ID of the second knowledge item */
  itemBId: string;
  /** Description of the contradiction */
  description: string;
  /** Severity of the contradiction */
  severity: 'blocking' | 'significant' | 'minor';
  /** Suggested resolution */
  suggestedResolution?: string;
  /** When this contradiction was detected */
  detectedAt: Date;
}

// ============================================================================
// KNOWLEDGE SEARCH
// ============================================================================

/**
 * Search result with relevance scoring.
 */
export interface SearchResult {
  /** The matched knowledge item */
  item: KnowledgeItem;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Matched terms that contributed to the score */
  matchedTerms: string[];
  /** Snippet of matched content */
  snippet?: string;
}

/**
 * Search options for knowledge queries.
 */
export interface SearchOptions {
  /** Limit number of results */
  limit?: number;
  /** Filter by knowledge types */
  types?: KnowledgeType[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by author */
  author?: string;
  /** Minimum confidence score */
  minConfidence?: number;
  /** Include stale items */
  includeStale?: boolean;
  /** Bounded context filter */
  boundedContext?: string;
}

// ============================================================================
// KNOWLEDGE GRAPH INTERFACE
// ============================================================================

/**
 * The Knowledge Graph provides a searchable, connected knowledge base.
 *
 * Features:
 * - Full-text search with relevance scoring
 * - Relationship traversal
 * - Gap detection
 * - Staleness management
 */
export interface KnowledgeGraph {
  /** All knowledge items in the graph */
  readonly items: KnowledgeItem[];
  /** All relations between items */
  readonly relations: KnowledgeRelation[];

  /**
   * Add a knowledge item to the graph.
   *
   * @param item - The knowledge item to add
   */
  addItem(item: KnowledgeItem): void;

  /**
   * Remove a knowledge item from the graph.
   *
   * @param itemId - ID of the item to remove
   */
  removeItem(itemId: string): void;

  /**
   * Get a knowledge item by ID.
   *
   * @param itemId - ID of the item to get
   * @returns The item or undefined if not found
   */
  getItem(itemId: string): KnowledgeItem | undefined;

  /**
   * Update a knowledge item.
   *
   * @param itemId - ID of the item to update
   * @param updates - Partial updates to apply
   */
  updateItem(itemId: string, updates: Partial<KnowledgeItem>): void;

  /**
   * Add a relation between knowledge items.
   *
   * @param relation - The relation to add
   */
  addRelation(relation: KnowledgeRelation): void;

  /**
   * Search for knowledge items.
   *
   * @param query - Search query string
   * @param options - Search options
   * @returns Search results with relevance scores
   */
  search(query: string, options?: SearchOptions): SearchResult[];

  /**
   * Get items related to a given item.
   *
   * @param itemId - ID of the item
   * @param types - Optional filter by relation types
   * @returns Related knowledge items
   */
  getRelated(itemId: string, types?: KnowledgeRelationType[]): KnowledgeItem[];

  /**
   * Detect gaps in knowledge coverage.
   *
   * Analyzes the graph to find areas where knowledge is missing
   * or insufficient.
   *
   * @returns Detected knowledge gaps
   */
  detectGaps(): KnowledgeGapItem[];

  /**
   * Find and return stale knowledge items that need refresh.
   *
   * @returns Items that are stale and need updating
   */
  refreshStale(): KnowledgeItem[];
}

// ============================================================================
// LEARNING SYSTEM INTERFACE
// ============================================================================

/**
 * Feedback on a knowledge item.
 */
export interface KnowledgeFeedback {
  /** ID of the knowledge item */
  itemId: string;
  /** Whether the feedback is positive */
  helpful: boolean;
  /** Optional comment */
  comment?: string;
  /** Who provided the feedback */
  userId?: string;
  /** When the feedback was given */
  timestamp: Date;
}

/**
 * The Learning System tracks feedback and suggests improvements.
 *
 * Features:
 * - Feedback collection
 * - Usage tracking
 * - Improvement suggestions
 * - Contradiction detection
 */
export interface LearningSystem {
  /**
   * Record feedback on a knowledge item.
   *
   * @param itemId - ID of the knowledge item
   * @param helpful - Whether the item was helpful
   * @param comment - Optional comment
   */
  recordFeedback(itemId: string, helpful: boolean, comment?: string): void;

  /**
   * Track usage of a knowledge item.
   *
   * @param itemId - ID of the knowledge item
   */
  trackUsage(itemId: string): void;

  /**
   * Suggest improvements based on feedback and usage patterns.
   *
   * @returns Suggested improvements
   */
  suggestImprovements(): KnowledgeImprovement[];

  /**
   * Detect contradictions between knowledge items.
   *
   * @returns Detected contradictions
   */
  detectContradictions(): Contradiction[];

  /**
   * Get feedback history for an item.
   *
   * @param itemId - ID of the knowledge item
   * @returns Feedback entries
   */
  getFeedbackHistory(itemId: string): KnowledgeFeedback[];

  /**
   * Get usage statistics for an item.
   *
   * @param itemId - ID of the knowledge item
   * @returns Usage statistics
   */
  getUsageStats(itemId: string): {
    totalAccesses: number;
    lastAccessed?: Date;
    accessTrend: 'increasing' | 'stable' | 'decreasing';
  };
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create default staleness info.
 *
 * @param maxAgeDays - Maximum age in days (default: 90)
 * @returns StalenessInfo with defaults
 */
export function createDefaultStalenessInfo(maxAgeDays = 90): StalenessInfo {
  return {
    lastVerified: new Date(),
    maxAgeDays,
    isStale: false,
    refreshPriority: 'low',
  };
}

/**
 * Create default feedback stats.
 *
 * @returns FeedbackStats with zero counts
 */
export function createDefaultFeedbackStats(): FeedbackStats {
  return {
    helpfulCount: 0,
    unhelpfulCount: 0,
    accessCount: 0,
  };
}

/**
 * Check if a knowledge item is stale.
 *
 * @param item - The knowledge item to check
 * @returns Whether the item is stale
 */
export function isKnowledgeStale(item: KnowledgeItem): boolean {
  const now = new Date();
  const lastVerified = item.staleness.lastVerified;
  const ageMs = now.getTime() - lastVerified.getTime();
  const maxAgeMs = item.staleness.maxAgeDays * 24 * 60 * 60 * 1000;
  return ageMs > maxAgeMs;
}

/**
 * Compute refresh priority based on various factors.
 *
 * @param item - The knowledge item
 * @returns Refresh priority
 */
export function computeRefreshPriority(item: KnowledgeItem): 'high' | 'medium' | 'low' {
  // High priority if:
  // - Item is stale AND heavily used
  // - Item has low confidence
  // - Item has many unhelpful votes

  const isStale = isKnowledgeStale(item);
  const confidence = getNumericValue(item.confidence);
  const unhelpfulRatio =
    item.feedback.helpfulCount + item.feedback.unhelpfulCount > 0
      ? item.feedback.unhelpfulCount /
        (item.feedback.helpfulCount + item.feedback.unhelpfulCount)
      : 0;

  // High priority conditions
  if (isStale && item.feedback.accessCount > 10) return 'high';
  if (confidence !== null && confidence < 0.3) return 'high';
  if (unhelpfulRatio > 0.5) return 'high';

  // Medium priority conditions
  if (isStale) return 'medium';
  if (confidence !== null && confidence < 0.6) return 'medium';
  if (unhelpfulRatio > 0.3) return 'medium';

  return 'low';
}

/**
 * Create a knowledge item ID.
 *
 * @param prefix - Optional prefix for the ID
 * @returns A unique ID
 */
export function createKnowledgeId(prefix = 'kn'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// KNOWLEDGE ITEM FACTORIES
// ============================================================================

/**
 * Options for creating a knowledge item.
 */
export interface CreateKnowledgeItemOptions {
  id?: string;
  title: string;
  content: string;
  tags?: string[];
  confidence?: ConfidenceValue;
  evidenceRefs?: string[];
  author: string;
  maxAgeDays?: number;
}

/**
 * Create a decision knowledge item.
 *
 * @param options - Base options
 * @param decisionContext - Context for the decision
 * @param alternatives - Alternatives considered
 * @returns DecisionKnowledge item
 */
export function createDecisionKnowledge(
  options: CreateKnowledgeItemOptions,
  decisionContext: string,
  alternatives: DecisionAlternative[]
): DecisionKnowledge {
  const now = new Date();
  return {
    id: options.id ?? createKnowledgeId('decision'),
    type: 'decision',
    title: options.title,
    content: options.content,
    tags: options.tags ?? [],
    confidence: options.confidence ?? absent('uncalibrated'),
    evidenceRefs: options.evidenceRefs ?? [],
    createdAt: now,
    updatedAt: now,
    author: options.author,
    staleness: createDefaultStalenessInfo(options.maxAgeDays ?? 180), // Decisions have longer validity
    feedback: createDefaultFeedbackStats(),
    decisionContext,
    alternatives,
  };
}

/**
 * Create an operational knowledge item.
 *
 * @param options - Base options
 * @param runbookSteps - Steps for the runbook
 * @returns OperationalKnowledge item
 */
export function createOperationalKnowledge(
  options: CreateKnowledgeItemOptions,
  runbookSteps: RunbookStep[]
): OperationalKnowledge {
  const now = new Date();
  return {
    id: options.id ?? createKnowledgeId('runbook'),
    type: 'operational',
    title: options.title,
    content: options.content,
    tags: options.tags ?? [],
    confidence: options.confidence ?? absent('uncalibrated'),
    evidenceRefs: options.evidenceRefs ?? [],
    createdAt: now,
    updatedAt: now,
    author: options.author,
    staleness: createDefaultStalenessInfo(options.maxAgeDays ?? 30), // Runbooks need frequent verification
    feedback: createDefaultFeedbackStats(),
    runbookSteps,
  };
}

/**
 * Create a domain knowledge item.
 *
 * @param options - Base options
 * @param relatedTerms - Related domain terms
 * @param boundedContext - Optional bounded context
 * @returns DomainKnowledge item
 */
export function createDomainKnowledge(
  options: CreateKnowledgeItemOptions,
  relatedTerms: string[],
  boundedContext?: string
): DomainKnowledge {
  const now = new Date();
  return {
    id: options.id ?? createKnowledgeId('domain'),
    type: 'domain',
    title: options.title,
    content: options.content,
    tags: options.tags ?? [],
    confidence: options.confidence ?? absent('uncalibrated'),
    evidenceRefs: options.evidenceRefs ?? [],
    createdAt: now,
    updatedAt: now,
    author: options.author,
    staleness: createDefaultStalenessInfo(options.maxAgeDays ?? 90),
    feedback: createDefaultFeedbackStats(),
    relatedTerms,
    boundedContext,
  };
}

/**
 * Create a glossary knowledge item.
 *
 * @param options - Base options
 * @param term - The term being defined
 * @param aliases - Aliases for the term
 * @param usageExamples - Examples of usage
 * @returns GlossaryKnowledge item
 */
export function createGlossaryKnowledge(
  options: CreateKnowledgeItemOptions,
  term: string,
  aliases: string[] = [],
  usageExamples: string[] = []
): GlossaryKnowledge {
  const now = new Date();
  return {
    id: options.id ?? createKnowledgeId('glossary'),
    type: 'glossary',
    title: options.title,
    content: options.content,
    tags: options.tags ?? [],
    confidence: options.confidence ?? absent('uncalibrated'),
    evidenceRefs: options.evidenceRefs ?? [],
    createdAt: now,
    updatedAt: now,
    author: options.author,
    staleness: createDefaultStalenessInfo(options.maxAgeDays ?? 365), // Glossary terms are stable
    feedback: createDefaultFeedbackStats(),
    term,
    aliases,
    usageExamples,
    notToBe: [],
  };
}

// ============================================================================
// IN-MEMORY KNOWLEDGE GRAPH IMPLEMENTATION
// ============================================================================

/**
 * In-memory implementation of the KnowledgeGraph interface.
 *
 * Provides full-text search, relation management, gap detection,
 * and staleness tracking.
 */
export class InMemoryKnowledgeGraph implements KnowledgeGraph {
  private _items: Map<string, KnowledgeItem> = new Map();
  private _relations: KnowledgeRelation[] = [];

  get items(): KnowledgeItem[] {
    return Array.from(this._items.values());
  }

  get relations(): KnowledgeRelation[] {
    return [...this._relations];
  }

  addItem(item: KnowledgeItem): void {
    this._items.set(item.id, item);
  }

  removeItem(itemId: string): void {
    this._items.delete(itemId);
    // Also remove relations involving this item
    this._relations = this._relations.filter(
      (r) => r.fromId !== itemId && r.toId !== itemId
    );
  }

  getItem(itemId: string): KnowledgeItem | undefined {
    return this._items.get(itemId);
  }

  updateItem(itemId: string, updates: Partial<KnowledgeItem>): void {
    const existing = this._items.get(itemId);
    if (existing) {
      this._items.set(itemId, {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      });
    }
  }

  addRelation(relation: KnowledgeRelation): void {
    // Check if both items exist
    if (!this._items.has(relation.fromId) || !this._items.has(relation.toId)) {
      return;
    }
    // Avoid duplicates
    const exists = this._relations.some(
      (r) =>
        r.fromId === relation.fromId &&
        r.toId === relation.toId &&
        r.type === relation.type
    );
    if (!exists) {
      this._relations.push({
        ...relation,
        createdAt: relation.createdAt ?? new Date(),
      });
    }
  }

  search(query: string, options?: SearchOptions): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 0);

    const results: SearchResult[] = [];

    for (const item of this._items.values()) {
      // Apply filters
      if (options?.types && !options.types.includes(item.type)) continue;
      if (options?.tags && !options.tags.some((t) => item.tags.includes(t))) continue;
      if (options?.author && item.author !== options.author) continue;
      if (options?.minConfidence) {
        const conf = getNumericValue(item.confidence);
        if (conf === null || conf < options.minConfidence) continue;
      }
      if (!options?.includeStale && isKnowledgeStale(item)) continue;

      // Compute relevance score
      const { score, matchedTerms, snippet } = this.computeRelevance(item, queryTerms);

      // If query is empty, include all items that passed filters
      // Otherwise, only include items with positive relevance score
      if (queryTerms.length === 0 || score > 0) {
        results.push({
          item,
          relevanceScore: queryTerms.length === 0 ? 1.0 : score,
          matchedTerms,
          snippet,
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply limit
    if (options?.limit && results.length > options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  private computeRelevance(
    item: KnowledgeItem,
    queryTerms: string[]
  ): { score: number; matchedTerms: string[]; snippet?: string } {
    const matchedTerms: string[] = [];
    let score = 0;

    const titleLower = item.title.toLowerCase();
    const contentLower = item.content.toLowerCase();
    const tagsLower = item.tags.map((t) => t.toLowerCase());

    for (const term of queryTerms) {
      // Title matches are worth more
      if (titleLower.includes(term)) {
        score += 0.5;
        matchedTerms.push(term);
      }
      // Content matches
      if (contentLower.includes(term)) {
        score += 0.3;
        if (!matchedTerms.includes(term)) matchedTerms.push(term);
      }
      // Tag matches
      if (tagsLower.some((t) => t.includes(term))) {
        score += 0.2;
        if (!matchedTerms.includes(term)) matchedTerms.push(term);
      }
    }

    // Normalize by number of query terms
    score = queryTerms.length > 0 ? score / queryTerms.length : 0;

    // Extract snippet around first match
    let snippet: string | undefined;
    if (matchedTerms.length > 0) {
      const firstMatch = matchedTerms[0];
      const idx = contentLower.indexOf(firstMatch);
      if (idx >= 0) {
        const start = Math.max(0, idx - 50);
        const end = Math.min(item.content.length, idx + firstMatch.length + 50);
        snippet = (start > 0 ? '...' : '') + item.content.slice(start, end) + (end < item.content.length ? '...' : '');
      }
    }

    return { score, matchedTerms, snippet };
  }

  getRelated(itemId: string, types?: KnowledgeRelationType[]): KnowledgeItem[] {
    const relatedIds = new Set<string>();

    for (const relation of this._relations) {
      if (types && !types.includes(relation.type)) continue;

      if (relation.fromId === itemId) {
        relatedIds.add(relation.toId);
      } else if (relation.toId === itemId) {
        relatedIds.add(relation.fromId);
      }
    }

    return Array.from(relatedIds)
      .map((id) => this._items.get(id))
      .filter((item): item is KnowledgeItem => item !== undefined);
  }

  detectGaps(): KnowledgeGapItem[] {
    const gaps: KnowledgeGapItem[] = [];

    // 1. Detect areas with low coverage (many stale items)
    const typeCountStale = new Map<KnowledgeType, number>();
    const typeCountTotal = new Map<KnowledgeType, number>();

    for (const item of this._items.values()) {
      const count = typeCountTotal.get(item.type) ?? 0;
      typeCountTotal.set(item.type, count + 1);

      if (isKnowledgeStale(item)) {
        const staleCount = typeCountStale.get(item.type) ?? 0;
        typeCountStale.set(item.type, staleCount + 1);
      }
    }

    for (const [type, staleCount] of typeCountStale) {
      const total = typeCountTotal.get(type) ?? 0;
      if (total > 0 && staleCount / total > 0.5) {
        gaps.push({
          area: `${type} knowledge`,
          importance: 'high',
          suggestedActions: [
            `Review and update stale ${type} items (${staleCount}/${total} are stale)`,
            `Consider archiving obsolete ${type} items`,
          ],
          detectedAt: new Date(),
        });
      }
    }

    // 2. Detect isolated items (no relations)
    const itemsWithRelations = new Set<string>();
    for (const relation of this._relations) {
      itemsWithRelations.add(relation.fromId);
      itemsWithRelations.add(relation.toId);
    }

    const isolatedItems: string[] = [];
    for (const item of this._items.values()) {
      if (!itemsWithRelations.has(item.id)) {
        isolatedItems.push(item.title);
      }
    }

    if (isolatedItems.length > 5) {
      gaps.push({
        area: 'Knowledge connectivity',
        importance: 'medium',
        suggestedActions: [
          `Add relations to ${isolatedItems.length} isolated knowledge items`,
          'Review if isolated items are still relevant',
        ],
        relatedItems: isolatedItems.slice(0, 5),
        detectedAt: new Date(),
      });
    }

    // 3. Detect areas with low confidence
    const lowConfidenceItems: string[] = [];
    for (const item of this._items.values()) {
      const conf = getNumericValue(item.confidence);
      if (conf === null || conf < 0.5) {
        lowConfidenceItems.push(item.id);
      }
    }

    if (lowConfidenceItems.length > 3) {
      gaps.push({
        area: 'Knowledge confidence',
        importance: 'high',
        suggestedActions: [
          `Verify and improve confidence for ${lowConfidenceItems.length} low-confidence items`,
          'Add supporting evidence to increase confidence',
        ],
        relatedItems: lowConfidenceItems.slice(0, 5),
        detectedAt: new Date(),
      });
    }

    return gaps;
  }

  refreshStale(): KnowledgeItem[] {
    const staleItems: KnowledgeItem[] = [];

    for (const item of this._items.values()) {
      if (isKnowledgeStale(item)) {
        // Update staleness info
        const updated = {
          ...item,
          staleness: {
            ...item.staleness,
            isStale: true,
            refreshPriority: computeRefreshPriority(item),
          },
        };
        this._items.set(item.id, updated);
        staleItems.push(updated);
      }
    }

    // Sort by refresh priority
    staleItems.sort((a, b) => {
      const priorities = { high: 0, medium: 1, low: 2 };
      return priorities[a.staleness.refreshPriority] - priorities[b.staleness.refreshPriority];
    });

    return staleItems;
  }
}

// ============================================================================
// IN-MEMORY LEARNING SYSTEM IMPLEMENTATION
// ============================================================================

/**
 * In-memory implementation of the LearningSystem interface.
 *
 * Provides feedback collection, usage tracking, improvement suggestions,
 * and contradiction detection.
 */
export class InMemoryLearningSystem implements LearningSystem {
  private feedbackHistory: Map<string, KnowledgeFeedback[]> = new Map();
  private usageHistory: Map<string, { timestamp: Date }[]> = new Map();

  constructor(private graph: KnowledgeGraph) {}

  recordFeedback(itemId: string, helpful: boolean, comment?: string): void {
    const feedback: KnowledgeFeedback = {
      itemId,
      helpful,
      comment,
      timestamp: new Date(),
    };

    const history = this.feedbackHistory.get(itemId) ?? [];
    history.push(feedback);
    this.feedbackHistory.set(itemId, history);

    // Update item's feedback stats
    const item = this.graph.getItem(itemId);
    if (item) {
      const stats = { ...item.feedback };
      if (helpful) {
        stats.helpfulCount++;
      } else {
        stats.unhelpfulCount++;
      }
      stats.lastFeedbackAt = new Date();
      this.graph.updateItem(itemId, { feedback: stats });
    }
  }

  trackUsage(itemId: string): void {
    const history = this.usageHistory.get(itemId) ?? [];
    history.push({ timestamp: new Date() });
    this.usageHistory.set(itemId, history);

    // Update item's access count
    const item = this.graph.getItem(itemId);
    if (item) {
      this.graph.updateItem(itemId, {
        feedback: {
          ...item.feedback,
          accessCount: item.feedback.accessCount + 1,
        },
      });
    }
  }

  getFeedbackHistory(itemId: string): KnowledgeFeedback[] {
    return this.feedbackHistory.get(itemId) ?? [];
  }

  getUsageStats(itemId: string): {
    totalAccesses: number;
    lastAccessed?: Date;
    accessTrend: 'increasing' | 'stable' | 'decreasing';
  } {
    const history = this.usageHistory.get(itemId) ?? [];

    if (history.length === 0) {
      return { totalAccesses: 0, accessTrend: 'stable' };
    }

    // Compute trend based on last 30 days vs previous 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentCount = history.filter((h) => h.timestamp >= thirtyDaysAgo).length;
    const previousCount = history.filter(
      (h) => h.timestamp >= sixtyDaysAgo && h.timestamp < thirtyDaysAgo
    ).length;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (recentCount > previousCount * 1.2) {
      trend = 'increasing';
    } else if (recentCount < previousCount * 0.8) {
      trend = 'decreasing';
    }

    return {
      totalAccesses: history.length,
      lastAccessed: history.length > 0 ? history[history.length - 1].timestamp : undefined,
      accessTrend: trend,
    };
  }

  suggestImprovements(): KnowledgeImprovement[] {
    const improvements: KnowledgeImprovement[] = [];

    for (const item of this.graph.items) {
      // 1. Items with high unhelpful feedback ratio
      const totalFeedback = item.feedback.helpfulCount + item.feedback.unhelpfulCount;
      if (totalFeedback >= 5) {
        const unhelpfulRatio = item.feedback.unhelpfulCount / totalFeedback;
        if (unhelpfulRatio > 0.4) {
          improvements.push({
            itemId: item.id,
            improvementType: 'update',
            suggestion: `Update content based on feedback - ${item.feedback.unhelpfulCount} users found this unhelpful`,
            reason: 'High unhelpful feedback ratio',
            priority: unhelpfulRatio > 0.6 ? 'high' : 'medium',
            confidence: deterministic(true, 'feedback_analysis'),
          });
        }
      }

      // 2. Items that are stale and heavily used
      if (isKnowledgeStale(item) && item.feedback.accessCount > 20) {
        improvements.push({
          itemId: item.id,
          improvementType: 'update',
          suggestion: 'Verify and update this frequently used but stale knowledge',
          reason: 'Stale but heavily accessed',
          priority: 'high',
          confidence: deterministic(true, 'staleness_analysis'),
        });
      }

      // 3. Items with very low usage (potential candidates for archiving)
      const usageStats = this.getUsageStats(item.id);
      if (usageStats.accessTrend === 'decreasing' && item.feedback.accessCount < 5) {
        improvements.push({
          itemId: item.id,
          improvementType: 'archive',
          suggestion: 'Consider archiving this rarely accessed knowledge',
          reason: 'Low and decreasing usage',
          priority: 'low',
          confidence: bounded(0.3, 0.7, 'theoretical', 'usage_pattern_heuristic'),
        });
      }

      // 4. Items with low confidence
      const conf = getNumericValue(item.confidence);
      if (conf !== null && conf < 0.5) {
        improvements.push({
          itemId: item.id,
          improvementType: 'elaborate',
          suggestion: 'Add supporting evidence to increase confidence',
          reason: 'Low confidence score',
          priority: conf < 0.3 ? 'high' : 'medium',
          confidence: deterministic(true, 'confidence_analysis'),
        });
      }
    }

    // Sort by priority
    improvements.sort((a, b) => {
      const priorities = { high: 0, medium: 1, low: 2 };
      return priorities[a.priority] - priorities[b.priority];
    });

    return improvements;
  }

  detectContradictions(): Contradiction[] {
    const contradictions: Contradiction[] = [];

    // Check explicit contradiction relations
    for (const relation of this.graph.relations) {
      if (relation.type === 'contradicts') {
        const itemA = this.graph.getItem(relation.fromId);
        const itemB = this.graph.getItem(relation.toId);
        if (itemA && itemB) {
          contradictions.push({
            itemAId: relation.fromId,
            itemBId: relation.toId,
            description: relation.description ?? `Contradiction between "${itemA.title}" and "${itemB.title}"`,
            severity: 'significant',
            detectedAt: relation.createdAt ?? new Date(),
          });
        }
      }
    }

    // Check for superseded items that are still actively used
    for (const item of this.graph.items) {
      if (item.type === 'decision') {
        const decisionItem = item as DecisionKnowledge;
        if (decisionItem.supersededBy) {
          const usageStats = this.getUsageStats(item.id);
          if (usageStats.totalAccesses > 10 && usageStats.accessTrend !== 'decreasing') {
            contradictions.push({
              itemAId: item.id,
              itemBId: decisionItem.supersededBy,
              description: `Superseded decision "${item.title}" is still being actively used`,
              severity: 'minor',
              suggestedResolution: 'Consider archiving the superseded decision or adding a prominent notice',
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    return contradictions;
  }
}

// ============================================================================
// EVIDENCE LEDGER INTEGRATION
// ============================================================================

/**
 * Options for connecting knowledge to the Evidence Ledger.
 */
export interface EvidenceLedgerOptions {
  /** The evidence ledger instance */
  ledger: IEvidenceLedger;
  /** Session ID for tracking */
  sessionId?: string;
}

/**
 * Connect a knowledge item to the Evidence Ledger.
 *
 * Creates an evidence entry for the knowledge item and returns
 * the evidence ID that can be stored in the item's evidenceRefs.
 *
 * @param item - The knowledge item
 * @param options - Evidence ledger options
 * @returns The created evidence entry
 */
export async function recordKnowledgeAsEvidence(
  item: KnowledgeItem,
  options: EvidenceLedgerOptions
): Promise<EvidenceEntry> {
  const { ledger } = options;

  const entry = await ledger.append({
    kind: 'claim',
    payload: {
      claim: item.content,
      category: mapKnowledgeTypeToClaimCategory(item.type),
      subject: {
        type: 'system',
        identifier: item.id,
      },
      supportingEvidence: item.evidenceRefs.map((ref) => ref as unknown as EvidenceId),
      knownDefeaters: [],
      confidence: item.confidence,
    },
    provenance: {
      source: 'user_input',
      method: 'knowledge_management',
      agent: {
        type: 'human',
        identifier: item.author,
      },
    },
    confidence: item.confidence,
    relatedEntries: item.evidenceRefs.map((ref) => ref as unknown as EvidenceId),
  });

  return entry;
}

/**
 * Map knowledge type to claim category.
 */
function mapKnowledgeTypeToClaimCategory(
  type: KnowledgeType
): 'existence' | 'relationship' | 'behavior' | 'quality' | 'recommendation' {
  switch (type) {
    case 'decision':
      return 'recommendation';
    case 'operational':
      return 'behavior';
    case 'domain':
      return 'existence';
    case 'technical':
      return 'behavior';
    case 'lesson':
      return 'recommendation';
    case 'recipe':
      return 'behavior';
    case 'glossary':
      return 'existence';
  }
}

/**
 * Sync feedback from knowledge items to the Evidence Ledger.
 *
 * @param itemId - The knowledge item ID
 * @param feedback - The feedback
 * @param options - Evidence ledger options
 * @returns The created feedback evidence entry
 */
export async function recordFeedbackAsEvidence(
  itemId: string,
  feedback: KnowledgeFeedback,
  options: EvidenceLedgerOptions
): Promise<EvidenceEntry> {
  const { ledger } = options;

  // Find the evidence entry for the knowledge item
  const entries = await ledger.query({
    textSearch: itemId,
    kinds: ['claim'],
    limit: 1,
  });

  const targetId = entries.length > 0 ? entries[0].id : createEvidenceId();

  const entry = await ledger.append({
    kind: 'feedback',
    payload: {
      targetId,
      feedbackType: feedback.helpful ? 'helpful' : 'unhelpful',
      source: feedback.userId ? 'user' : 'system',
      comment: feedback.comment,
    },
    provenance: {
      source: 'user_input',
      method: 'knowledge_feedback',
    },
    relatedEntries: [targetId],
  });

  return entry;
}

// ============================================================================
// FACTORY FUNCTIONS FOR KNOWLEDGE GRAPH AND LEARNING SYSTEM
// ============================================================================

/**
 * Create a new in-memory knowledge graph.
 *
 * @returns A new InMemoryKnowledgeGraph instance
 */
export function createKnowledgeGraph(): KnowledgeGraph {
  return new InMemoryKnowledgeGraph();
}

/**
 * Create a new learning system connected to a knowledge graph.
 *
 * @param graph - The knowledge graph to track
 * @returns A new InMemoryLearningSystem instance
 */
export function createLearningSystem(graph: KnowledgeGraph): LearningSystem {
  return new InMemoryLearningSystem(graph);
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if an item is a DecisionKnowledge.
 */
export function isDecisionKnowledge(item: KnowledgeItem): item is DecisionKnowledge {
  return item.type === 'decision';
}

/**
 * Check if an item is an OperationalKnowledge.
 */
export function isOperationalKnowledge(item: KnowledgeItem): item is OperationalKnowledge {
  return item.type === 'operational';
}

/**
 * Check if an item is a DomainKnowledge.
 */
export function isDomainKnowledge(item: KnowledgeItem): item is DomainKnowledge {
  return item.type === 'domain';
}

/**
 * Check if an item is a GlossaryKnowledge.
 */
export function isGlossaryKnowledge(item: KnowledgeItem): item is GlossaryKnowledge {
  return item.type === 'glossary';
}
