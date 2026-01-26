import { describe, it, expect } from 'vitest';
import { checkAllProviders } from '../api/provider_check.js';
import { SemanticCompositionSelector } from '../api/composition_selector.js';
import { DEFAULT_TECHNIQUE_COMPOSITIONS } from '../api/technique_compositions.js';

describe('semantic composition selector (integration)', () => {
  it('selects performance composition for matching intent', async (ctx) => {
    const status = await checkAllProviders({ workspaceRoot: process.cwd() });
    ctx.skip(
      !status.embedding.available,
      `unverified_by_trace(provider_unavailable): Embedding: ${status.embedding.error ?? 'unavailable'}`
    );

    const selector = new SemanticCompositionSelector({
      compositions: DEFAULT_TECHNIQUE_COMPOSITIONS,
    });
    const matches = await selector.select('Profile, diagnose, and validate performance bottlenecks.', {
      maxResults: 3,
      minConfidence: 0.1,
      includeAlternatives: false,
      includeIntentEmbedding: false,
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.composition.id).toBe('tc_performance_reliability');
    expect(matches[0]?.matchReason.type).toBe('semantic');
  });
});
