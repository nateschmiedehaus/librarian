import { describe, it, expect, vi } from 'vitest';
import {
  __testing,
  evaluateOperatorCondition,
  SequenceOperatorInterpreter,
  ParallelOperatorInterpreter,
  MergeOperatorInterpreter,
  FanoutOperatorInterpreter,
  FaninOperatorInterpreter,
  RetryOperatorInterpreter,
  BackoffOperatorInterpreter,
  QuorumOperatorInterpreter,
  FallbackOperatorInterpreter,
  ConsensusOperatorInterpreter,
  TimeboxOperatorInterpreter,
  ConditionalOperatorInterpreter,
  LoopOperatorInterpreter,
  CircuitBreakerOperatorInterpreter,
  ReduceOperatorInterpreter,
  CacheOperatorInterpreter,
  ReplayOperatorInterpreter,
  MonitorOperatorInterpreter,
} from '../operator_interpreters.js';
import type { TechniqueComposition, TechniqueOperator, TechniquePrimitive } from '../../strategic/techniques.js';
import type { OperatorContext } from '../operator_interpreters.js';
import type { PrimitiveExecutionResult } from '../technique_execution.js';

const now = new Date('2026-01-21T00:00:00.000Z');

function buildComposition(): TechniqueComposition {
  return {
    id: 'tc_operator_test',
    name: 'Operator test',
    description: 'Operator interpreter test',
    primitiveIds: ['tp_one'],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function buildOperatorContext(operator: TechniqueOperator): OperatorContext {
  return {
    operator,
    composition: buildComposition(),
    state: Object.create(null),
    executionState: Object.create(null),
    attempt: 0,
    startedAt: now,
  };
}

function buildResult(input: Partial<PrimitiveExecutionResult> = {}): PrimitiveExecutionResult {
  return {
    primitiveId: input.primitiveId ?? 'tp_one',
    status: input.status ?? 'success',
    input: input.input ?? {},
    output: input.output ?? {},
    issues: input.issues ?? [],
    evidence: input.evidence ?? [],
    startedAt: input.startedAt ?? now.toISOString(),
    completedAt: input.completedAt ?? now.toISOString(),
    durationMs: input.durationMs ?? 0,
  };
}

const primitive: TechniquePrimitive = {
  id: 'tp_one',
  name: 'One',
  intent: 'One',
  triggers: [],
  inputsRequired: [],
  actions: [],
  failureModes: [],
  outputs: [],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

describe('operator interpreters', () => {
  it('evaluates numeric conditions with guards', () => {
    const state = Object.create(null) as Record<string, unknown>;
    state.score = 10;
    state.flag = true;
    expect(evaluateOperatorCondition('state.score > 5', state).matched).toBe(true);
    expect(evaluateOperatorCondition('state.score < 5', state).matched).toBe(false);
    const mismatch = evaluateOperatorCondition('state.score > "bad"', state);
    expect(mismatch.matched).toBe(false);
    expect(state.__condition_errors).toEqual(['condition_type_mismatch']);
    expect(evaluateOperatorCondition('state.flag == true', state).matched).toBe(true);
  });

  it('caps condition error accumulation', () => {
    const state = Object.create(null) as Record<string, unknown>;
    state.score = 10;
    const attempts = __testing.MAX_CONDITION_ERRORS + 25;
    for (let i = 0; i < attempts; i += 1) {
      evaluateOperatorCondition('state.score > "bad"', state);
    }
    const errors = Array.isArray(state.__condition_errors) ? state.__condition_errors : [];
    expect(errors.length).toBeLessThanOrEqual(__testing.MAX_CONDITION_ERRORS);
  });

  it('evaluates conditions on plain object state', () => {
    const state = { score: 3, name: 'alpha' } as Record<string, unknown>;
    expect(evaluateOperatorCondition('state.score == 3', state).matched).toBe(true);
    expect(evaluateOperatorCondition('state.name == "alpha"', state).matched).toBe(true);
  });

  it('supports boolean logic and grouping', () => {
    const state = Object.create(null) as Record<string, unknown>;
    state.score = 10;
    state.flag = false;
    expect(evaluateOperatorCondition('state.score > 5 AND NOT state.flag', state).matched).toBe(true);
    expect(evaluateOperatorCondition('state.score > 5 AND state.flag', state).matched).toBe(false);
    expect(evaluateOperatorCondition('(state.score < 5 OR state.score >= 10)', state).matched).toBe(true);
  });

  it('evaluates exists checks', () => {
    const state = Object.create(null) as Record<string, unknown>;
    state.value = 1;
    expect(evaluateOperatorCondition('state.value.exists', state).matched).toBe(true);
    expect(evaluateOperatorCondition('state.missing.exists', state).matched).toBe(false);
  });

  it('blocks prototype traversal in conditions', () => {
    const state = Object.create(null) as Record<string, unknown>;
    state.safe = true;
    expect(evaluateOperatorCondition('state.__proto__.polluted.exists', state).matched).toBe(false);
  });

  it('rejects invalid escape sequences in conditions', () => {
    const tokenized = __testing.tokenizeCondition('state.name == \"\\u202E\"');
    expect(tokenized.ok).toBe(false);
  });

  it('rejects control characters in condition literals', () => {
    const tokenized = __testing.tokenizeCondition('state.name == \"\u0001\"');
    expect(tokenized.ok).toBe(false);
  });

  it('aggregates parallel output collisions by default', async () => {
    const interpreter = new ParallelOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_parallel', type: 'parallel' };
    const context = buildOperatorContext(operator);
    const results = [
      buildResult({ primitiveId: 'tp_a', output: { value: 1 } }),
      buildResult({ primitiveId: 'tp_b', output: { value: 2 } }),
    ];
    const output = await interpreter.afterExecute(results, context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs.value).toEqual([1, 2]);
    }
  });

  it('flattens repeated parallel collisions into arrays', async () => {
    const interpreter = new ParallelOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_parallel', type: 'parallel' };
    const context = buildOperatorContext(operator);
    const results = [
      buildResult({ primitiveId: 'tp_a', output: { value: 1 } }),
      buildResult({ primitiveId: 'tp_b', output: { value: 2 } }),
      buildResult({ primitiveId: 'tp_c', output: { value: 3 } }),
    ];
    const output = await interpreter.afterExecute(results, context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs.value).toEqual([1, 2, 3]);
    }
  });

  it('tracks skipped parallel output keys', async () => {
    const interpreter = new ParallelOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_parallel', type: 'parallel' };
    const context = buildOperatorContext(operator);
    const unsafeOutput = Object.create(null) as Record<string, unknown>;
    unsafeOutput['__proto__'] = 'bad';
    unsafeOutput['___proto__'] = 'worse';
    unsafeOutput.ok = 1;
    const results = [
      buildResult({ primitiveId: 'tp_a', output: unsafeOutput }),
    ];
    const output = await interpreter.afterExecute(results, context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs.ok).toBe(1);
      expect(output.outputs.__parallel_skipped_keys).toEqual([
        { key: '__proto__', primitiveId: 'tp_a', reason: 'invalid_key' },
        { key: '___proto__', primitiveId: 'tp_a', reason: 'invalid_key' },
      ]);
    }
  });

  it('rejects non-ascii output keys', async () => {
    const interpreter = new ParallelOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_parallel', type: 'parallel' };
    const context = buildOperatorContext(operator);
    const homoglyph = 'va\u043blue';
    const results = [
      buildResult({ primitiveId: 'tp_a', output: { [homoglyph]: 1, ok: 2 } }),
    ];
    const output = await interpreter.afterExecute(results, context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs.ok).toBe(2);
      expect(output.outputs.__parallel_skipped_keys).toEqual([
        { key: homoglyph, primitiveId: 'tp_a', reason: 'invalid_key' },
      ]);
    }
  });

  it('records unprocessed outputs when collisions overflow', async () => {
    const interpreter = new ParallelOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_parallel', type: 'parallel' };
    const context = buildOperatorContext(operator);
    const results = Array.from({ length: 1050 }, (_, index) =>
      buildResult({ primitiveId: `tp_${index}`, output: { value: index } })
    );
    const output = await interpreter.afterExecute(results, context);
    expect(output.type).toBe('checkpoint');
    if (output.type === 'checkpoint') {
      expect(output.terminate).toBe(true);
      const state = output.state as Record<string, unknown>;
      const rawOutputs = state.__parallel_raw_outputs as unknown[] | undefined;
      const unprocessed = state.__parallel_unprocessed_outputs as unknown[] | undefined;
      expect(rawOutputs?.length).toBe(results.length);
      expect((unprocessed ?? []).length).toBeGreaterThan(0);
      if (Array.isArray(state.value)) {
        expect(state.value[0]).toBe(0);
      } else {
        expect(state.value).toBe(0);
      }
    }
  });

  it('namespaces parallel output collisions when configured', async () => {
    const interpreter = new ParallelOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_parallel',
      type: 'parallel',
      parameters: { collisionStrategy: 'namespace' },
    };
    const context = buildOperatorContext(operator);
    const results = [
      buildResult({ primitiveId: 'tp_a', output: { value: 1 } }),
      buildResult({ primitiveId: 'tp_b', output: { value: 2 } }),
    ];
    const output = await interpreter.afterExecute(results, context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs['tp_a.value']).toBe(1);
      expect(output.outputs['tp_b.value']).toBe(2);
      expect(output.outputs.value).toBeUndefined();
    }
  });

  it('terminates on parallel output collisions when configured', async () => {
    const interpreter = new ParallelOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_parallel',
      type: 'parallel',
      parameters: { collisionStrategy: 'terminate' },
    };
    const context = buildOperatorContext(operator);
    const results = [
      buildResult({ primitiveId: 'tp_a', output: { value: 1 } }),
      buildResult({ primitiveId: 'tp_b', output: { value: 2 } }),
    ];
    const output = await interpreter.afterExecute(results, context);
    expect(output.type).toBe('checkpoint');
    if (output.type === 'checkpoint') {
      expect(output.terminate).toBe(true);
      const state = output.state as Record<string, unknown>;
      const detail = state.__parallel_collision_detail as { reason?: string } | undefined;
      expect(detail?.reason).toBe('collision_terminate');
    }
  });

  it('caps retry backoff delays', async () => {
    const interpreter = new RetryOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_retry',
      type: 'retry',
      parameters: { baseDelayMs: 1000, maxRetries: 100, backoff: 'exponential' },
    };
    const context = buildOperatorContext(operator);
    context.state.retry_tp_one = 49;
    const result = await interpreter.afterPrimitiveExecute(primitive, buildResult({ status: 'failed' }), context);
    expect(result.type).toBe('retry');
    if (result.type === 'retry') {
      expect(result.delay).toBeLessThanOrEqual(60000);
    }
  });

  it('guards backoff calculations for invalid inputs', () => {
    const delay = __testing.calculateBackoffDelay('exponential_jitter', Number.NaN, -5, Number.NaN);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(60000);

    const huge = __testing.calculateBackoffDelay('exponential', 1e9, 50, 0);
    expect(huge).toBeGreaterThanOrEqual(0);
    expect(huge).toBeLessThanOrEqual(60000);
  });

  it('handles unserializable quorum outputs without throwing', async () => {
    const interpreter = new QuorumOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_quorum', type: 'quorum' };
    const context = buildOperatorContext(operator);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const output = await interpreter.afterExecute([
      buildResult({ output: circular }),
    ], context);
    expect(output.type).toBe('escalate');
  });

  it('reaches quorum based on successful results', async () => {
    const interpreter = new QuorumOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_quorum', type: 'quorum' };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_a', output: { conclusion: 'yes' } }),
      buildResult({ primitiveId: 'tp_b', output: { conclusion: 'yes' } }),
      buildResult({ primitiveId: 'tp_c', status: 'failed', output: { conclusion: 'no' } }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs.quorumReached).toBe(true);
      expect(output.outputs.votes).toBe(2);
      expect(output.outputs.required).toBe(2);
    }
  });

  it('terminates on invalid timebox deadline', async () => {
    const interpreter = new TimeboxOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_timebox',
      type: 'timebox',
      parameters: { deadlineIso: 'not-a-date' },
    };
    const context = buildOperatorContext(operator);
    const output = await interpreter.beforeExecute(context);
    expect(output.type).toBe('terminate');
  });

  it('checkpoints when timebox exceeds deadline', async () => {
    const interpreter = new TimeboxOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_timebox',
      type: 'timebox',
      parameters: { timeoutMs: 10 },
    };
    const context = buildOperatorContext(operator);
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    await interpreter.beforeExecute(context);
    nowSpy.mockReturnValue(2000);
    const output = await interpreter.afterPrimitiveExecute(primitive, buildResult(), context);
    expect(output.type).toBe('checkpoint');
    nowSpy.mockRestore();
  });

  it('terminates when timebox is configured to terminate', async () => {
    const interpreter = new TimeboxOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_timebox',
      type: 'timebox',
      parameters: { timeoutMs: 10, onTimeout: 'terminate' },
    };
    const context = buildOperatorContext(operator);
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    await interpreter.beforeExecute(context);
    nowSpy.mockReturnValue(2000);
    const output = await interpreter.afterPrimitiveExecute(primitive, buildResult(), context);
    expect(output.type).toBe('terminate');
    nowSpy.mockRestore();
  });

  it('branches to first matching conditional target', async () => {
    const interpreter = new ConditionalOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_conditional',
      type: 'conditional',
      conditions: ['state.score > 5 => tp_fast', 'state.score > 1 => tp_slow'],
    };
    const context = buildOperatorContext(operator);
    context.executionState.score = 10;
    const output = await interpreter.beforeExecute(context);
    expect(output.type).toBe('branch');
    if (output.type === 'branch') {
      expect(output.target).toBe('tp_fast');
    }
  });

  it('falls back to default conditional target', async () => {
    const interpreter = new ConditionalOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_conditional',
      type: 'conditional',
      conditions: ['state.score > 5'],
      parameters: { default: 'tp_default' },
    };
    const context = buildOperatorContext(operator);
    context.executionState.score = 1;
    const output = await interpreter.beforeExecute(context);
    expect(output.type).toBe('branch');
    if (output.type === 'branch') {
      expect(output.target).toBe('tp_default');
    }
  });

  it('skips when no conditional branch matches', async () => {
    const interpreter = new ConditionalOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_conditional',
      type: 'conditional',
      conditions: ['state.score > 5'],
    };
    const context = buildOperatorContext(operator);
    context.executionState.score = 1;
    const output = await interpreter.beforeExecute(context);
    expect(output.type).toBe('skip');
  });

  it('loops until condition met', async () => {
    const interpreter = new LoopOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_loop',
      type: 'loop',
      inputs: ['tp_one'],
      conditions: ['state.done == true'],
      parameters: { maxIterations: 3 },
    };
    const context = buildOperatorContext(operator);
    await interpreter.beforeExecute(context);
    context.executionState.done = false;
    const output = await interpreter.afterExecute([buildResult()], context);
    expect(output.type).toBe('branch');
    if (output.type === 'branch') {
      expect(output.target).toBe('tp_one');
    }
  });

  it('migrates legacy operator state when container is replaced', async () => {
    const interpreter = new LoopOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_loop',
      type: 'loop',
      inputs: ['tp_one'],
      parameters: { maxIterations: 2 },
    };
    const context = buildOperatorContext(operator);
    const legacy = { iteration: 1 } as Record<string, unknown>;
    context.state = legacy;
    const output = await interpreter.beforeExecute(context);
    expect(output.type).toBe('continue');
    const operatorState = (context.state as Record<string, unknown>).__operator_state as Record<string, unknown> | undefined;
    expect(operatorState?.iteration).toBe(2);
    expect(operatorState?.__operator_state_migrated).toBe('state_replaced');
  });

  it('branches to fallback targets after failures', async () => {
    const interpreter = new FallbackOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_fallback',
      type: 'fallback',
      outputs: ['tp_backup', 'tp_last'],
    };
    const context = buildOperatorContext(operator);
    const first = await interpreter.afterPrimitiveExecute(primitive, buildResult({ status: 'failed' }), context);
    expect(first.type).toBe('branch');
    if (first.type === 'branch') {
      expect(first.target).toBe('tp_backup');
    }
    const second = await interpreter.afterPrimitiveExecute(primitive, buildResult({ status: 'failed' }), context);
    expect(second.type).toBe('branch');
    if (second.type === 'branch') {
      expect(second.target).toBe('tp_last');
    }
    const third = await interpreter.afterPrimitiveExecute(primitive, buildResult({ status: 'failed' }), context);
    expect(third.type).toBe('terminate');
  });

  it('reaches consensus on unanimous conclusions', async () => {
    const interpreter = new ConsensusOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_consensus', type: 'consensus' };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_a', output: { conclusion: 'yes' } }),
      buildResult({ primitiveId: 'tp_b', output: { conclusion: 'yes' } }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs.consensusReached).toBe(true);
      expect(output.outputs.unanimous).toBe(true);
      expect(output.outputs.conclusion).toBe('yes');
    }
  });

  it('uses majority rule for consensus when configured', async () => {
    const interpreter = new ConsensusOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_consensus',
      type: 'consensus',
      parameters: { resolution: 'majority' },
    };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_a', output: { conclusion: 'yes' } }),
      buildResult({ primitiveId: 'tp_b', output: { conclusion: 'no' } }),
      buildResult({ primitiveId: 'tp_c', output: { conclusion: 'yes' } }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      expect(output.outputs.unanimous).toBe(false);
      expect(output.outputs.method).toBe('majority');
      expect(output.outputs.conclusion).toBe('yes');
    }
  });

  it('terminates when loop exceeds max iterations', async () => {
    const interpreter = new LoopOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_loop',
      type: 'loop',
      inputs: ['tp_one'],
      parameters: { maxIterations: 1 },
    };
    const context = buildOperatorContext(operator);
    await interpreter.beforeExecute(context);
    const output = await interpreter.beforeExecute(context);
    expect(output.type).toBe('terminate');
  });

  it('opens and resets circuit breaker', async () => {
    const interpreter = new CircuitBreakerOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_circuit',
      type: 'circuit_breaker',
      parameters: { failureThreshold: 2, resetTimeoutMs: 1000 },
    };
    const context = buildOperatorContext(operator);
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);
    await interpreter.beforeExecute(context);
    const firstFail = await interpreter.afterPrimitiveExecute(
      primitive,
      buildResult({ status: 'failed' }),
      context
    );
    expect(firstFail.type).toBe('continue');
    const secondFail = await interpreter.afterPrimitiveExecute(
      primitive,
      buildResult({ status: 'failed' }),
      context
    );
    expect(secondFail.type).toBe('terminate');

    nowSpy.mockReturnValue(500);
    const skip = await interpreter.beforeExecute(context);
    expect(skip.type).toBe('skip');

    nowSpy.mockReturnValue(1500);
    const halfOpen = await interpreter.beforeExecute(context);
    expect(halfOpen.type).toBe('continue');
    const success = await interpreter.afterPrimitiveExecute(
      primitive,
      buildResult({ status: 'success' }),
      context
    );
    expect(success.type).toBe('continue');
    nowSpy.mockRestore();
  });

  it('enforces sequence ordering', async () => {
    const interpreter = new SequenceOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_sequence',
      type: 'sequence',
      inputs: ['tp_one', 'tp_two'],
    };
    const context = buildOperatorContext(operator);
    await interpreter.beforeExecute(context);
    const primitiveTwo: TechniquePrimitive = { ...primitive, id: 'tp_two', name: 'Two' };
    const outOfOrder = await interpreter.afterPrimitiveExecute(
      primitiveTwo,
      buildResult({ primitiveId: 'tp_two' }),
      context
    );
    expect(outOfOrder.type).toBe('terminate');

    const orderedContext = buildOperatorContext(operator);
    await interpreter.beforeExecute(orderedContext);
    const first = await interpreter.afterPrimitiveExecute(
      primitive,
      buildResult({ primitiveId: 'tp_one' }),
      orderedContext
    );
    expect(first.type).toBe('continue');
    const second = await interpreter.afterPrimitiveExecute(
      primitiveTwo,
      buildResult({ primitiveId: 'tp_two' }),
      orderedContext
    );
    expect(second.type).toBe('continue');
    if (second.type === 'continue') {
      expect(second.outputs.sequenceCompleted).toBe(true);
    }
  });

  it('merges outputs with merge operator', async () => {
    const interpreter = new MergeOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_merge', type: 'merge' };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_a', output: { value: 1 } }),
      buildResult({ primitiveId: 'tp_b', output: { value: 2 } }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      const merged = output.outputs.merge_op_merge as Record<string, unknown> | undefined;
      expect(merged?.value).toEqual([1, 2]);
    }
  });

  it('rejects merge collisions when configured', async () => {
    const interpreter = new MergeOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_merge_reject',
      type: 'merge',
      parameters: { mergeStrategy: 'reject' },
    };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_a', output: { value: 1 } }),
      buildResult({ primitiveId: 'tp_b', output: { value: 2 } }),
    ], context);
    expect(output.type).toBe('checkpoint');
  });

  it('records fanout payloads', async () => {
    const interpreter = new FanoutOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_fanout',
      type: 'fanout',
      inputs: ['tp_one'],
      outputs: ['tp_two', 'tp_three'],
    };
    const context = buildOperatorContext(operator);
    await interpreter.beforeExecute(context);
    await interpreter.afterPrimitiveExecute(primitive, buildResult({ output: { value: 7 } }), context);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_one', output: { value: 7 } }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      const payload = output.outputs.fanout_op_fanout as { payload?: { value?: number } } | undefined;
      expect(payload?.payload?.value).toBe(7);
    }
  });

  it('collects fanin results', async () => {
    const interpreter = new FaninOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_fanin',
      type: 'fanin',
      inputs: ['tp_one', 'tp_two'],
      outputs: ['tp_three'],
    };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_one', output: { value: 1 } }),
      buildResult({ primitiveId: 'tp_two', output: { value: 2 } }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      const entries = output.outputs.fanin_op_fanin as Array<{ primitiveId: string }> | undefined;
      expect(entries?.length).toBe(2);
    }
  });

  it('reduces numeric outputs', async () => {
    const interpreter = new ReduceOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_reduce',
      type: 'reduce',
      parameters: { reducer: 'sum', field: 'value' },
    };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_a', output: { value: 2 } }),
      buildResult({ primitiveId: 'tp_b', output: { value: 3 } }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      const reduced = output.outputs.reduce_op_reduce as { value?: number } | undefined;
      expect(reduced?.value).toBe(5);
    }
  });

  it('backs off on failures with limits', async () => {
    const interpreter = new BackoffOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_backoff',
      type: 'backoff',
      parameters: { baseDelayMs: 100, multiplier: 2, maxAttempts: 1 },
    };
    const context = buildOperatorContext(operator);
    const first = await interpreter.afterPrimitiveExecute(
      primitive,
      buildResult({ status: 'failed' }),
      context
    );
    expect(first.type).toBe('retry');
    const second = await interpreter.afterPrimitiveExecute(
      primitive,
      buildResult({ status: 'failed' }),
      context
    );
    expect(second.type).toBe('terminate');
  });

  it('serves cached outputs when available', async () => {
    const interpreter = new CacheOperatorInterpreter();
    const operator: TechniqueOperator = { id: 'op_cache', type: 'cache' };
    const context = buildOperatorContext(operator);
    const initial = await interpreter.beforeExecute(context);
    expect(initial.type).toBe('continue');
    if (initial.type === 'continue') {
      expect(initial.outputs.cacheHit).toBe(false);
    }
    await interpreter.afterPrimitiveExecute(
      primitive,
      buildResult({ output: { cached: true } }),
      context
    );
    const second = await interpreter.beforeExecute(context);
    expect(second.type).toBe('continue');
    if (second.type === 'continue') {
      expect(second.outputs.cacheHit).toBe(true);
    }
    expect(context.executionState.cached).toBe(true);
  });

  it('hydrates replay state and reports completion', async () => {
    const interpreter = new ReplayOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_replay',
      type: 'replay',
      parameters: { replayId: 'rp_1', state: { restored: true } },
    };
    const context = buildOperatorContext(operator);
    const before = await interpreter.beforeExecute(context);
    expect(before.type).toBe('continue');
    expect(context.executionState.restored).toBe(true);
    const after = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_one', output: { value: 1 } }),
    ], context);
    expect(after.type).toBe('continue');
    if (after.type === 'continue') {
      expect(after.outputs.replayCompleted).toBe(true);
    }
  });

  it('summarizes monitor results', async () => {
    const interpreter = new MonitorOperatorInterpreter();
    const operator: TechniqueOperator = {
      id: 'op_monitor',
      type: 'monitor',
      parameters: { signals: ['latency', 'error_rate'] },
    };
    const context = buildOperatorContext(operator);
    const output = await interpreter.afterExecute([
      buildResult({ primitiveId: 'tp_a', status: 'success' }),
      buildResult({ primitiveId: 'tp_b', status: 'failed' }),
    ], context);
    expect(output.type).toBe('continue');
    if (output.type === 'continue') {
      const summary = output.outputs.monitorSummary as { failed?: number; total?: number } | undefined;
      expect(summary?.failed).toBe(1);
      expect(summary?.total).toBe(2);
    }
  });
});
