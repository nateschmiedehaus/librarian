/**
 * @fileoverview DRAGIN Active Retrieval (WU-DRAGIN-001)
 *
 * Implements Dynamic Retrieval Augmented Generation based on Information Needs
 * (DRAGIN) per ACL 2024. Detects when a model needs more information during
 * generation by monitoring uncertainty signals (simulated via text patterns).
 *
 * Key Features:
 * - Uncertainty signal detection (hedging, questions, low confidence, unknown entities, vague quantifiers)
 * - Dynamic retrieval triggering based on aggregated uncertainty
 * - Configurable thresholds for signal severity and retrieval decision
 * - Composable with other retrieval strategies (IRCoT, FLARE, etc.)
 *
 * Research reference: "DRAGIN: Dynamic Retrieval Augmented Generation based on
 * Information Needs of Large Language Models" (ACL 2024)
 *
 * @packageDocumentation
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of uncertainty signals that can be detected in text.
 */
export type UncertaintyType =
  | 'hedging'
  | 'question'
  | 'low_confidence'
  | 'unknown_entity'
  | 'vague_quantifier';

/**
 * A single uncertainty signal detected in text.
 */
export interface UncertaintySignal {
  /** The type of uncertainty signal */
  type: UncertaintyType;
  /** The text that triggered this signal */
  text: string;
  /** Character position in the original text */
  position: number;
  /** Severity of the uncertainty (0.0 to 1.0) */
  severity: number;
}

/**
 * Decision about whether retrieval should be triggered.
 */
export interface RetrievalDecision {
  /** Whether retrieval should be triggered */
  shouldRetrieve: boolean;
  /** Human-readable reason for the decision */
  reason: string;
  /** All detected uncertainty signals */
  signals: UncertaintySignal[];
  /** Confidence in the retrieval decision (0.0 to 1.0) */
  confidence: number;
}

/**
 * Result from processing a generation with active retrieval.
 */
export interface ActiveRetrievalResult {
  /** The original generated text */
  originalText: string;
  /** The revised text (may include retrieved context) */
  revisedText: string;
  /** Whether retrieval was triggered */
  retrievalTriggered: boolean;
  /** Context retrieved during the process */
  retrievedContext: string[];
  /** Uncertainty signals detected */
  signals: UncertaintySignal[];
}

/**
 * Result from dynamic retrieval triggering.
 */
export interface DynamicRetrievalResult {
  /** The generated query for retrieval */
  query: string;
  /** Signals that influenced the query */
  contributingSignals: UncertaintySignal[];
}

/**
 * Configuration for DRAGIN retrieval.
 */
export interface DRAGINConfig {
  /** Threshold for aggregate uncertainty to trigger retrieval (default: 0.5) */
  uncertaintyThreshold: number;
  /** Minimum severity for a signal to be considered (default: 0.3) */
  minSignalSeverity: number;
  /** Maximum retrieval attempts per generation (default: 3) */
  maxRetrievalAttempts: number;
  /** Maximum query length in characters (default: 200) */
  maxQueryLength: number;
}

/**
 * Default configuration for DRAGIN.
 */
export const DEFAULT_DRAGIN_CONFIG: DRAGINConfig = {
  uncertaintyThreshold: 0.5,
  minSignalSeverity: 0.3,
  maxRetrievalAttempts: 3,
  maxQueryLength: 200,
};

// ============================================================================
// UNCERTAINTY DETECTION PATTERNS
// ============================================================================

/**
 * Patterns for detecting hedging language.
 * Hedging words indicate uncertainty about claims.
 */
const HEDGING_PATTERNS: Array<{ pattern: RegExp; severity: number }> = [
  { pattern: /\bmight\b/gi, severity: 0.7 },
  { pattern: /\bmaybe\b/gi, severity: 0.7 },
  { pattern: /\bpossibly\b/gi, severity: 0.8 },
  { pattern: /\bperhaps\b/gi, severity: 0.75 },
  { pattern: /\bprobably\b/gi, severity: 0.5 },
  { pattern: /\bcould be\b/gi, severity: 0.6 },
  { pattern: /\bseems like\b/gi, severity: 0.6 },
  { pattern: /\bappears to\b/gi, severity: 0.5 },
  { pattern: /\bit looks like\b/gi, severity: 0.55 },
  { pattern: /\bi believe\b/gi, severity: 0.6 },
  { pattern: /\bi assume\b/gi, severity: 0.7 },
];

/**
 * Patterns for detecting low confidence phrases.
 */
const LOW_CONFIDENCE_PATTERNS: Array<{ pattern: RegExp; severity: number }> = [
  { pattern: /\bi'?m not sure\b/gi, severity: 0.9 },
  { pattern: /\bi don'?t know\b/gi, severity: 0.95 },
  { pattern: /\bi think\b/gi, severity: 0.5 },
  { pattern: /\bnot certain\b/gi, severity: 0.85 },
  { pattern: /\bunclear\b/gi, severity: 0.8 },
  { pattern: /\bunknown\b/gi, severity: 0.85 },
  { pattern: /\bhard to say\b/gi, severity: 0.75 },
  { pattern: /\bdifficult to determine\b/gi, severity: 0.8 },
  { pattern: /\bcannot confirm\b/gi, severity: 0.85 },
  { pattern: /\bcannot verify\b/gi, severity: 0.85 },
];

/**
 * Patterns for detecting vague quantifiers.
 */
const VAGUE_QUANTIFIER_PATTERNS: Array<{ pattern: RegExp; severity: number }> = [
  { pattern: /\bsome\b/gi, severity: 0.4 },
  { pattern: /\bseveral\b/gi, severity: 0.45 },
  { pattern: /\bmany\b/gi, severity: 0.4 },
  { pattern: /\bfew\b/gi, severity: 0.45 },
  { pattern: /\ba lot of\b/gi, severity: 0.35 },
  { pattern: /\bvarious\b/gi, severity: 0.4 },
  { pattern: /\bnumerous\b/gi, severity: 0.4 },
  { pattern: /\bmultiple\b/gi, severity: 0.35 },
];

/**
 * Pattern for detecting unknown entities (PascalCase identifiers that look
 * like they reference specific classes/types that might not be defined).
 */
const UNKNOWN_ENTITY_PATTERN = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;

/**
 * Common known entity prefixes/suffixes that indicate well-known patterns.
 * These are less likely to be "unknown" entities.
 */
const KNOWN_ENTITY_PATTERNS = [
  /^(Array|String|Number|Boolean|Object|Function|Promise|Map|Set)$/,
  /^(User|Admin|Manager|Handler|Service|Controller|Repository|Factory)$/,
  /^(Error|Exception|Warning)$/,
];

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Compute uncertainty signals from a given text.
 *
 * Analyzes text for patterns that indicate uncertainty:
 * - Hedging language (might, possibly, maybe, etc.)
 * - Question marks
 * - Low confidence phrases (not sure, don't know, etc.)
 * - Unknown entity references (PascalCase identifiers)
 * - Vague quantifiers (some, many, few, etc.)
 *
 * @param text - The text to analyze
 * @returns Array of detected uncertainty signals
 *
 * @example
 * ```typescript
 * const signals = computeUncertaintySignals("The function might return null.");
 * // Returns: [{ type: 'hedging', text: 'might', position: 13, severity: 0.7 }]
 * ```
 */
export function computeUncertaintySignals(text: string): UncertaintySignal[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const signals: UncertaintySignal[] = [];

  // Detect hedging language
  for (const { pattern, severity } of HEDGING_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      signals.push({
        type: 'hedging',
        text: match[0],
        position: match.index,
        severity,
      });
    }
  }

  // Detect question marks
  const questionPattern = /\?/g;
  let questionMatch: RegExpExecArray | null;
  while ((questionMatch = questionPattern.exec(text)) !== null) {
    // Find the start of the question (look backwards for sentence start)
    let questionStart = questionMatch.index;
    for (let i = questionMatch.index - 1; i >= 0; i--) {
      if (text[i] === '.' || text[i] === '!' || text[i] === '?' || text[i] === '\n') {
        questionStart = i + 1;
        break;
      }
      if (i === 0) {
        questionStart = 0;
      }
    }
    const questionText = text.slice(questionStart, questionMatch.index + 1).trim();
    if (questionText.length > 1) {
      signals.push({
        type: 'question',
        text: questionText,
        position: questionStart,
        severity: 0.8,
      });
    }
  }

  // Detect low confidence phrases
  for (const { pattern, severity } of LOW_CONFIDENCE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      signals.push({
        type: 'low_confidence',
        text: match[0],
        position: match.index,
        severity,
      });
    }
  }

  // Detect unknown entities (PascalCase identifiers)
  UNKNOWN_ENTITY_PATTERN.lastIndex = 0;
  let entityMatch: RegExpExecArray | null;
  while ((entityMatch = UNKNOWN_ENTITY_PATTERN.exec(text)) !== null) {
    const entity = entityMatch[1];

    // Skip if it matches a known entity pattern
    const isKnown = KNOWN_ENTITY_PATTERNS.some(pattern => pattern.test(entity));
    if (isKnown) {
      continue;
    }

    // Check for "Unknown" or uncommon prefixes
    const hasUnknownPrefix = entity.startsWith('Unknown') || entity.startsWith('Xyz');
    const severity = hasUnknownPrefix ? 0.85 : 0.6;

    signals.push({
      type: 'unknown_entity',
      text: entity,
      position: entityMatch.index,
      severity,
    });
  }

  // Detect vague quantifiers
  for (const { pattern, severity } of VAGUE_QUANTIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      signals.push({
        type: 'vague_quantifier',
        text: match[0],
        position: match.index,
        severity,
      });
    }
  }

  // Sort by position
  signals.sort((a, b) => a.position - b.position);

  return signals;
}

/**
 * Detect whether retrieval is needed based on context and generated text.
 *
 * Analyzes the generated text for uncertainty signals and determines
 * whether additional retrieval would be beneficial.
 *
 * @param context - The preceding context
 * @param generatedText - The text being generated
 * @param config - Optional configuration override
 * @returns Decision about whether retrieval should be triggered
 *
 * @example
 * ```typescript
 * const decision = detectRetrievalNeed(
 *   "Find the authentication handler",
 *   "Maybe the AuthHandler processes this?"
 * );
 * // decision.shouldRetrieve === true
 * ```
 */
export function detectRetrievalNeed(
  context: string,
  generatedText: string,
  config: Partial<DRAGINConfig> = {}
): RetrievalDecision {
  const fullConfig = { ...DEFAULT_DRAGIN_CONFIG, ...config };

  // Get uncertainty signals
  const signals = computeUncertaintySignals(generatedText);

  // Filter by minimum severity
  const significantSignals = signals.filter(
    s => s.severity >= fullConfig.minSignalSeverity
  );

  // Calculate aggregate uncertainty
  let aggregateUncertainty = 0;
  if (significantSignals.length > 0) {
    // Weighted average based on severity
    const totalWeight = significantSignals.reduce((sum, s) => sum + s.severity, 0);
    aggregateUncertainty = totalWeight / significantSignals.length;

    // Boost for multiple signals
    const signalCountBoost = Math.min(significantSignals.length * 0.05, 0.2);
    aggregateUncertainty = Math.min(1, aggregateUncertainty + signalCountBoost);
  }

  // Make retrieval decision
  const shouldRetrieve = aggregateUncertainty >= fullConfig.uncertaintyThreshold;

  // Generate reason
  let reason: string;
  if (shouldRetrieve) {
    const signalTypes = Array.from(new Set(significantSignals.map(s => s.type)));
    reason = `Detected uncertainty (${signalTypes.join(', ')}) exceeding threshold. ` +
      `Aggregate uncertainty: ${(aggregateUncertainty * 100).toFixed(1)}%`;
  } else if (significantSignals.length === 0) {
    reason = 'No significant uncertainty signals detected in the generated text.';
  } else {
    reason = `Uncertainty below threshold (${(aggregateUncertainty * 100).toFixed(1)}% < ` +
      `${(fullConfig.uncertaintyThreshold * 100).toFixed(1)}%).`;
  }

  // Calculate decision confidence
  // Higher confidence when there's a clear signal or clear absence
  let confidence: number;
  if (significantSignals.length === 0) {
    confidence = 0.9; // High confidence in no-retrieval decision
  } else {
    // Confidence based on how far from threshold
    const distanceFromThreshold = Math.abs(aggregateUncertainty - fullConfig.uncertaintyThreshold);
    confidence = Math.min(0.95, 0.5 + distanceFromThreshold);
  }

  return {
    shouldRetrieve,
    reason,
    signals: significantSignals,
    confidence,
  };
}

/**
 * Generate a retrieval query based on uncertainty signals.
 *
 * Creates a focused query that targets the areas of uncertainty
 * identified in the text.
 *
 * @param originalQuery - The original query/context
 * @param signals - Detected uncertainty signals
 * @param config - Optional configuration override
 * @returns Query information for retrieval
 *
 * @example
 * ```typescript
 * const result = triggerDynamicRetrieval(
 *   "Find the database handler",
 *   [{ type: 'unknown_entity', text: 'XyzHandler', ... }]
 * );
 * // result.query includes "XyzHandler"
 * ```
 */
export function triggerDynamicRetrieval(
  originalQuery: string,
  signals: UncertaintySignal[],
  config: Partial<DRAGINConfig> = {}
): DynamicRetrievalResult {
  const fullConfig = { ...DEFAULT_DRAGIN_CONFIG, ...config };

  const queryTerms: string[] = [];
  const contributingSignals: UncertaintySignal[] = [];

  // Sort signals by severity (highest first)
  const sortedSignals = [...signals].sort((a, b) => b.severity - a.severity);

  // Extract query terms from signals
  for (const signal of sortedSignals) {
    if (signal.type === 'unknown_entity') {
      // Unknown entities make great search terms
      queryTerms.push(signal.text);
      contributingSignals.push(signal);
    } else if (signal.type === 'hedging' || signal.type === 'low_confidence') {
      // For hedging/low confidence, the text itself isn't useful for query
      // but we note it contributed to the retrieval decision
      contributingSignals.push(signal);
    } else if (signal.type === 'question') {
      // Extract keywords from questions
      const questionKeywords = extractKeywordsFromQuestion(signal.text);
      queryTerms.push(...questionKeywords);
      contributingSignals.push(signal);
    } else if (signal.type === 'vague_quantifier') {
      contributingSignals.push(signal);
    }
  }

  // Add context terms from original query
  const contextTerms = extractKeywords(originalQuery);
  queryTerms.push(...contextTerms);

  // Deduplicate and build query
  const uniqueTerms = Array.from(new Set(queryTerms));
  let query = uniqueTerms.join(' ');

  // Truncate if too long
  if (query.length > fullConfig.maxQueryLength) {
    query = query.slice(0, fullConfig.maxQueryLength);
    // Trim to last complete word
    const lastSpace = query.lastIndexOf(' ');
    if (lastSpace > 0) {
      query = query.slice(0, lastSpace);
    }
  }

  return {
    query: query.trim() || originalQuery,
    contributingSignals,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract keywords from a question text.
 */
function extractKeywordsFromQuestion(question: string): string[] {
  // Remove question marks and common question words
  const cleaned = question
    .replace(/[?!.,;:'"()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');

  // Filter out common question words and stop words
  const stopWords = new Set([
    'what', 'where', 'when', 'why', 'how', 'which', 'who', 'whom',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'this', 'that', 'these', 'those',
    'it', 'its', 'i', 'we', 'you', 'they', 'he', 'she',
  ]);

  return words.filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
}

/**
 * Extract keywords from text.
 */
function extractKeywords(text: string): string[] {
  const cleaned = text
    .replace(/[?!.,;:'"()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'find', 'how',
    'what', 'where', 'when', 'why', 'which', 'who', 'that', 'this', 'these',
    'those', 'it', 'its', 'i', 'we', 'you', 'they',
  ]);

  return words.filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
}

// ============================================================================
// DRAGIN RETRIEVER CLASS
// ============================================================================

/**
 * DRAGIN (Dynamic Retrieval Augmented Generation based on Information Needs)
 * retriever implementation.
 *
 * Monitors generated text for uncertainty signals and triggers retrieval
 * dynamically when the model appears to need more information.
 *
 * @example
 * ```typescript
 * const retriever = createDRAGINRetriever({
 *   uncertaintyThreshold: 0.6,
 * });
 *
 * const result = await retriever.processGeneration(
 *   "Find the database handler",
 *   "Maybe the XyzHandler processes this?"
 * );
 *
 * if (result.retrievalTriggered) {
 *   console.log("Retrieved context:", result.retrievedContext);
 * }
 * ```
 */
export class DRAGINRetriever {
  private readonly config: DRAGINConfig;

  /**
   * Create a new DRAGINRetriever.
   *
   * @param config - Optional partial configuration (merged with defaults)
   */
  constructor(config?: Partial<DRAGINConfig>) {
    this.config = { ...DEFAULT_DRAGIN_CONFIG, ...config };
  }

  /**
   * Get the current configuration.
   *
   * @returns A copy of the current configuration
   */
  getConfig(): DRAGINConfig {
    return { ...this.config };
  }

  /**
   * Process a generation and determine if retrieval is needed.
   *
   * @param context - The preceding context
   * @param generatedText - The text being generated
   * @returns Result including retrieval decision and any retrieved context
   */
  async processGeneration(
    context: string,
    generatedText: string
  ): Promise<ActiveRetrievalResult> {
    // Handle empty generated text
    if (!generatedText || generatedText.trim().length === 0) {
      return {
        originalText: generatedText,
        revisedText: generatedText,
        retrievalTriggered: false,
        retrievedContext: [],
        signals: [],
      };
    }

    // Analyze uncertainty
    const signals = this.analyzeUncertainty(generatedText);

    // Check if retrieval should be triggered
    const shouldRetrieve = this.shouldRetrieve(signals);

    let retrievedContext: string[] = [];
    let revisedText = generatedText;

    if (shouldRetrieve) {
      // Generate query and perform retrieval
      const retrievalResult = triggerDynamicRetrieval(context, signals, this.config);

      // In a real implementation, this would call the actual retrieval system
      // For now, we simulate with empty results (Tier-0 mode)
      retrievedContext = [];

      // In a full implementation, we would:
      // 1. Retrieve relevant documents
      // 2. Potentially revise the generated text based on retrieved content
      // For now, revised text stays the same
      revisedText = generatedText;
    }

    return {
      originalText: generatedText,
      revisedText,
      retrievalTriggered: shouldRetrieve,
      retrievedContext,
      signals,
    };
  }

  /**
   * Analyze text for uncertainty signals.
   *
   * @param text - The text to analyze
   * @returns Filtered signals based on configuration
   */
  analyzeUncertainty(text: string): UncertaintySignal[] {
    const allSignals = computeUncertaintySignals(text);

    // Filter by minimum severity
    return allSignals.filter(s => s.severity >= this.config.minSignalSeverity);
  }

  /**
   * Determine if retrieval should be triggered based on signals.
   *
   * @param signals - The detected uncertainty signals
   * @returns True if retrieval should be triggered
   */
  shouldRetrieve(signals: UncertaintySignal[]): boolean {
    if (signals.length === 0) {
      return false;
    }

    // Calculate aggregate uncertainty
    const totalWeight = signals.reduce((sum, s) => sum + s.severity, 0);
    const avgUncertainty = totalWeight / signals.length;

    // Boost for multiple signals
    const signalCountBoost = Math.min(signals.length * 0.05, 0.2);
    const aggregateUncertainty = Math.min(1, avgUncertainty + signalCountBoost);

    return aggregateUncertainty >= this.config.uncertaintyThreshold;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new DRAGINRetriever instance.
 *
 * @param config - Optional partial configuration (merged with defaults)
 * @returns A new DRAGINRetriever instance
 *
 * @example
 * ```typescript
 * // Use default configuration
 * const retriever = createDRAGINRetriever();
 *
 * // Custom threshold for stricter retrieval
 * const strictRetriever = createDRAGINRetriever({
 *   uncertaintyThreshold: 0.7,
 *   minSignalSeverity: 0.5,
 * });
 * ```
 */
export function createDRAGINRetriever(
  config?: Partial<DRAGINConfig>
): DRAGINRetriever {
  return new DRAGINRetriever(config);
}
