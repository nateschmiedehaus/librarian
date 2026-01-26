/**
 * @fileoverview Retrieval Weight Emitter
 *
 * Mutates retrieval parameters within safe ranges:
 * - Lexical vs semantic vs graph weights
 * - Co-change boost strength
 * - Reranker threshold
 * - Graph expansion depth
 *
 * @packageDocumentation
 */

import type { Variant, ArchiveCell } from '../types.js';
import { BaseEmitter } from './base.js';
import { clamp } from '../../utils/math.js';

/**
 * Emitter that mutates retrieval parameters.
 */
export class RetrievalWeightEmitter extends BaseEmitter {
  id = 'retrieval-weight';
  name = 'Retrieval Weight Emitter';
  description = 'Mutates retrieval weights within safe ranges';
  estimatedCost = { tokens: 0, embeddings: 10 };

  async emit(parent: Variant | null, archive: ArchiveCell[]): Promise<Variant> {
    const selectedParent = parent ?? this.selectParent(archive);

    // Get current values or defaults
    const current = selectedParent?.genotype.retrievalParams ?? {
      lexicalWeight: 0.3,
      semanticWeight: 0.5,
      graphWeight: 0.2,
      coChangeBoost: 1.2,
      rerankerThreshold: 0.5,
      graphExpansionDepth: 2,
    };

    // Select a random mutation
    const mutations = [
      () => this.mutateWeights(current),
      () => this.mutateCoChangeBoost(current),
      () => this.mutateRerankerThreshold(current),
      () => this.mutateGraphDepth(current),
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    const { changes, description } = mutation();

    return this.createVariant(selectedParent, { retrievalParams: changes }, description);
  }

  private mutateWeights(current: NonNullable<Variant['genotype']['retrievalParams']>): {
    changes: Variant['genotype']['retrievalParams'];
    description: string;
  } {
    // Slightly adjust weights while keeping sum = 1
    const delta = (Math.random() - 0.5) * 0.2; // +/- 10%

    const weightTypes = ['lexicalWeight', 'semanticWeight', 'graphWeight'] as const;
    const increaseIdx = Math.floor(Math.random() * 3);
    const decreaseIdx = (increaseIdx + 1) % 3;

    const increased = weightTypes[increaseIdx];
    const decreased = weightTypes[decreaseIdx];

    const changes = {
      [increased]: clamp((current[increased] ?? 0.33) + delta, 0.1, 0.7),
      [decreased]: clamp((current[decreased] ?? 0.33) - delta, 0.1, 0.7),
    };

    return {
      changes,
      description: `Adjusted ${increased} +${(delta * 100).toFixed(1)}%, ${decreased} ${(delta * 100).toFixed(1)}%`,
    };
  }

  private mutateCoChangeBoost(current: NonNullable<Variant['genotype']['retrievalParams']>): {
    changes: Variant['genotype']['retrievalParams'];
    description: string;
  } {
    const delta = (Math.random() - 0.5) * 0.4; // +/- 20%
    const newValue = clamp((current.coChangeBoost ?? 1.2) + delta, 1.0, 2.0);

    return {
      changes: { coChangeBoost: newValue },
      description: `Adjusted coChangeBoost to ${newValue.toFixed(2)}`,
    };
  }

  private mutateRerankerThreshold(current: NonNullable<Variant['genotype']['retrievalParams']>): {
    changes: Variant['genotype']['retrievalParams'];
    description: string;
  } {
    const delta = (Math.random() - 0.5) * 0.2;
    const newValue = clamp((current.rerankerThreshold ?? 0.5) + delta, 0.3, 0.8);

    return {
      changes: { rerankerThreshold: newValue },
      description: `Adjusted rerankerThreshold to ${newValue.toFixed(2)}`,
    };
  }

  private mutateGraphDepth(current: NonNullable<Variant['genotype']['retrievalParams']>): {
    changes: Variant['genotype']['retrievalParams'];
    description: string;
  } {
    const currentDepth = current.graphExpansionDepth ?? 2;
    const delta = Math.random() > 0.5 ? 1 : -1;
    const newValue = Math.max(1, Math.min(4, currentDepth + delta));

    return {
      changes: { graphExpansionDepth: newValue },
      description: `Adjusted graphExpansionDepth to ${newValue}`,
    };
  }
}
