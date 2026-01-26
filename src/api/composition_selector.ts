import type { TechniqueComposition } from '../strategic/techniques.js';
import type { LearnedRecommendations, LearningLoop, LearningQueryContext } from './learning_loop.js';
import { EmbeddingService, cosineSimilarity } from './embeddings.js';
import { matchCompositionKeywords } from './composition_keywords.js';
import { ProviderUnavailableError, requireProviders, type ProviderCheckOptions } from './provider_check.js';

export type CompositionSelectionMode = 'keyword' | 'semantic' | 'hybrid';

export interface CompositionSelectionOptions {
  selectionMode?: CompositionSelectionMode;
  maxResults?: number;
  minConfidence?: number;
  includeAlternatives?: boolean;
  alternativesLimit?: number;
  includeIntentEmbedding?: boolean;
  allowKeywordFallback?: boolean;
  providerCheck?: ProviderCheckOptions;
  learningSignals?: Record<string, LearningSignal>;
  learningBoostScale?: number;
}

export interface LearningSignal {
  score: number;
  successRate: number;
  examples: number;
}

export interface CompositionUsageOutcome {
  success: boolean;
  reason?: string;
}

export type MatchReason =
  | { type: 'semantic'; similarity: number; intentEmbedding?: Float32Array }
  | { type: 'keyword'; matchedKeywords: string[] }
  | { type: 'learned'; priorSuccessRate: number; usageCount: number }
  | { type: 'explicit'; userSpecified: true };

export interface AlternativeMatch {
  compositionId: string;
  confidence: number;
  reason: MatchReason;
}

export interface CompositionMatch {
  composition: TechniqueComposition;
  matchReason: MatchReason;
  confidence: number;
  alternatives: AlternativeMatch[];
}

export interface CompositionSelector {
  select(intent: string, options?: CompositionSelectionOptions): Promise<CompositionMatch[]>;
  recordUsage(intent: string, selectedComposition: string, outcome: CompositionUsageOutcome): void;
}

type UsageStats = {
  successes: number;
  failures: number;
  lastUsedAt: string;
};

const DEFAULT_MIN_CONFIDENCE = 0.3;
const DEFAULT_MAX_RESULTS = 3;
const DEFAULT_ALTERNATIVES = 3;
const DEFAULT_USAGE_BOOST = 0.2;
const DEFAULT_LEARNING_BOOST = 0.15;
const FALLBACK_MATCH_TARGET = 3;
const FALLBACK_CONFIDENCE_BASE = 0.25;
const FALLBACK_CONFIDENCE_RANGE = 0.35;
const FALLBACK_CONFIDENCE_CAP = 0.6;
const MAX_INTENT_LENGTH = 10000;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;

function buildCompositionDescriptor(composition: TechniqueComposition): string {
  const lines: string[] = [
    composition.name,
    composition.description,
  ];
  if (composition.primitiveIds.length > 0) {
    lines.push(`Primitives: ${composition.primitiveIds.join(', ')}`);
  }
  if (composition.operators && composition.operators.length > 0) {
    const operatorTypes = composition.operators.map((operator) => operator.type).join(', ');
    lines.push(`Operators: ${operatorTypes}`);
  }
  if (composition.relationships && composition.relationships.length > 0) {
    const relationshipTypes = Array.from(new Set(
      composition.relationships.map((relationship) => relationship.type)
    )).join(', ');
    lines.push(`Relationships: ${relationshipTypes}`);
  }
  return lines.filter((line) => line.trim().length > 0).join('\n');
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-limit, Math.min(limit, value));
}

export function buildLearningSignalMap(recommendations: LearnedRecommendations): Record<string, LearningSignal> {
  const signals: Record<string, LearningSignal> = {};
  for (const suggestion of recommendations.suggestedCompositions) {
    signals[suggestion.compositionId] = {
      score: suggestion.score,
      successRate: suggestion.successRate,
      examples: suggestion.examples,
    };
  }
  return signals;
}

function computeLearningBoost(signal: LearningSignal | undefined, scale: number): number {
  if (!signal) return 0;
  const centered = signal.successRate - 0.5;
  const evidenceWeight = Math.min(1, signal.examples / 10);
  return clampSigned(centered * scale * evidenceWeight, scale);
}

function computeKeywordConfidence(matchedCount: number): number {
  if (matchedCount <= 0) return 0;
  const ratio = Math.min(1, matchedCount / FALLBACK_MATCH_TARGET);
  return FALLBACK_CONFIDENCE_BASE + ratio * FALLBACK_CONFIDENCE_RANGE;
}

function isProviderUnavailable(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof ProviderUnavailableError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('unverified_by_trace(provider_unavailable)');
}

function rankMatches(
  entries: Array<{ composition: TechniqueComposition; confidence: number; matchReason: MatchReason }>,
  minConfidence: number
): Array<{ composition: TechniqueComposition; confidence: number; matchReason: MatchReason }> {
  return entries
    .filter((entry) => entry.confidence >= minConfidence)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.composition.id.localeCompare(b.composition.id);
    });
}

export class SemanticCompositionSelector implements CompositionSelector {
  private readonly compositions: TechniqueComposition[];
  private readonly compositionIds: Set<string>;
  private readonly embeddingService: EmbeddingService;
  private readonly providerCheck?: ProviderCheckOptions;
  private readonly learner?: LearningLoop;
  private readonly usageStats = new Map<string, UsageStats>();
  private readonly embeddingCache = new Map<string, { updatedAt: string; embedding: Float32Array }>();

  constructor(options: {
    compositions: TechniqueComposition[];
    embeddingService?: EmbeddingService;
    providerCheck?: ProviderCheckOptions;
    learner?: LearningLoop;
  }) {
    this.compositions = options.compositions;
    this.compositionIds = new Set(options.compositions.map((composition) => composition.id));
    this.embeddingService = options.embeddingService ?? new EmbeddingService();
    this.providerCheck = options.providerCheck;
    this.learner = options.learner;
  }

  recordUsage(_intent: string, selectedComposition: string, outcome: CompositionUsageOutcome): void {
    if (typeof selectedComposition !== 'string' || selectedComposition.trim().length === 0) {
      throw new Error('unverified_by_trace(composition_id_invalid)');
    }
    if (!this.compositionIds.has(selectedComposition)) {
      throw new Error(`unverified_by_trace(composition_unknown): ${selectedComposition}`);
    }
    const existing = this.usageStats.get(selectedComposition) ?? {
      successes: 0,
      failures: 0,
      lastUsedAt: new Date().toISOString(),
    };
    if (outcome.success) {
      existing.successes += 1;
    } else {
      existing.failures += 1;
    }
    existing.lastUsedAt = new Date().toISOString();
    this.usageStats.set(selectedComposition, existing);
  }

  async select(intent: string, options: CompositionSelectionOptions = {}): Promise<CompositionMatch[]> {
    const trimmedIntent = intent.trim();
    const sanitizedIntent = trimmedIntent.replace(CONTROL_CHAR_PATTERN, ' ').trim();
    if (!sanitizedIntent) {
      throw new Error('unverified_by_trace(intent_invalid)');
    }
    if (sanitizedIntent.length > MAX_INTENT_LENGTH) {
      throw new Error('unverified_by_trace(intent_too_long)');
    }

    const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      throw new Error('unverified_by_trace(selection_confidence_invalid)');
    }
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    if (!Number.isFinite(maxResults) || maxResults < 0 || !Number.isInteger(maxResults)) {
      throw new Error('unverified_by_trace(selection_max_results_invalid)');
    }
    const includeAlternatives = options.includeAlternatives ?? true;
    const alternativesLimit = options.alternativesLimit ?? DEFAULT_ALTERNATIVES;
    if (!Number.isFinite(alternativesLimit) || alternativesLimit < 0 || !Number.isInteger(alternativesLimit)) {
      throw new Error('unverified_by_trace(selection_alternatives_invalid)');
    }
    const includeIntentEmbedding = options.includeIntentEmbedding ?? true;
    const allowKeywordFallback = options.allowKeywordFallback ?? true;
    const learningBoostScale = options.learningBoostScale ?? DEFAULT_LEARNING_BOOST;

    // Wire the learning loop: fetch recommendations from learner if available and not provided
    let learningSignals: Record<string, LearningSignal> | null = options.learningSignals ?? null;
    if (!learningSignals && this.learner) {
      const learnedRecs = await this.learner.getRecommendations(sanitizedIntent, {
        maxSuggestions: maxResults + 5,
        fallbackToGlobal: true,
      } satisfies LearningQueryContext);
      learningSignals = buildLearningSignalMap(learnedRecs);
    }
    if (!Number.isFinite(learningBoostScale) || learningBoostScale < 0 || learningBoostScale > 1) {
      throw new Error('unverified_by_trace(selection_learning_boost_invalid)');
    }

    if (maxResults === 0 || this.compositions.length === 0) {
      return [];
    }

    const buildSelections = (
      ranked: Array<{ composition: TechniqueComposition; confidence: number; matchReason: MatchReason }>
    ): CompositionMatch[] => {
      const limited = ranked.slice(0, maxResults);
      return limited.map((entry) => ({
        composition: entry.composition,
        confidence: entry.confidence,
        matchReason: entry.matchReason,
        alternatives: includeAlternatives
          ? ranked
            .filter((alt) => alt.composition.id !== entry.composition.id)
            .slice(0, alternativesLimit)
            .map((alt) => ({
              compositionId: alt.composition.id,
              confidence: alt.confidence,
              reason: alt.matchReason,
            }))
          : [],
      }));
    };

    const fallbackByKeyword = (): CompositionMatch[] => {
      const scored = this.compositions.flatMap((composition) => {
        const matchedKeywords = matchCompositionKeywords(sanitizedIntent, composition);
        if (matchedKeywords.length === 0) return [];
        const usageBoost = this.getUsageBoost(composition.id);
        const learningBoost = computeLearningBoost(learningSignals?.[composition.id], learningBoostScale);
        const base = computeKeywordConfidence(matchedKeywords.length);
        const confidence = Math.min(
          FALLBACK_CONFIDENCE_CAP,
          clampConfidence(base + usageBoost + learningBoost)
        );
        const matchReason: MatchReason = { type: 'keyword', matchedKeywords };
        return [{ composition, confidence, matchReason }];
      });
      const ranked = rankMatches(scored, minConfidence);
      return buildSelections(ranked);
    };

    try {
      await requireProviders({ llm: false, embedding: true }, options.providerCheck ?? this.providerCheck);

      const intentEmbedding = (await this.embeddingService.generateEmbedding({
        text: sanitizedIntent,
        kind: 'query',
      })).embedding;
      const compositionEmbeddings = await this.resolveCompositionEmbeddings();

      const scored = this.compositions.map((composition) => {
        const embedding = compositionEmbeddings.get(composition.id);
        if (!embedding) {
          throw new Error(`unverified_by_trace(composition_embedding_missing): ${composition.id}`);
        }
        const similarity = cosineSimilarity(intentEmbedding, embedding);
        const usageBoost = this.getUsageBoost(composition.id);
        const learningBoost = computeLearningBoost(learningSignals?.[composition.id], learningBoostScale);
        const confidence = clampConfidence(Math.max(0, similarity) + usageBoost + learningBoost);
        const matchReason: MatchReason = includeIntentEmbedding
          ? { type: 'semantic', similarity, intentEmbedding }
          : { type: 'semantic', similarity };
        return { composition, confidence, matchReason };
      });

      const ranked = rankMatches(scored, minConfidence);
      return buildSelections(ranked);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (allowKeywordFallback) {
        if (
          isProviderUnavailable(error) ||
          message.includes('unverified_by_trace(embedding_request_failed)') ||
          !message.includes('unverified_by_trace(')
        ) {
          return fallbackByKeyword();
        }
      }
      if (message.includes('unverified_by_trace(')) {
        throw error;
      }
      throw new Error(`unverified_by_trace(embedding_request_failed): ${message}`);
    }
  }

  private getUsageBoost(compositionId: string): number {
    const stats = this.usageStats.get(compositionId);
    if (!stats) return 0;
    const total = stats.successes + stats.failures;
    if (total === 0) return 0;
    const successRate = stats.successes / total;
    const centered = successRate - 0.5;
    return clampSigned(centered * DEFAULT_USAGE_BOOST, DEFAULT_USAGE_BOOST);
  }

  private async resolveCompositionEmbeddings(): Promise<Map<string, Float32Array>> {
    const resolved = new Map<string, Float32Array>();
    const pending: Array<{ composition: TechniqueComposition; text: string }> = [];

    for (const composition of this.compositions) {
      const cached = this.embeddingCache.get(composition.id);
      if (cached && cached.updatedAt === composition.updatedAt) {
        resolved.set(composition.id, cached.embedding);
        continue;
      }
      pending.push({ composition, text: buildCompositionDescriptor(composition) });
    }

    if (pending.length > 0) {
      const results = await this.embeddingService.generateEmbeddings(
        pending.map((item) => ({ text: item.text, kind: 'code' }))
      );
      if (results.length !== pending.length) {
        throw new Error('unverified_by_trace(embedding_results_mismatch)');
      }
      results.forEach((result, index) => {
        const composition = pending[index]?.composition;
        if (!composition) {
          throw new Error('unverified_by_trace(embedding_index_mismatch)');
        }
        this.embeddingCache.set(composition.id, {
          updatedAt: composition.updatedAt,
          embedding: result.embedding,
        });
        resolved.set(composition.id, result.embedding);
      });
    }

    return resolved;
  }
}

export const __testing = {
  computeLearningBoost,
};
