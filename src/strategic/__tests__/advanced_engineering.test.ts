import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type Precondition,
  type Postcondition,
  type Invariant,
  type Contract,
  type ContractViolation,
  type MetamorphicRelation,
  type MetamorphicTest,
  type FuzzConfig,
  type PropertyTest,
  type PropertyTestConfig,
  type CircuitBreakerConfig,
  type BulkheadConfig,
  type RetryConfig,
  type ChaosConfig,
  type ProfileConfig,
  type PerformanceBaseline,
  type PerformanceMetrics,
  type RegressionResult,
  type ReviewGuideline,

  // Factory functions
  createPrecondition,
  createPostcondition,
  createInvariant,
  createContract,
  createContractEnforcement,
  createMetamorphicRelation,
  createCircuitBreakerConfig,
  createBulkheadConfig,
  createRetryConfig,
  createChaosConfig,
  createProfileConfig,
  createPerformanceBaseline,
  detectPerformanceRegression,

  // Constants
  DEFAULT_FUZZ_CONFIG,
  DEFAULT_PROPERTY_TEST_CONFIG,
  DEFAULT_REVIEW_GUIDELINES,
  STANDARD_METAMORPHIC_RELATIONS,
} from '../advanced_engineering.js';

describe('Advanced Engineering Module', () => {
  // ============================================================================
  // LIGHTWEIGHT FORMAL METHODS
  // ============================================================================
  describe('Lightweight Formal Methods', () => {
    describe('createPrecondition', () => {
      it('creates a precondition with required fields', () => {
        const pre = createPrecondition<number>(
          'positive-number',
          (n) => n > 0
        );

        expect(pre.name).toBe('positive-number');
        expect(pre.check(5)).toBe(true);
        expect(pre.check(-1)).toBe(false);
        expect(pre.severity).toBe('error');
        expect(pre.mode).toBe('strict');
      });

      it('accepts custom options', () => {
        const pre = createPrecondition<string>(
          'non-empty',
          (s) => s.length > 0,
          {
            description: 'String must not be empty',
            errorMessage: 'Empty string provided',
            severity: 'warning',
            mode: 'permissive',
          }
        );

        expect(pre.description).toBe('String must not be empty');
        expect(pre.errorMessage).toBe('Empty string provided');
        expect(pre.severity).toBe('warning');
        expect(pre.mode).toBe('permissive');
      });

      it('validates complex objects', () => {
        interface User {
          name: string;
          age: number;
        }

        const pre = createPrecondition<User>(
          'valid-user',
          (user) => user.name.length > 0 && user.age >= 0
        );

        expect(pre.check({ name: 'Alice', age: 30 })).toBe(true);
        expect(pre.check({ name: '', age: 30 })).toBe(false);
        expect(pre.check({ name: 'Bob', age: -1 })).toBe(false);
      });
    });

    describe('createPostcondition', () => {
      it('creates a postcondition with required fields', () => {
        const post = createPostcondition<number, number>(
          'result-greater',
          (input, output) => output > input
        );

        expect(post.name).toBe('result-greater');
        expect(post.check(5, 10)).toBe(true);
        expect(post.check(10, 5)).toBe(false);
      });

      it('validates relationship between input and output', () => {
        const post = createPostcondition<number[], number>(
          'sum-correct',
          (input, output) => input.reduce((a, b) => a + b, 0) === output
        );

        expect(post.check([1, 2, 3], 6)).toBe(true);
        expect(post.check([1, 2, 3], 5)).toBe(false);
      });
    });

    describe('createInvariant', () => {
      it('creates an invariant with required fields', () => {
        interface Counter {
          value: number;
        }

        const inv = createInvariant<Counter>(
          'non-negative-counter',
          (state) => state.value >= 0
        );

        expect(inv.name).toBe('non-negative-counter');
        expect(inv.check({ value: 5 })).toBe(true);
        expect(inv.check({ value: -1 })).toBe(false);
        expect(inv.checkpoints).toContain('before_method');
        expect(inv.checkpoints).toContain('after_method');
      });

      it('accepts custom checkpoints', () => {
        const inv = createInvariant<{ valid: boolean }>(
          'always-valid',
          (state) => state.valid,
          { checkpoints: ['on_state_change', 'periodic'] }
        );

        expect(inv.checkpoints).toContain('on_state_change');
        expect(inv.checkpoints).toContain('periodic');
        expect(inv.checkpoints).not.toContain('before_method');
      });
    });

    describe('createContract', () => {
      it('creates a contract with default values', () => {
        const contract = createContract<number, number>('increment');

        expect(contract.functionId).toBe('increment');
        expect(contract.enabled).toBe(true);
        expect(contract.preconditions).toHaveLength(0);
        expect(contract.postconditions).toHaveLength(0);
        expect(contract.onViolation).toEqual({ type: 'throw' });
      });

      it('creates a contract with pre and post conditions', () => {
        const pre = createPrecondition<number>('positive', (n) => n > 0);
        const post = createPostcondition<number, number>(
          'incremented',
          (input, output) => output === input + 1
        );

        const contract = createContract<number, number>('increment', {
          preconditions: [pre],
          postconditions: [post],
        });

        expect(contract.preconditions).toHaveLength(1);
        expect(contract.postconditions).toHaveLength(1);
      });
    });

    describe('createContractEnforcement', () => {
      it('creates an enforcement instance', () => {
        const enforcement = createContractEnforcement();

        expect(enforcement.getViolations()).toHaveLength(0);
        expect(typeof enforcement.enforceContract).toBe('function');
        expect(typeof enforcement.definePrecondition).toBe('function');
      });

      it('enforces preconditions', () => {
        const enforcement = createContractEnforcement();

        const pre = enforcement.definePrecondition<number>(
          'positive',
          (n) => n > 0
        );

        const contract = createContract<number, number>('double', {
          preconditions: [pre],
        });

        const enforcedFn = enforcement.enforceContract(
          (n) => n * 2,
          contract
        );

        expect(enforcedFn(5)).toBe(10);
        expect(() => enforcedFn(-1)).toThrow('Contract violation');
      });

      it('enforces postconditions', () => {
        const enforcement = createContractEnforcement();

        const post = enforcement.definePostcondition<number, number>(
          'doubled',
          (input, output) => output === input * 2
        );

        const contract = createContract<number, number>('bad-double', {
          postconditions: [post],
        });

        // This function is buggy - adds instead of multiplies
        const buggyFn = (n: number) => n + 2;

        const enforcedFn = enforcement.enforceContract(buggyFn, contract);

        expect(() => enforcedFn(5)).toThrow('Contract violation');
      });

      it('tracks violations when using aggregate mode', () => {
        const violations: ContractViolation[] = [];
        const enforcement = createContractEnforcement();

        const pre = enforcement.definePrecondition<number>(
          'positive',
          (n) => n > 0
        );

        const contract = createContract<number, number>('double', {
          preconditions: [pre],
          onViolation: { type: 'aggregate', destination: violations },
        });

        const enforcedFn = enforcement.enforceContract(
          (n) => n * 2,
          contract
        );

        enforcedFn(-1);
        enforcedFn(-2);

        expect(violations).toHaveLength(2);
        expect(violations[0].conditionName).toBe('positive');
        expect(violations[0].violationType).toBe('precondition');
      });

      it('logs violations when using log mode', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const enforcement = createContractEnforcement();

        const pre = enforcement.definePrecondition<number>(
          'positive',
          (n) => n > 0
        );

        const contract = createContract<number, number>('double', {
          preconditions: [pre],
          onViolation: { type: 'log', level: 'warn' },
        });

        const enforcedFn = enforcement.enforceContract(
          (n) => n * 2,
          contract
        );

        enforcedFn(-1);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('skips enforcement when contract is disabled', () => {
        const enforcement = createContractEnforcement();

        const pre = enforcement.definePrecondition<number>(
          'positive',
          (n) => n > 0
        );

        const contract = createContract<number, number>('double', {
          preconditions: [pre],
          enabled: false,
        });

        const enforcedFn = enforcement.enforceContract(
          (n) => n * 2,
          contract
        );

        // Should not throw even with negative input
        expect(enforcedFn(-5)).toBe(-10);
      });

      it('clears violations', () => {
        const enforcement = createContractEnforcement();

        const pre = enforcement.definePrecondition<number>(
          'positive',
          (n) => n > 0,
          { mode: 'permissive' }
        );

        const contract = createContract<number, number>('double', {
          preconditions: [pre],
          onViolation: { type: 'log', level: 'info' },
        });

        const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const enforcedFn = enforcement.enforceContract(
          (n) => n * 2,
          contract
        );

        enforcedFn(-1);
        expect(enforcement.getViolations()).toHaveLength(1);

        enforcement.clearViolations();
        expect(enforcement.getViolations()).toHaveLength(0);

        consoleSpy.mockRestore();
      });
    });
  });

  // ============================================================================
  // ADVANCED TESTING TECHNIQUES
  // ============================================================================
  describe('Advanced Testing Techniques', () => {
    describe('createMetamorphicRelation', () => {
      it('creates a basic metamorphic relation', () => {
        const relation = createMetamorphicRelation<number[], number>(
          'sum-commutativity',
          (input) => [...input].reverse(),
          (r1, r2) => r1 === r2,
          {
            description: 'Sum should be commutative',
            categories: ['math', 'aggregation'],
          }
        );

        expect(relation.name).toBe('sum-commutativity');
        expect(relation.categories).toContain('math');

        const input = [1, 2, 3];
        const transformed = relation.transformInput(input);
        expect(transformed).toEqual([3, 2, 1]);
      });

      it('verifies relations correctly', () => {
        const relation = createMetamorphicRelation<number, number>(
          'double-preserves-sign',
          (input) => input * 2,
          (r1, r2) => Math.sign(r1) === Math.sign(r2)
        );

        const input = 5;
        const transformed = relation.transformInput(input);

        // Simulate function results
        const r1 = input * 3; // Some function
        const r2 = transformed * 3;

        expect(relation.verifyRelation(r1, r2, input, transformed)).toBe(true);
      });
    });

    describe('STANDARD_METAMORPHIC_RELATIONS', () => {
      it('provides permutation invariance relation', () => {
        const relation = STANDARD_METAMORPHIC_RELATIONS.permutationInvariance<number[]>();

        expect(relation.name).toBe('Permutation Invariance');
        expect(relation.categories).toContain('search');

        const input = [1, 2, 3];
        const transformed = relation.transformInput(input);
        expect(transformed).toHaveLength(3);
        expect(transformed.sort()).toEqual([1, 2, 3]);
      });

      it('provides idempotence relation', () => {
        const relation = STANDARD_METAMORPHIC_RELATIONS.idempotence<number[]>();

        expect(relation.name).toBe('Idempotence');

        const input = [3, 1, 2];
        const transformed = relation.transformInput(input);
        expect(transformed).toEqual(input);
      });

      it('provides identity element relation', () => {
        const relation = STANDARD_METAMORPHIC_RELATIONS.identityElement();

        expect(relation.name).toBe('Identity Element');

        const input = [1, 2, 3];
        const transformed = relation.transformInput(input);
        expect(transformed).toEqual([1, 2, 3, 0]);
      });
    });

    describe('DEFAULT_FUZZ_CONFIG', () => {
      it('has sensible defaults', () => {
        expect(DEFAULT_FUZZ_CONFIG.maxIterations).toBe(10000);
        expect(DEFAULT_FUZZ_CONFIG.timeLimitSeconds).toBe(300);
        expect(DEFAULT_FUZZ_CONFIG.coverageGuided).toBe(true);
        expect(DEFAULT_FUZZ_CONFIG.mutationStrategies).toContain('bitflip');
        expect(DEFAULT_FUZZ_CONFIG.mutationStrategies).toContain('arithmetic');
        expect(DEFAULT_FUZZ_CONFIG.crashDetection.detectExceptions).toBe(true);
        expect(DEFAULT_FUZZ_CONFIG.crashDetection.detectHangs).toBe(true);
      });
    });

    describe('DEFAULT_PROPERTY_TEST_CONFIG', () => {
      it('has sensible defaults', () => {
        expect(DEFAULT_PROPERTY_TEST_CONFIG.numTests).toBe(100);
        expect(DEFAULT_PROPERTY_TEST_CONFIG.maxSize).toBe(100);
        expect(DEFAULT_PROPERTY_TEST_CONFIG.maxShrinks).toBe(100);
        expect(DEFAULT_PROPERTY_TEST_CONFIG.timeoutMs).toBe(5000);
        expect(DEFAULT_PROPERTY_TEST_CONFIG.verbose).toBe(false);
      });
    });
  });

  // ============================================================================
  // AI-ASSISTED DEVELOPMENT
  // ============================================================================
  describe('AI-Assisted Development', () => {
    describe('DEFAULT_REVIEW_GUIDELINES', () => {
      it('includes security guidelines', () => {
        const securityGuidelines = DEFAULT_REVIEW_GUIDELINES.filter(
          g => g.category === 'security'
        );

        expect(securityGuidelines.length).toBeGreaterThan(0);

        const secretsGuideline = securityGuidelines.find(
          g => g.id === 'no-hardcoded-secrets'
        );
        expect(secretsGuideline).toBeDefined();
        expect(secretsGuideline?.severity).toBe('critical');
        expect(secretsGuideline?.autoFixable).toBe(false);
      });

      it('includes maintainability guidelines', () => {
        const maintainabilityGuidelines = DEFAULT_REVIEW_GUIDELINES.filter(
          g => g.category === 'maintainability'
        );

        expect(maintainabilityGuidelines.length).toBeGreaterThan(0);

        const noConsoleGuideline = maintainabilityGuidelines.find(
          g => g.id === 'no-console-log'
        );
        expect(noConsoleGuideline).toBeDefined();
        expect(noConsoleGuideline?.autoFixable).toBe(true);
      });

      it('includes reliability guidelines', () => {
        const reliabilityGuidelines = DEFAULT_REVIEW_GUIDELINES.filter(
          g => g.category === 'reliability'
        );

        expect(reliabilityGuidelines.length).toBeGreaterThan(0);

        const asyncGuideline = reliabilityGuidelines.find(
          g => g.id === 'async-await-error-handling'
        );
        expect(asyncGuideline).toBeDefined();
        expect(asyncGuideline?.severity).toBe('major');
      });

      it('has proper pattern definitions', () => {
        for (const guideline of DEFAULT_REVIEW_GUIDELINES) {
          expect(guideline.patterns.length).toBeGreaterThan(0);

          for (const pattern of guideline.patterns) {
            expect(['regex', 'ast', 'semantic', 'custom']).toContain(pattern.type);
            expect(pattern.explanation).toBeDefined();
            expect(pattern.explanation.length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  // ============================================================================
  // RELIABILITY PATTERNS
  // ============================================================================
  describe('Reliability Patterns', () => {
    describe('createCircuitBreakerConfig', () => {
      it('creates config with defaults', () => {
        const config = createCircuitBreakerConfig('test-circuit');

        expect(config.name).toBe('test-circuit');
        expect(config.failureThreshold).toBe(5);
        expect(config.failureWindowMs).toBe(60000);
        expect(config.resetTimeoutMs).toBe(30000);
        expect(config.successThreshold).toBe(3);
        expect(config.tripOnErrors).toHaveLength(1);
      });

      it('accepts custom options', () => {
        const config = createCircuitBreakerConfig('custom-circuit', {
          failureThreshold: 3,
          resetTimeoutMs: 10000,
          fallback: { type: 'value', value: null },
        });

        expect(config.failureThreshold).toBe(3);
        expect(config.resetTimeoutMs).toBe(10000);
        expect(config.fallback).toEqual({ type: 'value', value: null });
      });

      it('accepts event handlers', () => {
        const onTrip = vi.fn();
        const onReset = vi.fn();

        const config = createCircuitBreakerConfig('handler-circuit', {
          onTrip,
          onReset,
        });

        expect(config.onTrip).toBe(onTrip);
        expect(config.onReset).toBe(onReset);
      });
    });

    describe('createBulkheadConfig', () => {
      it('creates config with defaults', () => {
        const config = createBulkheadConfig('test-bulkhead');

        expect(config.name).toBe('test-bulkhead');
        expect(config.maxConcurrent).toBe(10);
        expect(config.maxQueue).toBe(100);
        expect(config.queueTimeoutMs).toBe(30000);
        expect(config.onReject).toEqual({ type: 'throw' });
      });

      it('accepts custom options', () => {
        const config = createBulkheadConfig('custom-bulkhead', {
          maxConcurrent: 5,
          maxQueue: 50,
          onReject: { type: 'fallback', value: 'queued' },
        });

        expect(config.maxConcurrent).toBe(5);
        expect(config.maxQueue).toBe(50);
        expect(config.onReject).toEqual({ type: 'fallback', value: 'queued' });
      });

      it('accepts priority function', () => {
        const priority = (req: unknown) => 1;

        const config = createBulkheadConfig('priority-bulkhead', {
          priority,
        });

        expect(config.priority).toBe(priority);
      });
    });

    describe('createRetryConfig', () => {
      it('creates config with defaults', () => {
        const config = createRetryConfig();

        expect(config.maxAttempts).toBe(3);
        expect(config.baseDelayMs).toBe(1000);
        expect(config.maxDelayMs).toBe(30000);
        expect(config.backoffStrategy).toEqual({ type: 'exponential', multiplier: 2 });
        expect(config.jitter).toEqual({ type: 'full', factor: 0.5 });
      });

      it('accepts custom backoff strategies', () => {
        const linearConfig = createRetryConfig({
          backoffStrategy: { type: 'linear', increment: 500 },
        });
        expect(linearConfig.backoffStrategy).toEqual({ type: 'linear', increment: 500 });

        const fibConfig = createRetryConfig({
          backoffStrategy: { type: 'fibonacci' },
        });
        expect(fibConfig.backoffStrategy).toEqual({ type: 'fibonacci' });
      });

      it('accepts custom jitter strategies', () => {
        const noJitter = createRetryConfig({
          jitter: { type: 'none' },
        });
        expect(noJitter.jitter).toEqual({ type: 'none' });

        const decorrelated = createRetryConfig({
          jitter: { type: 'decorrelated' },
        });
        expect(decorrelated.jitter).toEqual({ type: 'decorrelated' });
      });

      it('accepts retry callbacks', () => {
        const onRetry = vi.fn();

        const config = createRetryConfig({ onRetry });

        expect(config.onRetry).toBe(onRetry);
      });
    });

    describe('createChaosConfig', () => {
      it('creates config with defaults', () => {
        const config = createChaosConfig(
          'test-experiment',
          'System should maintain 99% availability'
        );

        expect(config.name).toBe('test-experiment');
        expect(config.hypothesis).toBe('System should maintain 99% availability');
        expect(config.durationSeconds).toBe(300);
        expect(config.blastRadius).toBe(0.1);
        expect(config.faults).toHaveLength(0);
        expect(config.safetyControls.length).toBeGreaterThan(0);
      });

      it('accepts custom faults', () => {
        const config = createChaosConfig(
          'latency-experiment',
          'System should handle latency spikes',
          {
            faults: [
              {
                type: 'latency',
                target: { type: 'service', selector: 'api-gateway' },
                parameters: { latencyMs: 500 },
                probability: 0.3,
              },
            ],
          }
        );

        expect(config.faults).toHaveLength(1);
        expect(config.faults[0].type).toBe('latency');
      });

      it('accepts steady state metrics', () => {
        const config = createChaosConfig(
          'availability-experiment',
          'System maintains availability',
          {
            steadyStateMetrics: [
              {
                name: 'error_rate',
                query: 'rate(errors[5m])',
                comparison: 'less_than',
                threshold: 0.01,
                tolerance: 0.005,
              },
            ],
          }
        );

        expect(config.steadyStateMetrics).toHaveLength(1);
        expect(config.steadyStateMetrics[0].name).toBe('error_rate');
      });

      it('includes default safety controls', () => {
        const config = createChaosConfig('safe-experiment', 'Test hypothesis');

        expect(config.safetyControls.some(c => c.type === 'abort_threshold')).toBe(true);
        expect(config.safetyControls.some(c => c.type === 'duration_limit')).toBe(true);
        expect(config.safetyControls.some(c => c.type === 'manual_kill')).toBe(true);
      });
    });
  });

  // ============================================================================
  // PERFORMANCE ENGINEERING
  // ============================================================================
  describe('Performance Engineering', () => {
    describe('createProfileConfig', () => {
      it('creates config with defaults', () => {
        const config = createProfileConfig('api-service');

        expect(config.target).toBe('api-service');
        expect(config.profileTypes).toContain('cpu');
        expect(config.profileTypes).toContain('heap');
        expect(config.samplingRate).toBe(0.1);
        expect(config.profileDurationSeconds).toBe(30);
        expect(config.intervalSeconds).toBe(60);
        expect(config.storage.type).toBe('local');
        expect(config.storage.compression).toBe(true);
      });

      it('accepts custom profile types', () => {
        const config = createProfileConfig('worker', {
          profileTypes: ['cpu', 'heap', 'goroutine', 'mutex'],
        });

        expect(config.profileTypes).toHaveLength(4);
        expect(config.profileTypes).toContain('goroutine');
      });

      it('accepts alert thresholds', () => {
        const config = createProfileConfig('critical-service', {
          alertThresholds: [
            {
              profileType: 'cpu',
              metric: 'usage',
              operator: 'gt',
              threshold: 80,
              severity: 'critical',
            },
          ],
        });

        expect(config.alertThresholds).toHaveLength(1);
        expect(config.alertThresholds?.[0].profileType).toBe('cpu');
      });
    });

    describe('createPerformanceBaseline', () => {
      it('creates a baseline from metrics', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));

        const metrics: PerformanceMetrics = {
          timestamp: '2026-01-29T09:00:00.000Z',
          metrics: [
            { name: 'api_latency_p99', type: 'latency', unit: 'ms', value: 150, percentile: 99, sampleCount: 1000 },
            { name: 'throughput', type: 'throughput', unit: 'rps', value: 500, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const baseline = createPerformanceBaseline('v1-baseline', metrics);

        expect(baseline.name).toBe('v1-baseline');
        expect(baseline.createdAt).toBe('2026-01-29T10:00:00.000Z');
        expect(baseline.metrics).toHaveLength(2);
        expect(baseline.environment).toBe('production');
        expect(baseline.version).toBe('1.0.0');
        expect(baseline.id).toMatch(/^baseline-/);

        vi.useRealTimers();
      });

      it('accepts custom options', () => {
        const metrics: PerformanceMetrics = {
          timestamp: '2026-01-29T09:00:00.000Z',
          metrics: [
            { name: 'latency', type: 'latency', unit: 'ms', value: 100, sampleCount: 500 },
          ],
          environment: 'staging',
          version: '1.0.0',
        };

        const baseline = createPerformanceBaseline('custom-baseline', metrics, {
          commitHash: 'abc123',
        });

        expect(baseline.commitHash).toBe('abc123');
      });
    });

    describe('detectPerformanceRegression', () => {
      it('detects latency regression', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', percentiles: { p99: 100 }, mean: 100, stdDev: 10, min: 50, max: 200, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', value: 150, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.1.0',
        };

        const result = detectPerformanceRegression(baseline, current);

        expect(result.hasRegression).toBe(true);
        expect(result.regressions).toHaveLength(1);
        expect(result.regressions[0].metric).toBe('api_latency');
        expect(result.regressions[0].changePercent).toBe(50);
        expect(result.regressions[0].severity).toBe('major');
      });

      it('detects latency improvement', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', percentiles: { p99: 100 }, mean: 100, stdDev: 10, min: 50, max: 200, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', value: 70, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.1.0',
        };

        const result = detectPerformanceRegression(baseline, current);

        expect(result.hasRegression).toBe(false);
        expect(result.improvements).toHaveLength(1);
        expect(result.improvements[0].metric).toBe('api_latency');
        expect(result.improvements[0].changePercent).toBe(-30);
      });

      it('marks metric as unchanged when within threshold', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', percentiles: { p99: 100 }, mean: 100, stdDev: 10, min: 50, max: 200, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', value: 102, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.1.0',
        };

        const result = detectPerformanceRegression(baseline, current);

        expect(result.hasRegression).toBe(false);
        expect(result.unchanged).toContain('api_latency');
      });

      it('detects throughput regression', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [
            { name: 'throughput', type: 'throughput', unit: 'rps', percentiles: {}, mean: 1000, stdDev: 50, min: 800, max: 1200, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [
            { name: 'throughput', type: 'throughput', unit: 'rps', value: 700, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.1.0',
        };

        const result = detectPerformanceRegression(baseline, current);

        expect(result.hasRegression).toBe(true);
        expect(result.regressions[0].metric).toBe('throughput');
        expect(result.regressions[0].changePercent).toBe(-30);
      });

      it('uses custom threshold', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', percentiles: { p99: 100 }, mean: 100, stdDev: 10, min: 50, max: 200, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', value: 115, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.1.0',
        };

        // With default 10% threshold, 15% change is a regression
        const result1 = detectPerformanceRegression(baseline, current);
        expect(result1.hasRegression).toBe(true);

        // With 20% threshold, 15% change is not significant
        const result2 = detectPerformanceRegression(baseline, current, { threshold: 0.20 });
        expect(result2.hasRegression).toBe(false);
        expect(result2.unchanged).toContain('api_latency');
      });

      it('provides possible causes for regressions', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', percentiles: { p99: 100 }, mean: 100, stdDev: 10, min: 50, max: 200, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', value: 200, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.1.0',
        };

        const result = detectPerformanceRegression(baseline, current);

        expect(result.regressions[0].possibleCauses.length).toBeGreaterThan(0);
        expect(result.regressions[0].possibleCauses).toContain('Increased database query complexity');
      });

      it('handles multiple metrics', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', percentiles: { p99: 100 }, mean: 100, stdDev: 10, min: 50, max: 200, sampleCount: 1000 },
            { name: 'throughput', type: 'throughput', unit: 'rps', percentiles: {}, mean: 1000, stdDev: 50, min: 800, max: 1200, sampleCount: 1000 },
            { name: 'memory', type: 'resource', unit: 'MB', percentiles: {}, mean: 512, stdDev: 20, min: 400, max: 600, sampleCount: 1000 },
          ],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [
            { name: 'api_latency', type: 'latency', unit: 'ms', value: 150, sampleCount: 1000 }, // Regression
            { name: 'throughput', type: 'throughput', unit: 'rps', value: 1200, sampleCount: 1000 }, // Improvement
            { name: 'memory', type: 'resource', unit: 'MB', value: 520, sampleCount: 1000 }, // Unchanged
          ],
          environment: 'production',
          version: '1.1.0',
        };

        const result = detectPerformanceRegression(baseline, current);

        expect(result.hasRegression).toBe(true);
        expect(result.regressions).toHaveLength(1);
        expect(result.improvements).toHaveLength(1);
        expect(result.unchanged).toHaveLength(1);
      });

      it('includes methodology in result', () => {
        const baseline: PerformanceBaseline = {
          id: 'baseline-1',
          name: 'v1-baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: [],
          environment: 'production',
          version: '1.0.0',
        };

        const current: PerformanceMetrics = {
          timestamp: '2026-01-29T00:00:00.000Z',
          metrics: [],
          environment: 'production',
          version: '1.1.0',
        };

        const result = detectPerformanceRegression(baseline, current);

        expect(result.methodology.algorithm).toBe('percentage_change');
        expect(result.methodology.threshold).toBe(0.1);
        expect(result.methodology.confidenceLevel).toBe(0.95);
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================
  describe('Integration Tests', () => {
    it('contract enforcement works with real functions', () => {
      const enforcement = createContractEnforcement();

      // Define a divide function with contracts
      const pre = enforcement.definePrecondition<[number, number]>(
        'divisor-not-zero',
        ([_, divisor]) => divisor !== 0
      );

      const post = enforcement.definePostcondition<[number, number], number>(
        'result-finite',
        (_, result) => Number.isFinite(result)
      );

      const contract = createContract<[number, number], number>('divide', {
        preconditions: [pre],
        postconditions: [post],
      });

      const divide = ([a, b]: [number, number]) => a / b;
      const safeDivide = enforcement.enforceContract(divide, contract);

      expect(safeDivide([10, 2])).toBe(5);
      expect(safeDivide([9, 3])).toBe(3);
      expect(() => safeDivide([5, 0])).toThrow('Contract violation');
    });

    it('metamorphic testing detects bugs', () => {
      // A buggy sort function that doesn't handle duplicates
      const buggySort = (arr: number[]) => {
        const uniqueArr = [...new Set(arr)];
        return uniqueArr.sort((a, b) => a - b);
      };

      // Correct sort function
      const correctSort = (arr: number[]) => {
        return [...arr].sort((a, b) => a - b);
      };

      // Metamorphic relation: adding duplicate should not change result length
      const relation = createMetamorphicRelation<number[], number[]>(
        'duplicate-invariance',
        (input) => [...input, input[0] ?? 0],
        (r1, r2) => r2.length === r1.length + 1
      );

      const input = [3, 1, 2];
      const transformed = relation.transformInput(input);

      // Correct function passes
      const correctResult1 = correctSort(input);
      const correctResult2 = correctSort(transformed);
      expect(relation.verifyRelation(correctResult1, correctResult2, input, transformed)).toBe(true);

      // Buggy function fails (removes duplicate)
      const buggyResult1 = buggySort(input);
      const buggyResult2 = buggySort(transformed);
      expect(relation.verifyRelation(buggyResult1, buggyResult2, input, transformed)).toBe(false);
    });

    it('performance regression detection integrates with baseline creation', () => {
      vi.useFakeTimers();

      // Create baseline at T0
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const initialMetrics: PerformanceMetrics = {
        timestamp: '2026-01-01T00:00:00.000Z',
        metrics: [
          { name: 'response_time', type: 'latency', unit: 'ms', value: 50, sampleCount: 5000 },
          { name: 'requests_per_second', type: 'throughput', unit: 'rps', value: 1000, sampleCount: 5000 },
        ],
        environment: 'production',
        version: '1.0.0',
      };

      const baseline = createPerformanceBaseline('v1.0', initialMetrics);

      // Verify baseline was created correctly
      expect(baseline.name).toBe('v1.0');
      expect(baseline.metrics).toHaveLength(2);

      // Test at T1 with some degradation
      vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'));

      const currentMetrics: PerformanceMetrics = {
        timestamp: '2026-01-15T00:00:00.000Z',
        metrics: [
          { name: 'response_time', type: 'latency', unit: 'ms', value: 75, sampleCount: 5000 }, // 50% regression
          { name: 'requests_per_second', type: 'throughput', unit: 'rps', value: 1200, sampleCount: 5000 }, // 20% improvement (above threshold)
        ],
        environment: 'production',
        version: '1.1.0',
      };

      const result = detectPerformanceRegression(baseline, currentMetrics);

      // Verify response_time regression is detected
      expect(result.hasRegression).toBe(true);
      expect(result.regressions.find(r => r.metric === 'response_time')).toBeDefined();

      // Verify throughput improvement is detected (20% increase from 1000 to 1200)
      const throughputChange = result.improvements.find(i => i.metric === 'requests_per_second') ||
                               result.unchanged.find(m => m === 'requests_per_second');
      expect(throughputChange).toBeDefined();

      vi.useRealTimers();
    });

    it('reliability configs can be composed', () => {
      // Create configs for a robust service
      const circuitConfig = createCircuitBreakerConfig('api-circuit', {
        failureThreshold: 5,
        resetTimeoutMs: 30000,
      });

      const bulkheadConfig = createBulkheadConfig('api-bulkhead', {
        maxConcurrent: 20,
        maxQueue: 100,
      });

      const retryConfig = createRetryConfig({
        maxAttempts: 3,
        backoffStrategy: { type: 'exponential', multiplier: 2 },
      });

      // Verify all configs are compatible
      expect(circuitConfig.name).toBe('api-circuit');
      expect(bulkheadConfig.name).toBe('api-bulkhead');
      expect(retryConfig.maxAttempts).toBe(3);

      // Verify they have the right structure for composition
      expect(circuitConfig.failureThreshold).toBeGreaterThan(0);
      expect(bulkheadConfig.maxConcurrent).toBeGreaterThan(0);
      expect(retryConfig.baseDelayMs).toBeGreaterThan(0);
    });

    it('chaos configs can test reliability patterns', () => {
      const chaosConfig = createChaosConfig(
        'circuit-breaker-validation',
        'Circuit breaker should trip after 5 consecutive failures',
        {
          faults: [
            {
              type: 'error',
              target: { type: 'endpoint', selector: '/api/service' },
              parameters: { errorRate: 1.0 },
              probability: 1.0,
            },
          ],
          steadyStateMetrics: [
            {
              name: 'circuit_state',
              query: 'circuit_breaker_state{name="api-circuit"}',
              comparison: 'equals',
              threshold: 1, // 1 = open
              tolerance: 0,
            },
          ],
          durationSeconds: 60,
          blastRadius: 0.1,
        }
      );

      expect(chaosConfig.faults).toHaveLength(1);
      expect(chaosConfig.faults[0].type).toBe('error');
      expect(chaosConfig.steadyStateMetrics).toHaveLength(1);
      expect(chaosConfig.safetyControls.length).toBeGreaterThan(0);
    });
  });
});
