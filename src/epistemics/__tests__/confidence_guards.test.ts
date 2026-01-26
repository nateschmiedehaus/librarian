/**
 * @fileoverview Tier-0 tests for claim-boundary confidence guards.
 */

import { describe, it, expect } from 'vitest';
import type { ClaimEvidence, EvidenceEntry } from '../evidence_ledger.js';
import {
  assertClaimConfidenceBoundary,
  assertClaimEvidence,
  isClaimEvidence,
  isClaimBoundaryEntry,
} from '../confidence_guards.js';
import { deterministic, bounded } from '../confidence.js';

const buildClaimPayload = (): ClaimEvidence => ({
  claim: 'Test claim',
  category: 'behavior',
  subject: {
    type: 'function',
    identifier: 'testFn',
  },
  supportingEvidence: [],
  knownDefeaters: [],
  confidence: deterministic(true, 'test'),
});

const buildClaimEntry = (): EvidenceEntry => ({
  id: 'ev_claim',
  timestamp: new Date(),
  kind: 'claim',
  payload: buildClaimPayload(),
  provenance: { source: 'llm_synthesis', method: 'test' },
  relatedEntries: [],
  confidence: bounded(0.8, 0.9, 'theoretical', 'test'),
});

describe('confidence guards', () => {
  it('accepts valid claim evidence at the boundary', () => {
    const entry = buildClaimEntry();
    expect(() => assertClaimConfidenceBoundary(entry, 'test')).not.toThrow();
    expect(isClaimBoundaryEntry(entry)).toBe(true);
    expect(isClaimEvidence(entry.payload)).toBe(true);
  });

  it('rejects raw numeric confidence in claim payload', () => {
    const rawPayload = {
      ...buildClaimPayload(),
      confidence: 0.7,
    } as unknown as ClaimEvidence;

    expect(() => assertClaimEvidence(rawPayload, 'test_payload')).toThrow(/D7_VIOLATION/);
    expect(isClaimEvidence(rawPayload)).toBe(false);
  });

  it('rejects raw numeric confidence on entry', () => {
    const entry = {
      ...buildClaimEntry(),
      confidence: 0.3,
    } as unknown as EvidenceEntry;

    expect(() => assertClaimConfidenceBoundary(entry, 'test_entry')).toThrow(/D7_VIOLATION/);
    expect(isClaimBoundaryEntry(entry)).toBe(false);
  });

  it('skips validation for non-claim entries', () => {
    const entry: EvidenceEntry = {
      id: 'ev_nonclaim',
      timestamp: new Date(),
      kind: 'extraction',
      payload: {
        filePath: '/test.ts',
        extractionType: 'function',
        entity: { name: 'test', kind: 'function', location: { file: '/test.ts' } },
        quality: 'ast_verified',
      },
      provenance: { source: 'ast_parser', method: 'test' },
      relatedEntries: [],
    };

    expect(() => assertClaimConfidenceBoundary(entry, 'test_nonclaim')).not.toThrow();
  });
});
