import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type ProjectTemplateType,
  type ProjectTemplate,
  type FeatureDevelopmentTemplate,
  type BugInvestigationTemplate,
  type RefactoringTemplate,
  type ResearchTemplate,
  type QualityGate,
  type QualityGateRequirement,
  type Deliverable,
  type RollbackTrigger,
  type EvidenceRequirement,
  type ConfidenceRule,
  type TimeoutProcedure,
  type BreakingChangeProtocol,
  type OrderingRule,
  type CoverageRequirement,
  type UncertaintyConfig,
  type DeadEndConfig,
  type CaptureConfig,
  type TemplateContext,
  type TemplateResult,

  // Standard templates
  FEATURE_DEVELOPMENT_TEMPLATE,
  BUG_INVESTIGATION_TEMPLATE,
  REFACTORING_TEMPLATE,
  RESEARCH_TEMPLATE,

  // Factory functions
  getTemplate,
  listTemplateTypes,
  createFromTemplate,
  createFeatureDevelopmentTemplate,
  createBugInvestigationTemplate,
  createRefactoringTemplate,
  createResearchTemplate,

  // Validators
  validateQualityGate,
  validateDeliverable,
  validateTemplate,

  // Utility functions
  getGatesForPhase,
  getDeliverablesForPhase,
  hasBlockingGatesForPhase,
  getMandatoryRequirements,
  getTemplateStats,
  templateHasPhase,
  getNextPhase,
  getPreviousPhase,
} from '../project_templates.js';

describe('project_templates', () => {
  // ============================================================================
  // STANDARD TEMPLATES TESTS
  // ============================================================================

  describe('standard templates', () => {
    describe('FEATURE_DEVELOPMENT_TEMPLATE', () => {
      it('has all required fields', () => {
        expect(FEATURE_DEVELOPMENT_TEMPLATE.id).toBe('feature-development-standard');
        expect(FEATURE_DEVELOPMENT_TEMPLATE.type).toBe('feature_development');
        expect(FEATURE_DEVELOPMENT_TEMPLATE.name).toBe('Feature Development');
        expect(FEATURE_DEVELOPMENT_TEMPLATE.version).toBe('1.0.0');
      });

      it('has correct phases', () => {
        expect(FEATURE_DEVELOPMENT_TEMPLATE.phases).toEqual([
          'research',
          'design',
          'implement',
          'test',
          'document',
        ]);
      });

      it('has quality gates for all phase transitions', () => {
        const gates = FEATURE_DEVELOPMENT_TEMPLATE.qualityGates;
        expect(gates.length).toBeGreaterThanOrEqual(4);

        // Check each phase transition has a gate
        expect(gates.some(g => g.targetPhase === 'design')).toBe(true);
        expect(gates.some(g => g.targetPhase === 'implement')).toBe(true);
        expect(gates.some(g => g.targetPhase === 'test')).toBe(true);
        expect(gates.some(g => g.targetPhase === 'document')).toBe(true);
      });

      it('has rollback triggers', () => {
        expect(FEATURE_DEVELOPMENT_TEMPLATE.rollbackTriggers.length).toBeGreaterThan(0);

        const triggerTypes = FEATURE_DEVELOPMENT_TEMPLATE.rollbackTriggers.map(t => t.type);
        expect(triggerTypes).toContain('test_failure');
        expect(triggerTypes).toContain('error_rate_spike');
      });

      it('has deliverables for each phase', () => {
        const deliverables = FEATURE_DEVELOPMENT_TEMPLATE.deliverables;
        expect(deliverables.length).toBeGreaterThanOrEqual(5);

        const phases = FEATURE_DEVELOPMENT_TEMPLATE.phases;
        for (const phase of phases) {
          expect(deliverables.some(d => d.phase === phase)).toBe(true);
        }
      });

      it('has acceptance criteria templates', () => {
        const criteria = FEATURE_DEVELOPMENT_TEMPLATE.acceptanceCriteria;
        expect(criteria.default.length).toBeGreaterThan(0);
        expect(criteria.optional.length).toBeGreaterThan(0);
        expect(criteria.customPlaceholders.length).toBeGreaterThan(0);
      });

      it('has feature flags configuration', () => {
        expect(FEATURE_DEVELOPMENT_TEMPLATE.featureFlags).toBeDefined();
        expect(FEATURE_DEVELOPMENT_TEMPLATE.featureFlags?.required).toBe(true);
        expect(FEATURE_DEVELOPMENT_TEMPLATE.featureFlags?.defaultLifetimeDays).toBe(30);
      });

      it('validates successfully', () => {
        const result = validateTemplate(FEATURE_DEVELOPMENT_TEMPLATE);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('BUG_INVESTIGATION_TEMPLATE', () => {
      it('has all required fields', () => {
        expect(BUG_INVESTIGATION_TEMPLATE.id).toBe('bug-investigation-standard');
        expect(BUG_INVESTIGATION_TEMPLATE.type).toBe('bug_investigation');
        expect(BUG_INVESTIGATION_TEMPLATE.name).toBe('Bug Investigation');
      });

      it('has correct phases', () => {
        expect(BUG_INVESTIGATION_TEMPLATE.phases).toEqual([
          'triage',
          'reproduce',
          'root_cause',
          'fix',
          'verify',
        ]);
      });

      it('has evidence requirements for each phase', () => {
        const requirements = BUG_INVESTIGATION_TEMPLATE.evidenceRequirements;
        expect(requirements.length).toBeGreaterThanOrEqual(5);

        const phases = BUG_INVESTIGATION_TEMPLATE.phases;
        for (const phase of phases) {
          expect(requirements.some(r => r.phase === phase)).toBe(true);
        }
      });

      it('has confidence escalation rules', () => {
        const rules = BUG_INVESTIGATION_TEMPLATE.confidenceEscalation;
        expect(rules.length).toBeGreaterThan(0);

        // Check for different actions
        const actions = rules.map(r => r.belowThresholdAction);
        expect(actions).toContain('escalate');
        expect(actions).toContain('block');
      });

      it('has timeout procedures', () => {
        const procedures = BUG_INVESTIGATION_TEMPLATE.timeoutProcedures;
        expect(procedures.length).toBeGreaterThan(0);

        // Check phases have timeout procedures
        expect(procedures.some(p => p.phase === 'triage')).toBe(true);
        expect(procedures.some(p => p.phase === 'reproduce')).toBe(true);
      });

      it('has severity SLA configuration', () => {
        const sla = BUG_INVESTIGATION_TEMPLATE.severitySLA;
        expect(sla).toBeDefined();
        expect(sla?.critical.responseMinutes).toBeLessThan(sla?.high.responseMinutes ?? 0);
        expect(sla?.high.resolutionHours).toBeLessThan(sla?.medium.resolutionHours ?? 0);
      });

      it('validates successfully', () => {
        const result = validateTemplate(BUG_INVESTIGATION_TEMPLATE);
        expect(result.valid).toBe(true);
      });
    });

    describe('REFACTORING_TEMPLATE', () => {
      it('has all required fields', () => {
        expect(REFACTORING_TEMPLATE.id).toBe('refactoring-standard');
        expect(REFACTORING_TEMPLATE.type).toBe('refactoring');
        expect(REFACTORING_TEMPLATE.name).toBe('Refactoring');
      });

      it('has correct phases', () => {
        expect(REFACTORING_TEMPLATE.phases).toEqual([
          'impact_analysis',
          'safety_check',
          'incremental_change',
          'regression_test',
        ]);
      });

      it('has breaking change protocols', () => {
        const protocols = REFACTORING_TEMPLATE.breakingChangeProtocols;
        expect(protocols.length).toBeGreaterThan(0);

        const changeTypes = protocols.map(p => p.changeType);
        expect(changeTypes).toContain('api');
        expect(changeTypes).toContain('data');
        expect(changeTypes).toContain('behavior');
      });

      it('has rollback-safe ordering rules', () => {
        const rules = REFACTORING_TEMPLATE.rollbackSafeOrdering;
        expect(rules.length).toBeGreaterThan(0);

        // Check for common patterns
        expect(rules.some(r => r.id === 'test-before-code')).toBe(true);
        expect(rules.some(r => r.id === 'add-before-remove')).toBe(true);
      });

      it('has test coverage requirements', () => {
        const requirements = REFACTORING_TEMPLATE.testCoverageRequirements;
        expect(requirements.length).toBeGreaterThan(0);

        const coverageTypes = requirements.map(r => r.coverageType);
        expect(coverageTypes).toContain('line');
        expect(coverageTypes).toContain('branch');
      });

      it('has rollback procedures', () => {
        const procedures = REFACTORING_TEMPLATE.rollbackProcedures;
        expect(procedures.length).toBeGreaterThan(0);
        expect(procedures[0].steps.length).toBeGreaterThan(0);
      });

      it('has max batch size configuration', () => {
        expect(REFACTORING_TEMPLATE.maxBatchSize).toBeDefined();
        expect(REFACTORING_TEMPLATE.maxBatchSize?.files).toBeGreaterThan(0);
        expect(REFACTORING_TEMPLATE.maxBatchSize?.linesChanged).toBeGreaterThan(0);
      });

      it('validates successfully', () => {
        const result = validateTemplate(REFACTORING_TEMPLATE);
        expect(result.valid).toBe(true);
      });
    });

    describe('RESEARCH_TEMPLATE', () => {
      it('has all required fields', () => {
        expect(RESEARCH_TEMPLATE.id).toBe('research-standard');
        expect(RESEARCH_TEMPLATE.type).toBe('research');
        expect(RESEARCH_TEMPLATE.name).toBe('Research/Exploration');
      });

      it('has correct phases', () => {
        expect(RESEARCH_TEMPLATE.phases).toEqual([
          'hypothesis',
          'investigate',
          'synthesize',
          'report',
        ]);
      });

      it('has uncertainty tracking configuration', () => {
        const config = RESEARCH_TEMPLATE.uncertaintyTracking;
        expect(config.initialLevel).toBeGreaterThan(0);
        expect(config.investigationThreshold).toBeLessThan(config.initialLevel);
        expect(config.acceptanceThreshold).toBeLessThan(config.investigationThreshold);
        expect(config.reducingFactors.length).toBeGreaterThan(0);
        expect(config.increasingFactors.length).toBeGreaterThan(0);
      });

      it('has dead end documentation configuration', () => {
        const config = RESEARCH_TEMPLATE.deadEndDocumentation;
        expect(config.required).toBe(true);
        expect(config.template).toBeDefined();
        expect(config.minFields.length).toBeGreaterThan(0);
        expect(config.tag).toBe('dead-end');
      });

      it('has knowledge capture configuration', () => {
        const config = RESEARCH_TEMPLATE.knowledgeCapture;
        expect(config.captureTypes.length).toBeGreaterThan(0);
        expect(config.requiredMetadata.length).toBeGreaterThan(0);
        expect(config.storageLocation).toBeDefined();
      });

      it('has hypothesis templates', () => {
        const templates = RESEARCH_TEMPLATE.hypothesisTemplates;
        expect(templates.length).toBeGreaterThan(0);
        expect(templates[0].statement).toContain('{');
        expect(templates[0].variables.length).toBeGreaterThan(0);
      });

      it('has time boxing configuration', () => {
        expect(RESEARCH_TEMPLATE.timeBoxing).toBeDefined();
        expect(RESEARCH_TEMPLATE.timeBoxing?.maxTotalHours).toBeGreaterThan(0);
        expect(RESEARCH_TEMPLATE.timeBoxing?.checkpointIntervalHours).toBeGreaterThan(0);
      });

      it('validates successfully', () => {
        const result = validateTemplate(RESEARCH_TEMPLATE);
        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // FACTORY FUNCTIONS TESTS
  // ============================================================================

  describe('factory functions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('getTemplate', () => {
      it('returns feature development template', () => {
        const template = getTemplate('feature_development');
        expect(template).toBe(FEATURE_DEVELOPMENT_TEMPLATE);
      });

      it('returns bug investigation template', () => {
        const template = getTemplate('bug_investigation');
        expect(template).toBe(BUG_INVESTIGATION_TEMPLATE);
      });

      it('returns refactoring template', () => {
        const template = getTemplate('refactoring');
        expect(template).toBe(REFACTORING_TEMPLATE);
      });

      it('returns research template', () => {
        const template = getTemplate('research');
        expect(template).toBe(RESEARCH_TEMPLATE);
      });
    });

    describe('listTemplateTypes', () => {
      it('returns all template types', () => {
        const types = listTemplateTypes();
        expect(types).toContain('feature_development');
        expect(types).toContain('bug_investigation');
        expect(types).toContain('refactoring');
        expect(types).toContain('research');
        expect(types).toHaveLength(4);
      });
    });

    describe('createFromTemplate', () => {
      it('creates from feature development template', () => {
        const context: TemplateContext = {
          name: 'Add user authentication',
          description: 'Implement OAuth2 authentication',
          priority: 'high',
          assignee: 'dev-1',
          tags: ['auth', 'security'],
        };

        const result = createFromTemplate('feature_development', context);

        expect(result.templateType).toBe('feature_development');
        expect(result.phases).toEqual(FEATURE_DEVELOPMENT_TEMPLATE.phases);
        expect(result.qualityGates.length).toBeGreaterThan(0);
        expect(result.deliverables.length).toBeGreaterThan(0);
        expect(result.acceptanceCriteria.length).toBeGreaterThan(0);
        expect(result.createdAt).toBe('2026-01-29T12:00:00.000Z');
      });

      it('creates from bug investigation template', () => {
        const context: TemplateContext = {
          name: 'Fix login timeout',
          priority: 'critical',
        };

        const result = createFromTemplate('bug_investigation', context);

        expect(result.templateType).toBe('bug_investigation');
        expect(result.phases).toEqual(BUG_INVESTIGATION_TEMPLATE.phases);
      });

      it('creates from refactoring template', () => {
        const context: TemplateContext = {
          name: 'Refactor auth module',
        };

        const result = createFromTemplate('refactoring', context);

        expect(result.templateType).toBe('refactoring');
        expect(result.phases).toEqual(REFACTORING_TEMPLATE.phases);
      });

      it('creates from research template', () => {
        const context: TemplateContext = {
          name: 'Evaluate new database',
        };

        const result = createFromTemplate('research', context);

        expect(result.templateType).toBe('research');
        expect(result.phases).toEqual(RESEARCH_TEMPLATE.phases);
      });

      it('adds warnings for missing optional fields', () => {
        const context: TemplateContext = {
          name: 'Test feature',
        };

        const result = createFromTemplate('feature_development', context);

        expect(result.warnings).toContain('No assignee specified');
        expect(result.warnings).toContain('No priority specified, using default');
      });

      it('includes additional criteria from context', () => {
        const context: TemplateContext = {
          name: 'Test feature',
          additionalCriteria: ['Custom criterion 1', 'Custom criterion 2'],
        };

        const result = createFromTemplate('feature_development', context);

        const customCriteria = result.acceptanceCriteria.filter(c =>
          c.id.startsWith('custom-')
        );
        expect(customCriteria).toHaveLength(2);
      });

      it('uses phase overrides from context', () => {
        const context: TemplateContext = {
          name: 'Quick feature',
          phases: ['implement', 'test'],
        };

        const result = createFromTemplate('feature_development', context);

        expect(result.phases).toEqual(['implement', 'test']);
      });

      it('generates unique IDs', () => {
        const context: TemplateContext = { name: 'Test' };

        const result1 = createFromTemplate('feature_development', context);
        const result2 = createFromTemplate('feature_development', context);

        expect(result1.id).not.toBe(result2.id);
      });
    });

    describe('createFeatureDevelopmentTemplate', () => {
      it('creates custom template with overrides', () => {
        const template = createFeatureDevelopmentTemplate({
          id: 'custom-feature',
          name: 'Custom Feature Template',
          defaultComplexity: 'complex',
        });

        expect(template.id).toBe('custom-feature');
        expect(template.name).toBe('Custom Feature Template');
        expect(template.type).toBe('feature_development');
        expect(template.defaultComplexity).toBe('complex');
        expect(template.phases).toEqual(FEATURE_DEVELOPMENT_TEMPLATE.phases);
      });

      it('preserves base template structure', () => {
        const template = createFeatureDevelopmentTemplate({
          id: 'minimal',
          name: 'Minimal',
        });

        expect(template.qualityGates).toEqual(FEATURE_DEVELOPMENT_TEMPLATE.qualityGates);
        expect(template.deliverables).toEqual(FEATURE_DEVELOPMENT_TEMPLATE.deliverables);
      });
    });

    describe('createBugInvestigationTemplate', () => {
      it('creates custom template with overrides', () => {
        const template = createBugInvestigationTemplate({
          id: 'custom-bug',
          name: 'Custom Bug Template',
          severitySLA: {
            critical: { responseMinutes: 5, resolutionHours: 1 },
            high: { responseMinutes: 30, resolutionHours: 8 },
            medium: { responseMinutes: 120, resolutionHours: 48 },
            low: { responseMinutes: 240, resolutionHours: 120 },
          },
        });

        expect(template.id).toBe('custom-bug');
        expect(template.type).toBe('bug_investigation');
        expect(template.severitySLA?.critical.responseMinutes).toBe(5);
      });
    });

    describe('createRefactoringTemplate', () => {
      it('creates custom template with overrides', () => {
        const template = createRefactoringTemplate({
          id: 'custom-refactoring',
          name: 'Custom Refactoring Template',
          maxBatchSize: { files: 5, linesChanged: 200 },
        });

        expect(template.id).toBe('custom-refactoring');
        expect(template.type).toBe('refactoring');
        expect(template.maxBatchSize?.files).toBe(5);
      });
    });

    describe('createResearchTemplate', () => {
      it('creates custom template with overrides', () => {
        const template = createResearchTemplate({
          id: 'custom-research',
          name: 'Custom Research Template',
          timeBoxing: {
            maxTotalHours: 80,
            checkpointIntervalHours: 16,
            extensionPolicy: 'automatic',
          },
        });

        expect(template.id).toBe('custom-research');
        expect(template.type).toBe('research');
        expect(template.timeBoxing?.maxTotalHours).toBe(80);
      });
    });
  });

  // ============================================================================
  // VALIDATOR TESTS
  // ============================================================================

  describe('validators', () => {
    describe('validateQualityGate', () => {
      it('validates valid gate', () => {
        const gate: QualityGate = {
          id: 'test-gate',
          name: 'Test Gate',
          targetPhase: 'implement',
          blocking: true,
          requirements: [
            {
              id: 'req-1',
              description: 'Test requirement',
              verification: 'manual',
              severity: 'critical',
              mandatory: true,
            },
          ],
        };

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('rejects gate without id', () => {
        const gate = {
          id: '',
          name: 'Test Gate',
          targetPhase: 'implement',
          blocking: true,
          requirements: [],
        } as QualityGate;

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'missing_id')).toBe(true);
      });

      it('rejects gate without name', () => {
        const gate = {
          id: 'test',
          name: '',
          targetPhase: 'implement',
          blocking: true,
          requirements: [],
        } as QualityGate;

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'missing_name')).toBe(true);
      });

      it('rejects gate without target phase', () => {
        const gate = {
          id: 'test',
          name: 'Test',
          targetPhase: '',
          blocking: true,
          requirements: [],
        } as QualityGate;

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'missing_target_phase')).toBe(true);
      });

      it('warns about empty requirements', () => {
        const gate: QualityGate = {
          id: 'test',
          name: 'Test',
          targetPhase: 'implement',
          blocking: true,
          requirements: [],
        };

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('validates requirements within gate', () => {
        const gate: QualityGate = {
          id: 'test',
          name: 'Test',
          targetPhase: 'implement',
          blocking: true,
          requirements: [
            {
              id: '',
              description: '',
              verification: 'manual',
              severity: 'critical',
              mandatory: true,
            },
          ],
        };

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('validateDeliverable', () => {
      it('validates valid deliverable', () => {
        const deliverable: Deliverable = {
          id: 'test-deliverable',
          name: 'Test Deliverable',
          type: 'code',
          description: 'Test description',
          phase: 'implement',
          mandatory: true,
          acceptanceCriteria: ['Criterion 1'],
        };

        const result = validateDeliverable(deliverable);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('rejects deliverable without id', () => {
        const deliverable = {
          id: '',
          name: 'Test',
          type: 'code',
          description: 'Test',
          phase: 'implement',
          mandatory: true,
          acceptanceCriteria: [],
        } as Deliverable;

        const result = validateDeliverable(deliverable);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'missing_id')).toBe(true);
      });

      it('rejects invalid deliverable type', () => {
        const deliverable = {
          id: 'test',
          name: 'Test',
          type: 'invalid' as any,
          description: 'Test',
          phase: 'implement',
          mandatory: true,
          acceptanceCriteria: [],
        } as Deliverable;

        const result = validateDeliverable(deliverable);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'invalid_type')).toBe(true);
      });

      it('warns about missing acceptance criteria', () => {
        const deliverable: Deliverable = {
          id: 'test',
          name: 'Test',
          type: 'code',
          description: 'Test',
          phase: 'implement',
          mandatory: true,
          acceptanceCriteria: [],
        };

        const result = validateDeliverable(deliverable);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });

    describe('validateTemplate', () => {
      it('validates all standard templates', () => {
        expect(validateTemplate(FEATURE_DEVELOPMENT_TEMPLATE).valid).toBe(true);
        expect(validateTemplate(BUG_INVESTIGATION_TEMPLATE).valid).toBe(true);
        expect(validateTemplate(REFACTORING_TEMPLATE).valid).toBe(true);
        expect(validateTemplate(RESEARCH_TEMPLATE).valid).toBe(true);
      });

      it('rejects template without id', () => {
        const template = {
          ...FEATURE_DEVELOPMENT_TEMPLATE,
          id: '',
        };

        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'missing_id')).toBe(true);
      });

      it('rejects template without phases', () => {
        const template = {
          ...FEATURE_DEVELOPMENT_TEMPLATE,
          phases: [] as readonly [],
        };

        const result = validateTemplate(template as unknown as ProjectTemplate);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'no_phases')).toBe(true);
      });

      it('collects errors from nested gates', () => {
        const template = {
          ...FEATURE_DEVELOPMENT_TEMPLATE,
          qualityGates: [
            {
              id: '',
              name: '',
              targetPhase: '',
              blocking: true,
              requirements: [],
            },
          ],
        };

        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS TESTS
  // ============================================================================

  describe('utility functions', () => {
    describe('getGatesForPhase', () => {
      it('returns gates for existing phase', () => {
        const gates = getGatesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'implement');
        expect(gates.length).toBeGreaterThan(0);
        expect(gates.every(g => g.targetPhase === 'implement')).toBe(true);
      });

      it('returns empty array for non-existent phase', () => {
        const gates = getGatesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'nonexistent');
        expect(gates).toEqual([]);
      });
    });

    describe('getDeliverablesForPhase', () => {
      it('returns deliverables for existing phase', () => {
        const deliverables = getDeliverablesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'implement');
        expect(deliverables.length).toBeGreaterThan(0);
        expect(deliverables.every(d => d.phase === 'implement')).toBe(true);
      });

      it('returns empty array for non-existent phase', () => {
        const deliverables = getDeliverablesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'nonexistent');
        expect(deliverables).toEqual([]);
      });

      it('handles templates without deliverables', () => {
        const deliverables = getDeliverablesForPhase(BUG_INVESTIGATION_TEMPLATE, 'triage');
        expect(deliverables).toEqual([]);
      });
    });

    describe('hasBlockingGatesForPhase', () => {
      it('returns true for phases with blocking gates', () => {
        expect(hasBlockingGatesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'implement')).toBe(true);
        expect(hasBlockingGatesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'test')).toBe(true);
      });

      it('returns false for non-existent phases', () => {
        expect(hasBlockingGatesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'nonexistent')).toBe(false);
      });
    });

    describe('getMandatoryRequirements', () => {
      it('returns all mandatory requirements', () => {
        const requirements = getMandatoryRequirements(FEATURE_DEVELOPMENT_TEMPLATE);
        expect(requirements.length).toBeGreaterThan(0);
        expect(requirements.every(r => r.mandatory)).toBe(true);
      });
    });

    describe('getTemplateStats', () => {
      it('returns correct stats for feature development template', () => {
        const stats = getTemplateStats(FEATURE_DEVELOPMENT_TEMPLATE);

        expect(stats.phaseCount).toBe(5);
        expect(stats.gateCount).toBe(FEATURE_DEVELOPMENT_TEMPLATE.qualityGates.length);
        expect(stats.deliverableCount).toBe(FEATURE_DEVELOPMENT_TEMPLATE.deliverables.length);
        expect(stats.requirementCount).toBeGreaterThan(0);
        expect(stats.mandatoryRequirementCount).toBeGreaterThan(0);
        expect(stats.mandatoryRequirementCount).toBeLessThanOrEqual(stats.requirementCount);
      });

      it('returns correct stats for bug investigation template', () => {
        const stats = getTemplateStats(BUG_INVESTIGATION_TEMPLATE);

        expect(stats.phaseCount).toBe(5);
        expect(stats.deliverableCount).toBe(0); // Bug template has no deliverables
      });
    });

    describe('templateHasPhase', () => {
      it('returns true for existing phases', () => {
        expect(templateHasPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'research')).toBe(true);
        expect(templateHasPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'implement')).toBe(true);
      });

      it('returns false for non-existing phases', () => {
        expect(templateHasPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'nonexistent')).toBe(false);
      });
    });

    describe('getNextPhase', () => {
      it('returns next phase', () => {
        expect(getNextPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'research')).toBe('design');
        expect(getNextPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'design')).toBe('implement');
        expect(getNextPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'test')).toBe('document');
      });

      it('returns null for last phase', () => {
        expect(getNextPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'document')).toBeNull();
      });

      it('returns null for non-existent phase', () => {
        expect(getNextPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'nonexistent')).toBeNull();
      });
    });

    describe('getPreviousPhase', () => {
      it('returns previous phase', () => {
        expect(getPreviousPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'design')).toBe('research');
        expect(getPreviousPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'document')).toBe('test');
      });

      it('returns null for first phase', () => {
        expect(getPreviousPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'research')).toBeNull();
      });

      it('returns null for non-existent phase', () => {
        expect(getPreviousPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'nonexistent')).toBeNull();
      });
    });
  });

  // ============================================================================
  // TEMPLATE-SPECIFIC TESTS
  // ============================================================================

  describe('template-specific behavior', () => {
    describe('feature development', () => {
      it('has automated gates for implementation', () => {
        const gates = getGatesForPhase(FEATURE_DEVELOPMENT_TEMPLATE, 'test');
        const automatedReqs = gates.flatMap(g =>
          g.requirements.filter(r => r.verification === 'automated')
        );
        expect(automatedReqs.length).toBeGreaterThan(0);
      });

      it('deliverables have file patterns for code', () => {
        const codeDeliverables = FEATURE_DEVELOPMENT_TEMPLATE.deliverables.filter(
          d => d.type === 'code'
        );
        expect(codeDeliverables.every(d => d.filePatterns && d.filePatterns.length > 0)).toBe(true);
      });
    });

    describe('bug investigation', () => {
      it('evidence requirements have appropriate types', () => {
        const requirements = BUG_INVESTIGATION_TEMPLATE.evidenceRequirements;
        const types = new Set(requirements.map(r => r.type));

        expect(types.has('commit')).toBe(true);
        expect(types.has('test_pass')).toBe(true);
      });

      it('timeout procedures have notification templates', () => {
        const procedures = BUG_INVESTIGATION_TEMPLATE.timeoutProcedures;
        const withTemplates = procedures.filter(p => p.notificationTemplate);
        expect(withTemplates.length).toBeGreaterThan(0);
      });
    });

    describe('refactoring', () => {
      it('breaking change protocols require migration for API changes', () => {
        const apiProtocol = REFACTORING_TEMPLATE.breakingChangeProtocols.find(
          p => p.changeType === 'api'
        );
        expect(apiProtocol?.migrationPathRequired).toBe(true);
      });

      it('ordering rules are not all overridable', () => {
        const nonOverridable = REFACTORING_TEMPLATE.rollbackSafeOrdering.filter(
          r => !r.overridable
        );
        expect(nonOverridable.length).toBeGreaterThan(0);
      });

      it('coverage requirements include mutation testing', () => {
        const mutationReq = REFACTORING_TEMPLATE.testCoverageRequirements.find(
          r => r.coverageType === 'mutation'
        );
        expect(mutationReq).toBeDefined();
      });
    });

    describe('research', () => {
      it('uncertainty reduces with investigation', () => {
        const config = RESEARCH_TEMPLATE.uncertaintyTracking;
        expect(config.investigationThreshold).toBeLessThan(config.initialLevel);
      });

      it('dead end documentation captures lessons learned', () => {
        const config = RESEARCH_TEMPLATE.deadEndDocumentation;
        expect(config.minFields).toContain('lessonsLearned');
      });

      it('knowledge capture includes multiple types', () => {
        const types = RESEARCH_TEMPLATE.knowledgeCapture.captureTypes;
        expect(types).toContain('decision');
        expect(types).toContain('learning');
        expect(types).toContain('pattern');
      });
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING
  // ============================================================================

  describe('edge cases', () => {
    it('handles template with minimal configuration', () => {
      const minimal = createFeatureDevelopmentTemplate({
        id: 'minimal',
        name: 'Minimal',
        qualityGates: [],
        deliverables: [],
        rollbackTriggers: [],
      });

      const result = validateTemplate(minimal);
      expect(result.valid).toBe(true);
    });

    it('createFromTemplate handles empty context', () => {
      const context: TemplateContext = {
        name: 'Test',
      };

      const result = createFromTemplate('feature_development', context);
      expect(result.id).toBeDefined();
      expect(result.phases.length).toBeGreaterThan(0);
    });

    it('phase navigation handles single-phase template', () => {
      const singlePhase = createResearchTemplate({
        id: 'single',
        name: 'Single',
        phases: ['investigate'] as const,
      });

      expect(getNextPhase(singlePhase, 'investigate')).toBeNull();
      expect(getPreviousPhase(singlePhase, 'investigate')).toBeNull();
    });
  });
});
