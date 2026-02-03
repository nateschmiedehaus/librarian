/**
 * @fileoverview Tests for Cross-Graph Importance Propagation
 *
 * Tests the cross-graph propagation module including:
 * - Building cross-graph edges from knowledge edges
 * - Bidirectional importance propagation
 * - Epistemic risk identification
 * - Influence chain tracing
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type CrossGraphEdge,
  type CrossGraphEdgeType,
  type GraphType,
  type PropagationResult,
  type EpistemicRisk,
  type InfluenceChain,
  type CrossGraphPropagationConfig,
  type BatchPropagationInput,
  // Functions
  buildCrossGraphEdges,
  propagateImportance,
  findEpistemicRisks,
  getInfluenceChain,
  propagateImportanceBatch,
  createCrossGraphEdge,
  filterEdgesByGraphPair,
  getInvolvedEntities,
  computeEdgeStatistics,
  // Config
  DEFAULT_CROSS_GRAPH_CONFIG,
  DEFAULT_EPISTEMIC_RISK_CONFIG,
} from '../cross_graph_propagation.js';
import type { ImportanceProfile } from '../importance_metrics.js';
import {
  createDefaultCodeMetrics,
  createDefaultRationaleMetrics,
  createDefaultEpistemicMetrics,
  createDefaultOrgMetrics,
} from '../importance_metrics.js';
import type { KnowledgeGraphEdge } from '../../storage/types.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockProfile(
  entityId: string,
  entityType: ImportanceProfile['entityType'],
  overrides: Partial<ImportanceProfile> = {}
): ImportanceProfile {
  return {
    entityId,
    entityType,
    codeImportance: overrides.codeImportance ?? createDefaultCodeMetrics(),
    rationaleImportance: overrides.rationaleImportance ?? createDefaultRationaleMetrics(),
    epistemicImportance: overrides.epistemicImportance ?? createDefaultEpistemicMetrics(),
    orgImportance: overrides.orgImportance ?? createDefaultOrgMetrics(),
    unified: overrides.unified ?? 0.5,
    crossGraphInfluence: overrides.crossGraphInfluence ?? 0,
    flags: overrides.flags ?? {
      isLoadBearing: false,
      isFoundational: false,
      isAtRisk: false,
      needsValidation: false,
      hasTruckFactorRisk: false,
      isHotspot: false,
    },
    computedAt: new Date().toISOString(),
  };
}

function createMockKnowledgeEdge(
  sourceId: string,
  targetId: string,
  edgeType: KnowledgeGraphEdge['edgeType'],
  weight: number = 1.0
): KnowledgeGraphEdge {
  return {
    id: `edge-${sourceId}-${targetId}`,
    sourceId,
    targetId,
    sourceType: 'function',
    targetType: 'function',
    edgeType,
    weight,
    confidence: 1.0,
    metadata: {},
    computedAt: new Date().toISOString(),
  };
}

function createMockCrossGraphEdge(
  sourceId: string,
  targetId: string,
  sourceGraph: GraphType,
  targetGraph: GraphType,
  edgeType: CrossGraphEdgeType,
  weight: number = 1.0
): CrossGraphEdge {
  return {
    id: `cross-${sourceId}-${targetId}`,
    sourceGraph,
    targetGraph,
    sourceEntityId: sourceId,
    targetEntityId: targetId,
    edgeType,
    weight,
    confidence: 1.0,
    computedAt: new Date().toISOString(),
  };
}

// ============================================================================
// BUILD CROSS-GRAPH EDGES TESTS
// ============================================================================

describe('Build Cross-Graph Edges', () => {
  describe('buildCrossGraphEdges', () => {
    it('should return empty array for empty input', () => {
      const result = buildCrossGraphEdges({
        knowledgeEdges: [],
        entityGraphTypes: new Map(),
      });
      expect(result).toEqual([]);
    });

    it('should skip edges within the same graph', () => {
      const knowledgeEdges: KnowledgeGraphEdge[] = [
        createMockKnowledgeEdge('A', 'B', 'calls'),
      ];
      const entityGraphTypes = new Map<string, GraphType>([
        ['A', 'code'],
        ['B', 'code'],
      ]);

      const result = buildCrossGraphEdges({ knowledgeEdges, entityGraphTypes });
      expect(result).toEqual([]);
    });

    it('should create cross-graph edge for Code -> Rationale', () => {
      const knowledgeEdges: KnowledgeGraphEdge[] = [
        createMockKnowledgeEdge('code-fn', 'decision-1', 'documents'),
      ];
      const entityGraphTypes = new Map<string, GraphType>([
        ['code-fn', 'code'],
        ['decision-1', 'rationale'],
      ]);

      const result = buildCrossGraphEdges({ knowledgeEdges, entityGraphTypes });

      expect(result.length).toBe(1);
      expect(result[0].sourceGraph).toBe('code');
      expect(result[0].targetGraph).toBe('rationale');
      expect(result[0].edgeType).toBe('documented_by_decision');
    });

    it('should create cross-graph edge for Rationale -> Epistemic', () => {
      const knowledgeEdges: KnowledgeGraphEdge[] = [
        createMockKnowledgeEdge('decision-1', 'claim-1', 'depends_on'),
      ];
      const entityGraphTypes = new Map<string, GraphType>([
        ['decision-1', 'rationale'],
        ['claim-1', 'epistemic'],
      ]);

      const result = buildCrossGraphEdges({ knowledgeEdges, entityGraphTypes });

      expect(result.length).toBe(1);
      expect(result[0].sourceGraph).toBe('rationale');
      expect(result[0].targetGraph).toBe('epistemic');
      expect(result[0].edgeType).toBe('justified_by_claim');
    });

    it('should create cross-graph edge for Epistemic -> Code (verified_by_test)', () => {
      const knowledgeEdges: KnowledgeGraphEdge[] = [
        createMockKnowledgeEdge('claim-1', 'test-fn', 'tests'),
      ];
      const entityGraphTypes = new Map<string, GraphType>([
        ['claim-1', 'epistemic'],
        ['test-fn', 'code'],
      ]);

      const result = buildCrossGraphEdges({ knowledgeEdges, entityGraphTypes });

      expect(result.length).toBe(1);
      expect(result[0].sourceGraph).toBe('epistemic');
      expect(result[0].targetGraph).toBe('code');
      expect(result[0].edgeType).toBe('verified_by_test');
    });

    it('should create cross-graph edge for Any -> Org', () => {
      const knowledgeEdges: KnowledgeGraphEdge[] = [
        createMockKnowledgeEdge('code-fn', 'alice', 'authored_by'),
      ];
      const entityGraphTypes = new Map<string, GraphType>([
        ['code-fn', 'code'],
        ['alice', 'org'],
      ]);

      const result = buildCrossGraphEdges({ knowledgeEdges, entityGraphTypes });

      expect(result.length).toBe(1);
      expect(result[0].sourceGraph).toBe('code');
      expect(result[0].targetGraph).toBe('org');
      expect(result[0].edgeType).toBe('owned_by_expert');
    });

    it('should skip edges with unknown entity types', () => {
      const knowledgeEdges: KnowledgeGraphEdge[] = [
        createMockKnowledgeEdge('A', 'B', 'documents'),
      ];
      const entityGraphTypes = new Map<string, GraphType>([
        ['A', 'code'],
        // B is not in the map
      ]);

      const result = buildCrossGraphEdges({ knowledgeEdges, entityGraphTypes });
      expect(result).toEqual([]);
    });
  });
});

// ============================================================================
// IMPORTANCE PROPAGATION TESTS
// ============================================================================

describe('Importance Propagation', () => {
  describe('propagateImportance', () => {
    it('should return empty array for empty profiles', () => {
      const result = propagateImportance({
        profiles: new Map(),
        crossGraphEdges: [],
      });
      expect(result).toEqual([]);
    });

    it('should return original importance for entities with no cross-graph edges', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['A', createMockProfile('A', 'function', { unified: 0.8 })],
      ]);

      const result = propagateImportance({
        profiles,
        crossGraphEdges: [],
      });

      expect(result.length).toBe(1);
      expect(result[0].entityId).toBe('A');
      expect(result[0].originalImportance).toBe(0.8);
      expect(result[0].influenceSources).toEqual([]);
    });

    it('should propagate importance through incoming edges', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['high-importance', createMockProfile('high-importance', 'decision', { unified: 0.9 })],
        ['low-importance', createMockProfile('low-importance', 'function', { unified: 0.3 })],
      ]);

      const crossGraphEdges: CrossGraphEdge[] = [
        createMockCrossGraphEdge(
          'high-importance',
          'low-importance',
          'rationale',
          'code',
          'documented_by_decision'
        ),
      ];

      const result = propagateImportance({ profiles, crossGraphEdges });

      const lowResult = result.find(r => r.entityId === 'low-importance')!;

      // low-importance should receive influence from high-importance
      expect(lowResult.influenceSources.length).toBeGreaterThan(0);
      expect(lowResult.influenceSources[0].entityId).toBe('high-importance');
      expect(lowResult.influenceSources[0].direction).toBe('incoming');
    });

    it('should propagate importance through outgoing edges (reverse)', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['source', createMockProfile('source', 'function', { unified: 0.5 })],
        ['important-target', createMockProfile('important-target', 'decision', { unified: 0.9 })],
      ]);

      const crossGraphEdges: CrossGraphEdge[] = [
        createMockCrossGraphEdge(
          'source',
          'important-target',
          'code',
          'rationale',
          'documented_by_decision'
        ),
      ];

      const result = propagateImportance({ profiles, crossGraphEdges });

      const sourceResult = result.find(r => r.entityId === 'source')!;

      // source should receive some influence from important-target (reverse propagation)
      expect(sourceResult.influenceSources.some(s => s.direction === 'outgoing')).toBe(true);
    });

    it('should apply damping factors by edge type', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['source', createMockProfile('source', 'decision', { unified: 1.0 })],
        ['target', createMockProfile('target', 'function', { unified: 0.0 })],
      ]);

      // Test with different edge types
      const testEdge = createMockCrossGraphEdge(
        'source',
        'target',
        'rationale',
        'code',
        'documented_by_decision'
      );

      const result = propagateImportance({
        profiles,
        crossGraphEdges: [testEdge],
      });

      const targetResult = result.find(r => r.entityId === 'target')!;

      // Check that damping was applied (influence should be < source importance)
      const contribution = targetResult.influenceSources.find(s => s.entityId === 'source')?.contribution ?? 0;
      expect(contribution).toBeLessThan(1.0);
      expect(contribution).toBeGreaterThan(0);
    });

    it('should respect minImportanceThreshold', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['low-source', createMockProfile('low-source', 'decision', { unified: 0.005 })], // Below threshold
        ['target', createMockProfile('target', 'function', { unified: 0.5 })],
      ]);

      const crossGraphEdges: CrossGraphEdge[] = [
        createMockCrossGraphEdge(
          'low-source',
          'target',
          'rationale',
          'code',
          'documented_by_decision'
        ),
      ];

      const result = propagateImportance({
        profiles,
        crossGraphEdges,
        config: { ...DEFAULT_CROSS_GRAPH_CONFIG, minImportanceThreshold: 0.01 },
      });

      const targetResult = result.find(r => r.entityId === 'target')!;

      // Should not have influence from low-source (below threshold)
      const hasLowSourceInfluence = targetResult.influenceSources.some(
        s => s.entityId === 'low-source'
      );
      expect(hasLowSourceInfluence).toBe(false);
    });
  });
});

// ============================================================================
// EPISTEMIC RISK TESTS
// ============================================================================

describe('Epistemic Risk Identification', () => {
  describe('findEpistemicRisks', () => {
    it('should return empty array for non-claim entities', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['fn', createMockProfile('fn', 'function')],
        ['decision', createMockProfile('decision', 'decision')],
      ]);

      const risks = findEpistemicRisks(profiles);
      expect(risks).toEqual([]);
    });

    it('should identify high-load low-confidence claims as risks', () => {
      const profiles = new Map<string, ImportanceProfile>([
        [
          'risky-claim',
          createMockProfile('risky-claim', 'claim', {
            epistemicImportance: {
              epistemicLoad: 0.9,  // High load
              evidenceDepth: 0.2,
              defeaterVulnerability: 0.3,
              combined: 0.5,
            },
          }),
        ],
      ]);

      const confidenceScores = new Map([
        ['risky-claim', 0.2], // Low confidence
      ]);

      const risks = findEpistemicRisks(profiles, confidenceScores);

      expect(risks.length).toBe(1);
      expect(risks[0].entityId).toBe('risky-claim');
      expect(risks[0].epistemicLoad).toBe(0.9);
      expect(risks[0].confidence).toBe(0.2);
      expect(risks[0].riskScore).toBeGreaterThan(0);
    });

    it('should not flag low-load claims as risks', () => {
      const profiles = new Map<string, ImportanceProfile>([
        [
          'safe-claim',
          createMockProfile('safe-claim', 'claim', {
            epistemicImportance: {
              epistemicLoad: 0.1,  // Low load
              evidenceDepth: 0.2,
              defeaterVulnerability: 0.0,
              combined: 0.3,
            },
          }),
        ],
      ]);

      const confidenceScores = new Map([
        ['safe-claim', 0.2], // Low confidence, but low load
      ]);

      const risks = findEpistemicRisks(profiles, confidenceScores);

      // Risk score should be below threshold
      expect(risks.length).toBe(0);
    });

    it('should not flag high-confidence claims as risks', () => {
      const profiles = new Map<string, ImportanceProfile>([
        [
          'confident-claim',
          createMockProfile('confident-claim', 'claim', {
            epistemicImportance: {
              epistemicLoad: 0.9,  // High load
              evidenceDepth: 0.8,
              defeaterVulnerability: 0.0,
              combined: 0.9,
            },
          }),
        ],
      ]);

      const confidenceScores = new Map([
        ['confident-claim', 0.95], // High confidence
      ]);

      const risks = findEpistemicRisks(profiles, confidenceScores);

      // High confidence should result in low risk score
      expect(risks.length).toBe(0);
    });

    it('should categorize risk levels correctly', () => {
      const profiles = new Map<string, ImportanceProfile>([
        [
          'critical-risk',
          createMockProfile('critical-risk', 'claim', {
            epistemicImportance: {
              epistemicLoad: 1.0,
              evidenceDepth: 0.1,
              defeaterVulnerability: 0.9,
              combined: 0.5,
            },
          }),
        ],
        [
          'medium-risk',
          createMockProfile('medium-risk', 'claim', {
            epistemicImportance: {
              epistemicLoad: 0.6,
              evidenceDepth: 0.3,
              defeaterVulnerability: 0.2,
              combined: 0.5,
            },
          }),
        ],
      ]);

      const confidenceScores = new Map([
        ['critical-risk', 0.1],
        ['medium-risk', 0.4],
      ]);

      const risks = findEpistemicRisks(profiles, confidenceScores);

      // Should have both risks
      expect(risks.length).toBe(2);

      // Critical risk should be first (sorted by score)
      const criticalRisk = risks.find(r => r.entityId === 'critical-risk');
      expect(criticalRisk?.riskLevel).toBe('critical');
    });

    it('should factor in defeater vulnerability', () => {
      const profileWithDefeaters = createMockProfile('vulnerable-claim', 'claim', {
        epistemicImportance: {
          epistemicLoad: 0.7,
          evidenceDepth: 0.3,
          defeaterVulnerability: 0.8, // High vulnerability
          combined: 0.5,
        },
      });

      const profileWithoutDefeaters = createMockProfile('stable-claim', 'claim', {
        epistemicImportance: {
          epistemicLoad: 0.7,
          evidenceDepth: 0.3,
          defeaterVulnerability: 0.0, // No vulnerability
          combined: 0.5,
        },
      });

      const profiles = new Map([
        ['vulnerable-claim', profileWithDefeaters],
        ['stable-claim', profileWithoutDefeaters],
      ]);

      const confidenceScores = new Map([
        ['vulnerable-claim', 0.3],
        ['stable-claim', 0.3],
      ]);

      const risks = findEpistemicRisks(profiles, confidenceScores);

      // Vulnerable claim should have higher risk
      const vulnerableRisk = risks.find(r => r.entityId === 'vulnerable-claim');
      const stableRisk = risks.find(r => r.entityId === 'stable-claim');

      if (vulnerableRisk && stableRisk) {
        expect(vulnerableRisk.riskScore).toBeGreaterThan(stableRisk.riskScore);
      }
    });

    it('should generate appropriate suggested actions', () => {
      const profiles = new Map<string, ImportanceProfile>([
        [
          'very-low-confidence',
          createMockProfile('very-low-confidence', 'claim', {
            epistemicImportance: {
              epistemicLoad: 0.8,
              evidenceDepth: 0.1,
              defeaterVulnerability: 0.1,
              combined: 0.5,
            },
          }),
        ],
      ]);

      const confidenceScores = new Map([
        ['very-low-confidence', 0.1],
      ]);

      const risks = findEpistemicRisks(profiles, confidenceScores);

      expect(risks.length).toBe(1);
      expect(risks[0].suggestedAction).toContain('URGENT');
    });
  });
});

// ============================================================================
// INFLUENCE CHAIN TESTS
// ============================================================================

describe('Influence Chain Tracing', () => {
  describe('getInfluenceChain', () => {
    it('should return empty chain for entity with no incoming edges', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['isolated', createMockProfile('isolated', 'function', { unified: 0.5 })],
      ]);

      const chain = getInfluenceChain('isolated', profiles, []);

      expect(chain.targetEntityId).toBe('isolated');
      expect(chain.chain).toEqual([]);
      expect(chain.chainLength).toBe(0);
    });

    it('should trace single-hop influence', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['source', createMockProfile('source', 'decision', { unified: 0.9 })],
        ['target', createMockProfile('target', 'function', { unified: 0.5 })],
      ]);

      const crossGraphEdges: CrossGraphEdge[] = [
        createMockCrossGraphEdge(
          'source',
          'target',
          'rationale',
          'code',
          'documented_by_decision'
        ),
      ];

      const chain = getInfluenceChain('target', profiles, crossGraphEdges);

      expect(chain.targetEntityId).toBe('target');
      expect(chain.chainLength).toBe(1);
      expect(chain.chain[0].fromEntityId).toBe('source');
      expect(chain.chain[0].toEntityId).toBe('target');
    });

    it('should trace multi-hop influence', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['claim', createMockProfile('claim', 'claim', { unified: 0.9 })],
        ['decision', createMockProfile('decision', 'decision', { unified: 0.7 })],
        ['code', createMockProfile('code', 'function', { unified: 0.3 })],
      ]);

      const crossGraphEdges: CrossGraphEdge[] = [
        // claim -> decision
        createMockCrossGraphEdge(
          'claim',
          'decision',
          'epistemic',
          'rationale',
          'justified_by_claim'
        ),
        // decision -> code
        createMockCrossGraphEdge(
          'decision',
          'code',
          'rationale',
          'code',
          'documented_by_decision'
        ),
      ];

      const chain = getInfluenceChain('code', profiles, crossGraphEdges);

      expect(chain.chainLength).toBeGreaterThanOrEqual(1);
      expect(chain.totalPropagationFactor).toBeLessThan(1); // Damping applied
    });

    it('should avoid cycles', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['A', createMockProfile('A', 'function', { unified: 0.5 })],
        ['B', createMockProfile('B', 'decision', { unified: 0.5 })],
      ]);

      // Create a cycle: A -> B -> A
      const crossGraphEdges: CrossGraphEdge[] = [
        createMockCrossGraphEdge('A', 'B', 'code', 'rationale', 'documented_by_decision'),
        createMockCrossGraphEdge('B', 'A', 'rationale', 'code', 'documented_by_decision'),
      ];

      // Should not hang or crash
      const chain = getInfluenceChain('A', profiles, crossGraphEdges);

      expect(chain).toBeDefined();
      expect(chain.chainLength).toBeLessThanOrEqual(DEFAULT_CROSS_GRAPH_CONFIG.maxPropagationDepth);
    });
  });
});

// ============================================================================
// BATCH PROPAGATION TESTS
// ============================================================================

describe('Batch Propagation', () => {
  describe('propagateImportanceBatch', () => {
    it('should return results for all entities', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['A', createMockProfile('A', 'function', { unified: 0.7 })],
        ['B', createMockProfile('B', 'decision', { unified: 0.8 })],
        ['C', createMockProfile('C', 'claim', { unified: 0.5 })],
      ]);

      const crossGraphEdges: CrossGraphEdge[] = [
        createMockCrossGraphEdge('B', 'A', 'rationale', 'code', 'documented_by_decision'),
      ];

      const result = propagateImportanceBatch({
        profiles,
        crossGraphEdges,
      });

      expect(result.results.size).toBe(3);
      expect(result.summary.totalEntities).toBe(3);
    });

    it('should identify epistemic risks in batch', () => {
      const profiles = new Map<string, ImportanceProfile>([
        [
          'risky-claim',
          createMockProfile('risky-claim', 'claim', {
            epistemicImportance: {
              epistemicLoad: 0.9,
              evidenceDepth: 0.1,
              defeaterVulnerability: 0.5,
              combined: 0.5,
            },
          }),
        ],
      ]);

      const confidenceScores = new Map([
        ['risky-claim', 0.2],
      ]);

      const result = propagateImportanceBatch({
        profiles,
        crossGraphEdges: [],
        confidenceScores,
      });

      expect(result.epistemicRisks.length).toBeGreaterThan(0);
      expect(result.summary.criticalRisks + result.summary.highRisks).toBeGreaterThan(0);
    });

    it('should compute summary statistics', () => {
      const profiles = new Map<string, ImportanceProfile>([
        ['A', createMockProfile('A', 'function', { unified: 0.3 })],
        ['B', createMockProfile('B', 'decision', { unified: 0.9 })],
      ]);

      const crossGraphEdges: CrossGraphEdge[] = [
        createMockCrossGraphEdge('B', 'A', 'rationale', 'code', 'documented_by_decision'),
      ];

      const result = propagateImportanceBatch({
        profiles,
        crossGraphEdges,
      });

      expect(result.summary.totalEntities).toBe(2);
      expect(result.summary.entitiesWithInfluence).toBeGreaterThan(0);
      expect(result.summary.avgImportanceDelta).toBeDefined();
      expect(result.computedAt).toBeDefined();
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Helper Functions', () => {
  describe('createCrossGraphEdge', () => {
    it('should create edge with defaults', () => {
      const edge = createCrossGraphEdge({
        sourceGraph: 'code',
        targetGraph: 'rationale',
        sourceEntityId: 'fn-1',
        targetEntityId: 'decision-1',
        edgeType: 'documented_by_decision',
        weight: 0.8,
      });

      expect(edge.id).toContain('fn-1');
      expect(edge.confidence).toBe(1.0);
      expect(edge.computedAt).toBeDefined();
    });

    it('should use provided id and confidence', () => {
      const edge = createCrossGraphEdge({
        id: 'custom-id',
        sourceGraph: 'code',
        targetGraph: 'rationale',
        sourceEntityId: 'fn-1',
        targetEntityId: 'decision-1',
        edgeType: 'documented_by_decision',
        weight: 0.8,
        confidence: 0.7,
      });

      expect(edge.id).toBe('custom-id');
      expect(edge.confidence).toBe(0.7);
    });
  });

  describe('filterEdgesByGraphPair', () => {
    it('should filter edges by source and target graph', () => {
      const edges: CrossGraphEdge[] = [
        createMockCrossGraphEdge('A', 'B', 'code', 'rationale', 'documented_by_decision'),
        createMockCrossGraphEdge('C', 'D', 'rationale', 'epistemic', 'justified_by_claim'),
        createMockCrossGraphEdge('E', 'F', 'code', 'rationale', 'constrained_by_decision'),
      ];

      const filtered = filterEdgesByGraphPair(edges, 'code', 'rationale');

      expect(filtered.length).toBe(2);
      expect(filtered.every(e => e.sourceGraph === 'code' && e.targetGraph === 'rationale')).toBe(true);
    });
  });

  describe('getInvolvedEntities', () => {
    it('should return all unique entities', () => {
      const edges: CrossGraphEdge[] = [
        createMockCrossGraphEdge('A', 'B', 'code', 'rationale', 'documented_by_decision'),
        createMockCrossGraphEdge('B', 'C', 'rationale', 'epistemic', 'justified_by_claim'),
        createMockCrossGraphEdge('A', 'C', 'code', 'epistemic', 'verified_by_test'),
      ];

      const entities = getInvolvedEntities(edges);

      expect(entities.size).toBe(3);
      expect(entities.has('A')).toBe(true);
      expect(entities.has('B')).toBe(true);
      expect(entities.has('C')).toBe(true);
    });
  });

  describe('computeEdgeStatistics', () => {
    it('should compute statistics correctly', () => {
      const edges: CrossGraphEdge[] = [
        { ...createMockCrossGraphEdge('A', 'B', 'code', 'rationale', 'documented_by_decision'), weight: 0.8, confidence: 0.9 },
        { ...createMockCrossGraphEdge('C', 'D', 'rationale', 'epistemic', 'justified_by_claim'), weight: 0.6, confidence: 0.7 },
      ];

      const stats = computeEdgeStatistics(edges);

      expect(stats.totalEdges).toBe(2);
      expect(stats.byType.documented_by_decision).toBe(1);
      expect(stats.byType.justified_by_claim).toBe(1);
      expect(stats.byGraphPair['code->rationale']).toBe(1);
      expect(stats.byGraphPair['rationale->epistemic']).toBe(1);
      expect(stats.avgWeight).toBe(0.7);
      expect(stats.avgConfidence).toBe(0.8);
    });

    it('should handle empty edge list', () => {
      const stats = computeEdgeStatistics([]);

      expect(stats.totalEdges).toBe(0);
      expect(stats.avgWeight).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('Default Configuration', () => {
  describe('DEFAULT_CROSS_GRAPH_CONFIG', () => {
    it('should have damping factors for all edge types', () => {
      const edgeTypes: CrossGraphEdgeType[] = [
        'documented_by_decision',
        'constrained_by_decision',
        'justified_by_claim',
        'assumes_claim',
        'verified_by_test',
        'evidenced_by_code',
        'owned_by_expert',
        'decided_by',
      ];

      for (const edgeType of edgeTypes) {
        expect(DEFAULT_CROSS_GRAPH_CONFIG.dampingFactors[edgeType]).toBeDefined();
        expect(DEFAULT_CROSS_GRAPH_CONFIG.dampingFactors[edgeType]).toBeGreaterThan(0);
        expect(DEFAULT_CROSS_GRAPH_CONFIG.dampingFactors[edgeType]).toBeLessThanOrEqual(1);
      }
    });

    it('should have reasonable defaults', () => {
      expect(DEFAULT_CROSS_GRAPH_CONFIG.maxPropagationDepth).toBeGreaterThan(0);
      expect(DEFAULT_CROSS_GRAPH_CONFIG.forwardWeight).toBeGreaterThan(0);
      expect(DEFAULT_CROSS_GRAPH_CONFIG.forwardWeight).toBeLessThanOrEqual(1);
      expect(DEFAULT_CROSS_GRAPH_CONFIG.minImportanceThreshold).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DEFAULT_EPISTEMIC_RISK_CONFIG', () => {
    it('should have ascending thresholds', () => {
      expect(DEFAULT_EPISTEMIC_RISK_CONFIG.minRiskThreshold).toBeLessThan(
        DEFAULT_EPISTEMIC_RISK_CONFIG.mediumThreshold
      );
      expect(DEFAULT_EPISTEMIC_RISK_CONFIG.mediumThreshold).toBeLessThan(
        DEFAULT_EPISTEMIC_RISK_CONFIG.highThreshold
      );
      expect(DEFAULT_EPISTEMIC_RISK_CONFIG.highThreshold).toBeLessThan(
        DEFAULT_EPISTEMIC_RISK_CONFIG.criticalThreshold
      );
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  it('should handle a complete multi-graph scenario', () => {
    // Create a realistic scenario with entities in all graphs
    const profiles = new Map<string, ImportanceProfile>([
      // Code entities
      ['parseConfig', createMockProfile('parseConfig', 'function', { unified: 0.8 })],
      ['validateInput', createMockProfile('validateInput', 'function', { unified: 0.6 })],
      // Decision entities
      ['ADR-001', createMockProfile('ADR-001', 'decision', { unified: 0.9 })],
      // Claim entities
      [
        'claim-input-validation',
        createMockProfile('claim-input-validation', 'claim', {
          unified: 0.7,
          epistemicImportance: {
            epistemicLoad: 0.8,
            evidenceDepth: 0.4,
            defeaterVulnerability: 0.2,
            combined: 0.6,
          },
        }),
      ],
    ]);

    // Create cross-graph edges
    const crossGraphEdges: CrossGraphEdge[] = [
      // ADR-001 documents parseConfig
      createMockCrossGraphEdge('ADR-001', 'parseConfig', 'rationale', 'code', 'documented_by_decision'),
      // claim-input-validation justifies ADR-001
      createMockCrossGraphEdge('claim-input-validation', 'ADR-001', 'epistemic', 'rationale', 'justified_by_claim'),
      // validateInput verifies claim-input-validation
      createMockCrossGraphEdge('validateInput', 'claim-input-validation', 'code', 'epistemic', 'verified_by_test'),
    ];

    const confidenceScores = new Map([
      ['parseConfig', 0.85],
      ['validateInput', 0.9],
      ['ADR-001', 0.95],
      ['claim-input-validation', 0.4], // Low confidence for risk testing
    ]);

    // Run batch propagation
    const result = propagateImportanceBatch({
      profiles,
      crossGraphEdges,
      confidenceScores,
    });

    // Verify all entities processed
    expect(result.results.size).toBe(4);
    expect(result.summary.totalEntities).toBe(4);

    // Verify some entities have influence
    expect(result.summary.entitiesWithInfluence).toBeGreaterThan(0);

    // Verify epistemic risks identified
    expect(result.epistemicRisks.length).toBeGreaterThan(0);

    // Verify claim-input-validation is flagged as risky (high load, low confidence)
    const claimRisk = result.epistemicRisks.find(
      r => r.entityId === 'claim-input-validation'
    );
    expect(claimRisk).toBeDefined();

    // Verify influence chains work
    const parseConfigChain = getInfluenceChain('parseConfig', profiles, crossGraphEdges);
    expect(parseConfigChain.chainLength).toBeGreaterThan(0);
  });

  it('should handle the key insight: Load-Bearing + Low Confidence = Risk', () => {
    // This test validates the key insight from RESEARCH-003
    const profiles = new Map<string, ImportanceProfile>([
      [
        'load-bearing-claim',
        createMockProfile('load-bearing-claim', 'claim', {
          unified: 0.9, // High unified importance
          epistemicImportance: {
            epistemicLoad: 0.95, // Very high load - many things depend on this
            evidenceDepth: 0.2,   // Shallow evidence
            defeaterVulnerability: 0.4,
            combined: 0.6,
          },
        }),
      ],
    ]);

    const confidenceScores = new Map([
      ['load-bearing-claim', 0.15], // Very low confidence!
    ]);

    const risks = findEpistemicRisks(profiles, confidenceScores);

    // This should be identified as a critical risk
    expect(risks.length).toBe(1);
    expect(risks[0].riskLevel).toBe('critical');
    expect(risks[0].suggestedAction).toContain('URGENT');

    // Risk score should be very high
    expect(risks[0].riskScore).toBeGreaterThan(0.8);
  });
});
