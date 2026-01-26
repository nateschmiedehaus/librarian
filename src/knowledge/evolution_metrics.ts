import type {
  FitnessMetrics,
  PerformanceMetrics,
  TaskOutcome,
  TrendAnalysis,
} from './evolution.js';

export function filterOutcomes(
  outcomes: TaskOutcome[],
  timeRange?: { start: Date; end: Date }
): TaskOutcome[] {
  if (!timeRange) return outcomes;
  return outcomes.filter((outcome) => outcome.timestamp >= timeRange.start && outcome.timestamp <= timeRange.end);
}

export function calculateSuccessRate(outcomes: TaskOutcome[]): number {
  if (outcomes.length === 0) return 0;
  return outcomes.filter((o) => o.success).length / outcomes.length;
}

export function calculateQualityScore(outcomes: TaskOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const total = outcomes.reduce((sum, o) => sum + o.qualityScore, 0);
  return total / outcomes.length;
}

export function calculateSpeedScore(outcomes: TaskOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const durations = outcomes.map((o) => o.durationMs).filter((d) => d > 0);
  if (durations.length === 0) return 0;
  const sorted = durations.slice().sort((a, b) => a - b);
  const avg = sorted.reduce((sum, d) => sum + d, 0) / sorted.length;
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? avg;
  return Math.max(0, Math.min(1, p75 / (avg + p75)));
}

export function determineTrend(outcomes: TaskOutcome[]): FitnessMetrics['trend'] {
  if (outcomes.length < 10) return 'stable';
  const sorted = outcomes.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const recent = sorted.slice(-10);
  const older = sorted.slice(-20, -10);
  if (older.length === 0) return 'stable';

  const recentSuccess = calculateSuccessRate(recent);
  const olderSuccess = calculateSuccessRate(older);

  if (recentSuccess > olderSuccess + 0.1) return 'improving';
  if (recentSuccess < olderSuccess - 0.1) return 'declining';
  return 'stable';
}

export function buildTrendAnalysis(outcomes: TaskOutcome[]): TrendAnalysis {
  const sorted = outcomes.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (sorted.length < 5) {
    return {
      metric: 'task_success_rate',
      direction: 'stable',
      magnitude: 0,
      confidence: sorted.length / 5,
      prediction: 'Not enough data to forecast',
    };
  }

  const window = Math.max(5, Math.floor(sorted.length / 4));
  const recent = sorted.slice(-window);
  const earlier = sorted.slice(-window * 2, -window);
  const recentRate = calculateSuccessRate(recent);
  const earlierRate = calculateSuccessRate(earlier);
  const delta = recentRate - earlierRate;
  const direction: TrendAnalysis['direction'] = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'stable';

  return {
    metric: 'task_success_rate',
    direction,
    magnitude: Math.abs(delta),
    confidence: Math.min(1, sorted.length / 40),
    prediction: direction === 'up'
      ? 'Success rate improving over recent tasks'
      : direction === 'down'
      ? 'Success rate declining; investigate recent regressions'
      : 'Success rate stable',
  };
}

export function buildPerformanceMetrics(outcomes: TaskOutcome[]): PerformanceMetrics {
  const successRate = calculateSuccessRate(outcomes);
  const avgDuration = outcomes.length > 0
    ? outcomes.reduce((sum, o) => sum + o.durationMs, 0) / outcomes.length
    : 0;
  const errorRate = outcomes.length > 0
    ? outcomes.filter((o) => !o.success).length / outcomes.length
    : 0;
  const avgQuality = calculateQualityScore(outcomes);

  const sorted = outcomes.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let throughput = outcomes.length;
  if (sorted.length > 1) {
    const spanMs = sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime();
    throughput = spanMs > 0 ? Math.round((outcomes.length / spanMs) * 86_400_000) : outcomes.length;
  }

  return {
    taskSuccessRate: successRate,
    averageTaskDuration: avgDuration,
    errorRate,
    throughput,
    qualityScore: avgQuality,
  };
}

export function getAgentComparisons(outcomes: TaskOutcome[]): FitnessMetrics['comparisons'] {
  const byAgent = new Map<string, TaskOutcome[]>();
  for (const outcome of outcomes) {
    if (!byAgent.has(outcome.agentId)) byAgent.set(outcome.agentId, []);
    byAgent.get(outcome.agentId)?.push(outcome);
  }

  const overall = calculateSuccessRate(outcomes);

  return [...byAgent.entries()].map(([agentId, agentOutcomes]) => {
    const fitness = calculateSuccessRate(agentOutcomes);
    return {
      name: agentId,
      fitness,
      delta: fitness - overall,
    };
  });
}
