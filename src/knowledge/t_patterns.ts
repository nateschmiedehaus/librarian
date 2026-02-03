/**
 * @fileoverview Complete T-Series Pattern Library (T-01 to T-30)
 *
 * Comprehensive pattern detection for the 30 common agent tasks:
 *
 * Category 1: Code Navigation (T-01 to T-06)
 * Category 2: Code Understanding (T-07 to T-12)
 * Category 3: Code Modification Support (T-13 to T-18)
 * Category 4: Bug Investigation (T-19 to T-24)
 * Category 5: HARD Scenarios (T-25 to T-30)
 *
 * Each pattern provides:
 * - Detection logic
 * - Confidence scoring
 * - Evidence generation
 * - Remediation suggestions
 */

import type { FunctionKnowledge, ModuleKnowledge } from '../storage/types.js';
import type { DetectedPattern, DetectedAntiPattern, PatternQuery, PatternResult, PatternOccurrence } from './patterns.js';
import { buildModuleGraphs } from './module_graph.js';

// ============================================================================
// T-PATTERN REGISTRY
// ============================================================================

export interface TPatternDefinition {
  id: string;
  name: string;
  category: 'navigation' | 'understanding' | 'modification' | 'bug_investigation' | 'hard_scenarios';
  description: string;
  qualityCriteria: string;
}

export const T_PATTERN_REGISTRY: TPatternDefinition[] = [
  // Category 1: Code Navigation (T-01 to T-06)
  { id: 'T-01', name: 'Find function by name', category: 'navigation', description: 'Locate functions by exact or partial name match', qualityCriteria: 'Recall@1, latency <500ms' },
  { id: 'T-02', name: 'Find function by purpose', category: 'navigation', description: 'Semantic search for functions by purpose/intent', qualityCriteria: 'Recall@5 >= 80%' },
  { id: 'T-03', name: 'Navigate call graph', category: 'navigation', description: 'Find what functions call a given function', qualityCriteria: 'Precision >= 90%' },
  { id: 'T-04', name: 'Navigate dependency graph', category: 'navigation', description: 'Find what modules import a given module', qualityCriteria: 'Precision >= 95%' },
  { id: 'T-05', name: 'Find interface implementation', category: 'navigation', description: 'Locate implementations of interfaces/abstract classes', qualityCriteria: 'Accuracy = 100%' },
  { id: 'T-06', name: 'Find test file for source', category: 'navigation', description: 'Map source files to their test files', qualityCriteria: 'Recall >= 90%' },

  // Category 2: Code Understanding (T-07 to T-12)
  { id: 'T-07', name: 'Explain function purpose', category: 'understanding', description: 'Generate accurate function purpose explanations', qualityCriteria: 'Faithfulness >= 85%' },
  { id: 'T-08', name: 'Explain module architecture', category: 'understanding', description: 'Describe module structure and responsibilities', qualityCriteria: 'Grounding >= 80%' },
  { id: 'T-09', name: 'Identify design patterns', category: 'understanding', description: 'Detect classic design patterns in code', qualityCriteria: 'Precision >= 70%' },
  { id: 'T-10', name: 'Understand error handling', category: 'understanding', description: 'Map error handling flow through code', qualityCriteria: 'Completeness >= 80%' },
  { id: 'T-11', name: 'Trace data flow', category: 'understanding', description: 'Track data from input to output', qualityCriteria: 'Accuracy >= 85%' },
  { id: 'T-12', name: 'Identify side effects', category: 'understanding', description: 'Detect functions with side effects', qualityCriteria: 'Recall >= 75%' },

  // Category 3: Code Modification Support (T-13 to T-18)
  { id: 'T-13', name: 'Find all usages', category: 'modification', description: 'Find all usages before refactoring', qualityCriteria: 'Recall = 100%' },
  { id: 'T-14', name: 'Identify breaking changes', category: 'modification', description: 'Identify impact of breaking changes', qualityCriteria: 'Coverage >= 90%' },
  { id: 'T-15', name: 'Suggest similar patterns', category: 'modification', description: 'Find similar code patterns for reference', qualityCriteria: 'Relevance >= 75%' },
  { id: 'T-16', name: 'Find feature location', category: 'modification', description: 'Identify where to add new features', qualityCriteria: 'Precision >= 80%' },
  { id: 'T-17', name: 'Identify test gaps', category: 'modification', description: 'Find test coverage gaps', qualityCriteria: 'Accuracy >= 85%' },
  { id: 'T-18', name: 'Find configuration', category: 'modification', description: 'Locate configuration files and settings', qualityCriteria: 'Recall >= 95%' },

  // Category 4: Bug Investigation (T-19 to T-24)
  { id: 'T-19', name: 'Locate error source', category: 'bug_investigation', description: 'Find error source from stack trace', qualityCriteria: 'Accuracy >= 95%' },
  { id: 'T-20', name: 'Find related bugs', category: 'bug_investigation', description: 'Find similar bug patterns', qualityCriteria: 'Recall >= 60%' },
  { id: 'T-21', name: 'Detect race conditions', category: 'bug_investigation', description: 'Identify potential race conditions', qualityCriteria: 'Detection >= 50%' },
  { id: 'T-22', name: 'Find null hazards', category: 'bug_investigation', description: 'Detect null/undefined hazards', qualityCriteria: 'Precision >= 70%' },
  { id: 'T-23', name: 'Trace exceptions', category: 'bug_investigation', description: 'Trace exception propagation', qualityCriteria: 'Completeness >= 85%' },
  { id: 'T-24', name: 'Find dead code', category: 'bug_investigation', description: 'Detect unreachable code', qualityCriteria: 'Precision >= 80%' },

  // Category 5: HARD Scenarios (T-25 to T-30)
  { id: 'T-25', name: 'Metaprogramming analysis', category: 'hard_scenarios', description: 'Analyze dynamic metaprogramming patterns', qualityCriteria: '"I don\'t know" if uncertain' },
  { id: 'T-26', name: 'Framework magic', category: 'hard_scenarios', description: 'Understand ORM, DI, and framework patterns', qualityCriteria: 'Grounding >= 60%' },
  { id: 'T-27', name: 'Security vulnerabilities', category: 'hard_scenarios', description: 'Detect security vulnerabilities', qualityCriteria: 'Recall >= 50%, no false confidence' },
  { id: 'T-28', name: 'Performance anti-patterns', category: 'hard_scenarios', description: 'Detect performance issues', qualityCriteria: 'Precision >= 65%' },
  { id: 'T-29', name: 'Circular dependencies', category: 'hard_scenarios', description: 'Analyze circular dependencies', qualityCriteria: 'Accuracy >= 90%' },
  { id: 'T-30', name: 'Legacy code markers', category: 'hard_scenarios', description: 'Identify and explain legacy code', qualityCriteria: 'Honest uncertainty disclosure' },
];

// ============================================================================
// CATEGORY 1: CODE NAVIGATION PATTERNS (T-01 to T-06)
// ============================================================================

/**
 * T-01: Find function by name
 * Detects function naming patterns and searchability
 */
export function analyzeT01FunctionByName(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Analyze naming consistency
  const namePatterns = analyzeFunctionNamePatterns(functions);

  if (namePatterns.uniqueNames > functions.length * 0.95) {
    patterns.push({
      name: 'Unique Function Names',
      type: 'team',
      occurrences: [],
      confidence: 0.9,
      description: 'Functions have unique, searchable names',
    });
  }

  // Check for descriptive names (length-based heuristic)
  const descriptiveNames = functions.filter(f => f.name.length >= 10 && !f.name.includes('_'));
  if (descriptiveNames.length > functions.length * 0.5) {
    patterns.push({
      name: 'Descriptive Function Names',
      type: 'team',
      occurrences: descriptiveNames.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: descriptiveNames.length / functions.length,
      description: `${Math.round(descriptiveNames.length / functions.length * 100)}% of functions have descriptive names`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-01: Analyzed ${functions.length} functions for name searchability`,
    recommendations: namePatterns.duplicateNames.length > 0
      ? [`Consider renaming ${namePatterns.duplicateNames.length} functions with duplicate names`]
      : [],
  };
}

interface FunctionNameAnalysis {
  uniqueNames: number;
  duplicateNames: string[];
  averageLength: number;
}

function analyzeFunctionNamePatterns(functions: FunctionKnowledge[]): FunctionNameAnalysis {
  const nameCounts = new Map<string, number>();
  let totalLength = 0;

  for (const fn of functions) {
    nameCounts.set(fn.name, (nameCounts.get(fn.name) ?? 0) + 1);
    totalLength += fn.name.length;
  }

  const duplicates = [...nameCounts.entries()]
    .filter(([_, count]) => count > 1)
    .map(([name]) => name);

  return {
    uniqueNames: nameCounts.size,
    duplicateNames: duplicates,
    averageLength: totalLength / Math.max(1, functions.length),
  };
}

/**
 * T-02: Find function by purpose (semantic search support)
 * Detects functions with clear semantic purpose indicators
 */
export function analyzeT02SemanticSearch(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Check for documented purposes
  const documentedFunctions = functions.filter(f => f.purpose && f.purpose.length > 20);
  if (documentedFunctions.length > 0) {
    patterns.push({
      name: 'Documented Function Purposes',
      type: 'team',
      occurrences: documentedFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.purpose.substring(0, 50) + '...',
      })),
      confidence: documentedFunctions.length / Math.max(1, functions.length),
      description: `${documentedFunctions.length} functions have documented purposes`,
    });
  }

  // Check for semantic naming patterns
  const semanticPrefixes = [
    { prefix: 'validate', purpose: 'validation' },
    { prefix: 'create', purpose: 'creation' },
    { prefix: 'update', purpose: 'modification' },
    { prefix: 'delete', purpose: 'deletion' },
    { prefix: 'get', purpose: 'retrieval' },
    { prefix: 'set', purpose: 'assignment' },
    { prefix: 'is', purpose: 'boolean check' },
    { prefix: 'has', purpose: 'existence check' },
    { prefix: 'transform', purpose: 'data transformation' },
    { prefix: 'parse', purpose: 'parsing' },
    { prefix: 'format', purpose: 'formatting' },
    { prefix: 'render', purpose: 'rendering' },
    { prefix: 'handle', purpose: 'event handling' },
    { prefix: 'process', purpose: 'processing' },
    { prefix: 'compute', purpose: 'calculation' },
    { prefix: 'calculate', purpose: 'calculation' },
  ];

  const semanticFunctions = functions.filter(f =>
    semanticPrefixes.some(p => f.name.toLowerCase().startsWith(p.prefix))
  );

  if (semanticFunctions.length > functions.length * 0.3) {
    patterns.push({
      name: 'Semantic Function Naming',
      type: 'team',
      occurrences: semanticFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: semanticFunctions.length / Math.max(1, functions.length),
      description: `${Math.round(semanticFunctions.length / functions.length * 100)}% of functions use semantic prefixes`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-02: ${documentedFunctions.length} functions support semantic search`,
    recommendations: documentedFunctions.length < functions.length * 0.5
      ? ['Add JSDoc comments to improve semantic searchability']
      : [],
  };
}

/**
 * T-03: Navigate call graph (what calls X?)
 * Detects call graph patterns and complexity
 */
export function analyzeT03CallGraph(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Build dependency graph for modules
  const { graph, reverse } = buildModuleGraphs(modules);

  // Analyze call patterns
  const highInDegree = [...reverse.entries()]
    .filter(([_, callers]) => callers.size > 10)
    .map(([target]) => target);

  if (highInDegree.length > 0) {
    patterns.push({
      name: 'Highly Called Modules',
      type: 'structural',
      occurrences: highInDegree.slice(0, 5).map(m => ({
        file: m,
        evidence: `called by ${reverse.get(m)?.size ?? 0} modules`,
      })),
      confidence: 0.9,
      description: `${highInDegree.length} modules are called by >10 other modules`,
    });
  }

  // Check for orphaned functions (no callers, not exported)
  const exportedFunctions = new Set(modules.flatMap(m => m.exports));
  const orphanedFunctions = functions.filter(f =>
    !exportedFunctions.has(f.name) &&
    !f.name.startsWith('_') &&
    !f.filePath.includes('.test.') &&
    !f.filePath.includes('.spec.')
  );

  if (orphanedFunctions.length > functions.length * 0.1) {
    antiPatterns.push({
      name: 'Potentially Orphaned Functions',
      severity: 'low',
      occurrences: orphanedFunctions.slice(0, 10).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: `${orphanedFunctions.length} functions may be orphaned (not exported, not obviously called)`,
      remediation: 'Review these functions - they may be dead code or missing exports',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-03: Analyzed call graph with ${graph.size} modules`,
    recommendations: [],
  };
}

/**
 * T-04: Navigate dependency graph (what imports X?)
 * Detects import/dependency patterns
 */
export function analyzeT04DependencyGraph(
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Analyze dependency patterns
  const { reverse } = buildModuleGraphs(modules);

  // Find utility modules (many dependents)
  const utilityModules = modules.filter(m => {
    const dependents = reverse.get(m.path)?.size ?? 0;
    return dependents >= 5;
  });

  if (utilityModules.length > 0) {
    patterns.push({
      name: 'Utility Modules',
      type: 'structural',
      occurrences: utilityModules.slice(0, 5).map(m => ({
        file: m.path,
        evidence: `${reverse.get(m.path)?.size ?? 0} dependents`,
      })),
      confidence: 0.85,
      description: `${utilityModules.length} modules are widely depended upon`,
    });
  }

  // Find isolated modules (no dependencies, no dependents)
  const isolatedModules = modules.filter(m => {
    const dependents = reverse.get(m.path)?.size ?? 0;
    const dependencies = m.dependencies.filter(d => d.startsWith('.')).length;
    return dependents === 0 && dependencies === 0;
  });

  if (isolatedModules.length > 0) {
    patterns.push({
      name: 'Isolated Modules',
      type: 'structural',
      occurrences: isolatedModules.slice(0, 5).map(m => ({
        file: m.path,
        evidence: 'no local dependencies or dependents',
      })),
      confidence: 0.7,
      description: `${isolatedModules.length} modules are isolated (potential entry points or unused)`,
    });
  }

  // Check for deep dependency chains
  const depthMap = computeDependencyDepth(modules);
  const deepModules = [...depthMap.entries()]
    .filter(([_, depth]) => depth > 5)
    .map(([path]) => path);

  if (deepModules.length > 0) {
    antiPatterns.push({
      name: 'Deep Dependency Chains',
      severity: 'medium',
      occurrences: deepModules.slice(0, 5).map(path => ({
        file: path,
        evidence: `depth: ${depthMap.get(path)}`,
      })),
      description: `${deepModules.length} modules have deep dependency chains (>5 levels)`,
      remediation: 'Consider flattening dependencies or introducing facades',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-04: Analyzed ${modules.length} modules for dependency patterns`,
    recommendations: [],
  };
}

function computeDependencyDepth(modules: ModuleKnowledge[]): Map<string, number> {
  const depthMap = new Map<string, number>();
  const moduleMap = new Map(modules.map(m => [m.path, m]));

  function getDepth(path: string, visited: Set<string>): number {
    if (depthMap.has(path)) return depthMap.get(path)!;
    if (visited.has(path)) return 0; // Cycle detected

    visited.add(path);
    const mod = moduleMap.get(path);
    if (!mod) return 0;

    let maxChildDepth = 0;
    for (const dep of mod.dependencies) {
      if (dep.startsWith('.')) {
        // Resolve relative path (simplified)
        const resolvedPath = modules.find(m => m.path.endsWith(dep.replace(/^\.\//, '')))?.path;
        if (resolvedPath) {
          maxChildDepth = Math.max(maxChildDepth, getDepth(resolvedPath, visited));
        }
      }
    }

    const depth = maxChildDepth + 1;
    depthMap.set(path, depth);
    return depth;
  }

  for (const mod of modules) {
    if (!depthMap.has(mod.path)) {
      getDepth(mod.path, new Set());
    }
  }

  return depthMap;
}

/**
 * T-05: Find interface implementation
 * Detects interface/implementation patterns
 */
export function analyzeT05InterfaceImplementation(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Find interface definitions
  const interfaceModules = modules.filter(m =>
    m.exports.some(e => e.startsWith('I') && /^I[A-Z]/.test(e)) ||
    m.path.includes('interface') ||
    m.path.includes('types')
  );

  if (interfaceModules.length > 0) {
    patterns.push({
      name: 'Interface Definitions',
      type: 'structural',
      occurrences: interfaceModules.slice(0, 5).map(m => ({
        file: m.path,
        evidence: m.exports.filter(e => /^I[A-Z]/.test(e)).join(', ') || 'types file',
      })),
      confidence: 0.85,
      description: `${interfaceModules.length} modules contain interface definitions`,
    });
  }

  // Find implementation patterns
  const implementationFunctions = functions.filter(f =>
    f.signature.includes('implements') ||
    f.signature.includes('extends') ||
    f.name.includes('Impl')
  );

  if (implementationFunctions.length > 0) {
    patterns.push({
      name: 'Interface Implementations',
      type: 'structural',
      occurrences: implementationFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.8,
      description: `${implementationFunctions.length} classes implement interfaces`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-05: Found ${interfaceModules.length} interface modules, ${implementationFunctions.length} implementations`,
    recommendations: interfaceModules.length === 0
      ? ['Consider using interfaces for better abstraction and testability']
      : [],
  };
}

/**
 * T-06: Find test file for source file
 * Detects test file mapping patterns
 */
export function analyzeT06TestMapping(
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Separate source and test files
  const testFiles = modules.filter(m =>
    m.path.includes('.test.') ||
    m.path.includes('.spec.') ||
    m.path.includes('__tests__')
  );

  const sourceFiles = modules.filter(m =>
    !m.path.includes('.test.') &&
    !m.path.includes('.spec.') &&
    !m.path.includes('__tests__') &&
    !m.path.includes('node_modules')
  );

  // Calculate test coverage ratio
  const testRatio = testFiles.length / Math.max(1, sourceFiles.length);

  if (testRatio > 0.5) {
    patterns.push({
      name: 'High Test Coverage',
      type: 'team',
      occurrences: [],
      confidence: Math.min(0.95, testRatio),
      description: `Test ratio: ${Math.round(testRatio * 100)}% (${testFiles.length} tests for ${sourceFiles.length} source files)`,
    });
  } else if (testRatio < 0.2) {
    antiPatterns.push({
      name: 'Low Test Coverage',
      severity: 'medium',
      occurrences: [],
      description: `Only ${testFiles.length} test files for ${sourceFiles.length} source files`,
      remediation: 'Add unit tests for critical functionality',
    });
  }

  // Detect test naming conventions
  const testPatterns = detectTestNamingConventions(testFiles);
  if (testPatterns.convention) {
    patterns.push({
      name: `Test Convention: ${testPatterns.convention}`,
      type: 'team',
      occurrences: testPatterns.examples.map(f => ({
        file: f,
        evidence: testPatterns.convention ?? 'test convention',
      })),
      confidence: testPatterns.consistency,
      description: `Tests follow ${testPatterns.convention} convention`,
    });
  }

  // Find source files without tests
  const untestedFiles = findUntestedSourceFiles(sourceFiles, testFiles);
  if (untestedFiles.length > 0 && untestedFiles.length < sourceFiles.length * 0.5) {
    antiPatterns.push({
      name: 'Missing Tests',
      severity: 'low',
      occurrences: untestedFiles.slice(0, 10).map(f => ({
        file: f,
        evidence: 'no corresponding test file found',
      })),
      description: `${untestedFiles.length} source files have no corresponding test files`,
      remediation: 'Add tests for these source files',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-06: ${testFiles.length} test files for ${sourceFiles.length} source files`,
    recommendations: [],
  };
}

interface TestNamingResult {
  convention: string | null;
  examples: string[];
  consistency: number;
}

function detectTestNamingConventions(testFiles: ModuleKnowledge[]): TestNamingResult {
  const conventions = {
    '.test.': 0,
    '.spec.': 0,
    '__tests__': 0,
  };

  const examples: string[] = [];

  for (const file of testFiles) {
    if (file.path.includes('.test.')) {
      conventions['.test.']++;
      if (examples.length < 3) examples.push(file.path);
    } else if (file.path.includes('.spec.')) {
      conventions['.spec.']++;
      if (examples.length < 3) examples.push(file.path);
    } else if (file.path.includes('__tests__')) {
      conventions['__tests__']++;
      if (examples.length < 3) examples.push(file.path);
    }
  }

  const total = Object.values(conventions).reduce((a, b) => a + b, 0);
  const dominant = Object.entries(conventions).sort(([, a], [, b]) => b - a)[0];

  if (dominant && dominant[1] > total * 0.6) {
    return {
      convention: dominant[0],
      examples,
      consistency: dominant[1] / Math.max(1, total),
    };
  }

  return { convention: null, examples: [], consistency: 0 };
}

function findUntestedSourceFiles(sourceFiles: ModuleKnowledge[], testFiles: ModuleKnowledge[]): string[] {
  const testedPaths = new Set<string>();

  for (const testFile of testFiles) {
    // Extract potential source file names from test file
    const testName = testFile.path
      .replace('.test.', '.')
      .replace('.spec.', '.')
      .replace('__tests__/', '');

    // Check if any source file matches
    for (const sourceFile of sourceFiles) {
      if (testName.includes(sourceFile.path.split('/').pop()?.replace('.ts', '') ?? '')) {
        testedPaths.add(sourceFile.path);
      }
    }
  }

  return sourceFiles
    .filter(s => !testedPaths.has(s.path))
    .map(s => s.path);
}

// ============================================================================
// CATEGORY 2: CODE UNDERSTANDING PATTERNS (T-07 to T-12)
// ============================================================================

/**
 * T-07: Explain function purpose
 * Analyzes function documentation and clarity
 */
export function analyzeT07FunctionPurpose(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Analyze documentation quality
  const wellDocumented = functions.filter(f =>
    f.purpose && f.purpose.length > 30 && !f.purpose.includes('TODO')
  );

  const documentationRate = wellDocumented.length / Math.max(1, functions.length);

  if (documentationRate > 0.5) {
    patterns.push({
      name: 'Well-Documented Functions',
      type: 'team',
      occurrences: wellDocumented.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.purpose.substring(0, 50) + '...',
      })),
      confidence: documentationRate,
      description: `${Math.round(documentationRate * 100)}% of functions have clear purpose documentation`,
    });
  }

  // Check for self-documenting code (meaningful names + types)
  const selfDocumenting = functions.filter(f =>
    f.name.length > 8 &&
    (f.signature.includes(': ') || f.signature.includes('->'))
  );

  if (selfDocumenting.length > functions.length * 0.6) {
    patterns.push({
      name: 'Self-Documenting Code',
      type: 'team',
      occurrences: selfDocumenting.slice(0, 3).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: `${f.name}: ${f.signature.substring(0, 40)}`,
      })),
      confidence: selfDocumenting.length / Math.max(1, functions.length),
      description: 'Functions have meaningful names and type annotations',
    });
  }

  return {
    query,
    patterns,
    summary: `T-07: ${wellDocumented.length}/${functions.length} functions have clear purposes`,
    recommendations: documentationRate < 0.5
      ? ['Add JSDoc or docstrings to undocumented functions']
      : [],
  };
}

/**
 * T-08: Explain module architecture
 * Analyzes module structure and organization
 */
export function analyzeT08ModuleArchitecture(
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Detect architectural layers
  const layerIndicators = {
    api: ['api', 'routes', 'handlers', 'controllers'],
    business: ['services', 'domain', 'business', 'core'],
    data: ['storage', 'db', 'repository', 'data', 'models'],
    utils: ['utils', 'helpers', 'lib', 'common', 'shared'],
    config: ['config', 'settings', 'env'],
  };

  const detectedLayers = new Map<string, ModuleKnowledge[]>();

  for (const mod of modules) {
    for (const [layer, indicators] of Object.entries(layerIndicators)) {
      if (indicators.some(ind => mod.path.toLowerCase().includes(ind))) {
        if (!detectedLayers.has(layer)) detectedLayers.set(layer, []);
        detectedLayers.get(layer)!.push(mod);
        break;
      }
    }
  }

  if (detectedLayers.size >= 3) {
    patterns.push({
      name: 'Layered Architecture',
      type: 'emergent',
      occurrences: [...detectedLayers.entries()].map(([layer, mods]) => ({
        file: layer,
        evidence: `${mods.length} modules`,
      })),
      confidence: detectedLayers.size / 5,
      description: `Detected ${detectedLayers.size} architectural layers: ${[...detectedLayers.keys()].join(', ')}`,
    });
  }

  // Detect feature-based organization
  const topLevelDirs = new Set<string>();
  for (const mod of modules) {
    const parts = mod.path.split('/');
    if (parts.length > 2) {
      topLevelDirs.add(parts[1]);
    }
  }

  const featureDirs = [...topLevelDirs].filter(d =>
    !['utils', 'lib', 'common', 'shared', 'types', 'config', 'test', '__tests__'].includes(d)
  );

  if (featureDirs.length >= 4) {
    patterns.push({
      name: 'Feature-Based Organization',
      type: 'emergent',
      occurrences: featureDirs.slice(0, 5).map(d => ({
        file: d,
        evidence: 'feature directory',
      })),
      confidence: 0.7,
      description: `Code organized by feature: ${featureDirs.slice(0, 5).join(', ')}`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-08: Detected ${detectedLayers.size} layers, ${featureDirs.length} feature directories`,
    recommendations: [],
  };
}

/**
 * T-09: Identify design patterns
 * Already implemented in patterns.ts - this adds additional detection
 */
export function analyzeT09DesignPatterns(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Repository pattern
  const repositoryModules = modules.filter(m =>
    m.path.toLowerCase().includes('repository') ||
    m.exports.some(e => e.toLowerCase().includes('repository'))
  );

  if (repositoryModules.length > 0) {
    patterns.push({
      name: 'Repository Pattern',
      type: 'design',
      occurrences: repositoryModules.map(m => ({
        file: m.path,
        evidence: 'repository in name/exports',
      })),
      confidence: 0.8,
      description: 'Data access abstraction using Repository pattern',
    });
  }

  // Adapter pattern
  const adapterModules = modules.filter(m =>
    m.path.toLowerCase().includes('adapter') ||
    m.exports.some(e => e.toLowerCase().includes('adapter'))
  );

  if (adapterModules.length > 0) {
    patterns.push({
      name: 'Adapter Pattern',
      type: 'design',
      occurrences: adapterModules.map(m => ({
        file: m.path,
        evidence: 'adapter in name/exports',
      })),
      confidence: 0.8,
      description: 'Interface conversion using Adapter pattern',
    });
  }

  // Middleware pattern
  const middlewareFunctions = functions.filter(f =>
    f.name.toLowerCase().includes('middleware') ||
    f.signature.includes('next') && (f.signature.includes('req') || f.signature.includes('ctx'))
  );

  if (middlewareFunctions.length >= 2) {
    patterns.push({
      name: 'Middleware Pattern',
      type: 'design',
      occurrences: middlewareFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.75,
      description: 'Request processing using Middleware pattern',
    });
  }

  // Decorator pattern (class-based)
  const decoratorFunctions = functions.filter(f =>
    f.signature.includes('@') ||
    f.name.toLowerCase().includes('decorator') ||
    f.name.toLowerCase().includes('wrapper')
  );

  if (decoratorFunctions.length >= 2) {
    patterns.push({
      name: 'Decorator Pattern',
      type: 'design',
      occurrences: decoratorFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.7,
      description: 'Behavior extension using Decorator pattern',
    });
  }

  return {
    query,
    patterns,
    summary: `T-09: Detected ${patterns.length} design patterns`,
    recommendations: [],
  };
}

/**
 * T-10: Understand error handling flow
 * Detects error handling patterns
 */
export function analyzeT10ErrorHandling(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find error handlers
  const errorHandlers = functions.filter(f =>
    f.name.toLowerCase().includes('error') ||
    f.name.toLowerCase().includes('catch') ||
    f.name.toLowerCase().includes('handle') ||
    f.signature.includes('Error') ||
    f.signature.includes('catch')
  );

  if (errorHandlers.length > 0) {
    patterns.push({
      name: 'Error Handling Functions',
      type: 'behavioral',
      occurrences: errorHandlers.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: Math.min(0.9, errorHandlers.length / 10),
      description: `${errorHandlers.length} dedicated error handling functions`,
    });
  }

  // Check for Result/Either pattern
  const resultPattern = functions.filter(f =>
    f.signature.includes('Result<') ||
    f.signature.includes('Either<') ||
    f.signature.includes('| Error') ||
    f.name.includes('Result')
  );

  if (resultPattern.length >= 3) {
    patterns.push({
      name: 'Result/Either Pattern',
      type: 'behavioral',
      occurrences: resultPattern.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.signature.substring(0, 50),
      })),
      confidence: 0.8,
      description: 'Uses Result/Either types for explicit error handling',
    });
  }

  // Check for throw statements in non-error functions
  const throwingFunctions = functions.filter(f =>
    !f.name.toLowerCase().includes('error') &&
    f.signature.includes('throw')
  );

  if (throwingFunctions.length > functions.length * 0.1) {
    antiPatterns.push({
      name: 'Widespread Throw Usage',
      severity: 'low',
      occurrences: throwingFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: 'Many functions throw exceptions without catch blocks nearby',
      remediation: 'Consider using Result types or centralized error handling',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-10: ${errorHandlers.length} error handlers, ${resultPattern.length} Result patterns`,
    recommendations: errorHandlers.length < 3
      ? ['Consider implementing centralized error handling']
      : [],
  };
}

/**
 * T-11: Trace data flow (input to output)
 * Detects data transformation patterns
 */
export function analyzeT11DataFlow(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Find data transformation functions
  const transformers = functions.filter(f =>
    f.name.toLowerCase().includes('transform') ||
    f.name.toLowerCase().includes('convert') ||
    f.name.toLowerCase().includes('map') ||
    f.name.toLowerCase().includes('serialize') ||
    f.name.toLowerCase().includes('deserialize') ||
    f.name.toLowerCase().includes('parse') ||
    f.name.toLowerCase().includes('format')
  );

  if (transformers.length > 0) {
    patterns.push({
      name: 'Data Transformation Functions',
      type: 'behavioral',
      occurrences: transformers.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: Math.min(0.9, transformers.length / 20),
      description: `${transformers.length} data transformation functions`,
    });
  }

  // Detect pipe/compose patterns
  const pipelineFunctions = functions.filter(f =>
    f.name.toLowerCase().includes('pipe') ||
    f.name.toLowerCase().includes('compose') ||
    f.signature.includes('...fns')
  );

  if (pipelineFunctions.length > 0) {
    patterns.push({
      name: 'Pipeline/Composition Pattern',
      type: 'behavioral',
      occurrences: pipelineFunctions.map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.85,
      description: 'Uses function composition for data flow',
    });
  }

  // Find pure functions (no 'this', no external state)
  const pureFunctions = functions.filter(f =>
    !f.signature.includes('this.') &&
    !f.signature.includes('state') &&
    f.signature.includes('=>')
  );

  if (pureFunctions.length > functions.length * 0.3) {
    patterns.push({
      name: 'Pure Function Style',
      type: 'team',
      occurrences: pureFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: pureFunctions.length / Math.max(1, functions.length),
      description: `${Math.round(pureFunctions.length / functions.length * 100)}% potentially pure functions (no 'this' or 'state')`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-11: ${transformers.length} transformers, ${pipelineFunctions.length} pipeline functions`,
    recommendations: [],
  };
}

/**
 * T-12: Identify side effects
 * Detects functions with side effects
 */
export function analyzeT12SideEffects(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Side effect indicators
  const sideEffectIndicators = [
    { pattern: /console\.(log|error|warn|info)/, name: 'Console output' },
    { pattern: /\bfs\./, name: 'File system' },
    { pattern: /\bfetch\(|axios|http\./, name: 'Network call' },
    { pattern: /localStorage|sessionStorage/, name: 'Browser storage' },
    { pattern: /document\.|window\./, name: 'DOM manipulation' },
    { pattern: /setState|this\.state/, name: 'State mutation' },
    { pattern: /\.push\(|\.pop\(|\.splice\(|\.shift\(/, name: 'Array mutation' },
    { pattern: /Date\.now|new Date/, name: 'Time dependency' },
    { pattern: /Math\.random/, name: 'Random dependency' },
  ];

  const sideEffectFunctions: Array<{ fn: FunctionKnowledge; effects: string[] }> = [];

  for (const fn of functions) {
    const effects: string[] = [];
    for (const indicator of sideEffectIndicators) {
      if (indicator.pattern.test(fn.signature) || indicator.pattern.test(fn.purpose)) {
        effects.push(indicator.name);
      }
    }
    if (effects.length > 0) {
      sideEffectFunctions.push({ fn, effects });
    }
  }

  if (sideEffectFunctions.length > 0) {
    patterns.push({
      name: 'Functions with Side Effects',
      type: 'behavioral',
      occurrences: sideEffectFunctions.slice(0, 10).map(({ fn, effects }) => ({
        file: fn.filePath,
        line: fn.startLine,
        evidence: `${fn.name}: ${effects.join(', ')}`,
      })),
      confidence: 0.8,
      description: `${sideEffectFunctions.length} functions have detectable side effects`,
    });
  }

  // Check for mixed pure/impure functions
  const sideEffectRatio = sideEffectFunctions.length / Math.max(1, functions.length);
  if (sideEffectRatio > 0.3 && sideEffectRatio < 0.7) {
    antiPatterns.push({
      name: 'Mixed Purity',
      severity: 'low',
      occurrences: [],
      description: 'Codebase has mixed pure and impure functions without clear separation',
      remediation: 'Consider separating pure business logic from side-effect functions',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-12: ${sideEffectFunctions.length}/${functions.length} functions have side effects`,
    recommendations: sideEffectRatio > 0.5
      ? ['Consider isolating side effects at module boundaries']
      : [],
  };
}

// ============================================================================
// CATEGORY 3: CODE MODIFICATION SUPPORT (T-13 to T-18)
// ============================================================================

/**
 * T-13: Find all usages before refactor
 * Analyzes code for refactoring readiness
 */
export function analyzeT13UsageAnalysis(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Find exported functions (more usage tracking needed)
  const exportedFunctions = new Set<string>();
  for (const mod of modules) {
    for (const exp of mod.exports) {
      exportedFunctions.add(exp);
    }
  }

  const publicFunctions = functions.filter(f => exportedFunctions.has(f.name));

  if (publicFunctions.length > 0) {
    patterns.push({
      name: 'Public API Surface',
      type: 'structural',
      occurrences: publicFunctions.slice(0, 10).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.9,
      description: `${publicFunctions.length} functions are exported (public API)`,
    });
  }

  // Find re-exported functions (cross-module dependencies)
  const reExports = modules.filter(m =>
    m.exports.length > 3 && m.path.includes('index')
  );

  if (reExports.length > 0) {
    patterns.push({
      name: 'Barrel Exports',
      type: 'structural',
      occurrences: reExports.map(m => ({
        file: m.path,
        evidence: `${m.exports.length} exports`,
      })),
      confidence: 0.85,
      description: 'Uses barrel files (index.ts) for re-exports',
    });
  }

  return {
    query,
    patterns,
    summary: `T-13: ${publicFunctions.length} public functions, ${reExports.length} barrel files`,
    recommendations: [],
  };
}

/**
 * T-14: Identify breaking change impact
 * Detects patterns that affect breaking change analysis
 */
export function analyzeT14BreakingChanges(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find versioned APIs
  const versionedModules = modules.filter(m =>
    /v\d+/.test(m.path) || m.path.includes('version')
  );

  if (versionedModules.length > 0) {
    patterns.push({
      name: 'Versioned API',
      type: 'structural',
      occurrences: versionedModules.map(m => ({
        file: m.path,
        evidence: 'version in path',
      })),
      confidence: 0.9,
      description: 'API versioning detected (v1, v2, etc.)',
    });
  }

  // Find deprecated functions
  const deprecatedFunctions = functions.filter(f =>
    f.purpose.toLowerCase().includes('deprecated') ||
    f.signature.includes('@deprecated')
  );

  if (deprecatedFunctions.length > 0) {
    patterns.push({
      name: 'Deprecated Functions',
      type: 'team',
      occurrences: deprecatedFunctions.map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.95,
      description: `${deprecatedFunctions.length} deprecated functions to track`,
    });
  }

  // Find widely-used modules (high impact if changed)
  const { reverse } = buildModuleGraphs(modules);
  const highImpactModules = modules.filter(m =>
    (reverse.get(m.path)?.size ?? 0) > 5
  );

  if (highImpactModules.length > 0) {
    antiPatterns.push({
      name: 'High-Impact Modules',
      severity: 'medium',
      occurrences: highImpactModules.slice(0, 5).map(m => ({
        file: m.path,
        evidence: `${reverse.get(m.path)?.size ?? 0} dependents`,
      })),
      description: 'Changes to these modules affect many dependents',
      remediation: 'Ensure thorough testing and consider semantic versioning',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-14: ${versionedModules.length} versioned APIs, ${highImpactModules.length} high-impact modules`,
    recommendations: [],
  };
}

/**
 * T-15: Suggest similar code patterns
 * Detects recurring code patterns for reference
 */
export function analyzeT15SimilarPatterns(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Group functions by prefix
  const prefixGroups = new Map<string, FunctionKnowledge[]>();
  for (const fn of functions) {
    const prefix = fn.name.match(/^(get|set|is|has|can|create|update|delete|handle|on|validate|parse|format)/i)?.[0]?.toLowerCase();
    if (prefix) {
      if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
      prefixGroups.get(prefix)!.push(fn);
    }
  }

  // Report significant groups
  for (const [prefix, fns] of prefixGroups) {
    if (fns.length >= 5) {
      patterns.push({
        name: `${prefix}* Pattern Group`,
        type: 'team',
        occurrences: fns.slice(0, 5).map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: f.name,
        })),
        confidence: 0.7,
        description: `${fns.length} functions follow ${prefix}* naming pattern`,
      });
    }
  }

  // Find functions with similar signatures
  const signatureGroups = new Map<string, FunctionKnowledge[]>();
  for (const fn of functions) {
    // Normalize signature for comparison
    const normalizedSig = fn.signature
      .replace(/\w+:/g, ':') // Remove parameter names
      .replace(/\s+/g, ' ');
    if (!signatureGroups.has(normalizedSig)) signatureGroups.set(normalizedSig, []);
    signatureGroups.get(normalizedSig)!.push(fn);
  }

  const largeSigGroups = [...signatureGroups.entries()].filter(([_, fns]) => fns.length >= 3);
  if (largeSigGroups.length > 0) {
    patterns.push({
      name: 'Consistent Function Signatures',
      type: 'team',
      occurrences: largeSigGroups.slice(0, 3).flatMap(([_, fns]) =>
        fns.slice(0, 2).map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: f.name,
        }))
      ),
      confidence: 0.75,
      description: `${largeSigGroups.length} groups of functions with similar signatures`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-15: Found ${prefixGroups.size} naming patterns, ${largeSigGroups.length} signature groups`,
    recommendations: [],
  };
}

/**
 * T-16: Find where to add new feature
 * Analyzes code structure for feature addition guidance
 */
export function analyzeT16FeatureLocation(
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Find entry points
  const entryPoints = modules.filter(m =>
    m.path.includes('index') ||
    m.path.includes('main') ||
    m.path.includes('app') ||
    m.path.includes('server') ||
    m.path.includes('cli')
  );

  if (entryPoints.length > 0) {
    patterns.push({
      name: 'Application Entry Points',
      type: 'structural',
      occurrences: entryPoints.map(m => ({
        file: m.path,
        evidence: 'entry point file',
      })),
      confidence: 0.9,
      description: `${entryPoints.length} entry point modules identified`,
    });
  }

  // Find extension points (modules with many exports)
  const extensionPoints = modules.filter(m =>
    m.exports.length > 5 && !m.path.includes('types')
  );

  if (extensionPoints.length > 0) {
    patterns.push({
      name: 'Extension Points',
      type: 'structural',
      occurrences: extensionPoints.slice(0, 5).map(m => ({
        file: m.path,
        evidence: `${m.exports.length} exports`,
      })),
      confidence: 0.75,
      description: 'Modules with many exports (potential extension points)',
    });
  }

  // Find feature directories
  const featureDirs = new Set<string>();
  for (const mod of modules) {
    const parts = mod.path.split('/');
    if (parts.length > 2 && !['utils', 'types', 'lib', 'common', 'shared'].includes(parts[1])) {
      featureDirs.add(parts[1]);
    }
  }

  if (featureDirs.size >= 3) {
    patterns.push({
      name: 'Feature Directories',
      type: 'emergent',
      occurrences: [...featureDirs].slice(0, 5).map(d => ({
        file: d,
        evidence: 'feature directory',
      })),
      confidence: 0.8,
      description: `Features organized in directories: ${[...featureDirs].slice(0, 5).join(', ')}`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-16: ${entryPoints.length} entry points, ${extensionPoints.length} extension points, ${featureDirs.size} features`,
    recommendations: [],
  };
}

/**
 * T-17: Identify test coverage gaps
 * Detects potential test coverage issues
 */
export function analyzeT17TestGaps(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find complex functions that might need more tests
  const complexFunctions = functions.filter(f =>
    f.endLine - f.startLine > 30 && !f.filePath.includes('.test.')
  );

  if (complexFunctions.length > 0) {
    antiPatterns.push({
      name: 'Complex Functions Need Tests',
      severity: 'low',
      occurrences: complexFunctions.slice(0, 10).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: `${f.endLine - f.startLine} lines`,
      })),
      description: `${complexFunctions.length} complex functions (>30 lines) - verify test coverage`,
      remediation: 'Ensure these functions have thorough unit tests',
    });
  }

  // Find public APIs without corresponding tests
  const testModules = new Set(
    modules
      .filter(m => m.path.includes('.test.') || m.path.includes('.spec.'))
      .map(m => m.path.replace('.test.', '.').replace('.spec.', '.'))
  );

  const untestedPublicModules = modules.filter(m =>
    m.exports.length > 0 &&
    !m.path.includes('.test.') &&
    !m.path.includes('.spec.') &&
    !testModules.has(m.path)
  );

  if (untestedPublicModules.length > 0) {
    antiPatterns.push({
      name: 'Public Modules Without Tests',
      severity: 'medium',
      occurrences: untestedPublicModules.slice(0, 10).map(m => ({
        file: m.path,
        evidence: `${m.exports.length} exports, no test file found`,
      })),
      description: `${untestedPublicModules.length} public modules may lack test coverage`,
      remediation: 'Add test files for these public modules',
    });
  }

  // Find error handlers without tests
  const errorHandlers = functions.filter(f =>
    (f.name.toLowerCase().includes('error') || f.name.toLowerCase().includes('catch')) &&
    !f.filePath.includes('.test.')
  );

  if (errorHandlers.length >= 3) {
    patterns.push({
      name: 'Error Handlers to Test',
      type: 'behavioral',
      occurrences: errorHandlers.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.7,
      description: `${errorHandlers.length} error handlers - verify they have error scenario tests`,
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-17: ${complexFunctions.length} complex functions, ${untestedPublicModules.length} potentially untested modules`,
    recommendations: antiPatterns.length > 0
      ? ['Review test coverage for identified modules']
      : [],
  };
}

/**
 * T-18: Find configuration locations
 * Detects configuration patterns
 */
export function analyzeT18Configuration(
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Find configuration files
  const configModules = modules.filter(m =>
    m.path.includes('config') ||
    m.path.includes('settings') ||
    m.path.includes('env') ||
    m.path.includes('options') ||
    m.path.includes('constants')
  );

  if (configModules.length > 0) {
    patterns.push({
      name: 'Configuration Modules',
      type: 'structural',
      occurrences: configModules.map(m => ({
        file: m.path,
        evidence: m.exports.slice(0, 3).join(', ') || 'config file',
      })),
      confidence: 0.95,
      description: `${configModules.length} configuration modules found`,
    });
  }

  // Find environment variable usage
  const envModules = modules.filter(m =>
    m.exports.some(e => e.toUpperCase() === e && e.length > 3) // ALL_CAPS exports
  );

  if (envModules.length > 0) {
    patterns.push({
      name: 'Environment Configuration',
      type: 'structural',
      occurrences: envModules.slice(0, 5).map(m => ({
        file: m.path,
        evidence: m.exports.filter(e => e.toUpperCase() === e).slice(0, 3).join(', '),
      })),
      confidence: 0.8,
      description: 'Modules with CONSTANT exports (likely config)',
    });
  }

  // Find schema/validation modules
  const schemaModules = modules.filter(m =>
    m.path.includes('schema') ||
    m.path.includes('validation') ||
    m.exports.some(e => e.toLowerCase().includes('schema'))
  );

  if (schemaModules.length > 0) {
    patterns.push({
      name: 'Schema Definitions',
      type: 'structural',
      occurrences: schemaModules.map(m => ({
        file: m.path,
        evidence: 'schema/validation file',
      })),
      confidence: 0.85,
      description: `${schemaModules.length} schema/validation modules`,
    });
  }

  return {
    query,
    patterns,
    summary: `T-18: ${configModules.length} config modules, ${schemaModules.length} schema modules`,
    recommendations: configModules.length === 0
      ? ['Consider centralizing configuration in config/ directory']
      : [],
  };
}

// ============================================================================
// CATEGORY 4: BUG INVESTIGATION (T-19 to T-24)
// ============================================================================

/**
 * T-19: Locate error source from stack trace
 * Detects error source patterns
 */
export function analyzeT19ErrorSource(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  // Find error-throwing functions
  const throwingFunctions = functions.filter(f =>
    f.signature.includes('throw') ||
    f.signature.includes('Error(')
  );

  if (throwingFunctions.length > 0) {
    patterns.push({
      name: 'Error-Throwing Functions',
      type: 'behavioral',
      occurrences: throwingFunctions.slice(0, 10).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.9,
      description: `${throwingFunctions.length} functions can throw errors`,
    });
  }

  // Find assertion functions
  const assertionFunctions = functions.filter(f =>
    f.name.toLowerCase().includes('assert') ||
    f.name.toLowerCase().includes('expect') ||
    f.name.toLowerCase().includes('ensure') ||
    f.name.toLowerCase().includes('require')
  );

  if (assertionFunctions.length > 0) {
    patterns.push({
      name: 'Assertion Functions',
      type: 'behavioral',
      occurrences: assertionFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.85,
      description: `${assertionFunctions.length} assertion/validation functions`,
    });
  }

  // Find error boundary modules
  const errorBoundaries = modules.filter(m =>
    m.path.includes('error') ||
    m.path.includes('boundary') ||
    m.exports.some(e => e.toLowerCase().includes('error'))
  );

  if (errorBoundaries.length > 0) {
    patterns.push({
      name: 'Error Boundary Modules',
      type: 'structural',
      occurrences: errorBoundaries.map(m => ({
        file: m.path,
        evidence: 'error boundary',
      })),
      confidence: 0.8,
      description: 'Modules containing error handling boundaries',
    });
  }

  return {
    query,
    patterns,
    summary: `T-19: ${throwingFunctions.length} throwing functions, ${errorBoundaries.length} error boundaries`,
    recommendations: [],
  };
}

/**
 * T-20: Find related bugs (similar patterns)
 * Detects patterns that might indicate related bugs
 */
export function analyzeT20RelatedBugs(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find functions with similar error-prone patterns
  const errorPronePatterns = [
    { pattern: /\.length\s*[<>=]/, name: 'Array length check' },
    { pattern: /null|undefined/, name: 'Null/undefined handling' },
    { pattern: /parseInt|parseFloat|Number\(/, name: 'Numeric parsing' },
    { pattern: /\.split\(|\.slice\(|\.substring\(/, name: 'String manipulation' },
    { pattern: /async|await|Promise/, name: 'Async operation' },
    { pattern: /JSON\.parse|JSON\.stringify/, name: 'JSON serialization' },
    { pattern: /Date\(|\.getTime\(|timestamp/, name: 'Date handling' },
  ];

  for (const { pattern, name } of errorPronePatterns) {
    const matchingFunctions = functions.filter(f =>
      pattern.test(f.signature) || pattern.test(f.purpose)
    );

    if (matchingFunctions.length >= 3) {
      patterns.push({
        name: `${name} Functions`,
        type: 'behavioral',
        occurrences: matchingFunctions.slice(0, 5).map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: f.name,
        })),
        confidence: 0.7,
        description: `${matchingFunctions.length} functions with ${name.toLowerCase()} - check for similar bugs`,
      });
    }
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-20: Identified ${patterns.length} error-prone pattern groups`,
    recommendations: patterns.length > 3
      ? ['Review functions with similar patterns for consistent error handling']
      : [],
  };
}

/**
 * T-21: Identify race condition potential
 * Detects patterns that might indicate race conditions
 */
export function analyzeT21RaceConditions(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find async functions that modify shared state
  const asyncStateModifiers = functions.filter(f =>
    (f.signature.includes('async') || f.signature.includes('Promise')) &&
    (f.signature.includes('this.') || f.signature.includes('state') || f.signature.includes('global'))
  );

  if (asyncStateModifiers.length > 0) {
    antiPatterns.push({
      name: 'Async State Modification',
      severity: 'medium',
      occurrences: asyncStateModifiers.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: `${asyncStateModifiers.length} async functions modify state - potential race conditions`,
      remediation: 'Consider using locks, queues, or atomic operations',
    });
  }

  // Find read-modify-write patterns
  const rmwPatterns = functions.filter(f =>
    f.signature.includes('++') ||
    f.signature.includes('--') ||
    f.signature.includes('+=') ||
    f.signature.includes('-=')
  );

  if (rmwPatterns.length > 0) {
    patterns.push({
      name: 'Read-Modify-Write Operations',
      type: 'behavioral',
      occurrences: rmwPatterns.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.6,
      description: `${rmwPatterns.length} functions with increment/decrement operations`,
    });
  }

  // Find setTimeout/setInterval usage
  const timerFunctions = functions.filter(f =>
    f.signature.includes('setTimeout') ||
    f.signature.includes('setInterval') ||
    f.signature.includes('requestAnimationFrame')
  );

  if (timerFunctions.length > 0) {
    patterns.push({
      name: 'Timer-Based Operations',
      type: 'behavioral',
      occurrences: timerFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.5,
      description: `${timerFunctions.length} functions use timers - check for race conditions`,
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-21: ${asyncStateModifiers.length} async state modifiers, ${timerFunctions.length} timer operations`,
    recommendations: asyncStateModifiers.length > 3
      ? ['Review async state modifications for race condition safety']
      : [],
  };
}

/**
 * T-22: Find null/undefined hazards
 * Detects potential null/undefined issues
 */
export function analyzeT22NullHazards(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find functions with optional parameters
  const optionalParams = functions.filter(f =>
    f.signature.includes('?:') ||
    f.signature.includes('| null') ||
    f.signature.includes('| undefined') ||
    f.signature.includes('= null') ||
    f.signature.includes('= undefined')
  );

  if (optionalParams.length > 0) {
    patterns.push({
      name: 'Optional Parameters',
      type: 'behavioral',
      occurrences: optionalParams.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.8,
      description: `${optionalParams.length} functions have optional/nullable parameters`,
    });
  }

  // Find potential null dereference patterns
  const nullDereferenceRisk = functions.filter(f =>
    f.signature.includes('.') &&
    !f.signature.includes('?.') &&
    (f.signature.includes('| null') || f.signature.includes('| undefined'))
  );

  if (nullDereferenceRisk.length > 0) {
    antiPatterns.push({
      name: 'Potential Null Dereference',
      severity: 'medium',
      occurrences: nullDereferenceRisk.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: 'Functions accessing properties on potentially null values without optional chaining',
      remediation: 'Use optional chaining (?.) or null checks before property access',
    });
  }

  // Find functions that return nullable values
  const nullableReturns = functions.filter(f =>
    f.signature.includes('): null') ||
    f.signature.includes('| null') ||
    f.signature.includes('| undefined') ||
    f.signature.includes(': void')
  );

  if (nullableReturns.length > 0) {
    patterns.push({
      name: 'Nullable Return Types',
      type: 'behavioral',
      occurrences: nullableReturns.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.75,
      description: `${nullableReturns.length} functions can return null/undefined`,
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-22: ${optionalParams.length} optional params, ${nullDereferenceRisk.length} null dereference risks`,
    recommendations: nullDereferenceRisk.length > 5
      ? ['Enable strict null checks in TypeScript configuration']
      : [],
  };
}

/**
 * T-23: Trace exception propagation
 * Detects exception handling patterns
 */
export function analyzeT23ExceptionPropagation(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find try-catch blocks
  const tryCatchFunctions = functions.filter(f =>
    f.signature.includes('try') ||
    f.signature.includes('catch')
  );

  if (tryCatchFunctions.length > 0) {
    patterns.push({
      name: 'Try-Catch Blocks',
      type: 'behavioral',
      occurrences: tryCatchFunctions.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.85,
      description: `${tryCatchFunctions.length} functions with try-catch blocks`,
    });
  }

  // Find async functions without try-catch (potential unhandled rejections)
  const asyncWithoutCatch = functions.filter(f =>
    f.signature.includes('async') &&
    !f.signature.includes('try') &&
    !f.signature.includes('catch') &&
    !f.signature.includes('.catch(')
  );

  if (asyncWithoutCatch.length > functions.filter(f => f.signature.includes('async')).length * 0.5) {
    antiPatterns.push({
      name: 'Unhandled Async Exceptions',
      severity: 'medium',
      occurrences: asyncWithoutCatch.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: 'Many async functions lack explicit error handling',
      remediation: 'Add try-catch or .catch() to handle async errors',
    });
  }

  // Find global error handlers
  const globalHandlers = functions.filter(f =>
    f.name.toLowerCase().includes('unhandled') ||
    f.name.toLowerCase().includes('global') ||
    f.name.toLowerCase().includes('uncaught')
  );

  if (globalHandlers.length > 0) {
    patterns.push({
      name: 'Global Error Handlers',
      type: 'behavioral',
      occurrences: globalHandlers.map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.9,
      description: 'Global/unhandled exception handlers present',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-23: ${tryCatchFunctions.length} try-catch, ${asyncWithoutCatch.length} async without catch`,
    recommendations: asyncWithoutCatch.length > 10
      ? ['Add error handling to async functions']
      : [],
  };
}

/**
 * T-24: Find dead code
 * Detects potentially unreachable code
 */
export function analyzeT24DeadCode(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // Find unexported, non-test functions
  const exportedNames = new Set(modules.flatMap(m => m.exports));
  const potentiallyDead = functions.filter(f =>
    !exportedNames.has(f.name) &&
    !f.filePath.includes('.test.') &&
    !f.filePath.includes('.spec.') &&
    !f.name.startsWith('_') &&
    !['constructor', 'render', 'componentDidMount'].includes(f.name)
  );

  if (potentiallyDead.length > 0) {
    antiPatterns.push({
      name: 'Potentially Dead Functions',
      severity: 'low',
      occurrences: potentiallyDead.slice(0, 10).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: `${potentiallyDead.length} non-exported functions - verify they are used`,
      remediation: 'Remove unused code or export if needed externally',
    });
  }

  // Find commented-out code patterns
  const commentedCode = functions.filter(f =>
    f.signature.includes('// ') ||
    f.purpose.includes('commented') ||
    f.purpose.includes('disabled')
  );

  if (commentedCode.length > 0) {
    antiPatterns.push({
      name: 'Commented-Out Code',
      severity: 'low',
      occurrences: commentedCode.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: 'Functions with commented-out code sections',
      remediation: 'Remove commented code or convert to proper feature flags',
    });
  }

  // Find deprecated but still present
  const deprecatedStillPresent = functions.filter(f =>
    f.purpose.toLowerCase().includes('deprecated') ||
    f.signature.includes('@deprecated')
  );

  if (deprecatedStillPresent.length > 0) {
    patterns.push({
      name: 'Deprecated Functions',
      type: 'team',
      occurrences: deprecatedStillPresent.map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.9,
      description: `${deprecatedStillPresent.length} deprecated functions still in codebase`,
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-24: ${potentiallyDead.length} potentially dead, ${deprecatedStillPresent.length} deprecated`,
    recommendations: potentiallyDead.length > 20
      ? ['Run dead code elimination analysis']
      : [],
  };
}

// ============================================================================
// CATEGORY 5: HARD SCENARIOS (T-25 to T-30)
// T-25, T-26, T-27, T-30 already implemented in pattern_behavior.ts
// T-28, T-29 implemented below
// ============================================================================

/**
 * T-28: Performance anti-pattern detection
 * Detects performance issues
 */
export function analyzeT28PerformanceAntiPatterns(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  // N+1 query patterns
  const n1Patterns = functions.filter(f =>
    f.signature.includes('.map(') &&
    (f.signature.includes('await') || f.signature.includes('query') || f.signature.includes('fetch'))
  );

  if (n1Patterns.length > 0) {
    antiPatterns.push({
      name: 'Potential N+1 Queries',
      severity: 'high',
      occurrences: n1Patterns.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: 'Async operations inside .map() - potential N+1 query pattern',
      remediation: 'Use Promise.all() or batch queries',
    });
  }

  // Synchronous file operations
  const syncFileOps = functions.filter(f =>
    f.signature.includes('Sync(') ||
    f.name.includes('Sync')
  );

  if (syncFileOps.length > 0) {
    antiPatterns.push({
      name: 'Synchronous File Operations',
      severity: 'medium',
      occurrences: syncFileOps.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: `${syncFileOps.length} synchronous file operations - blocks event loop`,
      remediation: 'Use async versions of file operations',
    });
  }

  // Memory leak patterns
  const memoryLeakPatterns = functions.filter(f =>
    f.signature.includes('addEventListener') &&
    !f.signature.includes('removeEventListener')
  );

  if (memoryLeakPatterns.length > 0) {
    antiPatterns.push({
      name: 'Potential Memory Leaks',
      severity: 'medium',
      occurrences: memoryLeakPatterns.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      description: 'Event listeners added without corresponding removal',
      remediation: 'Add cleanup logic to remove event listeners',
    });
  }

  // Large array operations
  const largeArrayOps = functions.filter(f =>
    f.signature.includes('.filter(') &&
    f.signature.includes('.map(') &&
    f.signature.includes('.reduce(')
  );

  if (largeArrayOps.length > 0) {
    patterns.push({
      name: 'Chained Array Operations',
      type: 'behavioral',
      occurrences: largeArrayOps.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.6,
      description: 'Chained array operations - consider combining for performance',
    });
  }

  // Unoptimized regex
  const regexPatterns = functions.filter(f =>
    f.signature.includes('new RegExp(') ||
    f.signature.includes('/.*/')
  );

  if (regexPatterns.length > 0) {
    patterns.push({
      name: 'Dynamic Regex',
      type: 'behavioral',
      occurrences: regexPatterns.slice(0, 5).map(f => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.5,
      description: 'Dynamic regex creation - may affect performance if called frequently',
    });
  }

  // Bundle size patterns
  const heavyImports = modules.filter(m =>
    m.dependencies.some(d =>
      d.includes('lodash') ||
      d.includes('moment') ||
      d.includes('jquery')
    )
  );

  if (heavyImports.length > 0) {
    antiPatterns.push({
      name: 'Heavy Dependencies',
      severity: 'low',
      occurrences: heavyImports.slice(0, 5).map(m => ({
        file: m.path,
        evidence: m.dependencies.filter(d => d.includes('lodash') || d.includes('moment')).join(', '),
      })),
      description: 'Large libraries imported - consider tree-shaking or alternatives',
      remediation: 'Use lodash-es, date-fns, or native methods',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-28: ${antiPatterns.length} performance anti-patterns detected`,
    recommendations: antiPatterns.length > 0
      ? antiPatterns.map(ap => `Fix ${ap.name}: ${ap.remediation}`)
      : ['No major performance anti-patterns detected'],
  };
}

/**
 * T-29: Circular dependency analysis
 * Detects circular dependencies between modules
 */
export function analyzeT29CircularDependencies(
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];

  const { graph } = buildModuleGraphs(modules);

  // Find cycles using DFS
  const cycles = findCycles(graph, 20);

  if (cycles.length > 0) {
    antiPatterns.push({
      name: 'Circular Dependencies',
      severity: cycles.length > 5 ? 'critical' : 'high',
      occurrences: cycles.slice(0, 5).map(cycle => ({
        file: cycle.join(' -> '),
        evidence: `${cycle.length} modules in cycle`,
      })),
      description: `${cycles.length} circular dependency chains detected`,
      remediation: 'Break cycles with dependency inversion, shared interfaces, or module restructuring',
    });

    // Identify modules involved in multiple cycles
    const cycleParticipants = new Map<string, number>();
    for (const cycle of cycles) {
      for (const node of cycle) {
        cycleParticipants.set(node, (cycleParticipants.get(node) ?? 0) + 1);
      }
    }

    const frequentParticipants = [...cycleParticipants.entries()]
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (frequentParticipants.length > 0) {
      antiPatterns.push({
        name: 'Cycle Hub Modules',
        severity: 'high',
        occurrences: frequentParticipants.slice(0, 5).map(([path, count]) => ({
          file: path,
          evidence: `involved in ${count} cycles`,
        })),
        description: 'Modules that participate in multiple cycles',
        remediation: 'These modules are good candidates for refactoring',
      });
    }
  } else {
    patterns.push({
      name: 'No Circular Dependencies',
      type: 'structural',
      occurrences: [],
      confidence: 1.0,
      description: 'Module graph is acyclic - no circular dependencies detected',
    });
  }

  // Check for near-cycles (A -> B -> C -> A pattern about to form)
  const nearCycles = findNearCycles(graph, modules);
  if (nearCycles.length > 0) {
    patterns.push({
      name: 'Near-Cycle Patterns',
      type: 'structural',
      occurrences: nearCycles.slice(0, 5).map(({ source, potentialTarget }) => ({
        file: source,
        evidence: `adding dep to ${potentialTarget} would create cycle`,
      })),
      confidence: 0.7,
      description: 'Module pairs that would create cycles if connected',
    });
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `T-29: ${cycles.length} circular dependencies, ${nearCycles.length} near-cycles`,
    recommendations: cycles.length > 0
      ? ['Refactor to eliminate circular dependencies']
      : [],
  };
}

function findCycles(graph: Map<string, Set<string>>, limit: number): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const inStack = new Set<string>();
  const seen = new Set<string>();

  const dfs = (node: string) => {
    if (cycles.length >= limit) return;

    visited.add(node);
    stack.push(node);
    inStack.add(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (cycles.length >= limit) return;
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        const idx = stack.indexOf(neighbor);
        if (idx >= 0) {
          const cycle = stack.slice(idx);
          const key = [...cycle].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push([...cycle, neighbor]);
          }
        }
      }
    }

    stack.pop();
    inStack.delete(node);
  };

  for (const node of graph.keys()) {
    if (cycles.length >= limit) break;
    if (!visited.has(node)) dfs(node);
  }

  return cycles;
}

interface NearCycle {
  source: string;
  potentialTarget: string;
}

function findNearCycles(graph: Map<string, Set<string>>, modules: ModuleKnowledge[]): NearCycle[] {
  const nearCycles: NearCycle[] = [];

  // For each module, check if any of its non-dependencies could create a cycle
  for (const mod of modules) {
    const currentDeps = graph.get(mod.path) ?? new Set();

    // Check each other module
    for (const other of modules) {
      if (mod.path === other.path) continue;
      if (currentDeps.has(other.path)) continue;

      // Would adding mod -> other create a cycle?
      // Check if other can reach mod
      if (canReach(graph, other.path, mod.path)) {
        nearCycles.push({
          source: mod.path,
          potentialTarget: other.path,
        });
      }
    }
  }

  return nearCycles.slice(0, 10);
}

function canReach(graph: Map<string, Set<string>>, from: string, to: string): boolean {
  const visited = new Set<string>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const neighbor of graph.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return false;
}

// ============================================================================
// UNIFIED T-PATTERN ANALYZER
// ============================================================================

export interface TPatternAnalysisResult {
  patterns: DetectedPattern[];
  antiPatterns: DetectedAntiPattern[];
  byCategory: Map<string, PatternResult>;
  summary: string;
  recommendations: string[];
  coverage: {
    implemented: string[];
    partial: string[];
    missing: string[];
  };
}

/**
 * Run comprehensive T-pattern analysis (T-01 to T-30)
 */
export function analyzeAllTPatterns(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): TPatternAnalysisResult {
  const byCategory = new Map<string, PatternResult>();
  const allPatterns: DetectedPattern[] = [];
  const allAntiPatterns: DetectedAntiPattern[] = [];
  const recommendations: string[] = [];

  // Navigation patterns (T-01 to T-06)
  const t01 = analyzeT01FunctionByName(functions, query);
  const t02 = analyzeT02SemanticSearch(functions, query);
  const t03 = analyzeT03CallGraph(functions, modules, query);
  const t04 = analyzeT04DependencyGraph(modules, query);
  const t05 = analyzeT05InterfaceImplementation(functions, modules, query);
  const t06 = analyzeT06TestMapping(modules, query);

  byCategory.set('navigation', {
    query,
    patterns: [
      ...(t01.patterns ?? []),
      ...(t02.patterns ?? []),
      ...(t03.patterns ?? []),
      ...(t04.patterns ?? []),
      ...(t05.patterns ?? []),
      ...(t06.patterns ?? []),
    ],
    antiPatterns: [
      ...(t03.antiPatterns ?? []),
      ...(t04.antiPatterns ?? []),
      ...(t06.antiPatterns ?? []),
    ],
    summary: 'Navigation patterns (T-01 to T-06)',
    recommendations: [
      ...t01.recommendations,
      ...t02.recommendations,
      ...t03.recommendations,
      ...t04.recommendations,
      ...t05.recommendations,
      ...t06.recommendations,
    ],
  });

  // Understanding patterns (T-07 to T-12)
  const t07 = analyzeT07FunctionPurpose(functions, query);
  const t08 = analyzeT08ModuleArchitecture(modules, query);
  const t09 = analyzeT09DesignPatterns(functions, modules, query);
  const t10 = analyzeT10ErrorHandling(functions, query);
  const t11 = analyzeT11DataFlow(functions, modules, query);
  const t12 = analyzeT12SideEffects(functions, query);

  byCategory.set('understanding', {
    query,
    patterns: [
      ...(t07.patterns ?? []),
      ...(t08.patterns ?? []),
      ...(t09.patterns ?? []),
      ...(t10.patterns ?? []),
      ...(t11.patterns ?? []),
      ...(t12.patterns ?? []),
    ],
    antiPatterns: [
      ...(t10.antiPatterns ?? []),
      ...(t12.antiPatterns ?? []),
    ],
    summary: 'Understanding patterns (T-07 to T-12)',
    recommendations: [
      ...t07.recommendations,
      ...t08.recommendations,
      ...t09.recommendations,
      ...t10.recommendations,
      ...t11.recommendations,
      ...t12.recommendations,
    ],
  });

  // Modification patterns (T-13 to T-18)
  const t13 = analyzeT13UsageAnalysis(functions, modules, query);
  const t14 = analyzeT14BreakingChanges(functions, modules, query);
  const t15 = analyzeT15SimilarPatterns(functions, query);
  const t16 = analyzeT16FeatureLocation(modules, query);
  const t17 = analyzeT17TestGaps(functions, modules, query);
  const t18 = analyzeT18Configuration(modules, query);

  byCategory.set('modification', {
    query,
    patterns: [
      ...(t13.patterns ?? []),
      ...(t14.patterns ?? []),
      ...(t15.patterns ?? []),
      ...(t16.patterns ?? []),
      ...(t17.patterns ?? []),
      ...(t18.patterns ?? []),
    ],
    antiPatterns: [
      ...(t14.antiPatterns ?? []),
      ...(t17.antiPatterns ?? []),
    ],
    summary: 'Modification support patterns (T-13 to T-18)',
    recommendations: [
      ...t13.recommendations,
      ...t14.recommendations,
      ...t15.recommendations,
      ...t16.recommendations,
      ...t17.recommendations,
      ...t18.recommendations,
    ],
  });

  // Bug investigation patterns (T-19 to T-24)
  const t19 = analyzeT19ErrorSource(functions, modules, query);
  const t20 = analyzeT20RelatedBugs(functions, query);
  const t21 = analyzeT21RaceConditions(functions, query);
  const t22 = analyzeT22NullHazards(functions, query);
  const t23 = analyzeT23ExceptionPropagation(functions, modules, query);
  const t24 = analyzeT24DeadCode(functions, modules, query);

  byCategory.set('bug_investigation', {
    query,
    patterns: [
      ...(t19.patterns ?? []),
      ...(t20.patterns ?? []),
      ...(t21.patterns ?? []),
      ...(t22.patterns ?? []),
      ...(t23.patterns ?? []),
      ...(t24.patterns ?? []),
    ],
    antiPatterns: [
      ...(t21.antiPatterns ?? []),
      ...(t22.antiPatterns ?? []),
      ...(t23.antiPatterns ?? []),
      ...(t24.antiPatterns ?? []),
    ],
    summary: 'Bug investigation patterns (T-19 to T-24)',
    recommendations: [
      ...t19.recommendations,
      ...t20.recommendations,
      ...t21.recommendations,
      ...t22.recommendations,
      ...t23.recommendations,
      ...t24.recommendations,
    ],
  });

  // HARD scenarios (T-28, T-29 - T-25, T-26, T-27, T-30 in pattern_behavior.ts)
  const t28 = analyzeT28PerformanceAntiPatterns(functions, modules, query);
  const t29 = analyzeT29CircularDependencies(modules, query);

  byCategory.set('hard_scenarios_extended', {
    query,
    patterns: [
      ...(t28.patterns ?? []),
      ...(t29.patterns ?? []),
    ],
    antiPatterns: [
      ...(t28.antiPatterns ?? []),
      ...(t29.antiPatterns ?? []),
    ],
    summary: 'Extended HARD scenarios (T-28, T-29)',
    recommendations: [
      ...t28.recommendations,
      ...t29.recommendations,
    ],
  });

  // Collect all results
  for (const result of byCategory.values()) {
    allPatterns.push(...(result.patterns ?? []));
    allAntiPatterns.push(...(result.antiPatterns ?? []));
    recommendations.push(...result.recommendations);
  }

  return {
    patterns: allPatterns,
    antiPatterns: allAntiPatterns,
    byCategory,
    summary: `Analyzed ${functions.length} functions, ${modules.length} modules across ${T_PATTERN_REGISTRY.length} T-patterns`,
    recommendations: [...new Set(recommendations)],
    coverage: {
      implemented: [
        'T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06',
        'T-07', 'T-08', 'T-09', 'T-10', 'T-11', 'T-12',
        'T-13', 'T-14', 'T-15', 'T-16', 'T-17', 'T-18',
        'T-19', 'T-20', 'T-21', 'T-22', 'T-23', 'T-24',
        'T-25', 'T-26', 'T-27', 'T-28', 'T-29', 'T-30',
      ],
      partial: [],
      missing: [],
    },
  };
}
