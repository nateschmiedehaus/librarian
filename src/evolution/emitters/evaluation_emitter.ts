/**
 * @fileoverview Evaluation Set Emitter
 *
 * Proposes new regression tests or metamorphic transformations:
 * - New scenario definitions
 * - Metamorphic test transforms
 * - Regression corpus additions
 *
 * @packageDocumentation
 */

import type { Variant, ArchiveCell } from '../types.js';
import { BaseEmitter } from './base.js';

// ============================================================================
// SCENARIO TEMPLATES
// ============================================================================

/**
 * Available scenario templates that can be added.
 */
const SCENARIO_TEMPLATES = [
  'scenario_onboarding_typescript',
  'scenario_onboarding_python',
  'scenario_onboarding_mixed',
  'scenario_change_impact_small',
  'scenario_change_impact_large',
  'scenario_security_injection',
  'scenario_security_secrets',
  'scenario_refactor_single_file',
  'scenario_refactor_cross_module',
  'scenario_query_semantic',
  'scenario_query_structural',
  'scenario_query_graph',
  'scenario_bootstrap_fresh',
  'scenario_bootstrap_incremental',
  'scenario_recovery_stale',
  'scenario_recovery_defeater',
];

/**
 * Available metamorphic transforms.
 */
const METAMORPHIC_TRANSFORMS = [
  'transform_rephrase_query',
  'transform_shuffle_files',
  'transform_add_noise',
  'transform_remove_comments',
  'transform_rename_symbols',
  'transform_reorder_functions',
];

// ============================================================================
// EMITTER
// ============================================================================

/**
 * Emitter that proposes evaluation set modifications.
 */
export class EvaluationEmitter extends BaseEmitter {
  id = 'evaluation-set';
  name = 'Evaluation Set Emitter';
  description = 'Proposes new test scenarios and metamorphic transforms';
  estimatedCost = { tokens: 100, embeddings: 0 };

  async emit(parent: Variant | null, archive: ArchiveCell[]): Promise<Variant> {
    const selectedParent = parent ?? this.selectParent(archive);

    // Get current evaluation set
    const current = selectedParent?.genotype.evaluationSet ?? {
      addedScenarios: [],
      removedScenarios: [],
      metamorphicTransforms: [],
    };

    // Select a random mutation type
    const mutations = [
      () => this.addScenario(current),
      () => this.addMetamorphicTransform(current),
      () => this.removeWeakScenario(current),
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    const { changes, description } = mutation();

    return this.createVariant(selectedParent, { evaluationSet: changes }, description);
  }

  private addScenario(current: NonNullable<Variant['genotype']['evaluationSet']>): {
    changes: Variant['genotype']['evaluationSet'];
    description: string;
  } {
    // Find a scenario not already added
    const existing = new Set(current.addedScenarios);
    const available = SCENARIO_TEMPLATES.filter((s) => !existing.has(s));

    if (available.length === 0) {
      return {
        changes: {},
        description: 'No new scenarios available to add',
      };
    }

    const newScenario = available[Math.floor(Math.random() * available.length)];

    return {
      changes: {
        addedScenarios: [newScenario],
      },
      description: `Added scenario: ${newScenario}`,
    };
  }

  private addMetamorphicTransform(current: NonNullable<Variant['genotype']['evaluationSet']>): {
    changes: Variant['genotype']['evaluationSet'];
    description: string;
  } {
    // Find a transform not already added
    const existing = new Set(current.metamorphicTransforms);
    const available = METAMORPHIC_TRANSFORMS.filter((t) => !existing.has(t));

    if (available.length === 0) {
      return {
        changes: {},
        description: 'No new transforms available to add',
      };
    }

    const newTransform = available[Math.floor(Math.random() * available.length)];

    return {
      changes: {
        metamorphicTransforms: [newTransform],
      },
      description: `Added metamorphic transform: ${newTransform}`,
    };
  }

  private removeWeakScenario(current: NonNullable<Variant['genotype']['evaluationSet']>): {
    changes: Variant['genotype']['evaluationSet'];
    description: string;
  } {
    // Propose removing a scenario (would need fitness correlation data in real impl)
    const candidates = current.addedScenarios ?? [];

    if (candidates.length === 0) {
      return {
        changes: {},
        description: 'No scenarios to remove',
      };
    }

    const toRemove = candidates[Math.floor(Math.random() * candidates.length)];

    return {
      changes: {
        removedScenarios: [toRemove],
      },
      description: `Proposed removing weak scenario: ${toRemove}`,
    };
  }
}
