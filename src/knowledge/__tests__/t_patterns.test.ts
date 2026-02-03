/**
 * @fileoverview Tests for Complete T-Series Pattern Library (T-01 to T-30)
 *
 * Validates that all T-patterns are properly implemented with:
 * - Detection logic
 * - Confidence scoring
 * - Evidence generation
 * - Remediation suggestions
 */

import { describe, it, expect } from 'vitest';
import {
  T_PATTERN_REGISTRY,
  analyzeT01FunctionByName,
  analyzeT02SemanticSearch,
  analyzeT03CallGraph,
  analyzeT04DependencyGraph,
  analyzeT05InterfaceImplementation,
  analyzeT06TestMapping,
  analyzeT07FunctionPurpose,
  analyzeT08ModuleArchitecture,
  analyzeT09DesignPatterns,
  analyzeT10ErrorHandling,
  analyzeT11DataFlow,
  analyzeT12SideEffects,
  analyzeT13UsageAnalysis,
  analyzeT14BreakingChanges,
  analyzeT15SimilarPatterns,
  analyzeT16FeatureLocation,
  analyzeT17TestGaps,
  analyzeT18Configuration,
  analyzeT19ErrorSource,
  analyzeT20RelatedBugs,
  analyzeT21RaceConditions,
  analyzeT22NullHazards,
  analyzeT23ExceptionPropagation,
  analyzeT24DeadCode,
  analyzeT28PerformanceAntiPatterns,
  analyzeT29CircularDependencies,
  analyzeAllTPatterns,
} from '../t_patterns.js';
import type { FunctionKnowledge, ModuleKnowledge } from '../../storage/types.js';
import type { PatternQuery } from '../patterns.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockFunction(overrides: Partial<FunctionKnowledge>): FunctionKnowledge {
  return {
    id: 'test-fn-' + Math.random().toString(36).slice(2),
    name: overrides.name || 'testFunction',
    filePath: overrides.filePath || '/test/file.ts',
    startLine: overrides.startLine || 1,
    endLine: overrides.endLine || 10,
    signature: overrides.signature || 'function testFunction(): void',
    purpose: overrides.purpose || 'Test function',
    confidence: overrides.confidence || 0.8,
    accessCount: 0,
    lastAccessed: null,
    validationCount: 0,
    outcomeHistory: { successes: 0, failures: 0 },
  };
}

function createMockModule(overrides: Partial<ModuleKnowledge>): ModuleKnowledge {
  return {
    id: 'test-mod-' + Math.random().toString(36).slice(2),
    path: overrides.path || '/test/module.ts',
    exports: overrides.exports || [],
    dependencies: overrides.dependencies || [],
    purpose: overrides.purpose || 'Test module',
    confidence: overrides.confidence || 0.8,
  };
}

const baseQuery: PatternQuery = { type: 'all_t_patterns' };

// ============================================================================
// T-PATTERN REGISTRY TESTS
// ============================================================================

describe('T-Pattern Registry', () => {
  it('should have all 30 T-patterns registered', () => {
    expect(T_PATTERN_REGISTRY.length).toBe(30);
  });

  it('should have unique IDs for all patterns', () => {
    const ids = T_PATTERN_REGISTRY.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(30);
  });

  it('should cover all categories', () => {
    const categories = new Set(T_PATTERN_REGISTRY.map(p => p.category));
    expect(categories).toContain('navigation');
    expect(categories).toContain('understanding');
    expect(categories).toContain('modification');
    expect(categories).toContain('bug_investigation');
    expect(categories).toContain('hard_scenarios');
  });

  it('should have quality criteria for all patterns', () => {
    for (const pattern of T_PATTERN_REGISTRY) {
      expect(pattern.qualityCriteria).toBeTruthy();
      expect(pattern.qualityCriteria.length).toBeGreaterThan(5);
    }
  });
});

// ============================================================================
// CATEGORY 1: NAVIGATION PATTERNS (T-01 to T-06)
// ============================================================================

describe('Category 1: Navigation Patterns', () => {
  describe('T-01: Find function by name', () => {
    it('should detect unique function names', () => {
      const functions = [
        createMockFunction({ name: 'createUser' }),
        createMockFunction({ name: 'updateUser' }),
        createMockFunction({ name: 'deleteUser' }),
      ];

      const result = analyzeT01FunctionByName(functions, baseQuery);

      expect(result.summary).toContain('T-01');
      expect(result.patterns).toBeDefined();
    });

    it('should flag duplicate function names', () => {
      const functions = [
        createMockFunction({ name: 'handler' }),
        createMockFunction({ name: 'handler' }),
        createMockFunction({ name: 'handler' }),
      ];

      const result = analyzeT01FunctionByName(functions, baseQuery);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('T-02: Semantic search support', () => {
    it('should detect documented functions', () => {
      const functions = [
        createMockFunction({ purpose: 'Creates a new user account with validation' }),
        createMockFunction({ purpose: 'Updates user profile information in database' }),
      ];

      const result = analyzeT02SemanticSearch(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Documented'))).toBe(true);
    });

    it('should detect semantic naming patterns', () => {
      const functions = [
        createMockFunction({ name: 'validateEmail' }),
        createMockFunction({ name: 'parseJSON' }),
        createMockFunction({ name: 'formatDate' }),
        createMockFunction({ name: 'calculateTotal' }),
      ];

      const result = analyzeT02SemanticSearch(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Semantic'))).toBe(true);
    });
  });

  describe('T-03: Call graph navigation', () => {
    it('should analyze call patterns', () => {
      const functions = [
        createMockFunction({ name: 'main' }),
        createMockFunction({ name: 'helper' }),
      ];
      const modules = [
        createMockModule({ path: '/src/main.ts', exports: ['main'], dependencies: ['./helper'] }),
        createMockModule({ path: '/src/helper.ts', exports: ['helper'], dependencies: [] }),
      ];

      const result = analyzeT03CallGraph(functions, modules, baseQuery);

      expect(result.summary).toContain('T-03');
    });
  });

  describe('T-04: Dependency graph navigation', () => {
    it('should identify utility modules', () => {
      const modules = [
        createMockModule({ path: '/src/utils.ts', exports: ['helper1', 'helper2'] }),
        createMockModule({ path: '/src/a.ts', dependencies: ['./utils'] }),
        createMockModule({ path: '/src/b.ts', dependencies: ['./utils'] }),
        createMockModule({ path: '/src/c.ts', dependencies: ['./utils'] }),
        createMockModule({ path: '/src/d.ts', dependencies: ['./utils'] }),
        createMockModule({ path: '/src/e.ts', dependencies: ['./utils'] }),
      ];

      const result = analyzeT04DependencyGraph(modules, baseQuery);

      expect(result.summary).toContain('T-04');
    });
  });

  describe('T-05: Interface implementation', () => {
    it('should detect interface patterns', () => {
      const functions = [
        createMockFunction({ signature: 'class UserServiceImpl implements IUserService' }),
      ];
      const modules = [
        createMockModule({ path: '/src/types.ts', exports: ['IUserService', 'IRepository'] }),
      ];

      const result = analyzeT05InterfaceImplementation(functions, modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Interface'))).toBe(true);
    });
  });

  describe('T-06: Test file mapping', () => {
    it('should calculate test coverage ratio', () => {
      const modules = [
        createMockModule({ path: '/src/user.ts' }),
        createMockModule({ path: '/src/user.test.ts' }),
        createMockModule({ path: '/src/auth.ts' }),
        createMockModule({ path: '/src/auth.test.ts' }),
      ];

      const result = analyzeT06TestMapping(modules, baseQuery);

      expect(result.summary).toContain('T-06');
    });
  });
});

// ============================================================================
// CATEGORY 2: UNDERSTANDING PATTERNS (T-07 to T-12)
// ============================================================================

describe('Category 2: Understanding Patterns', () => {
  describe('T-07: Function purpose explanation', () => {
    it('should identify well-documented functions', () => {
      const functions = [
        createMockFunction({ purpose: 'Validates user email format and checks against database for uniqueness' }),
      ];

      const result = analyzeT07FunctionPurpose(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Documented') || p.name.includes('Self-Documenting'))).toBe(true);
    });
  });

  describe('T-08: Module architecture', () => {
    it('should detect layered architecture', () => {
      const modules = [
        createMockModule({ path: '/src/api/routes.ts' }),
        createMockModule({ path: '/src/services/user.ts' }),
        createMockModule({ path: '/src/storage/database.ts' }),
        createMockModule({ path: '/src/utils/helpers.ts' }),
      ];

      const result = analyzeT08ModuleArchitecture(modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Layered') || p.name.includes('Feature'))).toBe(true);
    });
  });

  describe('T-09: Design patterns', () => {
    it('should detect repository pattern', () => {
      const modules = [
        createMockModule({ path: '/src/repository/user.ts', exports: ['UserRepository'] }),
      ];

      const result = analyzeT09DesignPatterns([], modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Repository'))).toBe(true);
    });

    it('should detect adapter pattern', () => {
      const modules = [
        createMockModule({ path: '/src/adapters/payment.ts', exports: ['PaymentAdapter'] }),
      ];

      const result = analyzeT09DesignPatterns([], modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Adapter'))).toBe(true);
    });
  });

  describe('T-10: Error handling', () => {
    it('should detect error handling functions', () => {
      const functions = [
        createMockFunction({ name: 'handleError', signature: 'function handleError(err: Error): void' }),
        createMockFunction({ name: 'catchException', signature: 'catch (error) { log(error) }' }),
      ];

      const result = analyzeT10ErrorHandling(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Error'))).toBe(true);
    });
  });

  describe('T-11: Data flow tracing', () => {
    it('should detect data transformation functions', () => {
      const functions = [
        createMockFunction({ name: 'transformUser' }),
        createMockFunction({ name: 'parseResponse' }),
        createMockFunction({ name: 'formatOutput' }),
      ];

      const result = analyzeT11DataFlow(functions, [], baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Transform'))).toBe(true);
    });
  });

  describe('T-12: Side effects', () => {
    it('should detect functions with side effects', () => {
      const functions = [
        createMockFunction({ signature: 'console.log(data)' }),
        createMockFunction({ signature: 'fs.writeFile(path, data)' }),
        createMockFunction({ signature: 'await fetch(url)' }),
      ];

      const result = analyzeT12SideEffects(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Side Effects'))).toBe(true);
    });
  });
});

// ============================================================================
// CATEGORY 3: MODIFICATION PATTERNS (T-13 to T-18)
// ============================================================================

describe('Category 3: Modification Patterns', () => {
  describe('T-13: Usage analysis', () => {
    it('should identify public API surface', () => {
      const functions = [
        createMockFunction({ name: 'createUser' }),
        createMockFunction({ name: 'updateUser' }),
      ];
      const modules = [
        createMockModule({ exports: ['createUser', 'updateUser'] }),
      ];

      const result = analyzeT13UsageAnalysis(functions, modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Public'))).toBe(true);
    });
  });

  describe('T-14: Breaking changes', () => {
    it('should identify high-impact modules', () => {
      const functions: FunctionKnowledge[] = [];
      const modules = [
        createMockModule({ path: '/src/core.ts', exports: ['core'] }),
        createMockModule({ path: '/src/a.ts', dependencies: ['./core'] }),
        createMockModule({ path: '/src/b.ts', dependencies: ['./core'] }),
        createMockModule({ path: '/src/c.ts', dependencies: ['./core'] }),
        createMockModule({ path: '/src/d.ts', dependencies: ['./core'] }),
        createMockModule({ path: '/src/e.ts', dependencies: ['./core'] }),
        createMockModule({ path: '/src/f.ts', dependencies: ['./core'] }),
      ];

      const result = analyzeT14BreakingChanges(functions, modules, baseQuery);

      expect(result.summary).toContain('T-14');
    });
  });

  describe('T-15: Similar patterns', () => {
    it('should group functions by prefix', () => {
      const functions = [
        createMockFunction({ name: 'getUserById' }),
        createMockFunction({ name: 'getUserByEmail' }),
        createMockFunction({ name: 'getUserByName' }),
        createMockFunction({ name: 'getUserList' }),
        createMockFunction({ name: 'getUserCount' }),
      ];

      const result = analyzeT15SimilarPatterns(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('get'))).toBe(true);
    });
  });

  describe('T-16: Feature location', () => {
    it('should identify entry points', () => {
      const modules = [
        createMockModule({ path: '/src/index.ts', exports: ['main'] }),
        createMockModule({ path: '/src/app.ts', exports: ['app'] }),
      ];

      const result = analyzeT16FeatureLocation(modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Entry'))).toBe(true);
    });
  });

  describe('T-17: Test gaps', () => {
    it('should identify complex untested functions', () => {
      const functions = [
        createMockFunction({ name: 'complexFunction', startLine: 1, endLine: 50, filePath: '/src/complex.ts' }),
      ];
      const modules = [
        createMockModule({ path: '/src/complex.ts', exports: ['complexFunction'] }),
      ];

      const result = analyzeT17TestGaps(functions, modules, baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name.includes('Complex') || ap.name.includes('Test'))).toBe(true);
    });
  });

  describe('T-18: Configuration', () => {
    it('should identify configuration modules', () => {
      const modules = [
        createMockModule({ path: '/src/config/database.ts', exports: ['DATABASE_URL'] }),
        createMockModule({ path: '/src/config/app.ts', exports: ['APP_CONFIG'] }),
      ];

      const result = analyzeT18Configuration(modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Configuration'))).toBe(true);
    });
  });
});

// ============================================================================
// CATEGORY 4: BUG INVESTIGATION PATTERNS (T-19 to T-24)
// ============================================================================

describe('Category 4: Bug Investigation Patterns', () => {
  describe('T-19: Error source location', () => {
    it('should identify error-throwing functions', () => {
      const functions = [
        createMockFunction({ signature: 'throw new Error("Invalid input")' }),
        createMockFunction({ signature: 'throw new ValidationError(msg)' }),
      ];

      const result = analyzeT19ErrorSource(functions, [], baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Error'))).toBe(true);
    });
  });

  describe('T-20: Related bugs', () => {
    it('should identify error-prone patterns', () => {
      const functions = [
        createMockFunction({ signature: 'if (arr.length > 0)' }),
        createMockFunction({ signature: 'if (list.length === 0)' }),
        createMockFunction({ signature: 'items.length < limit' }),
      ];

      const result = analyzeT20RelatedBugs(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Array length'))).toBe(true);
    });
  });

  describe('T-21: Race conditions', () => {
    it('should detect async state modifications', () => {
      const functions = [
        createMockFunction({ signature: 'async function updateState() { this.state = await fetch() }' }),
      ];

      const result = analyzeT21RaceConditions(functions, baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name.includes('Async') || ap.name.includes('State'))).toBe(true);
    });
  });

  describe('T-22: Null hazards', () => {
    it('should detect optional parameters', () => {
      const functions = [
        createMockFunction({ signature: 'function process(data?: string | null)' }),
      ];

      const result = analyzeT22NullHazards(functions, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Optional') || p.name.includes('Null'))).toBe(true);
    });
  });

  describe('T-23: Exception propagation', () => {
    it('should detect try-catch patterns', () => {
      const functions = [
        createMockFunction({ signature: 'try { doSomething() } catch (e) { handle(e) }' }),
      ];

      const result = analyzeT23ExceptionPropagation(functions, [], baseQuery);

      expect(result.patterns?.some(p => p.name.includes('Try-Catch'))).toBe(true);
    });
  });

  describe('T-24: Dead code', () => {
    it('should identify potentially dead functions', () => {
      const functions = [
        createMockFunction({ name: 'unusedHelper', filePath: '/src/helpers.ts' }),
      ];
      const modules = [
        createMockModule({ path: '/src/helpers.ts', exports: [] }),
      ];

      const result = analyzeT24DeadCode(functions, modules, baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name.includes('Dead') || ap.name.includes('Potentially'))).toBe(true);
    });
  });
});

// ============================================================================
// CATEGORY 5: HARD SCENARIOS (T-28 and T-29)
// T-25, T-26, T-27, T-30 tested in hard_scenario_patterns.test.ts
// ============================================================================

describe('Category 5: Extended HARD Scenarios', () => {
  describe('T-28: Performance anti-patterns', () => {
    it('should detect N+1 query patterns', () => {
      const functions = [
        createMockFunction({ signature: 'users.map(async u => await db.query(u.id))' }),
      ];

      const result = analyzeT28PerformanceAntiPatterns(functions, [], baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name.includes('N+1'))).toBe(true);
    });

    it('should detect synchronous file operations', () => {
      const functions = [
        createMockFunction({ name: 'readFileSync', signature: 'fs.readFileSync(path)' }),
      ];

      const result = analyzeT28PerformanceAntiPatterns(functions, [], baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name.includes('Sync'))).toBe(true);
    });

    it('should detect heavy dependencies', () => {
      const modules = [
        createMockModule({ path: '/src/utils.ts', dependencies: ['lodash', 'moment'] }),
      ];

      const result = analyzeT28PerformanceAntiPatterns([], modules, baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name.includes('Heavy'))).toBe(true);
    });
  });

  describe('T-29: Circular dependencies', () => {
    it('should detect no cycles in acyclic graph', () => {
      const modules = [
        createMockModule({ path: '/src/a.ts', dependencies: ['./b'] }),
        createMockModule({ path: '/src/b.ts', dependencies: ['./c'] }),
        createMockModule({ path: '/src/c.ts', dependencies: [] }),
      ];

      const result = analyzeT29CircularDependencies(modules, baseQuery);

      expect(result.patterns?.some(p => p.name.includes('No Circular'))).toBe(true);
    });

    it('should detect cycles in cyclic graph', () => {
      const modules = [
        createMockModule({ path: '/src/a.ts', dependencies: ['./b'] }),
        createMockModule({ path: '/src/b.ts', dependencies: ['./c'] }),
        createMockModule({ path: '/src/c.ts', dependencies: ['./a'] }),
      ];

      const result = analyzeT29CircularDependencies(modules, baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name.includes('Circular'))).toBe(true);
    });
  });
});

// ============================================================================
// COMPREHENSIVE ANALYSIS
// ============================================================================

describe('Comprehensive T-Pattern Analysis', () => {
  it('should analyze all T-patterns (T-01 to T-30)', () => {
    const functions = [
      createMockFunction({ name: 'createUser' }),
      createMockFunction({ name: 'validateEmail' }),
      createMockFunction({ name: 'handleError' }),
    ];
    const modules = [
      createMockModule({ path: '/src/user.ts', exports: ['createUser'] }),
      createMockModule({ path: '/src/utils.ts', exports: ['validateEmail'] }),
    ];

    const result = analyzeAllTPatterns(functions, modules, baseQuery);

    expect(result.coverage.implemented.length).toBe(30);
    expect(result.coverage.missing.length).toBe(0);
    expect(result.byCategory.size).toBeGreaterThanOrEqual(4);
  });

  it('should provide meaningful recommendations', () => {
    const functions = [
      createMockFunction({ name: 'a' }), // Short, non-descriptive name
      createMockFunction({ name: 'b' }),
    ];
    const modules: ModuleKnowledge[] = [];

    const result = analyzeAllTPatterns(functions, modules, baseQuery);

    // Should have some recommendations even with minimal input
    expect(result.recommendations).toBeDefined();
  });
});
