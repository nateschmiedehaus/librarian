/**
 * @fileoverview Analyze Command
 *
 * Runs static analysis on the codebase for dead code detection
 * and complexity metrics.
 *
 * Usage:
 *   librarian analyze --dead-code [--format text|json]
 *   librarian analyze --complexity [--format text|json] [--threshold <n>]
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project, Node, SyntaxKind, SourceFile } from 'ts-morph';
import {
  createDeadCodeDetector,
  type DeadCodeReport,
  type DeadCodeCandidate,
} from '../../evaluation/dead_code_detector.js';

// ============================================================================
// Types
// ============================================================================

export interface AnalyzeCommandOptions {
  workspace: string;
  args: string[];
  rawArgs: string[];
}

interface ComplexityResult {
  file: string;
  line: number;
  name: string;
  kind: 'function' | 'method' | 'arrow';
  metrics: {
    lines: number;
    maxNesting: number;
    cyclomaticComplexity: number;
    parameterCount: number;
  };
}

interface ComplexityReport {
  repoPath: string;
  analyzedAt: string;
  results: ComplexityResult[];
  summary: {
    totalFunctions: number;
    averageLines: number;
    averageNesting: number;
    averageComplexity: number;
    highComplexityCount: number;
    deepNestingCount: number;
  };
}

// ============================================================================
// Dead Code Analysis
// ============================================================================

async function runDeadCodeAnalysis(
  workspace: string,
  format: 'text' | 'json'
): Promise<void> {
  console.log('Running dead code analysis...\n');

  const detector = createDeadCodeDetector({ commentedCodeMinLines: 3 });
  const report = await detector.detect(workspace);

  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printDeadCodeReport(report);
}

function printDeadCodeReport(report: DeadCodeReport): void {
  console.log('=== Dead Code Analysis Report ===\n');
  console.log(`Repository: ${report.repoPath}`);
  console.log(`Analyzed at: ${report.analyzedAt}`);
  console.log(`Total candidates: ${report.summary.totalCandidates}`);
  console.log(`High confidence (>0.8): ${report.summary.highConfidence}\n`);

  console.log('Summary by type:');
  for (const [type, count] of Object.entries(report.summary.byType)) {
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log();

  if (report.candidates.length === 0) {
    console.log('No dead code candidates found.\n');
    return;
  }

  // Group candidates by file for cleaner output
  const byFile = new Map<string, DeadCodeCandidate[]>();
  for (const candidate of report.candidates) {
    const existing = byFile.get(candidate.file) || [];
    existing.push(candidate);
    byFile.set(candidate.file, existing);
  }

  console.log('--- Candidates ---\n');

  for (const [file, candidates] of byFile) {
    // Show relative path if possible
    const displayPath = file.startsWith(report.repoPath)
      ? file.slice(report.repoPath.length + 1)
      : file;

    console.log(`${displayPath}:`);

    for (const candidate of candidates.sort((a, b) => a.line - b.line)) {
      const confidenceStr = `[${(candidate.confidence * 100).toFixed(0)}%]`;
      const identifierStr = candidate.identifier
        ? ` "${candidate.identifier}"`
        : '';

      console.log(
        `  L${candidate.line}: ${confidenceStr} ${candidate.type}${identifierStr}`
      );
      console.log(`         ${candidate.reason}`);

      if (candidate.codeSnippet) {
        const snippet = candidate.codeSnippet.trim().split('\n')[0];
        if (snippet.length > 60) {
          console.log(`         > ${snippet.slice(0, 60)}...`);
        } else {
          console.log(`         > ${snippet}`);
        }
      }
    }
    console.log();
  }
}

// ============================================================================
// Complexity Analysis
// ============================================================================

async function runComplexityAnalysis(
  workspace: string,
  format: 'text' | 'json',
  threshold: number
): Promise<void> {
  console.log('Running complexity analysis...\n');

  const report = analyzeComplexity(workspace, threshold);

  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printComplexityReport(report, threshold);
}

function analyzeComplexity(repoPath: string, threshold: number): ComplexityReport {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  const files = getTypeScriptFiles(repoPath);
  const results: ComplexityResult[] = [];

  for (const file of files) {
    try {
      const sourceFile = project.addSourceFileAtPath(file);
      results.push(...analyzeFileComplexity(sourceFile, file));
    } catch {
      // Skip files that can't be parsed
    }
  }

  // Sort by cyclomatic complexity descending
  results.sort((a, b) => b.metrics.cyclomaticComplexity - a.metrics.cyclomaticComplexity);

  // Calculate summary
  const totalFunctions = results.length;
  const totalLines = results.reduce((sum, r) => sum + r.metrics.lines, 0);
  const totalNesting = results.reduce((sum, r) => sum + r.metrics.maxNesting, 0);
  const totalComplexity = results.reduce(
    (sum, r) => sum + r.metrics.cyclomaticComplexity,
    0
  );

  const highComplexityCount = results.filter(
    (r) => r.metrics.cyclomaticComplexity > threshold
  ).length;
  const deepNestingCount = results.filter((r) => r.metrics.maxNesting > 4).length;

  return {
    repoPath,
    analyzedAt: new Date().toISOString(),
    results,
    summary: {
      totalFunctions,
      averageLines: totalFunctions > 0 ? Math.round(totalLines / totalFunctions) : 0,
      averageNesting:
        totalFunctions > 0 ? Math.round((totalNesting / totalFunctions) * 10) / 10 : 0,
      averageComplexity:
        totalFunctions > 0
          ? Math.round((totalComplexity / totalFunctions) * 10) / 10
          : 0,
      highComplexityCount,
      deepNestingCount,
    },
  };
}

function analyzeFileComplexity(
  sourceFile: SourceFile,
  filePath: string
): ComplexityResult[] {
  const results: ComplexityResult[] = [];

  // Analyze top-level functions
  for (const func of sourceFile.getFunctions()) {
    const name = func.getName() || '<anonymous>';
    const body = func.getBody();
    if (!body) continue;

    results.push({
      file: filePath,
      line: func.getStartLineNumber(),
      name,
      kind: 'function',
      metrics: computeMetrics(body, func.getParameters().length),
    });
  }

  // Analyze class methods
  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName() || '<anonymous class>';

    for (const method of cls.getMethods()) {
      const methodName = method.getName();
      const body = method.getBody();
      if (!body) continue;

      results.push({
        file: filePath,
        line: method.getStartLineNumber(),
        name: `${className}.${methodName}`,
        kind: 'method',
        metrics: computeMetrics(body, method.getParameters().length),
      });
    }

    // Analyze constructors
    for (const ctor of cls.getConstructors()) {
      const body = ctor.getBody();
      if (!body) continue;

      results.push({
        file: filePath,
        line: ctor.getStartLineNumber(),
        name: `${className}.constructor`,
        kind: 'method',
        metrics: computeMetrics(body, ctor.getParameters().length),
      });
    }
  }

  // Analyze arrow functions (only those assigned to variables)
  for (const varStmt of sourceFile.getVariableStatements()) {
    for (const decl of varStmt.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isArrowFunction(initializer)) continue;

      const name = decl.getName();
      const body = initializer.getBody();

      results.push({
        file: filePath,
        line: decl.getStartLineNumber(),
        name,
        kind: 'arrow',
        metrics: computeMetrics(body, initializer.getParameters().length),
      });
    }
  }

  return results;
}

function computeMetrics(
  body: Node,
  parameterCount: number
): ComplexityResult['metrics'] {
  const lines = countLines(body);
  const maxNesting = computeMaxNesting(body);
  const cyclomaticComplexity = computeCyclomaticComplexity(body);

  return {
    lines,
    maxNesting,
    cyclomaticComplexity,
    parameterCount,
  };
}

function countLines(node: Node): number {
  const startLine = node.getStartLineNumber();
  const endLine = node.getEndLineNumber();
  return endLine - startLine + 1;
}

function computeMaxNesting(node: Node): number {
  let maxNesting = 0;

  function traverse(n: Node, currentNesting: number): void {
    let nesting = currentNesting;

    // These constructs increase nesting depth
    if (
      Node.isIfStatement(n) ||
      Node.isForStatement(n) ||
      Node.isForOfStatement(n) ||
      Node.isForInStatement(n) ||
      Node.isWhileStatement(n) ||
      Node.isDoStatement(n) ||
      Node.isSwitchStatement(n) ||
      Node.isTryStatement(n) ||
      Node.isCatchClause(n)
    ) {
      nesting++;
      maxNesting = Math.max(maxNesting, nesting);
    }

    // Also count arrow functions and nested functions as nesting
    if (
      Node.isArrowFunction(n) ||
      Node.isFunctionDeclaration(n) ||
      Node.isFunctionExpression(n)
    ) {
      // Only count if we're not at the root level
      if (currentNesting > 0) {
        nesting++;
        maxNesting = Math.max(maxNesting, nesting);
      }
    }

    n.forEachChild((child) => traverse(child, nesting));
  }

  traverse(node, 0);
  return maxNesting;
}

function computeCyclomaticComplexity(node: Node): number {
  // Start at 1 (the base path)
  let complexity = 1;

  node.forEachDescendant((n) => {
    // Each decision point adds 1 to complexity
    if (
      Node.isIfStatement(n) ||
      Node.isConditionalExpression(n) || // ternary
      Node.isForStatement(n) ||
      Node.isForOfStatement(n) ||
      Node.isForInStatement(n) ||
      Node.isWhileStatement(n) ||
      Node.isDoStatement(n) ||
      Node.isCatchClause(n)
    ) {
      complexity++;
    }

    // Switch cases (except default) add complexity
    if (Node.isCaseClause(n)) {
      complexity++;
    }

    // Logical operators (&&, ||, ??) add complexity
    if (Node.isBinaryExpression(n)) {
      const op = n.getOperatorToken().getText();
      if (op === '&&' || op === '||' || op === '??') {
        complexity++;
      }
    }
  });

  return complexity;
}

function printComplexityReport(report: ComplexityReport, threshold: number): void {
  console.log('=== Complexity Analysis Report ===\n');
  console.log(`Repository: ${report.repoPath}`);
  console.log(`Analyzed at: ${report.analyzedAt}`);
  console.log(`Total functions: ${report.summary.totalFunctions}`);
  console.log(`Complexity threshold: ${threshold}\n`);

  console.log('Summary:');
  console.log(`  Average lines: ${report.summary.averageLines}`);
  console.log(`  Average nesting: ${report.summary.averageNesting}`);
  console.log(`  Average complexity: ${report.summary.averageComplexity}`);
  console.log(`  High complexity (>${threshold}): ${report.summary.highComplexityCount}`);
  console.log(`  Deep nesting (>4): ${report.summary.deepNestingCount}`);
  console.log();

  if (report.results.length === 0) {
    console.log('No functions found.\n');
    return;
  }

  // Show functions above threshold or top 20, whichever is larger
  const highComplexity = report.results.filter(
    (r) => r.metrics.cyclomaticComplexity > threshold
  );

  if (highComplexity.length > 0) {
    console.log(`--- High Complexity Functions (>${threshold}) ---\n`);

    for (const result of highComplexity) {
      const displayPath = result.file.startsWith(report.repoPath)
        ? result.file.slice(report.repoPath.length + 1)
        : result.file;

      console.log(`${displayPath}:${result.line} - ${result.name}`);
      console.log(
        `  Complexity: ${result.metrics.cyclomaticComplexity} | Lines: ${result.metrics.lines} | Nesting: ${result.metrics.maxNesting} | Params: ${result.metrics.parameterCount}`
      );
    }
    console.log();
  }

  // Show deep nesting
  const deepNesting = report.results.filter(
    (r) => r.metrics.maxNesting > 4 && r.metrics.cyclomaticComplexity <= threshold
  );

  if (deepNesting.length > 0) {
    console.log('--- Deep Nesting Functions (>4) ---\n');

    for (const result of deepNesting) {
      const displayPath = result.file.startsWith(report.repoPath)
        ? result.file.slice(report.repoPath.length + 1)
        : result.file;

      console.log(`${displayPath}:${result.line} - ${result.name}`);
      console.log(
        `  Nesting: ${result.metrics.maxNesting} | Lines: ${result.metrics.lines} | Complexity: ${result.metrics.cyclomaticComplexity}`
      );
    }
    console.log();
  }

  // Show top functions by lines if nothing above threshold
  if (highComplexity.length === 0 && deepNesting.length === 0) {
    console.log('--- Top 10 Functions by Complexity ---\n');

    for (const result of report.results.slice(0, 10)) {
      const displayPath = result.file.startsWith(report.repoPath)
        ? result.file.slice(report.repoPath.length + 1)
        : result.file;

      console.log(`${displayPath}:${result.line} - ${result.name}`);
      console.log(
        `  Complexity: ${result.metrics.cyclomaticComplexity} | Lines: ${result.metrics.lines} | Nesting: ${result.metrics.maxNesting}`
      );
    }
    console.log();
  }
}

// ============================================================================
// Utilities
// ============================================================================

function getTypeScriptFiles(dirPath: string): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip hidden directories, node_modules, and .git
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== 'build'
        ) {
          walk(fullPath);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
          !entry.name.endsWith('.d.ts')
        ) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  };

  walk(dirPath);
  return files;
}

// ============================================================================
// Command Entry Point
// ============================================================================

export async function analyzeCommand(options: AnalyzeCommandOptions): Promise<void> {
  const { workspace, rawArgs } = options;

  // Parse command-specific arguments
  const { values } = parseArgs({
    args: rawArgs,
    options: {
      'dead-code': { type: 'boolean', default: false },
      complexity: { type: 'boolean', default: false },
      format: { type: 'string', default: 'text' },
      threshold: { type: 'string', default: '10' },
    },
    allowPositionals: true,
    strict: false,
  });

  const runDeadCode = values['dead-code'] as boolean;
  const runComplexity = values.complexity as boolean;
  const format = (values.format as string) === 'json' ? 'json' : 'text';
  const threshold = parseInt(values.threshold as string, 10) || 10;

  if (!runDeadCode && !runComplexity) {
    console.log('Usage: librarian analyze --dead-code | --complexity');
    console.log();
    console.log('Options:');
    console.log('  --dead-code      Run dead code detection');
    console.log('  --complexity     Report function complexity metrics');
    console.log('  --format <fmt>   Output format: text | json (default: text)');
    console.log('  --threshold <n>  Complexity threshold (default: 10)');
    console.log();
    console.log('Examples:');
    console.log('  librarian analyze --dead-code');
    console.log('  librarian analyze --complexity --threshold 15');
    console.log('  librarian analyze --dead-code --format json');
    return;
  }

  if (runDeadCode) {
    await runDeadCodeAnalysis(workspace, format);
  }

  if (runComplexity) {
    await runComplexityAnalysis(workspace, format, threshold);
  }
}
