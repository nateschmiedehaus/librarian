type Graph = Map<string, Set<string>>;

export function computeBetweennessCentrality(graph: Graph): Map<string, number> {
  const nodes = Array.from(collectNodes(graph));
  const centrality = new Map(nodes.map((node) => [node, 0]));

  for (const source of nodes) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();

    for (const node of nodes) {
      predecessors.set(node, []);
      sigma.set(node, 0);
      dist.set(node, -1);
    }
    sigma.set(source, 1);
    dist.set(source, 0);

    const queue: string[] = [source];
    while (queue.length > 0) {
      const v = queue.shift() as string;
      stack.push(v);
      for (const w of graph.get(v) ?? []) {
        if (dist.get(w) === -1) {
          queue.push(w);
          dist.set(w, (dist.get(v) ?? 0) + 1);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          predecessors.get(w)?.push(v);
        }
      }
    }

    const delta = new Map<string, number>();
    for (const node of nodes) delta.set(node, 0);

    while (stack.length > 0) {
      const w = stack.pop() as string;
      for (const v of predecessors.get(w) ?? []) {
        const contribution = ((sigma.get(v) ?? 0) / (sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + contribution);
      }
      if (w !== source) {
        centrality.set(w, (centrality.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  const n = nodes.length;
  if (n > 2) {
    const norm = 2 / ((n - 1) * (n - 2));
    for (const [node, value] of centrality) {
      centrality.set(node, value * norm);
    }
  }

  return centrality;
}

export function computeClosenessCentrality(graph: Graph): Map<string, number> {
  const nodes = Array.from(collectNodes(graph)); const closeness = new Map(nodes.map((n) => [n, 0]));
  for (const node of nodes) {
    const distances = bfsDistances(graph, node); let sum = 0; let reachable = 0;
    for (const [target, dist] of distances) { if (target === node) continue; if (dist > 0) { sum += dist; reachable += 1; } }
    closeness.set(node, sum > 0 ? reachable / sum : 0);
  }
  return closeness;
}

export function computeEigenvectorCentrality(graph: Graph, maxIterations = 100, tolerance = 1e-6): Map<string, number> {
  const nodes = Array.from(collectNodes(graph)); const n = nodes.length; if (!n) return new Map();
  const seed = 1 / Math.sqrt(n); const values = new Map(nodes.map((node) => [node, seed])); const undirected = toUndirected(graph);
  for (let iter = 0; iter < maxIterations; iter += 1) {
    const next = new Map<string, number>(); let norm = 0;
    for (const node of nodes) {
      let sum = 0; for (const neighbor of undirected.get(node) ?? []) sum += values.get(neighbor) ?? 0;
      next.set(node, sum); norm += sum * sum;
    }
    norm = Math.sqrt(norm) || 1; let delta = 0;
    for (const node of nodes) {
      const value = (next.get(node) ?? 0) / norm; delta += Math.abs(value - (values.get(node) ?? 0)); values.set(node, value);
    }
    if (delta < tolerance) break;
  }
  return values;
}

function bfsDistances(graph: Graph, start: string): Map<string, number> {
  const distances = new Map<string, number>(); const queue: string[] = [start]; distances.set(start, 0);
  while (queue.length) {
    const node = queue.shift() as string; const nextDist = (distances.get(node) ?? 0) + 1;
    for (const neighbor of graph.get(node) ?? []) {
      if (!distances.has(neighbor)) { distances.set(neighbor, nextDist); queue.push(neighbor); }
    }
  }
  return distances;
}

function collectNodes(graph: Graph): Set<string> {
  const nodes = new Set<string>(); for (const [node, neighbors] of graph) { nodes.add(node); for (const neighbor of neighbors) nodes.add(neighbor); }
  return nodes;
}

function toUndirected(graph: Graph): Graph {
  const undirected: Graph = new Map();
  for (const node of collectNodes(graph)) undirected.set(node, new Set());
  for (const [node, neighbors] of graph) {
    const set = undirected.get(node) as Set<string>;
    for (const neighbor of neighbors) { set.add(neighbor); (undirected.get(neighbor) as Set<string>).add(node); }
  }
  return undirected;
}
