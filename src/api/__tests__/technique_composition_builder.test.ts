import { describe, it, expect } from 'vitest';
import {
  createTechniqueComposition,
  createTechniquePrimitive,
} from '../../strategic/techniques.js';
import { DEFAULT_TECHNIQUE_COMPOSITIONS } from '../technique_compositions.js';
import { TechniqueCompositionBuilder } from '../technique_composition_builder.js';

describe('TechniqueCompositionBuilder', () => {
  const now = '2026-01-20T00:00:00.000Z';
  const primitives = [
    createTechniquePrimitive({ id: 'tp_a', name: 'A', intent: 'A' }),
    createTechniquePrimitive({ id: 'tp_b', name: 'B', intent: 'B' }),
    createTechniquePrimitive({ id: 'tp_c', name: 'C', intent: 'C' }),
  ];

  it('builds a custom composition with relationships', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_custom',
      name: 'Custom',
      description: 'Custom composition',
    });

    const built = builder
      .addPrimitive('tp_a')
      .addPrimitive('tp_b', { after: 'tp_a' })
      .relate('tp_a', 'depends_on', 'tp_b')
      .build({ primitives, now });

    expect(built.primitiveIds).toEqual(['tp_a', 'tp_b']);
    expect(built.relationships).toHaveLength(1);
    expect(built.relationships?.[0]?.type).toBe('depends_on');
    expect(built.updatedAt).toBe(now);
  });

  it('rejects relationships that reference missing primitives', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_invalid',
      name: 'Invalid',
      description: 'Invalid relationship',
      primitiveIds: ['tp_a'],
    });

    expect(() => builder.relate('tp_a', 'depends_on', 'tp_missing')).toThrow(
      'unverified_by_trace(relationship_to_missing)'
    );
  });

  it('positions primitives and rejects invalid anchors', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_positions',
      name: 'Positions',
      description: 'Position primitives',
      primitiveIds: ['tp_a'],
    });

    builder.addPrimitive('tp_b', { index: 0 });
    builder.addPrimitive('tp_c', { after: 'tp_a' });
    expect(builder.build({ primitives, now }).primitiveIds).toEqual(['tp_b', 'tp_a', 'tp_c']);

    expect(() => builder.addPrimitive('tp_x', { index: -1 })).toThrow(
      'unverified_by_trace(primitive_index_invalid)'
    );
    expect(() => builder.addPrimitive('tp_x', { before: 'tp_missing' })).toThrow(
      'unverified_by_trace(primitive_missing_before)'
    );
  });

  it('allows explicit duplicate primitives', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_duplicates',
      name: 'Duplicates',
      description: 'Duplicate primitives',
      primitiveIds: ['tp_a'],
    });

    builder.addPrimitive('tp_a', { allowDuplicates: true });
    expect(builder.build({ primitives, now }).primitiveIds).toEqual(['tp_a', 'tp_a']);
  });

  it('removes primitives and prunes invalid operators', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_remove',
      name: 'Remove',
      description: 'Remove primitives',
      primitiveIds: ['tp_a', 'tp_b', 'tp_c'],
      operators: [
        { id: 'op_1', type: 'parallel', inputs: ['tp_a', 'tp_b'] },
      ],
      relationships: [
        { fromId: 'tp_a', toId: 'tp_b', type: 'depends_on' },
        { fromId: 'tp_b', toId: 'tp_c', type: 'depends_on' },
      ],
    });

    const built = builder.removePrimitive('tp_b').build({ primitives, now });
    expect(built.primitiveIds).toEqual(['tp_a', 'tp_c']);
    expect(built.operators).toHaveLength(0);
    expect(built.relationships).toHaveLength(0);
  });

  it('adds operators with reference validation', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_ops',
      name: 'Ops',
      description: 'Operator checks',
      primitiveIds: ['tp_a', 'tp_b'],
    });

    builder.addOperator({ id: 'op_1', type: 'sequence', inputs: ['tp_a', 'tp_b'] });
    expect(builder.build({ primitives, now }).operators).toHaveLength(1);

    expect(() => builder.addOperator({ id: 'op_1', type: 'sequence', inputs: ['tp_a'] })).toThrow(
      'unverified_by_trace(operator_duplicate)'
    );
    expect(() => builder.addOperator({ id: 'op_2', type: 'sequence', inputs: ['tp_missing'] })).toThrow(
      'unverified_by_trace(operator_inputs_missing)'
    );
    expect(() => builder.addOperator({ id: 'op_3', type: 'custom:unknown', inputs: ['tp_a'] })).toThrow(
      'unverified_by_trace(operator_type_unknown)'
    );
    expect(() => builder.addOperator({ id: 'op_4', type: 'sequence', inputs: ['tp_a', 'tp_a'] })).toThrow(
      'unverified_by_trace(operator_inputs_duplicate)'
    );
  });

  it('merges composition details and options', () => {
    const base = new TechniqueCompositionBuilder({
      id: 'tc_base',
      name: 'Base',
      description: 'Base composition',
      primitiveIds: ['tp_a'],
      operators: [{ id: 'op_base', type: 'sequence', inputs: ['tp_a'] }],
    });
    const other = new TechniqueCompositionBuilder({
      id: 'tc_other',
      name: 'Other',
      description: 'Other composition',
      primitiveIds: ['tp_a', 'tp_b'],
      operators: [{ id: 'op_other', type: 'sequence', inputs: ['tp_a', 'tp_b'] }],
      relationships: [{ fromId: 'tp_a', toId: 'tp_b', type: 'depends_on' }],
    });

    const built = base.merge(other, {
      mergeOperators: true,
      mergeRelationships: true,
      allowDuplicatePrimitives: true,
    }).build({ primitives, now });

    expect(built.primitiveIds).toEqual(['tp_a', 'tp_a', 'tp_b']);
    expect(built.operators).toHaveLength(2);
    expect(built.relationships).toHaveLength(1);
  });

  it('clones from composition with overrides', () => {
    const base = createTechniqueComposition({
      id: 'tc_base_override',
      name: 'Base',
      description: 'Base description',
      primitiveIds: ['tp_a'],
    });
    const built = TechniqueCompositionBuilder.from(base, {
      id: 'tc_override',
      name: 'Override',
      description: 'Override description',
    }).build({ primitives, now });

    expect(built.id).toBe('tc_override');
    expect(built.name).toBe('Override');
    expect(built.description).toBe('Override description');
    expect(built.primitiveIds).toEqual(['tp_a']);
  });

  it('resolves fromId sources and throws on missing', () => {
    const defaultId = DEFAULT_TECHNIQUE_COMPOSITIONS[0]?.id;
    expect(defaultId).toBeDefined();
    if (!defaultId) return;

    const built = TechniqueCompositionBuilder.fromId(defaultId).build({
      primitives,
      now,
      allowMissingPrimitives: true,
    });
    expect(built.id).toBe(defaultId);

    const custom = createTechniqueComposition({
      id: 'tc_custom_source',
      name: 'Custom Source',
      description: 'Custom composition source',
      primitiveIds: ['tp_a'],
    });
    const customBuilt = TechniqueCompositionBuilder.fromId('tc_custom_source', [custom])
      .build({ primitives, now });
    expect(customBuilt.id).toBe('tc_custom_source');

    expect(() => TechniqueCompositionBuilder.fromId('tc_missing', [])).toThrow(
      'unverified_by_trace(composition_missing)'
    );
  });

  it('supports metadata mutation helpers', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_meta',
      name: 'Meta',
      description: 'Meta composition',
      primitiveIds: ['tp_a'],
    });

    const built = builder
      .setName('Next')
      .setDescription('Next description')
      .setGraphVersion(2)
      .build({ primitives, now });

    expect(built.name).toBe('Next');
    expect(built.description).toBe('Next description');
    expect(built.graphVersion).toBe(2);
  });

  it('keeps clones isolated from base mutations', () => {
    const base = createTechniqueComposition({
      id: 'tc_clone',
      name: 'Clone',
      description: 'Clone composition',
      primitiveIds: ['tp_a', 'tp_b'],
      operators: [{ id: 'op_clone', type: 'parallel', inputs: ['tp_a', 'tp_b'] }],
    });
    const builder = TechniqueCompositionBuilder.from(base);
    builder.removePrimitive('tp_b');

    expect(base.operators?.[0]?.inputs).toEqual(['tp_a', 'tp_b']);
  });

  it('snapshot isolates future mutations', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_snapshot',
      name: 'Snapshot',
      description: 'Snapshot composition',
      primitiveIds: ['tp_a'],
    });
    const snapshot = builder.snapshot();

    builder.setName('Updated');
    expect(snapshot.name).toBe('Snapshot');
  });

  it('adds relationships via direct method', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_relationship',
      name: 'Relationship',
      description: 'Relationship additions',
      primitiveIds: ['tp_a', 'tp_b'],
    });

    builder.addRelationship({ fromId: 'tp_a', toId: 'tp_b', type: 'depends_on' });
    const built = builder.build({ primitives, now });
    expect(built.relationships).toHaveLength(1);
  });

  it('rejects invalid relationship payloads', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_relationship_invalid',
      name: 'Relationship invalid',
      description: 'Relationship additions',
      primitiveIds: ['tp_a', 'tp_b'],
    });

    expect(() => builder.addRelationship({
      fromId: 'tp_a',
      toId: 'tp_b',
      type: 'depends_on',
      notes: 'x'.repeat(1200),
    })).toThrow('unverified_by_trace(invalid_relationship_notes)');

    expect(() => builder.addRelationship({
      fromId: 'tp_a',
      toId: 'tp_b',
      type: 'depends_on',
      weight: Number.POSITIVE_INFINITY,
    })).toThrow('unverified_by_trace(invalid_relationship_weight)');
  });

  it('rejects missing primitives when validating', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_missing_primitive',
      name: 'Missing primitive',
      description: 'Missing primitive validation',
      primitiveIds: ['tp_missing'],
    });

    expect(() => builder.build({ primitives, now })).toThrow('unverified_by_trace');
  });

  it('rejects self-referential relationships', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_self',
      name: 'Self loop',
      description: 'Self loop',
      primitiveIds: ['tp_a'],
    });

    expect(() => builder.relate('tp_a', 'depends_on', 'tp_a')).toThrow(
      'unverified_by_trace(relationship_self_loop)'
    );
  });

  it('prunes operators with missing outputs', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_outputs',
      name: 'Outputs',
      description: 'Output pruning',
      primitiveIds: ['tp_a', 'tp_b'],
      operators: [{ id: 'op_out', type: 'fanout', inputs: ['tp_a'], outputs: ['tp_b'] }],
    });

    const built = builder.removePrimitive('tp_b').build({ primitives, now });
    expect(built.operators).toHaveLength(0);
  });

  it('validates merge collisions and missing references', () => {
    const base = new TechniqueCompositionBuilder({
      id: 'tc_merge_base',
      name: 'Merge base',
      description: 'Merge base',
      primitiveIds: ['tp_a'],
      operators: [{ id: 'op_shared', type: 'sequence', inputs: ['tp_a'] }],
    });
    const other = new TechniqueCompositionBuilder({
      id: 'tc_merge_other',
      name: 'Merge other',
      description: 'Merge other',
      primitiveIds: ['tp_b'],
      operators: [{ id: 'op_shared', type: 'sequence', inputs: ['tp_b'] }],
    });

    expect(() => base.merge(other, { mergeOperators: true }).build({ primitives, now })).toThrow(
      'unverified_by_trace(operator_duplicate)'
    );

    const otherMissing = new TechniqueCompositionBuilder({
      id: 'tc_merge_missing',
      name: 'Merge missing',
      description: 'Merge missing',
      primitiveIds: ['tp_a'],
      operators: [{ id: 'op_missing', type: 'sequence', inputs: ['tp_missing'] }],
    });

    expect(() => base.merge(otherMissing, { mergeOperators: true }).build({ primitives, now })).toThrow(
      'unverified_by_trace(operator_inputs_missing)'
    );
  });

  it('requires timestamps for build', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_timestamp',
      name: 'Timestamp',
      description: 'Timestamp required',
      primitiveIds: ['tp_a'],
    });

    expect(() => builder.build({ primitives } as unknown as { primitives: typeof primitives; now: string })).toThrow(
      'unverified_by_trace(timestamp_required)'
    );
  });

  it('rejects empty ids', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_empty',
      name: 'Empty',
      description: 'Empty ids',
    });

    expect(() => builder.addPrimitive('')).toThrow('unverified_by_trace(invalid_primitive_id)');
  });

  it('requires explicit validation opt-out', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_validation_required',
      name: 'Validation required',
      description: 'Validation required',
      primitiveIds: ['tp_a'],
    });

    expect(() => builder.build({ now })).toThrow('unverified_by_trace(primitives_required)');
    const built = builder.build({ now, skipValidation: true });
    expect(built.id).toBe('tc_validation_required');
  });

  it('deep clones operator parameters', () => {
    const builder = new TechniqueCompositionBuilder({
      id: 'tc_params',
      name: 'Params',
      description: 'Parameters cloning',
      primitiveIds: ['tp_a'],
      operators: [
        {
          id: 'op_params',
          type: 'sequence',
          inputs: ['tp_a'],
          parameters: { nested: { value: 1 } },
        },
      ],
    });

    const snapshot = builder.snapshot();
    const params = snapshot.operators?.[0]?.parameters as { nested: { value: number } };
    expect(() => {
      params.nested.value = 2;
    }).toThrow();

    const snapshot2 = builder.snapshot();
    const nextParams = snapshot2.operators?.[0]?.parameters as { nested: { value: number } };
    expect(nextParams).not.toBe(params);
  });

  it('rolls back merge on failure', () => {
    const base = new TechniqueCompositionBuilder({
      id: 'tc_merge_atomic',
      name: 'Merge atomic',
      description: 'Merge atomic',
      primitiveIds: ['tp_a'],
      operators: [{ id: 'op_a', type: 'sequence', inputs: ['tp_a'] }],
    });
    const other = new TechniqueCompositionBuilder({
      id: 'tc_merge_atomic_other',
      name: 'Merge atomic other',
      description: 'Merge atomic other',
      primitiveIds: ['tp_a'],
      operators: [{ id: 'op_a', type: 'sequence', inputs: ['tp_a'] }],
    });

    expect(() => base.merge(other, { mergeOperators: true })).toThrow(
      'unverified_by_trace(operator_duplicate)'
    );
    expect(base.snapshot().operators).toHaveLength(1);
  });

  it('rejects invalid operator parameter shapes', () => {
    const makeBuilder = (id: string) => new TechniqueCompositionBuilder({
      id,
      name: 'Param validation',
      description: 'Param validation',
      primitiveIds: ['tp_a'],
    });

    const deep: Record<string, unknown> = { level: {} };
    let cursor: Record<string, unknown> = deep.level as Record<string, unknown>;
    for (let i = 0; i < 10; i++) {
      cursor.level = {};
      cursor = cursor.level as Record<string, unknown>;
    }
    expect(() => makeBuilder('tc_param_depth').addOperator({
      id: 'op_depth',
      type: 'sequence',
      inputs: ['tp_a'],
      parameters: deep,
    })).toThrow('operator_parameters');

    expect(() => makeBuilder('tc_param_nan').addOperator({
      id: 'op_nan',
      type: 'sequence',
      inputs: ['tp_a'],
      parameters: { value: Number.NaN },
    })).toThrow('operator_parameters');

    expect(() => makeBuilder('tc_param_array').addOperator({
      id: 'op_array',
      type: 'sequence',
      inputs: ['tp_a'],
      parameters: { items: new Array(201).fill('x') },
    })).toThrow('operator_parameters');

    const forbidden = Object.create(null) as Record<string, unknown>;
    forbidden['__proto__'] = { bad: true } as unknown as Record<string, unknown>;
    expect(() => makeBuilder('tc_param_forbidden').addOperator({
      id: 'op_forbidden',
      type: 'sequence',
      inputs: ['tp_a'],
      parameters: forbidden,
    })).toThrow('operator_parameters');

    expect(() => makeBuilder('tc_param_fn').addOperator({
      id: 'op_fn',
      type: 'sequence',
      inputs: ['tp_a'],
      parameters: { fn: () => true },
    })).toThrow('operator_parameters');

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => makeBuilder('tc_param_circular').addOperator({
      id: 'op_circular',
      type: 'sequence',
      inputs: ['tp_a'],
      parameters: circular,
    })).toThrow('operator_parameters');
  });
});
