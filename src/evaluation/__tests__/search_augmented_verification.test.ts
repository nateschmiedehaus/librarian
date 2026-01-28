/**
 * @fileoverview Tests for Search-Augmented Factual Evaluation (SAFE)
 *
 * Tests are written FIRST (TDD). Implementation comes AFTER these tests fail.
 *
 * Based on DeepMind's SAFE paper (NeurIPS 2024), this module verifies claims
 * by searching for corroborating evidence in the codebase.
 *
 * Key differences from citation_verifier:
 * - Decomposes claims into atomic searchable facts
 * - Actively searches for evidence (not just verifying existing citations)
 * - Aggregates evidence from multiple sources
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  SAFEVerifier,
  createSAFEVerifier,
  decomposeClaim,
  generateSearchQueries,
  searchForEvidence,
  evaluateEvidence,
  aggregateVerdict,
  type AtomicFact,
  type SearchResult,
  type FactVerification,
  type SAFEResult,
  type SearchStrategy,
  type SAFEConfig,
} from '../search_augmented_verification.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const LIBRARIAN_ROOT = path.resolve(__dirname, '../../..');
const EVALUATION_DIR = path.join(LIBRARIAN_ROOT, 'src/evaluation');
const AST_EXTRACTOR_PATH = path.join(EVALUATION_DIR, 'ast_fact_extractor.ts');

// Sample claims for testing
const SAMPLE_CLAIMS = {
  existence: 'The ASTFactExtractor class exists in the codebase',
  property: 'The extractFromFile method takes a filePath parameter',
  relationship: 'The ASTFactExtractor class uses ts-morph for parsing',
  behavior: 'The extractFromDirectory method recursively searches for files',
  complex: 'The ASTFactExtractor class has methods for extracting functions, imports, and classes, and it uses the ts-morph library',
};

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createSAFEVerifier', () => {
  it('should create a SAFEVerifier instance', () => {
    const verifier = createSAFEVerifier();
    expect(verifier).toBeInstanceOf(SAFEVerifier);
  });

  it('should accept custom configuration', () => {
    const config: SAFEConfig = {
      maxSearchResults: 20,
      minRelevanceScore: 0.5,
      searchStrategies: ['exact_symbol', 'fuzzy_text'],
    };
    const verifier = createSAFEVerifier(config);
    expect(verifier).toBeInstanceOf(SAFEVerifier);
  });
});

// ============================================================================
// DECOMPOSE CLAIM TESTS
// ============================================================================

describe('decomposeClaim', () => {
  it('should decompose a simple existence claim into one atomic fact', () => {
    const claim = 'The ASTFactExtractor class exists';
    const facts = decomposeClaim(claim);

    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts[0].type).toBe('existence');
    expect(facts[0].text).toContain('ASTFactExtractor');
    expect(facts[0].searchable).toBe(true);
  });

  it('should decompose a property claim', () => {
    const claim = 'The extractFromFile method has a filePath parameter';
    const facts = decomposeClaim(claim);

    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts.some((f) => f.type === 'property')).toBe(true);
    expect(facts.some((f) => f.text.includes('filePath'))).toBe(true);
  });

  it('should decompose a relationship claim', () => {
    const claim = 'The UserService class extends BaseService';
    const facts = decomposeClaim(claim);

    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts.some((f) => f.type === 'relationship')).toBe(true);
  });

  it('should decompose a behavior claim', () => {
    const claim = 'The processData function calls validateInput';
    const facts = decomposeClaim(claim);

    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts.some((f) => f.type === 'behavior')).toBe(true);
  });

  it('should decompose complex claims into multiple atomic facts', () => {
    const claim = 'The ASTFactExtractor class has methods extractFromFile and extractFromDirectory, and it uses ts-morph';
    const facts = decomposeClaim(claim);

    expect(facts.length).toBeGreaterThanOrEqual(3);
  });

  it('should assign unique IDs to each fact', () => {
    const claim = 'Class A extends B and implements C';
    const facts = decomposeClaim(claim);

    const ids = facts.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should mark unsearchable facts appropriately', () => {
    const claim = 'The code is well-designed and efficient';
    const facts = decomposeClaim(claim);

    // Subjective claims may be marked as unsearchable
    expect(facts.some((f) => f.searchable === false)).toBe(true);
  });

  it('should handle empty claim', () => {
    const facts = decomposeClaim('');
    expect(facts).toEqual([]);
  });

  it('should handle claims with only whitespace', () => {
    const facts = decomposeClaim('   \n\t  ');
    expect(facts).toEqual([]);
  });

  it('should extract identifiers from backtick-quoted text', () => {
    const claim = 'The `MyClass` has method `doSomething`';
    const facts = decomposeClaim(claim);

    expect(facts.some((f) => f.text.includes('MyClass'))).toBe(true);
    expect(facts.some((f) => f.text.includes('doSomething'))).toBe(true);
  });
});

// ============================================================================
// GENERATE SEARCH QUERIES TESTS
// ============================================================================

describe('generateSearchQueries', () => {
  it('should generate exact symbol search query for existence fact', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'ASTFactExtractor class exists',
      type: 'existence',
      searchable: true,
    };

    const queries = generateSearchQueries(fact);

    expect(queries.length).toBeGreaterThanOrEqual(1);
    expect(queries.some((q) => q.includes('ASTFactExtractor'))).toBe(true);
  });

  it('should generate multiple search strategies', () => {
    const fact: AtomicFact = {
      id: '1',
      text: '`extractFromFile` method exists',
      type: 'existence',
      searchable: true,
    };

    const queries = generateSearchQueries(fact);

    // Should have queries for different strategies (backtick identifier should be extracted)
    expect(queries.length).toBeGreaterThanOrEqual(2);
  });

  it('should generate structural queries for relationship facts', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'UserService extends BaseService',
      type: 'relationship',
      searchable: true,
    };

    const queries = generateSearchQueries(fact);

    expect(queries.some((q) => q.includes('extends'))).toBe(true);
  });

  it('should generate import queries for dependency facts', () => {
    const fact: AtomicFact = {
      id: '1',
      text: '`ASTFactExtractor` uses ts-morph',
      type: 'relationship',
      searchable: true,
    };

    const queries = generateSearchQueries(fact);

    // Should generate queries for the identifier and the import
    expect(queries.some((q) => q.includes('ASTFactExtractor') || q.includes('ts-morph'))).toBe(true);
  });

  it('should return empty array for unsearchable facts', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'The code is efficient',
      type: 'property',
      searchable: false,
    };

    const queries = generateSearchQueries(fact);

    expect(queries).toEqual([]);
  });

  it('should escape regex special characters in queries', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'Pattern matches foo.*bar',
      type: 'property',
      searchable: true,
    };

    const queries = generateSearchQueries(fact);

    // Should handle special characters safely
    expect(Array.isArray(queries)).toBe(true);
  });
});

// ============================================================================
// SEARCH FOR EVIDENCE TESTS
// ============================================================================

describe('searchForEvidence', () => {
  it('should find evidence for existing class', async () => {
    const query = 'class ASTFactExtractor';
    const results = await searchForEvidence(query, LIBRARIAN_ROOT);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toContain('ast_fact_extractor');
    expect(results[0].relevanceScore).toBeGreaterThan(0);
  });

  it('should find evidence for existing function', async () => {
    const query = 'function extractFromFile';
    const results = await searchForEvidence(query, LIBRARIAN_ROOT);

    expect(results.length).toBeGreaterThan(0);
  });

  it('should return results with file, line, content', async () => {
    const query = 'ASTFactExtractor';
    const results = await searchForEvidence(query, LIBRARIAN_ROOT);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toBeDefined();
    expect(results[0].line).toBeDefined();
    expect(typeof results[0].line).toBe('number');
    expect(results[0].content).toBeDefined();
  });

  it('should return empty array for non-existent query', async () => {
    // Use a query that won't exist - search in a directory without matching content
    // Create a unique query that won't match anything
    const uniquePart = String(Date.now());
    const results = await searchForEvidence(`Zzz${uniquePart}Qqq`, LIBRARIAN_ROOT);

    expect(results).toEqual([]);
  });

  it('should respect max results limit', async () => {
    const query = 'function';
    const results = await searchForEvidence(query, LIBRARIAN_ROOT, { maxResults: 5 });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should handle invalid directory gracefully', async () => {
    const query = 'ASTFactExtractor';
    const results = await searchForEvidence(query, '/nonexistent/path');

    expect(results).toEqual([]);
  });

  it('should calculate relevance scores', async () => {
    const query = 'class ASTFactExtractor';
    const results = await searchForEvidence(query, LIBRARIAN_ROOT);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].relevanceScore).toBeGreaterThanOrEqual(0);
    expect(results[0].relevanceScore).toBeLessThanOrEqual(1);
  });

  it('should sort results by relevance', async () => {
    const query = 'ASTFactExtractor';
    const results = await searchForEvidence(query, LIBRARIAN_ROOT);

    if (results.length > 1) {
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].relevanceScore).toBeGreaterThanOrEqual(results[i + 1].relevanceScore);
      }
    }
  });
});

// ============================================================================
// EVALUATE EVIDENCE TESTS
// ============================================================================

describe('evaluateEvidence', () => {
  it('should return supported when evidence matches fact', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'ASTFactExtractor class exists',
      type: 'existence',
      searchable: true,
    };

    const evidence: SearchResult[] = [
      {
        file: 'src/evaluation/ast_fact_extractor.ts',
        line: 149,
        content: 'export class ASTFactExtractor {',
        relevanceScore: 0.95,
      },
    ];

    const result = evaluateEvidence(fact, evidence);

    expect(result.verdict).toBe('supported');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should return insufficient_evidence when no evidence found', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'NonExistentClass exists',
      type: 'existence',
      searchable: true,
    };

    const evidence: SearchResult[] = [];

    const result = evaluateEvidence(fact, evidence);

    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should return refuted when evidence contradicts fact', () => {
    const fact: AtomicFact = {
      id: '1',
      text: '`ASTFactExtractor` extends `BaseExtractor`',
      type: 'relationship',
      searchable: true,
    };

    // Evidence shows class exists but doesn't extend the expected class
    const evidence: SearchResult[] = [
      {
        file: 'src/evaluation/ast_fact_extractor.ts',
        line: 149,
        content: 'export class ASTFactExtractor {',
        relevanceScore: 0.9,
      },
    ];

    const result = evaluateEvidence(fact, evidence);

    // Class exists but doesn't extend BaseExtractor - should be refuted
    expect(result.verdict).toBe('refuted');
  });

  it('should include fact in verification result', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'Test fact',
      type: 'existence',
      searchable: true,
    };

    const result = evaluateEvidence(fact, []);

    expect(result.fact).toEqual(fact);
  });

  it('should include evidence in verification result', () => {
    const fact: AtomicFact = {
      id: '1',
      text: 'ASTFactExtractor exists',
      type: 'existence',
      searchable: true,
    };

    const evidence: SearchResult[] = [
      {
        file: 'test.ts',
        line: 10,
        content: 'class ASTFactExtractor',
        relevanceScore: 0.9,
      },
    ];

    const result = evaluateEvidence(fact, evidence);

    expect(result.evidence).toEqual(evidence);
  });

  it('should calculate confidence based on evidence quality', () => {
    const fact: AtomicFact = {
      id: '1',
      text: '`TestClass` exists',
      type: 'existence',
      searchable: true,
    };

    const highQualityEvidence: SearchResult[] = [
      { file: 'a.ts', line: 1, content: 'class TestClass {', relevanceScore: 0.95 },
      { file: 'b.ts', line: 2, content: 'TestClass instance', relevanceScore: 0.9 },
    ];

    const lowQualityEvidence: SearchResult[] = [
      { file: 'c.ts', line: 1, content: 'TestClass ref', relevanceScore: 0.35 },
    ];

    const highResult = evaluateEvidence(fact, highQualityEvidence);
    const lowResult = evaluateEvidence(fact, lowQualityEvidence);

    expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
  });
});

// ============================================================================
// AGGREGATE VERDICT TESTS
// ============================================================================

describe('aggregateVerdict', () => {
  it('should return verified when all facts are supported', () => {
    const verifications: FactVerification[] = [
      {
        fact: { id: '1', text: 'fact 1', type: 'existence', searchable: true },
        evidence: [],
        verdict: 'supported',
        confidence: 0.9,
      },
      {
        fact: { id: '2', text: 'fact 2', type: 'property', searchable: true },
        evidence: [],
        verdict: 'supported',
        confidence: 0.85,
      },
    ];

    const result = aggregateVerdict(verifications);

    expect(result.overallVerdict).toBe('verified');
    expect(result.supportRate).toBe(1);
  });

  it('should return refuted when any fact is refuted', () => {
    const verifications: FactVerification[] = [
      {
        fact: { id: '1', text: 'fact 1', type: 'existence', searchable: true },
        evidence: [],
        verdict: 'supported',
        confidence: 0.9,
      },
      {
        fact: { id: '2', text: 'fact 2', type: 'property', searchable: true },
        evidence: [],
        verdict: 'refuted',
        confidence: 0.8,
      },
    ];

    const result = aggregateVerdict(verifications);

    expect(result.overallVerdict).toBe('refuted');
    expect(result.supportRate).toBe(0.5);
  });

  it('should return partially_verified when mixed results', () => {
    const verifications: FactVerification[] = [
      {
        fact: { id: '1', text: 'fact 1', type: 'existence', searchable: true },
        evidence: [],
        verdict: 'supported',
        confidence: 0.9,
      },
      {
        fact: { id: '2', text: 'fact 2', type: 'property', searchable: true },
        evidence: [],
        verdict: 'insufficient_evidence',
        confidence: 0.3,
      },
    ];

    const result = aggregateVerdict(verifications);

    expect(result.overallVerdict).toBe('partially_verified');
    expect(result.supportRate).toBe(0.5);
  });

  it('should return unverifiable when no searchable facts', () => {
    const verifications: FactVerification[] = [
      {
        fact: { id: '1', text: 'subjective claim', type: 'property', searchable: false },
        evidence: [],
        verdict: 'insufficient_evidence',
        confidence: 0.1,
      },
    ];

    const result = aggregateVerdict(verifications);

    expect(result.overallVerdict).toBe('unverifiable');
  });

  it('should calculate correct support rate', () => {
    const verifications: FactVerification[] = [
      {
        fact: { id: '1', text: 'fact 1', type: 'existence', searchable: true },
        evidence: [],
        verdict: 'supported',
        confidence: 0.9,
      },
      {
        fact: { id: '2', text: 'fact 2', type: 'property', searchable: true },
        evidence: [],
        verdict: 'supported',
        confidence: 0.9,
      },
      {
        fact: { id: '3', text: 'fact 3', type: 'behavior', searchable: true },
        evidence: [],
        verdict: 'insufficient_evidence',
        confidence: 0.3,
      },
    ];

    const result = aggregateVerdict(verifications);

    expect(result.supportRate).toBeCloseTo(2 / 3, 2);
  });

  it('should handle empty verifications', () => {
    const result = aggregateVerdict([]);

    expect(result.overallVerdict).toBe('unverifiable');
    expect(result.supportRate).toBe(0);
  });
});

// ============================================================================
// SAFE VERIFIER CLASS TESTS
// ============================================================================

describe('SAFEVerifier', () => {
  let verifier: SAFEVerifier;

  beforeAll(() => {
    verifier = createSAFEVerifier();
  });

  describe('verify', () => {
    it('should verify a simple existence claim', async () => {
      const result = await verifier.verify(
        'The `ASTFactExtractor` class exists in the codebase',
        LIBRARIAN_ROOT
      );

      expect(['verified', 'partially_verified']).toContain(result.overallVerdict);
      expect(result.supportRate).toBeGreaterThan(0.5);
    });

    it('should verify a property claim', async () => {
      const result = await verifier.verify(
        'The `extractFromFile` method takes a `filePath` parameter of type string',
        LIBRARIAN_ROOT
      );

      // This is a complex claim that may decompose into multiple facts
      expect(['verified', 'partially_verified', 'unverifiable']).toContain(result.overallVerdict);
    });

    it('should verify a relationship claim', async () => {
      const result = await verifier.verify(
        'The file imports `Project` from ts-morph',
        LIBRARIAN_ROOT
      );

      expect(['verified', 'partially_verified']).toContain(result.overallVerdict);
    });

    it('should refute a false claim', async () => {
      const result = await verifier.verify(
        'The ASTFactExtractor class extends NonExistentBaseClass',
        LIBRARIAN_ROOT
      );

      expect(['refuted', 'partially_verified']).toContain(result.overallVerdict);
    });

    it('should return unverifiable for subjective claims', async () => {
      const result = await verifier.verify(
        'The code is beautiful and elegant',
        LIBRARIAN_ROOT
      );

      expect(result.overallVerdict).toBe('unverifiable');
    });

    it('should include original claim in result', async () => {
      const claim = 'ASTFactExtractor exists';
      const result = await verifier.verify(claim, LIBRARIAN_ROOT);

      expect(result.originalClaim).toBe(claim);
    });

    it('should include facts in result', async () => {
      const result = await verifier.verify(
        'The ASTFactExtractor class exists',
        LIBRARIAN_ROOT
      );

      expect(result.facts.length).toBeGreaterThan(0);
    });

    it('should include verifications in result', async () => {
      const result = await verifier.verify(
        'The ASTFactExtractor class exists',
        LIBRARIAN_ROOT
      );

      expect(result.verifications.length).toBeGreaterThan(0);
      expect(result.verifications.length).toBe(result.facts.length);
    });

    it('should handle empty claim', async () => {
      const result = await verifier.verify('', LIBRARIAN_ROOT);

      expect(result.overallVerdict).toBe('unverifiable');
      expect(result.facts).toEqual([]);
    });

    it('should handle invalid repo path', async () => {
      const result = await verifier.verify(
        'ASTFactExtractor exists',
        '/nonexistent/path'
      );

      expect(['unverifiable', 'refuted']).toContain(result.overallVerdict);
    });
  });

  describe('verifyBatch', () => {
    it('should verify multiple claims', async () => {
      const claims = [
        'The ASTFactExtractor class exists',
        'The extractFromFile method exists',
      ];

      const results = await verifier.verifyBatch(claims, LIBRARIAN_ROOT);

      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(result.originalClaim).toBeDefined();
        expect(result.overallVerdict).toBeDefined();
      });
    });

    it('should handle empty claims array', async () => {
      const results = await verifier.verifyBatch([], LIBRARIAN_ROOT);
      expect(results).toEqual([]);
    });
  });
});

// ============================================================================
// SAFE RESULT INTERFACE TESTS
// ============================================================================

describe('SAFEResult Interface', () => {
  let verifier: SAFEVerifier;

  beforeAll(() => {
    verifier = createSAFEVerifier();
  });

  it('should have all required fields', async () => {
    const result = await verifier.verify(
      'The ASTFactExtractor class exists',
      LIBRARIAN_ROOT
    );

    expect(result.originalClaim).toBeDefined();
    expect(Array.isArray(result.facts)).toBe(true);
    expect(Array.isArray(result.verifications)).toBe(true);
    expect(result.overallVerdict).toBeDefined();
    expect(typeof result.supportRate).toBe('number');
  });

  it('should have valid verdict values', async () => {
    const result = await verifier.verify(
      'Test claim',
      LIBRARIAN_ROOT
    );

    const validVerdicts = ['verified', 'refuted', 'partially_verified', 'unverifiable'];
    expect(validVerdicts).toContain(result.overallVerdict);
  });

  it('should have support rate between 0 and 1', async () => {
    const result = await verifier.verify(
      'ASTFactExtractor exists',
      LIBRARIAN_ROOT
    );

    expect(result.supportRate).toBeGreaterThanOrEqual(0);
    expect(result.supportRate).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// ATOMIC FACT INTERFACE TESTS
// ============================================================================

describe('AtomicFact Interface', () => {
  it('should support all required fields', () => {
    const fact: AtomicFact = {
      id: 'fact-1',
      text: 'ASTFactExtractor exists',
      type: 'existence',
      searchable: true,
    };

    expect(fact.id).toBe('fact-1');
    expect(fact.text).toBe('ASTFactExtractor exists');
    expect(fact.type).toBe('existence');
    expect(fact.searchable).toBe(true);
  });

  it('should accept all fact types', () => {
    const types: AtomicFact['type'][] = ['existence', 'property', 'relationship', 'behavior'];

    types.forEach((type) => {
      const fact: AtomicFact = { id: '1', text: 'test', type, searchable: true };
      expect(fact.type).toBe(type);
    });
  });
});

// ============================================================================
// SEARCH RESULT INTERFACE TESTS
// ============================================================================

describe('SearchResult Interface', () => {
  it('should support all required fields', () => {
    const result: SearchResult = {
      file: 'src/test.ts',
      line: 42,
      content: 'class TestClass {',
      relevanceScore: 0.85,
    };

    expect(result.file).toBe('src/test.ts');
    expect(result.line).toBe(42);
    expect(result.content).toBe('class TestClass {');
    expect(result.relevanceScore).toBe(0.85);
  });
});

// ============================================================================
// FACT VERIFICATION INTERFACE TESTS
// ============================================================================

describe('FactVerification Interface', () => {
  it('should support all required fields', () => {
    const verification: FactVerification = {
      fact: { id: '1', text: 'test', type: 'existence', searchable: true },
      evidence: [],
      verdict: 'supported',
      confidence: 0.9,
    };

    expect(verification.fact).toBeDefined();
    expect(Array.isArray(verification.evidence)).toBe(true);
    expect(verification.verdict).toBe('supported');
    expect(verification.confidence).toBe(0.9);
  });

  it('should accept all verdict values', () => {
    const verdicts: FactVerification['verdict'][] = ['supported', 'refuted', 'insufficient_evidence'];

    verdicts.forEach((verdict) => {
      const verification: FactVerification = {
        fact: { id: '1', text: 'test', type: 'existence', searchable: true },
        evidence: [],
        verdict,
        confidence: 0.5,
      };
      expect(verification.verdict).toBe(verdict);
    });
  });
});

// ============================================================================
// SEARCH STRATEGIES TESTS
// ============================================================================

describe('Search Strategies', () => {
  let verifier: SAFEVerifier;

  beforeAll(() => {
    verifier = createSAFEVerifier();
  });

  it('should use exact symbol search for identifiers', async () => {
    const result = await verifier.verify(
      'The function `createASTFactExtractor` exists',
      LIBRARIAN_ROOT
    );

    // Should find the exact function name using backtick extraction
    expect(['verified', 'partially_verified']).toContain(result.overallVerdict);
  });

  it('should use fuzzy text search for comments', async () => {
    const result = await verifier.verify(
      'The `ASTFactExtractor` extracts machine-verifiable facts',
      LIBRARIAN_ROOT
    );

    // Should find via fuzzy matching in comments
    expect(['verified', 'partially_verified']).toContain(result.overallVerdict);
  });

  it('should use structural search for imports', async () => {
    const result = await verifier.verify(
      'The file imports `Project` from ts-morph',
      LIBRARIAN_ROOT
    );

    expect(['verified', 'partially_verified']).toContain(result.overallVerdict);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('SAFEVerifier - Edge Cases', () => {
  let verifier: SAFEVerifier;

  beforeAll(() => {
    verifier = createSAFEVerifier();
  });

  it('should handle claims with special characters', async () => {
    const result = await verifier.verify(
      'The function handles Pattern<T> types',
      LIBRARIAN_ROOT
    );

    // Should not crash
    expect(result).toBeDefined();
    expect(result.overallVerdict).toBeDefined();
  });

  it('should handle very long claims', async () => {
    const longClaim = 'The ASTFactExtractor ' + 'has many methods '.repeat(50);
    const result = await verifier.verify(longClaim, LIBRARIAN_ROOT);

    // Should handle gracefully
    expect(result).toBeDefined();
  });

  it('should handle claims with unicode', async () => {
    const result = await verifier.verify(
      'The function handles unicode strings like "hello"',
      LIBRARIAN_ROOT
    );

    expect(result).toBeDefined();
  });

  it('should handle claims about non-existent files', async () => {
    const result = await verifier.verify(
      'The NonExistentFile.ts contains important code',
      LIBRARIAN_ROOT
    );

    expect(['refuted', 'unverifiable', 'partially_verified']).toContain(result.overallVerdict);
  });

  it('should handle claims with multiple identifiers', async () => {
    const result = await verifier.verify(
      'Both ASTFactExtractor and createASTFactExtractor are in the codebase',
      LIBRARIAN_ROOT
    );

    expect(result.facts.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle negated claims', async () => {
    const result = await verifier.verify(
      'The ASTFactExtractor does not extend any class',
      LIBRARIAN_ROOT
    );

    // Should handle negation
    expect(result).toBeDefined();
  });
});

// ============================================================================
// INTEGRATION WITH EXISTING CODE TESTS
// ============================================================================

describe('SAFEVerifier - Integration', () => {
  let verifier: SAFEVerifier;

  beforeAll(() => {
    verifier = createSAFEVerifier();
  });

  it('should be usable alongside CitationVerifier', async () => {
    // SAFE verifies claims by searching
    // CitationVerifier verifies existing citations
    // They should complement each other
    const result = await verifier.verify(
      'The citation_verifier module exists',
      LIBRARIAN_ROOT
    );

    expect(result.overallVerdict).toBe('verified');
  });

  it('should be usable alongside EntailmentChecker', async () => {
    // SAFE searches for evidence
    // EntailmentChecker checks if claims are entailed by evidence
    const result = await verifier.verify(
      'The entailment_checker module exists',
      LIBRARIAN_ROOT
    );

    expect(result.overallVerdict).toBe('verified');
  });

  it('should work with AST facts from ast_fact_extractor', async () => {
    // SAFE can use facts from AST extraction
    const result = await verifier.verify(
      'The ASTFactExtractor class has an extractFromFile method',
      LIBRARIAN_ROOT
    );

    expect(['verified', 'partially_verified']).toContain(result.overallVerdict);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('SAFEVerifier - Performance', () => {
  let verifier: SAFEVerifier;

  beforeAll(() => {
    verifier = createSAFEVerifier();
  });

  it('should complete verification within reasonable time', async () => {
    const start = Date.now();
    await verifier.verify(
      'The ASTFactExtractor class exists',
      LIBRARIAN_ROOT
    );
    const elapsed = Date.now() - start;

    // Should complete within 10 seconds
    expect(elapsed).toBeLessThan(10000);
  });

  it('should handle batch verification efficiently', async () => {
    const claims = [
      'ASTFactExtractor exists',
      'extractFromFile exists',
      'extractFromDirectory exists',
    ];

    const start = Date.now();
    await verifier.verifyBatch(claims, LIBRARIAN_ROOT);
    const elapsed = Date.now() - start;

    // Should complete within 30 seconds for 3 claims
    expect(elapsed).toBeLessThan(30000);
  });
});

// ============================================================================
// TIER-0 COMPATIBILITY TESTS
// ============================================================================

describe('SAFEVerifier - Tier-0 Compatibility', () => {
  it('should work without LLM for basic operations', async () => {
    // SAFE should work with pattern matching only (no LLM required)
    const verifier = createSAFEVerifier({
      searchStrategies: ['exact_symbol', 'fuzzy_text'],
    });

    const result = await verifier.verify(
      'The ASTFactExtractor class exists',
      LIBRARIAN_ROOT
    );

    // Should still work with Tier-0 constraints
    expect(result).toBeDefined();
    expect(result.overallVerdict).toBeDefined();
  });

  it('should use pattern matching for search', async () => {
    // Verify that search uses pattern matching, not semantic search
    const results = await searchForEvidence('class ASTFactExtractor', LIBRARIAN_ROOT);

    expect(results.length).toBeGreaterThan(0);
    // Results should be from pattern matching
    expect(results[0].content).toContain('ASTFactExtractor');
  });
});
