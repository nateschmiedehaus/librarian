import { createContentHash } from '../../core/contracts.js';
import type { KnowledgeMeta } from '../universal_types.js';

export type LlmEvidenceSection = 'semantics' | 'security' | 'rationale' | 'query_synthesis';

export type LlmEvidence = NonNullable<KnowledgeMeta['llmEvidence']>[string];

export async function buildLlmEvidence(options: {
  provider: 'claude' | 'codex';
  modelId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}): Promise<LlmEvidence> {
  const promptDigest = await createContentHash(JSON.stringify(options.messages));
  return {
    provider: options.provider,
    modelId: options.modelId,
    promptDigest,
    timestamp: new Date().toISOString(),
  };
}
