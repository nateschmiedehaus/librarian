import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  QUALITY_STANDARDS_SCHEMA_VERSION,
  WORLD_CLASS_PLUS_STANDARDS,
  WORLD_CLASS_STANDARDS,
  PRODUCTION_STANDARDS,
  MVP_STANDARDS,
  ELITE_DORA_METRICS,
  HIGH_DORA_METRICS,
  validateAgainstStandard,
  generateComplianceReport,
  createCustomStandard,
  createArtifact,
  getStandardById,
  getAllStandardPresets,
  getDORAPerformanceLevel,
  calculateSQALERating,
  validateDORAMetrics,
  validateSREMetrics,
  validateAdvancedCodeQuality,
  type CorrectnessStandard,
  type CompletenessStandard,
  type ReliabilityStandard,
  type MaintainabilityStandard,
  type EpistemicStandard,
  type QualityStandard,
  type ValidatableArtifact,
  type ValidationResult,
  type ComplianceReport,
  type DORAMetrics,
  type SREStandards,
  type AdvancedCodeQuality,
  type SQALERating,
} from '../quality_standards.js';

describe('quality_standards', () => {
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
      expect(QUALITY_STANDARDS_SCHEMA_VERSION).toBe('2.0.0');
    });
  });

  // =========================================================================
  // STANDARD PRESETS
  // =========================================================================

  describe('WORLD_CLASS_STANDARDS', () => {
    it('has the strictest correctness requirements', () => {
      const { correctness } = WORLD_CLASS_STANDARDS;
      expect(correctness.functional.testCoverageMin).toBe(0.95);
      expect(correctness.functional.mutationScoreMin).toBe(0.85);
      expect(correctness.functional.requiresIntegrationTests).toBe(true);
      expect(correctness.functional.requiresE2ETests).toBe(true);
      expect(correctness.structural.maxCyclomaticComplexity).toBe(8);
      expect(correctness.structural.maxFileLines).toBe(300);
      expect(correctness.structural.maxFunctionLines).toBe(30);
    });

    it('has the strictest epistemic requirements', () => {
      const { epistemic } = WORLD_CLASS_STANDARDS;
      expect(epistemic.maxECE).toBe(0.05);
      expect(epistemic.evidenceGroundingRate).toBe(1.0);
      expect(epistemic.maxHallucinationRate).toBe(0.01);
      expect(epistemic.uncertaintyDisclosureRequired).toBe(true);
      expect(epistemic.minCalibrationSampleSize).toBe(500);
    });

    it('has the strictest reliability requirements', () => {
      const { reliability } = WORLD_CLASS_STANDARDS;
      expect(reliability.errorRateTarget).toBe(0.001);
      expect(reliability.availabilityTarget).toBe(0.9999);
      expect(reliability.latencyBudgets.p50).toBe(50);
      expect(reliability.latencyBudgets.p99).toBe(200);
      expect(reliability.recoveryTimeTarget).toBe(60);
    });

    it('has valid schema version', () => {
      expect(WORLD_CLASS_STANDARDS.schemaVersion).toBe(QUALITY_STANDARDS_SCHEMA_VERSION);
    });

    it('requires all documentation types', () => {
      expect(WORLD_CLASS_STANDARDS.completeness.documentationRequired).toContain('readme');
      expect(WORLD_CLASS_STANDARDS.completeness.documentationRequired).toContain('api');
      expect(WORLD_CLASS_STANDARDS.completeness.documentationRequired).toContain('architecture');
      expect(WORLD_CLASS_STANDARDS.completeness.documentationRequired).toContain('changelog');
      expect(WORLD_CLASS_STANDARDS.completeness.documentationRequired).toContain('contributing');
    });

    it('allows zero critical and high vulnerabilities', () => {
      expect(WORLD_CLASS_STANDARDS.maintainability.maxVulnerabilities?.critical).toBe(0);
      expect(WORLD_CLASS_STANDARDS.maintainability.maxVulnerabilities?.high).toBe(0);
    });
  });

  describe('PRODUCTION_STANDARDS', () => {
    it('has moderate correctness requirements', () => {
      const { correctness } = PRODUCTION_STANDARDS;
      expect(correctness.functional.testCoverageMin).toBe(0.80);
      expect(correctness.functional.mutationScoreMin).toBe(0.70);
      expect(correctness.functional.requiresIntegrationTests).toBe(true);
      expect(correctness.functional.requiresE2ETests).toBe(false);
      expect(correctness.structural.maxCyclomaticComplexity).toBe(10);
    });

    it('has moderate epistemic requirements', () => {
      const { epistemic } = PRODUCTION_STANDARDS;
      expect(epistemic.maxECE).toBe(0.10);
      expect(epistemic.evidenceGroundingRate).toBe(0.95);
      expect(epistemic.maxHallucinationRate).toBe(0.05);
    });

    it('has 99.9% availability target', () => {
      expect(PRODUCTION_STANDARDS.reliability.availabilityTarget).toBe(0.999);
    });

    it('is less strict than world-class', () => {
      expect(PRODUCTION_STANDARDS.correctness.functional.testCoverageMin)
        .toBeLessThan(WORLD_CLASS_STANDARDS.correctness.functional.testCoverageMin);
      expect(PRODUCTION_STANDARDS.epistemic.maxECE)
        .toBeGreaterThan(WORLD_CLASS_STANDARDS.epistemic.maxECE);
      expect(PRODUCTION_STANDARDS.reliability.errorRateTarget)
        .toBeGreaterThan(WORLD_CLASS_STANDARDS.reliability.errorRateTarget);
    });
  });

  describe('MVP_STANDARDS', () => {
    it('has minimal correctness requirements', () => {
      const { correctness } = MVP_STANDARDS;
      expect(correctness.functional.testCoverageMin).toBe(0.60);
      expect(correctness.functional.mutationScoreMin).toBeUndefined();
      expect(correctness.functional.requiresIntegrationTests).toBe(false);
      expect(correctness.structural.maxCyclomaticComplexity).toBe(15);
    });

    it('has relaxed epistemic requirements', () => {
      const { epistemic } = MVP_STANDARDS;
      expect(epistemic.maxECE).toBe(0.20);
      expect(epistemic.evidenceGroundingRate).toBe(0.80);
      expect(epistemic.maxHallucinationRate).toBe(0.15);
      expect(epistemic.uncertaintyDisclosureRequired).toBe(false);
    });

    it('only requires readme documentation', () => {
      expect(MVP_STANDARDS.completeness.documentationRequired).toEqual(['readme']);
    });

    it('is less strict than production', () => {
      expect(MVP_STANDARDS.correctness.functional.testCoverageMin)
        .toBeLessThan(PRODUCTION_STANDARDS.correctness.functional.testCoverageMin);
      expect(MVP_STANDARDS.epistemic.maxECE)
        .toBeGreaterThan(PRODUCTION_STANDARDS.epistemic.maxECE);
    });
  });

  // =========================================================================
  // VALIDATOR FUNCTIONS
  // =========================================================================

  describe('validateAgainstStandard', () => {
    it('passes when all metrics exceed world-class thresholds', () => {
      const artifact = createArtifact({
        name: 'excellent-project',
        type: 'project',
        metrics: {
          testCoverage: 0.98,
          mutationScore: 0.90,
          hasIntegrationTests: true,
          hasE2ETests: true,
          hasAcceptanceCriteria: true,
          hasUserStoryMapping: true,
          cyclomaticComplexity: 5,
          maxFileLines: 200,
          maxFunctionLines: 20,
          maxNestingDepth: 2,
          hasRequirementsTracking: true,
          hasEdgeCaseDocumentation: true,
          errorHandlingCoverage: 0.99,
          documentationPresent: ['readme', 'api', 'architecture', 'changelog', 'contributing'],
          apiDocumentationCoverage: 0.98,
          observedErrorRate: 0.0005,
          observedAvailability: 0.99995,
          latencyP50: 30,
          latencyP99: 150,
          meanRecoveryTime: 30,
          dependencyCount: 20,
          dependencyAgeMonths: 2,
          documentationAgeMonths: 0.5,
          technicalDebtHours: 2,
          vulnerabilities: { critical: 0, high: 0, medium: 1, low: 2 },
          calibrationECE: 0.03,
          evidenceGroundingRate: 1.0,
          hallucinationRate: 0.005,
          hasUncertaintyDisclosure: true,
          calibrationSampleSize: 1000,
          unresolvedContradictions: 0,
        },
      });

      const result = validateAgainstStandard(artifact, WORLD_CLASS_STANDARDS);

      expect(result.passed).toBe(true);
      expect(result.violations.filter(v => v.severity === 'error')).toHaveLength(0);
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('fails when test coverage is below threshold', () => {
      const artifact = createArtifact({
        name: 'under-tested',
        type: 'project',
        metrics: {
          testCoverage: 0.50,
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      expect(result.passed).toBe(false);
      const coverageViolation = result.violations.find(
        v => v.field === 'testCoverageMin' && v.severity === 'error'
      );
      expect(coverageViolation).toBeDefined();
      expect(coverageViolation?.actual).toBe(0.50);
      expect(coverageViolation?.expected).toBe(0.80);
    });

    it('fails when ECE exceeds threshold', () => {
      const artifact = createArtifact({
        name: 'poorly-calibrated',
        type: 'project',
        metrics: {
          calibrationECE: 0.25,
        },
      });

      const result = validateAgainstStandard(artifact, MVP_STANDARDS);

      expect(result.passed).toBe(false);
      const eceViolation = result.violations.find(v => v.field === 'maxECE');
      expect(eceViolation).toBeDefined();
      expect(eceViolation?.actual).toBe(0.25);
    });

    it('fails when hallucination rate exceeds threshold', () => {
      const artifact = createArtifact({
        name: 'hallucinating',
        type: 'project',
        metrics: {
          hallucinationRate: 0.10,
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      const hallucinationViolation = result.violations.find(
        v => v.field === 'maxHallucinationRate'
      );
      expect(hallucinationViolation).toBeDefined();
      expect(hallucinationViolation?.message).toContain('Hallucination rate exceeds maximum');
    });

    it('tracks dimension scores correctly', () => {
      const artifact = createArtifact({
        name: 'mixed-quality',
        type: 'project',
        metrics: {
          testCoverage: 0.95, // Good
          cyclomaticComplexity: 5, // Good
          calibrationECE: 0.50, // Bad for epistemic
          evidenceGroundingRate: 0.50, // Bad for epistemic
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      // Epistemic should score lower due to violations
      expect(result.dimensionScores.epistemic).toBeLessThan(result.dimensionScores.correctness);
    });

    it('reports missing required documentation', () => {
      const artifact = createArtifact({
        name: 'undocumented',
        type: 'project',
        metrics: {
          documentationPresent: ['readme'],
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      const apiDocViolation = result.violations.find(
        v => v.field === 'documentationRequired' && v.expected === 'api'
      );
      expect(apiDocViolation).toBeDefined();
      expect(apiDocViolation?.message).toContain("'api'");
    });

    it('reports vulnerability violations', () => {
      const artifact = createArtifact({
        name: 'vulnerable',
        type: 'project',
        metrics: {
          vulnerabilities: { critical: 2, high: 5, medium: 10, low: 20 },
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      const criticalViolation = result.violations.find(
        v => v.field === 'maxVulnerabilities.critical'
      );
      expect(criticalViolation).toBeDefined();
      expect(criticalViolation?.severity).toBe('error');
    });

    it('reports warning for undefined metrics', () => {
      const artifact = createArtifact({
        name: 'incomplete-metrics',
        type: 'project',
        metrics: {},
      });

      const result = validateAgainstStandard(artifact, MVP_STANDARDS);

      const warnings = result.violations.filter(v => v.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.message.includes('metric not provided'))).toBe(true);
    });

    it('sets timestamps correctly', () => {
      const artifact = createArtifact({
        name: 'test',
        type: 'project',
        metrics: {},
      });

      const result = validateAgainstStandard(artifact, MVP_STANDARDS);

      expect(result.validatedAt).toBe('2026-01-29T10:00:00.000Z');
      expect(result.standardId).toBe('mvp');
    });
  });

  // =========================================================================
  // COMPLIANCE REPORT
  // =========================================================================

  describe('generateComplianceReport', () => {
    it('generates a report for multiple projects', () => {
      const projects = [
        {
          artifact: createArtifact({
            name: 'good-project',
            type: 'project',
            metrics: {
              testCoverage: 0.85,
              cyclomaticComplexity: 8,
              errorHandlingCoverage: 0.90,
              documentationPresent: ['readme', 'api'],
            },
          }),
          name: 'Good Project',
        },
        {
          artifact: createArtifact({
            name: 'bad-project',
            type: 'project',
            metrics: {
              testCoverage: 0.30,
              cyclomaticComplexity: 20,
            },
          }),
          name: 'Bad Project',
        },
      ];

      const report = generateComplianceReport(projects, PRODUCTION_STANDARDS);

      expect(report.summary.projectCount).toBe(2);
      expect(report.projectCompliance).toHaveLength(2);
      expect(report.topViolations.length).toBeGreaterThan(0);
    });

    it('calculates compliance levels correctly', () => {
      const excellentArtifact = createArtifact({
        name: 'excellent',
        type: 'project',
        metrics: {
          testCoverage: 0.99,
          mutationScore: 0.95,
          hasIntegrationTests: true,
          hasAcceptanceCriteria: true,
          cyclomaticComplexity: 3,
          maxFileLines: 100,
          maxFunctionLines: 15,
          hasRequirementsTracking: true,
          hasEdgeCaseDocumentation: true,
          errorHandlingCoverage: 0.99,
          documentationPresent: ['readme', 'api'],
          calibrationECE: 0.05,
          evidenceGroundingRate: 0.98,
          hallucinationRate: 0.02,
          hasUncertaintyDisclosure: true,
        },
      });

      const report = generateComplianceReport(
        [{ artifact: excellentArtifact }],
        PRODUCTION_STANDARDS
      );

      // Score of 0.99+ now qualifies for world-class-plus
      expect(report.projectCompliance[0].complianceLevel).toBe('world-class-plus');
    });

    it('identifies top violations across projects', () => {
      const sharedViolation = { testCoverage: 0.50 };
      const projects = [
        { artifact: createArtifact({ name: 'p1', type: 'project', metrics: sharedViolation }) },
        { artifact: createArtifact({ name: 'p2', type: 'project', metrics: sharedViolation }) },
        { artifact: createArtifact({ name: 'p3', type: 'project', metrics: sharedViolation }) },
      ];

      const report = generateComplianceReport(projects, PRODUCTION_STANDARDS);

      const testCoverageViolation = report.topViolations.find(
        v => v.violation.field === 'testCoverageMin'
      );
      expect(testCoverageViolation).toBeDefined();
      expect(testCoverageViolation?.occurrenceCount).toBe(3);
      expect(testCoverageViolation?.affectedProjects).toHaveLength(3);
    });

    it('generates recommendations for common violations', () => {
      const projects = Array.from({ length: 10 }, (_, i) =>
        ({ artifact: createArtifact({
          name: `project-${i}`,
          type: 'project',
          metrics: { testCoverage: 0.50 },
        }) })
      );

      const report = generateComplianceReport(projects, PRODUCTION_STANDARDS);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('High Priority'))).toBe(true);
    });

    it('tracks level distribution', () => {
      const projects = [
        { artifact: createArtifact({ name: 'p1', type: 'project', metrics: { testCoverage: 0.99 } }) },
        { artifact: createArtifact({ name: 'p2', type: 'project', metrics: { testCoverage: 0.85 } }) },
        { artifact: createArtifact({ name: 'p3', type: 'project', metrics: { testCoverage: 0.65 } }) },
        { artifact: createArtifact({ name: 'p4', type: 'project', metrics: { testCoverage: 0.20 } }) },
      ];

      const report = generateComplianceReport(projects, MVP_STANDARDS);

      expect(report.summary.levelDistribution['world-class']).toBeGreaterThanOrEqual(0);
      expect(report.summary.levelDistribution['production']).toBeGreaterThanOrEqual(0);
      expect(report.summary.levelDistribution['mvp']).toBeGreaterThanOrEqual(0);
      expect(report.summary.levelDistribution['below-mvp']).toBeGreaterThanOrEqual(0);
    });

    it('includes correct timestamps', () => {
      const report = generateComplianceReport([], PRODUCTION_STANDARDS);

      expect(report.generatedAt).toBe('2026-01-29T10:00:00.000Z');
    });
  });

  // =========================================================================
  // FACTORY FUNCTIONS
  // =========================================================================

  describe('createCustomStandard', () => {
    it('creates a custom standard from a base', () => {
      const custom = createCustomStandard(PRODUCTION_STANDARDS, {
        id: 'custom-production',
        name: 'Custom Production',
        description: 'Custom standard for our team',
        correctness: {
          functional: {
            testCoverageMin: 0.90,
          },
        },
      });

      expect(custom.id).toBe('custom-production');
      expect(custom.name).toBe('Custom Production');
      expect(custom.correctness.functional.testCoverageMin).toBe(0.90);
      // Other values should be inherited
      expect(custom.correctness.functional.requiresIntegrationTests).toBe(true);
    });

    it('preserves nested objects correctly', () => {
      const custom = createCustomStandard(PRODUCTION_STANDARDS, {
        id: 'custom',
        name: 'Custom',
        reliability: {
          latencyBudgets: {
            p50: 75,
          },
        },
      });

      expect(custom.reliability.latencyBudgets.p50).toBe(75);
      // p99 should be inherited
      expect(custom.reliability.latencyBudgets.p99).toBe(PRODUCTION_STANDARDS.reliability.latencyBudgets.p99);
    });

    it('sets timestamps', () => {
      const custom = createCustomStandard(MVP_STANDARDS, {
        id: 'test',
        name: 'Test',
      });

      expect(custom.createdAt).toBe('2026-01-29T10:00:00.000Z');
      expect(custom.updatedAt).toBe('2026-01-29T10:00:00.000Z');
    });
  });

  describe('createArtifact', () => {
    it('creates an artifact with generated ID', () => {
      const artifact = createArtifact({
        name: 'Test Project',
        type: 'project',
        metrics: { testCoverage: 0.80 },
      });

      expect(artifact.id).toMatch(/^artifact-/);
      expect(artifact.name).toBe('Test Project');
      expect(artifact.type).toBe('project');
      expect(artifact.metrics.testCoverage).toBe(0.80);
    });

    it('uses provided ID when given', () => {
      const artifact = createArtifact({
        id: 'my-custom-id',
        name: 'Test',
        type: 'module',
        metrics: {},
      });

      expect(artifact.id).toBe('my-custom-id');
    });
  });

  describe('getStandardById', () => {
    it('returns world-class standard', () => {
      const standard = getStandardById('world-class');
      expect(standard).toBe(WORLD_CLASS_STANDARDS);
    });

    it('returns production standard', () => {
      const standard = getStandardById('production');
      expect(standard).toBe(PRODUCTION_STANDARDS);
    });

    it('returns mvp standard', () => {
      const standard = getStandardById('mvp');
      expect(standard).toBe(MVP_STANDARDS);
    });

    it('returns undefined for unknown ID', () => {
      const standard = getStandardById('unknown');
      expect(standard).toBeUndefined();
    });
  });

  describe('getAllStandardPresets', () => {
    it('returns all four presets', () => {
      const presets = getAllStandardPresets();
      expect(presets).toHaveLength(4);
      expect(presets).toContain(WORLD_CLASS_PLUS_STANDARDS);
      expect(presets).toContain(WORLD_CLASS_STANDARDS);
      expect(presets).toContain(PRODUCTION_STANDARDS);
      expect(presets).toContain(MVP_STANDARDS);
    });
  });

  // =========================================================================
  // TYPE SAFETY TESTS
  // =========================================================================

  describe('type safety', () => {
    it('enforces valid documentation types', () => {
      // This test ensures DocumentationType is properly constrained
      const validDocs: Array<'readme' | 'api' | 'architecture' | 'changelog' | 'contributing'> = [
        'readme',
        'api',
        'architecture',
      ];

      const artifact = createArtifact({
        name: 'typed',
        type: 'project',
        metrics: { documentationPresent: validDocs },
      });

      expect(artifact.metrics.documentationPresent).toEqual(validDocs);
    });

    it('enforces valid artifact types', () => {
      const types: Array<ValidatableArtifact['type']> = [
        'project',
        'module',
        'file',
        'function',
        'component',
      ];

      for (const type of types) {
        const artifact = createArtifact({ name: 'test', type, metrics: {} });
        expect(artifact.type).toBe(type);
      }
    });

    it('enforces valid severity levels', () => {
      const artifact = createArtifact({
        name: 'test',
        type: 'project',
        metrics: { testCoverage: 0.10 },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      for (const violation of result.violations) {
        expect(['error', 'warning', 'info']).toContain(violation.severity);
      }
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('handles empty project list in compliance report', () => {
      const report = generateComplianceReport([], PRODUCTION_STANDARDS);

      expect(report.summary.projectCount).toBe(0);
      expect(report.summary.passingCount).toBe(0);
      expect(report.summary.averageScore).toBe(0);
      expect(report.projectCompliance).toHaveLength(0);
    });

    it('handles artifact with all undefined metrics', () => {
      const artifact = createArtifact({
        name: 'empty',
        type: 'project',
        metrics: {},
      });

      const result = validateAgainstStandard(artifact, MVP_STANDARDS);

      // Should not crash, should report violations
      expect(result.violations.length).toBeGreaterThan(0);
      // Most undefined numeric metrics become warnings, but missing required docs are errors
      const warnings = result.violations.filter(v => v.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.message.includes('metric not provided'))).toBe(true);
    });

    it('handles boundary values correctly', () => {
      const artifact = createArtifact({
        name: 'boundary',
        type: 'project',
        metrics: {
          testCoverage: 0.80, // Exactly at production threshold
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      const coverageViolation = result.violations.find(
        v => v.field === 'testCoverageMin' && v.severity === 'error'
      );
      expect(coverageViolation).toBeUndefined(); // Should pass at exact threshold
    });

    it('handles vulnerability edge cases', () => {
      const artifact = createArtifact({
        name: 'vulns',
        type: 'project',
        metrics: {
          vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 },
        },
      });

      const result = validateAgainstStandard(artifact, WORLD_CLASS_STANDARDS);

      const vulnViolations = result.violations.filter(v =>
        v.field.startsWith('maxVulnerabilities')
      );
      expect(vulnViolations).toHaveLength(0);
    });
  });

  // =========================================================================
  // EPISTEMIC STANDARD SPECIFIC TESTS
  // =========================================================================

  describe('epistemic standards', () => {
    it('validates all epistemic metrics', () => {
      const artifact = createArtifact({
        name: 'epistemic-test',
        type: 'project',
        metrics: {
          calibrationECE: 0.15,
          evidenceGroundingRate: 0.85,
          hallucinationRate: 0.08,
          hasUncertaintyDisclosure: false,
          calibrationSampleSize: 50,
          unresolvedContradictions: 10,
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      // ECE exceeds 0.10
      expect(result.violations.some(v => v.field === 'maxECE')).toBe(true);
      // Grounding rate below 0.95
      expect(result.violations.some(v => v.field === 'evidenceGroundingRate')).toBe(true);
      // Hallucination rate exceeds 0.05
      expect(result.violations.some(v => v.field === 'maxHallucinationRate')).toBe(true);
      // Uncertainty disclosure required but false
      expect(result.violations.some(v => v.field === 'uncertaintyDisclosureRequired')).toBe(true);
      // Sample size below minimum
      expect(result.violations.some(v => v.field === 'minCalibrationSampleSize')).toBe(true);
      // Contradictions exceed maximum
      expect(result.violations.some(v => v.field === 'maxUnresolvedContradictions')).toBe(true);
    });

    it('passes all epistemic checks for well-calibrated system', () => {
      const artifact = createArtifact({
        name: 'calibrated',
        type: 'project',
        metrics: {
          calibrationECE: 0.08,
          evidenceGroundingRate: 0.97,
          hallucinationRate: 0.03,
          hasUncertaintyDisclosure: true,
          calibrationSampleSize: 200,
          unresolvedContradictions: 3,
        },
      });

      const result = validateAgainstStandard(artifact, PRODUCTION_STANDARDS);

      const epistemicViolations = result.violations.filter(
        v => v.dimension === 'epistemic' && v.severity === 'error'
      );
      expect(epistemicViolations).toHaveLength(0);
    });
  });

  // =========================================================================
  // WORLD-CLASS PLUS STANDARDS
  // =========================================================================

  describe('WORLD_CLASS_PLUS_STANDARDS', () => {
    it('has stricter requirements than world-class', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.correctness.functional.testCoverageMin)
        .toBeGreaterThan(WORLD_CLASS_STANDARDS.correctness.functional.testCoverageMin);
      expect(WORLD_CLASS_PLUS_STANDARDS.reliability.availabilityTarget)
        .toBeGreaterThan(WORLD_CLASS_STANDARDS.reliability.availabilityTarget);
      expect(WORLD_CLASS_PLUS_STANDARDS.epistemic.maxECE)
        .toBeLessThan(WORLD_CLASS_STANDARDS.epistemic.maxECE);
    });

    it('includes DORA metrics', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.dora).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.dora?.deploymentFrequency.minDeploysPerDay).toBeGreaterThanOrEqual(1);
      expect(WORLD_CLASS_PLUS_STANDARDS.dora?.leadTimeForChanges.maxMinutes).toBeLessThanOrEqual(60);
      expect(WORLD_CLASS_PLUS_STANDARDS.dora?.changeFailureRate.maxRate).toBeLessThanOrEqual(0.15);
      expect(WORLD_CLASS_PLUS_STANDARDS.dora?.meanTimeToRecovery.maxMinutes).toBeLessThanOrEqual(60);
    });

    it('includes SRE standards with error budgets', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.sre).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.sre?.slos.length).toBeGreaterThan(0);
      expect(WORLD_CLASS_PLUS_STANDARDS.sre?.errorBudgets.length).toBeGreaterThan(0);
      expect(WORLD_CLASS_PLUS_STANDARDS.sre?.toil.maxToilPercent).toBeLessThanOrEqual(50);
    });

    it('includes advanced code quality metrics', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.advancedCodeQuality).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.advancedCodeQuality?.cognitiveComplexity.maxPerFunction).toBeLessThanOrEqual(15);
      expect(WORLD_CLASS_PLUS_STANDARDS.advancedCodeQuality?.technicalDebtRatio.maxRatio).toBeLessThanOrEqual(0.05);
    });

    it('includes ISO 25010 quality model', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.iso25010).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.iso25010?.reliability?.availability).toBeGreaterThan(0.9999);
    });

    it('includes CISQ standards', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.cisq).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.cisq?.security.owaspTop10Compliance).toBe(true);
    });

    it('includes SQALE standards', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.sqale).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.sqale?.targetRating).toBe('A');
    });

    it('requires formal verification', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.formalVerification).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.formalVerification?.required).toBe(true);
    });

    it('requires 99.99% test determinism', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.testDeterminism).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.testDeterminism?.minDeterminismRate).toBeGreaterThanOrEqual(0.9999);
    });

    it('requires zero-downtime deployment', () => {
      expect(WORLD_CLASS_PLUS_STANDARDS.zeroDowntimeDeployment).toBeDefined();
      expect(WORLD_CLASS_PLUS_STANDARDS.zeroDowntimeDeployment?.required).toBe(true);
    });
  });

  // =========================================================================
  // DORA METRICS TESTS
  // =========================================================================

  describe('DORA Metrics', () => {
    describe('getDORAPerformanceLevel', () => {
      it('identifies elite performers', () => {
        const level = getDORAPerformanceLevel(ELITE_DORA_METRICS);
        expect(level).toBe('elite');
      });

      it('identifies high performers', () => {
        const level = getDORAPerformanceLevel(HIGH_DORA_METRICS);
        expect(level).toBe('high');
      });

      it('identifies medium performers', () => {
        const metrics: DORAMetrics = {
          deploymentFrequency: {
            minDeploysPerDay: 0.05, // About twice per month
            requiresOnDemandCapability: false,
            maxDaysBetweenDeploys: 30,
          },
          leadTimeForChanges: {
            maxMinutes: 20000, // ~2 weeks
            percentile: 'p90',
            requiresAutomatedPipeline: false,
          },
          changeFailureRate: {
            maxRate: 0.25,
            requiresAutomatedRollback: false,
          },
          meanTimeToRecovery: {
            maxMinutes: 5000, // ~3-4 days
            requiresAutomatedDetection: false,
            requiresRunbooks: false,
          },
        };
        const level = getDORAPerformanceLevel(metrics);
        expect(level).toBe('medium');
      });

      it('identifies low performers', () => {
        const metrics: DORAMetrics = {
          deploymentFrequency: {
            minDeploysPerDay: 0.01, // About once every 3 months
            requiresOnDemandCapability: false,
            maxDaysBetweenDeploys: 90,
          },
          leadTimeForChanges: {
            maxMinutes: 100000, // ~2 months
            percentile: 'p90',
            requiresAutomatedPipeline: false,
          },
          changeFailureRate: {
            maxRate: 0.50,
            requiresAutomatedRollback: false,
          },
          meanTimeToRecovery: {
            maxMinutes: 20000, // ~2 weeks
            requiresAutomatedDetection: false,
            requiresRunbooks: false,
          },
        };
        const level = getDORAPerformanceLevel(metrics);
        expect(level).toBe('low');
      });
    });

    describe('validateDORAMetrics', () => {
      it('reports violations for below-target deployment frequency', () => {
        const violations = validateDORAMetrics(
          { deploysPerDay: 0.1 },
          ELITE_DORA_METRICS
        );
        expect(violations.some(v => v.field === 'deploymentFrequency')).toBe(true);
      });

      it('reports violations for slow lead time', () => {
        const violations = validateDORAMetrics(
          { leadTimeMinutes: 120 },
          ELITE_DORA_METRICS
        );
        expect(violations.some(v => v.field === 'leadTimeForChanges')).toBe(true);
      });

      it('reports violations for high change failure rate', () => {
        const violations = validateDORAMetrics(
          { changeFailureRate: 0.25 },
          ELITE_DORA_METRICS
        );
        expect(violations.some(v => v.field === 'changeFailureRate')).toBe(true);
      });

      it('reports violations for slow MTTR', () => {
        const violations = validateDORAMetrics(
          { mttrMinutes: 120 },
          ELITE_DORA_METRICS
        );
        expect(violations.some(v => v.field === 'meanTimeToRecovery')).toBe(true);
      });

      it('returns no violations for elite metrics', () => {
        const violations = validateDORAMetrics(
          {
            deploysPerDay: 5,
            leadTimeMinutes: 30,
            changeFailureRate: 0.05,
            mttrMinutes: 15,
          },
          ELITE_DORA_METRICS
        );
        expect(violations).toHaveLength(0);
      });
    });
  });

  // =========================================================================
  // SQALE RATING TESTS
  // =========================================================================

  describe('SQALE Rating', () => {
    describe('calculateSQALERating', () => {
      const thresholds = {
        A: 0.05,
        B: 0.10,
        C: 0.20,
        D: 0.50,
      };

      it('returns A for debt ratio <= 5%', () => {
        expect(calculateSQALERating(0.03, thresholds)).toBe('A');
        expect(calculateSQALERating(0.05, thresholds)).toBe('A');
      });

      it('returns B for debt ratio 5-10%', () => {
        expect(calculateSQALERating(0.07, thresholds)).toBe('B');
        expect(calculateSQALERating(0.10, thresholds)).toBe('B');
      });

      it('returns C for debt ratio 10-20%', () => {
        expect(calculateSQALERating(0.15, thresholds)).toBe('C');
        expect(calculateSQALERating(0.20, thresholds)).toBe('C');
      });

      it('returns D for debt ratio 20-50%', () => {
        expect(calculateSQALERating(0.30, thresholds)).toBe('D');
        expect(calculateSQALERating(0.50, thresholds)).toBe('D');
      });

      it('returns E for debt ratio > 50%', () => {
        expect(calculateSQALERating(0.51, thresholds)).toBe('E');
        expect(calculateSQALERating(0.80, thresholds)).toBe('E');
      });
    });
  });

  // =========================================================================
  // SRE METRICS VALIDATION TESTS
  // =========================================================================

  describe('SRE Metrics Validation', () => {
    const sreStandards: SREStandards = {
      slis: [],
      slos: [],
      errorBudgets: [
        {
          sloId: 'test-slo',
          burnRateAlerts: [
            { burnRate: 14.4, shortWindowMinutes: 5, longWindowMinutes: 60, severity: 'page', action: 'auto_rollback' },
            { burnRate: 6, shortWindowMinutes: 30, longWindowMinutes: 360, severity: 'page', action: 'freeze_deploys' },
          ],
          exhaustedPolicy: {
            freezeFeatureDeployments: true,
            requireAdditionalReview: true,
            prioritizeReliabilityWork: true,
          },
        },
      ],
      toil: {
        maxToilPercent: 50,
        quarterlyReductionTarget: 5,
        categories: [],
        requiresTracking: true,
        requiresAutomationProposals: true,
      },
    };

    it('reports violations for high toil percentage', () => {
      const violations = validateSREMetrics({ toilPercent: 60 }, sreStandards);
      expect(violations.some(v => v.field === 'toilPercent')).toBe(true);
    });

    it('reports error when error budget exhausted', () => {
      const violations = validateSREMetrics({ errorBudgetRemaining: 0 }, sreStandards);
      expect(violations.some(v => v.field === 'errorBudget' && v.severity === 'error')).toBe(true);
    });

    it('reports warning when error budget low', () => {
      const violations = validateSREMetrics({ errorBudgetRemaining: 0.15 }, sreStandards);
      expect(violations.some(v => v.field === 'errorBudget' && v.severity === 'warning')).toBe(true);
    });

    it('reports violations for high burn rate', () => {
      const violations = validateSREMetrics({ burnRate: 15 }, sreStandards);
      expect(violations.some(v => v.field === 'burnRate')).toBe(true);
    });

    it('returns no violations for healthy SRE metrics', () => {
      const violations = validateSREMetrics(
        {
          toilPercent: 30,
          errorBudgetRemaining: 0.8,
          burnRate: 1.0,
        },
        sreStandards
      );
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // ADVANCED CODE QUALITY VALIDATION TESTS
  // =========================================================================

  describe('Advanced Code Quality Validation', () => {
    const advancedStandards: AdvancedCodeQuality = {
      cognitiveComplexity: {
        maxPerFunction: 15,
        maxPerClass: 50,
        maxPerFile: 100,
        trackTrends: true,
        refactoringThreshold: 12,
      },
      packageCoupling: {
        afferentCoupling: { maxPerPackage: 20, warnThreshold: 15 },
        efferentCoupling: { maxPerPackage: 15, warnThreshold: 10 },
        instability: { requiresExtremity: true, maxDistanceFromSequence: 0.2 },
        abstractness: { corePackageTarget: 0.7, implPackageTarget: 0.2 },
        mainSequenceDistance: { maxDistance: 0.2, flagZoneOfPain: true, flagZoneOfUselessness: true },
      },
      technicalDebtRatio: {
        maxRatio: 0.05,
        targetRatio: 0.03,
        actionThresholdHours: 8,
        trackByCategory: true,
      },
      duplication: {
        maxDuplicatedLinesPercent: 3,
        maxDuplicatedBlocks: 5,
        minTokensForDetection: 50,
      },
      codeSmells: {
        maxBlockers: 0,
        maxCritical: 2,
        maxMajor: 10,
      },
    };

    it('reports violations for high cognitive complexity', () => {
      const violations = validateAdvancedCodeQuality(
        { cognitiveComplexity: 20 },
        advancedStandards
      );
      expect(violations.some(v => v.field === 'cognitiveComplexity')).toBe(true);
    });

    it('reports violations for main sequence distance', () => {
      const violations = validateAdvancedCodeQuality(
        { mainSequenceDistance: 0.5 },
        advancedStandards
      );
      expect(violations.some(v => v.field === 'mainSequenceDistance')).toBe(true);
    });

    it('reports violations for high technical debt ratio', () => {
      const violations = validateAdvancedCodeQuality(
        { technicalDebtRatio: 0.10 },
        advancedStandards
      );
      expect(violations.some(v => v.field === 'technicalDebtRatio')).toBe(true);
    });

    it('reports violations for code duplication', () => {
      const violations = validateAdvancedCodeQuality(
        { duplicatedLinesPercent: 10 },
        advancedStandards
      );
      expect(violations.some(v => v.field === 'duplicatedLinesPercent')).toBe(true);
    });

    it('reports violations for blocker code smells', () => {
      const violations = validateAdvancedCodeQuality(
        { codeSmells: { blocker: 1, critical: 0, major: 0 } },
        advancedStandards
      );
      expect(violations.some(v => v.field === 'codeSmells.blocker')).toBe(true);
    });

    it('reports violations for low test determinism', () => {
      const violations = validateAdvancedCodeQuality(
        { testDeterminismRate: 0.95 },
        advancedStandards
      );
      expect(violations.some(v => v.field === 'testDeterminismRate')).toBe(true);
    });

    it('returns no violations for excellent code quality', () => {
      const violations = validateAdvancedCodeQuality(
        {
          cognitiveComplexity: 8,
          mainSequenceDistance: 0.1,
          technicalDebtRatio: 0.02,
          duplicatedLinesPercent: 1,
          codeSmells: { blocker: 0, critical: 0, major: 5 },
          testDeterminismRate: 0.9999,
        },
        advancedStandards
      );
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET STANDARD BY ID TESTS (including world-class-plus)
  // =========================================================================

  describe('getStandardById with world-class-plus', () => {
    it('returns world-class-plus standard', () => {
      const standard = getStandardById('world-class-plus');
      expect(standard).toBe(WORLD_CLASS_PLUS_STANDARDS);
    });
  });
});
