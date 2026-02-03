import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateDXScore,
  generateOnboardingChecklist,
  validateWorkflow,
  createDXConfig,
  getDXPresets,
  WORLD_CLASS_DX_PRESET,
  STANDARD_DX_PRESET,
  MINIMAL_DX_PRESET,
  WORLD_CLASS_DOCS_PRESET,
  validateWorldClassDocs,
  createWorldClassDocsConfig,
  runDocTests,
  calculateReadingLevel,
  validateContentForAudience,
  checkDocFreshness,
  calculateLearningProgress,
  type DeveloperExperienceConfig,
  type DXScore,
  type OnboardingChecklist,
  type WorkflowValidationResult,
  type WorldClassDocConfig,
  type DocTesting,
  type ContentRequirements,
  type DocFreshness,
  type LearningPath,
} from '../developer_experience.js';

describe('Developer Experience Standards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DX Score Calculator', () => {
    it('calculates world-class preset as A+ grade', () => {
      const score = calculateDXScore(WORLD_CLASS_DX_PRESET);

      expect(score.grade).toBe('A+');
      expect(score.overall).toBeGreaterThanOrEqual(95);
      expect(score.calculatedAt).toBe('2026-01-29T12:00:00.000Z');
    });

    it('calculates standard preset with reasonable grade', () => {
      const score = calculateDXScore(STANDARD_DX_PRESET);

      // Standard preset should score between C and B (55-84)
      expect(['A+', 'A', 'B', 'C']).toContain(score.grade);
      expect(score.overall).toBeGreaterThanOrEqual(55);
      expect(score.overall).toBeLessThan(95); // Below world-class
    });

    it('calculates minimal preset as C or lower grade', () => {
      const score = calculateDXScore(MINIMAL_DX_PRESET);

      expect(['C', 'D', 'F']).toContain(score.grade);
      expect(score.overall).toBeLessThan(70);
    });

    it('provides breakdown by category', () => {
      const score = calculateDXScore(WORLD_CLASS_DX_PRESET);

      expect(score.breakdown).toHaveProperty('onboarding');
      expect(score.breakdown).toHaveProperty('workflow');
      expect(score.breakdown).toHaveProperty('tooling');
      expect(score.breakdown).toHaveProperty('documentation');
      expect(score.breakdown).toHaveProperty('feedback');

      // All categories should be scored 0-100
      Object.values(score.breakdown).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    it('provides component-level details', () => {
      const score = calculateDXScore(WORLD_CLASS_DX_PRESET);

      expect(score.components.length).toBeGreaterThan(0);

      score.components.forEach((component) => {
        expect(component.name).toBeTruthy();
        expect(['onboarding', 'workflow', 'tooling', 'documentation', 'feedback']).toContain(component.category);
        expect(component.score).toBeGreaterThanOrEqual(0);
        expect(component.score).toBeLessThanOrEqual(component.maxScore);
        expect(component.weight).toBeGreaterThan(0);
        expect(Array.isArray(component.details)).toBe(true);
        expect(Array.isArray(component.suggestions)).toBe(true);
      });
    });

    it('generates meaningful summary', () => {
      const worldClassScore = calculateDXScore(WORLD_CLASS_DX_PRESET);
      const minimalScore = calculateDXScore(MINIMAL_DX_PRESET);

      expect(worldClassScore.summary).toContain('World-class');
      expect(minimalScore.summary).not.toContain('World-class');
    });

    it('provides improvement suggestions for lower scores', () => {
      const minimalScore = calculateDXScore(MINIMAL_DX_PRESET);

      expect(minimalScore.topSuggestions.length).toBeGreaterThan(0);
    });

    it('respects custom weights', () => {
      const customWeights = {
        onboarding: 0.5,
        workflow: 0.2,
        tooling: 0.1,
        documentation: 0.1,
        feedback: 0.1,
      };

      const score = calculateDXScore(WORLD_CLASS_DX_PRESET, customWeights);

      // With world-class onboarding weighted heavily, should still be high
      expect(score.overall).toBeGreaterThanOrEqual(90);
    });

    it('scores onboarding time-to-first-commit appropriately', () => {
      const fast = createDXConfig('world_class', {
        onboarding: { timeToFirstCommitTarget: 2 },
      });
      const slow = createDXConfig('world_class', {
        onboarding: { timeToFirstCommitTarget: 80 },
      });

      const fastScore = calculateDXScore(fast);
      const slowScore = calculateDXScore(slow);

      expect(fastScore.breakdown.onboarding).toBeGreaterThan(slowScore.breakdown.onboarding);
    });

    it('scores workflow code review requirements', () => {
      const strict = createDXConfig('standard', {
        workflow: {
          codeReview: {
            required: true,
            minReviewers: 2,
            slaHours: 4,
            autoAssignment: true,
            checklist: ['a', 'b', 'c', 'd', 'e'],
            dismissStaleReviews: true,
          },
        },
      });

      const lenient = createDXConfig('standard', {
        workflow: {
          codeReview: {
            required: false,
            minReviewers: 0,
            slaHours: 72,
            autoAssignment: false,
            checklist: [],
            dismissStaleReviews: false,
          },
        },
      });

      const strictScore = calculateDXScore(strict);
      const lenientScore = calculateDXScore(lenient);

      expect(strictScore.breakdown.workflow).toBeGreaterThan(lenientScore.breakdown.workflow);
    });
  });

  describe('Onboarding Checklist Generator', () => {
    it('generates checklist from world-class config', () => {
      const checklist = generateOnboardingChecklist(WORLD_CLASS_DX_PRESET);

      expect(checklist.title).toContain('World-Class DX');
      expect(checklist.items.length).toBeGreaterThan(0);
      expect(checklist.totalEstimatedHours).toBeGreaterThan(0);
      expect(checklist.createdAt).toBe('2026-01-29T12:00:00.000Z');
    });

    it('categorizes items correctly', () => {
      const checklist = generateOnboardingChecklist(WORLD_CLASS_DX_PRESET);

      expect(checklist.categories.setup.length).toBeGreaterThan(0);
      expect(checklist.categories.learning.length).toBeGreaterThan(0);
      expect(checklist.categories.social.length).toBeGreaterThan(0);
      expect(checklist.categories.contribution.length).toBeGreaterThan(0);

      // Verify all items are categorized
      const totalCategorized =
        checklist.categories.setup.length +
        checklist.categories.learning.length +
        checklist.categories.social.length +
        checklist.categories.contribution.length;

      expect(totalCategorized).toBe(checklist.items.length);
    });

    it('includes bootstrap command when provided', () => {
      const checklist = generateOnboardingChecklist(WORLD_CLASS_DX_PRESET);

      const bootstrapItem = checklist.items.find((i) => i.id === 'setup-bootstrap');
      expect(bootstrapItem).toBeDefined();
      expect(bootstrapItem!.verificationCommand).toBe('make setup');
    });

    it('includes prerequisite items', () => {
      const checklist = generateOnboardingChecklist(WORLD_CLASS_DX_PRESET);

      const prereqItems = checklist.items.filter((i) => i.id.startsWith('setup-prereq'));
      expect(prereqItems.length).toBeGreaterThan(0);
    });

    it('includes buddy meeting when enabled', () => {
      const withBuddy = createDXConfig('world_class');
      const withoutBuddy = createDXConfig('minimal');

      const checklistWithBuddy = generateOnboardingChecklist(withBuddy);
      const checklistWithoutBuddy = generateOnboardingChecklist(withoutBuddy);

      expect(checklistWithBuddy.items.some((i) => i.id === 'social-buddy')).toBe(true);
      expect(checklistWithoutBuddy.items.some((i) => i.id === 'social-buddy')).toBe(false);
    });

    it('includes first commit item', () => {
      const checklist = generateOnboardingChecklist(WORLD_CLASS_DX_PRESET);

      const firstCommitItem = checklist.items.find((i) => i.id === 'contribute-first-commit');
      expect(firstCommitItem).toBeDefined();
      expect(firstCommitItem!.required).toBe(true);
      expect(firstCommitItem!.dependencies).toContain('contribute-tests');
    });

    it('includes documentation learning items', () => {
      const checklist = generateOnboardingChecklist(WORLD_CLASS_DX_PRESET);

      const learningItems = checklist.categories.learning;
      const hasQuickstart = learningItems.some((i) => i.id === 'learn-quickstart');
      const hasArchitecture = learningItems.some((i) => i.id === 'learn-architecture');

      expect(hasQuickstart).toBe(true);
      expect(hasArchitecture).toBe(true);
    });

    it('calculates total estimated hours correctly', () => {
      const checklist = generateOnboardingChecklist(WORLD_CLASS_DX_PRESET);

      const totalMinutes = checklist.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
      const expectedHours = Math.round((totalMinutes / 60) * 10) / 10;

      expect(checklist.totalEstimatedHours).toBe(expectedHours);
    });
  });

  describe('Workflow Validator', () => {
    it('validates world-class config without errors', () => {
      const result = validateWorkflow(WORLD_CLASS_DX_PRESET);

      expect(result.valid).toBe(true);
      expect(result.summary.errors).toBe(0);
      expect(result.validatedAt).toBe('2026-01-29T12:00:00.000Z');
    });

    it('detects missing code review requirement', () => {
      const config = createDXConfig('standard', {
        workflow: {
          codeReview: {
            required: false,
            minReviewers: 0,
            slaHours: 48,
            autoAssignment: false,
            checklist: [],
            dismissStaleReviews: false,
          },
        },
      });

      const result = validateWorkflow(config);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'code-review-required')).toBe(true);
    });

    it('detects missing CI requirement', () => {
      const config = createDXConfig('standard', {
        workflow: {
          prGuidelines: {
            maxLines: 600,
            templateRequired: true,
            linkedIssueRequired: false,
            ciPassRequired: false,
            requiredSections: [],
            supportDraftPRs: true,
          },
        },
      });

      const result = validateWorkflow(config);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'ci-required')).toBe(true);
    });

    it('warns about slow review SLA', () => {
      const config = createDXConfig('standard', {
        workflow: {
          codeReview: {
            required: true,
            minReviewers: 1,
            slaHours: 72,
            autoAssignment: false,
            checklist: [],
            dismissStaleReviews: false,
          },
        },
      });

      const result = validateWorkflow(config);

      expect(result.issues.some((i) => i.rule === 'review-sla' && i.severity === 'warning')).toBe(true);
    });

    it('warns about large PR size limits', () => {
      const config = createDXConfig('standard', {
        workflow: {
          prGuidelines: {
            maxLines: 2000,
            templateRequired: true,
            linkedIssueRequired: false,
            ciPassRequired: true,
            requiredSections: [],
            supportDraftPRs: true,
          },
        },
      });

      const result = validateWorkflow(config);

      expect(result.issues.some((i) => i.rule === 'pr-size' && i.severity === 'warning')).toBe(true);
    });

    it('warns about disabled linting', () => {
      const config = createDXConfig('standard', {
        tooling: {
          linting: {
            enabled: false,
            strict: false,
            autoFix: false,
            customRules: [],
          },
        },
      });

      const result = validateWorkflow(config);

      expect(result.issues.some((i) => i.rule === 'linting-enabled')).toBe(true);
    });

    it('provides info about missing ADRs', () => {
      const config = createDXConfig('standard', {
        documentation: {
          architecture: {
            required: false,
            adrEnabled: false,
            diagramsRequired: false,
            maxAgeDays: 180,
          },
        },
      });

      const result = validateWorkflow(config);

      expect(result.issues.some((i) => i.rule === 'adr-enabled' && i.severity === 'info')).toBe(true);
    });

    it('warns about slow build times', () => {
      const config = createDXConfig('standard', {
        feedbackLoops: {
          buildTimeTarget: 600,
          testTimeTarget: 120,
          hotReloadRequired: false,
          errorMessageQuality: 'detailed',
          buildCaching: true,
          incrementalBuilds: false,
        },
      });

      const result = validateWorkflow(config);

      expect(result.issues.some((i) => i.rule === 'build-time' && i.severity === 'warning')).toBe(true);
    });

    it('calculates summary correctly', () => {
      const result = validateWorkflow(MINIMAL_DX_PRESET);

      expect(result.summary.errors + result.summary.warnings + result.summary.info).toBe(result.issues.length);
    });
  });

  describe('Presets', () => {
    it('provides three preset configurations', () => {
      const presets = getDXPresets();

      expect(Object.keys(presets)).toHaveLength(3);
      expect(presets).toHaveProperty('world_class');
      expect(presets).toHaveProperty('standard');
      expect(presets).toHaveProperty('minimal');
    });

    it('world-class preset has strict settings', () => {
      expect(WORLD_CLASS_DX_PRESET.onboarding.timeToFirstCommitTarget).toBeLessThanOrEqual(4);
      expect(WORLD_CLASS_DX_PRESET.workflow.codeReview.required).toBe(true);
      expect(WORLD_CLASS_DX_PRESET.workflow.codeReview.minReviewers).toBeGreaterThanOrEqual(2);
      expect(WORLD_CLASS_DX_PRESET.tooling.linting.enabled).toBe(true);
      expect(WORLD_CLASS_DX_PRESET.tooling.linting.strict).toBe(true);
      expect(WORLD_CLASS_DX_PRESET.feedbackLoops.errorMessageQuality).toBe('actionable');
    });

    it('standard preset has reasonable defaults', () => {
      expect(STANDARD_DX_PRESET.onboarding.timeToFirstCommitTarget).toBeLessThanOrEqual(8);
      expect(STANDARD_DX_PRESET.workflow.codeReview.required).toBe(true);
      expect(STANDARD_DX_PRESET.tooling.linting.enabled).toBe(true);
      expect(STANDARD_DX_PRESET.workflow.prGuidelines.ciPassRequired).toBe(true);
    });

    it('minimal preset has relaxed settings', () => {
      expect(MINIMAL_DX_PRESET.onboarding.timeToFirstCommitTarget).toBeGreaterThan(8);
      expect(MINIMAL_DX_PRESET.tooling.linting.enabled).toBe(false);
      expect(MINIMAL_DX_PRESET.tooling.formatting.enabled).toBe(false);
      expect(MINIMAL_DX_PRESET.feedbackLoops.errorMessageQuality).toBe('basic');
    });

    it('all presets have valid structure', () => {
      const presets = [WORLD_CLASS_DX_PRESET, STANDARD_DX_PRESET, MINIMAL_DX_PRESET];

      presets.forEach((preset) => {
        expect(preset.name).toBeTruthy();
        expect(preset.version).toBeTruthy();
        expect(preset.onboarding).toBeDefined();
        expect(preset.workflow).toBeDefined();
        expect(preset.tooling).toBeDefined();
        expect(preset.documentation).toBeDefined();
        expect(preset.feedbackLoops).toBeDefined();
      });
    });
  });

  describe('createDXConfig', () => {
    it('creates config from world_class preset', () => {
      const config = createDXConfig('world_class');

      expect(config.name).toBe(WORLD_CLASS_DX_PRESET.name);
      expect(config.onboarding.timeToFirstCommitTarget).toBe(WORLD_CLASS_DX_PRESET.onboarding.timeToFirstCommitTarget);
    });

    it('creates config from standard preset', () => {
      const config = createDXConfig('standard');

      expect(config.name).toBe(STANDARD_DX_PRESET.name);
    });

    it('creates config from minimal preset', () => {
      const config = createDXConfig('minimal');

      expect(config.name).toBe(MINIMAL_DX_PRESET.name);
    });

    it('applies overrides to preset', () => {
      const config = createDXConfig('standard', {
        name: 'Custom Config',
        onboarding: {
          timeToFirstCommitTarget: 2,
        },
      });

      expect(config.name).toBe('Custom Config');
      expect(config.onboarding.timeToFirstCommitTarget).toBe(2);
      // Other settings should be inherited from standard
      expect(config.workflow.branchStrategy).toBe(STANDARD_DX_PRESET.workflow.branchStrategy);
    });

    it('deep merges nested overrides', () => {
      const config = createDXConfig('standard', {
        workflow: {
          codeReview: {
            minReviewers: 3,
          },
        },
      });

      // Override applied
      expect(config.workflow.codeReview.minReviewers).toBe(3);
      // Other code review settings inherited
      expect(config.workflow.codeReview.required).toBe(STANDARD_DX_PRESET.workflow.codeReview.required);
    });

    it('preserves array overrides', () => {
      const config = createDXConfig('standard', {
        workflow: {
          protectedBranches: ['main', 'develop', 'staging'],
        },
      });

      expect(config.workflow.protectedBranches).toEqual(['main', 'develop', 'staging']);
    });
  });

  describe('Integration', () => {
    it('score improves when issues are fixed', () => {
      // Start with minimal config
      const minimalScore = calculateDXScore(MINIMAL_DX_PRESET);

      // Add improvements
      const improvedConfig = createDXConfig('minimal', {
        tooling: {
          linting: {
            enabled: true,
            strict: true,
            autoFix: true,
            customRules: [],
          },
          formatting: {
            enabled: true,
            tool: 'prettier',
            formatOnSave: true,
          },
        },
      });

      const improvedScore = calculateDXScore(improvedConfig);

      expect(improvedScore.overall).toBeGreaterThan(minimalScore.overall);
    });

    it('checklist reflects configuration', () => {
      const withCloudWorkspace = createDXConfig('standard', {
        onboarding: {
          setupAutomation: {
            cloudWorkspaceSupport: true,
          },
        },
      });

      const withoutCloudWorkspace = createDXConfig('standard', {
        onboarding: {
          setupAutomation: {
            cloudWorkspaceSupport: false,
          },
        },
      });

      const scoreWith = calculateDXScore(withCloudWorkspace);
      const scoreWithout = calculateDXScore(withoutCloudWorkspace);

      // Cloud workspace support should improve onboarding score
      expect(scoreWith.breakdown.onboarding).toBeGreaterThanOrEqual(scoreWithout.breakdown.onboarding);
    });

    it('validation issues correlate with lower scores', () => {
      const validConfig = WORLD_CLASS_DX_PRESET;
      const invalidConfig = createDXConfig('minimal', {
        workflow: {
          codeReview: {
            required: false,
            minReviewers: 0,
            slaHours: 168,
            autoAssignment: false,
            checklist: [],
            dismissStaleReviews: false,
          },
          prGuidelines: {
            ciPassRequired: false,
            maxLines: 5000,
            templateRequired: false,
            linkedIssueRequired: false,
            requiredSections: [],
            supportDraftPRs: false,
          },
        },
      });

      const validScore = calculateDXScore(validConfig);
      const invalidScore = calculateDXScore(invalidConfig);
      const validValidation = validateWorkflow(validConfig);
      const invalidValidation = validateWorkflow(invalidConfig);

      expect(validScore.overall).toBeGreaterThan(invalidScore.overall);
      expect(invalidValidation.issues.length).toBeGreaterThan(validValidation.issues.length);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty prerequisites', () => {
      const config = createDXConfig('minimal', {
        onboarding: {
          setupAutomation: {
            prerequisites: [],
          },
        },
      });

      const checklist = generateOnboardingChecklist(config);

      // Should not have prerequisite items
      expect(checklist.items.filter((i) => i.id.startsWith('setup-prereq')).length).toBe(0);
    });

    it('handles no pre-commit hooks', () => {
      const config = createDXConfig('minimal', {
        tooling: {
          preCommitHooks: [],
        },
      });

      const result = validateWorkflow(config);

      // Should warn about missing hooks
      expect(result.issues.some((i) => i.rule === 'pre-commit-hooks')).toBe(true);
    });

    it('handles zero build time target', () => {
      const config = createDXConfig('world_class', {
        feedbackLoops: {
          buildTimeTarget: 0,
        },
      });

      const score = calculateDXScore(config);

      // Should still calculate (0 is unrealistic but valid)
      expect(score.breakdown.feedback).toBeGreaterThan(0);
    });

    it('handles missing optional fields', () => {
      const config: DeveloperExperienceConfig = {
        name: 'Test',
        version: '1.0.0',
        onboarding: {
          timeToFirstCommitTarget: 8,
          setupAutomation: {
            oneCommandBootstrap: false,
            containerized: false,
            cloudWorkspaceSupport: false,
            prerequisites: [],
          },
          documentationRequirements: [],
          mentorshipGuidelines: {
            buddySystemEnabled: false,
            checkInFrequencyDays: 14,
            onboardingTopics: [],
            mentorshipDurationWeeks: 1,
          },
        },
        workflow: {
          branchStrategy: 'github_flow',
          codeReview: {
            required: true,
            minReviewers: 1,
            slaHours: 24,
            autoAssignment: false,
            checklist: [],
            dismissStaleReviews: false,
          },
          commitConventions: {
            convention: 'none',
            enforced: false,
            maxSubjectLength: 100,
            requireBreakingChangeMarker: false,
            requireIssueReference: false,
          },
          prGuidelines: {
            maxLines: 500,
            templateRequired: false,
            linkedIssueRequired: false,
            ciPassRequired: true,
            requiredSections: [],
            supportDraftPRs: false,
          },
          protectedBranches: ['main'],
          allowForcePush: false,
        },
        tooling: {
          ide: {
            recommended: [],
            sharedSettingsProvided: false,
            requiredExtensions: [],
            recommendedExtensions: [],
          },
          linting: {
            enabled: false,
            strict: false,
            autoFix: false,
            customRules: [],
          },
          formatting: {
            enabled: false,
            tool: 'none',
            formatOnSave: false,
          },
          preCommitHooks: [],
          dependencyAutomation: false,
          securityScanning: false,
        },
        documentation: {
          api: {
            required: false,
            tool: 'none',
            autoGenerated: false,
          },
          architecture: {
            required: false,
            adrEnabled: false,
            diagramsRequired: false,
            maxAgeDays: 365,
          },
          readme: {
            sections: [],
            badgesRequired: false,
            examplesRequired: false,
            screenshotsRecommended: false,
          },
          runbooks: {
            required: false,
            requiredSections: [],
            maxAgeDays: 365,
            testingRequired: false,
          },
        },
        feedbackLoops: {
          buildTimeTarget: 120,
          testTimeTarget: 180,
          hotReloadRequired: false,
          errorMessageQuality: 'basic',
          buildCaching: false,
          incrementalBuilds: false,
        },
      };

      // Should not throw
      const score = calculateDXScore(config);
      const checklist = generateOnboardingChecklist(config);
      const validation = validateWorkflow(config);

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(checklist.items.length).toBeGreaterThan(0);
      expect(validation).toBeDefined();
    });
  });
});

// ============================================================================
// WORLD-CLASS DOCUMENTATION STANDARDS TESTS
// ============================================================================

describe('World-Class Documentation Standards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('WORLD_CLASS_DOCS_PRESET', () => {
    it('has complete multi-modal documentation configuration', () => {
      expect(WORLD_CLASS_DOCS_PRESET.multiModal).toBeDefined();
      expect(WORLD_CLASS_DOCS_PRESET.multiModal.written).toBeDefined();
      expect(WORLD_CLASS_DOCS_PRESET.multiModal.visual).toBeDefined();
      expect(WORLD_CLASS_DOCS_PRESET.multiModal.interactive).toBeDefined();
    });

    it('requires essential written documentation files', () => {
      const { requiredFiles } = WORLD_CLASS_DOCS_PRESET.multiModal.written;

      expect(requiredFiles).toContain('README.md');
      expect(requiredFiles).toContain('CONTRIBUTING.md');
      expect(requiredFiles).toContain('CHANGELOG.md');
      expect(requiredFiles.length).toBeGreaterThanOrEqual(5);
    });

    it('requires architecture diagrams', () => {
      const { architectureDiagrams } = WORLD_CLASS_DOCS_PRESET.multiModal.visual;

      expect(architectureDiagrams.length).toBeGreaterThan(0);
      expect(architectureDiagrams.some(d => d.type === 'architecture')).toBe(true);
      expect(architectureDiagrams.some(d => d.required)).toBe(true);
    });

    it('supports multiple diagram tools', () => {
      const { tools } = WORLD_CLASS_DOCS_PRESET.multiModal.visual;

      expect(tools).toContain('mermaid');
      expect(tools.length).toBeGreaterThan(1);
    });

    it('has interactive documentation enabled', () => {
      const { interactive } = WORLD_CLASS_DOCS_PRESET.multiModal;

      expect(interactive.required).toBe(true);
      expect(interactive.playground.enabled).toBe(true);
      expect(interactive.apiExplorer.enabled).toBe(true);
      expect(interactive.codeSnippets.copyButton).toBe(true);
    });

    it('requires tutorials with minimum count', () => {
      const { tutorials } = WORLD_CLASS_DOCS_PRESET.multiModal.interactive;

      expect(tutorials.required).toBe(true);
      expect(tutorials.minCount).toBeGreaterThanOrEqual(3);
      expect(tutorials.requiredTopics.length).toBeGreaterThan(0);
    });

    it('has comprehensive testing configuration', () => {
      const { testing } = WORLD_CLASS_DOCS_PRESET;

      expect(testing.testCodeExamples).toBe(true);
      expect(testing.validateLinks).toBe(true);
      expect(testing.checkScreenshots).toBe(true);
      expect(testing.verifyApiDocs).toBe(true);
    });

    it('has audience-specific content requirements', () => {
      const { audienceContent } = WORLD_CLASS_DOCS_PRESET;

      expect(audienceContent.beginner).toBeDefined();
      expect(audienceContent.intermediate).toBeDefined();
      expect(audienceContent.expert).toBeDefined();
      expect(audienceContent.quickReference).toBeDefined();
    });

    it('has different reading levels for different audiences', () => {
      const { audienceContent } = WORLD_CLASS_DOCS_PRESET;

      expect(audienceContent.beginner.maxReadingLevel).toBeLessThan(
        audienceContent.expert.maxReadingLevel
      );
      expect(audienceContent.intermediate.maxReadingLevel).toBeLessThan(
        audienceContent.expert.maxReadingLevel
      );
    });

    it('requires more examples for beginners', () => {
      const { audienceContent } = WORLD_CLASS_DOCS_PRESET;

      expect(audienceContent.beginner.examples.stepByStep).toBe(true);
      expect(audienceContent.expert.examples.stepByStep).toBe(false);
    });

    it('has freshness guarantees configured', () => {
      const { freshness } = WORLD_CLASS_DOCS_PRESET;

      expect(freshness.maxAgeDays).toBeLessThanOrEqual(90);
      expect(freshness.ownershipRequired).toBe(true);
      expect(freshness.staleness.enabled).toBe(true);
    });

    it('has auto-update hooks configured', () => {
      const { autoUpdateHooks } = WORLD_CLASS_DOCS_PRESET.freshness;

      expect(autoUpdateHooks.length).toBeGreaterThan(0);
      expect(autoUpdateHooks.some(h => h.trigger === 'api_change')).toBe(true);
      expect(autoUpdateHooks.some(h => h.action === 'block_release')).toBe(true);
    });

    it('has discoverability features enabled', () => {
      const { discoverability } = WORLD_CLASS_DOCS_PRESET;

      expect(discoverability.searchOptimization.enabled).toBe(true);
      expect(discoverability.crossLinking.autoLink).toBe(true);
      expect(discoverability.recommendations.enabled).toBe(true);
      expect(discoverability.search.enabled).toBe(true);
    });

    it('has learning paths defined', () => {
      const { learningPaths } = WORLD_CLASS_DOCS_PRESET.discoverability;

      expect(learningPaths.length).toBeGreaterThan(0);
      expect(learningPaths.some(p => p.difficulty === 'beginner')).toBe(true);
      expect(learningPaths.some(p => p.difficulty === 'advanced')).toBe(true);
    });

    it('has learning paths with steps and estimated times', () => {
      const { learningPaths } = WORLD_CLASS_DOCS_PRESET.discoverability;

      for (const path of learningPaths) {
        expect(path.steps.length).toBeGreaterThan(0);
        expect(path.estimatedTime).toBeGreaterThan(0);
        expect(path.steps.every(s => s.estimatedMinutes > 0)).toBe(true);
      }
    });
  });

  describe('validateWorldClassDocs', () => {
    it('validates the preset without errors', () => {
      const result = validateWorldClassDocs(WORLD_CLASS_DOCS_PRESET);

      expect(result.valid).toBe(true);
      expect(result.summary.errors).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.validatedAt).toBe('2026-01-29T12:00:00.000Z');
    });

    it('detects missing architecture diagrams', () => {
      const config = createWorldClassDocsConfig({
        multiModal: {
          visual: {
            architectureDiagrams: [],
            flowDiagrams: [],
            stateMachines: [],
            autoGenerate: true,
            tools: ['mermaid'],
            preferredFormats: ['svg'],
          },
        },
      });

      const result = validateWorldClassDocs(config);

      expect(result.issues.some(i => i.rule === 'architecture-diagrams-required')).toBe(true);
      expect(result.summary.errors).toBeGreaterThan(0);
    });

    it('detects disabled code example testing', () => {
      const config = createWorldClassDocsConfig({
        testing: {
          testCodeExamples: false,
          validateLinks: true,
          checkScreenshots: true,
          verifyApiDocs: true,
          screenshotMaxAgeDays: 90,
          linkTimeoutMs: 10000,
          codeExampleTimeoutMs: 30000,
        },
      });

      const result = validateWorldClassDocs(config);

      expect(result.issues.some(i => i.rule === 'test-code-examples')).toBe(true);
    });

    it('warns about disabled staleness detection', () => {
      const config = createWorldClassDocsConfig({
        freshness: {
          maxAgeDays: 30,
          ownershipRequired: true,
          reviewCadence: 'monthly',
          staleness: {
            enabled: false,
            watchPatterns: [],
            ignorePatterns: [],
            trackDependencies: false,
            alertThresholdDays: 14,
          },
          autoUpdateHooks: [],
          requireLastReviewedDate: true,
          requireVersionTracking: true,
        },
      });

      const result = validateWorldClassDocs(config);

      expect(result.issues.some(i => i.rule === 'staleness-detection')).toBe(true);
    });

    it('warns about too long max age', () => {
      const config = createWorldClassDocsConfig({
        freshness: {
          maxAgeDays: 180,
          ownershipRequired: true,
          reviewCadence: 'quarterly',
          staleness: {
            enabled: true,
            watchPatterns: ['src/**/*.ts'],
            ignorePatterns: [],
            trackDependencies: true,
            alertThresholdDays: 30,
          },
          autoUpdateHooks: [],
          requireLastReviewedDate: true,
          requireVersionTracking: true,
        },
      });

      const result = validateWorldClassDocs(config);

      expect(result.issues.some(i => i.rule === 'max-age')).toBe(true);
    });

    it('warns about disabled search', () => {
      const config = createWorldClassDocsConfig({
        discoverability: {
          searchOptimization: {
            enabled: false,
            requireMetaDescriptions: false,
            requireStructuredData: false,
            generateSitemap: false,
            canonicalUrls: false,
            openGraphTags: false,
            twitterCards: false,
          },
          crossLinking: {
            autoLink: false,
            minLinksPerDoc: 0,
            maxLinksPerDoc: 10,
            requireRelatedDocs: false,
            bidirectionalLinks: false,
            validateOnBuild: false,
          },
          recommendations: {
            enabled: false,
            algorithm: 'content-based',
            maxRecommendations: 5,
            showNextSteps: false,
            showRelatedTopics: false,
            personalize: false,
          },
          learningPaths: [],
          search: {
            enabled: false,
            provider: 'built-in',
            fuzzyMatching: false,
            highlighting: false,
            suggestions: false,
          },
          navigation: {
            breadcrumbs: false,
            tableOfContents: false,
            previousNext: false,
            sidebar: false,
          },
        },
      });

      const result = validateWorldClassDocs(config);

      expect(result.issues.some(i => i.rule === 'search-enabled')).toBe(true);
      expect(result.issues.some(i => i.rule === 'seo-enabled')).toBe(true);
    });

    it('calculates score based on issues', () => {
      const perfectResult = validateWorldClassDocs(WORLD_CLASS_DOCS_PRESET);

      const badConfig = createWorldClassDocsConfig({
        multiModal: {
          visual: {
            architectureDiagrams: [],
            flowDiagrams: [],
            stateMachines: [],
            autoGenerate: false,
            tools: [],
            preferredFormats: [],
          },
        },
        testing: {
          testCodeExamples: false,
          validateLinks: false,
          checkScreenshots: false,
          verifyApiDocs: false,
          screenshotMaxAgeDays: 365,
          linkTimeoutMs: 5000,
          codeExampleTimeoutMs: 10000,
        },
      });

      const badResult = validateWorldClassDocs(badConfig);

      expect(perfectResult.score).toBeGreaterThan(badResult.score);
    });
  });

  describe('createWorldClassDocsConfig', () => {
    it('creates config from preset without overrides', () => {
      const config = createWorldClassDocsConfig();

      expect(config.multiModal.written.requiredFiles).toEqual(
        WORLD_CLASS_DOCS_PRESET.multiModal.written.requiredFiles
      );
    });

    it('applies overrides while preserving defaults', () => {
      const config = createWorldClassDocsConfig({
        testing: {
          testCodeExamples: false,
          validateLinks: true,
          checkScreenshots: true,
          verifyApiDocs: true,
          screenshotMaxAgeDays: 60,
          linkTimeoutMs: 5000,
          codeExampleTimeoutMs: 20000,
        },
      });

      expect(config.testing.testCodeExamples).toBe(false);
      expect(config.testing.screenshotMaxAgeDays).toBe(60);
      // Preserved from preset
      expect(config.multiModal.written.requiredFiles.length).toBeGreaterThan(0);
    });

    it('deep merges nested overrides', () => {
      const config = createWorldClassDocsConfig({
        multiModal: {
          interactive: {
            required: false,
            playground: {
              enabled: false,
            },
            apiExplorer: {
              enabled: true,
              tool: 'redoc',
            },
            codeSnippets: {
              languages: ['rust'],
              copyButton: true,
              lineNumbers: true,
              highlighting: true,
            },
            tutorials: {
              required: false,
              minCount: 1,
              requiredTopics: [],
            },
          },
        },
      });

      expect(config.multiModal.interactive.required).toBe(false);
      expect(config.multiModal.interactive.playground.enabled).toBe(false);
      expect(config.multiModal.interactive.apiExplorer.tool).toBe('redoc');
      // Written config should be preserved
      expect(config.multiModal.written.requiredFiles.length).toBeGreaterThan(0);
    });
  });

  describe('runDocTests', () => {
    it('returns test result structure', () => {
      const testConfig: DocTesting = {
        testCodeExamples: true,
        validateLinks: true,
        checkScreenshots: true,
        verifyApiDocs: true,
        screenshotMaxAgeDays: 90,
        linkTimeoutMs: 10000,
        codeExampleTimeoutMs: 30000,
      };

      const result = runDocTests(testConfig, '/docs');

      expect(result.testedAt).toBe('2026-01-29T12:00:00.000Z');
      expect(result.passed).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.brokenLinks).toEqual([]);
      expect(result.staleScreenshots).toEqual([]);
      expect(result.apiDocMismatches).toEqual([]);
    });
  });

  describe('calculateReadingLevel', () => {
    it('calculates reading level for simple text', () => {
      const simpleText = 'The cat sat on the mat. It was a good day.';
      const level = calculateReadingLevel(simpleText);

      expect(level).toBeLessThan(8);
    });

    it('calculates higher reading level for complex text', () => {
      const complexText = `
        The implementation of comprehensive documentation standards necessitates
        a sophisticated understanding of multi-modal content delivery mechanisms
        and audience segmentation strategies that facilitate optimal knowledge
        transfer across heterogeneous developer populations.
      `;
      const level = calculateReadingLevel(complexText);

      expect(level).toBeGreaterThan(12);
    });

    it('returns 0 for empty text', () => {
      const level = calculateReadingLevel('');

      expect(level).toBe(0);
    });

    it('handles text with special characters', () => {
      const text = 'Hello! How are you? I am fine. Thank you for asking.';
      const level = calculateReadingLevel(text);

      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(20);
    });
  });

  describe('validateContentForAudience', () => {
    const beginnerRequirements: ContentRequirements = {
      requiredSections: ['Overview', 'Installation', 'Quick Start'],
      maxReadingLevel: 8,
      examples: {
        minCount: 3,
        stepByStep: true,
        runnable: true,
        realWorld: false,
        types: ['basic'],
      },
      prerequisites: [],
      technicalDepth: 2,
      conceptualExplanations: true,
      codeComments: true,
      assumedKnowledge: [],
    };

    it('validates content with required sections', () => {
      // Note: The regex looks for markdown headers like "## Section Name"
      const content = `
## Overview
This is an overview.

## Installation
Install the package.

## Quick Start
Get started quickly.
      `;

      const result = validateContentForAudience(content, beginnerRequirements);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('detects missing sections', () => {
      const content = `
## Overview
This is an overview.
      `;

      const result = validateContentForAudience(content, beginnerRequirements);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Installation'))).toBe(true);
      expect(result.issues.some(i => i.includes('Quick Start'))).toBe(true);
    });

    it('detects content exceeding reading level', () => {
      const complexContent = `
## Overview
The implementation of comprehensive documentation standards necessitates
a sophisticated understanding of multi-modal content delivery mechanisms.

## Installation
Installation requires configuration of heterogeneous infrastructure.

## Quick Start
Initialization necessitates comprehensive environmental prerequisites.
      `;

      const result = validateContentForAudience(complexContent, beginnerRequirements);

      expect(result.issues.some(i => i.includes('Reading level'))).toBe(true);
    });
  });

  describe('checkDocFreshness', () => {
    const freshnessConfig: DocFreshness = {
      maxAgeDays: 30,
      ownershipRequired: true,
      reviewCadence: 'monthly',
      staleness: {
        enabled: true,
        watchPatterns: ['src/**/*.ts'],
        ignorePatterns: [],
        trackDependencies: true,
        alertThresholdDays: 14,
      },
      autoUpdateHooks: [],
      requireLastReviewedDate: true,
      requireVersionTracking: true,
    };

    it('detects fresh documents', () => {
      const lastModified = new Date('2026-01-20T12:00:00.000Z');
      const lastReviewed = new Date('2026-01-25T12:00:00.000Z');

      const status = checkDocFreshness('/docs/test.md', lastModified, lastReviewed, freshnessConfig);

      expect(status.isStale).toBe(false);
      expect(status.ageDays).toBeLessThan(freshnessConfig.maxAgeDays);
    });

    it('detects stale documents', () => {
      const lastModified = new Date('2025-12-01T12:00:00.000Z');

      const status = checkDocFreshness('/docs/test.md', lastModified, undefined, freshnessConfig);

      expect(status.isStale).toBe(true);
      expect(status.ageDays).toBeGreaterThan(freshnessConfig.maxAgeDays);
    });

    it('provides recommendations for stale docs', () => {
      const lastModified = new Date('2025-11-01T12:00:00.000Z');

      const status = checkDocFreshness('/docs/test.md', lastModified, undefined, freshnessConfig);

      expect(status.recommendations.length).toBeGreaterThan(0);
      expect(status.recommendations.some(r => r.includes('days old'))).toBe(true);
    });

    it('recommends ownership when required but missing', () => {
      const lastModified = new Date('2026-01-25T12:00:00.000Z');

      const status = checkDocFreshness('/docs/test.md', lastModified, undefined, freshnessConfig);

      expect(status.recommendations.some(r => r.includes('owner'))).toBe(true);
    });
  });

  describe('calculateLearningProgress', () => {
    const learningPath: LearningPath = {
      id: 'test-path',
      name: 'Test Path',
      description: 'A test learning path',
      targetAudience: 'beginner',
      steps: [
        {
          order: 1,
          title: 'Step 1',
          description: 'First step',
          resources: ['doc1.md'],
          estimatedMinutes: 30,
          required: true,
          skillsGained: ['Skill 1'],
        },
        {
          order: 2,
          title: 'Step 2',
          description: 'Second step',
          resources: ['doc2.md'],
          estimatedMinutes: 45,
          required: true,
          skillsGained: ['Skill 2'],
        },
        {
          order: 3,
          title: 'Step 3',
          description: 'Third step',
          resources: ['doc3.md'],
          estimatedMinutes: 60,
          required: false,
          skillsGained: ['Skill 3'],
        },
      ],
      estimatedTime: 135,
      prerequisites: [],
      difficulty: 'beginner',
      tags: ['test'],
    };

    it('calculates 0% progress when no steps completed', () => {
      const progress = calculateLearningProgress(learningPath, []);

      expect(progress.percentComplete).toBe(0);
      expect(progress.remainingTime).toBe(135);
      expect(progress.nextStep?.order).toBe(1);
    });

    it('calculates partial progress', () => {
      const progress = calculateLearningProgress(learningPath, [1]);

      expect(progress.percentComplete).toBe(33);
      expect(progress.remainingTime).toBe(105); // 45 + 60
      expect(progress.nextStep?.order).toBe(2);
    });

    it('calculates 100% progress when all steps completed', () => {
      const progress = calculateLearningProgress(learningPath, [1, 2, 3]);

      expect(progress.percentComplete).toBe(100);
      expect(progress.remainingTime).toBe(0);
      expect(progress.nextStep).toBeUndefined();
    });

    it('prioritizes required steps for next step', () => {
      // Skip optional step 1, complete required step 2
      const progress = calculateLearningProgress(learningPath, [2]);

      // Should suggest required step 1 first
      expect(progress.nextStep?.required).toBe(true);
    });
  });

  describe('Multi-Modal Documentation Types', () => {
    it('supports visual documentation configuration', () => {
      const config = createWorldClassDocsConfig();

      expect(config.multiModal.visual.autoGenerate).toBeDefined();
      expect(Array.isArray(config.multiModal.visual.tools)).toBe(true);
      expect(Array.isArray(config.multiModal.visual.architectureDiagrams)).toBe(true);
    });

    it('supports video documentation configuration', () => {
      const config = createWorldClassDocsConfig({
        multiModal: {
          video: {
            required: true,
            requiredTypes: ['quickstart', 'tutorial', 'demo'],
            platform: 'youtube',
            maxAgeDays: 90,
            captionsRequired: true,
            minQuality: '1080p',
          },
        },
      });

      expect(config.multiModal.video).toBeDefined();
      expect(config.multiModal.video?.required).toBe(true);
      expect(config.multiModal.video?.captionsRequired).toBe(true);
    });

    it('supports interactive documentation playground', () => {
      const config = createWorldClassDocsConfig();

      expect(config.multiModal.interactive.playground.enabled).toBe(true);
      expect(config.multiModal.interactive.playground.platform).toBeDefined();
    });
  });

  describe('Documentation Testing Configuration', () => {
    it('supports all testing options', () => {
      const config = createWorldClassDocsConfig();

      expect(config.testing.testCodeExamples).toBeDefined();
      expect(config.testing.validateLinks).toBeDefined();
      expect(config.testing.checkScreenshots).toBeDefined();
      expect(config.testing.verifyApiDocs).toBeDefined();
      expect(config.testing.screenshotMaxAgeDays).toBeDefined();
      expect(config.testing.linkTimeoutMs).toBeDefined();
      expect(config.testing.codeExampleTimeoutMs).toBeDefined();
    });

    it('supports allowed external domains configuration', () => {
      const config = createWorldClassDocsConfig();

      expect(Array.isArray(config.testing.allowedExternalDomains)).toBe(true);
    });
  });

  describe('Discoverability Features', () => {
    it('supports SEO configuration', () => {
      const config = createWorldClassDocsConfig();

      expect(config.discoverability.searchOptimization.enabled).toBeDefined();
      expect(config.discoverability.searchOptimization.requireMetaDescriptions).toBeDefined();
      expect(config.discoverability.searchOptimization.generateSitemap).toBeDefined();
    });

    it('supports cross-linking configuration', () => {
      const config = createWorldClassDocsConfig();

      expect(config.discoverability.crossLinking.autoLink).toBeDefined();
      expect(config.discoverability.crossLinking.minLinksPerDoc).toBeDefined();
      expect(config.discoverability.crossLinking.bidirectionalLinks).toBeDefined();
    });

    it('supports recommendations configuration', () => {
      const config = createWorldClassDocsConfig();

      expect(config.discoverability.recommendations.enabled).toBeDefined();
      expect(config.discoverability.recommendations.algorithm).toBeDefined();
      expect(config.discoverability.recommendations.maxRecommendations).toBeDefined();
    });

    it('supports navigation configuration', () => {
      const config = createWorldClassDocsConfig();

      expect(config.discoverability.navigation.breadcrumbs).toBeDefined();
      expect(config.discoverability.navigation.tableOfContents).toBeDefined();
      expect(config.discoverability.navigation.previousNext).toBeDefined();
      expect(config.discoverability.navigation.sidebar).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty learning paths', () => {
      const emptyPath: LearningPath = {
        id: 'empty',
        name: 'Empty Path',
        description: '',
        targetAudience: 'beginner',
        steps: [],
        estimatedTime: 0,
        prerequisites: [],
        difficulty: 'beginner',
        tags: [],
      };

      const progress = calculateLearningProgress(emptyPath, []);

      expect(progress.percentComplete).toBe(0);
      expect(progress.remainingTime).toBe(0);
      expect(progress.nextStep).toBeUndefined();
    });

    it('handles single-word text in reading level calculation', () => {
      const level = calculateReadingLevel('Hello');

      expect(level).toBeGreaterThanOrEqual(0);
    });

    it('handles whitespace-only text in reading level calculation', () => {
      const level = calculateReadingLevel('   \n\t  ');

      expect(level).toBe(0);
    });

    it('validates config with minimal overrides', () => {
      const config = createWorldClassDocsConfig({
        freshness: {
          maxAgeDays: 7,
          ownershipRequired: true,
          reviewCadence: 'weekly',
          staleness: {
            enabled: true,
            watchPatterns: ['*.ts'],
            ignorePatterns: [],
            trackDependencies: true,
            alertThresholdDays: 3,
          },
          autoUpdateHooks: [],
          requireLastReviewedDate: true,
          requireVersionTracking: true,
        },
      });

      const result = validateWorldClassDocs(config);

      expect(result.validatedAt).toBe('2026-01-29T12:00:00.000Z');
    });
  });
});
