/**
 * @fileoverview Graph-Augmented Similarity
 *
 * Fixes the adversarial case problem by combining:
 * 1. Semantic similarity (embeddings)
 * 2. Structural proximity (import graph, call graph)
 * 3. Module distance (same module = related)
 *
 * KEY INSIGHT: Two files with high embedding similarity but
 * NO structural connection are likely FALSE POSITIVES.
 *
 * Example:
 *   storage/types.ts vs engines/types.ts
 *   - Embedding similarity: 0.56 (high - similar structure)
 *   - Graph proximity: 0.0 (no imports between them)
 *   - Module distance: 1.0 (completely different modules)
 *   → Final similarity: 0.56 * 0.0 * 0.5 = ~0.1 (correctly low)
 */

import {
  cosineSimilarity,
  type EmbeddingModelId,
} from './real_embeddings.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FileNode {
  filePath: string;
  moduleName: string;
  imports: string[];      // Files this imports
  importedBy: string[];   // Files that import this
  calls: string[];        // Functions this calls (from other files)
  calledBy: string[];     // Functions that call this
  embedding?: Float32Array;
}

export interface GraphAugmentedResult {
  filePath: string;
  semanticSimilarity: number;
  graphProximity: number;
  moduleAffinity: number;
  penaltyFactor: number;
  finalSimilarity: number;
  reasoning: string;
}

// ============================================================================
// GRAPH CONSTRUCTION
// ============================================================================

export class DependencyGraph {
  private nodes: Map<string, FileNode> = new Map();
  private importIndex: Map<string, Set<string>> = new Map(); // imported → importers

  addNode(node: FileNode): void {
    this.nodes.set(node.filePath, node);

    // Build reverse import index
    for (const imported of node.imports) {
      const normalizedImport = this.normalizeImport(imported, node.filePath);
      if (!this.importIndex.has(normalizedImport)) {
        this.importIndex.set(normalizedImport, new Set());
      }
      this.importIndex.get(normalizedImport)!.add(node.filePath);
    }
  }

  private normalizeImport(importPath: string, fromFile: string): string {
    // Convert relative import to absolute-ish path
    // './foo' from 'dir/bar.ts' → 'dir/foo'
    if (importPath.startsWith('./')) {
      const dir = fromFile.split('/').slice(0, -1).join('/');
      return `${dir}/${importPath.slice(2)}`.replace(/\.js$/, '');
    }
    if (importPath.startsWith('../')) {
      const parts = fromFile.split('/');
      parts.pop(); // remove filename
      let imp = importPath;
      while (imp.startsWith('../')) {
        parts.pop();
        imp = imp.slice(3);
      }
      return `${parts.join('/')}/${imp}`.replace(/\.js$/, '');
    }
    return importPath.replace(/\.js$/, '');
  }

  /**
   * Compute graph proximity between two files.
   *
   * Returns 1.0 if directly connected (import relationship)
   * Returns 0.5 if one step away (share a common import/importer)
   * Returns 0.2 if two steps away
   * Returns 0.0 if no connection
   */
  computeGraphProximity(fileA: string, fileB: string): number {
    const nodeA = this.nodes.get(fileA);
    const nodeB = this.nodes.get(fileB);

    if (!nodeA || !nodeB) return 0;

    // Direct import relationship?
    if (this.isDirectlyConnected(nodeA, nodeB)) {
      return 1.0;
    }

    // One step away (share common import or importer)?
    if (this.isOneStepAway(nodeA, nodeB)) {
      return 0.5;
    }

    // Two steps away?
    if (this.isTwoStepsAway(nodeA, nodeB)) {
      return 0.2;
    }

    // No connection
    return 0.0;
  }

  private isDirectlyConnected(nodeA: FileNode, nodeB: FileNode): boolean {
    // A imports B?
    for (const imp of nodeA.imports) {
      if (this.normalizeImport(imp, nodeA.filePath).includes(nodeB.filePath.replace(/\.ts$/, ''))) {
        return true;
      }
    }
    // B imports A?
    for (const imp of nodeB.imports) {
      if (this.normalizeImport(imp, nodeB.filePath).includes(nodeA.filePath.replace(/\.ts$/, ''))) {
        return true;
      }
    }
    return false;
  }

  private isOneStepAway(nodeA: FileNode, nodeB: FileNode): boolean {
    // Do A and B import the same file?
    const aImports = new Set(nodeA.imports.map(i => this.normalizeImport(i, nodeA.filePath)));
    const bImports = new Set(nodeB.imports.map(i => this.normalizeImport(i, nodeB.filePath)));

    for (const imp of aImports) {
      if (bImports.has(imp)) {
        return true;
      }
    }

    // Are A and B both imported by the same file?
    const aImporters = this.importIndex.get(nodeA.filePath.replace(/\.ts$/, '')) || new Set();
    const bImporters = this.importIndex.get(nodeB.filePath.replace(/\.ts$/, '')) || new Set();

    for (const importer of aImporters) {
      if (bImporters.has(importer)) {
        return true;
      }
    }

    return false;
  }

  private isTwoStepsAway(nodeA: FileNode, nodeB: FileNode): boolean {
    // Check if any file imported by A also imports B (or vice versa)
    for (const aImp of nodeA.imports) {
      const normalizedAImp = this.normalizeImport(aImp, nodeA.filePath);
      const midNode = this.findNodeByImport(normalizedAImp);
      if (midNode) {
        for (const midImp of midNode.imports) {
          if (this.normalizeImport(midImp, midNode.filePath).includes(nodeB.filePath.replace(/\.ts$/, ''))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private findNodeByImport(importPath: string): FileNode | undefined {
    for (const [path, node] of this.nodes) {
      if (path.replace(/\.ts$/, '').endsWith(importPath) || importPath.endsWith(path.replace(/\.ts$/, ''))) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Compute module affinity between two files.
   *
   * Returns 1.0 if same module (same directory)
   * Returns 0.5 if sibling modules (same parent)
   * Returns 0.0 if different module trees
   */
  computeModuleAffinity(fileA: string, fileB: string): number {
    const partsA = fileA.split('/');
    const partsB = fileB.split('/');

    // Same module (same directory)?
    const dirA = partsA.slice(0, -1).join('/');
    const dirB = partsB.slice(0, -1).join('/');

    if (dirA === dirB) {
      return 1.0;
    }

    // Sibling modules (same parent)?
    const parentA = partsA.slice(0, -2).join('/');
    const parentB = partsB.slice(0, -2).join('/');

    if (parentA === parentB && parentA !== '') {
      return 0.5;
    }

    // Different module trees
    return 0.0;
  }

  get size(): number {
    return this.nodes.size;
  }
}

// ============================================================================
// GRAPH-AUGMENTED SIMILARITY
// ============================================================================

/**
 * Compute graph-augmented similarity between two files.
 *
 * KEY INSIGHT: Apply heavy penalty for adversarial patterns.
 */
export function computeGraphAugmentedSimilarity(
  semanticSimilarity: number,
  graphProximity: number,
  moduleAffinity: number,
  options: {
    fileA?: string;
    fileB?: string;
    semanticWeight?: number;
    graphWeight?: number;
    moduleWeight?: number;
  } = {}
): GraphAugmentedResult {
  const {
    fileA = '',
    fileB = '',
    semanticWeight = 0.6,
    graphWeight = 0.25,
    moduleWeight = 0.15,
  } = options;

  // Detect adversarial patterns and apply penalty
  let penaltyFactor = 1.0;
  let reasoning = '';

  const nameA = fileA.split('/').pop() || '';
  const nameB = fileB.split('/').pop() || '';
  const dirA = fileA.split('/').slice(0, -1).join('/');
  const dirB = fileB.split('/').slice(0, -1).join('/');

  // PENALTY 1: Same filename, different directory (types.ts in storage vs engines)
  if (nameA === nameB && dirA !== dirB) {
    penaltyFactor = 0.3;
    reasoning = `Same filename "${nameA}" in different directories → heavily penalized`;
  }
  // PENALTY 2: Both are boilerplate files in different directories
  else if (['index.ts', 'types.ts', 'constants.ts'].includes(nameA) &&
           ['index.ts', 'types.ts', 'constants.ts'].includes(nameB) &&
           dirA !== dirB) {
    penaltyFactor = 0.4;
    reasoning = 'Boilerplate files in different modules → penalized';
  }
  // PENALTY 3: Same suffix pattern in different directories (xxx_indexer.ts)
  else if (nameA.includes('_indexer') && nameB.includes('_indexer') && dirA !== dirB) {
    penaltyFactor = 0.5;
    reasoning = 'Same indexer pattern in different directories → penalized';
  }
  // BOOST: Same module
  else if (moduleAffinity >= 1.0) {
    penaltyFactor = 1.2; // Slight boost
    reasoning = 'Same module → boosted';
  }
  // BOOST: Direct import connection
  else if (graphProximity >= 1.0) {
    penaltyFactor = 1.3;
    reasoning = 'Direct import relationship → boosted';
  }
  else {
    reasoning = 'No special pattern detected';
  }

  // Apply penalty to semantic similarity
  const adjustedSemantic = semanticSimilarity * penaltyFactor;

  // Final score combines adjusted semantic with structural signals
  const finalSimilarity = Math.min(1.0,
    adjustedSemantic * semanticWeight +
    graphProximity * graphWeight +
    moduleAffinity * moduleWeight
  );

  return {
    filePath: '',
    semanticSimilarity,
    graphProximity,
    moduleAffinity,
    penaltyFactor,
    finalSimilarity,
    reasoning,
  };
}

// ============================================================================
// ADVERSARIAL CASE DETECTOR
// ============================================================================

/**
 * Detect if two files are likely adversarial (similar structure, different purpose).
 *
 * Signals:
 * - Same filename, different directory
 * - Both are index.ts or types.ts (boilerplate files)
 * - High embedding similarity but no imports
 */
export function isLikelyAdversarial(
  fileA: string,
  fileB: string,
  semanticSimilarity: number,
  graphProximity: number
): { isAdversarial: boolean; reason: string } {
  const nameA = fileA.split('/').pop() || '';
  const nameB = fileB.split('/').pop() || '';
  const dirA = fileA.split('/').slice(0, -1).join('/');
  const dirB = fileB.split('/').slice(0, -1).join('/');

  // Same filename, different directory
  if (nameA === nameB && dirA !== dirB) {
    return {
      isAdversarial: true,
      reason: `Same filename "${nameA}" in different modules`,
    };
  }

  // Both are boilerplate files
  const boilerplateNames = ['index.ts', 'types.ts', 'constants.ts', 'utils.ts', 'helpers.ts'];
  if (boilerplateNames.includes(nameA) && boilerplateNames.includes(nameB) && dirA !== dirB) {
    return {
      isAdversarial: true,
      reason: 'Both are boilerplate files in different modules',
    };
  }

  // High semantic, no graph connection
  if (semanticSimilarity > 0.6 && graphProximity === 0) {
    return {
      isAdversarial: true,
      reason: 'High semantic similarity but no structural connection',
    };
  }

  return { isAdversarial: false, reason: '' };
}

// Already exported inline above
