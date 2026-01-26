import { describe, it, expect } from 'vitest';
import { ActiveEvidenceEngine, type EvidenceClaim, type EvidenceRecord } from '../evidence_system.js';
import type { Evidence } from '../universal_types.js';

class InMemoryEvidenceStore {
  private claims: EvidenceClaim[];
  private evidenceByClaim: Map<string, EvidenceRecord[]>;

  constructor(claims: EvidenceClaim[], evidence: EvidenceRecord[]) {
    this.claims = claims;
    this.evidenceByClaim = new Map();
    for (const record of evidence) {
      const existing = this.evidenceByClaim.get(record.claimId) ?? [];
      existing.push(record);
      this.evidenceByClaim.set(record.claimId, existing);
    }
  }

  async listClaims(): Promise<EvidenceClaim[]> {
    return this.claims;
  }

  async listEvidenceForClaim(claimId: string): Promise<EvidenceRecord[]> {
    return this.evidenceByClaim.get(claimId) ?? [];
  }

  async updateEvidenceForClaim(claimId: string, evidence: EvidenceRecord[]): Promise<void> {
    this.evidenceByClaim.set(claimId, evidence);
  }
}

describe('ActiveEvidenceEngine', () => {
  it('validates evidence strength with defeater penalties', () => {
    const engine = new ActiveEvidenceEngine({ minEvidenceStrength: 0.8, defeaterPenalty: 0.3 });
    const claim: EvidenceClaim = { id: 'c1', proposition: 'Function is pure' };
    const evidence: Evidence[] = [
      { type: 'code', source: 'file.ts', description: 'Implementation', confidence: 0.9 },
      { type: 'test', source: 'spec.ts', description: 'Unit test', confidence: 0.8 },
    ];

    const baseline = engine.validateEvidence(claim, evidence);
    expect(baseline.supported).toBe(true);
    expect(baseline.effectiveStrength).toBeGreaterThan(0.7);

    const withDefeater = engine.validateEvidence(claim, evidence, [
      { type: 'code_change', description: 'Signature changed', detected: '2024-01-01T00:00:00Z' },
    ]);
    expect(withDefeater.supported).toBe(false);
  });

  it('rejects invalid evidence confidence', () => {
    const engine = new ActiveEvidenceEngine();
    const claim: EvidenceClaim = { id: 'c2', proposition: 'Function returns number' };
    const evidence: Evidence[] = [
      { type: 'code', source: 'file.ts', description: 'Implementation', confidence: 2 },
    ];

    expect(() => engine.validateEvidence(claim, evidence)).toThrow(
      'unverified_by_trace(evidence_invalid_confidence)'
    );
  });

  it('rejects malformed evidence entries', () => {
    const engine = new ActiveEvidenceEngine();
    const claim: EvidenceClaim = { id: 'c2b', proposition: 'Function returns number' };
    const evidence = [null as unknown as Evidence];

    expect(() => engine.validateEvidence(claim, evidence)).toThrow(
      'unverified_by_trace(evidence_invalid_entry)'
    );
  });

  it('rejects unknown evidence types', () => {
    const engine = new ActiveEvidenceEngine();
    const claim: EvidenceClaim = { id: 'c2c', proposition: 'Function returns number' };
    const evidence = [
      {
        type: 'unknown',
        source: 'file.ts',
        description: 'Implementation',
        confidence: 0.8,
      } as unknown as Evidence,
    ];

    expect(() => engine.validateEvidence(claim, evidence)).toThrow(
      'unverified_by_trace(evidence_invalid_type)'
    );
  });

  it('rejects evidence with missing source or description', () => {
    const engine = new ActiveEvidenceEngine();
    const claim: EvidenceClaim = { id: 'c2e', proposition: 'Function returns number' };
    const evidence: Evidence[] = [
      { type: 'code', source: '   ', description: 'Implementation', confidence: 0.8 },
    ];

    expect(() => engine.validateEvidence(claim, evidence)).toThrow(
      'unverified_by_trace(evidence_invalid_entry)'
    );
  });

  it('rejects claims missing required fields', () => {
    const engine = new ActiveEvidenceEngine();
    const claim = { id: '', proposition: '   ' } as EvidenceClaim;

    expect(() => engine.validateEvidence(claim, [])).toThrow(
      'unverified_by_trace(evidence_invalid_claim)'
    );
  });

  it('returns unsupported when evidence is empty', () => {
    const engine = new ActiveEvidenceEngine();
    const claim: EvidenceClaim = { id: 'c2d', proposition: 'Function returns number' };

    const result = engine.validateEvidence(claim, []);
    expect(result.supported).toBe(false);
    expect(result.effectiveStrength).toBe(0);
    expect(result.activeDefeaters).toEqual([]);
  });

  it('updates evidence weights based on outcomes', () => {
    const engine = new ActiveEvidenceEngine({
      weightConfig: { adjustments: { confirmed: 0.1, refuted: -0.2, inconclusive: -0.05 } },
    });
    const evidence: Evidence = {
      type: 'doc',
      source: 'README',
      description: 'Documentation',
      confidence: 0.6,
    };

    const before = engine.getEvidenceWeights().doc;
    engine.updateWeights(evidence, 'confirmed');
    const after = engine.getEvidenceWeights().doc;
    expect(after).toBeGreaterThan(before);

    engine.updateWeights(evidence, 'refuted');
    const refuted = engine.getEvidenceWeights().doc;
    expect(refuted).toBeLessThanOrEqual(after);

    engine.updateWeights(evidence, 'inconclusive');
    const inconclusive = engine.getEvidenceWeights().doc;
    expect(inconclusive).toBeLessThanOrEqual(refuted);
  });

  it('clamps evidence weights to configured bounds', () => {
    const engine = new ActiveEvidenceEngine({
      weightConfig: {
        minWeight: 0.2,
        maxWeight: 0.3,
        adjustments: { confirmed: 0.5, refuted: -0.5, inconclusive: 0 },
      },
      weights: { doc: 0.25 },
    });
    const evidence: Evidence = {
      type: 'doc',
      source: 'README',
      description: 'Documentation',
      confidence: 1,
    };

    engine.updateWeights(evidence, 'confirmed');
    expect(engine.getEvidenceWeights().doc).toBe(0.3);

    engine.updateWeights(evidence, 'refuted');
    expect(engine.getEvidenceWeights().doc).toBe(0.2);
  });

  it('rejects weight updates for unknown evidence types', () => {
    const engine = new ActiveEvidenceEngine();
    const evidence = {
      type: 'unknown',
      source: 'README',
      description: 'Documentation',
      confidence: 0.6,
    } as unknown as Evidence;

    expect(() => engine.updateWeights(evidence, 'confirmed')).toThrow(
      'unverified_by_trace(evidence_invalid_type)'
    );
  });

  it('rejects invalid config values', () => {
    expect(
      () => new ActiveEvidenceEngine({ minEvidenceStrength: -0.1 })
    ).toThrow('unverified_by_trace(evidence_invalid_config)');
    expect(
      () => new ActiveEvidenceEngine({ defeaterPenalty: 2 })
    ).toThrow('unverified_by_trace(evidence_invalid_config)');
  });

  it('applies aging with deterministic decay', async () => {
    const claim: EvidenceClaim = { id: 'c3', proposition: 'Module owns feature' };
    const evidence: EvidenceRecord = {
      claimId: 'c3',
      capturedAt: '2024-01-01T00:00:00Z',
      type: 'doc',
      source: 'docs.md',
      description: 'Architecture doc',
      confidence: 0.9,
    };
    const store = new InMemoryEvidenceStore([claim], [evidence]);
    const engine = new ActiveEvidenceEngine({
      store,
      aging: {
        decayPerDay: 0.1,
        minConfidence: 0.2,
        maxConfidence: 1,
        now: () => new Date('2024-01-11T00:00:00Z'),
      },
    });

    const report = await engine.applyAging();
    expect(report.updatedEvidence).toBe(1);
    const updated = await store.listEvidenceForClaim('c3');
    expect(updated[0].confidence).toBeLessThan(0.9);
    expect(updated[0].confidence).toBeGreaterThanOrEqual(0.2);
  });

  it('rejects invalid evidence timestamps during aging', async () => {
    const claim: EvidenceClaim = { id: 'c3b', proposition: 'Module owns feature' };
    const evidence: EvidenceRecord = {
      claimId: 'c3b',
      capturedAt: 'invalid',
      type: 'doc',
      source: 'docs.md',
      description: 'Architecture doc',
      confidence: 0.9,
    };
    const store = new InMemoryEvidenceStore([claim], [evidence]);
    const engine = new ActiveEvidenceEngine({ store });

    await expect(engine.applyAging()).rejects.toThrow(
      'unverified_by_trace(evidence_invalid_timestamp)'
    );
  });

  it('uses batch updates when available', async () => {
    class BatchStore extends InMemoryEvidenceStore {
      public batchCalls = 0;

      async updateEvidenceBatch(updates: Map<string, EvidenceRecord[]>): Promise<void> {
        this.batchCalls += 1;
        for (const [claimId, records] of updates.entries()) {
          await this.updateEvidenceForClaim(claimId, records);
        }
      }
    }

    const claims: EvidenceClaim[] = [{ id: 'c7', proposition: 'Claim one' }];
    const evidence: EvidenceRecord[] = [
      {
        claimId: 'c7',
        capturedAt: '2024-01-01T00:00:00Z',
        type: 'doc',
        source: 'docs.md',
        description: 'Doc',
        confidence: 0.9,
      },
    ];
    const store = new BatchStore(claims, evidence);
    const engine = new ActiveEvidenceEngine({
      store,
      aging: {
        decayPerDay: 0.1,
        minConfidence: 0.2,
        maxConfidence: 1,
        now: () => new Date('2024-01-11T00:00:00Z'),
      },
    });

    await engine.applyAging();
    expect(store.batchCalls).toBe(1);
  });

  it('surfaces update failures as traceable errors', async () => {
    class FailingStore extends InMemoryEvidenceStore {
      async updateEvidenceForClaim(): Promise<void> {
        throw new Error('simulated store failure');
      }
    }

    const claims: EvidenceClaim[] = [{ id: 'c8', proposition: 'Claim two' }];
    const evidence: EvidenceRecord[] = [
      {
        claimId: 'c8',
        capturedAt: '2024-01-01T00:00:00Z',
        type: 'doc',
        source: 'docs.md',
        description: 'Doc',
        confidence: 0.8,
      },
    ];
    const store = new FailingStore(claims, evidence);
    const engine = new ActiveEvidenceEngine({ store });

    await expect(engine.applyAging()).rejects.toThrow(
      'unverified_by_trace(evidence_store_update_failed)'
    );
  });

  it('detects direct contradictions by polarity', async () => {
    const claims: EvidenceClaim[] = [
      { id: 'c4', proposition: 'Function is pure', subject: { id: 'fn-1' }, polarity: 'affirmative' },
      { id: 'c5', proposition: 'Function is pure', subject: { id: 'fn-1' }, polarity: 'negative' },
    ];
    const store = new InMemoryEvidenceStore(claims, []);
    const engine = new ActiveEvidenceEngine({ store });

    const contradictions = await engine.detectContradictions();
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].claimA.id).toBe('c4');
    expect(contradictions[0].claimB.id).toBe('c5');
  });

  it('detects contradictions for subjectless claims', async () => {
    const claims: EvidenceClaim[] = [
      { id: 'c11', proposition: 'Module is deprecated', polarity: 'affirmative' },
      { id: 'c12', proposition: 'Module is deprecated', polarity: 'negative' },
    ];
    const store = new InMemoryEvidenceStore(claims, []);
    const engine = new ActiveEvidenceEngine({ store });

    const contradictions = await engine.detectContradictions();
    expect(contradictions).toHaveLength(1);
  });

  it('normalizes unicode claim propositions before matching', async () => {
    const composed = 'caf\u00e9';
    const decomposed = 'cafe\u0301';
    const claims: EvidenceClaim[] = [
      { id: 'c9', proposition: composed, subject: { id: 'fn-3' }, polarity: 'affirmative' },
      { id: 'c10', proposition: decomposed, subject: { id: 'fn-3' }, polarity: 'negative' },
    ];
    const store = new InMemoryEvidenceStore(claims, []);
    const engine = new ActiveEvidenceEngine({ store });

    const contradictions = await engine.detectContradictions();
    expect(contradictions).toHaveLength(1);
  });

  it('normalizes unicode subject ids before matching', async () => {
    const composed = 'caf\u00e9';
    const decomposed = 'cafe\u0301';
    const claims: EvidenceClaim[] = [
      { id: 'c13', proposition: 'Module is deprecated', subject: { id: composed }, polarity: 'affirmative' },
      { id: 'c14', proposition: 'Module is deprecated', subject: { id: decomposed }, polarity: 'negative' },
    ];
    const store = new InMemoryEvidenceStore(claims, []);
    const engine = new ActiveEvidenceEngine({ store });

    const contradictions = await engine.detectContradictions();
    expect(contradictions).toHaveLength(1);
  });

  it('skips invalid claims during contradiction checks', async () => {
    const claims: EvidenceClaim[] = [
      { id: 'c6', proposition: '   ', subject: { id: 'fn-2' } },
      { id: 'c15', proposition: 'Module is stable', subject: { id: 'mod-1' }, polarity: 'affirmative' },
      { id: 'c16', proposition: 'Module is stable', subject: { id: 'mod-1' }, polarity: 'negative' },
    ];
    const store = new InMemoryEvidenceStore(claims, []);
    const engine = new ActiveEvidenceEngine({ store });

    const contradictions = await engine.detectContradictions();
    expect(contradictions).toHaveLength(1);
  });
});
