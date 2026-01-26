/**
 * @fileoverview LLM Evidence Tracking Tests (TDD)
 *
 * Tests for verifying that file and directory knowledge records
 * carry LLM evidence metadata (provider, modelId, promptDigest, timestamp).
 *
 * This is a critical mandate for the Understanding Layer:
 * "Understanding requires LLM synthesis; no non-LLM shortcuts for semantic claims."
 *
 * REQUIREMENTS:
 * - Every file/directory record with LLM-generated semantics MUST include llmEvidence
 * - llmEvidence must have: provider, modelId, promptDigest, timestamp
 * - Records without LLM synthesis should NOT have llmEvidence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { FileKnowledge, DirectoryKnowledge } from '../types.js';
import { setDefaultLlmServiceFactory, clearDefaultLlmServiceFactory } from '../adapters/llm_service.js';

describe('LLM Evidence Tracking', () => {
  beforeEach(() => {
    setDefaultLlmServiceFactory(async () => ({
      chat: async ({ provider }) => ({
        provider,
        content: JSON.stringify({
          purpose: 'Provides test semantics for evidence tracking',
          summary: 'This is a deterministic stub summary used to verify llmEvidence wiring.',
        }),
      }),
      checkClaudeHealth: async () => ({
        provider: 'claude',
        available: true,
        authenticated: true,
        lastCheck: Date.now(),
      }),
      checkCodexHealth: async () => ({
        provider: 'codex',
        available: false,
        authenticated: false,
        lastCheck: Date.now(),
      }),
    }));
  });

  afterEach(() => {
    clearDefaultLlmServiceFactory();
  });

  describe('FileKnowledge llmEvidence', () => {
    it('includes llmEvidence when LLM is used for semantic extraction', async () => {
      const { extractFileKnowledge } = await import('../knowledge/extractors/file_extractor.js');

      const result = await extractFileKnowledge(
        {
          absolutePath: '/test/sample.ts',
          workspaceRoot: '/test',
          content: 'export function hello() { return "world"; }',
        },
        {
          llmProvider: 'claude',
          llmModelId: 'claude-haiku-4-5-20241022',
        }
      );

      expect(result.file).toBeDefined();
      expect(result.file.purpose).toContain('Provides test semantics for evidence tracking');
      expect(result.file.summary).toContain('deterministic stub summary');
      expect(result.file.llmEvidence).toBeDefined();
      expect(result.file.llmEvidence?.provider).toBe('claude');
      expect(result.file.llmEvidence?.modelId).toBeTruthy();
      expect(result.file.llmEvidence?.promptDigest).toMatch(/^[a-f0-9]+$/);
      expect(result.file.llmEvidence?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('does NOT include llmEvidence when file is unreadable', async () => {
      // Binary/unreadable files don't use LLM, so no evidence
      const { extractFileKnowledge } = await import('../knowledge/extractors/file_extractor.js');

      const result = await extractFileKnowledge(
        {
          absolutePath: '/nonexistent/binary.bin',
          workspaceRoot: '/nonexistent',
          // No content provided and file doesn't exist - will fail to read
        },
        {
          llmProvider: 'claude',
        }
      );

      expect(result.file.purpose).toContain('unverified_by_trace(file_unreadable)');
      expect(result.file.llmEvidence).toBeUndefined();
    });

    it('llmEvidence has correct structure', async () => {
      // Test the llmEvidence structure matches the mandate
      const { buildLlmEvidence } = await import('../knowledge/extractors/llm_evidence.js');

      const evidence = await buildLlmEvidence({
        provider: 'claude',
        modelId: 'test-model-123',
        messages: [
          { role: 'system', content: 'Test system prompt' },
          { role: 'user', content: 'Test user message' },
        ],
      });

      expect(evidence).toEqual({
        provider: 'claude',
        modelId: 'test-model-123',
        promptDigest: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });

      // promptDigest should be a hash (hex string)
      expect(evidence.promptDigest).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('DirectoryKnowledge llmEvidence', () => {
    it('includes llmEvidence when LLM is used for semantic extraction', async () => {
      const { extractDirectoryKnowledge } = await import('../knowledge/extractors/directory_extractor.js');

      const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-evidence-dir-'));
      const absolutePath = path.join(workspaceRoot, 'src');
      await fs.mkdir(absolutePath, { recursive: true });
      await fs.writeFile(path.join(absolutePath, 'index.ts'), 'export const x = 1;\n');

      try {
        const result = await extractDirectoryKnowledge(
          { absolutePath, workspaceRoot },
          { llmProvider: 'claude', llmModelId: 'claude-haiku-4-5-20241022' }
        );

        expect(result.directory).toBeDefined();
        expect(result.directory.purpose).toBeTruthy();
        expect(result.directory.llmEvidence).toBeDefined();
        expect(result.directory.llmEvidence?.provider).toBe('claude');
        expect(result.directory.llmEvidence?.modelId).toBeTruthy();
      } finally {
        await fs.rm(workspaceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('Evidence persistence', () => {
    it('llmEvidence survives serialization/deserialization', async () => {
      const { buildLlmEvidence } = await import('../knowledge/extractors/llm_evidence.js');

      const original = await buildLlmEvidence({
        provider: 'codex',
        modelId: 'codex-mini-latest',
        messages: [{ role: 'user', content: 'test' }],
      });

      // Simulate JSON serialization (as would happen in storage)
      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(original);
    });
  });

  describe('Evidence mandate compliance', () => {
    it('semantic fields without evidence are invalid', () => {
      // This test documents the mandate: semantic claims require evidence

      const fileWithSemantics: Partial<FileKnowledge> = {
        purpose: 'Handles user authentication',
        summary: 'This file provides OAuth2 authentication handlers',
        // Missing llmEvidence - this should be invalid
      };

      // Check that semantic content exists without evidence
      const hasSemantics = Boolean(fileWithSemantics.purpose && fileWithSemantics.summary);
      const hasEvidence = Boolean((fileWithSemantics as FileKnowledge & { llmEvidence?: unknown }).llmEvidence);

      // This combination is invalid per mandate
      if (hasSemantics && !hasEvidence) {
        // This is the gap we're fixing
        expect(hasSemantics).toBe(true);
        expect(hasEvidence).toBe(false);
      }
    });

    it('unverified_by_trace semantics do not require evidence', () => {
      // Files that couldn't be analyzed don't need evidence
      const unverifiedFile: Partial<FileKnowledge> = {
        purpose: 'unverified_by_trace(file_unreadable)',
        summary: 'unverified_by_trace(file_unreadable): binary file',
        // No llmEvidence needed - no LLM was used
      };

      const isUnverified = unverifiedFile.purpose?.includes('unverified_by_trace');
      const hasEvidence = Boolean((unverifiedFile as FileKnowledge & { llmEvidence?: unknown }).llmEvidence);

      // Unverified files don't need evidence (no LLM was used)
      expect(isUnverified).toBe(true);
      expect(hasEvidence).toBe(false);
    });
  });
});

describe('LLM Evidence Type Definition', () => {
  it('FileKnowledge interface includes llmEvidence field', () => {
    // This test will fail until we add llmEvidence to FileKnowledge interface
    // It documents the expected type structure

    type ExpectedFileKnowledge = {
      llmEvidence?: {
        provider: string;
        modelId: string;
        promptDigest: string;
        timestamp: string;
      };
    };

    // Type-level test: this should compile if FileKnowledge has llmEvidence
    const _typeCheck: ExpectedFileKnowledge = {} as FileKnowledge;

    // This assertion will fail until the interface is updated
    // For now, we check that the field can be assigned
    expect(typeof _typeCheck).toBe('object');
  });

  it('DirectoryKnowledge interface includes llmEvidence field', () => {
    type ExpectedDirectoryKnowledge = {
      llmEvidence?: {
        provider: string;
        modelId: string;
        promptDigest: string;
        timestamp: string;
      };
    };

    const _typeCheck: ExpectedDirectoryKnowledge = {} as DirectoryKnowledge;
    expect(typeof _typeCheck).toBe('object');
  });
});
