/**
 * @fileoverview Prioritization Engine
 *
 * Intelligent, evidence-based prioritization for work items.
 * Priority is COMPUTED, not arbitrarily assigned.
 *
 * Key Principles:
 * - Transparent: Every score can be explained
 * - Contextual: Uses project vision and strategic pillars
 * - Dynamic: Recalculates as conditions change
 * - Fair: Consistent algorithm across all items
 */

import type {
  StrategicPillar,
  ProjectVision,
  BoundedContext,
  ConfidenceAssessment,
} from './types.js';

import type {
  WorkPrimitive,
  ComputedPriority,
  PriorityLevel,
  PriorityFactor,
  ImpactAssessment,
  EffortEstimate,
  WorkStatus,
  WorkDependency,
} from './work_primitives.js';

// ============================================================================
// PRIORITIZATION CONFIGURATION
// ============================================================================

/**
 * Configuration for the prioritization engine.
 * Can be customized per project.
 */
export interface PrioritizationConfig {
  // Factor weights (should sum to ~1.0)
  weights: PriorityWeights;

  // Thresholds for priority levels
  thresholds: PriorityThresholds;

  // Rules for automatic adjustments
  rules: PrioritizationRule[];

  // Decay settings
  decay: DecayConfig;

  // Context
  projectVision?: ProjectVision;
  boundedContexts?: BoundedContext[];
}

export interface PriorityWeights {
  strategicAlignment: number;   // Default: 0.20
  userImpact: number;           // Default: 0.18
  riskReduction: number;        // Default: 0.15
  dependencyUnblock: number;    // Default: 0.12
  effortValue: number;          // Default: 0.12
  timeDecay: number;            // Default: 0.08
  momentum: number;             // Default: 0.08
  externalPressure: number;     // Default: 0.07
}

export interface PriorityThresholds {
  critical: number;             // Score >= this is critical (default: 85)
  high: number;                 // Score >= this is high (default: 70)
  medium: number;               // Score >= this is medium (default: 45)
  low: number;                  // Score >= this is low (default: 20)
  // Anything below low threshold is backlog
}

export interface DecayConfig {
  // How much priority decreases over time for stale items
  staleAfterDays: number;       // Default: 30
  decayPerDay: number;          // Default: 0.5 points per day after stale
  maxDecay: number;             // Default: 20 points max decay
}

/**
 * Default configuration
 */
export const DEFAULT_PRIORITIZATION_CONFIG: PrioritizationConfig = {
  weights: {
    strategicAlignment: 0.20,
    userImpact: 0.18,
    riskReduction: 0.15,
    dependencyUnblock: 0.12,
    effortValue: 0.12,
    timeDecay: 0.08,
    momentum: 0.08,
    externalPressure: 0.07,
  },
  thresholds: {
    critical: 85,
    high: 70,
    medium: 45,
    low: 20,
  },
  rules: [],
  decay: {
    staleAfterDays: 30,
    decayPerDay: 0.5,
    maxDecay: 20,
  },
};

// ============================================================================
// PRIORITIZATION RULES
// ============================================================================

/**
 * Rules can automatically boost or lower priority based on conditions.
 */
export interface PrioritizationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;

  // Condition
  condition: RuleCondition;

  // Effect
  effect: RuleEffect;

  // Metadata
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

export type RuleCondition =
  | { type: 'tag_present'; tag: string }
  | { type: 'tag_absent'; tag: string }
  | { type: 'type_is'; workType: string }
  | { type: 'context_is'; contextId: string }
  | { type: 'age_exceeds'; days: number }
  | { type: 'blocks_count_exceeds'; count: number }
  | { type: 'impact_is'; level: string }
  | { type: 'effort_is'; complexity: string }
  | { type: 'has_deadline_within'; days: number }
  | { type: 'assignee_is'; assignee: string }
  | { type: 'custom'; evaluator: string };  // Custom function name

export interface RuleEffect {
  type: 'boost' | 'penalize' | 'set_min' | 'set_max' | 'flag';

  // For boost/penalize
  factorName?: string;          // Which factor to adjust
  multiplier?: number;          // Multiply factor by this
  additive?: number;            // Add this to factor

  // For set_min/set_max
  level?: PriorityLevel;

  // For flag
  flag?: string;
}

/**
 * Built-in prioritization rules
 */
export const BUILT_IN_RULES: PrioritizationRule[] = [
  {
    id: 'security-critical',
    name: 'Security Issues Priority',
    description: 'Security-tagged issues are always high priority minimum',
    enabled: true,
    condition: { type: 'tag_present', tag: 'security' },
    effect: { type: 'set_min', level: 'high' },
    createdAt: '2026-01-01',
    createdBy: 'system',
    usageCount: 0,
  },
  {
    id: 'blocking-many',
    name: 'Blocker Boost',
    description: 'Items blocking 3+ others get dependency factor boosted',
    enabled: true,
    condition: { type: 'blocks_count_exceeds', count: 2 },
    effect: { type: 'boost', factorName: 'dependencyUnblock', multiplier: 1.5 },
    createdAt: '2026-01-01',
    createdBy: 'system',
    usageCount: 0,
  },
  {
    id: 'quick-wins',
    name: 'Quick Win Boost',
    description: 'Low effort items get ROI factor boosted',
    enabled: true,
    condition: { type: 'effort_is', complexity: 'trivial' },
    effect: { type: 'boost', factorName: 'effortValue', multiplier: 2.0 },
    createdAt: '2026-01-01',
    createdBy: 'system',
    usageCount: 0,
  },
  {
    id: 'deadline-approaching',
    name: 'Deadline Urgency',
    description: 'Items with deadlines within 7 days get boosted',
    enabled: true,
    condition: { type: 'has_deadline_within', days: 7 },
    effect: { type: 'boost', factorName: 'externalPressure', multiplier: 2.0 },
    createdAt: '2026-01-01',
    createdBy: 'system',
    usageCount: 0,
  },
  {
    id: 'stale-triage',
    name: 'Stale Item Flag',
    description: 'Items open >60 days without progress get flagged',
    enabled: true,
    condition: { type: 'age_exceeds', days: 60 },
    effect: { type: 'flag', flag: 'needs-triage' },
    createdAt: '2026-01-01',
    createdBy: 'system',
    usageCount: 0,
  },
];

// ============================================================================
// PRIORITY COMPUTATION
// ============================================================================

/**
 * Input context for priority computation
 */
export interface PriorityComputeContext {
  work: WorkPrimitive;
  allWork: WorkPrimitive[];     // For relative comparisons
  recentlyCompleted: WorkPrimitive[];  // For momentum calculation
  config: PrioritizationConfig;

  // Optional enrichment
  pillarScores?: Map<string, number>;  // Pre-computed pillar alignment
  dependencyGraph?: DependencyGraph;
}

export interface DependencyGraph {
  blockedBy: Map<string, string[]>;
  blocks: Map<string, string[]>;
  criticalPath: string[];       // IDs on critical path
}

/**
 * Detailed breakdown of how priority was computed
 */
export interface PriorityComputation {
  workId: string;
  computedAt: string;

  // Raw factor scores (0-100)
  rawScores: Record<string, number>;

  // Weighted scores
  weightedScores: Record<string, number>;

  // Rule applications
  rulesApplied: AppliedRule[];

  // Adjustments
  adjustments: PriorityAdjustment[];

  // Final
  baseScore: number;            // Before adjustments
  finalScore: number;           // After adjustments
  level: PriorityLevel;

  // Explanation
  explanation: PriorityExplanation;
}

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  effect?: string;              // Description of what happened
}

export interface PriorityAdjustment {
  source: string;               // What caused this adjustment
  type: 'decay' | 'boost' | 'cap' | 'floor';
  amount: number;
  reason: string;
}

// ============================================================================
// PRIORITY EXPLANATION
// ============================================================================

/**
 * Human-readable explanation of priority
 */
export interface PriorityExplanation {
  summary: string;              // 1-2 sentence summary
  topFactors: ExplainedFactor[];
  comparison: PriorityComparison;
  suggestions: PrioritySuggestion[];
  confidence: number;
}

export interface ExplainedFactor {
  name: string;
  contribution: string;         // e.g., "High (+15 points)"
  reason: string;               // Why this score
  evidence: string[];
}

export interface PriorityComparison {
  higherPriority: WorkReference[];  // Items with higher priority
  similarPriority: WorkReference[];
  lowerPriority: WorkReference[];
  percentile: number;           // Where this falls (0-100)
}

export interface WorkReference {
  id: string;
  title: string;
  score: number;
  level: PriorityLevel;
}

export interface PrioritySuggestion {
  type: 'increase' | 'decrease' | 'maintain';
  action: string;
  expectedImpact: string;
}

// ============================================================================
// FACTOR CALCULATORS
// ============================================================================

/**
 * Interface for factor calculator functions
 */
export interface FactorCalculator {
  name: string;
  calculate: (ctx: PriorityComputeContext) => FactorResult;
}

export interface FactorResult {
  score: number;                // 0-100
  evidence: string[];
  dataQuality: 'measured' | 'estimated' | 'inferred' | 'default';
}

/**
 * Strategic Alignment Factor
 * How well does this align with project vision and strategic pillars?
 */
export function calculateStrategicAlignment(
  ctx: PriorityComputeContext
): FactorResult {
  const { work, config } = ctx;
  const evidence: string[] = [];
  let score = 50; // Default neutral

  if (!config.projectVision?.pillars.length) {
    return {
      score: 50,
      evidence: ['No strategic pillars defined - using neutral score'],
      dataQuality: 'default',
    };
  }

  // Check alignment with each pillar
  const pillars = config.projectVision.pillars;
  const alignedPillars: string[] = [];

  for (const pillar of pillars) {
    const isAligned =
      work.tags.some(t => t.toLowerCase().includes(pillar.name.toLowerCase())) ||
      work.traceability.affectedContexts.some(c =>
        pillar.relatedContexts.includes(c)
      ) ||
      work.traceability.affectedFiles.some(f =>
        pillar.relatedFiles.some(pf => f.path.includes(pf))
      );

    if (isAligned) {
      alignedPillars.push(pillar.name);
      // Higher priority pillars give more points
      const pillarBonus = (4 - pillar.priority) * 15; // P1=45, P2=30, P3=15
      score += pillarBonus;
    }
  }

  if (alignedPillars.length > 0) {
    evidence.push(`Aligns with pillars: ${alignedPillars.join(', ')}`);
  } else {
    evidence.push('No direct alignment with strategic pillars');
    score = 30; // Below neutral if no alignment
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    evidence,
    dataQuality: alignedPillars.length > 0 ? 'measured' : 'inferred',
  };
}

/**
 * User Impact Factor
 * How many users affected and how severely?
 */
export function calculateUserImpact(
  ctx: PriorityComputeContext
): FactorResult {
  const { work } = ctx;
  const impact = work.impact;
  const evidence: string[] = [];

  if (!impact) {
    return {
      score: 50,
      evidence: ['No impact assessment - using neutral score'],
      dataQuality: 'default',
    };
  }

  // Base score from impact level
  const impactScores: Record<string, number> = {
    none: 10,
    minimal: 25,
    low: 40,
    medium: 55,
    high: 75,
    critical: 95,
  };

  const userImpactScore = impactScores[impact.userImpact] || 50;
  evidence.push(`User impact: ${impact.userImpact}`);

  // Adjust for number of affected users
  let userCountMultiplier = 1.0;
  if (impact.affectedUserCount === 'all') {
    userCountMultiplier = 1.3;
    evidence.push('Affects all users');
  } else if (impact.affectedUserCount === 'subset') {
    userCountMultiplier = 1.0;
  } else if (typeof impact.affectedUserCount === 'number') {
    if (impact.affectedUserCount > 1000) {
      userCountMultiplier = 1.2;
      evidence.push(`Affects ${impact.affectedUserCount}+ users`);
    }
  }

  // Consider reversibility
  if (impact.reversibility === 'irreversible' ||
      impact.reversibility === 'difficult') {
    userCountMultiplier *= 1.15;
    evidence.push(`Changes are ${impact.reversibility} to reverse`);
  }

  const finalScore = Math.min(100, userImpactScore * userCountMultiplier);

  return {
    score: finalScore,
    evidence,
    dataQuality: 'measured',
  };
}

/**
 * Risk Reduction Factor
 * Does completing this reduce security, stability, or compliance risk?
 */
export function calculateRiskReduction(
  ctx: PriorityComputeContext
): FactorResult {
  const { work } = ctx;
  const evidence: string[] = [];
  let score = 30; // Default low (most work doesn't reduce risk)

  // Check for risk-related tags
  const riskTags = ['security', 'vulnerability', 'compliance', 'stability',
                    'reliability', 'critical-bug', 'data-integrity'];
  const matchedTags = work.tags.filter(t =>
    riskTags.some(rt => t.toLowerCase().includes(rt))
  );

  if (matchedTags.length > 0) {
    score += matchedTags.length * 20;
    evidence.push(`Risk-related tags: ${matchedTags.join(', ')}`);
  }

  // Check impact assessment
  if (work.impact?.riskLevel) {
    const riskScores: Record<string, number> = {
      none: 0,
      minimal: 5,
      low: 15,
      medium: 30,
      high: 50,
      critical: 70,
    };
    score += riskScores[work.impact.riskLevel] || 0;
    evidence.push(`Risk level: ${work.impact.riskLevel}`);
  }

  // Technical debt items inherently reduce risk
  if (work.type === 'debt') {
    score += 15;
    evidence.push('Technical debt reduction');
  }

  return {
    score: Math.min(100, score),
    evidence,
    dataQuality: matchedTags.length > 0 ? 'measured' : 'inferred',
  };
}

/**
 * Dependency Unblock Factor
 * How many other items does completing this unblock?
 */
export function calculateDependencyUnblock(
  ctx: PriorityComputeContext
): FactorResult {
  const { work, allWork } = ctx;
  const evidence: string[] = [];

  // Count items blocked by this work
  const blocksCount = work.dependencies.filter(d =>
    d.type === 'blocks' && d.status === 'pending'
  ).length;

  // Also check reverse - items in allWork that are blocked_by this
  const reverseBlocks = allWork.filter(w =>
    w.dependencies.some(d =>
      d.targetId === work.id &&
      d.type === 'blocked_by' &&
      d.status === 'pending'
    )
  ).length;

  const totalBlocking = blocksCount + reverseBlocks;

  if (totalBlocking === 0) {
    return {
      score: 20,
      evidence: ['Does not block other work items'],
      dataQuality: 'measured',
    };
  }

  // Score increases with number of blocked items, with diminishing returns
  // 1 item: 40, 2: 55, 3: 65, 4: 72, 5+: 75-85
  const score = Math.min(85, 40 + Math.log2(totalBlocking + 1) * 25);

  evidence.push(`Blocks ${totalBlocking} other work item(s)`);

  // Check if any blocked items are high priority
  const highPriorityBlocked = allWork.filter(w =>
    w.dependencies.some(d => d.targetId === work.id) &&
    (w.priority.level === 'critical' || w.priority.level === 'high')
  );

  if (highPriorityBlocked.length > 0) {
    evidence.push(`Including ${highPriorityBlocked.length} high-priority items`);
  }

  return {
    score,
    evidence,
    dataQuality: 'measured',
  };
}

/**
 * Effort/Value Factor (ROI)
 * What's the return on investment?
 */
export function calculateEffortValue(
  ctx: PriorityComputeContext
): FactorResult {
  const { work } = ctx;
  const evidence: string[] = [];

  // Get impact score (simplified)
  const impactScores: Record<string, number> = {
    none: 10, minimal: 25, low: 40, medium: 60, high: 80, critical: 95,
  };
  const impact = impactScores[work.impact?.userImpact || 'medium'] || 50;

  // Get effort score (inverse - lower effort = higher score)
  const effortScores: Record<string, number> = {
    trivial: 95, simple: 75, moderate: 50, complex: 25, heroic: 10,
  };
  const effortScore = effortScores[work.effort?.complexity || 'moderate'] || 50;

  // ROI = (impact * effort_ease) / 100
  const roi = (impact * effortScore) / 100;
  evidence.push(`Impact: ${work.impact?.userImpact || 'medium'}, Effort: ${work.effort?.complexity || 'moderate'}`);

  // High ROI items should score well
  if (roi > 70) {
    evidence.push('High ROI: Quick win opportunity');
  } else if (roi < 30) {
    evidence.push('Low ROI: High effort relative to impact');
  }

  return {
    score: roi,
    evidence,
    dataQuality: work.effort ? 'measured' : 'estimated',
  };
}

/**
 * Time Decay Factor
 * Older items without progress get attention
 */
export function calculateTimeDecay(
  ctx: PriorityComputeContext
): FactorResult {
  const { work, config } = ctx;
  const evidence: string[] = [];

  const createdAt = new Date(work.createdAt).getTime();
  const now = Date.now();
  const ageMs = now - createdAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Get last activity (status change or update)
  const lastActivity = work.statusHistory.length > 0
    ? new Date(work.statusHistory[work.statusHistory.length - 1].at).getTime()
    : createdAt;
  const staleDays = (now - lastActivity) / (1000 * 60 * 60 * 24);

  const { staleAfterDays, decayPerDay, maxDecay } = config.decay;

  // Base score starts neutral
  let score = 50;

  if (staleDays > staleAfterDays) {
    // Increase priority for stale items (they need attention)
    const staleBonus = Math.min(maxDecay, (staleDays - staleAfterDays) * decayPerDay);
    score += staleBonus;
    evidence.push(`Stale for ${Math.floor(staleDays - staleAfterDays)} days - needs attention`);
  } else if (ageDays < 7) {
    // New items get slight boost (fresh context)
    score += 10;
    evidence.push('Recently created - context is fresh');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    evidence,
    dataQuality: 'measured',
  };
}

/**
 * Momentum Factor
 * Related work recently completed increases priority
 */
export function calculateMomentum(
  ctx: PriorityComputeContext
): FactorResult {
  const { work, recentlyCompleted } = ctx;
  const evidence: string[] = [];

  if (recentlyCompleted.length === 0) {
    return {
      score: 50,
      evidence: ['No recently completed work to compare'],
      dataQuality: 'default',
    };
  }

  // Check for related work
  const relatedCompleted = recentlyCompleted.filter(completed => {
    // Same parent
    if (completed.parentId === work.parentId && work.parentId) return true;

    // Same context
    const sharedContexts = completed.traceability.affectedContexts.filter(c =>
      work.traceability.affectedContexts.includes(c)
    );
    if (sharedContexts.length > 0) return true;

    // Same files
    const sharedFiles = completed.traceability.affectedFiles.filter(f =>
      work.traceability.affectedFiles.some(wf => wf.path === f.path)
    );
    if (sharedFiles.length > 0) return true;

    // Shared tags
    const sharedTags = completed.tags.filter(t => work.tags.includes(t));
    if (sharedTags.length >= 2) return true;

    return false;
  });

  if (relatedCompleted.length === 0) {
    return {
      score: 40,
      evidence: ['No related work recently completed'],
      dataQuality: 'measured',
    };
  }

  // More related work = more momentum
  const score = Math.min(85, 50 + relatedCompleted.length * 10);
  evidence.push(`${relatedCompleted.length} related items recently completed`);
  evidence.push('Building on recent momentum');

  return {
    score,
    evidence,
    dataQuality: 'measured',
  };
}

/**
 * External Pressure Factor
 * Customer requests, deadlines, compliance requirements
 */
export function calculateExternalPressure(
  ctx: PriorityComputeContext
): FactorResult {
  const { work } = ctx;
  const evidence: string[] = [];
  let score = 30; // Default low

  // Check for deadline
  if (work.timing.deadline) {
    const deadline = new Date(work.timing.deadline.date).getTime();
    const now = Date.now();
    const daysUntil = (deadline - now) / (1000 * 60 * 60 * 24);

    if (daysUntil < 0) {
      score = 95;
      evidence.push('OVERDUE');
    } else if (daysUntil < 3) {
      score = 90;
      evidence.push(`Deadline in ${Math.ceil(daysUntil)} days - urgent`);
    } else if (daysUntil < 7) {
      score = 75;
      evidence.push(`Deadline in ${Math.ceil(daysUntil)} days`);
    } else if (daysUntil < 14) {
      score = 60;
      evidence.push(`Deadline in ${Math.ceil(daysUntil)} days`);
    }

    if (work.timing.deadline.type === 'hard') {
      score = Math.min(100, score + 10);
      evidence.push('Hard deadline - non-negotiable');
    }
  }

  // Check for external references (customer request, compliance, etc.)
  const externalRefs = work.traceability.externalRefs;
  if (externalRefs.length > 0) {
    score += externalRefs.length * 5;
    evidence.push(`${externalRefs.length} external reference(s)`);
  }

  // Check for compliance/regulatory tags
  const complianceTags = ['compliance', 'regulatory', 'audit', 'legal', 'gdpr', 'hipaa'];
  const hasCompliance = work.tags.some(t =>
    complianceTags.some(ct => t.toLowerCase().includes(ct))
  );
  if (hasCompliance) {
    score += 20;
    evidence.push('Compliance/regulatory requirement');
  }

  return {
    score: Math.min(100, score),
    evidence,
    dataQuality: work.timing.deadline ? 'measured' : 'inferred',
  };
}

/**
 * Hotspot Factor
 * Files/functions with high churn AND high complexity.
 * This is a strong predictor of future bugs and maintenance burden.
 *
 * Integration with src/strategic/hotspot.ts:
 * - Use computeHotspotScore() for entities in affectedFiles
 * - Requires churn data from temporal_graph.ts
 * - Requires complexity data from DebtMetrics
 */
export function calculateHotspotScore(
  ctx: PriorityComputeContext
): FactorResult {
  const { work } = ctx;
  const evidence: string[] = [];
  let score = 30; // Default low (most work doesn't target hotspots)

  // Check for hotspot-related tags
  const hotspotTags = ['hotspot', 'high-churn', 'complex', 'legacy', 'tech-debt', 'refactor'];
  const matchedTags = work.tags.filter(t =>
    hotspotTags.some(ht => t.toLowerCase().includes(ht))
  );

  if (matchedTags.length > 0) {
    score += matchedTags.length * 15;
    evidence.push(`Hotspot-related tags: ${matchedTags.join(', ')}`);
  }

  // Check if affected files are known hotspots (if hotspot data is available in context)
  // This would integrate with ctx.hotspotScores if provided
  const affectedFiles = work.traceability.affectedFiles;
  if (affectedFiles.length > 0) {
    // Check for high-change files (heuristic based on file history if available)
    const hasHighChangeFiles = affectedFiles.some(f =>
      f.changeType === 'modify' && (
        f.path.includes('core') ||
        f.path.includes('api') ||
        f.path.includes('service')
      )
    );
    if (hasHighChangeFiles) {
      score += 20;
      evidence.push('Affects core/api/service files (potential hotspots)');
    }
  }

  // Technical debt work inherently targets hotspots
  if (work.type === 'debt') {
    score += 25;
    evidence.push('Technical debt reduction targets problem areas');
  }

  // Refactoring work often targets hotspots
  if (work.tags.includes('refactoring') || work.tags.includes('cleanup')) {
    score += 15;
    evidence.push('Refactoring work addresses code quality');
  }

  return {
    score: Math.min(100, score),
    evidence,
    dataQuality: matchedTags.length > 0 ? 'measured' : 'inferred',
  };
}

// ============================================================================
// RANKING AND RECOMMENDATIONS
// ============================================================================

/**
 * Ranked list of work items
 */
export interface RankedWork {
  work: WorkPrimitive;
  rank: number;
  priority: ComputedPriority;
  actionable: boolean;          // Ready to work on
  actionableReason?: string;    // Why not actionable
}

export interface RankOptions {
  includeNonActionable?: boolean;
  limit?: number;
  types?: string[];
  contexts?: string[];
  minScore?: number;
}

/**
 * Focus recommendation
 */
export interface FocusRecommendation {
  type: 'area' | 'theme' | 'goal';
  name: string;
  description: string;
  reason: string;
  suggestedWork: string[];      // Work IDs
  expectedImpact: string;
  confidence: number;
  timeframe: 'immediate' | 'this_week' | 'this_sprint';
}

/**
 * Priority simulation - what happens if we complete this?
 */
export interface PrioritySimulation {
  workId: string;
  currentPriority: ComputedPriority;

  // Effects on other items
  unblocked: WorkReference[];
  priorityChanges: PriorityChange[];

  // Aggregate impact
  totalItemsAffected: number;
  netPriorityChange: number;    // Sum of all priority changes
  recommendation: string;
}

export interface PriorityChange {
  workId: string;
  title: string;
  from: number;
  to: number;
  reason: string;
}

// ============================================================================
// ENGINE INTERFACE
// ============================================================================

/**
 * Prioritization Engine interface
 */
export interface PrioritizationEngine {
  /**
   * Compute priority for a single work item
   */
  computePriority(
    work: WorkPrimitive,
    context: Partial<PriorityComputeContext>
  ): Promise<PriorityComputation>;

  /**
   * Rank all work items
   */
  rankAll(
    work: WorkPrimitive[],
    options?: RankOptions
  ): Promise<RankedWork[]>;

  /**
   * Get focus recommendations
   */
  getRecommendedFocus(
    work: WorkPrimitive[],
    limit?: number
  ): Promise<FocusRecommendation[]>;

  /**
   * Explain why something has its priority
   */
  explainPriority(workId: string): Promise<PriorityExplanation>;

  /**
   * Simulate completing a work item
   */
  simulateCompletion(
    workId: string,
    allWork: WorkPrimitive[]
  ): Promise<PrioritySimulation>;

  /**
   * Add or update a prioritization rule
   */
  addRule(rule: Omit<PrioritizationRule, 'id' | 'createdAt' | 'usageCount'>): Promise<PrioritizationRule>;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PrioritizationConfig>): Promise<void>;
}
