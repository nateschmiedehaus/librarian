/**
 * @fileoverview Tests for Evaluation Harness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EvaluationHarness,
  createEvaluationHarness,
  DEFAULT_EVAL_CONFIG,
  type EvaluationQuery,
  type EvaluationConfig,
} from '../harness.js';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Evaluation Harness', () => {
  let harness: EvaluationHarness;

  beforeEach(() => {
    harness = createEvaluationHarness();
  });

  // ============================================================================
  // SINGLE QUERY EVALUATION
  // ============================================================================

  describe('single query evaluation', () => {
    it('should calculate precision@k correctly', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find authentication functions',
        relevantDocs: ['doc1', 'doc2', 'doc3'],
      };

      // 2 out of 5 retrieved are relevant
      const result = harness.evaluateQuery(
        query,
        ['doc1', 'doc4', 'doc2', 'doc5', 'doc6'],
        100
      );

      expect(result.metrics.precision).toBeCloseTo(0.4, 2); // 2/5
    });

    it('should calculate recall@k correctly', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find authentication functions',
        relevantDocs: ['doc1', 'doc2', 'doc3', 'doc4'],
      };

      // 2 out of 4 relevant docs found
      const result = harness.evaluateQuery(
        query,
        ['doc1', 'doc5', 'doc2', 'doc6', 'doc7'],
        100
      );

      expect(result.metrics.recall).toBeCloseTo(0.5, 2); // 2/4
    });

    it('should calculate F1 score correctly', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1', 'doc2'],
      };

      const result = harness.evaluateQuery(
        query,
        ['doc1', 'doc3'], // precision=0.5, recall=0.5
        100
      );

      expect(result.metrics.f1).toBeCloseTo(0.5, 2); // 2*0.5*0.5/(0.5+0.5)
    });

    it('should calculate MRR correctly', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc3'],
      };

      // First relevant doc at position 3 (0-indexed: 2)
      const result = harness.evaluateQuery(
        query,
        ['doc1', 'doc2', 'doc3', 'doc4'],
        100
      );

      expect(result.metrics.mrr).toBeCloseTo(1 / 3, 2);
    });

    it('should return MRR=0 when no relevant docs found', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc5'],
      };

      const result = harness.evaluateQuery(
        query,
        ['doc1', 'doc2', 'doc3', 'doc4'],
        100
      );

      expect(result.metrics.mrr).toBe(0);
    });

    it('should calculate nDCG correctly with binary relevance', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1', 'doc2', 'doc3'],
      };

      // Perfect ranking
      const result = harness.evaluateQuery(
        query,
        ['doc1', 'doc2', 'doc3'],
        100
      );

      expect(result.metrics.ndcg).toBeCloseTo(1.0, 2);
    });

    it('should calculate nDCG correctly with graded relevance', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1', 'doc2', 'doc3'],
        relevanceGrades: {
          doc1: 3,
          doc2: 2,
          doc3: 1,
        },
      };

      // Suboptimal ranking
      const result = harness.evaluateQuery(
        query,
        ['doc3', 'doc2', 'doc1'], // Worst case: least relevant first
        100
      );

      expect(result.metrics.ndcg).toBeLessThan(1.0);
      expect(result.metrics.ndcg).toBeGreaterThan(0);
    });

    it('should calculate MAP correctly', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1', 'doc3'],
      };

      // doc1 at position 1 (precision=1), doc3 at position 3 (precision=2/3)
      const result = harness.evaluateQuery(
        query,
        ['doc1', 'doc2', 'doc3', 'doc4'],
        100
      );

      // AP = (1/1 + 2/3) / 2 = 0.833
      expect(result.metrics.map).toBeCloseTo(0.833, 2);
    });

    it('should track latency', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1'],
      };

      const result = harness.evaluateQuery(query, ['doc1'], 150);

      expect(result.metrics.latency).toBe(150);
      expect(result.latencyMs).toBe(150);
    });

    it('should calculate throughput', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1'],
      };

      const result = harness.evaluateQuery(query, ['doc1'], 200);

      expect(result.metrics.throughput).toBe(5); // 1000/200
    });

    it('should evaluate confidence calibration', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1'],
        expectedConfidence: { min: 0.7, max: 0.9 },
      };

      const inRange = harness.evaluateQuery(query, ['doc1'], 100, 0.8);
      const outOfRange = harness.evaluateQuery(query, ['doc1'], 100, 0.5);

      expect(inRange.metrics.confidence_calibration).toBe(1);
      expect(outOfRange.metrics.confidence_calibration).toBe(0);
    });

    it('should handle empty retrieved docs', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: ['doc1', 'doc2'],
      };

      const result = harness.evaluateQuery(query, [], 100);

      expect(result.metrics.precision).toBe(0);
      expect(result.metrics.recall).toBe(0);
      expect(result.metrics.f1).toBe(0);
    });

    it('should handle empty relevant docs', () => {
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Find auth',
        relevantDocs: [],
      };

      const result = harness.evaluateQuery(query, ['doc1', 'doc2'], 100);

      expect(result.metrics.precision).toBe(0);
      expect(result.metrics.recall).toBe(0);
    });
  });

  // ============================================================================
  // BATCH EVALUATION
  // ============================================================================

  describe('batch evaluation', () => {
    it('should evaluate multiple queries', async () => {
      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'] },
        { id: 'q3', intent: 'Query 3', relevantDocs: ['doc3'] },
      ];

      const mockRetriever = async (query: EvaluationQuery) => ({
        docs: [query.relevantDocs[0]], // Perfect retrieval
        confidence: 0.9,
      });

      const report = await harness.runBatch(queries, mockRetriever);

      expect(report.queryCount).toBe(3);
      expect(report.queryResults.length).toBe(3);
    });

    it('should handle retriever errors gracefully', async () => {
      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'] },
      ];

      const mockRetriever = async (query: EvaluationQuery) => {
        if (query.id === 'q2') {
          throw new Error('Retrieval failed');
        }
        return { docs: ['doc1'] };
      };

      const report = await harness.runBatch(queries, mockRetriever);

      expect(report.queryResults[1].error).toBe('Retrieval failed');
    });

    it('should perform warmup queries', async () => {
      const warmupHarness = createEvaluationHarness({ warmupQueries: 2 });
      let callCount = 0;

      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'] },
      ];

      const mockRetriever = async () => {
        callCount++;
        return { docs: ['doc1'] };
      };

      await warmupHarness.runBatch(queries, mockRetriever);

      // 2 warmup + 2 actual = 4 calls
      expect(callCount).toBe(4);
    });
  });

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  describe('report generation', () => {
    beforeEach(() => {
      // Add some results
      harness.evaluateQuery(
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'], tags: ['tag1'] },
        ['doc1', 'doc2'],
        100
      );
      harness.evaluateQuery(
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'], tags: ['tag1', 'tag2'] },
        ['doc2'],
        150
      );
      harness.evaluateQuery(
        { id: 'q3', intent: 'Query 3', relevantDocs: ['doc3'], tags: ['tag2'] },
        ['doc1'], // Wrong doc
        200
      );
    });

    it('should generate report with correct structure', () => {
      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'], tags: ['tag1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'], tags: ['tag1', 'tag2'] },
        { id: 'q3', intent: 'Query 3', relevantDocs: ['doc3'], tags: ['tag2'] },
      ];

      const report = harness.generateReport(queries);

      expect(report.id).toMatch(/^eval_/);
      expect(report.timestamp).toBeDefined();
      expect(report.queryCount).toBe(3);
      expect(report.aggregateMetrics).toBeDefined();
      expect(report.byTag).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should calculate aggregate metrics', () => {
      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'], tags: ['tag1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'], tags: ['tag1', 'tag2'] },
        { id: 'q3', intent: 'Query 3', relevantDocs: ['doc3'], tags: ['tag2'] },
      ];

      const report = harness.generateReport(queries);

      expect(report.aggregateMetrics.precision).toBeDefined();
      expect(report.aggregateMetrics.precision.mean).toBeGreaterThanOrEqual(0);
      expect(report.aggregateMetrics.precision.median).toBeGreaterThanOrEqual(0);
      expect(report.aggregateMetrics.precision.std).toBeGreaterThanOrEqual(0);
    });

    it('should calculate percentiles', () => {
      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'], tags: ['tag1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'], tags: ['tag1', 'tag2'] },
        { id: 'q3', intent: 'Query 3', relevantDocs: ['doc3'], tags: ['tag2'] },
      ];

      const report = harness.generateReport(queries);

      expect(report.aggregateMetrics.latency.percentiles).toBeDefined();
      expect(report.aggregateMetrics.latency.percentiles.p50).toBeDefined();
      expect(report.aggregateMetrics.latency.percentiles.p90).toBeDefined();
      expect(report.aggregateMetrics.latency.percentiles.p95).toBeDefined();
      expect(report.aggregateMetrics.latency.percentiles.p99).toBeDefined();
    });

    it('should aggregate by tag', () => {
      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'], tags: ['tag1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'], tags: ['tag1', 'tag2'] },
        { id: 'q3', intent: 'Query 3', relevantDocs: ['doc3'], tags: ['tag2'] },
      ];

      const report = harness.generateReport(queries);

      expect(report.byTag['tag1']).toBeDefined();
      expect(report.byTag['tag2']).toBeDefined();
    });

    it('should generate quality summary', () => {
      const queries: EvaluationQuery[] = [
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1'], tags: ['tag1'] },
        { id: 'q2', intent: 'Query 2', relevantDocs: ['doc2'], tags: ['tag1', 'tag2'] },
        { id: 'q3', intent: 'Query 3', relevantDocs: ['doc3'], tags: ['tag2'] },
      ];

      const report = harness.generateReport(queries);

      expect(['A', 'B', 'C', 'D', 'F']).toContain(report.summary.qualityGrade);
      expect(report.summary.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.qualityScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.summary.findings)).toBe(true);
      expect(Array.isArray(report.summary.recommendations)).toBe(true);
      expect(typeof report.summary.passed).toBe('boolean');
    });

    it('should include failure reasons when thresholds not met', () => {
      // Create harness with high thresholds
      const strictHarness = createEvaluationHarness({
        minPrecision: 0.95,
        minRecall: 0.95,
        maxLatencyMs: 50,
      });

      strictHarness.evaluateQuery(
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1', 'doc2'] },
        ['doc1'], // Low precision/recall
        100 // High latency
      );

      const report = strictHarness.generateReport([
        { id: 'q1', intent: 'Query 1', relevantDocs: ['doc1', 'doc2'] },
      ]);

      expect(report.summary.passed).toBe(false);
      expect(report.summary.failureReasons).toBeDefined();
      expect(report.summary.failureReasons!.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  describe('configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_EVAL_CONFIG.cutoffK).toBe(10);
      expect(DEFAULT_EVAL_CONFIG.minPrecision).toBe(0.7);
      expect(DEFAULT_EVAL_CONFIG.minRecall).toBe(0.6);
      expect(DEFAULT_EVAL_CONFIG.maxLatencyMs).toBe(500);
    });

    it('should merge custom configuration', () => {
      const customHarness = createEvaluationHarness({
        cutoffK: 5,
        minPrecision: 0.8,
      });

      // Verify custom config is applied by checking behavior
      const query: EvaluationQuery = {
        id: 'q1',
        intent: 'Test',
        relevantDocs: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6'],
      };

      const result = customHarness.evaluateQuery(
        query,
        ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6', 'doc7', 'doc8', 'doc9', 'doc10'],
        100
      );

      // With cutoffK=5, only first 5 docs should be considered
      expect(result.metrics.precision).toBeCloseTo(1.0, 2); // 5/5
      expect(result.metrics.recall).toBeCloseTo(5 / 6, 2); // 5/6 relevant found
    });

    it('should support configurable metrics', () => {
      const metricsHarness = createEvaluationHarness({
        metrics: ['precision', 'recall'],
      });

      metricsHarness.evaluateQuery(
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
        ['doc1'],
        100
      );

      const report = metricsHarness.generateReport([
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
      ]);

      expect(report.aggregateMetrics.precision).toBeDefined();
      expect(report.aggregateMetrics.recall).toBeDefined();
    });
  });

  // ============================================================================
  // UTILITIES
  // ============================================================================

  describe('utilities', () => {
    it('should reset results', () => {
      harness.evaluateQuery(
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
        ['doc1'],
        100
      );

      expect(harness.resultCount).toBe(1);

      harness.reset();

      expect(harness.resultCount).toBe(0);
    });

    it('should track result count', () => {
      expect(harness.resultCount).toBe(0);

      harness.evaluateQuery(
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
        ['doc1'],
        100
      );
      harness.evaluateQuery(
        { id: 'q2', intent: 'Test', relevantDocs: ['doc2'] },
        ['doc2'],
        100
      );

      expect(harness.resultCount).toBe(2);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('should handle single result', () => {
      harness.evaluateQuery(
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
        ['doc1'],
        100
      );

      const report = harness.generateReport([
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
      ]);

      expect(report.aggregateMetrics.precision.mean).toBe(1);
      expect(report.aggregateMetrics.precision.std).toBe(0);
    });

    it('should handle queries without tags', () => {
      harness.evaluateQuery(
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
        ['doc1'],
        100
      );

      const report = harness.generateReport([
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
      ]);

      expect(report.byTag['untagged']).toBeDefined();
    });

    it('should handle very low latency', () => {
      const result = harness.evaluateQuery(
        { id: 'q1', intent: 'Test', relevantDocs: ['doc1'] },
        ['doc1'],
        1
      );

      expect(result.metrics.throughput).toBe(1000);
    });

    it('should handle large result sets', () => {
      const relevantDocs = Array.from({ length: 100 }, (_, i) => `doc${i}`);
      const retrievedDocs = Array.from({ length: 50 }, (_, i) => `doc${i * 2}`);

      const result = harness.evaluateQuery(
        { id: 'q1', intent: 'Test', relevantDocs },
        retrievedDocs,
        100
      );

      expect(result.metrics.precision).toBeGreaterThan(0);
      expect(result.metrics.recall).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createEvaluationHarness', () => {
  it('should create harness with default config', () => {
    const harness = createEvaluationHarness();
    expect(harness).toBeInstanceOf(EvaluationHarness);
  });

  it('should create harness with custom config', () => {
    const harness = createEvaluationHarness({
      cutoffK: 20,
      minPrecision: 0.9,
    });
    expect(harness).toBeInstanceOf(EvaluationHarness);
  });
});
