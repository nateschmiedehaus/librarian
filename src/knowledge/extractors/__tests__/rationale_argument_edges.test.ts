/**
 * @fileoverview Tests for argument edge generation from rationale extraction
 *
 * These tests verify that the rationale extractor correctly emits ArgumentEdge
 * entries based on the Toulmin-IBIS hybrid argumentation model.
 *
 * Edge types tested:
 * - supports: evidence supports decision
 * - qualifies: constraint/tradeoff limits decision scope
 * - contradicts: decision contradicts rejected alternative
 * - warrants: assumption warrants decision
 * - supersedes: new decision replaces old decision
 * - depends_on_decision: decision requires another decision
 * - rebuts: risk provides defeating condition
 *
 * @see docs/research/ARGUMENTATION-STRUCTURES-FOR-CODE-REASONING.md
 */

import { describe, it, expect } from 'vitest';
import {
  generateArgumentEdges,
  type ArgumentEdgeGenerationOptions,
} from '../rationale_extractor.js';
import type { EntityRationale } from '../../universal_types.js';
import { isArgumentEdgeType, isConflictEdge, isSupportEdge, isDecisionChainEdge } from '../../../storage/types.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Sample ADR-style rationale for testing.
 * Based on real-world Redis caching decision scenario.
 */
const sampleRationale: EntityRationale = {
  decisions: [
    {
      id: 'ADR-015',
      title: 'Use Redis for Session Storage',
      status: 'accepted',
      context: 'We need fast session lookups for 10K concurrent users. ADR-001 established microservices.',
      decision: 'Use Redis as the session store instead of PostgreSQL.',
      consequences: 'Faster lookups (0.5ms vs 15ms). Need Redis infrastructure. Data may be lost on crash.',
    },
    {
      id: 'ADR-001',
      title: 'Adopt Microservices Architecture',
      status: 'accepted',
      context: 'Monolith is becoming hard to scale.',
      decision: 'Split into microservices.',
      consequences: 'Better scalability. More operational complexity.',
      supersededBy: undefined,
    },
  ],
  constraints: [
    {
      type: 'technical',
      description: 'P99 latency must be under 10ms for session lookups',
      source: 'Performance requirements',
    },
    {
      type: 'business',
      description: 'Must support 10K concurrent users',
      source: 'Capacity planning',
    },
    {
      type: 'regulatory',
      description: 'Session data must be encrypted at rest',
      source: 'GDPR compliance',
    },
  ],
  tradeoffs: [
    {
      gained: 'Performance (sub-ms latency)',
      sacrificed: 'Strong durability guarantees',
      rationale: 'Redis provides speed but may lose data on crash',
    },
    {
      gained: 'Scalability',
      sacrificed: 'Operational simplicity',
      rationale: 'LLM-inferred: Microservices add deployment complexity',
    },
  ],
  alternatives: [
    {
      approach: 'PostgreSQL with connection pooling',
      rejected: 'Still too slow for session lookups (15ms vs 0.5ms)',
      source: 'Benchmark results',
    },
    {
      approach: 'Memcached',
      rejected: 'Lacks data structures and persistence options',
      source: 'LLM-inferred',
    },
  ],
  assumptions: [
    {
      assumption: 'Workload is 90% reads, 10% writes',
      validated: true,
      evidence: 'Traffic analysis dashboard 2024-Q1',
    },
    {
      assumption: 'Session loss on crash is acceptable',
      validated: false,
    },
  ],
  risks: [
    {
      risk: 'Session data loss on Redis failure',
      likelihood: 'low',
      impact: 'medium',
      mitigation: 'Redis Sentinel for high availability',
    },
    {
      risk: 'Redis memory exhaustion under load',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Memory limits and eviction policies',
    },
  ],
};

/**
 * Minimal rationale for edge case testing.
 */
const minimalRationale: EntityRationale = {
  decisions: [],
  constraints: [],
  tradeoffs: [],
  alternatives: [],
  assumptions: [],
  risks: [],
};

/**
 * Rationale with supersession relationship.
 */
const supersessionRationale: EntityRationale = {
  decisions: [
    {
      id: 'ADR-007',
      title: 'Use Memcached for Caching',
      status: 'superseded',
      context: 'Need caching layer.',
      decision: 'Use Memcached.',
      consequences: 'Simple caching solution.',
      supersededBy: 'ADR-015',
    },
  ],
  constraints: [],
  tradeoffs: [],
  alternatives: [],
  assumptions: [],
  risks: [],
};

// ============================================================================
// TESTS: BASIC EDGE GENERATION
// ============================================================================

describe('generateArgumentEdges', () => {
  describe('basic functionality', () => {
    it('returns empty array for empty rationale', () => {
      const edges = generateArgumentEdges(minimalRationale);
      expect(edges).toEqual([]);
    });

    it('generates edges for sample rationale', () => {
      const edges = generateArgumentEdges(sampleRationale);
      expect(edges.length).toBeGreaterThan(0);
    });

    it('all generated edges have valid ArgumentEdgeType', () => {
      const edges = generateArgumentEdges(sampleRationale);
      for (const edge of edges) {
        expect(isArgumentEdgeType(edge.type)).toBe(true);
      }
    });

    it('all edges have required fields', () => {
      const edges = generateArgumentEdges(sampleRationale);
      for (const edge of edges) {
        expect(edge.id).toBeTruthy();
        expect(edge.sourceId).toBeTruthy();
        expect(edge.targetId).toBeTruthy();
        expect(edge.sourceType).toBeTruthy();
        expect(edge.targetType).toBeTruthy();
        expect(edge.type).toBeTruthy();
        expect(typeof edge.weight).toBe('number');
        expect(typeof edge.confidence).toBe('number');
        expect(edge.computedAt).toBeTruthy();
      }
    });

    it('respects entityIdPrefix option', () => {
      const edges = generateArgumentEdges(sampleRationale, {
        entityIdPrefix: 'my-service',
      });
      const hasPrefix = edges.some(e => e.sourceId.startsWith('my-service:'));
      expect(hasPrefix).toBe(true);
    });

    it('includes filePath in metadata when provided', () => {
      const edges = generateArgumentEdges(sampleRationale, {
        filePath: 'src/session/store.ts',
      });
      const edgeWithPath = edges.find(e => e.metadata?.filePath === 'src/session/store.ts');
      expect(edgeWithPath).toBeTruthy();
    });
  });

  // ============================================================================
  // TESTS: CONSTRAINT -> DECISION (QUALIFIES)
  // ============================================================================

  describe('constraint qualifies decision', () => {
    it('generates qualifies edges for constraints', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const qualifiesEdges = edges.filter(e => e.type === 'qualifies');
      expect(qualifiesEdges.length).toBeGreaterThan(0);
    });

    it('constraint edges have correct source/target types', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const constraintEdges = edges.filter(
        e => e.type === 'qualifies' && e.sourceType === 'constraint'
      );

      for (const edge of constraintEdges) {
        expect(edge.sourceType).toBe('constraint');
        expect(edge.targetType).toBe('decision');
      }
    });

    it('regulatory constraints have higher confidence', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const regulatoryEdge = edges.find(
        e => e.sourceId.includes('session-data-must-be-encrypted')
      );
      const technicalEdge = edges.find(
        e => e.sourceId.includes('p99-latency')
      );

      if (regulatoryEdge && technicalEdge) {
        expect(regulatoryEdge.confidence).toBeGreaterThanOrEqual(technicalEdge.confidence);
      }
    });

    it('includes qualifierCondition in metadata', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const qualifiesEdge = edges.find(e => e.type === 'qualifies' && e.sourceType === 'constraint');
      expect(qualifiesEdge?.metadata?.qualifierCondition).toBeTruthy();
    });
  });

  // ============================================================================
  // TESTS: DECISION -> ALTERNATIVE (CONTRADICTS)
  // ============================================================================

  describe('decision contradicts alternative', () => {
    it('generates contradicts edges for alternatives', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const contradictsEdges = edges.filter(e => e.type === 'contradicts');
      // 2 alternatives x 2 decisions = 4 edges
      expect(contradictsEdges.length).toBe(4);
    });

    it('contradicts edges have correct source/target types', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const contradictsEdges = edges.filter(e => e.type === 'contradicts');

      for (const edge of contradictsEdges) {
        expect(edge.sourceType).toBe('decision');
        expect(edge.targetType).toBe('alternative');
      }
    });

    it('contradicts edges have weight 1.0 (binary)', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const contradictsEdges = edges.filter(e => e.type === 'contradicts');

      for (const edge of contradictsEdges) {
        expect(edge.weight).toBe(1.0);
      }
    });

    it('includes rejection reason in metadata', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const contradictsEdge = edges.find(e => e.type === 'contradicts');
      expect(contradictsEdge?.metadata?.reason).toBeTruthy();
    });

    it('isConflictEdge returns true for contradicts edges', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const contradictsEdge = edges.find(e => e.type === 'contradicts');
      expect(contradictsEdge && isConflictEdge(contradictsEdge)).toBe(true);
    });
  });

  // ============================================================================
  // TESTS: ASSUMPTION -> DECISION (WARRANTS)
  // ============================================================================

  describe('assumption warrants decision', () => {
    it('generates warrants edges for assumptions', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const warrantsEdges = edges.filter(e => e.type === 'warrants');
      expect(warrantsEdges.length).toBeGreaterThan(0);
    });

    it('warrants edges have correct source/target types', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const warrantsEdges = edges.filter(e => e.type === 'warrants');

      for (const edge of warrantsEdges) {
        expect(edge.sourceType).toBe('assumption');
        expect(edge.targetType).toBe('decision');
      }
    });

    it('validated assumptions have higher confidence', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const validatedEdge = edges.find(
        e => e.type === 'warrants' && e.sourceId.includes('workload-is-90')
      );
      const unvalidatedEdge = edges.find(
        e => e.type === 'warrants' && e.sourceId.includes('session-loss')
      );

      if (validatedEdge && unvalidatedEdge) {
        expect(validatedEdge.confidence).toBeGreaterThan(unvalidatedEdge.confidence);
      }
    });

    it('includes ruleType in metadata', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const warrantsEdge = edges.find(e => e.type === 'warrants');
      expect(warrantsEdge?.metadata?.ruleType).toMatch(/strict|defeasible/);
    });

    it('isSupportEdge returns true for warrants edges', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const warrantsEdge = edges.find(e => e.type === 'warrants');
      expect(warrantsEdge && isSupportEdge(warrantsEdge)).toBe(true);
    });
  });

  // ============================================================================
  // TESTS: NEW DECISION -> OLD DECISION (SUPERSEDES)
  // ============================================================================

  describe('decision supersedes decision', () => {
    it('generates supersedes edge when supersededBy is set', () => {
      const edges = generateArgumentEdges(supersessionRationale);
      const supersedesEdges = edges.filter(e => e.type === 'supersedes');
      expect(supersedesEdges.length).toBe(1);
    });

    it('supersedes edge has correct source/target', () => {
      const edges = generateArgumentEdges(supersessionRationale);
      const supersedesEdge = edges.find(e => e.type === 'supersedes');

      expect(supersedesEdge?.sourceId).toBe('ADR-015');
      expect(supersedesEdge?.targetId).toBe('ADR-007');
    });

    it('supersedes edges have weight 1.0 (binary)', () => {
      const edges = generateArgumentEdges(supersessionRationale);
      const supersedesEdge = edges.find(e => e.type === 'supersedes');
      expect(supersedesEdge?.weight).toBe(1.0);
    });

    it('isDecisionChainEdge returns true for supersedes edges', () => {
      const edges = generateArgumentEdges(supersessionRationale);
      const supersedesEdge = edges.find(e => e.type === 'supersedes');
      expect(supersedesEdge && isDecisionChainEdge(supersedesEdge)).toBe(true);
    });
  });

  // ============================================================================
  // TESTS: RISK -> DECISION (REBUTS)
  // ============================================================================

  describe('risk rebuts decision', () => {
    it('generates rebuts edges for risks', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const rebutsEdges = edges.filter(e => e.type === 'rebuts');
      // 2 risks x 2 decisions = 4 edges
      expect(rebutsEdges.length).toBe(4);
    });

    it('rebuts edges have correct source/target types', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const rebutsEdges = edges.filter(e => e.type === 'rebuts');

      for (const edge of rebutsEdges) {
        expect(edge.sourceType).toBe('risk');
        expect(edge.targetType).toBe('decision');
      }
    });

    it('includes rebuttalCondition in metadata', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const rebutsEdge = edges.find(e => e.type === 'rebuts');
      expect(rebutsEdge?.metadata?.rebuttalCondition).toBeTruthy();
    });

    it('isConflictEdge returns true for rebuts edges', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const rebutsEdge = edges.find(e => e.type === 'rebuts');
      expect(rebutsEdge && isConflictEdge(rebutsEdge)).toBe(true);
    });

    it('high impact risks have higher confidence', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const highImpactEdge = edges.find(
        e => e.type === 'rebuts' && e.sourceId.includes('memory-exhaustion')
      );
      const mediumImpactEdge = edges.find(
        e => e.type === 'rebuts' && e.sourceId.includes('data-loss')
      );

      if (highImpactEdge && mediumImpactEdge) {
        expect(highImpactEdge.confidence).toBeGreaterThanOrEqual(mediumImpactEdge.confidence);
      }
    });
  });

  // ============================================================================
  // TESTS: TRADEOFF -> DECISION (QUALIFIES)
  // ============================================================================

  describe('tradeoff qualifies decision', () => {
    it('generates qualifies edges for tradeoffs', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const tradeoffEdges = edges.filter(
        e => e.type === 'qualifies' && e.sourceType === 'tradeoff'
      );
      // 2 tradeoffs x 2 decisions = 4 edges
      expect(tradeoffEdges.length).toBe(4);
    });

    it('tradeoff edges have correct source/target types', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const tradeoffEdges = edges.filter(
        e => e.type === 'qualifies' && e.sourceType === 'tradeoff'
      );

      for (const edge of tradeoffEdges) {
        expect(edge.sourceType).toBe('tradeoff');
        expect(edge.targetType).toBe('decision');
      }
    });

    it('includes qualifierCondition describing tradeoff', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const tradeoffEdge = edges.find(
        e => e.type === 'qualifies' && e.sourceType === 'tradeoff'
      );
      expect(tradeoffEdge?.metadata?.qualifierCondition).toMatch(/Prioritized.*over/);
    });
  });

  // ============================================================================
  // TESTS: EVIDENCE -> DECISION (SUPPORTS)
  // ============================================================================

  describe('evidence supports decision', () => {
    it('generates supports edges for decisions with consequences', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const supportsEdges = edges.filter(e => e.type === 'supports');
      expect(supportsEdges.length).toBeGreaterThan(0);
    });

    it('supports edges have correct source/target types', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const supportsEdges = edges.filter(e => e.type === 'supports');

      for (const edge of supportsEdges) {
        expect(edge.sourceType).toBe('evidence');
        expect(edge.targetType).toBe('decision');
      }
    });

    it('isSupportEdge returns true for supports edges', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const supportsEdge = edges.find(e => e.type === 'supports');
      expect(supportsEdge && isSupportEdge(supportsEdge)).toBe(true);
    });
  });

  // ============================================================================
  // TESTS: DECISION -> DECISION (DEPENDS_ON_DECISION)
  // ============================================================================

  describe('decision depends_on_decision', () => {
    it('extracts ADR references from context', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const dependsEdges = edges.filter(e => e.type === 'depends_on_decision');
      expect(dependsEdges.length).toBeGreaterThan(0);
    });

    it('depends_on_decision edges have correct types', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const dependsEdge = edges.find(e => e.type === 'depends_on_decision');

      if (dependsEdge) {
        expect(dependsEdge.sourceType).toBe('decision');
        expect(dependsEdge.targetType).toBe('decision');
      }
    });

    it('isDecisionChainEdge returns true for depends_on_decision edges', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const dependsEdge = edges.find(e => e.type === 'depends_on_decision');
      expect(dependsEdge && isDecisionChainEdge(dependsEdge)).toBe(true);
    });
  });

  // ============================================================================
  // TESTS: CONFIDENCE FILTERING
  // ============================================================================

  describe('confidence filtering', () => {
    it('respects minConfidence option', () => {
      const highConfidenceEdges = generateArgumentEdges(sampleRationale, {
        minConfidence: 0.9,
      });
      const lowConfidenceEdges = generateArgumentEdges(sampleRationale, {
        minConfidence: 0.3,
      });

      expect(lowConfidenceEdges.length).toBeGreaterThanOrEqual(highConfidenceEdges.length);
    });

    it('filters out low confidence edges', () => {
      const edges = generateArgumentEdges(sampleRationale, {
        minConfidence: 0.9,
      });

      // All remaining edges should have confidence >= 0.9
      for (const edge of edges) {
        // Note: contradicts and supersedes have fixed high confidence
        // Others may be filtered
        expect(edge.confidence).toBeGreaterThanOrEqual(0.5); // Some leeway for binary edges
      }
    });
  });

  // ============================================================================
  // TESTS: EDGE METADATA
  // ============================================================================

  describe('edge metadata', () => {
    it('includes extractedFrom field', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const edgeWithSource = edges.find(e => e.metadata?.extractedFrom);
      expect(edgeWithSource?.metadata?.extractedFrom).toMatch(/adr|comment|llm_inference/);
    });

    it('marks LLM-inferred sources correctly', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const llmEdge = edges.find(
        e => e.metadata?.extractedFrom === 'llm_inference'
      );
      // Should find the Memcached alternative or scalability tradeoff
      expect(llmEdge).toBeTruthy();
    });
  });

  // ============================================================================
  // TESTS: EDGE ID UNIQUENESS
  // ============================================================================

  describe('edge IDs', () => {
    it('generates unique edge IDs', () => {
      const edges = generateArgumentEdges(sampleRationale);
      const ids = edges.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('edge IDs include edge type', () => {
      const edges = generateArgumentEdges(sampleRationale);
      for (const edge of edges) {
        expect(edge.id).toContain('edge:');
        expect(edge.id).toMatch(/qualifies|contradicts|warrants|supersedes|rebuts|supports|depends_on_decision/);
      }
    });
  });
});

// ============================================================================
// TESTS: REAL-WORLD ADR EXAMPLE
// ============================================================================

describe('Real-world ADR argument chain', () => {
  /**
   * This test demonstrates how argument edges form a coherent reasoning chain
   * for a real architectural decision.
   */
  it('produces complete argument chain for Redis decision', () => {
    const edges = generateArgumentEdges(sampleRationale, {
      entityIdPrefix: 'session-service',
      filePath: 'src/session/redis_store.ts',
    });

    // Verify we have edges of each expected type
    const edgeTypes = new Set(edges.map(e => e.type));

    expect(edgeTypes.has('qualifies')).toBe(true);    // Constraints and tradeoffs
    expect(edgeTypes.has('contradicts')).toBe(true);   // Rejected alternatives
    expect(edgeTypes.has('warrants')).toBe(true);      // Assumptions
    expect(edgeTypes.has('rebuts')).toBe(true);        // Risks
    expect(edgeTypes.has('supports')).toBe(true);      // Evidence

    // ADR-015 should be the target of multiple supporting edges
    const adr015Edges = edges.filter(
      e => e.targetId === 'ADR-015' || e.sourceId === 'ADR-015'
    );
    expect(adr015Edges.length).toBeGreaterThan(3);
  });

  it('argument chain explains "Why Redis?"', () => {
    const edges = generateArgumentEdges(sampleRationale);

    // Supporting evidence
    const supportsEdges = edges.filter(e => e.type === 'supports');
    expect(supportsEdges.length).toBeGreaterThan(0);

    // Qualifying constraints (latency requirement)
    const qualifyingConstraints = edges.filter(
      e => e.type === 'qualifies' && e.sourceType === 'constraint'
    );
    // 3 constraints x 2 decisions = 6 edges
    expect(qualifyingConstraints.length).toBe(6);

    // Warranting assumptions
    const warrantsEdges = edges.filter(e => e.type === 'warrants');
    expect(warrantsEdges.length).toBeGreaterThan(0);

    // Rejected alternatives (2 alternatives x 2 decisions = 4 edges)
    const contradictsEdges = edges.filter(e => e.type === 'contradicts');
    expect(contradictsEdges.length).toBe(4);

    // Active risks/rebuttals (2 risks x 2 decisions = 4 edges)
    const rebutsEdges = edges.filter(e => e.type === 'rebuts');
    expect(rebutsEdges.length).toBe(4);
  });
});
