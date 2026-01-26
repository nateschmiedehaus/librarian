import type { SimilarityResult } from './types.js';

export type VectorIndexEntityType = 'function' | 'module';
export interface VectorIndexItem { entityId: string; entityType: VectorIndexEntityType; embedding: Float32Array; }

export class VectorIndex {
  private items: VectorIndexItem[] = [];
  private dimensions = new Set<number>();
  load(items: VectorIndexItem[]): void {
    this.items = items;
    this.dimensions = new Set(items.map((item) => item.embedding.length));
  }
  clear(): void { this.items = []; this.dimensions.clear(); }
  size(): number { return this.items.length; }
  hasDimension(length: number): boolean { return this.dimensions.has(length); }
  search(query: Float32Array, options: { limit: number; minSimilarity: number; entityTypes?: VectorIndexEntityType[] }): SimilarityResult[] {
    const results: SimilarityResult[] = []; const typeSet = options.entityTypes?.length ? new Set(options.entityTypes) : null;
    for (const item of this.items) {
      if (typeSet && !typeSet.has(item.entityType)) continue;
      if (item.embedding.length !== query.length) continue;
      const similarity = cosineSimilarity(query, item.embedding);
      if (similarity >= options.minSimilarity) results.push({ entityId: item.entityId, entityType: item.entityType, similarity });
    }
    results.sort((a, b) => b.similarity - a.similarity); return results.slice(0, options.limit);
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number { if (a.length !== b.length) return 0; let dot = 0; let normA = 0; let normB = 0; for (let i = 0; i < a.length; i += 1) { const av = a[i] ?? 0; const bv = b[i] ?? 0; dot += av * bv; normA += av * av; normB += bv * bv; } if (normA === 0 || normB === 0) return 0; return dot / (Math.sqrt(normA) * Math.sqrt(normB)); }
