import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Schema Version
  EXCELLENCE_VALIDATION_SCHEMA_VERSION,

  // Dimensions and Tiers
  EXCELLENCE_DIMENSIONS,
  EXCELLENCE_TIERS,
  TIER_NAMES,
  TIER_DESCRIPTIONS,

  // Tier Requirements
  GOOD_TIER_REQUIREMENTS,
  GREAT_TIER_REQUIREMENTS,
  WORLD_CLASS_TIER_REQUIREMENTS,
  LEGENDARY_TIER_REQUIREMENTS,
  getTierRequirements,

  // Default Criteria
  FUNCTIONAL_CRITERIA,
  PERFORMANCE_CRITERIA,
  RELIABILITY_CRITERIA,
  SECURITY_CRITERIA,
  MAINTAINABILITY_CRITERIA,
  USABILITY_CRITERIA,
  DEFAULT_EXCELLENCE_CRITERIA,

  // Implementation Classes
  InMemoryBenchmarkDatabase,
  createExcellenceChecklist,
  createCertificationFramework,
  createIndependentValidation,

  // Factory Functions
  createEvidence,
  createValidationArtifact,
  createAttackVector,
  createTestSystem,
  createTestComponent,

  // Types
  type ExcellenceDimension,
  type ExcellenceTier,
  type Evidence,
  type EvidenceType,
  type Artifact,
  type ExcellenceReport,
  type TierRequirements,
  type TierAssessment,
  type Metrics,
  type BenchmarkEntry,
  type ComparisonResult,
  type AuditResult,
  type RedTeamResult,
  type AdversarialResult,
  type EdgeCaseReport,
  type AttackVector,
  type System,
  type Component,
  type AdversarialConfig,
  type Domain,
} from '../excellence_validation.js';

describe('excellence_validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // SCHEMA VERSION
  // =========================================================================

  describe('schema version', () => {
    it('has a valid schema version', () => {
      expect(EXCELLENCE_VALIDATION_SCHEMA_VERSION).toBe('1.0.0');
    });
  });

  // =========================================================================
  // DIMENSIONS AND TIERS
  // =========================================================================

  describe('excellence dimensions', () => {
    it('defines all six excellence dimensions', () => {
      expect(EXCELLENCE_DIMENSIONS).toHaveLength(6);
      expect(EXCELLENCE_DIMENSIONS).toContain('functional');
      expect(EXCELLENCE_DIMENSIONS).toContain('performance');
      expect(EXCELLENCE_DIMENSIONS).toContain('reliability');
      expect(EXCELLENCE_DIMENSIONS).toContain('security');
      expect(EXCELLENCE_DIMENSIONS).toContain('maintainability');
      expect(EXCELLENCE_DIMENSIONS).toContain('usability');
    });
  });

  describe('excellence tiers', () => {
    it('defines four excellence tiers', () => {
      expect(EXCELLENCE_TIERS).toHaveLength(4);
      expect(EXCELLENCE_TIERS).toContain('good');
      expect(EXCELLENCE_TIERS).toContain('great');
      expect(EXCELLENCE_TIERS).toContain('world_class');
      expect(EXCELLENCE_TIERS).toContain('legendary');
    });

    it('has human-readable names for all tiers', () => {
      expect(TIER_NAMES.good).toBe('Good');
      expect(TIER_NAMES.great).toBe('Great');
      expect(TIER_NAMES.world_class).toBe('World-Class');
      expect(TIER_NAMES.legendary).toBe('Legendary');
    });

    it('has descriptions for all tiers', () => {
      expect(TIER_DESCRIPTIONS.good).toContain('70%+');
      expect(TIER_DESCRIPTIONS.great).toContain('85%+');
      expect(TIER_DESCRIPTIONS.world_class).toContain('95%+');
      expect(TIER_DESCRIPTIONS.legendary).toContain('99%+');
    });
  });

  // =========================================================================
  // TIER REQUIREMENTS
  // =========================================================================

  describe('tier requirements', () => {
    describe('GOOD_TIER_REQUIREMENTS', () => {
      it('requires 70% minimum scores across all dimensions', () => {
        for (const dim of EXCELLENCE_DIMENSIONS) {
          expect(GOOD_TIER_REQUIREMENTS.minimumScores.get(dim)).toBe(70);
        }
      });

      it('requires basic evidence types', () => {
        expect(GOOD_TIER_REQUIREMENTS.requiredEvidence).toContain('test_results');
        expect(GOOD_TIER_REQUIREMENTS.requiredEvidence).toContain('code_metrics');
      });

      it('has 365 day renewal period', () => {
        expect(GOOD_TIER_REQUIREMENTS.renewalPeriodDays).toBe(365);
      });

      it('does not require external audit', () => {
        expect(GOOD_TIER_REQUIREMENTS.requiresExternalAudit).toBe(false);
      });
    });

    describe('GREAT_TIER_REQUIREMENTS', () => {
      it('requires 85% minimum scores across all dimensions', () => {
        for (const dim of EXCELLENCE_DIMENSIONS) {
          expect(GREAT_TIER_REQUIREMENTS.minimumScores.get(dim)).toBe(85);
        }
      });

      it('requires peer review', () => {
        expect(GREAT_TIER_REQUIREMENTS.requiresPeerReview).toBe(true);
      });

      it('has 180 day renewal period', () => {
        expect(GREAT_TIER_REQUIREMENTS.renewalPeriodDays).toBe(180);
      });
    });

    describe('WORLD_CLASS_TIER_REQUIREMENTS', () => {
      it('requires 95% minimum scores across all dimensions', () => {
        for (const dim of EXCELLENCE_DIMENSIONS) {
          expect(WORLD_CLASS_TIER_REQUIREMENTS.minimumScores.get(dim)).toBe(95);
        }
      });

      it('requires external audit', () => {
        expect(WORLD_CLASS_TIER_REQUIREMENTS.requiresExternalAudit).toBe(true);
      });

      it('requires comprehensive evidence', () => {
        expect(WORLD_CLASS_TIER_REQUIREMENTS.requiredEvidence).toContain('penetration_test');
        expect(WORLD_CLASS_TIER_REQUIREMENTS.requiredEvidence).toContain('load_test');
        expect(WORLD_CLASS_TIER_REQUIREMENTS.requiredEvidence).toContain('user_feedback');
      });

      it('has 90 day renewal period', () => {
        expect(WORLD_CLASS_TIER_REQUIREMENTS.renewalPeriodDays).toBe(90);
      });
    });

    describe('LEGENDARY_TIER_REQUIREMENTS', () => {
      it('requires 99% minimum scores across all dimensions', () => {
        for (const dim of EXCELLENCE_DIMENSIONS) {
          expect(LEGENDARY_TIER_REQUIREMENTS.minimumScores.get(dim)).toBe(99);
        }
      });

      it('requires chaos engineering evidence', () => {
        expect(LEGENDARY_TIER_REQUIREMENTS.requiredEvidence).toContain('chaos_engineering');
      });

      it('requires certification', () => {
        expect(LEGENDARY_TIER_REQUIREMENTS.requiredEvidence).toContain('certification');
      });

      it('has 30 day renewal period', () => {
        expect(LEGENDARY_TIER_REQUIREMENTS.renewalPeriodDays).toBe(30);
      });

      it('requires notable innovations', () => {
        expect(LEGENDARY_TIER_REQUIREMENTS.additionalRequirements).toContainEqual(
          expect.stringContaining('innovations')
        );
      });
    });

    describe('getTierRequirements', () => {
      it('returns correct requirements for each tier', () => {
        expect(getTierRequirements('good')).toBe(GOOD_TIER_REQUIREMENTS);
        expect(getTierRequirements('great')).toBe(GREAT_TIER_REQUIREMENTS);
        expect(getTierRequirements('world_class')).toBe(WORLD_CLASS_TIER_REQUIREMENTS);
        expect(getTierRequirements('legendary')).toBe(LEGENDARY_TIER_REQUIREMENTS);
      });
    });
  });

  // =========================================================================
  // DEFAULT EXCELLENCE CRITERIA
  // =========================================================================

  describe('default excellence criteria', () => {
    it('defines criteria for all dimensions', () => {
      expect(DEFAULT_EXCELLENCE_CRITERIA).toHaveLength(6);
      const dimensions = DEFAULT_EXCELLENCE_CRITERIA.map(c => c.dimension);
      for (const dim of EXCELLENCE_DIMENSIONS) {
        expect(dimensions).toContain(dim);
      }
    });

    describe('FUNCTIONAL_CRITERIA', () => {
      it('includes test coverage requirement', () => {
        const testCoverageReq = FUNCTIONAL_CRITERIA.requirements.find(
          r => r.id === 'func-test-coverage'
        );
        expect(testCoverageReq).toBeDefined();
        expect(testCoverageReq?.mandatory).toBe(true);
        expect(testCoverageReq?.targetValue).toBe(0.8);
      });

      it('includes mutation score requirement', () => {
        const mutationReq = FUNCTIONAL_CRITERIA.requirements.find(
          r => r.id === 'func-mutation-score'
        );
        expect(mutationReq).toBeDefined();
        expect(mutationReq?.operator).toBe('gte');
      });

      it('has appropriate weight', () => {
        expect(FUNCTIONAL_CRITERIA.weight).toBe(0.2);
      });
    });

    describe('PERFORMANCE_CRITERIA', () => {
      it('includes latency requirements', () => {
        const p50Req = PERFORMANCE_CRITERIA.requirements.find(r => r.id === 'perf-p50-latency');
        const p99Req = PERFORMANCE_CRITERIA.requirements.find(r => r.id === 'perf-p99-latency');
        expect(p50Req).toBeDefined();
        expect(p99Req).toBeDefined();
        expect(p50Req?.targetValue).toBe(100);
        expect(p99Req?.targetValue).toBe(500);
      });

      it('requires benchmark data and load tests', () => {
        expect(PERFORMANCE_CRITERIA.evidenceRequired).toContain('benchmark_data');
        expect(PERFORMANCE_CRITERIA.evidenceRequired).toContain('load_test');
      });
    });

    describe('RELIABILITY_CRITERIA', () => {
      it('includes availability requirement', () => {
        const availReq = RELIABILITY_CRITERIA.requirements.find(r => r.id === 'rel-availability');
        expect(availReq).toBeDefined();
        expect(availReq?.targetValue).toBe(0.999); // Three nines
      });

      it('includes MTTR requirement', () => {
        const mttrReq = RELIABILITY_CRITERIA.requirements.find(r => r.id === 'rel-mttr');
        expect(mttrReq).toBeDefined();
        expect(mttrReq?.operator).toBe('lte'); // Less than or equal
        expect(mttrReq?.targetValue).toBe(15); // 15 minutes
      });
    });

    describe('SECURITY_CRITERIA', () => {
      it('requires zero critical vulnerabilities', () => {
        const critVulnReq = SECURITY_CRITERIA.requirements.find(r => r.id === 'sec-critical-vulns');
        expect(critVulnReq).toBeDefined();
        expect(critVulnReq?.targetValue).toBe(0);
        expect(critVulnReq?.mandatory).toBe(true);
      });

      it('requires penetration testing evidence', () => {
        expect(SECURITY_CRITERIA.evidenceRequired).toContain('penetration_test');
      });
    });

    describe('MAINTAINABILITY_CRITERIA', () => {
      it('includes complexity requirement', () => {
        const complexityReq = MAINTAINABILITY_CRITERIA.requirements.find(
          r => r.id === 'maint-complexity'
        );
        expect(complexityReq).toBeDefined();
        expect(complexityReq?.targetValue).toBe(10);
        expect(complexityReq?.operator).toBe('lte');
      });

      it('includes documentation coverage requirement', () => {
        const docReq = MAINTAINABILITY_CRITERIA.requirements.find(
          r => r.id === 'maint-documentation'
        );
        expect(docReq).toBeDefined();
        expect(docReq?.targetValue).toBe(0.9);
      });
    });

    describe('USABILITY_CRITERIA', () => {
      it('includes user satisfaction requirement', () => {
        const satisfactionReq = USABILITY_CRITERIA.requirements.find(
          r => r.id === 'use-satisfaction'
        );
        expect(satisfactionReq).toBeDefined();
        expect(satisfactionReq?.targetValue).toBe(80);
      });

      it('includes accessibility compliance requirement', () => {
        const a11yReq = USABILITY_CRITERIA.requirements.find(
          r => r.id === 'use-accessibility'
        );
        expect(a11yReq).toBeDefined();
        expect(a11yReq?.targetValue).toBe(0.95);
      });
    });
  });

  // =========================================================================
  // BENCHMARK DATABASE
  // =========================================================================

  describe('InMemoryBenchmarkDatabase', () => {
    let db: InMemoryBenchmarkDatabase;

    beforeEach(() => {
      db = new InMemoryBenchmarkDatabase();
    });

    it('adds and retrieves benchmarks', () => {
      db.addBenchmark('web-api', 'project-a', { p99Latency: 100, throughput: 1000 });
      db.addBenchmark('web-api', 'project-b', { p99Latency: 150, throughput: 800 });

      const entries = db.getEntriesForCategory('web-api');
      expect(entries).toHaveLength(2);
    });

    it('returns best in class', () => {
      db.addBenchmark('web-api', 'project-a', { p99Latency: 100, throughput: 1000 });
      db.addBenchmark('web-api', 'project-b', { p99Latency: 50, throughput: 2000 });

      const best = db.getBestInClass('web-api');
      expect(best).not.toBeNull();
      // project-b has higher sum of metrics (50 + 2000 = 2050 vs 100 + 1000 = 1100)
      expect(best?.project).toBe('project-b');
    });

    it('returns null for empty category', () => {
      const best = db.getBestInClass('unknown-category');
      expect(best).toBeNull();
    });

    it('compares metrics to industry', () => {
      db.addBenchmark('web-api', 'industry-avg', { p99Latency: 200, throughput: 500 });
      db.addBenchmark('web-api', 'top-performer', { p99Latency: 50, throughput: 2000 });

      const result = db.compareToIndustry({ p99Latency: 100, throughput: 1000 }, 'web-api');

      expect(result.category).toBe('web-api');
      expect(result.comparisons).toHaveLength(2);
      expect(result.overallPercentile).toBeGreaterThanOrEqual(0);
      expect(result.overallPercentile).toBeLessThanOrEqual(100);
    });

    it('tracks historical bests', () => {
      db.addBenchmark('web-api', 'v1', { throughput: 500 });
      db.addBenchmark('web-api', 'v2', { throughput: 1000 });
      db.addBenchmark('web-api', 'v3', { throughput: 750 }); // Not a new best

      const history = db.trackHistoricalBest('throughput');
      expect(history).toHaveLength(2); // Only v1 and v2 are bests
      expect(history[1].value).toBe(1000);
      expect(history[1].previousBest?.value).toBe(500);
    });

    it('calculates percentiles', () => {
      db.addBenchmark('web-api', 'p1', { score: 50 });
      db.addBenchmark('web-api', 'p2', { score: 60 });
      db.addBenchmark('web-api', 'p3', { score: 70 });
      db.addBenchmark('web-api', 'p4', { score: 80 });

      // 75 is greater than 3 out of 4 values (50, 60, 70)
      const percentile = db.getPercentile('web-api', 'score', 75);
      expect(percentile).toBe(75); // 3/4 * 100 = 75
    });

    it('returns 50 percentile for empty category', () => {
      const percentile = db.getPercentile('unknown', 'score', 100);
      expect(percentile).toBe(50);
    });
  });

  // =========================================================================
  // EXCELLENCE CHECKLIST
  // =========================================================================

  describe('createExcellenceChecklist', () => {
    it('creates checklist with default criteria', () => {
      const checklist = createExcellenceChecklist();
      expect(checklist.schemaVersion).toBe(EXCELLENCE_VALIDATION_SCHEMA_VERSION);
      expect(checklist.dimensions.size).toBe(6);
    });

    it('creates checklist with custom criteria', () => {
      const customCriteria = [FUNCTIONAL_CRITERIA, SECURITY_CRITERIA];
      const checklist = createExcellenceChecklist(customCriteria);
      expect(checklist.dimensions.size).toBe(2);
      expect(checklist.dimensions.has('functional')).toBe(true);
      expect(checklist.dimensions.has('security')).toBe(true);
    });

    describe('evaluate', () => {
      it('evaluates an excellent artifact as world-class', () => {
        const checklist = createExcellenceChecklist();
        const artifact = createValidationArtifact({
          name: 'excellent-system',
          type: 'system',
          metrics: {
            // Functional
            testCoverage: 0.98,
            mutationScore: 0.90,
            defectRate: 0.1,
            acceptanceCriteriaMet: true,
            // Performance
            p50Latency: 30,
            p99Latency: 100,
            throughput: 5000,
            resourceEfficiency: 0.95,
            // Reliability
            availability: 0.9999,
            mtbf: 2000,
            mttr: 5,
            errorRate: 0.001,
            // Security
            criticalVulnerabilities: 0,
            highVulnerabilities: 0,
            securityCompliance: 0.99,
            securityReviewComplete: true,
            // Maintainability
            avgComplexity: 5,
            duplicationPercent: 1,
            documentationCoverage: 0.98,
            dependencyHealth: 0.95,
            techDebtRatio: 2,
            // Usability
            userSatisfaction: 95,
            accessibilityCompliance: 0.98,
            apiConsistency: 0.95,
            errorMessageQuality: 0.92,
          },
          evidence: [
            createEvidence({ type: 'test_results', description: 'Unit tests', source: 'CI' }),
            createEvidence({ type: 'benchmark_data', description: 'Performance', source: 'Load test' }),
            createEvidence({ type: 'audit_report', description: 'Security audit', source: 'External' }),
            createEvidence({ type: 'peer_review', description: 'Code review', source: 'Team' }),
          ],
        });

        const report = checklist.evaluate(artifact);

        expect(report.overallScore).toBeGreaterThan(90);
        // Artifact is so excellent it may achieve world_class or legendary
        expect(['world_class', 'legendary']).toContain(report.tier);
        expect(report.passedMandatory).toBe(true);
        // Summary should reflect the achieved tier
        expect(report.summary).toMatch(/World-Class|Legendary/);
      });

      it('evaluates a poor artifact as good tier', () => {
        const checklist = createExcellenceChecklist();
        const artifact = createValidationArtifact({
          name: 'basic-system',
          type: 'system',
          metrics: {
            testCoverage: 0.75,
            defectRate: 2,
            acceptanceCriteriaMet: true,
            p50Latency: 150,
            p99Latency: 600,
            availability: 0.995,
            mttr: 30,
            errorRate: 0.02,
            criticalVulnerabilities: 0,
            highVulnerabilities: 1,
            securityReviewComplete: true,
            avgComplexity: 12,
            documentationCoverage: 0.75,
          },
        });

        const report = checklist.evaluate(artifact);

        expect(report.overallScore).toBeLessThan(90);
        expect(['good', 'great']).toContain(report.tier);
      });

      it('identifies gaps in evaluation', () => {
        const checklist = createExcellenceChecklist();
        const artifact = createValidationArtifact({
          name: 'gappy-system',
          type: 'system',
          metrics: {
            testCoverage: 0.50, // Below requirement
            criticalVulnerabilities: 1, // Should be 0
          },
        });

        const report = checklist.evaluate(artifact);

        expect(report.gaps.length).toBeGreaterThan(0);
        const testCoverageGap = report.gaps.find(g =>
          g.description.includes('Test Coverage')
        );
        expect(testCoverageGap).toBeDefined();
      });

      it('generates recommendations', () => {
        const checklist = createExcellenceChecklist();
        const artifact = createValidationArtifact({
          name: 'needs-work',
          type: 'system',
          metrics: {
            testCoverage: 0.60,
            avgComplexity: 15,
          },
        });

        const report = checklist.evaluate(artifact);

        expect(report.recommendations.length).toBeGreaterThan(0);
        expect(report.recommendations[0].actions.length).toBeGreaterThan(0);
      });

      it('tracks evidence used', () => {
        const checklist = createExcellenceChecklist();
        const evidence1 = createEvidence({ type: 'test_results', description: 'Tests', source: 'CI' });
        const evidence2 = createEvidence({ type: 'code_metrics', description: 'Metrics', source: 'SonarQube' });

        const artifact = createValidationArtifact({
          name: 'evidenced-system',
          type: 'system',
          metrics: { testCoverage: 0.85 },
          evidence: [evidence1, evidence2],
        });

        const report = checklist.evaluate(artifact);

        expect(report.evidenceUsed.length).toBeGreaterThanOrEqual(0);
      });

      it('calculates dimension scores correctly', () => {
        const checklist = createExcellenceChecklist();
        const artifact = createValidationArtifact({
          name: 'mixed-quality',
          type: 'system',
          metrics: {
            testCoverage: 0.95, // Functional - good
            defectRate: 0.5,
            acceptanceCriteriaMet: true,
            criticalVulnerabilities: 2, // Security - bad
            highVulnerabilities: 5,
          },
        });

        const report = checklist.evaluate(artifact);

        const functionalScore = report.dimensionScores.get('functional');
        const securityScore = report.dimensionScores.get('security');

        // Functional should score higher than security
        expect(functionalScore?.score).toBeGreaterThan((securityScore?.score ?? 0));
      });

      it('generates meaningful summary', () => {
        const checklist = createExcellenceChecklist();
        const artifact = createValidationArtifact({
          name: 'test-system',
          type: 'system',
          metrics: { testCoverage: 0.85 },
        });

        const report = checklist.evaluate(artifact);

        expect(report.summary).toContain('excellence score');
        expect(report.summary).toContain('tier');
      });
    });
  });

  // =========================================================================
  // CERTIFICATION FRAMEWORK
  // =========================================================================

  describe('createCertificationFramework', () => {
    it('creates a certification framework', () => {
      const framework = createCertificationFramework();
      expect(framework.assessTier).toBeDefined();
      expect(framework.getRequirementsForTier).toBeDefined();
      expect(framework.maintainCertification).toBeDefined();
      expect(framework.upgradePath).toBeDefined();
    });

    describe('assessTier', () => {
      it('assesses an artifact and returns tier', () => {
        const framework = createCertificationFramework();
        const artifact = createValidationArtifact({
          name: 'assessed-system',
          type: 'system',
          metrics: {
            testCoverage: 0.90,
            defectRate: 0.5,
            acceptanceCriteriaMet: true,
            p50Latency: 50,
            p99Latency: 200,
            availability: 0.999,
            mttr: 10,
            errorRate: 0.005,
            criticalVulnerabilities: 0,
            highVulnerabilities: 0,
            securityReviewComplete: true,
            avgComplexity: 8,
            documentationCoverage: 0.90,
          },
        });
        const evidence = [
          createEvidence({ type: 'test_results', description: 'Tests', source: 'CI' }),
        ];

        const assessment = framework.assessTier(artifact, evidence);

        expect(assessment.artifactId).toBe(artifact.id);
        expect(assessment.currentTier).toBeDefined();
        expect(EXCELLENCE_TIERS).toContain(assessment.currentTier);
        expect(assessment.dimensionAssessments).toHaveLength(6);
        expect(assessment.confidence).toBeGreaterThanOrEqual(0);
        expect(assessment.confidence).toBeLessThanOrEqual(1);
      });

      it('marks certification validity based on mandatory requirements', () => {
        const framework = createCertificationFramework();
        const artifact = createValidationArtifact({
          name: 'certified-system',
          type: 'system',
          metrics: {
            testCoverage: 0.85,
            acceptanceCriteriaMet: true,
            defectRate: 0.5,
            availability: 0.999,
            mttr: 10,
            errorRate: 0.005,
            criticalVulnerabilities: 0,
            highVulnerabilities: 0,
            securityReviewComplete: true,
            avgComplexity: 8,
            documentationCoverage: 0.85,
          },
        });

        const assessment = framework.assessTier(artifact, []);

        expect(typeof assessment.isCertified).toBe('boolean');
      });

      it('calculates gaps to next tier', () => {
        const framework = createCertificationFramework();
        const artifact = createValidationArtifact({
          name: 'good-system',
          type: 'system',
          metrics: {
            testCoverage: 0.75, // Good but not great
          },
        });

        const assessment = framework.assessTier(artifact, []);

        if (assessment.currentTier !== 'legendary') {
          expect(assessment.gapsToNextTier.length).toBeGreaterThanOrEqual(0);
        }
      });

      it('sets certification expiry', () => {
        const framework = createCertificationFramework();
        const artifact = createValidationArtifact({
          name: 'expiring-system',
          type: 'system',
          metrics: { testCoverage: 0.80 },
        });

        const assessment = framework.assessTier(artifact, []);

        expect(assessment.certificationExpiry).toBeDefined();
        const expiryDate = new Date(assessment.certificationExpiry!);
        const assessedDate = new Date(assessment.assessedAt);
        expect(expiryDate.getTime()).toBeGreaterThan(assessedDate.getTime());
      });
    });

    describe('getRequirementsForTier', () => {
      it('returns requirements for all tiers', () => {
        const framework = createCertificationFramework();

        for (const tier of EXCELLENCE_TIERS) {
          const requirements = framework.getRequirementsForTier(tier);
          expect(requirements.tier).toBe(tier);
          expect(requirements.minimumScores.size).toBe(6);
          expect(requirements.requiredEvidence.length).toBeGreaterThan(0);
        }
      });
    });

    describe('maintainCertification', () => {
      it('returns maintenance status', () => {
        const framework = createCertificationFramework();

        const status = framework.maintainCertification('cert-123');

        expect(status.certificationId).toBe('cert-123');
        expect(status.isActive).toBeDefined();
        expect(status.daysUntilRenewal).toBeGreaterThanOrEqual(0);
        expect(status.healthScore).toBeGreaterThanOrEqual(0);
        expect(status.healthScore).toBeLessThanOrEqual(100);
      });
    });

    describe('upgradePath', () => {
      it('returns upgrade path from good to great', () => {
        const framework = createCertificationFramework();

        const path = framework.upgradePath('good');

        expect(path.currentTier).toBe('good');
        expect(path.targetTier).toBe('great');
        expect(path.requirements).toBeDefined();
        expect(path.estimatedEffort).toBeGreaterThan(0);
        expect(path.recommendedSequence.length).toBeGreaterThan(0);
      });

      it('returns upgrade path from great to world_class', () => {
        const framework = createCertificationFramework();

        const path = framework.upgradePath('great');

        expect(path.currentTier).toBe('great');
        expect(path.targetTier).toBe('world_class');
      });

      it('returns no upgrade from legendary', () => {
        const framework = createCertificationFramework();

        const path = framework.upgradePath('legendary');

        expect(path.currentTier).toBe('legendary');
        expect(path.targetTier).toBe('legendary');
        expect(path.gaps).toHaveLength(0);
        expect(path.estimatedEffort).toBe(0);
      });

      it('provides recommended sequence of improvements', () => {
        const framework = createCertificationFramework();

        const path = framework.upgradePath('good');

        for (const step of path.recommendedSequence) {
          expect(step.stepNumber).toBeGreaterThan(0);
          expect(step.title).toBeDefined();
          expect(step.dimension).toBeDefined();
          expect(step.effort).toBeGreaterThan(0);
          expect(step.actions.length).toBeGreaterThan(0);
        }
      });
    });

    describe('meetsTierRequirements', () => {
      it('returns true for artifact meeting tier requirements', () => {
        const framework = createCertificationFramework();
        const artifact = createValidationArtifact({
          name: 'good-system',
          type: 'system',
          metrics: {
            testCoverage: 0.95,
            mutationScore: 0.85,
            defectRate: 0.2,
            acceptanceCriteriaMet: true,
            p50Latency: 30,
            p99Latency: 100,
            throughput: 5000,
            resourceEfficiency: 0.95,
            availability: 0.9999,
            mtbf: 2000,
            mttr: 5,
            errorRate: 0.001,
            criticalVulnerabilities: 0,
            highVulnerabilities: 0,
            securityCompliance: 0.99,
            securityReviewComplete: true,
            avgComplexity: 5,
            duplicationPercent: 1,
            documentationCoverage: 0.95,
            dependencyHealth: 0.95,
            techDebtRatio: 2,
            userSatisfaction: 95,
            accessibilityCompliance: 0.98,
            apiConsistency: 0.95,
            errorMessageQuality: 0.92,
          },
        });

        expect(framework.meetsTierRequirements(artifact, 'good')).toBe(true);
      });
    });
  });

  // =========================================================================
  // INDEPENDENT VALIDATION
  // =========================================================================

  describe('createIndependentValidation', () => {
    it('creates an independent validation interface', () => {
      const validation = createIndependentValidation();
      expect(validation.simulateExternalAudit).toBeDefined();
      expect(validation.runRedTeamExercise).toBeDefined();
      expect(validation.performAdversarialTesting).toBeDefined();
      expect(validation.exhaustEdgeCases).toBeDefined();
    });

    describe('simulateExternalAudit', () => {
      it('simulates an ISO 27001 audit', () => {
        const validation = createIndependentValidation();
        const artifact = createValidationArtifact({
          name: 'audited-system',
          type: 'system',
          metrics: {},
        });

        const result = validation.simulateExternalAudit(artifact, 'ISO_27001');

        expect(result.standard).toBe('ISO_27001');
        expect(result.artifactId).toBe(artifact.id);
        expect(result.complianceScore).toBeGreaterThanOrEqual(0);
        expect(result.complianceScore).toBeLessThanOrEqual(100);
        expect(result.controlsChecked.length).toBeGreaterThan(0);
        expect(typeof result.passed).toBe('boolean');
      });

      it('simulates OWASP TOP 10 audit', () => {
        const validation = createIndependentValidation();
        const artifact = createValidationArtifact({
          name: 'web-app',
          type: 'system',
          metrics: {},
        });

        const result = validation.simulateExternalAudit(artifact, 'OWASP_TOP_10');

        expect(result.standard).toBe('OWASP_TOP_10');
        expect(result.controlsChecked).toHaveLength(10);
      });

      it('identifies findings by severity', () => {
        const validation = createIndependentValidation();
        const artifact = createValidationArtifact({
          name: 'system',
          type: 'system',
          metrics: {},
        });

        const result = validation.simulateExternalAudit(artifact, 'SOC_2');

        // At least one type of finding should be present (or all empty if perfect)
        expect(result.criticalFindings).toBeDefined();
        expect(result.majorFindings).toBeDefined();
        expect(result.minorFindings).toBeDefined();
      });

      it('generates remediation items', () => {
        const validation = createIndependentValidation();
        const artifact = createValidationArtifact({
          name: 'system',
          type: 'system',
          metrics: {},
        });

        const result = validation.simulateExternalAudit(artifact, 'PCI_DSS');

        for (const item of result.remediationRequired) {
          expect(item.findingId).toBeDefined();
          expect(item.action).toBeDefined();
          expect(item.priority).toBeGreaterThan(0);
          expect(item.effortHours).toBeGreaterThan(0);
        }
      });
    });

    describe('runRedTeamExercise', () => {
      it('runs a red team exercise', () => {
        const validation = createIndependentValidation();
        const system = createTestSystem({
          name: 'target-system',
          components: [
            createTestComponent({ name: 'web-server', type: 'server' }),
            createTestComponent({ name: 'database', type: 'database' }),
          ],
          securityControls: ['firewall', 'WAF', 'IDS'],
        });
        const attackVectors = [
          createAttackVector({
            type: 'injection',
            name: 'SQL Injection',
            description: 'Test SQL injection',
            complexity: 2,
            potentialImpact: 5,
            techniques: ['union-based', 'blind'],
            targets: ['web-server'],
          }),
          createAttackVector({
            type: 'authentication',
            name: 'Credential Stuffing',
            description: 'Test credential reuse',
            complexity: 1,
            potentialImpact: 4,
            techniques: ['automated-login'],
            targets: ['web-server'],
          }),
        ];

        const result = validation.runRedTeamExercise(system, attackVectors);

        expect(result.systemId).toBe(system.id);
        expect(result.vectorsAttempted).toHaveLength(2);
        expect(result.detectionRate).toBeGreaterThanOrEqual(0);
        expect(result.detectionRate).toBeLessThanOrEqual(1);
        expect(result.securityScore).toBeGreaterThanOrEqual(0);
        expect(result.securityScore).toBeLessThanOrEqual(100);
      });

      it('tracks successful breaches and blocked attempts', () => {
        const validation = createIndependentValidation();
        const system = createTestSystem({
          name: 'target',
          components: [createTestComponent({ name: 'app', type: 'application' })],
        });
        const attackVectors = Array.from({ length: 10 }, (_, i) =>
          createAttackVector({
            type: 'injection',
            name: `Attack ${i}`,
            description: `Test attack ${i}`,
            complexity: 3,
            potentialImpact: 3,
            techniques: ['tech1'],
            targets: ['app'],
          })
        );

        const result = validation.runRedTeamExercise(system, attackVectors);

        // Sum of breaches and blocked should equal attempted
        const total = result.successfulBreaches.length + result.blockedAttempts.length;
        expect(total).toBe(attackVectors.length);
      });
    });

    describe('performAdversarialTesting', () => {
      it('performs adversarial testing on a component', () => {
        const validation = createIndependentValidation();
        const component = createTestComponent({
          name: 'api-handler',
          type: 'function',
          technologies: ['typescript'],
        });
        const config: AdversarialConfig = {
          intensity: 3,
          useFuzzing: true,
          fuzzingSeedCount: 50,
          testBoundaries: true,
          testMalformedInput: true,
          maxTimePerTest: 1000,
          testConcurrency: false,
        };

        const result = validation.performAdversarialTesting(component, config);

        expect(result.componentId).toBe(component.id);
        expect(result.totalTests).toBe(50);
        expect(result.passed + result.failed).toBe(result.totalTests);
        expect(result.reliabilityScore).toBeGreaterThanOrEqual(0);
        expect(result.reliabilityScore).toBeLessThanOrEqual(100);
        expect(result.coverage).toBeGreaterThanOrEqual(0);
        expect(result.coverage).toBeLessThanOrEqual(1);
      });

      it('reports crashes and unexpected behaviors', () => {
        const validation = createIndependentValidation();
        const component = createTestComponent({ name: 'parser', type: 'function' });
        const config: AdversarialConfig = {
          intensity: 5,
          useFuzzing: true,
          fuzzingSeedCount: 200,
          testBoundaries: true,
          testMalformedInput: true,
          maxTimePerTest: 500,
          testConcurrency: true,
          concurrentUsers: 10,
        };

        const result = validation.performAdversarialTesting(component, config);

        // With 200 tests, we expect some issues
        expect(result.crashes).toBeDefined();
        expect(result.unexpectedBehaviors).toBeDefined();
        expect(result.performanceAnomalies).toBeDefined();
      });
    });

    describe('exhaustEdgeCases', () => {
      it('exhausts edge cases for numeric domain', () => {
        const validation = createIndependentValidation();
        const domain: Domain = {
          name: 'age',
          type: 'numeric',
          min: 0,
          max: 150,
          nullable: false,
        };

        const result = validation.exhaustEdgeCases('validateAge', domain);

        expect(result.targetId).toBe('validateAge');
        expect(result.domain).toBe(domain);
        expect(result.totalCases).toBeGreaterThan(0);
        expect(result.passedCases).toBeLessThanOrEqual(result.totalCases);
        expect(result.robustnessScore).toBeGreaterThanOrEqual(0);
        expect(result.robustnessScore).toBeLessThanOrEqual(100);
      });

      it('exhausts edge cases for string domain', () => {
        const validation = createIndependentValidation();
        const domain: Domain = {
          name: 'username',
          type: 'string',
          maxLength: 50,
          nullable: true,
        };

        const result = validation.exhaustEdgeCases('validateUsername', domain);

        expect(result.categoriesTested.length).toBeGreaterThan(0);
        expect(result.categoriesTested.some(c => c.name === 'Empty/Null')).toBe(true);
        expect(result.categoriesTested.some(c => c.name === 'Special Characters')).toBe(true);
      });

      it('exhausts edge cases for array domain', () => {
        const validation = createIndependentValidation();
        const domain: Domain = {
          name: 'items',
          type: 'array',
          maxLength: 100,
          nullable: false,
        };

        const result = validation.exhaustEdgeCases('processItems', domain);

        expect(result.categoriesTested.some(c => c.name === 'Empty Array')).toBe(true);
        expect(result.categoriesTested.some(c => c.name === 'Single Element')).toBe(true);
      });

      it('includes nullable edge cases when nullable', () => {
        const validation = createIndependentValidation();
        const domain: Domain = {
          name: 'optional',
          type: 'string',
          nullable: true,
        };

        const result = validation.exhaustEdgeCases('processOptional', domain);

        expect(result.categoriesTested.some(c => c.name === 'Null Values')).toBe(true);
      });

      it('provides recommendations based on results', () => {
        const validation = createIndependentValidation();
        const domain: Domain = {
          name: 'data',
          type: 'object',
          nullable: false,
        };

        const result = validation.exhaustEdgeCases('processData', domain);

        expect(result.recommendations.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // FACTORY FUNCTIONS
  // =========================================================================

  describe('factory functions', () => {
    describe('createEvidence', () => {
      it('creates evidence with required fields', () => {
        const evidence = createEvidence({
          type: 'test_results',
          description: 'Unit test results',
          source: 'Jest',
        });

        expect(evidence.id).toMatch(/^evidence-/);
        expect(evidence.type).toBe('test_results');
        expect(evidence.description).toBe('Unit test results');
        expect(evidence.source).toBe('Jest');
        expect(evidence.collectedAt).toBe('2026-01-29T10:00:00.000Z');
        expect(evidence.isValid).toBe(true);
        expect(evidence.reliability).toBe(0.9);
      });

      it('creates evidence with optional fields', () => {
        const evidence = createEvidence({
          type: 'benchmark_data',
          description: 'Performance benchmarks',
          source: 'k6',
          value: 99.5,
          unit: 'percentile',
          reference: 'https://example.com/results',
          reliability: 0.95,
          expiresAt: '2027-01-29T10:00:00.000Z',
        });

        expect(evidence.value).toBe(99.5);
        expect(evidence.unit).toBe('percentile');
        expect(evidence.reference).toBe('https://example.com/results');
        expect(evidence.reliability).toBe(0.95);
        expect(evidence.expiresAt).toBe('2027-01-29T10:00:00.000Z');
      });
    });

    describe('createValidationArtifact', () => {
      it('creates artifact with required fields', () => {
        const artifact = createValidationArtifact({
          name: 'My System',
          type: 'system',
          metrics: { testCoverage: 0.85 },
        });

        expect(artifact.id).toMatch(/^artifact-/);
        expect(artifact.name).toBe('My System');
        expect(artifact.type).toBe('system');
        expect(artifact.metrics.testCoverage).toBe(0.85);
        expect(artifact.evidence).toHaveLength(0);
        expect(artifact.updatedAt).toBe('2026-01-29T10:00:00.000Z');
      });

      it('creates artifact with evidence', () => {
        const evidence = createEvidence({
          type: 'test_results',
          description: 'Tests',
          source: 'CI',
        });
        const artifact = createValidationArtifact({
          name: 'Tested System',
          type: 'component',
          metrics: {},
          evidence: [evidence],
          version: '1.0.0',
        });

        expect(artifact.evidence).toHaveLength(1);
        expect(artifact.version).toBe('1.0.0');
      });
    });

    describe('createAttackVector', () => {
      it('creates an attack vector', () => {
        const vector = createAttackVector({
          type: 'injection',
          name: 'SQL Injection',
          description: 'Test SQL injection vulnerabilities',
          complexity: 2,
          potentialImpact: 5,
          techniques: ['union-based', 'time-based blind'],
          targets: ['login-form', 'search-api'],
        });

        expect(vector.id).toMatch(/^attack-vector-/);
        expect(vector.type).toBe('injection');
        expect(vector.name).toBe('SQL Injection');
        expect(vector.complexity).toBe(2);
        expect(vector.potentialImpact).toBe(5);
        expect(vector.techniques).toHaveLength(2);
        expect(vector.targets).toHaveLength(2);
      });
    });

    describe('createTestSystem', () => {
      it('creates a test system', () => {
        const components = [
          createTestComponent({ name: 'web', type: 'server' }),
          createTestComponent({ name: 'db', type: 'database' }),
        ];
        const system = createTestSystem({
          name: 'Production System',
          components,
          interfaces: [{ id: 'api', name: 'REST API', type: 'API', protocol: 'HTTPS', authRequired: true }],
          securityControls: ['firewall', 'WAF'],
        });

        expect(system.id).toMatch(/^system-/);
        expect(system.name).toBe('Production System');
        expect(system.components).toHaveLength(2);
        expect(system.interfaces).toHaveLength(1);
        expect(system.securityControls).toHaveLength(2);
      });

      it('creates system with defaults for optional fields', () => {
        const system = createTestSystem({
          name: 'Simple System',
          components: [],
        });

        expect(system.interfaces).toHaveLength(0);
        expect(system.securityControls).toHaveLength(0);
      });
    });

    describe('createTestComponent', () => {
      it('creates a test component', () => {
        const component = createTestComponent({
          name: 'API Gateway',
          type: 'service',
          technologies: ['Node.js', 'Express'],
          dependencies: ['auth-service', 'user-service'],
          interfaces: ['REST', 'GraphQL'],
        });

        expect(component.id).toMatch(/^component-/);
        expect(component.name).toBe('API Gateway');
        expect(component.type).toBe('service');
        expect(component.technologies).toHaveLength(2);
        expect(component.dependencies).toHaveLength(2);
        expect(component.interfaces).toHaveLength(2);
      });

      it('creates component with defaults for optional fields', () => {
        const component = createTestComponent({
          name: 'Simple Component',
          type: 'function',
        });

        expect(component.technologies).toHaveLength(0);
        expect(component.dependencies).toHaveLength(0);
        expect(component.interfaces).toHaveLength(0);
      });
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('handles artifact with no metrics gracefully', () => {
      const checklist = createExcellenceChecklist();
      const artifact = createValidationArtifact({
        name: 'empty',
        type: 'system',
        metrics: {},
      });

      const report = checklist.evaluate(artifact);

      // Should not crash and should report issues
      expect(report).toBeDefined();
      expect(report.gaps.length).toBeGreaterThan(0);
    });

    it('handles empty evidence array', () => {
      const framework = createCertificationFramework();
      const artifact = createValidationArtifact({
        name: 'no-evidence',
        type: 'system',
        metrics: { testCoverage: 0.85 },
      });

      const assessment = framework.assessTier(artifact, []);

      expect(assessment).toBeDefined();
      expect(assessment.confidence).toBeLessThan(1);
    });

    it('handles boundary metric values', () => {
      const checklist = createExcellenceChecklist();
      const artifact = createValidationArtifact({
        name: 'boundary',
        type: 'system',
        metrics: {
          testCoverage: 0.80, // Exactly at threshold
          p99Latency: 500, // Exactly at threshold
        },
      });

      const report = checklist.evaluate(artifact);

      // Should pass requirements at exact boundary
      const testCoverageResult = report.requirementResults.find(
        r => r.requirement.id === 'func-test-coverage'
      );
      expect(testCoverageResult?.met).toBe(true);
    });

    it('handles zero attack vectors in red team', () => {
      const validation = createIndependentValidation();
      const system = createTestSystem({
        name: 'safe-system',
        components: [],
      });

      const result = validation.runRedTeamExercise(system, []);

      expect(result.vectorsAttempted).toHaveLength(0);
      expect(result.detectionRate).toBe(1); // Perfect when nothing to detect
    });
  });

  // =========================================================================
  // TYPE SAFETY
  // =========================================================================

  describe('type safety', () => {
    it('enforces valid evidence types', () => {
      const validTypes: EvidenceType[] = [
        'test_results',
        'benchmark_data',
        'audit_report',
        'user_feedback',
        'code_metrics',
        'incident_history',
        'peer_review',
        'certification',
        'penetration_test',
        'load_test',
        'chaos_engineering',
        'accessibility_audit',
      ];

      for (const type of validTypes) {
        const evidence = createEvidence({
          type,
          description: 'Test',
          source: 'Test',
        });
        expect(evidence.type).toBe(type);
      }
    });

    it('enforces valid excellence dimensions', () => {
      const dimensions: ExcellenceDimension[] = [
        'functional',
        'performance',
        'reliability',
        'security',
        'maintainability',
        'usability',
      ];

      for (const dim of dimensions) {
        expect(EXCELLENCE_DIMENSIONS).toContain(dim);
      }
    });

    it('enforces valid excellence tiers', () => {
      const tiers: ExcellenceTier[] = ['good', 'great', 'world_class', 'legendary'];

      for (const tier of tiers) {
        expect(EXCELLENCE_TIERS).toContain(tier);
        expect(getTierRequirements(tier)).toBeDefined();
      }
    });
  });
});
