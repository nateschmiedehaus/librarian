/**
 * @fileoverview Prompt Template Emitter
 *
 * Mutates prompt templates with bounded, grammar-safe transformations:
 * - Purpose extraction prompts
 * - Mechanism extraction prompts
 * - Contract extraction prompts
 * - Contradiction detection prompts
 *
 * @packageDocumentation
 */

import type { Variant, ArchiveCell } from '../types.js';
import { BaseEmitter } from './base.js';

// ============================================================================
// PROMPT MUTATION TEMPLATES
// ============================================================================

/**
 * Prompt variations for purpose extraction.
 */
const PURPOSE_VARIANTS = [
  'v1_concise',
  'v2_structured',
  'v3_example_guided',
  'v4_chain_of_thought',
];

/**
 * Prompt variations for mechanism extraction.
 */
const MECHANISM_VARIANTS = [
  'v1_detailed',
  'v2_high_level',
  'v3_flow_focused',
  'v4_dependency_aware',
];

/**
 * Prompt variations for contract extraction.
 */
const CONTRACT_VARIANTS = [
  'v1_formal',
  'v2_natural',
  'v3_example_based',
  'v4_assertion_style',
];

/**
 * Prompt variations for contradiction detection.
 */
const CONTRADICTION_VARIANTS = [
  'v1_strict',
  'v2_lenient',
  'v3_evidence_focused',
  'v4_semantic_diff',
];

// ============================================================================
// EMITTER
// ============================================================================

/**
 * Emitter that mutates prompt templates.
 */
export class PromptEmitter extends BaseEmitter {
  id = 'prompt-template';
  name = 'Prompt Template Emitter';
  description = 'Mutates prompt templates with bounded variations';
  estimatedCost = { tokens: 500, embeddings: 0 };

  async emit(parent: Variant | null, archive: ArchiveCell[]): Promise<Variant> {
    const selectedParent = parent ?? this.selectParent(archive);

    // Get current templates or defaults
    const current = selectedParent?.genotype.promptTemplates ?? {
      purposeExtraction: 'v1_concise',
      mechanismExtraction: 'v1_detailed',
      contractExtraction: 'v1_formal',
      contradictionDetection: 'v1_strict',
      methodPackGeneration: 'v1_standard',
    };

    // Select a random template to mutate
    const mutations = [
      () => this.mutatePurpose(current),
      () => this.mutateMechanism(current),
      () => this.mutateContract(current),
      () => this.mutateContradiction(current),
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    const { changes, description } = mutation();

    return this.createVariant(selectedParent, { promptTemplates: changes }, description);
  }

  private mutatePurpose(current: NonNullable<Variant['genotype']['promptTemplates']>): {
    changes: Variant['genotype']['promptTemplates'];
    description: string;
  } {
    const currentVersion = current.purposeExtraction ?? 'v1_concise';
    const newVersion = selectDifferent(PURPOSE_VARIANTS, currentVersion);

    return {
      changes: { purposeExtraction: newVersion },
      description: `Changed purposeExtraction: ${currentVersion} -> ${newVersion}`,
    };
  }

  private mutateMechanism(current: NonNullable<Variant['genotype']['promptTemplates']>): {
    changes: Variant['genotype']['promptTemplates'];
    description: string;
  } {
    const currentVersion = current.mechanismExtraction ?? 'v1_detailed';
    const newVersion = selectDifferent(MECHANISM_VARIANTS, currentVersion);

    return {
      changes: { mechanismExtraction: newVersion },
      description: `Changed mechanismExtraction: ${currentVersion} -> ${newVersion}`,
    };
  }

  private mutateContract(current: NonNullable<Variant['genotype']['promptTemplates']>): {
    changes: Variant['genotype']['promptTemplates'];
    description: string;
  } {
    const currentVersion = current.contractExtraction ?? 'v1_formal';
    const newVersion = selectDifferent(CONTRACT_VARIANTS, currentVersion);

    return {
      changes: { contractExtraction: newVersion },
      description: `Changed contractExtraction: ${currentVersion} -> ${newVersion}`,
    };
  }

  private mutateContradiction(current: NonNullable<Variant['genotype']['promptTemplates']>): {
    changes: Variant['genotype']['promptTemplates'];
    description: string;
  } {
    const currentVersion = current.contradictionDetection ?? 'v1_strict';
    const newVersion = selectDifferent(CONTRADICTION_VARIANTS, currentVersion);

    return {
      changes: { contradictionDetection: newVersion },
      description: `Changed contradictionDetection: ${currentVersion} -> ${newVersion}`,
    };
  }
}

function selectDifferent(options: string[], current: string): string {
  const filtered = options.filter((o) => o !== current);
  return filtered[Math.floor(Math.random() * filtered.length)] ?? options[0];
}
