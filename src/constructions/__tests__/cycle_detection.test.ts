/**
 * @fileoverview Tests for Cycle Detection Algorithms
 *
 * Tests the DFS-based cycle detection and Tarjan's SCC algorithm:
 * - 2-node (direct) cycles
 * - 3+ node (indirect) cycles
 * - Multiple cycles
 * - Self-loops
 * - Complex dependency graphs
 * - Strongly connected components
 */

import { describe, it, expect } from 'vitest';
import { detectAllCycles, findStronglyConnectedComponents, DependencyCycle } from '../architecture_verifier.js';

// ============================================================================
// detectAllCycles TESTS
// ============================================================================

describe('detectAllCycles', () => {
  describe('2-node (direct) cycles', () => {
    it('should detect a simple 2-node cycle (A -> B -> A)', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(1);
      expect(cycles[0].type).toBe('direct');
      expect(cycles[0].length).toBe(2);
      expect(cycles[0].nodes).toContain('A');
      expect(cycles[0].nodes).toContain('B');
    });

    it('should detect multiple 2-node cycles', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['A']],
        ['C', ['D']],
        ['D', ['C']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(2);
      expect(cycles.every(c => c.type === 'direct')).toBe(true);
      expect(cycles.every(c => c.length === 2)).toBe(true);
    });
  });

  describe('3-node cycles', () => {
    it('should detect a 3-node cycle (A -> B -> C -> A)', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(1);
      expect(cycles[0].type).toBe('indirect');
      expect(cycles[0].length).toBe(3);
      expect(cycles[0].nodes.slice(0, -1)).toEqual(expect.arrayContaining(['A', 'B', 'C']));
      // Verify the cycle closes
      expect(cycles[0].nodes[cycles[0].nodes.length - 1]).toBe(cycles[0].nodes[0]);
    });

    it('should detect 3-node cycle with extra dependencies', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B', 'X']],
        ['B', ['C', 'Y']],
        ['C', ['A', 'Z']],
        ['X', []],
        ['Y', []],
        ['Z', []],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(1);
      expect(cycles[0].length).toBe(3);
    });
  });

  describe('4+ node cycles', () => {
    it('should detect a 4-node cycle (A -> B -> C -> D -> A)', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['D']],
        ['D', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(1);
      expect(cycles[0].type).toBe('indirect');
      expect(cycles[0].length).toBe(4);
    });

    it('should detect a 5-node cycle', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['D']],
        ['D', ['E']],
        ['E', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(1);
      expect(cycles[0].length).toBe(5);
    });
  });

  describe('multiple cycles', () => {
    it('should detect overlapping cycles', () => {
      // A -> B -> C -> A (3-node)
      // A -> B -> D -> A (3-node)
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C', 'D']],
        ['C', ['A']],
        ['D', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(2);
      expect(cycles.every(c => c.length === 3)).toBe(true);
    });

    it('should detect nested cycles', () => {
      // A -> B -> A (2-node)
      // A -> B -> C -> A (3-node)
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['A', 'C']],
        ['C', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      // Should find both the 2-node and 3-node cycles
      expect(cycles.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect independent cycles in disconnected components', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['A']],
        ['X', ['Y']],
        ['Y', ['Z']],
        ['Z', ['X']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(2);
      // One 2-node and one 3-node
      const lengths = cycles.map(c => c.length).sort();
      expect(lengths).toEqual([2, 3]);
    });
  });

  describe('self-loops', () => {
    it('should detect a self-loop (A -> A)', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(1);
      expect(cycles[0].length).toBe(1);
      expect(cycles[0].nodes).toEqual(['A', 'A']);
    });
  });

  describe('no cycles', () => {
    it('should return empty array for acyclic graph', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', []],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles).toEqual([]);
    });

    it('should return empty array for empty graph', () => {
      const dependencies = new Map<string, string[]>();

      const cycles = detectAllCycles(dependencies);

      expect(cycles).toEqual([]);
    });

    it('should handle nodes with no dependencies', () => {
      const dependencies = new Map<string, string[]>([
        ['A', []],
        ['B', []],
        ['C', []],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles).toEqual([]);
    });
  });

  describe('cycle normalization', () => {
    it('should not report duplicate cycles from different starting points', () => {
      // The same cycle A -> B -> C -> A should only be reported once
      // regardless of which node we start from
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      // Should only have one cycle, not three
      expect(cycles.length).toBe(1);
    });
  });

  describe('complex graphs', () => {
    it('should handle diamond dependency with cycle', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D -> A (creates cycle)
      const dependencies = new Map<string, string[]>([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', ['A']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBeGreaterThanOrEqual(1);
      // Should find cycles like A -> B -> D -> A and A -> C -> D -> A
    });

    it('should handle real-world module cycle scenario', () => {
      // Simulates: api -> services -> utils -> api
      const dependencies = new Map<string, string[]>([
        ['src/api/index.ts', ['src/services/auth.ts']],
        ['src/services/auth.ts', ['src/utils/crypto.ts']],
        ['src/utils/crypto.ts', ['src/api/index.ts']],
      ]);

      const cycles = detectAllCycles(dependencies);

      expect(cycles.length).toBe(1);
      expect(cycles[0].length).toBe(3);
      expect(cycles[0].type).toBe('indirect');
    });
  });
});

// ============================================================================
// findStronglyConnectedComponents TESTS
// ============================================================================

describe('findStronglyConnectedComponents', () => {
  describe('basic SCCs', () => {
    it('should find a 2-node SCC', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['A']],
      ]);

      const sccs = findStronglyConnectedComponents(dependencies);

      expect(sccs.length).toBe(1);
      expect(sccs[0].sort()).toEqual(['A', 'B']);
    });

    it('should find a 3-node SCC', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);

      const sccs = findStronglyConnectedComponents(dependencies);

      expect(sccs.length).toBe(1);
      expect(sccs[0].sort()).toEqual(['A', 'B', 'C']);
    });
  });

  describe('multiple SCCs', () => {
    it('should find multiple independent SCCs', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['A']],
        ['X', ['Y']],
        ['Y', ['X']],
      ]);

      const sccs = findStronglyConnectedComponents(dependencies);

      expect(sccs.length).toBe(2);
    });

    it('should find SCCs connected by non-cyclic edges', () => {
      // SCC1: A <-> B
      // SCC2: X <-> Y
      // A -> X (non-cyclic connection)
      const dependencies = new Map<string, string[]>([
        ['A', ['B', 'X']],
        ['B', ['A']],
        ['X', ['Y']],
        ['Y', ['X']],
      ]);

      const sccs = findStronglyConnectedComponents(dependencies);

      expect(sccs.length).toBe(2);
    });
  });

  describe('no SCCs', () => {
    it('should return empty array for acyclic graph', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', []],
      ]);

      const sccs = findStronglyConnectedComponents(dependencies);

      // Single-node SCCs are filtered out, so should be empty
      expect(sccs).toEqual([]);
    });

    it('should return empty array for empty graph', () => {
      const dependencies = new Map<string, string[]>();

      const sccs = findStronglyConnectedComponents(dependencies);

      expect(sccs).toEqual([]);
    });
  });

  describe('complex SCCs', () => {
    it('should handle complex interconnected SCC', () => {
      // All nodes can reach all other nodes
      const dependencies = new Map<string, string[]>([
        ['A', ['B', 'C']],
        ['B', ['A', 'C']],
        ['C', ['A', 'B']],
      ]);

      const sccs = findStronglyConnectedComponents(dependencies);

      expect(sccs.length).toBe(1);
      expect(sccs[0].sort()).toEqual(['A', 'B', 'C']);
    });

    it('should correctly separate overlapping cycles into one SCC', () => {
      // A -> B -> C -> A (3-node cycle)
      // A -> D -> A (2-node cycle with A)
      // All these form one SCC
      const dependencies = new Map<string, string[]>([
        ['A', ['B', 'D']],
        ['B', ['C']],
        ['C', ['A']],
        ['D', ['A']],
      ]);

      const sccs = findStronglyConnectedComponents(dependencies);

      expect(sccs.length).toBe(1);
      expect(sccs[0].sort()).toEqual(['A', 'B', 'C', 'D']);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Cycle Detection Integration', () => {
  it('should find cycles that SCCs contain', () => {
    const dependencies = new Map<string, string[]>([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
    ]);

    const cycles = detectAllCycles(dependencies);
    const sccs = findStronglyConnectedComponents(dependencies);

    // If there's an SCC, there should be cycles
    expect(sccs.length).toBeGreaterThan(0);
    expect(cycles.length).toBeGreaterThan(0);

    // All cycle nodes should be in an SCC
    for (const cycle of cycles) {
      const cycleNodes = new Set(cycle.nodes.slice(0, -1)); // Exclude closing node
      const inScc = sccs.some(scc => {
        const sccSet = new Set(scc);
        return [...cycleNodes].every(node => sccSet.has(node));
      });
      expect(inScc).toBe(true);
    }
  });

  it('should handle large cycle (performance test)', () => {
    // Create a 100-node cycle
    const dependencies = new Map<string, string[]>();
    const nodeCount = 100;

    for (let i = 0; i < nodeCount; i++) {
      const next = (i + 1) % nodeCount;
      dependencies.set(`Node${i}`, [`Node${next}`]);
    }

    const startTime = Date.now();
    const cycles = detectAllCycles(dependencies);
    const elapsed = Date.now() - startTime;

    expect(cycles.length).toBe(1);
    expect(cycles[0].length).toBe(nodeCount);
    // Should complete in reasonable time (< 1 second)
    expect(elapsed).toBeLessThan(1000);
  });
});
