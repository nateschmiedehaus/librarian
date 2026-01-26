/**
 * @fileoverview Evidence Ledger - Append-Only Epistemic Event Log
 *
 * Implements the IEvidenceLedger interface from the evidence-ledger spec.
 * This is a COMPLEMENTARY system to EvidenceGraphStorage:
 * - EvidenceGraphStorage: Mutable graph of claims, edges, defeaters
 * - EvidenceLedger: Append-only log of ALL epistemic events for audit/calibration
 *
 * Key properties:
 * - APPEND-ONLY: Entries are never modified or deleted
 * - AUDITABLE: Complete trace of how any conclusion was reached
 * - CALIBRATION: Historical data for confidence calibration
 *
 * @packageDocumentation
 */

import type Database from 'better-sqlite3';
import type { ConfidenceValue } from './confidence.js';
import { randomUUID } from 'node:crypto';

// ============================================================================
// BRANDED TYPES
// ============================================================================

export type EvidenceId = string & { readonly __brand: 'EvidenceId' };
export type SessionId = string & { readonly __brand: 'SessionId' };

export function createEvidenceId(id?: string): EvidenceId {
  return (id ?? `ev_${randomUUID()}`) as EvidenceId;
}

export function createSessionId(id?: string): SessionId {
  return (id ?? `sess_${randomUUID()}`) as SessionId;
}

// ============================================================================
// EVIDENCE KINDS
// ============================================================================

export type EvidenceKind =
  | 'extraction'
  | 'retrieval'
  | 'synthesis'
  | 'claim'
  | 'verification'
  | 'contradiction'
  | 'feedback'
  | 'outcome'
  | 'tool_call'
  | 'episode'
  | 'calibration';

// ============================================================================
// PROVENANCE
// ============================================================================

export type ProvenanceSource =
  | 'ast_parser'
  | 'llm_synthesis'
  | 'embedding_search'
  | 'user_input'
  | 'tool_output'
  | 'system_observation';

export interface EvidenceProvenance {
  source: ProvenanceSource;
  method: string;
  agent?: {
    type: 'llm' | 'embedding' | 'ast' | 'human' | 'tool';
    identifier: string;
    version?: string;
  };
  inputHash?: string;
  config?: Record<string, unknown>;
}

// ============================================================================
// PAYLOAD TYPES
// ============================================================================

export interface CodeLocation {
  file: string;
  startLine?: number;
  endLine?: number;
  column?: number;
}

export interface ExtractionEvidence {
  filePath: string;
  extractionType: 'function' | 'class' | 'type' | 'import' | 'export' | 'pattern';
  entity: {
    name: string;
    kind: string;
    signature?: string;
    location: CodeLocation;
  };
  quality: 'ast_verified' | 'ast_inferred' | 'llm_synthesized';
  astNode?: unknown;
}

export interface RetrievalEvidence {
  query: string;
  method: 'vector' | 'keyword' | 'graph' | 'hybrid';
  results: Array<{
    entityId: string;
    score: number;
    snippet: string;
  }>;
  candidatesConsidered: number;
  latencyMs: number;
}

export interface SynthesisEvidence {
  request: string;
  output: string;
  model: {
    provider: string;
    modelId: string;
    temperature?: number;
  };
  tokens: {
    input: number;
    output: number;
  };
  synthesisType: 'answer' | 'explanation' | 'code' | 'summary';
}

export interface ClaimEvidence {
  claim: string;
  category: 'existence' | 'relationship' | 'behavior' | 'quality' | 'recommendation';
  subject: {
    type: 'file' | 'function' | 'class' | 'pattern' | 'system';
    identifier: string;
  };
  supportingEvidence: EvidenceId[];
  knownDefeaters: EvidenceId[];
  confidence: ConfidenceValue;
}

export interface VerificationEvidence {
  claimId: EvidenceId;
  method: 'test' | 'static_analysis' | 'runtime_check' | 'human_review';
  result: 'verified' | 'refuted' | 'inconclusive';
  details: string;
}

export interface ContradictionEvidence {
  claimA: EvidenceId;
  claimB: EvidenceId;
  contradictionType: 'direct' | 'implicational' | 'temporal' | 'scope';
  explanation: string;
  severity: 'blocking' | 'significant' | 'minor';
}

export interface FeedbackEvidence {
  targetId: EvidenceId;
  feedbackType: 'correct' | 'incorrect' | 'helpful' | 'unhelpful' | 'unclear';
  source: 'user' | 'agent' | 'system';
  comment?: string;
}

export interface OutcomeEvidence {
  predictionId: EvidenceId;
  predicted: {
    claim: string;
    confidence: ConfidenceValue;
  };
  actual: {
    outcome: 'correct' | 'incorrect' | 'partial' | 'unknown';
    observation: string;
  };
  verificationMethod: 'user_feedback' | 'test_result' | 'system_observation';
}

export interface ToolCallEvidence {
  toolName: string;
  toolVersion?: string;
  arguments: Record<string, unknown>;
  result: unknown;
  success: boolean;
  durationMs: number;
  errorMessage?: string;
}

export interface EpisodeEvidence {
  query: string;
  stages: Array<{
    name: string;
    durationMs: number;
    success: boolean;
  }>;
  totalDurationMs: number;
  retrievedEntities: number;
  synthesizedResponse: boolean;
}

export interface CalibrationEvidence {
  operationType: string;
  predictions: Array<{
    predicted: number;
    actual: boolean;
  }>;
  ece: number;
  brierScore: number;
  sampleSize: number;
}

export type EvidencePayload =
  | ExtractionEvidence
  | RetrievalEvidence
  | SynthesisEvidence
  | ClaimEvidence
  | VerificationEvidence
  | ContradictionEvidence
  | FeedbackEvidence
  | OutcomeEvidence
  | ToolCallEvidence
  | EpisodeEvidence
  | CalibrationEvidence;

// ============================================================================
// EVIDENCE ENTRY
// ============================================================================

/**
 * An immutable entry in the evidence ledger.
 *
 * INVARIANT: Once created, an entry is never modified
 * INVARIANT: entry.id is globally unique within the ledger
 */
export interface EvidenceEntry {
  id: EvidenceId;
  timestamp: Date;
  kind: EvidenceKind;
  payload: EvidencePayload;
  provenance: EvidenceProvenance;
  confidence?: ConfidenceValue;
  relatedEntries: EvidenceId[];
  sessionId?: SessionId;
}

// ============================================================================
// EVIDENCE CHAIN
// ============================================================================

export interface EvidenceChain {
  root: EvidenceEntry;
  evidence: EvidenceEntry[];
  graph: Map<EvidenceId, EvidenceId[]>;
  chainConfidence: ConfidenceValue;
  contradictions: ContradictionEvidence[];
}

// ============================================================================
// QUERY INTERFACE
// ============================================================================

export interface EvidenceQuery {
  kinds?: EvidenceKind[];
  timeRange?: {
    from?: Date;
    to?: Date;
  };
  sessionId?: SessionId;
  source?: ProvenanceSource;
  textSearch?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'confidence';
  orderDirection?: 'asc' | 'desc';
}

export interface EvidenceFilter {
  kinds?: EvidenceKind[];
  sessionId?: SessionId;
}

export type Unsubscribe = () => void;

// ============================================================================
// LEDGER INTERFACE
// ============================================================================

/**
 * The Evidence Ledger - append-only storage for all epistemic events.
 *
 * INVARIANT: All append operations are atomic
 * INVARIANT: Query operations are eventually consistent
 * INVARIANT: No entry can be deleted or modified after append
 */
export interface IEvidenceLedger {
  append(entry: Omit<EvidenceEntry, 'id' | 'timestamp'>): Promise<EvidenceEntry>;
  appendBatch(entries: Omit<EvidenceEntry, 'id' | 'timestamp'>[]): Promise<EvidenceEntry[]>;
  query(criteria: EvidenceQuery): Promise<EvidenceEntry[]>;
  get(id: EvidenceId): Promise<EvidenceEntry | null>;
  getChain(claimId: EvidenceId): Promise<EvidenceChain>;
  getSessionEntries(sessionId: SessionId): Promise<EvidenceEntry[]>;
  subscribe(filter: EvidenceFilter, callback: (entry: EvidenceEntry) => void): Unsubscribe;
}

// ============================================================================
// SQLITE IMPLEMENTATION
// ============================================================================

interface LedgerRow {
  id: string;
  timestamp: string;
  kind: string;
  payload: string;
  provenance: string;
  confidence: string | null;
  related_entries: string;
  session_id: string | null;
}

/**
 * SQLite implementation of the evidence ledger.
 *
 * PRECONDITION: Database connection is open and writable
 * POSTCONDITION: All appends are durable (WAL mode)
 * INVARIANT: No data loss on crash
 */
export class SqliteEvidenceLedger implements IEvidenceLedger {
  private db: Database.Database | null = null;
  private initialized = false;
  private subscribers: Map<string, { filter: EvidenceFilter; callback: (entry: EvidenceEntry) => void }> =
    new Map();

  constructor(private dbPath: string) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const BetterSqlite3 = (await import('better-sqlite3')).default;
    this.db = new BetterSqlite3(this.dbPath);

    // Enable WAL mode for durability and concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');

    this.createTables();
    this.initialized = true;
  }

  private createTables(): void {
    if (!this.db) throw new Error('unverified_by_trace(ledger_not_initialized)');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS evidence_ledger (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        provenance TEXT NOT NULL,
        confidence TEXT,
        related_entries TEXT NOT NULL DEFAULT '[]',
        session_id TEXT,

        CONSTRAINT valid_kind CHECK (kind IN (
          'extraction', 'retrieval', 'synthesis', 'claim',
          'verification', 'contradiction', 'feedback',
          'outcome', 'tool_call', 'episode', 'calibration'
        ))
      );

      CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON evidence_ledger(timestamp);
      CREATE INDEX IF NOT EXISTS idx_ledger_kind ON evidence_ledger(kind);
      CREATE INDEX IF NOT EXISTS idx_ledger_session ON evidence_ledger(session_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_kind_timestamp ON evidence_ledger(kind, timestamp);
    `);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
    this.subscribers.clear();
  }

  async append(entry: Omit<EvidenceEntry, 'id' | 'timestamp'>): Promise<EvidenceEntry> {
    if (!this.db) throw new Error('unverified_by_trace(ledger_not_initialized)');

    const id = createEvidenceId();
    const timestamp = new Date();

    const fullEntry: EvidenceEntry = {
      ...entry,
      id,
      timestamp,
    };

    this.db
      .prepare(
        `
      INSERT INTO evidence_ledger (id, timestamp, kind, payload, provenance, confidence, related_entries, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        timestamp.toISOString(),
        entry.kind,
        JSON.stringify(entry.payload),
        JSON.stringify(entry.provenance),
        entry.confidence ? JSON.stringify(entry.confidence) : null,
        JSON.stringify(entry.relatedEntries),
        entry.sessionId ?? null
      );

    // Notify subscribers
    this.notifySubscribers(fullEntry);

    return fullEntry;
  }

  async appendBatch(entries: Omit<EvidenceEntry, 'id' | 'timestamp'>[]): Promise<EvidenceEntry[]> {
    if (!this.db) throw new Error('unverified_by_trace(ledger_not_initialized)');

    const fullEntries: EvidenceEntry[] = [];
    const timestamp = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO evidence_ledger (id, timestamp, kind, payload, provenance, confidence, related_entries, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((entries: Omit<EvidenceEntry, 'id' | 'timestamp'>[]) => {
      for (const entry of entries) {
        const id = createEvidenceId();
        const fullEntry: EvidenceEntry = { ...entry, id, timestamp };
        fullEntries.push(fullEntry);

        stmt.run(
          id,
          timestamp.toISOString(),
          entry.kind,
          JSON.stringify(entry.payload),
          JSON.stringify(entry.provenance),
          entry.confidence ? JSON.stringify(entry.confidence) : null,
          JSON.stringify(entry.relatedEntries),
          entry.sessionId ?? null
        );
      }
    });

    insertMany(entries);

    // Notify subscribers for each entry
    for (const entry of fullEntries) {
      this.notifySubscribers(entry);
    }

    return fullEntries;
  }

  async query(criteria: EvidenceQuery): Promise<EvidenceEntry[]> {
    if (!this.db) throw new Error('unverified_by_trace(ledger_not_initialized)');

    let sql = 'SELECT * FROM evidence_ledger WHERE 1=1';
    const params: unknown[] = [];

    if (criteria.kinds && criteria.kinds.length > 0) {
      sql += ` AND kind IN (${criteria.kinds.map(() => '?').join(', ')})`;
      params.push(...criteria.kinds);
    }

    if (criteria.timeRange?.from) {
      sql += ' AND timestamp >= ?';
      params.push(criteria.timeRange.from.toISOString());
    }

    if (criteria.timeRange?.to) {
      sql += ' AND timestamp <= ?';
      params.push(criteria.timeRange.to.toISOString());
    }

    if (criteria.sessionId) {
      sql += ' AND session_id = ?';
      params.push(criteria.sessionId);
    }

    if (criteria.source) {
      sql += " AND json_extract(provenance, '$.source') = ?";
      params.push(criteria.source);
    }

    if (criteria.textSearch) {
      sql += ' AND payload LIKE ?';
      params.push(`%${criteria.textSearch}%`);
    }

    const orderBy = criteria.orderBy ?? 'timestamp';
    const orderDir = criteria.orderDirection ?? 'desc';
    sql += ` ORDER BY ${orderBy} ${orderDir.toUpperCase()}`;

    // SQLite requires LIMIT when using OFFSET, so we need to handle this
    if (criteria.limit || criteria.offset) {
      // Use provided limit or a very large number if only offset is specified
      const effectiveLimit = criteria.limit ?? -1; // SQLite: -1 means no limit
      sql += ' LIMIT ?';
      params.push(effectiveLimit);

      if (criteria.offset) {
        sql += ' OFFSET ?';
        params.push(criteria.offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params) as LedgerRow[];
    return rows.map((row) => this.rowToEntry(row));
  }

  async get(id: EvidenceId): Promise<EvidenceEntry | null> {
    if (!this.db) throw new Error('unverified_by_trace(ledger_not_initialized)');

    const row = this.db.prepare('SELECT * FROM evidence_ledger WHERE id = ?').get(id) as
      | LedgerRow
      | undefined;
    return row ? this.rowToEntry(row) : null;
  }

  async getChain(claimId: EvidenceId): Promise<EvidenceChain> {
    const root = await this.get(claimId);
    if (!root) {
      throw new Error(`unverified_by_trace(claim_not_found): ${claimId}`);
    }

    const visited = new Set<string>();
    const evidence: EvidenceEntry[] = [];
    const graph = new Map<EvidenceId, EvidenceId[]>();
    const contradictions: ContradictionEvidence[] = [];

    // BFS to collect all related evidence
    const queue: EvidenceId[] = [claimId];
    visited.add(claimId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const entry = currentId === claimId ? root : await this.get(currentId);
      if (!entry) continue;

      evidence.push(entry);
      graph.set(currentId, entry.relatedEntries);

      // Check for contradictions
      if (entry.kind === 'contradiction') {
        contradictions.push(entry.payload as ContradictionEvidence);
      }

      for (const relatedId of entry.relatedEntries) {
        if (!visited.has(relatedId)) {
          visited.add(relatedId);
          queue.push(relatedId);
        }
      }
    }

    // Compute chain confidence (minimum of all deterministic/derived, absent if any absent)
    const chainConfidence = this.computeChainConfidence(evidence);

    return {
      root,
      evidence,
      graph,
      chainConfidence,
      contradictions,
    };
  }

  private computeChainConfidence(entries: EvidenceEntry[]): ConfidenceValue {
    const confidences = entries
      .filter((e) => e.confidence)
      .map((e) => e.confidence!);

    if (confidences.length === 0) {
      return { type: 'absent', reason: 'insufficient_data' };
    }

    // If any confidence is absent, chain is absent
    if (confidences.some((c) => c.type === 'absent')) {
      return { type: 'absent', reason: 'uncalibrated' };
    }

    // Compute minimum for derived chain
    const values = confidences.map((c) => {
      switch (c.type) {
        case 'deterministic':
        case 'derived':
        case 'measured':
          return c.value;
        case 'bounded':
          return c.low;
        default:
          return 0;
      }
    });

    const minValue = Math.min(...values);

    return {
      type: 'derived',
      value: minValue,
      formula: 'min(chain_entries)',
      inputs: entries
        .filter((e) => e.confidence)
        .map((e) => ({
          name: e.id,
          confidence: e.confidence!,
        })),
    };
  }

  async getSessionEntries(sessionId: SessionId): Promise<EvidenceEntry[]> {
    return this.query({ sessionId, orderBy: 'timestamp', orderDirection: 'asc' });
  }

  subscribe(filter: EvidenceFilter, callback: (entry: EvidenceEntry) => void): Unsubscribe {
    const id = `sub_${randomUUID()}`;
    this.subscribers.set(id, { filter, callback });

    return () => {
      this.subscribers.delete(id);
    };
  }

  private notifySubscribers(entry: EvidenceEntry): void {
    for (const { filter, callback } of this.subscribers.values()) {
      // Check if entry matches filter
      if (filter.kinds && !filter.kinds.includes(entry.kind)) continue;
      if (filter.sessionId && entry.sessionId !== filter.sessionId) continue;

      try {
        callback(entry);
      } catch {
        // Subscriber errors should not break the ledger
      }
    }
  }

  private rowToEntry(row: LedgerRow): EvidenceEntry {
    return {
      id: row.id as EvidenceId,
      timestamp: new Date(row.timestamp),
      kind: row.kind as EvidenceKind,
      payload: JSON.parse(row.payload) as EvidencePayload,
      provenance: JSON.parse(row.provenance) as EvidenceProvenance,
      confidence: row.confidence ? (JSON.parse(row.confidence) as ConfidenceValue) : undefined,
      relatedEntries: JSON.parse(row.related_entries) as EvidenceId[],
      sessionId: row.session_id ? (row.session_id as SessionId) : undefined,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createEvidenceLedger(dbPath: string): SqliteEvidenceLedger {
  return new SqliteEvidenceLedger(dbPath);
}
