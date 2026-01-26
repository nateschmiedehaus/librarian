import { describe, it, expect } from 'vitest';
import { categorizeFromMessage, createCommitIngestionSource } from '../commit_indexer.js';
import { createIngestionContext } from '../framework.js';

describe('Commit Extraction', () => {
  describe('categorizeFromMessage', () => {
    const cases: Array<[string, string]> = [
      // Conventional commit prefixes
      ['fix: resolve null pointer', 'bugfix'],
      ['fix(auth): handle token expiry', 'bugfix'],
      ['bugfix: handle edge case', 'bugfix'],
      ['hotfix: critical security patch', 'bugfix'],
      ['feat: add user auth', 'feature'],
      ['feat(api): new endpoint', 'feature'],
      ['feature: implement dark mode', 'feature'],
      ['add: new utility function', 'feature'],
      ['refactor: clean up utils', 'refactor'],
      ['refactor(core): simplify logic', 'refactor'],
      ['cleanup: remove dead code', 'refactor'],
      ['test: add unit tests', 'test'],
      ['tests: improve coverage', 'test'],
      ['spec: add integration tests', 'test'],
      ['docs: update readme', 'docs'],
      ['doc: add API documentation', 'docs'],
      ['readme: update installation', 'docs'],
      ['chore: bump deps', 'chore'],
      ['build: update webpack config', 'chore'],
      ['ci: add GitHub actions', 'chore'],
      ['deps: update lodash', 'chore'],
      ['perf: optimize query', 'perf'],
      ['performance: reduce memory usage', 'perf'],
      ['optimize: cache results', 'perf'],
      ['style: format code', 'style'],
      ['format: run prettier', 'style'],
      ['lint: fix eslint warnings', 'style'],
      ['revert: undo last change', 'revert'],

      // Keyword-based detection
      ['Fixed the login bug', 'bugfix'],
      ['Resolve issue #123', 'bugfix'],
      ['Patch for security vulnerability', 'bugfix'],
      ['Implement new feature', 'feature'],
      ['Add user registration', 'feature'],
      ['New API endpoint', 'feature'],
      ['Refactor authentication module', 'refactor'],
      ['Restructure folder layout', 'refactor'],
      ['Simplify error handling', 'refactor'],
      ['Write test for utils', 'test'],
      ['Improve test coverage', 'test'],
      ['Update documentation', 'docs'],
      ['Wrote documentation for API', 'docs'],
      ['Updated README with examples', 'docs'],
      // Note: "Add" triggers "feature" before "readme"/"comments" trigger "docs"
      // This is expected behavior - use conventional prefix "docs:" for clarity

      // Edge cases
      ['random message without keywords', 'other'],
      ['Update version number', 'other'],
      ['Merge branch main', 'other'],
      ['', 'other'],
    ];

    it.each(cases)('categorizes "%s" as "%s"', (message, expected) => {
      expect(categorizeFromMessage(message)).toBe(expected);
    });
  });

  describe('without LLM', () => {
    it('extracts commits with heuristic categorization', async () => {
      // Create source without LLM configured
      const source = createCommitIngestionSource({
        llmProvider: undefined,
        llmModelId: undefined,
        maxCommits: 5,
      });

      // Use a mock context with the current directory (a git repo)
      const ctx = createIngestionContext(
        process.cwd(),
        () => new Date().toISOString()
      );

      const result = await source.ingest(ctx);

      // Should have commits without errors (since LLM is optional now)
      expect(result.errors).toHaveLength(0);

      if (result.items.length > 0) {
        for (const item of result.items) {
          const payload = item.payload as {
            semanticSummary: string;
            riskScore: number;
            message: string;
          };

          // Verify semantic summary is present and follows heuristic format
          expect(payload.semanticSummary).toBeTruthy();
          expect(typeof payload.semanticSummary).toBe('string');

          // Risk score should be computed
          expect(payload.riskScore).toBeGreaterThanOrEqual(0);
          expect(payload.riskScore).toBeLessThanOrEqual(1);
        }
      }
    });

    it('uses category prefix in heuristic summary', async () => {
      const source = createCommitIngestionSource({
        llmProvider: undefined,
        maxCommits: 10,
      });

      const ctx = createIngestionContext(
        process.cwd(),
        () => new Date().toISOString()
      );

      const result = await source.ingest(ctx);

      if (result.items.length > 0) {
        for (const item of result.items) {
          const payload = item.payload as { semanticSummary: string; message: string };

          // Heuristic summary should contain a colon (category: message format)
          expect(payload.semanticSummary).toContain(':');

          // The category should be one of the known categories
          const category = payload.semanticSummary.split(':')[0];
          expect([
            'bugfix',
            'feature',
            'refactor',
            'test',
            'docs',
            'chore',
            'perf',
            'style',
            'revert',
            'other',
          ]).toContain(category);
        }
      }
    });
  });

  describe('source validation', () => {
    it('validates commit items correctly', () => {
      const source = createCommitIngestionSource({});

      // Valid item
      expect(
        source.validate({
          payload: {
            commitHash: 'abc123',
            filesChanged: ['file.ts'],
          },
        })
      ).toBe(true);

      // Missing commitHash
      expect(
        source.validate({
          payload: {
            filesChanged: ['file.ts'],
          },
        })
      ).toBe(false);

      // Missing filesChanged
      expect(
        source.validate({
          payload: {
            commitHash: 'abc123',
          },
        })
      ).toBe(false);

      // filesChanged not an array
      expect(
        source.validate({
          payload: {
            commitHash: 'abc123',
            filesChanged: 'file.ts',
          },
        })
      ).toBe(false);

      // Null data
      expect(source.validate(null)).toBe(false);

      // Non-object data
      expect(source.validate('string')).toBe(false);
    });
  });

  describe('filtering', () => {
    it('respects exclude patterns', async () => {
      const source = createCommitIngestionSource({
        exclude: ['node_modules/**', '*.lock'],
        maxCommits: 5,
      });

      const ctx = createIngestionContext(
        process.cwd(),
        () => new Date().toISOString()
      );

      const result = await source.ingest(ctx);

      // Verify no excluded files appear in results
      for (const item of result.items) {
        const payload = item.payload as { filesChanged: string[] };
        for (const file of payload.filesChanged) {
          expect(file).not.toMatch(/node_modules/);
          expect(file).not.toMatch(/\.lock$/);
        }
      }
    });
  });
});
