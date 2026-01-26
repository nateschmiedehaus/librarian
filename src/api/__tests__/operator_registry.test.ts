import { describe, it, expect } from 'vitest';
import { createDefaultOperatorRegistry } from '../operator_registry.js';
import type { TechniqueComposition, TechniqueOperator } from '../../strategic/techniques.js';

const now = new Date('2026-01-21T00:00:00.000Z').toISOString();

function buildComposition(operators: TechniqueOperator[]): TechniqueComposition {
  return {
    id: 'tc_registry',
    name: 'Registry Plan',
    description: 'Operator registry planning',
    primitiveIds: ['tp_a', 'tp_b', 'tp_c'],
    operators,
    createdAt: now,
    updatedAt: now,
  };
}

describe('operator registry', () => {
  it('builds execution plans with operator metadata', () => {
    const registry = createDefaultOperatorRegistry();
    const composition = buildComposition([
      { id: 'op_parallel', type: 'parallel', inputs: ['tp_a', 'tp_b'] },
      { id: 'op_cond', type: 'conditional', outputs: ['tp_c'] },
      { id: 'op_loop', type: 'loop', inputs: ['tp_a'] },
    ]);

    const plan = registry.buildExecutionPlan(composition);
    expect(plan.steps).toEqual(['tp_a', 'tp_b', 'tp_c']);
    expect(plan.parallelGroups).toEqual([['tp_a', 'tp_b']]);
    expect(plan.conditionalBranches).toEqual([{ operatorId: 'op_cond', outputs: ['tp_c'] }]);
    expect(plan.loopBoundaries).toEqual([{ operatorId: 'op_loop', inputs: ['tp_a'] }]);
    expect(plan.operators.map((entry) => entry.id)).toEqual(['op_parallel', 'op_cond', 'op_loop']);
  });

  it('throws when operators reference missing primitives', () => {
    const registry = createDefaultOperatorRegistry();
    const composition = buildComposition([
      { id: 'op_parallel', type: 'parallel', inputs: ['tp_missing', 'tp_b'] },
    ]);
    expect(() => registry.buildExecutionPlan(composition)).toThrow(/operator_input_missing/);
  });

  it('throws on duplicate operator ids', () => {
    const registry = createDefaultOperatorRegistry();
    const composition = buildComposition([
      { id: 'op_dup', type: 'parallel', inputs: ['tp_a', 'tp_b'] },
      { id: 'op_dup', type: 'loop', inputs: ['tp_a'] },
    ]);
    expect(() => registry.buildExecutionPlan(composition)).toThrow(/operator_duplicate_id/);
  });
});
