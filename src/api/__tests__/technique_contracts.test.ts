import { describe, it, expect } from 'vitest';
import { createTechniquePrimitive, type JsonSchemaObject } from '../../strategic/techniques.js';
import {
  validateTechniquePrimitiveExecution,
  validateTechniquePrimitiveExamples,
} from '../technique_contracts.js';

describe('technique contract execution', () => {
  it('flags missing required inputs', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_missing_input',
      name: 'Missing input',
      intent: 'Missing input',
      inputsRequired: ['request'],
      outputs: ['result'],
    });
    expect(primitive.contract?.preconditions).toContain('exists(input["request"])');
    const result = validateTechniquePrimitiveExecution(primitive, {}, { result: 'ok' });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'contract_input_missing_required')).toBe(true);
  });

  it('flags type mismatches in outputs', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_type_output',
      name: 'Type output',
      intent: 'Type output',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'count', required: true, type: 'number' }],
      },
    });
    const result = validateTechniquePrimitiveExecution(primitive, { request: 'ok' }, { count: 'bad' });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'contract_output_type_invalid')).toBe(true);
  });

  it('accepts null when schema allows it', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_null_allowed',
      name: 'Null allowed',
      intent: 'Null allowed',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: ['null', 'string'] },
          },
          required: ['result'],
        },
      },
    });
    const result = validateTechniquePrimitiveExecution(primitive, { request: 'ok' }, { result: null });
    expect(result.ok).toBe(true);
  });

  it('reports failed preconditions', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_precondition',
      name: 'Precondition',
      intent: 'Precondition',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        preconditions: ['exists(input["token"])'],
      },
    });
    const result = validateTechniquePrimitiveExecution(primitive, { request: 'ok' }, { result: 'done' });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'contract_precondition_failed')).toBe(true);
  });

  it('skips condition checks when schema validation fails', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_skip_conditions',
      name: 'Skip conditions',
      intent: 'Skip conditions',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        preconditions: ['exists(input["token"])'],
        postconditions: ['exists(output["proof"])'],
      },
    });
    const result = validateTechniquePrimitiveExecution(primitive, {}, {});
    expect(result.issues.some((issue) => issue.code === 'contract_input_missing_required')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'contract_output_missing_required')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'contract_precondition_failed')).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'contract_postcondition_failed')).toBe(false);
  });

  it('validates examples against contract schema', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_examples',
      name: 'Examples',
      intent: 'Examples',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        examples: [
          { input: { request: 'ok' }, output: { result: 'done' } },
          { input: { request: 'ok' }, output: { result: 42 } },
        ],
      },
    });
    const issues = validateTechniquePrimitiveExamples(primitive);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.code === 'contract_output_type_invalid')).toBe(true);
  });

  it('flags null and undefined required values', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_nulls',
      name: 'Nulls',
      intent: 'Nulls',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
      },
    });
    const nullResult = validateTechniquePrimitiveExecution(
      primitive,
      { request: null },
      { result: 'ok' }
    );
    expect(nullResult.issues.some((issue) => issue.code === 'contract_input_type_invalid')).toBe(true);
    const undefinedResult = validateTechniquePrimitiveExecution(
      primitive,
      { request: undefined },
      { result: 'ok' }
    );
    expect(undefinedResult.issues.some((issue) => issue.code === 'contract_input_type_invalid')).toBe(true);
  });

  it('handles deep schemas and schema budgets', () => {
    const deepSchema: JsonSchemaObject = {
      type: 'object',
      properties: {
        level0: {
          type: 'object',
          properties: {
            level1: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: {
                      type: 'object',
                      properties: {
                        level4: {
                          type: 'object',
                          properties: {
                            level5: {
                              type: 'object',
                              properties: {
                                level6: {
                                  type: 'object',
                                  properties: {
                                    value: { type: 'string' },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      required: ['level0'],
    };
    const primitive = createTechniquePrimitive({
      id: 'tp_depth',
      name: 'Depth',
      intent: 'Depth',
      contract: {
        inputs: [{ name: 'level0', required: true, type: 'object' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        inputSchema: deepSchema,
      },
    });
    const deepInput = { level0: { level1: { level2: { level3: { level4: { level5: { level6: { value: 'ok' } } } } } } } };
    const depthResult = validateTechniquePrimitiveExecution(primitive, deepInput, { result: 'ok' });
    expect(depthResult.issues.some((issue) => issue.code === 'contract_schema_depth_exceeded')).toBe(true);

    const shallowSchema: JsonSchemaObject = {
      type: 'object',
      properties: {
        level0: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      },
      required: ['level0'],
    };
    const shallowPrimitive = createTechniquePrimitive({
      id: 'tp_depth_ok',
      name: 'Depth ok',
      intent: 'Depth ok',
      contract: {
        inputs: [{ name: 'level0', required: true, type: 'object' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        inputSchema: shallowSchema,
      },
    });
    const shallowResult = validateTechniquePrimitiveExecution(
      shallowPrimitive,
      { level0: { value: 'ok' } },
      { result: 'ok' }
    );
    expect(shallowResult.issues.some((issue) => issue.code === 'contract_schema_depth_exceeded')).toBe(false);

    const wideSchema: JsonSchemaObject = {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' } },
      },
      required: ['items'],
    };
    const widePrimitive = createTechniquePrimitive({
      id: 'tp_budget',
      name: 'Budget',
      intent: 'Budget',
      contract: {
        inputs: [{ name: 'items', required: true, type: 'array' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        inputSchema: wideSchema,
      },
    });
    const items = Array.from({ length: 1100 }, () => 'x');
    const budgetResult = validateTechniquePrimitiveExecution(widePrimitive, { items }, { result: 'ok' });
    expect(budgetResult.issues.some((issue) => issue.code === 'contract_schema_budget_exceeded')).toBe(true);
  });

  it('flags malformed conditions and inconsistent schemas', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_bad_condition',
      name: 'Bad condition',
      intent: 'Bad condition',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        preconditions: ['exists(input["bad\\"])'],
        inputSchema: {
          type: 'object',
          properties: {
            request: { type: 'string' },
          },
          required: ['request'],
        },
      },
    });
    if (primitive.contract) {
      primitive.contract.inputSchema = {
        type: 'object',
        properties: {
          request: { type: 'string' },
        },
        required: ['missing'],
      };
    }
    const result = validateTechniquePrimitiveExecution(
      primitive,
      { request: 'ok' },
      { result: 'ok' }
    );
    expect(result.issues.some((issue) => issue.code === 'contract_condition_malformed')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'contract_schema_inconsistent')).toBe(true);
  });

  it('rejects empty condition keys', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_empty_condition',
      name: 'Empty condition',
      intent: 'Empty condition',
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        preconditions: ['exists(input[""])', 'exists(input["  "])'],
      },
    });
    const result = validateTechniquePrimitiveExecution(
      primitive,
      { request: 'ok' },
      { result: 'ok' }
    );
    expect(result.issues.some((issue) => issue.code === 'contract_condition_malformed')).toBe(true);
  });

  it('guards against condition and example overload', () => {
    const tooManyConditions = Array.from({ length: 201 }, (_value, index) => `exists(input["field_${index}"])`);
    const primitive = createTechniquePrimitive({
      id: 'tp_conditions',
      name: 'Conditions',
      intent: 'Conditions',
      contract: {
        inputs: [{ name: 'field_0', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        preconditions: tooManyConditions,
      },
    });
    const conditionResult = validateTechniquePrimitiveExecution(
      primitive,
      { field_0: 'ok' },
      { result: 'ok' }
    );
    expect(conditionResult.issues.some((issue) => issue.code === 'contract_condition_limit_exceeded')).toBe(true);

    const tooManyExamples = Array.from({ length: 101 }, () => ({
      input: { field_0: 'ok' },
      output: { result: 'ok' },
    }));
    const examplePrimitive = createTechniquePrimitive({
      id: 'tp_example_limit',
      name: 'Example limit',
      intent: 'Example limit',
      contract: {
        inputs: [{ name: 'field_0', required: true, type: 'string' }],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        examples: tooManyExamples,
      },
    });
    const exampleIssues = validateTechniquePrimitiveExamples(examplePrimitive);
    expect(exampleIssues.some((issue) => issue.code === 'contract_examples_exceed_limit')).toBe(true);
  });

  it('handles circular references and prototype pollution attempts', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp_cycle',
      name: 'Cycle',
      intent: 'Cycle',
      contract: {
        inputs: [
          { name: 'request', required: true, type: 'string' },
          { name: 'self', required: false, type: 'object' },
        ],
        outputs: [{ name: 'result', required: true, type: 'string' }],
        inputSchema: {
          type: 'object',
          properties: {
            request: { type: 'string' },
            self: {
              type: 'object',
              properties: {
                request: { type: 'string' },
              },
            },
          },
          required: ['request'],
        },
      },
    });
    const input = { request: 'ok' } as { request: string; self?: unknown };
    input.self = input;
    const result = validateTechniquePrimitiveExecution(primitive, input, { result: 'ok' });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'contract_schema_circular_reference')).toBe(true);

    const polluted = Object.create(null) as Record<string, unknown>;
    polluted.request = 'ok';
    polluted[''] = 'empty';
    const nullKey = `field_${String.fromCharCode(0)}`;
    polluted[nullKey] = 'value';
    polluted['__proto__'] = { polluted: true };
    const pollutedResult = validateTechniquePrimitiveExecution(primitive, polluted, { result: 'ok' });
    expect(pollutedResult.ok).toBe(true);
  });
});
