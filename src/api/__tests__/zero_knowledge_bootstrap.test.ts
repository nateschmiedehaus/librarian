import { describe, it, expect } from 'vitest';
import {
  ZERO_KNOWLEDGE_PROTOCOL,
  createZeroKnowledgeState,
  recordPhaseResult,
  computeEvidenceBasedConfidence,
  reportUnderstanding,
  EpistemicEscalationEngine,
  type KnowledgeClaim,
  type KnowledgeState,
} from '../zero_knowledge_bootstrap.js';

function makeClaim(source: KnowledgeClaim['source'], confidence = 0.7): KnowledgeClaim {
  return {
    claim: `${source} claim`,
    source,
    confidence,
    evidence: `${source} evidence`,
  };
}

function makeState(claims: KnowledgeClaim[], unknowns: string[] = []): KnowledgeState {
  return {
    facts: claims,
    inferences: [],
    unknowns,
    contradictions: [],
  };
}

describe('zero-knowledge bootstrap protocol', () => {
  it('defines the expected phases', () => {
    const names = ZERO_KNOWLEDGE_PROTOCOL.map((phase) => phase.name);
    expect(names).toEqual([
      'structural_inventory',
      'naming_inference',
      'structural_inference',
      'behavioral_probing',
      'semantic_extraction',
      'verification_loop',
    ]);
  });

  it('records phase results and advances the protocol', () => {
    const state = createZeroKnowledgeState();
    const next = recordPhaseResult(state, {
      phase: 'structural_inventory',
      facts: [makeClaim('syntactic')],
    });

    expect(next.currentPhase).toBe(1);
    expect(next.accumulatedKnowledge.facts).toHaveLength(1);
  });

  it('computes evidence-based confidence', () => {
    const empty = computeEvidenceBasedConfidence('claim', []);
    expect(empty.calibrationMethod).toBe('no_evidence');
    expect(empty.confidence).toBe(0.5);

    const combined = computeEvidenceBasedConfidence('claim', [
      { source: 'syntactic', evidence: 'parse', weight: 0.9, reliability: 1 },
      { source: 'structural', evidence: 'graph', weight: 0.6, reliability: 0.5 },
    ]);
    expect(combined.calibrationMethod).toBe('combining_agreement');
    expect(combined.confidence).toBeGreaterThan(0.5);
    expect(combined.confidence).toBeLessThanOrEqual(0.95);

    const contradictory = computeEvidenceBasedConfidence('claim', [
      { source: 'syntactic', evidence: 'parse', weight: 0.5, reliability: 1 },
      { source: 'semantic', evidence: 'summary', weight: -0.5, reliability: 0.7 },
    ]);
    expect(contradictory.calibrationMethod).toBe('contradictory_evidence');
    expect(contradictory.confidence).toBeLessThanOrEqual(0.5);
  });

  it('reports understanding levels', () => {
    const empty = reportUnderstanding(makeState([]));
    expect(empty.level).toBe(0);

    const syntactic = reportUnderstanding(makeState([makeClaim('syntactic')]));
    expect(syntactic.level).toBe(1);

    const naming = reportUnderstanding(makeState([makeClaim('naming')]));
    expect(naming.level).toBe(2);

    const behavioral = reportUnderstanding(makeState([makeClaim('behavioral'), makeClaim('semantic')]));
    expect(behavioral.level).toBe(4);
  });

  it('selects escalation paths based on evidence and unknowns', () => {
    const engine = new EpistemicEscalationEngine({ humanAvailable: false });
    const shallow = makeState([makeClaim('syntactic', 0.3)], ['entry point unknown']);
    const decision = engine.decideEscalation('understand', shallow, 0.9);
    expect(decision.decision).toBe('try_alternative');

    const fullCoverage: KnowledgeState = {
      facts: [
        makeClaim('syntactic', 0.2),
        makeClaim('naming', 0.2),
        makeClaim('structural', 0.2),
        makeClaim('behavioral', 0.2),
        makeClaim('semantic', 0.2),
      ],
      inferences: [],
      unknowns: ['ownership unclear'],
      contradictions: [],
    };
    const askEngine = new EpistemicEscalationEngine({ humanAvailable: true });
    const askDecision = askEngine.decideEscalation('understand', fullCoverage, 0.9);
    expect(askDecision.decision).toBe('ask_human');
  });
});
