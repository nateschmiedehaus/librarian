import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // ADR
  createADR,
  updateADR,
  supersedeADR,
  type ArchitectureDecisionRecord,
  type AdfStatus,
  type Alternative,

  // Trade-off Analysis
  createTradeoffAnalysis,
  compareOptions,
  DEFAULT_TRADEOFF_WEIGHTS,
  type QualityAttribute,
  type TradeoffAnalysis,

  // Constraint Validation
  validateLayerDependency,
  validateNamingConvention,
  validateCircularDependencies,
  type ArchitectureConstraint,
  type ConstraintViolation,

  // Drift Detection
  calculateTechnicalDebt,
  generateDriftReport,
  type ArchitectureDriftReport,

  // Pattern Recommendations
  createPatternRecommendation,
  checkPatternApplicability,
  type PatternRecommendation,

  // Built-in Constraints
  CLEAN_ARCHITECTURE_CONSTRAINTS,
  NAMING_CONVENTION_CONSTRAINTS,
} from '../architecture_decisions.js';
import { absent, bounded, deterministic } from '../../epistemics/confidence.js';

describe('Architecture Decision Records (ADR)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createADR', () => {
    it('creates an ADR with minimal input', () => {
      const adr = createADR({
        id: 'ADR-001',
        title: 'Use TypeScript',
        context: 'Need type safety',
        decision: 'Use TypeScript for all new code',
      });

      expect(adr.id).toBe('ADR-001');
      expect(adr.title).toBe('Use TypeScript');
      expect(adr.status).toBe('proposed');
      expect(adr.context).toBe('Need type safety');
      expect(adr.decision).toBe('Use TypeScript for all new code');
      expect(adr.consequences.positive).toEqual([]);
      expect(adr.consequences.negative).toEqual([]);
      expect(adr.consequences.neutral).toEqual([]);
      expect(adr.alternatives).toEqual([]);
      expect(adr.confidence.type).toBe('absent');
      expect(adr.evidenceRefs).toEqual([]);
      expect(adr.createdAt.toISOString()).toBe('2026-01-29T10:00:00.000Z');
      expect(adr.updatedAt.toISOString()).toBe('2026-01-29T10:00:00.000Z');
    });

    it('creates an ADR with full input', () => {
      const alternatives: Alternative[] = [
        {
          description: 'Use JavaScript with JSDoc',
          pros: ['No build step', 'Familiar syntax'],
          cons: ['Weaker type checking', 'Less IDE support'],
          whyRejected: 'Type safety is critical for this project',
        },
      ];

      const adr = createADR({
        id: 'ADR-002',
        title: 'Use Event Sourcing',
        context: 'Need full audit trail',
        decision: 'Implement event sourcing for order management',
        status: 'accepted',
        consequences: {
          positive: ['Full audit trail', 'Event replay'],
          negative: ['Increased complexity'],
          neutral: ['New team skills needed'],
        },
        alternatives,
        confidence: bounded(0.7, 0.9, 'literature', 'Fowler CQRS pattern'),
        evidenceRefs: ['RFC-2024-001', 'spike-results.md'],
        supersedes: 'ADR-001',
      });

      expect(adr.status).toBe('accepted');
      expect(adr.consequences.positive).toContain('Full audit trail');
      expect(adr.consequences.negative).toContain('Increased complexity');
      expect(adr.alternatives).toHaveLength(1);
      expect(adr.alternatives[0]?.description).toBe('Use JavaScript with JSDoc');
      expect(adr.confidence.type).toBe('bounded');
      expect(adr.evidenceRefs).toContain('RFC-2024-001');
      expect(adr.supersedes).toBe('ADR-001');
    });
  });

  describe('updateADR', () => {
    it('updates specific fields and timestamp', () => {
      const original = createADR({
        id: 'ADR-001',
        title: 'Original Title',
        context: 'Original context',
        decision: 'Original decision',
      });

      vi.setSystemTime(new Date('2026-01-29T11:00:00.000Z'));

      const updated = updateADR(original, {
        title: 'Updated Title',
        status: 'accepted',
      });

      expect(updated.id).toBe('ADR-001');
      expect(updated.title).toBe('Updated Title');
      expect(updated.status).toBe('accepted');
      expect(updated.context).toBe('Original context');
      expect(updated.createdAt.toISOString()).toBe('2026-01-29T10:00:00.000Z');
      expect(updated.updatedAt.toISOString()).toBe('2026-01-29T11:00:00.000Z');
    });
  });

  describe('supersedeADR', () => {
    it('links old and new ADRs correctly', () => {
      const oldAdr = createADR({
        id: 'ADR-001',
        title: 'Old Decision',
        context: 'Original context',
        decision: 'Original decision',
        status: 'accepted',
      });

      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));

      const newAdr = createADR({
        id: 'ADR-002',
        title: 'New Decision',
        context: 'Updated context',
        decision: 'New decision',
      });

      const [updatedOld, updatedNew] = supersedeADR(oldAdr, newAdr);

      expect(updatedOld.status).toBe('superseded');
      expect(updatedOld.supersededBy).toBe('ADR-002');
      expect(updatedNew.supersedes).toBe('ADR-001');
    });
  });
});

describe('Trade-off Analysis', () => {
  describe('createTradeoffAnalysis', () => {
    it('creates analysis with weighted scoring', () => {
      const analysis = createTradeoffAnalysis({
        options: [
          {
            id: 'option-a',
            description: 'Monolithic architecture',
            impacts: [
              { attribute: 'simplicity', impact: 2, rationale: 'Single deployment' },
              { attribute: 'scalability', impact: -1, rationale: 'Horizontal scaling limited' },
              { attribute: 'maintainability', impact: 1, rationale: 'Easier to understand initially' },
            ],
          },
          {
            id: 'option-b',
            description: 'Microservices architecture',
            impacts: [
              { attribute: 'simplicity', impact: -1, rationale: 'Distributed complexity' },
              { attribute: 'scalability', impact: 2, rationale: 'Independent scaling' },
              { attribute: 'maintainability', impact: -1, rationale: 'More moving parts' },
            ],
          },
        ],
        qualities: ['simplicity', 'scalability', 'maintainability'],
      });

      expect(analysis.qualities).toContain('simplicity');
      expect(analysis.qualities).toContain('scalability');
      expect(analysis.matrix.rows).toHaveLength(2);

      // Check that scores are computed
      const optionA = analysis.matrix.rows.find((r) => r.optionId === 'option-a');
      const optionB = analysis.matrix.rows.find((r) => r.optionId === 'option-b');
      expect(optionA?.weightedScore).toBeDefined();
      expect(optionB?.weightedScore).toBeDefined();

      // Recommendation should exist
      expect(analysis.recommendation).toBeTruthy();
      expect(analysis.matrix.recommendedOptionId).toBeTruthy();
    });

    it('handles empty options', () => {
      const analysis = createTradeoffAnalysis({
        options: [],
      });

      expect(analysis.matrix.rows).toHaveLength(0);
      expect(analysis.recommendation).toContain('No options provided');
    });

    it('uses custom weights when provided', () => {
      const customWeights = new Map<QualityAttribute, number>([
        ['performance', 0.5],
        ['security', 0.5],
      ]);

      const analysis = createTradeoffAnalysis({
        options: [
          {
            id: 'fast',
            description: 'Optimized for speed',
            impacts: [
              { attribute: 'performance', impact: 2, rationale: 'Highly optimized' },
              { attribute: 'security', impact: -1, rationale: 'Some shortcuts taken' },
            ],
          },
          {
            id: 'secure',
            description: 'Optimized for security',
            impacts: [
              { attribute: 'performance', impact: -1, rationale: 'Extra validation overhead' },
              { attribute: 'security', impact: 2, rationale: 'Comprehensive protection' },
            ],
          },
        ],
        weights: customWeights,
      });

      expect(analysis.matrix.weights.get('performance')).toBe(0.5);
      expect(analysis.matrix.weights.get('security')).toBe(0.5);
    });
  });

  describe('compareOptions', () => {
    it('compares two options and determines winner', () => {
      const optionA = [
        { attribute: 'performance' as QualityAttribute, impact: 2 },
        { attribute: 'security' as QualityAttribute, impact: 1 },
      ];
      const optionB = [
        { attribute: 'performance' as QualityAttribute, impact: 1 },
        { attribute: 'security' as QualityAttribute, impact: 2 },
      ];

      // With equal weights
      const evenWeights = new Map<QualityAttribute, number>([
        ['performance', 0.5],
        ['security', 0.5],
      ]);

      const result = compareOptions(optionA, optionB, evenWeights);
      expect(result.winner).toBe('tie');
      expect(result.scoreA).toBe(1.5);
      expect(result.scoreB).toBe(1.5);
    });

    it('handles unequal weights', () => {
      const optionA = [
        { attribute: 'performance' as QualityAttribute, impact: 2 },
      ];
      const optionB = [
        { attribute: 'performance' as QualityAttribute, impact: 1 },
      ];

      const weights = new Map<QualityAttribute, number>([
        ['performance', 1.0],
      ]);

      const result = compareOptions(optionA, optionB, weights);
      expect(result.winner).toBe('A');
      expect(result.scoreA).toBe(2);
      expect(result.scoreB).toBe(1);
      expect(result.difference).toBe(1);
    });
  });

  describe('DEFAULT_TRADEOFF_WEIGHTS', () => {
    it('contains all standard quality attributes', () => {
      expect(DEFAULT_TRADEOFF_WEIGHTS.has('performance')).toBe(true);
      expect(DEFAULT_TRADEOFF_WEIGHTS.has('maintainability')).toBe(true);
      expect(DEFAULT_TRADEOFF_WEIGHTS.has('security')).toBe(true);
      expect(DEFAULT_TRADEOFF_WEIGHTS.has('testability')).toBe(true);
    });

    it('weights sum to approximately 1.0', () => {
      let sum = 0;
      for (const weight of DEFAULT_TRADEOFF_WEIGHTS.values()) {
        sum += weight;
      }
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });
});

describe('Constraint Validation', () => {
  describe('validateLayerDependency', () => {
    it('detects forbidden dependencies', () => {
      const constraint: ArchitectureConstraint = {
        id: 'CA-001',
        type: 'layer_dependency',
        rule: 'Domain must not depend on infrastructure',
        severity: 'error',
        scope: 'src/domain/**',
        forbiddenDependencies: ['src/infrastructure/**'],
      };

      const dependencies = new Map<string, string[]>([
        ['src/domain/user.ts', ['src/infrastructure/database.ts']],
        ['src/domain/order.ts', ['src/domain/user.ts']],
      ]);

      const violations = validateLayerDependency(constraint, dependencies);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.file).toBe('src/domain/user.ts');
      expect(violations[0]?.severity).toBe('error');
    });

    it('allows valid dependencies', () => {
      const constraint: ArchitectureConstraint = {
        id: 'CA-002',
        type: 'layer_dependency',
        rule: 'Domain layers can depend on each other',
        severity: 'error',
        scope: 'src/domain/**',
        forbiddenDependencies: ['src/infrastructure/**'],
      };

      const dependencies = new Map<string, string[]>([
        ['src/domain/user.ts', ['src/domain/shared.ts']],
        ['src/domain/order.ts', ['src/domain/user.ts']],
      ]);

      const violations = validateLayerDependency(constraint, dependencies);
      expect(violations).toHaveLength(0);
    });

    it('ignores files outside scope', () => {
      const constraint: ArchitectureConstraint = {
        id: 'CA-003',
        type: 'layer_dependency',
        rule: 'Domain must not depend on infrastructure',
        severity: 'error',
        scope: 'src/domain/**',
        forbiddenDependencies: ['src/infrastructure/**'],
      };

      const dependencies = new Map<string, string[]>([
        ['src/api/handler.ts', ['src/infrastructure/database.ts']], // Outside scope
      ]);

      const violations = validateLayerDependency(constraint, dependencies);
      expect(violations).toHaveLength(0);
    });
  });

  describe('validateNamingConvention', () => {
    it('detects naming convention violations', () => {
      const constraint: ArchitectureConstraint = {
        id: 'NC-001',
        type: 'naming_convention',
        rule: 'Test files must end with .test.ts',
        severity: 'warning',
        pattern: '.*\\.test\\.ts$',
        scope: 'src/**/__tests__/**',
      };

      const files = [
        'src/api/__tests__/user.test.ts',
        'src/api/__tests__/order.spec.ts', // Violation
        'src/api/__tests__/helper.ts', // Violation
      ];

      const violations = validateNamingConvention(constraint, files);

      expect(violations).toHaveLength(2);
      expect(violations.map((v) => v.file)).toContain('src/api/__tests__/order.spec.ts');
      expect(violations.map((v) => v.file)).toContain('src/api/__tests__/helper.ts');
    });

    it('passes valid naming', () => {
      const constraint: ArchitectureConstraint = {
        id: 'NC-002',
        type: 'naming_convention',
        rule: 'Test files must end with .test.ts',
        severity: 'warning',
        pattern: '.*\\.test\\.ts$',
        scope: 'src/**/__tests__/**',
      };

      const files = [
        'src/api/__tests__/user.test.ts',
        'src/api/__tests__/order.test.ts',
      ];

      const violations = validateNamingConvention(constraint, files);
      expect(violations).toHaveLength(0);
    });
  });

  describe('validateCircularDependencies', () => {
    it('detects circular dependencies', () => {
      const constraint: ArchitectureConstraint = {
        id: 'CD-001',
        type: 'circular_dependency',
        rule: 'No circular dependencies',
        severity: 'error',
      };

      const dependencies = new Map<string, string[]>([
        ['a.ts', ['b.ts']],
        ['b.ts', ['c.ts']],
        ['c.ts', ['a.ts']], // Creates cycle: a -> b -> c -> a
      ]);

      const violations = validateCircularDependencies(constraint, dependencies);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.severity).toBe('error');
      expect(violations[0]?.context).toContain('a.ts');
      expect(violations[0]?.context).toContain('b.ts');
      expect(violations[0]?.context).toContain('c.ts');
    });

    it('allows acyclic dependencies', () => {
      const constraint: ArchitectureConstraint = {
        id: 'CD-002',
        type: 'circular_dependency',
        rule: 'No circular dependencies',
        severity: 'error',
      };

      const dependencies = new Map<string, string[]>([
        ['a.ts', ['b.ts', 'c.ts']],
        ['b.ts', ['c.ts']],
        ['c.ts', []], // Leaf node
      ]);

      const violations = validateCircularDependencies(constraint, dependencies);
      expect(violations).toHaveLength(0);
    });
  });
});

describe('Drift Detection', () => {
  describe('calculateTechnicalDebt', () => {
    it('calculates debt from violations', () => {
      const violations: ConstraintViolation[] = [
        {
          constraintId: 'CA-001',
          file: 'src/domain/user.ts',
          message: 'Layer violation',
          severity: 'error',
        },
        {
          constraintId: 'NC-001',
          file: 'src/test/helper.ts',
          message: 'Naming violation',
          severity: 'warning',
        },
      ];

      const debt = calculateTechnicalDebt(violations);

      expect(debt.totalHours).toBeGreaterThan(0);
      expect(debt.confidence.type).toBe('bounded');
    });

    it('handles empty violations', () => {
      const debt = calculateTechnicalDebt([]);
      expect(debt.totalHours).toBe(0);
    });
  });

  describe('generateDriftReport', () => {
    it('generates comprehensive report', () => {
      const constraints = CLEAN_ARCHITECTURE_CONSTRAINTS;
      const violations: ConstraintViolation[] = [
        {
          constraintId: 'CA-001',
          file: 'src/domain/user.ts',
          message: 'Domain depends on infrastructure',
          severity: 'error',
        },
        {
          constraintId: 'CA-001',
          file: 'src/domain/order.ts',
          message: 'Domain depends on infrastructure',
          severity: 'error',
        },
        {
          constraintId: 'CA-002',
          file: 'src/domain/product.ts',
          message: 'Domain depends on application',
          severity: 'warning',
        },
      ];

      const report = generateDriftReport(constraints, violations);

      expect(report.summary.totalViolations).toBe(3);
      expect(report.summary.errorCount).toBe(2);
      expect(report.summary.warningCount).toBe(1);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.technicalDebtEstimate.totalHours).toBeGreaterThan(0);
    });

    it('generates healthy report with no violations', () => {
      const constraints = CLEAN_ARCHITECTURE_CONSTRAINTS;
      const violations: ConstraintViolation[] = [];

      const report = generateDriftReport(constraints, violations);

      expect(report.summary.totalViolations).toBe(0);
      expect(report.recommendations).toContain('Architecture is in good health - continue monitoring');
    });

    it('identifies systemic issues', () => {
      const constraints: ArchitectureConstraint[] = [
        {
          id: 'SYS-001',
          type: 'layer_dependency',
          rule: 'No direct database access',
          severity: 'error',
        },
      ];

      const violations: ConstraintViolation[] = [];
      for (let i = 0; i < 5; i++) {
        violations.push({
          constraintId: 'SYS-001',
          file: `src/handler${i}.ts`,
          message: 'Direct database access',
          severity: 'error',
        });
      }

      const report = generateDriftReport(constraints, violations);

      const systemicRecommendation = report.recommendations.find((r) =>
        r.includes('Systemic issue')
      );
      expect(systemicRecommendation).toBeTruthy();
    });
  });
});

describe('Pattern Recommendations', () => {
  describe('createPatternRecommendation', () => {
    it('creates recommendation with minimal input', () => {
      const rec = createPatternRecommendation({
        pattern: 'Repository Pattern',
        description: 'Abstract data access',
        applicability: ['Domain entities with CRUD', 'Need to swap data sources'],
      });

      expect(rec.pattern).toBe('Repository Pattern');
      expect(rec.applicability).toHaveLength(2);
      expect(rec.antiPatterns).toEqual([]);
      expect(rec.examples).toEqual([]);
      expect(rec.confidence.type).toBe('absent');
    });

    it('creates full recommendation', () => {
      const rec = createPatternRecommendation({
        pattern: 'CQRS',
        description: 'Command Query Responsibility Segregation',
        applicability: ['Complex domain logic', 'Different read/write models'],
        antiPatterns: [
          {
            name: 'God Repository',
            description: 'Single repo handling all queries and commands',
            symptoms: ['Bloated repository', 'Complex query methods'],
            remediation: 'Split into read and write repositories',
          },
        ],
        examples: [
          {
            title: 'Command Handler',
            code: 'class CreateOrderHandler { handle(cmd: CreateOrder) {} }',
            language: 'typescript',
            explanation: 'Handles a single command',
          },
        ],
        evidence: [
          { type: 'literature', reference: 'Fowler CQRS', strength: 'strong' },
        ],
        confidence: bounded(0.7, 0.9, 'literature', 'Well-established pattern'),
        relatedPatterns: ['Event Sourcing', 'Repository'],
        tradeoffs: {
          benefits: ['Optimized read models', 'Clear separation of concerns'],
          costs: ['Increased complexity', 'Eventual consistency'],
        },
      });

      expect(rec.antiPatterns).toHaveLength(1);
      expect(rec.antiPatterns[0]?.name).toBe('God Repository');
      expect(rec.examples).toHaveLength(1);
      expect(rec.evidence).toHaveLength(1);
      expect(rec.relatedPatterns).toContain('Event Sourcing');
      expect(rec.tradeoffs?.benefits).toContain('Optimized read models');
    });
  });

  describe('checkPatternApplicability', () => {
    it('finds matching applicabilities', () => {
      const rec = createPatternRecommendation({
        pattern: 'Repository Pattern',
        description: 'Abstract data access',
        applicability: [
          'Domain entities with CRUD operations',
          'Need to swap data sources easily',
          'Testing database logic in isolation',
        ],
      });

      const result = checkPatternApplicability(rec, ['CRUD', 'database', 'testing']);

      expect(result.applicable).toBe(true);
      expect(result.matchedApplicabilities.length).toBeGreaterThan(0);
      expect(result.matchScore).toBeGreaterThan(0);
    });

    it('returns not applicable for no matches', () => {
      const rec = createPatternRecommendation({
        pattern: 'Saga Pattern',
        description: 'Distributed transactions',
        applicability: ['Distributed systems', 'Long-running transactions'],
      });

      const result = checkPatternApplicability(rec, ['simple', 'single-service']);

      expect(result.applicable).toBe(false);
      expect(result.matchScore).toBe(0);
    });

    it('handles empty context', () => {
      const rec = createPatternRecommendation({
        pattern: 'Test Pattern',
        description: 'Test',
        applicability: ['Any context'],
      });

      const result = checkPatternApplicability(rec, []);

      expect(result.applicable).toBe(false);
    });
  });
});

describe('Built-in Constraints', () => {
  describe('CLEAN_ARCHITECTURE_CONSTRAINTS', () => {
    it('includes core clean architecture rules', () => {
      expect(CLEAN_ARCHITECTURE_CONSTRAINTS.length).toBeGreaterThan(0);

      const domainRule = CLEAN_ARCHITECTURE_CONSTRAINTS.find((c) =>
        c.rule.includes('Domain') && c.rule.includes('infrastructure')
      );
      expect(domainRule).toBeTruthy();
      expect(domainRule?.severity).toBe('error');

      const circularRule = CLEAN_ARCHITECTURE_CONSTRAINTS.find(
        (c) => c.type === 'circular_dependency'
      );
      expect(circularRule).toBeTruthy();
    });
  });

  describe('NAMING_CONVENTION_CONSTRAINTS', () => {
    it('includes common naming rules', () => {
      expect(NAMING_CONVENTION_CONSTRAINTS.length).toBeGreaterThan(0);

      const testRule = NAMING_CONVENTION_CONSTRAINTS.find((c) =>
        c.rule.includes('Test files')
      );
      expect(testRule).toBeTruthy();
      expect(testRule?.pattern).toBeTruthy();
    });
  });
});

describe('Integration with Epistemics', () => {
  it('uses confidence values correctly in ADRs', () => {
    const adr = createADR({
      id: 'ADR-CONF',
      title: 'Confidence Test',
      context: 'Testing confidence integration',
      decision: 'Use proper confidence values',
      confidence: deterministic(true, 'explicit_decision'),
    });

    expect(adr.confidence.type).toBe('deterministic');
    if (adr.confidence.type === 'deterministic') {
      expect(adr.confidence.value).toBe(1.0);
      expect(adr.confidence.reason).toBe('explicit_decision');
    }
  });

  it('uses confidence values in trade-off analysis', () => {
    const analysis = createTradeoffAnalysis({
      options: [
        {
          id: 'option-with-confidence',
          description: 'Option with confidence',
          impacts: [
            {
              attribute: 'performance',
              impact: 2,
              rationale: 'Well-measured',
              confidence: bounded(0.8, 0.95, 'literature', 'Benchmark studies'),
            },
          ],
        },
      ],
      qualities: ['performance'],
    });

    const cell = analysis.matrix.rows[0]?.cells[0];
    expect(cell?.confidence.type).toBe('bounded');
    if (cell?.confidence.type === 'bounded') {
      expect(cell.confidence.low).toBe(0.8);
      expect(cell.confidence.high).toBe(0.95);
    }
  });

  it('uses confidence values in technical debt estimates', () => {
    const debt = calculateTechnicalDebt([
      {
        constraintId: 'TEST',
        file: 'test.ts',
        message: 'Test violation',
        severity: 'warning',
      },
    ]);

    expect(debt.confidence.type).toBe('bounded');
    if (debt.confidence.type === 'bounded') {
      expect(debt.confidence.basis).toBe('theoretical');
    }
  });
});
