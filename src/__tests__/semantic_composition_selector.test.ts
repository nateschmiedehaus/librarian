import { describe, it, expect } from 'vitest';
import { SemanticCompositionSelector } from '../api/composition_selector.js';
import { DEFAULT_TECHNIQUE_COMPOSITIONS } from '../api/technique_compositions.js';

describe('semantic composition selector validation', () => {
  it('returns empty for empty composition list', async () => {
    const selector = new SemanticCompositionSelector({ compositions: [] });
    const matches = await selector.select('Clarify performance issues', {
      maxResults: 3,
      includeAlternatives: false,
      includeIntentEmbedding: false,
    });
    expect(matches).toEqual([]);
  });

  it('rejects invalid intents and bounds', async () => {
    const selector = new SemanticCompositionSelector({ compositions: [] });
    await expect(selector.select('   ', { maxResults: 1 }))
      .rejects.toThrow(/intent_invalid/);
    await expect(selector.select('Valid intent', { minConfidence: 1.2 }))
      .rejects.toThrow(/selection_confidence_invalid/);
    await expect(selector.select('Valid intent', { maxResults: -1 }))
      .rejects.toThrow(/selection_max_results_invalid/);
    await expect(selector.select('Valid intent', { alternativesLimit: -2 }))
      .rejects.toThrow(/selection_alternatives_invalid/);
    const matches = await selector.select('Valid intent', { maxResults: 0 });
    expect(matches).toEqual([]);
  });

  it('rejects recordUsage for unknown compositions', () => {
    const selector = new SemanticCompositionSelector({
      compositions: DEFAULT_TECHNIQUE_COMPOSITIONS.slice(0, 1),
    });
    expect(() => selector.recordUsage('intent', 'tc_missing', { success: true }))
      .toThrow(/composition_unknown/);
  });
});
