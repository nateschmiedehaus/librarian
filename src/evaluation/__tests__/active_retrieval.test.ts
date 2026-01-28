/**
 * @fileoverview Tests for DRAGIN Active Retrieval (WU-DRAGIN-001)
 *
 * Tests are written FIRST (TDD). Implementation comes AFTER these tests fail.
 *
 * DRAGIN (Dynamic Retrieval Augmented Generation with INterleavIng Needs) is a
 * technique from ACL 2024 that detects when a model needs more information during
 * generation by monitoring "attention signals" (simulated via uncertainty patterns).
 *
 * Research reference: "DRAGIN: Dynamic Retrieval Augmented Generation based on
 * Information Needs of Large Language Models" (ACL 2024)
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  DRAGINRetriever,
  createDRAGINRetriever,
  detectRetrievalNeed,
  computeUncertaintySignals,
  triggerDynamicRetrieval,
  type UncertaintySignal,
  type RetrievalDecision,
  type ActiveRetrievalResult,
  type DRAGINConfig,
  DEFAULT_DRAGIN_CONFIG,
} from '../active_retrieval.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/** Sample text with hedging language */
const HEDGING_TEXT = 'The function might return a value, possibly an array or maybe a string.';

/** Sample text with questions */
const QUESTION_TEXT = 'What is the return type? Does this function handle errors?';

/** Sample text with low confidence phrases */
const LOW_CONFIDENCE_TEXT = "I'm not sure about the implementation. I think it works, but I don't know.";

/** Sample text with unknown entity references */
const UNKNOWN_ENTITY_TEXT = 'The XyzHandler class processes the UnknownWidget data structure.';

/** Sample text with vague quantifiers */
const VAGUE_QUANTIFIER_TEXT = 'Some functions use several parameters and many callbacks with few errors.';

/** Sample text with high confidence (no uncertainty) */
const HIGH_CONFIDENCE_TEXT = 'The function returns a string. It takes one parameter named input.';

/** Mixed text with multiple uncertainty signals */
const MIXED_UNCERTAINTY_TEXT =
  'The function might process some data. What is the expected format? ' +
  "I'm not sure, but perhaps the UnknownService handles this.";

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createDRAGINRetriever', () => {
  it('should create a retriever instance with default config', () => {
    const retriever = createDRAGINRetriever();
    expect(retriever).toBeInstanceOf(DRAGINRetriever);
  });

  it('should create a retriever instance with custom config', () => {
    const retriever = createDRAGINRetriever({
      uncertaintyThreshold: 0.7,
      minSignalSeverity: 0.4,
    });
    expect(retriever).toBeInstanceOf(DRAGINRetriever);
    const config = retriever.getConfig();
    expect(config.uncertaintyThreshold).toBe(0.7);
    expect(config.minSignalSeverity).toBe(0.4);
  });

  it('should merge custom config with defaults', () => {
    const retriever = createDRAGINRetriever({
      uncertaintyThreshold: 0.8,
    });
    const config = retriever.getConfig();
    expect(config.uncertaintyThreshold).toBe(0.8);
    // Other values should be defaults
    expect(config.minSignalSeverity).toBe(DEFAULT_DRAGIN_CONFIG.minSignalSeverity);
  });
});

// ============================================================================
// COMPUTE UNCERTAINTY SIGNALS TESTS
// ============================================================================

describe('computeUncertaintySignals', () => {
  it('should detect hedging language', () => {
    const signals = computeUncertaintySignals(HEDGING_TEXT);

    const hedgingSignals = signals.filter(s => s.type === 'hedging');
    expect(hedgingSignals.length).toBeGreaterThan(0);

    // Should detect "might", "possibly", "maybe"
    const hedgingWords = hedgingSignals.map(s => s.text.toLowerCase());
    expect(hedgingWords.some(w => w.includes('might') || w.includes('possibly') || w.includes('maybe'))).toBe(true);
  });

  it('should detect question marks', () => {
    const signals = computeUncertaintySignals(QUESTION_TEXT);

    const questionSignals = signals.filter(s => s.type === 'question');
    expect(questionSignals.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect low confidence phrases', () => {
    const signals = computeUncertaintySignals(LOW_CONFIDENCE_TEXT);

    const lowConfidenceSignals = signals.filter(s => s.type === 'low_confidence');
    expect(lowConfidenceSignals.length).toBeGreaterThan(0);

    // Should detect "not sure", "I think", "don't know"
    const phrases = lowConfidenceSignals.map(s => s.text.toLowerCase());
    expect(phrases.some(p =>
      p.includes('not sure') || p.includes('think') || p.includes("don't know")
    )).toBe(true);
  });

  it('should detect unknown entity references', () => {
    const signals = computeUncertaintySignals(UNKNOWN_ENTITY_TEXT);

    const unknownEntitySignals = signals.filter(s => s.type === 'unknown_entity');
    expect(unknownEntitySignals.length).toBeGreaterThan(0);

    // Should detect "XyzHandler", "UnknownWidget"
    const entities = unknownEntitySignals.map(s => s.text);
    expect(entities.some(e => e.includes('Xyz') || e.includes('Unknown'))).toBe(true);
  });

  it('should detect vague quantifiers', () => {
    const signals = computeUncertaintySignals(VAGUE_QUANTIFIER_TEXT);

    const vagueSignals = signals.filter(s => s.type === 'vague_quantifier');
    expect(vagueSignals.length).toBeGreaterThan(0);

    // Should detect "some", "several", "many", "few"
    const quantifiers = vagueSignals.map(s => s.text.toLowerCase());
    expect(quantifiers.some(q =>
      q.includes('some') || q.includes('several') || q.includes('many') || q.includes('few')
    )).toBe(true);
  });

  it('should return empty array for high confidence text', () => {
    const signals = computeUncertaintySignals(HIGH_CONFIDENCE_TEXT);

    // Should have no or minimal signals for confident text
    expect(signals.length).toBe(0);
  });

  it('should detect multiple signal types in mixed text', () => {
    const signals = computeUncertaintySignals(MIXED_UNCERTAINTY_TEXT);

    const signalTypes = new Set(signals.map(s => s.type));
    expect(signalTypes.size).toBeGreaterThanOrEqual(2);
  });

  it('should include position for each signal', () => {
    const signals = computeUncertaintySignals(HEDGING_TEXT);

    for (const signal of signals) {
      expect(typeof signal.position).toBe('number');
      expect(signal.position).toBeGreaterThanOrEqual(0);
      expect(signal.position).toBeLessThan(HEDGING_TEXT.length);
    }
  });

  it('should include severity for each signal', () => {
    const signals = computeUncertaintySignals(MIXED_UNCERTAINTY_TEXT);

    for (const signal of signals) {
      expect(typeof signal.severity).toBe('number');
      expect(signal.severity).toBeGreaterThanOrEqual(0);
      expect(signal.severity).toBeLessThanOrEqual(1);
    }
  });

  it('should handle empty text', () => {
    const signals = computeUncertaintySignals('');
    expect(signals).toEqual([]);
  });

  it('should handle text with only whitespace', () => {
    const signals = computeUncertaintySignals('   \n\t  ');
    expect(signals).toEqual([]);
  });
});

// ============================================================================
// DETECT RETRIEVAL NEED TESTS
// ============================================================================

describe('detectRetrievalNeed', () => {
  it('should recommend retrieval when uncertainty is high', () => {
    const context = 'Looking for information about the database schema.';
    const generatedText = "I'm not sure how the tables are connected. Maybe the User table?";

    const decision = detectRetrievalNeed(context, generatedText);

    expect(decision.shouldRetrieve).toBe(true);
    expect(decision.signals.length).toBeGreaterThan(0);
  });

  it('should not recommend retrieval when text is confident', () => {
    const context = 'Looking for information about the database schema.';
    const generatedText = 'The User table has three columns: id, name, and email.';

    const decision = detectRetrievalNeed(context, generatedText);

    expect(decision.shouldRetrieve).toBe(false);
  });

  it('should include reason for retrieval decision', () => {
    const decision = detectRetrievalNeed('context', HEDGING_TEXT);

    expect(typeof decision.reason).toBe('string');
    expect(decision.reason.length).toBeGreaterThan(0);
  });

  it('should include all detected signals', () => {
    const decision = detectRetrievalNeed('context', MIXED_UNCERTAINTY_TEXT);

    expect(Array.isArray(decision.signals)).toBe(true);
    expect(decision.signals.length).toBeGreaterThan(0);
  });

  it('should include confidence score for decision', () => {
    const decision = detectRetrievalNeed('context', HEDGING_TEXT);

    expect(typeof decision.confidence).toBe('number');
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  });

  it('should weight multiple signals appropriately', () => {
    const decisionMixed = detectRetrievalNeed('context', MIXED_UNCERTAINTY_TEXT);
    const decisionSingle = detectRetrievalNeed('context', 'Perhaps this works.');

    // Mixed uncertainty should have higher retrieval need
    if (decisionMixed.shouldRetrieve && decisionSingle.shouldRetrieve) {
      expect(decisionMixed.signals.length).toBeGreaterThan(decisionSingle.signals.length);
    }
  });

  it('should consider context when making decision', () => {
    const relevantContext = 'The function getUserById returns a User object.';
    const irrelevantContext = 'The weather is nice today.';
    const generatedText = 'Maybe the getUserById function exists?';

    const decisionRelevant = detectRetrievalNeed(relevantContext, generatedText);
    const decisionIrrelevant = detectRetrievalNeed(irrelevantContext, generatedText);

    // Both should detect uncertainty, but context might affect confidence
    expect(decisionRelevant.signals.length).toBeGreaterThan(0);
    expect(decisionIrrelevant.signals.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TRIGGER DYNAMIC RETRIEVAL TESTS
// ============================================================================

describe('triggerDynamicRetrieval', () => {
  it('should generate query from uncertainty signals', () => {
    const signals: UncertaintySignal[] = [
      { type: 'unknown_entity', text: 'UserService', position: 10, severity: 0.8 },
      { type: 'hedging', text: 'might', position: 5, severity: 0.6 },
    ];

    const result = triggerDynamicRetrieval('Find the UserService', signals);

    expect(result.query).toContain('UserService');
  });

  it('should prioritize high severity signals', () => {
    const signals: UncertaintySignal[] = [
      { type: 'unknown_entity', text: 'ImportantClass', position: 10, severity: 0.9 },
      { type: 'vague_quantifier', text: 'some', position: 0, severity: 0.3 },
    ];

    const result = triggerDynamicRetrieval('Looking for classes', signals);

    // High severity signal should be included in query
    expect(result.query.toLowerCase()).toContain('importantclass');
  });

  it('should extract entities from unknown_entity signals', () => {
    const signals: UncertaintySignal[] = [
      { type: 'unknown_entity', text: 'XyzHandler', position: 10, severity: 0.8 },
      { type: 'unknown_entity', text: 'AbcService', position: 30, severity: 0.7 },
    ];

    const result = triggerDynamicRetrieval('Find handlers', signals);

    expect(result.query).toContain('XyzHandler');
    expect(result.query).toContain('AbcService');
  });

  it('should include relevant context terms', () => {
    const signals: UncertaintySignal[] = [
      { type: 'hedging', text: 'might', position: 5, severity: 0.6 },
    ];

    const result = triggerDynamicRetrieval('database connection pooling', signals);

    // Should include context terms
    expect(
      result.query.includes('database') ||
      result.query.includes('connection') ||
      result.query.includes('pooling')
    ).toBe(true);
  });

  it('should handle empty signals array', () => {
    const result = triggerDynamicRetrieval('Some query', []);

    expect(result.query).toBeDefined();
    expect(typeof result.query).toBe('string');
  });

  it('should limit query length', () => {
    const signals: UncertaintySignal[] = Array.from({ length: 20 }, (_, i) => ({
      type: 'unknown_entity' as const,
      text: `Entity${i}WithVeryLongName`,
      position: i * 10,
      severity: 0.5,
    }));

    const result = triggerDynamicRetrieval('original query', signals);

    // Query should not be excessively long
    expect(result.query.length).toBeLessThan(300);
  });
});

// ============================================================================
// DRAGIN RETRIEVER CLASS TESTS
// ============================================================================

describe('DRAGINRetriever', () => {
  let retriever: DRAGINRetriever;

  beforeEach(() => {
    retriever = createDRAGINRetriever();
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = retriever.getConfig();

      expect(config).toBeDefined();
      expect(typeof config.uncertaintyThreshold).toBe('number');
      expect(typeof config.minSignalSeverity).toBe('number');
      expect(typeof config.maxRetrievalAttempts).toBe('number');
    });

    it('should return a copy of config (not reference)', () => {
      const config1 = retriever.getConfig();
      const config2 = retriever.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('processGeneration', () => {
    it('should detect retrieval need and return result', async () => {
      const result = await retriever.processGeneration(
        'Find the authentication handler',
        "The AuthHandler might process login requests. I'm not sure about the exact implementation."
      );

      expect(result).toBeDefined();
      expect(typeof result.originalText).toBe('string');
      expect(typeof result.revisedText).toBe('string');
      expect(typeof result.retrievalTriggered).toBe('boolean');
      expect(Array.isArray(result.retrievedContext)).toBe(true);
      expect(Array.isArray(result.signals)).toBe(true);
    });

    it('should trigger retrieval for uncertain text', async () => {
      const result = await retriever.processGeneration(
        'Find database functions',
        "Maybe the getUser function exists? I'm not sure where it's defined."
      );

      expect(result.retrievalTriggered).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should not trigger retrieval for confident text', async () => {
      const result = await retriever.processGeneration(
        'Find database functions',
        'The getUser function is defined in src/db/users.ts at line 42.'
      );

      expect(result.retrievalTriggered).toBe(false);
      expect(result.signals.length).toBe(0);
    });

    it('should preserve original text', async () => {
      const originalText = 'The function might work.';
      const result = await retriever.processGeneration('context', originalText);

      expect(result.originalText).toBe(originalText);
    });

    it('should return signals found during analysis', async () => {
      const result = await retriever.processGeneration(
        'context',
        MIXED_UNCERTAINTY_TEXT
      );

      expect(result.signals.length).toBeGreaterThan(0);
      for (const signal of result.signals) {
        expect(signal.type).toBeDefined();
        expect(signal.text).toBeDefined();
        expect(signal.position).toBeDefined();
        expect(signal.severity).toBeDefined();
      }
    });
  });

  describe('analyzeUncertainty', () => {
    it('should analyze text and return signals', () => {
      const signals = retriever.analyzeUncertainty(HEDGING_TEXT);

      expect(Array.isArray(signals)).toBe(true);
      expect(signals.length).toBeGreaterThan(0);
    });

    it('should filter signals by minimum severity', () => {
      const highThresholdRetriever = createDRAGINRetriever({
        minSignalSeverity: 0.9,
      });

      const signals = highThresholdRetriever.analyzeUncertainty(HEDGING_TEXT);

      for (const signal of signals) {
        expect(signal.severity).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  describe('shouldRetrieve', () => {
    it('should return true when uncertainty exceeds threshold', () => {
      const signals: UncertaintySignal[] = [
        { type: 'hedging', text: 'might', position: 0, severity: 0.8 },
        { type: 'hedging', text: 'possibly', position: 10, severity: 0.7 },
        { type: 'low_confidence', text: 'not sure', position: 20, severity: 0.9 },
      ];

      const shouldRetrieve = retriever.shouldRetrieve(signals);

      expect(shouldRetrieve).toBe(true);
    });

    it('should return false when signals are below threshold', () => {
      const lowThresholdRetriever = createDRAGINRetriever({
        uncertaintyThreshold: 0.95,
      });

      const signals: UncertaintySignal[] = [
        { type: 'vague_quantifier', text: 'some', position: 0, severity: 0.3 },
      ];

      const shouldRetrieve = lowThresholdRetriever.shouldRetrieve(signals);

      expect(shouldRetrieve).toBe(false);
    });

    it('should return false for empty signals', () => {
      const shouldRetrieve = retriever.shouldRetrieve([]);

      expect(shouldRetrieve).toBe(false);
    });
  });
});

// ============================================================================
// ACTIVE RETRIEVAL RESULT INTERFACE TESTS
// ============================================================================

describe('ActiveRetrievalResult Interface', () => {
  let retriever: DRAGINRetriever;

  beforeEach(() => {
    retriever = createDRAGINRetriever();
  });

  it('should have all required fields', async () => {
    const result = await retriever.processGeneration('context', HEDGING_TEXT);

    expect('originalText' in result).toBe(true);
    expect('revisedText' in result).toBe(true);
    expect('retrievalTriggered' in result).toBe(true);
    expect('retrievedContext' in result).toBe(true);
    expect('signals' in result).toBe(true);
  });

  it('should have correct types for all fields', async () => {
    const result = await retriever.processGeneration('context', HEDGING_TEXT);

    expect(typeof result.originalText).toBe('string');
    expect(typeof result.revisedText).toBe('string');
    expect(typeof result.retrievalTriggered).toBe('boolean');
    expect(Array.isArray(result.retrievedContext)).toBe(true);
    expect(Array.isArray(result.signals)).toBe(true);
  });
});

// ============================================================================
// UNCERTAINTY SIGNAL INTERFACE TESTS
// ============================================================================

describe('UncertaintySignal Interface', () => {
  it('should have valid type values', () => {
    const signals = computeUncertaintySignals(MIXED_UNCERTAINTY_TEXT);

    const validTypes = ['hedging', 'question', 'low_confidence', 'unknown_entity', 'vague_quantifier'];

    for (const signal of signals) {
      expect(validTypes).toContain(signal.type);
    }
  });

  it('should have non-empty text', () => {
    const signals = computeUncertaintySignals(MIXED_UNCERTAINTY_TEXT);

    for (const signal of signals) {
      expect(signal.text.length).toBeGreaterThan(0);
    }
  });

  it('should have valid position', () => {
    const signals = computeUncertaintySignals(MIXED_UNCERTAINTY_TEXT);

    for (const signal of signals) {
      expect(Number.isInteger(signal.position)).toBe(true);
      expect(signal.position).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have severity in valid range', () => {
    const signals = computeUncertaintySignals(MIXED_UNCERTAINTY_TEXT);

    for (const signal of signals) {
      expect(signal.severity).toBeGreaterThanOrEqual(0);
      expect(signal.severity).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// RETRIEVAL DECISION INTERFACE TESTS
// ============================================================================

describe('RetrievalDecision Interface', () => {
  it('should have all required fields', () => {
    const decision = detectRetrievalNeed('context', HEDGING_TEXT);

    expect('shouldRetrieve' in decision).toBe(true);
    expect('reason' in decision).toBe(true);
    expect('signals' in decision).toBe(true);
    expect('confidence' in decision).toBe(true);
  });

  it('should have correct types', () => {
    const decision = detectRetrievalNeed('context', HEDGING_TEXT);

    expect(typeof decision.shouldRetrieve).toBe('boolean');
    expect(typeof decision.reason).toBe('string');
    expect(Array.isArray(decision.signals)).toBe(true);
    expect(typeof decision.confidence).toBe('number');
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_DRAGIN_CONFIG', () => {
  it('should have reasonable default values', () => {
    expect(DEFAULT_DRAGIN_CONFIG.uncertaintyThreshold).toBeGreaterThan(0);
    expect(DEFAULT_DRAGIN_CONFIG.uncertaintyThreshold).toBeLessThan(1);

    expect(DEFAULT_DRAGIN_CONFIG.minSignalSeverity).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_DRAGIN_CONFIG.minSignalSeverity).toBeLessThan(1);

    expect(DEFAULT_DRAGIN_CONFIG.maxRetrievalAttempts).toBeGreaterThan(0);
  });

  it('should be used when no config is provided', () => {
    const retriever = createDRAGINRetriever();
    const config = retriever.getConfig();

    expect(config.uncertaintyThreshold).toBe(DEFAULT_DRAGIN_CONFIG.uncertaintyThreshold);
    expect(config.minSignalSeverity).toBe(DEFAULT_DRAGIN_CONFIG.minSignalSeverity);
    expect(config.maxRetrievalAttempts).toBe(DEFAULT_DRAGIN_CONFIG.maxRetrievalAttempts);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('DRAGIN Edge Cases', () => {
  let retriever: DRAGINRetriever;

  beforeEach(() => {
    retriever = createDRAGINRetriever();
  });

  it('should handle empty context', async () => {
    const result = await retriever.processGeneration('', HEDGING_TEXT);

    expect(result).toBeDefined();
    expect(result.originalText).toBe(HEDGING_TEXT);
  });

  it('should handle empty generated text', async () => {
    const result = await retriever.processGeneration('context', '');

    expect(result).toBeDefined();
    expect(result.retrievalTriggered).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it('should handle very long text', async () => {
    const longText = HEDGING_TEXT.repeat(100);
    const result = await retriever.processGeneration('context', longText);

    expect(result).toBeDefined();
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('should handle text with special characters', async () => {
    const specialText = "Maybe it's <script>alert('test')</script> or perhaps not?";
    const result = await retriever.processGeneration('context', specialText);

    expect(result).toBeDefined();
  });

  it('should handle unicode text', async () => {
    const unicodeText = 'Perhaps the \u00e9l\u00e8ve function might work? I\'m not sure.';
    const result = await retriever.processGeneration('context', unicodeText);

    expect(result).toBeDefined();
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('should handle text with only numbers', async () => {
    const numberText = '12345 67890 111213';
    const result = await retriever.processGeneration('context', numberText);

    expect(result).toBeDefined();
    expect(result.retrievalTriggered).toBe(false);
  });

  it('should handle text with newlines', async () => {
    const multilineText = 'Maybe this works?\nI\'m not sure.\nPerhaps line 3?';
    const result = await retriever.processGeneration('context', multilineText);

    expect(result).toBeDefined();
    expect(result.signals.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// COMPOSABILITY TESTS
// ============================================================================

describe('DRAGIN Composability', () => {
  it('should work with different uncertainty thresholds', async () => {
    const lowThreshold = createDRAGINRetriever({ uncertaintyThreshold: 0.2 });
    const highThreshold = createDRAGINRetriever({ uncertaintyThreshold: 0.9 });

    const text = 'Maybe the function exists somewhere.';

    const resultLow = await lowThreshold.processGeneration('context', text);
    const resultHigh = await highThreshold.processGeneration('context', text);

    // Low threshold should be more likely to trigger retrieval
    if (resultLow.signals.length > 0) {
      expect(resultLow.retrievalTriggered || !resultHigh.retrievalTriggered).toBe(true);
    }
  });

  it('should filter signals based on minSignalSeverity', async () => {
    const strictRetriever = createDRAGINRetriever({ minSignalSeverity: 0.8 });
    const lenientRetriever = createDRAGINRetriever({ minSignalSeverity: 0.1 });

    const text = 'Some functions might use several parameters.';

    const strictSignals = strictRetriever.analyzeUncertainty(text);
    const lenientSignals = lenientRetriever.analyzeUncertainty(text);

    // Lenient should find more or equal signals
    expect(lenientSignals.length).toBeGreaterThanOrEqual(strictSignals.length);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('DRAGIN Performance', () => {
  it('should process typical text quickly', async () => {
    const retriever = createDRAGINRetriever();
    const start = Date.now();

    await retriever.processGeneration('context', MIXED_UNCERTAINTY_TEXT);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100); // Should complete in < 100ms
  });

  it('should handle multiple consecutive calls', async () => {
    const retriever = createDRAGINRetriever();

    const promises = Array.from({ length: 10 }, () =>
      retriever.processGeneration('context', HEDGING_TEXT)
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(10);
    for (const result of results) {
      expect(result).toBeDefined();
    }
  });
});
