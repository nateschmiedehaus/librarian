/**
 * @fileoverview Edge Confidence Computation
 *
 * Replaces hardcoded 0.7/0.9 confidence values with quality-based
 * confidence computation based on extraction source and evidence.
 *
 * CONFIDENCE TIER MAPPING:
 * | Scenario                              | Confidence | Rationale                    |
 * |---------------------------------------|------------|------------------------------|
 * | AST-verified, resolved target, line   | 0.95       | Maximum certainty            |
 * | AST-verified, resolved target, no line| 0.90       | High certainty               |
 * | AST-verified, unresolved target       | 0.75       | External dependency          |
 * | AST-inferred (ambiguous overload)     | 0.85       | 0.95 - 0.10 penalty          |
 * | LLM fallback                          | 0.65       | Uncertain extraction         |
 */

/**
 * Source of the edge extraction
 */
export type EdgeSource = 'ast_verified' | 'ast_inferred' | 'llm_fallback';

/**
 * Factors that influence edge confidence
 */
export interface EdgeConfidenceFactors {
  /** How the edge was extracted */
  source: EdgeSource;
  /** Whether the call has a source line number */
  hasSourceLine: boolean;
  /** Whether there were multiple overloads that could match */
  isAmbiguous: boolean;
  /** Whether the target function/module was found in the codebase */
  targetResolved: boolean;
}

/**
 * Confidence bounds
 */
const MIN_CONFIDENCE = 0.15;
const MAX_CONFIDENCE = 0.95;

/**
 * Source quality bonuses
 */
const SOURCE_BONUSES: Record<EdgeSource, number> = {
  ast_verified: 0.35,
  ast_inferred: 0.20,
  llm_fallback: 0.10,
};

/**
 * Evidence bonuses
 */
const SOURCE_LINE_BONUS = 0.05;
const TARGET_RESOLVED_BONUS = 0.05;

/**
 * Penalties
 */
const AMBIGUITY_PENALTY = 0.10;
const EXTERNAL_DEPENDENCY_PENALTY = 0.15;

/**
 * Base confidence value
 */
const BASE_CONFIDENCE = 0.5;

/**
 * Compute edge confidence based on extraction quality factors.
 *
 * Formula:
 *   Base: 0.5
 *   + Source quality: +0.35 (ast_verified) | +0.20 (ast_inferred) | +0.10 (llm_fallback)
 *   + Evidence quality: +0.05 (hasSourceLine) +0.05 (targetResolved)
 *   - Ambiguity penalty: -0.10 (if ambiguous)
 *   - External dependency penalty: -0.15 (if unresolved AND ast_verified)
 *
 *   Bounded: [0.15, 0.95]
 *
 * @param factors - The factors influencing confidence
 * @returns Confidence value between 0.15 and 0.95
 */
export function computeEdgeConfidence(factors: EdgeConfidenceFactors): number {
  let confidence = BASE_CONFIDENCE;

  // Add source quality bonus
  confidence += SOURCE_BONUSES[factors.source];

  // Add evidence bonuses
  if (factors.hasSourceLine) {
    confidence += SOURCE_LINE_BONUS;
  }
  if (factors.targetResolved) {
    confidence += TARGET_RESOLVED_BONUS;
  }

  // Apply penalties
  if (factors.isAmbiguous) {
    confidence -= AMBIGUITY_PENALTY;
  }

  // External dependency penalty (when AST-verified but target not in codebase)
  if (!factors.targetResolved && factors.source === 'ast_verified') {
    confidence -= EXTERNAL_DEPENDENCY_PENALTY;
  }

  // Clamp to bounds
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, confidence));
}

/**
 * Compute confidence for a call edge given the extraction context.
 *
 * @param parsed - The parsed call edge from the AST
 * @param targetExists - Whether the target function exists in the indexed functions
 * @param parserName - The parser used (e.g., 'ts-morph', 'tree-sitter-*', 'llm')
 * @param overloadCount - Number of overloads matched (>1 = ambiguous)
 * @returns Confidence value
 */
export function computeCallEdgeConfidence(
  hasSourceLine: boolean,
  targetExists: boolean,
  parserName: string,
  overloadCount: number = 1
): number {
  // Determine source type
  let source: EdgeSource;
  if (parserName === 'llm' || parserName === 'llm-fallback') {
    source = 'llm_fallback';
  } else if (overloadCount > 1) {
    source = 'ast_inferred';
  } else {
    source = 'ast_verified';
  }

  return computeEdgeConfidence({
    source,
    hasSourceLine,
    isAmbiguous: overloadCount > 1,
    targetResolved: targetExists,
  });
}

/**
 * Compute confidence for an import edge.
 * Import edges are generally more reliable than call edges.
 *
 * @param targetExists - Whether the target module exists in the codebase
 * @param parserName - The parser used
 * @returns Confidence value
 */
export function computeImportEdgeConfidence(
  targetExists: boolean,
  parserName: string
): number {
  const source: EdgeSource =
    parserName === 'llm' || parserName === 'llm-fallback'
      ? 'llm_fallback'
      : 'ast_verified';

  return computeEdgeConfidence({
    source,
    hasSourceLine: false, // imports typically don't have meaningful line numbers
    isAmbiguous: false, // imports are not ambiguous
    targetResolved: targetExists,
  });
}
