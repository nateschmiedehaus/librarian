import { describe, it, expect } from 'vitest';
import {
  COMPOSITION_PATTERN_CATALOG,
  createCompositionPattern,
  type CompositionPatternInput,
  validatePatternCatalog,
} from '../pattern_catalog.js';
import { DEFAULT_TECHNIQUE_PRIMITIVES_BY_ID } from '../technique_library.js';
import { DEFAULT_TECHNIQUE_COMPOSITIONS_BY_ID } from '../technique_compositions.js';
import { deterministic } from '../../epistemics/confidence.js';

const basePattern: CompositionPatternInput = {
  id: 'pattern_bug_investigation',
  name: 'Bug Investigation',
  archetype: 'investigation',
  situations: [
    {
      trigger: 'Something is broken',
      context: ['error message'],
      confidence: deterministic(true, 'pattern_catalog_test'),
      examples: ['Why is login failing?'],
    },
  ],
  corePrimitives: ['tp_hypothesis'],
  optionalPrimitives: [
    {
      primitiveId: 'tp_min_repro',
      includeWhen: ['intermittent'],
      excludeWhen: ['deterministic'],
      rationale: 'Isolate repro',
    },
  ],
  operators: [
    {
      type: 'loop',
      purpose: 'Iterate until signal stable',
      placement: 'wrapper',
      conditions: ['signal unstable'],
    },
  ],
  antiPatterns: [
    {
      description: 'Fixing without understanding',
      whyBad: 'Introduces new bugs',
      betterAlternative: 'Verify root cause first',
    },
  ],
  examples: ['tc_root_cause_recovery'],
  successSignals: ['Root cause identified'],
  failureSignals: ['Bug cannot be reproduced'],
};

describe('pattern catalog', () => {
  it('creates a validated composition pattern', () => {
    const pattern = createCompositionPattern(basePattern);
    expect(pattern.id).toBe('pattern_bug_investigation');
    expect(pattern.situations[0].confidence.type).toBe('deterministic');
    expect(pattern.corePrimitives[0]).toBe('tp_hypothesis');
  });

  it('rejects invalid pattern ids', () => {
    expect(() => createCompositionPattern({ ...basePattern, id: 'bad' })).toThrow(
      /pattern_catalog_id_invalid/
    );
  });

  it('rejects invalid primitive ids', () => {
    expect(() => createCompositionPattern({ ...basePattern, corePrimitives: ['bad'] })).toThrow(
      /pattern_catalog_primitive_id_invalid/
    );
  });

  it('rejects empty situations and examples', () => {
    expect(() => createCompositionPattern({ ...basePattern, situations: [] as never })).toThrow(
      /pattern_catalog_situations_too_short/
    );
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        situations: [
          { ...basePattern.situations[0], examples: [] as never },
        ],
      })
    ).toThrow(/pattern_catalog_situation_examples_too_short/);
  });

  it('rejects empty string entries in string arrays', () => {
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        situations: [
          { ...basePattern.situations[0], context: [''] },
        ],
      })
    ).toThrow(/pattern_catalog_situation_context_invalid/);
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        successSignals: [''],
      })
    ).toThrow(/pattern_catalog_success_signals_invalid/);
  });

  it('rejects out-of-range confidence', () => {
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        situations: [
          {
            ...basePattern.situations[0],
            confidence: {
              type: 'derived',
              value: 1.2,
              formula: 'test',
              inputs: [],
            },
          },
        ],
      })
    ).toThrow(/pattern_catalog_confidence_invalid/);
  });

  it('rejects invalid embeddings', () => {
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        embedding: [Number.NaN],
      })
    ).toThrow(/pattern_catalog_embedding_non_numeric/);
  });

  it('rejects oversized string lists', () => {
    const tooMany = Array.from({ length: 129 }, () => 'signal');
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        examples: tooMany,
      })
    ).toThrow(/pattern_catalog_examples_too_long/);
  });

  it('rejects invalid anti-patterns', () => {
    expect(() =>
      createCompositionPattern({
        ...basePattern,
        antiPatterns: [
          {
            description: '',
            whyBad: 'bad',
            betterAlternative: 'better',
          },
        ],
      })
    ).toThrow(/pattern_catalog_anti_pattern_description_invalid/);
  });

  it('exports an immutable catalog', () => {
    expect(Object.isFrozen(COMPOSITION_PATTERN_CATALOG)).toBe(true);
  });

  it('references known primitives and compositions', () => {
    for (const pattern of COMPOSITION_PATTERN_CATALOG) {
      for (const primitiveId of pattern.corePrimitives) {
        expect(DEFAULT_TECHNIQUE_PRIMITIVES_BY_ID.has(primitiveId)).toBe(true);
      }
      for (const optional of pattern.optionalPrimitives) {
        expect(DEFAULT_TECHNIQUE_PRIMITIVES_BY_ID.has(optional.primitiveId)).toBe(true);
      }
      for (const example of pattern.examples) {
        if (example.startsWith('tc_')) {
          expect(DEFAULT_TECHNIQUE_COMPOSITIONS_BY_ID.has(example)).toBe(true);
        }
      }
    }
  });

  it('avoids duplicate pattern ids and conflicting optional hints', () => {
    const seen = new Set<string>();
    for (const pattern of COMPOSITION_PATTERN_CATALOG) {
      expect(seen.has(pattern.id)).toBe(false);
      seen.add(pattern.id);
      for (const optional of pattern.optionalPrimitives) {
        const includeSet = new Set(optional.includeWhen.map((value) => value.toLowerCase()));
        for (const exclude of optional.excludeWhen) {
          expect(includeSet.has(exclude.toLowerCase())).toBe(false);
        }
      }
    }
  });

  it('includes expected verification and performance patterns', () => {
    const verification = COMPOSITION_PATTERN_CATALOG.find(
      (pattern) => pattern.id === 'pattern_change_verification'
    );
    const performance = COMPOSITION_PATTERN_CATALOG.find(
      (pattern) => pattern.id === 'pattern_performance_investigation'
    );

    expect(verification).toBeDefined();
    expect(performance).toBeDefined();

    const verificationPattern = verification!;
    const performancePattern = performance!;

    expect(verificationPattern.archetype).toBe('verification');
    expect(verificationPattern.corePrimitives).toEqual([
      'tp_assumption_audit',
      'tp_change_impact',
      'tp_test_gap_analysis',
      'tp_verify_plan',
    ]);
    expect(verificationPattern.examples).toContain('tc_agentic_review_v1');

    expect(performancePattern.archetype).toBe('investigation');
    expect(performancePattern.corePrimitives).toEqual([
      'tp_hypothesis',
      'tp_instrument',
      'tp_bisect',
      'tp_root_cause',
    ]);
    expect(performancePattern.examples).toContain('tc_performance_reliability');
  });

  it('validates catalog references and duplicates', () => {
    const invalidPrimitive = createCompositionPattern({
      ...basePattern,
      corePrimitives: ['tp_missing'],
    });
    expect(() => validatePatternCatalog([invalidPrimitive])).toThrow(
      /pattern_catalog_primitive_missing:tp_missing/
    );

    const invalidExample = createCompositionPattern({
      ...basePattern,
      examples: ['tc_missing_composition'],
    });
    expect(() => validatePatternCatalog([invalidExample])).toThrow(
      /pattern_catalog_example_missing:tc_missing_composition/
    );

    const first = createCompositionPattern(basePattern);
    const duplicate = createCompositionPattern({ ...basePattern, name: 'Duplicate' });
    expect(() => validatePatternCatalog([first, duplicate])).toThrow(
      /pattern_catalog_duplicate_id:pattern_bug_investigation/
    );
  });

  it('validates the default catalog without throwing', () => {
    expect(() => validatePatternCatalog([...COMPOSITION_PATTERN_CATALOG])).not.toThrow();
  });

  it('includes the feature construction pattern', () => {
    const feature = COMPOSITION_PATTERN_CATALOG.find(
      (pattern) => pattern.id === 'pattern_feature_construction'
    );
    expect(feature).toBeDefined();

    const featurePattern = feature!;
    expect(featurePattern.archetype).toBe('construction');
    expect(featurePattern.corePrimitives).toEqual([
      'tp_clarify_goal',
      'tp_list_constraints',
      'tp_decompose',
      'tp_verify_plan',
    ]);
    expect(featurePattern.examples).toContain('Feature development');
  });

  it('includes the safe refactoring pattern', () => {
    const refactoring = COMPOSITION_PATTERN_CATALOG.find(
      (pattern) => pattern.id === 'pattern_refactoring'
    );
    expect(refactoring).toBeDefined();

    const refactorPattern = refactoring!;
    expect(refactorPattern.archetype).toBe('transformation');
    expect(refactorPattern.corePrimitives).toEqual([
      'tp_change_impact',
      'tp_dependency_map',
      'tp_test_gap_analysis',
      'tp_verify_plan',
    ]);
    expect(refactorPattern.examples).toContain('Safe refactor');
  });

  it('includes the multi-agent coordination pattern', () => {
    const coordination = COMPOSITION_PATTERN_CATALOG.find(
      (pattern) => pattern.id === 'pattern_multi_agent_task'
    );
    expect(coordination).toBeDefined();

    const coordinationPattern = coordination!;
    expect(coordinationPattern.archetype).toBe('coordination');
    expect(coordinationPattern.corePrimitives).toEqual([
      'tp_decompose',
      'tp_ownership_matrix',
      'tp_blackboard_coordination',
      'tp_arbitration',
    ]);
    expect(coordinationPattern.examples).toContain('tc_multi_agent_coordination');
  });

  it('includes the self-improvement pattern', () => {
    const improvement = COMPOSITION_PATTERN_CATALOG.find(
      (pattern) => pattern.id === 'pattern_self_improvement'
    );
    expect(improvement).toBeDefined();

    const improvementPattern = improvement!;
    expect(improvementPattern.archetype).toBe('evolution');
    expect(improvementPattern.corePrimitives).toEqual([
      'tp_self_bootstrap',
      'tp_analyze_architecture',
      'tp_hebbian_learning',
      'tp_homeostasis_loop',
    ]);
    expect(improvementPattern.examples).toContain('Self audit');
  });

  it('includes the extended pattern set', () => {
    const expected = [
      { id: 'pattern_codebase_onboarding', archetype: 'analysis' },
      { id: 'pattern_security_audit', archetype: 'analysis' },
      { id: 'pattern_api_design', archetype: 'analysis' },
      { id: 'pattern_incident_response', archetype: 'recovery' },
      { id: 'pattern_dependency_update', archetype: 'recovery' },
      { id: 'pattern_technical_debt', archetype: 'optimization' },
      { id: 'pattern_test_generation', archetype: 'construction' },
      { id: 'pattern_documentation', archetype: 'construction' },
    ];

    for (const { id, archetype } of expected) {
      const pattern = COMPOSITION_PATTERN_CATALOG.find((entry) => entry.id === id);
      expect(pattern).toBeDefined();
      expect(pattern!.archetype).toBe(archetype);
    }
  });

  it('allows descriptive examples without tc_ prefix', () => {
    const descriptive = createCompositionPattern({
      ...basePattern,
      examples: ['Feature development walkthrough'],
    });
    expect(() => validatePatternCatalog([descriptive])).not.toThrow();
  });

  it('reports multiple validation issues together', () => {
    const invalid = createCompositionPattern({
      ...basePattern,
      corePrimitives: ['tp_missing'],
      examples: ['tc_missing_composition'],
    });
    expect(() => validatePatternCatalog([invalid])).toThrow(
      /pattern_catalog_primitive_missing:tp_missing; pattern_catalog_example_missing:tc_missing_composition/
    );
  });
});
