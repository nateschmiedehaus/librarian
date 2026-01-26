import { describe, it, expect } from 'vitest';
import { createEmptyKnowledge } from '../universal_types.js';
import type { AgenticAffordances, UniversalKnowledge } from '../universal_types.js';
import {
  createSectionedKnowledge,
  createLazySectionedKnowledge,
  SECTION_TYPES,
} from '../sectioned_knowledge.js';

describe('createSectionedKnowledge', () => {
  it('maps identity and respects per-section confidence overrides', async () => {
    const knowledge = createEmptyKnowledge('id-1', 'Thing', 'function', 'file.ts', 10);
    knowledge.meta.confidence.overall = 0.2;
    knowledge.meta.confidence.bySection = { semantics: 0.9 };

    const sectioned = createSectionedKnowledge(knowledge);
    const semantics = await sectioned.loadSection('semantics');
    const contract = await sectioned.loadSection('contract');

    expect(sectioned.identity.id).toBe('id-1');
    expect(sectioned.identity.name).toBe('Thing');
    expect(sectioned.identity.module).toBe('file.ts');
    expect(semantics?.confidence).toBe(0.9);
    expect(contract?.confidence).toBe(0.2);
  });

  it('includes agentic section when present', async () => {
    const knowledge = createEmptyKnowledge('id-2', 'AgenticThing', 'function', 'file.ts', 10);
    const agentic: AgenticAffordances = {
      actions: [
        {
          verb: 'validate',
          object: 'input',
          preconditions: [],
          postconditions: [],
          sideEffects: [],
          complexity: 'simple',
          riskLevel: 'safe',
        },
      ],
    };
    knowledge.agentic = agentic;

    const sectioned = createSectionedKnowledge(knowledge);
    const agenticSection = await sectioned.loadSection('agentic');

    expect(agenticSection?.type).toBe('agentic');
    expect(agenticSection?.data).toStrictEqual(agentic);
  });

  it('omits agentic section when absent', async () => {
    const knowledge = createEmptyKnowledge('id-3', 'PlainThing', 'function', 'file.ts', 10);

    const sectioned = createSectionedKnowledge(knowledge);
    const agenticSection = await sectioned.loadSection('agentic');

    expect(agenticSection).toBeNull();
    expect(sectioned.hasSection('agentic')).toBe(false);
  });

  it('tracks section availability separately from load state', async () => {
    const knowledge = createEmptyKnowledge('id-3b', 'LazyThing', 'function', 'file.ts', 10);
    const sectioned = createLazySectionedKnowledge(knowledge);

    expect(sectioned.isSectionLoaded('semantics')).toBe(false);
    expect(sectioned.hasSection('semantics')).toBe(true);

    await sectioned.loadSection('semantics');

    expect(sectioned.isSectionLoaded('semantics')).toBe(true);
  });

  it('falls back to default confidence when meta is missing', async () => {
    const knowledge = createEmptyKnowledge('id-4', 'MetaMissing', 'function', 'file.ts', 10) as UniversalKnowledge & {
      meta?: unknown;
    };
    delete (knowledge as { meta?: unknown }).meta;

    const sectioned = createSectionedKnowledge(knowledge as UniversalKnowledge);
    const semantics = await sectioned.loadSection('semantics');

    expect(semantics?.confidence).toBe(0.5);
  });

  it('falls back to default confidence when meta confidence is missing', async () => {
    const knowledge = createEmptyKnowledge('id-5', 'ConfidenceMissing', 'function', 'file.ts', 10) as UniversalKnowledge & {
      meta: { confidence?: unknown };
    };
    delete (knowledge.meta as { confidence?: unknown }).confidence;

    const sectioned = createSectionedKnowledge(knowledge as UniversalKnowledge);
    const semantics = await sectioned.loadSection('semantics');

    expect(semantics?.confidence).toBe(0.5);
  });

  it('throws when knowledge is null', () => {
    expect(() => createSectionedKnowledge(null as unknown as UniversalKnowledge)).toThrow(
      'createSectionedKnowledge requires a knowledge object'
    );
  });

  it('loads all known section types when data is available', async () => {
    const knowledge = createEmptyKnowledge('id-6', 'FullThing', 'function', 'file.ts', 10);
    knowledge.agentic = {
      actions: [
        {
          verb: 'inspect',
          object: 'state',
          preconditions: [],
          postconditions: [],
          sideEffects: [],
          complexity: 'simple',
          riskLevel: 'safe',
        },
      ],
    };
    const sectioned = createLazySectionedKnowledge(knowledge);

    for (const type of SECTION_TYPES) {
      const section = await sectioned.loadSection(type);
      expect(section).not.toBeNull();
    }
  });

  it('returns isolated section data for each load', async () => {
    const knowledge = createEmptyKnowledge('id-7', 'CloneThing', 'function', 'file.ts', 10);
    const sectioned = createLazySectionedKnowledge(knowledge);

    const [first, second] = await Promise.all([
      sectioned.loadSection('semantics'),
      sectioned.loadSection('semantics'),
    ]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);

    (first!.data as any).purpose.summary = 'mutated';
    const third = await sectioned.loadSection('semantics');

    expect((second!.data as any).purpose.summary).toBe('');
    expect((third!.data as any).purpose.summary).toBe('');
  });

  it('rejects invalid confidence values', async () => {
    const knowledge = createEmptyKnowledge('id-8', 'BadConfidence', 'function', 'file.ts', 10);
    knowledge.meta.confidence.bySection = { semantics: 2 };
    const sectioned = createLazySectionedKnowledge(knowledge);

    await expect(sectioned.loadSection('semantics')).rejects.toThrow('Invalid confidence');
  });
});
