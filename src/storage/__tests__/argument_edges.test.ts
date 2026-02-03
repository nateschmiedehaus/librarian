/**
 * @fileoverview Tests for Argument Edge Types (Toulmin-IBIS Research)
 *
 * Tests cover:
 * - ArgumentEdgeType union type
 * - ArgumentEdge interface with metadata
 * - Type guards: isArgumentEdge(), isArgumentEdgeType()
 * - Helper functions: getArgumentEdges(), groupArgumentEdgesByType()
 * - Edge creation and classification utilities
 *
 * Based on: docs/research/ARGUMENTATION-STRUCTURES-FOR-CODE-REASONING.md
 */

import { describe, it, expect } from 'vitest';
import {
  type ArgumentEdge,
  type ArgumentEdgeType,
  type ArgumentEntityType,
  type ArgumentEdgeMetadata,
  type KnowledgeGraphEdge,
  ARGUMENT_EDGE_TYPES,
  ARGUMENT_ENTITY_TYPES,
  isArgumentEdgeType,
  isArgumentEntityType,
  isArgumentEdge,
  getArgumentEdges,
  groupArgumentEdgesByType,
  createArgumentEdge,
  isConflictEdge,
  isSupportEdge,
  isDecisionChainEdge,
} from '../types.js';

describe('Argument Edge Types', () => {
  // ========================================================================
  // ArgumentEdgeType Tests
  // ========================================================================

  describe('ArgumentEdgeType', () => {
    it('should include all 8 Toulmin-IBIS edge types', () => {
      expect(ARGUMENT_EDGE_TYPES).toHaveLength(8);
      expect(ARGUMENT_EDGE_TYPES).toContain('supports');
      expect(ARGUMENT_EDGE_TYPES).toContain('warrants');
      expect(ARGUMENT_EDGE_TYPES).toContain('qualifies');
      expect(ARGUMENT_EDGE_TYPES).toContain('contradicts');
      expect(ARGUMENT_EDGE_TYPES).toContain('undermines');
      expect(ARGUMENT_EDGE_TYPES).toContain('rebuts');
      expect(ARGUMENT_EDGE_TYPES).toContain('supersedes');
      expect(ARGUMENT_EDGE_TYPES).toContain('depends_on_decision');
    });

    it('should have Toulmin-inspired types (reasoning structure)', () => {
      // Toulmin model: claim-warrant-backing structure
      const toulminTypes: ArgumentEdgeType[] = ['supports', 'warrants', 'qualifies'];
      toulminTypes.forEach((type) => {
        expect(isArgumentEdgeType(type)).toBe(true);
      });
    });

    it('should have AAF/ASPIC+-inspired types (conflict resolution)', () => {
      // AAF: attack semantics; ASPIC+: undermining, rebutting
      const aafTypes: ArgumentEdgeType[] = ['contradicts', 'undermines', 'rebuts'];
      aafTypes.forEach((type) => {
        expect(isArgumentEdgeType(type)).toBe(true);
      });
    });

    it('should have ADR/IBIS-inspired types (decision chains)', () => {
      // IBIS: issue-position-argument deliberation
      const ibisTypes: ArgumentEdgeType[] = ['supersedes', 'depends_on_decision'];
      ibisTypes.forEach((type) => {
        expect(isArgumentEdgeType(type)).toBe(true);
      });
    });
  });

  // ========================================================================
  // ArgumentEntityType Tests
  // ========================================================================

  describe('ArgumentEntityType', () => {
    it('should include all argument entity types', () => {
      expect(ARGUMENT_ENTITY_TYPES).toHaveLength(8);
      expect(ARGUMENT_ENTITY_TYPES).toContain('decision');
      expect(ARGUMENT_ENTITY_TYPES).toContain('constraint');
      expect(ARGUMENT_ENTITY_TYPES).toContain('assumption');
      expect(ARGUMENT_ENTITY_TYPES).toContain('alternative');
      expect(ARGUMENT_ENTITY_TYPES).toContain('tradeoff');
      expect(ARGUMENT_ENTITY_TYPES).toContain('risk');
      expect(ARGUMENT_ENTITY_TYPES).toContain('evidence');
      expect(ARGUMENT_ENTITY_TYPES).toContain('principle');
    });
  });

  // ========================================================================
  // Type Guard Tests
  // ========================================================================

  describe('isArgumentEdgeType()', () => {
    it('should return true for valid argument edge types', () => {
      expect(isArgumentEdgeType('supports')).toBe(true);
      expect(isArgumentEdgeType('warrants')).toBe(true);
      expect(isArgumentEdgeType('qualifies')).toBe(true);
      expect(isArgumentEdgeType('contradicts')).toBe(true);
      expect(isArgumentEdgeType('undermines')).toBe(true);
      expect(isArgumentEdgeType('rebuts')).toBe(true);
      expect(isArgumentEdgeType('supersedes')).toBe(true);
      expect(isArgumentEdgeType('depends_on_decision')).toBe(true);
    });

    it('should return false for non-argument edge types', () => {
      expect(isArgumentEdgeType('calls')).toBe(false);
      expect(isArgumentEdgeType('imports')).toBe(false);
      expect(isArgumentEdgeType('extends')).toBe(false);
      expect(isArgumentEdgeType('implements')).toBe(false);
      expect(isArgumentEdgeType('invalid')).toBe(false);
      expect(isArgumentEdgeType('')).toBe(false);
    });

    it('should work as type guard', () => {
      const edgeType: string = 'supports';
      if (isArgumentEdgeType(edgeType)) {
        // TypeScript should narrow to ArgumentEdgeType
        const _narrowed: ArgumentEdgeType = edgeType;
        expect(_narrowed).toBe('supports');
      }
    });
  });

  describe('isArgumentEntityType()', () => {
    it('should return true for valid argument entity types', () => {
      expect(isArgumentEntityType('decision')).toBe(true);
      expect(isArgumentEntityType('constraint')).toBe(true);
      expect(isArgumentEntityType('assumption')).toBe(true);
      expect(isArgumentEntityType('alternative')).toBe(true);
      expect(isArgumentEntityType('tradeoff')).toBe(true);
      expect(isArgumentEntityType('risk')).toBe(true);
      expect(isArgumentEntityType('evidence')).toBe(true);
      expect(isArgumentEntityType('principle')).toBe(true);
    });

    it('should return false for non-argument entity types', () => {
      expect(isArgumentEntityType('function')).toBe(false);
      expect(isArgumentEntityType('module')).toBe(false);
      expect(isArgumentEntityType('file')).toBe(false);
      expect(isArgumentEntityType('invalid')).toBe(false);
    });
  });

  describe('isArgumentEdge()', () => {
    it('should return true for edges with argument edge types', () => {
      const edge: ArgumentEdge = {
        id: 'test-1',
        sourceId: 'benchmark-1',
        targetId: 'adr-001',
        sourceType: 'evidence',
        targetType: 'decision',
        type: 'supports',
        weight: 0.9,
        confidence: 0.95,
        computedAt: new Date().toISOString(),
      };
      expect(isArgumentEdge(edge)).toBe(true);
    });

    it('should handle edges with edgeType instead of type', () => {
      const edge = {
        id: 'test-1',
        edgeType: 'supports',
      };
      expect(isArgumentEdge(edge)).toBe(true);
    });

    it('should return false for knowledge graph edges', () => {
      const edge: Partial<KnowledgeGraphEdge> = {
        id: 'test-1',
        edgeType: 'calls',
      };
      expect(isArgumentEdge(edge)).toBe(false);
    });

    it('should return false for edges without type', () => {
      const edge = { id: 'test-1' };
      expect(isArgumentEdge(edge)).toBe(false);
    });
  });

  // ========================================================================
  // ArgumentEdge Interface Tests
  // ========================================================================

  describe('ArgumentEdge interface', () => {
    it('should create a valid supports edge', () => {
      const edge: ArgumentEdge = {
        id: 'arg-001',
        sourceId: 'benchmark-2024',
        targetId: 'adr-015-redis-cache',
        sourceType: 'evidence',
        targetType: 'decision',
        type: 'supports',
        weight: 0.9,
        confidence: 0.95,
        metadata: {
          strength: 0.9,
          extractedFrom: 'adr',
        },
        computedAt: '2024-01-15T10:00:00Z',
      };

      expect(edge.type).toBe('supports');
      expect(edge.sourceType).toBe('evidence');
      expect(edge.targetType).toBe('decision');
      expect(edge.metadata?.strength).toBe(0.9);
    });

    it('should create a valid warrants edge with Toulmin metadata', () => {
      const edge: ArgumentEdge = {
        id: 'arg-002',
        sourceId: 'principle:cap-theorem',
        targetId: 'adr-008-eventual-consistency',
        sourceType: 'principle',
        targetType: 'decision',
        type: 'warrants',
        weight: 1.0,
        confidence: 1.0,
        metadata: {
          warrantSource: 'Brewer, E. (2000). PODC Keynote',
          ruleType: 'strict',
        },
        computedAt: '2024-01-15T10:00:00Z',
      };

      expect(edge.type).toBe('warrants');
      expect(edge.metadata?.warrantSource).toBe('Brewer, E. (2000). PODC Keynote');
      expect(edge.metadata?.ruleType).toBe('strict');
    });

    it('should create a valid qualifies edge with condition', () => {
      const edge: ArgumentEdge = {
        id: 'arg-003',
        sourceId: 'assumption:read-heavy-workload',
        targetId: 'adr-015-redis-cache',
        sourceType: 'assumption',
        targetType: 'decision',
        type: 'qualifies',
        weight: 0.7,
        confidence: 0.85,
        metadata: {
          qualifierCondition: 'read:write ratio > 10:1',
          ruleType: 'defeasible',
        },
        computedAt: '2024-01-15T10:00:00Z',
      };

      expect(edge.type).toBe('qualifies');
      expect(edge.metadata?.qualifierCondition).toBe('read:write ratio > 10:1');
    });

    it('should create a valid rebuts edge with defeat condition', () => {
      const edge: ArgumentEdge = {
        id: 'arg-004',
        sourceId: 'constraint:acid-transactions',
        targetId: 'adr-008-eventual-consistency',
        sourceType: 'constraint',
        targetType: 'decision',
        type: 'rebuts',
        weight: 1.0,
        confidence: 0.9,
        metadata: {
          rebuttalCondition: 'financial transactions require ACID',
          ruleType: 'strict',
        },
        computedAt: '2024-01-15T10:00:00Z',
      };

      expect(edge.type).toBe('rebuts');
      expect(edge.metadata?.rebuttalCondition).toContain('ACID');
    });

    it('should create a valid supersedes edge', () => {
      const edge: ArgumentEdge = {
        id: 'arg-005',
        sourceId: 'adr-015-redis-cache',
        targetId: 'adr-007-memcached',
        sourceType: 'decision',
        targetType: 'decision',
        type: 'supersedes',
        weight: 1.0,
        confidence: 1.0,
        metadata: {
          validFrom: '2024-06-01T00:00:00Z',
          extractedFrom: 'adr',
        },
        computedAt: '2024-06-01T10:00:00Z',
      };

      expect(edge.type).toBe('supersedes');
      expect(edge.sourceType).toBe('decision');
      expect(edge.targetType).toBe('decision');
    });

    it('should create a valid depends_on_decision edge', () => {
      const edge: ArgumentEdge = {
        id: 'arg-006',
        sourceId: 'adr-002-api-gateway',
        targetId: 'adr-001-microservices',
        sourceType: 'decision',
        targetType: 'decision',
        type: 'depends_on_decision',
        weight: 1.0,
        confidence: 0.8,
        metadata: {
          extractedFrom: 'adr',
        },
        computedAt: '2024-01-15T10:00:00Z',
      };

      expect(edge.type).toBe('depends_on_decision');
    });

    it('should support code entity types as source/target', () => {
      // Argument edges can connect to code entities, not just argument entities
      const edge: ArgumentEdge = {
        id: 'arg-007',
        sourceId: 'test-suite-001',
        targetId: 'func-authenticate',
        sourceType: 'file', // Code entity type
        targetType: 'function', // Code entity type
        type: 'supports',
        weight: 0.8,
        confidence: 0.9,
        computedAt: '2024-01-15T10:00:00Z',
      };

      expect(edge.sourceType).toBe('file');
      expect(edge.targetType).toBe('function');
    });
  });

  // ========================================================================
  // ArgumentEdgeMetadata Tests
  // ========================================================================

  describe('ArgumentEdgeMetadata', () => {
    it('should support Toulmin components', () => {
      const metadata: ArgumentEdgeMetadata = {
        warrantSource: 'Clean Code by Robert Martin',
        qualifierCondition: 'only for internal services',
        rebuttalCondition: 'unless PCI compliance required',
      };

      expect(metadata.warrantSource).toBeDefined();
      expect(metadata.qualifierCondition).toBeDefined();
      expect(metadata.rebuttalCondition).toBeDefined();
    });

    it('should support ASPIC+ components', () => {
      const metadata: ArgumentEdgeMetadata = {
        ruleType: 'defeasible',
        preferenceLevel: 0.8,
      };

      expect(metadata.ruleType).toBe('defeasible');
      expect(metadata.preferenceLevel).toBe(0.8);
    });

    it('should support evidence linkage', () => {
      const metadata: ArgumentEdgeMetadata = {
        strength: 0.95,
        evidenceRefs: ['evidence-001', 'evidence-002'],
      };

      expect(metadata.strength).toBe(0.95);
      expect(metadata.evidenceRefs).toHaveLength(2);
    });

    it('should support temporal validity', () => {
      const metadata: ArgumentEdgeMetadata = {
        validFrom: '2024-01-01T00:00:00Z',
        validUntil: '2025-01-01T00:00:00Z',
      };

      expect(metadata.validFrom).toBeDefined();
      expect(metadata.validUntil).toBeDefined();
    });

    it('should support provenance tracking', () => {
      const metadata: ArgumentEdgeMetadata = {
        extractedFrom: 'adr',
      };

      expect(metadata.extractedFrom).toBe('adr');
    });
  });

  // ========================================================================
  // Helper Function Tests
  // ========================================================================

  describe('getArgumentEdges()', () => {
    it('should filter only argument edges from mixed array', () => {
      const edges = [
        { type: 'supports', id: '1' },
        { edgeType: 'calls', id: '2' },
        { type: 'warrants', id: '3' },
        { edgeType: 'imports', id: '4' },
        { type: 'contradicts', id: '5' },
      ];

      const argumentEdges = getArgumentEdges(edges);

      expect(argumentEdges).toHaveLength(3);
      expect(argumentEdges.map((e) => e.id)).toEqual(['1', '3', '5']);
    });

    it('should return empty array when no argument edges', () => {
      const edges = [
        { edgeType: 'calls', id: '1' },
        { edgeType: 'imports', id: '2' },
      ];

      const argumentEdges = getArgumentEdges(edges);

      expect(argumentEdges).toHaveLength(0);
    });

    it('should handle edges with edgeType property', () => {
      const edges = [
        { edgeType: 'supports', id: '1' },
        { edgeType: 'calls', id: '2' },
      ];

      const argumentEdges = getArgumentEdges(edges);

      expect(argumentEdges).toHaveLength(1);
      expect(argumentEdges[0].id).toBe('1');
    });
  });

  describe('groupArgumentEdgesByType()', () => {
    it('should group edges by their type', () => {
      const edges: ArgumentEdge[] = [
        createArgumentEdge({ id: '1', sourceId: 'a', targetId: 'b', type: 'supports' }),
        createArgumentEdge({ id: '2', sourceId: 'c', targetId: 'd', type: 'supports' }),
        createArgumentEdge({ id: '3', sourceId: 'e', targetId: 'f', type: 'warrants' }),
        createArgumentEdge({ id: '4', sourceId: 'g', targetId: 'h', type: 'contradicts' }),
      ];

      const grouped = groupArgumentEdgesByType(edges);

      expect(grouped.get('supports')).toHaveLength(2);
      expect(grouped.get('warrants')).toHaveLength(1);
      expect(grouped.get('contradicts')).toHaveLength(1);
      expect(grouped.get('rebuts')).toBeUndefined();
    });

    it('should return empty map for empty array', () => {
      const grouped = groupArgumentEdgesByType([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe('createArgumentEdge()', () => {
    it('should create edge with defaults', () => {
      const edge = createArgumentEdge({
        id: 'test-1',
        sourceId: 'source-1',
        targetId: 'target-1',
        type: 'supports',
      });

      expect(edge.id).toBe('test-1');
      expect(edge.sourceId).toBe('source-1');
      expect(edge.targetId).toBe('target-1');
      expect(edge.type).toBe('supports');
      expect(edge.weight).toBe(1.0);
      expect(edge.confidence).toBe(1.0);
      expect(edge.sourceType).toBe('evidence');
      expect(edge.targetType).toBe('decision');
      expect(edge.computedAt).toBeDefined();
    });

    it('should allow overriding defaults', () => {
      const edge = createArgumentEdge({
        id: 'test-1',
        sourceId: 'source-1',
        targetId: 'target-1',
        type: 'warrants',
        weight: 0.8,
        confidence: 0.9,
        sourceType: 'principle',
      });

      expect(edge.weight).toBe(0.8);
      expect(edge.confidence).toBe(0.9);
      expect(edge.sourceType).toBe('principle');
    });
  });

  // ========================================================================
  // Edge Classification Tests
  // ========================================================================

  describe('isConflictEdge()', () => {
    it('should identify conflict edges', () => {
      expect(isConflictEdge(createArgumentEdge({ id: '1', sourceId: 'a', targetId: 'b', type: 'contradicts' }))).toBe(true);
      expect(isConflictEdge(createArgumentEdge({ id: '2', sourceId: 'a', targetId: 'b', type: 'undermines' }))).toBe(true);
      expect(isConflictEdge(createArgumentEdge({ id: '3', sourceId: 'a', targetId: 'b', type: 'rebuts' }))).toBe(true);
    });

    it('should not identify support edges as conflicts', () => {
      expect(isConflictEdge(createArgumentEdge({ id: '1', sourceId: 'a', targetId: 'b', type: 'supports' }))).toBe(false);
      expect(isConflictEdge(createArgumentEdge({ id: '2', sourceId: 'a', targetId: 'b', type: 'warrants' }))).toBe(false);
    });
  });

  describe('isSupportEdge()', () => {
    it('should identify support edges', () => {
      expect(isSupportEdge(createArgumentEdge({ id: '1', sourceId: 'a', targetId: 'b', type: 'supports' }))).toBe(true);
      expect(isSupportEdge(createArgumentEdge({ id: '2', sourceId: 'a', targetId: 'b', type: 'warrants' }))).toBe(true);
    });

    it('should not identify conflict edges as support', () => {
      expect(isSupportEdge(createArgumentEdge({ id: '1', sourceId: 'a', targetId: 'b', type: 'contradicts' }))).toBe(false);
      expect(isSupportEdge(createArgumentEdge({ id: '2', sourceId: 'a', targetId: 'b', type: 'rebuts' }))).toBe(false);
    });
  });

  describe('isDecisionChainEdge()', () => {
    it('should identify decision chain edges', () => {
      expect(isDecisionChainEdge(createArgumentEdge({ id: '1', sourceId: 'a', targetId: 'b', type: 'supersedes' }))).toBe(true);
      expect(isDecisionChainEdge(createArgumentEdge({ id: '2', sourceId: 'a', targetId: 'b', type: 'depends_on_decision' }))).toBe(true);
    });

    it('should not identify other edges as decision chain', () => {
      expect(isDecisionChainEdge(createArgumentEdge({ id: '1', sourceId: 'a', targetId: 'b', type: 'supports' }))).toBe(false);
      expect(isDecisionChainEdge(createArgumentEdge({ id: '2', sourceId: 'a', targetId: 'b', type: 'contradicts' }))).toBe(false);
    });
  });

  // ========================================================================
  // Real-World Scenario Tests
  // ========================================================================

  describe('Real-World Scenarios', () => {
    it('should model "Why Redis?" decision chain', () => {
      // From the research document example
      const edges: ArgumentEdge[] = [
        // Evidence supports decision
        createArgumentEdge({
          id: 'edge-1',
          sourceId: 'benchmark-2024',
          targetId: 'adr-015-redis',
          type: 'supports',
          sourceType: 'evidence',
          targetType: 'decision',
          weight: 0.9,
          confidence: 0.95,
        }),
        // Constraint supports decision
        createArgumentEdge({
          id: 'edge-2',
          sourceId: 'constraint-latency',
          targetId: 'adr-015-redis',
          type: 'supports',
          sourceType: 'constraint',
          targetType: 'decision',
          weight: 0.8,
          confidence: 0.9,
        }),
        // Principle warrants decision
        createArgumentEdge({
          id: 'edge-3',
          sourceId: 'principle-cap',
          targetId: 'adr-015-redis',
          type: 'warrants',
          sourceType: 'principle',
          targetType: 'decision',
          weight: 1.0,
          confidence: 1.0,
        }),
        // Assumption qualifies decision
        createArgumentEdge({
          id: 'edge-4',
          sourceId: 'assume-read-heavy',
          targetId: 'adr-015-redis',
          type: 'qualifies',
          sourceType: 'assumption',
          targetType: 'decision',
          weight: 0.9,
          confidence: 0.85,
        }),
        // Decision contradicts alternative
        createArgumentEdge({
          id: 'edge-5',
          sourceId: 'adr-015-redis',
          targetId: 'alt-postgres',
          type: 'contradicts',
          sourceType: 'decision',
          targetType: 'alternative',
          weight: 1.0,
          confidence: 1.0,
        }),
        // Decision supersedes old alternative
        createArgumentEdge({
          id: 'edge-6',
          sourceId: 'adr-015-redis',
          targetId: 'alt-memcached',
          type: 'supersedes',
          sourceType: 'decision',
          targetType: 'alternative',
          weight: 1.0,
          confidence: 1.0,
        }),
        // Decision depends on microservices decision
        createArgumentEdge({
          id: 'edge-7',
          sourceId: 'adr-015-redis',
          targetId: 'adr-001-microservices',
          type: 'depends_on_decision',
          sourceType: 'decision',
          targetType: 'decision',
          weight: 0.7,
          confidence: 0.8,
        }),
      ];

      // Group by type
      const grouped = groupArgumentEdgesByType(edges);

      // Verify reasoning structure
      expect(grouped.get('supports')).toHaveLength(2);
      expect(grouped.get('warrants')).toHaveLength(1);
      expect(grouped.get('qualifies')).toHaveLength(1);
      expect(grouped.get('contradicts')).toHaveLength(1);
      expect(grouped.get('supersedes')).toHaveLength(1);
      expect(grouped.get('depends_on_decision')).toHaveLength(1);

      // Find support edges
      const supportEdges = edges.filter(isSupportEdge);
      expect(supportEdges).toHaveLength(3); // 2 supports + 1 warrants

      // Find conflict edges
      const conflictEdges = edges.filter(isConflictEdge);
      expect(conflictEdges).toHaveLength(1); // 1 contradicts

      // Find decision chain edges
      const decisionChainEdges = edges.filter(isDecisionChainEdge);
      expect(decisionChainEdges).toHaveLength(2); // supersedes + depends_on_decision
    });

    it('should model security audit finding undermining an assumption', () => {
      const edge: ArgumentEdge = {
        id: 'arg-sec-001',
        sourceId: 'finding:audit-2024-q1',
        targetId: 'assumption:internal-network-safe',
        sourceType: 'evidence',
        targetType: 'assumption',
        type: 'undermines',
        weight: 0.9,
        confidence: 0.95,
        metadata: {
          strength: 0.9,
          extractedFrom: 'manual',
          rebuttalCondition: 'Zero-trust required after finding',
        },
        computedAt: new Date().toISOString(),
      };

      expect(isConflictEdge(edge)).toBe(true);
      expect(edge.metadata?.rebuttalCondition).toContain('Zero-trust');
    });
  });
});
