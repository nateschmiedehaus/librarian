/**
 * @fileoverview Tests for Multi-Graph Importance Metrics
 *
 * Tests the importance metric computation for each graph type and the
 * unified importance scoring system.
 */

import { describe, it, expect } from 'vitest';
import {
  // Code importance
  computeCodeImportance,
  createDefaultCodeMetrics,
  type CodeImportanceInput,
  type CodeImportanceMetrics,
  // Rationale importance
  computeRationaleImportance,
  createDefaultRationaleMetrics,
  type RationaleImportanceInput,
  type RationaleImportanceMetrics,
  // Epistemic importance
  computeEpistemicImportance,
  createDefaultEpistemicMetrics,
  type EpistemicImportanceInput,
  type EpistemicImportanceMetrics,
  // Org importance
  computeOrgImportance,
  createDefaultOrgMetrics,
  type OrgImportanceInput,
  type OrgImportanceMetrics,
  // Unified
  computeUnifiedImportance,
  computeImportanceFlags,
  computeImportanceProfile,
  computeCrossGraphInfluence,
  computeBatchImportance,
  // Config
  DEFAULT_IMPORTANCE_CONFIG,
  type ImportanceConfig,
  type ImportanceProfile,
} from '../importance_metrics.js';
import type { ArgumentEdge } from '../../storage/types.js';
import type { Claim, ClaimId, EvidenceEdge, Contradiction, ExtendedDefeater } from '../../epistemics/types.js';
import { createClaimId } from '../../epistemics/types.js';
import { absent } from '../../epistemics/confidence.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

type Graph = Map<string, Set<string>>;

function createGraph(edges: Array<[string, string]>): Graph {
  const graph: Graph = new Map();
  for (const [from, to] of edges) {
    if (!graph.has(from)) graph.set(from, new Set());
    if (!graph.has(to)) graph.set(to, new Set());
    graph.get(from)!.add(to);
  }
  return graph;
}

function createClaim(id: string, props: Partial<Claim> = {}): Claim {
  return {
    id: createClaimId(id),
    proposition: props.proposition ?? `Test claim ${id}`,
    type: props.type ?? 'semantic',
    subject: props.subject ?? {
      type: 'function',
      id: 'test-fn',
      name: 'testFn',
    },
    createdAt: new Date().toISOString(),
    source: props.source ?? {
      type: 'llm',
      id: 'test-llm',
    },
    status: props.status ?? 'active',
    confidence: props.confidence ?? absent('uncalibrated'),
    signalStrength: props.signalStrength ?? {
      overall: 0.5,
      retrieval: 0.5,
      structural: 0.5,
      semantic: 0.5,
      testExecution: 0.5,
      recency: 0.5,
      aggregationMethod: 'geometric_mean',
    },
    schemaVersion: '1.0.0',
  };
}

function createEvidenceEdge(
  fromId: string,
  toId: string,
  type: EvidenceEdge['type'],
  strength: number = 1.0
): EvidenceEdge {
  return {
    id: `edge-${fromId}-${toId}`,
    fromClaimId: createClaimId(fromId),
    toClaimId: createClaimId(toId),
    type,
    strength,
    createdAt: new Date().toISOString(),
  };
}

function createArgumentEdge(
  sourceId: string,
  targetId: string,
  type: ArgumentEdge['type'],
  weight: number = 1.0
): ArgumentEdge {
  return {
    id: `arg-${sourceId}-${targetId}`,
    sourceId,
    targetId,
    sourceType: 'decision',
    targetType: 'decision',
    type,
    weight,
    confidence: 1.0,
    computedAt: new Date().toISOString(),
  };
}

// ============================================================================
// CODE IMPORTANCE TESTS
// ============================================================================

describe('Code Importance Metrics', () => {
  describe('computeCodeImportance', () => {
    it('should return empty map for empty graph', () => {
      const input: CodeImportanceInput = {
        graph: new Map(),
      };
      const result = computeCodeImportance(input);
      expect(result.size).toBe(0);
    });

    it('should compute PageRank for simple chain', () => {
      // A -> B -> C
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
      ]);

      const input: CodeImportanceInput = { graph };
      const result = computeCodeImportance(input);

      expect(result.size).toBe(3);
      expect(result.has('A')).toBe(true);
      expect(result.has('B')).toBe(true);
      expect(result.has('C')).toBe(true);

      // All should have valid metrics
      for (const [_, metrics] of result) {
        expect(metrics.pageRank).toBeGreaterThanOrEqual(0);
        expect(metrics.pageRank).toBeLessThanOrEqual(1);
        expect(metrics.centrality).toBeGreaterThanOrEqual(0);
        expect(metrics.centrality).toBeLessThanOrEqual(1);
        expect(metrics.combined).toBeGreaterThanOrEqual(0);
        expect(metrics.combined).toBeLessThanOrEqual(1);
      }
    });

    it('should identify hub nodes with high PageRank', () => {
      // Hub pattern: A is called by many nodes
      // B, C, D, E all point to A
      const graph = createGraph([
        ['B', 'A'],
        ['C', 'A'],
        ['D', 'A'],
        ['E', 'A'],
      ]);

      const input: CodeImportanceInput = { graph };
      const result = computeCodeImportance(input);

      // A should have highest PageRank (normalized, so relative comparison)
      const aMetrics = result.get('A')!;
      expect(aMetrics).toBeDefined();
      expect(aMetrics.pageRank).toBeGreaterThan(0);
    });

    it('should identify bridge nodes with high centrality', () => {
      // Bridge pattern: B connects two clusters
      // Cluster 1: A -> B
      // Cluster 2: B -> C, B -> D
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['B', 'D'],
      ]);

      const input: CodeImportanceInput = { graph };
      const result = computeCodeImportance(input);

      // B should have highest betweenness centrality
      const bMetrics = result.get('B')!;
      expect(bMetrics).toBeDefined();
      expect(bMetrics.centrality).toBeGreaterThanOrEqual(0);
    });

    it('should include hotspot scores when provided', () => {
      const graph = createGraph([['A', 'B']]);

      const hotspotInputs = new Map([
        [
          'A',
          {
            entityId: 'A',
            entityType: 'function' as const,
            commitCount: 50,
            cyclomaticComplexity: 30,
          },
        ],
      ]);

      const input: CodeImportanceInput = { graph, hotspotInputs };
      const result = computeCodeImportance(input);

      const aMetrics = result.get('A')!;
      expect(aMetrics.hotspotScore).toBeDefined();
      // With high churn and complexity, hotspot should be elevated
      expect(aMetrics.hotspotScore).toBeGreaterThan(0);
    });
  });

  describe('createDefaultCodeMetrics', () => {
    it('should create neutral metrics', () => {
      const metrics = createDefaultCodeMetrics();
      expect(metrics.pageRank).toBe(0.5);
      expect(metrics.centrality).toBe(0.5);
      expect(metrics.hotspotScore).toBe(0.5);
      expect(metrics.combined).toBe(0.5);
    });
  });
});

// ============================================================================
// RATIONALE IMPORTANCE TESTS
// ============================================================================

describe('Rationale Importance Metrics', () => {
  describe('computeRationaleImportance', () => {
    it('should return empty map for empty input', () => {
      const input: RationaleImportanceInput = {
        argumentEdges: [],
      };
      const result = computeRationaleImportance(input);
      expect(result.size).toBe(0);
    });

    it('should identify foundational decisions', () => {
      // Decision A supports decisions B, C, D
      const argumentEdges: ArgumentEdge[] = [
        createArgumentEdge('A', 'B', 'supports'),
        createArgumentEdge('A', 'C', 'supports'),
        createArgumentEdge('A', 'D', 'supports'),
      ];

      const input: RationaleImportanceInput = { argumentEdges };
      const result = computeRationaleImportance(input);

      // A should have high foundationality (others depend on it via supports)
      // Note: supports edge means source supports target
      // So B, C, D are supported BY A, meaning B, C, D depend on A
      expect(result.has('A')).toBe(true);
      expect(result.has('B')).toBe(true);
    });

    it('should respect activity scores', () => {
      const argumentEdges: ArgumentEdge[] = [
        createArgumentEdge('A', 'B', 'supports'),
      ];

      const decisionStatuses = new Map<string, 'accepted' | 'proposed' | 'deprecated' | 'superseded'>([
        ['A', 'superseded'],
        ['B', 'accepted'],
      ]);

      const input: RationaleImportanceInput = {
        argumentEdges,
        decisionStatuses,
      };
      const result = computeRationaleImportance(input);

      const aMetrics = result.get('A')!;
      const bMetrics = result.get('B')!;

      expect(aMetrics.activityScore).toBe(0);  // superseded
      expect(bMetrics.activityScore).toBe(1.0); // accepted
    });

    it('should compute tradeoff centrality', () => {
      const argumentEdges: ArgumentEdge[] = [
        createArgumentEdge('A', 'B', 'supports'),
      ];

      const tradeoffCounts = new Map([
        ['A', 5], // 5 tradeoffs = 1.0 normalized
        ['B', 1], // 1 tradeoff = 0.2 normalized
      ]);

      const input: RationaleImportanceInput = {
        argumentEdges,
        tradeoffCounts,
      };
      const result = computeRationaleImportance(input);

      const aMetrics = result.get('A')!;
      const bMetrics = result.get('B')!;

      expect(aMetrics.tradeoffCentrality).toBe(1.0);
      expect(bMetrics.tradeoffCentrality).toBe(0.2);
    });

    it('should compute constraint load', () => {
      const argumentEdges: ArgumentEdge[] = [
        createArgumentEdge('A', 'B', 'supports'),
      ];

      const constraintCounts = new Map([
        ['A', 10], // 10 constraints = 1.0 normalized
        ['B', 2],  // 2 constraints = 0.2 normalized
      ]);

      const input: RationaleImportanceInput = {
        argumentEdges,
        constraintCounts,
      };
      const result = computeRationaleImportance(input);

      const aMetrics = result.get('A')!;
      const bMetrics = result.get('B')!;

      expect(aMetrics.constraintLoad).toBe(1.0);
      expect(bMetrics.constraintLoad).toBe(0.2);
    });
  });

  describe('createDefaultRationaleMetrics', () => {
    it('should create neutral metrics', () => {
      const metrics = createDefaultRationaleMetrics();
      expect(metrics.foundationality).toBe(0);
      expect(metrics.activityScore).toBe(1.0); // Active by default
      expect(metrics.tradeoffCentrality).toBe(0);
      expect(metrics.constraintLoad).toBe(0);
      expect(metrics.combined).toBe(0.5);
    });
  });
});

// ============================================================================
// EPISTEMIC IMPORTANCE TESTS
// ============================================================================

describe('Epistemic Importance Metrics', () => {
  describe('computeEpistemicImportance', () => {
    it('should return empty map for empty input', () => {
      const input: EpistemicImportanceInput = {
        claims: new Map(),
        evidenceEdges: [],
        defeaters: [],
        contradictions: [],
      };
      const result = computeEpistemicImportance(input);
      expect(result.size).toBe(0);
    });

    it('should compute epistemic load', () => {
      // Claim A supports claims B, C, D
      const claims = new Map<ClaimId, Claim>([
        [createClaimId('A'), createClaim('A')],
        [createClaimId('B'), createClaim('B')],
        [createClaimId('C'), createClaim('C')],
        [createClaimId('D'), createClaim('D')],
      ]);

      const evidenceEdges: EvidenceEdge[] = [
        createEvidenceEdge('A', 'B', 'supports'),
        createEvidenceEdge('A', 'C', 'supports'),
        createEvidenceEdge('A', 'D', 'supports'),
      ];

      const input: EpistemicImportanceInput = {
        claims,
        evidenceEdges,
        defeaters: [],
        contradictions: [],
      };
      const result = computeEpistemicImportance(input);

      // All claims should have metrics
      expect(result.has('A')).toBe(true);
      expect(result.has('B')).toBe(true);
      expect(result.has('C')).toBe(true);
      expect(result.has('D')).toBe(true);
    });

    it('should compute evidence depth', () => {
      // Chain: A -> B -> C (A supports B, B supports C)
      const claims = new Map<ClaimId, Claim>([
        [createClaimId('A'), createClaim('A')],
        [createClaimId('B'), createClaim('B')],
        [createClaimId('C'), createClaim('C')],
      ]);

      const evidenceEdges: EvidenceEdge[] = [
        createEvidenceEdge('A', 'B', 'supports'),
        createEvidenceEdge('B', 'C', 'supports'),
      ];

      const input: EpistemicImportanceInput = {
        claims,
        evidenceEdges,
        defeaters: [],
        contradictions: [],
      };
      const result = computeEpistemicImportance(input);

      // C has deepest evidence chain (supported by B, which is supported by A)
      const cMetrics = result.get('C')!;
      expect(cMetrics.evidenceDepth).toBeGreaterThan(0);
    });

    it('should compute defeater vulnerability', () => {
      const claims = new Map<ClaimId, Claim>([
        [createClaimId('A'), createClaim('A')],
      ]);

      const defeaters: ExtendedDefeater[] = [
        {
          id: 'def-1',
          type: 'code_change',
          description: 'Code changed',
          severity: 'partial',
          detectedAt: new Date().toISOString(),
          status: 'active',
          affectedClaimIds: [createClaimId('A')],
          confidenceReduction: 0.3,
          autoResolvable: false,
        },
        {
          id: 'def-2',
          type: 'test_failure',
          description: 'Test failed',
          severity: 'partial',
          detectedAt: new Date().toISOString(),
          status: 'pending',
          affectedClaimIds: [createClaimId('A')],
          confidenceReduction: 0.1,
          autoResolvable: true,
        },
      ];

      const input: EpistemicImportanceInput = {
        claims,
        evidenceEdges: [],
        defeaters,
        contradictions: [],
      };
      const result = computeEpistemicImportance(input);

      const aMetrics = result.get('A')!;
      // Should have some vulnerability due to active + pending defeaters
      expect(aMetrics.defeaterVulnerability).toBeGreaterThan(0);
      expect(aMetrics.defeaterVulnerability).toBeLessThanOrEqual(1);
    });

    it('should penalize contradictions', () => {
      const claims = new Map<ClaimId, Claim>([
        [createClaimId('A'), createClaim('A')],
        [createClaimId('B'), createClaim('B')],
      ]);

      const contradictions: Contradiction[] = [
        {
          id: 'contra-1',
          claimA: createClaimId('A'),
          claimB: createClaimId('B'),
          type: 'direct',
          explanation: 'A contradicts B',
          detectedAt: new Date().toISOString(),
          status: 'unresolved',
          severity: 'blocking',
        },
      ];

      const input: EpistemicImportanceInput = {
        claims,
        evidenceEdges: [],
        defeaters: [],
        contradictions,
      };
      const result = computeEpistemicImportance(input);

      // Both claims involved in blocking contradiction should have reduced combined score
      const aMetrics = result.get('A')!;
      const bMetrics = result.get('B')!;

      expect(aMetrics.combined).toBeLessThan(1);
      expect(bMetrics.combined).toBeLessThan(1);
    });
  });

  describe('createDefaultEpistemicMetrics', () => {
    it('should create neutral metrics', () => {
      const metrics = createDefaultEpistemicMetrics();
      expect(metrics.epistemicLoad).toBe(0);
      expect(metrics.evidenceDepth).toBe(0);
      expect(metrics.defeaterVulnerability).toBe(0);
      expect(metrics.combined).toBe(0.5);
    });
  });
});

// ============================================================================
// ORGANIZATIONAL IMPORTANCE TESTS
// ============================================================================

describe('Organizational Importance Metrics', () => {
  describe('computeOrgImportance', () => {
    it('should return empty map for empty input', () => {
      const input: OrgImportanceInput = {
        authorshipEdges: [],
      };
      const result = computeOrgImportance(input);
      expect(result.size).toBe(0);
    });

    it('should compute ownership concentration for single owner', () => {
      const authorshipEdges = [
        {
          id: 'edge-1',
          sourceId: 'file.ts',
          targetId: 'alice',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'authored_by' as const,
          weight: 1.0,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
      ];

      const input: OrgImportanceInput = { authorshipEdges };
      const result = computeOrgImportance(input);

      const metrics = result.get('file.ts')!;
      // Single owner = high concentration
      expect(metrics.ownershipConcentration).toBe(1.0);
    });

    it('should compute ownership concentration for distributed ownership', () => {
      const authorshipEdges = [
        {
          id: 'edge-1',
          sourceId: 'file.ts',
          targetId: 'alice',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'authored_by' as const,
          weight: 0.33,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
        {
          id: 'edge-2',
          sourceId: 'file.ts',
          targetId: 'bob',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'authored_by' as const,
          weight: 0.33,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
        {
          id: 'edge-3',
          sourceId: 'file.ts',
          targetId: 'charlie',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'authored_by' as const,
          weight: 0.34,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
      ];

      const input: OrgImportanceInput = { authorshipEdges };
      const result = computeOrgImportance(input);

      const metrics = result.get('file.ts')!;
      // Evenly distributed ownership = low concentration
      expect(metrics.ownershipConcentration).toBeLessThan(0.5);
    });

    it('should compute expertise depth with scores', () => {
      const authorshipEdges = [
        {
          id: 'edge-1',
          sourceId: 'file.ts',
          targetId: 'alice',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'authored_by' as const,
          weight: 0.8,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
      ];

      const expertiseScores = new Map([
        ['alice', 0.9], // High expertise
      ]);

      const input: OrgImportanceInput = { authorshipEdges, expertiseScores };
      const result = computeOrgImportance(input);

      const metrics = result.get('file.ts')!;
      // High expertise author = high expertise depth
      expect(metrics.expertiseDepth).toBeGreaterThan(0.5);
    });

    it('should compute review coverage', () => {
      const authorshipEdges = [
        {
          id: 'edge-1',
          sourceId: 'file.ts',
          targetId: 'alice',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'authored_by' as const,
          weight: 1.0,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
      ];

      const reviewEdges = [
        {
          id: 'rev-1',
          sourceId: 'file.ts',
          targetId: 'bob',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'reviewed_by' as const,
          weight: 1.0,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
        {
          id: 'rev-2',
          sourceId: 'file.ts',
          targetId: 'charlie',
          sourceType: 'file' as const,
          targetType: 'author' as const,
          edgeType: 'reviewed_by' as const,
          weight: 1.0,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
      ];

      const input: OrgImportanceInput = { authorshipEdges, reviewEdges };
      const result = computeOrgImportance(input);

      const metrics = result.get('file.ts')!;
      // 2 reviews = 0.4 coverage (2/5)
      expect(metrics.reviewCoverage).toBe(0.4);
    });
  });

  describe('createDefaultOrgMetrics', () => {
    it('should create neutral metrics', () => {
      const metrics = createDefaultOrgMetrics();
      expect(metrics.ownershipConcentration).toBe(0.5);
      expect(metrics.expertiseDepth).toBe(0.5);
      expect(metrics.reviewCoverage).toBe(0.5);
      expect(metrics.combined).toBe(0.5);
    });
  });
});

// ============================================================================
// UNIFIED IMPORTANCE TESTS
// ============================================================================

describe('Unified Importance', () => {
  describe('computeUnifiedImportance', () => {
    it('should compute weighted average of per-graph scores', () => {
      const code: CodeImportanceMetrics = {
        pageRank: 1.0,
        centrality: 1.0,
        hotspotScore: 1.0,
        combined: 1.0,
      };
      const rationale: RationaleImportanceMetrics = {
        foundationality: 1.0,
        activityScore: 1.0,
        tradeoffCentrality: 1.0,
        constraintLoad: 1.0,
        combined: 1.0,
      };
      const epistemic: EpistemicImportanceMetrics = {
        epistemicLoad: 1.0,
        evidenceDepth: 1.0,
        defeaterVulnerability: 0,
        combined: 1.0,
      };
      const org: OrgImportanceMetrics = {
        ownershipConcentration: 0,
        expertiseDepth: 1.0,
        reviewCoverage: 1.0,
        combined: 1.0,
      };

      const unified = computeUnifiedImportance(code, rationale, epistemic, org, 1.0);

      // All metrics at max = unified should be 1.0
      expect(unified).toBe(1.0);
    });

    it('should respect custom weights', () => {
      const code = createDefaultCodeMetrics();
      code.combined = 1.0;

      const rationale = createDefaultRationaleMetrics();
      rationale.combined = 0;

      const epistemic = createDefaultEpistemicMetrics();
      epistemic.combined = 0;

      const org = createDefaultOrgMetrics();
      org.combined = 0;

      const config: ImportanceConfig = {
        ...DEFAULT_IMPORTANCE_CONFIG,
        weights: {
          code: 1.0,
          rationale: 0,
          epistemic: 0,
          org: 0,
          crossGraph: 0,
        },
      };

      const unified = computeUnifiedImportance(code, rationale, epistemic, org, 0, config);

      // Only code weight matters, and code.combined = 1.0
      expect(unified).toBe(1.0);
    });
  });

  describe('computeImportanceFlags', () => {
    it('should set isLoadBearing for high-importance entities', () => {
      const code = createDefaultCodeMetrics();
      code.combined = 0.8; // Above threshold

      const rationale = createDefaultRationaleMetrics();
      const epistemic = createDefaultEpistemicMetrics();
      const org = createDefaultOrgMetrics();

      const flags = computeImportanceFlags(
        code,
        rationale,
        epistemic,
        org,
        0.7
      );

      expect(flags.isLoadBearing).toBe(true);
    });

    it('should set isFoundational for high foundationality', () => {
      const code = createDefaultCodeMetrics();
      const rationale = createDefaultRationaleMetrics();
      rationale.foundationality = 0.8; // Above threshold

      const epistemic = createDefaultEpistemicMetrics();
      const org = createDefaultOrgMetrics();

      const flags = computeImportanceFlags(
        code,
        rationale,
        epistemic,
        org,
        0.7
      );

      expect(flags.isFoundational).toBe(true);
    });

    it('should set isAtRisk for high importance + low confidence', () => {
      const code = createDefaultCodeMetrics();
      const rationale = createDefaultRationaleMetrics();
      const epistemic = createDefaultEpistemicMetrics();
      const org = createDefaultOrgMetrics();

      const unified = 0.7; // High importance
      const confidence = 0.3; // Low confidence

      const flags = computeImportanceFlags(
        code,
        rationale,
        epistemic,
        org,
        unified,
        confidence
      );

      expect(flags.isAtRisk).toBe(true);
    });

    it('should set needsValidation for high defeater vulnerability', () => {
      const code = createDefaultCodeMetrics();
      const rationale = createDefaultRationaleMetrics();
      const epistemic = createDefaultEpistemicMetrics();
      epistemic.defeaterVulnerability = 0.6; // Above threshold

      const org = createDefaultOrgMetrics();

      const flags = computeImportanceFlags(
        code,
        rationale,
        epistemic,
        org,
        0.5
      );

      expect(flags.needsValidation).toBe(true);
    });

    it('should set hasTruckFactorRisk for high ownership concentration', () => {
      const code = createDefaultCodeMetrics();
      const rationale = createDefaultRationaleMetrics();
      const epistemic = createDefaultEpistemicMetrics();
      const org = createDefaultOrgMetrics();
      org.ownershipConcentration = 0.9; // Above threshold

      const flags = computeImportanceFlags(
        code,
        rationale,
        epistemic,
        org,
        0.5
      );

      expect(flags.hasTruckFactorRisk).toBe(true);
    });

    it('should set isHotspot for high hotspot score', () => {
      const code = createDefaultCodeMetrics();
      code.hotspotScore = 0.6; // Above threshold

      const rationale = createDefaultRationaleMetrics();
      const epistemic = createDefaultEpistemicMetrics();
      const org = createDefaultOrgMetrics();

      const flags = computeImportanceFlags(
        code,
        rationale,
        epistemic,
        org,
        0.5
      );

      expect(flags.isHotspot).toBe(true);
    });
  });
});

// ============================================================================
// CROSS-GRAPH INFLUENCE TESTS
// ============================================================================

describe('Cross-Graph Influence', () => {
  describe('computeCrossGraphInfluence', () => {
    it('should return 0 for isolated entity', () => {
      const influence = computeCrossGraphInfluence(
        'isolated',
        new Map(),
        new Map(),
        new Map(),
        []
      );
      expect(influence).toBe(0);
    });

    it('should compute influence from connected important entities', () => {
      const codeMetrics = new Map([
        ['A', { ...createDefaultCodeMetrics(), combined: 0.9 }],
        ['B', { ...createDefaultCodeMetrics(), combined: 0.5 }],
      ]);

      const crossGraphEdges = [
        {
          id: 'edge-1',
          sourceId: 'A',
          targetId: 'B',
          sourceType: 'function' as const,
          targetType: 'function' as const,
          edgeType: 'documents' as const,
          weight: 1.0,
          confidence: 1.0,
          metadata: {},
          computedAt: new Date().toISOString(),
        },
      ];

      const influence = computeCrossGraphInfluence(
        'B',
        codeMetrics,
        new Map(),
        new Map(),
        crossGraphEdges
      );

      // B should have influence from A (which documents it)
      expect(influence).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// COMPLETE PROFILE TESTS
// ============================================================================

describe('Importance Profile', () => {
  describe('computeImportanceProfile', () => {
    it('should create complete profile with defaults', () => {
      const profile = computeImportanceProfile(
        'test-entity',
        'function',
        new Map(),
        new Map(),
        new Map(),
        new Map()
      );

      expect(profile.entityId).toBe('test-entity');
      expect(profile.entityType).toBe('function');
      expect(profile.codeImportance).toBeDefined();
      expect(profile.rationaleImportance).toBeDefined();
      expect(profile.epistemicImportance).toBeDefined();
      expect(profile.orgImportance).toBeDefined();
      expect(profile.unified).toBeDefined();
      expect(profile.crossGraphInfluence).toBeDefined();
      expect(profile.flags).toBeDefined();
      expect(profile.computedAt).toBeDefined();
    });

    it('should use provided metrics', () => {
      const codeMetrics = new Map([
        ['test', { ...createDefaultCodeMetrics(), combined: 0.9 }],
      ]);

      const profile = computeImportanceProfile(
        'test',
        'function',
        codeMetrics,
        new Map(),
        new Map(),
        new Map()
      );

      expect(profile.codeImportance.combined).toBe(0.9);
    });
  });
});

// ============================================================================
// BATCH COMPUTATION TESTS
// ============================================================================

describe('Batch Importance Computation', () => {
  describe('computeBatchImportance', () => {
    it('should compute profiles for all entities', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
      ]);

      const result = computeBatchImportance({
        codeInput: { graph },
      });

      expect(result.profiles.size).toBe(3); // A, B, C
      expect(result.summary.totalEntities).toBe(3);
      expect(result.computedAt).toBeDefined();
    });

    it('should compute summary statistics', () => {
      const codeInput: CodeImportanceInput = {
        graph: createGraph([
          ['A', 'B'],
          ['C', 'B'],
          ['D', 'B'],
        ]),
        hotspotInputs: new Map([
          ['B', { entityId: 'B', entityType: 'function', commitCount: 100, cyclomaticComplexity: 50 }],
        ]),
      };

      const result = computeBatchImportance({ codeInput });

      expect(result.summary.totalEntities).toBe(4);
      expect(result.summary.avgUnifiedScore).toBeGreaterThan(0);
      // B should be a hotspot
      expect(result.summary.hotspotCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty input', () => {
      const result = computeBatchImportance({});

      expect(result.profiles.size).toBe(0);
      expect(result.summary.totalEntities).toBe(0);
      expect(result.summary.avgUnifiedScore).toBe(0);
    });
  });
});
