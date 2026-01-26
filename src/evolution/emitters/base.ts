/**
 * @fileoverview Base Emitter and Common Utilities
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import type { Emitter, Variant, ArchiveCell, VariantGenotype } from '../types.js';

/**
 * Base emitter implementation.
 */
export abstract class BaseEmitter implements Emitter {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract estimatedCost: { tokens: number; embeddings: number };

  abstract emit(parent: Variant | null, archive: ArchiveCell[]): Promise<Variant>;

  /**
   * Create a variant with the given genotype changes.
   */
  protected createVariant(
    parent: Variant | null,
    genotypeChanges: Partial<VariantGenotype>,
    mutationDescription: string
  ): Variant {
    const parentGenotype = parent?.genotype ?? {};

    return {
      id: `var_${randomUUID().slice(0, 8)}`,
      parentId: parent?.id ?? null,
      emitterId: this.id,
      createdAt: new Date().toISOString(),
      genotype: mergeGenotypes(parentGenotype, genotypeChanges),
      mutationDescription,
      evaluated: false,
    };
  }

  /**
   * Select a parent from the archive (tournament selection).
   */
  protected selectParent(archive: ArchiveCell[]): Variant | null {
    if (archive.length === 0) return null;

    // Tournament selection with size 3
    const tournamentSize = Math.min(3, archive.length);
    const candidates: ArchiveCell[] = [];

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * archive.length);
      candidates.push(archive[idx]);
    }

    // Return the fittest candidate
    candidates.sort((a, b) => b.fitness - a.fitness);
    return candidates[0].variant;
  }
}

/**
 * Merge parent genotype with changes.
 */
function mergeGenotypes(
  parent: VariantGenotype,
  changes: Partial<VariantGenotype>
): VariantGenotype {
  return {
    retrievalParams: {
      ...parent.retrievalParams,
      ...changes.retrievalParams,
    },
    promptTemplates: {
      ...parent.promptTemplates,
      ...changes.promptTemplates,
    },
    budgetThresholds: {
      ...parent.budgetThresholds,
      ...changes.budgetThresholds,
    },
    evaluationSet: {
      addedScenarios: [
        ...(parent.evaluationSet?.addedScenarios ?? []),
        ...(changes.evaluationSet?.addedScenarios ?? []),
      ],
      removedScenarios: [
        ...(parent.evaluationSet?.removedScenarios ?? []),
        ...(changes.evaluationSet?.removedScenarios ?? []),
      ],
      metamorphicTransforms: [
        ...(parent.evaluationSet?.metamorphicTransforms ?? []),
        ...(changes.evaluationSet?.metamorphicTransforms ?? []),
      ],
    },
    codePatches: [
      ...(parent.codePatches ?? []),
      ...(changes.codePatches ?? []),
    ],
  };
}
