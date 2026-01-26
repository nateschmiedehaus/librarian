export interface PageRankOptions {
  dampingFactor?: number;
  convergenceThreshold?: number;
  maxIterations?: number;
  damping?: number;
  tolerance?: number;
}

type Graph = Map<string, Set<string>>;

export function computePageRank(graph: Graph, options: PageRankOptions = {}): Map<string, number> {
  const normalized = normalizeGraph(graph);
  const nodes = Array.from(normalized.keys());
  const n = nodes.length;
  if (n === 0) return new Map();

  const dampingFactor = options.dampingFactor ?? options.damping ?? 0.85;
  const convergenceThreshold = options.convergenceThreshold ?? options.tolerance ?? 1e-6;
  const maxIterations = options.maxIterations ?? 100;

  let scores = new Map<string, number>();
  let prevScores = new Map<string, number>();
  for (const node of nodes) {
    scores.set(node, 1 / n);
  }

  for (let iter = 0; iter < maxIterations; iter += 1) {
    prevScores = new Map(scores);

    for (const node of nodes) {
      let sum = 0;
      for (const [source, targets] of normalized.entries()) {
        if (targets.size === 0) continue;
        if (targets.has(node)) {
          sum += (prevScores.get(source) ?? 0) / targets.size;
        }
      }
      scores.set(node, (1 - dampingFactor) / n + dampingFactor * sum);
    }

    let delta = 0;
    for (const node of nodes) {
      delta += Math.abs((scores.get(node) ?? 0) - (prevScores.get(node) ?? 0));
    }
    if (delta < convergenceThreshold) break;
  }

  return scores;
}

function normalizeGraph(graph: Graph): Graph {
  const normalized: Graph = new Map();
  for (const [node, neighbors] of graph) {
    if (!normalized.has(node)) normalized.set(node, new Set());
    for (const neighbor of neighbors) {
      if (!normalized.has(neighbor)) normalized.set(neighbor, new Set());
      if (neighbor !== node) {
        (normalized.get(node) as Set<string>).add(neighbor);
      }
    }
  }
  return normalized;
}
