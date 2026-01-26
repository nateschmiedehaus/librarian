/**
 * @fileoverview Tests for Technique-Epistemics Contract Bridge
 *
 * Verifies that the TechniqueContractBridge correctly:
 * - Derives confidence values from technique execution results
 * - Creates epistemics contracts from technique primitives
 * - Records execution events to the Evidence Ledger
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TechniqueContractBridge,
  createTechniqueContractBridge,
  DEFAULT_CONFIDENCE_SPEC,
  type EnhancedExecutionResult,
} from '../technique_contract_bridge.js';
import type { TechniquePrimitive } from '../../strategic/techniques.js';
import type { PrimitiveExecutionResult, ExecutionContext } from '../technique_execution.js';
import { resetContractRegistry } from '../../epistemics/contracts.js';
import { bounded, deterministic } from '../../epistemics/confidence.js';
import type { IEvidenceLedger, EvidenceEntry, EvidenceQuery, EvidenceFilter, EvidenceChain, EvidenceId, SessionId } from '../../epistemics/evidence_ledger.js';

// ============================================================================
// MOCK EVIDENCE LEDGER
// ============================================================================

class MockEvidenceLedger implements IEvidenceLedger {
  private entries: EvidenceEntry[] = [];
  private idCounter = 0;

  async append(entry: Omit<EvidenceEntry, 'id' | 'timestamp'>): Promise<EvidenceEntry> {
    const fullEntry: EvidenceEntry = {
      ...entry,
      id: `ev_${++this.idCounter}` as EvidenceId,
      timestamp: new Date(),
    };
    this.entries.push(fullEntry);
    return fullEntry;
  }

  async appendBatch(entries: Omit<EvidenceEntry, 'id' | 'timestamp'>[]): Promise<EvidenceEntry[]> {
    return Promise.all(entries.map((e) => this.append(e)));
  }

  async query(_criteria: EvidenceQuery): Promise<EvidenceEntry[]> {
    return [...this.entries];
  }

  async get(id: EvidenceId): Promise<EvidenceEntry | null> {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  async getChain(claimId: EvidenceId): Promise<EvidenceChain> {
    const claim = await this.get(claimId);
    if (!claim) {
      return { claim: null as unknown as EvidenceEntry, supporting: [], defeating: [] };
    }
    return { claim, supporting: [], defeating: [] };
  }

  async getSessionEntries(_sessionId: SessionId): Promise<EvidenceEntry[]> {
    return [...this.entries];
  }

  subscribe(_filter: EvidenceFilter, _callback: (entry: EvidenceEntry) => void): () => void {
    return () => {};
  }

  // Test helpers
  getEntries(): EvidenceEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.idCounter = 0;
  }
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockPrimitive(id: string, name: string): TechniquePrimitive {
  return {
    id,
    name,
    description: `Mock primitive: ${name}`,
    category: 'extraction',
    kind: 'llm_operation',
    abstractionLevel: 'medium',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
    },
    examples: [],
    semanticProfile: 'semantic_code_search',
    domainTags: ['general'],
    contract: {
      inputValidation: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1 },
        },
        required: ['query'],
      },
      outputValidation: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
      preconditions: ['query must not be empty'],
      postconditions: ['result contains relevant information'],
    },
  };
}

function createMockExecutionResult(
  status: 'success' | 'partial' | 'failed',
  input: Record<string, unknown> = { query: 'test' }
): PrimitiveExecutionResult {
  return {
    primitiveId: 'mock_primitive',
    status,
    input,
    output: status === 'failed' ? undefined : { result: 'test result' },
    evidence: [{ type: 'execution', summary: 'Test executed' }],
    issues: status === 'failed' ? [{ severity: 'error', message: 'Execution failed' }] : [],
    startedAt: new Date(),
    completedAt: new Date(),
    durationMs: 100,
  };
}

function createMockExecutionContext(hasLlm: boolean = true): ExecutionContext {
  return {
    llm: hasLlm ? { provider: 'anthropic', model: 'claude-3' } : undefined,
    storage: {} as unknown as ExecutionContext['storage'],
    rootDir: '/test',
    timeout: 30000,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('TechniqueContractBridge', () => {
  let bridge: TechniqueContractBridge;
  let ledger: MockEvidenceLedger;

  beforeEach(() => {
    ledger = new MockEvidenceLedger();
    resetContractRegistry();
    bridge = createTechniqueContractBridge({
      ledger,
      recordExecutionEvents: true,
    });
  });

  describe('enhanceResult', () => {
    it('adds confidence to successful execution result', async () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const result = createMockExecutionResult('success');
      const context = createMockExecutionContext();

      const enhanced = await bridge.enhanceResult(primitive, result, context);

      expect(enhanced.confidence).toBeDefined();
      expect(enhanced.confidence.type).toBe('derived');
      expect(enhanced.confidenceFactors.size).toBeGreaterThan(0);
      expect(enhanced.evidenceRecorded).toBe(true);
    });

    it('produces lower confidence for partial execution', async () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const successResult = createMockExecutionResult('success');
      const partialResult = createMockExecutionResult('partial');
      const context = createMockExecutionContext();

      const successEnhanced = await bridge.enhanceResult(primitive, successResult, context);
      const partialEnhanced = await bridge.enhanceResult(primitive, partialResult, context);

      // Get numeric values for comparison
      const successValue = getNumericConfidence(successEnhanced.confidence);
      const partialValue = getNumericConfidence(partialEnhanced.confidence);

      expect(partialValue).toBeLessThan(successValue);
    });

    it('produces lowest confidence for failed execution', async () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const partialResult = createMockExecutionResult('partial');
      const failedResult = createMockExecutionResult('failed');
      const context = createMockExecutionContext();

      const partialEnhanced = await bridge.enhanceResult(primitive, partialResult, context);
      const failedEnhanced = await bridge.enhanceResult(primitive, failedResult, context);

      const partialValue = getNumericConfidence(partialEnhanced.confidence);
      const failedValue = getNumericConfidence(failedEnhanced.confidence);

      expect(failedValue).toBeLessThan(partialValue);
    });

    it('records execution evidence to ledger', async () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const result = createMockExecutionResult('success');
      const context = createMockExecutionContext();

      await bridge.enhanceResult(primitive, result, context);

      const entries = ledger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe('claim');
      expect(entries[0].payload).toMatchObject({
        category: 'behavior',
        subject: {
          type: 'function',
          identifier: primitive.id,
        },
      });
    });

    it('does not record evidence when disabled', async () => {
      const bridgeNoRecord = createTechniqueContractBridge({
        ledger,
        recordExecutionEvents: false,
      });

      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const result = createMockExecutionResult('success');
      const context = createMockExecutionContext();

      const enhanced = await bridgeNoRecord.enhanceResult(primitive, result, context);

      expect(enhanced.evidenceRecorded).toBe(false);
      expect(ledger.getEntries()).toHaveLength(0);
    });

    it('incorporates input confidences when provided', async () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const result = createMockExecutionResult('success');
      const context = createMockExecutionContext();

      // Low input confidence should reduce overall confidence
      const lowInputConfidence = new Map([
        ['query', bounded(0.2, 0.3, 'theoretical', 'test')],
      ]);

      const highInputConfidence = new Map([
        ['query', bounded(0.9, 1.0, 'theoretical', 'test')],
      ]);

      const lowEnhanced = await bridge.enhanceResult(primitive, result, context, {
        inputConfidences: lowInputConfidence,
      });

      const highEnhanced = await bridge.enhanceResult(primitive, result, context, {
        inputConfidences: highInputConfidence,
      });

      const lowValue = getNumericConfidence(lowEnhanced.confidence);
      const highValue = getNumericConfidence(highEnhanced.confidence);

      expect(lowValue).toBeLessThan(highValue);
    });

    it('handles execution context without LLM', async () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const result = createMockExecutionResult('success');
      const contextNoLlm = createMockExecutionContext(false);

      const enhanced = await bridge.enhanceResult(primitive, result, contextNoLlm);

      expect(enhanced.confidence).toBeDefined();
      expect(enhanced.confidence.type).toBe('derived');
    });
  });

  describe('createEpistemicsContract', () => {
    it('creates epistemics contract from technique primitive', () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');

      const contract = bridge.createEpistemicsContract(primitive);

      expect(contract).not.toBeNull();
      expect(contract!.id).toBe('contract_test_prim');
      expect(contract!.primitiveId).toBe('test_prim');
      expect(contract!.preconditions).toHaveLength(1);
      expect(contract!.postconditions).toHaveLength(1);
    });

    it('returns null for primitive without contract', () => {
      const primitive = createMockPrimitive('no_contract', 'No Contract');
      delete (primitive as Record<string, unknown>).contract;

      const contract = bridge.createEpistemicsContract(primitive);

      expect(contract).toBeNull();
    });

    it('includes default confidence derivation spec', () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');

      const contract = bridge.createEpistemicsContract(primitive);

      expect(contract!.confidenceDerivation).toEqual(DEFAULT_CONFIDENCE_SPEC);
    });
  });

  describe('registerPrimitiveContract', () => {
    it('registers primitive contract with registry', () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');

      const registered = bridge.registerPrimitiveContract(primitive);

      expect(registered).toBe(true);
    });

    it('returns false for duplicate registration', () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');

      bridge.registerPrimitiveContract(primitive);
      const secondRegistration = bridge.registerPrimitiveContract(primitive);

      expect(secondRegistration).toBe(false);
    });

    it('returns false for primitive without contract', () => {
      const primitive = createMockPrimitive('no_contract', 'No Contract');
      delete (primitive as Record<string, unknown>).contract;

      const registered = bridge.registerPrimitiveContract(primitive);

      expect(registered).toBe(false);
    });
  });

  describe('meetsConfidenceThreshold', () => {
    it('returns true when confidence meets threshold', async () => {
      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const result = createMockExecutionResult('success');
      const context = createMockExecutionContext();

      const enhanced = await bridge.enhanceResult(primitive, result, context);

      // Success execution should have high confidence (> 0.3 default threshold)
      expect(bridge.meetsConfidenceThreshold(enhanced)).toBe(true);
    });

    it('returns false when confidence is below threshold', async () => {
      const strictBridge = createTechniqueContractBridge({
        ledger,
        minimumConfidenceThreshold: 0.99, // Very high threshold
      });

      const primitive = createMockPrimitive('test_prim', 'Test Primitive');
      const result = createMockExecutionResult('partial');
      const context = createMockExecutionContext();

      const enhanced = await strictBridge.enhanceResult(primitive, result, context);

      // Partial execution won't meet 0.99 threshold
      expect(strictBridge.meetsConfidenceThreshold(enhanced)).toBe(false);
    });
  });

  describe('DEFAULT_CONFIDENCE_SPEC', () => {
    it('has four confidence factors', () => {
      expect(DEFAULT_CONFIDENCE_SPEC.factors).toHaveLength(4);
    });

    it('uses weighted_average combiner', () => {
      expect(DEFAULT_CONFIDENCE_SPEC.combiner).toBe('weighted_average');
    });

    it('weights sum to 1.0', () => {
      const totalWeight = DEFAULT_CONFIDENCE_SPEC.factors.reduce(
        (sum, f) => sum + f.baseWeight,
        0
      );
      expect(totalWeight).toBeCloseTo(1.0);
    });
  });

  describe('factory', () => {
    it('createTechniqueContractBridge returns TechniqueContractBridge instance', () => {
      const bridge = createTechniqueContractBridge();
      expect(bridge).toBeInstanceOf(TechniqueContractBridge);
    });
  });
});

// ============================================================================
// HELPERS
// ============================================================================

function getNumericConfidence(conf: EnhancedExecutionResult['confidence']): number {
  switch (conf.type) {
    case 'deterministic':
      return conf.value;
    case 'derived':
    case 'measured':
      return conf.value;
    case 'bounded':
      return (conf.low + conf.high) / 2;
    case 'absent':
      return 0.5;
  }
}
