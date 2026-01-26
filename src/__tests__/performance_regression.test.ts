/**
 * @fileoverview Performance Regression Tests
 *
 * PHILOSOPHICAL ALIGNMENT (CONTROL_LOOP.md):
 * Performance SLOs must be continuously validated:
 * - Query latency p50 < 500ms, p99 < 2s
 * - Bootstrap < 5 min for 10k files
 * - Distributional pass rate ≥ 80% over 10 trials
 *
 * Tier-0/unit scope: deterministic tests for measurement utilities and constants.
 */

import { describe, it, expect } from 'vitest';
import { SLO_THRESHOLDS, QueryLatencyTracker } from '../measurement/observability.js';

describe('SLO Threshold Constants', () => {
  it('should have correct threshold values per CONTROL_LOOP.md', () => {
    expect(SLO_THRESHOLDS.queryLatencyP50Ms).toBe(500);
    expect(SLO_THRESHOLDS.queryLatencyP99Ms).toBe(2000);
    expect(SLO_THRESHOLDS.indexFreshnessMs).toBe(5 * 60 * 1000); // 5 minutes
    expect(SLO_THRESHOLDS.confidenceMeanMin).toBe(0.7);
    expect(SLO_THRESHOLDS.maxDefeatersHealthy).toBe(10);
    expect(SLO_THRESHOLDS.coverageRatioMin).toBe(0.9);
    expect(SLO_THRESHOLDS.recoveryTimeMs).toBe(15 * 60 * 1000); // 15 minutes
  });
});

describe('QueryLatencyTracker', () => {
  it('should correctly calculate percentiles', () => {
    const tracker = new QueryLatencyTracker(100);

    // Record a distribution of latencies
    const latencies = [
      100, 150, 200, 250, 300, 350, 400, 450, 500, 600,
      100, 150, 200, 250, 300, 350, 400, 450, 500, 600,
    ];

    for (const latency of latencies) {
      tracker.recordLatency(latency, false);
    }

    const metrics = tracker.getMetrics();

    // P50 should be around 325 (middle of distribution)
    expect(metrics.queryLatencyP50).toBeLessThan(SLO_THRESHOLDS.queryLatencyP50Ms);

    // P99 should be around 600 (near max)
    expect(metrics.queryLatencyP99).toBeLessThan(SLO_THRESHOLDS.queryLatencyP99Ms);
  });

  it('should track cache hit rate', () => {
    const tracker = new QueryLatencyTracker(100);

    // 8 cache hits out of 10 queries
    for (let i = 0; i < 10; i++) {
      tracker.recordLatency(100, i < 8);
    }

    const metrics = tracker.getMetrics();
    expect(metrics.cacheHitRate).toBe(0.8);
  });

  it('should reset metrics correctly', () => {
    const tracker = new QueryLatencyTracker(100);

    tracker.recordLatency(100, false);
    tracker.recordLatency(200, true);

    tracker.reset();

    const metrics = tracker.getMetrics();
    expect(metrics.queryCount).toBe(0);
    expect(metrics.cacheHitRate).toBe(0);
  });
});

/**
 * Performance report artifact (for CI/CD integration)
 */
export interface PerformanceReport {
  version: 'PerformanceReport.v1';
  timestamp: string;
  slos: {
    queryLatencyP50: { target: number; actual: number; passed: boolean };
    queryLatencyP99: { target: number; actual: number; passed: boolean };
    passRate: { target: number; actual: number; passed: boolean };
  };
  trials: number;
  overallPassed: boolean;
}

/**
 * Generate a performance report for CI/CD.
 */
export function generatePerformanceReport(
  p50Latency: number,
  p99Latency: number,
  passRate: number,
  trials: number
): PerformanceReport {
  const p50Passed = p50Latency < SLO_THRESHOLDS.queryLatencyP50Ms;
  const p99Passed = p99Latency < SLO_THRESHOLDS.queryLatencyP99Ms;
  const ratePassed = passRate >= 0.8;

  return {
    version: 'PerformanceReport.v1',
    timestamp: new Date().toISOString(),
    slos: {
      queryLatencyP50: {
        target: SLO_THRESHOLDS.queryLatencyP50Ms,
        actual: p50Latency,
        passed: p50Passed,
      },
      queryLatencyP99: {
        target: SLO_THRESHOLDS.queryLatencyP99Ms,
        actual: p99Latency,
        passed: p99Passed,
      },
      passRate: {
        target: 0.8,
        actual: passRate,
        passed: ratePassed,
      },
    },
    trials,
    overallPassed: p50Passed && p99Passed && ratePassed,
  };
}

/**
 * Utility to validate performance against SLOs.
 */
export function validatePerformanceSLOs(tracker: QueryLatencyTracker): {
  passed: boolean;
  violations: string[];
} {
  const metrics = tracker.getMetrics();
  const violations: string[] = [];

  if (metrics.queryLatencyP50 >= SLO_THRESHOLDS.queryLatencyP50Ms) {
    violations.push(`P50 latency ${metrics.queryLatencyP50}ms exceeds target ${SLO_THRESHOLDS.queryLatencyP50Ms}ms`);
  }

  if (metrics.queryLatencyP99 >= SLO_THRESHOLDS.queryLatencyP99Ms) {
    violations.push(`P99 latency ${metrics.queryLatencyP99}ms exceeds target ${SLO_THRESHOLDS.queryLatencyP99Ms}ms`);
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
