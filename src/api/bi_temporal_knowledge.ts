export type Timestamp = string;

export interface EvidenceEntry {
  id: string;
  description?: string;
}

export interface BiTemporalFact {
  claim: string;
  subject: string;
  validTime: {
    start: Timestamp;
    end: Timestamp | 'now';
  };
  transactionTime: {
    recorded: Timestamp;
    superseded?: Timestamp;
  };
  evidence: EvidenceEntry[];
  confidence: number;
}

export interface BiTemporalQuery {
  question: string;
  asOfValidTime?: Timestamp;
  asOfTransactionTime?: Timestamp;
}

export interface KnowledgeDiff {
  added: BiTemporalFact[];
  removed: BiTemporalFact[];
}

export class BiTemporalKnowledgeStore {
  private facts: BiTemporalFact[] = [];

  recordFact(fact: BiTemporalFact): void {
    this.facts.push(fact);
  }

  current(query: string): BiTemporalFact[] {
    const now = new Date().toISOString();
    return this.asOf(query, now, now);
  }

  asOfValidTime(query: string, validTime: Timestamp): BiTemporalFact[] {
    const now = new Date().toISOString();
    return this.asOf(query, validTime, now);
  }

  asOfTransactionTime(query: string, transactionTime: Timestamp): BiTemporalFact[] {
    const now = new Date().toISOString();
    return this.asOf(query, now, transactionTime);
  }

  asOf(query: string, validTime: Timestamp, transactionTime: Timestamp): BiTemporalFact[] {
    return this.filterFacts(query, validTime, transactionTime);
  }

  knowledgeDiff(query: string, fromTransaction: Timestamp, toTransaction: Timestamp): KnowledgeDiff {
    const fromFacts = this.asOfTransactionTime(query, fromTransaction);
    const toFacts = this.asOfTransactionTime(query, toTransaction);
    const fromKeys = new Set(fromFacts.map((fact) => factKey(fact)));
    const toKeys = new Set(toFacts.map((fact) => factKey(fact)));
    return {
      added: toFacts.filter((fact) => !fromKeys.has(factKey(fact))),
      removed: fromFacts.filter((fact) => !toKeys.has(factKey(fact))),
    };
  }

  private filterFacts(query: string, validTime: Timestamp, transactionTime: Timestamp): BiTemporalFact[] {
    const normalizedQuery = query.trim().toLowerCase();
    return this.facts.filter((fact) => {
      if (!matchesQuery(fact, normalizedQuery)) return false;
      if (!isWithin(validTime, fact.validTime)) return false;
      if (!isTransactionVisible(transactionTime, fact.transactionTime)) return false;
      return true;
    });
  }
}

function factKey(fact: BiTemporalFact): string {
  return `${fact.subject}::${fact.claim}`;
}

function isWithin(time: Timestamp, range: { start: Timestamp; end: Timestamp | 'now' }): boolean {
  const start = Date.parse(range.start);
  const end = range.end === 'now' ? Date.now() : Date.parse(range.end);
  const target = Date.parse(time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(target)) return false;
  return target >= start && target <= end;
}

function isTransactionVisible(time: Timestamp, transaction: { recorded: Timestamp; superseded?: Timestamp }): boolean {
  const recorded = Date.parse(transaction.recorded);
  const target = Date.parse(time);
  if (!Number.isFinite(recorded) || !Number.isFinite(target)) return false;
  if (target < recorded) return false;
  if (transaction.superseded) {
    const superseded = Date.parse(transaction.superseded);
    if (Number.isFinite(superseded) && target >= superseded) return false;
  }
  return true;
}

function matchesQuery(fact: BiTemporalFact, query: string): boolean {
  if (!query) return true;
  const haystack = `${fact.subject} ${fact.claim}`.toLowerCase();
  return haystack.includes(query);
}
