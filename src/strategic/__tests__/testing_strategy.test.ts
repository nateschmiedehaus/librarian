import { describe, it, expect, vi } from 'vitest';
import {
  // Types
  type TestingStrategy,
  type TestingPyramid,
  type TestQualityMetrics,
  type TestInfrastructure,
  type CoverageGap,
  type ValidationIssue,

  // Presets
  COMPREHENSIVE_PRESET,
  BALANCED_PRESET,
  MINIMAL_PRESET,
  DEFAULT_TEST_INFRASTRUCTURE,
  DEFAULT_QUALITY_TARGETS,

  // Functions
  validateStrategy,
  analyzeCoverageGaps,
  generateQualityReport,
  createTestingStrategy,
} from '../testing_strategy.js';

describe('Testing Strategy Framework', () => {
  describe('Preset Configurations', () => {
    it('COMPREHENSIVE_PRESET has high coverage targets', () => {
      expect(COMPREHENSIVE_PRESET.unit.coverageTarget).toBeGreaterThanOrEqual(0.90);
      expect(COMPREHENSIVE_PRESET.integration.coverageTarget).toBeGreaterThanOrEqual(0.80);
      expect(COMPREHENSIVE_PRESET.e2e.criticalPathCoverage).toBeGreaterThanOrEqual(0.90);
    });

    it('COMPREHENSIVE_PRESET enables all security testing', () => {
      expect(COMPREHENSIVE_PRESET.specialized.security.sastEnabled).toBe(true);
      expect(COMPREHENSIVE_PRESET.specialized.security.dastEnabled).toBe(true);
      expect(COMPREHENSIVE_PRESET.specialized.security.dependencyScanEnabled).toBe(true);
    });

    it('COMPREHENSIVE_PRESET requires property-based testing', () => {
      expect(COMPREHENSIVE_PRESET.unit.propertyBasedTestingRequired).toBe(true);
    });

    it('BALANCED_PRESET has moderate coverage targets', () => {
      expect(BALANCED_PRESET.unit.coverageTarget).toBe(0.80);
      expect(BALANCED_PRESET.integration.coverageTarget).toBe(0.70);
      expect(BALANCED_PRESET.e2e.criticalPathCoverage).toBe(0.80);
    });

    it('BALANCED_PRESET disables some specialized testing', () => {
      expect(BALANCED_PRESET.specialized.security.dastEnabled).toBe(false);
      expect(BALANCED_PRESET.specialized.mutation.enabled).toBe(false);
      expect(BALANCED_PRESET.e2e.chaosTestingEnabled).toBe(false);
    });

    it('MINIMAL_PRESET has low coverage targets', () => {
      expect(MINIMAL_PRESET.unit.coverageTarget).toBe(0.60);
      expect(MINIMAL_PRESET.integration.coverageTarget).toBe(0.50);
      expect(MINIMAL_PRESET.e2e.criticalPathCoverage).toBe(0.50);
    });

    it('MINIMAL_PRESET disables most specialized testing', () => {
      expect(MINIMAL_PRESET.specialized.security.sastEnabled).toBe(false);
      expect(MINIMAL_PRESET.specialized.security.dastEnabled).toBe(false);
      expect(MINIMAL_PRESET.specialized.accessibility.automatedTestingEnabled).toBe(false);
      expect(MINIMAL_PRESET.specialized.performance.loadTestingEnabled).toBe(false);
    });

    it('all presets have valid coverage ranges', () => {
      const presets = [COMPREHENSIVE_PRESET, BALANCED_PRESET, MINIMAL_PRESET];
      for (const preset of presets) {
        expect(preset.unit.coverageTarget).toBeGreaterThanOrEqual(0);
        expect(preset.unit.coverageTarget).toBeLessThanOrEqual(1);
        expect(preset.integration.coverageTarget).toBeGreaterThanOrEqual(0);
        expect(preset.integration.coverageTarget).toBeLessThanOrEqual(1);
        expect(preset.e2e.criticalPathCoverage).toBeGreaterThanOrEqual(0);
        expect(preset.e2e.criticalPathCoverage).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('createTestingStrategy', () => {
    it('creates a strategy from comprehensive preset', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));

      const strategy = createTestingStrategy({
        id: 'test-strategy-1',
        name: 'Production Strategy',
        description: 'Testing strategy for production systems',
        preset: 'comprehensive',
      });

      expect(strategy.id).toBe('test-strategy-1');
      expect(strategy.name).toBe('Production Strategy');
      expect(strategy.pyramid.unit.coverageTarget).toBe(COMPREHENSIVE_PRESET.unit.coverageTarget);
      expect(strategy.metadata.version).toBe('1.0.0');
      expect(strategy.metadata.createdAt).toBe('2026-01-29T10:00:00.000Z');
      expect(strategy.metadata.tags).toContain('comprehensive');

      vi.useRealTimers();
    });

    it('creates a strategy from balanced preset', () => {
      const strategy = createTestingStrategy({
        id: 'test-strategy-2',
        name: 'Standard Strategy',
        description: 'Balanced testing approach',
        preset: 'balanced',
      });

      expect(strategy.pyramid.unit.coverageTarget).toBe(BALANCED_PRESET.unit.coverageTarget);
      expect(strategy.pyramid.specialized.mutation.enabled).toBe(false);
    });

    it('creates a strategy from minimal preset', () => {
      const strategy = createTestingStrategy({
        id: 'test-strategy-3',
        name: 'MVP Strategy',
        description: 'Minimal testing for rapid development',
        preset: 'minimal',
      });

      expect(strategy.pyramid.unit.coverageTarget).toBe(MINIMAL_PRESET.unit.coverageTarget);
    });

    it('applies pyramid overrides', () => {
      const strategy = createTestingStrategy({
        id: 'test-strategy-4',
        name: 'Custom Strategy',
        description: 'Strategy with overrides',
        preset: 'balanced',
        pyramidOverrides: {
          unit: {
            coverageTarget: 0.90,
            isolationRequired: true,
            mockingGuidelines: ['Custom guideline'],
            propertyBasedTestingRequired: true,
            namingConvention: 'custom_naming',
          },
        },
      });

      expect(strategy.pyramid.unit.coverageTarget).toBe(0.90);
      expect(strategy.pyramid.unit.propertyBasedTestingRequired).toBe(true);
      // Integration should still be from balanced preset
      expect(strategy.pyramid.integration.coverageTarget).toBe(BALANCED_PRESET.integration.coverageTarget);
    });

    it('applies infrastructure overrides', () => {
      const strategy = createTestingStrategy({
        id: 'test-strategy-5',
        name: 'GitLab Strategy',
        description: 'Strategy using GitLab CI',
        preset: 'balanced',
        infrastructureOverrides: {
          ciIntegration: {
            provider: 'gitlab-ci',
            parallelExecutionEnabled: true,
            testSplittingStrategy: 'count',
            cacheEnabled: true,
            failFastEnabled: true,
            requiredChecks: ['test', 'lint', 'security'],
          },
        },
      });

      expect(strategy.infrastructure.ciIntegration.provider).toBe('gitlab-ci');
      expect(strategy.infrastructure.ciIntegration.failFastEnabled).toBe(true);
    });

    it('applies quality target overrides', () => {
      const strategy = createTestingStrategy({
        id: 'test-strategy-6',
        name: 'High Quality Strategy',
        description: 'Strategy with strict quality targets',
        preset: 'balanced',
        qualityTargetOverrides: {
          coverage: 0.95,
          flakyRate: 0.01,
        },
      });

      expect(strategy.qualityTargets.coverage).toBe(0.95);
      expect(strategy.qualityTargets.flakyRate).toBe(0.01);
    });

    it('applies metadata overrides', () => {
      const strategy = createTestingStrategy({
        id: 'test-strategy-7',
        name: 'Versioned Strategy',
        description: 'Strategy with custom metadata',
        preset: 'balanced',
        metadata: {
          version: '2.0.0',
          author: 'Test Team',
          tags: ['production', 'high-availability'],
        },
      });

      expect(strategy.metadata.version).toBe('2.0.0');
      expect(strategy.metadata.author).toBe('Test Team');
      expect(strategy.metadata.tags).toContain('production');
    });
  });

  describe('validateStrategy', () => {
    function createValidStrategy(): TestingStrategy {
      return createTestingStrategy({
        id: 'valid-strategy',
        name: 'Valid Strategy',
        description: 'A valid testing strategy',
        preset: 'balanced',
      });
    }

    it('validates a correct strategy', () => {
      const strategy = createValidStrategy();
      const result = validateStrategy(strategy);

      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('detects invalid coverage target', () => {
      const strategy = createValidStrategy();
      strategy.pyramid.unit.coverageTarget = 1.5; // Invalid

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'INVALID_COVERAGE_TARGET' && i.severity === 'error'
      )).toBe(true);
    });

    it('warns about low coverage target', () => {
      const strategy = createValidStrategy();
      strategy.pyramid.unit.coverageTarget = 0.40; // Low but valid

      const result = validateStrategy(strategy);

      expect(result.issues.some(i =>
        i.code === 'LOW_COVERAGE_TARGET' && i.severity === 'warning'
      )).toBe(true);
    });

    it('detects missing user journeys', () => {
      const strategy = createValidStrategy();
      strategy.pyramid.e2e.userJourneyTests = [];

      const result = validateStrategy(strategy);

      expect(result.issues.some(i =>
        i.code === 'MISSING_USER_JOURNEYS' && i.severity === 'warning'
      )).toBe(true);
    });

    it('detects invalid mutation operators when mutation testing is enabled', () => {
      const strategy = createValidStrategy();
      strategy.pyramid.specialized.mutation.enabled = true;
      strategy.pyramid.specialized.mutation.scoreTarget = 0.70;
      strategy.pyramid.specialized.mutation.operators = []; // No operators

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'MISSING_MUTATION_OPERATORS'
      )).toBe(true);
    });

    it('warns when no security testing is enabled', () => {
      const strategy = createValidStrategy();
      strategy.pyramid.specialized.security.sastEnabled = false;
      strategy.pyramid.specialized.security.dastEnabled = false;
      strategy.pyramid.specialized.security.dependencyScanEnabled = false;

      const result = validateStrategy(strategy);

      expect(result.issues.some(i =>
        i.code === 'NO_SECURITY_TESTING'
      )).toBe(true);
    });

    it('detects negative max retries', () => {
      const strategy = createValidStrategy();
      strategy.infrastructure.flakyTestManagement.maxRetries = -1;

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'INVALID_MAX_RETRIES'
      )).toBe(true);
    });

    it('warns about high retry count', () => {
      const strategy = createValidStrategy();
      strategy.infrastructure.flakyTestManagement.maxRetries = 10;

      const result = validateStrategy(strategy);

      expect(result.issues.some(i =>
        i.code === 'HIGH_RETRY_COUNT' && i.severity === 'warning'
      )).toBe(true);
    });

    it('detects no test environments', () => {
      const strategy = createValidStrategy();
      strategy.infrastructure.testEnvironments = [];

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'NO_ENVIRONMENTS'
      )).toBe(true);
    });

    it('detects duplicate environment names', () => {
      const strategy = createValidStrategy();
      strategy.infrastructure.testEnvironments = [
        { name: 'ci', type: 'ci' },
        { name: 'ci', type: 'local' }, // Duplicate
      ];

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'DUPLICATE_ENVIRONMENTS'
      )).toBe(true);
    });

    it('detects invalid percentiles order', () => {
      const strategy = createValidStrategy();
      strategy.qualityTargets.executionTime.p50 = 100000;
      strategy.qualityTargets.executionTime.p99 = 50000; // p50 > p99 is invalid

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'INVALID_PERCENTILES'
      )).toBe(true);
    });

    it('warns about misaligned coverage targets', () => {
      const strategy = createValidStrategy();
      strategy.qualityTargets.coverage = 0.95; // Higher than unit target
      strategy.pyramid.unit.coverageTarget = 0.80;

      const result = validateStrategy(strategy);

      expect(result.issues.some(i =>
        i.code === 'MISALIGNED_COVERAGE_TARGETS'
      )).toBe(true);
    });

    it('validates date formats in metadata', () => {
      const strategy = createValidStrategy();
      strategy.metadata.createdAt = 'invalid-date';

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'INVALID_DATE'
      )).toBe(true);
    });

    it('detects createdAt after updatedAt', () => {
      const strategy = createValidStrategy();
      strategy.metadata.createdAt = '2026-02-01T00:00:00.000Z';
      strategy.metadata.updatedAt = '2026-01-01T00:00:00.000Z';

      const result = validateStrategy(strategy);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.code === 'INVALID_DATE_ORDER'
      )).toBe(true);
    });

    it('provides validation summary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));

      const strategy = createValidStrategy();
      strategy.pyramid.unit.coverageTarget = 1.5; // Error
      strategy.pyramid.e2e.userJourneyTests = []; // Warning

      const result = validateStrategy(strategy);

      expect(result.summary.errorCount).toBeGreaterThan(0);
      expect(result.summary.warningCount).toBeGreaterThan(0);
      expect(result.summary.checkedAt).toBe('2026-01-29T12:00:00.000Z');

      vi.useRealTimers();
    });
  });

  describe('analyzeCoverageGaps', () => {
    function createStrategyWithTargets(): TestingStrategy {
      return createTestingStrategy({
        id: 'gap-analysis-strategy',
        name: 'Gap Analysis Strategy',
        description: 'Strategy for testing gap analysis',
        preset: 'balanced',
        qualityTargetOverrides: {
          coverage: 0.80,
          mutationScore: 0.60,
          flakyRate: 0.02,
          maintenanceBurden: 0.15,
          executionTime: { p50: 30000, p99: 120000 },
        },
      });
    }

    it('identifies coverage gaps', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.65, // Below target
        mutationScore: 0.70,
        flakyRate: 0.01,
        executionTime: { p50: 25000, p99: 100000 },
        maintenanceBurden: 0.10,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.gaps.some(g => g.area === 'Unit Test Coverage')).toBe(true);
      const coverageGap = analysis.gaps.find(g => g.area === 'Unit Test Coverage');
      expect(coverageGap?.gap).toBeCloseTo(0.15, 2); // 0.80 - 0.65
    });

    it('does not report gaps when metrics exceed targets', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.90,
        mutationScore: 0.80,
        flakyRate: 0.01,
        executionTime: { p50: 20000, p99: 80000 },
        maintenanceBurden: 0.05,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.gaps.filter(g => g.area === 'Unit Test Coverage')).toHaveLength(0);
    });

    it('identifies flaky rate gaps (inverted metric)', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.85,
        mutationScore: 0.70,
        flakyRate: 0.08, // Above target (worse)
        executionTime: { p50: 25000, p99: 100000 },
        maintenanceBurden: 0.10,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.gaps.some(g => g.area === 'Flaky Test Rate')).toBe(true);
    });

    it('identifies execution time gaps', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.85,
        mutationScore: 0.70,
        flakyRate: 0.01,
        executionTime: { p50: 50000, p99: 200000 }, // Above target
        maintenanceBurden: 0.10,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.gaps.some(g => g.area === 'Test Execution Time (P99)')).toBe(true);
    });

    it('categorizes gap severity correctly', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.40, // Very low - should be critical
        mutationScore: 0.70,
        flakyRate: 0.01,
        executionTime: { p50: 25000, p99: 100000 },
        maintenanceBurden: 0.10,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      const coverageGap = analysis.gaps.find(g => g.area === 'Unit Test Coverage');
      expect(coverageGap?.severity).toBe('critical');
    });

    it('generates prioritized actions', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.50,
        mutationScore: 0.40,
        flakyRate: 0.10,
        executionTime: { p50: 50000, p99: 200000 },
        maintenanceBurden: 0.30,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.prioritizedActions.length).toBeGreaterThan(0);
      expect(analysis.prioritizedActions[0].priority).toBe(1);
    });

    it('calculates overall score', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.65,
        mutationScore: 0.50,
        flakyRate: 0.05,
        executionTime: { p50: 40000, p99: 150000 },
        maintenanceBurden: 0.20,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(100);
    });

    it('returns perfect score when all targets met', () => {
      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.95,
        mutationScore: 0.80,
        flakyRate: 0.01,
        executionTime: { p50: 20000, p99: 80000 },
        maintenanceBurden: 0.05,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.overallScore).toBe(100);
      expect(analysis.gaps).toHaveLength(0);
    });

    it('includes analyzedAt timestamp', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T14:00:00.000Z'));

      const strategy = createStrategyWithTargets();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.80,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };

      const analysis = analyzeCoverageGaps(strategy, currentMetrics);

      expect(analysis.analyzedAt).toBe('2026-01-29T14:00:00.000Z');

      vi.useRealTimers();
    });
  });

  describe('generateQualityReport', () => {
    function createReportStrategy(): TestingStrategy {
      return createTestingStrategy({
        id: 'report-strategy',
        name: 'Report Strategy',
        description: 'Strategy for quality reports',
        preset: 'balanced',
      });
    }

    it('generates a complete quality report', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T15:00:00.000Z'));

      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.75,
        mutationScore: 0.55,
        flakyRate: 0.03,
        executionTime: { p50: 35000, p99: 130000 },
        maintenanceBurden: 0.18,
      };

      const report = generateQualityReport(strategy, currentMetrics);

      expect(report.strategy).toBe(strategy);
      expect(report.currentMetrics).toBe(currentMetrics);
      expect(report.generatedAt).toBe('2026-01-29T15:00:00.000Z');

      vi.useRealTimers();
    });

    it('calculates trends when previous metrics provided', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.80,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };
      const previousMetrics: TestQualityMetrics = {
        coverage: 0.75, // Improved
        mutationScore: 0.55, // Improved
        flakyRate: 0.04, // Improved (lower)
        executionTime: { p50: 35000, p99: 140000 }, // Improved (lower)
        maintenanceBurden: 0.20, // Improved (lower)
      };

      const report = generateQualityReport(strategy, currentMetrics, previousMetrics);

      expect(report.trends.length).toBeGreaterThan(0);

      const coverageTrend = report.trends.find(t => t.metric === 'coverage');
      expect(coverageTrend?.direction).toBe('improving');
      expect(coverageTrend?.change).toBeCloseTo(0.05);

      const flakyTrend = report.trends.find(t => t.metric === 'flakyRate');
      expect(flakyTrend?.direction).toBe('improving');
    });

    it('identifies degrading trends', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.70,
        mutationScore: 0.50,
        flakyRate: 0.05,
        executionTime: { p50: 40000, p99: 160000 },
        maintenanceBurden: 0.25,
      };
      const previousMetrics: TestQualityMetrics = {
        coverage: 0.80,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };

      const report = generateQualityReport(strategy, currentMetrics, previousMetrics);

      const coverageTrend = report.trends.find(t => t.metric === 'coverage');
      expect(coverageTrend?.direction).toBe('degrading');
    });

    it('identifies stable trends', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.80,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };
      const previousMetrics: TestQualityMetrics = {
        coverage: 0.805, // Very small change
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };

      const report = generateQualityReport(strategy, currentMetrics, previousMetrics);

      const coverageTrend = report.trends.find(t => t.metric === 'coverage');
      expect(coverageTrend?.direction).toBe('stable');
    });

    it('generates category statistics', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.80,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };

      const report = generateQualityReport(strategy, currentMetrics);

      expect(report.categoryStats.length).toBeGreaterThan(0);
      expect(report.categoryStats.some(s => s.category === 'unit')).toBe(true);
      expect(report.categoryStats.some(s => s.category === 'integration')).toBe(true);
      expect(report.categoryStats.some(s => s.category === 'e2e')).toBe(true);
    });

    it('generates recommendations for low coverage', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.50, // Low
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };

      const report = generateQualityReport(strategy, currentMetrics);

      expect(report.recommendations.some(r =>
        r.category === 'coverage' && r.title.includes('Coverage')
      )).toBe(true);
    });

    it('generates recommendations for high flaky rate', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.85,
        mutationScore: 0.60,
        flakyRate: 0.10, // High
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };

      const report = generateQualityReport(strategy, currentMetrics);

      expect(report.recommendations.some(r =>
        r.category === 'reliability' && r.title.includes('Flaky')
      )).toBe(true);
    });

    it('generates recommendations for slow execution time', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.85,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 60000, p99: 300000 }, // Slow
        maintenanceBurden: 0.15,
      };

      const report = generateQualityReport(strategy, currentMetrics);

      expect(report.recommendations.some(r =>
        r.category === 'performance' && r.title.includes('Execution Time')
      )).toBe(true);
    });

    it('generates recommendations for high maintenance burden', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.85,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.30, // High
      };

      const report = generateQualityReport(strategy, currentMetrics);

      expect(report.recommendations.some(r =>
        r.category === 'maintenance'
      )).toBe(true);
    });

    it('generates recommendations for degrading trends', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.70,
        mutationScore: 0.50,
        flakyRate: 0.05,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };
      const previousMetrics: TestQualityMetrics = {
        coverage: 0.80,
        mutationScore: 0.60,
        flakyRate: 0.02,
        executionTime: { p50: 30000, p99: 120000 },
        maintenanceBurden: 0.15,
      };

      const report = generateQualityReport(strategy, currentMetrics, previousMetrics);

      expect(report.recommendations.some(r =>
        r.title.includes('Degrading')
      )).toBe(true);
    });

    it('sorts recommendations by priority', () => {
      const strategy = createReportStrategy();
      const currentMetrics: TestQualityMetrics = {
        coverage: 0.40, // Critical
        mutationScore: 0.40,
        flakyRate: 0.10, // Critical
        executionTime: { p50: 60000, p99: 300000 },
        maintenanceBurden: 0.30,
      };

      const report = generateQualityReport(strategy, currentMetrics);

      const priorities = report.recommendations.map(r => r.priority);
      const priorityOrder = ['critical', 'high', 'medium', 'low'];

      for (let i = 1; i < priorities.length; i++) {
        const prevOrder = priorityOrder.indexOf(priorities[i - 1]);
        const currOrder = priorityOrder.indexOf(priorities[i]);
        expect(prevOrder).toBeLessThanOrEqual(currOrder);
      }
    });
  });

  describe('Default configurations', () => {
    it('DEFAULT_TEST_INFRASTRUCTURE has sensible defaults', () => {
      expect(DEFAULT_TEST_INFRASTRUCTURE.ciIntegration.provider).toBe('github-actions');
      expect(DEFAULT_TEST_INFRASTRUCTURE.ciIntegration.parallelExecutionEnabled).toBe(true);
      expect(DEFAULT_TEST_INFRASTRUCTURE.flakyTestManagement.detectionEnabled).toBe(true);
      expect(DEFAULT_TEST_INFRASTRUCTURE.flakyTestManagement.maxRetries).toBe(3);
      expect(DEFAULT_TEST_INFRASTRUCTURE.analyticsEnabled).toBe(true);
    });

    it('DEFAULT_QUALITY_TARGETS has reasonable values', () => {
      expect(DEFAULT_QUALITY_TARGETS.coverage).toBe(0.80);
      expect(DEFAULT_QUALITY_TARGETS.mutationScore).toBe(0.60);
      expect(DEFAULT_QUALITY_TARGETS.flakyRate).toBe(0.02);
      expect(DEFAULT_QUALITY_TARGETS.maintenanceBurden).toBe(0.15);
    });
  });

  describe('Edge cases', () => {
    it('handles minimal strategy validation with expected warnings', () => {
      const minimalStrategy: TestingStrategy = {
        id: 'minimal',
        name: 'Minimal',
        description: 'Minimal strategy',
        pyramid: structuredClone(MINIMAL_PRESET),
        infrastructure: structuredClone(DEFAULT_TEST_INFRASTRUCTURE),
        qualityTargets: structuredClone(DEFAULT_QUALITY_TARGETS),
        metadata: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const result = validateStrategy(minimalStrategy);

      // Minimal preset may produce warnings (e.g., low coverage targets, no security testing)
      // but should not have critical errors that make the strategy invalid
      expect(result.valid).toBe(true);
      // Check that warnings are present as expected for minimal preset
      expect(result.issues.some(i => i.severity === 'warning')).toBe(true);
    });

    it('handles zero metrics gracefully', () => {
      const strategy = createTestingStrategy({
        id: 'zero-test',
        name: 'Zero Test',
        description: 'Testing with zero metrics',
        preset: 'balanced',
      });

      const zeroMetrics: TestQualityMetrics = {
        coverage: 0,
        mutationScore: 0,
        flakyRate: 0,
        executionTime: { p50: 0, p99: 0 },
        maintenanceBurden: 0,
      };

      const analysis = analyzeCoverageGaps(strategy, zeroMetrics);

      expect(analysis.gaps.length).toBeGreaterThan(0);
      expect(analysis.overallScore).toBeLessThan(100);
    });

    it('handles perfect metrics gracefully', () => {
      const strategy = createTestingStrategy({
        id: 'perfect-test',
        name: 'Perfect Test',
        description: 'Testing with perfect metrics',
        preset: 'minimal',
      });

      const perfectMetrics: TestQualityMetrics = {
        coverage: 1.0,
        mutationScore: 1.0,
        flakyRate: 0,
        executionTime: { p50: 1, p99: 1 },
        maintenanceBurden: 0,
      };

      const analysis = analyzeCoverageGaps(strategy, perfectMetrics);

      expect(analysis.gaps).toHaveLength(0);
      expect(analysis.overallScore).toBe(100);
    });
  });
});
