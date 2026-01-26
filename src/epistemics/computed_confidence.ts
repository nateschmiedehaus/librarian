/**
 * @fileoverview Computed Confidence from Signals
 *
 * Replaces the uniform 0.5 default confidence with actual computed values
 * based on multiple signal sources. This provides meaningful confidence
 * that varies based on evidence quality.
 *
 * Signal Components:
 * - Structural (0-0.50): Type annotations, docstrings, exports, complexity
 * - Semantic (0-0.30): Purpose quality, embedding cohesion
 * - Historical (0-0.20): Retrieval success rate, access count, validation count
 * - Cross-validation (-0.1 to +0.1): Extractor agreement
 *
 * Key Design Principles:
 * - Never certain (max 0.85) - epistemic humility
 * - Never clueless (min 0.15) - always some signal
 * - Real variance - entities should have different confidences
 *
 * @packageDocumentation
 */

import type { FunctionKnowledge, FileKnowledge, ModuleKnowledge, ContextPack } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input signals for confidence computation.
 * Can come from various entity types.
 */
export interface ConfidenceSignals {
  // Structural signals
  structural: {
    /** Ratio of typed parameters (0-1) */
    typeAnnotationRatio: number;
    /** Has JSDoc/TSDoc documentation */
    hasDocstring: boolean;
    /** Docstring quality (0-1) based on completeness */
    docstringQuality: number;
    /** Is exported/public API */
    isExported: boolean;
    /** Has public API surface */
    hasPublicAPI: boolean;
    /** Complexity level */
    complexity: 'low' | 'medium' | 'high';
    /** Number of lines (used for size penalty) */
    lineCount: number;
  };

  // Semantic signals
  semantic: {
    /** Purpose description quality (0-1) */
    purposeQuality: number;
    /** Embedding similarity to related entities (0-1) */
    embeddingCohesion: number;
    /** Has clear single responsibility */
    hasClearResponsibility: boolean;
  };

  // Historical signals
  historical: {
    /** Number of successful retrievals */
    retrievalCount: number;
    /** Success rate of retrievals (0-1) */
    retrievalSuccessRate: number;
    /** Number of validations performed */
    validationCount: number;
    /** Validation pass rate (0-1) */
    validationPassRate: number;
    /** Days since last access */
    daysSinceLastAccess: number | null;
  };

  // Cross-validation signals
  crossValidation: {
    /** Number of extractors that agreed */
    extractorAgreementCount: number;
    /** Total number of extractors */
    extractorTotalCount: number;
    /** Specific disagreements found */
    disagreements: string[];
  };
}

/**
 * Result of confidence computation with full breakdown.
 */
export interface ComputedConfidenceResult {
  /** Final overall confidence [0.15, 0.85] */
  overall: number;

  /** Component contributions */
  components: {
    structural: number;
    semantic: number;
    historical: number;
    crossValidation: number;
  };

  /** Weighted contributions to overall */
  contributions: {
    structuralContribution: number;
    semanticContribution: number;
    historicalContribution: number;
    crossValidationContribution: number;
  };

  /** Diagnostic information */
  diagnostics: {
    /** Why confidence is at this level */
    factors: string[];
    /** What could improve confidence */
    suggestions: string[];
    /** Raw score before clamping */
    rawScore: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum confidence - we're never completely clueless */
export const CONFIDENCE_FLOOR = 0.15;

/** Maximum confidence - we're never completely certain */
export const CONFIDENCE_CEILING = 0.85;

/** Component weights (must sum to 1.0) */
export const COMPONENT_WEIGHTS = {
  structural: 0.50,
  semantic: 0.30,
  historical: 0.15,
  crossValidation: 0.05,
} as const;

/** Structural sub-weights */
const STRUCTURAL_WEIGHTS = {
  typeAnnotations: 0.30,
  docstrings: 0.25,
  exported: 0.20,
  complexity: 0.15,
  size: 0.10,
};

/** Semantic sub-weights */
const SEMANTIC_WEIGHTS = {
  purposeQuality: 0.50,
  embeddingCohesion: 0.30,
  responsibility: 0.20,
};

/** Historical sub-weights */
const HISTORICAL_WEIGHTS = {
  retrievalSuccess: 0.40,
  validationSuccess: 0.35,
  recency: 0.25,
};

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute confidence from signals.
 *
 * This is the core confidence computation that replaces the uniform 0.5 default.
 * Uses a weighted sum of component scores, clamped to [0.15, 0.85].
 *
 * @param signals - Input signals from entity analysis
 * @returns Computed confidence with full breakdown
 */
export function computeConfidence(signals: ConfidenceSignals): ComputedConfidenceResult {
  const factors: string[] = [];
  const suggestions: string[] = [];

  // Compute structural score (0-1)
  const structural = computeStructuralScore(signals.structural, factors, suggestions);

  // Compute semantic score (0-1)
  const semantic = computeSemanticScore(signals.semantic, factors, suggestions);

  // Compute historical score (0-1)
  const historical = computeHistoricalScore(signals.historical, factors, suggestions);

  // Compute cross-validation adjustment (-0.1 to +0.1)
  const crossValidation = computeCrossValidationAdjustment(
    signals.crossValidation,
    factors,
    suggestions
  );

  // Weighted sum
  const rawScore =
    structural * COMPONENT_WEIGHTS.structural +
    semantic * COMPONENT_WEIGHTS.semantic +
    historical * COMPONENT_WEIGHTS.historical +
    crossValidation; // Cross-validation is an adjustment, not weighted

  // Clamp to [floor, ceiling]
  const overall = Math.max(CONFIDENCE_FLOOR, Math.min(CONFIDENCE_CEILING, rawScore));

  return {
    overall,
    components: {
      structural,
      semantic,
      historical,
      crossValidation,
    },
    contributions: {
      structuralContribution: structural * COMPONENT_WEIGHTS.structural,
      semanticContribution: semantic * COMPONENT_WEIGHTS.semantic,
      historicalContribution: historical * COMPONENT_WEIGHTS.historical,
      crossValidationContribution: crossValidation,
    },
    diagnostics: {
      factors,
      suggestions,
      rawScore,
    },
  };
}

// ============================================================================
// COMPONENT SCORES
// ============================================================================

/**
 * Compute structural confidence score (0-1).
 */
function computeStructuralScore(
  signals: ConfidenceSignals['structural'],
  factors: string[],
  suggestions: string[]
): number {
  let score = 0;

  // Type annotations (0-0.30)
  const typeScore = signals.typeAnnotationRatio * STRUCTURAL_WEIGHTS.typeAnnotations;
  score += typeScore;
  if (signals.typeAnnotationRatio > 0.8) {
    factors.push('Well-typed code increases confidence');
  } else if (signals.typeAnnotationRatio < 0.3) {
    suggestions.push('Add type annotations to improve confidence');
  }

  // Docstrings (0-0.25)
  if (signals.hasDocstring) {
    const docScore = signals.docstringQuality * STRUCTURAL_WEIGHTS.docstrings;
    score += docScore;
    if (signals.docstringQuality > 0.7) {
      factors.push('Comprehensive documentation increases confidence');
    }
  } else {
    suggestions.push('Add documentation comments to improve confidence');
  }

  // Exported/public (0-0.20)
  if (signals.isExported || signals.hasPublicAPI) {
    score += STRUCTURAL_WEIGHTS.exported;
    factors.push('Public API surface indicates importance');
  } else {
    // Internal code gets partial credit
    score += STRUCTURAL_WEIGHTS.exported * 0.5;
  }

  // Complexity penalty (0-0.15, inverted)
  const complexityScore =
    signals.complexity === 'low'
      ? STRUCTURAL_WEIGHTS.complexity
      : signals.complexity === 'medium'
        ? STRUCTURAL_WEIGHTS.complexity * 0.6
        : STRUCTURAL_WEIGHTS.complexity * 0.2;
  score += complexityScore;
  if (signals.complexity === 'high') {
    factors.push('High complexity reduces confidence');
    suggestions.push('Consider refactoring to reduce complexity');
  }

  // Size factor (0-0.10) - penalize very large or very small
  const sizeScore = computeSizeScore(signals.lineCount);
  score += sizeScore * STRUCTURAL_WEIGHTS.size;
  if (signals.lineCount > 500) {
    suggestions.push('Large files may have incomplete understanding');
  }

  return Math.min(1.0, score);
}

/**
 * Compute semantic confidence score (0-1).
 */
function computeSemanticScore(
  signals: ConfidenceSignals['semantic'],
  factors: string[],
  suggestions: string[]
): number {
  let score = 0;

  // Purpose quality (0-0.50)
  score += signals.purposeQuality * SEMANTIC_WEIGHTS.purposeQuality;
  if (signals.purposeQuality > 0.7) {
    factors.push('Clear purpose description increases confidence');
  } else if (signals.purposeQuality < 0.3) {
    factors.push('Vague or missing purpose description');
    suggestions.push('Improve purpose description quality');
  }

  // Embedding cohesion (0-0.30)
  score += signals.embeddingCohesion * SEMANTIC_WEIGHTS.embeddingCohesion;
  if (signals.embeddingCohesion > 0.7) {
    factors.push('High semantic coherence with related code');
  } else if (signals.embeddingCohesion < 0.3) {
    factors.push('Low semantic coherence may indicate misunderstanding');
  }

  // Single responsibility (0-0.20)
  if (signals.hasClearResponsibility) {
    score += SEMANTIC_WEIGHTS.responsibility;
    factors.push('Clear single responsibility');
  } else {
    score += SEMANTIC_WEIGHTS.responsibility * 0.3;
    suggestions.push('Consider separating concerns for clearer understanding');
  }

  return Math.min(1.0, score);
}

/**
 * Compute historical confidence score (0-1).
 */
function computeHistoricalScore(
  signals: ConfidenceSignals['historical'],
  factors: string[],
  suggestions: string[]
): number {
  let score = 0;

  // Retrieval success (0-0.40)
  if (signals.retrievalCount > 0) {
    const retrievalScore =
      signals.retrievalSuccessRate *
      Math.min(1.0, signals.retrievalCount / 10) * // Confidence grows with usage
      HISTORICAL_WEIGHTS.retrievalSuccess;
    score += retrievalScore;
    if (signals.retrievalSuccessRate > 0.8 && signals.retrievalCount >= 5) {
      factors.push('Successful retrieval history increases confidence');
    }
  } else {
    // No history - use moderate default
    score += HISTORICAL_WEIGHTS.retrievalSuccess * 0.5;
    factors.push('No retrieval history yet');
  }

  // Validation success (0-0.35)
  if (signals.validationCount > 0) {
    const validationScore =
      signals.validationPassRate *
      Math.min(1.0, signals.validationCount / 5) *
      HISTORICAL_WEIGHTS.validationSuccess;
    score += validationScore;
    if (signals.validationPassRate > 0.9) {
      factors.push('High validation pass rate');
    } else if (signals.validationPassRate < 0.5) {
      factors.push('Low validation pass rate reduces confidence');
      suggestions.push('Address validation failures');
    }
  } else {
    score += HISTORICAL_WEIGHTS.validationSuccess * 0.5;
  }

  // Recency (0-0.25)
  if (signals.daysSinceLastAccess !== null) {
    const recencyScore = computeRecencyScore(signals.daysSinceLastAccess);
    score += recencyScore * HISTORICAL_WEIGHTS.recency;
    if (signals.daysSinceLastAccess > 30) {
      factors.push('Stale knowledge may be outdated');
      suggestions.push('Re-validate stale entities');
    }
  } else {
    score += HISTORICAL_WEIGHTS.recency * 0.6;
  }

  return Math.min(1.0, score);
}

/**
 * Compute cross-validation adjustment (-0.1 to +0.1).
 * This is an adjustment, not a score - it can be negative.
 */
function computeCrossValidationAdjustment(
  signals: ConfidenceSignals['crossValidation'],
  factors: string[],
  suggestions: string[]
): number {
  if (signals.extractorTotalCount === 0) {
    return 0; // No cross-validation possible
  }

  const agreementRatio = signals.extractorAgreementCount / signals.extractorTotalCount;

  // Map agreement ratio to adjustment
  // 100% agreement: +0.1
  // 50% agreement: 0
  // 0% agreement: -0.1
  const adjustment = (agreementRatio - 0.5) * 0.2;

  if (agreementRatio > 0.8) {
    factors.push('High extractor agreement increases confidence');
  } else if (agreementRatio < 0.5) {
    factors.push('Extractor disagreement reduces confidence');
    if (signals.disagreements.length > 0) {
      suggestions.push(`Resolve disagreements: ${signals.disagreements.slice(0, 2).join(', ')}`);
    }
  }

  return adjustment;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compute size score (0-1) with penalty for extremes.
 */
function computeSizeScore(lineCount: number): number {
  // Optimal range: 20-200 lines
  if (lineCount >= 20 && lineCount <= 200) {
    return 1.0;
  }
  // Too small (might be trivial/incomplete)
  if (lineCount < 20) {
    return 0.5 + (lineCount / 20) * 0.5;
  }
  // Too large (harder to understand fully)
  if (lineCount > 200) {
    // Decay from 1.0 at 200 to 0.3 at 1000+
    return Math.max(0.3, 1.0 - ((lineCount - 200) / 800) * 0.7);
  }
  return 0.5;
}

/**
 * Compute recency score (0-1) based on days since access.
 */
function computeRecencyScore(daysSinceAccess: number): number {
  if (daysSinceAccess <= 1) {
    return 1.0; // Very fresh
  }
  if (daysSinceAccess <= 7) {
    return 0.9; // Recent
  }
  if (daysSinceAccess <= 30) {
    return 0.7; // Somewhat stale
  }
  if (daysSinceAccess <= 90) {
    return 0.5; // Stale
  }
  // Very stale - decay slowly
  return Math.max(0.2, 0.5 - ((daysSinceAccess - 90) / 365) * 0.3);
}

// ============================================================================
// ENTITY ADAPTERS
// ============================================================================

/**
 * Extract signals from FunctionKnowledge.
 */
export function extractSignalsFromFunction(
  fn: FunctionKnowledge,
  options: {
    embeddingCohesion?: number;
    extractorResults?: Map<string, unknown>;
  } = {}
): ConfidenceSignals {
  // Analyze signature for type annotations
  const typeAnnotationRatio = estimateTypeAnnotationRatio(fn.signature);

  // Analyze purpose for quality
  const purposeQuality = estimatePurposeQuality(fn.purpose);

  // Check for docstring in purpose
  const hasDocstring = fn.purpose.length > 20;
  const docstringQuality = hasDocstring ? Math.min(1.0, fn.purpose.length / 200) : 0;

  // Compute days since last access
  const daysSinceLastAccess = fn.lastAccessed
    ? Math.floor((Date.now() - fn.lastAccessed.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Compute retrieval success rate from outcomes
  const totalOutcomes = fn.outcomeHistory.successes + fn.outcomeHistory.failures;
  const retrievalSuccessRate =
    totalOutcomes > 0 ? fn.outcomeHistory.successes / totalOutcomes : 0.5;

  // Extract cross-validation from extractor results
  const { agreementCount, totalCount, disagreements } = extractorAgreement(options.extractorResults);

  return {
    structural: {
      typeAnnotationRatio,
      hasDocstring,
      docstringQuality,
      isExported: fn.name.startsWith('export') || !fn.name.startsWith('_'),
      hasPublicAPI: !fn.name.startsWith('_'),
      complexity: estimateComplexity(fn.endLine - fn.startLine),
      lineCount: fn.endLine - fn.startLine,
    },
    semantic: {
      purposeQuality,
      embeddingCohesion: options.embeddingCohesion ?? 0.5,
      hasClearResponsibility: fn.purpose.split(' ').length < 30, // Short purpose = focused
    },
    historical: {
      retrievalCount: fn.accessCount,
      retrievalSuccessRate,
      validationCount: fn.validationCount,
      validationPassRate: totalOutcomes > 0 ? retrievalSuccessRate : 0.5,
      daysSinceLastAccess,
    },
    crossValidation: {
      extractorAgreementCount: agreementCount,
      extractorTotalCount: totalCount,
      disagreements,
    },
  };
}

/**
 * Extract signals from FileKnowledge.
 */
export function extractSignalsFromFile(
  file: FileKnowledge,
  options: {
    embeddingCohesion?: number;
  } = {}
): ConfidenceSignals {
  // Files have different structural signals
  const hasDocstring = file.summary.length > 20;
  const docstringQuality = hasDocstring ? Math.min(1.0, file.summary.length / 200) : 0;

  // Estimate type coverage from category
  const typeAnnotationRatio =
    file.category === 'code' ? 0.7 : file.category === 'config' ? 0.5 : 0.3;

  return {
    structural: {
      typeAnnotationRatio,
      hasDocstring,
      docstringQuality,
      isExported: file.exportCount > 0,
      hasPublicAPI: file.exportCount > 0,
      complexity: file.complexity,
      lineCount: file.lineCount,
    },
    semantic: {
      purposeQuality: estimatePurposeQuality(file.purpose),
      embeddingCohesion: options.embeddingCohesion ?? 0.5,
      hasClearResponsibility: file.mainConcepts.length <= 3,
    },
    historical: {
      retrievalCount: 0, // Files don't track access
      retrievalSuccessRate: 0.5,
      validationCount: 0,
      validationPassRate: 0.5,
      daysSinceLastAccess: null,
    },
    crossValidation: {
      extractorAgreementCount: 1,
      extractorTotalCount: 1,
      disagreements: [],
    },
  };
}

/**
 * Extract signals from ContextPack.
 */
export function extractSignalsFromContextPack(
  pack: ContextPack,
  options: {
    embeddingCohesion?: number;
  } = {}
): ConfidenceSignals {
  const totalOutcomes = pack.successCount + pack.failureCount;
  const successRate = totalOutcomes > 0 ? pack.successCount / totalOutcomes : 0.5;

  return {
    structural: {
      typeAnnotationRatio: 0.7, // Context packs are curated
      hasDocstring: pack.summary.length > 20,
      docstringQuality: Math.min(1.0, pack.summary.length / 200),
      isExported: true, // All packs are "exported"
      hasPublicAPI: true,
      complexity: pack.keyFacts.length > 10 ? 'high' : pack.keyFacts.length > 5 ? 'medium' : 'low',
      lineCount: pack.codeSnippets.reduce((sum, s) => sum + (s.endLine - s.startLine), 0),
    },
    semantic: {
      purposeQuality: estimatePurposeQuality(pack.summary),
      embeddingCohesion: options.embeddingCohesion ?? 0.6,
      hasClearResponsibility: pack.keyFacts.length <= 5,
    },
    historical: {
      retrievalCount: pack.accessCount,
      retrievalSuccessRate: successRate,
      validationCount: totalOutcomes,
      validationPassRate: successRate,
      daysSinceLastAccess: Math.floor(
        (Date.now() - pack.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ),
    },
    crossValidation: {
      extractorAgreementCount: 1, // Packs don't have cross-validation
      extractorTotalCount: 1,
      disagreements: [],
    },
  };
}

// ============================================================================
// ESTIMATION HELPERS
// ============================================================================

/**
 * Estimate type annotation ratio from signature.
 */
function estimateTypeAnnotationRatio(signature: string): number {
  if (!signature) return 0;

  // Count typed vs untyped parameters
  const params = signature.match(/\(([^)]*)\)/)?.[1] || '';
  if (!params) return 0.5; // No parameters

  const paramList = params.split(',').filter((p) => p.trim());
  if (paramList.length === 0) return 1.0; // No parameters = fully typed

  const typedCount = paramList.filter((p) => p.includes(':')).length;
  const ratio = typedCount / paramList.length;

  // Also check return type
  const hasReturnType = signature.includes('): ') || signature.includes('=> ');
  const returnBonus = hasReturnType ? 0.1 : 0;

  return Math.min(1.0, ratio + returnBonus);
}

/**
 * Estimate purpose quality (0-1).
 */
function estimatePurposeQuality(purpose: string): number {
  if (!purpose || purpose.length < 10) return 0.1;

  let quality = 0;

  // Length factor (10-200 chars optimal)
  if (purpose.length >= 20 && purpose.length <= 200) {
    quality += 0.3;
  } else if (purpose.length >= 10) {
    quality += 0.15;
  }

  // Action verbs (validates, handles, computes, etc.)
  const actionVerbs = /\b(validates?|handles?|computes?|processes?|returns?|creates?|manages?|transforms?)\b/i;
  if (actionVerbs.test(purpose)) {
    quality += 0.2;
  }

  // Specificity (mentions types, parameters, behaviors)
  const specificTerms = /\b(parameter|argument|return|input|output|error|exception|result)\b/i;
  if (specificTerms.test(purpose)) {
    quality += 0.2;
  }

  // Not vague
  const vagueTerms = /\b(stuff|things?|does|something|misc|various|etc)\b/i;
  if (!vagueTerms.test(purpose)) {
    quality += 0.15;
  }

  // Complete sentence structure
  if (purpose.includes(' ') && purpose.length > 30) {
    quality += 0.15;
  }

  return Math.min(1.0, quality);
}

/**
 * Estimate complexity from line count.
 */
function estimateComplexity(lineCount: number): 'low' | 'medium' | 'high' {
  if (lineCount <= 30) return 'low';
  if (lineCount <= 100) return 'medium';
  return 'high';
}

/**
 * Extract extractor agreement from results.
 */
function extractorAgreement(results?: Map<string, unknown>): {
  agreementCount: number;
  totalCount: number;
  disagreements: string[];
} {
  if (!results || results.size === 0) {
    return { agreementCount: 1, totalCount: 1, disagreements: [] };
  }

  const extractors = Array.from(results.keys());
  const totalCount = extractors.length;

  // Simple agreement check - compare type/name fields
  const disagreements: string[] = [];
  let agreementCount = 0;

  // If all extractors agree on basic type, count as agreement
  const types = new Set<string>();
  for (const [_extractor, result] of Array.from(results.entries())) {
    if (result && typeof result === 'object' && 'type' in result) {
      types.add(String((result as Record<string, unknown>).type));
    }
  }

  if (types.size <= 1) {
    agreementCount = totalCount;
  } else {
    agreementCount = 1; // At least one agreed with itself
    disagreements.push(`Type disagreement: ${Array.from(types).join(' vs ')}`);
  }

  return { agreementCount, totalCount, disagreements };
}

// ============================================================================
// BATCH COMPUTATION
// ============================================================================

/**
 * Compute confidence for multiple entities efficiently.
 */
export function computeConfidenceBatch(
  entities: Array<{
    id: string;
    signals: ConfidenceSignals;
  }>
): Map<string, ComputedConfidenceResult> {
  const results = new Map<string, ComputedConfidenceResult>();

  for (const { id, signals } of entities) {
    results.set(id, computeConfidence(signals));
  }

  return results;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Compute statistics about confidence distribution.
 */
export function computeConfidenceStats(
  confidences: number[]
): {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
  variance: number;
} {
  if (confidences.length === 0) {
    return { mean: 0.5, stdDev: 0, min: 0.5, max: 0.5, median: 0.5, variance: 0 };
  }

  const sorted = [...confidences].sort((a, b) => a - b);
  const n = confidences.length;

  const mean = confidences.reduce((a, b) => a + b, 0) / n;
  const variance = confidences.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const median =
    n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  return {
    mean,
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    median,
    variance,
  };
}
