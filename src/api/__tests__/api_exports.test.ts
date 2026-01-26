import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as api from '../index.js';
import { resetTechniqueSemanticsRegistry } from '../../strategic/technique_semantics.js';

describe('api exports', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    resetTechniqueSemanticsRegistry();
  });

  afterEach(() => {
    resetTechniqueSemanticsRegistry();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('re-exports technique constants and semantics', () => {
    expect(api.TECHNIQUE_PRIMITIVE_CATEGORIES).toContain('analysis');
    expect(api.TECHNIQUE_PRIMITIVE_KINDS).toContain('procedural');
    expect(api.TECHNIQUE_ABSTRACTION_LEVELS).toContain('strategic');
    expect(api.TECHNIQUE_SEMANTIC_PROFILE_IDS).toContain('verification');
    expect(api.TECHNIQUE_OPERATOR_TYPES).toContain('gate');
    expect(api.TECHNIQUE_RELATIONSHIP_TYPES).toContain('depends_on');
    const profile = api.getTechniqueSemanticProfile('analysis');
    expect(profile.id).toBe('analysis');
    const operator = api.getOperatorSemantics('gate');
    expect(operator.compile).toBe('checkpoint');
    const relationship = api.getRelationshipSemantics('depends_on');
    expect(relationship.direction).toBe('from_to');
    expect(typeof api.TechniqueCompositionBuilder).toBe('function');
  });

  it('re-exports registration and locking utilities', () => {
    api.registerOperatorSemantics('custom:export_test', {
      role: 'control',
      description: 'Export test',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
      requiredParameters: ['batchSize'],
    });
    api.lockTechniqueSemanticsRegistry();
    expect(() => api.registerOperatorSemantics('custom:blocked', {
      role: 'control',
      description: 'Blocked',
      compile: 'checkpoint',
      minInputs: 1,
      minOutputs: 0,
    })).toThrow(/semantics_registry_locked/);
  });
});
