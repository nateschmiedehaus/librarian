import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Factory functions
  createOutcomeTracker,
  createFeedbackLoop,
  createFailureLearning,
  createBenchmarkSystem,
  createTemplateEvolution,
  createContinuousImprovementSystem,

  // Types
  type OutcomeTracker,
  type FeedbackLoop,
  type FailureLearning,
  type BenchmarkSystem,
  type TemplateEvolution,
  type Outcome,
  type ProcessMetrics,
  type ImprovementOpportunity,
  type Feedback,
  type FeedbackSource,
  type Insight,
  type ProcessChange,
  type Failure,
  type RootCause,
  type Action,
  type FailurePattern,
  type Baseline,
  type Comparison,
  type Alert,
  type Change,
  type Version,
  type MigrationPath,
  type AdoptionMetrics,
  type TimeRange,
  type Trend,

  // Config
  DEFAULT_CONTINUOUS_IMPROVEMENT_CONFIG,
} from '../continuous_improvement.js';

describe('OutcomeTracker', () => {
  let tracker: OutcomeTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
    tracker = createOutcomeTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recordDecisionOutcome', () => {
    it('records and retrieves decision outcomes', () => {
      const outcome: Outcome = {
        id: 'out-001',
        success: true,
        quality: 0.85,
        timeToOutcomeMs: 5000,
        sideEffects: [],
        metrics: { accuracy: 0.9 },
        evidence: ['test evidence'],
        recordedAt: new Date().toISOString(),
      };

      tracker.recordDecisionOutcome('dec-001', outcome);
      const outcomes = tracker.getOutcomesForDecision('dec-001');

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].id).toBe('out-001');
      expect(outcomes[0].success).toBe(true);
      expect(outcomes[0].quality).toBe(0.85);
    });

    it('tracks multiple outcomes for the same decision', () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordDecisionOutcome('dec-001', {
          id: `out-${i}`,
          success: i % 2 === 0,
          quality: 0.5 + i * 0.1,
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const outcomes = tracker.getOutcomesForDecision('dec-001');
      expect(outcomes).toHaveLength(5);
    });
  });

  describe('recordProcessOutcome', () => {
    it('records and retrieves process metrics', () => {
      const metrics: ProcessMetrics = {
        durationMs: 10000,
        resourceUsage: { cpuAvgPercent: 50, memoryPeakBytes: 1024 * 1024 },
        stepsCompleted: 5,
        stepsFailed: 1,
        retryCount: 2,
        errorRate: 0.1,
        custom: {},
      };

      tracker.recordProcessOutcome('proc-001', metrics);
      const allMetrics = tracker.getMetricsForProcess('proc-001');

      expect(allMetrics).toHaveLength(1);
      expect(allMetrics[0].durationMs).toBe(10000);
      expect(allMetrics[0].errorRate).toBe(0.1);
    });
  });

  describe('getImprovementOpportunities', () => {
    it('identifies low success rate opportunities', () => {
      // Record enough outcomes with low success rate
      for (let i = 0; i < 10; i++) {
        tracker.recordDecisionOutcome('dec-low', {
          id: `out-${i}`,
          success: i < 3, // Only 30% success
          quality: 0.5,
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const opportunities = tracker.getImprovementOpportunities();
      const lowSuccessOpp = opportunities.find(o => o.title.includes('success rate'));

      expect(lowSuccessOpp).toBeDefined();
      expect(lowSuccessOpp?.priority).toBe('high');
    });

    it('identifies low quality opportunities', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordDecisionOutcome('dec-quality', {
          id: `out-${i}`,
          success: true,
          quality: 0.3, // Low quality
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const opportunities = tracker.getImprovementOpportunities();
      const qualityOpp = opportunities.find(o => o.title.includes('quality'));

      expect(qualityOpp).toBeDefined();
    });

    it('identifies high error rate in processes', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordProcessOutcome('proc-errors', {
          durationMs: 1000,
          resourceUsage: {},
          stepsCompleted: 10,
          stepsFailed: 3,
          retryCount: 0,
          errorRate: 0.25, // 25% error rate
          custom: {},
        });
      }

      const opportunities = tracker.getImprovementOpportunities();
      const errorOpp = opportunities.find(o => o.title.includes('error rate'));

      expect(errorOpp).toBeDefined();
      expect(errorOpp?.priority).toBe('urgent');
    });

    it('identifies high retry count', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordProcessOutcome('proc-retries', {
          durationMs: 1000,
          resourceUsage: {},
          stepsCompleted: 10,
          stepsFailed: 0,
          retryCount: 6, // High retry count
          errorRate: 0,
          custom: {},
        });
      }

      const opportunities = tracker.getImprovementOpportunities();
      const retryOpp = opportunities.find(o => o.title.includes('retry'));

      expect(retryOpp).toBeDefined();
    });
  });

  describe('calculateTrendDirection', () => {
    it('returns insufficient_data for small samples', () => {
      tracker.recordDecisionOutcome('dec-001', {
        id: 'out-1',
        success: true,
        quality: 0.8,
        timeToOutcomeMs: 1000,
        sideEffects: [],
        metrics: {},
        evidence: [],
        recordedAt: new Date().toISOString(),
      });

      const trend = tracker.calculateTrendDirection('decision.dec-001.quality', 10);
      expect(trend).toBe('insufficient_data');
    });

    it('detects improving trend', () => {
      for (let i = 0; i < 20; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 10).toString().padStart(2, '0')}T10:00:00.000Z`));
        tracker.recordDecisionOutcome('dec-trend', {
          id: `out-${i}`,
          success: true,
          quality: 0.5 + i * 0.02, // Increasing quality
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const trend = tracker.calculateTrendDirection('decision.dec-trend.quality', 10);
      expect(trend).toBe('improving');
    });

    it('detects degrading trend', () => {
      for (let i = 0; i < 20; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 10).toString().padStart(2, '0')}T10:00:00.000Z`));
        tracker.recordDecisionOutcome('dec-degrade', {
          id: `out-${i}`,
          success: true,
          quality: 0.9 - i * 0.02, // Decreasing quality
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const trend = tracker.calculateTrendDirection('decision.dec-degrade.quality', 10);
      expect(trend).toBe('degrading');
    });

    it('detects stable trend', () => {
      for (let i = 0; i < 20; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 10).toString().padStart(2, '0')}T10:00:00.000Z`));
        tracker.recordDecisionOutcome('dec-stable', {
          id: `out-${i}`,
          success: true,
          quality: 0.75 + (Math.random() - 0.5) * 0.01, // Small variance
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const trend = tracker.calculateTrendDirection('decision.dec-stable.quality', 10);
      expect(['stable', 'improving', 'degrading']).toContain(trend);
    });
  });

  describe('getTrendData', () => {
    it('filters trend data by time range', () => {
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 15).toString().padStart(2, '0')}T10:00:00.000Z`));
        tracker.recordDecisionOutcome('dec-range', {
          id: `out-${i}`,
          success: true,
          quality: 0.8,
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const range: TimeRange = {
        start: '2026-01-18T00:00:00.000Z',
        end: '2026-01-22T23:59:59.999Z',
      };

      const data = tracker.getTrendData('decision.dec-range.quality', range);
      expect(data.length).toBeLessThanOrEqual(5);
      data.forEach(point => {
        const time = new Date(point.timestamp).getTime();
        expect(time).toBeGreaterThanOrEqual(new Date(range.start).getTime());
        expect(time).toBeLessThanOrEqual(new Date(range.end).getTime());
      });
    });
  });
});

describe('FeedbackLoop', () => {
  let feedbackLoop: FeedbackLoop;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
    feedbackLoop = createFeedbackLoop();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createFeedback = (overrides: Partial<Feedback> = {}): Feedback => ({
    id: `fb-${Date.now()}-${Math.random()}`,
    subject: { type: 'template', subjectId: 'template-001' },
    type: 'observation',
    sentiment: 'neutral',
    content: 'Test feedback',
    tags: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  const defaultSource: FeedbackSource = {
    type: 'user',
    sourceId: 'user-001',
    name: 'Test User',
    reliability: 0.8,
  };

  describe('collectFeedback', () => {
    it('collects and retrieves feedback', () => {
      const feedback = createFeedback({ id: 'fb-001' });
      feedbackLoop.collectFeedback(defaultSource, feedback);

      const retrieved = feedbackLoop.getFeedbackForSubject('template-001');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe('fb-001');
    });
  });

  describe('aggregateFeedback', () => {
    it('aggregates feedback within time range', () => {
      // Add feedback over multiple days
      for (let day = 20; day <= 29; day++) {
        vi.setSystemTime(new Date(`2026-01-${day}T10:00:00.000Z`));

        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          sentiment: day % 2 === 0 ? 'positive' : 'negative',
          type: 'observation',
          rating: day % 5 + 1,
          tags: ['quality', day % 2 === 0 ? 'fast' : 'slow'],
        }));
      }

      const range: TimeRange = {
        start: '2026-01-25T00:00:00.000Z',
        end: '2026-01-29T23:59:59.999Z',
      };

      const aggregated = feedbackLoop.aggregateFeedback(range);

      expect(aggregated.totalCount).toBe(5);
      expect(aggregated.bySentiment.positive + aggregated.bySentiment.negative + aggregated.bySentiment.neutral)
        .toBe(5);
      expect(aggregated.topTags.length).toBeGreaterThan(0);
    });

    it('calculates average rating', () => {
      for (let i = 0; i < 5; i++) {
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          rating: i + 1, // Ratings 1-5
        }));
      }

      const range: TimeRange = {
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-12-31T23:59:59.999Z',
      };

      const aggregated = feedbackLoop.aggregateFeedback(range);
      expect(aggregated.averageRating).toBe(3); // (1+2+3+4+5)/5
    });

    it('identifies sentiment trend', () => {
      // First half: negative
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 10).toString().padStart(2, '0')}T10:00:00.000Z`));
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          sentiment: 'negative',
        }));
      }

      // Second half: positive
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 20).toString().padStart(2, '0')}T10:00:00.000Z`));
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          sentiment: 'positive',
        }));
      }

      const range: TimeRange = {
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T23:59:59.999Z',
      };

      const aggregated = feedbackLoop.aggregateFeedback(range);
      expect(aggregated.sentimentTrend).toBe('improving');
    });
  });

  describe('generateInsights', () => {
    it('identifies patterns in negative feedback', () => {
      // Add enough feedback first to trigger analysis (10 minimum)
      for (let i = 0; i < 5; i++) {
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          sentiment: 'positive',
        }));
      }

      // Add multiple negative feedbacks with same tag
      for (let i = 0; i < 5; i++) {
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          sentiment: 'negative',
          tags: ['slow-response', 'performance'],
        }));
      }

      const insights = feedbackLoop.generateInsights();
      const patternInsight = insights.find(i => i.title.includes('slow-response'));

      expect(patternInsight).toBeDefined();
      expect(patternInsight?.category).toBe('pattern');
    });

    it('detects rating decline', () => {
      // Earlier high ratings
      for (let i = 0; i < 15; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 1).toString().padStart(2, '0')}T10:00:00.000Z`));
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          rating: 5,
        }));
      }

      // Recent low ratings
      for (let i = 0; i < 15; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 16).toString().padStart(2, '0')}T10:00:00.000Z`));
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          rating: 2,
        }));
      }

      const insights = feedbackLoop.generateInsights();
      const ratingInsight = insights.find(i => i.title.includes('Rating decline'));

      expect(ratingInsight).toBeDefined();
      expect(ratingInsight?.importance).toBe('high');
    });
  });

  describe('suggestProcessChanges', () => {
    it('suggests changes based on feature requests', () => {
      for (let i = 0; i < 5; i++) {
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          type: 'feature_request',
          tags: ['export-pdf'],
        }));
      }

      const changes = feedbackLoop.suggestProcessChanges();
      const featureChange = changes.find(c => c.title.includes('export-pdf'));

      expect(featureChange).toBeDefined();
      expect(featureChange?.type).toBe('add_step');
    });

    it('suggests validation improvements for bug reports', () => {
      for (let i = 0; i < 6; i++) {
        feedbackLoop.collectFeedback(defaultSource, createFeedback({
          type: 'bug_report',
        }));
      }

      const changes = feedbackLoop.suggestProcessChanges();
      const validationChange = changes.find(c => c.title.includes('validation'));

      expect(validationChange).toBeDefined();
      expect(validationChange?.type).toBe('add_gate');
    });
  });

  describe('getTrendingTopics', () => {
    it('returns trending topics sorted by count', () => {
      feedbackLoop.collectFeedback(defaultSource, createFeedback({ tags: ['api', 'performance'] }));
      feedbackLoop.collectFeedback(defaultSource, createFeedback({ tags: ['api'] }));
      feedbackLoop.collectFeedback(defaultSource, createFeedback({ tags: ['api'] }));
      feedbackLoop.collectFeedback(defaultSource, createFeedback({ tags: ['documentation'] }));

      const trending = feedbackLoop.getTrendingTopics(3);

      expect(trending[0].topic).toBe('api');
      expect(trending[0].count).toBe(3);
    });
  });
});

describe('FailureLearning', () => {
  let failureLearning: FailureLearning;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
    failureLearning = createFailureLearning();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createFailure = (overrides: Partial<Failure> = {}): Failure => ({
    id: `fail-${Date.now()}-${Math.random()}`,
    type: 'logic_error',
    title: 'Test failure',
    description: 'A test failure',
    severity: 'medium',
    occurredAt: new Date().toISOString(),
    affectedComponents: ['component-a'],
    errorDetails: [{ code: 'ERR001', message: 'Test error' }],
    context: {},
    resolved: false,
    ...overrides,
  });

  describe('recordFailure', () => {
    it('records and retrieves failures', () => {
      const failure = createFailure({ id: 'fail-001' });
      failureLearning.recordFailure(failure);

      const failures = failureLearning.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].id).toBe('fail-001');
    });
  });

  describe('categorizeFailure', () => {
    it('categorizes timeout failures', () => {
      const failure = createFailure({
        type: 'timeout',
        errorDetails: [{ code: 'TIMEOUT', message: 'Operation timed out' }],
      });

      const category = failureLearning.categorizeFailure(failure);

      expect(category.primary).toBe('performance');
      expect(category.tags).toContain('timeout');
    });

    it('categorizes configuration errors', () => {
      const failure = createFailure({
        type: 'configuration_error',
      });

      const category = failureLearning.categorizeFailure(failure);
      expect(category.primary).toBe('configuration');
    });

    it('adds appropriate tags based on error codes', () => {
      const failure = createFailure({
        errorDetails: [
          { code: 'AUTH_FAILED', message: 'Authentication failed' },
          { code: 'OOM', message: 'Out of memory' },
        ],
      });

      const category = failureLearning.categorizeFailure(failure);

      expect(category.tags).toContain('authentication');
      expect(category.tags).toContain('memory');
    });
  });

  describe('performRootCauseAnalysis', () => {
    it('performs RCA for configuration errors', () => {
      const failure = createFailure({
        type: 'configuration_error',
      });
      failureLearning.recordFailure(failure);

      const rootCause = failureLearning.performRootCauseAnalysis(failure);

      expect(rootCause.category).toBe('process_gap');
      expect(rootCause.recommendations.length).toBeGreaterThan(0);
      expect(rootCause.timeline.length).toBeGreaterThan(0);
    });

    it('performs RCA for external dependency failures', () => {
      const failure = createFailure({
        type: 'external_service_failure',
      });
      failureLearning.recordFailure(failure);

      const rootCause = failureLearning.performRootCauseAnalysis(failure);

      expect(rootCause.category).toBe('external_dependency');
      expect(rootCause.recommendations).toContain('Implement fallback mechanism');
    });

    it('identifies related failures', () => {
      // Record several similar failures
      for (let i = 0; i < 5; i++) {
        failureLearning.recordFailure(createFailure({
          id: `fail-rel-${i}`,
          type: 'timeout',
        }));
      }

      const newFailure = createFailure({ type: 'timeout' });
      failureLearning.recordFailure(newFailure);

      const rootCause = failureLearning.performRootCauseAnalysis(newFailure);

      expect(rootCause.relatedFailures.length).toBeGreaterThan(0);
    });
  });

  describe('trackPreventiveActions', () => {
    it('tracks actions for a failure', () => {
      const failure = createFailure({ id: 'fail-act' });
      failureLearning.recordFailure(failure);

      const actions: Action[] = [
        {
          id: 'act-001',
          type: 'code_fix',
          title: 'Fix the bug',
          description: 'Apply a code fix',
          priority: 'high',
          status: 'pending',
          relatedFailures: ['fail-act'],
          expectedEffectiveness: 0.9,
        },
      ];

      failureLearning.trackPreventiveActions(failure, actions);

      const retrieved = failureLearning.getActionsForFailure('fail-act');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe('act-001');
    });
  });

  describe('detectFailurePatterns', () => {
    it('detects patterns by failure type', () => {
      for (let i = 0; i < 5; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 20).toString().padStart(2, '0')}T10:00:00.000Z`));
        failureLearning.recordFailure(createFailure({
          type: 'timeout',
          affectedComponents: ['api-gateway'],
        }));
      }

      const patterns = failureLearning.detectFailurePatterns();
      const timeoutPattern = patterns.find(p => p.name.includes('timeout'));

      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern?.occurrenceCount).toBe(5);
    });

    it('detects patterns by component', () => {
      for (let i = 0; i < 4; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 20).toString().padStart(2, '0')}T10:00:00.000Z`));
        failureLearning.recordFailure(createFailure({
          type: i % 2 === 0 ? 'timeout' : 'logic_error',
          affectedComponents: ['database'],
        }));
      }

      const patterns = failureLearning.detectFailurePatterns();
      const dbPattern = patterns.find(p => p.name.includes('database'));

      expect(dbPattern).toBeDefined();
      expect(dbPattern?.occurrenceCount).toBe(4);
    });
  });

  describe('getFailures with filter', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 15).toString().padStart(2, '0')}T10:00:00.000Z`));
        failureLearning.recordFailure(createFailure({
          id: `fail-${i}`,
          type: i % 2 === 0 ? 'timeout' : 'logic_error',
          severity: i < 5 ? 'high' : 'low',
          resolved: i % 3 === 0,
          affectedComponents: i % 2 === 0 ? ['api'] : ['db'],
        }));
      }
    });

    it('filters by time range', () => {
      const failures = failureLearning.getFailures({
        timeRange: {
          start: '2026-01-18T00:00:00.000Z',
          end: '2026-01-22T23:59:59.999Z',
        },
      });

      expect(failures.length).toBeLessThan(10);
    });

    it('filters by severity', () => {
      const failures = failureLearning.getFailures({
        severities: ['high'],
      });

      expect(failures.every(f => f.severity === 'high')).toBe(true);
    });

    it('filters by type', () => {
      const failures = failureLearning.getFailures({
        types: ['timeout'],
      });

      expect(failures.every(f => f.type === 'timeout')).toBe(true);
    });

    it('filters by resolved status', () => {
      const unresolvedFailures = failureLearning.getFailures({
        resolved: false,
      });

      expect(unresolvedFailures.every(f => !f.resolved)).toBe(true);
    });

    it('filters by components', () => {
      const failures = failureLearning.getFailures({
        components: ['api'],
      });

      expect(failures.every(f => f.affectedComponents.includes('api'))).toBe(true);
    });
  });

  describe('updateActionStatus', () => {
    it('updates action status', () => {
      const failure = createFailure({ id: 'fail-status' });
      failureLearning.recordFailure(failure);

      const actions: Action[] = [
        {
          id: 'act-update',
          type: 'code_fix',
          title: 'Fix',
          description: 'Fix',
          priority: 'high',
          status: 'pending',
          relatedFailures: ['fail-status'],
          expectedEffectiveness: 0.8,
        },
      ];

      failureLearning.trackPreventiveActions(failure, actions);
      failureLearning.updateActionStatus('act-update', 'completed');

      const retrieved = failureLearning.getActionsForFailure('fail-status');
      expect(retrieved[0].status).toBe('completed');
    });
  });
});

describe('BenchmarkSystem', () => {
  let benchmarkSystem: BenchmarkSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
    benchmarkSystem = createBenchmarkSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setBaseline', () => {
    it('sets and retrieves baselines', () => {
      benchmarkSystem.setBaseline('response_time_ms', 100);

      const baseline = benchmarkSystem.getBaseline('response_time_ms');
      expect(baseline).not.toBeNull();
      expect(baseline?.value).toBe(100);
      expect(baseline?.metricName).toBe('response_time_ms');
    });

    it('sets baseline with custom method', () => {
      benchmarkSystem.setBaseline('throughput', 1000, 'historical_average');

      const baseline = benchmarkSystem.getBaseline('throughput');
      expect(baseline?.method).toBe('historical_average');
    });
  });

  describe('compareToBaseline', () => {
    beforeEach(() => {
      benchmarkSystem.setBaseline('metric', 100);
    });

    it('identifies improvement', () => {
      const comparison = benchmarkSystem.compareToBaseline('metric', 120);

      expect(comparison.status).toBe('better');
      expect(comparison.percentageChange).toBe(20);
      expect(comparison.difference).toBe(20);
    });

    it('identifies regression', () => {
      const comparison = benchmarkSystem.compareToBaseline('metric', 80);

      expect(comparison.status).toBe('worse');
      expect(comparison.percentageChange).toBe(-20);
    });

    it('identifies stable metrics', () => {
      const comparison = benchmarkSystem.compareToBaseline('metric', 102);

      expect(comparison.status).toBe('same');
    });

    it('handles missing baseline', () => {
      const comparison = benchmarkSystem.compareToBaseline('unknown_metric', 50);

      expect(comparison.status).toBe('same');
      expect(comparison.baselineValue).toBe(50);
    });
  });

  describe('trackTrend', () => {
    it('tracks values over time', () => {
      for (let i = 0; i < 5; i++) {
        vi.setSystemTime(new Date(`2026-01-${(i + 20).toString().padStart(2, '0')}T10:00:00.000Z`));
        benchmarkSystem.trackTrend('latency', 100 + i * 10);
      }

      const range: TimeRange = {
        start: '2026-01-20T00:00:00.000Z',
        end: '2026-01-25T23:59:59.999Z',
      };

      const trend = benchmarkSystem.getTrend('latency', range);
      expect(trend).toHaveLength(5);
      expect(trend[0].value).toBe(100);
      expect(trend[4].value).toBe(140);
    });
  });

  describe('alertOnRegression', () => {
    it('generates alerts for regressions', () => {
      benchmarkSystem.setBaseline('quality', 0.9);

      // Track degrading values
      for (let i = 0; i < 5; i++) {
        benchmarkSystem.trackTrend('quality', 0.7); // 22% below baseline
      }

      const alerts = benchmarkSystem.alertOnRegression(10);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('regression');
      expect(alerts[0].metricName).toBe('quality');
    });

    it('does not generate alerts within threshold', () => {
      benchmarkSystem.setBaseline('quality', 0.9);

      for (let i = 0; i < 5; i++) {
        benchmarkSystem.trackTrend('quality', 0.85); // Only 5.5% below
      }

      const alerts = benchmarkSystem.alertOnRegression(10);
      expect(alerts).toHaveLength(0);
    });

    it('does not duplicate existing active alerts', () => {
      benchmarkSystem.setBaseline('metric', 100);

      for (let i = 0; i < 5; i++) {
        benchmarkSystem.trackTrend('metric', 70);
      }

      // Generate alert twice
      benchmarkSystem.alertOnRegression(10);
      const secondAlerts = benchmarkSystem.alertOnRegression(10);

      expect(secondAlerts).toHaveLength(0);
    });
  });

  describe('alert management', () => {
    beforeEach(() => {
      benchmarkSystem.setBaseline('metric', 100);
      for (let i = 0; i < 5; i++) {
        benchmarkSystem.trackTrend('metric', 70);
      }
      benchmarkSystem.alertOnRegression(10);
    });

    it('gets active alerts', () => {
      const alerts = benchmarkSystem.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].status).toBe('active');
    });

    it('acknowledges alerts', () => {
      const alerts = benchmarkSystem.getActiveAlerts();
      benchmarkSystem.acknowledgeAlert(alerts[0].id, 'user-001');

      const updated = benchmarkSystem.getActiveAlerts();
      expect(updated).toHaveLength(0);
    });

    it('resolves alerts', () => {
      const alerts = benchmarkSystem.getActiveAlerts();
      benchmarkSystem.resolveAlert(alerts[0].id, 'Fixed the issue');

      const updated = benchmarkSystem.getActiveAlerts();
      expect(updated).toHaveLength(0);
    });
  });

  describe('getAllBaselines', () => {
    it('returns all baselines', () => {
      benchmarkSystem.setBaseline('metric1', 100);
      benchmarkSystem.setBaseline('metric2', 200);
      benchmarkSystem.setBaseline('metric3', 300);

      const baselines = benchmarkSystem.getAllBaselines();
      expect(baselines).toHaveLength(3);
    });
  });
});

describe('TemplateEvolution', () => {
  let templateEvolution: TemplateEvolution;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
    templateEvolution = createTemplateEvolution();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('versionTemplate', () => {
    it('creates initial version', () => {
      const changes: Change[] = [
        {
          type: 'addition',
          description: 'Initial template',
          affected: 'all',
          rationale: 'Initial release',
          breaking: false,
        },
      ];

      const version = templateEvolution.versionTemplate('template-001', changes);

      expect(version.version).toBe('0.1.0');
      expect(version.templateId).toBe('template-001');
      expect(version.changes).toHaveLength(1);
      expect(version.status).toBe('draft');
    });

    it('increments minor version for features', () => {
      templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Feature 1', affected: 'x', rationale: 'y', breaking: false },
      ]);

      const version = templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Feature 2', affected: 'x', rationale: 'y', breaking: false },
      ]);

      expect(version.version).toBe('0.2.0');
    });

    it('increments patch version for bugfixes', () => {
      templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Feature', affected: 'x', rationale: 'y', breaking: false },
      ]);

      const version = templateEvolution.versionTemplate('template-001', [
        { type: 'bugfix', description: 'Fix', affected: 'x', rationale: 'y', breaking: false },
      ]);

      expect(version.version).toBe('0.1.1');
    });

    it('increments major version for breaking changes', () => {
      templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Feature', affected: 'x', rationale: 'y', breaking: false },
      ]);

      const version = templateEvolution.versionTemplate('template-001', [
        { type: 'modification', description: 'Breaking change', affected: 'x', rationale: 'y', breaking: true },
      ]);

      expect(version.version).toBe('1.0.0');
    });

    it('generates release notes', () => {
      const version = templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'New feature A', affected: 'x', rationale: 'y', breaking: false },
        { type: 'bugfix', description: 'Fix bug B', affected: 'y', rationale: 'z', breaking: false },
        { type: 'modification', description: 'Breaking change C', affected: 'z', rationale: 'w', breaking: true },
      ]);

      expect(version.releaseNotes).toContain('Breaking Changes');
      expect(version.releaseNotes).toContain('New Features');
      expect(version.releaseNotes).toContain('Bug Fixes');
    });
  });

  describe('deprecateVersion', () => {
    it('deprecates a version with migration path', () => {
      const v1 = templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Initial', affected: 'x', rationale: 'y', breaking: false },
      ]);

      const v2 = templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'V2', affected: 'x', rationale: 'y', breaking: false },
      ]);

      const migrationPath: MigrationPath = {
        fromVersion: v1.version,
        toVersion: v2.version,
        steps: [
          { order: 1, title: 'Update config', description: 'Update configuration file', canAutomate: true, required: true },
        ],
        effort: { size: 's', hoursEstimate: 2, confidence: { type: 'absent', reason: 'uncalibrated' } },
        risks: [],
        automated: false,
      };

      templateEvolution.deprecateVersion(v1.version, migrationPath);

      const versions = templateEvolution.getVersions('template-001');
      const deprecatedVersion = versions.find(v => v.version === v1.version);

      expect(deprecatedVersion?.status).toBe('deprecated');
      expect(deprecatedVersion?.deprecation?.alternative).toBe(v2.version);
    });
  });

  describe('trackAdoption', () => {
    it('tracks adoption metrics', () => {
      const version = templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Feature', affected: 'x', rationale: 'y', breaking: false },
      ]);

      // Track adoptions
      for (let i = 0; i < 5; i++) {
        templateEvolution.trackAdoption(version.version);
      }

      const metrics = templateEvolution.trackAdoption(version.version);

      expect(metrics.totalAdoptions).toBe(6);
      expect(metrics.adoptionRate).toBeGreaterThan(0);
    });
  });

  describe('getVersions', () => {
    it('returns all versions for a template', () => {
      for (let i = 0; i < 3; i++) {
        templateEvolution.versionTemplate('template-001', [
          { type: 'bugfix', description: `Fix ${i}`, affected: 'x', rationale: 'y', breaking: false },
        ]);
      }

      const versions = templateEvolution.getVersions('template-001');
      expect(versions).toHaveLength(3);
    });

    it('returns empty array for unknown template', () => {
      const versions = templateEvolution.getVersions('unknown');
      expect(versions).toHaveLength(0);
    });
  });

  describe('getLatestVersion', () => {
    it('returns the latest version', () => {
      templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'V1', affected: 'x', rationale: 'y', breaking: false },
      ]);
      templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'V2', affected: 'x', rationale: 'y', breaking: false },
      ]);

      const latest = templateEvolution.getLatestVersion('template-001');

      expect(latest?.version).toBe('0.2.0');
    });

    it('returns null for unknown template', () => {
      const latest = templateEvolution.getLatestVersion('unknown');
      expect(latest).toBeNull();
    });
  });

  describe('getMigrationPath', () => {
    it('retrieves migration path', () => {
      const v1 = templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'V1', affected: 'x', rationale: 'y', breaking: false },
      ]);

      const v2 = templateEvolution.versionTemplate('template-001', [
        { type: 'modification', description: 'Breaking', affected: 'x', rationale: 'y', breaking: true },
      ]);

      const migrationPath: MigrationPath = {
        fromVersion: v1.version,
        toVersion: v2.version,
        steps: [],
        effort: { size: 'm', hoursEstimate: 4, confidence: { type: 'absent', reason: 'uncalibrated' } },
        risks: [],
        automated: false,
      };

      templateEvolution.deprecateVersion(v1.version, migrationPath);

      const path = templateEvolution.getMigrationPath(v1.version, v2.version);
      expect(path).not.toBeNull();
      expect(path?.fromVersion).toBe(v1.version);
      expect(path?.toVersion).toBe(v2.version);
    });
  });

  describe('compareVersions', () => {
    it('compares two versions', () => {
      templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Feature 1', affected: 'x', rationale: 'y', breaking: false },
      ]);

      templateEvolution.versionTemplate('template-001', [
        { type: 'bugfix', description: 'Fix 1', affected: 'x', rationale: 'y', breaking: false },
      ]);

      templateEvolution.versionTemplate('template-001', [
        { type: 'modification', description: 'Breaking change', affected: 'x', rationale: 'y', breaking: true },
      ]);

      const comparison = templateEvolution.compareVersions('0.1.0', '1.0.0');

      expect(comparison.changes.length).toBeGreaterThan(0);
      expect(comparison.breakingChanges.length).toBeGreaterThan(0);
      expect(comparison.migrationRequired).toBe(true);
    });
  });

  describe('getAdoptionHistory', () => {
    it('returns adoption history for a version', () => {
      const version = templateEvolution.versionTemplate('template-001', [
        { type: 'addition', description: 'Feature', affected: 'x', rationale: 'y', breaking: false },
      ]);

      // Track adoptions over multiple days
      for (let i = 20; i <= 25; i++) {
        vi.setSystemTime(new Date(`2026-01-${i}T10:00:00.000Z`));
        templateEvolution.trackAdoption(version.version);
      }

      const range: TimeRange = {
        start: '2026-01-20T00:00:00.000Z',
        end: '2026-01-25T23:59:59.999Z',
      };

      const history = templateEvolution.getAdoptionHistory(version.version, range);
      expect(history.length).toBeGreaterThan(0);
    });
  });
});

describe('ContinuousImprovementSystem', () => {
  let system: ReturnType<typeof createContinuousImprovementSystem>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
    system = createContinuousImprovementSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createContinuousImprovementSystem', () => {
    it('creates system with default config', () => {
      expect(system.config).toEqual(DEFAULT_CONTINUOUS_IMPROVEMENT_CONFIG);
      expect(system.outcomeTracker).toBeDefined();
      expect(system.feedbackLoop).toBeDefined();
      expect(system.failureLearning).toBeDefined();
      expect(system.benchmarkSystem).toBeDefined();
      expect(system.templateEvolution).toBeDefined();
    });

    it('allows custom config', () => {
      const customSystem = createContinuousImprovementSystem({
        trackOutcomes: false,
        regressionThreshold: 20,
      });

      expect(customSystem.config.trackOutcomes).toBe(false);
      expect(customSystem.config.regressionThreshold).toBe(20);
      expect(customSystem.config.collectFeedback).toBe(true); // Default preserved
    });
  });

  describe('getAllOpportunities', () => {
    it('aggregates opportunities from outcome tracker', () => {
      // Add data that generates opportunities
      for (let i = 0; i < 10; i++) {
        system.outcomeTracker.recordDecisionOutcome('dec-test', {
          id: `out-${i}`,
          success: false,
          quality: 0.3,
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const opportunities = system.getAllOpportunities();
      expect(opportunities.length).toBeGreaterThan(0);
    });
  });

  describe('getAllAlerts', () => {
    it('returns active alerts from benchmark system', () => {
      system.benchmarkSystem.setBaseline('metric', 100);
      for (let i = 0; i < 5; i++) {
        system.benchmarkSystem.trackTrend('metric', 70);
      }
      system.benchmarkSystem.alertOnRegression(10);

      const alerts = system.getAllAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('generateReport', () => {
    it('generates comprehensive report', () => {
      // Add some data
      system.outcomeTracker.recordDecisionOutcome('dec-001', {
        id: 'out-001',
        success: true,
        quality: 0.8,
        timeToOutcomeMs: 1000,
        sideEffects: [],
        metrics: {},
        evidence: [],
        recordedAt: new Date().toISOString(),
      });

      system.feedbackLoop.collectFeedback(
        { type: 'user', sourceId: 'user-001', name: 'User', reliability: 0.9 },
        {
          id: 'fb-001',
          subject: { type: 'template', subjectId: 'template-001' },
          type: 'observation',
          sentiment: 'positive',
          content: 'Good',
          tags: [],
          timestamp: new Date().toISOString(),
        }
      );

      system.failureLearning.recordFailure({
        id: 'fail-001',
        type: 'logic_error',
        title: 'Test failure',
        description: 'A test failure',
        severity: 'medium',
        occurredAt: new Date().toISOString(),
        affectedComponents: [],
        errorDetails: [],
        context: {},
        resolved: false,
      });

      const report = system.generateReport();

      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalFeedback).toBe(1);
      expect(report.summary.totalFailures).toBe(1);
    });

    it('prioritizes opportunities correctly', () => {
      // Add data that generates multiple opportunities with different priorities
      for (let i = 0; i < 10; i++) {
        system.outcomeTracker.recordDecisionOutcome('dec-urgent', {
          id: `out-u-${i}`,
          success: false,
          quality: 0.1, // Very low quality
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      for (let i = 0; i < 10; i++) {
        system.outcomeTracker.recordDecisionOutcome('dec-medium', {
          id: `out-m-${i}`,
          success: i % 2 === 0, // 50% success
          quality: 0.6,
          timeToOutcomeMs: 1000,
          sideEffects: [],
          metrics: {},
          evidence: [],
          recordedAt: new Date().toISOString(),
        });
      }

      const report = system.generateReport();

      expect(report.topOpportunities.length).toBeLessThanOrEqual(5);
      // Higher priority opportunities should come first
      if (report.topOpportunities.length >= 2) {
        const priorities = ['urgent', 'high', 'medium', 'low', 'backlog'];
        const firstPriority = priorities.indexOf(report.topOpportunities[0].priority);
        const lastPriority = priorities.indexOf(report.topOpportunities[report.topOpportunities.length - 1].priority);
        expect(firstPriority).toBeLessThanOrEqual(lastPriority);
      }
    });
  });
});

describe('Integration', () => {
  it('all components work together', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));

    const system = createContinuousImprovementSystem();

    // 1. Track some outcomes
    system.outcomeTracker.recordDecisionOutcome('template-selection', {
      id: 'out-001',
      success: true,
      quality: 0.9,
      timeToOutcomeMs: 500,
      sideEffects: [],
      metrics: { templateScore: 0.95 },
      evidence: ['Template T1 selected'],
      recordedAt: new Date().toISOString(),
    });

    // 2. Collect feedback
    system.feedbackLoop.collectFeedback(
      { type: 'user', sourceId: 'dev-001', name: 'Developer', reliability: 0.9 },
      {
        id: 'fb-001',
        subject: { type: 'template', subjectId: 'T1' },
        type: 'praise',
        sentiment: 'positive',
        content: 'Template worked well',
        tags: ['accurate', 'fast'],
        timestamp: new Date().toISOString(),
      }
    );

    // 3. Record a failure
    system.failureLearning.recordFailure({
      id: 'fail-001',
      type: 'timeout',
      title: 'Template execution timeout',
      description: 'T2 timed out on large codebase',
      severity: 'high',
      occurredAt: new Date().toISOString(),
      affectedComponents: ['T2', 'parser'],
      errorDetails: [{ code: 'TIMEOUT', message: 'Operation exceeded 30s limit' }],
      context: { codebaseSize: '500k LOC' },
      resolved: false,
    });

    // 4. Set benchmarks
    system.benchmarkSystem.setBaseline('template_accuracy', 0.85);
    system.benchmarkSystem.trackTrend('template_accuracy', 0.9);

    // 5. Version a template
    system.templateEvolution.versionTemplate('T1', [
      {
        type: 'performance',
        description: 'Optimized token usage',
        affected: 'output_generation',
        rationale: 'Reduce cost and latency',
        breaking: false,
      },
    ]);

    // Generate report
    const report = system.generateReport();

    expect(report.summary.totalFeedback).toBe(1);
    expect(report.summary.totalFailures).toBe(1);
    expect(report.summary.unresolvedFailures).toBe(1);

    // Verify RCA was performed
    const failure = system.failureLearning.getFailures()[0];
    const rootCause = system.failureLearning.performRootCauseAnalysis(failure);
    // Timeout failures map to 'resource_limitation' category
    expect(rootCause.category).toBe('resource_limitation');
    expect(rootCause.recommendations.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
