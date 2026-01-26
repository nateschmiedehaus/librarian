/**
 * @fileoverview Defeater Calculus Engine
 *
 * Implements Pollock's defeater theory for knowledge validation:
 * - Rebutting defeaters: Direct contradiction of claims
 * - Undercutting defeaters: Attack the justification, not the claim
 * - Undermining defeaters: Reduce confidence without full defeat
 *
 * Key principles:
 * - All defeaters are typed and computed
 * - Contradictions remain visible - never silently reconcile
 * - Supports automatic detection and resolution where safe
 *
 * @packageDocumentation
 */

import {
  type Claim,
  type ClaimId,
  type ExtendedDefeater,
  type ExtendedDefeaterType,
  type DefeaterSeverity,
  type Contradiction,
  type ContradictionType,
  type ClaimSignalStrength,
  type EvidenceGraph,
  createClaimId,
  createDefeater,
  createContradiction,
  computeOverallSignalStrength,
} from './types.js';
import type { EvidenceGraphStorage } from './storage.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Configuration for the defeater engine */
export interface DefeaterEngineConfig {
  /** How old (in ms) before a claim is considered stale */
  stalenessThresholdMs: number;

  /** Minimum signal strength below which claims are auto-defeated */
  minimumSignalStrengthThreshold: number;

  /** Whether to automatically activate detected defeaters */
  autoActivateDefeaters: boolean;

  /** Whether to automatically resolve resolvable defeaters */
  autoResolveDefeaters: boolean;

  /** Maximum defeaters to process in a single batch */
  maxBatchSize: number;
}

/** Default configuration */
export const DEFAULT_DEFEATER_CONFIG: DefeaterEngineConfig = {
  stalenessThresholdMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  minimumSignalStrengthThreshold: 0.1,
  autoActivateDefeaters: true,
  autoResolveDefeaters: false,
  maxBatchSize: 100,
};

// ============================================================================
// DEFEATER DETECTION
// ============================================================================

/** Result of defeater detection */
export interface DetectionResult {
  defeaters: ExtendedDefeater[];
  contradictions: Contradiction[];
  affectedClaimIds: ClaimId[];
}

/** Context for defeater detection */
export interface DetectionContext {
  /** Changed file paths */
  changedFiles?: string[];

  /** Failed test identifiers */
  failedTests?: string[];

  /** New claims to check for contradictions */
  newClaims?: Claim[];

  /** Current timestamp for staleness checks */
  timestamp?: string;

  /** Hash mismatches detected */
  hashMismatches?: Array<{ claimId: ClaimId; expected: string; actual: string }>;

  /** Provider availability status */
  providerStatus?: Record<string, boolean>;
}

/**
 * Detect defeaters based on context.
 * This is the main entry point for defeater detection.
 */
export async function detectDefeaters(
  storage: EvidenceGraphStorage,
  context: DetectionContext,
  config: DefeaterEngineConfig = DEFAULT_DEFEATER_CONFIG
): Promise<DetectionResult> {
  const defeaters: ExtendedDefeater[] = [];
  const contradictions: Contradiction[] = [];
  const affectedClaimIds = new Set<ClaimId>();

  // Detect staleness defeaters
  if (context.timestamp) {
    const stalenessDefeaters = await detectStalenessDefeaters(
      storage,
      context.timestamp,
      config.stalenessThresholdMs
    );
    for (const d of stalenessDefeaters) {
      defeaters.push(d);
      for (const id of d.affectedClaimIds) {
        affectedClaimIds.add(id);
      }
    }
  }

  // Detect code change defeaters
  if (context.changedFiles?.length) {
    const codeChangeDefeaters = await detectCodeChangeDefeaters(
      storage,
      context.changedFiles
    );
    for (const d of codeChangeDefeaters) {
      defeaters.push(d);
      for (const id of d.affectedClaimIds) {
        affectedClaimIds.add(id);
      }
    }
  }

  // Detect test failure defeaters
  if (context.failedTests?.length) {
    const testFailureDefeaters = await detectTestFailureDefeaters(
      storage,
      context.failedTests
    );
    for (const d of testFailureDefeaters) {
      defeaters.push(d);
      for (const id of d.affectedClaimIds) {
        affectedClaimIds.add(id);
      }
    }
  }

  // Detect contradictions from new claims
  if (context.newClaims?.length) {
    const newContradictions = await detectContradictions(storage, context.newClaims);
    for (const c of newContradictions) {
      contradictions.push(c);
      affectedClaimIds.add(c.claimA);
      affectedClaimIds.add(c.claimB);
    }
  }

  // Detect hash mismatch defeaters
  if (context.hashMismatches?.length) {
    const hashDefeaters = detectHashMismatchDefeaters(context.hashMismatches);
    for (const d of hashDefeaters) {
      defeaters.push(d);
      for (const id of d.affectedClaimIds) {
        affectedClaimIds.add(id);
      }
    }
  }

  // Detect provider unavailability defeaters
  if (context.providerStatus) {
    const providerDefeaters = await detectProviderDefeaters(
      storage,
      context.providerStatus
    );
    for (const d of providerDefeaters) {
      defeaters.push(d);
      for (const id of d.affectedClaimIds) {
        affectedClaimIds.add(id);
      }
    }
  }

  return {
    defeaters,
    contradictions,
    affectedClaimIds: Array.from(affectedClaimIds),
  };
}

/**
 * Detect staleness defeaters for claims that haven't been validated recently.
 */
async function detectStalenessDefeaters(
  storage: EvidenceGraphStorage,
  currentTimestamp: string,
  thresholdMs: number
): Promise<ExtendedDefeater[]> {
  const defeaters: ExtendedDefeater[] = [];
  const claims = await storage.getClaims({ status: 'active' });
  const now = new Date(currentTimestamp).getTime();

  for (const claim of claims) {
    const claimTime = new Date(claim.createdAt).getTime();
    const age = now - claimTime;

    if (age > thresholdMs) {
      defeaters.push(
        createDefeater({
          type: 'staleness',
          description: `Claim "${claim.proposition.slice(0, 50)}..." is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old`,
          severity: age > thresholdMs * 2 ? 'partial' : 'warning',
          affectedClaimIds: [claim.id],
          confidenceReduction: Math.min(0.3, (age / thresholdMs - 1) * 0.1),
          autoResolvable: true,
          resolutionAction: 'revalidate',
          evidence: `Created: ${claim.createdAt}, Age: ${age}ms, Threshold: ${thresholdMs}ms`,
        })
      );
    }
  }

  return defeaters;
}

/**
 * Detect defeaters for claims about code that has changed.
 */
async function detectCodeChangeDefeaters(
  storage: EvidenceGraphStorage,
  changedFiles: string[]
): Promise<ExtendedDefeater[]> {
  const defeaters: ExtendedDefeater[] = [];

  for (const file of changedFiles) {
    // Find claims that reference this file
    const claims = await storage.getClaims({ status: 'active' });
    const affectedClaims = claims.filter(
      (c) => c.subject.location?.file === file || c.subject.id.includes(file)
    );

    if (affectedClaims.length > 0) {
      defeaters.push(
        createDefeater({
          type: 'code_change',
          description: `File "${file}" was modified, affecting ${affectedClaims.length} claim(s)`,
          severity: 'partial',
          affectedClaimIds: affectedClaims.map((c) => c.id),
          confidenceReduction: 0.2,
          autoResolvable: true,
          resolutionAction: 'reindex',
          evidence: `Changed file: ${file}`,
        })
      );
    }
  }

  return defeaters;
}

/**
 * Detect defeaters for claims whose tests have failed.
 */
async function detectTestFailureDefeaters(
  storage: EvidenceGraphStorage,
  failedTests: string[]
): Promise<ExtendedDefeater[]> {
  const defeaters: ExtendedDefeater[] = [];

  for (const testId of failedTests) {
    // Find claims with test execution evidence from this test
    const claims = await storage.getClaims({ status: 'active' });
    const affectedClaims = claims.filter(
      (c) =>
        c.source.type === 'test' && c.source.id === testId ||
        c.subject.id === testId
    );

    if (affectedClaims.length > 0) {
      defeaters.push(
        createDefeater({
          type: 'test_failure',
          description: `Test "${testId}" failed, invalidating ${affectedClaims.length} claim(s)`,
          severity: 'full',
          affectedClaimIds: affectedClaims.map((c) => c.id),
          confidenceReduction: 1.0,
          autoResolvable: false,
          evidence: `Failed test: ${testId}`,
        })
      );
    }
  }

  return defeaters;
}

/**
 * Detect contradictions between new claims and existing claims.
 */
async function detectContradictions(
  storage: EvidenceGraphStorage,
  newClaims: Claim[]
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];
  const existingClaims = await storage.getClaims({ status: 'active' });

  for (const newClaim of newClaims) {
    for (const existingClaim of existingClaims) {
      // Skip if same claim
      if (newClaim.id === existingClaim.id) continue;

      // Check for potential contradiction
      const contradictionType = detectContradictionType(newClaim, existingClaim);
      if (contradictionType) {
        contradictions.push(
          createContradiction(
            newClaim.id,
            existingClaim.id,
            contradictionType.type,
            contradictionType.explanation,
            contradictionType.severity
          )
        );
      }
    }
  }

  return contradictions;
}

/**
 * Detect the type of contradiction between two claims, if any.
 */
function detectContradictionType(
  claimA: Claim,
  claimB: Claim
): { type: ContradictionType; explanation: string; severity: 'blocking' | 'significant' | 'minor' } | null {
  // Same subject, same type - potential direct contradiction
  if (
    claimA.subject.id === claimB.subject.id &&
    claimA.type === claimB.type
  ) {
    // Check for semantic opposition indicators
    const aLower = claimA.proposition.toLowerCase();
    const bLower = claimB.proposition.toLowerCase();

    // Direct negation patterns
    if (
      (aLower.includes('not') && !bLower.includes('not')) ||
      (!aLower.includes('not') && bLower.includes('not')) ||
      (aLower.includes("doesn't") && !bLower.includes("doesn't")) ||
      (aLower.includes('never') && bLower.includes('always')) ||
      (aLower.includes('always') && bLower.includes('never'))
    ) {
      return {
        type: 'direct',
        explanation: `Claims make opposing assertions about "${claimA.subject.name}"`,
        severity: 'blocking',
      };
    }

    // Temporal contradiction - same subject, different time assertions
    if (claimA.type === 'temporal' || claimB.type === 'temporal') {
      return {
        type: 'temporal',
        explanation: `Claims make different temporal assertions about "${claimA.subject.name}"`,
        severity: 'significant',
      };
    }

    // Different propositions about same subject - potential scope conflict
    if (claimA.proposition !== claimB.proposition) {
      return {
        type: 'scope',
        explanation: `Claims make different assertions about "${claimA.subject.name}" - may conflict at different scopes`,
        severity: 'minor',
      };
    }
  }

  return null;
}

/**
 * Detect hash mismatch defeaters.
 */
function detectHashMismatchDefeaters(
  mismatches: Array<{ claimId: ClaimId; expected: string; actual: string }>
): ExtendedDefeater[] {
  return mismatches.map((m) =>
    createDefeater({
      type: 'hash_mismatch',
      description: `Content hash mismatch for claim - expected ${m.expected.slice(0, 8)}, got ${m.actual.slice(0, 8)}`,
      severity: 'full',
      affectedClaimIds: [m.claimId],
      confidenceReduction: 1.0,
      autoResolvable: true,
      resolutionAction: 'reindex',
      evidence: `Expected: ${m.expected}, Actual: ${m.actual}`,
    })
  );
}

/**
 * Detect provider unavailability defeaters.
 */
async function detectProviderDefeaters(
  storage: EvidenceGraphStorage,
  providerStatus: Record<string, boolean>
): Promise<ExtendedDefeater[]> {
  const defeaters: ExtendedDefeater[] = [];

  for (const [provider, available] of Object.entries(providerStatus)) {
    if (!available) {
      // Find claims that depend on this provider
      const claims = await storage.getClaims({ status: 'active' });
      const affectedClaims = claims.filter(
        (c) => c.source.type === 'llm' && c.source.id.includes(provider)
      );

      if (affectedClaims.length > 0) {
        defeaters.push(
          createDefeater({
            type: 'provider_unavailable',
            description: `Provider "${provider}" is unavailable, ${affectedClaims.length} claim(s) cannot be revalidated`,
            severity: 'warning',
            affectedClaimIds: affectedClaims.map((c) => c.id),
            confidenceReduction: 0.1,
            autoResolvable: true,
            resolutionAction: 'retry_provider',
            evidence: `Provider: ${provider}, Status: unavailable`,
          })
        );
      }
    }
  }

  return defeaters;
}

// ============================================================================
// DEFEATER APPLICATION
// ============================================================================

/** Result of applying defeaters */
export interface ApplicationResult {
  /** Claims that were updated */
  updatedClaims: ClaimId[];

  /** Defeaters that were activated */
  activatedDefeaters: string[];

  /** Defeaters that were auto-resolved */
  resolvedDefeaters: string[];

  /** New contradictions that were recorded */
  recordedContradictions: string[];
}

/**
 * Apply detected defeaters to the evidence graph.
 */
export async function applyDefeaters(
  storage: EvidenceGraphStorage,
  detectionResult: DetectionResult,
  config: DefeaterEngineConfig = DEFAULT_DEFEATER_CONFIG
): Promise<ApplicationResult> {
  const result: ApplicationResult = {
    updatedClaims: [],
    activatedDefeaters: [],
    resolvedDefeaters: [],
    recordedContradictions: [],
  };

  // Store and optionally activate defeaters
  for (const defeater of detectionResult.defeaters.slice(0, config.maxBatchSize)) {
    await storage.upsertDefeater(defeater);

    if (config.autoActivateDefeaters) {
      await storage.activateDefeater(defeater.id);
      result.activatedDefeaters.push(defeater.id);

      // Apply signal-strength reduction to affected claims
      for (const claimId of defeater.affectedClaimIds) {
        const claim = await storage.getClaim(claimId);
        if (claim) {
          const newSignalStrength = applySignalStrengthReduction(
            claim.signalStrength,
            defeater.confidenceReduction,
            defeater.type
          );
          await storage.updateClaimSignalStrength(claimId, newSignalStrength);

          // Update status if signal strength falls below threshold
          if (newSignalStrength.overall < config.minimumSignalStrengthThreshold) {
            await storage.updateClaimStatus(claimId, 'defeated');
          } else if (defeater.severity === 'full') {
            await storage.updateClaimStatus(claimId, 'defeated');
          }

          result.updatedClaims.push(claimId);
        }
      }
    }

    // Auto-resolve if configured and defeater supports it
    if (config.autoResolveDefeaters && defeater.autoResolvable) {
      await storage.resolveDefeater(defeater.id);
      result.resolvedDefeaters.push(defeater.id);
    }
  }

  // Store contradictions
  for (const contradiction of detectionResult.contradictions) {
    await storage.upsertContradiction(contradiction);
    result.recordedContradictions.push(contradiction.id);

    // Mark both claims as contradicted
    await storage.updateClaimStatus(contradiction.claimA, 'contradicted');
    await storage.updateClaimStatus(contradiction.claimB, 'contradicted');
    result.updatedClaims.push(contradiction.claimA, contradiction.claimB);
  }

  return result;
}

/**
 * Apply confidence reduction based on defeater type.
 */
function applySignalStrengthReduction(
  signalStrength: ClaimSignalStrength,
  reduction: number,
  defeaterType: ExtendedDefeaterType
): ClaimSignalStrength {
  const newSignalStrength = { ...signalStrength };

  // Apply reduction to relevant signal components based on defeater type
  switch (defeaterType) {
    case 'code_change':
    case 'hash_mismatch':
      // Affects structural and recency signal strength
      newSignalStrength.structural = Math.max(0, signalStrength.structural - reduction);
      newSignalStrength.recency = Math.max(0, signalStrength.recency - reduction);
      break;

    case 'test_failure':
      // Primarily affects test execution signal strength
      newSignalStrength.testExecution = Math.max(0, signalStrength.testExecution - reduction);
      break;

    case 'staleness':
      // Primarily affects recency signal strength
      newSignalStrength.recency = Math.max(0, signalStrength.recency - reduction);
      break;

    case 'contradiction':
    case 'new_info':
      // Affects semantic signal strength
      newSignalStrength.semantic = Math.max(0, signalStrength.semantic - reduction);
      break;

    case 'coverage_gap':
      // Affects retrieval signal strength
      newSignalStrength.retrieval = Math.max(0, signalStrength.retrieval - reduction);
      break;

    case 'tool_failure':
    case 'sandbox_mismatch':
      // Affects structural signal strength
      newSignalStrength.structural = Math.max(0, signalStrength.structural - reduction);
      break;

    case 'provider_unavailable':
      // Minor overall reduction
      newSignalStrength.retrieval = Math.max(0, signalStrength.retrieval - reduction * 0.5);
      newSignalStrength.semantic = Math.max(0, signalStrength.semantic - reduction * 0.5);
      break;

    default:
      // Generic reduction across all components
      newSignalStrength.retrieval = Math.max(0, signalStrength.retrieval - reduction * 0.2);
      newSignalStrength.structural = Math.max(0, signalStrength.structural - reduction * 0.2);
      newSignalStrength.semantic = Math.max(0, signalStrength.semantic - reduction * 0.2);
      newSignalStrength.testExecution = Math.max(0, signalStrength.testExecution - reduction * 0.2);
      newSignalStrength.recency = Math.max(0, signalStrength.recency - reduction * 0.2);
  }

  // Recompute overall signal strength
  newSignalStrength.overall = computeOverallSignalStrength(newSignalStrength);

  return newSignalStrength;
}

// ============================================================================
// DEFEATER RESOLUTION
// ============================================================================

/** Resolution action for a defeater */
export interface ResolutionAction {
  defeater: ExtendedDefeater;
  action: 'revalidate' | 'reindex' | 'retry_provider' | 'manual' | 'ignore';
  priority: number;
}

/**
 * Get recommended resolution actions for active defeaters.
 */
export async function getResolutionActions(
  storage: EvidenceGraphStorage
): Promise<ResolutionAction[]> {
  const activeDefeaters = await storage.getActiveDefeaters();
  const actions: ResolutionAction[] = [];

  for (const defeater of activeDefeaters) {
    let action: ResolutionAction['action'] = 'manual';
    let priority = 1;

    if (defeater.autoResolvable && defeater.resolutionAction) {
      switch (defeater.resolutionAction) {
        case 'revalidate':
          action = 'revalidate';
          priority = 2;
          break;
        case 'reindex':
          action = 'reindex';
          priority = 3;
          break;
        case 'retry_provider':
          action = 'retry_provider';
          priority = 1;
          break;
      }
    }

    // Adjust priority based on severity
    if (defeater.severity === 'full') {
      priority += 10;
    } else if (defeater.severity === 'partial') {
      priority += 5;
    }

    actions.push({ defeater, action, priority });
  }

  // Sort by priority (highest first)
  return actions.sort((a, b) => b.priority - a.priority);
}

/**
 * Resolve a defeater by applying its resolution action.
 */
export async function resolveDefeater(
  storage: EvidenceGraphStorage,
  defeaterId: string,
  action: ResolutionAction['action']
): Promise<void> {
  const defeater = await storage.getDefeater(defeaterId);
  if (!defeater) {
    throw new Error(`Defeater ${defeaterId} not found`);
  }

  // Mark defeater as resolved
  await storage.resolveDefeater(defeaterId);

  // Restore affected claims if action was successful
  if (action !== 'ignore') {
    for (const claimId of defeater.affectedClaimIds) {
      const claim = await storage.getClaim(claimId);
      if (claim && claim.status === 'defeated') {
        // Check if there are other active defeaters for this claim
        const otherDefeaters = await storage.getDefeatersForClaim(claimId);
        const stillDefeated = otherDefeaters.some(
          (d) => d.id !== defeaterId && d.status === 'active'
        );

        if (!stillDefeated) {
          // Restore claim to stale status (needs revalidation)
          await storage.updateClaimStatus(claimId, 'stale');
        }
      }
    }
  }
}

// ============================================================================
// GRAPH HEALTH
// ============================================================================

/** Health assessment of the evidence graph */
export interface GraphHealthAssessment {
  /** Overall health score (0-1) */
  overallHealth: number;

  /** Number of active claims */
  activeClaimCount: number;

  /** Number of defeated claims */
  defeatedClaimCount: number;

  /** Number of stale claims */
  staleClaimCount: number;

  /** Number of active defeaters */
  activeDefeaterCount: number;

  /** Number of unresolved contradictions */
  unresolvedContradictionCount: number;

  /** Average signal strength of active claims */
  averageSignalStrength: number;

  /** Top issues affecting health */
  topIssues: Array<{
    type: 'defeater' | 'contradiction' | 'low_signal_strength' | 'staleness';
    description: string;
    severity: 'high' | 'medium' | 'low';
    affectedClaims: number;
  }>;

  /** Recommendations for improving health */
  recommendations: string[];
}

/**
 * Assess the health of the evidence graph.
 */
export async function assessGraphHealth(
  storage: EvidenceGraphStorage,
  config: DefeaterEngineConfig = DEFAULT_DEFEATER_CONFIG
): Promise<GraphHealthAssessment> {
  const stats = await storage.getGraphStats();
  const activeClaims = await storage.getClaims({ status: 'active' });
  const staleClaims = await storage.getClaims({ status: 'stale' });
  const defeatedClaims = await storage.getClaims({ status: 'defeated' });
  const activeDefeaters = await storage.getActiveDefeaters();
  const unresolvedContradictions = await storage.getUnresolvedContradictions();

  const topIssues: GraphHealthAssessment['topIssues'] = [];
  const recommendations: string[] = [];

  // Analyze defeaters
  if (activeDefeaters.length > 0) {
    const fullDefeaters = activeDefeaters.filter((d) => d.severity === 'full');
    if (fullDefeaters.length > 0) {
      topIssues.push({
        type: 'defeater',
        description: `${fullDefeaters.length} critical defeater(s) requiring attention`,
        severity: 'high',
        affectedClaims: fullDefeaters.reduce((sum, d) => sum + d.affectedClaimIds.length, 0),
      });
      recommendations.push(
        `Address ${fullDefeaters.length} critical defeater(s) to restore claim validity`
      );
    }
  }

  // Analyze contradictions
  if (unresolvedContradictions.length > 0) {
    const blocking = unresolvedContradictions.filter((c) => c.severity === 'blocking');
    if (blocking.length > 0) {
      topIssues.push({
        type: 'contradiction',
        description: `${blocking.length} blocking contradiction(s) detected`,
        severity: 'high',
        affectedClaims: blocking.length * 2,
      });
      recommendations.push(
        `Resolve ${blocking.length} blocking contradiction(s) to maintain consistency`
      );
    }
  }

  // Analyze staleness
  if (staleClaims.length > activeClaims.length * 0.2) {
    topIssues.push({
      type: 'staleness',
      description: `${staleClaims.length} stale claim(s) need revalidation`,
      severity: 'medium',
      affectedClaims: staleClaims.length,
    });
    recommendations.push(
      `Revalidate ${staleClaims.length} stale claims to improve knowledge freshness`
    );
  }

  // Analyze low confidence
  const lowSignalClaims = activeClaims.filter(
    (c) => c.signalStrength.overall < 0.5
  );
  if (lowSignalClaims.length > 0) {
    topIssues.push({
      type: 'low_signal_strength',
      description: `${lowSignalClaims.length} claim(s) have low signal strength`,
      severity: 'low',
      affectedClaims: lowSignalClaims.length,
    });
    recommendations.push(
      `Consider gathering additional evidence for ${lowSignalClaims.length} low-signal claims`
    );
  }

  // Calculate overall health
  const totalClaims = activeClaims.length + staleClaims.length + defeatedClaims.length;
  const healthyClaimRatio = totalClaims > 0 ? activeClaims.length / totalClaims : 1;
  const defeaterPenalty = Math.min(0.3, activeDefeaters.length * 0.03);
  const contradictionPenalty = Math.min(0.3, unresolvedContradictions.length * 0.05);
  const overallHealth = Math.max(0, healthyClaimRatio - defeaterPenalty - contradictionPenalty);

  return {
    overallHealth,
    activeClaimCount: activeClaims.length,
    defeatedClaimCount: defeatedClaims.length,
    staleClaimCount: staleClaims.length,
    activeDefeaterCount: activeDefeaters.length,
    unresolvedContradictionCount: unresolvedContradictions.length,
    averageSignalStrength: stats.avgSignalStrength,
    topIssues,
    recommendations,
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Run a complete defeater detection and application cycle.
 */
export async function runDefeaterCycle(
  storage: EvidenceGraphStorage,
  context: DetectionContext,
  config: DefeaterEngineConfig = DEFAULT_DEFEATER_CONFIG
): Promise<{
  detection: DetectionResult;
  application: ApplicationResult;
  health: GraphHealthAssessment;
}> {
  // Detect defeaters
  const detection = await detectDefeaters(storage, context, config);

  // Apply defeaters
  const application = await applyDefeaters(storage, detection, config);

  // Assess health
  const health = await assessGraphHealth(storage, config);

  return { detection, application, health };
}
