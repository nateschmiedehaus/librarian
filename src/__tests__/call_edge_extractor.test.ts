import { describe, it, expect } from 'vitest';
import { extractCallEdgesFromAst } from '../agents/call_edge_extractor.js';
import type { ParsedFunction } from '../agents/parser_registry.js';
import type { ParsedCallEdge } from '../agents/call_edge_extractor.js';
import { resolveCallEdges } from '../agents/ast_indexer.js';
import type { FunctionKnowledge } from '../types.js';

const sampleSource = `
function alpha() {
  beta();
}

function beta() {
  return 1;
}

function gamma() {
  alpha();
  this.beta();
}
`;

const parsedFunctions: ParsedFunction[] = [
  { name: 'alpha', signature: 'alpha()', startLine: 2, endLine: 4, purpose: '' },
  { name: 'beta', signature: 'beta()', startLine: 6, endLine: 8, purpose: '' },
  { name: 'gamma', signature: 'gamma()', startLine: 10, endLine: 13, purpose: '' },
];

function createFunctionKnowledge(overrides: Partial<FunctionKnowledge>): FunctionKnowledge {
  return {
    id: 'fn',
    filePath: 'sample.ts',
    name: 'fn',
    signature: 'fn()',
    purpose: '',
    startLine: 1,
    endLine: 1,
    confidence: 1,
    accessCount: 0,
    lastAccessed: null,
    validationCount: 0,
    outcomeHistory: { successes: 0, failures: 0 },
    ...overrides,
  };
}

describe('call_edge_extractor', () => {
  it('extracts call edges from ts-morph AST', () => {
    const edges = extractCallEdgesFromAst('sample.ts', sampleSource, parsedFunctions, 'ts-morph');
    const simplified = edges.map((edge) => ({
      from: edge.fromName,
      to: edge.toName,
    }));

    expect(simplified).toContainEqual({ from: 'alpha', to: 'beta' });
    expect(simplified).toContainEqual({ from: 'gamma', to: 'alpha' });
    expect(simplified).toContainEqual({ from: 'gamma', to: 'beta' });
  });

  it('returns empty edges for unsupported parsers', () => {
    const edges = extractCallEdgesFromAst('sample.unknown', sampleSource, parsedFunctions, 'unsupported');
    expect(edges).toEqual([]);
  });

  it('resolves call edges when names are unambiguous', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'alpha', name: 'alpha', startLine: 2, endLine: 4 }),
      createFunctionKnowledge({ id: 'beta', name: 'beta', startLine: 6, endLine: 8 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'alpha', fromStartLine: 2, toName: 'beta', callLine: 3 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    expect(resolved).toEqual([{
      fromId: 'alpha',
      toId: 'beta',
      sourceLine: 3,
      targetResolved: true,
      isAmbiguous: false,
      overloadCount: 1,
    }]);
  });

  it('keeps ambiguous call edge targets with ambiguity metadata', () => {
    // Changed behavior: ambiguous edges are now KEPT but marked as ambiguous
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'caller', name: 'caller', startLine: 2, endLine: 4 }),
      createFunctionKnowledge({ id: 'dup-1', name: 'dup', startLine: 10, endLine: 12 }),
      createFunctionKnowledge({ id: 'dup-2', name: 'dup', startLine: 20, endLine: 22 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'caller', fromStartLine: 2, toName: 'dup', callLine: 3 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    expect(resolved).toEqual([{
      fromId: 'caller',
      toId: 'dup-1', // Picks first match
      sourceLine: 3,
      targetResolved: true,
      isAmbiguous: true, // Marked as ambiguous
      overloadCount: 2,
    }]);
  });

  it('uses start line to disambiguate callers', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'dup-1', name: 'dup', startLine: 5, endLine: 7 }),
      createFunctionKnowledge({ id: 'dup-2', name: 'dup', startLine: 15, endLine: 17 }),
      createFunctionKnowledge({ id: 'target', name: 'target', startLine: 25, endLine: 27 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'dup', fromStartLine: 15, toName: 'target', callLine: 16 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    expect(resolved).toEqual([{
      fromId: 'dup-2',
      toId: 'target',
      sourceLine: 16,
      targetResolved: true,
      isAmbiguous: false,
      overloadCount: 1,
    }]);
  });
});

describe('resolveCallEdges ambiguity tracking', () => {
  /**
   * Tests for the enhanced resolveCallEdges that tracks ambiguity and resolution
   * quality for use by the edge confidence computation system.
   *
   * Key scenarios:
   * - targetResolved: Whether the target function was found in the indexed functions
   * - isAmbiguous: Whether multiple overloads could match (callee or caller)
   * - overloadCount: Number of matching functions for the target name
   */

  it('marks edges as resolved when target exists', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'caller', name: 'caller', startLine: 2, endLine: 4 }),
      createFunctionKnowledge({ id: 'target', name: 'target', startLine: 6, endLine: 8 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'caller', fromStartLine: 2, toName: 'target', callLine: 3 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    expect(resolved.length).toBe(1);
    expect(resolved[0].targetResolved).toBe(true);
    expect(resolved[0].isAmbiguous).toBe(false);
    expect(resolved[0].overloadCount).toBe(1);
  });

  it('marks edges as unresolved when target is external/not found', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'caller', name: 'caller', startLine: 2, endLine: 4 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'caller', fromStartLine: 2, toName: 'externalFunction', callLine: 3 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    // External calls should be included but marked as unresolved
    expect(resolved.length).toBe(1);
    expect(resolved[0].targetResolved).toBe(false);
    expect(resolved[0].toId).toBe('external:externalFunction');
  });

  it('marks edges as ambiguous when multiple overloads match', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'caller', name: 'caller', startLine: 2, endLine: 10 }),
      createFunctionKnowledge({ id: 'overload-1', name: 'process', startLine: 15, endLine: 20 }),
      createFunctionKnowledge({ id: 'overload-2', name: 'process', startLine: 25, endLine: 30 }),
      createFunctionKnowledge({ id: 'overload-3', name: 'process', startLine: 35, endLine: 40 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'caller', fromStartLine: 2, toName: 'process', callLine: 5 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    // Ambiguous edges should be included with ambiguity metadata
    expect(resolved.length).toBe(1);
    expect(resolved[0].isAmbiguous).toBe(true);
    expect(resolved[0].overloadCount).toBe(3);
    expect(resolved[0].targetResolved).toBe(true);
    // Should pick first match when ambiguous
    expect(resolved[0].toId).toBe('overload-1');
  });

  it('does not mark as ambiguous when caller is disambiguated by line', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'caller-1', name: 'handler', startLine: 2, endLine: 10 }),
      createFunctionKnowledge({ id: 'caller-2', name: 'handler', startLine: 15, endLine: 25 }),
      createFunctionKnowledge({ id: 'target', name: 'target', startLine: 30, endLine: 35 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'handler', fromStartLine: 15, toName: 'target', callLine: 20 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    expect(resolved.length).toBe(1);
    expect(resolved[0].fromId).toBe('caller-2');
    expect(resolved[0].isAmbiguous).toBe(false);
  });

  it('includes hasSourceLine in resolved edge metadata', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'caller', name: 'caller', startLine: 2, endLine: 4 }),
      createFunctionKnowledge({ id: 'target', name: 'target', startLine: 6, endLine: 8 }),
    ];

    const withLine: ParsedCallEdge[] = [
      { fromName: 'caller', fromStartLine: 2, toName: 'target', callLine: 3 },
    ];
    const withoutLine: ParsedCallEdge[] = [
      { fromName: 'caller', fromStartLine: 2, toName: 'target', callLine: null },
    ];

    const resolvedWithLine = resolveCallEdges(withLine, functions);
    const resolvedWithoutLine = resolveCallEdges(withoutLine, functions);

    expect(resolvedWithLine[0].sourceLine).toBe(3);
    expect(resolvedWithoutLine[0].sourceLine).toBeNull();
  });

  it('produces varying overloadCounts across different edges', () => {
    const functions: FunctionKnowledge[] = [
      createFunctionKnowledge({ id: 'main', name: 'main', startLine: 1, endLine: 20 }),
      createFunctionKnowledge({ id: 'unique', name: 'uniqueFunc', startLine: 25, endLine: 30 }),
      createFunctionKnowledge({ id: 'dup-1', name: 'duplicated', startLine: 35, endLine: 40 }),
      createFunctionKnowledge({ id: 'dup-2', name: 'duplicated', startLine: 45, endLine: 50 }),
    ];
    const parsedEdges: ParsedCallEdge[] = [
      { fromName: 'main', fromStartLine: 1, toName: 'uniqueFunc', callLine: 5 },
      { fromName: 'main', fromStartLine: 1, toName: 'duplicated', callLine: 10 },
    ];

    const resolved = resolveCallEdges(parsedEdges, functions);

    expect(resolved.length).toBe(2);

    const uniqueEdge = resolved.find(e => e.toId === 'unique');
    const dupEdge = resolved.find(e => e.toId?.startsWith('dup'));

    expect(uniqueEdge?.overloadCount).toBe(1);
    expect(uniqueEdge?.isAmbiguous).toBe(false);

    expect(dupEdge?.overloadCount).toBe(2);
    expect(dupEdge?.isAmbiguous).toBe(true);
  });
});
