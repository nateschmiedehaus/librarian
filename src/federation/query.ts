/**
 * @fileoverview Federated Query Executor
 *
 * Executes queries across multiple federated repositories with:
 * - Parallel execution with timeout handling
 * - Result merging and ranking
 * - Provenance tracking
 * - Safe boundaries (no data leakage)
 */

import { randomUUID } from 'crypto';
import type {
  RepoId,
  FederatedRepo,
  FederatedQuery,
  FederatedQueryResponse,
  FederatedRepoResult,
  FederatedEntity,
  FederatedRelationship,
  FederationScope,
  FederationConfig,
} from './types.js';
import { DEFAULT_FEDERATION_CONFIG } from './types.js';
import type { FederationRegistry } from './registry.js';
import { withTimeout } from '../utils/async.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Function to execute a query against a single repository.
 */
export type RepoQueryExecutor<T> = (
  repoId: RepoId,
  workspacePath: string,
  query: FederatedQuery
) => Promise<T[]>;

/**
 * Function to score/rank a result for merging.
 */
export type ResultScorer<T> = (entity: T, repoId: RepoId) => number;

// ============================================================================
// FEDERATED QUERY EXECUTOR
// ============================================================================

/**
 * Executes queries across federated repositories.
 */
export class FederatedQueryExecutor<T> {
  private registry: FederationRegistry;
  private config: FederationConfig;
  private queryExecutor: RepoQueryExecutor<T>;
  private scorer?: ResultScorer<T>;

  constructor(
    registry: FederationRegistry,
    queryExecutor: RepoQueryExecutor<T>,
    options?: {
      config?: Partial<FederationConfig>;
      scorer?: ResultScorer<T>;
    }
  ) {
    this.registry = registry;
    this.queryExecutor = queryExecutor;
    this.config = { ...DEFAULT_FEDERATION_CONFIG, ...options?.config };
    this.scorer = options?.scorer;
  }

  /**
   * Execute a federated query across all matching repositories.
   */
  async executeQuery(query: FederatedQuery): Promise<FederatedQueryResponse<T>> {
    const startTime = Date.now();
    const queryId = randomUUID();

    // Resolve which repos to query
    const repos = this.resolveScope(query.scope);
    if (repos.length === 0) {
      return this.createEmptyResponse(queryId, startTime);
    }

    // Execute queries in parallel with timeout
    const repoResults = await this.executeInParallel(repos, query);

    // Merge results if requested
    let merged: FederatedEntity<T>[] | undefined;
    if (query.mergeStrategy !== 'by_repo') {
      merged = this.mergeResults(repoResults, query);
    }

    // Find cross-repo relationships if requested
    let relationships: FederatedRelationship[] | undefined;
    if (query.includeRelationships) {
      relationships = this.findRelationships(repoResults);
    }

    return {
      queryId,
      timestamp: new Date().toISOString(),
      repoResults,
      merged,
      relationships,
      totalLatencyMs: Date.now() - startTime,
      stats: {
        reposQueried: repos.length,
        reposSucceeded: repoResults.filter((r) => r.success).length,
        reposFailed: repoResults.filter((r) => !r.success).length,
        totalResults: repoResults.reduce((sum, r) => sum + r.results.length, 0),
      },
    };
  }

  /**
   * Resolve which repositories match the query scope.
   */
  private resolveScope(scope: FederationScope): FederatedRepo[] {
    if (scope.all) {
      let repos = this.registry.getAllRepos();

      if (scope.minTrustLevel) {
        repos = this.registry.getRepos({ trustLevel: scope.minTrustLevel });
      }

      if (scope.excludeRepoIds?.length) {
        const excludeSet = new Set(scope.excludeRepoIds);
        repos = repos.filter((r) => !excludeSet.has(r.repoId));
      }

      return repos.filter((r) => r.available);
    }

    if (scope.repoIds?.length) {
      return scope.repoIds
        .map((id) => this.registry.getRepo(id))
        .filter((r): r is FederatedRepo => r !== undefined && r.available);
    }

    if (scope.tags?.length) {
      return this.registry.getRepos({
        available: true,
        tags: scope.tags,
        trustLevel: scope.minTrustLevel,
        excludeIds: scope.excludeRepoIds,
      });
    }

    return [];
  }

  /**
   * Execute queries against multiple repos in parallel.
   */
  private async executeInParallel(
    repos: FederatedRepo[],
    query: FederatedQuery
  ): Promise<FederatedRepoResult<T>[]> {
    // Limit parallel execution
    const chunks = chunkArray(repos, this.config.maxParallelRepos);
    const results: FederatedRepoResult<T>[] = [];

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((repo) => this.executeForRepo(repo, query))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Execute query for a single repository with timeout.
   */
  private async executeForRepo(
    repo: FederatedRepo,
    query: FederatedQuery
  ): Promise<FederatedRepoResult<T>> {
    const startTime = Date.now();

    try {
      // Execute with timeout
      const rawResults = await withTimeout(
        this.queryExecutor(repo.repoId, repo.workspacePath, query),
        this.config.repoTimeoutMs
      );

      // Limit results per repo
      const limitedResults = query.maxResultsPerRepo
        ? rawResults.slice(0, query.maxResultsPerRepo)
        : rawResults;

      // Wrap results with provenance
      const results: FederatedEntity<T>[] = limitedResults.map((entity, index) => ({
        entity,
        provenance: {
          repoId: repo.repoId,
          repoName: repo.name,
          commitHash: repo.currentCommit,
          verifiedAt: new Date().toISOString(),
          relativePath: '', // Would be filled by entity-specific logic
          trustLevel: repo.trustLevel,
        },
        federatedId: `${repo.repoId}:entity:${index}`,
      }));

      return {
        repoId: repo.repoId,
        repoName: repo.name,
        results,
        latencyMs: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      // Mark repo as unavailable on failure
      this.registry.markUnavailable(repo.repoId);

      return {
        repoId: repo.repoId,
        repoName: repo.name,
        results: [],
        latencyMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Merge results from multiple repositories.
   */
  private mergeResults(
    repoResults: FederatedRepoResult<T>[],
    query: FederatedQuery
  ): FederatedEntity<T>[] {
    const allResults = repoResults.flatMap((r) => r.results);

    if (query.mergeStrategy === 'interleave') {
      return this.interleaveResults(repoResults);
    }

    if (query.mergeStrategy === 'score_ranked' && this.scorer) {
      return this.scoreRankResults(allResults);
    }

    // Default: just concatenate
    const limited = query.maxTotalResults
      ? allResults.slice(0, query.maxTotalResults)
      : allResults;

    return limited;
  }

  /**
   * Interleave results from different repos (round-robin).
   */
  private interleaveResults(
    repoResults: FederatedRepoResult<T>[]
  ): FederatedEntity<T>[] {
    const merged: FederatedEntity<T>[] = [];
    const iterators = repoResults.map((r) => r.results[Symbol.iterator]());
    let hasMore = true;

    while (hasMore) {
      hasMore = false;
      for (const iter of iterators) {
        const next = iter.next();
        if (!next.done) {
          merged.push(next.value);
          hasMore = true;
        }
      }
    }

    return merged;
  }

  /**
   * Rank results by score across all repos.
   */
  private scoreRankResults(results: FederatedEntity<T>[]): FederatedEntity<T>[] {
    if (!this.scorer) return results;

    const scored = results.map((r) => ({
      result: r,
      score: this.scorer!(r.entity, r.provenance.repoId),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.map((s) => s.result);
  }

  /**
   * Find cross-repo relationships between results.
   */
  private findRelationships(
    repoResults: FederatedRepoResult<T>[]
  ): FederatedRelationship[] {
    // Placeholder for relationship detection
    // In a full implementation, this would:
    // 1. Extract identifiers from each result
    // 2. Look for cross-repo dependencies
    // 3. Calculate similarity scores
    return [];
  }

  /**
   * Create an empty response for no matching repos.
   */
  private createEmptyResponse(
    queryId: string,
    startTime: number
  ): FederatedQueryResponse<T> {
    return {
      queryId,
      timestamp: new Date().toISOString(),
      repoResults: [],
      totalLatencyMs: Date.now() - startTime,
      stats: {
        reposQueried: 0,
        reposSucceeded: 0,
        reposFailed: 0,
        totalResults: 0,
      },
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Split array into chunks.
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
