/**
 * @fileoverview Testing Knowledge Extractor
 *
 * Extracts testing-related knowledge (questions 126-135):
 * - Tests: which tests cover this entity
 * - Test types: unit, integration, e2e, performance, security
 * - Assertions: what is being asserted
 * - Edge cases: boundary condition tests
 * - Properties: property-based testing specs
 * - Behavior specs: BDD given/when/then
 * - Test history: failures, flakiness
 * - Dependencies: mocks, fixtures, setup
 *
 * Designed to integrate with test_indexer.ts data and coverage tools.
 */

import type {
  EntityTesting,
  TestReference,
  TestsByType,
  TestAssertion,
  EdgeCaseTest,
  PropertySpec,
  BehaviorSpec,
  TestHistory,
  TestDependencies,
  MockDependency,
  TestFixture,
  TestType,
} from '../universal_types.js';

export interface TestingExtraction {
  testing: EntityTesting;
  confidence: number;
}

export interface TestingInput {
  name: string;
  filePath: string;
  content?: string;
  signature?: string;

  // Pre-indexed test data (from test_indexer)
  relatedTests?: TestFileInfo[];

  // Coverage data (from coverage tools)
  coverage?: {
    line?: number;
    branch?: number;
    function?: number;
  };

  // Historical test data
  testHistory?: {
    failureCount?: number;
    lastFailure?: string;
    flakyTests?: string[];
  };
}

export interface TestFileInfo {
  testFilePath: string;
  testName?: string;
  testType?: string;
  assertions?: string[];
}

// ============================================================================
// ASSERTION PATTERNS
// ============================================================================

interface AssertionPattern {
  pattern: RegExp;
  type: TestAssertion['type'];
  description: string;
}

const ASSERTION_PATTERNS: AssertionPattern[] = [
  // Equality
  { pattern: /expect\s*\([^)]+\)\s*\.toBe\s*\(/i, type: 'equality', description: 'Strict equality check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toEqual\s*\(/i, type: 'equality', description: 'Deep equality check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toStrictEqual\s*\(/i, type: 'equality', description: 'Strict deep equality' },
  { pattern: /assert\.equal\s*\(/i, type: 'equality', description: 'Equality assertion' },
  { pattern: /assert\.deepEqual\s*\(/i, type: 'equality', description: 'Deep equality assertion' },
  { pattern: /assert\.strictEqual\s*\(/i, type: 'equality', description: 'Strict equality assertion' },

  // Truthiness
  { pattern: /expect\s*\([^)]+\)\s*\.toBeTruthy\s*\(/i, type: 'truthiness', description: 'Truthy check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toBeFalsy\s*\(/i, type: 'truthiness', description: 'Falsy check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toBeNull\s*\(/i, type: 'truthiness', description: 'Null check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toBeDefined\s*\(/i, type: 'truthiness', description: 'Defined check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toBeUndefined\s*\(/i, type: 'truthiness', description: 'Undefined check' },
  { pattern: /assert\.ok\s*\(/i, type: 'truthiness', description: 'Truthy assertion' },

  // Exception
  { pattern: /expect\s*\([^)]+\)\s*\.toThrow\s*\(/i, type: 'exception', description: 'Exception check' },
  { pattern: /expect\s*\([^)]+\)\s*\.rejects\s*\./i, type: 'exception', description: 'Promise rejection' },
  { pattern: /assert\.throws\s*\(/i, type: 'exception', description: 'Throws assertion' },
  { pattern: /assert\.rejects\s*\(/i, type: 'exception', description: 'Rejects assertion' },

  // Type
  { pattern: /expect\s*\([^)]+\)\s*\.toBeInstanceOf\s*\(/i, type: 'type', description: 'Instance type check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toMatchObject\s*\(/i, type: 'type', description: 'Object shape check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toHaveProperty\s*\(/i, type: 'property', description: 'Property existence' },

  // Property
  { pattern: /expect\s*\([^)]+\)\s*\.toContain\s*\(/i, type: 'property', description: 'Contains check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toHaveLength\s*\(/i, type: 'property', description: 'Length check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toMatch\s*\(/i, type: 'property', description: 'Pattern match' },
  { pattern: /expect\s*\([^)]+\)\s*\.toBeGreaterThan\s*\(/i, type: 'property', description: 'Greater than check' },
  { pattern: /expect\s*\([^)]+\)\s*\.toBeLessThan\s*\(/i, type: 'property', description: 'Less than check' },
];

// ============================================================================
// EDGE CASE PATTERNS
// ============================================================================

interface EdgeCasePattern {
  pattern: RegExp;
  description: string;
  input: string;
  expectedBehavior: string;
}

const EDGE_CASE_PATTERNS: EdgeCasePattern[] = [
  { pattern: /null|undefined/i, description: 'Null/undefined handling', input: 'null or undefined', expectedBehavior: 'Graceful handling or error' },
  { pattern: /empty|length\s*===?\s*0|\[\s*\]/i, description: 'Empty input handling', input: 'Empty array/string/object', expectedBehavior: 'Returns empty or default' },
  { pattern: /negative|< 0|-\d+/i, description: 'Negative number handling', input: 'Negative numbers', expectedBehavior: 'Validation or special handling' },
  { pattern: /zero|=== 0|== 0/i, description: 'Zero handling', input: 'Zero value', expectedBehavior: 'No division by zero, proper handling' },
  { pattern: /max|infinity|overflow/i, description: 'Maximum/overflow handling', input: 'Maximum values', expectedBehavior: 'No overflow, proper limits' },
  { pattern: /boundary|edge|limit/i, description: 'Boundary conditions', input: 'Boundary values', expectedBehavior: 'Correct at boundaries' },
  { pattern: /special\s*char|unicode|emoji/i, description: 'Special character handling', input: 'Special characters', expectedBehavior: 'Proper encoding/escaping' },
  { pattern: /concurrent|parallel|race/i, description: 'Concurrency handling', input: 'Concurrent access', expectedBehavior: 'Thread-safe or atomic' },
  { pattern: /timeout|slow|delay/i, description: 'Timeout handling', input: 'Slow responses', expectedBehavior: 'Proper timeout behavior' },
  { pattern: /error|exception|failure/i, description: 'Error scenarios', input: 'Error conditions', expectedBehavior: 'Proper error handling' },
];

// ============================================================================
// BDD PATTERNS
// ============================================================================

const BDD_PATTERNS = {
  describe: /describe\s*\(\s*['"`]([^'"`]+)['"`]/g,
  it: /it\s*\(\s*['"`]([^'"`]+)['"`]/g,
  test: /test\s*\(\s*['"`]([^'"`]+)['"`]/g,
  given: /given\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  when: /when\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  then: /then\s*\(\s*['"`]([^'"`]+)['"`]/gi,
};

// ============================================================================
// MOCK PATTERNS
// ============================================================================

const MOCK_PATTERNS = [
  { pattern: /jest\.mock\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'module' },
  { pattern: /jest\.spyOn\s*\(\s*([^,]+),/g, type: 'method' },
  { pattern: /jest\.fn\s*\(/g, type: 'function' },
  { pattern: /sinon\.stub\s*\(/g, type: 'stub' },
  { pattern: /sinon\.spy\s*\(/g, type: 'spy' },
  { pattern: /vi\.mock\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'vitest-module' },
  { pattern: /vi\.spyOn\s*\(/g, type: 'vitest-spy' },
  { pattern: /mockImplementation|mockReturnValue|mockResolvedValue/g, type: 'mock-impl' },
];

// ============================================================================
// FIXTURE PATTERNS
// ============================================================================

const FIXTURE_PATTERNS = [
  { pattern: /beforeAll\s*\(/g, scope: 'suite' as const },
  { pattern: /beforeEach\s*\(/g, scope: 'test' as const },
  { pattern: /afterAll\s*\(/g, scope: 'suite' as const },
  { pattern: /afterEach\s*\(/g, scope: 'test' as const },
  { pattern: /fixture|setup|factory/gi, scope: 'file' as const },
];

// ============================================================================
// MAIN EXTRACTOR
// ============================================================================

/**
 * Extract testing-related knowledge for a code entity.
 */
export function extractTesting(input: TestingInput): TestingExtraction {
  // Determine related tests
  const tests = extractTestReferences(input);

  // Categorize by type
  const byType = categorizeTests(tests);

  // Extract assertions if test content available
  const assertions = extractAssertions(input);

  // Identify edge case tests
  const edgeCases = extractEdgeCases(input);

  // Extract property specs (property-based testing)
  const properties = extractPropertySpecs(input);

  // Extract BDD specs
  const behaviorSpecs = extractBehaviorSpecs(input);

  // Build test history
  const history = extractTestHistory(input);

  // Extract test dependencies
  const dependencies = extractTestDependencies(input);

  // Calculate confidence
  const hasTests = tests.length > 0;
  const hasContent = !!input.content;
  const hasCoverage = !!input.coverage;
  const confidence = 0.3 + (hasTests ? 0.3 : 0) + (hasContent ? 0.2 : 0) + (hasCoverage ? 0.2 : 0);

  return {
    testing: {
      tests,
      byType,
      assertions,
      edgeCases,
      properties,
      behaviorSpecs,
      history,
      dependencies,
    },
    confidence,
  };
}

function extractTestReferences(input: TestingInput): TestReference[] {
  const tests: TestReference[] = [];

  // Use pre-indexed test data if available
  if (input.relatedTests && input.relatedTests.length > 0) {
    for (const testInfo of input.relatedTests) {
      tests.push({
        id: `${testInfo.testFilePath}:${testInfo.testName || 'test'}`,
        file: testInfo.testFilePath,
        name: testInfo.testName || extractTestNameFromPath(testInfo.testFilePath),
        type: inferTestType(testInfo),
        assertions: testInfo.assertions || [],
      });
    }
  }

  // If this IS a test file, extract test cases
  if (isTestFile(input.filePath) && input.content) {
    const testCases = extractTestCases(input.content);
    for (const tc of testCases) {
      const existing = tests.find(t => t.name === tc.name);
      if (!existing) {
        tests.push({
          id: `${input.filePath}:${tc.name}`,
          file: input.filePath,
          name: tc.name,
          type: inferTestTypeFromContent(tc.content),
          assertions: extractAssertionTypes(tc.content),
        });
      }
    }
  }

  return tests;
}

function extractTestNameFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  return fileName.replace(/\.(test|spec)\.[jt]sx?$/i, '').replace(/[_-]/g, ' ');
}

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.[jt]sx?$/i.test(filePath) ||
         /__tests__\//.test(filePath) ||
         /\/tests?\//.test(filePath);
}

function inferTestType(testInfo: TestFileInfo): TestType {
  if (testInfo.testType) {
    const type = testInfo.testType.toLowerCase();
    if (type === 'unit' || type === 'integration' || type === 'e2e' || type === 'performance' || type === 'security') {
      return type as TestType;
    }
  }

  const path = testInfo.testFilePath.toLowerCase();
  if (path.includes('e2e') || path.includes('end-to-end') || path.includes('cypress') || path.includes('playwright')) {
    return 'e2e';
  }
  if (path.includes('integration') || path.includes('int.')) {
    return 'integration';
  }
  if (path.includes('perf') || path.includes('benchmark') || path.includes('load')) {
    return 'performance';
  }
  if (path.includes('security') || path.includes('pentest')) {
    return 'security';
  }

  return 'unit';
}

function inferTestTypeFromContent(content: string): TestType {
  const lower = content.toLowerCase();

  if (/cy\.|page\.|browser\.|puppeteer|playwright|selenium/i.test(content)) {
    return 'e2e';
  }
  if (/supertest|request\s*\(app\)|mockserver|nock/i.test(content)) {
    return 'integration';
  }
  if (/benchmark|performance|measure|timing/i.test(lower)) {
    return 'performance';
  }
  if (/security|vulnerability|penetration|injection/i.test(lower)) {
    return 'security';
  }

  return 'unit';
}

interface TestCase {
  name: string;
  content: string;
}

function extractTestCases(content: string): TestCase[] {
  const testCases: TestCase[] = [];

  // Match it/test blocks
  const itMatches = content.matchAll(/(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?\([^)]*\)\s*(?:=>)?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g);
  for (const match of itMatches) {
    testCases.push({
      name: match[1],
      content: match[2] || '',
    });
  }

  return testCases;
}

function extractAssertionTypes(content: string): string[] {
  const assertions: string[] = [];

  for (const pattern of ASSERTION_PATTERNS) {
    if (pattern.pattern.test(content)) {
      assertions.push(pattern.description);
    }
  }

  return [...new Set(assertions)];
}

function categorizeTests(tests: TestReference[]): TestsByType {
  return {
    unit: tests.filter(t => t.type === 'unit'),
    integration: tests.filter(t => t.type === 'integration'),
    e2e: tests.filter(t => t.type === 'e2e'),
    performance: tests.filter(t => t.type === 'performance'),
    security: tests.filter(t => t.type === 'security'),
  };
}

function extractAssertions(input: TestingInput): TestAssertion[] {
  const assertions: TestAssertion[] = [];

  if (!input.content) return assertions;

  for (const pattern of ASSERTION_PATTERNS) {
    const matches = input.content.matchAll(new RegExp(pattern.pattern.source, 'gi'));
    for (const match of matches) {
      // Extract what's being tested
      const contextMatch = match.input?.slice(Math.max(0, match.index! - 50), match.index! + match[0].length + 50);

      assertions.push({
        description: pattern.description,
        type: pattern.type,
        target: contextMatch?.match(/expect\s*\(\s*([^)]+)\)/)?.[1] || 'unknown',
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return assertions.filter(a => {
    const key = `${a.type}:${a.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractEdgeCases(input: TestingInput): EdgeCaseTest[] {
  const edgeCases: EdgeCaseTest[] = [];

  if (!input.content) return edgeCases;

  const content = input.content.toLowerCase();

  for (const pattern of EDGE_CASE_PATTERNS) {
    if (pattern.pattern.test(content)) {
      // Check if there's a corresponding test for this edge case
      const tested = isTestFile(input.filePath) ||
                     input.relatedTests?.some(t =>
                       pattern.pattern.test(t.testFilePath.toLowerCase()) ||
                       pattern.pattern.test(t.testName?.toLowerCase() || ''));

      edgeCases.push({
        description: pattern.description,
        input: pattern.input,
        expectedBehavior: pattern.expectedBehavior,
        tested: !!tested,
      });
    }
  }

  return edgeCases;
}

function extractPropertySpecs(input: TestingInput): PropertySpec[] {
  const properties: PropertySpec[] = [];

  if (!input.content) return properties;

  // Check for property-based testing libraries
  const hasPropertyTest = /fast-check|jsverify|testcheck|hypothesis/i.test(input.content);
  if (!hasPropertyTest) return properties;

  // Extract fc.property or similar patterns
  const propertyMatches = input.content.matchAll(/(?:fc\.property|property)\s*\(\s*([^,]+),\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{?([^}]+)/g);
  for (const match of propertyMatches) {
    properties.push({
      property: match[1]?.trim() || 'Unknown property',
      description: 'Property-based test',
      generator: match[1]?.includes('fc.') ? 'fast-check' : 'unknown',
    });
  }

  return properties;
}

function extractBehaviorSpecs(input: TestingInput): BehaviorSpec[] {
  const specs: BehaviorSpec[] = [];

  if (!input.content) return specs;

  // Look for BDD-style patterns
  const describeMatches = [...input.content.matchAll(BDD_PATTERNS.describe)];
  const itMatches = [...input.content.matchAll(BDD_PATTERNS.it)];
  const testMatches = [...input.content.matchAll(BDD_PATTERNS.test)];

  // Combine and parse into given/when/then
  const allTests = [...itMatches, ...testMatches];
  for (const match of allTests) {
    const testName = match[1];
    const parts = parseBehaviorFromTestName(testName);
    if (parts) {
      specs.push(parts);
    }
  }

  // Also check for explicit given/when/then
  const givenMatches = [...input.content.matchAll(BDD_PATTERNS.given)];
  const whenMatches = [...input.content.matchAll(BDD_PATTERNS.when)];
  const thenMatches = [...input.content.matchAll(BDD_PATTERNS.then)];

  if (givenMatches.length > 0 && whenMatches.length > 0 && thenMatches.length > 0) {
    specs.push({
      given: givenMatches[0][1],
      when: whenMatches[0][1],
      then: thenMatches[0][1],
    });
  }

  return specs.slice(0, 10); // Limit
}

function parseBehaviorFromTestName(testName: string): BehaviorSpec | null {
  // Try to extract given/when/then from test name
  // e.g., "should return empty array when input is null"
  const shouldMatch = testName.match(/should\s+(.+)\s+when\s+(.+)/i);
  if (shouldMatch) {
    return {
      given: 'Given the function under test',
      when: shouldMatch[2],
      then: `should ${shouldMatch[1]}`,
    };
  }

  // e.g., "returns error for invalid input"
  const returnsMatch = testName.match(/returns?\s+(.+)\s+for\s+(.+)/i);
  if (returnsMatch) {
    return {
      given: returnsMatch[2],
      when: 'the function is called',
      then: `returns ${returnsMatch[1]}`,
    };
  }

  return null;
}

function extractTestHistory(input: TestingInput): TestHistory {
  const history = input.testHistory || {};

  return {
    failureCount: history.failureCount ?? 0,
    flakyScore: history.flakyTests ? history.flakyTests.length * 0.1 : 0,
    lastFailure: history.lastFailure,
    failurePatterns: history.flakyTests || [],
  };
}

function extractTestDependencies(input: TestingInput): TestDependencies {
  const mocks: MockDependency[] = [];
  const fixtures: TestFixture[] = [];
  const setup: string[] = [];

  if (!input.content) {
    return { mocks, fixtures, setup };
  }

  // Extract mocks
  for (const pattern of MOCK_PATTERNS) {
    const matches = input.content.matchAll(new RegExp(pattern.pattern.source, 'g'));
    for (const match of matches) {
      mocks.push({
        target: match[1] || 'unknown',
        type: pattern.type,
        reason: `Mock for ${pattern.type}`,
      });
    }
  }

  // Extract fixtures
  for (const pattern of FIXTURE_PATTERNS) {
    if (pattern.pattern.test(input.content)) {
      fixtures.push({
        name: pattern.scope === 'suite' ? 'Suite fixture' : 'Test fixture',
        type: 'setup/teardown',
        scope: pattern.scope,
      });
    }
  }

  // Look for common setup patterns
  if (/createTestDatabase|setupTestDb/i.test(input.content)) {
    setup.push('Database setup required');
  }
  if (/startServer|createTestServer/i.test(input.content)) {
    setup.push('Server startup required');
  }
  if (/mockApi|nock|msw/i.test(input.content)) {
    setup.push('API mocking required');
  }

  return {
    mocks: mocks.slice(0, 10),
    fixtures: fixtures.slice(0, 5),
    setup,
  };
}

/**
 * Extract testing with coverage integration.
 * Uses actual coverage data when available.
 */
export async function extractTestingWithCoverage(
  input: TestingInput,
  coverageData?: {
    line: number;
    branch: number;
    function: number;
  }
): Promise<TestingExtraction> {
  const result = extractTesting({
    ...input,
    coverage: coverageData,
  });

  // Enhance confidence if we have coverage data
  if (coverageData && coverageData.line > 0) {
    result.confidence = Math.min(1, result.confidence + 0.1);
  }

  return result;
}
