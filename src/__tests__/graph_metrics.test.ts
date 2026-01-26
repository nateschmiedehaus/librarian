import { describe, it, expect } from 'vitest';
import { computePageRank } from '../graphs/pagerank.js';
import { detectCommunities } from '../graphs/communities.js';
import { computeGraphMetrics } from '../graphs/metrics.js';
describe('graph metrics', () => {
  it('orders PageRank by inbound influence', () => {
    const ranks = computePageRank(new Map([['A', new Set(['B'])], ['B', new Set(['C'])], ['C', new Set(['B'])]]));
    expect(ranks.get('B') ?? 0).toBeGreaterThan(ranks.get('C') ?? 0); expect(ranks.get('C') ?? 0).toBeGreaterThan(ranks.get('A') ?? 0);
  });

  it('detects separate communities in disconnected graphs', () => {
    const communities = detectCommunities(new Map([['A', new Set(['B', 'C'])], ['B', new Set(['A', 'C'])], ['C', new Set(['A', 'B'])], ['D', new Set(['E', 'F'])], ['E', new Set(['D', 'F'])], ['F', new Set(['D', 'E'])]]));
    const first = communities.get('A');
    expect(first).toBeDefined(); expect(communities.get('B')).toBe(first); expect(communities.get('C')).toBe(first); expect(communities.get('D')).not.toBe(first);
  });
  it('emits a graph metrics report summary', () => {
    const { metrics, report } = computeGraphMetrics({ function: new Map([['A', new Set(['B'])], ['B', new Set(['C'])], ['C', new Set(['A'])]]) }, '2025-01-01T00:00:00.000Z');
    expect(metrics).toHaveLength(3); expect(report.kind).toBe('GraphMetricsReport.v1'); expect(report.totals.nodes).toBe(3); expect(report.totals.edges).toBe(3);
  });
});
