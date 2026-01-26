/**
 * @fileoverview Fitness Computation for EvolutionOps
 *
 * Computes multi-objective FitnessReport.v1 from evaluation results.
 * Integrates with existing evaluation harness and observability.
 *
 * @packageDocumentation
 */

import type {
  FitnessReport,
  FitnessVector,
  BehaviorDescriptors,
  FitnessDelta,
  StageResult,
  ResourceUsage,
  Variant,
} from './types.js';
import type { EvaluationReport } from '../evaluation/harness.js';
import type { LibrarianStateReport } from '../measurement/observability.js';
import { computeContinuousOverallScore } from './continuous_fitness.js';

// ============================================================================
// FITNESS COMPUTATION
// ============================================================================

/**
 * Compute FitnessReport.v1 from evaluation results.
 */
export function computeFitnessReport(
  variantId: string | null,
  scope: { repository: string; subsystem: string; commitHash: string },
  stages: {
    stage0: StageResult;
    stage1: StageResult;
    stage2: StageResult;
    stage3: StageResult;
    stage4: StageResult;
  },
  retrievalReport?: EvaluationReport,
  stateReport?: LibrarianStateReport,
  resourceUsage?: ResourceUsage,
  baseline?: FitnessReport
): FitnessReport {
  const fitness = computeFitnessVector(stages, retrievalReport, stateReport);
  const descriptors = computeBehaviorDescriptors(fitness, stateReport);
  const delta = baseline ? computeFitnessDelta(fitness, baseline.fitness, baseline.variantId ?? 'baseline') : undefined;

  return {
    kind: 'FitnessReport.v1',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    variantId,
    scope,
    stages: {
      stage0_static: stages.stage0,
      stage1_tier0: stages.stage1,
      stage2_tier1: stages.stage2,
      stage3_tier2: stages.stage3,
      stage4_adversarial: stages.stage4,
    },
    fitness,
    behaviorDescriptors: descriptors,
    resources: resourceUsage ?? { tokensUsed: 0, embeddingsUsed: 0, providerCallsUsed: 0, durationMs: 0 },
    baselineDelta: delta,
  };
}

/**
 * Compute multi-objective fitness vector.
 */
export function computeFitnessVector(
  stages: {
    stage0: StageResult;
    stage1: StageResult;
    stage2: StageResult;
    stage3: StageResult;
    stage4: StageResult;
  },
  retrievalReport?: EvaluationReport,
  stateReport?: LibrarianStateReport
): FitnessVector {
  // Correctness from stage results
  const correctness = {
    tier0PassRate: stages.stage1.status === 'passed' ? 1.0 : extractPassRate(stages.stage1),
    tier1PassRate: stages.stage2.status === 'passed' ? 1.0 : extractPassRate(stages.stage2),
    tier2PassRate: stages.stage3.status === 'passed' ? 1.0 : extractPassRate(stages.stage3),
    schemaValid: stages.stage0.metrics['schema_valid'] === true,
    deterministicVerified: stages.stage0.metrics['determinism_verified'] === true,
  };

  // Retrieval quality from evaluation report
  const retrievalQuality = extractRetrievalQuality(retrievalReport);

  // Epistemic quality from state report
  const epistemicQuality = extractEpistemicQuality(stateReport);

  // Operational quality from state report
  const operationalQuality = extractOperationalQuality(stateReport);

  // Security robustness from stage 4
  const securityRobustness = extractSecurityRobustness(stages.stage4);

  // Cost efficiency from stages
  const costEfficiency = extractCostEfficiency(stages);

  // Compute overall score (geometric mean of normalized scores)
  const overall = computeOverallScore({
    correctness,
    retrievalQuality,
    epistemicQuality,
    operationalQuality,
    securityRobustness,
    costEfficiency,
  });

  return {
    correctness,
    retrievalQuality,
    epistemicQuality,
    operationalQuality,
    securityRobustness,
    costEfficiency,
    overall,
  };
}

/**
 * Compute behavior descriptors for MAP-Elites archiving.
 */
export function computeBehaviorDescriptors(
  fitness: FitnessVector,
  stateReport?: LibrarianStateReport
): BehaviorDescriptors {
  // Latency bucket
  const latencyP50 = fitness.operationalQuality.queryLatencyP50Ms;
  const latencyBucket: BehaviorDescriptors['latencyBucket'] =
    latencyP50 < 200 ? 'fast' : latencyP50 < 500 ? 'medium' : 'slow';

  // Token cost bucket
  const tokenUsage = fitness.costEfficiency.tokenUsage;
  const tokenCostBucket: BehaviorDescriptors['tokenCostBucket'] =
    tokenUsage < 10000 ? 'low' : tokenUsage < 50000 ? 'medium' : 'high';

  // Evidence completeness bucket
  const evidenceCoverage = fitness.epistemicQuality.evidenceCoverage;
  const evidenceCompletenessBucket: BehaviorDescriptors['evidenceCompletenessBucket'] =
    evidenceCoverage < 0.5 ? 'low' : evidenceCoverage < 0.8 ? 'medium' : 'high';

  // Calibration bucket
  const calibrationError = fitness.epistemicQuality.calibrationError;
  const calibrationBucket: BehaviorDescriptors['calibrationBucket'] =
    calibrationError > 0.2 ? 'low' : calibrationError > 0.1 ? 'medium' : 'high';

  // Retrieval strategy (simplified heuristic)
  const retrievalStrategy = inferRetrievalStrategy(stateReport);

  // Provider reliance
  const providerReliance = inferProviderReliance(fitness);

  return {
    latencyBucket,
    tokenCostBucket,
    evidenceCompletenessBucket,
    calibrationBucket,
    retrievalStrategy,
    providerReliance,
  };
}

/**
 * Compute fitness delta vs baseline.
 */
export function computeFitnessDelta(
  current: FitnessVector,
  baseline: FitnessVector,
  baselineId: string
): FitnessDelta {
  const improvements: string[] = [];
  const regressions: string[] = [];
  const neutral: string[] = [];

  // Compare correctness
  compareMetric('tier0PassRate', current.correctness.tier0PassRate, baseline.correctness.tier0PassRate, improvements, regressions, neutral);
  compareMetric('tier1PassRate', current.correctness.tier1PassRate, baseline.correctness.tier1PassRate, improvements, regressions, neutral);

  // Compare retrieval
  compareMetric('recallAt5', current.retrievalQuality.recallAt5, baseline.retrievalQuality.recallAt5, improvements, regressions, neutral);
  compareMetric('nDCG', current.retrievalQuality.nDCG, baseline.retrievalQuality.nDCG, improvements, regressions, neutral);

  // Compare epistemic
  compareMetric('evidenceCoverage', current.epistemicQuality.evidenceCoverage, baseline.epistemicQuality.evidenceCoverage, improvements, regressions, neutral);
  compareMetric('calibrationError', baseline.epistemicQuality.calibrationError, current.epistemicQuality.calibrationError, improvements, regressions, neutral); // Lower is better

  // Compare operational (lower is better for latency)
  compareMetric('queryLatencyP50', baseline.operationalQuality.queryLatencyP50Ms, current.operationalQuality.queryLatencyP50Ms, improvements, regressions, neutral);

  // Compare overall
  compareMetric('overall', current.overall, baseline.overall, improvements, regressions, neutral);

  // Pareto improvement: at least one improvement, no regressions
  const isParetoImprovement = improvements.length > 0 && regressions.length === 0;

  return {
    baselineId,
    improvements,
    regressions,
    neutral,
    isParetoImprovement,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function extractPassRate(stage: StageResult): number {
  const passed = stage.metrics['tests_passed'];
  const total = stage.metrics['tests_total'];
  if (typeof passed === 'number' && typeof total === 'number' && total > 0) {
    return passed / total;
  }
  return stage.status === 'passed' ? 1.0 : 0.0;
}

function extractRetrievalQuality(report?: EvaluationReport): FitnessVector['retrievalQuality'] {
  if (!report?.aggregateMetrics) {
    return {
      recallAt5: 0,
      recallAt10: 0,
      precisionAt5: 0,
      nDCG: 0,
      mrr: 0,
    };
  }

  return {
    recallAt5: report.aggregateMetrics.recall?.mean ?? 0,
    recallAt10: report.aggregateMetrics.recall?.mean ?? 0, // Would need separate k=10 run
    precisionAt5: report.aggregateMetrics.precision?.mean ?? 0,
    nDCG: report.aggregateMetrics.ndcg?.mean ?? 0,
    mrr: report.aggregateMetrics.mrr?.mean ?? 0,
  };
}

function extractEpistemicQuality(stateReport?: LibrarianStateReport): FitnessVector['epistemicQuality'] {
  if (!stateReport) {
    return {
      evidenceCoverage: 0,
      defeaterCorrectness: 0,
      calibrationError: 1,
      claimVerificationRate: 0,
    };
  }

  return {
    evidenceCoverage: stateReport.codeGraphHealth.coverageRatio,
    defeaterCorrectness: stateReport.confidenceState.defeaterCount <= 10 ? 1.0 : 0.5,
    calibrationError: stateReport.confidenceState.calibrationError ?? 0.15,
    claimVerificationRate: stateReport.confidenceState.geometricMeanConfidence,
  };
}

function extractOperationalQuality(stateReport?: LibrarianStateReport): FitnessVector['operationalQuality'] {
  if (!stateReport) {
    return {
      queryLatencyP50Ms: 1000,
      queryLatencyP99Ms: 5000,
      bootstrapTimeSeconds: 300,
      cacheHitRate: 0,
      freshnessLagSeconds: 600,
    };
  }

  return {
    queryLatencyP50Ms: stateReport.queryPerformance.queryLatencyP50,
    queryLatencyP99Ms: stateReport.queryPerformance.queryLatencyP99,
    bootstrapTimeSeconds: 60, // Would need bootstrap timing
    cacheHitRate: stateReport.queryPerformance.cacheHitRate,
    freshnessLagSeconds: Math.max(0, stateReport.indexFreshness.stalenessMs / 1000),
  };
}

function extractSecurityRobustness(stage4: StageResult): FitnessVector['securityRobustness'] {
  return {
    injectionResistance: stage4.metrics['injection_resistance'] as number ?? 1.0,
    provenanceLabeling: stage4.metrics['provenance_labeling'] as number ?? 1.0,
    failClosedBehavior: stage4.metrics['fail_closed'] as boolean ?? true,
  };
}

function extractCostEfficiency(stages: Record<string, StageResult>): FitnessVector['costEfficiency'] {
  let totalTokens = 0;
  let totalEmbeddings = 0;
  let totalProviderCalls = 0;

  for (const stage of Object.values(stages)) {
    totalTokens += (stage.metrics['tokens_used'] as number) ?? 0;
    totalEmbeddings += (stage.metrics['embeddings_used'] as number) ?? 0;
    totalProviderCalls += (stage.metrics['provider_calls'] as number) ?? 0;
  }

  return {
    tokenUsage: totalTokens,
    embeddingCalls: totalEmbeddings,
    providerCalls: totalProviderCalls,
    recoveryBudgetCompliance: true, // Would check against actual budgets
  };
}

function computeOverallScore(fitness: Omit<FitnessVector, 'overall'>): number {
  // Use continuous fitness computation with harmonic mean and floors.
  // This prevents zero collapse and provides gradient signal even for broken systems.
  //
  // The old geometric mean approach had a critical flaw: any 0 factor = 0 overall.
  // The new harmonic mean with floors ensures fitness is always in [floor, 1.0].
  const fitnessWithOverall = {
    ...fitness,
    overall: 0, // Will be computed by computeContinuousOverallScore
  } as FitnessVector;

  return computeContinuousOverallScore(fitnessWithOverall);
}

function normalizeLatency(latencyMs: number): number {
  // Target: 500ms = 1.0, 2000ms = 0.25
  return Math.min(1.0, 500 / Math.max(1, latencyMs));
}

function normalizeTokenUsage(tokens: number): number {
  // Target: <10k = 1.0, 100k = 0.1
  return Math.min(1.0, 10000 / Math.max(1, tokens));
}

function compareMetric(
  name: string,
  current: number,
  baseline: number,
  improvements: string[],
  regressions: string[],
  neutral: string[]
): void {
  const threshold = 0.01; // 1% threshold for change detection
  const delta = current - baseline;

  if (delta > threshold) {
    improvements.push(`${name}: ${baseline.toFixed(3)} -> ${current.toFixed(3)} (+${(delta * 100).toFixed(1)}%)`);
  } else if (delta < -threshold) {
    regressions.push(`${name}: ${baseline.toFixed(3)} -> ${current.toFixed(3)} (${(delta * 100).toFixed(1)}%)`);
  } else {
    neutral.push(name);
  }
}

function inferRetrievalStrategy(_stateReport?: LibrarianStateReport): BehaviorDescriptors['retrievalStrategy'] {
  // Would analyze actual retrieval weights; default to balanced
  return 'balanced';
}

function inferProviderReliance(fitness: FitnessVector): BehaviorDescriptors['providerReliance'] {
  const calls = fitness.costEfficiency.providerCalls;
  if (calls === 0) return 'deterministic-only';
  if (calls < 10) return 'light-llm';
  return 'heavy-llm';
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isFitnessReport(value: unknown): value is FitnessReport {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return r.kind === 'FitnessReport.v1' && r.schemaVersion === 1;
}
