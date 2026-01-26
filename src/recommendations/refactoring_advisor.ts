/**
 * @fileoverview Refactoring Recommendation Advisor
 *
 * Generates actionable refactoring recommendations with:
 * - Effort estimates (hours, confidence)
 * - Impact analysis (maintainability, testability, readability)
 * - Risk assessment (factors, mitigations)
 * - Step-by-step guidance
 * - Automation suggestions
 *
 * Designed to help agents and developers make informed decisions
 * about code improvement priorities.
 */

import type { UniversalKnowledge, Reference } from '../knowledge/universal_types.js';

// ============================================================================
// TYPES
// ============================================================================

export type RefactoringType =
  | 'extract_function'
  | 'extract_module'
  | 'inline'
  | 'rename'
  | 'move'
  | 'split_class'
  | 'combine_modules'
  | 'add_interface'
  | 'simplify_conditional'
  | 'replace_magic_numbers'
  | 'add_null_checks'
  | 'convert_to_async'
  | 'add_error_handling'
  | 'reduce_coupling'
  | 'improve_cohesion'
  | 'add_tests'
  | 'improve_documentation';

export type EffortEstimate = 'trivial' | 'small' | 'medium' | 'large' | 'epic';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface EntityReference {
  id: string;
  name: string;
  file: string;
}

export interface RefactoringStep {
  order: number;
  description: string;
  tool?: string;
  automated?: boolean;
  validation?: string;
}

export interface RefactoringRecommendation {
  id: string;
  target: EntityReference;
  type: RefactoringType;
  title: string;
  description: string;
  rationale: string;

  effort: {
    estimate: EffortEstimate;
    hours: number;
    confidence: number;
  };

  impact: {
    maintainability: number;  // Delta in maintainability index (0-100)
    testability: number;      // Delta in testability
    readability: number;      // Delta in readability
    performance?: number;     // Delta in performance (optional)
  };

  risk: {
    level: RiskLevel;
    factors: string[];
    mitigations: string[];
  };

  steps: RefactoringStep[];

  blocking: EntityReference[];    // What blocks this refactoring
  blockedBy: EntityReference[];   // What this refactoring would unblock

  automatable: boolean;
  suggestedTool?: string;

  priority: number;              // Computed priority (higher = more important)
  roi: number;                   // Return on investment (impact / effort)
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate refactoring recommendations for knowledge entities.
 * Recommendations are sorted by ROI (impact / effort).
 */
export function generateRefactoringRecommendations(
  knowledge: UniversalKnowledge[]
): RefactoringRecommendation[] {
  const recommendations: RefactoringRecommendation[] = [];

  for (const k of knowledge) {
    // Long method detection
    if (k.quality.complexity.lines > 100) {
      recommendations.push(createLongMethodRecommendation(k));
    }

    // High complexity
    if (k.quality.complexity.cognitive > 15) {
      recommendations.push(createHighComplexityRecommendation(k));
    }

    // Deep nesting
    if (k.quality.complexity.nesting > 4) {
      recommendations.push(createDeepNestingRecommendation(k));
    }

    // High coupling
    if (k.relationships.coupling.efferent > 15) {
      recommendations.push(createHighCouplingRecommendation(k));
    }

    // Low coverage
    if (k.quality.coverage.function < 0.5 && k.kind === 'function') {
      recommendations.push(createLowCoverageRecommendation(k));
    }

    // Code smells
    for (const smell of k.quality.smells) {
      if (smell.severity === 'critical' || smell.severity === 'blocker') {
        recommendations.push(createSmellRecommendation(k, smell));
      }
    }

    // Poor documentation
    if (!k.quality.documentation.hasDocstring && k.visibility === 'public') {
      recommendations.push(createDocumentationRecommendation(k));
    }

    // Technical debt items
    if (k.quality.maintainability.technicalDebt.minutes > 60) {
      recommendations.push(createDebtRecommendation(k));
    }
  }

  // Calculate ROI and sort
  for (const rec of recommendations) {
    rec.roi = calculateROI(rec);
    rec.priority = calculatePriority(rec);
  }

  return recommendations.sort((a, b) => b.roi - a.roi);
}

// ============================================================================
// RECOMMENDATION FACTORIES
// ============================================================================

function createLongMethodRecommendation(k: UniversalKnowledge): RefactoringRecommendation {
  const hours = Math.ceil(k.quality.complexity.lines / 50);
  const callerCount = k.relationships.calledBy.length;

  return {
    id: `extract-${k.id}-${Date.now()}`,
    target: toEntityReference(k),
    type: 'extract_function',
    title: `Extract functions from ${k.name}`,
    description: `This function is ${k.quality.complexity.lines} lines. Consider extracting cohesive blocks into separate functions.`,
    rationale: 'Long methods are harder to understand, test, and maintain. Breaking them into smaller, focused functions improves readability and enables better testing.',

    effort: {
      estimate: hours <= 2 ? 'small' : hours <= 4 ? 'medium' : 'large',
      hours,
      confidence: 0.7,
    },

    impact: {
      maintainability: 15,
      testability: 20,
      readability: 25,
    },

    risk: {
      level: callerCount > 5 ? 'high' : callerCount > 2 ? 'medium' : 'low',
      factors: [
        'May introduce bugs if extraction boundaries are incorrect',
        `${callerCount} callers may need review`,
        'Variable scoping may need adjustment',
      ],
      mitigations: [
        'Write tests for current behavior first',
        'Use IDE refactoring tools for automated extraction',
        'Review call sites after extraction',
        'Use git bisect if issues arise',
      ],
    },

    steps: [
      { order: 1, description: 'Identify cohesive blocks of code (single responsibility)', tool: 'manual' },
      { order: 2, description: 'Write tests for current behavior', tool: 'vitest', automated: false },
      { order: 3, description: 'Extract each block as a separate function', tool: 'ts-morph', automated: true },
      { order: 4, description: 'Run tests to verify behavior preserved', tool: 'vitest', validation: 'All tests pass' },
      { order: 5, description: 'Update documentation for new functions', tool: 'manual' },
    ],

    blocking: [],
    blockedBy: [],
    automatable: true,
    suggestedTool: 'ts-morph',
    priority: 0,
    roi: 0,
  };
}

function createHighComplexityRecommendation(k: UniversalKnowledge): RefactoringRecommendation {
  const complexity = k.quality.complexity.cognitive;

  return {
    id: `simplify-${k.id}-${Date.now()}`,
    target: toEntityReference(k),
    type: 'simplify_conditional',
    title: `Reduce complexity in ${k.name}`,
    description: `Cognitive complexity of ${complexity} exceeds recommended threshold of 15. Simplify conditional logic.`,
    rationale: 'High cognitive complexity makes code hard to understand and increases bug risk. Simplifying conditions improves maintainability.',

    effort: {
      estimate: complexity > 25 ? 'large' : 'medium',
      hours: Math.ceil(complexity / 5),
      confidence: 0.6,
    },

    impact: {
      maintainability: 20,
      testability: 15,
      readability: 25,
    },

    risk: {
      level: complexity > 30 ? 'high' : 'medium',
      factors: [
        'Simplification may change edge case behavior',
        'Deep conditionals may have hidden dependencies',
      ],
      mitigations: [
        'Document all code paths before refactoring',
        'Add tests for edge cases',
        'Use guard clauses to reduce nesting',
        'Consider strategy pattern for complex conditionals',
      ],
    },

    steps: [
      { order: 1, description: 'Map all conditional branches', tool: 'manual' },
      { order: 2, description: 'Add tests for each branch', tool: 'vitest' },
      { order: 3, description: 'Replace nested ifs with guard clauses', tool: 'manual' },
      { order: 4, description: 'Extract complex conditions into named functions', tool: 'manual' },
      { order: 5, description: 'Consider polymorphism for type-based conditionals', tool: 'manual' },
    ],

    blocking: [],
    blockedBy: [],
    automatable: false,
    priority: 0,
    roi: 0,
  };
}

function createDeepNestingRecommendation(k: UniversalKnowledge): RefactoringRecommendation {
  const nesting = k.quality.complexity.nesting;

  return {
    id: `flatten-${k.id}-${Date.now()}`,
    target: toEntityReference(k),
    type: 'simplify_conditional',
    title: `Reduce nesting depth in ${k.name}`,
    description: `Nesting depth of ${nesting} is too deep. Use early returns and extract helper functions.`,
    rationale: 'Deep nesting (arrow anti-pattern) is hard to read and reason about. Flattening improves maintainability.',

    effort: {
      estimate: 'small',
      hours: 1,
      confidence: 0.8,
    },

    impact: {
      maintainability: 15,
      testability: 10,
      readability: 30,
    },

    risk: {
      level: 'low',
      factors: ['Early returns change control flow'],
      mitigations: ['Ensure all cleanup code still runs', 'Test edge cases'],
    },

    steps: [
      { order: 1, description: 'Identify guard conditions that can return early', tool: 'manual' },
      { order: 2, description: 'Invert conditions and add early returns', tool: 'manual', automated: true },
      { order: 3, description: 'Extract deeply nested blocks into helper functions', tool: 'ts-morph' },
    ],

    blocking: [],
    blockedBy: [],
    automatable: true,
    suggestedTool: 'eslint --fix',
    priority: 0,
    roi: 0,
  };
}

function createHighCouplingRecommendation(k: UniversalKnowledge): RefactoringRecommendation {
  const efferent = k.relationships.coupling.efferent;
  const deps = k.relationships.imports;

  return {
    id: `decouple-${k.id}-${Date.now()}`,
    target: toEntityReference(k),
    type: 'reduce_coupling',
    title: `Reduce dependencies in ${k.name}`,
    description: `This module has ${efferent} outgoing dependencies. Consider introducing interfaces or consolidating related imports.`,
    rationale: 'High efferent coupling makes modules fragile and hard to test in isolation. Reducing dependencies improves stability.',

    effort: {
      estimate: 'medium',
      hours: 3,
      confidence: 0.6,
    },

    impact: {
      maintainability: 20,
      testability: 25,
      readability: 10,
    },

    risk: {
      level: 'medium',
      factors: [
        'Interface changes affect all consumers',
        'May require coordination across teams',
      ],
      mitigations: [
        'Introduce interfaces gradually',
        'Use dependency injection for testing',
        'Consider facade pattern for grouped dependencies',
      ],
    },

    steps: [
      { order: 1, description: 'Analyze dependency graph to identify clusters', tool: 'manual' },
      { order: 2, description: 'Group related dependencies behind interfaces', tool: 'manual' },
      { order: 3, description: 'Inject dependencies instead of importing directly', tool: 'manual' },
      { order: 4, description: 'Update tests to use mocked dependencies', tool: 'vitest' },
    ],

    blocking: [],
    blockedBy: deps.map(d => ({ id: d.id, name: d.name, file: d.file })),
    automatable: false,
    priority: 0,
    roi: 0,
  };
}

function createLowCoverageRecommendation(k: UniversalKnowledge): RefactoringRecommendation {
  const coverage = Math.round(k.quality.coverage.function * 100);

  return {
    id: `test-${k.id}-${Date.now()}`,
    target: toEntityReference(k),
    type: 'add_tests',
    title: `Add tests for ${k.name}`,
    description: `Function coverage is only ${coverage}%. Add tests to improve confidence.`,
    rationale: 'Low test coverage increases risk of regressions. Tests document expected behavior and enable safe refactoring.',

    effort: {
      estimate: 'small',
      hours: 2,
      confidence: 0.8,
    },

    impact: {
      maintainability: 10,
      testability: 30,
      readability: 5,
    },

    risk: {
      level: 'low',
      factors: ['Tests may have false assumptions about behavior'],
      mitigations: ['Review existing usage patterns', 'Consult domain experts for edge cases'],
    },

    steps: [
      { order: 1, description: 'Identify untested code paths', tool: 'vitest --coverage' },
      { order: 2, description: 'Write tests for happy path', tool: 'vitest' },
      { order: 3, description: 'Add edge case tests', tool: 'vitest' },
      { order: 4, description: 'Add error handling tests', tool: 'vitest' },
      { order: 5, description: 'Verify coverage meets threshold', tool: 'vitest --coverage', validation: '>80% coverage' },
    ],

    blocking: [],
    blockedBy: [],
    automatable: false,
    priority: 0,
    roi: 0,
  };
}

function createSmellRecommendation(
  k: UniversalKnowledge,
  smell: { name: string; description: string; refactoring?: string }
): RefactoringRecommendation {
  const refactoringType = mapSmellToRefactoring(smell.name);

  return {
    id: `smell-${k.id}-${smell.name}-${Date.now()}`,
    target: toEntityReference(k),
    type: refactoringType,
    title: `Fix "${smell.name}" in ${k.name}`,
    description: smell.description,
    rationale: smell.refactoring ?? `Addressing this code smell improves maintainability and reduces technical debt.`,

    effort: {
      estimate: 'small',
      hours: 1,
      confidence: 0.7,
    },

    impact: {
      maintainability: 10,
      testability: 5,
      readability: 10,
    },

    risk: {
      level: 'low',
      factors: ['Changes may affect callers'],
      mitigations: ['Run tests after changes'],
    },

    steps: [
      { order: 1, description: `Apply ${refactoringType} refactoring`, tool: 'manual' },
      { order: 2, description: 'Verify tests pass', tool: 'vitest' },
    ],

    blocking: [],
    blockedBy: [],
    automatable: false,
    priority: 0,
    roi: 0,
  };
}

function createDocumentationRecommendation(k: UniversalKnowledge): RefactoringRecommendation {
  return {
    id: `doc-${k.id}-${Date.now()}`,
    target: toEntityReference(k),
    type: 'improve_documentation',
    title: `Add documentation for ${k.name}`,
    description: `Public ${k.kind} lacks documentation. Add JSDoc/TSDoc comments.`,
    rationale: 'Documentation helps users understand how to use APIs and reduces support burden.',

    effort: {
      estimate: 'trivial',
      hours: 0.5,
      confidence: 0.9,
    },

    impact: {
      maintainability: 5,
      testability: 0,
      readability: 15,
    },

    risk: {
      level: 'low',
      factors: [],
      mitigations: [],
    },

    steps: [
      { order: 1, description: 'Add @param, @returns, and @throws annotations', tool: 'manual' },
      { order: 2, description: 'Add usage examples', tool: 'manual' },
      { order: 3, description: 'Verify documentation renders correctly', tool: 'typedoc' },
    ],

    blocking: [],
    blockedBy: [],
    automatable: false,
    priority: 0,
    roi: 0,
  };
}

function createDebtRecommendation(k: UniversalKnowledge): RefactoringRecommendation {
  const debtMinutes = k.quality.maintainability.technicalDebt.minutes;
  const debtHours = Math.ceil(debtMinutes / 60);
  const issues = k.quality.maintainability.technicalDebt.issues;

  return {
    id: `debt-${k.id}-${Date.now()}`,
    target: toEntityReference(k),
    type: 'improve_cohesion',
    title: `Address technical debt in ${k.name}`,
    description: `Estimated ${debtHours}h of technical debt. ${issues.length} identified issues.`,
    rationale: 'Technical debt accumulates interest over time, making future changes more expensive.',

    effort: {
      estimate: debtHours <= 2 ? 'small' : debtHours <= 8 ? 'medium' : 'large',
      hours: debtHours,
      confidence: 0.5,
    },

    impact: {
      maintainability: Math.min(30, debtHours * 3),
      testability: 10,
      readability: 15,
    },

    risk: {
      level: debtHours > 8 ? 'high' : 'medium',
      factors: issues.map(i => i.description),
      mitigations: ['Address incrementally', 'Prioritize highest-impact issues first'],
    },

    steps: issues.map((issue, i) => ({
      order: i + 1,
      description: issue.description,
      tool: 'manual',
    })),

    blocking: [],
    blockedBy: [],
    automatable: false,
    priority: 0,
    roi: 0,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function toEntityReference(k: UniversalKnowledge): EntityReference {
  return {
    id: k.id,
    name: k.name,
    file: k.location.file,
  };
}

function mapSmellToRefactoring(smellName: string): RefactoringType {
  const map: Record<string, RefactoringType> = {
    'Long Method': 'extract_function',
    'Long Parameter List': 'extract_function',
    'Feature Envy': 'move',
    'Data Clumps': 'extract_module',
    'Primitive Obsession': 'add_interface',
    'Duplicate Code': 'extract_function',
    'Dead Code': 'inline',
    'Speculative Generality': 'inline',
    'Comments': 'rename',
    'Magic Numbers': 'replace_magic_numbers',
  };
  return map[smellName] ?? 'improve_cohesion';
}

function calculateROI(rec: RefactoringRecommendation): number {
  const totalImpact = rec.impact.maintainability + rec.impact.testability + rec.impact.readability;
  const effort = Math.max(0.5, rec.effort.hours);
  return totalImpact / effort;
}

function calculatePriority(rec: RefactoringRecommendation): number {
  // Priority factors:
  // - ROI (higher = better)
  // - Risk (lower = better)
  // - Automation (automatable = better)
  const riskPenalty = rec.risk.level === 'high' ? 0.5 : rec.risk.level === 'medium' ? 0.8 : 1.0;
  const automationBonus = rec.automatable ? 1.2 : 1.0;

  return rec.roi * riskPenalty * automationBonus;
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export const _internal = {
  createLongMethodRecommendation,
  createHighComplexityRecommendation,
  calculateROI,
  calculatePriority,
};
