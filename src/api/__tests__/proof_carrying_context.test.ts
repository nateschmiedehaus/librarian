import { describe, it, expect } from 'vitest';
import { ProofCarryingRetriever } from '../proof_carrying_context.js';

describe('proof carrying context', () => {
  it('returns proofs for entities with shared terms', async () => {
    const retriever = new ProofCarryingRetriever();
    const results = await retriever.retrieveWithProofs('login flow', [
      { id: 'fn_auth', name: 'loginHandler', description: 'Handles login flow' },
      { id: 'fn_misc', name: 'miscUtility', description: 'Random helpers' },
    ]);

    expect(results.length).toBe(1);
    expect(results[0]?.relevanceProof?.verified).toBe(true);
    expect(results[0]?.entity.id).toBe('fn_auth');
  });

  it('returns proof failure when no overlap exists', async () => {
    const retriever = new ProofCarryingRetriever();
    const result = await retriever.proveRelevance(
      { id: 'fn_misc', name: 'miscUtility', description: 'Random helpers' },
      'encryption key rotation'
    );

    expect('reason' in result && result.reason).toBe('no_overlap');
  });

  it('returns missing query failure when query lacks terms', async () => {
    const retriever = new ProofCarryingRetriever();
    const result = await retriever.proveRelevance(
      { id: 'fn_auth', name: 'loginHandler', description: 'Handles login flow' },
      '  '
    );

    expect('reason' in result && result.reason).toBe('missing_query');
  });
});
