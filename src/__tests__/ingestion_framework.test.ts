import { describe, it, expect } from 'vitest';
import { IngestionFramework, createIngestionContext } from '../ingest/framework.js';
import type { IngestionSource } from '../ingest/types.js';

describe('IngestionFramework', () => {
  it('normalizes items and enforces schema validation', async () => {
    const framework = new IngestionFramework();
    const now = '2025-01-02T03:04:05.000Z';
    const source: IngestionSource = {
      type: 'docs',
      version: 'v1',
      validate: (data: unknown) => {
        const item = data as { id?: string; sourceType?: string; sourceVersion?: string; ingestedAt?: string; payload?: unknown };
        return Boolean(item.id) && item.sourceType === 'docs' && item.sourceVersion === 'v1' && item.ingestedAt === now && item.payload !== undefined;
      },
      ingest: async () => ({
        items: [
          { id: 'doc-1', sourceType: '', sourceVersion: '', ingestedAt: '', payload: { title: 'Doc' } },
          { id: '', sourceType: 'docs', sourceVersion: 'v1', ingestedAt: now, payload: { title: 'Bad' } },
        ],
        errors: ['source warning'],
      }),
    };

    framework.registerSource(source);

    const result = await framework.ingestAll(createIngestionContext('/repo', () => now));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sourceType).toBe('docs');
    expect(result.items[0]?.sourceVersion).toBe('v1');
    expect(result.items[0]?.ingestedAt).toBe(now);
    expect(result.errors).toEqual([
      '[docs] source warning',
      '[docs] invalid item unknown',
    ]);
    expect(result.sources).toEqual([{ type: 'docs', version: 'v1', itemCount: 1 }]);
  });

  it('records ingestion failures without halting other sources', async () => {
    const framework = new IngestionFramework();
    const healthy: IngestionSource = {
      type: 'config',
      version: 'v1',
      validate: () => true,
      ingest: async () => ({
        items: [{ id: 'cfg-1', sourceType: 'config', sourceVersion: 'v1', ingestedAt: '2025-01-01', payload: { key: 'value' } }],
        errors: [],
      }),
    };
    const failing: IngestionSource = {
      type: 'ci',
      version: 'v2',
      validate: () => true,
      ingest: async () => {
        throw new Error('boom');
      },
    };

    framework.registerSource(healthy);
    framework.registerSource(failing);

    const result = await framework.ingestAll(createIngestionContext('/repo', () => '2025-01-01'));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('cfg-1');
    expect(result.errors).toEqual(['[ci] boom']);
    expect(result.sources).toEqual([
      { type: 'config', version: 'v1', itemCount: 1 },
      { type: 'ci', version: 'v2', itemCount: 0 },
    ]);
  });
});
