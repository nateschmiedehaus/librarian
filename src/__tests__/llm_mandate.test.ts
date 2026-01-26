import { describe, it, expect } from 'vitest';
import { createEmptyKnowledge } from '../knowledge/universal_types.js';
import { collectEvidence } from '../knowledge/extractors/evidence_collector.js';
import { extractRationale } from '../knowledge/extractors/rationale_extractor.js';

describe('LLM mandate enforcement (Tier-0)', () => {
  it('records llmEvidence for semantic sections when provided', () => {
    const knowledge = createEmptyKnowledge('id', 'name', 'function', '/tmp/file.ts', 1);
    const llmEvidence = {
      provider: 'codex' as const,
      modelId: 'gpt-5.1-codex-mini',
      promptDigest: 'deadbeef',
      timestamp: new Date().toISOString(),
    };

    const result = collectEvidence({
      entityId: 'id',
      entityName: 'name',
      filePath: '/tmp/file.ts',
      contentHash: 'hash',
      semantics: { semantics: knowledge.semantics, confidence: 0.9, llmEvidence },
      rationale: { rationale: knowledge.rationale, confidence: 0.8, llmEvidence },
      security: { security: knowledge.security, confidence: 0.8, llmEvidence },
      generatedBy: 'test',
    });

    expect(result.meta.llmEvidence?.semantics).toEqual(llmEvidence);
    expect(result.meta.llmEvidence?.rationale).toEqual(llmEvidence);
    expect(result.meta.llmEvidence?.security).toEqual(llmEvidence);
  });

  it('marks semantic understanding as unverified when llmEvidence is missing', () => {
    const knowledge = createEmptyKnowledge('id', 'name', 'function', '/tmp/file.ts', 1);
    const result = collectEvidence({
      entityId: 'id',
      entityName: 'name',
      filePath: '/tmp/file.ts',
      contentHash: 'hash',
      semantics: { semantics: knowledge.semantics, confidence: 0.9 },
      generatedBy: 'test',
    });
    expect(result.meta.defeaters.some((d) => d.description.includes('Missing LLM evidence'))).toBe(true);
  });

  it('forbids heuristic-only rationale extraction entrypoint', async () => {
    await expect(extractRationale({
      filePath: '/tmp/file.ts',
      workspaceRoot: '/tmp',
      content: 'x',
    })).rejects.toThrow(/unverified_by_trace\(rationale_llm_required\)/);
  });
});

