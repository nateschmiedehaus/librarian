/**
 * @fileoverview Tests for git query handling
 */

import { describe, it, expect } from 'vitest';
import { detectGitQuery, queryGitHistory, runGitQueryStage, createGitHistoryPack } from '../git_query.js';
import { LIBRARIAN_VERSION } from '../../index.js';

describe('detectGitQuery', () => {
  it('detects "recent changes to X" queries', () => {
    const result = detectGitQuery('recent changes to query.ts');
    expect(result.isGitQuery).toBe(true);
    expect(result.targetFile).toBe('query.ts');
    expect(result.queryType).toBe('recent_changes');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects "what was modified in X" queries', () => {
    const result = detectGitQuery('what was modified in storage module');
    expect(result.isGitQuery).toBe(true);
    expect(result.targetFile).toBe('storage');
    expect(result.queryType).toBe('modifications');
  });

  it('detects "git history of X" queries', () => {
    const result = detectGitQuery('git history of storage.ts');
    expect(result.isGitQuery).toBe(true);
    expect(result.targetFile).toBe('storage.ts');
    expect(result.queryType).toBe('file_history');
  });

  it('detects "commits to X" queries', () => {
    const result = detectGitQuery('commits to api/query.ts');
    expect(result.isGitQuery).toBe(true);
    expect(result.targetFile).toBe('api/query.ts');
    expect(result.queryType).toBe('commits');
  });

  it('detects general git queries without file target', () => {
    const result = detectGitQuery('recent changes');
    expect(result.isGitQuery).toBe(true);
    expect(result.targetFile).toBeUndefined();
    expect(result.queryType).toBe('recent_changes');
  });

  it('detects "latest commits" queries', () => {
    const result = detectGitQuery('show me the latest commits');
    expect(result.isGitQuery).toBe(true);
    expect(result.queryType).toBe('commits');
  });

  it('does NOT detect regular code queries', () => {
    const tests = [
      'show me the function runQuery',
      'list all classes',
      'what does the Storage interface do',
      'where is authentication implemented',
    ];

    for (const query of tests) {
      const result = detectGitQuery(query);
      expect(result.isGitQuery).toBe(false);
    }
  });

  it('handles trailing punctuation in file names', () => {
    const result = detectGitQuery('recent changes to query.ts?');
    expect(result.isGitQuery).toBe(true);
    expect(result.targetFile).toBe('query.ts');
  });

  it('detects "who changed X" queries', () => {
    const result = detectGitQuery('who changed the storage module');
    expect(result.isGitQuery).toBe(true);
    expect(result.queryType).toBe('file_history');
  });

  it('detects "when was X modified" queries', () => {
    const result = detectGitQuery('when was query.ts last updated');
    expect(result.isGitQuery).toBe(true);
    expect(result.targetFile).toBe('query.ts');
    expect(result.queryType).toBe('file_history');
  });
});

describe('queryGitHistory', () => {
  it('returns commits for the repository', () => {
    const result = queryGitHistory(process.cwd());
    expect(result.isGitRepo).toBe(true);
    expect(result.commits.length).toBeGreaterThan(0);
    expect(result.summary).toContain('commit');
  });

  it('returns commits for a specific file', () => {
    const result = queryGitHistory(process.cwd(), 'src/api/query.ts');
    expect(result.isGitRepo).toBe(true);
    expect(result.targetFile).toBe('src/api/query.ts');
    // Note: May have commits or not depending on file history
    expect(result.summary).toBeDefined();
  });

  it('handles non-existent files gracefully', () => {
    const result = queryGitHistory(process.cwd(), 'nonexistent-file.ts');
    expect(result.isGitRepo).toBe(true);
    expect(result.commits.length).toBe(0);
    expect(result.summary).toContain('No commits found');
  });

  it('respects the limit parameter', () => {
    const result = queryGitHistory(process.cwd(), undefined, 3);
    expect(result.commits.length).toBeLessThanOrEqual(3);
  });
});

describe('createGitHistoryPack', () => {
  it('creates a valid context pack from git results', () => {
    const gitResult = {
      commits: [
        { hash: 'abc123', shortHash: 'abc', author: 'Test User', date: '2024-01-01', message: 'Test commit' },
        { hash: 'def456', shortHash: 'def', author: 'Test User', date: '2024-01-02', message: 'Another commit' },
      ],
      summary: 'Found 2 commits',
      targetFile: 'query.ts',
      isGitRepo: true,
    };

    const pack = createGitHistoryPack(gitResult, LIBRARIAN_VERSION);

    expect(pack.packType).toBe('git_history');
    expect(pack.summary).toBe('Found 2 commits');
    expect(pack.keyFacts.length).toBeGreaterThan(0);
    expect(pack.confidence).toBe(0.95);
    expect(pack.relatedFiles).toContain('query.ts');
  });

  it('handles empty commit list', () => {
    const gitResult = {
      commits: [],
      summary: 'No commits found',
      targetFile: 'missing.ts',
      isGitRepo: true,
    };

    const pack = createGitHistoryPack(gitResult, LIBRARIAN_VERSION);

    expect(pack.packType).toBe('git_history');
    expect(pack.confidence).toBe(0.5);  // Lower confidence when no commits
  });
});

describe('runGitQueryStage', () => {
  it('short-circuits for high-confidence git queries with results', () => {
    const result = runGitQueryStage({
      intent: 'recent changes to src/api/query.ts',
      workspace: process.cwd(),
      version: LIBRARIAN_VERSION,
    });

    expect(result.isGitQuery).toBe(true);
    // Should short-circuit if we have results
    if (result.gitPacks.length > 0) {
      expect(result.shouldShortCircuit).toBe(true);
    }
    expect(result.explanation).toContain('Found');
  });

  it('does not short-circuit for non-git queries', () => {
    const result = runGitQueryStage({
      intent: 'show me the Storage interface',
      workspace: process.cwd(),
      version: LIBRARIAN_VERSION,
    });

    expect(result.isGitQuery).toBe(false);
    expect(result.shouldShortCircuit).toBe(false);
    expect(result.gitPacks.length).toBe(0);
  });

  it('includes git packs in results', () => {
    const result = runGitQueryStage({
      intent: 'git history of README.md',
      workspace: process.cwd(),
      version: LIBRARIAN_VERSION,
    });

    expect(result.isGitQuery).toBe(true);
    expect(result.gitPacks.length).toBe(1);
    expect(result.gitPacks[0].packType).toBe('git_history');
  });
});
