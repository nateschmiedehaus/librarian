import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  OPERATOR_SEMANTICS,
  RELATIONSHIP_SEMANTICS,
  getOperatorSemantics,
  getRelationshipSemantics,
  registerOperatorSemantics,
  registerRelationshipSemantics,
  resetTechniqueSemanticsRegistry,
  lockTechniqueSemanticsRegistry,
  type OperatorSemantics,
} from '../technique_semantics.js';
import {
  TECHNIQUE_OPERATOR_TYPES,
  TECHNIQUE_RELATIONSHIP_TYPES,
  type TechniqueOperatorType,
  type TechniqueRelationshipType,
} from '../techniques.js';

describe('technique semantics registry', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    resetTechniqueSemanticsRegistry();
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('defines semantics for all operator types', () => {
    expect(Object.keys(OPERATOR_SEMANTICS).sort()).toEqual(TECHNIQUE_OPERATOR_TYPES.slice().sort());
  });

  it('defines semantics for all relationship types', () => {
    expect(Object.keys(RELATIONSHIP_SEMANTICS).sort())
      .toEqual(TECHNIQUE_RELATIONSHIP_TYPES.slice().sort());
  });

  it('freezes registries to avoid mutation drift', () => {
    expect(Object.isFrozen(OPERATOR_SEMANTICS)).toBe(true);
    expect(Object.isFrozen(RELATIONSHIP_SEMANTICS)).toBe(true);
    for (const semantics of Object.values(OPERATOR_SEMANTICS)) {
      expect(Object.isFrozen(semantics)).toBe(true);
    }
    for (const semantics of Object.values(RELATIONSHIP_SEMANTICS)) {
      expect(Object.isFrozen(semantics)).toBe(true);
    }
  });

  it('enforces minimum input/output constraints', () => {
    for (const type of TECHNIQUE_OPERATOR_TYPES) {
      const semantics = OPERATOR_SEMANTICS[type] as OperatorSemantics;
      expect(semantics.minInputs).toBeGreaterThanOrEqual(0);
      expect(semantics.minOutputs).toBeGreaterThanOrEqual(0);
      if (typeof semantics.maxInputs === 'number') {
        expect(semantics.maxInputs).toBeGreaterThanOrEqual(semantics.minInputs);
      }
      if (typeof semantics.maxOutputs === 'number') {
        expect(semantics.maxOutputs).toBeGreaterThanOrEqual(semantics.minOutputs);
      }
    }
  });

  it('marks core flow operators as edge-compiled', () => {
    expect(OPERATOR_SEMANTICS.sequence.compile).toBe('edge');
    expect(OPERATOR_SEMANTICS.parallel.compile).toBe('edge');
    expect(OPERATOR_SEMANTICS.fanout.compile).toBe('edge');
    expect(OPERATOR_SEMANTICS.fanin.compile).toBe('edge');
    expect(OPERATOR_SEMANTICS.reduce.compile).toBe('edge');
  });

  it('marks gates as checkpoint-compiled', () => {
    expect(OPERATOR_SEMANTICS.gate.compile).toBe('checkpoint');
    expect(OPERATOR_SEMANTICS.checkpoint.compile).toBe('checkpoint');
    expect(OPERATOR_SEMANTICS.timebox.compile).toBe('checkpoint');
    expect(OPERATOR_SEMANTICS.budget_cap.compile).toBe('checkpoint');
  });

  it('throws when operator semantics are missing', () => {
    expect(() => getOperatorSemantics('tp_missing' as TechniqueOperatorType))
      .toThrow(/operator_semantics_missing/);
  });

  it('throws when relationship semantics are missing', () => {
    expect(() => getRelationshipSemantics('tp_missing' as TechniqueRelationshipType))
      .toThrow(/relationship_semantics_missing/);
  });

  it('supports custom operator semantics registration', () => {
    registerOperatorSemantics('custom:batch', {
      role: 'control',
      description: 'Batch inputs before processing.',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
      requiredParameters: ['batchSize'],
    });
    const semantics = getOperatorSemantics('custom:batch');
    expect(semantics.description).toBe('Batch inputs before processing.');
  });

  it('supports custom relationship semantics registration', () => {
    registerRelationshipSemantics('custom:audits', {
      direction: 'from_to',
      dependencyType: 'requires_decision',
      description: 'From audits To.',
    });
    const semantics = getRelationshipSemantics('custom:audits');
    expect(semantics.direction).toBe('from_to');
  });

  it('rejects overriding builtin operator semantics', () => {
    expect(() => registerOperatorSemantics('gate', {
      role: 'gate',
      description: 'Override gate',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
    })).toThrow(/operator_semantics_override_forbidden/);
  });

  it('rejects invalid custom operator types', () => {
    expect(() => registerOperatorSemantics('custom:bad-name' as TechniqueOperatorType, {
      role: 'control',
      description: 'Bad custom type',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
    })).toThrow(/operator_type_invalid/);
  });

  it('rejects duplicate custom operator registrations without override', () => {
    registerOperatorSemantics('custom:dup_operator', {
      role: 'control',
      description: 'Duplicate operator',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
    });
    expect(() => registerOperatorSemantics('custom:dup_operator', {
      role: 'control',
      description: 'Duplicate operator',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
    })).toThrow(/operator_semantics_exists/);
  });

  it('rejects invalid operator semantics shapes', () => {
    expect(() => registerOperatorSemantics('custom:bad_shape', {
      role: 'flow',
      description: 'Bad shape',
      compile: 'edge',
      minInputs: -1,
      minOutputs: 0,
    } as unknown as Parameters<typeof registerOperatorSemantics>[1])).toThrow(/operator_semantics_invalid/);

    expect(() => registerOperatorSemantics('custom:bad_description', {
      role: 'control',
      description: '',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
    })).toThrow(/operator_semantics_invalid/);
  });

  it('rejects overriding builtin relationship semantics', () => {
    expect(() => registerRelationshipSemantics('depends_on', {
      direction: 'from_to',
      dependencyType: 'blocked_by',
      description: 'Override depends_on',
    })).toThrow(/relationship_semantics_override_forbidden/);
  });

  it('rejects invalid custom relationship types', () => {
    expect(() => registerRelationshipSemantics('custom:bad-rel' as TechniqueRelationshipType, {
      direction: 'from_to',
      dependencyType: 'requires_decision',
      description: 'Bad custom relationship',
    })).toThrow(/relationship_type_invalid/);
  });

  it('rejects duplicate custom relationship registrations without override', () => {
    registerRelationshipSemantics('custom:dup_relationship', {
      direction: 'from_to',
      dependencyType: 'requires_decision',
      description: 'Duplicate relationship',
    });
    expect(() => registerRelationshipSemantics('custom:dup_relationship', {
      direction: 'from_to',
      dependencyType: 'requires_decision',
      description: 'Duplicate relationship',
    })).toThrow(/relationship_semantics_exists/);
  });

  it('rejects invalid relationship semantics shapes', () => {
    expect(() => registerRelationshipSemantics('custom:bad_relationship', {
      direction: 'sideways',
      dependencyType: 'requires_decision',
      description: '',
    } as unknown as Parameters<typeof registerRelationshipSemantics>[1])).toThrow(/relationship_semantics_invalid/);
  });

  it('locks the registry to prevent further registration', () => {
    lockTechniqueSemanticsRegistry();
    expect(() => registerOperatorSemantics('custom:locked', {
      role: 'control',
      description: 'Locked registry',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
    })).toThrow(/semantics_registry_locked/);
  });
});
