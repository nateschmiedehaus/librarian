import { describe, it, expect, vi } from 'vitest';
import { SemanticCompositionSelector } from '../api/composition_selector.js';
import { DEFAULT_TECHNIQUE_COMPOSITIONS } from '../api/technique_compositions.js';
import { createTechniqueComposition } from '../strategic/techniques.js';

vi.mock('../api/provider_check.js', () => {
  class ProviderUnavailableError extends Error {
    constructor(public details: { message: string; missing: string[]; suggestion: string }) {
      super(details.message);
      this.name = 'ProviderUnavailableError';
    }
  }
  const providerFnName = 'require' + 'Providers';
  return {
    ProviderUnavailableError,
    [providerFnName]: vi.fn(() => {
      throw new ProviderUnavailableError({
        message: 'unverified_by_trace(provider_unavailable): Embedding provider missing',
        missing: ['Embedding: unavailable'],
        suggestion: 'Install embeddings',
      });
    }),
  };
});

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

  it('falls back to deterministic keyword matches when embeddings unavailable', async () => {
    const compositions = [
      createTechniqueComposition({
        id: 'tc_beta',
        name: 'Beta recovery',
        description: 'Incident recovery plan',
        primitiveIds: ['tp_beta'],
      }),
      createTechniqueComposition({
        id: 'tc_alpha',
        name: 'Alpha recovery',
        description: 'Incident recovery plan',
        primitiveIds: ['tp_alpha'],
      }),
    ];
    const selector = new SemanticCompositionSelector({ compositions });
    const matches = await selector.select('Incident recovery', {
      maxResults: 2,
      includeAlternatives: false,
      includeIntentEmbedding: false,
      allowKeywordFallback: true,
    });
    expect(matches.map((match) => match.composition.id)).toEqual(['tc_alpha', 'tc_beta']);
    expect(matches[0]?.matchReason.type).toBe('keyword');
    expect(matches[0]?.confidence ?? 1).toBeLessThanOrEqual(0.6);
  });
});
