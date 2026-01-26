/**
 * @fileoverview Multi-Signal Relevance Scorer
 *
 * Combines 11 relevance signals with learned weights:
 * 1. Semantic similarity (embedding distance)
 * 2. Structural proximity (AST/file distance)
 * 3. History correlation (co-change patterns)
 * 4. Access recency (how recently accessed)
 * 5. Query term match (keyword overlap)
 * 6. Domain relevance (domain match score)
 * 7. Entity type match (type alignment)
 * 8. Ownership match (team/author alignment)
 * 9. Risk correlation (risk signal match)
 * 10. Test correlation (test coverage relevance)
 * 11. Dependency distance (import graph distance)
 */

import { Result, Ok, Err } from '../core/result.js';
import { EntityId, Timestamp, now } from '../core/contracts.js';

// ============================================================================
// TYPES
// ============================================================================

export type SignalType =
  | 'semantic'
  | 'structural'
  | 'history'
  | 'recency'
  | 'keyword'
  | 'domain'
  | 'entity_type'
  | 'ownership'
  | 'risk'
  | 'test'
  | 'dependency';

export interface SignalValue {
  signal: SignalType;
  score: number; // 0-1 normalized
  confidence: number; // 0-1 confidence in this signal
  metadata?: Record<string, unknown>;
}

export interface ScoredEntity {
  entityId: EntityId;
  signals: SignalValue[];
  combinedScore: number;
  confidence: number;
  explanation: string;
}

export interface QueryContext {
  queryText: string;
  queryTerms: string[];
  queryEmbedding?: number[];
  targetDomains?: string[];
  targetEntityTypes?: string[];
  currentFile?: string;
  currentUser?: string;
  currentTeam?: string;
}

export interface SignalWeight {
  signal: SignalType;
  weight: number;
  learningRate: number;
}

export interface FeedbackRecord {
  entityId: EntityId;
  wasRelevant: boolean;
  signals: SignalValue[];
  timestamp: Timestamp;
}

// ============================================================================
// SIGNAL COMPUTERS
// ============================================================================

export interface SignalComputer {
  readonly signal: SignalType;
  compute(
    entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue>;
}

export interface EntityData {
  id: EntityId;
  type: string;
  path?: string;
  embedding?: number[];
  lastAccessed?: number;
  lastModified?: number;
  domains?: string[];
  owners?: string[];
  dependencies?: string[];
  dependents?: string[];
  riskLevel?: number;
  testCoverage?: number;
  changeFrequency?: number;
  content?: string;
  name?: string;
}

// ============================================================================
// DEFAULT SIGNAL COMPUTERS
// ============================================================================

/**
 * Semantic similarity using embeddings
 */
export class SemanticSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'semantic';

  async compute(
    _entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (!context.queryEmbedding || !entityData.embedding) {
      return { signal: this.signal, score: 0, confidence: 0 };
    }

    const similarity = this.cosineSimilarity(
      context.queryEmbedding,
      entityData.embedding
    );

    return {
      signal: this.signal,
      score: Math.max(0, similarity), // Clamp negative similarities
      confidence: 0.9, // High confidence when embeddings exist
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

/**
 * Structural proximity based on file path distance
 */
export class StructuralSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'structural';

  async compute(
    _entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (!context.currentFile || !entityData.path) {
      return { signal: this.signal, score: 0.5, confidence: 0.3 };
    }

    const distance = this.pathDistance(context.currentFile, entityData.path);
    const score = Math.exp(-distance / 5); // Exponential decay

    return {
      signal: this.signal,
      score,
      confidence: 0.7,
      metadata: { pathDistance: distance },
    };
  }

  private pathDistance(path1: string, path2: string): number {
    const parts1 = path1.split('/');
    const parts2 = path2.split('/');

    // Find common prefix length
    let commonLength = 0;
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    // Distance = steps up from path1 to common ancestor + steps down to path2
    return (parts1.length - commonLength) + (parts2.length - commonLength);
  }
}

/**
 * Access recency signal
 */
export class RecencySignalComputer implements SignalComputer {
  readonly signal: SignalType = 'recency';

  async compute(
    _entityId: EntityId,
    _context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (!entityData.lastAccessed) {
      return { signal: this.signal, score: 0.5, confidence: 0.2 };
    }

    const ageMs = Date.now() - entityData.lastAccessed;
    const hoursSinceAccess = ageMs / (1000 * 60 * 60);

    // Exponential decay over 24 hours
    const score = Math.exp(-hoursSinceAccess / 24);

    return {
      signal: this.signal,
      score,
      confidence: 0.6,
      metadata: { hoursSinceAccess },
    };
  }
}

/**
 * Query term keyword match
 */
export class KeywordSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'keyword';

  async compute(
    _entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (context.queryTerms.length === 0) {
      return { signal: this.signal, score: 0, confidence: 0 };
    }

    // Searchable text from entity
    const searchableText = [
      entityData.name ?? '',
      entityData.path ?? '',
      entityData.content ?? '',
    ].join(' ').toLowerCase();

    // Count matching terms
    let matches = 0;
    const matchedTerms: string[] = [];

    for (const term of context.queryTerms) {
      if (searchableText.includes(term.toLowerCase())) {
        matches++;
        matchedTerms.push(term);
      }
    }

    const score = matches / context.queryTerms.length;

    return {
      signal: this.signal,
      score,
      confidence: 0.8,
      metadata: { matchedTerms, totalTerms: context.queryTerms.length },
    };
  }
}

/**
 * Domain relevance signal
 */
export class DomainSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'domain';

  async compute(
    _entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (!context.targetDomains?.length || !entityData.domains?.length) {
      return { signal: this.signal, score: 0.5, confidence: 0.3 };
    }

    const entityDomains = new Set(entityData.domains);
    const matchingDomains = context.targetDomains.filter(d => entityDomains.has(d));
    const score = matchingDomains.length / context.targetDomains.length;

    return {
      signal: this.signal,
      score,
      confidence: 0.85,
      metadata: { matchingDomains },
    };
  }
}

/**
 * Entity type match signal
 */
export class EntityTypeSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'entity_type';

  async compute(
    _entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (!context.targetEntityTypes?.length) {
      return { signal: this.signal, score: 0.5, confidence: 0.3 };
    }

    const matches = context.targetEntityTypes.includes(entityData.type);
    return {
      signal: this.signal,
      score: matches ? 1.0 : 0.0,
      confidence: 0.9,
      metadata: { entityType: entityData.type, targetTypes: context.targetEntityTypes },
    };
  }
}

/**
 * Ownership match signal
 */
export class OwnershipSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'ownership';

  async compute(
    _entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (!entityData.owners?.length) {
      return { signal: this.signal, score: 0.5, confidence: 0.2 };
    }

    let score = 0.5;
    const matches: string[] = [];

    // Check user match
    if (context.currentUser && entityData.owners.includes(context.currentUser)) {
      score = 1.0;
      matches.push(context.currentUser);
    }

    // Check team match
    if (context.currentTeam && entityData.owners.includes(context.currentTeam)) {
      score = Math.max(score, 0.8);
      matches.push(context.currentTeam);
    }

    return {
      signal: this.signal,
      score,
      confidence: matches.length > 0 ? 0.8 : 0.4,
      metadata: { matches, owners: entityData.owners },
    };
  }
}

/**
 * Risk correlation signal
 */
export class RiskSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'risk';

  async compute(
    _entityId: EntityId,
    _context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (entityData.riskLevel === undefined) {
      return { signal: this.signal, score: 0.5, confidence: 0.2 };
    }

    // Higher risk = more relevant (might need attention)
    // Normalize risk level to 0-1
    const normalizedRisk = Math.min(1, Math.max(0, entityData.riskLevel));

    return {
      signal: this.signal,
      score: normalizedRisk,
      confidence: 0.7,
      metadata: { riskLevel: entityData.riskLevel },
    };
  }
}

/**
 * Test coverage correlation signal
 */
export class TestSignalComputer implements SignalComputer {
  readonly signal: SignalType = 'test';

  async compute(
    _entityId: EntityId,
    _context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (entityData.testCoverage === undefined) {
      return { signal: this.signal, score: 0.5, confidence: 0.2 };
    }

    // Well-tested code might be more relevant for understanding
    const coverage = Math.min(1, Math.max(0, entityData.testCoverage));

    return {
      signal: this.signal,
      score: coverage,
      confidence: 0.6,
      metadata: { testCoverage: entityData.testCoverage },
    };
  }
}

/**
 * Dependency distance signal
 */
export class DependencySignalComputer implements SignalComputer {
  readonly signal: SignalType = 'dependency';

  async compute(
    _entityId: EntityId,
    context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (!context.currentFile || (!entityData.dependencies?.length && !entityData.dependents?.length)) {
      return { signal: this.signal, score: 0.5, confidence: 0.2 };
    }

    // Check if current file is in dependencies or dependents
    const isDependency = entityData.dependencies?.includes(context.currentFile) ?? false;
    const isDependent = entityData.dependents?.includes(context.currentFile) ?? false;

    let score = 0.5;
    if (isDependency || isDependent) {
      score = 1.0; // Direct dependency
    }

    return {
      signal: this.signal,
      score,
      confidence: isDependency || isDependent ? 0.9 : 0.4,
      metadata: { isDependency, isDependent },
    };
  }
}

/**
 * History/co-change correlation signal
 */
export class HistorySignalComputer implements SignalComputer {
  readonly signal: SignalType = 'history';

  async compute(
    _entityId: EntityId,
    _context: QueryContext,
    entityData: EntityData
  ): Promise<SignalValue> {
    if (entityData.changeFrequency === undefined) {
      return { signal: this.signal, score: 0.5, confidence: 0.2 };
    }

    // Frequently changed files might be more relevant
    // Normalize change frequency (assume 0-100 range)
    const normalized = Math.min(1, entityData.changeFrequency / 100);

    return {
      signal: this.signal,
      score: normalized,
      confidence: 0.6,
      metadata: { changeFrequency: entityData.changeFrequency },
    };
  }
}

// ============================================================================
// MULTI-SIGNAL SCORER
// ============================================================================

export class MultiSignalScorer {
  private weights: Map<SignalType, SignalWeight>;
  private computers: Map<SignalType, SignalComputer>;
  private feedbackHistory: FeedbackRecord[] = [];
  private readonly maxFeedbackHistory = 10000;

  constructor() {
    // Initialize default weights
    this.weights = new Map([
      ['semantic', { signal: 'semantic', weight: 0.25, learningRate: 0.1 }],
      ['structural', { signal: 'structural', weight: 0.10, learningRate: 0.1 }],
      ['history', { signal: 'history', weight: 0.08, learningRate: 0.1 }],
      ['recency', { signal: 'recency', weight: 0.07, learningRate: 0.1 }],
      ['keyword', { signal: 'keyword', weight: 0.15, learningRate: 0.1 }],
      ['domain', { signal: 'domain', weight: 0.10, learningRate: 0.1 }],
      ['entity_type', { signal: 'entity_type', weight: 0.08, learningRate: 0.1 }],
      ['ownership', { signal: 'ownership', weight: 0.05, learningRate: 0.1 }],
      ['risk', { signal: 'risk', weight: 0.04, learningRate: 0.1 }],
      ['test', { signal: 'test', weight: 0.04, learningRate: 0.1 }],
      ['dependency', { signal: 'dependency', weight: 0.04, learningRate: 0.1 }],
    ]);

    // Initialize default signal computers
    this.computers = new Map([
      ['semantic', new SemanticSignalComputer()],
      ['structural', new StructuralSignalComputer()],
      ['history', new HistorySignalComputer()],
      ['recency', new RecencySignalComputer()],
      ['keyword', new KeywordSignalComputer()],
      ['domain', new DomainSignalComputer()],
      ['entity_type', new EntityTypeSignalComputer()],
      ['ownership', new OwnershipSignalComputer()],
      ['risk', new RiskSignalComputer()],
      ['test', new TestSignalComputer()],
      ['dependency', new DependencySignalComputer()],
    ]);
  }

  // ============================================================================
  // SCORING
  // ============================================================================

  /**
   * Score a single entity against a query context
   */
  async scoreEntity(
    entityData: EntityData,
    context: QueryContext
  ): Promise<ScoredEntity> {
    const signals: SignalValue[] = [];

    // Compute all signals in parallel
    const signalPromises = Array.from(this.computers.entries()).map(
      async ([signalType, computer]) => {
        try {
          return await computer.compute(entityData.id, context, entityData);
        } catch {
          // Return neutral signal on error
          return { signal: signalType, score: 0.5, confidence: 0 };
        }
      }
    );

    const computedSignals = await Promise.all(signalPromises);
    signals.push(...computedSignals);

    // Combine signals using weighted sum
    const { score, confidence } = this.combineSignals(signals);

    // Generate explanation
    const explanation = this.generateExplanation(signals);

    return {
      entityId: entityData.id,
      signals,
      combinedScore: score,
      confidence,
      explanation,
    };
  }

  /**
   * Score multiple entities
   */
  async scoreEntities(
    entities: EntityData[],
    context: QueryContext
  ): Promise<ScoredEntity[]> {
    const scored = await Promise.all(
      entities.map(e => this.scoreEntity(e, context))
    );

    // Sort by combined score descending
    return scored.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Combine signals into a final score
   */
  private combineSignals(signals: SignalValue[]): { score: number; confidence: number } {
    let weightedSum = 0;
    let totalWeight = 0;
    let confidenceSum = 0;
    let confidenceWeightSum = 0;

    for (const signal of signals) {
      const weight = this.weights.get(signal.signal)?.weight ?? 0;

      // Weight by both configured weight and signal confidence
      const effectiveWeight = weight * signal.confidence;
      weightedSum += signal.score * effectiveWeight;
      totalWeight += effectiveWeight;

      // Track confidence separately
      confidenceSum += signal.confidence * weight;
      confidenceWeightSum += weight;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const confidence = confidenceWeightSum > 0 ? confidenceSum / confidenceWeightSum : 0;

    return { score, confidence };
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(signals: SignalValue[]): string {
    // Sort by contribution (score * weight * confidence)
    const contributions = signals
      .map(s => ({
        signal: s.signal,
        contribution: s.score * (this.weights.get(s.signal)?.weight ?? 0) * s.confidence,
        score: s.score,
      }))
      .sort((a, b) => b.contribution - a.contribution);

    const top3 = contributions.slice(0, 3);
    const explanations = top3.map(c => {
      const pct = Math.round(c.score * 100);
      return `${c.signal}: ${pct}%`;
    });

    return `Top signals: ${explanations.join(', ')}`;
  }

  // ============================================================================
  // WEIGHT LEARNING
  // ============================================================================

  /**
   * Record feedback on a scored entity
   */
  recordFeedback(entityId: EntityId, wasRelevant: boolean, signals: SignalValue[]): void {
    this.feedbackHistory.push({
      entityId,
      wasRelevant,
      signals,
      timestamp: now(),
    });

    // Prune old feedback
    if (this.feedbackHistory.length > this.maxFeedbackHistory) {
      this.feedbackHistory = this.feedbackHistory.slice(-this.maxFeedbackHistory);
    }

    // Update weights based on feedback
    this.updateWeights(wasRelevant, signals);
  }

  /**
   * Update weights based on feedback
   */
  private updateWeights(wasRelevant: boolean, signals: SignalValue[]): void {
    const target = wasRelevant ? 1.0 : 0.0;

    for (const signal of signals) {
      const weightConfig = this.weights.get(signal.signal);
      if (!weightConfig) continue;

      // Gradient: how much did this signal contribute to the error?
      // If signal was high and result was wrong, reduce weight
      // If signal was high and result was right, increase weight
      const error = target - signal.score;
      const gradient = error * signal.confidence;

      // Update weight with learning rate
      const newWeight = weightConfig.weight + weightConfig.learningRate * gradient;

      // Clamp to reasonable range
      weightConfig.weight = Math.max(0.01, Math.min(0.5, newWeight));
    }

    // Normalize weights to sum to 1
    this.normalizeWeights();
  }

  /**
   * Normalize weights to sum to 1
   */
  private normalizeWeights(): void {
    let total = 0;
    for (const config of this.weights.values()) {
      total += config.weight;
    }

    if (total > 0) {
      for (const config of this.weights.values()) {
        config.weight /= total;
      }
    }
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Register a custom signal computer
   */
  registerComputer(computer: SignalComputer): void {
    this.computers.set(computer.signal, computer);

    // Add default weight if not exists
    if (!this.weights.has(computer.signal)) {
      this.weights.set(computer.signal, {
        signal: computer.signal,
        weight: 0.05, // Low default weight for new signals
        learningRate: 0.1,
      });
      this.normalizeWeights();
    }
  }

  /**
   * Set weight for a signal
   */
  setWeight(signal: SignalType, weight: number): void {
    const config = this.weights.get(signal);
    if (config) {
      config.weight = Math.max(0.01, Math.min(1.0, weight));
      this.normalizeWeights();
    }
  }

  /**
   * Get current weights
   */
  getWeights(): Record<SignalType, number> {
    const result: Partial<Record<SignalType, number>> = {};
    for (const [signal, config] of this.weights) {
      result[signal] = config.weight;
    }
    return result as Record<SignalType, number>;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get learning statistics
   */
  getStats(): {
    totalFeedback: number;
    positiveRatio: number;
    weights: Record<SignalType, number>;
    signalPerformance: Record<SignalType, { avgScore: number; avgContribution: number }>;
  } {
    const positiveCount = this.feedbackHistory.filter(f => f.wasRelevant).length;
    const positiveRatio = this.feedbackHistory.length > 0
      ? positiveCount / this.feedbackHistory.length
      : 0;

    // Calculate signal performance from feedback
    const signalPerformance: Record<string, { scores: number[]; contributions: number[] }> = {};

    for (const feedback of this.feedbackHistory.slice(-1000)) {
      for (const signal of feedback.signals) {
        if (!signalPerformance[signal.signal]) {
          signalPerformance[signal.signal] = { scores: [], contributions: [] };
        }
        signalPerformance[signal.signal].scores.push(signal.score);

        const weight = this.weights.get(signal.signal)?.weight ?? 0;
        signalPerformance[signal.signal].contributions.push(signal.score * weight);
      }
    }

    const avgPerformance: Record<string, { avgScore: number; avgContribution: number }> = {};
    for (const [signal, data] of Object.entries(signalPerformance)) {
      avgPerformance[signal] = {
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        avgContribution: data.contributions.reduce((a, b) => a + b, 0) / data.contributions.length,
      };
    }

    return {
      totalFeedback: this.feedbackHistory.length,
      positiveRatio,
      weights: this.getWeights(),
      signalPerformance: avgPerformance as Record<SignalType, { avgScore: number; avgContribution: number }>,
    };
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  /**
   * Export state for persistence
   */
  toJSON(): {
    weights: Record<SignalType, SignalWeight>;
    recentFeedback: FeedbackRecord[];
  } {
    return {
      weights: Object.fromEntries(this.weights) as Record<SignalType, SignalWeight>,
      recentFeedback: this.feedbackHistory.slice(-1000),
    };
  }

  /**
   * Import state
   */
  fromJSON(data: {
    weights?: Record<string, SignalWeight>;
    recentFeedback?: FeedbackRecord[];
  }): void {
    if (data.weights) {
      for (const [signal, config] of Object.entries(data.weights)) {
        this.weights.set(signal as SignalType, config);
      }
    }

    if (data.recentFeedback) {
      this.feedbackHistory = data.recentFeedback;
    }
  }

  /**
   * Reset to default weights
   */
  reset(): void {
    this.feedbackHistory = [];
    this.weights = new Map([
      ['semantic', { signal: 'semantic', weight: 0.25, learningRate: 0.1 }],
      ['structural', { signal: 'structural', weight: 0.10, learningRate: 0.1 }],
      ['history', { signal: 'history', weight: 0.08, learningRate: 0.1 }],
      ['recency', { signal: 'recency', weight: 0.07, learningRate: 0.1 }],
      ['keyword', { signal: 'keyword', weight: 0.15, learningRate: 0.1 }],
      ['domain', { signal: 'domain', weight: 0.10, learningRate: 0.1 }],
      ['entity_type', { signal: 'entity_type', weight: 0.08, learningRate: 0.1 }],
      ['ownership', { signal: 'ownership', weight: 0.05, learningRate: 0.1 }],
      ['risk', { signal: 'risk', weight: 0.04, learningRate: 0.1 }],
      ['test', { signal: 'test', weight: 0.04, learningRate: 0.1 }],
      ['dependency', { signal: 'dependency', weight: 0.04, learningRate: 0.1 }],
    ]);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const multiSignalScorer = new MultiSignalScorer();
