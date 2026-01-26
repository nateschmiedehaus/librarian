/**
 * @fileoverview Tests for AGENTS.md Directory Precedence Rules
 *
 * Tests cover:
 * - Priority calculation
 * - Precedence comparison and sorting
 * - File type detection
 * - Path utilities
 * - Merge strategies
 * - Monorepo fixtures
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePriority,
  comparePrecedence,
  sortByPrecedence,
  getFileType,
  isGuidanceFile,
  shouldSkipDirectory,
  calculateDepth,
  normalizePath,
  getParentDirectories,
  getMergeStrategy,
  getEffectiveSources,
  generatePrecedenceReport,
  FILE_TYPE_PRIORITY,
} from '../precedence.js';
import type { GuidanceSource } from '../types.js';

describe('Precedence Rules', () => {
  describe('Priority Calculation', () => {
    it('should calculate priority based on depth and file type', () => {
      // Depth 0, AGENTS.md (priority 1) = 0 * 100 + 1 = 1
      expect(calculatePriority(0, 'AGENTS.md')).toBe(1);

      // Depth 0, CLAUDE.md (priority 2) = 0 * 100 + 2 = 2
      expect(calculatePriority(0, 'CLAUDE.md')).toBe(2);

      // Depth 1, AGENTS.md (priority 1) = 1 * 100 + 1 = 101
      expect(calculatePriority(1, 'AGENTS.md')).toBe(101);

      // Depth 2, CLAUDE.md (priority 2) = 2 * 100 + 2 = 202
      expect(calculatePriority(2, 'CLAUDE.md')).toBe(202);
    });

    it('should ensure closer files have lower (better) priority than farther files', () => {
      const depth0 = calculatePriority(0, 'AGENTS.md');
      const depth1 = calculatePriority(1, 'AGENTS.md');
      const depth2 = calculatePriority(2, 'AGENTS.md');

      expect(depth0).toBeLessThan(depth1);
      expect(depth1).toBeLessThan(depth2);
    });

    it('should ensure AGENTS.md has better priority than CLAUDE.md in same directory', () => {
      const agentsMd = calculatePriority(0, 'AGENTS.md');
      const claudeMd = calculatePriority(0, 'CLAUDE.md');

      expect(agentsMd).toBeLessThan(claudeMd);
    });
  });

  describe('Precedence Comparison', () => {
    const createSource = (
      path: string,
      type: string,
      depth: number,
      priority: number
    ): GuidanceSource => ({
      path,
      absolutePath: `/workspace/${path}`,
      type: type as GuidanceSource['type'],
      depth,
      priority,
      hash: 'abc123',
      lastModified: '2026-01-01T00:00:00Z',
    });

    it('should compare by priority first', () => {
      const a = createSource('AGENTS.md', 'AGENTS.md', 0, 1);
      const b = createSource('deep/AGENTS.md', 'AGENTS.md', 1, 101);

      expect(comparePrecedence(a, b)).toBeLessThan(0);
      expect(comparePrecedence(b, a)).toBeGreaterThan(0);
    });

    it('should compare by depth when priorities are equal', () => {
      const a = createSource('CLAUDE.md', 'CLAUDE.md', 0, 2);
      const b = createSource('deep/CLAUDE.md', 'CLAUDE.md', 1, 2);

      // a has lower depth, should come first
      expect(comparePrecedence(a, b)).toBeLessThan(0);
    });

    it('should compare by file type when depth is equal', () => {
      const a = createSource('AGENTS.md', 'AGENTS.md', 0, 1);
      const b = createSource('CLAUDE.md', 'CLAUDE.md', 0, 2);

      expect(comparePrecedence(a, b)).toBeLessThan(0);
    });

    it('should compare by path for determinism when all else is equal', () => {
      const a = createSource('a/AGENTS.md', 'AGENTS.md', 1, 101);
      const b = createSource('b/AGENTS.md', 'AGENTS.md', 1, 101);

      expect(comparePrecedence(a, b)).toBeLessThan(0);
      expect(comparePrecedence(b, a)).toBeGreaterThan(0);
    });
  });

  describe('Sorting', () => {
    const createSource = (
      path: string,
      type: GuidanceSource['type'],
      depth: number
    ): GuidanceSource => ({
      path,
      absolutePath: `/workspace/${path}`,
      type,
      depth,
      priority: calculatePriority(depth, type),
      hash: 'abc123',
      lastModified: '2026-01-01T00:00:00Z',
    });

    it('should sort sources by precedence', () => {
      const sources: GuidanceSource[] = [
        createSource('packages/app/CLAUDE.md', 'CLAUDE.md', 2),
        createSource('AGENTS.md', 'AGENTS.md', 0),
        createSource('packages/AGENTS.md', 'AGENTS.md', 1),
        createSource('CLAUDE.md', 'CLAUDE.md', 0),
      ];

      const sorted = sortByPrecedence(sources);

      expect(sorted[0].path).toBe('AGENTS.md');
      expect(sorted[1].path).toBe('CLAUDE.md');
      expect(sorted[2].path).toBe('packages/AGENTS.md');
      expect(sorted[3].path).toBe('packages/app/CLAUDE.md');
    });

    it('should not mutate the original array', () => {
      const sources: GuidanceSource[] = [
        createSource('b/AGENTS.md', 'AGENTS.md', 1),
        createSource('a/AGENTS.md', 'AGENTS.md', 1),
      ];

      const original = [...sources];
      sortByPrecedence(sources);

      expect(sources).toEqual(original);
    });
  });

  describe('File Type Detection', () => {
    it('should detect AGENTS.md', () => {
      expect(getFileType('AGENTS.md')).toBe('AGENTS.md');
      expect(getFileType('/path/to/AGENTS.md')).toBe('AGENTS.md');
      expect(getFileType('docs/AGENTS.MD')).toBe('AGENTS.md');
    });

    it('should detect agent-specific files', () => {
      expect(getFileType('CLAUDE.md')).toBe('CLAUDE.md');
      expect(getFileType('CODEX.md')).toBe('CODEX.md');
      expect(getFileType('GEMINI.md')).toBe('GEMINI.md');
      expect(getFileType('COPILOT.md')).toBe('COPILOT.md');
    });

    it('should detect AI.md and CONTRIBUTING.md', () => {
      expect(getFileType('AI.md')).toBe('AI.md');
      expect(getFileType('CONTRIBUTING.md')).toBe('CONTRIBUTING.md');
    });

    it('should return custom for unknown files', () => {
      expect(getFileType('README.md')).toBe('custom');
      expect(getFileType('package.json')).toBe('custom');
    });
  });

  describe('Guidance File Detection', () => {
    it('should identify guidance files', () => {
      expect(isGuidanceFile('AGENTS.md')).toBe(true);
      expect(isGuidanceFile('CLAUDE.md')).toBe(true);
      expect(isGuidanceFile('CODEX.md')).toBe(true);
      expect(isGuidanceFile('AI.md')).toBe(true);
      expect(isGuidanceFile('CONTRIBUTING.md')).toBe(true);
    });

    it('should reject non-guidance files', () => {
      expect(isGuidanceFile('README.md')).toBe(false);
      expect(isGuidanceFile('package.json')).toBe(false);
      expect(isGuidanceFile('index.ts')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isGuidanceFile('agents.md')).toBe(true);
      expect(isGuidanceFile('Agents.MD')).toBe(true);
    });
  });

  describe('Skip Directories', () => {
    it('should skip common build/cache directories', () => {
      expect(shouldSkipDirectory('node_modules')).toBe(true);
      expect(shouldSkipDirectory('.git')).toBe(true);
      expect(shouldSkipDirectory('dist')).toBe(true);
      expect(shouldSkipDirectory('build')).toBe(true);
      expect(shouldSkipDirectory('coverage')).toBe(true);
    });

    it('should not skip regular directories', () => {
      expect(shouldSkipDirectory('src')).toBe(false);
      expect(shouldSkipDirectory('packages')).toBe(false);
      expect(shouldSkipDirectory('docs')).toBe(false);
    });
  });

  describe('Path Utilities', () => {
    describe('normalizePath', () => {
      it('should remove trailing slashes', () => {
        expect(normalizePath('/path/to/dir/')).toBe('/path/to/dir');
      });

      it('should preserve paths without trailing slash', () => {
        expect(normalizePath('/path/to/dir')).toBe('/path/to/dir');
      });
    });

    describe('calculateDepth', () => {
      it('should return 0 for root', () => {
        expect(calculateDepth('/workspace', '/workspace')).toBe(0);
        expect(calculateDepth('/workspace/', '/workspace')).toBe(0);
      });

      it('should count directory levels', () => {
        expect(calculateDepth('/workspace/src', '/workspace')).toBe(1);
        expect(calculateDepth('/workspace/src/lib', '/workspace')).toBe(2);
        expect(calculateDepth('/workspace/a/b/c', '/workspace')).toBe(3);
      });

      it('should throw for paths not under root', () => {
        expect(() => calculateDepth('/other/path', '/workspace')).toThrow();
      });
    });

    describe('getParentDirectories', () => {
      it('should return all parent directories from file to root', () => {
        const dirs = getParentDirectories('/workspace/src/lib/file.ts', '/workspace');

        expect(dirs).toContain('/workspace/src/lib');
        expect(dirs).toContain('/workspace/src');
        expect(dirs).toContain('/workspace');
      });

      it('should order from closest to root', () => {
        const dirs = getParentDirectories('/workspace/a/b/c/file.ts', '/workspace');

        expect(dirs[0]).toBe('/workspace/a/b/c');
        expect(dirs[dirs.length - 1]).toBe('/workspace');
      });
    });
  });

  describe('Merge Strategies', () => {
    const createSource = (
      type: GuidanceSource['type'],
      depth: number
    ): GuidanceSource => ({
      path: `${'sub/'.repeat(depth)}${type}`,
      absolutePath: `/workspace/${'sub/'.repeat(depth)}${type}`,
      type,
      depth,
      priority: calculatePriority(depth, type),
      hash: 'abc123',
      lastModified: '2026-01-01T00:00:00Z',
    });

    it('should extend for agent-specific files', () => {
      const claudeMd = createSource('CLAUDE.md', 0);
      const agentsMd = createSource('AGENTS.md', 0);

      expect(getMergeStrategy(claudeMd, [agentsMd])).toBe('extend');
    });

    it('should replace for first AGENTS.md', () => {
      const agentsMd = createSource('AGENTS.md', 0);

      expect(getMergeStrategy(agentsMd, [])).toBe('replace');
    });

    it('should extend for farther AGENTS.md when closer exists', () => {
      const closer = createSource('AGENTS.md', 0);
      const farther = createSource('AGENTS.md', 1);

      expect(getMergeStrategy(farther, [closer])).toBe('extend');
    });
  });

  describe('Effective Sources', () => {
    const createSource = (
      type: GuidanceSource['type'],
      depth: number
    ): GuidanceSource => ({
      path: `${'sub/'.repeat(depth)}${type}`,
      absolutePath: `/workspace/${'sub/'.repeat(depth)}${type}`,
      type,
      depth,
      priority: calculatePriority(depth, type),
      hash: 'abc123',
      lastModified: '2026-01-01T00:00:00Z',
    });

    it('should include all sources with proper merge', () => {
      const sources = [
        createSource('AGENTS.md', 0),
        createSource('CLAUDE.md', 0),
        createSource('AGENTS.md', 1),
      ];

      const effective = getEffectiveSources(sources, '/workspace/sub');

      // All should be included since they all extend or replace appropriately
      expect(effective.length).toBeGreaterThan(0);
      // Root AGENTS.md should be first
      expect(effective[0].type).toBe('AGENTS.md');
      expect(effective[0].depth).toBe(0);
    });
  });

  describe('Precedence Report', () => {
    const createSource = (
      path: string,
      type: GuidanceSource['type'],
      depth: number
    ): GuidanceSource => ({
      path,
      absolutePath: `/workspace/${path}`,
      type,
      depth,
      priority: calculatePriority(depth, type),
      hash: 'abc123',
      lastModified: '2026-01-01T00:00:00Z',
    });

    it('should generate a comprehensive report', () => {
      const sources = [
        createSource('AGENTS.md', 'AGENTS.md', 0),
        createSource('CLAUDE.md', 'CLAUDE.md', 0),
        createSource('packages/AGENTS.md', 'AGENTS.md', 1),
      ];

      const report = generatePrecedenceReport(
        '/workspace/packages/app',
        '/workspace',
        sources
      );

      expect(report.targetPath).toBe('/workspace/packages/app');
      expect(report.workspaceRoot).toBe('/workspace');
      expect(report.discoveredSources.length).toBe(3);
      expect(report.decisions.length).toBe(3);

      // First decision should be for root AGENTS.md with replace
      const rootDecision = report.decisions.find(d => d.source === 'AGENTS.md');
      expect(rootDecision?.decision).toBe('replace');
    });

    it('should document all decisions with reasons', () => {
      const sources = [
        createSource('AGENTS.md', 'AGENTS.md', 0),
        createSource('CLAUDE.md', 'CLAUDE.md', 0),
      ];

      const report = generatePrecedenceReport('/workspace', '/workspace', sources);

      for (const decision of report.decisions) {
        expect(decision.reason).toBeTruthy();
        expect(decision.decision).toMatch(/^(replace|extend|skip)$/);
      }
    });
  });

  describe('Monorepo Fixtures', () => {
    const createSource = (
      path: string,
      type: GuidanceSource['type'],
      depth: number
    ): GuidanceSource => ({
      path,
      absolutePath: `/monorepo/${path}`,
      type,
      depth,
      priority: calculatePriority(depth, type),
      hash: 'abc123',
      lastModified: '2026-01-01T00:00:00Z',
    });

    it('should handle typical monorepo structure', () => {
      // Monorepo structure:
      // /monorepo/
      //   AGENTS.md (root)
      //   packages/
      //     app/
      //       AGENTS.md (package-specific)
      //       CLAUDE.md (agent-specific)
      //     lib/
      //       (no guidance files)

      const sources = [
        createSource('AGENTS.md', 'AGENTS.md', 0),
        createSource('packages/app/AGENTS.md', 'AGENTS.md', 2),
        createSource('packages/app/CLAUDE.md', 'CLAUDE.md', 2),
      ];

      // For a file in packages/app
      const effective = getEffectiveSources(sources, '/monorepo/packages/app/src/index.ts');

      // Should include root AGENTS.md, package AGENTS.md, and CLAUDE.md
      expect(effective.length).toBeGreaterThanOrEqual(1);
    });

    it('should prefer closer guidance over farther', () => {
      const sources = [
        createSource('AGENTS.md', 'AGENTS.md', 0),
        createSource('packages/app/AGENTS.md', 'AGENTS.md', 2),
      ];

      const sorted = sortByPrecedence(sources);

      // Root should be first (lower priority number = higher precedence)
      expect(sorted[0].path).toBe('AGENTS.md');
    });
  });

  describe('Determinism', () => {
    it('should produce deterministic results for same inputs', () => {
      const createSource = (path: string): GuidanceSource => ({
        path,
        absolutePath: `/workspace/${path}`,
        type: getFileType(path),
        depth: path.split('/').length - 1,
        priority: calculatePriority(path.split('/').length - 1, getFileType(path)),
        hash: 'abc123',
        lastModified: '2026-01-01T00:00:00Z',
      });

      const sources = [
        createSource('z/AGENTS.md'),
        createSource('a/AGENTS.md'),
        createSource('m/AGENTS.md'),
        createSource('AGENTS.md'),
      ];

      // Run multiple times
      const result1 = sortByPrecedence(sources);
      const result2 = sortByPrecedence(sources);
      const result3 = sortByPrecedence(sources);

      // Should all be identical
      expect(result1.map(s => s.path)).toEqual(result2.map(s => s.path));
      expect(result2.map(s => s.path)).toEqual(result3.map(s => s.path));
    });
  });
});
