/**
 * @fileoverview Claim-boundary confidence guards (Track D Q8).
 *
 * Enforces that epistemic claim confidence uses ConfidenceValue at runtime.
 */

import type { ConfidenceValue } from './confidence.js';
import { assertConfidenceValue, isConfidenceValue } from './confidence.js';
import type { ClaimEvidence, EvidenceEntry } from './evidence_ledger.js';

// ============================================================================
// CLAIM EVIDENCE GUARDS
// ============================================================================

export function isClaimEvidence(value: unknown): value is ClaimEvidence {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.claim !== 'string') return false;
  if (typeof obj.category !== 'string') return false;
  if (!obj.subject || typeof obj.subject !== 'object') return false;
  const subject = obj.subject as Record<string, unknown>;
  if (typeof subject.type !== 'string' || typeof subject.identifier !== 'string') return false;
  if (!Array.isArray(obj.supportingEvidence)) return false;
  if (!Array.isArray(obj.knownDefeaters)) return false;
  if (!isConfidenceValue(obj.confidence)) return false;
  return true;
}

export function assertClaimEvidence(value: unknown, context: string): asserts value is ClaimEvidence {
  if (!value || typeof value !== 'object') {
    throw new Error(`D7_VIOLATION(${context}): Expected ClaimEvidence object.`);
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.claim !== 'string') {
    throw new Error(`D7_VIOLATION(${context}): ClaimEvidence.claim must be string.`);
  }
  if (typeof obj.category !== 'string') {
    throw new Error(`D7_VIOLATION(${context}): ClaimEvidence.category must be string.`);
  }
  if (!obj.subject || typeof obj.subject !== 'object') {
    throw new Error(`D7_VIOLATION(${context}): ClaimEvidence.subject must be object.`);
  }
  const subject = obj.subject as Record<string, unknown>;
  if (typeof subject.type !== 'string' || typeof subject.identifier !== 'string') {
    throw new Error(`D7_VIOLATION(${context}): ClaimEvidence.subject is invalid.`);
  }
  if (!Array.isArray(obj.supportingEvidence)) {
    throw new Error(`D7_VIOLATION(${context}): ClaimEvidence.supportingEvidence must be array.`);
  }
  if (!Array.isArray(obj.knownDefeaters)) {
    throw new Error(`D7_VIOLATION(${context}): ClaimEvidence.knownDefeaters must be array.`);
  }

  // Enforce claim confidence provenance.
  assertConfidenceValue(obj.confidence, `${context}.confidence`);
}

// ============================================================================
// CLAIM BOUNDARY ENFORCEMENT
// ============================================================================

type ClaimBoundaryEntry = Pick<EvidenceEntry, 'kind' | 'payload' | 'confidence'>;

export function assertClaimConfidenceBoundary(
  entry: ClaimBoundaryEntry,
  context = 'claim_boundary'
): asserts entry is ClaimBoundaryEntry & { payload: ClaimEvidence; confidence?: ConfidenceValue } {
  if (entry.kind !== 'claim') return;

  assertClaimEvidence(entry.payload, `${context}.payload`);

  if (entry.confidence !== undefined) {
    assertConfidenceValue(entry.confidence, `${context}.confidence`);
  }
}

export function isClaimBoundaryEntry(
  entry: ClaimBoundaryEntry
): entry is ClaimBoundaryEntry & { payload: ClaimEvidence; confidence?: ConfidenceValue } {
  if (entry.kind !== 'claim') return false;
  if (!isClaimEvidence(entry.payload)) return false;
  if (entry.confidence !== undefined && !isConfidenceValue(entry.confidence)) return false;
  return true;
}

// ============================================================================
// TYPE-LEVEL INVARIANTS (COMPILE-TIME)
// ============================================================================

type ClaimConfidenceRejectsNumber = number extends ClaimEvidence['confidence'] ? false : true;
const _claimConfidenceTypecheck: true = true as ClaimConfidenceRejectsNumber;

type EntryConfidenceRejectsNumber = number extends EvidenceEntry['confidence'] ? false : true;
const _entryConfidenceTypecheck: true = true as EntryConfidenceRejectsNumber;
