import { describe, it, expect } from 'vitest';
import {
  // Factory functions
  createStressEvent,
  createImprovement,
  createDecision,
  createOption,
  createBarbellAllocation,
  createFragility,
  createRemoval,
  createOwnership,
  createFeedback,
  createConfidenceAssessment,

  // Utility functions
  calculateAntifragilityScore,
  classifyResponse,
  calculateReversibilityScore,
  prioritizeFragilities,
  calculateReputationFromQuality,
  getReputationLevel,
  isValidStressEventType,
  isValidFragilityType,

  // Preset configurations
  HIGH_RELIABILITY_STRESS_CONFIG,
  STANDARD_STRESS_CONFIG,
  CONSERVATIVE_BARBELL_CONFIG,
  BALANCED_BARBELL_CONFIG,
  AGGRESSIVE_BARBELL_CONFIG,
  THOROUGH_SIMPLIFICATION_CONFIG,
  STANDARD_SIMPLIFICATION_CONFIG,
  STRICT_ACCOUNTABILITY_CONFIG,
  STANDARD_ACCOUNTABILITY_CONFIG,

  // Types
  type StressEvent,
  type StressEventType,
  type ResponseClassification,
  type Improvement,
  type ImprovementType,
  type Decision,
  type Option,
  type Item,
  type Budget,
  type BarbellAllocation,
  type Fragility,
  type FragilityType,
  type Removal,
  type Ownership,
  type OwnershipType,
  type Feedback,
  type FeedbackType,
  type QualityMetrics,
  type ReputationScore,
  type StrengtheningMetrics,
  type ReversibilityScore,
} from '../antifragility.js';

describe('Antifragility Framework', () => {
  // ============================================================================
  // PRESET CONFIGURATIONS
  // ============================================================================

  describe('Preset Configurations', () => {
    describe('Stress Response Configs', () => {
      it('HIGH_RELIABILITY_STRESS_CONFIG is frozen', () => {
        expect(Object.isFrozen(HIGH_RELIABILITY_STRESS_CONFIG)).toBe(true);
      });

      it('HIGH_RELIABILITY_STRESS_CONFIG has stricter thresholds', () => {
        expect(HIGH_RELIABILITY_STRESS_CONFIG.minSeverityToRecord).toBeLessThan(
          STANDARD_STRESS_CONFIG.minSeverityToRecord
        );
        expect(HIGH_RELIABILITY_STRESS_CONFIG.autoAnalyzeThreshold).toBeLessThan(
          STANDARD_STRESS_CONFIG.autoAnalyzeThreshold
        );
        expect(HIGH_RELIABILITY_STRESS_CONFIG.requiredResolutionTime.critical).toBeLessThan(
          STANDARD_STRESS_CONFIG.requiredResolutionTime.critical
        );
      });

      it('HIGH_RELIABILITY_STRESS_CONFIG enables chaos experiments', () => {
        expect(HIGH_RELIABILITY_STRESS_CONFIG.chaosExperimentsEnabled).toBe(true);
        expect(STANDARD_STRESS_CONFIG.chaosExperimentsEnabled).toBe(false);
      });

      it('both configs enable learning loop', () => {
        expect(HIGH_RELIABILITY_STRESS_CONFIG.learningLoopEnabled).toBe(true);
        expect(STANDARD_STRESS_CONFIG.learningLoopEnabled).toBe(true);
      });

      it('HIGH_RELIABILITY requires more metrics', () => {
        expect(HIGH_RELIABILITY_STRESS_CONFIG.requiredMetrics.length).toBeGreaterThan(
          STANDARD_STRESS_CONFIG.requiredMetrics.length
        );
      });
    });

    describe('Barbell Strategy Configs', () => {
      it('all barbell configs are frozen', () => {
        expect(Object.isFrozen(CONSERVATIVE_BARBELL_CONFIG)).toBe(true);
        expect(Object.isFrozen(BALANCED_BARBELL_CONFIG)).toBe(true);
        expect(Object.isFrozen(AGGRESSIVE_BARBELL_CONFIG)).toBe(true);
      });

      it('conservative has highest conservative ratio', () => {
        expect(CONSERVATIVE_BARBELL_CONFIG.conservativeRatio).toBeGreaterThan(
          BALANCED_BARBELL_CONFIG.conservativeRatio
        );
        expect(BALANCED_BARBELL_CONFIG.conservativeRatio).toBeGreaterThan(
          AGGRESSIVE_BARBELL_CONFIG.conservativeRatio
        );
      });

      it('ratios sum to 1', () => {
        expect(CONSERVATIVE_BARBELL_CONFIG.conservativeRatio + CONSERVATIVE_BARBELL_CONFIG.experimentalRatio).toBe(1);
        expect(BALANCED_BARBELL_CONFIG.conservativeRatio + BALANCED_BARBELL_CONFIG.experimentalRatio).toBe(1);
        expect(AGGRESSIVE_BARBELL_CONFIG.conservativeRatio + AGGRESSIVE_BARBELL_CONFIG.experimentalRatio).toBe(1);
      });

      it('conservative has more required safeguards', () => {
        expect(CONSERVATIVE_BARBELL_CONFIG.requiredSafeguards.length).toBeGreaterThan(
          AGGRESSIVE_BARBELL_CONFIG.requiredSafeguards.length
        );
      });

      it('conservative has smaller blast radius', () => {
        expect(CONSERVATIVE_BARBELL_CONFIG.experimentMaxBlastRadius).toBeLessThan(
          BALANCED_BARBELL_CONFIG.experimentMaxBlastRadius
        );
        expect(BALANCED_BARBELL_CONFIG.experimentMaxBlastRadius).toBeLessThan(
          AGGRESSIVE_BARBELL_CONFIG.experimentMaxBlastRadius
        );
      });
    });

    describe('Simplification Configs', () => {
      it('all simplification configs are frozen', () => {
        expect(Object.isFrozen(THOROUGH_SIMPLIFICATION_CONFIG)).toBe(true);
        expect(Object.isFrozen(STANDARD_SIMPLIFICATION_CONFIG)).toBe(true);
      });

      it('thorough has stricter thresholds', () => {
        expect(THOROUGH_SIMPLIFICATION_CONFIG.fragilityThresholds.critical).toBeLessThan(
          STANDARD_SIMPLIFICATION_CONFIG.fragilityThresholds.critical
        );
        expect(THOROUGH_SIMPLIFICATION_CONFIG.complexityThresholds.maxCyclomaticComplexity).toBeLessThan(
          STANDARD_SIMPLIFICATION_CONFIG.complexityThresholds.maxCyclomaticComplexity
        );
      });

      it('thorough requires higher coverage', () => {
        expect(THOROUGH_SIMPLIFICATION_CONFIG.minimumTestCoverage).toBeGreaterThan(
          STANDARD_SIMPLIFICATION_CONFIG.minimumTestCoverage
        );
        expect(THOROUGH_SIMPLIFICATION_CONFIG.minimumDocCoverage).toBeGreaterThan(
          STANDARD_SIMPLIFICATION_CONFIG.minimumDocCoverage
        );
      });

      it('thorough has stricter dependency age limit', () => {
        expect(THOROUGH_SIMPLIFICATION_CONFIG.maxDependencyAge).toBeLessThan(
          STANDARD_SIMPLIFICATION_CONFIG.maxDependencyAge
        );
      });
    });

    describe('Accountability Configs', () => {
      it('all accountability configs are frozen', () => {
        expect(Object.isFrozen(STRICT_ACCOUNTABILITY_CONFIG)).toBe(true);
        expect(Object.isFrozen(STANDARD_ACCOUNTABILITY_CONFIG)).toBe(true);
      });

      it('both require ownership', () => {
        expect(STRICT_ACCOUNTABILITY_CONFIG.requiredOwnership).toBe(true);
        expect(STANDARD_ACCOUNTABILITY_CONFIG.requiredOwnership).toBe(true);
      });

      it('strict has shorter response SLAs', () => {
        expect(STRICT_ACCOUNTABILITY_CONFIG.responseTimeSLA.critical).toBeLessThan(
          STANDARD_ACCOUNTABILITY_CONFIG.responseTimeSLA.critical
        );
        expect(STRICT_ACCOUNTABILITY_CONFIG.responseTimeSLA.high).toBeLessThan(
          STANDARD_ACCOUNTABILITY_CONFIG.responseTimeSLA.high
        );
      });

      it('strict has higher quality requirements', () => {
        expect(STRICT_ACCOUNTABILITY_CONFIG.minimumQualityScore).toBeGreaterThan(
          STANDARD_ACCOUNTABILITY_CONFIG.minimumQualityScore
        );
      });

      it('strict requires feedback', () => {
        expect(STRICT_ACCOUNTABILITY_CONFIG.feedbackRequired).toBe(true);
        expect(STANDARD_ACCOUNTABILITY_CONFIG.feedbackRequired).toBe(false);
      });
    });
  });

  // ============================================================================
  // FACTORY FUNCTIONS
  // ============================================================================

  describe('Factory Functions', () => {
    describe('createStressEvent', () => {
      it('creates a stress event with unique ID', () => {
        const event = createStressEvent({
          type: 'load_spike',
          severity: 0.7,
          affectedComponents: ['api-gateway', 'database'],
          timestamp: new Date(),
          durationMs: 30000,
          deliberate: false,
          metrics: {
            errorRate: 0.05,
            latencyP50Ms: 100,
            latencyP95Ms: 500,
            latencyP99Ms: 1000,
            throughput: 1000,
            cpuUtilization: 0.8,
            memoryUtilization: 0.6,
            customMetrics: {},
          },
          relatedEvents: [],
        });

        expect(event.id).toMatch(/^stress-/);
        expect(event.type).toBe('load_spike');
        expect(event.severity).toBe(0.7);
        expect(event.affectedComponents).toHaveLength(2);
      });

      it('creates unique IDs for different events', () => {
        const event1 = createStressEvent({
          type: 'failure',
          severity: 0.5,
          affectedComponents: [],
          timestamp: new Date(),
          durationMs: 1000,
          deliberate: false,
          metrics: {
            errorRate: 0,
            latencyP50Ms: 0,
            latencyP95Ms: 0,
            latencyP99Ms: 0,
            throughput: 0,
            cpuUtilization: 0,
            memoryUtilization: 0,
            customMetrics: {},
          },
          relatedEvents: [],
        });

        const event2 = createStressEvent({
          type: 'failure',
          severity: 0.5,
          affectedComponents: [],
          timestamp: new Date(),
          durationMs: 1000,
          deliberate: false,
          metrics: {
            errorRate: 0,
            latencyP50Ms: 0,
            latencyP95Ms: 0,
            latencyP99Ms: 0,
            throughput: 0,
            cpuUtilization: 0,
            memoryUtilization: 0,
            customMetrics: {},
          },
          relatedEvents: [],
        });

        expect(event1.id).not.toBe(event2.id);
      });
    });

    describe('createImprovement', () => {
      it('creates an improvement with default status', () => {
        const improvement = createImprovement({
          title: 'Add circuit breaker',
          description: 'Implement circuit breaker pattern for external API calls',
          type: 'circuit_breaker',
          priority: 'high',
          estimatedEffort: {
            hours: 16,
            confidence: 'medium',
            requiredSkills: ['backend'],
            hasExternalDependencies: false,
          },
          expectedImpact: 0.6,
          affectedComponents: ['api-client'],
          motivatingEvents: ['stress-123'],
          implementationSteps: [
            { order: 1, description: 'Add circuit breaker library', optional: false, estimatedHours: 2, dependsOn: [] },
            { order: 2, description: 'Implement wrapper', optional: false, estimatedHours: 8, dependsOn: [1] },
            { order: 3, description: 'Add tests', optional: false, estimatedHours: 4, dependsOn: [2] },
            { order: 4, description: 'Update docs', optional: true, estimatedHours: 2, dependsOn: [2] },
          ],
          verificationCriteria: ['Circuit breaker opens on 5 consecutive failures'],
        });

        expect(improvement.id).toMatch(/^improvement-/);
        expect(improvement.status).toBe('identified');
        expect(improvement.identifiedAt).toBeInstanceOf(Date);
        expect(improvement.type).toBe('circuit_breaker');
        expect(improvement.priority).toBe('high');
      });
    });

    describe('createDecision', () => {
      it('creates a decision with unique ID', () => {
        const decision = createDecision({
          description: 'Choose between PostgreSQL and MongoDB',
          reversible: false,
          alternatives: [
            {
              id: 'postgres',
              name: 'PostgreSQL',
              description: 'Relational database',
              pros: ['ACID compliance', 'Strong ecosystem'],
              cons: ['Less flexible schema'],
              cost: { timeHours: 40, complexity: 0.5, risk: 'low', intangibleCosts: [] },
              reversible: false,
              constraints: [],
            },
            {
              id: 'mongodb',
              name: 'MongoDB',
              description: 'Document database',
              pros: ['Flexible schema'],
              cons: ['Less strict consistency'],
              cost: { timeHours: 30, complexity: 0.4, risk: 'medium', intangibleCosts: [] },
              reversible: false,
              constraints: [],
            },
          ],
          context: {
            domain: 'infrastructure',
            constraints: ['Must support high write throughput'],
            priorDecisions: [],
            stakeholders: ['engineering', 'ops'],
            urgency: 'medium',
          },
          decisionMaker: 'architecture-team',
        });

        expect(decision.id).toMatch(/^decision-/);
        expect(decision.alternatives).toHaveLength(2);
        expect(decision.reversible).toBe(false);
      });
    });

    describe('createOption', () => {
      it('creates an option with unique ID', () => {
        const option = createOption({
          name: 'Multi-cloud deployment',
          description: 'Ability to deploy to multiple cloud providers',
          currentValue: {
            strategicValue: 0.7,
            timeDecay: 'stable',
            uncertainty: 'medium',
            valuableScenarios: ['Vendor lock-in concerns', 'Price negotiation'],
            exerciseProbability: 0.3,
          },
          preservationCost: {
            timeHours: 20,
            complexity: 0.4,
            risk: 'low',
            intangibleCosts: [],
          },
          context: 'infrastructure',
          dependencies: [],
          preserved: false,
          exerciseRequirements: ['Abstract cloud APIs', 'Terraform modules'],
        });

        expect(option.id).toMatch(/^option-/);
        expect(option.name).toBe('Multi-cloud deployment');
        expect(option.preserved).toBe(false);
      });
    });

    describe('createBarbellAllocation', () => {
      const testItems: Item[] = [
        {
          id: 'item-1',
          name: 'Core Database',
          description: 'Main database',
          riskLevel: 0.1,
          potentialUpside: 0.2,
          potentialDownside: 0.1,
          category: 'infrastructure',
          dependencies: [],
        },
        {
          id: 'item-2',
          name: 'Stable API',
          description: 'Production API',
          riskLevel: 0.2,
          potentialUpside: 0.3,
          potentialDownside: 0.1,
          category: 'services',
          dependencies: [],
        },
        {
          id: 'item-3',
          name: 'Experimental ML',
          description: 'ML experiments',
          riskLevel: 0.8,
          potentialUpside: 0.9,
          potentialDownside: 0.7,
          category: 'research',
          dependencies: [],
        },
        {
          id: 'item-4',
          name: 'New Framework',
          description: 'Trying new framework',
          riskLevel: 0.75,
          potentialUpside: 0.8,
          potentialDownside: 0.6,
          category: 'experiments',
          dependencies: [],
        },
      ];

      const testBudget: Budget = {
        total: 100,
        unit: 'percentage',
        conservativeMinimum: 70,
        experimentalMaximum: 30,
        constraints: [],
      };

      it('creates allocation with correct percentages', () => {
        const allocation = createBarbellAllocation(testItems, testBudget, 0.85);

        expect(allocation.conservativePercentage).toBe(85);
        expect(allocation.experimentalPercentage).toBe(15);
      });

      it('categorizes items by risk level', () => {
        const allocation = createBarbellAllocation(testItems, testBudget, 0.85);

        expect(allocation.conservativeItems.length).toBeGreaterThan(0);
        expect(allocation.experimentalItems.length).toBeGreaterThan(0);

        // Conservative items should have low risk
        for (const item of allocation.conservativeItems) {
          expect(item.riskLevel).toBeLessThan(0.3);
        }

        // Experimental items should have high risk
        for (const item of allocation.experimentalItems) {
          expect(item.riskLevel).toBeGreaterThan(0.7);
        }
      });

      it('calculates risk metrics', () => {
        const allocation = createBarbellAllocation(testItems, testBudget, 0.85);

        expect(allocation.riskMetrics).toBeDefined();
        expect(allocation.riskMetrics.maxPotentialLoss).toBeGreaterThanOrEqual(0);
        expect(allocation.riskMetrics.maxPotentialGain).toBeGreaterThanOrEqual(0);
        expect(typeof allocation.riskMetrics.expectedValue).toBe('number');
      });

      it('provides rationale', () => {
        const allocation = createBarbellAllocation(testItems, testBudget, 0.85);

        expect(allocation.rationale).toContain('85%');
        expect(allocation.rationale).toContain('15%');
      });
    });

    describe('createFragility', () => {
      it('creates a fragility with unique ID', () => {
        const fragility = createFragility({
          type: 'single_point_of_failure',
          description: 'Single database instance without replica',
          affectedComponents: ['database'],
          severity: 0.9,
          likelihood: 0.5,
          potentialImpact: 'Complete system outage',
          rootCauses: ['Cost constraints', 'Original MVP architecture'],
          evidence: [
            {
              type: 'code_analysis',
              description: 'Only one database connection configured',
              collectedAt: new Date(),
              source: 'config-analysis',
              confidence: 0.95,
            },
          ],
          trending: 'stable',
          remediationOptions: [
            {
              description: 'Add read replica',
              type: 'add_safeguard',
              effort: { hours: 20, confidence: 'high', requiredSkills: ['dba'], hasExternalDependencies: true },
              expectedRiskReduction: 0.7,
              prerequisites: ['Budget approval'],
              sideEffects: ['Increased cost', 'Replication lag'],
            },
          ],
        });

        expect(fragility.id).toMatch(/^fragility-/);
        expect(fragility.type).toBe('single_point_of_failure');
        expect(fragility.severity).toBe(0.9);
      });
    });

    describe('createRemoval', () => {
      it('creates a removal with proposed status', () => {
        const removal = createRemoval({
          target: 'legacy-auth-service',
          type: 'component',
          reason: 'Replaced by new auth service',
          expectedBenefit: {
            linesRemoved: 5000,
            dependenciesRemoved: 10,
            complexityReduction: 0.3,
            maintenanceReduction: 10,
            riskReduction: 0.5,
            cognitiveLoadReduction: 'significant',
          },
          dependents: ['api-gateway'],
          migrationPath: 'Update API gateway to use new auth service',
        });

        expect(removal.id).toMatch(/^removal-/);
        expect(removal.status).toBe('proposed');
        expect(removal.type).toBe('component');
      });
    });

    describe('createOwnership', () => {
      it('creates primary ownership with default responsibilities', () => {
        const ownership = createOwnership('artifact-123', 'user-456', 'admin-789');

        expect(ownership.artifactId).toBe('artifact-123');
        expect(ownership.ownerId).toBe('user-456');
        expect(ownership.assignedBy).toBe('admin-789');
        expect(ownership.type).toBe('primary');
        expect(ownership.active).toBe(true);
        expect(ownership.responsibilities.length).toBeGreaterThan(0);
        expect(ownership.responsibilities).toContain('Maintain code quality');
      });

      it('creates reviewer ownership with different responsibilities', () => {
        const ownership = createOwnership('artifact-123', 'user-456', 'admin-789', 'reviewer');

        expect(ownership.type).toBe('reviewer');
        expect(ownership.responsibilities).toContain('Review all changes before merge');
      });

      it('initializes metrics at zero', () => {
        const ownership = createOwnership('artifact-123', 'user-456', 'admin-789');

        expect(ownership.metrics.tenureDays).toBe(0);
        expect(ownership.metrics.changesMade).toBe(0);
        expect(ownership.metrics.issuesResolved).toBe(0);
      });
    });

    describe('createFeedback', () => {
      it('creates feedback with unaddressed status', () => {
        const feedback = createFeedback('artifact-123', {
          type: 'bug_report',
          sentiment: 'negative',
          content: 'Memory leak in component X',
          severity: 'major',
          providedBy: 'user-456',
          providedAt: new Date(),
          qualityImpact: -0.1,
        });

        expect(feedback.id).toMatch(/^feedback-/);
        expect(feedback.addressed).toBe(false);
        expect(feedback.type).toBe('bug_report');
        expect(feedback.severity).toBe('major');
      });
    });

    describe('createConfidenceAssessment', () => {
      it('creates verified level for high scores', () => {
        const assessment = createConfidenceAssessment(0.95, [
          { name: 'Production data', contribution: 0.8, evidence: 'Live metrics' },
        ]);

        expect(assessment.level).toBe('verified');
        expect(assessment.score).toBe(0.95);
      });

      it('creates established level for medium-high scores', () => {
        const assessment = createConfidenceAssessment(0.75, [
          { name: 'Test data', contribution: 0.6, evidence: 'Integration tests' },
        ]);

        expect(assessment.level).toBe('established');
      });

      it('creates speculative level for low scores', () => {
        const assessment = createConfidenceAssessment(0.35, [
          { name: 'Inference', contribution: 0.3, evidence: 'LLM analysis' },
        ]);

        expect(assessment.level).toBe('speculative');
      });

      it('assigns quality based on contribution', () => {
        const assessment = createConfidenceAssessment(0.8, [
          { name: 'Strong evidence', contribution: 0.8, evidence: 'Strong' },
          { name: 'Moderate evidence', contribution: 0.5, evidence: 'Moderate' },
          { name: 'Weak evidence', contribution: 0.2, evidence: 'Weak' },
        ]);

        expect(assessment.factors[0].quality).toBe('strong');
        expect(assessment.factors[1].quality).toBe('moderate');
        expect(assessment.factors[2].quality).toBe('weak');
      });
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  describe('Utility Functions', () => {
    describe('calculateAntifragilityScore', () => {
      it('calculates score from strengthening metrics', () => {
        const metrics: StrengtheningMetrics = {
          systemId: 'test-system',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-03-01'),
          stressEventCount: 10,
          eventTypeDistribution: { load_spike: 5, failure: 3, attack: 2 } as Record<StressEventType, number>,
          averageResponseQuality: 0.8,
          responseQualityTrend: 0.2,
          improvementsImplemented: 5,
          improvementsVerified: 4,
          meanTimeToDetectMs: 30000,
          mttdTrend: -0.1,
          meanTimeToResolveMs: 120000,
          mttrTrend: -0.2,
          recurringPatterns: [],
          antifragilityScore: 0,
          confidence: createConfidenceAssessment(0.85, []),
        };

        const score = calculateAntifragilityScore(metrics);

        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      it('returns higher score for better metrics', () => {
        const goodMetrics: StrengtheningMetrics = {
          systemId: 'good-system',
          periodStart: new Date(),
          periodEnd: new Date(),
          stressEventCount: 10,
          eventTypeDistribution: {} as Record<StressEventType, number>,
          averageResponseQuality: 0.9,
          responseQualityTrend: 0.3,
          improvementsImplemented: 10,
          improvementsVerified: 9,
          meanTimeToDetectMs: 10000,
          mttdTrend: -0.2,
          meanTimeToResolveMs: 60000,
          mttrTrend: -0.3,
          recurringPatterns: [],
          antifragilityScore: 0,
          confidence: createConfidenceAssessment(0.9, []),
        };

        const poorMetrics: StrengtheningMetrics = {
          systemId: 'poor-system',
          periodStart: new Date(),
          periodEnd: new Date(),
          stressEventCount: 10,
          eventTypeDistribution: {} as Record<StressEventType, number>,
          averageResponseQuality: 0.3,
          responseQualityTrend: -0.2,
          improvementsImplemented: 10,
          improvementsVerified: 2,
          meanTimeToDetectMs: 300000,
          mttdTrend: 0.1,
          meanTimeToResolveMs: 900000,
          mttrTrend: 0.2,
          recurringPatterns: [],
          antifragilityScore: 0,
          confidence: createConfidenceAssessment(0.5, []),
        };

        expect(calculateAntifragilityScore(goodMetrics)).toBeGreaterThan(
          calculateAntifragilityScore(poorMetrics)
        );
      });
    });

    describe('classifyResponse', () => {
      it('classifies antifragile for highest scores', () => {
        expect(classifyResponse(0.95)).toBe('antifragile');
        expect(classifyResponse(0.9)).toBe('antifragile');
      });

      it('classifies resilient for high scores', () => {
        expect(classifyResponse(0.85)).toBe('resilient');
        expect(classifyResponse(0.75)).toBe('resilient');
      });

      it('classifies robust for medium scores', () => {
        expect(classifyResponse(0.6)).toBe('robust');
        expect(classifyResponse(0.5)).toBe('robust');
      });

      it('classifies fragile for low scores', () => {
        expect(classifyResponse(0.4)).toBe('fragile');
        expect(classifyResponse(0.25)).toBe('fragile');
      });

      it('classifies catastrophic for lowest scores', () => {
        expect(classifyResponse(0.2)).toBe('catastrophic');
        expect(classifyResponse(0.1)).toBe('catastrophic');
      });
    });

    describe('calculateReversibilityScore', () => {
      it('returns high score for reversible decisions', () => {
        const decision = createDecision({
          description: 'Choose feature flag library',
          reversible: true,
          reversalCost: {
            timeHours: 4,
            complexity: 0.2,
            risk: 'low',
            intangibleCosts: [],
          },
          alternatives: [
            { id: 'a', name: 'A', description: '', pros: [], cons: [], cost: { timeHours: 8, complexity: 0.3, risk: 'low', intangibleCosts: [] }, reversible: true, constraints: [] },
            { id: 'b', name: 'B', description: '', pros: [], cons: [], cost: { timeHours: 8, complexity: 0.3, risk: 'low', intangibleCosts: [] }, reversible: true, constraints: [] },
          ],
          context: { domain: 'tooling', constraints: [], priorDecisions: [], stakeholders: [], urgency: 'low' },
          decisionMaker: 'team',
        });

        const score = calculateReversibilityScore(decision);

        expect(score.score).toBeGreaterThan(0.6);
        expect(score.classification).toMatch(/reversible/);
      });

      it('returns low score for irreversible decisions', () => {
        const decision = createDecision({
          description: 'Choose primary programming language',
          reversible: false,
          alternatives: [],
          context: { domain: 'core', constraints: [], priorDecisions: [], stakeholders: [], urgency: 'high' },
          decisionMaker: 'leadership',
        });

        const score = calculateReversibilityScore(decision);

        expect(score.score).toBeLessThan(0.5);
        expect(['one_way_door', 'irreversible', 'partially_reversible']).toContain(score.classification);
      });

      it('provides recommendations for low-score decisions', () => {
        const decision = createDecision({
          description: 'Database choice',
          reversible: false,
          alternatives: [],
          context: { domain: 'data', constraints: [], priorDecisions: [], stakeholders: [], urgency: 'medium' },
          decisionMaker: 'team',
        });

        const score = calculateReversibilityScore(decision);

        expect(score.recommendations.length).toBeGreaterThan(0);
      });

      it('includes reversal window for low-risk decisions', () => {
        const decision = createDecision({
          description: 'Test framework',
          reversible: true,
          reversalCost: { timeHours: 10, complexity: 0.3, risk: 'low', intangibleCosts: [] },
          alternatives: [
            { id: 'a', name: 'A', description: '', pros: [], cons: [], cost: { timeHours: 8, complexity: 0.3, risk: 'low', intangibleCosts: [] }, reversible: true, constraints: [] },
          ],
          context: { domain: 'testing', constraints: [], priorDecisions: [], stakeholders: [], urgency: 'low' },
          decisionMaker: 'team',
        });

        const score = calculateReversibilityScore(decision);

        expect(score.reversalWindow).toBeDefined();
      });
    });

    describe('prioritizeFragilities', () => {
      it('sorts by risk (severity * likelihood)', () => {
        const fragilities: Fragility[] = [
          createFragility({
            type: 'complexity',
            description: 'Low risk',
            affectedComponents: [],
            severity: 0.3,
            likelihood: 0.3,
            potentialImpact: '',
            rootCauses: [],
            evidence: [],
            trending: 'stable',
            remediationOptions: [],
          }),
          createFragility({
            type: 'single_point_of_failure',
            description: 'High risk',
            affectedComponents: [],
            severity: 0.9,
            likelihood: 0.8,
            potentialImpact: '',
            rootCauses: [],
            evidence: [],
            trending: 'stable',
            remediationOptions: [],
          }),
          createFragility({
            type: 'technical_debt',
            description: 'Medium risk',
            affectedComponents: [],
            severity: 0.5,
            likelihood: 0.5,
            potentialImpact: '',
            rootCauses: [],
            evidence: [],
            trending: 'stable',
            remediationOptions: [],
          }),
        ];

        const sorted = prioritizeFragilities(fragilities);

        expect(sorted[0].description).toBe('High risk');
        expect(sorted[1].description).toBe('Medium risk');
        expect(sorted[2].description).toBe('Low risk');
      });

      it('prioritizes worsening trends for equal risk', () => {
        const fragilities: Fragility[] = [
          createFragility({
            type: 'complexity',
            description: 'Stable',
            affectedComponents: [],
            severity: 0.5,
            likelihood: 0.5,
            potentialImpact: '',
            rootCauses: [],
            evidence: [],
            trending: 'stable',
            remediationOptions: [],
          }),
          createFragility({
            type: 'complexity',
            description: 'Worsening',
            affectedComponents: [],
            severity: 0.5,
            likelihood: 0.5,
            potentialImpact: '',
            rootCauses: [],
            evidence: [],
            trending: 'worsening',
            remediationOptions: [],
          }),
        ];

        const sorted = prioritizeFragilities(fragilities);

        expect(sorted[0].description).toBe('Worsening');
      });

      it('prioritizes SPOFs for equal risk and trend', () => {
        const fragilities: Fragility[] = [
          createFragility({
            type: 'complexity',
            description: 'Not SPOF',
            affectedComponents: [],
            severity: 0.5,
            likelihood: 0.5,
            potentialImpact: '',
            rootCauses: [],
            evidence: [],
            trending: 'stable',
            remediationOptions: [],
          }),
          createFragility({
            type: 'single_point_of_failure',
            description: 'SPOF',
            affectedComponents: [],
            severity: 0.5,
            likelihood: 0.5,
            potentialImpact: '',
            rootCauses: [],
            evidence: [],
            trending: 'stable',
            remediationOptions: [],
          }),
        ];

        const sorted = prioritizeFragilities(fragilities);

        expect(sorted[0].type).toBe('single_point_of_failure');
      });
    });

    describe('calculateReputationFromQuality', () => {
      it('calculates reputation from quality metrics', () => {
        const metrics: QualityMetrics = {
          authorId: 'user-123',
          periodStart: new Date(),
          periodEnd: new Date(),
          totalArtifacts: 50,
          averageQuality: 0.85,
          bugRate: 0.05,
          reworkRate: 0.1,
          feedbackIncorporationRate: 0.9,
          reviewAcceptanceRate: 0.95,
          documentationCompleteness: 0.8,
          testCoverage: 0.85,
          breakdownByType: {},
          trend: 'improving',
        };

        const score = calculateReputationFromQuality(metrics);

        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      it('returns higher score for better metrics', () => {
        const goodMetrics: QualityMetrics = {
          authorId: 'user-123',
          periodStart: new Date(),
          periodEnd: new Date(),
          totalArtifacts: 50,
          averageQuality: 0.95,
          bugRate: 0.01,
          reworkRate: 0.02,
          feedbackIncorporationRate: 0.98,
          reviewAcceptanceRate: 0.99,
          documentationCompleteness: 0.95,
          testCoverage: 0.95,
          breakdownByType: {},
          trend: 'improving',
        };

        const poorMetrics: QualityMetrics = {
          authorId: 'user-456',
          periodStart: new Date(),
          periodEnd: new Date(),
          totalArtifacts: 50,
          averageQuality: 0.4,
          bugRate: 0.3,
          reworkRate: 0.4,
          feedbackIncorporationRate: 0.3,
          reviewAcceptanceRate: 0.5,
          documentationCompleteness: 0.2,
          testCoverage: 0.3,
          breakdownByType: {},
          trend: 'declining',
        };

        expect(calculateReputationFromQuality(goodMetrics)).toBeGreaterThan(
          calculateReputationFromQuality(poorMetrics)
        );
      });
    });

    describe('getReputationLevel', () => {
      it('returns Distinguished for highest scores', () => {
        const level = getReputationLevel(0.95);
        expect(level.name).toBe('Distinguished');
        expect(level.level).toBe(5);
      });

      it('returns Senior for high scores', () => {
        const level = getReputationLevel(0.8);
        expect(level.name).toBe('Senior');
        expect(level.level).toBe(4);
      });

      it('returns Established for medium scores', () => {
        const level = getReputationLevel(0.65);
        expect(level.name).toBe('Established');
        expect(level.level).toBe(3);
      });

      it('returns Contributing for lower scores', () => {
        const level = getReputationLevel(0.45);
        expect(level.name).toBe('Contributing');
        expect(level.level).toBe(2);
      });

      it('returns Newcomer for lowest scores', () => {
        const level = getReputationLevel(0.2);
        expect(level.name).toBe('Newcomer');
        expect(level.level).toBe(1);
      });

      it('includes privileges', () => {
        const level = getReputationLevel(0.95);
        expect(level.privileges.length).toBeGreaterThan(0);
      });

      it('calculates points to next level', () => {
        const level = getReputationLevel(0.5);
        expect(level.pointsToNextLevel).toBeGreaterThan(0);
      });
    });

    describe('isValidStressEventType', () => {
      it('returns true for valid types', () => {
        expect(isValidStressEventType('load_spike')).toBe(true);
        expect(isValidStressEventType('failure')).toBe(true);
        expect(isValidStressEventType('attack')).toBe(true);
        expect(isValidStressEventType('chaos_experiment')).toBe(true);
        expect(isValidStressEventType('resource_exhaustion')).toBe(true);
        expect(isValidStressEventType('dependency_failure')).toBe(true);
        expect(isValidStressEventType('data_corruption')).toBe(true);
        expect(isValidStressEventType('network_partition')).toBe(true);
      });

      it('returns false for invalid types', () => {
        expect(isValidStressEventType('invalid')).toBe(false);
        expect(isValidStressEventType('')).toBe(false);
        expect(isValidStressEventType('LOAD_SPIKE')).toBe(false);
      });
    });

    describe('isValidFragilityType', () => {
      it('returns true for valid types', () => {
        expect(isValidFragilityType('single_point_of_failure')).toBe(true);
        expect(isValidFragilityType('tight_coupling')).toBe(true);
        expect(isValidFragilityType('hidden_dependency')).toBe(true);
        expect(isValidFragilityType('complexity')).toBe(true);
        expect(isValidFragilityType('technical_debt')).toBe(true);
        expect(isValidFragilityType('security_vulnerability')).toBe(true);
      });

      it('returns false for invalid types', () => {
        expect(isValidFragilityType('invalid')).toBe(false);
        expect(isValidFragilityType('')).toBe(false);
        expect(isValidFragilityType('SPOF')).toBe(false);
      });
    });
  });

  // ============================================================================
  // TYPE SAFETY AND EDGE CASES
  // ============================================================================

  describe('Type Safety and Edge Cases', () => {
    it('handles empty arrays in barbell allocation', () => {
      const budget: Budget = { total: 100, unit: 'percentage', conservativeMinimum: 70, experimentalMaximum: 30, constraints: [] };
      const allocation = createBarbellAllocation([], budget);

      expect(allocation.conservativeItems).toHaveLength(0);
      expect(allocation.experimentalItems).toHaveLength(0);
      expect(allocation.totalAllocated).toBe(0);
    });

    it('handles items without clear categorization', () => {
      const moderateItems: Item[] = [
        {
          id: 'item-1',
          name: 'Moderate Risk',
          description: '',
          riskLevel: 0.5,
          potentialUpside: 0.5,
          potentialDownside: 0.5,
          category: 'general',
          dependencies: [],
        },
      ];
      const budget: Budget = { total: 100, unit: 'percentage', conservativeMinimum: 70, experimentalMaximum: 30, constraints: [] };

      const allocation = createBarbellAllocation(moderateItems, budget);

      // Moderate items should not appear in either extreme category
      expect(allocation.conservativeItems).toHaveLength(0);
      expect(allocation.experimentalItems).toHaveLength(0);
    });

    it('creates valid ownership for all types', () => {
      const types: OwnershipType[] = ['primary', 'secondary', 'reviewer', 'consulted', 'informed'];

      for (const type of types) {
        const ownership = createOwnership('artifact', 'owner', 'assigner', type);
        expect(ownership.type).toBe(type);
        expect(ownership.responsibilities.length).toBeGreaterThan(0);
      }
    });

    it('calculates reversibility for edge case decisions', () => {
      // Decision with no alternatives
      const noAlts = createDecision({
        description: 'No alternatives',
        reversible: true,
        alternatives: [],
        context: { domain: 'test', constraints: [], priorDecisions: [], stakeholders: [], urgency: 'low' },
        decisionMaker: 'test',
      });

      const score = calculateReversibilityScore(noAlts);
      expect(score.score).toBeGreaterThan(0);
      expect(score.factors.length).toBeGreaterThan(0);
    });

    it('prioritizes empty fragility list', () => {
      const sorted = prioritizeFragilities([]);
      expect(sorted).toHaveLength(0);
    });

    it('handles single fragility in prioritization', () => {
      const fragility = createFragility({
        type: 'complexity',
        description: 'Single',
        affectedComponents: [],
        severity: 0.5,
        likelihood: 0.5,
        potentialImpact: '',
        rootCauses: [],
        evidence: [],
        trending: 'stable',
        remediationOptions: [],
      });

      const sorted = prioritizeFragilities([fragility]);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].description).toBe('Single');
    });

    it('creates feedback with all severity levels', () => {
      const severities: Array<'critical' | 'major' | 'minor' | 'suggestion'> = ['critical', 'major', 'minor', 'suggestion'];

      for (const severity of severities) {
        const feedback = createFeedback('artifact', {
          type: 'bug_report',
          sentiment: 'negative',
          content: `${severity} issue`,
          severity,
          providedBy: 'user',
          providedAt: new Date(),
          qualityImpact: -0.1,
        });

        expect(feedback.severity).toBe(severity);
      }
    });

    it('creates improvements for all types', () => {
      const types: ImprovementType[] = [
        'redundancy', 'circuit_breaker', 'bulkhead', 'timeout', 'retry',
        'cache', 'monitoring', 'capacity', 'degradation', 'documentation',
        'testing', 'architecture',
      ];

      for (const type of types) {
        const improvement = createImprovement({
          title: `${type} improvement`,
          description: '',
          type,
          priority: 'medium',
          estimatedEffort: { hours: 10, confidence: 'medium', requiredSkills: [], hasExternalDependencies: false },
          expectedImpact: 0.5,
          affectedComponents: [],
          motivatingEvents: [],
          implementationSteps: [],
          verificationCriteria: [],
        });

        expect(improvement.type).toBe(type);
      }
    });
  });

  // ============================================================================
  // INTEGRATION SCENARIOS
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('complete stress response workflow', () => {
      // 1. Create stress event
      const event = createStressEvent({
        type: 'load_spike',
        severity: 0.7,
        affectedComponents: ['api-gateway', 'auth-service'],
        timestamp: new Date(),
        durationMs: 120000,
        deliberate: false,
        metrics: {
          errorRate: 0.15,
          latencyP50Ms: 200,
          latencyP95Ms: 1000,
          latencyP99Ms: 3000,
          throughput: 500,
          cpuUtilization: 0.95,
          memoryUtilization: 0.85,
          customMetrics: { queueDepth: 10000 },
        },
        relatedEvents: [],
      });

      expect(event.id).toBeDefined();

      // 2. Create improvement based on event
      const improvement = createImprovement({
        title: 'Add rate limiting to API gateway',
        description: 'Implement rate limiting to prevent overload',
        type: 'capacity',
        priority: 'high',
        estimatedEffort: { hours: 24, confidence: 'high', requiredSkills: ['backend', 'infra'], hasExternalDependencies: false },
        expectedImpact: 0.7,
        affectedComponents: ['api-gateway'],
        motivatingEvents: [event.id],
        implementationSteps: [
          { order: 1, description: 'Choose rate limiting strategy', optional: false, estimatedHours: 4, dependsOn: [] },
          { order: 2, description: 'Implement limiter', optional: false, estimatedHours: 12, dependsOn: [1] },
          { order: 3, description: 'Add monitoring', optional: false, estimatedHours: 4, dependsOn: [2] },
          { order: 4, description: 'Load test', optional: false, estimatedHours: 4, dependsOn: [2] },
        ],
        verificationCriteria: ['Rate limiter triggers at configured threshold', 'Graceful degradation under load'],
      });

      expect(improvement.motivatingEvents).toContain(event.id);
      expect(improvement.status).toBe('identified');
    });

    it('complete optionality workflow', () => {
      // 1. Create decision
      const decision = createDecision({
        description: 'Choose between monolith and microservices',
        reversible: false,
        reversalCost: { timeHours: 2000, complexity: 0.9, risk: 'critical', intangibleCosts: ['Team restructuring', 'Lost momentum'] },
        alternatives: [
          { id: 'monolith', name: 'Monolith', description: 'Single deployable', pros: ['Simplicity'], cons: ['Scaling limits'], cost: { timeHours: 100, complexity: 0.3, risk: 'low', intangibleCosts: [] }, reversible: true, constraints: [] },
          { id: 'microservices', name: 'Microservices', description: 'Distributed', pros: ['Scalability'], cons: ['Complexity'], cost: { timeHours: 500, complexity: 0.7, risk: 'medium', intangibleCosts: [] }, reversible: false, constraints: [] },
        ],
        context: { domain: 'architecture', constraints: ['Must support 10x growth'], priorDecisions: [], stakeholders: ['engineering', 'product'], urgency: 'medium' },
        decisionMaker: 'architecture-council',
      });

      // 2. Assess reversibility
      const reversibility = calculateReversibilityScore(decision);

      expect(reversibility.score).toBeLessThan(0.5);
      expect(reversibility.recommendations.length).toBeGreaterThan(0);

      // 3. Create options to preserve
      const option = createOption({
        name: 'Modular monolith path',
        description: 'Keep monolith but with clean module boundaries for future extraction',
        currentValue: { strategicValue: 0.8, timeDecay: 'decreasing', uncertainty: 'medium', valuableScenarios: ['Need to scale specific component'], exerciseProbability: 0.4 },
        preservationCost: { timeHours: 50, complexity: 0.4, risk: 'low', intangibleCosts: [] },
        context: 'architecture',
        dependencies: [],
        preserved: false,
        exerciseRequirements: ['Define module boundaries', 'Enforce dependency rules'],
      });

      expect(option.preserved).toBe(false);
      expect(option.currentValue.strategicValue).toBeGreaterThan(0.5);
    });

    it('complete via negativa workflow', () => {
      // 1. Identify fragility
      const fragility = createFragility({
        type: 'outdated_dependency',
        description: 'Using lodash 3.x with known vulnerabilities',
        affectedComponents: ['utils', 'data-processing'],
        severity: 0.6,
        likelihood: 0.4,
        potentialImpact: 'Security vulnerability, performance issues',
        rootCauses: ['Delayed upgrades', 'Fear of breaking changes'],
        evidence: [
          { type: 'dependency_scan', description: '5 known CVEs', collectedAt: new Date(), source: 'npm audit', confidence: 0.95 },
        ],
        trending: 'worsening',
        remediationOptions: [
          { description: 'Upgrade to lodash 4.x', type: 'replace', effort: { hours: 16, confidence: 'medium', requiredSkills: ['frontend'], hasExternalDependencies: false }, expectedRiskReduction: 0.9, prerequisites: ['Compatibility testing'], sideEffects: ['May break existing code'] },
          { description: 'Replace with native methods', type: 'remove', effort: { hours: 40, confidence: 'low', requiredSkills: ['frontend'], hasExternalDependencies: false }, expectedRiskReduction: 1.0, prerequisites: ['Comprehensive tests'], sideEffects: ['More code initially'] },
        ],
      });

      // 2. Prioritize
      const fragilities = prioritizeFragilities([fragility]);
      expect(fragilities[0].id).toBe(fragility.id);

      // 3. Create removal
      const removal = createRemoval({
        target: 'lodash@3.x',
        type: 'dependency',
        reason: 'Replace with native methods to eliminate vulnerability and reduce bundle size',
        associatedFragility: fragility.id,
        expectedBenefit: {
          linesRemoved: 0,
          dependenciesRemoved: 1,
          complexityReduction: 0.1,
          maintenanceReduction: 2,
          riskReduction: 0.6,
          cognitiveLoadReduction: 'minimal',
        },
        dependents: ['utils', 'data-processing'],
        migrationPath: 'Replace each lodash usage with native equivalent',
      });

      expect(removal.status).toBe('proposed');
      expect(removal.associatedFragility).toBe(fragility.id);
    });

    it('complete accountability workflow', () => {
      // 1. Assign ownership
      const ownership = createOwnership('critical-service', 'senior-dev', 'tech-lead', 'primary');

      expect(ownership.active).toBe(true);
      expect(ownership.type).toBe('primary');

      // 2. Create feedback
      const feedback = createFeedback('critical-service', {
        type: 'bug_report',
        sentiment: 'negative',
        content: 'Service crashes under high load',
        severity: 'critical',
        providedBy: 'on-call-eng',
        providedAt: new Date(),
        qualityImpact: -0.2,
      });

      expect(feedback.addressed).toBe(false);

      // 3. Simulate quality metrics
      const metrics: QualityMetrics = {
        authorId: 'senior-dev',
        periodStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        totalArtifacts: 25,
        averageQuality: 0.75,
        bugRate: 0.12,
        reworkRate: 0.15,
        feedbackIncorporationRate: 0.85,
        reviewAcceptanceRate: 0.9,
        documentationCompleteness: 0.7,
        testCoverage: 0.8,
        breakdownByType: {},
        trend: 'stable',
      };

      // 4. Calculate reputation
      const reputation = calculateReputationFromQuality(metrics);
      const level = getReputationLevel(reputation);

      expect(reputation).toBeGreaterThan(0);
      expect(level.level).toBeGreaterThanOrEqual(1);
      expect(level.privileges.length).toBeGreaterThan(0);
    });
  });
});
