/**
 * @fileoverview Edge Confidence Tiers - TDD Tests
 *
 * Tests for the edge confidence computation system that replaces
 * hardcoded 0.7 (calls) and 0.9 (imports) with quality-based confidence.
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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  computeEdgeConfidence,
  type EdgeConfidenceFactors,
} from '../edge_confidence.js';

describe('Edge Confidence Tiers', () => {
  describe('computeEdgeConfidence', () => {
    describe('core confidence computation', () => {
      it('returns 0.95 for AST-verified, resolved target, with source line', () => {
        const factors: EdgeConfidenceFactors = {
          source: 'ast_verified',
          hasSourceLine: true,
          isAmbiguous: false,
          targetResolved: true,
        };
        expect(computeEdgeConfidence(factors)).toBe(0.95);
      });

      it('returns 0.90 for AST-verified, resolved target, without source line', () => {
        const factors: EdgeConfidenceFactors = {
          source: 'ast_verified',
          hasSourceLine: false,
          isAmbiguous: false,
          targetResolved: true,
        };
        expect(computeEdgeConfidence(factors)).toBe(0.90);
      });

      it('returns 0.75 for AST-verified, unresolved target (external dep)', () => {
        const factors: EdgeConfidenceFactors = {
          source: 'ast_verified',
          hasSourceLine: true,
          isAmbiguous: false,
          targetResolved: false,
        };
        expect(computeEdgeConfidence(factors)).toBe(0.75);
      });

      it('returns 0.85 for ambiguous overload resolution (0.95 - 0.10 penalty)', () => {
        const factors: EdgeConfidenceFactors = {
          source: 'ast_verified',
          hasSourceLine: true,
          isAmbiguous: true,
          targetResolved: true,
        };
        expect(computeEdgeConfidence(factors)).toBeCloseTo(0.85, 2);
      });

      it('returns 0.65 for LLM fallback extraction', () => {
        const factors: EdgeConfidenceFactors = {
          source: 'llm_fallback',
          hasSourceLine: false,
          isAmbiguous: false,
          targetResolved: true,
        };
        expect(computeEdgeConfidence(factors)).toBe(0.65);
      });

      it('returns 0.80 for AST-inferred (not ambiguous)', () => {
        const factors: EdgeConfidenceFactors = {
          source: 'ast_inferred',
          hasSourceLine: true,
          isAmbiguous: false,
          targetResolved: true,
        };
        expect(computeEdgeConfidence(factors)).toBe(0.80);
      });
    });

    describe('bounds checking', () => {
      it('never returns below 0.15', () => {
        const worstCase: EdgeConfidenceFactors = {
          source: 'llm_fallback',
          hasSourceLine: false,
          isAmbiguous: true,
          targetResolved: false,
        };
        expect(computeEdgeConfidence(worstCase)).toBeGreaterThanOrEqual(0.15);
      });

      it('never returns above 0.95', () => {
        const bestCase: EdgeConfidenceFactors = {
          source: 'ast_verified',
          hasSourceLine: true,
          isAmbiguous: false,
          targetResolved: true,
        };
        expect(computeEdgeConfidence(bestCase)).toBeLessThanOrEqual(0.95);
      });
    });

    describe('factor combinations', () => {
      it('applies cumulative penalties for multiple negative factors', () => {
        const multipleNegatives: EdgeConfidenceFactors = {
          source: 'ast_inferred',
          hasSourceLine: false,
          isAmbiguous: true,
          targetResolved: false,
        };
        const confidence = computeEdgeConfidence(multipleNegatives);
        // Should be lower than individual penalty cases
        expect(confidence).toBeLessThan(0.7);
        expect(confidence).toBeGreaterThanOrEqual(0.15);
      });

      it('LLM fallback with all positive factors still lower than AST verified', () => {
        const llmGood: EdgeConfidenceFactors = {
          source: 'llm_fallback',
          hasSourceLine: true,
          isAmbiguous: false,
          targetResolved: true,
        };
        const astVerified: EdgeConfidenceFactors = {
          source: 'ast_verified',
          hasSourceLine: true,
          isAmbiguous: false,
          targetResolved: true,
        };
        expect(computeEdgeConfidence(llmGood)).toBeLessThan(
          computeEdgeConfidence(astVerified)
        );
      });
    });
  });

  describe('import vs call edge confidence', () => {
    it('import edges default to higher confidence than call edges', () => {
      // Import edges are more reliable because they're statically resolvable
      const importFactors: EdgeConfidenceFactors = {
        source: 'ast_verified',
        hasSourceLine: false, // imports typically don't have line numbers
        isAmbiguous: false,
        targetResolved: true,
      };

      const callFactors: EdgeConfidenceFactors = {
        source: 'ast_verified',
        hasSourceLine: true,
        isAmbiguous: false,
        targetResolved: true,
      };

      // Both should be high, but explicit line number gives slight boost
      const importConfidence = computeEdgeConfidence(importFactors);
      const callConfidence = computeEdgeConfidence(callFactors);

      expect(importConfidence).toBeGreaterThanOrEqual(0.85);
      expect(callConfidence).toBeGreaterThanOrEqual(0.90);
    });
  });

  describe('confidence variance requirement', () => {
    it('produces at least 5 distinct confidence values across factor combinations', () => {
      const combinations: EdgeConfidenceFactors[] = [
        // Best case
        { source: 'ast_verified', hasSourceLine: true, isAmbiguous: false, targetResolved: true },
        // Missing line
        { source: 'ast_verified', hasSourceLine: false, isAmbiguous: false, targetResolved: true },
        // Unresolved target
        { source: 'ast_verified', hasSourceLine: true, isAmbiguous: false, targetResolved: false },
        // Ambiguous
        { source: 'ast_verified', hasSourceLine: true, isAmbiguous: true, targetResolved: true },
        // AST inferred
        { source: 'ast_inferred', hasSourceLine: true, isAmbiguous: false, targetResolved: true },
        // LLM fallback
        { source: 'llm_fallback', hasSourceLine: false, isAmbiguous: false, targetResolved: true },
        // Worst case
        { source: 'llm_fallback', hasSourceLine: false, isAmbiguous: true, targetResolved: false },
      ];

      const confidences = combinations.map(computeEdgeConfidence);
      const uniqueConfidences = new Set(confidences.map(c => c.toFixed(2)));

      expect(uniqueConfidences.size).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('Edge Confidence Formula Documentation', () => {
  it('documents the confidence formula', () => {
    /**
     * EDGE CONFIDENCE COMPUTATION FORMULA:
     *
     * Base: 0.5
     * + Source quality: +0.35 (ast_verified) | +0.20 (ast_inferred) | +0.10 (llm_fallback)
     * + Evidence quality: +0.05 (hasSourceLine) +0.05 (targetResolved)
     * - Ambiguity penalty: -0.10 (if ambiguous)
     *
     * Bounded: [0.15, 0.95]
     *
     * EXAMPLE CALCULATIONS:
     * - ast_verified + line + resolved = 0.5 + 0.35 + 0.05 + 0.05 = 0.95
     * - ast_verified + no line + resolved = 0.5 + 0.35 + 0 + 0.05 = 0.90
     * - ast_verified + line + unresolved = 0.5 + 0.35 + 0.05 + 0 = 0.90 (but external dep penalty applies)
     * - llm_fallback + resolved = 0.5 + 0.10 + 0 + 0.05 = 0.65
     */
    expect(true).toBe(true);
  });
});
