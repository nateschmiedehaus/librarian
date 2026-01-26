import { describe, it, expect } from 'vitest';
import {
  createTechniqueComposition,
  createTechniquePrimitive,
  type TechniquePrimitive,
  type TechniquePrimitiveContract,
} from '../../strategic/techniques.js';
import {
  analyzeTechniqueComposition,
  analyzeTechniquePrimitive,
} from '../technique_validation.js';

describe('technique validation', () => {
  it('flags missing contracts and honors strict mode', () => {
    const base = createTechniquePrimitive({ id: 'tp_base', name: 'Base', intent: 'Base' });
    const primitive = { ...base, contract: undefined };
    const analysis = analyzeTechniquePrimitive(primitive);
    expect(analysis.issues.some((issue) => issue.code === 'primitive_contract_missing')).toBe(true);

    const strict = analyzeTechniquePrimitive(primitive, { strictContracts: true });
    expect(
      strict.issues.some(
        (issue) => issue.code === 'primitive_contract_missing' && issue.severity === 'error'
      )
    ).toBe(true);
  });

  it('validates contract shapes and field names', () => {
    const base = createTechniquePrimitive({ id: 'tp_contract', name: 'Contract', intent: 'Contract' });
    const invalidShape = {
      ...base,
      contract: { inputs: 'bad', outputs: [] } as unknown as TechniquePrimitiveContract,
    };
    const shapeAnalysis = analyzeTechniquePrimitive(invalidShape);
    expect(shapeAnalysis.issues.some((issue) => issue.code === 'primitive_contract_shape_invalid')).toBe(true);

    const invalidNames = {
      ...base,
      contract: {
        inputs: [{ name: '', required: true }],
        outputs: [{ name: 'valid', required: true }],
      },
    };
    const nameAnalysis = analyzeTechniquePrimitive(invalidNames);
    expect(nameAnalysis.issues.some((issue) => issue.code === 'primitive_contract_input_invalid')).toBe(true);
  });

  it('validates semantic field values', () => {
    const base = createTechniquePrimitive({ id: 'tp_semantics', name: 'Semantics', intent: 'Semantics' });
    const invalidSemantics = {
      ...base,
      semantics: {
        preconditions: [],
        postconditions: [],
        termination: 'nope',
        determinism: 'deterministic',
        complexity: 'constant',
      },
    };
    const analysis = analyzeTechniquePrimitive(invalidSemantics as typeof base);
    expect(analysis.issues.some((issue) => issue.code === 'primitive_semantics_termination_invalid')).toBe(true);
  });

  it('normalizes labels and removes duplicates', () => {
    const base = createTechniquePrimitive({ id: 'tp_labels', name: 'Labels', intent: 'Labels' });
    const primitive = {
      ...base,
      contract: {
        inputs: [{ name: ' alpha ', required: true }, { name: 'alpha', required: false }],
        outputs: [{ name: ' beta', required: true }],
      },
    };
    const analysis = analyzeTechniquePrimitive(primitive);
    expect(analysis.signature.inputs).toEqual(['alpha']);
    expect(analysis.signature.outputs).toEqual(['beta']);
  });

  it('flags invalid contract examples', () => {
    const base = createTechniquePrimitive({ id: 'tp_example', name: 'Example', intent: 'Example' });
    const primitive = {
      ...base,
      contract: {
        inputs: [{ name: 'request', required: true, type: 'string' as const }],
        outputs: [{ name: 'result', required: true, type: 'string' as const }],
        examples: [{ input: { request: 'ok' }, output: { result: 123 } }],
      },
    } as TechniquePrimitive;
    const analysis = analyzeTechniquePrimitive(primitive);
    expect(analysis.issues.some((issue) => issue.code === 'primitive_contract_example_invalid')).toBe(true);

    const strict = analyzeTechniquePrimitive(primitive, { strictContracts: true });
    expect(
      strict.issues.some(
        (issue) => issue.code === 'primitive_contract_example_invalid' && issue.severity === 'error'
      )
    ).toBe(true);
  });

  it('reports missing primitives and relationship gaps', () => {
    const missing = createTechniqueComposition({
      id: 'tc_missing',
      name: 'Missing',
      description: 'Missing primitive',
      primitiveIds: ['tp_missing'],
    });
    const missingAnalysis = analyzeTechniqueComposition(missing, []);
    expect(missingAnalysis.missingPrimitiveIds).toEqual(['tp_missing']);
    expect(missingAnalysis.issues.some((issue) => issue.code === 'composition_missing_primitives')).toBe(true);

    const producer = createTechniquePrimitive({
      id: 'tp_out',
      name: 'Out',
      intent: 'Out',
      outputs: ['artifact'],
    });
    const consumer = createTechniquePrimitive({
      id: 'tp_in',
      name: 'In',
      intent: 'In',
      inputsRequired: ['different'],
    });
    const gap = createTechniqueComposition({
      id: 'tc_gap',
      name: 'Gap',
      description: 'Gap',
      primitiveIds: ['tp_out', 'tp_in'],
      relationships: [{ fromId: 'tp_out', toId: 'tp_in', type: 'produces' }],
    });
    const gapAnalysis = analyzeTechniqueComposition(gap, [producer, consumer]);
    expect(gapAnalysis.issues.some((issue) => issue.code === 'composition_data_gap')).toBe(true);
  });

  it('flags invalid relationships and dependency cycles', () => {
    const left = createTechniquePrimitive({ id: 'tp_left', name: 'Left', intent: 'Left', outputs: ['x'] });
    const right = createTechniquePrimitive({ id: 'tp_right', name: 'Right', intent: 'Right', inputsRequired: ['x'] });

    const missingNode = createTechniqueComposition({
      id: 'tc_rel_missing',
      name: 'Rel missing',
      description: 'Missing relationship node',
      primitiveIds: ['tp_left'],
      relationships: [{ fromId: 'tp_left', toId: 'tp_missing', type: 'produces' }],
    });
    const missingAnalysis = analyzeTechniqueComposition(missingNode, [left]);
    expect(missingAnalysis.issues.some((issue) => issue.code === 'composition_relationship_missing_node')).toBe(true);

    const invalidType = createTechniqueComposition({
      id: 'tc_rel_invalid',
      name: 'Rel invalid',
      description: 'Invalid relationship type',
      primitiveIds: ['tp_left', 'tp_right'],
      relationships: [{ fromId: 'tp_left', toId: 'tp_right', type: 'bogus_rel' as never }],
    });
    const invalidAnalysis = analyzeTechniqueComposition(invalidType, [left, right]);
    expect(invalidAnalysis.issues.some((issue) => issue.code === 'composition_relationship_type_unknown')).toBe(true);

    const selfLoop = createTechniqueComposition({
      id: 'tc_self_loop',
      name: 'Self loop',
      description: 'Self loop',
      primitiveIds: ['tp_left'],
      relationships: [{ fromId: 'tp_left', toId: 'tp_left', type: 'depends_on' }],
    });
    const selfLoopAnalysis = analyzeTechniqueComposition(selfLoop, [left]);
    expect(selfLoopAnalysis.issues.some((issue) => issue.code === 'composition_relationship_self_loop')).toBe(true);

    const cycle = createTechniqueComposition({
      id: 'tc_cycle',
      name: 'Cycle',
      description: 'Cycle',
      primitiveIds: ['tp_left', 'tp_right'],
      relationships: [
        { fromId: 'tp_left', toId: 'tp_right', type: 'depends_on' },
        { fromId: 'tp_right', toId: 'tp_left', type: 'depends_on' },
      ],
    });
    const cycleAnalysis = analyzeTechniqueComposition(cycle, [left, right]);
    expect(cycleAnalysis.issues.some((issue) => issue.code === 'composition_dependency_cycle')).toBe(true);
  });
});
