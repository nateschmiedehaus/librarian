import { describe, it, expect } from 'vitest';
import { __testing, buildLearningSignalMap } from '../composition_selector.js';

describe('composition selector learning signals', () => {
  it('builds learning signal map from recommendations', () => {
    const recommendations = {
      suggestedCompositions: [
        {
          compositionId: 'tc_a',
          score: 0.72,
          successRate: 0.9,
          examples: 12,
        },
      ],
      effectivePrimitives: [],
      reliableContextSources: [],
      warningsFromHistory: [],
    };

    const signals = buildLearningSignalMap(recommendations);
    expect(signals.tc_a.successRate).toBe(0.9);
    expect(signals.tc_a.examples).toBe(12);
  });

  it('computes learning boost based on success rate and evidence', () => {
    const positive = __testing.computeLearningBoost({
      score: 0.7,
      successRate: 0.9,
      examples: 12,
    }, 0.2);
    const negative = __testing.computeLearningBoost({
      score: 0.4,
      successRate: 0.1,
      examples: 12,
    }, 0.2);

    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeLessThan(0);
  });
});
