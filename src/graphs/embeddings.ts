import type { GraphMetricsEntry } from './metrics.js';
import { emptyArray } from '../api/empty_values.js';
import { clamp01 } from '../utils/math.js';

export interface GraphEmbeddingNeighbor { entityId: string; similarity: number; }
export interface GraphEmbeddingOptions { limit?: number; minSimilarity?: number; }

export function buildMetricEmbeddings(entries: GraphMetricsEntry[]): Map<string, Float32Array> {
  const embeddings = new Map<string, Float32Array>();
  if (!entries.length) return embeddings;
  let maxPagerank = 0; let maxBetweenness = 0; let maxCloseness = 0; let maxEigenvector = 0; let maxCommunity = 0;
  for (const entry of entries) {
    if (entry.pagerank > maxPagerank) maxPagerank = entry.pagerank;
    if (entry.betweenness > maxBetweenness) maxBetweenness = entry.betweenness;
    if (entry.closeness > maxCloseness) maxCloseness = entry.closeness;
    if (entry.eigenvector > maxEigenvector) maxEigenvector = entry.eigenvector;
    if (entry.communityId > maxCommunity) maxCommunity = entry.communityId;
  }
  for (const entry of entries) {
    const vector = new Float32Array([
      normalizeMetric(entry.pagerank, maxPagerank),
      normalizeMetric(entry.betweenness, maxBetweenness),
      normalizeMetric(entry.closeness, maxCloseness),
      normalizeMetric(entry.eigenvector, maxEigenvector),
      maxCommunity > 0 ? clamp01(entry.communityId / maxCommunity) : 0,
      entry.isBridge ? 1 : 0,
    ]);
    embeddings.set(entry.entityId, vector);
  }
  return embeddings;
}

export function findGraphNeighbors(targetId: string, embeddings: Map<string, Float32Array>, options: GraphEmbeddingOptions = {}): GraphEmbeddingNeighbor[] {
  const target = embeddings.get(targetId); if (!target) return emptyArray<GraphEmbeddingNeighbor>();
  const limit = Math.max(1, options.limit ?? 5); const minSimilarity = options.minSimilarity ?? 0.5;
  const neighbors: GraphEmbeddingNeighbor[] = [];
  for (const [entityId, vector] of embeddings) {
    if (entityId === targetId) continue;
    const similarity = cosineSimilarity(target, vector);
    if (similarity >= minSimilarity) neighbors.push({ entityId, similarity });
  }
  neighbors.sort((a, b) => b.similarity - a.similarity);
  return neighbors.slice(0, limit);
}

function normalizeMetric(value: number, max: number): number { if (!Number.isFinite(value) || max <= 0) return 0; return clamp01(value / max); }
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0; let normA = 0; let normB = 0;
  for (let i = 0; i < a.length; i += 1) { const av = a[i] ?? 0; const bv = b[i] ?? 0; dot += av * bv; normA += av * av; normB += bv * bv; }
  if (normA === 0 || normB === 0) return 0; return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
