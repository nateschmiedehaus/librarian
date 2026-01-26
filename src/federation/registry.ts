/**
 * @fileoverview Federation Registry
 *
 * Manages registration and discovery of federated repositories.
 * Provides safe access control and provenance tracking.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import type {
  RepoId,
  FederatedRepo,
  FederationConfig,
  FederatedProvenance,
} from './types.js';
import { DEFAULT_FEDERATION_CONFIG } from './types.js';

// ============================================================================
// FEDERATION REGISTRY
// ============================================================================

/**
 * Registry for managing federated repositories.
 */
export class FederationRegistry {
  private repos: Map<RepoId, FederatedRepo> = new Map();
  private config: FederationConfig;
  private statePath: string;
  private initialized: boolean = false;

  constructor(config: Partial<FederationConfig> = {}) {
    this.config = { ...DEFAULT_FEDERATION_CONFIG, ...config };
    this.statePath = this.config.statePath;
  }

  /**
   * Initialize the registry, loading state from disk if available.
   */
  async initialize(workspaceRoot: string): Promise<void> {
    if (this.initialized) return;

    const fullStatePath = path.join(workspaceRoot, this.statePath);
    try {
      const data = await fs.readFile(fullStatePath, 'utf8');
      const state = JSON.parse(data);
      if (state.repos && Array.isArray(state.repos)) {
        for (const repo of state.repos) {
          if (isValidFederatedRepo(repo)) {
            this.repos.set(repo.repoId, repo);
          }
        }
      }
    } catch {
      // No existing state, start fresh
    }

    this.initialized = true;
  }

  /**
   * Register a repository in the federation.
   */
  async registerRepo(options: {
    workspacePath: string;
    name?: string;
    remoteUrl?: string;
    trustLevel?: 'local' | 'trusted' | 'untrusted';
    tags?: string[];
  }): Promise<FederatedRepo> {
    const repoId = generateRepoId(options.workspacePath, options.remoteUrl);

    // Check if already registered
    const existing = this.repos.get(repoId);
    if (existing) {
      // Update existing registration
      const updated: FederatedRepo = {
        ...existing,
        name: options.name ?? existing.name,
        remoteUrl: options.remoteUrl ?? existing.remoteUrl,
        trustLevel: options.trustLevel ?? existing.trustLevel,
        tags: options.tags ?? existing.tags,
        available: true,
        lastIndexedAt: new Date().toISOString(),
      };
      this.repos.set(repoId, updated);
      return updated;
    }

    // Create new registration
    const repo: FederatedRepo = {
      repoId,
      name: options.name ?? path.basename(options.workspacePath),
      workspacePath: path.resolve(options.workspacePath),
      remoteUrl: options.remoteUrl,
      currentCommit: await getCurrentCommit(options.workspacePath),
      lastIndexedAt: new Date().toISOString(),
      available: true,
      trustLevel: options.trustLevel ?? 'untrusted',
      tags: options.tags,
    };

    this.repos.set(repoId, repo);
    return repo;
  }

  /**
   * Unregister a repository from the federation.
   */
  unregisterRepo(repoId: RepoId): boolean {
    return this.repos.delete(repoId);
  }

  /**
   * Get a registered repository by ID.
   */
  getRepo(repoId: RepoId): FederatedRepo | undefined {
    return this.repos.get(repoId);
  }

  /**
   * Get all registered repositories.
   */
  getAllRepos(): FederatedRepo[] {
    return Array.from(this.repos.values());
  }

  /**
   * Get repositories matching a filter.
   */
  getRepos(filter: {
    available?: boolean;
    trustLevel?: 'local' | 'trusted' | 'untrusted';
    tags?: string[];
    excludeIds?: RepoId[];
  }): FederatedRepo[] {
    let results = Array.from(this.repos.values());

    if (filter.available !== undefined) {
      results = results.filter((r) => r.available === filter.available);
    }

    if (filter.trustLevel) {
      const trustOrder = { local: 2, trusted: 1, untrusted: 0 };
      const minTrust = trustOrder[filter.trustLevel];
      results = results.filter((r) => trustOrder[r.trustLevel] >= minTrust);
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((r) =>
        filter.tags!.some((tag) => r.tags?.includes(tag))
      );
    }

    if (filter.excludeIds && filter.excludeIds.length > 0) {
      const excludeSet = new Set(filter.excludeIds);
      results = results.filter((r) => !excludeSet.has(r.repoId));
    }

    return results;
  }

  /**
   * Mark a repository as unavailable.
   */
  markUnavailable(repoId: RepoId): void {
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.available = false;
    }
  }

  /**
   * Mark a repository as available.
   */
  markAvailable(repoId: RepoId): void {
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.available = true;
    }
  }

  /**
   * Create provenance for an entity from a repository.
   */
  createProvenance(repoId: RepoId, relativePath: string): FederatedProvenance | null {
    const repo = this.repos.get(repoId);
    if (!repo) return null;

    return {
      repoId: repo.repoId,
      repoName: repo.name,
      commitHash: repo.currentCommit,
      verifiedAt: new Date().toISOString(),
      relativePath,
      trustLevel: repo.trustLevel,
    };
  }

  /**
   * Generate a global federated ID for an entity.
   */
  createFederatedId(repoId: RepoId, entityId: string): string {
    return `${repoId}:${entityId}`;
  }

  /**
   * Parse a federated ID into repo and entity IDs.
   */
  parseFederatedId(federatedId: string): { repoId: RepoId; entityId: string } | null {
    const firstColon = federatedId.indexOf(':');
    if (firstColon === -1) return null;
    return {
      repoId: federatedId.slice(0, firstColon),
      entityId: federatedId.slice(firstColon + 1),
    };
  }

  /**
   * Save registry state to disk.
   */
  async saveState(workspaceRoot: string): Promise<void> {
    const fullStatePath = path.join(workspaceRoot, this.statePath);
    await fs.mkdir(path.dirname(fullStatePath), { recursive: true });

    const state = {
      version: 1,
      savedAt: new Date().toISOString(),
      repos: Array.from(this.repos.values()),
    };

    await fs.writeFile(fullStatePath, JSON.stringify(state, null, 2));
  }

  /**
   * Get registry statistics.
   */
  getStats(): {
    totalRepos: number;
    availableRepos: number;
    byTrustLevel: Record<string, number>;
  } {
    const repos = Array.from(this.repos.values());
    const byTrustLevel: Record<string, number> = {
      local: 0,
      trusted: 0,
      untrusted: 0,
    };

    for (const repo of repos) {
      byTrustLevel[repo.trustLevel] = (byTrustLevel[repo.trustLevel] ?? 0) + 1;
    }

    return {
      totalRepos: repos.length,
      availableRepos: repos.filter((r) => r.available).length,
      byTrustLevel,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a stable repo ID from workspace path and remote URL.
 */
function generateRepoId(workspacePath: string, remoteUrl?: string): RepoId {
  // Prefer remote URL for stable identification across machines
  if (remoteUrl) {
    const normalized = normalizeRemoteUrl(remoteUrl);
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  // Fall back to workspace path
  const normalizedPath = path.resolve(workspacePath).toLowerCase();
  return createHash('sha256').update(normalizedPath).digest('hex').slice(0, 16);
}

/**
 * Normalize a git remote URL for comparison.
 */
function normalizeRemoteUrl(url: string): string {
  // Remove .git suffix
  let normalized = url.replace(/\.git$/, '');

  // Convert SSH to HTTPS-like format for comparison
  // git@github.com:user/repo -> github.com/user/repo
  normalized = normalized.replace(/^git@([^:]+):/, '$1/');

  // Remove protocol prefix
  normalized = normalized.replace(/^https?:\/\//, '');

  return normalized.toLowerCase();
}

/**
 * Get current git commit hash for a workspace.
 */
async function getCurrentCommit(workspacePath: string): Promise<string | undefined> {
  try {
    const headPath = path.join(workspacePath, '.git', 'HEAD');
    const head = await fs.readFile(headPath, 'utf8');

    if (head.startsWith('ref: ')) {
      // HEAD is a ref, read the actual commit
      const refPath = head.slice(5).trim();
      const refFullPath = path.join(workspacePath, '.git', refPath);
      const commit = await fs.readFile(refFullPath, 'utf8');
      return commit.trim();
    }

    // HEAD is a direct commit hash
    return head.trim();
  } catch {
    return undefined;
  }
}

/**
 * Type guard for FederatedRepo.
 */
function isValidFederatedRepo(value: unknown): value is FederatedRepo {
  if (!value || typeof value !== 'object') return false;
  const repo = value as Record<string, unknown>;
  return (
    typeof repo.repoId === 'string' &&
    typeof repo.name === 'string' &&
    typeof repo.workspacePath === 'string' &&
    typeof repo.lastIndexedAt === 'string' &&
    typeof repo.available === 'boolean' &&
    ['local', 'trusted', 'untrusted'].includes(repo.trustLevel as string)
  );
}
