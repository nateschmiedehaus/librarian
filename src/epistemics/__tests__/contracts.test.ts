/**
 * @fileoverview Tier-0 Tests for Primitive Contracts
 *
 * Deterministic tests that verify the Contract system implementation.
 * These tests require no external providers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ContractExecutor,
  ContractViolation,
  getContractRegistry,
  resetContractRegistry,
  createContractId,
  createPrimitiveId,
  createPrecondition,
  createPostcondition,
  DEFAULT_RETRY_POLICY,
  type PrimitiveContract,
  type ExecutionContext,
} from '../contracts.js';
import { createSessionId } from '../evidence_ledger.js';

// Test types
interface TestInput {
  value: number;
  shouldFail?: boolean;
}

interface TestOutput {
  result: number;
  processed: boolean;
}

describe('PrimitiveContracts', () => {
  beforeEach(() => {
    resetContractRegistry();
  });

  afterEach(() => {
    resetContractRegistry();
  });

  function createTestContext(): ExecutionContext {
    return {
      sessionId: createSessionId('test_session'),
      providers: { llm: true, embedding: true, storage: true },
      now: new Date(),
      budget: { tokensRemaining: 10000, timeRemainingMs: 30000 },
    };
  }

  describe('ContractRegistry', () => {
    it('registers and retrieves contracts', () => {
      const registry = getContractRegistry();

      const contract: PrimitiveContract<TestInput, TestOutput> = {
        id: createContractId('contract_test'),
        name: 'Test Contract',
        primitiveId: createPrimitiveId('tp_test'),
        preconditions: [],
        postconditions: [],
        invariants: [],
        confidenceDerivation: {
          factors: [],
          combiner: 'min',
        },
        errorSpec: {
          expectedErrors: [],
          retryPolicy: DEFAULT_RETRY_POLICY,
          fallback: 'throw',
        },
      };

      registry.register(contract);

      expect(registry.has(createPrimitiveId('tp_test'))).toBe(true);
      expect(registry.get(createPrimitiveId('tp_test'))).toEqual(contract);
    });

    it('prevents duplicate registration', () => {
      const registry = getContractRegistry();

      const contract: PrimitiveContract<TestInput, TestOutput> = {
        id: createContractId('contract_test'),
        name: 'Test Contract',
        primitiveId: createPrimitiveId('tp_test'),
        preconditions: [],
        postconditions: [],
        invariants: [],
        confidenceDerivation: { factors: [], combiner: 'min' },
        errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
      };

      registry.register(contract);

      expect(() => registry.register(contract)).toThrow('already registered');
    });

    it('lists all registered contracts', () => {
      const registry = getContractRegistry();

      registry.register({
        id: createContractId('contract_1'),
        name: 'Contract 1',
        primitiveId: createPrimitiveId('tp_1'),
        preconditions: [],
        postconditions: [],
        invariants: [],
        confidenceDerivation: { factors: [], combiner: 'min' },
        errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
      });

      registry.register({
        id: createContractId('contract_2'),
        name: 'Contract 2',
        primitiveId: createPrimitiveId('tp_2'),
        preconditions: [],
        postconditions: [],
        invariants: [],
        confidenceDerivation: { factors: [], combiner: 'min' },
        errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
      });

      const list = registry.list();
      expect(list).toHaveLength(2);
    });

    it('returns null for unknown primitive', () => {
      const registry = getContractRegistry();
      expect(registry.get(createPrimitiveId('tp_unknown'))).toBeNull();
    });
  });

  describe('ContractExecutor', () => {
    describe('preconditions', () => {
      it('passes execution when preconditions pass', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_pre_pass'),
          name: 'Precondition Pass Contract',
          primitiveId: createPrimitiveId('tp_pre_pass'),
          preconditions: [
            createPrecondition('positive_value', 'Value must be positive', (input) => input.value > 0),
          ],
          postconditions: [],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        const result = await executor.execute<TestInput, TestOutput>(
          createPrimitiveId('tp_pre_pass'),
          { value: 10 },
          async (input) => ({ result: input.value * 2, processed: true }),
          context
        );

        expect(result.output.result).toBe(20);
        expect(result.verification.preconditionsPassed).toContain('positive_value');
      });

      it('throws ContractViolation when critical precondition fails', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_pre_fail'),
          name: 'Precondition Fail Contract',
          primitiveId: createPrimitiveId('tp_pre_fail'),
          preconditions: [
            createPrecondition(
              'positive_value',
              'Value must be positive',
              (input) => input.value > 0,
              { onViolation: 'throw', severity: 'critical' }
            ),
          ],
          postconditions: [],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        await expect(
          executor.execute<TestInput, TestOutput>(
            createPrimitiveId('tp_pre_fail'),
            { value: -5 },
            async (input) => ({ result: input.value * 2, processed: true }),
            context
          )
        ).rejects.toThrow(ContractViolation);
      });

      it('records warning when warning precondition fails', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_pre_warn'),
          name: 'Precondition Warn Contract',
          primitiveId: createPrimitiveId('tp_pre_warn'),
          preconditions: [
            createPrecondition(
              'large_value',
              'Value should be large',
              (input) => input.value > 100,
              { onViolation: 'warn', severity: 'warning' }
            ),
          ],
          postconditions: [],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        const result = await executor.execute<TestInput, TestOutput>(
          createPrimitiveId('tp_pre_warn'),
          { value: 50 },
          async (input) => ({ result: input.value * 2, processed: true }),
          context
        );

        expect(result.output.result).toBe(100);
        expect(result.verification.warnings).toHaveLength(1);
        expect(result.verification.warnings[0].conditionId).toBe('large_value');
      });
    });

    describe('postconditions', () => {
      it('passes when postconditions pass', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_post_pass'),
          name: 'Postcondition Pass Contract',
          primitiveId: createPrimitiveId('tp_post_pass'),
          preconditions: [],
          postconditions: [
            createPostcondition(
              'result_positive',
              'Result must be positive',
              (_, output) => output.result > 0
            ),
          ],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        const result = await executor.execute<TestInput, TestOutput>(
          createPrimitiveId('tp_post_pass'),
          { value: 10 },
          async (input) => ({ result: input.value * 2, processed: true }),
          context
        );

        expect(result.verification.postconditionsPassed).toContain('result_positive');
      });

      it('throws ContractViolation when postcondition fails', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_post_fail'),
          name: 'Postcondition Fail Contract',
          primitiveId: createPrimitiveId('tp_post_fail'),
          preconditions: [],
          postconditions: [
            createPostcondition(
              'result_positive',
              'Result must be positive',
              (_, output) => output.result > 0,
              { onViolation: 'throw' }
            ),
          ],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        await expect(
          executor.execute<TestInput, TestOutput>(
            createPrimitiveId('tp_post_fail'),
            { value: -10 },
            async (input) => ({ result: input.value * 2, processed: true }),
            context
          )
        ).rejects.toThrow(ContractViolation);
      });
    });

    describe('retry', () => {
      it('retries on transient error', async () => {
        const registry = getContractRegistry();
        let attemptCount = 0;

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_retry'),
          name: 'Retry Contract',
          primitiveId: createPrimitiveId('tp_retry'),
          preconditions: [],
          postconditions: [],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: {
            expectedErrors: [
              { code: 'TRANSIENT', transient: true, handling: 'retry', description: 'Transient' },
            ],
            retryPolicy: { maxAttempts: 3, baseDelayMs: 10, backoffMultiplier: 2, maxDelayMs: 100 },
            fallback: 'throw',
          },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        const result = await executor.execute<TestInput, TestOutput>(
          createPrimitiveId('tp_retry'),
          { value: 10 },
          async (input) => {
            attemptCount++;
            if (attemptCount < 2) {
              const error = new Error('Transient error') as Error & { code: string };
              error.code = 'TRANSIENT';
              throw error;
            }
            return { result: input.value * 2, processed: true };
          },
          context
        );

        expect(result.output.result).toBe(20);
        expect(result.execution.retryCount).toBe(1);
        expect(attemptCount).toBe(2);
      });

      it('respects max retries', async () => {
        const registry = getContractRegistry();
        let attemptCount = 0;

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_max_retry'),
          name: 'Max Retry Contract',
          primitiveId: createPrimitiveId('tp_max_retry'),
          preconditions: [],
          postconditions: [],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: {
            expectedErrors: [],
            retryPolicy: { maxAttempts: 2, baseDelayMs: 10, backoffMultiplier: 2, maxDelayMs: 100 },
            fallback: 'throw',
          },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        await expect(
          executor.execute<TestInput, TestOutput>(
            createPrimitiveId('tp_max_retry'),
            { value: 10 },
            async () => {
              attemptCount++;
              throw new Error('Always fails');
            },
            context
          )
        ).rejects.toThrow('Always fails');

        expect(attemptCount).toBe(3); // Initial + 2 retries
      });
    });

    describe('confidence derivation', () => {
      it('derives confidence from factors', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_confidence'),
          name: 'Confidence Contract',
          primitiveId: createPrimitiveId('tp_confidence'),
          preconditions: [],
          postconditions: [],
          invariants: [],
          confidenceDerivation: {
            factors: [
              { id: 'factor_a', source: 'execution_quality', baseWeight: 0.5 },
              { id: 'factor_b', source: 'input_confidence', baseWeight: 0.5 },
            ],
            combiner: 'weighted_average',
          },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        const result = await executor.execute<TestInput, TestOutput>(
          createPrimitiveId('tp_confidence'),
          { value: 10 },
          async (input) => ({ result: input.value * 2, processed: true }),
          context
        );

        expect(result.confidence).toBeDefined();
        expect(result.confidence.type).toBe('derived');
      });

      it('returns absent confidence when no factors', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_no_conf'),
          name: 'No Confidence Contract',
          primitiveId: createPrimitiveId('tp_no_conf'),
          preconditions: [],
          postconditions: [],
          invariants: [],
          confidenceDerivation: {
            factors: [],
            combiner: 'min',
          },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        const result = await executor.execute<TestInput, TestOutput>(
          createPrimitiveId('tp_no_conf'),
          { value: 10 },
          async (input) => ({ result: input.value * 2, processed: true }),
          context
        );

        expect(result.confidence.type).toBe('absent');
      });
    });

    describe('execution metadata', () => {
      it('records execution timing', async () => {
        const registry = getContractRegistry();

        registry.register<TestInput, TestOutput>({
          id: createContractId('contract_timing'),
          name: 'Timing Contract',
          primitiveId: createPrimitiveId('tp_timing'),
          preconditions: [],
          postconditions: [],
          invariants: [],
          confidenceDerivation: { factors: [], combiner: 'min' },
          errorSpec: { expectedErrors: [], retryPolicy: DEFAULT_RETRY_POLICY, fallback: 'throw' },
        });

        const executor = new ContractExecutor(registry);
        const context = createTestContext();

        const result = await executor.execute<TestInput, TestOutput>(
          createPrimitiveId('tp_timing'),
          { value: 10 },
          async (input) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { result: input.value * 2, processed: true };
          },
          context
        );

        expect(result.execution.startTime).toBeInstanceOf(Date);
        expect(result.execution.endTime).toBeInstanceOf(Date);
        // Timer resolution can vary slightly, allow 1ms tolerance
        expect(result.execution.durationMs).toBeGreaterThanOrEqual(9);
        expect(result.execution.retryCount).toBe(0);
      });
    });
  });

  describe('ContractViolation', () => {
    it('contains all violation details', () => {
      const violation = new ContractViolation(
        createContractId('contract_test'),
        'condition_id',
        'precondition',
        'Test violation message',
        { value: 10 },
        undefined
      );

      expect(violation.contractId).toBe('contract_test');
      expect(violation.conditionId).toBe('condition_id');
      expect(violation.conditionType).toBe('precondition');
      expect(violation.message).toContain('Test violation message');
      expect(violation.input).toEqual({ value: 10 });
      expect(violation.name).toBe('ContractViolation');
    });
  });
});
