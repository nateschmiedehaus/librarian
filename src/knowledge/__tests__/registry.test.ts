import { describe, it, expect } from 'vitest';
import { getCurrentVersion } from '../../api/versioning.js';
import type { ContextPack } from '../../types.js';
import {
  createKnowledgeObjectRegistry,
  REQUIRED_KNOWLEDGE_OBJECT_KINDS,
} from '../registry.js';

function createSamplePack(): ContextPack {
  return {
    packId: 'pack-registry-1',
    packType: 'function_context',
    targetId: 'fn-registry-1',
    summary: 'Registry test pack',
    keyFacts: ['Registry pack fact'],
    codeSnippets: [],
    relatedFiles: ['src/registry.ts'],
    confidence: 0.5,
    createdAt: new Date('2026-01-25T00:00:00.000Z'),
    accessCount: 0,
    lastOutcome: 'unknown',
    successCount: 0,
    failureCount: 0,
    version: getCurrentVersion(),
    invalidationTriggers: ['src/registry.ts'],
  };
}

describe('Knowledge object registry', () => {
  it('registers required knowledge object definitions', () => {
    const registry = createKnowledgeObjectRegistry();
    const kinds = new Set(registry.listDefinitions().map((definition) => definition.kind));

    for (const kind of REQUIRED_KNOWLEDGE_OBJECT_KINDS) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it('ensures each definition has a constructor and invalidation rule', () => {
    const registry = createKnowledgeObjectRegistry();

    for (const kind of REQUIRED_KNOWLEDGE_OBJECT_KINDS) {
      const definition = registry.getDefinitionOrThrow(kind);
      expect(typeof definition.create).toBe('function');
      expect(definition.invalidationRule.id.length).toBeGreaterThan(0);
      expect(definition.invalidationRule.description.length).toBeGreaterThan(0);
      if (definition.invalidationRule.mode === 'invalidate') {
        expect(definition.invalidationRule.triggers?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('creates and retrieves objects by kind and id', () => {
    const registry = createKnowledgeObjectRegistry();

    const repoFact = registry.create('repo_fact', {
      id: 'rf-1',
      factType: 'build',
      data: { command: 'npm run build' },
      evidenceIds: ['ev-1'],
    });
    const map = registry.create('map', {
      id: 'map-1',
      mapType: 'repo_map',
      entries: { root: ['src/index.ts'] },
    });
    const claim = registry.create('claim', {
      id: 'cl-1',
      statement: 'build command is npm run build',
      subject: 'repo',
      evidenceIds: ['ev-1'],
      defeaterIds: [],
    });
    const pack = registry.create('pack', {
      id: 'pk-1',
      pack: createSamplePack(),
    });
    const episode = registry.create('episode', {
      id: 'ep-1',
      episodeType: 'bootstrap',
      summary: 'Bootstrap session',
      inputs: { scope: 'repo' },
      outputs: { packs: 1 },
      outcomes: ['ok'],
    });
    const outcome = registry.create('outcome', {
      id: 'oc-1',
      outcomeType: 'verification',
      observation: 'verified',
      result: 'success',
    });

    expect(registry.get('repo_fact', repoFact.id)).toEqual(repoFact);
    expect(registry.get('map', map.id)).toEqual(map);
    expect(registry.get('claim', claim.id)).toEqual(claim);
    expect(registry.get('pack', pack.id)).toEqual(pack);
    expect(registry.get('episode', episode.id)).toEqual(episode);
    expect(registry.get('outcome', outcome.id)).toEqual(outcome);
    expect(registry.list('pack')).toHaveLength(1);
    expect(registry.size()).toBe(6);
  });

  it('rejects duplicate ids across kinds', () => {
    const registry = createKnowledgeObjectRegistry();
    registry.create('repo_fact', {
      id: 'dup-1',
      factType: 'owners',
      data: { owners: ['team-a'] },
    });

    expect(() =>
      registry.create('map', {
        id: 'dup-1',
        mapType: 'owner_map',
        entries: {},
      })
    ).toThrow(/unverified_by_trace\(knowledge_object_duplicate\)/);
  });
});
