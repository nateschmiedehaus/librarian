/**
 * @fileoverview Federation Module Tests
 *
 * Tests for cross-repo federation protocol.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import {
  FederationRegistry,
  FederatedQueryExecutor,
  type FederatedQuery,
  type RepoQueryExecutor,
} from '../federation/index.js';

// ============================================================================
// TEST DATA
// ============================================================================

interface MockEntity {
  id: string;
  name: string;
  score: number;
}

// ============================================================================
// TESTS
// ============================================================================

describe('FederationRegistry', () => {
  let registry: FederationRegistry;

  beforeEach(() => {
    registry = new FederationRegistry();
  });

  describe('registerRepo', () => {
    it('should register a repository with generated ID', async () => {
      const repo = await registry.registerRepo({
        workspacePath: '/tmp/test-repo',
        name: 'Test Repo',
        trustLevel: 'trusted',
      });

      expect(repo.repoId).toBeDefined();
      expect(repo.repoId.length).toBe(16);
      expect(repo.name).toBe('Test Repo');
      expect(repo.trustLevel).toBe('trusted');
      expect(repo.available).toBe(true);
    });

    it('should generate stable ID from remote URL', async () => {
      const repo1 = await registry.registerRepo({
        workspacePath: '/tmp/repo-a',
        remoteUrl: 'https://github.com/user/repo.git',
      });

      const repo2 = await registry.registerRepo({
        workspacePath: '/tmp/repo-b',
        remoteUrl: 'git@github.com:user/repo.git',
      });

      // Same repo via different URL formats should get same ID
      expect(repo1.repoId).toBe(repo2.repoId);
    });

    it('should update existing registration', async () => {
      const repo1 = await registry.registerRepo({
        workspacePath: '/tmp/test-repo',
        name: 'Original Name',
        trustLevel: 'untrusted',
      });

      const repo2 = await registry.registerRepo({
        workspacePath: '/tmp/test-repo',
        name: 'Updated Name',
        trustLevel: 'trusted',
      });

      expect(repo1.repoId).toBe(repo2.repoId);
      expect(repo2.name).toBe('Updated Name');
      expect(repo2.trustLevel).toBe('trusted');

      // Only one repo in registry
      expect(registry.getAllRepos().length).toBe(1);
    });
  });

  describe('getRepos', () => {
    beforeEach(async () => {
      await registry.registerRepo({
        workspacePath: '/tmp/local-repo',
        name: 'Local',
        trustLevel: 'local',
        tags: ['core'],
      });

      await registry.registerRepo({
        workspacePath: '/tmp/trusted-repo',
        name: 'Trusted',
        trustLevel: 'trusted',
        tags: ['core', 'production'],
      });

      await registry.registerRepo({
        workspacePath: '/tmp/untrusted-repo',
        name: 'Untrusted',
        trustLevel: 'untrusted',
        tags: ['external'],
      });
    });

    it('should filter by trust level', () => {
      const trusted = registry.getRepos({ trustLevel: 'trusted' });
      expect(trusted.length).toBe(2); // local + trusted

      const local = registry.getRepos({ trustLevel: 'local' });
      expect(local.length).toBe(1);
    });

    it('should filter by tags', () => {
      const core = registry.getRepos({ tags: ['core'] });
      expect(core.length).toBe(2);

      const external = registry.getRepos({ tags: ['external'] });
      expect(external.length).toBe(1);
    });

    it('should exclude specific repos', () => {
      const all = registry.getAllRepos();
      const firstId = all[0].repoId;

      const filtered = registry.getRepos({ excludeIds: [firstId] });
      expect(filtered.length).toBe(2);
      expect(filtered.every((r) => r.repoId !== firstId)).toBe(true);
    });
  });

  describe('provenance', () => {
    it('should create provenance for registered repo', async () => {
      const repo = await registry.registerRepo({
        workspacePath: '/tmp/test-repo',
        name: 'Test',
        trustLevel: 'trusted',
      });

      const provenance = registry.createProvenance(repo.repoId, 'src/index.ts');

      expect(provenance).not.toBeNull();
      expect(provenance!.repoId).toBe(repo.repoId);
      expect(provenance!.repoName).toBe('Test');
      expect(provenance!.trustLevel).toBe('trusted');
      expect(provenance!.relativePath).toBe('src/index.ts');
    });

    it('should return null for unknown repo', () => {
      const provenance = registry.createProvenance('unknown-id', 'src/index.ts');
      expect(provenance).toBeNull();
    });
  });

  describe('federated IDs', () => {
    it('should create and parse federated IDs', async () => {
      const repo = await registry.registerRepo({
        workspacePath: '/tmp/test-repo',
      });

      const federatedId = registry.createFederatedId(repo.repoId, 'entity:123');
      expect(federatedId).toBe(`${repo.repoId}:entity:123`);

      const parsed = registry.parseFederatedId(federatedId);
      expect(parsed).not.toBeNull();
      expect(parsed!.repoId).toBe(repo.repoId);
      expect(parsed!.entityId).toBe('entity:123');
    });
  });

  describe('statistics', () => {
    it('should calculate registry stats', async () => {
      await registry.registerRepo({
        workspacePath: '/tmp/repo1',
        trustLevel: 'local',
      });

      await registry.registerRepo({
        workspacePath: '/tmp/repo2',
        trustLevel: 'trusted',
      });

      const repo3 = await registry.registerRepo({
        workspacePath: '/tmp/repo3',
        trustLevel: 'untrusted',
      });

      registry.markUnavailable(repo3.repoId);

      const stats = registry.getStats();

      expect(stats.totalRepos).toBe(3);
      expect(stats.availableRepos).toBe(2);
      expect(stats.byTrustLevel.local).toBe(1);
      expect(stats.byTrustLevel.trusted).toBe(1);
      expect(stats.byTrustLevel.untrusted).toBe(1);
    });
  });
});

describe('FederatedQueryExecutor', () => {
  let registry: FederationRegistry;
  let mockExecutor: RepoQueryExecutor<MockEntity>;

  beforeEach(async () => {
    registry = new FederationRegistry();

    // Register test repos
    await registry.registerRepo({
      workspacePath: '/tmp/repo-a',
      name: 'Repo A',
      trustLevel: 'trusted',
      tags: ['core'],
    });

    await registry.registerRepo({
      workspacePath: '/tmp/repo-b',
      name: 'Repo B',
      trustLevel: 'trusted',
      tags: ['core'],
    });

    // Create mock executor that returns different results per repo
    mockExecutor = async (repoId, workspacePath, query) => {
      if (repoId.includes('repo-a') || workspacePath.includes('repo-a')) {
        return [
          { id: 'a1', name: 'Entity A1', score: 0.9 },
          { id: 'a2', name: 'Entity A2', score: 0.7 },
        ];
      }
      return [
        { id: 'b1', name: 'Entity B1', score: 0.8 },
        { id: 'b2', name: 'Entity B2', score: 0.6 },
      ];
    };
  });

  describe('executeQuery', () => {
    it('should query all matching repos', async () => {
      const executor = new FederatedQueryExecutor(registry, mockExecutor);

      const query: FederatedQuery = {
        intent: 'Find entities',
        scope: { all: true },
        mergeStrategy: 'by_repo',
      };

      const response = await executor.executeQuery(query);

      expect(response.stats.reposQueried).toBe(2);
      expect(response.stats.reposSucceeded).toBe(2);
      expect(response.stats.totalResults).toBe(4);
      expect(response.repoResults.length).toBe(2);
    });

    it('should merge results with interleave strategy', async () => {
      const executor = new FederatedQueryExecutor(registry, mockExecutor);

      const query: FederatedQuery = {
        intent: 'Find entities',
        scope: { all: true },
        mergeStrategy: 'interleave',
      };

      const response = await executor.executeQuery(query);

      expect(response.merged).toBeDefined();
      expect(response.merged!.length).toBe(4);

      // Results should alternate between repos
      const repoIds = response.merged!.map((r) => r.provenance.repoName);
      expect(repoIds[0]).not.toBe(repoIds[1]);
    });

    it('should merge results with score ranking', async () => {
      const scorer = (entity: MockEntity) => entity.score;
      const executor = new FederatedQueryExecutor(registry, mockExecutor, { scorer });

      const query: FederatedQuery = {
        intent: 'Find entities',
        scope: { all: true },
        mergeStrategy: 'score_ranked',
      };

      const response = await executor.executeQuery(query);

      expect(response.merged).toBeDefined();
      expect(response.merged!.length).toBe(4);

      // Results should be sorted by score descending
      const scores = response.merged!.map((r) => r.entity.score);
      expect(scores).toEqual([0.9, 0.8, 0.7, 0.6]);
    });

    it('should respect maxResultsPerRepo', async () => {
      const executor = new FederatedQueryExecutor(registry, mockExecutor);

      const query: FederatedQuery = {
        intent: 'Find entities',
        scope: { all: true },
        maxResultsPerRepo: 1,
        mergeStrategy: 'by_repo',
      };

      const response = await executor.executeQuery(query);

      expect(response.stats.totalResults).toBe(2);
      response.repoResults.forEach((result) => {
        expect(result.results.length).toBe(1);
      });
    });

    it('should track provenance correctly', async () => {
      const executor = new FederatedQueryExecutor(registry, mockExecutor);

      const query: FederatedQuery = {
        intent: 'Find entities',
        scope: { all: true },
        mergeStrategy: 'by_repo',
      };

      const response = await executor.executeQuery(query);

      for (const repoResult of response.repoResults) {
        for (const entity of repoResult.results) {
          expect(entity.provenance).toBeDefined();
          expect(entity.provenance.repoId).toBe(repoResult.repoId);
          expect(entity.provenance.trustLevel).toBe('trusted');
          expect(entity.federatedId).toContain(repoResult.repoId);
        }
      }
    });

    it('should handle query failures gracefully', async () => {
      const failingExecutor: RepoQueryExecutor<MockEntity> = async (repoId, workspacePath) => {
        if (repoId.includes('repo-a') || workspacePath.includes('repo-a')) {
          throw new Error('Connection failed');
        }
        return [{ id: 'b1', name: 'Entity B1', score: 0.8 }];
      };

      const executor = new FederatedQueryExecutor(registry, failingExecutor);

      const query: FederatedQuery = {
        intent: 'Find entities',
        scope: { all: true },
        mergeStrategy: 'by_repo',
      };

      const response = await executor.executeQuery(query);

      expect(response.stats.reposQueried).toBe(2);
      expect(response.stats.reposSucceeded).toBe(1);
      expect(response.stats.reposFailed).toBe(1);

      const failed = response.repoResults.find((r) => !r.success);
      expect(failed).toBeDefined();
      expect(failed!.error).toContain('Connection failed');
    });

    it('should filter repos by tags', async () => {
      await registry.registerRepo({
        workspacePath: '/tmp/repo-c',
        name: 'Repo C',
        trustLevel: 'trusted',
        tags: ['external'],
      });

      const executor = new FederatedQueryExecutor(registry, mockExecutor);

      const query: FederatedQuery = {
        intent: 'Find entities',
        scope: { tags: ['core'] },
        mergeStrategy: 'by_repo',
      };

      const response = await executor.executeQuery(query);

      expect(response.stats.reposQueried).toBe(2);
      expect(response.repoResults.every((r) => r.repoName !== 'Repo C')).toBe(true);
    });
  });
});
