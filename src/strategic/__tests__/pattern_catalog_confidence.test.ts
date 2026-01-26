import { describe, it, expect } from 'vitest';
import { createCompositionPattern, type CompositionPatternInput } from '../../api/pattern_catalog.js';
import { absent, deterministic, type ConfidenceValue } from '../../epistemics/confidence.js';

const basePattern: CompositionPatternInput = {
  id: 'pattern_confidence_test',
  name: 'Pattern Confidence Test',
  archetype: 'analysis',
  situations: [
    {
      trigger: 'Need to validate confidence inputs',
      context: ['test'],
      confidence: deterministic(true, 'test'),
      examples: ['Validate confidence types'],
    },
  ],
  corePrimitives: ['tp_hypothesis'],
};

describe('pattern catalog confidence', () => {
  it('accepts ConfidenceValue inputs', () => {
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        situations: [
          {
            ...basePattern.situations[0],
            confidence: absent('uncalibrated'),
          },
        ],
      })
    ).not.toThrow();
  });

  it('rejects raw numeric confidence values', () => {
    const numeric = 0.5 as unknown as ConfidenceValue;
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        situations: [
          {
            ...basePattern.situations[0],
            confidence: numeric,
          },
        ],
      })
    ).toThrow(/D7_VIOLATION/);
  });
});
