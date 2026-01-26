type Graph = Map<string, Set<string>>;

export interface CommunityDetectionOptions {
  maxIterations?: number;
  maxLevels?: number;
}

export function detectCommunities(graph: Graph, options: CommunityDetectionOptions = {}): Map<string, number> {
  const normalized = normalizeGraph(graph);
  if (normalized.size === 0) return new Map();

  let currentGraph = normalized;
  let members = initMembers(currentGraph);
  let assignments = new Map<string, number>();

  const maxIterations = options.maxIterations ?? 20;
  const maxLevels = options.maxLevels ?? 10;

  for (let level = 0; level < maxLevels; level += 1) {
    const partition = initPartition(currentGraph);
    const { partition: movedPartition, moved } = localMovingPhase(currentGraph, partition, maxIterations);
    const refined = refinePartition(currentGraph, movedPartition);
    assignments = mapAssignments(members, refined);
    const aggregated = aggregateGraph(currentGraph, members, refined);

    if (!moved || aggregated.graph.size === currentGraph.size) {
      break;
    }

    currentGraph = aggregated.graph;
    members = aggregated.members;
  }

  return compactAssignments(assignments);
}

function initMembers(graph: Graph): Map<string, Set<string>> {
  const members = new Map<string, Set<string>>();
  for (const node of graph.keys()) {
    members.set(node, new Set([node]));
  }
  return members;
}

function initPartition(graph: Graph): Map<string, number> {
  const nodes = Array.from(graph.keys()).sort();
  const partition = new Map<string, number>();
  nodes.forEach((node, idx) => {
    partition.set(node, idx);
  });
  return partition;
}

function localMovingPhase(
  graph: Graph,
  partition: Map<string, number>,
  maxIterations: number
): { partition: Map<string, number>; moved: boolean } {
  const nodes = Array.from(graph.keys()).sort();
  const degrees = computeDegrees(graph);
  const totalEdges = computeTotalEdges(degrees);
  if (totalEdges === 0) {
    return { partition, moved: false };
  }

  const communityDegree = new Map<number, number>();
  for (const [node, community] of partition) {
    const degree = degrees.get(node) ?? 0;
    communityDegree.set(community, (communityDegree.get(community) ?? 0) + degree);
  }

  let moved = false;
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let movedThisRound = false;
    for (const node of nodes) {
      const nodeCommunity = partition.get(node);
      if (nodeCommunity === undefined) continue;
      const nodeDegree = degrees.get(node) ?? 0;
      if (nodeDegree === 0) continue;

      const neighborCommunities = new Map<number, number>();
      for (const neighbor of graph.get(node) ?? []) {
        const community = partition.get(neighbor);
        if (community === undefined) continue;
        neighborCommunities.set(community, (neighborCommunities.get(community) ?? 0) + 1);
      }

      communityDegree.set(nodeCommunity, (communityDegree.get(nodeCommunity) ?? 0) - nodeDegree);

      let bestCommunity = nodeCommunity;
      let bestGain = 0;
      for (const [community, weight] of neighborCommunities) {
        const sumTot = communityDegree.get(community) ?? 0;
        const gain = modularityGain(nodeDegree, weight, sumTot, totalEdges);
        if (gain > bestGain + 1e-9) {
          bestGain = gain;
          bestCommunity = community;
        }
      }

      if (bestCommunity !== nodeCommunity) {
        partition.set(node, bestCommunity);
        moved = true;
        movedThisRound = true;
      }

      communityDegree.set(bestCommunity, (communityDegree.get(bestCommunity) ?? 0) + nodeDegree);
    }

    if (!movedThisRound) break;
  }

  return { partition, moved };
}

function modularityGain(nodeDegree: number, edgeWeightToCommunity: number, communityDegree: number, totalEdges: number): number {
  const m2 = 2 * totalEdges;
  return edgeWeightToCommunity - (nodeDegree * communityDegree) / m2;
}

function refinePartition(graph: Graph, partition: Map<string, number>): Map<string, number> {
  const communities = new Map<number, string[]>();
  for (const [node, community] of partition) {
    const list = communities.get(community) ?? [];
    list.push(node);
    communities.set(community, list);
  }

  let nextCommunityId = Math.max(0, ...communities.keys()) + 1;
  const refined = new Map(partition);

  for (const [communityId, nodes] of communities) {
    if (nodes.length <= 1) continue;
    const components = connectedComponents(graph, new Set(nodes));
    if (components.length <= 1) continue;
    components.forEach((component, index) => {
      const targetCommunity = index === 0 ? communityId : nextCommunityId++;
      for (const node of component) {
        refined.set(node, targetCommunity);
      }
    });
  }

  return refined;
}

function connectedComponents(graph: Graph, nodeSet: Set<string>): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const node of nodeSet) {
    if (seen.has(node)) continue;
    const queue = [node];
    const component: string[] = [];
    seen.add(node);
    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      component.push(current);
      for (const neighbor of graph.get(current) ?? []) {
        if (!nodeSet.has(neighbor) || seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

function aggregateGraph(
  graph: Graph,
  members: Map<string, Set<string>>,
  partition: Map<string, number>
): { graph: Graph; members: Map<string, Set<string>> } {
  const newMembers = new Map<string, Set<string>>();
  for (const [node, memberSet] of members) {
    const community = partition.get(node) ?? 0;
    const key = String(community);
    const combined = newMembers.get(key) ?? new Set<string>();
    for (const member of memberSet) combined.add(member);
    newMembers.set(key, combined);
  }

  const aggregated: Graph = new Map();
  for (const key of newMembers.keys()) aggregated.set(key, new Set());

  for (const [node, neighbors] of graph) {
    const sourceCommunity = String(partition.get(node) ?? 0);
    const sourceSet = aggregated.get(sourceCommunity);
    if (!sourceSet) continue;
    for (const neighbor of neighbors) {
      const targetCommunity = String(partition.get(neighbor) ?? 0);
      if (targetCommunity === sourceCommunity) continue;
      sourceSet.add(targetCommunity);
      const targetSet = aggregated.get(targetCommunity);
      if (targetSet) targetSet.add(sourceCommunity);
    }
  }

  return { graph: aggregated, members: newMembers };
}

function mapAssignments(
  members: Map<string, Set<string>>,
  partition: Map<string, number>
): Map<string, number> {
  const assignments = new Map<string, number>();
  for (const [node, memberSet] of members) {
    const community = partition.get(node) ?? 0;
    for (const member of memberSet) {
      assignments.set(member, community);
    }
  }
  return assignments;
}

function compactAssignments(assignments: Map<string, number>): Map<string, number> {
  if (assignments.size === 0) return assignments;
  const unique = Array.from(new Set(assignments.values())).sort((a, b) => a - b);
  const mapping = new Map<number, number>();
  unique.forEach((value, index) => {
    mapping.set(value, index);
  });
  const compacted = new Map<string, number>();
  for (const [node, community] of assignments) {
    compacted.set(node, mapping.get(community) ?? 0);
  }
  return compacted;
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

function computeDegrees(graph: Graph): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const [node, neighbors] of graph) {
    degrees.set(node, neighbors.size);
  }
  return degrees;
}

function computeTotalEdges(degrees: Map<string, number>): number {
  let total = 0;
  for (const value of degrees.values()) total += value;
  return total / 2;
}
