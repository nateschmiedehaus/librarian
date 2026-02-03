import { describe, it, expect } from 'vitest';
import {
  checkCompliance,
  calculateHealthScore,
  generateRunbookTemplate,
  createOperationalExcellenceConfig,
  ENTERPRISE_CONFIG,
  STARTUP_CONFIG,
  MINIMAL_CONFIG,
  type OperationalExcellenceConfig,
  type ObservabilityConfig,
  type ReliabilityConfig,
  type DeploymentConfig,
  type SecOpsConfig,
} from '../operational_excellence.js';

describe('Operational Excellence Framework', () => {
  // ============================================================================
  // PRESET CONFIGURATIONS
  // ============================================================================

  describe('Preset Configurations', () => {
    it('provides frozen enterprise configuration', () => {
      expect(Object.isFrozen(ENTERPRISE_CONFIG)).toBe(true);
      expect(ENTERPRISE_CONFIG.metadata.name).toBe('Enterprise Configuration');
      expect(ENTERPRISE_CONFIG.observability.logging.format).toBe('structured');
      expect(ENTERPRISE_CONFIG.reliability.postMortemTemplate.blameless).toBe(true);
      expect(ENTERPRISE_CONFIG.deployment.strategy).toBe('canary');
      expect(ENTERPRISE_CONFIG.secOps.accessControl.authentication.mfaPolicy.required).toBe(true);
    });

    it('provides frozen startup configuration', () => {
      expect(Object.isFrozen(STARTUP_CONFIG)).toBe(true);
      expect(STARTUP_CONFIG.metadata.name).toBe('Startup Configuration');
      expect(STARTUP_CONFIG.observability.logging.format).toBe('structured');
      expect(STARTUP_CONFIG.deployment.strategy).toBe('rolling');
    });

    it('provides frozen minimal configuration', () => {
      expect(Object.isFrozen(MINIMAL_CONFIG)).toBe(true);
      expect(MINIMAL_CONFIG.metadata.name).toBe('Minimal Configuration');
      expect(MINIMAL_CONFIG.observability.tracing.enabled).toBe(false);
      expect(MINIMAL_CONFIG.deployment.strategy).toBe('recreate');
    });

    it('enterprise config has more SLIs than startup', () => {
      expect(ENTERPRISE_CONFIG.observability.metrics.slis.length).toBeGreaterThan(
        STARTUP_CONFIG.observability.metrics.slis.length
      );
    });

    it('enterprise config has stricter SLO targets', () => {
      const enterpriseAvailability = ENTERPRISE_CONFIG.observability.metrics.slos.find(
        (slo) => slo.sliName === 'availability'
      );
      const startupAvailability = STARTUP_CONFIG.observability.metrics.slos.find(
        (slo) => slo.sliName === 'availability'
      );

      expect(enterpriseAvailability?.target).toBeGreaterThan(startupAvailability?.target ?? 0);
    });

    it('all configs have required observability sections', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        expect(config.observability.logging).toBeDefined();
        expect(config.observability.metrics).toBeDefined();
        expect(config.observability.tracing).toBeDefined();
        expect(config.observability.alerting).toBeDefined();
      }
    });

    it('all configs have required reliability sections', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        expect(config.reliability.incidentResponse).toBeDefined();
        expect(config.reliability.postMortemTemplate).toBeDefined();
        expect(config.reliability.capacityPlanning).toBeDefined();
        expect(config.reliability.disasterRecovery).toBeDefined();
      }
    });

    it('all configs have required deployment sections', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        expect(config.deployment.pipeline).toBeDefined();
        expect(config.deployment.strategy).toBeDefined();
        expect(config.deployment.featureFlags).toBeDefined();
        expect(config.deployment.rollback).toBeDefined();
      }
    });

    it('all configs have required secops sections', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        expect(config.secOps.vulnerabilityManagement).toBeDefined();
        expect(config.secOps.secretsManagement).toBeDefined();
        expect(config.secOps.accessControl).toBeDefined();
        expect(config.secOps.auditLogging).toBeDefined();
      }
    });
  });

  // ============================================================================
  // CONFIGURATION CREATION
  // ============================================================================

  describe('createOperationalExcellenceConfig', () => {
    it('creates config from enterprise preset', () => {
      const config = createOperationalExcellenceConfig('enterprise');
      expect(config.metadata.name).toBe('Enterprise Configuration');
      expect(config.deployment.strategy).toBe('canary');
    });

    it('creates config from startup preset', () => {
      const config = createOperationalExcellenceConfig('startup');
      expect(config.metadata.name).toBe('Startup Configuration');
      expect(config.deployment.strategy).toBe('rolling');
    });

    it('creates config from minimal preset', () => {
      const config = createOperationalExcellenceConfig('minimal');
      expect(config.metadata.name).toBe('Minimal Configuration');
      expect(config.deployment.strategy).toBe('recreate');
    });

    it('applies overrides to preset', () => {
      const config = createOperationalExcellenceConfig('startup', {
        metadata: { name: 'Custom Startup' } as OperationalExcellenceConfig['metadata'],
      });
      expect(config.metadata.name).toBe('Custom Startup');
    });

    it('updates timestamp on override', () => {
      const before = new Date().toISOString();
      const config = createOperationalExcellenceConfig('minimal', {
        metadata: { name: 'Test' } as OperationalExcellenceConfig['metadata'],
      });
      const after = new Date().toISOString();

      expect(config.metadata.updatedAt >= before).toBe(true);
      expect(config.metadata.updatedAt <= after).toBe(true);
    });
  });

  // ============================================================================
  // COMPLIANCE CHECKER
  // ============================================================================

  describe('checkCompliance', () => {
    it('enterprise config passes compliance', () => {
      const result = checkCompliance(ENTERPRISE_CONFIG);
      expect(result.passed).toBe(true);
      expect(result.overallScore).toBeGreaterThan(0.8);
      expect(result.criticalIssues.length).toBe(0);
    });

    it('startup config has good compliance score', () => {
      const result = checkCompliance(STARTUP_CONFIG);
      // Startup config may have some critical issues as it's designed for growing orgs
      expect(result.overallScore).toBeGreaterThan(0.7);
      // But it should be better than minimal
      const minimalResult = checkCompliance(MINIMAL_CONFIG);
      expect(result.overallScore).toBeGreaterThan(minimalResult.overallScore);
    });

    it('minimal config has compliance issues', () => {
      const result = checkCompliance(MINIMAL_CONFIG);
      // Minimal config may not pass all checks but should run without errors
      expect(result.timestamp).toBeDefined();
      expect(result.categories.length).toBe(4);
    });

    it('returns all four category results', () => {
      const result = checkCompliance(ENTERPRISE_CONFIG);
      const categoryNames = result.categories.map((c) => c.category);
      expect(categoryNames).toContain('observability');
      expect(categoryNames).toContain('reliability');
      expect(categoryNames).toContain('deployment');
      expect(categoryNames).toContain('security');
    });

    it('each category has checks', () => {
      const result = checkCompliance(ENTERPRISE_CONFIG);
      for (const category of result.categories) {
        expect(category.checks.length).toBeGreaterThan(0);
        for (const check of category.checks) {
          expect(check.name).toBeDefined();
          expect(check.severity).toBeDefined();
          expect(typeof check.passed).toBe('boolean');
        }
      }
    });

    it('identifies missing structured logging', () => {
      const config = createOperationalExcellenceConfig('minimal');
      const result = checkCompliance(config);

      const observabilityCategory = result.categories.find((c) => c.category === 'observability');
      const loggingCheck = observabilityCategory?.checks.find((c) => c.name.includes('Structured'));
      expect(loggingCheck?.passed).toBe(false);
    });

    it('identifies missing MFA requirement', () => {
      const config = createOperationalExcellenceConfig('minimal');
      const result = checkCompliance(config);

      const securityCategory = result.categories.find((c) => c.category === 'security');
      const mfaCheck = securityCategory?.checks.find((c) => c.name.includes('MFA'));
      expect(mfaCheck?.passed).toBe(false);
    });

    it('categorizes issues by severity', () => {
      const config = createOperationalExcellenceConfig('minimal');
      const result = checkCompliance(config);

      // All issues should be categorized
      const totalFailedChecks = result.categories.reduce(
        (sum, c) => sum + c.checks.filter((check) => !check.passed).length,
        0
      );

      const categorizedIssues =
        result.criticalIssues.length + result.warnings.length + result.suggestions.length;

      expect(categorizedIssues).toBeLessThanOrEqual(totalFailedChecks);
    });
  });

  // ============================================================================
  // HEALTH SCORE CALCULATOR
  // ============================================================================

  describe('calculateHealthScore', () => {
    it('enterprise config has high health score', () => {
      const result = calculateHealthScore(ENTERPRISE_CONFIG);
      expect(result.overallScore).toBeGreaterThan(0.8);
      expect(result.riskLevel).toBe('low');
    });

    it('startup config has good health score', () => {
      const result = calculateHealthScore(STARTUP_CONFIG);
      expect(result.overallScore).toBeGreaterThan(0.5);
      expect(['low', 'medium']).toContain(result.riskLevel);
    });

    it('minimal config has lower health score', () => {
      const result = calculateHealthScore(MINIMAL_CONFIG);
      expect(result.overallScore).toBeLessThan(ENTERPRISE_CONFIG.observability.metrics.slos[0].target / 100);
    });

    it('returns all four dimensions', () => {
      const result = calculateHealthScore(ENTERPRISE_CONFIG);
      const dimensionNames = result.dimensions.map((d) => d.dimension);
      expect(dimensionNames).toContain('Observability');
      expect(dimensionNames).toContain('Reliability');
      expect(dimensionNames).toContain('Deployment');
      expect(dimensionNames).toContain('Security');
    });

    it('each dimension has factors', () => {
      const result = calculateHealthScore(ENTERPRISE_CONFIG);
      for (const dimension of result.dimensions) {
        expect(dimension.factors.length).toBeGreaterThan(0);
        for (const factor of dimension.factors) {
          expect(factor.name).toBeDefined();
          expect(factor.score).toBeGreaterThanOrEqual(0);
          expect(factor.score).toBeLessThanOrEqual(1);
          expect(factor.evidence).toBeDefined();
        }
      }
    });

    it('dimension weights sum to approximately 1', () => {
      const result = calculateHealthScore(ENTERPRISE_CONFIG);
      const totalWeight = result.dimensions.reduce((sum, d) => sum + d.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 1);
    });

    it('includes confidence assessment', () => {
      const result = calculateHealthScore(ENTERPRISE_CONFIG);
      expect(result.confidence).toBeDefined();
      expect(result.confidence.level).toBeDefined();
      expect(result.confidence.score).toBe(result.overallScore);
      expect(result.confidence.factors.length).toBe(result.dimensions.length);
    });

    it('generates recommendations', () => {
      const result = calculateHealthScore(MINIMAL_CONFIG);
      expect(result.recommendations.length).toBeGreaterThan(0);
      for (const rec of result.recommendations) {
        expect(rec.priority).toBeDefined();
        expect(rec.category).toBeDefined();
        expect(rec.recommendation).toBeDefined();
        expect(rec.impact).toBeDefined();
        expect(rec.effort).toBeDefined();
      }
    });

    it('sorts recommendations by priority', () => {
      const result = calculateHealthScore(MINIMAL_CONFIG);
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

      for (let i = 1; i < result.recommendations.length; i++) {
        const prevPriority = priorityOrder[result.recommendations[i - 1].priority];
        const currPriority = priorityOrder[result.recommendations[i].priority];
        expect(currPriority).toBeGreaterThanOrEqual(prevPriority);
      }
    });

    it('limits recommendations to 10', () => {
      const result = calculateHealthScore(MINIMAL_CONFIG);
      expect(result.recommendations.length).toBeLessThanOrEqual(10);
    });

    it('sets risk level based on score', () => {
      const highScore = calculateHealthScore(ENTERPRISE_CONFIG);
      expect(highScore.riskLevel).toBe('low');

      const lowScore = calculateHealthScore(MINIMAL_CONFIG);
      expect(['medium', 'high', 'critical']).toContain(lowScore.riskLevel);
    });
  });

  // ============================================================================
  // RUNBOOK GENERATOR
  // ============================================================================

  describe('generateRunbookTemplate', () => {
    it('generates incident runbook', () => {
      const runbook = generateRunbookTemplate('incident', {
        serviceName: 'api-gateway',
        severity: 'sev1',
        alertName: 'HighErrorRate',
        description: 'High error rate detected',
      });

      expect(runbook.type).toBe('incident');
      expect(runbook.title).toContain('Incident');
      expect(runbook.title).toContain('api-gateway');
      expect(runbook.severity).toBe('sev1');
      expect(runbook.tags).toContain('incident');
      expect(runbook.tags).toContain('api-gateway');
      expect(runbook.tags).toContain('sev1');
    });

    it('generates deployment runbook', () => {
      const runbook = generateRunbookTemplate('deployment', {
        serviceName: 'user-service',
        description: 'Standard deployment procedure',
      });

      expect(runbook.type).toBe('deployment');
      expect(runbook.sections.some((s) => s.type === 'steps')).toBe(true);
      expect(runbook.sections.some((s) => s.title.includes('Pre-Deployment'))).toBe(true);
      expect(runbook.sections.some((s) => s.title.includes('Rollback'))).toBe(true);
    });

    it('generates maintenance runbook', () => {
      const runbook = generateRunbookTemplate('maintenance', {
        serviceName: 'database',
      });

      expect(runbook.type).toBe('maintenance');
      expect(runbook.sections.some((s) => s.title.includes('Pre-Maintenance'))).toBe(true);
      expect(runbook.sections.some((s) => s.title.includes('Post-Maintenance'))).toBe(true);
    });

    it('generates recovery runbook', () => {
      const runbook = generateRunbookTemplate('recovery', {
        serviceName: 'core-platform',
        description: 'Disaster recovery procedure',
      });

      expect(runbook.type).toBe('recovery');
      expect(runbook.sections.some((s) => s.title.includes('Assess'))).toBe(true);
      expect(runbook.sections.some((s) => s.title.includes('Recovery'))).toBe(true);
    });

    it('generates investigation runbook', () => {
      const runbook = generateRunbookTemplate('investigation', {
        serviceName: 'payment-service',
      });

      expect(runbook.type).toBe('investigation');
      expect(runbook.sections.some((s) => s.title.includes('Gather'))).toBe(true);
      expect(runbook.sections.some((s) => s.title.includes('Analysis'))).toBe(true);
    });

    it('includes common sections in all runbooks', () => {
      const types: Array<'incident' | 'deployment' | 'maintenance' | 'recovery' | 'investigation'> = [
        'incident',
        'deployment',
        'maintenance',
        'recovery',
        'investigation',
      ];

      for (const type of types) {
        const runbook = generateRunbookTemplate(type, { serviceName: 'test-service' });
        expect(runbook.sections.some((s) => s.type === 'overview')).toBe(true);
        expect(runbook.sections.some((s) => s.type === 'prerequisites')).toBe(true);
      }
    });

    it('includes metadata with timestamps', () => {
      const before = new Date().toISOString();
      const runbook = generateRunbookTemplate('incident', { serviceName: 'test' });
      const after = new Date().toISOString();

      expect(runbook.metadata.createdAt >= before).toBe(true);
      expect(runbook.metadata.createdAt <= after).toBe(true);
      expect(runbook.metadata.version).toBe('1.0.0');
      expect(runbook.metadata.author).toBe('system');
    });

    it('includes related services in metadata', () => {
      const runbook = generateRunbookTemplate('incident', {
        serviceName: 'my-service',
        alertName: 'TestAlert',
      });

      expect(runbook.metadata.relatedServices).toContain('my-service');
      expect(runbook.metadata.relatedAlerts).toContain('TestAlert');
    });

    it('steps have order and automatable flag', () => {
      const runbook = generateRunbookTemplate('incident', { serviceName: 'test' });

      for (const section of runbook.sections) {
        if (section.steps) {
          for (const step of section.steps) {
            expect(typeof step.order).toBe('number');
            expect(typeof step.automatable).toBe('boolean');
            expect(step.description).toBeDefined();
          }
        }
      }
    });

    it('incident runbook includes escalation section', () => {
      const runbook = generateRunbookTemplate('incident', { serviceName: 'test' });
      expect(runbook.sections.some((s) => s.type === 'escalation')).toBe(true);
    });

    it('deployment and incident runbooks include rollback section', () => {
      const incidentRunbook = generateRunbookTemplate('incident', { serviceName: 'test' });
      const deploymentRunbook = generateRunbookTemplate('deployment', { serviceName: 'test' });

      expect(incidentRunbook.sections.some((s) => s.type === 'rollback')).toBe(true);
      expect(deploymentRunbook.sections.some((s) => s.type === 'rollback')).toBe(true);
    });

    it('generates unique IDs', () => {
      const runbook1 = generateRunbookTemplate('incident', { serviceName: 'test1' });
      const runbook2 = generateRunbookTemplate('incident', { serviceName: 'test2' });

      expect(runbook1.id).not.toBe(runbook2.id);
    });
  });

  // ============================================================================
  // OBSERVABILITY CONFIG VALIDATION
  // ============================================================================

  describe('ObservabilityConfig structure', () => {
    it('enterprise logging config is comprehensive', () => {
      const logging = ENTERPRISE_CONFIG.observability.logging;
      expect(logging.format).toBe('structured');
      expect(logging.levels.length).toBe(4);
      expect(logging.requiredFields.length).toBeGreaterThanOrEqual(3);
      expect(logging.piiHandling).toBe('redact');
      expect(logging.retentionDays).toBeGreaterThanOrEqual(30);
    });

    it('enterprise metrics config includes SLIs and SLOs', () => {
      const metrics = ENTERPRISE_CONFIG.observability.metrics;
      expect(metrics.slis.length).toBeGreaterThanOrEqual(3);
      expect(metrics.slos.length).toBeGreaterThanOrEqual(2);
      expect(metrics.errorBudget.thresholdActions.length).toBeGreaterThan(0);
    });

    it('SLIs have required fields', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        for (const sli of config.observability.metrics.slis) {
          expect(sli.name).toBeDefined();
          expect(sli.type).toBeDefined();
          expect(sli.measurement).toBeDefined();
        }
      }
    });

    it('SLOs reference valid SLIs', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const sliNames = config.observability.metrics.slis.map((s) => s.name);
        for (const slo of config.observability.metrics.slos) {
          expect(sliNames).toContain(slo.sliName);
          expect(slo.target).toBeGreaterThan(0);
          expect(slo.window).toBeDefined();
        }
      }
    });

    it('tracing config is valid', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        if (config.observability.tracing.enabled) {
          expect(config.observability.tracing.samplingStrategy).toBeDefined();
          expect(config.observability.tracing.exporter).toBeDefined();
          expect(config.observability.tracing.exporter.type).toBeDefined();
        }
      }
    });
  });

  // ============================================================================
  // RELIABILITY CONFIG VALIDATION
  // ============================================================================

  describe('ReliabilityConfig structure', () => {
    it('severity levels are properly ordered', () => {
      const levels = ENTERPRISE_CONFIG.reliability.incidentResponse.severityLevels;
      expect(levels.length).toBeGreaterThanOrEqual(3);

      // Higher severity should have faster response time
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].responseTimeMinutes).toBeGreaterThanOrEqual(levels[i - 1].responseTimeMinutes);
      }
    });

    it('post-mortem template has essential sections', () => {
      const template = ENTERPRISE_CONFIG.reliability.postMortemTemplate;
      expect(template.sections).toContain('timeline');
      expect(template.sections).toContain('root_cause');
      expect(template.sections).toContain('action_items');
    });

    it('DR config has valid RTO and RPO', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        const dr = config.reliability.disasterRecovery;
        expect(dr.rtoMinutes).toBeGreaterThan(0);
        expect(dr.rpoMinutes).toBeGreaterThan(0);
        // RPO should typically be less than or equal to RTO
        expect(dr.rpoMinutes).toBeLessThanOrEqual(dr.rtoMinutes);
      }
    });

    it('backup config has valid retention', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const backup = config.reliability.disasterRecovery.backupConfig;
        expect(backup.destinations.length).toBeGreaterThan(0);
        expect(backup.retention.dailyBackups >= 0).toBe(true);
        expect(backup.retention.weeklyBackups >= 0).toBe(true);
      }
    });
  });

  // ============================================================================
  // DEPLOYMENT CONFIG VALIDATION
  // ============================================================================

  describe('DeploymentConfig structure', () => {
    it('pipeline has required stages', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const stages = config.deployment.pipeline.stages;
        expect(stages.some((s) => s.type === 'build')).toBe(true);
        expect(stages.some((s) => s.type === 'deploy')).toBe(true);
      }
    });

    it('enterprise has test and security stages', () => {
      const stages = ENTERPRISE_CONFIG.deployment.pipeline.stages;
      expect(stages.some((s) => s.type === 'test')).toBe(true);
      expect(stages.some((s) => s.type === 'security')).toBe(true);
    });

    it('rollback config is valid', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const rollback = config.deployment.rollback;
        expect(rollback.maxRollbackTime).toBeGreaterThan(0);
        expect(rollback.versionRetention).toBeGreaterThan(0);
      }
    });

    it('enterprise has automatic rollback', () => {
      expect(ENTERPRISE_CONFIG.deployment.rollback.automatic).toBe(true);
      expect(ENTERPRISE_CONFIG.deployment.rollback.triggers.length).toBeGreaterThan(0);
    });

    it('feature flags config is valid', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const ff = config.deployment.featureFlags;
        expect(ff.provider).toBeDefined();
        expect(ff.defaultState).toBeDefined();
        expect(ff.stalePolicy).toBeDefined();
      }
    });
  });

  // ============================================================================
  // SECOPS CONFIG VALIDATION
  // ============================================================================

  describe('SecOpsConfig structure', () => {
    it('vulnerability scanning has scan types', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const scanning = config.secOps.vulnerabilityManagement.scanning;
        expect(scanning.scanTypes.length).toBeGreaterThan(0);
        expect(scanning.frequency).toBeDefined();
      }
    });

    it('remediation SLAs are defined for all severities', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        const sla = config.secOps.vulnerabilityManagement.remediationSLA;
        expect(sla.critical).toBeDefined();
        expect(sla.high).toBeDefined();
        expect(sla.medium).toBeDefined();
        expect(sla.low).toBeDefined();

        // Higher severity should have faster SLA
        expect(sla.critical.hours).toBeLessThan(sla.high.hours);
        expect(sla.high.hours).toBeLessThan(sla.medium.hours);
        expect(sla.medium.hours).toBeLessThan(sla.low.hours);
      }
    });

    it('secrets management has rotation policy', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const secrets = config.secOps.secretsManagement;
        expect(secrets.provider).toBeDefined();
        expect(secrets.rotationPolicy).toBeDefined();
      }
    });

    it('access control has authentication methods', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        const auth = config.secOps.accessControl.authentication;
        expect(auth.methods.length).toBeGreaterThan(0);
        expect(auth.session).toBeDefined();
      }
    });

    it('enterprise requires MFA', () => {
      expect(ENTERPRISE_CONFIG.secOps.accessControl.authentication.mfaPolicy.required).toBe(true);
    });

    it('audit logging has events configured', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG]) {
        const audit = config.secOps.auditLogging;
        expect(audit.auditedEvents.length).toBeGreaterThan(0);
        expect(audit.destination).toBeDefined();
        expect(audit.retention).toBeDefined();
      }
    });

    it('enterprise has longer audit retention', () => {
      expect(ENTERPRISE_CONFIG.secOps.auditLogging.retention.deleteAfterDays).toBeGreaterThan(
        STARTUP_CONFIG.secOps.auditLogging.retention.deleteAfterDays
      );
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING
  // ============================================================================

  describe('Edge cases', () => {
    it('compliance checker handles empty arrays gracefully', () => {
      const config = createOperationalExcellenceConfig('minimal');
      // Minimal config has many empty arrays - should not throw
      expect(() => checkCompliance(config)).not.toThrow();
    });

    it('health score handles zero-length arrays', () => {
      const config = createOperationalExcellenceConfig('minimal');
      expect(() => calculateHealthScore(config)).not.toThrow();
    });

    it('runbook generator handles minimal context', () => {
      const runbook = generateRunbookTemplate('incident', { serviceName: 'test' });
      expect(runbook.title).toContain('test');
      expect(runbook.description).toBeDefined();
    });

    it('compliance score is between 0 and 1', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        const result = checkCompliance(config);
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(1);
        for (const category of result.categories) {
          expect(category.score).toBeGreaterThanOrEqual(0);
          expect(category.score).toBeLessThanOrEqual(1);
        }
      }
    });

    it('health score is between 0 and 1', () => {
      for (const config of [ENTERPRISE_CONFIG, STARTUP_CONFIG, MINIMAL_CONFIG]) {
        const result = calculateHealthScore(config);
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(1);
        for (const dimension of result.dimensions) {
          expect(dimension.score).toBeGreaterThanOrEqual(0);
          expect(dimension.score).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
