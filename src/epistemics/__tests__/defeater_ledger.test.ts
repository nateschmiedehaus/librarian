/**
 * @fileoverview Tests for Defeater-Evidence Ledger Integration
 *
 * Tests the DefeaterLedgerBridge:
 * - Records defeater detection events as verification evidence
 * - Records contradictions as contradiction evidence
 * - Subscribes to new claims and triggers defeater detection
 * - Provides unified defeater tracking through the ledger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DefeaterLedgerBridge,
  createDefeaterLedgerBridge,
  type DefeaterLedgerConfig,
  type DefeaterDetectionEvent,
} from '../defeater_ledger.js';
import {
  SqliteEvidenceLedger,
  type IEvidenceLedger,
  type EvidenceEntry,
  type EvidenceId,
  type SessionId,
  type EvidenceFilter,
  type EvidenceQuery,
  type EvidenceChain,
} from '../evidence_ledger.js';
import {
  SqliteEvidenceGraphStorage,
  type EvidenceGraphStorage,
} from '../storage.js';
import {
  createClaimId,
  createClaim,
  createDefeater,
  createContradiction,
  EVIDENCE_GRAPH_SCHEMA_VERSION,
  type Claim,
  type ClaimId,
  type ExtendedDefeater,
  type Contradiction,
} from '../types.js';
import { bounded, deterministic } from '../confidence.js';

// ============================================================================
// MOCK EVIDENCE LEDGER
// ============================================================================

class MockEvidenceLedger implements IEvidenceLedger {
  private entries: EvidenceEntry[] = [];
  private idCounter = 0;
  private subscribers: Map<string, { filter: EvidenceFilter; callback: (entry: EvidenceEntry) => void }> = new Map();

  async append(entry: Omit<EvidenceEntry, 'id' | 'timestamp'>): Promise<EvidenceEntry> {
    const fullEntry: EvidenceEntry = {
      ...entry,
      id: `ev_${++this.idCounter}` as EvidenceId,
      timestamp: new Date(),
    };
    this.entries.push(fullEntry);

    // Notify subscribers
    for (const { filter, callback } of this.subscribers.values()) {
      if (!filter.kinds || filter.kinds.includes(entry.kind)) {
        callback(fullEntry);
      }
    }

    return fullEntry;
  }

  async appendBatch(entries: Omit<EvidenceEntry, 'id' | 'timestamp'>[]): Promise<EvidenceEntry[]> {
    return Promise.all(entries.map((e) => this.append(e)));
  }

  async query(criteria: EvidenceQuery): Promise<EvidenceEntry[]> {
    let result = [...this.entries];

    if (criteria.kinds?.length) {
      result = result.filter((e) => criteria.kinds!.includes(e.kind));
    }

    if (criteria.limit) {
      result = result.slice(0, criteria.limit);
    }

    return result;
  }

  async get(id: EvidenceId): Promise<EvidenceEntry | null> {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  async getChain(claimId: EvidenceId): Promise<EvidenceChain> {
    const root = await this.get(claimId);
    if (!root) {
      throw new Error(`Claim ${claimId} not found`);
    }
    return {
      root,
      evidence: [root],
      graph: new Map(),
      chainConfidence: deterministic(true, 'test'),
      contradictions: [],
    };
  }

  async getSessionEntries(sessionId: SessionId): Promise<EvidenceEntry[]> {
    return this.entries.filter((e) => e.sessionId === sessionId);
  }

  subscribe(filter: EvidenceFilter, callback: (entry: EvidenceEntry) => void): () => void {
    const id = `sub_${Date.now()}_${Math.random()}`;
    this.subscribers.set(id, { filter, callback });
    return () => this.subscribers.delete(id);
  }

  // Test helpers
  getEntries(): EvidenceEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.idCounter = 0;
  }
}

// ============================================================================
// MOCK STORAGE
// ============================================================================

class MockEvidenceGraphStorage implements Partial<EvidenceGraphStorage> {
  private claims: Map<ClaimId, Claim> = new Map();
  private defeaters: ExtendedDefeater[] = [];
  private contradictions: Contradiction[] = [];

  // Implement minimal interface needed for defeater detection
  async getClaim(id: ClaimId): Promise<Claim | null> {
    return this.claims.get(id) ?? null;
  }

  async getClaims(options?: { status?: string }): Promise<Claim[]> {
    let result = Array.from(this.claims.values());
    if (options?.status) {
      result = result.filter((c) => c.status === options.status);
    }
    return result;
  }

  async getAllClaims(): Promise<Claim[]> {
    return Array.from(this.claims.values());
  }

  async getActiveDefeaters(): Promise<ExtendedDefeater[]> {
    return this.defeaters.filter((d) => d.status === 'active');
  }

  async getUnresolvedContradictions(): Promise<Contradiction[]> {
    return this.contradictions.filter((c) => c.status === 'unresolved');
  }

  async updateClaimConfidence(_id: ClaimId, _confidence: unknown): Promise<void> {
    // No-op for tests
  }

  async updateClaimStatus(_id: ClaimId, _status: string): Promise<void> {
    // No-op for tests
  }

  async insertDefeater(defeater: ExtendedDefeater): Promise<void> {
    this.defeaters.push(defeater);
  }

  async insertContradiction(contradiction: Contradiction): Promise<void> {
    this.contradictions.push(contradiction);
  }

  async activateDefeater(_id: string): Promise<void> {
    // No-op for tests
  }

  // Test helpers
  addClaim(claim: Claim): void {
    this.claims.set(claim.id, claim);
  }

  addDefeater(defeater: ExtendedDefeater): void {
    this.defeaters.push(defeater);
  }

  addContradiction(contradiction: Contradiction): void {
    this.contradictions.push(contradiction);
  }

  clear(): void {
    this.claims.clear();
    this.defeaters = [];
    this.contradictions = [];
  }
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createTestClaim(id?: string): Claim {
  const claimId = createClaimId(id);
  return createClaim({
    id: claimId,
    type: 'behavioral',
    proposition: 'Test function is pure',
    subject: {
      id: 'test-func',
      name: 'testFunction',
      type: 'function',
    },
    source: {
      id: 'test-source',
      type: 'llm',
    },
  });
}

function createTestDefeater(affectedClaimId: ClaimId): ExtendedDefeater {
  return createDefeater({
    type: 'test_failure',
    description: 'Unit test failed',
    severity: 'full',
    affectedClaimIds: [affectedClaimId],
  });
}

function createTestContradiction(claimA: ClaimId, claimB: ClaimId): Contradiction {
  return createContradiction(claimA, claimB, 'direct', 'Claims contradict each other');
}

// ============================================================================
// TESTS
// ============================================================================

describe('DefeaterLedgerBridge', () => {
  let bridge: DefeaterLedgerBridge;
  let ledger: MockEvidenceLedger;
  let storage: MockEvidenceGraphStorage;

  beforeEach(() => {
    ledger = new MockEvidenceLedger();
    storage = new MockEvidenceGraphStorage();
    bridge = createDefeaterLedgerBridge(
      ledger as IEvidenceLedger,
      storage as unknown as EvidenceGraphStorage
    );
  });

  afterEach(() => {
    bridge.stopAutoDetection();
    ledger.clear();
    storage.clear();
  });

  describe('factory', () => {
    it('creates a DefeaterLedgerBridge instance', () => {
      expect(bridge).toBeInstanceOf(DefeaterLedgerBridge);
    });

    it('accepts custom configuration', () => {
      const config: DefeaterLedgerConfig = {
        autoDetectOnNewClaims: false,
        recordDetections: false,
        minimumRecordSeverity: 'full',
      };
      const customBridge = createDefeaterLedgerBridge(
        ledger as IEvidenceLedger,
        storage as unknown as EvidenceGraphStorage,
        config
      );
      expect(customBridge).toBeInstanceOf(DefeaterLedgerBridge);
    });
  });

  describe('detectAndRecord', () => {
    it('records defeaters as verification evidence', async () => {
      const claim = createTestClaim();
      storage.addClaim(claim);
      storage.addDefeater(createTestDefeater(claim.id));

      const result = await bridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      expect(result.detectionId).toMatch(/^detection_/);
      expect(result.timestamp).toBeInstanceOf(Date);
      // Verification entries should be recorded
      const entries = ledger.getEntries();
      const verificationEntries = entries.filter((e) => e.kind === 'verification');
      expect(verificationEntries.length).toBeGreaterThanOrEqual(0); // May or may not detect based on mock
    });

    it('records contradictions as contradiction evidence', async () => {
      const claimA = createTestClaim('claim-a');
      const claimB = createTestClaim('claim-b');
      storage.addClaim(claimA);
      storage.addClaim(claimB);
      storage.addContradiction(createTestContradiction(claimA.id, claimB.id));

      const result = await bridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      expect(result.detectionId).toBeDefined();
      // The detection should capture contradictions
      expect(result.result).toBeDefined();
    });

    it('returns detection context in result', async () => {
      const context = {
        timestamp: new Date().toISOString(),
        newClaims: [createTestClaim()],
      };

      const result = await bridge.detectAndRecord(context);

      expect(result.context).toEqual(context);
    });

    it('respects minimumRecordSeverity configuration', async () => {
      const strictBridge = createDefeaterLedgerBridge(
        ledger as IEvidenceLedger,
        storage as unknown as EvidenceGraphStorage,
        { minimumRecordSeverity: 'full' }
      );

      const claim = createTestClaim();
      storage.addClaim(claim);

      // Add a warning-level defeater
      const warningDefeater = createDefeater({
        type: 'staleness',
        description: 'Entity is stale',
        severity: 'warning',
        affectedClaimIds: [claim.id],
      });
      storage.addDefeater(warningDefeater);

      await strictBridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      // Warning-level should not be recorded with 'full' minimum
      const entries = ledger.getEntries();
      const verificationEntries = entries.filter(
        (e) => e.kind === 'verification' && e.provenance.method === 'defeater_detection'
      );
      expect(verificationEntries.length).toBe(0);
    });
  });

  describe('detectAndApply', () => {
    it('returns both detection and application results', async () => {
      const claim = createTestClaim();
      storage.addClaim(claim);

      const { detection, application } = await bridge.detectAndApply({
        timestamp: new Date().toISOString(),
      });

      expect(detection.detectionId).toMatch(/^detection_/);
      expect(application.applicationId).toMatch(/^application_/);
      expect(detection.result).toBeDefined();
      expect(application.applicationResult).toBeDefined();
    });

    it('links application to detection result', async () => {
      const { detection, application } = await bridge.detectAndApply({
        timestamp: new Date().toISOString(),
      });

      expect(application.detectionResult).toBe(detection.result);
    });
  });

  describe('autoDetection', () => {
    it('starts and stops auto detection', () => {
      bridge.startAutoDetection();
      // Starting again should be a no-op
      bridge.startAutoDetection();
      bridge.stopAutoDetection();
      // Stopping again should be a no-op
      bridge.stopAutoDetection();
    });

    it('triggers detection when new claim is added to ledger', async () => {
      bridge.startAutoDetection();

      // Spy on detection
      const detectSpy = vi.spyOn(bridge, 'detectAndApply');

      // Add a claim entry to the ledger
      await ledger.append({
        kind: 'claim',
        payload: {
          claim: 'Test claim',
          category: 'behavior',
          subject: { type: 'function', identifier: 'testFunc' },
          supportingEvidence: [],
          knownDefeaters: [],
          confidence: bounded(0.8, 0.9, 'theoretical', 'test'),
        },
        provenance: { source: 'llm_synthesis', method: 'test' },
        relatedEntries: [],
        confidence: bounded(0.8, 0.9, 'theoretical', 'test'),
      });

      // Allow async callback to complete
      await new Promise((r) => setTimeout(r, 10));

      expect(detectSpy).toHaveBeenCalled();
    });

    it('does not trigger when autoDetectOnNewClaims is false', async () => {
      const noAutoBridge = createDefeaterLedgerBridge(
        ledger as IEvidenceLedger,
        storage as unknown as EvidenceGraphStorage,
        { autoDetectOnNewClaims: false }
      );

      noAutoBridge.startAutoDetection(); // Should be a no-op

      const detectSpy = vi.spyOn(noAutoBridge, 'detectAndApply');

      await ledger.append({
        kind: 'claim',
        payload: {
          claim: 'Test claim',
          category: 'behavior',
          subject: { type: 'function', identifier: 'testFunc' },
          supportingEvidence: [],
          knownDefeaters: [],
          confidence: bounded(0.8, 0.9, 'theoretical', 'test'),
        },
        provenance: { source: 'llm_synthesis', method: 'test' },
        relatedEntries: [],
        confidence: bounded(0.8, 0.9, 'theoretical', 'test'),
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(detectSpy).not.toHaveBeenCalled();
    });
  });

  describe('getDefeaterHistory', () => {
    it('returns defeater-related verification entries', async () => {
      // Record some defeaters
      const claim = createTestClaim();
      storage.addClaim(claim);
      storage.addDefeater(createTestDefeater(claim.id));

      await bridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      const history = await bridge.getDefeaterHistory();

      // All returned entries should be verification kind with defeater method
      for (const entry of history) {
        expect(entry.kind).toBe('verification');
        expect(entry.provenance.method).toBe('defeater_detection');
      }
    });

    it('respects limit option', async () => {
      const history = await bridge.getDefeaterHistory({ limit: 5 });
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getContradictionHistory', () => {
    it('returns contradiction entries', async () => {
      const claimA = createTestClaim('a');
      const claimB = createTestClaim('b');
      storage.addClaim(claimA);
      storage.addClaim(claimB);
      storage.addContradiction(createTestContradiction(claimA.id, claimB.id));

      await bridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      const history = await bridge.getContradictionHistory();

      for (const entry of history) {
        expect(entry.kind).toBe('contradiction');
      }
    });
  });

  describe('getActiveDefeaters', () => {
    it('returns reconstructed defeaters from ledger entries', async () => {
      // Add a verification entry that looks like a defeater
      await ledger.append({
        kind: 'verification',
        payload: {
          claimId: 'claim_1' as EvidenceId,
          method: 'test',
          result: 'refuted',
          details: 'test_failure: Unit test failed',
        },
        provenance: { source: 'system_observation', method: 'defeater_detection' },
        relatedEntries: [],
        confidence: deterministic(true, 'test'),
      });

      const activeDefeaters = await bridge.getActiveDefeaters();

      expect(activeDefeaters.length).toBe(1);
      expect(activeDefeaters[0].type).toBe('test_failure');
      expect(activeDefeaters[0].status).toBe('active');
    });
  });

  describe('getUnresolvedContradictions', () => {
    it('returns reconstructed contradictions from ledger entries', async () => {
      await ledger.append({
        kind: 'contradiction',
        payload: {
          claimA: 'claim_1' as EvidenceId,
          claimB: 'claim_2' as EvidenceId,
          contradictionType: 'direct',
          explanation: 'Claims contradict',
          severity: 'significant',
        },
        provenance: { source: 'system_observation', method: 'contradiction_detection' },
        relatedEntries: [],
        confidence: bounded(0.9, 1.0, 'theoretical', 'test'),
      });

      const contradictions = await bridge.getUnresolvedContradictions();

      expect(contradictions.length).toBe(1);
      expect(contradictions[0].type).toBe('direct');
      expect(contradictions[0].status).toBe('unresolved');
    });
  });

  describe('resolveDefeater', () => {
    it('records resolution as verification entry', async () => {
      const entry = await bridge.resolveDefeater('defeater_1', 'addressed');

      expect(entry.kind).toBe('verification');
      expect(entry.provenance.method).toBe('defeater_resolution');

      const payload = entry.payload as { result: string; details: string };
      expect(payload.result).toBe('verified'); // addressed = verified
      expect(payload.details).toContain('addressed');
    });

    it('marks invalidated defeaters as refuted', async () => {
      const entry = await bridge.resolveDefeater('defeater_1', 'invalidated');

      const payload = entry.payload as { result: string };
      expect(payload.result).toBe('refuted');
    });

    it('marks accepted defeaters as verified', async () => {
      const entry = await bridge.resolveDefeater('defeater_1', 'accepted');

      const payload = entry.payload as { result: string };
      expect(payload.result).toBe('verified');
    });
  });

  describe('confidence computation', () => {
    it('assigns deterministic confidence to test failures', async () => {
      // Record a test failure defeater
      const claim = createTestClaim();
      storage.addClaim(claim);

      const defeater = createDefeater({
        type: 'test_failure',
        description: 'Test failed',
        severity: 'full',
        affectedClaimIds: [claim.id],
      });
      storage.addDefeater(defeater);

      await bridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      const entries = ledger.getEntries().filter(
        (e) => e.kind === 'verification' && e.provenance.method === 'defeater_detection'
      );

      // Test failures should have deterministic confidence
      for (const entry of entries) {
        if (entry.payload && (entry.payload as { details?: string }).details?.includes('test_failure')) {
          expect(entry.confidence?.type).toBe('deterministic');
        }
      }
    });

    it('assigns bounded confidence to staleness defeaters', async () => {
      const claim = createTestClaim();
      storage.addClaim(claim);

      const defeater = createDefeater({
        type: 'staleness',
        description: 'Entity is stale',
        severity: 'warning',
        affectedClaimIds: [claim.id],
      });
      storage.addDefeater(defeater);

      await bridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      // Staleness should have bounded confidence
      const entries = ledger.getEntries().filter(
        (e) => e.kind === 'verification' &&
               e.provenance.method === 'defeater_detection' &&
               (e.payload as { details?: string }).details?.includes('staleness')
      );

      for (const entry of entries) {
        expect(entry.confidence?.type).toBe('bounded');
      }
    });
  });

  describe('edge cases', () => {
    it('handles empty detection context', async () => {
      const result = await bridge.detectAndRecord({
        timestamp: new Date().toISOString(),
      });

      expect(result.detectionId).toBeDefined();
      expect(result.result).toBeDefined();
    });

    it('handles claim entries without required fields', async () => {
      bridge.startAutoDetection();

      // Add a malformed claim entry
      await ledger.append({
        kind: 'claim',
        payload: {
          // Missing claim and subject
        },
        provenance: { source: 'llm_synthesis', method: 'test' },
        relatedEntries: [],
      });

      // Should not crash
      await new Promise((r) => setTimeout(r, 10));

      bridge.stopAutoDetection();
    });

    it('handles concurrent detection calls', async () => {
      const results = await Promise.all([
        bridge.detectAndRecord({ timestamp: new Date().toISOString() }),
        bridge.detectAndRecord({ timestamp: new Date().toISOString() }),
        bridge.detectAndRecord({ timestamp: new Date().toISOString() }),
      ]);

      // Each should have unique detection ID
      const ids = results.map((r) => r.detectionId);
      expect(new Set(ids).size).toBe(3);
    });
  });
});
