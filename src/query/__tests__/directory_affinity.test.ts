/**
 * @fileoverview Tests for Directory Affinity Signal
 *
 * Tests the DirectoryAffinitySignalComputer which boosts results from directories
 * matching query context. This addresses the problem of queries returning scattered
 * results from unrelated modules.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DirectoryAffinitySignalComputer,
  type QueryContext,
  type EntityData,
} from '../multi_signal_scorer.js';
import type { EntityId } from '../../core/contracts.js';

describe('DirectoryAffinitySignalComputer', () => {
  let computer: DirectoryAffinitySignalComputer;

  beforeEach(() => {
    computer = new DirectoryAffinitySignalComputer();
  });

  describe('detectDirectoryPatterns', () => {
    it('should detect CLI-related patterns', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'How do CLI commands work?'
      );
      expect(patterns).toContain('cli');
    });

    it('should detect storage-related patterns', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'Where is the storage layer implementation?'
      );
      expect(patterns).toContain('storage');
    });

    it('should detect API-related patterns', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'What are the API endpoints?'
      );
      expect(patterns).toContain('api');
    });

    it('should detect test-related patterns', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'Where are the tests for this module?'
      );
      expect(patterns).toContain('test');
    });

    it('should detect query-related patterns', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'How does query scoring work?'
      );
      expect(patterns).toContain('query');
    });

    it('should detect multiple patterns in a single query', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'CLI commands that interact with storage'
      );
      expect(patterns).toContain('cli');
      expect(patterns).toContain('storage');
    });

    it('should not duplicate canonical directories', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'CLI commands and command implementation'
      );
      // Both "cli" and "command" map to the same canonical "cli"
      const cliCount = patterns.filter(p => p === 'cli').length;
      expect(cliCount).toBe(1);
    });

    it('should detect explicit directory mentions', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'Look in the cli folder'
      );
      expect(patterns).toContain('cli');
    });

    it('should return empty array for generic queries', () => {
      const patterns = DirectoryAffinitySignalComputer.detectDirectoryPatterns(
        'What is this project about?'
      );
      expect(patterns).toEqual([]);
    });
  });

  describe('compute', () => {
    const createContext = (targetDirectories?: string[]): QueryContext => ({
      queryText: 'test query',
      queryTerms: ['test', 'query'],
      targetDirectories,
    });

    const createEntityData = (path?: string): EntityData => ({
      id: 'entity-1' as EntityId,
      type: 'function',
      path,
    });

    it('should return neutral score when no target directories', async () => {
      const context = createContext(undefined);
      const entity = createEntityData('src/cli/commands.ts');

      const result = await computer.compute(entity.id, context, entity);

      expect(result.signal).toBe('directory_affinity');
      expect(result.score).toBe(0.5);
      expect(result.confidence).toBe(0.2);
    });

    it('should return low score when entity has no path', async () => {
      const context = createContext(['cli']);
      const entity = createEntityData(undefined);

      const result = await computer.compute(entity.id, context, entity);

      expect(result.score).toBe(0.3);
      expect(result.confidence).toBe(0.3);
    });

    it('should boost score for matching directory', async () => {
      const context = createContext(['cli']);
      const entity = createEntityData('src/cli/commands.ts');

      const result = await computer.compute(entity.id, context, entity);

      expect(result.score).toBe(1.0);
      expect(result.confidence).toBe(0.85);
      expect(result.metadata?.matchedDirectories).toContain('cli');
    });

    it('should boost score for alias match', async () => {
      const context = createContext(['cli']);
      const entity = createEntityData('src/commands/bootstrap.ts');

      const result = await computer.compute(entity.id, context, entity);

      // 'commands' is an alias for 'cli'
      expect(result.score).toBeGreaterThanOrEqual(0.9);
      expect(result.confidence).toBe(0.85);
    });

    it('should penalize competing directory (CLI query, storage result)', async () => {
      const context = createContext(['cli']);
      const entity = createEntityData('src/storage/sqlite_storage.ts');

      const result = await computer.compute(entity.id, context, entity);

      expect(result.score).toBe(0.15); // Strong penalty
      expect(result.confidence).toBe(0.8);
      expect(result.metadata?.penalty).toBe('competing_area');
    });

    it('should mildly penalize unrelated directory', async () => {
      const context = createContext(['cli']);
      const entity = createEntityData('src/types.ts');

      const result = await computer.compute(entity.id, context, entity);

      expect(result.score).toBe(0.35);
      expect(result.confidence).toBe(0.6);
      expect(result.metadata?.penalty).toBe('no_match');
    });

    it('should handle multiple target directories', async () => {
      const context = createContext(['cli', 'storage']);
      const entity = createEntityData('src/cli/commands.ts');

      const result = await computer.compute(entity.id, context, entity);

      expect(result.score).toBe(1.0);
      expect(result.metadata?.matchedDirectories).toContain('cli');
    });

    it('should handle nested paths', async () => {
      const context = createContext(['test']);
      const entity = createEntityData('src/cli/__tests__/commands.test.ts');

      const result = await computer.compute(entity.id, context, entity);

      // '__tests__' matches 'test' pattern
      expect(result.score).toBeGreaterThanOrEqual(0.9);
    });

    it('should handle query module affinity', async () => {
      const context = createContext(['query']);
      const entity = createEntityData('src/query/scoring.ts');

      const result = await computer.compute(entity.id, context, entity);

      expect(result.score).toBe(1.0);
      expect(result.confidence).toBe(0.85);
    });

    it('should handle knowledge module affinity', async () => {
      const context = createContext(['knowledge']);
      const entity = createEntityData('src/knowledge/extractors/index.ts');

      const result = await computer.compute(entity.id, context, entity);

      expect(result.score).toBe(1.0);
    });
  });

  describe('real-world query scenarios', () => {
    it('should properly rank CLI query results', async () => {
      const context: QueryContext = {
        queryText: 'CLI commands',
        queryTerms: ['cli', 'commands'],
        targetDirectories: DirectoryAffinitySignalComputer.detectDirectoryPatterns('CLI commands'),
      };

      const cliEntity = createEntityData('src/cli/commands/bootstrap.ts');
      const storageEntity = createEntityData('src/storage/sqlite_storage.ts');
      const apiEntity = createEntityData('src/api/query.ts');

      const cliScore = await computer.compute(cliEntity.id, context, cliEntity);
      const storageScore = await computer.compute(storageEntity.id, context, storageEntity);
      const apiScore = await computer.compute(apiEntity.id, context, apiEntity);

      // CLI should score highest
      expect(cliScore.score).toBeGreaterThan(storageScore.score);
      expect(cliScore.score).toBeGreaterThan(apiScore.score);
      // Storage should have penalty for being in competing area
      expect(storageScore.score).toBeLessThan(0.5);
    });

    it('should properly rank storage query results', async () => {
      const context: QueryContext = {
        queryText: 'storage layer',
        queryTerms: ['storage', 'layer'],
        targetDirectories: DirectoryAffinitySignalComputer.detectDirectoryPatterns('storage layer'),
      };

      const storageEntity = createEntityData('src/storage/sqlite_storage.ts');
      const cliEntity = createEntityData('src/cli/commands/bootstrap.ts');

      const storageScore = await computer.compute(storageEntity.id, context, storageEntity);
      const cliScore = await computer.compute(cliEntity.id, context, cliEntity);

      // Storage should score highest
      expect(storageScore.score).toBeGreaterThan(cliScore.score);
    });

    it('should properly rank test query results', async () => {
      const context: QueryContext = {
        queryText: 'testing the query module',
        queryTerms: ['testing', 'query', 'module'],
        targetDirectories: DirectoryAffinitySignalComputer.detectDirectoryPatterns('testing the query module'),
      };

      const testEntity = createEntityData('src/query/__tests__/scoring.test.ts');
      const queryEntity = createEntityData('src/query/scoring.ts');
      const cliEntity = createEntityData('src/cli/commands.ts');

      const testScore = await computer.compute(testEntity.id, context, testEntity);
      const queryScore = await computer.compute(queryEntity.id, context, queryEntity);
      const cliScore = await computer.compute(cliEntity.id, context, cliEntity);

      // Both test and query directories are mentioned, so both should score high
      expect(testScore.score).toBeGreaterThanOrEqual(0.9);
      expect(queryScore.score).toBeGreaterThanOrEqual(0.9);
      // CLI should have penalty
      expect(cliScore.score).toBeLessThan(0.5);
    });
  });

  function createEntityData(path?: string): EntityData {
    return {
      id: `entity-${path?.replace(/[^a-z0-9]/gi, '-') || 'none'}` as EntityId,
      type: 'function',
      path,
    };
  }
});
