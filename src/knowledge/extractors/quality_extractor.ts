/**
 * @fileoverview Quality Extractor
 *
 * Extracts quality metrics (questions 81-100):
 * - Complexity: cyclomatic, cognitive, nesting
 * - Code smells: long methods, god classes
 * - Maintainability: index, rating, debt
 * - Coverage: line, branch, function
 * - Documentation quality
 * - Code hygiene: linter violations, TODOs
 * - Churn: change frequency, age
 */

import type {
  EntityQuality,
  QualityComplexity,
  QualityCodeSmell,
  Maintainability,
  TestCoverage,
  DocumentationQuality,
  CodeHygiene,
  ChangeChurn,
  HalsteadMetrics,
  TechnicalDebt,
  SmellSeverity,
} from '../universal_types.js';

export interface QualityExtraction {
  quality: EntityQuality;
  confidence: number;
}

export interface QualityInput {
  name: string;
  content?: string;
  signature?: string;
  startLine: number;
  endLine: number;
  docstring?: string;
  testCoverage?: {
    line?: number;
    branch?: number;
    function?: number;
  };
  changeHistory?: {
    lastChanged?: string;
    changeCount?: number;
    authors?: number;
    createdAt?: string;
  };
}

/**
 * Extract quality metrics from a code entity.
 */
export function extractQuality(input: QualityInput): QualityExtraction {
  const complexity = extractComplexityMetrics(input);
  const smells = detectCodeSmells(input);
  const maintainability = calculateMaintainability(input, complexity, smells);
  const coverage = extractCoverage(input);
  const documentation = extractDocumentation(input);
  const hygiene = extractHygiene(input);
  const churn = extractChurn(input);

  // Confidence based on data availability
  const hasContent = !!input.content;
  const hasTestData = !!input.testCoverage;
  const hasHistory = !!input.changeHistory;
  const confidence = 0.3 + (hasContent ? 0.3 : 0) + (hasTestData ? 0.2 : 0) + (hasHistory ? 0.2 : 0);

  return {
    quality: {
      complexity,
      smells,
      maintainability,
      coverage,
      documentation,
      hygiene,
      churn,
    },
    confidence,
  };
}

function extractComplexityMetrics(input: QualityInput): QualityComplexity {
  const content = input.content || '';
  const lines = input.endLine - input.startLine;

  // Count decision points for cyclomatic complexity
  const ifCount = (content.match(/\bif\b/g) || []).length;
  const elseCount = (content.match(/\belse\b/g) || []).length;
  const forCount = (content.match(/\bfor\b/g) || []).length;
  const whileCount = (content.match(/\bwhile\b/g) || []).length;
  const caseCount = (content.match(/\bcase\b/g) || []).length;
  const catchCount = (content.match(/\bcatch\b/g) || []).length;
  const ternaryCount = (content.match(/\?[^:]+:/g) || []).length;
  const andCount = (content.match(/&&/g) || []).length;
  const orCount = (content.match(/\|\|/g) || []).length;

  const cyclomatic = 1 + ifCount + forCount + whileCount + caseCount + catchCount + ternaryCount + andCount + orCount;

  // Cognitive complexity (more weight for nesting)
  const nestingDepth = calculateNestingDepth(content);
  const cognitive = cyclomatic + (nestingDepth * 2);

  // Count statements
  const statements = (content.match(/[;{}]/g) || []).length;

  // Count parameters from signature
  const paramMatch = (input.signature || '').match(/\(([^)]*)\)/);
  const parameters = paramMatch
    ? paramMatch[1].split(',').filter((p) => p.trim()).length
    : 0;

  // Count return statements
  const returns = (content.match(/\breturn\b/g) || []).length;

  // Halstead metrics (simplified)
  const halstead = calculateHalstead(content);

  return {
    cyclomatic,
    cognitive,
    nesting: nestingDepth,
    lines,
    statements,
    parameters,
    returns,
    halstead,
  };
}

function calculateNestingDepth(content: string): number {
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of content) {
    if (char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return maxDepth;
}

function calculateHalstead(content: string): HalsteadMetrics {
  // Simplified Halstead metrics
  const operators = new Set<string>();
  const operands = new Set<string>();

  // Count operators
  const opMatches = content.match(/[+\-*/%=<>!&|^~?:]+/g) || [];
  const keywordOps = content.match(/\b(if|else|for|while|return|switch|case|break|continue|throw|try|catch|finally|new|delete|typeof|instanceof|in|of|async|await)\b/g) || [];
  opMatches.forEach((op) => operators.add(op));
  keywordOps.forEach((op) => operators.add(op));

  // Count operands (identifiers and literals)
  const identifiers = content.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
  const numbers = content.match(/\b\d+\.?\d*\b/g) || [];
  const strings = content.match(/'[^']*'|"[^"]*"|`[^`]*`/g) || [];
  identifiers.forEach((id) => operands.add(id));
  numbers.forEach((n) => operands.add(n));
  strings.forEach((s) => operands.add(s));

  const n1 = operators.size;  // Unique operators
  const n2 = operands.size;   // Unique operands
  const N1 = opMatches.length + keywordOps.length;  // Total operators
  const N2 = identifiers.length + numbers.length + strings.length;  // Total operands

  const vocabulary = n1 + n2;
  const length = N1 + N2;
  const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
  const volume = length > 0 && vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
  const effort = difficulty * volume;
  const bugs = volume / 3000;  // Halstead's bug estimate

  return {
    vocabulary,
    length,
    difficulty: Math.round(difficulty * 100) / 100,
    effort: Math.round(effort),
    bugs: Math.round(bugs * 100) / 100,
  };
}

function detectCodeSmells(input: QualityInput): QualityCodeSmell[] {
  const smells: QualityCodeSmell[] = [];
  const content = input.content || '';
  const lines = input.endLine - input.startLine;

  // Long Method
  if (lines > 100) {
    smells.push({
      name: 'Long Method',
      severity: lines > 200 ? 'critical' : lines > 150 ? 'major' : 'minor',
      location: { line: input.startLine, column: 0 },
      description: `Method is ${lines} lines long (threshold: 100)`,
      refactoring: 'Extract Method: Split into smaller, focused functions',
    });
  }

  // Too Many Parameters
  const paramMatch = (input.signature || '').match(/\(([^)]*)\)/);
  const paramCount = paramMatch
    ? paramMatch[1].split(',').filter((p) => p.trim()).length
    : 0;
  if (paramCount > 5) {
    smells.push({
      name: 'Long Parameter List',
      severity: paramCount > 7 ? 'major' : 'minor',
      location: { line: input.startLine, column: 0 },
      description: `Function has ${paramCount} parameters (threshold: 5)`,
      refactoring: 'Introduce Parameter Object or use Builder pattern',
    });
  }

  // Deep Nesting
  const nestingDepth = calculateNestingDepth(content);
  if (nestingDepth > 4) {
    smells.push({
      name: 'Deep Nesting',
      severity: nestingDepth > 6 ? 'major' : 'minor',
      location: { line: input.startLine, column: 0 },
      description: `Nesting depth is ${nestingDepth} (threshold: 4)`,
      refactoring: 'Extract conditionals, use early returns, or extract methods',
    });
  }

  // Feature Envy (many external references)
  const externalRefs = (content.match(/this\./g) || []).length;
  const otherRefs = (content.match(/[a-z]+\./g) || []).length - externalRefs;
  if (otherRefs > externalRefs * 2 && otherRefs > 10) {
    smells.push({
      name: 'Feature Envy',
      severity: 'minor',
      location: { line: input.startLine, column: 0 },
      description: 'Method seems to use other objects more than its own',
      refactoring: 'Move Method: Consider moving to the class it uses most',
    });
  }

  // God Function (too complex)
  const cyclomatic = 1 + (content.match(/\bif\b|\bfor\b|\bwhile\b|\bcase\b|\bcatch\b/g) || []).length;
  if (cyclomatic > 15) {
    smells.push({
      name: 'Complex Function',
      severity: cyclomatic > 25 ? 'critical' : 'major',
      location: { line: input.startLine, column: 0 },
      description: `Cyclomatic complexity is ${cyclomatic} (threshold: 15)`,
      refactoring: 'Split function into smaller units with single responsibilities',
    });
  }

  // Magic Numbers
  const magicNumbers = (content.match(/(?<![a-zA-Z_])\d{2,}(?![a-zA-Z_])/g) || [])
    .filter((n) => !['10', '100', '1000'].includes(n));
  if (magicNumbers.length > 3) {
    smells.push({
      name: 'Magic Numbers',
      severity: 'info',
      location: { line: input.startLine, column: 0 },
      description: `Found ${magicNumbers.length} magic numbers: ${magicNumbers.slice(0, 3).join(', ')}...`,
      refactoring: 'Extract constants with meaningful names',
    });
  }

  return smells;
}

function calculateMaintainability(
  input: QualityInput,
  complexity: QualityComplexity,
  smells: QualityCodeSmell[]
): Maintainability {
  // Maintainability Index formula (simplified)
  // MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
  const HV = Math.max(1, complexity.halstead.vocabulary);
  const CC = complexity.cyclomatic;
  const LOC = Math.max(1, complexity.lines);

  let index = 171 - (5.2 * Math.log(HV)) - (0.23 * CC) - (16.2 * Math.log(LOC));
  index = Math.max(0, Math.min(100, index));

  // Determine rating
  let rating: 'A' | 'B' | 'C' | 'D' | 'F';
  if (index >= 80) rating = 'A';
  else if (index >= 60) rating = 'B';
  else if (index >= 40) rating = 'C';
  else if (index >= 20) rating = 'D';
  else rating = 'F';

  // Calculate technical debt
  const debt = calculateTechnicalDebt(smells, complexity);

  return {
    index: Math.round(index),
    rating,
    technicalDebt: debt,
  };
}

function calculateTechnicalDebt(smells: QualityCodeSmell[], complexity: QualityComplexity): TechnicalDebt {
  const issues: TechnicalDebt['issues'] = [];
  let totalMinutes = 0;

  // Convert smells to debt issues
  const smellEffort: Record<SmellSeverity, number> = {
    blocker: 120,
    critical: 60,
    major: 30,
    minor: 15,
    info: 5,
  };

  for (const smell of smells) {
    const effort = smellEffort[smell.severity];
    totalMinutes += effort;
    issues.push({
      type: smell.name,
      description: smell.description,
      effort,
      priority: smell.severity === 'blocker' ? 1 : smell.severity === 'critical' ? 2 : 3,
    });
  }

  // Add complexity debt
  if (complexity.cyclomatic > 10) {
    const effort = (complexity.cyclomatic - 10) * 5;
    totalMinutes += effort;
    issues.push({
      type: 'High Complexity',
      description: `Cyclomatic complexity ${complexity.cyclomatic} exceeds threshold`,
      effort,
      priority: 2,
    });
  }

  // Calculate ratio (debt / development time estimate)
  const estimatedDevMinutes = complexity.lines * 2;
  const ratio = estimatedDevMinutes > 0 ? totalMinutes / estimatedDevMinutes : 0;

  return {
    minutes: totalMinutes,
    ratio: Math.round(ratio * 100) / 100,
    issues,
  };
}

function extractCoverage(input: QualityInput): TestCoverage {
  const tc = input.testCoverage;
  return {
    line: tc?.line ?? 0,
    branch: tc?.branch ?? 0,
    function: tc?.function ?? 0,
    statement: tc?.line ?? 0,
    mutation: undefined,
  };
}

function extractDocumentation(input: QualityInput): DocumentationQuality {
  const content = input.content || '';
  const hasDocstring = !!input.docstring || content.includes('/**') || content.includes('"""');

  // Count comment lines
  const commentLines = (content.match(/\/\/.*$|\/\*[\s\S]*?\*\/|#.*$/gm) || []).length;
  const codeLines = Math.max(1, input.endLine - input.startLine);
  const documentationRatio = commentLines / codeLines;

  // Simple quality score based on presence and length
  let qualityScore = 0;
  if (hasDocstring) qualityScore += 0.4;
  if (documentationRatio > 0.1) qualityScore += 0.2;
  if (input.docstring && input.docstring.length > 50) qualityScore += 0.2;
  if (content.includes('@param') || content.includes('@returns')) qualityScore += 0.2;

  return {
    hasDocstring,
    hasInlineComments: commentLines > 0,
    documentationRatio: Math.round(documentationRatio * 100) / 100,
    qualityScore: Math.round(qualityScore * 100) / 100,
  };
}

function extractHygiene(input: QualityInput): CodeHygiene {
  const content = input.content || '';

  // Count TODOs and FIXMEs
  const todoCount = (content.match(/\bTODO\b/gi) || []).length;
  const fixmeCount = (content.match(/\bFIXME\b/gi) || []).length;

  return {
    linterViolations: [], // Would need linter integration
    typeErrors: [], // Would need TypeScript compiler
    duplications: [], // Would need duplication detection
    todoCount,
    fixmeCount,
  };
}

function extractChurn(input: QualityInput): ChangeChurn {
  const history = input.changeHistory;
  const now = new Date();

  let age = 0;
  if (history?.createdAt) {
    const created = new Date(history.createdAt);
    age = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    changeCount: history?.changeCount ?? 0,
    changeFrequency: history?.changeCount ?? 0 / Math.max(1, age / 30),
    lastChanged: history?.lastChanged ?? now.toISOString(),
    age,
    authors: history?.authors ?? 1,
  };
}
