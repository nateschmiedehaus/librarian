/**
 * @fileoverview Search-Augmented Factual Evaluation (SAFE)
 *
 * Based on DeepMind's SAFE paper (NeurIPS 2024), this module verifies claims
 * by searching for corroborating evidence in the codebase. This approach provides
 * 20x cheaper verification than human annotation while maintaining high accuracy.
 *
 * Key concepts:
 * - Decompose claims into atomic searchable facts
 * - Search codebase for evidence of each fact
 * - Aggregate evidence into verification verdict
 *
 * Unlike CitationVerifier (which validates existing citations), SAFE actively
 * searches for evidence to verify claims.
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { createASTFactExtractor, type ASTFact } from './ast_fact_extractor.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of atomic facts that can be extracted from claims
 */
export type FactType = 'existence' | 'property' | 'relationship' | 'behavior';

/**
 * Search strategies for finding evidence
 */
export type SearchStrategy = 'exact_symbol' | 'fuzzy_text' | 'structural' | 'semantic';

/**
 * An atomic fact extracted from a claim
 */
export interface AtomicFact {
  /** Unique identifier for this fact */
  id: string;
  /** The text of the atomic fact */
  text: string;
  /** The type of fact */
  type: FactType;
  /** Whether this fact can be verified by searching */
  searchable: boolean;
}

/**
 * A search result from the codebase
 */
export interface SearchResult {
  /** The file where evidence was found */
  file: string;
  /** The line number (1-based) */
  line: number;
  /** The content at that location */
  content: string;
  /** Relevance score from 0 to 1 */
  relevanceScore: number;
}

/**
 * Verification result for a single atomic fact
 */
export interface FactVerification {
  /** The fact being verified */
  fact: AtomicFact;
  /** Evidence found for this fact */
  evidence: SearchResult[];
  /** The verification verdict */
  verdict: 'supported' | 'refuted' | 'insufficient_evidence';
  /** Confidence in the verdict (0-1) */
  confidence: number;
}

/**
 * Overall SAFE verification result
 */
export interface SAFEResult {
  /** The original claim being verified */
  originalClaim: string;
  /** Atomic facts extracted from the claim */
  facts: AtomicFact[];
  /** Verification results for each fact */
  verifications: FactVerification[];
  /** Overall verdict */
  overallVerdict: 'verified' | 'refuted' | 'partially_verified' | 'unverifiable';
  /** Proportion of facts supported (0-1) */
  supportRate: number;
}

/**
 * Configuration for SAFE verifier
 */
export interface SAFEConfig {
  /** Maximum number of search results per query */
  maxSearchResults?: number;
  /** Minimum relevance score to consider */
  minRelevanceScore?: number;
  /** Search strategies to use */
  searchStrategies?: SearchStrategy[];
  /** File extensions to search */
  fileExtensions?: string[];
}

/**
 * Options for search operations
 */
export interface SearchOptions {
  /** Maximum results to return */
  maxResults?: number;
  /** Minimum relevance score */
  minRelevance?: number;
  /** File extensions to include */
  extensions?: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default SAFE configuration
 */
export const DEFAULT_SAFE_CONFIG: Required<SAFEConfig> = {
  maxSearchResults: 10,
  minRelevanceScore: 0.3,
  searchStrategies: ['exact_symbol', 'fuzzy_text', 'structural'],
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
};

// ============================================================================
// CLAIM DECOMPOSITION
// ============================================================================

// Patterns for identifying claim types
const EXISTENCE_PATTERNS = [
  /(?:the\s+)?(?:`)?(\w+)(?:`)?\s+(?:class|function|method|interface|type|module|file|component)\s+exists/i,
  /(?:there\s+is\s+a\s+)?(?:class|function|method|interface|type)\s+(?:named\s+|called\s+)?(?:`)?(\w+)(?:`)?/i,
  /(?:`)?(\w+)(?:`)?\s+(?:is\s+(?:a|an)\s+)?(?:class|function|method|interface|type)/i,
];

const PROPERTY_PATTERNS = [
  /(?:`)?(\w+)(?:`)?\s+(?:has|takes|accepts|returns|contains)\s+(?:a\s+)?(?:`)?(\w+)(?:`)?/i,
  /(?:`)?(\w+)(?:`)?\s+(?:method|function|parameter|property)\s+(?:is\s+)?(?:`)?(\w+)(?:`)?/i,
  /(?:the\s+)?(?:`)?(\w+)(?:`)?\s+(?:parameter|property)\s+(?:of\s+type\s+)?(?:`)?(\w+)(?:`)?/i,
];

const RELATIONSHIP_PATTERNS = [
  /(?:`)?(\w+)(?:`)?\s+(?:extends|implements|inherits\s+from|imports|uses|depends\s+on)\s+(?:`)?(\w+)(?:`)?/i,
  /(?:`)?(\w+)(?:`)?\s+(?:is\s+imported\s+from|comes\s+from)\s+(?:`)?([^`]+)(?:`)?/i,
  /(?:import|from)\s+(?:`)?([^`]+)(?:`)?/i,
];

const BEHAVIOR_PATTERNS = [
  /(?:`)?(\w+)(?:`)?\s+(?:calls|invokes|triggers|emits|handles|processes)\s+(?:`)?(\w+)(?:`)?/i,
  /(?:`)?(\w+)(?:`)?\s+(?:recursively|asynchronously|synchronously)\s+/i,
];

const SUBJECTIVE_PATTERNS = [
  /(?:well-designed|efficient|elegant|beautiful|clean|messy|ugly|complex|simple|fast|slow)/i,
  /(?:should|could|might|may)\s+be/i,
  /(?:is\s+)?(?:good|bad|better|worse|best|worst)/i,
];

/**
 * Decompose a claim into atomic searchable facts
 */
export function decomposeClaim(claim: string): AtomicFact[] {
  if (!claim || !claim.trim()) {
    return [];
  }

  const facts: AtomicFact[] = [];
  let factId = 0;

  // Extract identifiers from backticks
  const backtickIdentifiers = extractBacktickIdentifiers(claim);

  // Check if claim is subjective
  const isSubjective = SUBJECTIVE_PATTERNS.some((p) => p.test(claim));

  // Try to match existence patterns
  for (const pattern of EXISTENCE_PATTERNS) {
    const match = claim.match(pattern);
    if (match) {
      facts.push({
        id: `fact-${++factId}`,
        text: match[0],
        type: 'existence',
        searchable: !isSubjective,
      });
    }
  }

  // Try to match property patterns
  for (const pattern of PROPERTY_PATTERNS) {
    const match = claim.match(pattern);
    if (match) {
      facts.push({
        id: `fact-${++factId}`,
        text: match[0],
        type: 'property',
        searchable: !isSubjective,
      });
    }
  }

  // Try to match relationship patterns
  for (const pattern of RELATIONSHIP_PATTERNS) {
    const match = claim.match(pattern);
    if (match) {
      facts.push({
        id: `fact-${++factId}`,
        text: match[0],
        type: 'relationship',
        searchable: !isSubjective,
      });
    }
  }

  // Try to match behavior patterns
  for (const pattern of BEHAVIOR_PATTERNS) {
    const match = claim.match(pattern);
    if (match) {
      facts.push({
        id: `fact-${++factId}`,
        text: match[0],
        type: 'behavior',
        searchable: !isSubjective,
      });
    }
  }

  // If no patterns matched but we have identifiers, create existence facts
  if (facts.length === 0 && backtickIdentifiers.length > 0) {
    for (const identifier of backtickIdentifiers) {
      facts.push({
        id: `fact-${++factId}`,
        text: `${identifier} exists`,
        type: 'existence',
        searchable: !isSubjective,
      });
    }
  }

  // If still no facts and claim is subjective, create an unsearchable fact
  if (facts.length === 0 && isSubjective) {
    facts.push({
      id: `fact-${++factId}`,
      text: claim,
      type: 'property',
      searchable: false,
    });
  }

  // If still no facts, try to extract from the whole claim
  if (facts.length === 0) {
    const identifiers = extractIdentifiers(claim);
    if (identifiers.length > 0) {
      for (const id of identifiers) {
        facts.push({
          id: `fact-${++factId}`,
          text: `${id} exists`,
          type: 'existence',
          searchable: true,
        });
      }
    }
  }

  // Deduplicate facts by text
  const seen = new Set<string>();
  return facts.filter((f) => {
    const key = f.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract identifiers from backtick-quoted text
 */
function extractBacktickIdentifiers(text: string): string[] {
  const matches = text.matchAll(/`(\w+)`/g);
  return [...matches].map((m) => m[1]);
}

/**
 * Extract potential identifiers from text
 */
function extractIdentifiers(text: string): string[] {
  const identifiers: string[] = [];

  // CamelCase identifiers
  const camelCase = text.matchAll(/\b([A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*)\b/g);
  for (const match of camelCase) {
    if (!isCommonWord(match[1])) {
      identifiers.push(match[1]);
    }
  }

  // snake_case identifiers
  const snakeCase = text.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g);
  for (const match of snakeCase) {
    identifiers.push(match[1]);
  }

  return [...new Set(identifiers)];
}

/**
 * Check if a word is a common English word (not an identifier)
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'Some', 'Any', 'All', 'Each',
    'Class', 'Method', 'Function', 'Type', 'Interface', 'Module', 'File',
    'Has', 'Takes', 'Returns', 'Uses', 'Calls', 'Contains', 'Exists',
    'And', 'Or', 'But', 'Not', 'From', 'Into', 'With', 'Without',
  ]);
  return commonWords.has(word);
}

// ============================================================================
// SEARCH QUERY GENERATION
// ============================================================================

/**
 * Generate search queries for an atomic fact
 */
export function generateSearchQueries(fact: AtomicFact): string[] {
  if (!fact.searchable) {
    return [];
  }

  const queries: string[] = [];
  const text = fact.text;

  // Extract identifiers from the fact
  const backtickIds = extractBacktickIdentifiers(text);
  const camelCaseIds = extractIdentifiers(text);
  const allIds = [...new Set([...backtickIds, ...camelCaseIds])];

  // Also extract identifiers directly from text using word boundaries
  const wordMatches = text.match(/\b([A-Z][a-zA-Z0-9]+|[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g);
  if (wordMatches) {
    for (const word of wordMatches) {
      if (!isCommonWord(word) && !allIds.includes(word)) {
        allIds.push(word);
      }
    }
  }

  // Generate queries based on fact type
  switch (fact.type) {
    case 'existence':
      // Exact symbol search
      for (const id of allIds) {
        queries.push(`class ${id}`);
        queries.push(`function ${id}`);
        queries.push(`interface ${id}`);
        queries.push(`type ${id}`);
        queries.push(id);
      }
      break;

    case 'property':
      // Property/parameter search
      for (const id of allIds) {
        queries.push(id);
      }
      // Look for parameter patterns
      if (text.match(/parameter|takes|accepts/i)) {
        const paramMatch = text.match(/(?:`)?(\w+)(?:`)?\s+parameter/i);
        if (paramMatch) {
          queries.push(paramMatch[1]);
        }
      }
      break;

    case 'relationship':
      // Import/extends search
      if (text.match(/extends/i)) {
        const match = text.match(/(?:`)?(\w+)(?:`)?\s+extends\s+(?:`)?(\w+)(?:`)?/i);
        if (match) {
          queries.push(`class ${match[1]} extends ${match[2]}`);
          queries.push(`extends ${match[2]}`);
        }
      }
      if (text.match(/import|from|uses/i)) {
        const match = text.match(/import.*from\s+['"]?([^'"]+)['"]?/i);
        if (match) {
          queries.push(`from '${match[1]}'`);
          queries.push(`from "${match[1]}"`);
        }
        // Check for "uses X" pattern
        const usesMatch = text.match(/uses\s+(?:`)?(\w+[-\w]*)(?:`)?/i);
        if (usesMatch) {
          queries.push(`import.*${usesMatch[1]}`);
          queries.push(`from ['"]${usesMatch[1]}`);
          queries.push(usesMatch[1]);
        }
        for (const id of allIds) {
          queries.push(`import.*${id}`);
        }
      }
      for (const id of allIds) {
        queries.push(id);
      }
      break;

    case 'behavior':
      // Function call patterns
      for (const id of allIds) {
        queries.push(id);
        queries.push(`${id}(`);
      }
      break;
  }

  // Add fuzzy queries
  for (const id of allIds) {
    if (id.length > 3) {
      queries.push(id);
    }
  }

  // Deduplicate and filter empty
  return [...new Set(queries)].filter((q) => q.trim().length > 0);
}

// ============================================================================
// EVIDENCE SEARCH
// ============================================================================

/**
 * Search for evidence in the codebase
 */
export async function searchForEvidence(
  query: string,
  codebasePath: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const maxResults = options.maxResults ?? 10;
  const extensions = options.extensions ?? ['.ts', '.tsx', '.js', '.jsx'];

  try {
    if (!fs.existsSync(codebasePath) || !fs.statSync(codebasePath).isDirectory()) {
      return [];
    }

    const results: SearchResult[] = [];
    const files = getCodeFiles(codebasePath, extensions);

    // Escape special regex characters for safe pattern matching
    const escapedQuery = escapeRegex(query);
    const pattern = new RegExp(escapedQuery, 'gi');

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (pattern.test(line)) {
            const relevance = calculateRelevance(query, line);
            results.push({
              file,
              line: i + 1,
              content: line.trim(),
              relevanceScore: relevance,
            });
          }
          // Reset regex lastIndex for global patterns
          pattern.lastIndex = 0;
        }
      } catch {
        // Skip files that can't be read
        continue;
      }

      // Early exit if we have enough results
      if (results.length >= maxResults * 2) {
        break;
      }
    }

    // Sort by relevance and return top results
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results.slice(0, maxResults);
  } catch {
    return [];
  }
}

/**
 * Get all code files in a directory recursively
 */
function getCodeFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  const walk = (currentDir: string) => {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // Skip common non-code directories
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  };

  walk(dir);
  return files;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate relevance score for a match
 */
function calculateRelevance(query: string, content: string): number {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();

  // Exact match gets highest score
  if (contentLower.includes(queryLower)) {
    // Calculate what fraction of the content is the query
    const matchRatio = queryLower.length / contentLower.length;
    return Math.min(1, 0.5 + matchRatio * 0.5);
  }

  // Partial word matches
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  const matchedWords = queryWords.filter((w) => contentLower.includes(w));
  return matchedWords.length / Math.max(queryWords.length, 1) * 0.5;
}

// ============================================================================
// EVIDENCE EVALUATION
// ============================================================================

/**
 * Evaluate whether evidence supports a fact
 */
export function evaluateEvidence(fact: AtomicFact, evidence: SearchResult[]): FactVerification {
  if (evidence.length === 0) {
    return {
      fact,
      evidence,
      verdict: 'insufficient_evidence',
      confidence: 0.2,
    };
  }

  // Check if evidence supports or refutes the fact
  const factText = fact.text.toLowerCase();
  const identifiers = extractBacktickIdentifiers(fact.text);
  const allIdentifiers = [...identifiers, ...extractIdentifiers(fact.text)];

  // Calculate support based on evidence quality
  let supportScore = 0;
  let refuteScore = 0;
  let relevantEvidenceCount = 0;

  for (const ev of evidence) {
    const contentLower = ev.content.toLowerCase();

    // Check if the primary identifier is present
    const primaryFound = allIdentifiers.some((id) =>
      contentLower.includes(id.toLowerCase())
    );

    if (!primaryFound) {
      continue;
    }

    relevantEvidenceCount++;

    // Check for relationship evidence
    if (fact.type === 'relationship') {
      // Check extends/implements claims
      if (factText.includes('extends')) {
        const extendsMatch = factText.match(/extends\s+(?:`)?(\w+)(?:`)?/i);
        if (extendsMatch) {
          const expectedParent = extendsMatch[1].toLowerCase();
          if (contentLower.includes('extends') && contentLower.includes(expectedParent)) {
            supportScore += ev.relevanceScore;
          } else if (contentLower.includes('extends') && !contentLower.includes(expectedParent)) {
            refuteScore += ev.relevanceScore * 0.8;
          } else if (!contentLower.includes('extends') && contentLower.includes('class')) {
            // Class found but no extends clause - strong refutation
            refuteScore += ev.relevanceScore * 0.7;
          }
        }
      } else {
        // Other relationship types
        supportScore += ev.relevanceScore;
      }
    } else {
      // For existence and property facts, presence is support
      supportScore += ev.relevanceScore;
    }
  }

  // Determine verdict based on accumulated scores
  let verdict: FactVerification['verdict'];
  let confidence: number;

  // Calculate average scores
  const avgSupport = relevantEvidenceCount > 0 ? supportScore / relevantEvidenceCount : 0;
  const avgRefute = relevantEvidenceCount > 0 ? refuteScore / relevantEvidenceCount : 0;

  if (supportScore > refuteScore && avgSupport > 0.3) {
    verdict = 'supported';
    confidence = Math.min(0.95, avgSupport + 0.3);
  } else if (refuteScore > supportScore && avgRefute > 0.2) {
    verdict = 'refuted';
    confidence = Math.min(0.95, avgRefute + 0.3);
  } else if (relevantEvidenceCount > 0 && supportScore > 0) {
    // Some support but not strong enough - still better than insufficient
    verdict = 'supported';
    confidence = Math.max(0.4, avgSupport + 0.2);
  } else {
    verdict = 'insufficient_evidence';
    confidence = Math.max(0.2, Math.max(avgSupport, avgRefute));
  }

  return {
    fact,
    evidence,
    verdict,
    confidence,
  };
}

// ============================================================================
// VERDICT AGGREGATION
// ============================================================================

/**
 * Intermediate result for aggregation (internal use)
 */
interface AggregationResult {
  overallVerdict: SAFEResult['overallVerdict'];
  supportRate: number;
}

/**
 * Aggregate fact verifications into overall verdict
 */
export function aggregateVerdict(verifications: FactVerification[]): AggregationResult {
  if (verifications.length === 0) {
    return {
      overallVerdict: 'unverifiable',
      supportRate: 0,
    };
  }

  const searchableFacts = verifications.filter((v) => v.fact.searchable);

  if (searchableFacts.length === 0) {
    return {
      overallVerdict: 'unverifiable',
      supportRate: 0,
    };
  }

  const supportedCount = searchableFacts.filter((v) => v.verdict === 'supported').length;
  const refutedCount = searchableFacts.filter((v) => v.verdict === 'refuted').length;
  const supportRate = supportedCount / searchableFacts.length;

  let overallVerdict: SAFEResult['overallVerdict'];

  if (refutedCount > 0) {
    overallVerdict = 'refuted';
  } else if (supportedCount === searchableFacts.length) {
    overallVerdict = 'verified';
  } else if (supportedCount > 0) {
    overallVerdict = 'partially_verified';
  } else {
    overallVerdict = 'unverifiable';
  }

  return {
    overallVerdict,
    supportRate,
  };
}

// ============================================================================
// SAFE VERIFIER CLASS
// ============================================================================

/**
 * Search-Augmented Factual Evaluation verifier
 *
 * Based on DeepMind's SAFE paper, this class orchestrates the verification
 * process: decomposing claims, searching for evidence, and aggregating results.
 */
export class SAFEVerifier {
  private config: Required<SAFEConfig>;
  private astExtractor: ReturnType<typeof createASTFactExtractor>;

  constructor(config: SAFEConfig = {}) {
    this.config = {
      ...DEFAULT_SAFE_CONFIG,
      ...config,
    };
    this.astExtractor = createASTFactExtractor();
  }

  /**
   * Verify a claim by searching for evidence in the codebase
   */
  async verify(claim: string, codebasePath: string): Promise<SAFEResult> {
    // Step 1: Decompose claim into atomic facts
    const facts = decomposeClaim(claim);

    if (facts.length === 0) {
      return {
        originalClaim: claim,
        facts: [],
        verifications: [],
        overallVerdict: 'unverifiable',
        supportRate: 0,
      };
    }

    // Step 2: Verify each fact
    const verifications: FactVerification[] = [];

    for (const fact of facts) {
      const verification = await this.verifyFact(fact, codebasePath);
      verifications.push(verification);
    }

    // Step 3: Aggregate results
    const { overallVerdict, supportRate } = aggregateVerdict(verifications);

    return {
      originalClaim: claim,
      facts,
      verifications,
      overallVerdict,
      supportRate,
    };
  }

  /**
   * Verify multiple claims in batch
   */
  async verifyBatch(claims: string[], codebasePath: string): Promise<SAFEResult[]> {
    const results: SAFEResult[] = [];

    for (const claim of claims) {
      const result = await this.verify(claim, codebasePath);
      results.push(result);
    }

    return results;
  }

  /**
   * Verify a single atomic fact
   */
  private async verifyFact(fact: AtomicFact, codebasePath: string): Promise<FactVerification> {
    if (!fact.searchable) {
      return {
        fact,
        evidence: [],
        verdict: 'insufficient_evidence',
        confidence: 0.1,
      };
    }

    // Generate search queries
    const queries = generateSearchQueries(fact);

    // Search for evidence
    const allEvidence: SearchResult[] = [];
    const seenLocations = new Set<string>();

    for (const query of queries) {
      const results = await searchForEvidence(query, codebasePath, {
        maxResults: this.config.maxSearchResults,
        extensions: this.config.fileExtensions,
      });

      for (const result of results) {
        const key = `${result.file}:${result.line}`;
        if (!seenLocations.has(key) && result.relevanceScore >= this.config.minRelevanceScore) {
          seenLocations.add(key);
          allEvidence.push(result);
        }
      }

      // Limit total evidence
      if (allEvidence.length >= this.config.maxSearchResults * 2) {
        break;
      }
    }

    // Sort by relevance and take top results
    allEvidence.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topEvidence = allEvidence.slice(0, this.config.maxSearchResults);

    // Evaluate evidence
    return evaluateEvidence(fact, topEvidence);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new SAFEVerifier instance
 */
export function createSAFEVerifier(config?: SAFEConfig): SAFEVerifier {
  return new SAFEVerifier(config);
}
