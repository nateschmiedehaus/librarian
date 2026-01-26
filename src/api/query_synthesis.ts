import type { ContextPack, LibrarianQuery } from '../types.js';
import type { LibrarianStorage } from '../storage/types.js';
import { resolveLlmServiceAdapter } from '../adapters/llm_service.js';
import { resolveLibrarianModelConfigWithDiscovery } from './llm_env.js';
import { requireProviders } from './provider_check.js';
import { createHash } from 'crypto';

// Helpers

/** Generate a unique query ID for feedback tracking */
function generateQueryId(query: LibrarianQuery): string {
  const timestamp = Date.now();
  const queryHash = createHash('sha256')
    .update(query.intent + (query.taskType ?? '') + timestamp.toString())
    .digest('hex')
    .substring(0, 8);
  return `query-${timestamp}-${queryHash}`;
}

// Types

export interface QuerySynthesisInput {
  query: LibrarianQuery;
  packs: ContextPack[];
  storage: LibrarianStorage;
  workspace: string;
}

export interface SynthesizedAnswer {
  /** Unique query ID for feedback reference */
  queryId: string;

  /** The synthesized understanding */
  answer: string;

  /** Confidence in the synthesis (0-1) */
  confidence: number;

  /** Citations to evidence that supports the answer */
  citations: Citation[];

  /** Key insights extracted during synthesis */
  keyInsights: string[];

  /** Gaps or uncertainties identified */
  uncertainties: string[];

  /** Whether synthesis was successful */
  synthesized: true;
}

export interface Citation {
  /** Pack ID this citation comes from */
  packId: string;

  /** Specific fact or snippet being cited */
  content: string;

  /** Relevance score (0-1) */
  relevance: number;

  /** File path if applicable */
  file?: string;

  /** Line number if applicable */
  line?: number;
}

export interface SynthesisFailure {
  synthesized: false;
  reason: string;
  fallbackHints: string[];
}

export type QuerySynthesisResult = SynthesizedAnswer | SynthesisFailure;

// Synthesis implementation

/**
 * Synthesize an understanding from retrieved knowledge.
 *
 * MANDATORY: This function requires LLM. There is no heuristic fallback.
 * If LLM is unavailable, it throws ProviderUnavailableError.
 */
export async function synthesizeQueryAnswer(
  input: QuerySynthesisInput
): Promise<QuerySynthesisResult> {
  const { query, packs, storage } = input;

  // Generate query ID for feedback tracking
  const queryId = generateQueryId(query);

  // Check LLM availability - MANDATORY
  await requireProviders({ llm: true, embedding: false });
  const llmConfig = await resolveLibrarianModelConfigWithDiscovery();

  // No packs = no knowledge to synthesize from
  if (!packs.length) {
    return {
      synthesized: false,
      reason: 'No relevant knowledge found for query',
      fallbackHints: [
        'Try a more specific query',
        'Ensure the codebase has been indexed',
        'Check if the topic exists in the codebase',
      ],
    };
  }

  // Extract knowledge from packs
  const knowledge = extractKnowledgeForSynthesis(packs);

  // Build synthesis prompt
  const prompt = buildSynthesisPrompt(query, knowledge);

  // Call LLM for synthesis
  try {
    const llmService = resolveLlmServiceAdapter();

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    const response = await llmService.chat({
      provider: llmConfig.provider,
      modelId: llmConfig.modelId,
      messages,
      maxTokens: 2000,
    });
    try {
      return parseSynthesisResponse(response.content, packs, queryId);
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      if (!message.includes('unverified_by_trace(synthesis_')) {
        throw parseError;
      }
      const repairMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: SYNTHESIS_REPAIR_SYSTEM_PROMPT },
        { role: 'user', content: `Fix this into strict JSON only (no prose):\n\n${response.content}` },
      ];
      try {
        const repaired = await llmService.chat({
          provider: llmConfig.provider,
          modelId: llmConfig.modelId,
          messages: repairMessages,
          maxTokens: 1200,
        });
        return parseSynthesisResponse(repaired.content, packs, queryId);
      } catch (repairError) {
        return coerceUnstructuredSynthesis(response.content, repairError, queryId);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Re-throw provider errors
    if (message.includes('unverified_by_trace')) {
      throw error;
    }

    // Wrap other errors
    throw new Error(
      `unverified_by_trace(synthesis_failed): LLM synthesis failed: ${message}`
    );
  }
}

// Knowledge extraction

interface ExtractedKnowledge {
  purposes: Array<{ summary: string; packId: string; file?: string }>;
  mechanisms: Array<{ explanation: string; packId: string; file?: string }>;
  relationships: Array<{ description: string; packId: string }>;
  keyFacts: Array<{ fact: string; packId: string; file?: string }>;
  files: string[];
}

function extractKnowledgeForSynthesis(packs: ContextPack[]): ExtractedKnowledge {
  const purposes: ExtractedKnowledge['purposes'] = [];
  const mechanisms: ExtractedKnowledge['mechanisms'] = [];
  const relationships: ExtractedKnowledge['relationships'] = [];
  const keyFacts: ExtractedKnowledge['keyFacts'] = [];
  const fileSet = new Set<string>();

  for (const pack of packs) {
    // Extract from summary (often contains purpose)
    if (pack.summary) {
      purposes.push({
        summary: pack.summary,
        packId: pack.packId,
        file: pack.relatedFiles[0],
      });
    }

    // Extract key facts
    for (const fact of pack.keyFacts) {
      keyFacts.push({
        fact,
        packId: pack.packId,
        file: pack.relatedFiles[0],
      });
    }

    // Collect files
    for (const file of pack.relatedFiles) {
      fileSet.add(file);
    }

    // Extract relationships from pack type
    if (pack.packType === 'change_impact' || pack.packType === 'pattern_context') {
      relationships.push({
        description: `${pack.packType}: ${pack.summary}`,
        packId: pack.packId,
      });
    }
  }

  return {
    purposes,
    mechanisms,
    relationships,
    keyFacts,
    files: Array.from(fileSet),
  };
}

// Prompt construction

const SYNTHESIS_SYSTEM_PROMPT = `You are a code understanding expert. Your task is to synthesize knowledge from retrieved code context into a clear, accurate answer.

CRITICAL REQUIREMENTS:
1. Only make claims supported by the provided evidence
2. Cite specific sources for each claim
3. Acknowledge gaps and uncertainties
4. Use precise technical language
5. Structure your answer for clarity

Output JSON with this structure:
{
  "answer": "Your synthesized understanding",
  "keyInsights": ["Key insight 1", "Key insight 2"],
  "citations": [
    {"packId": "...", "content": "specific evidence", "relevance": 0.9}
  ],
  "uncertainties": ["Any gaps or unclear areas"],
  "confidence": 0.85
}

The confidence should reflect:
- How well the evidence supports the answer (primary factor)
- How complete the coverage is
- Whether there are conflicting signals`;

const SYNTHESIS_REPAIR_SYSTEM_PROMPT = `You are a strict JSON formatter.
Return ONLY a single valid JSON object. Do not include markdown fences. Keys must be double-quoted. No trailing commas.`;

function buildSynthesisPrompt(
  query: LibrarianQuery,
  knowledge: ExtractedKnowledge
): string {
  const parts: string[] = [];

  parts.push(`QUERY: ${query.intent}`);
  parts.push('');

  if (query.taskType) {
    parts.push(`TASK CONTEXT: ${query.taskType}`);
    parts.push('');
  }

  parts.push('RETRIEVED KNOWLEDGE:');
  parts.push('');

  // Purposes
  if (knowledge.purposes.length) {
    parts.push('## Purpose Summaries');
    for (const p of knowledge.purposes.slice(0, 8)) {
      const fileRef = p.file ? ` (${p.file})` : '';
      parts.push(`- [${p.packId}]${fileRef}: ${p.summary}`);
    }
    parts.push('');
  }

  // Key facts
  if (knowledge.keyFacts.length) {
    parts.push('## Key Facts');
    for (const f of knowledge.keyFacts.slice(0, 15)) {
      const fileRef = f.file ? ` (${f.file})` : '';
      parts.push(`- [${f.packId}]${fileRef}: ${f.fact}`);
    }
    parts.push('');
  }

  // Relationships
  if (knowledge.relationships.length) {
    parts.push('## Relationships');
    for (const r of knowledge.relationships.slice(0, 6)) {
      parts.push(`- [${r.packId}]: ${r.description}`);
    }
    parts.push('');
  }

  // Files
  if (knowledge.files.length) {
    parts.push('## Related Files');
    parts.push(knowledge.files.slice(0, 10).join(', '));
    parts.push('');
  }

  parts.push('Based on this evidence, synthesize a comprehensive answer to the query.');
  parts.push('Include citations and acknowledge any gaps.');

  return parts.join('\n');
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

function parseSynthesisResponse(
  response: string,
  packs: ContextPack[],
  queryId: string
): QuerySynthesisResult {
  const trimmed = response.trim();
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('unverified_by_trace(synthesis_invalid_response): LLM response contained no JSON');
  }

  let parsed: {
    answer?: string;
    keyInsights?: string[];
    citations?: Array<{ packId?: string; content?: string; relevance?: number }>;
    uncertainties?: string[];
    confidence?: number;
  };

  parsed = parsePossiblyLooseJson(jsonMatch[0]);

  // Validate required fields
  if (!parsed.answer || typeof parsed.answer !== 'string') {
    throw new Error(
      'unverified_by_trace(synthesis_missing_answer): Synthesis response missing answer field'
    );
  }

  // Build pack lookup for validation
  const packIds = new Set(packs.map((p) => p.packId));

  // Validate and filter citations
  const citations: Citation[] = (parsed.citations || [])
    .filter((c) => c.packId && c.content && packIds.has(c.packId))
    .map((c) => ({
      packId: c.packId!,
      content: c.content!,
      relevance: typeof c.relevance === 'number' ? Math.min(1, Math.max(0, c.relevance)) : 0.7,
    }));

  // Validate confidence
  const confidence = typeof parsed.confidence === 'number'
    ? Math.min(1, Math.max(0, parsed.confidence))
    : estimateConfidence(citations, packs);

  return {
    queryId,
    synthesized: true,
    answer: parsed.answer || trimmed,
    confidence,
    citations,
    keyInsights: Array.isArray(parsed.keyInsights)
      ? parsed.keyInsights.filter((i): i is string => typeof i === 'string')
      : [],
    uncertainties: Array.isArray(parsed.uncertainties)
      ? parsed.uncertainties.filter((u): u is string => typeof u === 'string')
      : [],
  };
}

function parsePossiblyLooseJson(input: string): { answer?: string; keyInsights?: string[]; citations?: Array<{ packId?: string; content?: string; relevance?: number }>; uncertainties?: string[]; confidence?: number } {
  try { return JSON.parse(input); } catch {}
  const normalized = input
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  try { return JSON.parse(normalized); } catch (parseError) {
    throw new Error(`unverified_by_trace(synthesis_parse_failed): Failed to parse synthesis JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

function coerceUnstructuredSynthesis(text: string, error: unknown, queryId: string): QuerySynthesisResult {
  const answer = String(text ?? '').trim();
  if (!answer) throw error instanceof Error ? error : new Error(String(error));
  const message = error instanceof Error ? error.message : String(error);
  return { queryId, synthesized: true, answer, confidence: 0.25, citations: [], keyInsights: [], uncertainties: [`unverified_by_trace(synthesis_unstructured): ${message}`] };
}

/**
 * Estimate confidence when LLM doesn't provide one.
 * Uses geometric mean of citation relevances as per VISION confidence model.
 */
function estimateConfidence(citations: Citation[], packs: ContextPack[]): number {
  if (!citations.length) return 0.3;

  // Geometric mean of citation relevances
  const product = citations.reduce((acc, c) => acc * Math.max(0.01, c.relevance), 1);
  const geometricMean = Math.pow(product, 1 / citations.length);

  // Factor in coverage (how many packs were cited)
  const citedPacks = new Set(citations.map((c) => c.packId));
  const coverageRatio = packs.length > 0 ? citedPacks.size / packs.length : 0;

  // Weighted combination
  const confidence = geometricMean * 0.7 + coverageRatio * 0.3;

  return Math.min(0.95, Math.max(0.1, confidence));
}

// ============================================================================
// OPTIONAL: Quick synthesis for simple queries
// ============================================================================

/**
 * Check if a query can be answered from pack summaries alone.
 * Used to skip full LLM synthesis for straightforward lookups.
 */
export function canAnswerFromSummaries(
  query: LibrarianQuery,
  packs: ContextPack[]
): boolean {
  if (!packs.length) return false;

  // Simple "what does X do" queries can often be answered from summaries
  const intent = query.intent?.toLowerCase() || '';
  const isSimplePurposeQuery =
    intent.startsWith('what does') ||
    intent.startsWith('what is') ||
    intent.includes('purpose of');

  if (!isSimplePurposeQuery) return false;

  // Check if we have high-confidence packs with clear summaries
  const goodPacks = packs.filter(
    (p) => p.confidence >= 0.7 && p.summary && p.summary.length > 20
  );

  return goodPacks.length >= 1;
}

/**
 * Create a quick answer from pack summaries without full LLM synthesis.
 * Only use when canAnswerFromSummaries returns true.
 */
export function createQuickAnswer(
  query: LibrarianQuery,
  packs: ContextPack[]
): SynthesizedAnswer {
  const topPack = packs
    .filter((p) => p.summary && p.summary.length > 10)
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!topPack) {
    throw new Error('No suitable pack for quick answer');
  }

  const queryId = generateQueryId(query);

  return {
    queryId,
    synthesized: true,
    answer: topPack.summary,
    confidence: Math.min(0.7, topPack.confidence), // Cap at 0.7 for quick answers
    citations: [
      {
        packId: topPack.packId,
        content: topPack.summary,
        relevance: 0.9,
        file: topPack.relatedFiles[0],
      },
    ],
    keyInsights: topPack.keyFacts.slice(0, 3),
    uncertainties: ['Answer derived from pack summary without full LLM synthesis'],
  };
}
