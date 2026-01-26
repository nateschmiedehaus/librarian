import { describe, it, expect } from 'vitest';
import {
  analyzeVectorRedundancy,
  type MultiVector,
} from '../embedding_providers/multi_vector_representations.js';

const baseVector: Pick<MultiVector, 'filePath' | 'lastUpdated' | 'modelId'> = {
  filePath: 'src/example.ts',
  lastUpdated: 0,
  modelId: 'all-MiniLM-L6-v2',
};

function makeVector(overrides: Partial<MultiVector>): MultiVector {
  return { ...baseVector, ...overrides } as MultiVector;
}

describe('vector redundancy analysis', () => {
  it('detects redundant pairs when vectors match', () => {
    const identical = new Float32Array([1, 0]);
    const orthogonal = new Float32Array([0, 1]);

    const samples = [
      makeVector({
        purpose: identical,
        semantic: identical,
        structural: orthogonal,
        dependency: orthogonal,
        usage: orthogonal,
      }),
    ];

    const analysis = analyzeVectorRedundancy(samples, 0.95);
    const correlation = analysis.correlations.get('purpose|semantic');

    expect(correlation).toBeDefined();
    expect(correlation).toBeGreaterThan(0.99);
    expect(analysis.redundantPairs).toContainEqual(['purpose', 'semantic']);
    expect(analysis.recommendation).toBe('drop_redundant');
  });

  it('returns keep_all when no pairs exceed threshold', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);

    const samples = [
      makeVector({
        purpose: a,
        semantic: b,
        structural: a,
        dependency: b,
        usage: a,
      }),
    ];

    const analysis = analyzeVectorRedundancy(samples, 0.99);

    expect(analysis.redundantPairs.length).toBe(0);
    expect(analysis.recommendation).toBe('keep_all');
  });
});
