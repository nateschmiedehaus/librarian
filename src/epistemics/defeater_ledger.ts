/**
 * @fileoverview Defeater-Evidence Ledger Integration
 *
 * Bridges the Defeater Calculus Engine with the Evidence Ledger:
 * - Records defeater detection events as verification evidence
 * - Records contradictions as contradiction evidence
 * - Subscribes to new claims and triggers defeater detection
 * - Provides unified defeater tracking through the ledger
 *
 * @packageDocumentation
 */

import type {
  IEvidenceLedger,
  EvidenceEntry,
  EvidenceId,
  SessionId,
  ContradictionEvidence,
  VerificationEvidence,
} from './evidence_ledger.js';
import { createSessionId } from './evidence_ledger.js';
import type {
  DetectionResult,
  DetectionContext,
  ApplicationResult,
  DefeaterEngineConfig,
} from './defeaters.js';
import {
  detectDefeaters,
  applyDefeaters,
  DEFAULT_DEFEATER_CONFIG,
} from './defeaters.js';
import type { EvidenceGraphStorage } from './storage.js';
import type {
  ExtendedDefeater,
  Contradiction,
  ClaimId,
  Claim,
  DecomposedConfidence,
} from './types.js';
import { EVIDENCE_GRAPH_SCHEMA_VERSION } from './types.js';
import type { ConfidenceValue } from './confidence.js';
import { deterministic, bounded } from './confidence.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for the defeater-ledger integration.
 */
export interface DefeaterLedgerConfig {
  /** Defeater engine configuration */
  defeaterConfig?: DefeaterEngineConfig;

  /** Whether to automatically detect defeaters on new claims */
  autoDetectOnNewClaims?: boolean;

  /** Whether to record all defeater detections to the ledger */
  recordDetections?: boolean;

  /** Whether to record all applications to the ledger */
  recordApplications?: boolean;

  /** Minimum severity to record (warning, partial, full) */
  minimumRecordSeverity?: 'warning' | 'partial' | 'full';
}

const DEFAULT_CONFIG: Required<DefeaterLedgerConfig> = {
  defeaterConfig: DEFAULT_DEFEATER_CONFIG,
  autoDetectOnNewClaims: true,
  recordDetections: true,
  recordApplications: true,
  minimumRecordSeverity: 'warning',
};

/**
 * Defeater detection event recorded to ledger.
 */
export interface DefeaterDetectionEvent {
  detectionId: string;
  timestamp: Date;
  context: DetectionContext;
  result: DetectionResult;
  evidenceEntries: EvidenceId[];
}

/**
 * Defeater application event recorded to ledger.
 */
export interface DefeaterApplicationEvent {
  applicationId: string;
  timestamp: Date;
  detectionResult: DetectionResult;
  applicationResult: ApplicationResult;
  evidenceEntries: EvidenceId[];
}

// ============================================================================
// DEFEATER LEDGER BRIDGE
// ============================================================================

/**
 * Bridges defeater detection with the Evidence Ledger.
 *
 * INVARIANT: All defeater events are recorded to the ledger
 * INVARIANT: New claims trigger automatic defeater detection (when enabled)
 */
export class DefeaterLedgerBridge {
  private config: Required<DefeaterLedgerConfig>;
  private sessionId: SessionId;
  private unsubscribe: (() => void) | null = null;
  private detectionCounter = 0;
  private applicationCounter = 0;

  constructor(
    private ledger: IEvidenceLedger,
    private storage: EvidenceGraphStorage,
    config: DefeaterLedgerConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = createSessionId();
  }

  /**
   * Start listening for new claims and auto-detect defeaters.
   */
  startAutoDetection(): void {
    if (this.unsubscribe) {
      return; // Already listening
    }

    if (!this.config.autoDetectOnNewClaims) {
      return;
    }

    this.unsubscribe = this.ledger.subscribe(
      { kinds: ['claim'] },
      async (entry) => {
        // Extract claim from entry for contradiction detection
        const claim = this.extractClaimFromEntry(entry);
        if (claim) {
          await this.detectAndApply({
            newClaims: [claim],
            timestamp: new Date().toISOString(),
          });
        }
      }
    );
  }

  /**
   * Stop listening for new claims.
   */
  stopAutoDetection(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Detect defeaters and record to ledger.
   */
  async detectAndRecord(context: DetectionContext): Promise<DefeaterDetectionEvent> {
    const detectionId = `detection_${++this.detectionCounter}_${Date.now()}`;
    const timestamp = new Date();

    // Run defeater detection
    const result = await detectDefeaters(
      this.storage,
      context,
      this.config.defeaterConfig
    );

    // Record to ledger
    const evidenceEntries: EvidenceId[] = [];

    if (this.config.recordDetections) {
      // Record each defeater as verification evidence
      for (const defeater of result.defeaters) {
        if (this.shouldRecord(defeater.severity)) {
          const entry = await this.recordDefeater(defeater);
          evidenceEntries.push(entry.id);
        }
      }

      // Record each contradiction as evidence
      for (const contradiction of result.contradictions) {
        const entry = await this.recordContradiction(contradiction);
        evidenceEntries.push(entry.id);
      }
    }

    return {
      detectionId,
      timestamp,
      context,
      result,
      evidenceEntries,
    };
  }

  /**
   * Detect and apply defeaters, recording all to ledger.
   */
  async detectAndApply(context: DetectionContext): Promise<{
    detection: DefeaterDetectionEvent;
    application: DefeaterApplicationEvent;
  }> {
    // Detect defeaters
    const detection = await this.detectAndRecord(context);

    // Apply defeaters
    const applicationId = `application_${++this.applicationCounter}_${Date.now()}`;
    const timestamp = new Date();

    const applicationResult = await applyDefeaters(
      this.storage,
      detection.result,
      this.config.defeaterConfig
    );

    // Record application event
    const applicationEvidenceEntries: EvidenceId[] = [];

    if (this.config.recordApplications && applicationResult.updatedClaims.length > 0) {
      const entry = await this.recordApplicationEvent(detection.result, applicationResult);
      applicationEvidenceEntries.push(entry.id);
    }

    const application: DefeaterApplicationEvent = {
      applicationId,
      timestamp,
      detectionResult: detection.result,
      applicationResult,
      evidenceEntries: applicationEvidenceEntries,
    };

    return { detection, application };
  }

  /**
   * Get defeater history from the ledger (verification entries with defeater method).
   */
  async getDefeaterHistory(options?: {
    limit?: number;
    timeRange?: { from?: Date; to?: Date };
  }): Promise<EvidenceEntry[]> {
    const entries = await this.ledger.query({
      kinds: ['verification'],
      limit: options?.limit ?? 100,
      timeRange: options?.timeRange,
    });

    // Filter to only defeater-related verifications
    return entries.filter((e) => e.provenance.method === 'defeater_detection');
  }

  /**
   * Get contradiction history from the ledger.
   */
  async getContradictionHistory(options?: {
    limit?: number;
    timeRange?: { from?: Date; to?: Date };
  }): Promise<EvidenceEntry[]> {
    return this.ledger.query({
      kinds: ['contradiction'],
      limit: options?.limit ?? 100,
      timeRange: options?.timeRange,
    });
  }

  /**
   * Get active defeaters (not yet resolved).
   */
  async getActiveDefeaters(): Promise<ExtendedDefeater[]> {
    const entries = await this.getDefeaterHistory({ limit: 1000 });

    const defeaters: ExtendedDefeater[] = [];
    for (const entry of entries) {
      const payload = entry.payload as VerificationEvidence;
      if (payload.result === 'refuted') {
        defeaters.push(this.reconstructDefeater(entry));
      }
    }

    return defeaters;
  }

  /**
   * Get unresolved contradictions.
   */
  async getUnresolvedContradictions(): Promise<Contradiction[]> {
    const entries = await this.getContradictionHistory({ limit: 1000 });

    const contradictions: Contradiction[] = [];
    for (const entry of entries) {
      // All logged contradictions are considered unresolved unless explicitly marked
      contradictions.push(this.reconstructContradiction(entry));
    }

    return contradictions;
  }

  /**
   * Mark a defeater as resolved in the ledger.
   */
  async resolveDefeater(
    defeaterId: string,
    resolution: 'invalidated' | 'addressed' | 'accepted'
  ): Promise<EvidenceEntry> {
    // Record resolution as a verification entry
    return this.ledger.append({
      kind: 'verification',
      payload: {
        claimId: defeaterId as unknown as EvidenceId,
        method: 'human_review',
        result: resolution === 'invalidated' ? 'refuted' : 'verified',
        details: `Defeater ${defeaterId} resolved as ${resolution}`,
      } satisfies VerificationEvidence,
      provenance: {
        source: 'system_observation',
        method: 'defeater_resolution',
      },
      relatedEntries: [],
      confidence: deterministic(true, 'manual_resolution'),
      sessionId: this.sessionId,
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private shouldRecord(severity: string): boolean {
    const severityOrder = ['warning', 'partial', 'full'];
    const minIndex = severityOrder.indexOf(this.config.minimumRecordSeverity);
    const actualIndex = severityOrder.indexOf(severity);
    return actualIndex >= minIndex;
  }

  private async recordDefeater(defeater: ExtendedDefeater): Promise<EvidenceEntry> {
    const confidence = this.computeDefeaterConfidence(defeater);

    // Record as verification evidence that refutes the claim
    return this.ledger.append({
      kind: 'verification',
      payload: {
        claimId: defeater.affectedClaimIds[0] as unknown as EvidenceId,
        method: defeater.type === 'test_failure' ? 'test' : 'static_analysis',
        result: defeater.severity === 'full' ? 'refuted' : 'inconclusive',
        details: `${defeater.type}: ${defeater.description}`,
      } satisfies VerificationEvidence,
      provenance: {
        source: 'system_observation',
        method: 'defeater_detection',
      },
      relatedEntries: defeater.affectedClaimIds.map((id) => id as unknown as EvidenceId),
      confidence,
      sessionId: this.sessionId,
    });
  }

  private async recordContradiction(contradiction: Contradiction): Promise<EvidenceEntry> {
    const confidence = this.computeContradictionConfidence(contradiction);

    // Map contradiction type to evidence ledger's type
    const evidenceType = this.mapContradictionType(contradiction.type);

    return this.ledger.append({
      kind: 'contradiction',
      payload: {
        claimA: contradiction.claimA as unknown as EvidenceId,
        claimB: contradiction.claimB as unknown as EvidenceId,
        contradictionType: evidenceType,
        explanation: contradiction.explanation,
        severity: contradiction.severity,
      } satisfies ContradictionEvidence,
      provenance: {
        source: 'system_observation',
        method: 'contradiction_detection',
      },
      relatedEntries: [
        contradiction.claimA as unknown as EvidenceId,
        contradiction.claimB as unknown as EvidenceId,
      ],
      confidence,
      sessionId: this.sessionId,
    });
  }

  private async recordApplicationEvent(
    detection: DetectionResult,
    application: ApplicationResult
  ): Promise<EvidenceEntry> {
    return this.ledger.append({
      kind: 'claim',
      payload: {
        claim: `Applied ${detection.defeaters.length} defeaters affecting ${application.updatedClaims.length} claims`,
        category: 'behavior',
        subject: {
          type: 'system',
          identifier: 'defeater_engine',
        },
        supportingEvidence: [],
        knownDefeaters: [],
        confidence: deterministic(true, 'application_completed'),
      },
      provenance: {
        source: 'system_observation',
        method: 'defeater_application',
      },
      relatedEntries: [],
      confidence: deterministic(true, 'application_completed'),
      sessionId: this.sessionId,
    });
  }

  private computeDefeaterConfidence(defeater: ExtendedDefeater): ConfidenceValue {
    // Confidence in the defeater based on its type and evidence
    switch (defeater.type) {
      case 'test_failure':
        return deterministic(true, 'test_result_observed');
      case 'hash_mismatch':
        return deterministic(true, 'checksum_computed');
      case 'code_change':
        return bounded(0.85, 0.95, 'theoretical', 'code_change_impact_model');
      case 'staleness':
        return bounded(0.7, 0.9, 'theoretical', 'temporal_decay_model');
      case 'provider_unavailable':
        return bounded(0.6, 0.8, 'theoretical', 'provider_dependency_model');
      default:
        return bounded(0.5, 0.8, 'theoretical', 'unknown_defeater_type');
    }
  }

  private computeContradictionConfidence(contradiction: Contradiction): ConfidenceValue {
    // Confidence in the contradiction detection
    switch (contradiction.type) {
      case 'direct':
        return bounded(0.9, 1.0, 'theoretical', 'direct_negation_pattern');
      case 'temporal':
        return bounded(0.8, 0.95, 'theoretical', 'temporal_conflict_model');
      case 'scope':
        return bounded(0.6, 0.8, 'theoretical', 'scope_conflict_heuristic');
      default:
        return bounded(0.5, 0.7, 'theoretical', 'unknown_contradiction_type');
    }
  }

  private mapContradictionType(type: string): 'direct' | 'implicational' | 'temporal' | 'scope' {
    switch (type) {
      case 'direct':
        return 'direct';
      case 'temporal':
        return 'temporal';
      case 'implicational':
        return 'implicational';
      case 'scope':
        return 'scope';
      case 'conditional':
        return 'implicational'; // Map conditional to implicational
      default:
        return 'direct'; // Default
    }
  }

  private extractClaimFromEntry(entry: EvidenceEntry): Claim | null {
    if (entry.kind !== 'claim') {
      return null;
    }

    const payload = entry.payload as {
      claim?: string;
      category?: string;
      subject?: { type?: string; identifier?: string };
    };

    if (!payload.claim || !payload.subject?.identifier) {
      return null;
    }

    // Map subject type to valid ClaimSubject type
    const subjectTypeMap: Record<string, 'file' | 'function' | 'module' | 'directory' | 'entity' | 'repo'> = {
      file: 'file',
      function: 'function',
      class: 'function', // Map class to function as closest equivalent
      pattern: 'module',
      system: 'entity', // Map system to entity
    };

    const subjectType = subjectTypeMap[payload.subject.type ?? 'entity'] ?? 'entity';

    // Reconstruct a minimal Claim object for contradiction detection
    return {
      id: entry.id as unknown as ClaimId,
      type: payload.category === 'behavior' ? 'behavioral' : 'structural',
      proposition: payload.claim,
      subject: {
        id: payload.subject.identifier,
        name: payload.subject.identifier,
        type: subjectType,
      },
      source: {
        id: 'ledger',
        type: 'llm' as const, // Default to llm as a common source
      },
      confidence: {
        overall: 0.8,
        structural: 0.8,
        semantic: 0.8,
        recency: 0.8,
      } as DecomposedConfidence,
      status: 'active',
      createdAt: entry.timestamp.toISOString(),
      schemaVersion: EVIDENCE_GRAPH_SCHEMA_VERSION,
    };
  }

  private reconstructDefeater(entry: EvidenceEntry): ExtendedDefeater {
    const payload = entry.payload as VerificationEvidence;
    return {
      id: entry.id,
      type: this.extractDefeaterType(payload.details),
      description: payload.details,
      severity: payload.result === 'refuted' ? 'full' : 'partial',
      affectedClaimIds: [payload.claimId as unknown as ClaimId],
      confidenceReduction: payload.result === 'refuted' ? 1.0 : 0.2,
      autoResolvable: false,
      status: 'active',
      detectedAt: entry.timestamp.toISOString(),
    };
  }

  private extractDefeaterType(details: string): ExtendedDefeater['type'] {
    const lowerDetails = details.toLowerCase();
    if (lowerDetails.includes('test_failure')) return 'test_failure';
    if (lowerDetails.includes('hash_mismatch')) return 'hash_mismatch';
    if (lowerDetails.includes('code_change')) return 'code_change';
    if (lowerDetails.includes('staleness')) return 'staleness';
    if (lowerDetails.includes('provider')) return 'provider_unavailable';
    return 'staleness'; // Default
  }

  private reconstructContradiction(entry: EvidenceEntry): Contradiction {
    const payload = entry.payload as ContradictionEvidence;
    return {
      id: entry.id,
      claimA: payload.claimA as unknown as ClaimId,
      claimB: payload.claimB as unknown as ClaimId,
      type: payload.contradictionType,
      explanation: payload.explanation,
      severity: payload.severity,
      detectedAt: entry.timestamp.toISOString(),
      status: 'unresolved',
      // Resolution is undefined until explicitly resolved
    };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a defeater-ledger bridge.
 */
export function createDefeaterLedgerBridge(
  ledger: IEvidenceLedger,
  storage: EvidenceGraphStorage,
  config?: DefeaterLedgerConfig
): DefeaterLedgerBridge {
  return new DefeaterLedgerBridge(ledger, storage, config);
}
