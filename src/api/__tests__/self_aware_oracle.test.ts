import { describe, it, expect } from 'vitest';
import { TuringOracleClassifier } from '../self_aware_oracle.js';

describe('self-aware oracle classifier', () => {
  it('classifies termination questions with loops as formally undecidable', async () => {
    const classifier = new TuringOracleClassifier();
    const result = await classifier.classify('Will this function terminate on all inputs?', [
      {
        type: 'function',
        name: 'loopForever',
        content: 'function loopForever() { while (true) { doWork(); } }',
      },
    ]);

    expect(result.classification).toBe('formally_undecidable');
    expect(result.reduction?.targetProblem).toBe('halting');
  });

  it('classifies existence questions as decidable', async () => {
    const classifier = new TuringOracleClassifier();
    const result = await classifier.classify('Does this file contain the keyword export?', [
      {
        type: 'file',
        name: 'sample.ts',
        content: 'export function example() {}',
      },
    ]);

    expect(result.classification).toBe('decidable');
    expect(result.algorithm).toContain('static scan');
  });

  it('classifies complexity questions as practically undecidable', async () => {
    const classifier = new TuringOracleClassifier();
    const result = await classifier.classify('What is the worst-case time complexity?', [
      {
        type: 'function',
        name: 'sortIt',
        content: 'function sortIt(items) { return items.sort(); }',
      },
    ]);

    expect(result.classification).toBe('practically_undecidable');
    expect(result.resourceBounds?.timeComplexity).toContain('super-polynomial');
  });

  it('defaults to oracle-dependent for ambiguous questions', async () => {
    const classifier = new TuringOracleClassifier();
    const result = await classifier.classify('Should we refactor this?');

    expect(result.classification).toBe('oracle_dependent');
  });

  it('returns an uncalibrated uncertainty estimate', async () => {
    const classifier = new TuringOracleClassifier();
    const estimate = await classifier.estimateOracleUncertainty('Is this refactor safe?');

    expect(estimate.confidenceInterval[0]).toBeLessThan(estimate.confidenceInterval[1]);
    expect(estimate.calibrationBasis).toContain('unverified_by_trace');
  });
});
