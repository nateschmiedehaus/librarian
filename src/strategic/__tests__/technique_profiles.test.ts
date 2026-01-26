import { describe, it, expect } from 'vitest';
import {
  TECHNIQUE_SEMANTIC_PROFILES,
  getTechniqueSemanticProfile,
} from '../technique_profiles.js';
import { TECHNIQUE_SEMANTIC_PROFILE_IDS } from '../techniques.js';

describe('technique semantic profiles', () => {
  it('covers all profiles with basic schema guarantees', () => {
    const terminationValues = new Set(['always', 'conditional', 'unknown']);
    const determinismValues = new Set(['deterministic', 'probabilistic', 'unknown']);
    const complexityValues = new Set(['constant', 'linear', 'quadratic', 'unbounded', 'unknown']);

    for (const id of TECHNIQUE_SEMANTIC_PROFILE_IDS) {
      const profile = getTechniqueSemanticProfile(id);
      expect(profile.id).toBe(id);
      expect(profile.preconditions.length).toBeGreaterThan(0);
      expect(profile.postconditions.length).toBeGreaterThan(0);
      expect(profile.invariants.length).toBeGreaterThan(0);
      expect(profile.evidenceRequirements.length).toBeGreaterThan(0);
      expect(terminationValues.has(profile.termination)).toBe(true);
      expect(determinismValues.has(profile.determinism)).toBe(true);
      expect(complexityValues.has(profile.complexity)).toBe(true);
    }
  });

  it('keeps profile ids in sync with registry keys', () => {
    const registryIds = Object.keys(TECHNIQUE_SEMANTIC_PROFILES).sort();
    const knownIds = [...TECHNIQUE_SEMANTIC_PROFILE_IDS].sort();
    expect(registryIds).toEqual(knownIds);
  });

  it('returns profiles for valid ids', () => {
    const profile = getTechniqueSemanticProfile('analysis');
    expect(profile.id).toBe('analysis');
    expect(profile.preconditions.length).toBeGreaterThan(0);
  });

  it('throws for invalid ids', () => {
    expect(() => getTechniqueSemanticProfile('missing' as typeof TECHNIQUE_SEMANTIC_PROFILE_IDS[number]))
      .toThrow(/semantic_profile_missing/);
  });

  it('freezes profile registry and nested arrays', () => {
    expect(Object.isFrozen(TECHNIQUE_SEMANTIC_PROFILES)).toBe(true);
    for (const profile of Object.values(TECHNIQUE_SEMANTIC_PROFILES)) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.preconditions)).toBe(true);
      expect(Object.isFrozen(profile.postconditions)).toBe(true);
      expect(Object.isFrozen(profile.invariants)).toBe(true);
      expect(Object.isFrozen(profile.evidenceRequirements)).toBe(true);
    }
  });
});
