import { describe, it, expect } from 'vitest';
import {
  buildEvidenceSummary,
  renderStatusBlock,
  renderValidationBlock,
  applyAutogenBlock,
  reconcileGates,
  type EvidenceManifestSummary,
} from '../evidence_reconciliation.js';

const BASE_MANIFEST: EvidenceManifestSummary = {
  generatedAt: '2026-02-02T00:00:00.000Z',
  metrics: {
    retrievalRecallAt5: { mean: 0.82, target: 0.8, met: true },
    contextPrecision: { mean: 0.74, target: 0.7, met: true },
    hallucinationRate: { mean: 0.03, target: 0.05, met: true },
    faithfulness: { mean: 0.87, target: 0.85, met: true },
    answerRelevancy: { mean: 0.79, target: 0.75, met: true },
  },
  ab: {
    lift: 0.2083333333,
    pValue: 0.0945,
    targetLift: 0.2,
    significant: false,
  },
  performance: {
    p50LatencyMs: 0,
    p99LatencyMs: 1,
    memoryPerKLOC: 222.78,
    targetMemoryPerKLOC: 50,
  },
  scenarios: {
    total: 30,
    passing: 30,
    failing: 0,
  },
};

describe('evidence reconciliation summaries', () => {
  it('builds a status block with explicit MET/NOT MET markers', () => {
    const summary = buildEvidenceSummary(BASE_MANIFEST);
    const block = renderStatusBlock(summary);
    expect(block).toContain('Retrieval Recall@5');
    expect(block).toContain('Memory per 1K LOC');
    expect(block).toContain('NOT MET');
    expect(block).toContain('p-value');
  });

  it('builds a validation block that reflects scenario coverage', () => {
    const summary = buildEvidenceSummary(BASE_MANIFEST);
    const block = renderValidationBlock(summary);
    expect(block).toContain('Scenario Families');
    expect(block).toContain('30/30');
  });

  it('replaces autogen blocks between markers', () => {
    const content = [
      'Header',
      '<!-- EVIDENCE_AUTOGEN_START -->',
      'old',
      '<!-- EVIDENCE_AUTOGEN_END -->',
      'Footer',
    ].join('\n');
    const updated = applyAutogenBlock(content, 'EVIDENCE_AUTOGEN', 'new block');
    expect(updated).toContain('new block');
    expect(updated).not.toContain('old');
  });

  it('updates gates validation status from summary', () => {
    const summary = buildEvidenceSummary(BASE_MANIFEST);
    const gates = {
      lastUpdated: 'old',
      validationStatus: {
        blockingMetrics: {},
      },
    };
    const updated = reconcileGates(gates, summary);
    expect(updated.lastUpdated).toBe(summary.generatedAt);
    expect(updated.validationStatus.blockingMetrics).toHaveProperty('Retrieval Recall@5');
  });
});
