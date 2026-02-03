import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type QualityGatesPreset,
  type OrchestrationPreset,
  type DeliverablePreset,
  type ReviewPreset,
  type WorkPreset,
  type PresetGateRequirement,
  type PresetQualityGate,
  type DeliverableRequirement,
  type ReviewTrigger,
  type AutomatedCheck,
  type RetryConfig,

  // Standard presets
  STRICT_PRESET,
  STANDARD_PRESET,
  EXPLORATORY_PRESET,
  STRICT_QUALITY_GATES,
  STANDARD_QUALITY_GATES,
  EXPLORATORY_QUALITY_GATES,
  STRICT_ORCHESTRATION,
  STANDARD_ORCHESTRATION,
  EXPLORATORY_ORCHESTRATION,
  CODE_DELIVERABLE_STRICT,
  CODE_DELIVERABLE_STANDARD,
  CODE_DELIVERABLE_EXPLORATORY,
  STRICT_REVIEW,
  STANDARD_REVIEW,
  EXPLORATORY_REVIEW,

  // Factory functions
  createQualityGatesPreset,
  createOrchestrationPreset,
  createDeliverablePreset,
  createReviewPreset,
  createWorkPreset,
  mergeWorkPresets,
  getPresetById,
  listPresetIds,

  // Validators
  validateGateRequirement,
  validateQualityGate,
  validateQualityGatesPreset,
  validateOrchestrationPreset,
  validateDeliverableRequirement,
  validateDeliverablePreset,
  validateReviewTrigger,
  validateAutomatedCheck,
  validateReviewPreset,
  validateWorkPreset,

  // Utility functions
  hasBlockingGates,
  getPhaseRequirements,
  isPeerReviewTriggered,
  calculateBackoff,
} from '../work_presets.js';

describe('work_presets', () => {
  // ============================================================================
  // STANDARD PRESETS TESTS
  // ============================================================================

  describe('standard presets', () => {
    describe('STRICT_PRESET', () => {
      it('has all required fields', () => {
        expect(STRICT_PRESET.id).toBe('strict');
        expect(STRICT_PRESET.name).toBe('Strict');
        expect(STRICT_PRESET.version).toBe('1.0.0');
        expect(STRICT_PRESET.qualityGates).toBeDefined();
        expect(STRICT_PRESET.orchestration).toBeDefined();
        expect(STRICT_PRESET.deliverables).toBeDefined();
        expect(STRICT_PRESET.review).toBeDefined();
      });

      it('has blocking gates for critical phases', () => {
        expect(hasBlockingGates(STRICT_PRESET.qualityGates, 'implementation')).toBe(true);
        expect(hasBlockingGates(STRICT_PRESET.qualityGates, 'testing')).toBe(true);
        expect(hasBlockingGates(STRICT_PRESET.qualityGates, 'review')).toBe(true);
        expect(hasBlockingGates(STRICT_PRESET.qualityGates, 'deploy')).toBe(true);
      });

      it('uses fail_fast orchestration policy', () => {
        expect(STRICT_PRESET.orchestration.failurePolicy).toBe('fail_fast');
        expect(STRICT_PRESET.orchestration.maxConcurrentAgents).toBe(2);
      });

      it('has comprehensive self-review checklist', () => {
        expect(STRICT_PRESET.review.selfReviewChecklist.length).toBeGreaterThanOrEqual(10);
      });

      it('validates successfully', () => {
        const result = validateWorkPreset(STRICT_PRESET);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('STANDARD_PRESET', () => {
      it('has all required fields', () => {
        expect(STANDARD_PRESET.id).toBe('standard');
        expect(STANDARD_PRESET.name).toBe('Standard');
        expect(STANDARD_PRESET.version).toBe('1.0.0');
      });

      it('has some blocking and some non-blocking gates', () => {
        expect(hasBlockingGates(STANDARD_PRESET.qualityGates, 'implementation')).toBe(true);
        expect(hasBlockingGates(STANDARD_PRESET.qualityGates, 'testing')).toBe(true);
        expect(hasBlockingGates(STANDARD_PRESET.qualityGates, 'review')).toBe(false);
      });

      it('uses retry orchestration policy', () => {
        expect(STANDARD_PRESET.orchestration.failurePolicy).toBe('retry');
        expect(STANDARD_PRESET.orchestration.retryConfig).toBeDefined();
        expect(STANDARD_PRESET.orchestration.retryConfig?.maxRetries).toBe(2);
      });

      it('validates successfully', () => {
        const result = validateWorkPreset(STANDARD_PRESET);
        expect(result.valid).toBe(true);
      });
    });

    describe('EXPLORATORY_PRESET', () => {
      it('has all required fields', () => {
        expect(EXPLORATORY_PRESET.id).toBe('exploratory');
        expect(EXPLORATORY_PRESET.name).toBe('Exploratory');
      });

      it('has no blocking gates', () => {
        expect(hasBlockingGates(EXPLORATORY_PRESET.qualityGates, 'implementation')).toBe(false);
        expect(hasBlockingGates(EXPLORATORY_PRESET.qualityGates, 'testing')).toBe(false);
      });

      it('uses continue orchestration policy', () => {
        expect(EXPLORATORY_PRESET.orchestration.failurePolicy).toBe('continue');
        expect(EXPLORATORY_PRESET.orchestration.maxConcurrentAgents).toBe(8);
      });

      it('validates successfully', () => {
        const result = validateWorkPreset(EXPLORATORY_PRESET);
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

    describe('createQualityGatesPreset', () => {
      it('creates preset with defaults', () => {
        const preset = createQualityGatesPreset({
          id: 'test-gates',
          name: 'Test Gates',
        });

        expect(preset.id).toBe('test-gates');
        expect(preset.name).toBe('Test Gates');
        expect(preset.gates).toEqual([]);
      });

      it('preserves provided gates', () => {
        const preset = createQualityGatesPreset({
          id: 'custom-gates',
          name: 'Custom Gates',
          gates: [
            {
              phase: 'test-phase',
              blocking: true,
              requirements: [
                { type: 'lint_pass', description: 'Lint must pass' },
              ],
            },
          ],
        });

        expect(preset.gates).toHaveLength(1);
        expect(preset.gates[0].phase).toBe('test-phase');
      });
    });

    describe('createOrchestrationPreset', () => {
      it('creates preset with defaults', () => {
        const preset = createOrchestrationPreset({ id: 'test-orch' });

        expect(preset.id).toBe('test-orch');
        expect(preset.maxConcurrentAgents).toBe(4);
        expect(preset.progressCheckIntervalMs).toBe(10000);
        expect(preset.stallDetectionThresholdMs).toBe(60000);
        expect(preset.failurePolicy).toBe('retry');
        expect(preset.retryConfig).toBeDefined();
      });

      it('adds retry config when policy is retry', () => {
        const preset = createOrchestrationPreset({
          id: 'retry-test',
          failurePolicy: 'retry',
        });

        expect(preset.retryConfig).toBeDefined();
        expect(preset.retryConfig?.maxRetries).toBe(3);
      });

      it('does not add retry config for fail_fast', () => {
        const preset = createOrchestrationPreset({
          id: 'fail-fast-test',
          failurePolicy: 'fail_fast',
        });

        expect(preset.retryConfig).toBeUndefined();
      });

      it('preserves explicit retry config', () => {
        const preset = createOrchestrationPreset({
          id: 'custom-retry',
          failurePolicy: 'retry',
          retryConfig: {
            maxRetries: 5,
            backoffMs: 2000,
          },
        });

        expect(preset.retryConfig?.maxRetries).toBe(5);
        expect(preset.retryConfig?.backoffMs).toBe(2000);
      });
    });

    describe('createDeliverablePreset', () => {
      it('creates preset with defaults', () => {
        const preset = createDeliverablePreset({ type: 'code' });

        expect(preset.type).toBe('code');
        expect(preset.requirements).toEqual([]);
      });

      it('preserves provided requirements', () => {
        const preset = createDeliverablePreset({
          type: 'documentation',
          requirements: [
            {
              id: 'complete',
              name: 'Complete',
              description: 'Must be complete',
              mandatory: true,
              verification: 'manual',
            },
          ],
        });

        expect(preset.requirements).toHaveLength(1);
        expect(preset.requirements[0].id).toBe('complete');
      });
    });

    describe('createReviewPreset', () => {
      it('creates preset with defaults', () => {
        const preset = createReviewPreset({});

        expect(preset.selfReviewChecklist).toEqual([]);
        expect(preset.peerReviewTriggers).toEqual([]);
        expect(preset.automatedChecks).toEqual([]);
      });

      it('preserves provided values', () => {
        const preset = createReviewPreset({
          selfReviewChecklist: ['Item 1', 'Item 2'],
          minSelfReviewConfidence: 0.8,
        });

        expect(preset.selfReviewChecklist).toHaveLength(2);
        expect(preset.minSelfReviewConfidence).toBe(0.8);
      });
    });

    describe('createWorkPreset', () => {
      it('creates preset with defaults', () => {
        const preset = createWorkPreset({
          id: 'test-preset',
          name: 'Test Preset',
        });

        expect(preset.id).toBe('test-preset');
        expect(preset.name).toBe('Test Preset');
        expect(preset.version).toBe('1.0.0');
        expect(preset.qualityGates).toBeDefined();
        expect(preset.orchestration).toBeDefined();
        expect(preset.deliverables).toBeDefined();
        expect(preset.review).toBeDefined();
        expect(preset.createdAt).toBe('2026-01-29T12:00:00.000Z');
      });

      it('uses standard defaults', () => {
        const preset = createWorkPreset({
          id: 'default-test',
          name: 'Default Test',
        });

        expect(preset.qualityGates).toBe(STANDARD_QUALITY_GATES);
        expect(preset.orchestration).toBe(STANDARD_ORCHESTRATION);
        expect(preset.review).toBe(STANDARD_REVIEW);
      });
    });

    describe('mergeWorkPresets', () => {
      it('merges presets with overrides taking precedence', () => {
        const base = createWorkPreset({
          id: 'base',
          name: 'Base',
          tags: ['base-tag'],
        });

        const merged = mergeWorkPresets(base, {
          name: 'Merged',
          qualityGates: STRICT_QUALITY_GATES,
          tags: ['override-tag'],
        });

        expect(merged.id).toBe('base');
        expect(merged.name).toBe('Merged');
        expect(merged.qualityGates).toBe(STRICT_QUALITY_GATES);
        expect(merged.tags).toContain('base-tag');
        expect(merged.tags).toContain('override-tag');
      });

      it('updates the updatedAt timestamp', () => {
        const base = createWorkPreset({
          id: 'base',
          name: 'Base',
        });

        vi.setSystemTime(new Date('2026-01-30T12:00:00.000Z'));

        const merged = mergeWorkPresets(base, { name: 'Updated' });

        expect(merged.updatedAt).toBe('2026-01-30T12:00:00.000Z');
      });
    });
  });

  // ============================================================================
  // PRESET LOOKUP TESTS
  // ============================================================================

  describe('preset lookup', () => {
    describe('getPresetById', () => {
      it('returns strict preset', () => {
        const preset = getPresetById('strict');
        expect(preset).toBe(STRICT_PRESET);
      });

      it('returns standard preset', () => {
        const preset = getPresetById('standard');
        expect(preset).toBe(STANDARD_PRESET);
      });

      it('returns exploratory preset', () => {
        const preset = getPresetById('exploratory');
        expect(preset).toBe(EXPLORATORY_PRESET);
      });

      it('returns undefined for unknown id', () => {
        const preset = getPresetById('unknown');
        expect(preset).toBeUndefined();
      });
    });

    describe('listPresetIds', () => {
      it('returns all preset ids', () => {
        const ids = listPresetIds();
        expect(ids).toContain('strict');
        expect(ids).toContain('standard');
        expect(ids).toContain('exploratory');
        expect(ids).toHaveLength(3);
      });
    });
  });

  // ============================================================================
  // VALIDATOR TESTS
  // ============================================================================

  describe('validators', () => {
    describe('validateGateRequirement', () => {
      it('validates valid requirement', () => {
        const req: PresetGateRequirement = {
          type: 'test_coverage',
          threshold: 80,
          description: 'Minimum 80% coverage',
        };

        const result = validateGateRequirement(req);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('rejects invalid type', () => {
        const req = {
          type: 'invalid_type' as any,
          description: 'Test',
        };

        const result = validateGateRequirement(req);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_gate_requirement_type');
      });

      it('rejects missing description', () => {
        const req = {
          type: 'lint_pass',
          description: '',
        } as PresetGateRequirement;

        const result = validateGateRequirement(req);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('missing_description');
      });

      it('warns about missing threshold for coverage', () => {
        const req: PresetGateRequirement = {
          type: 'test_coverage',
          description: 'Coverage check',
        };

        const result = validateGateRequirement(req);
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].path).toBe('threshold');
      });

      it('rejects invalid coverage threshold', () => {
        const req: PresetGateRequirement = {
          type: 'test_coverage',
          threshold: 150,
          description: 'Invalid threshold',
        };

        const result = validateGateRequirement(req);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_threshold');
      });

      it('rejects invalid confidence threshold', () => {
        const req: PresetGateRequirement = {
          type: 'confidence_threshold',
          threshold: 1.5,
          description: 'Invalid confidence',
        };

        const result = validateGateRequirement(req);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_threshold');
      });
    });

    describe('validateQualityGate', () => {
      it('validates valid gate', () => {
        const gate: PresetQualityGate = {
          phase: 'testing',
          blocking: true,
          requirements: [
            { type: 'test_coverage', threshold: 80, description: '80% coverage' },
          ],
        };

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(true);
      });

      it('rejects missing phase', () => {
        const gate = {
          phase: '',
          blocking: true,
          requirements: [],
        } as PresetQualityGate;

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('missing_phase');
      });

      it('warns about empty requirements', () => {
        const gate: PresetQualityGate = {
          phase: 'testing',
          blocking: true,
          requirements: [],
        };

        const result = validateQualityGate(gate);
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
      });
    });

    describe('validateOrchestrationPreset', () => {
      it('validates valid preset', () => {
        const result = validateOrchestrationPreset(STANDARD_ORCHESTRATION);
        expect(result.valid).toBe(true);
      });

      it('rejects invalid maxConcurrentAgents', () => {
        const preset: OrchestrationPreset = {
          ...STANDARD_ORCHESTRATION,
          maxConcurrentAgents: 0,
        };

        const result = validateOrchestrationPreset(preset);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_max_concurrent_agents');
      });

      it('rejects stall threshold less than check interval', () => {
        const preset: OrchestrationPreset = {
          ...STANDARD_ORCHESTRATION,
          progressCheckIntervalMs: 60000,
          stallDetectionThresholdMs: 30000,
        };

        const result = validateOrchestrationPreset(preset);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_stall_detection_threshold');
      });

      it('rejects retry policy without config', () => {
        const preset: OrchestrationPreset = {
          id: 'test',
          maxConcurrentAgents: 4,
          progressCheckIntervalMs: 10000,
          stallDetectionThresholdMs: 60000,
          failurePolicy: 'retry',
        };

        const result = validateOrchestrationPreset(preset);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('missing_retry_config');
      });

      it('warns about very short progress interval', () => {
        const preset: OrchestrationPreset = {
          ...STANDARD_ORCHESTRATION,
          progressCheckIntervalMs: 50,
        };

        const result = validateOrchestrationPreset(preset);
        expect(result.warnings.some(w => w.path === 'progressCheckIntervalMs')).toBe(true);
      });
    });

    describe('validateDeliverableRequirement', () => {
      it('validates valid requirement', () => {
        const req: DeliverableRequirement = {
          id: 'test',
          name: 'Test Requirement',
          description: 'A test requirement',
          mandatory: true,
          verification: 'automated',
          verificationCommand: 'npm test',
        };

        const result = validateDeliverableRequirement(req);
        expect(result.valid).toBe(true);
      });

      it('warns about missing command for automated verification', () => {
        const req: DeliverableRequirement = {
          id: 'test',
          name: 'Test',
          description: 'Test',
          mandatory: true,
          verification: 'automated',
        };

        const result = validateDeliverableRequirement(req);
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.path === 'verificationCommand')).toBe(true);
      });
    });

    describe('validateReviewTrigger', () => {
      it('validates valid trigger', () => {
        const trigger: ReviewTrigger = {
          condition: 'security_sensitive',
          description: 'Security-sensitive changes',
          minReviewers: 2,
        };

        const result = validateReviewTrigger(trigger);
        expect(result.valid).toBe(true);
      });

      it('rejects custom condition without expression', () => {
        const trigger: ReviewTrigger = {
          condition: 'custom',
          description: 'Custom trigger',
        };

        const result = validateReviewTrigger(trigger);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('missing_custom_condition');
      });
    });

    describe('validateAutomatedCheck', () => {
      it('validates valid check', () => {
        const check: AutomatedCheck = {
          type: 'lint',
          name: 'ESLint',
          command: 'npm run lint',
          required: true,
        };

        const result = validateAutomatedCheck(check);
        expect(result.valid).toBe(true);
      });

      it('warns about coverage check without threshold', () => {
        const check: AutomatedCheck = {
          type: 'coverage',
          name: 'Coverage',
          required: true,
        };

        const result = validateAutomatedCheck(check);
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.path === 'threshold')).toBe(true);
      });
    });

    describe('validateReviewPreset', () => {
      it('validates standard presets', () => {
        expect(validateReviewPreset(STRICT_REVIEW).valid).toBe(true);
        expect(validateReviewPreset(STANDARD_REVIEW).valid).toBe(true);
        expect(validateReviewPreset(EXPLORATORY_REVIEW).valid).toBe(true);
      });

      it('rejects invalid confidence threshold', () => {
        const preset: ReviewPreset = {
          ...STANDARD_REVIEW,
          minSelfReviewConfidence: 1.5,
        };

        const result = validateReviewPreset(preset);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_confidence');
      });
    });

    describe('validateWorkPreset', () => {
      it('validates all standard presets', () => {
        expect(validateWorkPreset(STRICT_PRESET).valid).toBe(true);
        expect(validateWorkPreset(STANDARD_PRESET).valid).toBe(true);
        expect(validateWorkPreset(EXPLORATORY_PRESET).valid).toBe(true);
      });

      it('collects errors from nested presets', () => {
        const preset: WorkPreset = {
          ...STANDARD_PRESET,
          id: '',
          orchestration: {
            ...STANDARD_ORCHESTRATION,
            maxConcurrentAgents: 0,
          },
        };

        const result = validateWorkPreset(preset);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.errors.some(e => e.path === 'id')).toBe(true);
        expect(result.errors.some(e => e.path.includes('orchestration'))).toBe(true);
      });
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS TESTS
  // ============================================================================

  describe('utility functions', () => {
    describe('hasBlockingGates', () => {
      it('returns true for phases with blocking gates', () => {
        expect(hasBlockingGates(STRICT_QUALITY_GATES, 'implementation')).toBe(true);
        expect(hasBlockingGates(STRICT_QUALITY_GATES, 'testing')).toBe(true);
      });

      it('returns false for phases without blocking gates', () => {
        expect(hasBlockingGates(EXPLORATORY_QUALITY_GATES, 'implementation')).toBe(false);
      });

      it('returns false for non-existent phases', () => {
        expect(hasBlockingGates(STRICT_QUALITY_GATES, 'nonexistent')).toBe(false);
      });
    });

    describe('getPhaseRequirements', () => {
      it('returns requirements for existing phase', () => {
        const reqs = getPhaseRequirements(STRICT_QUALITY_GATES, 'implementation');
        expect(reqs.length).toBeGreaterThan(0);
        expect(reqs.some(r => r.type === 'type_check')).toBe(true);
      });

      it('returns empty array for non-existent phase', () => {
        const reqs = getPhaseRequirements(STRICT_QUALITY_GATES, 'nonexistent');
        expect(reqs).toEqual([]);
      });
    });

    describe('isPeerReviewTriggered', () => {
      it('triggers on security sensitive changes', () => {
        const result = isPeerReviewTriggered(STRICT_REVIEW, {
          isSecuritySensitive: true,
        });

        expect(result.triggered).toBe(true);
        expect(result.minReviewers).toBeGreaterThanOrEqual(1);
      });

      it('triggers on breaking changes', () => {
        const result = isPeerReviewTriggered(STRICT_REVIEW, {
          isBreakingChange: true,
        });

        expect(result.triggered).toBe(true);
      });

      it('triggers on large changes', () => {
        const result = isPeerReviewTriggered(STRICT_REVIEW, {
          linesChanged: 600,
        });

        expect(result.triggered).toBe(true);
        expect(result.reasons.length).toBeGreaterThan(0);
      });

      it('does not trigger for small changes without other conditions', () => {
        const result = isPeerReviewTriggered(STRICT_REVIEW, {
          linesChanged: 50,
        });

        expect(result.triggered).toBe(false);
        expect(result.minReviewers).toBe(0);
      });

      it('accumulates multiple triggers', () => {
        const result = isPeerReviewTriggered(STRICT_REVIEW, {
          isSecuritySensitive: true,
          isBreakingChange: true,
          linesChanged: 600,
        });

        expect(result.triggered).toBe(true);
        expect(result.reasons.length).toBeGreaterThanOrEqual(3);
        expect(result.minReviewers).toBeGreaterThanOrEqual(2);
      });

      it('handles custom conditions', () => {
        const preset = createReviewPreset({
          peerReviewTriggers: [
            {
              condition: 'custom',
              customCondition: 'myCustomRule',
              description: 'Custom rule triggered',
              minReviewers: 3,
            },
          ],
        });

        const result = isPeerReviewTriggered(preset, {
          customConditions: { myCustomRule: true },
        });

        expect(result.triggered).toBe(true);
        expect(result.minReviewers).toBe(3);
      });
    });

    describe('calculateBackoff', () => {
      const config: RetryConfig = {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
        maxBackoffMs: 10000,
      };

      it('calculates correct backoff for first attempt', () => {
        const backoff = calculateBackoff(config, 0);
        expect(backoff).toBe(1000);
      });

      it('calculates exponential backoff', () => {
        expect(calculateBackoff(config, 1)).toBe(2000);
        expect(calculateBackoff(config, 2)).toBe(4000);
        expect(calculateBackoff(config, 3)).toBe(8000);
      });

      it('respects maxBackoffMs', () => {
        expect(calculateBackoff(config, 4)).toBe(10000);
        expect(calculateBackoff(config, 10)).toBe(10000);
      });

      it('uses default multiplier of 2 if not specified', () => {
        const simpleConfig: RetryConfig = {
          maxRetries: 3,
          backoffMs: 1000,
        };

        expect(calculateBackoff(simpleConfig, 1)).toBe(2000);
        expect(calculateBackoff(simpleConfig, 2)).toBe(4000);
      });
    });
  });

  // ============================================================================
  // QUALITY GATES PRESETS TESTS
  // ============================================================================

  describe('quality gates presets', () => {
    describe('STRICT_QUALITY_GATES', () => {
      it('has gates for all critical phases', () => {
        const phases = STRICT_QUALITY_GATES.gates.map(g => g.phase);
        expect(phases).toContain('implementation');
        expect(phases).toContain('testing');
        expect(phases).toContain('review');
        expect(phases).toContain('deploy');
      });

      it('requires high coverage threshold', () => {
        const testingReqs = getPhaseRequirements(STRICT_QUALITY_GATES, 'testing');
        const coverageReq = testingReqs.find(r => r.type === 'test_coverage');
        expect(coverageReq?.threshold).toBeGreaterThanOrEqual(90);
      });
    });

    describe('STANDARD_QUALITY_GATES', () => {
      it('requires moderate coverage', () => {
        const testingReqs = getPhaseRequirements(STANDARD_QUALITY_GATES, 'testing');
        const coverageReq = testingReqs.find(r => r.type === 'test_coverage');
        expect(coverageReq?.threshold).toBeGreaterThanOrEqual(70);
        expect(coverageReq?.threshold).toBeLessThan(90);
      });
    });

    describe('EXPLORATORY_QUALITY_GATES', () => {
      it('allows lower coverage', () => {
        const testingReqs = getPhaseRequirements(EXPLORATORY_QUALITY_GATES, 'testing');
        const coverageReq = testingReqs.find(r => r.type === 'test_coverage');
        expect(coverageReq?.threshold).toBeLessThan(50);
      });
    });
  });

  // ============================================================================
  // ORCHESTRATION PRESETS TESTS
  // ============================================================================

  describe('orchestration presets', () => {
    it('STRICT has lower concurrency', () => {
      expect(STRICT_ORCHESTRATION.maxConcurrentAgents).toBeLessThan(
        STANDARD_ORCHESTRATION.maxConcurrentAgents
      );
    });

    it('EXPLORATORY has higher concurrency', () => {
      expect(EXPLORATORY_ORCHESTRATION.maxConcurrentAgents).toBeGreaterThan(
        STANDARD_ORCHESTRATION.maxConcurrentAgents
      );
    });

    it('STRICT has shorter stall detection', () => {
      expect(STRICT_ORCHESTRATION.stallDetectionThresholdMs).toBeLessThan(
        EXPLORATORY_ORCHESTRATION.stallDetectionThresholdMs
      );
    });
  });

  // ============================================================================
  // DELIVERABLE PRESETS TESTS
  // ============================================================================

  describe('deliverable presets', () => {
    describe('CODE_DELIVERABLE_STRICT', () => {
      it('requires comprehensive documentation', () => {
        const docReq = CODE_DELIVERABLE_STRICT.requirements.find(
          r => r.id === 'documented'
        );
        expect(docReq).toBeDefined();
        expect(docReq?.mandatory).toBe(true);
      });

      it('requires security review', () => {
        const secReq = CODE_DELIVERABLE_STRICT.requirements.find(
          r => r.id === 'security-reviewed'
        );
        expect(secReq).toBeDefined();
        expect(secReq?.mandatory).toBe(true);
      });
    });

    describe('CODE_DELIVERABLE_EXPLORATORY', () => {
      it('has minimal requirements', () => {
        expect(CODE_DELIVERABLE_EXPLORATORY.requirements.length).toBeLessThan(
          CODE_DELIVERABLE_STRICT.requirements.length
        );
      });
    });
  });

  // ============================================================================
  // REVIEW PRESETS TESTS
  // ============================================================================

  describe('review presets', () => {
    describe('STRICT_REVIEW', () => {
      it('has comprehensive automated checks', () => {
        const checkTypes = STRICT_REVIEW.automatedChecks.map(c => c.type);
        expect(checkTypes).toContain('type_check');
        expect(checkTypes).toContain('lint');
        expect(checkTypes).toContain('test');
        expect(checkTypes).toContain('security_scan');
      });

      it('has high self-review confidence requirement', () => {
        expect(STRICT_REVIEW.minSelfReviewConfidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    describe('EXPLORATORY_REVIEW', () => {
      it('has minimal automated checks', () => {
        expect(EXPLORATORY_REVIEW.automatedChecks.length).toBeLessThan(
          STRICT_REVIEW.automatedChecks.length
        );
      });

      it('has low self-review confidence requirement', () => {
        expect(EXPLORATORY_REVIEW.minSelfReviewConfidence).toBeLessThan(
          STRICT_REVIEW.minSelfReviewConfidence!
        );
      });
    });
  });
});
