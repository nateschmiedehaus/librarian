import type {
  UniversalKnowledge,
  EntityKind,
  EntityLocation,
  Visibility,
  KnowledgeMeta,
} from './universal_types.js';

export type SectionType =
  | 'semantics'
  | 'contract'
  | 'relationships'
  | 'quality'
  | 'security'
  | 'runtime'
  | 'testing'
  | 'history'
  | 'ownership'
  | 'rationale'
  | 'context'
  | 'traceability'
  | 'meta'
  | 'agentic';

export const SECTION_TYPES: SectionType[] = [
  'semantics',
  'contract',
  'relationships',
  'quality',
  'security',
  'runtime',
  'testing',
  'history',
  'ownership',
  'rationale',
  'context',
  'traceability',
  'meta',
  'agentic',
];

export interface IdentitySection {
  id: string;
  name: string;
  qualifiedName: string;
  kind: EntityKind;
  location: EntityLocation;
  language: string;
  framework?: string;
  module: string;
  visibility: Visibility;
  created: string;
  hash: string;
  tokenCount: number;
  embedding?: Float32Array;
}

export interface KnowledgeSection<T> {
  type: SectionType;
  data: T;
  confidence: number;
  generatedAt?: string;
  validUntil?: string;
}

export interface SectionedKnowledge {
  identity: IdentitySection;
  sections: ReadonlyMap<SectionType, KnowledgeSection<unknown>>;
  loadSection(type: SectionType): Promise<KnowledgeSection<unknown> | null>;
  hasSection(type: SectionType): boolean;
  isSectionLoaded(type: SectionType): boolean;
}

export interface SectionedKnowledgeOptions {
  preload?: boolean;
}

function validateConfidence(value: number, type: SectionType): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid confidence for ${type}: ${value}`);
  }
  return value;
}

function cloneSectionData<T>(value: T): T {
  if (typeof globalThis.structuredClone !== 'function') {
    throw new Error('Section data clone failed: structuredClone not available');
  }
  try {
    return globalThis.structuredClone(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Section data clone failed: ${message}`);
  }
}

function cloneSection(section: KnowledgeSection<unknown>): KnowledgeSection<unknown> {
  return {
    type: section.type,
    data: cloneSectionData(section.data),
    confidence: section.confidence,
    generatedAt: section.generatedAt,
    validUntil: section.validUntil,
  };
}

function buildSection<T>(
  type: SectionType,
  data: T,
  meta: KnowledgeMeta | null | undefined
): KnowledgeSection<T> {
  const overallConfidence = meta?.confidence?.overall ?? 0.5;
  const confidence = validateConfidence(
    meta?.confidence?.bySection?.[type] ?? overallConfidence,
    type
  );
  return {
    type,
    data,
    confidence,
    generatedAt: meta?.generatedAt,
    validUntil: meta?.validUntil,
  };
}

function getSectionData(
  knowledge: UniversalKnowledge,
  type: SectionType
): unknown {
  switch (type) {
    case 'semantics':
      return knowledge.semantics;
    case 'contract':
      return knowledge.contract;
    case 'relationships':
      return knowledge.relationships;
    case 'quality':
      return knowledge.quality;
    case 'security':
      return knowledge.security;
    case 'runtime':
      return knowledge.runtime;
    case 'testing':
      return knowledge.testing;
    case 'history':
      return knowledge.history;
    case 'ownership':
      return knowledge.ownership;
    case 'rationale':
      return knowledge.rationale;
    case 'context':
      return knowledge.context;
    case 'traceability':
      return knowledge.traceability;
    case 'meta':
      return knowledge.meta;
    case 'agentic':
      return knowledge.agentic ?? null;
    default:
      return null;
  }
}

export function createSectionedKnowledge(
  knowledge: UniversalKnowledge,
  options: SectionedKnowledgeOptions = {}
): SectionedKnowledge {
  if (!knowledge) {
    throw new Error('createSectionedKnowledge requires a knowledge object');
  }
  const knowledgeSnapshot = cloneSectionData(knowledge);
  const identity: IdentitySection = {
    id: knowledgeSnapshot.id,
    name: knowledgeSnapshot.name,
    qualifiedName: knowledgeSnapshot.qualifiedName,
    kind: knowledgeSnapshot.kind,
    location: knowledgeSnapshot.location,
    language: knowledgeSnapshot.language,
    framework: knowledgeSnapshot.framework,
    module: knowledgeSnapshot.module,
    visibility: knowledgeSnapshot.visibility,
    created: knowledgeSnapshot.created,
    hash: knowledgeSnapshot.hash,
    tokenCount: knowledgeSnapshot.tokenCount,
    embedding: knowledgeSnapshot.embedding,
  };

  const meta = knowledgeSnapshot.meta;
  const sections = new Map<SectionType, KnowledgeSection<unknown>>();
  const inFlight = new Map<SectionType, Promise<KnowledgeSection<unknown> | null>>();
  const preload = options.preload ?? true;

  const loadSection = async (type: SectionType): Promise<KnowledgeSection<unknown> | null> => {
    const existing = sections.get(type);
    if (existing) {
      return cloneSection(existing);
    }

    const pending = inFlight.get(type);
    if (pending) {
      const resolved = await pending;
      return resolved ? cloneSection(resolved) : null;
    }

    const promise = (async () => {
      const data = getSectionData(knowledgeSnapshot, type);
      if (data === null || data === undefined) {
        return null;
      }

      const section = buildSection(type, cloneSectionData(data), meta);
      sections.set(type, section);
      return section;
    })();

    inFlight.set(type, promise);
    try {
      const resolved = await promise;
      return resolved ? cloneSection(resolved) : null;
    } finally {
      inFlight.delete(type);
    }

  };

  if (preload) {
    for (const type of SECTION_TYPES) {
      const data = getSectionData(knowledgeSnapshot, type);
      if (data === null || data === undefined) {
        continue;
      }
      sections.set(type, buildSection(type, cloneSectionData(data), meta));
    }
  }

  return {
    identity,
    get sections() {
      return new Map(
        Array.from(sections.entries(), ([type, section]) => [
          type,
          cloneSection(section),
        ])
      );
    },
    loadSection,
    hasSection: (type) => {
      if (sections.has(type)) {
        return true;
      }
      const data = getSectionData(knowledgeSnapshot, type);
      return data !== null && data !== undefined;
    },
    isSectionLoaded: (type) => sections.has(type),
  };
}

export function createLazySectionedKnowledge(knowledge: UniversalKnowledge): SectionedKnowledge {
  return createSectionedKnowledge(knowledge, { preload: false });
}
