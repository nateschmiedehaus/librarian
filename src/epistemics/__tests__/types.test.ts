/**
 * @fileoverview Tests for Evidence Graph Types
 *
 * Tests cover:
 * - Type guards for all main types
 * - Serialization/deserialization roundtrip
 * - Factory functions
 * - Confidence computation
 */

import { describe, it, expect } from 'vitest';
import {
  EVIDENCE_GRAPH_SCHEMA_VERSION,
  createClaimId,
  createDefaultSignalStrength,
  computeOverallSignalStrength,
  createEmptyEvidenceGraph,
  createClaim,
  createDefeater,
  createContradiction,
  serializeEvidenceGraph,
  deserializeEvidenceGraph,
  isClaimId,
  isClaim,
  isEvidenceEdge,
  isExtendedDefeater,
  isContradiction,
  isEvidenceGraph,
  type Claim,
  type EvidenceEdge,
  type ExtendedDefeater,
  type Contradiction,
  type EvidenceGraph,
  type ClaimSignalStrength,
} from '../types.js';
import { absent, deterministic } from '../confidence.js';

describe('Evidence Graph Types', () => {
  describe('Schema Version', () => {
    it('should have a valid semantic version', () => {
      expect(EVIDENCE_GRAPH_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('ClaimId', () => {
    it('should create a valid ClaimId', () => {
      const id = createClaimId('test-claim-1');
      expect(id).toBe('test-claim-1');
      expect(isClaimId(id)).toBe(true);
    });

    it('should reject invalid ClaimIds', () => {
      expect(isClaimId('')).toBe(false);
      expect(isClaimId(null)).toBe(false);
      expect(isClaimId(undefined)).toBe(false);
      expect(isClaimId(123)).toBe(false);
      expect(isClaimId({})).toBe(false);
    });
  });

  describe('ClaimSignalStrength', () => {
    it('should create default signal strength with balanced values', () => {
      const conf = createDefaultSignalStrength();
      expect(conf.overall).toBe(0.5);
      expect(conf.retrieval).toBe(0.5);
      expect(conf.structural).toBe(0.5);
      expect(conf.semantic).toBe(0.5);
      expect(conf.testExecution).toBe(0.5);
      expect(conf.recency).toBe(0.5);
      expect(conf.aggregationMethod).toBe('geometric_mean');
    });

    it('should compute overall signal strength using geometric mean', () => {
      const conf: Omit<ClaimSignalStrength, 'overall'> = {
        retrieval: 0.9,
        structural: 0.8,
        semantic: 0.7,
        testExecution: 0.6,
        recency: 0.5,
        aggregationMethod: 'geometric_mean',
      };
      const overall = computeOverallSignalStrength(conf);

      // Geometric mean of [0.9, 0.8, 0.7, 0.6, 0.5] = (0.9*0.8*0.7*0.6*0.5)^(1/5)
      const expected = Math.pow(0.9 * 0.8 * 0.7 * 0.6 * 0.5, 1 / 5);
      expect(overall).toBeCloseTo(expected, 10);
    });

    it('should handle edge cases in confidence computation', () => {
      // All 1s
      const allOnes = computeOverallSignalStrength({
        retrieval: 1,
        structural: 1,
        semantic: 1,
        testExecution: 1,
        recency: 1,
        aggregationMethod: 'geometric_mean',
      });
      expect(allOnes).toBe(1);

      // All 0s
      const allZeros = computeOverallSignalStrength({
        retrieval: 0,
        structural: 0,
        semantic: 0,
        testExecution: 0,
        recency: 0,
        aggregationMethod: 'geometric_mean',
      });
      expect(allZeros).toBe(0);
    });
  });

  describe('Claim', () => {
    it('should create a valid claim with factory function', () => {
      const claim = createClaim({
        proposition: 'Function X validates user input',
        type: 'semantic',
        subject: {
          type: 'function',
          id: 'func_123',
          name: 'validateInput',
          location: {
            file: 'src/validators.ts',
            startLine: 10,
            endLine: 25,
          },
        },
        source: {
          type: 'llm',
          id: 'claude-sonnet-4-20250514',
          version: '1.0',
          traceId: 'trace_abc123',
        },
      });

      expect(claim.id).toBeTruthy();
      expect(claim.proposition).toBe('Function X validates user input');
      expect(claim.type).toBe('semantic');
      expect(claim.status).toBe('active');
      expect(claim.schemaVersion).toBe(EVIDENCE_GRAPH_SCHEMA_VERSION);
      expect(claim.confidence.type).toBe('absent');
      expect(claim.signalStrength.overall).toBeGreaterThan(0);
      expect(isClaim(claim)).toBe(true);
    });

    it('should accept custom signal strength values', () => {
      const claim = createClaim({
        proposition: 'Test claim',
        type: 'quality',
        subject: { type: 'file', id: 'file_1', name: 'test.ts' },
        source: { type: 'static_analysis', id: 'eslint' },
        signalStrength: {
          retrieval: 0.95,
          structural: 0.9,
          semantic: 0.85,
        },
      });

      expect(claim.signalStrength.retrieval).toBe(0.95);
      expect(claim.signalStrength.structural).toBe(0.9);
      expect(claim.signalStrength.semantic).toBe(0.85);
      // testExecution and recency should be default 0.5
      expect(claim.signalStrength.testExecution).toBe(0.5);
      expect(claim.signalStrength.recency).toBe(0.5);
    });

    it('should accept ConfidenceValue for claim confidence', () => {
      const claim = createClaim({
        proposition: 'Deterministic claim',
        type: 'semantic',
        subject: { type: 'file', id: 'file_2', name: 'test.ts' },
        source: { type: 'static_analysis', id: 'eslint' },
        confidence: deterministic(true, 'test_deterministic'),
      });

      expect(claim.confidence.type).toBe('deterministic');
    });

    it('should reject invalid claims in type guard', () => {
      expect(isClaim(null)).toBe(false);
      expect(isClaim(undefined)).toBe(false);
      expect(isClaim({})).toBe(false);
      expect(isClaim({ id: 'test' })).toBe(false);
      expect(isClaim({ id: 'test', proposition: 'test' })).toBe(false);
    });
  });

  describe('EvidenceEdge', () => {
    it('should validate evidence edges', () => {
      const edge: EvidenceEdge = {
        id: 'edge_1',
        fromClaimId: createClaimId('claim_a'),
        toClaimId: createClaimId('claim_b'),
        type: 'supports',
        strength: 0.85,
        createdAt: new Date().toISOString(),
      };

      expect(isEvidenceEdge(edge)).toBe(true);
    });

    it('should reject invalid evidence edges', () => {
      expect(isEvidenceEdge(null)).toBe(false);
      expect(isEvidenceEdge({})).toBe(false);
      expect(isEvidenceEdge({ id: 'test', fromClaimId: 'a' })).toBe(false);
    });

    it('should support all edge types', () => {
      const edgeTypes = [
        'supports', 'opposes', 'assumes', 'defeats', 'rebuts',
        'undercuts', 'undermines', 'supersedes', 'depends_on', 'co_occurs',
      ];

      for (const type of edgeTypes) {
        const edge: EvidenceEdge = {
          id: `edge_${type}`,
          fromClaimId: createClaimId('a'),
          toClaimId: createClaimId('b'),
          type: type as EvidenceEdge['type'],
          strength: 0.5,
          createdAt: new Date().toISOString(),
        };
        expect(isEvidenceEdge(edge)).toBe(true);
      }
    });
  });

  describe('ExtendedDefeater', () => {
    it('should create a valid defeater with factory function', () => {
      const defeater = createDefeater({
        type: 'staleness',
        description: 'Knowledge is 45 days old',
        severity: 'warning',
        affectedClaimIds: [createClaimId('claim_1'), createClaimId('claim_2')],
        confidenceReduction: 0.15,
        autoResolvable: true,
        resolutionAction: 're-index affected files',
      });

      expect(defeater.id).toBeTruthy();
      expect(defeater.type).toBe('staleness');
      expect(defeater.severity).toBe('warning');
      expect(defeater.status).toBe('pending');
      expect(defeater.affectedClaimIds).toHaveLength(2);
      expect(isExtendedDefeater(defeater)).toBe(true);
    });

    it('should support all extended defeater types', () => {
      const defeaterTypes = [
        'code_change', 'test_failure', 'contradiction', 'new_info',
        'staleness', 'coverage_gap', 'tool_failure', 'sandbox_mismatch',
        'untrusted_content', 'provider_unavailable', 'hash_mismatch',
        'dependency_drift', 'schema_version',
      ];

      for (const type of defeaterTypes) {
        const defeater = createDefeater({
          type: type as ExtendedDefeater['type'],
          description: `Test ${type} defeater`,
          severity: 'partial',
          affectedClaimIds: [],
          confidenceReduction: 0.2,
          autoResolvable: false,
        });
        expect(isExtendedDefeater(defeater)).toBe(true);
        expect(defeater.type).toBe(type);
      }
    });

    it('should reject invalid defeaters', () => {
      expect(isExtendedDefeater(null)).toBe(false);
      expect(isExtendedDefeater({})).toBe(false);
      expect(isExtendedDefeater({ type: 'staleness' })).toBe(false);
    });
  });

  describe('Contradiction', () => {
    it('should create a valid contradiction with factory function', () => {
      const claimA = createClaimId('claim_a');
      const claimB = createClaimId('claim_b');

      const contradiction = createContradiction(
        claimA,
        claimB,
        'direct',
        'ClaimA says function is pure, ClaimB says it has side effects',
        'significant'
      );

      expect(contradiction.id).toBeTruthy();
      expect(contradiction.claimA).toBe(claimA);
      expect(contradiction.claimB).toBe(claimB);
      expect(contradiction.type).toBe('direct');
      expect(contradiction.status).toBe('unresolved');
      expect(contradiction.resolution).toBeUndefined();
      expect(isContradiction(contradiction)).toBe(true);
    });

    it('should support all contradiction types', () => {
      const types = ['direct', 'implicational', 'temporal', 'scope', 'conditional'];

      for (const type of types) {
        const contradiction = createContradiction(
          createClaimId('a'),
          createClaimId('b'),
          type as Contradiction['type'],
          `Test ${type} contradiction`
        );
        expect(isContradiction(contradiction)).toBe(true);
      }
    });

    it('should default severity to significant', () => {
      const contradiction = createContradiction(
        createClaimId('a'),
        createClaimId('b'),
        'direct',
        'Test'
      );
      expect(contradiction.severity).toBe('significant');
    });

    it('should reject invalid contradictions', () => {
      expect(isContradiction(null)).toBe(false);
      expect(isContradiction({})).toBe(false);
      expect(isContradiction({ claimA: 'a', claimB: 'b' })).toBe(false);
    });
  });

  describe('EvidenceGraph', () => {
    it('should create an empty evidence graph', () => {
      const graph = createEmptyEvidenceGraph('/workspace/test-repo');

      expect(graph.id).toContain('graph_');
      expect(graph.schemaVersion).toBe(EVIDENCE_GRAPH_SCHEMA_VERSION);
      expect(graph.workspace).toBe('/workspace/test-repo');
      expect(graph.claims).toBeInstanceOf(Map);
      expect(graph.claims.size).toBe(0);
      expect(graph.edges).toEqual([]);
      expect(graph.defeaters).toEqual([]);
      expect(graph.contradictions).toEqual([]);
      expect(graph.meta.claimCount).toBe(0);
      expect(graph.meta.health).toBe(1.0);
      expect(isEvidenceGraph(graph)).toBe(true);
    });

    it('should serialize and deserialize correctly', () => {
      const graph = createEmptyEvidenceGraph('/workspace/test');

      // Add some claims
      const claim1 = createClaim({
        proposition: 'Claim 1',
        type: 'semantic',
        subject: { type: 'file', id: 'f1', name: 'test.ts' },
        source: { type: 'llm', id: 'test' },
      });
      const claim2 = createClaim({
        proposition: 'Claim 2',
        type: 'structural',
        subject: { type: 'module', id: 'm1', name: 'module' },
        source: { type: 'static_analysis', id: 'test' },
      });

      graph.claims.set(claim1.id, claim1);
      graph.claims.set(claim2.id, claim2);
      graph.meta.claimCount = 2;

      // Add an edge
      graph.edges.push({
        id: 'edge_1',
        fromClaimId: claim1.id,
        toClaimId: claim2.id,
        type: 'supports',
        strength: 0.8,
        createdAt: new Date().toISOString(),
      });

      // Add a defeater
      graph.defeaters.push(createDefeater({
        type: 'staleness',
        description: 'Test defeater',
        severity: 'warning',
        affectedClaimIds: [claim1.id],
        confidenceReduction: 0.1,
        autoResolvable: true,
      }));

      // Add a contradiction
      graph.contradictions.push(createContradiction(
        claim1.id,
        claim2.id,
        'direct',
        'Test contradiction'
      ));

      // Serialize
      const serialized = serializeEvidenceGraph(graph);
      expect(typeof serialized.claims).toBe('object');
      expect(serialized.claims).not.toBeInstanceOf(Map);

      // Deserialize
      const deserialized = deserializeEvidenceGraph(serialized);
      expect(deserialized.claims).toBeInstanceOf(Map);
      expect(deserialized.claims.size).toBe(2);
      expect(deserialized.claims.get(claim1.id)).toBeDefined();
      expect(deserialized.claims.get(claim1.id)?.proposition).toBe('Claim 1');
      expect(deserialized.edges).toHaveLength(1);
      expect(deserialized.defeaters).toHaveLength(1);
      expect(deserialized.contradictions).toHaveLength(1);
      expect(isEvidenceGraph(deserialized)).toBe(true);
    });

    it('should preserve all data through serialization roundtrip', () => {
      const graph = createEmptyEvidenceGraph('/test');

      const claim = createClaim({
        proposition: 'Test with special chars: "quotes" & <brackets>',
        type: 'security',
        subject: {
          type: 'function',
          id: 'fn_special',
          name: 'specialFunction',
          location: {
            file: '/path/to/file.ts',
            startLine: 100,
            endLine: 150,
          },
        },
        source: {
          type: 'tool',
          id: 'security-scanner',
          version: '2.0.0',
          traceId: 'trace_xyz',
        },
        confidence: absent('uncalibrated'),
        signalStrength: {
          retrieval: 0.92,
          structural: 0.88,
          semantic: 0.75,
          testExecution: 0.95,
          recency: 0.99,
        },
      });

      graph.claims.set(claim.id, claim);

      const serialized = serializeEvidenceGraph(graph);
      const json = JSON.stringify(serialized);
      const parsed = JSON.parse(json);
      const deserialized = deserializeEvidenceGraph(parsed);

      const restored = deserialized.claims.get(claim.id);
      expect(restored).toBeDefined();
      expect(restored?.proposition).toBe(claim.proposition);
      expect(restored?.source.traceId).toBe('trace_xyz');
      expect(restored?.signalStrength.retrieval).toBe(0.92);
    });

    it('should reject invalid evidence graphs', () => {
      expect(isEvidenceGraph(null)).toBe(false);
      expect(isEvidenceGraph({})).toBe(false);
      expect(isEvidenceGraph({ id: 'test', claims: {} })).toBe(false);
    });
  });

  describe('Invariants', () => {
    it('contradictions are never automatically removed', () => {
      const graph = createEmptyEvidenceGraph('/test');

      const contradiction = createContradiction(
        createClaimId('a'),
        createClaimId('b'),
        'direct',
        'Important contradiction'
      );

      graph.contradictions.push(contradiction);

      // Verify contradiction status is unresolved by default
      expect(contradiction.status).toBe('unresolved');

      // There should be no auto-resolution logic
      expect(contradiction.resolution).toBeUndefined();
    });

    it('defeaters preserve full audit trail', () => {
      const defeater = createDefeater({
        type: 'code_change',
        description: 'File was modified',
        severity: 'full',
        affectedClaimIds: [createClaimId('c1')],
        confidenceReduction: 0.5,
        autoResolvable: false,
        evidence: 'git diff output showing changes',
      });

      expect(defeater.detectedAt).toBeTruthy();
      expect(defeater.evidence).toBe('git diff output showing changes');
      expect(defeater.status).toBe('pending');
    });

    it('schema version is always set on claims', () => {
      const claim = createClaim({
        proposition: 'Any claim',
        type: 'semantic',
        subject: { type: 'file', id: '1', name: 'test' },
        source: { type: 'llm', id: 'test' },
      });

      expect(claim.schemaVersion).toBe(EVIDENCE_GRAPH_SCHEMA_VERSION);
    });
  });
});
