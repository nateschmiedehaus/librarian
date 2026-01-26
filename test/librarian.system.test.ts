import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { createLibrarian, Librarian, checkAllProviders } from '../src/index.js';
import { requireProviders } from '../src/api/provider_check.js';
import { resolveLibrarianModelId } from '../src/api/llm_env.js';

describe('Librarian', () => {
  let llmProvider: 'claude' | 'codex' | null = null;
  let llmModelId: string | null = null;
  let lib: Librarian | null = null;

  beforeAll(async () => {
    await requireProviders({ llm: true, embedding: true }, { workspaceRoot: process.cwd() });

    const status = await checkAllProviders({ workspaceRoot: process.cwd() });
    llmProvider = status.llm.provider === 'claude' ? 'claude' : 'codex';
    llmModelId =
      resolveLibrarianModelId(llmProvider) ||
      (llmProvider === 'claude' ? 'claude-3-5-sonnet-20241022' : 'codex-mini-latest');
  });

  beforeEach(async () => {
    if (!llmProvider || !llmModelId) throw new Error('test_setup_failed: missing llmProvider/llmModelId');
    lib = await createLibrarian({
      workspace: process.cwd(),
      storage: { type: 'memory' },
      llmProvider,
      llmModelId,
    });
  });

  afterEach(async () => {
    if (lib) {
      await lib.close();
      lib = null;
    }
  });

  const withLib = (title: string, fn: (lib: Librarian) => Promise<void> | void) =>
    it(title, async () => {
      if (!lib) throw new Error('test_setup_failed: librarian not initialized');
      await fn(lib);
    });

  describe('createLibrarian', () => {
    withLib('should create an initialized instance', async (lib) => {
      expect(lib).toBeInstanceOf(Librarian);
    });
  });

  describe('bootstrap', () => {
    withLib('should return bootstrap stats', async (lib) => {
      const stats = await lib.bootstrap();

      expect(stats).toHaveProperty('filesIndexed');
      expect(stats).toHaveProperty('functionsFound');
      expect(stats).toHaveProperty('classesFound');
      expect(stats).toHaveProperty('relationshipsFound');
      expect(stats).toHaveProperty('issuesDetected');
      expect(stats).toHaveProperty('durationMs');
    });
  });

  describe('query', () => {
    withLib('should return a query result', async (lib) => {
      const result = await lib.query({
        intent: 'Where is authentication handled?',
        depth: 'L2',
      });

      expect(result).toHaveProperty('queryId');
      expect(result).toHaveProperty('intent', 'Where is authentication handled?');
      expect(result).toHaveProperty('packs');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('feedbackToken');
      expect(result).toHaveProperty('timing');
    });

    withLib('should include timing information', async (lib) => {
      const result = await lib.query({
        intent: 'Test query',
      });

      expect(result.timing).toHaveProperty('totalMs');
      expect(result.timing).toHaveProperty('searchMs');
      expect(result.timing).toHaveProperty('rankingMs');
    });
  });

  describe('issues', () => {
    withLib('should return empty issues for fresh storage', async (lib) => {
      const issues = await lib.getIssues({});
      expect(issues).toEqual([]);
    });

    withLib('should return actionable issues', async (lib) => {
      const issues = await lib.getActionableIssues();
      expect(Array.isArray(issues)).toBe(true);
    });

    withLib('should return quick wins', async (lib) => {
      const issues = await lib.getQuickWins();
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('stats', () => {
    withLib('should return storage stats', async (lib) => {
      const stats = await lib.getStats();

      expect(stats).toHaveProperty('entities');
      expect(stats).toHaveProperty('functions');
      expect(stats).toHaveProperty('classes');
      expect(stats).toHaveProperty('files');
      expect(stats).toHaveProperty('relationships');
      expect(stats).toHaveProperty('issues');
    });
  });

  describe('events', () => {
    withLib('should emit events during bootstrap', async (lib) => {
      const events: any[] = [];
      const unsubscribe = lib.on((event) => events.push(event));

      await lib.bootstrap();

      unsubscribe();

      expect(events.some(e => e.type === 'bootstrap:start')).toBe(true);
      expect(events.some(e => e.type === 'bootstrap:complete')).toBe(true);
    });

    withLib('should emit events during query', async (lib) => {
      const events: any[] = [];
      const unsubscribe = lib.on((event) => events.push(event));

      await lib.query({ intent: 'test' });

      unsubscribe();

      expect(events.some(e => e.type === 'query:start')).toBe(true);
      expect(events.some(e => e.type === 'query:complete')).toBe(true);
    });
  });
});
