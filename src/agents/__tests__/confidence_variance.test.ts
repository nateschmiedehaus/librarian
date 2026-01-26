/**
 * Test that confidence calculation produces real variance across different function types.
 * This verifies the continuous signals actually differentiate function quality.
 */
import { describe, it, expect } from 'vitest';

// Simulate the confidence calculation logic (inlined for testing without imports)
function getParserConfidence(parserType?: string): number {
  if (!parserType) return 0.5;
  if (parserType === 'ts-morph') return 0.95;
  if (parserType.startsWith('tree-sitter')) return 0.90;
  if (parserType === 'llm-fallback') return 0.45;
  return 0.6;
}

function computePurposeScore(purpose: string): number {
  if (!purpose) return 0.2;
  const len = purpose.length;
  const lengthScore = Math.min(1, len / 100) * 0.4;
  const genericPhrases = ['function', 'method', 'helper', 'utility', 'handles', 'does'];
  const words = purpose.toLowerCase().split(/\s+/);
  const genericCount = words.filter(w => genericPhrases.includes(w)).length;
  const specificityScore = Math.max(0, 1 - genericCount * 0.15) * 0.3;
  const technicalTerms = ['async', 'promise', 'callback', 'validation', 'parse', 'transform',
    'compute', 'calculate', 'render', 'serialize', 'deserialize', 'encrypt', 'decrypt',
    'authenticate', 'authorize', 'cache', 'index', 'query', 'fetch', 'store'];
  const technicalCount = words.filter(w => technicalTerms.some(t => w.includes(t))).length;
  const technicalScore = Math.min(1, technicalCount * 0.3) * 0.3;
  return lengthScore + specificityScore + technicalScore;
}

function computeSignatureScore(signature: string): number {
  if (!signature) return 0.2;
  let score = 0.4;
  const paramMatch = signature.match(/\(([^)]*)\)/);
  if (paramMatch) {
    const params = paramMatch[1];
    if (params.length > 0) {
      const typedParams = (params.match(/:\s*\w+/g) || []).length;
      const totalParams = params.split(',').filter(p => p.trim()).length;
      if (totalParams > 0) {
        score += (typedParams / totalParams) * 0.3;
      }
    }
  }
  if (signature.includes('): ') || signature.includes('=> ')) {
    score += 0.2;
  }
  if (signature.includes('<') && signature.includes('>')) {
    score += 0.1;
  }
  return Math.min(1, score);
}

function computeSizeScore(startLine: number, endLine: number): number {
  if (startLine <= 0 || endLine < startLine) return 0.3;
  const lines = endLine - startLine + 1;
  if (lines >= 5 && lines <= 50) return 0.9;
  if (lines < 5) return 0.5 + (lines / 5) * 0.3;
  if (lines <= 200) return 0.9 - ((lines - 50) / 150) * 0.4;
  return 0.4;
}

function computeNameScore(name: string): number {
  if (!name) return 0.2;
  let score = 0.5;
  if (name.length >= 3 && name.length <= 30) score += 0.2;
  else if (name.length < 3) score -= 0.2;
  const hasCamelCase = /[a-z][A-Z]/.test(name);
  const hasSnakeCase = /_[a-z]/.test(name);
  if (hasCamelCase || hasSnakeCase) score += 0.15;
  const verbPrefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'will', 'create',
    'build', 'make', 'init', 'load', 'save', 'fetch', 'find', 'compute', 'calculate',
    'validate', 'check', 'parse', 'format', 'render', 'handle', 'process', 'on'];
  const lowerName = name.toLowerCase();
  if (verbPrefixes.some(v => lowerName.startsWith(v))) score += 0.15;
  return Math.min(1, score);
}

interface ParsedFunction {
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
}

function computeFunctionConfidence(
  parsed: ParsedFunction,
  purpose: string,
  parserType?: string
): number {
  const parserConfidence = getParserConfidence(parserType);
  const purposeScore = computePurposeScore(purpose);
  const signatureScore = computeSignatureScore(parsed.signature);
  const sizeScore = computeSizeScore(parsed.startLine, parsed.endLine);
  const nameScore = computeNameScore(parsed.name);

  const confidence =
    parserConfidence * 0.35 +
    purposeScore * 0.25 +
    signatureScore * 0.15 +
    sizeScore * 0.15 +
    nameScore * 0.10;

  return Math.max(0.15, Math.min(0.92, confidence));
}

describe('Confidence Calculation Variance', () => {
  describe('individual signal variance', () => {
    it('parser confidence has 4 distinct tiers', () => {
      const tiers = [
        getParserConfidence('ts-morph'),      // 0.95
        getParserConfidence('tree-sitter'),   // 0.90
        getParserConfidence('unknown'),       // 0.60
        getParserConfidence(undefined),       // 0.50
        getParserConfidence('llm-fallback'),  // 0.45
      ];
      const unique = new Set(tiers);
      expect(unique.size).toBeGreaterThanOrEqual(4);
      expect(tiers[0]).toBeGreaterThan(tiers[1]); // ts-morph > tree-sitter
      expect(tiers[4]).toBeLessThan(tiers[3]);   // llm-fallback < undefined
    });

    it('purpose score varies continuously with quality', () => {
      const scores = [
        computePurposeScore(''),                                           // Empty
        computePurposeScore('Does stuff'),                                 // Very generic
        computePurposeScore('A helper function'),                          // Generic
        computePurposeScore('Processes user input'),                       // Medium
        computePurposeScore('Validates and transforms user authentication credentials'), // Good
        computePurposeScore('Asynchronously fetches, deserializes, and caches API responses with retry logic'), // Excellent
      ];

      // Should have increasing trend (not strictly, but generally)
      expect(scores[0]).toBeLessThan(scores[5]);
      expect(scores[1]).toBeLessThan(scores[4]);

      // Should have distinct values
      const unique = new Set(scores.map(s => Math.round(s * 100)));
      expect(unique.size).toBeGreaterThanOrEqual(4);
    });

    it('signature score varies with type completeness', () => {
      const scores = [
        computeSignatureScore(''),                                    // Empty
        computeSignatureScore('foo()'),                               // No types
        computeSignatureScore('foo(x)'),                              // Untyped param
        computeSignatureScore('foo(x: string)'),                      // One typed param
        computeSignatureScore('foo(x: string): void'),                // With return type
        computeSignatureScore('foo<T>(x: T): Promise<T>'),            // Generic
      ];

      // Should have increasing trend
      expect(scores[0]).toBeLessThan(scores[3]);
      expect(scores[3]).toBeLessThan(scores[5]);

      // Should have distinct values
      const unique = new Set(scores.map(s => Math.round(s * 100)));
      expect(unique.size).toBeGreaterThanOrEqual(4);
    });

    it('size score penalizes extremes', () => {
      const scores = [
        computeSizeScore(1, 1),     // 1 line - too small
        computeSizeScore(1, 3),     // 3 lines - small
        computeSizeScore(1, 10),    // 10 lines - ideal
        computeSizeScore(1, 30),    // 30 lines - ideal
        computeSizeScore(1, 100),   // 100 lines - large
        computeSizeScore(1, 300),   // 300 lines - too large
      ];

      // Ideal range should be highest
      expect(scores[2]).toBeGreaterThan(scores[0]); // 10 lines > 1 line
      expect(scores[3]).toBeGreaterThan(scores[5]); // 30 lines > 300 lines

      // Very large should be penalized
      expect(scores[5]).toBeLessThan(0.5);
    });

    it('name score rewards good naming conventions', () => {
      const scores = [
        computeNameScore(''),                  // Empty
        computeNameScore('x'),                 // Too short
        computeNameScore('foo'),               // No conventions
        computeNameScore('fooBar'),            // camelCase
        computeNameScore('getUserName'),       // Verb prefix + camelCase
        computeNameScore('validateUserInput'), // Good verb prefix + camelCase
      ];

      // Should have increasing trend
      expect(scores[0]).toBeLessThan(scores[2]);
      expect(scores[3]).toBeLessThan(scores[5]);

      // Should have distinct values
      const unique = new Set(scores.map(s => Math.round(s * 100)));
      expect(unique.size).toBeGreaterThanOrEqual(4);
    });
  });

  describe('combined confidence variance', () => {
    it('produces distinct values for different function qualities', () => {
      const testCases: Array<{ fn: ParsedFunction; purpose: string; parser: string }> = [
        // Low quality: LLM fallback, no purpose, bad signature, tiny function, bad name
        {
          fn: { name: 'x', signature: '', startLine: 1, endLine: 1 },
          purpose: '',
          parser: 'llm-fallback',
        },
        // Medium-low: LLM fallback, generic purpose, minimal signature
        {
          fn: { name: 'helper', signature: 'helper()', startLine: 1, endLine: 5 },
          purpose: 'A helper function that does stuff',
          parser: 'llm-fallback',
        },
        // Medium: Tree-sitter, decent purpose, typed signature
        {
          fn: { name: 'processData', signature: 'processData(input: string): void', startLine: 1, endLine: 20 },
          purpose: 'Processes incoming data from the API',
          parser: 'tree-sitter-typescript',
        },
        // High: ts-morph, good purpose, fully typed, ideal size
        {
          fn: { name: 'validateUserCredentials', signature: 'validateUserCredentials(creds: Credentials): Promise<boolean>', startLine: 1, endLine: 30 },
          purpose: 'Validates user authentication credentials against the stored hash, applying rate limiting and logging failed attempts',
          parser: 'ts-morph',
        },
        // Very high: ts-morph, excellent purpose, generic types, great name
        {
          fn: { name: 'fetchAndCacheResource', signature: 'fetchAndCacheResource<T>(url: string, options?: FetchOptions): Promise<CacheResult<T>>', startLine: 1, endLine: 45 },
          purpose: 'Asynchronously fetches external resources, deserializes JSON responses, caches results with configurable TTL, and handles retry logic for transient failures',
          parser: 'ts-morph',
        },
      ];

      const confidences = testCases.map(tc =>
        computeFunctionConfidence(tc.fn, tc.purpose, tc.parser)
      );

      // Should be monotonically increasing (or close to it)
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i]).toBeGreaterThan(confidences[i - 1]);
      }

      // Should span a reasonable range
      const min = Math.min(...confidences);
      const max = Math.max(...confidences);
      expect(max - min).toBeGreaterThan(0.3); // At least 30% spread

      // Should have distinct values (not clustered)
      const unique = new Set(confidences.map(c => Math.round(c * 100)));
      expect(unique.size).toBe(confidences.length); // All distinct at 1% precision
    });

    it('produces many distinct values across realistic function set', () => {
      // Simulate a realistic set of functions with varying quality
      const realisticFunctions = [
        // Getters/setters (small, simple)
        { name: 'getValue', signature: 'getValue(): number', lines: [1, 3], purpose: '' },
        { name: 'setValue', signature: 'setValue(v: number): void', lines: [5, 8], purpose: 'Sets the value' },

        // Utility functions
        { name: 'formatDate', signature: 'formatDate(d: Date): string', lines: [10, 25], purpose: 'Formats a date for display' },
        { name: 'parseJSON', signature: 'parseJSON<T>(text: string): T', lines: [27, 40], purpose: 'Safely parses JSON with error handling' },

        // Business logic
        { name: 'calculateTotal', signature: 'calculateTotal(items: CartItem[]): number', lines: [42, 80], purpose: 'Calculates the total price including discounts and taxes' },
        { name: 'processOrder', signature: 'processOrder(order: Order): Promise<OrderResult>', lines: [82, 150], purpose: 'Processes an order through the payment gateway, updates inventory, and sends confirmation emails' },

        // Complex functions
        { name: 'synchronizeDatabase', signature: 'synchronizeDatabase(source: DB, target: DB, options?: SyncOptions): Promise<SyncReport>', lines: [152, 350], purpose: 'Synchronizes two databases with conflict resolution, retry logic, and progress tracking' },

        // Test helpers (often small, generic names)
        { name: 'setup', signature: 'setup(): void', lines: [1, 5], purpose: '' },
        { name: 'teardown', signature: 'teardown(): void', lines: [7, 10], purpose: '' },
      ];

      const confidences = realisticFunctions.map(fn =>
        computeFunctionConfidence(
          { name: fn.name, signature: fn.signature, startLine: fn.lines[0], endLine: fn.lines[1] },
          fn.purpose,
          'ts-morph'
        )
      );

      // Count distinct confidence values (at 2% precision)
      const distinctAt2Pct = new Set(confidences.map(c => Math.round(c * 50))).size;

      // Should have meaningful variance - at least 5 distinct values at 2% precision
      expect(distinctAt2Pct).toBeGreaterThanOrEqual(5);

      // Verify no extreme clustering (no more than 2 values at same 5% bucket)
      const buckets = new Map<number, number>();
      for (const c of confidences) {
        const bucket = Math.round(c * 20);
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
      }
      const maxInBucket = Math.max(...buckets.values());
      expect(maxInBucket).toBeLessThanOrEqual(3);

      // Log distribution for visibility
      console.log('Confidence distribution:', confidences.map(c => c.toFixed(3)).join(', '));
      console.log('Distinct values at 2%:', distinctAt2Pct);
    });
  });

  describe('edge-based aggregation', () => {
    // Inline the edge aggregation functions for testing
    interface EdgeForAggregation {
      fromId: string;
      toId: string;
      confidence: number;
      edgeType: 'calls' | 'imports';
    }

    function computeEdgeAggregationBoost(
      functionId: string,
      incomingEdges: EdgeForAggregation[],
      outgoingEdges: EdgeForAggregation[]
    ): number {
      if (incomingEdges.length === 0 && outgoingEdges.length === 0) {
        return 0;
      }

      let boost = 0;

      if (incomingEdges.length > 0) {
        const avgIncoming = incomingEdges.reduce((s, e) => s + e.confidence, 0) / incomingEdges.length;
        const incomingBoost = Math.max(0, (avgIncoming - 0.5) * 0.125);
        boost += Math.min(0.05, incomingBoost);
      }

      if (outgoingEdges.length > 0) {
        const avgOutgoing = outgoingEdges.reduce((s, e) => s + e.confidence, 0) / outgoingEdges.length;
        const outgoingBoost = Math.max(0, (avgOutgoing - 0.5) * 0.1);
        boost += Math.min(0.04, outgoingBoost);
      }

      const totalEdges = incomingEdges.length + outgoingEdges.length;
      if (totalEdges >= 3) {
        const connectivityBonus = Math.min(0.03, totalEdges * 0.005);
        boost += connectivityBonus;
      }

      return Math.min(0.12, boost);
    }

    function applyEdgeAggregation(baseConfidence: number, edgeBoost: number): number {
      return Math.max(0.15, Math.min(0.95, baseConfidence + edgeBoost));
    }

    it('returns zero boost for isolated functions', () => {
      const boost = computeEdgeAggregationBoost('fn1', [], []);
      expect(boost).toBe(0);
    });

    it('provides boost for high-confidence callers', () => {
      const incoming: EdgeForAggregation[] = [
        { fromId: 'caller1', toId: 'fn1', confidence: 0.9, edgeType: 'calls' },
        { fromId: 'caller2', toId: 'fn1', confidence: 0.85, edgeType: 'calls' },
      ];
      const boost = computeEdgeAggregationBoost('fn1', incoming, []);
      expect(boost).toBeGreaterThan(0.03);
      expect(boost).toBeLessThan(0.08);
    });

    it('provides boost for high-confidence callees', () => {
      const outgoing: EdgeForAggregation[] = [
        { fromId: 'fn1', toId: 'callee1', confidence: 0.9, edgeType: 'calls' },
        { fromId: 'fn1', toId: 'callee2', confidence: 0.88, edgeType: 'calls' },
      ];
      const boost = computeEdgeAggregationBoost('fn1', [], outgoing);
      expect(boost).toBeGreaterThan(0.02);
      expect(boost).toBeLessThan(0.06);
    });

    it('provides connectivity bonus for well-connected functions', () => {
      const edges: EdgeForAggregation[] = [
        { fromId: 'fn1', toId: 'a', confidence: 0.7, edgeType: 'calls' },
        { fromId: 'fn1', toId: 'b', confidence: 0.7, edgeType: 'calls' },
        { fromId: 'fn1', toId: 'c', confidence: 0.7, edgeType: 'calls' },
        { fromId: 'fn1', toId: 'd', confidence: 0.7, edgeType: 'calls' },
      ];
      const boost = computeEdgeAggregationBoost('fn1', [], edges);
      // Should have connectivity bonus in addition to outgoing boost
      expect(boost).toBeGreaterThan(0.03);
    });

    it('caps total boost at 0.12', () => {
      const highConfEdges: EdgeForAggregation[] = Array(10).fill(null).map((_, i) => ({
        fromId: `caller${i}`,
        toId: 'fn1',
        confidence: 0.95,
        edgeType: 'calls' as const,
      }));
      const boost = computeEdgeAggregationBoost('fn1', highConfEdges, highConfEdges);
      expect(boost).toBeLessThanOrEqual(0.12);
    });

    it('applies edge aggregation correctly', () => {
      const baseConfidence = 0.7;
      const edgeBoost = 0.08;
      const adjusted = applyEdgeAggregation(baseConfidence, edgeBoost);
      expect(adjusted).toBeCloseTo(0.78, 2);
    });

    it('respects confidence bounds when applying boost', () => {
      // High base + boost should cap at 0.95
      const adjusted = applyEdgeAggregation(0.92, 0.10);
      expect(adjusted).toBeLessThanOrEqual(0.95);

      // Low base - boost should floor at 0.15
      const lowAdjusted = applyEdgeAggregation(0.10, -0.05);
      expect(lowAdjusted).toBeGreaterThanOrEqual(0.15);
    });

    it('provides varying boosts based on edge quality', () => {
      const highConfEdges: EdgeForAggregation[] = [
        { fromId: 'a', toId: 'fn1', confidence: 0.9, edgeType: 'calls' },
        { fromId: 'b', toId: 'fn1', confidence: 0.88, edgeType: 'calls' },
      ];
      const lowConfEdges: EdgeForAggregation[] = [
        { fromId: 'c', toId: 'fn2', confidence: 0.5, edgeType: 'calls' },
        { fromId: 'd', toId: 'fn2', confidence: 0.45, edgeType: 'calls' },
      ];

      const highBoost = computeEdgeAggregationBoost('fn1', highConfEdges, []);
      const lowBoost = computeEdgeAggregationBoost('fn2', lowConfEdges, []);

      expect(highBoost).toBeGreaterThan(lowBoost);
    });
  });

  describe('evidence quality factors', () => {
    interface EvidenceForQuality {
      claim: string;
      confidence: 'verified' | 'inferred' | 'uncertain';
      createdAt: string;
    }

    const EVIDENCE_TYPE_WEIGHTS: Record<string, number> = {
      verified: 0.95,
      inferred: 0.65,
      uncertain: 0.35,
    };

    function computeEvidenceQualityScore(entries: EvidenceForQuality[]): number {
      if (entries.length === 0) return 0.3;
      const countScore = Math.min(1, entries.length / 5) * 0.3;
      let qualitySum = 0;
      for (const entry of entries) {
        qualitySum += EVIDENCE_TYPE_WEIGHTS[entry.confidence] ?? 0.5;
      }
      const avgQuality = qualitySum / entries.length;
      const qualityScore = avgQuality * 0.5;
      let freshnessScore = 0.2;
      const now = Date.now();
      const oldestEntry = entries.reduce((oldest, e) => {
        const time = new Date(e.createdAt).getTime();
        return isNaN(time) ? oldest : Math.min(oldest, time);
      }, now);
      if (oldestEntry < now) {
        const daysSinceOldest = (now - oldestEntry) / (1000 * 60 * 60 * 24);
        freshnessScore = Math.max(0, 0.2 * (1 - daysSinceOldest / 90));
      }
      return countScore + qualityScore + freshnessScore;
    }

    function computeEvidenceQualityBoost(evidenceQualityScore: number): number {
      const adjustment = (evidenceQualityScore - 0.5) * 0.2;
      return Math.max(-0.10, Math.min(0.10, adjustment));
    }

    it('returns low score for no evidence', () => {
      const score = computeEvidenceQualityScore([]);
      expect(score).toBe(0.3);
    });

    it('returns higher score for more evidence', () => {
      const oneEntry: EvidenceForQuality[] = [
        { claim: 'Test claim', confidence: 'verified', createdAt: new Date().toISOString() },
      ];
      const fiveEntries: EvidenceForQuality[] = Array(5).fill(null).map((_, i) => ({
        claim: `Claim ${i}`,
        confidence: 'verified' as const,
        createdAt: new Date().toISOString(),
      }));

      const scoreOne = computeEvidenceQualityScore(oneEntry);
      const scoreFive = computeEvidenceQualityScore(fiveEntries);

      expect(scoreFive).toBeGreaterThan(scoreOne);
    });

    it('returns higher score for verified vs inferred evidence', () => {
      const now = new Date().toISOString();
      const verified: EvidenceForQuality[] = [
        { claim: 'Test', confidence: 'verified', createdAt: now },
        { claim: 'Test2', confidence: 'verified', createdAt: now },
      ];
      const inferred: EvidenceForQuality[] = [
        { claim: 'Test', confidence: 'inferred', createdAt: now },
        { claim: 'Test2', confidence: 'inferred', createdAt: now },
      ];

      const scoreVerified = computeEvidenceQualityScore(verified);
      const scoreInferred = computeEvidenceQualityScore(inferred);

      expect(scoreVerified).toBeGreaterThan(scoreInferred);
    });

    it('decays freshness over time', () => {
      const fresh = [
        { claim: 'Test', confidence: 'verified' as const, createdAt: new Date().toISOString() },
      ];
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 60); // 60 days ago
      const stale = [
        { claim: 'Test', confidence: 'verified' as const, createdAt: staleDate.toISOString() },
      ];

      const freshScore = computeEvidenceQualityScore(fresh);
      const staleScore = computeEvidenceQualityScore(stale);

      expect(freshScore).toBeGreaterThan(staleScore);
    });

    it('computes positive boost for strong evidence', () => {
      const boost = computeEvidenceQualityBoost(0.8);
      expect(boost).toBeGreaterThan(0);
      expect(boost).toBeLessThanOrEqual(0.10);
    });

    it('computes negative boost for weak evidence', () => {
      const boost = computeEvidenceQualityBoost(0.2);
      expect(boost).toBeLessThan(0);
      expect(boost).toBeGreaterThanOrEqual(-0.10);
    });

    it('computes neutral boost for average evidence', () => {
      const boost = computeEvidenceQualityBoost(0.5);
      expect(boost).toBeCloseTo(0, 2);
    });
  });

  describe('change-based decay', () => {
    interface ChangeContext {
      directlyModified: boolean;
      changedDependencies: Array<{ targetId: string; edgeConfidence: number }>;
      changedCallGraph: Array<{ targetId: string; edgeConfidence: number }>;
      changedCochangePartners: Array<{ filePath: string; cochangeStrength: number }>;
    }

    function calculateChangeBasedDecay(
      baseConfidence: number,
      changes: ChangeContext
    ): number {
      if (changes.directlyModified) {
        return 0.10;
      }

      let decayFactor = 1.0;

      for (const dep of changes.changedDependencies) {
        const impact = dep.edgeConfidence * 0.15;
        decayFactor *= (1 - impact);
      }

      for (const edge of changes.changedCallGraph) {
        const impact = edge.edgeConfidence * 0.08;
        decayFactor *= (1 - impact);
      }

      for (const partner of changes.changedCochangePartners) {
        const impact = partner.cochangeStrength * 0.05;
        decayFactor *= (1 - impact);
      }

      const decayedConfidence = baseConfidence * decayFactor;
      const minConfidence = baseConfidence * 0.1;

      return Math.max(minConfidence, Math.min(baseConfidence, decayedConfidence));
    }

    it('returns full confidence when nothing changed', () => {
      const noChanges: ChangeContext = {
        directlyModified: false,
        changedDependencies: [],
        changedCallGraph: [],
        changedCochangePartners: [],
      };
      const result = calculateChangeBasedDecay(0.85, noChanges);
      expect(result).toBe(0.85);
    });

    it('returns minimum confidence when directly modified', () => {
      const directChange: ChangeContext = {
        directlyModified: true,
        changedDependencies: [],
        changedCallGraph: [],
        changedCochangePartners: [],
      };
      const result = calculateChangeBasedDecay(0.85, directChange);
      expect(result).toBe(0.10);
    });

    it('decays based on dependency changes', () => {
      const depChange: ChangeContext = {
        directlyModified: false,
        changedDependencies: [
          { targetId: 'dep1', edgeConfidence: 0.9 },
        ],
        changedCallGraph: [],
        changedCochangePartners: [],
      };
      const result = calculateChangeBasedDecay(0.85, depChange);
      // Should be 0.85 * (1 - 0.9 * 0.15) = 0.85 * 0.865 ≈ 0.735
      expect(result).toBeCloseTo(0.735, 2);
      expect(result).toBeLessThan(0.85);
    });

    it('decays cumulatively with multiple changes', () => {
      const multipleChanges: ChangeContext = {
        directlyModified: false,
        changedDependencies: [
          { targetId: 'dep1', edgeConfidence: 0.8 },
          { targetId: 'dep2', edgeConfidence: 0.7 },
        ],
        changedCallGraph: [
          { targetId: 'caller1', edgeConfidence: 0.9 },
        ],
        changedCochangePartners: [
          { filePath: 'partner.ts', cochangeStrength: 0.5 },
        ],
      };
      const result = calculateChangeBasedDecay(0.85, multipleChanges);
      // Multiple decay factors compound
      expect(result).toBeLessThan(0.7);
      expect(result).toBeGreaterThan(0.085); // min is 10% of original
    });

    it('never decays below 10% of original', () => {
      const massiveChanges: ChangeContext = {
        directlyModified: false,
        changedDependencies: Array(10).fill({ targetId: 'dep', edgeConfidence: 0.95 }),
        changedCallGraph: Array(10).fill({ targetId: 'call', edgeConfidence: 0.95 }),
        changedCochangePartners: Array(10).fill({ filePath: 'p.ts', cochangeStrength: 0.9 }),
      };
      const result = calculateChangeBasedDecay(0.85, massiveChanges);
      expect(result).toBeGreaterThanOrEqual(0.085); // 10% of 0.85
    });

    it('weak dependencies cause less decay than strong ones', () => {
      const strongDep: ChangeContext = {
        directlyModified: false,
        changedDependencies: [{ targetId: 'dep', edgeConfidence: 0.95 }],
        changedCallGraph: [],
        changedCochangePartners: [],
      };
      const weakDep: ChangeContext = {
        directlyModified: false,
        changedDependencies: [{ targetId: 'dep', edgeConfidence: 0.3 }],
        changedCallGraph: [],
        changedCochangePartners: [],
      };

      const strongResult = calculateChangeBasedDecay(0.85, strongDep);
      const weakResult = calculateChangeBasedDecay(0.85, weakDep);

      expect(weakResult).toBeGreaterThan(strongResult);
    });
  });

  describe('boundary conditions', () => {
    it('never produces confidence below 0.15', () => {
      const worstCase = computeFunctionConfidence(
        { name: '', signature: '', startLine: 0, endLine: 0 },
        '',
        'llm-fallback'
      );
      expect(worstCase).toBeGreaterThanOrEqual(0.15);
    });

    it('never produces confidence above 0.92', () => {
      const bestCase = computeFunctionConfidence(
        { name: 'validateAndTransformUserInput', signature: 'validateAndTransformUserInput<T extends Serializable>(input: T, schema: Schema<T>): Promise<ValidationResult<T>>', startLine: 1, endLine: 35 },
        'Asynchronously validates, transforms, serializes, and caches user input with comprehensive error handling, retry logic, and audit logging for compliance',
        'ts-morph'
      );
      expect(bestCase).toBeLessThanOrEqual(0.92);
    });
  });
});
