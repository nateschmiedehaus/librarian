/**
 * @fileoverview Knowledge Aggregation System
 *
 * PHILOSOPHICAL ALIGNMENT (UNDERSTANDING_LAYER.md §Knowledge Aggregation Rules):
 * Parent entities (modules, subsystems) inherit knowledge from children
 * according to explicit aggregation rules. These rules ensure consistent
 * rollup and prevent silent knowledge loss.
 *
 * AGGREGATION FUNCTIONS BY DOMAIN:
 * - Purpose: LLM synthesis
 * - Risk: Maximum + Coupling penalty
 * - Quality: Weighted average by LOC
 * - Ownership: Mode + Recency
 * - Coverage: Aggregated ratio
 * - Confidence: Minimum + Propagation factor (0.95)
 *
 * DEFEATER PROPAGATION:
 * - Critical: Always propagate
 * - High: Propagate if > 50% of children affected
 * - Medium: Aggregate count in parent metadata
 * - Low: Only recorded in child entities
 */

import type { ContextPack } from '../types.js';
import type { DefeaterType } from '../knowledge/universal_types.js';

// ============================================================================
// TYPES (per UNDERSTANDING_LAYER.md)
// ============================================================================

export type AggregationFunction =
  | 'min'
  | 'max'
  | 'avg'
  | 'weighted_avg'
  | 'sum'
  | 'mode'
  | 'synthesis';

export type AggregationDomain =
  | 'purpose'
  | 'risk'
  | 'quality'
  | 'ownership'
  | 'coverage'
  | 'confidence';

export interface AggregationConfig {
  /** Knowledge domain being aggregated */
  domain: AggregationDomain;
  /** Aggregation function to use */
  function: AggregationFunction;
  /** Weights for weighted operations (key = entity id) */
  weights?: Record<string, number>;
  /** Confidence decay per aggregation level (default: 0.95) */
  propagationFactor?: number;
  /** Coupling penalty for risk aggregation */
  couplingPenalty?: number;
  /** LLM prompt for synthesis function */
  synthesisPrompt?: string;
}

export interface AggregatedKnowledge {
  /** Aggregated value */
  value: number | string | string[];
  /** Confidence in the aggregated value */
  confidence: number;
  /** Source entity IDs that contributed */
  sourceIds: string[];
  /** Timestamp of aggregation */
  aggregatedAt: string;
  /** Config used for aggregation */
  config: AggregationConfig;
}

export interface EntityForAggregation {
  id: string;
  /** Lines of code (for weighting) */
  loc?: number;
  /** Entity type */
  type: string;
  /** Child entity IDs */
  childIds?: string[];
  /** Number of edges/dependencies */
  edgeCount?: number;
  /** Knowledge values by domain */
  knowledge?: Partial<Record<AggregationDomain, number | string | string[]>>;
  /** Confidence for this entity */
  confidence?: number;
  /** Active defeaters */
  defeaters?: AggregatedDefeater[];
}

export interface AggregatedDefeater {
  type: DefeaterType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  active: boolean;
  sourceId?: string;
  description?: string;
  count?: number;
}

// ============================================================================
// DEFAULT CONFIGS (per UNDERSTANDING_LAYER.md)
// ============================================================================

export const DEFAULT_AGGREGATION_CONFIGS: Record<AggregationDomain, AggregationConfig> = {
  purpose: {
    domain: 'purpose',
    function: 'synthesis',
    synthesisPrompt: 'Summarize the purpose of this module based on its child components',
    propagationFactor: 0.95,
  },
  risk: {
    domain: 'risk',
    function: 'max',
    couplingPenalty: 0.05, // per edge
    propagationFactor: 0.95,
  },
  quality: {
    domain: 'quality',
    function: 'weighted_avg',
    propagationFactor: 0.95,
  },
  ownership: {
    domain: 'ownership',
    function: 'mode',
    propagationFactor: 0.95,
  },
  coverage: {
    domain: 'coverage',
    function: 'avg',
    propagationFactor: 0.95,
  },
  confidence: {
    domain: 'confidence',
    function: 'min',
    propagationFactor: 0.95,
  },
};

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Aggregate knowledge from child entities to parent.
 */
export function aggregateKnowledge(
  _parent: EntityForAggregation,
  children: EntityForAggregation[],
  config: AggregationConfig
): AggregatedKnowledge {
  if (children.length === 0) {
    return {
      value: 0,
      confidence: 0,
      sourceIds: [],
      aggregatedAt: new Date().toISOString(),
      config,
    };
  }

  const values = children
    .map(c => c.knowledge?.[config.domain])
    .filter((v): v is number | string | string[] => v !== undefined);

  const numericValues = values.filter((v): v is number => typeof v === 'number');

  let aggregatedValue: number | string | string[];
  let confidence: number;

  switch (config.function) {
    case 'min':
      aggregatedValue = numericValues.length > 0 ? Math.min(...numericValues) : 0;
      confidence = propagateConfidence(
        children.map(c => c.confidence ?? 0.5),
        config.propagationFactor
      );
      break;

    case 'max':
      aggregatedValue = numericValues.length > 0 ? Math.max(...numericValues) : 0;
      // For risk: add coupling penalty
      if (config.domain === 'risk' && config.couplingPenalty) {
        const totalEdges = children.reduce((sum, c) => sum + (c.edgeCount ?? 0), 0);
        aggregatedValue = (aggregatedValue as number) + config.couplingPenalty * totalEdges;
      }
      confidence = propagateConfidence(
        children.map(c => c.confidence ?? 0.5),
        config.propagationFactor
      );
      break;

    case 'avg':
      aggregatedValue = numericValues.length > 0
        ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length
        : 0;
      confidence = propagateConfidence(
        children.map(c => c.confidence ?? 0.5),
        config.propagationFactor
      );
      break;

    case 'weighted_avg':
      const totalWeight = children.reduce((sum, c) =>
        sum + (config.weights?.[c.id] ?? c.loc ?? 1), 0);
      const weightedSum = children.reduce((sum, c) => {
        const value = c.knowledge?.[config.domain];
        if (typeof value !== 'number') return sum;
        const weight = config.weights?.[c.id] ?? c.loc ?? 1;
        return sum + value * weight;
      }, 0);
      aggregatedValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
      confidence = propagateConfidence(
        children.map(c => c.confidence ?? 0.5),
        config.propagationFactor
      );
      break;

    case 'sum':
      aggregatedValue = numericValues.reduce((sum, v) => sum + v, 0);
      confidence = propagateConfidence(
        children.map(c => c.confidence ?? 0.5),
        config.propagationFactor
      );
      break;

    case 'mode':
      const counts = new Map<string, number>();
      for (const value of values) {
        const key = String(value);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      aggregatedValue = sorted.length > 0 ? sorted[0][0] : '';
      confidence = propagateConfidence(
        children.map(c => c.confidence ?? 0.5),
        config.propagationFactor
      );
      break;

    case 'synthesis':
      // For synthesis, return the child values to be synthesized by LLM
      aggregatedValue = values.map(v => String(v));
      confidence = propagateConfidence(
        children.map(c => c.confidence ?? 0.5),
        config.propagationFactor
      ) * 0.9; // Additional penalty for synthesis uncertainty
      break;

    default:
      aggregatedValue = 0;
      confidence = 0;
  }

  return {
    value: aggregatedValue,
    confidence,
    sourceIds: children.map(c => c.id),
    aggregatedAt: new Date().toISOString(),
    config,
  };
}

// ============================================================================
// CONFIDENCE PROPAGATION (per UNDERSTANDING_LAYER.md)
// ============================================================================

/**
 * Propagate confidence from children to parent.
 *
 * Per UNDERSTANDING_LAYER.md:
 * - Take minimum child confidence
 * - Apply propagation factor (default 0.95) per level
 *
 * Example: 3-level hierarchy with child confidence 0.8
 * - Level 1 (direct): 0.8 * 0.95 = 0.76
 * - Level 2 (module): 0.76 * 0.95 = 0.72
 * - Level 3 (subsystem): 0.72 * 0.95 = 0.68
 */
export function propagateConfidence(
  childConfidences: number[],
  propagationFactor: number = 0.95
): number {
  if (childConfidences.length === 0) {
    return 0;
  }

  // Minimum child confidence with propagation penalty
  const minConfidence = Math.min(...childConfidences);

  // Apply propagation factor per aggregation level
  return minConfidence * propagationFactor;
}

/**
 * Calculate confidence for multi-level hierarchy.
 */
export function calculateHierarchicalConfidence(
  baseConfidence: number,
  levels: number,
  propagationFactor: number = 0.95
): number {
  return baseConfidence * Math.pow(propagationFactor, levels);
}

// ============================================================================
// DEFEATER PROPAGATION (per UNDERSTANDING_LAYER.md)
// ============================================================================

/**
 * Propagate defeaters from children to parent.
 *
 * Per UNDERSTANDING_LAYER.md:
 * - Critical defeaters: Always propagate
 * - High defeaters: Propagate if > 50% of children affected
 * - Medium defeaters: Aggregate count in parent metadata
 * - Low defeaters: Only recorded in child entities (not propagated)
 */
export function propagateDefeaters(
  children: EntityForAggregation[]
): AggregatedDefeater[] {
  const propagated: AggregatedDefeater[] = [];

  // Collect all active defeaters by severity
  const criticalDefeaters: AggregatedDefeater[] = [];
  const highDefeaters: AggregatedDefeater[] = [];
  const mediumDefeaters: AggregatedDefeater[] = [];

  for (const child of children) {
    if (!child.defeaters) continue;

    for (const defeater of child.defeaters) {
      if (!defeater.active) continue;

      switch (defeater.severity) {
        case 'critical':
          criticalDefeaters.push({ ...defeater, sourceId: child.id });
          break;
        case 'high':
          highDefeaters.push({ ...defeater, sourceId: child.id });
          break;
        case 'medium':
          mediumDefeaters.push({ ...defeater, sourceId: child.id });
          break;
        // Low defeaters are not propagated
      }
    }
  }

  // Always propagate critical defeaters
  propagated.push(...criticalDefeaters);

  // Propagate high defeaters if > 50% of children affected
  const highThreshold = children.length * 0.5;
  if (highDefeaters.length > highThreshold) {
    propagated.push(createAggregatedDefeater('high', highDefeaters));
  }

  // Aggregate medium defeaters into count
  if (mediumDefeaters.length > 0) {
    propagated.push(createAggregatedDefeater('medium', mediumDefeaters));
  }

  return propagated;
}

/**
 * Create an aggregated defeater from multiple child defeaters.
 */
function createAggregatedDefeater(
  severity: 'high' | 'medium',
  defeaters: AggregatedDefeater[]
): AggregatedDefeater {
  // Group by type
  const typeCounts = new Map<DefeaterType, number>();
  for (const d of defeaters) {
    typeCounts.set(d.type, (typeCounts.get(d.type) ?? 0) + 1);
  }

  // Most common type
  const sortedTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const primaryType = sortedTypes[0]?.[0] ?? 'new_info';

  return {
    type: primaryType,
    severity,
    active: true,
    count: defeaters.length,
    description: `Aggregated ${defeaters.length} ${severity} defeaters from children`,
  };
}

// ============================================================================
// AGGREGATION TRIGGERS
// ============================================================================

export type AggregationTrigger =
  | 'child_change'
  | 'child_add'
  | 'child_remove'
  | 'staleness'
  | 'query_demand';

export interface AggregationEvent {
  trigger: AggregationTrigger;
  parentId: string;
  childId?: string;
  timestamp: string;
  domain?: AggregationDomain;
}

/**
 * Check if aggregation is needed for a parent entity.
 */
export function shouldAggregate(
  parent: EntityForAggregation,
  lastAggregation: string | null,
  staleness: number,
  maxStalenessMs: number
): boolean {
  // Always aggregate if never done
  if (!lastAggregation) {
    return true;
  }

  // Check staleness
  const ageMs = Date.now() - new Date(lastAggregation).getTime();
  if (ageMs > maxStalenessMs) {
    return true;
  }

  // Check if staleness percentage exceeds threshold
  if (staleness > 0.5) {
    return true;
  }

  return false;
}

// ============================================================================
// AGGREGATION CACHE
// ============================================================================

export interface AggregationCacheEntry {
  knowledge: AggregatedKnowledge;
  expiresAt: number;
  invalidatedBy?: string[];
}

const aggregationCache = new Map<string, AggregationCacheEntry>();

/**
 * Get cached aggregation or compute fresh.
 */
export function getCachedAggregation(
  parentId: string,
  domain: AggregationDomain
): AggregatedKnowledge | null {
  const key = `${parentId}:${domain}`;
  const entry = aggregationCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    aggregationCache.delete(key);
    return null;
  }

  return entry.knowledge;
}

/**
 * Cache an aggregation result.
 */
export function cacheAggregation(
  parentId: string,
  domain: AggregationDomain,
  knowledge: AggregatedKnowledge,
  ttlMs: number
): void {
  const key = `${parentId}:${domain}`;
  aggregationCache.set(key, {
    knowledge,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Invalidate cached aggregations for a parent.
 */
export function invalidateAggregationCache(
  parentId: string,
  domain?: AggregationDomain
): void {
  if (domain) {
    aggregationCache.delete(`${parentId}:${domain}`);
  } else {
    // Invalidate all domains for this parent
    for (const key of aggregationCache.keys()) {
      if (key.startsWith(`${parentId}:`)) {
        aggregationCache.delete(key);
      }
    }
  }
}

/**
 * Clear entire aggregation cache.
 */
export function clearAggregationCache(): void {
  aggregationCache.clear();
}

// ============================================================================
// DOMAIN-SPECIFIC AGGREGATORS
// ============================================================================

/**
 * Aggregate risk with coupling penalty.
 *
 * Formula: max(child_risks) + coupling_penalty * num_edges
 */
export function aggregateRisk(
  children: EntityForAggregation[],
  couplingPenalty: number = 0.05
): AggregatedKnowledge {
  const config: AggregationConfig = {
    ...DEFAULT_AGGREGATION_CONFIGS.risk,
    couplingPenalty,
  };

  return aggregateKnowledge({ id: '', type: 'module' }, children, config);
}

/**
 * Aggregate quality weighted by lines of code.
 *
 * Formula: Σ(child_quality * child_loc) / Σ(child_loc)
 */
export function aggregateQuality(
  children: EntityForAggregation[]
): AggregatedKnowledge {
  const config = DEFAULT_AGGREGATION_CONFIGS.quality;
  return aggregateKnowledge({ id: '', type: 'module' }, children, config);
}

/**
 * Aggregate coverage as ratio of covered children.
 *
 * Formula: covered_children / total_children
 */
export function aggregateCoverage(
  children: EntityForAggregation[]
): AggregatedKnowledge {
  const coveredCount = children.filter(c => {
    const coverage = c.knowledge?.coverage;
    return typeof coverage === 'number' && coverage > 0;
  }).length;

  const ratio = children.length > 0 ? coveredCount / children.length : 0;

  return {
    value: ratio,
    confidence: propagateConfidence(
      children.map(c => c.confidence ?? 0.5),
      DEFAULT_AGGREGATION_CONFIGS.coverage.propagationFactor
    ),
    sourceIds: children.map(c => c.id),
    aggregatedAt: new Date().toISOString(),
    config: DEFAULT_AGGREGATION_CONFIGS.coverage,
  };
}

/**
 * Aggregate ownership by mode (most frequent owner).
 */
export function aggregateOwnership(
  children: EntityForAggregation[]
): AggregatedKnowledge {
  const config = DEFAULT_AGGREGATION_CONFIGS.ownership;
  return aggregateKnowledge({ id: '', type: 'module' }, children, config);
}

/**
 * Aggregate confidence with propagation factor.
 *
 * Formula: min(child_confidence) * propagation_factor
 */
export function aggregateConfidence(
  children: EntityForAggregation[],
  propagationFactor: number = 0.95
): AggregatedKnowledge {
  const childConfidences = children.map(c => c.confidence ?? 0.5);
  const aggregatedConfidence = propagateConfidence(childConfidences, propagationFactor);

  return {
    value: aggregatedConfidence,
    confidence: aggregatedConfidence, // Confidence of confidence is itself
    sourceIds: children.map(c => c.id),
    aggregatedAt: new Date().toISOString(),
    config: {
      ...DEFAULT_AGGREGATION_CONFIGS.confidence,
      propagationFactor,
    },
  };
}

// ============================================================================
// FULL ENTITY AGGREGATION
// ============================================================================

export interface EntityAggregationResult {
  knowledge: Partial<Record<AggregationDomain, AggregatedKnowledge>>;
  defeaters: AggregatedDefeater[];
  aggregatedAt: string;
  childCount: number;
}

/**
 * Aggregate all knowledge domains for an entity.
 */
export function aggregateEntity(
  parent: EntityForAggregation,
  children: EntityForAggregation[],
  domains: AggregationDomain[] = ['confidence', 'risk', 'quality', 'coverage', 'ownership']
): EntityAggregationResult {
  const knowledge: Partial<Record<AggregationDomain, AggregatedKnowledge>> = {};

  for (const domain of domains) {
    const config = DEFAULT_AGGREGATION_CONFIGS[domain];
    knowledge[domain] = aggregateKnowledge(parent, children, config);
  }

  const defeaters = propagateDefeaters(children);

  return {
    knowledge,
    defeaters,
    aggregatedAt: new Date().toISOString(),
    childCount: children.length,
  };
}

// ============================================================================
// CONTEXT PACK AGGREGATION
// ============================================================================

/**
 * Aggregate knowledge from multiple context packs into a summary.
 */
export function aggregateContextPacks(
  packs: ContextPack[]
): AggregatedKnowledge {
  const children: EntityForAggregation[] = packs.map(pack => ({
    id: pack.packId,
    type: pack.packType,
    confidence: pack.confidence,
    knowledge: {
      confidence: pack.confidence ?? 0.5,
    },
  }));

  return aggregateConfidence(children);
}
