/**
 * @fileoverview Citation accuracy tests for eval runner.
 */

import { describe, it, expect } from 'vitest';
import { computeCitationAccuracy } from '../citation_accuracy.js';

describe('computeCitationAccuracy', () => {
  it('scores citations against evidence references', () => {
    const result = computeCitationAccuracy({
      evidenceRefs: [
        {
          refId: 'ref-1',
          path: 'src/app.ts',
          location: { startLine: 10, endLine: 20 },
        },
        {
          refId: 'ref-2',
          path: 'src/util.ts',
          location: { startLine: 1, endLine: 5 },
        },
      ],
      citations: [
        'ref-1',
        'src/app.ts:15',
        'src/app.ts:25',
        'src/util.ts#L3-L4',
        'missing.ts:1',
      ],
    });

    expect(result.validCitations).toBe(3);
    expect(result.totalCitations).toBe(5);
    expect(result.accuracy).toBeCloseTo(0.6, 5);
  });

  it('accepts structured citations with file and line', () => {
    const result = computeCitationAccuracy({
      evidenceRefs: [
        {
          refId: 'alpha',
          path: 'src/alpha.ts',
          location: { startLine: 2, endLine: 4 },
        },
      ],
      citations: [
        { file: 'src/alpha.ts', line: 3 },
        { file: 'src/alpha.ts', line: 10 },
      ],
    });

    expect(result.validCitations).toBe(1);
    expect(result.accuracy).toBeCloseTo(0.5, 5);
  });
});
