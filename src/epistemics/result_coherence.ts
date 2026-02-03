/**
 * @fileoverview Result Coherence Analysis for Query Confidence
 *
 * This module addresses a critical calibration gap: the system was reporting
 * 0.8-0.86 confidence on completely irrelevant results. Confidence should
 * reflect the QUALITY of retrieved results, not just individual pack metrics.
 *
 * Key insight: When results are semantically scattered (unrelated to each other
 * or to the query), confidence MUST be LOW regardless of individual pack scores.
 *
 * Three coherence signals:
 * 1. Result Clustering - How similar are results to each other?
 * 2. Query Alignment - How well do results match the query domain?
 * 3. Domain Coherence - Do results come from the same conceptual domain?
 *
 * @packageDocumentation
 */

import type { ContextPack } from '../types.js';
import type { ConfidenceValue } from './confidence.js';
import { bounded, deterministic, absent } from './confidence.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of coherence analysis for a query response.
 */
export interface CoherenceAnalysis {
  /** Overall coherence score [0, 1] - low = scattered results */
  overallCoherence: number;

  /** How tightly clustered are the results semantically [0, 1] */
  resultClustering: number;

  /** How well results align with query intent [0, 1] */
  queryAlignment: number;

  /** Do results come from similar domains [0, 1] */
  domainCoherence: number;

  /** Confidence value with provenance for the coherence assessment */
  confidence: ConfidenceValue;

  /** Human-readable explanation of the coherence assessment */
  explanation: string;

  /** Warnings about result quality */
  warnings: string[];

  /** Suggested confidence adjustment factor [0, 1] */
  confidenceAdjustment: number;
}

/**
 * Options for coherence analysis.
 */
export interface CoherenceAnalysisOptions {
  /**
   * Query embedding - currently unused but preserved for future enhancements
   * where we might compare query embedding against pack target embeddings
   * retrieved from storage.
   */
  queryEmbedding?: Float32Array | number[] | null;

  /** Query intent text for keyword-based alignment */
  queryIntent?: string;

  /** Minimum coherence before triggering penalty (default: 0.4) */
  coherenceThreshold?: number;

  /** Maximum penalty to apply - confidence multiplier at lowest coherence (default: 0.3) */
  maxPenalty?: number;

  /** Whether to include detailed diagnostics in warnings */
  verbose?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default coherence threshold - below this, confidence should be penalized */
export const DEFAULT_COHERENCE_THRESHOLD = 0.4;

/** Maximum penalty factor - confidence can be reduced to this fraction */
export const DEFAULT_MAX_PENALTY = 0.3;

/** Weights for combining coherence signals */
export const COHERENCE_WEIGHTS = {
  resultClustering: 0.35,  // How similar results are to each other
  queryAlignment: 0.40,    // How well results match query
  domainCoherence: 0.25,   // Domain consistency
} as const;

/** Minimum results needed for clustering analysis */
export const MIN_RESULTS_FOR_CLUSTERING = 2;

/** Semantic similarity threshold for considering results "related" */
export const RELATED_SIMILARITY_THRESHOLD = 0.5;

// ============================================================================
// CORE ANALYSIS
// ============================================================================

/**
 * Analyze the coherence of query results to determine if confidence should be reduced.
 *
 * This is the primary entry point. It examines:
 * 1. Whether results are semantically clustered (vs scattered across unrelated topics)
 * 2. Whether results align with the query intent
 * 3. Whether results come from consistent domains
 *
 * @param packs - The context packs returned by the query
 * @param options - Analysis options including query embedding and intent
 * @returns Coherence analysis with suggested confidence adjustment
 */
export function analyzeResultCoherence(
  packs: ContextPack[],
  options: CoherenceAnalysisOptions = {}
): CoherenceAnalysis {
  const warnings: string[] = [];
  const verbose = options.verbose ?? false;

  // Handle edge cases
  if (packs.length === 0) {
    return {
      overallCoherence: 0,
      resultClustering: 0,
      queryAlignment: 0,
      domainCoherence: 0,
      confidence: deterministic(true, 'no_results'),
      explanation: 'No results to analyze - cannot assess coherence.',
      warnings: ['No results returned'],
      confidenceAdjustment: 0.1, // Very low confidence when no results
    };
  }

  if (packs.length === 1) {
    const queryAlignment = computeSingleResultAlignment(packs[0], options);
    return {
      overallCoherence: queryAlignment,
      resultClustering: 1.0, // Single result is trivially coherent with itself
      queryAlignment,
      domainCoherence: 1.0,
      confidence: bounded(
        queryAlignment * 0.8,
        Math.min(1.0, queryAlignment * 1.2),
        'theoretical',
        'single_result_coherence'
      ),
      explanation: 'Single result - coherence based on query alignment only.',
      warnings: [],
      confidenceAdjustment: queryAlignment > 0.5 ? 1.0 : 0.5,
    };
  }

  // Compute individual coherence signals
  const resultClustering = computeResultClustering(packs, verbose ? warnings : undefined);
  const queryAlignment = computeQueryAlignment(packs, options, verbose ? warnings : undefined);
  const domainCoherence = computeDomainCoherence(packs, options.queryIntent, verbose ? warnings : undefined);

  // Weighted combination
  const overallCoherence =
    resultClustering * COHERENCE_WEIGHTS.resultClustering +
    queryAlignment * COHERENCE_WEIGHTS.queryAlignment +
    domainCoherence * COHERENCE_WEIGHTS.domainCoherence;

  // Compute confidence adjustment
  const threshold = options.coherenceThreshold ?? DEFAULT_COHERENCE_THRESHOLD;
  const maxPenalty = options.maxPenalty ?? DEFAULT_MAX_PENALTY;
  const confidenceAdjustment = computeConfidenceAdjustment(
    overallCoherence,
    threshold,
    maxPenalty
  );

  // Build explanation
  const explanation = buildCoherenceExplanation(
    overallCoherence,
    resultClustering,
    queryAlignment,
    domainCoherence,
    confidenceAdjustment,
    warnings
  );

  // Add warnings for low coherence
  if (overallCoherence < 0.3) {
    warnings.push(`CRITICAL: Results appear semantically scattered (coherence: ${(overallCoherence * 100).toFixed(0)}%)`);
  } else if (overallCoherence < threshold) {
    warnings.push(`Results have low coherence (${(overallCoherence * 100).toFixed(0)}%), confidence reduced.`);
  }

  return {
    overallCoherence,
    resultClustering,
    queryAlignment,
    domainCoherence,
    confidence: bounded(
      Math.max(0.1, overallCoherence - 0.15),
      Math.min(1.0, overallCoherence + 0.15),
      'theoretical',
      'result_coherence_analysis'
    ),
    explanation,
    warnings,
    confidenceAdjustment,
  };
}

// ============================================================================
// COMPONENT SIGNALS
// ============================================================================

/**
 * Compute how clustered/similar results are to each other.
 * Low clustering = results are scattered across unrelated topics.
 */
function computeResultClustering(
  packs: ContextPack[],
  warnings?: string[]
): number {
  if (packs.length < MIN_RESULTS_FOR_CLUSTERING) {
    return 0.5; // Neutral when not enough data
  }

  // Extract semantic indicators from packs
  const packSignatures = packs.map(extractPackSignature);

  // Compute pairwise similarity
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < packSignatures.length; i++) {
    for (let j = i + 1; j < packSignatures.length; j++) {
      const similarity = computeSignatureSimilarity(packSignatures[i], packSignatures[j]);
      totalSimilarity += similarity;
      pairCount++;
    }
  }

  const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

  // Count how many pairs are "related" (above threshold)
  let relatedPairs = 0;
  for (let i = 0; i < packSignatures.length; i++) {
    for (let j = i + 1; j < packSignatures.length; j++) {
      if (computeSignatureSimilarity(packSignatures[i], packSignatures[j]) >= RELATED_SIMILARITY_THRESHOLD) {
        relatedPairs++;
      }
    }
  }

  const relatedRatio = pairCount > 0 ? relatedPairs / pairCount : 0;

  // Low related ratio indicates scattered results
  if (relatedRatio < 0.3 && warnings) {
    warnings.push(`Only ${(relatedRatio * 100).toFixed(0)}% of result pairs are semantically related.`);
  }

  // Combine average similarity and related ratio
  return avgSimilarity * 0.6 + relatedRatio * 0.4;
}

/**
 * Compute how well results align with the query intent.
 * Note: ContextPack doesn't carry embeddings, so we use keyword-based alignment.
 */
function computeQueryAlignment(
  packs: ContextPack[],
  options: CoherenceAnalysisOptions,
  warnings?: string[]
): number {
  // Use keyword-based alignment with query intent
  if (options.queryIntent) {
    return computeKeywordAlignment(packs, options.queryIntent, warnings);
  }

  // No alignment data available - return neutral with warning
  if (warnings) {
    warnings.push('Cannot compute query alignment - no query intent provided.');
  }
  return 0.5;
}

/**
 * Compute domain coherence - do results come from similar conceptual domains?
 */
function computeDomainCoherence(
  packs: ContextPack[],
  queryIntent?: string,
  warnings?: string[]
): number {
  // Extract domains from pack metadata
  const domains = packs.flatMap(extractDomains);

  if (domains.length === 0) {
    return 0.5; // Neutral when no domain info
  }

  // Count domain frequency
  const domainCounts = new Map<string, number>();
  for (const domain of domains) {
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  // Find dominant domain
  let maxCount = 0;
  let dominantDomain = '';
  for (const [domain, count] of domainCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantDomain = domain;
    }
  }

  // Coherence = fraction of packs in dominant domain
  const coherence = maxCount / packs.length;

  // Check if dominant domain matches query intent
  if (queryIntent && coherence > 0.5) {
    const intentDomains = extractDomainsFromText(queryIntent);
    const domainMatch = intentDomains.some(d =>
      dominantDomain.toLowerCase().includes(d.toLowerCase()) ||
      d.toLowerCase().includes(dominantDomain.toLowerCase())
    );

    if (!domainMatch && warnings) {
      warnings.push(`Dominant result domain "${dominantDomain}" may not match query intent.`);
      return coherence * 0.7; // Penalize mismatched domains
    }
  }

  if (coherence < 0.4 && warnings) {
    warnings.push(`Results span multiple domains with no clear dominant domain.`);
  }

  return coherence;
}

/**
 * Compute alignment for single result case.
 * Note: ContextPack doesn't carry embeddings, so we use keyword-based alignment.
 */
function computeSingleResultAlignment(
  pack: ContextPack,
  options: CoherenceAnalysisOptions
): number {
  // Use keyword matching with query intent
  if (options.queryIntent) {
    return computeKeywordOverlap(pack, options.queryIntent);
  }

  return 0.5; // Neutral when no intent provided
}

// ============================================================================
// CONFIDENCE ADJUSTMENT
// ============================================================================

/**
 * Compute the confidence adjustment factor based on coherence.
 *
 * When coherence is below threshold, confidence should be reduced.
 * The reduction is proportional to how far below threshold we are.
 *
 * @param coherence - Overall coherence score [0, 1]
 * @param threshold - Coherence threshold below which to penalize
 * @param maxPenalty - Maximum penalty (confidence multiplier at lowest coherence)
 * @returns Adjustment factor [maxPenalty, 1.0]
 */
function computeConfidenceAdjustment(
  coherence: number,
  threshold: number,
  maxPenalty: number
): number {
  if (coherence >= threshold) {
    // Above threshold - no penalty
    return 1.0;
  }

  // Linear interpolation from threshold to 0
  // At threshold: adjustment = 1.0
  // At 0: adjustment = maxPenalty
  const ratio = coherence / threshold;
  return maxPenalty + (1.0 - maxPenalty) * ratio;
}

/**
 * Apply coherence-based confidence adjustment to total confidence.
 *
 * This is the main function to use when finalizing query confidence.
 *
 * @param totalConfidence - The original computed confidence
 * @param coherenceAnalysis - Results from analyzeResultCoherence
 * @returns Adjusted confidence value
 */
export function applyCoherenceAdjustment(
  totalConfidence: number,
  coherenceAnalysis: CoherenceAnalysis
): number {
  const adjusted = totalConfidence * coherenceAnalysis.confidenceAdjustment;

  // Never let confidence be higher than coherence itself
  // If results are 30% coherent, we can't be 80% confident they're right
  const coherenceCap = coherenceAnalysis.overallCoherence + 0.1;
  const capped = Math.min(adjusted, coherenceCap);

  // Floor to prevent extremely low confidence when there ARE results
  const floored = Math.max(0.05, capped);

  return floored;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract a semantic signature from a pack for comparison.
 */
interface PackSignature {
  keywords: Set<string>;
  domains: string[];
  packType: string;
  concepts: string[];
}

function extractPackSignature(pack: ContextPack): PackSignature {
  const keywords = new Set<string>();

  // Extract from summary
  if (pack.summary) {
    tokenize(pack.summary).forEach(k => keywords.add(k));
  }

  // Extract from key facts
  for (const fact of pack.keyFacts || []) {
    tokenize(fact).forEach(k => keywords.add(k));
  }

  // Extract from related files (path segments)
  for (const file of pack.relatedFiles || []) {
    const segments = file.split(/[\/\\]/).filter(s => s.length > 2);
    segments.forEach(s => keywords.add(s.toLowerCase()));
  }

  return {
    keywords,
    domains: extractDomains(pack),
    packType: pack.packType,
    concepts: extractConcepts(pack),
  };
}

/**
 * Compute similarity between two pack signatures.
 */
function computeSignatureSimilarity(a: PackSignature, b: PackSignature): number {
  // Jaccard similarity for keywords
  const keywordSimilarity = jaccardSimilarity(a.keywords, b.keywords);

  // Domain overlap
  const domainOverlap = computeArrayOverlap(a.domains, b.domains);

  // Concept overlap
  const conceptOverlap = computeArrayOverlap(a.concepts, b.concepts);

  // Pack type match bonus
  const typeMatch = a.packType === b.packType ? 0.1 : 0;

  return (keywordSimilarity * 0.5 + domainOverlap * 0.25 + conceptOverlap * 0.15 + typeMatch);
}

/**
 * Compute Jaccard similarity between two sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Compute overlap ratio between two arrays.
 */
function computeArrayOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));

  let overlap = 0;
  for (const item of setA) {
    if (setB.has(item)) overlap++;
  }

  return (2 * overlap) / (setA.size + setB.size);
}

/**
 * Extract domain indicators from a pack.
 */
function extractDomains(pack: ContextPack): string[] {
  const domains: string[] = [];

  // From pack type
  if (pack.packType) {
    domains.push(pack.packType.replace(/_/g, ' '));
  }

  // From related files - extract directory names as domains
  for (const file of pack.relatedFiles || []) {
    const parts = file.split(/[\/\\]/);
    if (parts.length > 1) {
      // Add parent directory as domain
      const parent = parts[parts.length - 2];
      if (parent && parent.length > 2 && !parent.startsWith('.')) {
        domains.push(parent);
      }
    }
  }

  // From key facts - look for domain indicators
  for (const fact of pack.keyFacts || []) {
    const domainPatterns = fact.match(/\b(api|ui|database|auth|test|utils?|core|config|service|model|controller|view)\b/gi);
    if (domainPatterns) {
      domains.push(...domainPatterns.map(d => d.toLowerCase()));
    }
  }

  return [...new Set(domains)];
}

/**
 * Extract concept indicators from a pack.
 */
function extractConcepts(pack: ContextPack): string[] {
  const concepts: string[] = [];

  // Extract technical concepts from summary
  if (pack.summary) {
    const techTerms = pack.summary.match(
      /\b(function|class|interface|module|component|service|handler|processor|manager|factory|builder|validator|parser|serializer|adapter|wrapper)\b/gi
    );
    if (techTerms) {
      concepts.push(...techTerms.map(t => t.toLowerCase()));
    }
  }

  return [...new Set(concepts)];
}

/**
 * Extract domains from text (query intent).
 */
function extractDomainsFromText(text: string): string[] {
  const domains: string[] = [];

  // Common domain indicators
  const patterns = [
    /\b(api|rest|graphql|endpoint)/gi,
    /\b(ui|frontend|component|view|page)/gi,
    /\b(database|storage|persistence|query)/gi,
    /\b(auth|security|permission|access)/gi,
    /\b(test|spec|mock|fixture)/gi,
    /\b(config|setting|environment)/gi,
    /\b(utils?|helper|common|shared)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      domains.push(...matches.map(m => m.toLowerCase()));
    }
  }

  return [...new Set(domains)];
}

/**
 * Compute keyword alignment between packs and query intent.
 */
function computeKeywordAlignment(
  packs: ContextPack[],
  queryIntent: string,
  warnings?: string[]
): number {
  const queryKeywords = new Set(tokenize(queryIntent));
  if (queryKeywords.size === 0) return 0.5;

  let totalAlignment = 0;
  for (const pack of packs) {
    const packKeywords = extractPackSignature(pack).keywords;
    let matches = 0;
    for (const kw of queryKeywords) {
      if (packKeywords.has(kw)) matches++;
    }
    totalAlignment += matches / queryKeywords.size;
  }

  const avgAlignment = totalAlignment / packs.length;

  if (avgAlignment < 0.3 && warnings) {
    warnings.push(`Low keyword match with query intent (${(avgAlignment * 100).toFixed(0)}%).`);
  }

  return avgAlignment;
}

/**
 * Compute keyword overlap for single pack.
 */
function computeKeywordOverlap(pack: ContextPack, queryIntent: string): number {
  const queryKeywords = new Set(tokenize(queryIntent));
  if (queryKeywords.size === 0) return 0.5;

  const packKeywords = extractPackSignature(pack).keywords;
  let matches = 0;
  for (const kw of queryKeywords) {
    if (packKeywords.has(kw)) matches++;
  }

  return matches / queryKeywords.size;
}

/**
 * Tokenize text into keywords.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z0-9_]+/)
    .filter(t => t.length >= 3)
    .filter(t => !STOP_WORDS.has(t));
}

/** Common stop words to filter out */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'from',
  'this', 'that', 'with', 'they', 'will', 'what', 'there', 'their',
  'which', 'would', 'about', 'into', 'more', 'some', 'than', 'them',
  'these', 'then', 'other', 'could', 'when', 'where', 'should',
]);

/**
 * Build human-readable explanation of coherence analysis.
 */
function buildCoherenceExplanation(
  overallCoherence: number,
  resultClustering: number,
  queryAlignment: number,
  domainCoherence: number,
  confidenceAdjustment: number,
  warnings: string[]
): string {
  const parts: string[] = [];

  // Overall assessment
  if (overallCoherence >= 0.7) {
    parts.push(`Results are coherent (${(overallCoherence * 100).toFixed(0)}%).`);
  } else if (overallCoherence >= 0.4) {
    parts.push(`Results have moderate coherence (${(overallCoherence * 100).toFixed(0)}%).`);
  } else {
    parts.push(`WARNING: Results appear scattered/incoherent (${(overallCoherence * 100).toFixed(0)}%).`);
  }

  // Component breakdown
  parts.push(`Clustering: ${(resultClustering * 100).toFixed(0)}%, ` +
    `Query alignment: ${(queryAlignment * 100).toFixed(0)}%, ` +
    `Domain coherence: ${(domainCoherence * 100).toFixed(0)}%.`);

  // Confidence impact
  if (confidenceAdjustment < 1.0) {
    parts.push(`Confidence reduced to ${(confidenceAdjustment * 100).toFixed(0)}% due to low coherence.`);
  }

  return parts.join(' ');
}
