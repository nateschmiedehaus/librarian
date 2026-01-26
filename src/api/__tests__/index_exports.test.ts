import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TECHNIQUE_PRIMITIVES,
  ensureTechniquePrimitives,
  DEFAULT_TECHNIQUE_COMPOSITIONS,
  ensureTechniqueCompositions,
  validateTechniqueComposition,
  selectTechniqueCompositions,
  selectTechniqueCompositionsFromStorage,
  compileTechniqueCompositionTemplate,
  compileTechniqueCompositionTemplateFromStorage,
  compileTechniqueCompositionTemplateWithGaps,
  compileTechniqueCompositionTemplateWithGapsFromStorage,
  compileTechniqueCompositionBundle,
  compileTechniqueCompositionBundleFromStorage,
  compileTechniqueBundlesFromIntent,
  compileTechniqueCompositionPrototype,
  compileLCL,
  loadPresets,
  applyTemplate,
  applyEpistemicPolicy,
  ClosedLoopLearner,
  ContextAssemblySessionManager,
  SemanticCompositionSelector,
} from '../index.js';

describe('api index exports', () => {
  it('exposes technique library helpers', () => {
    expect(Array.isArray(DEFAULT_TECHNIQUE_PRIMITIVES)).toBe(true);
    expect(DEFAULT_TECHNIQUE_PRIMITIVES.length).toBeGreaterThan(0);
    expect(DEFAULT_TECHNIQUE_PRIMITIVES.every(
      (item) => item &&
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        typeof item.name === 'string' &&
        item.name.length > 0
    )).toBe(true);
    expect(DEFAULT_TECHNIQUE_PRIMITIVES.some((item) => item.id === 'tp_clarify_goal')).toBe(true);
    expect(typeof ensureTechniquePrimitives).toBe('function');
  });

  it('exposes technique composition helpers', () => {
    expect(Array.isArray(DEFAULT_TECHNIQUE_COMPOSITIONS)).toBe(true);
    expect(DEFAULT_TECHNIQUE_COMPOSITIONS.length).toBeGreaterThan(0);
    expect(DEFAULT_TECHNIQUE_COMPOSITIONS.every(
      (item) => item &&
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        Array.isArray(item.primitiveIds) &&
        item.primitiveIds.length > 0
    )).toBe(true);
    expect(DEFAULT_TECHNIQUE_COMPOSITIONS.some((item) => item.id === 'tc_agentic_review_v1')).toBe(true);
    expect(typeof ensureTechniqueCompositions).toBe('function');
    expect(typeof validateTechniqueComposition).toBe('function');
  });

  it('exposes plan compiler selection helpers', () => {
    expect(typeof selectTechniqueCompositions).toBe('function');
    expect(typeof selectTechniqueCompositionsFromStorage).toBe('function');
    expect(typeof compileTechniqueCompositionTemplate).toBe('function');
    expect(typeof compileTechniqueCompositionTemplateFromStorage).toBe('function');
    expect(typeof compileTechniqueCompositionTemplateWithGaps).toBe('function');
    expect(typeof compileTechniqueCompositionTemplateWithGapsFromStorage).toBe('function');
    expect(typeof compileTechniqueCompositionBundle).toBe('function');
    expect(typeof compileTechniqueCompositionBundleFromStorage).toBe('function');
    expect(typeof compileTechniqueBundlesFromIntent).toBe('function');
    expect(typeof compileTechniqueCompositionPrototype).toBe('function');
  });

  it('exposes closed loop learning helpers', () => {
    expect(typeof ClosedLoopLearner).toBe('function');
  });

  it('exposes context session helpers', () => {
    expect(typeof ContextAssemblySessionManager).toBe('function');
  });

  it('exposes semantic composition selector', () => {
    expect(typeof SemanticCompositionSelector).toBe('function');
  });

  it('exposes LCL configuration helpers', () => {
    expect(typeof compileLCL).toBe('function');
    expect(typeof loadPresets).toBe('function');
  });

  it('exposes structure templates', () => {
    expect(typeof applyTemplate).toBe('function');
  });

  it('exposes epistemic policy helpers', () => {
    expect(typeof applyEpistemicPolicy).toBe('function');
  });
});
