import type { FunctionKnowledge } from '../storage/types.js';
import type { DetectedPattern, PatternQuery, PatternResult } from './patterns.js';

export function analyzeErrorHandlingPatterns(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  const errorHandlers = functions.filter((f) =>
    /error|catch|handle|throw/i.test(f.name) || /try|catch|throw/i.test(f.signature)
  );

  if (errorHandlers.length > 0) {
    patterns.push({
      name: 'Centralized Error Handling',
      type: 'behavioral',
      occurrences: errorHandlers.slice(0, 5).map((f) => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: Math.min(0.9, errorHandlers.length / Math.max(1, functions.length)),
      description: `${errorHandlers.length} dedicated error handling functions`,
    });
  }

  return {
    query,
    patterns,
    summary: `Found ${patterns.length} error handling patterns`,
    recommendations: errorHandlers.length < 3
      ? ['Consider implementing centralized error handling']
      : [],
  };
}

export function analyzeAsyncPatterns(functions: FunctionKnowledge[], query: PatternQuery): PatternResult {
  const patterns: DetectedPattern[] = [];

  const asyncFunctions = functions.filter((f) =>
    f.signature.includes('async') || f.signature.includes('Promise') || f.signature.includes('=>')
  );

  if (asyncFunctions.length > 0) {
    patterns.push({
      name: 'Async/Await',
      type: 'behavioral',
      occurrences: asyncFunctions.slice(0, 5).map((f) => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.signature.substring(0, 50),
      })),
      confidence: asyncFunctions.length / Math.max(1, functions.length),
      description: `${asyncFunctions.length} async functions (${Math.round(asyncFunctions.length / Math.max(1, functions.length) * 100)}%)`,
    });
  }

  return {
    query,
    patterns,
    summary: `${asyncFunctions.length} async functions`,
    recommendations: [],
  };
}

export function analyzeTestingPatterns(functions: FunctionKnowledge[], query: PatternQuery): PatternResult {
  const patterns: DetectedPattern[] = [];
  const testFunctions = functions.filter((f) =>
    f.filePath.includes('.test.') ||
    f.filePath.includes('.spec.') ||
    f.filePath.includes('__tests__')
  );

  const describeFunctions = testFunctions.filter((f) =>
    f.name.toLowerCase() === 'describe' || f.purpose.toLowerCase().includes('describe')
  );
  if (describeFunctions.length > 0 || testFunctions.length > 10) {
    patterns.push({
      name: 'BDD Testing Style',
      type: 'team',
      occurrences: [],
      confidence: 0.9,
      description: 'Uses describe/it pattern for tests',
    });
  }

  const mockFunctions = testFunctions.filter((f) =>
    f.name.toLowerCase().includes('mock') ||
    f.name.toLowerCase().includes('stub') ||
    f.name.toLowerCase().includes('spy')
  );
  if (mockFunctions.length > 0) {
    patterns.push({
      name: 'Mock-Based Testing',
      type: 'team',
      occurrences: mockFunctions.slice(0, 3).map((f) => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.7,
      description: 'Uses mocks/stubs for test isolation',
    });
  }

  return {
    query,
    patterns,
    summary: `${testFunctions.length} test functions, ${patterns.length} patterns`,
    recommendations: [],
  };
}
