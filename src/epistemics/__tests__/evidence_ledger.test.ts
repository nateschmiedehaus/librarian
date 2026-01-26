/**
 * @fileoverview Tier-0 Tests for Evidence Ledger
 *
 * Deterministic tests that verify the Evidence Ledger implementation.
 * These tests use an in-memory database and require no external providers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  SqliteEvidenceLedger,
  createEvidenceId,
  createSessionId,
  type EvidenceEntry,
  type EvidenceKind,
  type ExtractionEvidence,
  type ClaimEvidence,
} from '../evidence_ledger.js';
import { deterministic, absent } from '../confidence.js';

describe('EvidenceLedger', () => {
  let ledger: SqliteEvidenceLedger;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-ledger-${Date.now()}.db`);
    ledger = new SqliteEvidenceLedger(dbPath);
    await ledger.initialize();
  });

  afterEach(async () => {
    await ledger.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('append', () => {
    it('creates entry with generated ID and timestamp', async () => {
      const entry = await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/test/file.ts',
          extractionType: 'function',
          entity: {
            name: 'testFunc',
            kind: 'function',
            location: { file: '/test/file.ts', startLine: 1 },
          },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: {
          source: 'ast_parser',
          method: 'typescript_parser',
        },
        relatedEntries: [],
      });

      expect(entry.id).toBeDefined();
      expect(entry.id.startsWith('ev_')).toBe(true);
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.kind).toBe('extraction');
    });

    it('stores and retrieves payload correctly', async () => {
      const payload: ExtractionEvidence = {
        filePath: '/test/file.ts',
        extractionType: 'class',
        entity: {
          name: 'TestClass',
          kind: 'class',
          signature: 'class TestClass {}',
          location: { file: '/test/file.ts', startLine: 10, endLine: 20 },
        },
        quality: 'ast_verified',
      };

      const entry = await ledger.append({
        kind: 'extraction',
        payload,
        provenance: { source: 'ast_parser', method: 'typescript_parser' },
        relatedEntries: [],
      });

      const retrieved = await ledger.get(entry.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.payload).toEqual(payload);
    });
  });

  describe('appendBatch', () => {
    it('creates all entries atomically', async () => {
      const entries = await ledger.appendBatch([
        {
          kind: 'extraction',
          payload: {
            filePath: '/file1.ts',
            extractionType: 'function',
            entity: { name: 'fn1', kind: 'function', location: { file: '/file1.ts' } },
            quality: 'ast_verified',
          } satisfies ExtractionEvidence,
          provenance: { source: 'ast_parser', method: 'test' },
          relatedEntries: [],
        },
        {
          kind: 'extraction',
          payload: {
            filePath: '/file2.ts',
            extractionType: 'function',
            entity: { name: 'fn2', kind: 'function', location: { file: '/file2.ts' } },
            quality: 'ast_verified',
          } satisfies ExtractionEvidence,
          provenance: { source: 'ast_parser', method: 'test' },
          relatedEntries: [],
        },
        {
          kind: 'extraction',
          payload: {
            filePath: '/file3.ts',
            extractionType: 'function',
            entity: { name: 'fn3', kind: 'function', location: { file: '/file3.ts' } },
            quality: 'ast_verified',
          } satisfies ExtractionEvidence,
          provenance: { source: 'ast_parser', method: 'test' },
          relatedEntries: [],
        },
      ]);

      expect(entries).toHaveLength(3);
      entries.forEach((entry) => {
        expect(entry.id).toBeDefined();
        expect(entry.timestamp).toBeInstanceOf(Date);
      });

      // Verify all are retrievable
      for (const entry of entries) {
        const retrieved = await ledger.get(entry.id);
        expect(retrieved).not.toBeNull();
      }
    });
  });

  describe('get', () => {
    it('returns entry for valid ID', async () => {
      const created = await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/test.ts',
          extractionType: 'type',
          entity: { name: 'TestType', kind: 'type', location: { file: '/test.ts' } },
          quality: 'ast_inferred',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
      });

      const retrieved = await ledger.get(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it('returns null for unknown ID', async () => {
      const unknownId = createEvidenceId('ev_unknown_123');
      const retrieved = await ledger.get(unknownId);
      expect(retrieved).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create test data
      await ledger.appendBatch([
        {
          kind: 'extraction',
          payload: {
            filePath: '/a.ts',
            extractionType: 'function',
            entity: { name: 'a', kind: 'function', location: { file: '/a.ts' } },
            quality: 'ast_verified',
          } satisfies ExtractionEvidence,
          provenance: { source: 'ast_parser', method: 'test' },
          relatedEntries: [],
        },
        {
          kind: 'retrieval',
          payload: {
            query: 'test query',
            method: 'vector',
            results: [],
            candidatesConsidered: 10,
            latencyMs: 50,
          },
          provenance: { source: 'embedding_search', method: 'test' },
          relatedEntries: [],
        },
        {
          kind: 'extraction',
          payload: {
            filePath: '/b.ts',
            extractionType: 'class',
            entity: { name: 'b', kind: 'class', location: { file: '/b.ts' } },
            quality: 'ast_verified',
          } satisfies ExtractionEvidence,
          provenance: { source: 'ast_parser', method: 'test' },
          relatedEntries: [],
        },
      ]);
    });

    it('filters by kind', async () => {
      const results = await ledger.query({ kinds: ['extraction'] });
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.kind).toBe('extraction'));
    });

    it('filters by multiple kinds', async () => {
      const results = await ledger.query({ kinds: ['extraction', 'retrieval'] });
      expect(results).toHaveLength(3);
    });

    it('respects limit', async () => {
      const results = await ledger.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('respects offset', async () => {
      const all = await ledger.query({});
      const offset = await ledger.query({ offset: 1 });
      expect(offset).toHaveLength(all.length - 1);
    });

    it('orders by timestamp descending by default', async () => {
      const results = await ledger.query({});
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          results[i].timestamp.getTime()
        );
      }
    });
  });

  describe('getChain', () => {
    it('returns chain with all related entries', async () => {
      // Create extraction evidence
      const extraction = await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/test.ts',
          extractionType: 'function',
          entity: { name: 'testFn', kind: 'function', location: { file: '/test.ts' } },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
        confidence: deterministic(true, 'ast_parse_succeeded'),
      });

      // Create claim that references extraction
      const claim = await ledger.append({
        kind: 'claim',
        payload: {
          claim: 'testFn handles nulls correctly',
          category: 'behavior',
          subject: { type: 'function', identifier: 'testFn' },
          supportingEvidence: [extraction.id],
          knownDefeaters: [],
          confidence: deterministic(true, 'verified'),
        } satisfies ClaimEvidence,
        provenance: { source: 'llm_synthesis', method: 'analysis' },
        relatedEntries: [extraction.id],
        confidence: deterministic(true, 'verified'),
      });

      const chain = await ledger.getChain(claim.id);

      expect(chain.root.id).toBe(claim.id);
      expect(chain.evidence).toHaveLength(2);
      expect(chain.graph.get(claim.id)).toContain(extraction.id);
    });

    it('throws for unknown claim ID', async () => {
      const unknownId = createEvidenceId('ev_unknown');
      await expect(ledger.getChain(unknownId)).rejects.toThrow('claim_not_found');
    });
  });

  describe('getSessionEntries', () => {
    it('returns only entries for specified session', async () => {
      const session1 = createSessionId('sess_1');
      const session2 = createSessionId('sess_2');

      await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/a.ts',
          extractionType: 'function',
          entity: { name: 'a', kind: 'function', location: { file: '/a.ts' } },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
        sessionId: session1,
      });

      await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/b.ts',
          extractionType: 'function',
          entity: { name: 'b', kind: 'function', location: { file: '/b.ts' } },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
        sessionId: session2,
      });

      const session1Entries = await ledger.getSessionEntries(session1);
      expect(session1Entries).toHaveLength(1);
      expect(session1Entries[0].sessionId).toBe(session1);
    });
  });

  describe('subscribe', () => {
    it('notifies callback for matching entries', async () => {
      const received: EvidenceEntry[] = [];

      const unsubscribe = ledger.subscribe(
        { kinds: ['extraction'] },
        (entry) => received.push(entry)
      );

      await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/test.ts',
          extractionType: 'function',
          entity: { name: 'test', kind: 'function', location: { file: '/test.ts' } },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
      });

      // Should not notify for non-matching kind
      await ledger.append({
        kind: 'retrieval',
        payload: {
          query: 'test',
          method: 'vector',
          results: [],
          candidatesConsidered: 0,
          latencyMs: 0,
        },
        provenance: { source: 'embedding_search', method: 'test' },
        relatedEntries: [],
      });

      expect(received).toHaveLength(1);
      expect(received[0].kind).toBe('extraction');

      unsubscribe();
    });

    it('stops notifying after unsubscribe', async () => {
      const received: EvidenceEntry[] = [];

      const unsubscribe = ledger.subscribe({}, (entry) => received.push(entry));

      await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/a.ts',
          extractionType: 'function',
          entity: { name: 'a', kind: 'function', location: { file: '/a.ts' } },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
      });

      unsubscribe();

      await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/b.ts',
          extractionType: 'function',
          entity: { name: 'b', kind: 'function', location: { file: '/b.ts' } },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
      });

      expect(received).toHaveLength(1);
    });
  });

  describe('confidence handling', () => {
    it('stores and retrieves confidence correctly', async () => {
      const confidence = deterministic(true, 'test_passed');

      const entry = await ledger.append({
        kind: 'extraction',
        payload: {
          filePath: '/test.ts',
          extractionType: 'function',
          entity: { name: 'test', kind: 'function', location: { file: '/test.ts' } },
          quality: 'ast_verified',
        } satisfies ExtractionEvidence,
        provenance: { source: 'ast_parser', method: 'test' },
        relatedEntries: [],
        confidence,
      });

      const retrieved = await ledger.get(entry.id);
      expect(retrieved?.confidence).toEqual(confidence);
    });

    it('handles absent confidence', async () => {
      const confidence = absent('uncalibrated');

      const entry = await ledger.append({
        kind: 'synthesis',
        payload: {
          request: 'analyze code',
          output: 'analysis result',
          model: { provider: 'test', modelId: 'test-model' },
          tokens: { input: 100, output: 50 },
          synthesisType: 'analysis',
        },
        provenance: { source: 'llm_synthesis', method: 'test' },
        relatedEntries: [],
        confidence,
      });

      const retrieved = await ledger.get(entry.id);
      expect(retrieved?.confidence?.type).toBe('absent');
    });
  });
});
