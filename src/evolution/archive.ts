/**
 * @fileoverview MAP-Elites Style Archive for Quality-Diversity
 *
 * Maintains an archive of elite variants across behavior space.
 * Prevents collapse into local optima by preserving diversity.
 *
 * @packageDocumentation
 */

import type {
  ArchiveCell,
  ArchiveCellKey,
  ArchiveState,
  BehaviorDescriptors,
  Variant,
} from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// ARCHIVE IMPLEMENTATION
// ============================================================================

/**
 * MAP-Elites style archive for quality-diversity.
 */
export class EvolutionArchive {
  private cells: Map<ArchiveCellKey, ArchiveCell> = new Map();
  private totalEvaluations = 0;
  private totalImprovements = 0;
  private readonly maxSize: number;
  private readonly archivePath: string;

  constructor(options: { maxSize?: number; archivePath?: string } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.archivePath = options.archivePath ?? 'state/audits/evolution/archive.json';
  }

  // ==========================================================================
  // CELL KEY COMPUTATION
  // ==========================================================================

  /**
   * Compute archive cell key from behavior descriptors.
   */
  computeCellKey(descriptors: BehaviorDescriptors): ArchiveCellKey {
    return [
      descriptors.latencyBucket,
      descriptors.tokenCostBucket,
      descriptors.evidenceCompletenessBucket,
      descriptors.calibrationBucket,
      descriptors.retrievalStrategy,
      descriptors.providerReliance,
    ].join(':');
  }

  // ==========================================================================
  // ARCHIVE OPERATIONS
  // ==========================================================================

  /**
   * Attempt to add a variant to the archive.
   * Returns true if added or replaced existing elite.
   */
  tryAdd(variant: Variant, fitness: number, descriptors: BehaviorDescriptors): boolean {
    this.totalEvaluations++;

    const key = this.computeCellKey(descriptors);
    const existing = this.cells.get(key);

    // If cell is empty or new variant is better, update
    if (!existing || fitness > existing.fitness) {
      const cell: ArchiveCell = {
        key,
        descriptors,
        variant,
        fitness,
        addedAt: new Date().toISOString(),
        replacementCount: existing ? existing.replacementCount + 1 : 0,
      };

      this.cells.set(key, cell);
      this.totalImprovements++;

      // Enforce size limit
      this.enforceSizeLimit();

      return true;
    }

    return false;
  }

  /**
   * Get all cells in the archive.
   */
  getCells(): ArchiveCell[] {
    return Array.from(this.cells.values());
  }

  /**
   * Get the best variant across all cells.
   */
  getBestVariant(): Variant | null {
    let best: ArchiveCell | null = null;

    for (const cell of this.cells.values()) {
      if (!best || cell.fitness > best.fitness) {
        best = cell;
      }
    }

    return best?.variant ?? null;
  }

  /**
   * Get variants from diverse cells (for parent selection).
   */
  getDiverseParents(count: number): Variant[] {
    const cells = this.getCells();

    if (cells.length <= count) {
      return cells.map((c) => c.variant);
    }

    // Sample uniformly from archive
    const selected: Variant[] = [];
    const indices = new Set<number>();

    while (selected.length < count && indices.size < cells.length) {
      const idx = Math.floor(Math.random() * cells.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        selected.push(cells[idx].variant);
      }
    }

    return selected;
  }

  /**
   * Get cell coverage statistics.
   */
  getCoverageStats(): {
    totalCells: number;
    occupiedCells: number;
    coverageRatio: number;
    avgFitness: number;
    maxFitness: number;
  } {
    // Theoretical max cells (6 descriptors with varying cardinalities)
    const totalCells = 3 * 3 * 3 * 3 * 4 * 3; // ~324 possible cells
    const cells = this.getCells();
    const occupiedCells = cells.length;

    const fitnesses = cells.map((c) => c.fitness);
    const avgFitness = fitnesses.length > 0
      ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length
      : 0;
    const maxFitness = fitnesses.length > 0 ? Math.max(...fitnesses) : 0;

    return {
      totalCells,
      occupiedCells,
      coverageRatio: occupiedCells / totalCells,
      avgFitness,
      maxFitness,
    };
  }

  // ==========================================================================
  // SIZE MANAGEMENT
  // ==========================================================================

  private enforceSizeLimit(): void {
    if (this.cells.size <= this.maxSize) return;

    // Remove lowest fitness cells until under limit
    const sorted = Array.from(this.cells.entries())
      .sort((a, b) => a[1].fitness - b[1].fitness);

    while (this.cells.size > this.maxSize && sorted.length > 0) {
      const [key] = sorted.shift()!;
      this.cells.delete(key);
    }
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Save archive to disk.
   */
  async save(basePath?: string): Promise<void> {
    const filePath = basePath
      ? path.join(basePath, 'archive.json')
      : this.archivePath;

    const state: ArchiveState = {
      kind: 'EvolutionArchive.v1',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cells: this.getCells(),
      totalEvaluations: this.totalEvaluations,
      totalImprovements: this.totalImprovements,
    };

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  /**
   * Load archive from disk.
   */
  async load(basePath?: string): Promise<boolean> {
    const filePath = basePath
      ? path.join(basePath, 'archive.json')
      : this.archivePath;

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const state = JSON.parse(raw) as ArchiveState;

      if (state.kind !== 'EvolutionArchive.v1') {
        return false;
      }

      this.cells.clear();
      for (const cell of state.cells) {
        this.cells.set(cell.key, cell);
      }

      this.totalEvaluations = state.totalEvaluations;
      this.totalImprovements = state.totalImprovements;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear the archive.
   */
  clear(): void {
    this.cells.clear();
    this.totalEvaluations = 0;
    this.totalImprovements = 0;
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  get size(): number {
    return this.cells.size;
  }

  get evaluations(): number {
    return this.totalEvaluations;
  }

  get improvements(): number {
    return this.totalImprovements;
  }

  get improvementRate(): number {
    return this.totalEvaluations > 0
      ? this.totalImprovements / this.totalEvaluations
      : 0;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createArchive(
  options?: { maxSize?: number; archivePath?: string }
): EvolutionArchive {
  return new EvolutionArchive(options);
}
