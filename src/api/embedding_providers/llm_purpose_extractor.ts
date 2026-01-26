/**
 * @fileoverview LLM-Based Purpose Extraction
 *
 * Uses Claude/Codex to extract semantic purpose from code files.
 * This provides much higher quality semantic understanding than
 * embeddings alone can achieve.
 *
 * MODEL SELECTION STRATEGY:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     MODEL TIERS                                 │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  TIER 1: Haiku 4.5 (cheap, fast)                               │
 * │     • Purpose extraction at scale                               │
 * │     • $0.25/M input - can process entire codebase               │
 * │     • Good for batch indexing                                   │
 * │                                                                 │
 * │  TIER 2: Sonnet 4.5 (balanced)                                 │
 * │     • Complex semantic understanding                            │
 * │     • Adversarial case resolution                               │
 * │     • Relationship inference                                    │
 * │                                                                 │
 * │  TIER 3: Codex (code-specialized)                              │
 * │     • API compatibility analysis                                │
 * │     • Deep code understanding                                   │
 * │     • Migration suggestions                                     │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * CACHING:
 * - Purpose extraction is cached in SQLite
 * - Re-extracted only when file content changes
 * - Cache key: file path + content hash
 */

import * as crypto from 'crypto';
import { resolveLlmServiceAdapter } from '../../adapters/llm_service.js';
import { requireProviders } from '../provider_check.js';
import { resolveLibrarianModelConfigWithDiscovery, resolveLibrarianModelId } from '../llm_env.js';

// ============================================================================
// TYPES
// ============================================================================

export type PurposeExtractionModel =
  | 'haiku-4.5'      // Fast, cheap - good for batch
  | 'sonnet-4.5'     // Balanced - good for complex cases
  | 'codex-low'      // Code-specialized, low cost
  | 'codex-medium';  // Code-specialized, better quality

export interface ExtractedPurpose {
  /** One-sentence purpose description */
  purpose: string;
  /** Key responsibilities (2-5 items) */
  responsibilities: string[];
  /** Primary domain/category */
  domain: string;
  /** Complexity assessment */
  complexity: 'simple' | 'moderate' | 'complex';
  /** Key concepts/patterns used */
  concepts: string[];
  /** Suggested related concerns */
  relatedTo: string[];
  /** Model used for extraction */
  model: PurposeExtractionModel;
  /** Extraction timestamp */
  extractedAt: number;
  /** Content hash for cache validation */
  contentHash: string;
}

export interface ExtractionOptions {
  /** Model to use */
  model?: PurposeExtractionModel;
  /** Include code snippets in response */
  includeSnippets?: boolean;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Temperature (0 = deterministic) */
  temperature?: number;
  /** Allow heuristic fallback if LLM is unavailable */
  allowHeuristics?: boolean;
}

export interface ExtractionResult {
  purpose: ExtractedPurpose;
  rawResponse: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  latencyMs: number;
}

// ============================================================================
// PROMPTS
// ============================================================================

const PURPOSE_EXTRACTION_PROMPT = `Analyze this code file and extract its semantic purpose.

Respond in JSON format with these fields:
- purpose: One-sentence description of what this file does (max 100 chars)
- responsibilities: Array of 2-5 key responsibilities
- domain: Primary domain (e.g., "authentication", "database", "UI", "testing", "utilities")
- complexity: "simple" | "moderate" | "complex"
- concepts: Array of key programming concepts/patterns used
- relatedTo: Array of what this might be related to in a codebase

Be concise and precise. Focus on WHAT the code does, not HOW.

File: {filePath}

\`\`\`typescript
{content}
\`\`\`

JSON response:`;

const RELATIONSHIP_ANALYSIS_PROMPT = `Analyze the relationship between these two code files.

File A: {filePathA}
\`\`\`typescript
{contentA}
\`\`\`

File B: {filePathB}
\`\`\`typescript
{contentB}
\`\`\`

Respond in JSON:
- relationship: "same-concern" | "complementary" | "dependency" | "sibling" | "unrelated"
- confidence: 0.0 to 1.0
- reason: Brief explanation
- sharedConcepts: Array of shared concepts

JSON response:`;

// ============================================================================
// MODEL RESOLUTION
// ============================================================================

function resolvePurposeModelId(model: PurposeExtractionModel | undefined, provider: 'claude' | 'codex'): string {
  if (provider === 'codex') {
    if (model === 'codex-low') return 'gpt-5-codex-low';
    if (model === 'codex-medium') return 'gpt-5-codex-medium';
    return resolveLibrarianModelId('codex') ?? 'gpt-5.1-codex-mini';
  }
  if (model === 'sonnet-4.5') return 'claude-sonnet-4-5-20241022';
  if (model === 'haiku-4.5') return 'claude-haiku-4-5-20241022';
  return resolveLibrarianModelId('claude') ?? 'claude-haiku-4-5-20241022';
}

async function resolvePurposeLlmConfig(
  model: PurposeExtractionModel,
  hasExplicitModel: boolean
): Promise<{ provider: 'claude' | 'codex'; modelId: string; resolvedModel: PurposeExtractionModel }> {
  if (hasExplicitModel) {
    const provider: 'claude' | 'codex' = model.startsWith('codex') ? 'codex' : 'claude';
    return { provider, modelId: resolvePurposeModelId(model, provider), resolvedModel: model };
  }

  const discovered = await resolveLibrarianModelConfigWithDiscovery();
  const resolvedModel: PurposeExtractionModel = discovered.provider === 'codex' ? 'codex-low' : 'haiku-4.5';
  return { provider: discovered.provider, modelId: discovered.modelId, resolvedModel };
}

// ============================================================================
// CONTENT HASHING
// ============================================================================

/**
 * Compute content hash for cache validation.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 1;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

// ============================================================================
// PURPOSE EXTRACTION
// ============================================================================

/**
 * Extract purpose from a code file using LLM.
 */
export async function extractPurpose(
  filePath: string,
  content: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const hasExplicitModel = typeof options.model !== 'undefined';
  const model = options.model ?? 'haiku-4.5';
  const {
    maxTokens = 500,
    temperature = 0,
    allowHeuristics = false,
  } = options;
  let resolvedModel: PurposeExtractionModel = model;

  const startTime = Date.now();
  const contentHash = computeContentHash(content);

  // Build prompt
  const truncatedContent = content.slice(0, 4000); // Limit for token efficiency
  const prompt = PURPOSE_EXTRACTION_PROMPT
    .replace('{filePath}', filePath)
    .replace('{content}', truncatedContent);

  // Call LLM
  let rawResponse: string;
  let tokensUsed = { input: 0, output: 0 };

  try {
    await requireProviders({ llm: true, embedding: false }, { workspaceRoot: process.cwd() });
    const resolved = await resolvePurposeLlmConfig(model, hasExplicitModel);
    const { provider, modelId } = resolved;
    resolvedModel = resolved.resolvedModel;
    const llmService = resolveLlmServiceAdapter();
    const response = await llmService.chat({
      provider,
      modelId,
      messages: [{ role: 'user', content: prompt }],
      maxTokens,
      temperature,
    });
    rawResponse = response.content;
    tokensUsed = {
      input: estimateTokenCount(prompt),
      output: estimateTokenCount(rawResponse),
    };
  } catch (error) {
    if (!allowHeuristics) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`unverified_by_trace(provider_unavailable): ${message}`);
    }
    rawResponse = heuristicPurposeExtraction(filePath, content);
    tokensUsed = { input: 0, output: 0 };
  }

  // Parse response
  const purpose = parsePurposeResponse(rawResponse, {
    filePath,
    contentHash,
    model: resolvedModel,
  });

  return {
    purpose,
    rawResponse,
    tokensUsed,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Parse LLM response into structured purpose.
 */
function parsePurposeResponse(
  response: string,
  defaults: {
    filePath: string;
    contentHash: string;
    model: PurposeExtractionModel;
  }
): ExtractedPurpose {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      purpose: parsed.purpose || 'Purpose extraction failed',
      responsibilities: parsed.responsibilities || [],
      domain: parsed.domain || 'unknown',
      complexity: parsed.complexity || 'moderate',
      concepts: parsed.concepts || [],
      relatedTo: parsed.relatedTo || [],
      model: defaults.model,
      extractedAt: Date.now(),
      contentHash: defaults.contentHash,
    };
  } catch (error) {
    // Return default on parse failure
    return {
      purpose: `Code file: ${defaults.filePath}`,
      responsibilities: [],
      domain: inferDomain(defaults.filePath),
      complexity: 'moderate',
      concepts: [],
      relatedTo: [],
      model: defaults.model,
      extractedAt: Date.now(),
      contentHash: defaults.contentHash,
    };
  }
}

/**
 * Heuristic purpose extraction when LLM is unavailable.
 */
function heuristicPurposeExtraction(filePath: string, content: string): string {
  const purpose = [];
  const responsibilities = [];
  const concepts = [];

  // Extract from file comment
  const commentMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (commentMatch) {
    const overviewMatch = commentMatch[0].match(/@fileoverview\s+(.+?)(?:\n|\*\/)/s);
    if (overviewMatch) {
      purpose.push(overviewMatch[1].replace(/\s*\*\s*/g, ' ').trim());
    }
  }

  // Infer from file name
  const fileName = filePath.split('/').pop() || '';
  if (fileName.includes('test')) {
    responsibilities.push('Testing');
  }
  if (fileName.includes('index')) {
    responsibilities.push('Module exports');
  }
  if (fileName.includes('types')) {
    responsibilities.push('Type definitions');
  }

  // Infer from content patterns
  if (content.includes('export class')) {
    concepts.push('OOP');
  }
  if (content.includes('async ')) {
    concepts.push('async-await');
  }
  if (content.includes('interface ')) {
    concepts.push('TypeScript interfaces');
  }

  const domain = inferDomain(filePath);

  return JSON.stringify({
    purpose: purpose[0] || `${domain} module: ${fileName}`,
    responsibilities: responsibilities,
    domain: domain,
    complexity: content.length > 2000 ? 'complex' : content.length > 500 ? 'moderate' : 'simple',
    concepts: concepts,
    relatedTo: [],
  });
}

/**
 * Infer domain from file path.
 */
function inferDomain(filePath: string): string {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.includes('auth')) return 'authentication';
  if (lowerPath.includes('test')) return 'testing';
  if (lowerPath.includes('api')) return 'API';
  if (lowerPath.includes('db') || lowerPath.includes('storage')) return 'database';
  if (lowerPath.includes('ui') || lowerPath.includes('component')) return 'UI';
  if (lowerPath.includes('util')) return 'utilities';
  if (lowerPath.includes('config')) return 'configuration';
  if (lowerPath.includes('engine')) return 'core-engine';
  if (lowerPath.includes('index')) return 'indexing';
  if (lowerPath.includes('embed')) return 'embeddings';

  return 'general';
}

// ============================================================================
// RELATIONSHIP ANALYSIS
// ============================================================================

export interface RelationshipAnalysis {
  relationship: 'same-concern' | 'complementary' | 'dependency' | 'sibling' | 'unrelated';
  confidence: number;
  reason: string;
  sharedConcepts: string[];
  model: PurposeExtractionModel;
  latencyMs: number;
}

/**
 * Analyze relationship between two files using LLM.
 */
export async function analyzeRelationship(
  fileA: { path: string; content: string },
  fileB: { path: string; content: string },
  options: ExtractionOptions = {}
): Promise<RelationshipAnalysis> {
  const hasExplicitModel = typeof options.model !== 'undefined';
  const model = options.model ?? 'haiku-4.5';
  const {
    maxTokens = 300,
    temperature = 0,
    allowHeuristics = false,
  } = options;
  let resolvedModel: PurposeExtractionModel = model;

  const startTime = Date.now();

  // Build prompt
  const prompt = RELATIONSHIP_ANALYSIS_PROMPT
    .replace('{filePathA}', fileA.path)
    .replace('{contentA}', fileA.content.slice(0, 2000))
    .replace('{filePathB}', fileB.path)
    .replace('{contentB}', fileB.content.slice(0, 2000));

  // Call LLM
  let rawResponse: string;
  try {
    await requireProviders({ llm: true, embedding: false }, { workspaceRoot: process.cwd() });
    const resolved = await resolvePurposeLlmConfig(model, hasExplicitModel);
    const { provider, modelId } = resolved;
    resolvedModel = resolved.resolvedModel;
    const llmService = resolveLlmServiceAdapter();
    const response = await llmService.chat({
      provider,
      modelId,
      messages: [{ role: 'user', content: prompt }],
      maxTokens,
      temperature,
    });
    rawResponse = response.content;
  } catch (error) {
    if (!allowHeuristics) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`unverified_by_trace(provider_unavailable): ${message}`);
    }
    // Fallback: heuristic relationship analysis
    rawResponse = heuristicRelationshipAnalysis(fileA, fileB);
  }

  // Parse response
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      relationship: parsed.relationship || 'unrelated',
      confidence: parsed.confidence || 0.5,
      reason: parsed.reason || 'Analysis failed',
      sharedConcepts: parsed.sharedConcepts || [],
      model: resolvedModel,
      latencyMs: Date.now() - startTime,
    };
  } catch {
    return {
      relationship: 'unrelated',
      confidence: 0.3,
      reason: 'Failed to analyze',
      sharedConcepts: [],
      model: resolvedModel,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Heuristic relationship analysis.
 */
function heuristicRelationshipAnalysis(
  fileA: { path: string; content: string },
  fileB: { path: string; content: string }
): string {
  const dirA = fileA.path.split('/').slice(0, -1).join('/');
  const dirB = fileB.path.split('/').slice(0, -1).join('/');

  // Same directory = sibling
  if (dirA === dirB) {
    return JSON.stringify({
      relationship: 'sibling',
      confidence: 0.7,
      reason: 'Same directory',
      sharedConcepts: [],
    });
  }

  // Check for import relationship
  if (fileA.content.includes(fileB.path.replace(/\.ts$/, '')) ||
      fileB.content.includes(fileA.path.replace(/\.ts$/, ''))) {
    return JSON.stringify({
      relationship: 'dependency',
      confidence: 0.8,
      reason: 'Import relationship',
      sharedConcepts: [],
    });
  }

  // Same domain
  const domainA = inferDomain(fileA.path);
  const domainB = inferDomain(fileB.path);
  if (domainA === domainB && domainA !== 'general') {
    return JSON.stringify({
      relationship: 'same-concern',
      confidence: 0.6,
      reason: `Same domain: ${domainA}`,
      sharedConcepts: [domainA],
    });
  }

  return JSON.stringify({
    relationship: 'unrelated',
    confidence: 0.5,
    reason: 'No obvious relationship',
    sharedConcepts: [],
  });
}

// ============================================================================
// BATCH EXTRACTION
// ============================================================================

export interface BatchExtractionResult {
  results: Map<string, ExtractedPurpose>;
  errors: Map<string, Error>;
  totalTokensUsed: { input: number; output: number };
  totalLatencyMs: number;
}

/**
 * Extract purpose from multiple files efficiently.
 */
export async function extractPurposeBatch(
  files: Array<{ path: string; content: string }>,
  options: ExtractionOptions & {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<BatchExtractionResult> {
  const { concurrency = 5, onProgress } = options;

  const results = new Map<string, ExtractedPurpose>();
  const errors = new Map<string, Error>();
  let totalInput = 0;
  let totalOutput = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map((file) => extractPurpose(file.path, file.content, options))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const file = batch[j];

      if (result.status === 'fulfilled') {
        results.set(file.path, result.value.purpose);
        totalInput += result.value.tokensUsed.input;
        totalOutput += result.value.tokensUsed.output;
      } else {
        errors.set(file.path, result.reason);
      }
    }

    onProgress?.(Math.min(i + concurrency, files.length), files.length);
  }

  return {
    results,
    errors,
    totalTokensUsed: { input: totalInput, output: totalOutput },
    totalLatencyMs: Date.now() - startTime,
  };
}

// All exports are inline above
