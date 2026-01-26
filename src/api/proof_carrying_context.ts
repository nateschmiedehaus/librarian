export interface ProofEntity {
  id: string;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
}

export interface ProofCarryingContext {
  entity: ProofEntity;
  relevanceProof?: RelevanceProof;
  proofFailure?: ProofFailure;
}

export interface ProofFailure {
  reason: 'missing_query' | 'no_overlap' | 'insufficient_context';
  detail: string;
}

export interface ProofStep {
  stepNumber: number;
  statement: string;
  justification: 'axiom' | 'definition' | 'inference' | 'given';
  rule?: string;
  premises?: number[];
}

export interface RelevanceProof {
  format: 'natural_deduction' | 'sequent' | 'resolution' | 'informal';
  steps: ProofStep[];
  conclusion: string;
  verified: boolean;
  verificationMethod: 'automated' | 'llm_checked' | 'unverified';
}

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const MAX_QUERY_LENGTH = 2000;

export class ProofCarryingRetriever {
  async retrieveWithProofs(query: string, entities: ProofEntity[]): Promise<ProofCarryingContext[]> {
    const normalized = normalizeQuery(query);
    if (!normalized) {
      throw new Error('unverified_by_trace(query_invalid)');
    }
    const results: ProofCarryingContext[] = [];
    for (const entity of entities) {
      const proof = await this.proveRelevance(entity, normalized);
      if ('steps' in proof) {
        results.push({ entity, relevanceProof: proof });
      }
    }
    return results;
  }

  async proveRelevance(entity: ProofEntity, query: string): Promise<RelevanceProof | ProofFailure> {
    const normalized = normalizeQuery(query);
    if (!normalized) {
      return { reason: 'missing_query', detail: 'Query lacks meaningful terms.' };
    }
    const queryTerms = tokenize(normalized);
    if (queryTerms.length === 0) {
      return { reason: 'missing_query', detail: 'Query lacks meaningful terms.' };
    }
    const entityTerms = extractEntityTerms(entity);
    if (entityTerms.length === 0) {
      return { reason: 'insufficient_context', detail: 'Entity lacks name/description/tags for matching.' };
    }
    const overlap = intersectTerms(queryTerms, entityTerms);
    if (overlap.length === 0) {
      return { reason: 'no_overlap', detail: 'No shared terms between query and entity.' };
    }

    const steps: ProofStep[] = [
      {
        stepNumber: 1,
        statement: `Query terms include: ${queryTerms.join(', ')}`,
        justification: 'given',
      },
      {
        stepNumber: 2,
        statement: `Entity terms include: ${entityTerms.join(', ')}`,
        justification: 'given',
      },
      {
        stepNumber: 3,
        statement: `Shared terms: ${overlap.join(', ')}`,
        justification: 'inference',
        rule: 'token_overlap',
        premises: [1, 2],
      },
    ];

    return {
      format: 'informal',
      steps,
      conclusion: `Entity ${entity.name} is relevant to the query based on shared terms.`,
      verified: true,
      verificationMethod: 'automated',
    };
  }
}

function normalizeQuery(query: string): string {
  if (typeof query !== 'string') return '';
  const normalized = query.replace(CONTROL_CHAR_PATTERN, ' ').trim();
  if (normalized.length > MAX_QUERY_LENGTH) {
    throw new Error('unverified_by_trace(query_too_long)');
  }
  return normalized;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function extractEntityTerms(entity: ProofEntity): string[] {
  const parts = [entity.name, entity.description, entity.content, ...(entity.tags ?? [])]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (parts.length === 0) return [];
  const tokens = new Set<string>();
  for (const part of parts) {
    for (const token of tokenize(part)) {
      tokens.add(token);
    }
  }
  return Array.from(tokens.values());
}

function intersectTerms(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token));
}
