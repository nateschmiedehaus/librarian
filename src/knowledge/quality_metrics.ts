import * as fs from 'fs';
import * as path from 'path';
import { Project, Node, SyntaxKind } from 'ts-morph';
import type { FunctionKnowledge, ModuleKnowledge } from '../storage/types.js';
import type {
  CodeSmell,
  ComplexityAnalysis,
  ComplexityDistribution,
  ComplexityHotspot,
  ImprovementOpportunity,
  RefactoringCandidate,
} from './quality.js';

export function buildComplexityAnalysis(
  functions: FunctionKnowledge[],
  threshold: number
): ComplexityAnalysis {
  const cyclomaticIndex = buildCyclomaticComplexityIndex(functions);
  const hotspots: ComplexityHotspot[] = [];
  const distribution: ComplexityDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
  let totalComplexity = 0;
  let maxComplexity = 0;

  for (const fn of functions) {
    const lines = Math.max(0, fn.endLine - fn.startLine);
    const { complexity, reason } = resolveFunctionComplexity(fn, lines, cyclomaticIndex);

    totalComplexity += complexity;
    maxComplexity = Math.max(maxComplexity, complexity);

    if (lines < 10) distribution.low += 1;
    else if (lines < 50) distribution.medium += 1;
    else if (lines < 100) distribution.high += 1;
    else distribution.critical += 1;

    if (complexity >= threshold) {
      hotspots.push({
        path: fn.filePath,
        function: fn.name,
        complexity,
        lines,
        reason,
      });
    }
  }

  hotspots.sort((a, b) => b.complexity - a.complexity);
  const average = functions.length ? totalComplexity / functions.length : 0;

  return {
    average: Math.round(average * 10) / 10,
    max: maxComplexity,
    hotspots,
    distribution,
  };
}

export function detectCodeSmells(functions: FunctionKnowledge[], modules: ModuleKnowledge[]): CodeSmell[] {
  const smells: CodeSmell[] = [];

  for (const fn of functions) {
    const lines = fn.endLine - fn.startLine;
    if (lines > 100) {
      smells.push({
        type: 'Long Method',
        severity: lines > 200 ? 'high' : 'medium',
        location: { file: fn.filePath, line: fn.startLine },
        description: `${fn.name} is ${lines} lines long`,
        suggestion: 'Extract smaller functions with single responsibilities',
      });
    }
  }

  for (const mod of modules) {
    if (mod.exports.length > 20) {
      smells.push({
        type: 'God Module',
        severity: mod.exports.length > 35 ? 'high' : 'medium',
        location: { file: mod.path },
        description: `Module exports ${mod.exports.length} symbols`,
        suggestion: 'Split into smaller, focused modules',
      });
    }
  }

  for (const mod of modules) {
    if (mod.dependencies.length > 15) {
      smells.push({
        type: 'Dependency Magnet',
        severity: mod.dependencies.length > 25 ? 'high' : 'medium',
        location: { file: mod.path },
        description: `Module has ${mod.dependencies.length} dependencies`,
        suggestion: 'Consider dependency injection or module splitting',
      });
    }
  }

  for (const fn of functions) {
    const paramMatch = fn.signature.match(/\(([^)]*)\)/);
    if (paramMatch) {
      const params = paramMatch[1].split(',').filter((p) => p.trim()).length;
      if (params > 5) {
        smells.push({
          type: 'Too Many Parameters',
          severity: params > 7 ? 'high' : 'medium',
          location: { file: fn.filePath, line: fn.startLine },
          description: `${fn.name} has ${params} parameters`,
          suggestion: 'Consider using an options object or builder pattern',
        });
      }
    }
  }

  return smells;
}

export function findImprovementOpportunities(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[]
): ImprovementOpportunity[] {
  const improvements: ImprovementOpportunity[] = [];

  for (const fn of functions) {
    const lines = fn.endLine - fn.startLine;
    if (lines > 50 && lines < 150) {
      improvements.push({
        type: 'readability',
        location: `${fn.filePath}:${fn.name}`,
        description: `${fn.name} could be split for better readability`,
        effort: 'low',
        impact: 'medium',
      });
    }
  }

  for (const mod of modules) {
    if (mod.exports.length > 10 && mod.exports.length <= 20) {
      improvements.push({
        type: 'maintainability',
        location: mod.path,
        description: 'Consider grouping related exports',
        effort: 'low',
        impact: 'low',
      });
    }
  }

  improvements.sort((a, b) => {
    const scoreA = impactScore(a.impact) / effortScore(a.effort);
    const scoreB = impactScore(b.impact) / effortScore(b.effort);
    return scoreB - scoreA;
  });

  return improvements;
}

export function findRefactoringCandidates(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[]
): RefactoringCandidate[] {
  const candidates: RefactoringCandidate[] = [];

  for (const fn of functions) {
    const lines = fn.endLine - fn.startLine;
    if (lines > 80) {
      candidates.push({
        type: 'extract_function',
        source: `${fn.filePath}:${fn.name}`,
        reason: `Function is ${lines} lines - extract smaller functions`,
        complexity: lines > 150 ? 'complex' : 'moderate',
      });
    }
  }

  for (const mod of modules) {
    if (mod.exports.length > 15) {
      candidates.push({
        type: 'extract_module',
        source: mod.path,
        reason: `Module has ${mod.exports.length} exports - split by responsibility`,
        complexity: mod.exports.length > 25 ? 'complex' : 'moderate',
      });
    }
  }

  for (const mod of modules) {
    const hasTypes = mod.exports.some((exp) => /type|interface|props/i.test(exp));
    const hasImpl = mod.exports.some((exp) => !/type|interface|props/i.test(exp));
    if (hasTypes && hasImpl && mod.exports.length > 5) {
      candidates.push({
        type: 'split',
        source: mod.path,
        reason: 'Mixed types and implementation - consider separate files',
        complexity: 'simple',
      });
    }
  }

  return candidates;
}

export function calculateModuleComplexity(
  functions: FunctionKnowledge[],
  modulePath: string
): { complexity: number; functionCount: number; averageComplexity: number; maxFunctionComplexity: number } {
  const moduleFunctions = functions.filter((fn) => fn.filePath === modulePath);
  const cyclomaticIndex = buildCyclomaticComplexityIndex(moduleFunctions);
  let total = 0;
  let max = 0;
  for (const fn of moduleFunctions) {
    const lines = Math.max(0, fn.endLine - fn.startLine);
    const { complexity } = resolveFunctionComplexity(fn, lines, cyclomaticIndex);
    total += complexity;
    max = Math.max(max, complexity);
  }
  const count = moduleFunctions.length;
  return {
    complexity: total,
    functionCount: count,
    averageComplexity: count > 0 ? total / count : 0,
    maxFunctionComplexity: max,
  };
}

function resolveFunctionComplexity(
  fn: FunctionKnowledge,
  lines: number,
  cyclomaticIndex: Map<string, CyclomaticEntry>
): { complexity: number; reason: string } {
  const key = buildFunctionKey(fn.filePath, fn.startLine, fn.endLine);
  const cyclomatic = cyclomaticIndex.get(key);
  if (cyclomatic) {
    return { complexity: cyclomatic.complexity, reason: cyclomatic.reason };
  }
  return estimateFunctionComplexity(fn, lines);
}

function estimateFunctionComplexity(fn: FunctionKnowledge, lines: number): { complexity: number; reason: string } {
  let complexity = Math.ceil(lines / 10);
  if (fn.signature.includes('async')) complexity += 1;
  const paramMatch = fn.signature.match(/\(([^)]*)\)/);
  if (paramMatch) {
    const params = paramMatch[1].split(',').filter((p) => p.trim()).length;
    complexity += Math.floor(params / 3);
  }
  const reason = lines > 100 ? 'Very long function' : lines > 50 ? 'Long function' : complexity > 15 ? 'High estimated complexity' : 'Moderate complexity';
  return { complexity, reason };
}

type CyclomaticEntry = { complexity: number; reason: string };
const COMPLEXITY_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const complexityProject = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: {
    allowJs: true,
    checkJs: false,
    noResolve: true,
    skipLibCheck: true,
  },
});

function buildCyclomaticComplexityIndex(functions: FunctionKnowledge[]): Map<string, CyclomaticEntry> {
  const index = new Map<string, CyclomaticEntry>();
  const functionsByFile = new Map<string, FunctionKnowledge[]>();

  for (const fn of functions) {
    const entry = functionsByFile.get(fn.filePath);
    if (entry) {
      entry.push(fn);
    } else {
      functionsByFile.set(fn.filePath, [fn]);
    }
  }

  for (const [filePath, fileFunctions] of functionsByFile) {
    const ext = path.extname(filePath).toLowerCase();
    if (!COMPLEXITY_EXTENSIONS.has(ext)) continue;
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const sourceFile = complexityProject.createSourceFile(filePath, content, { overwrite: true });
    try {
      const nodes = collectFunctionNodes(sourceFile);
      for (const nodeInfo of nodes) {
        const key = buildFunctionKey(filePath, nodeInfo.startLine, nodeInfo.endLine);
        index.set(key, {
          complexity: nodeInfo.complexity,
          reason: `Cyclomatic complexity ${nodeInfo.complexity} (${nodeInfo.decisionPoints} decision points)`,
        });
      }
      // Handle functions stored without exact AST matches
      for (const fn of fileFunctions) {
        const key = buildFunctionKey(filePath, fn.startLine, fn.endLine);
        if (index.has(key)) continue;
        const fallback = estimateFunctionComplexity(fn, Math.max(0, fn.endLine - fn.startLine));
        index.set(key, fallback);
      }
    } finally {
      sourceFile.forget();
    }
  }

  return index;
}

function buildFunctionKey(filePath: string, startLine: number, endLine: number): string {
  return `${filePath}:${startLine}:${endLine}`;
}

function collectFunctionNodes(sourceFile: import('ts-morph').SourceFile): Array<{ startLine: number; endLine: number; complexity: number; decisionPoints: number }> {
  const nodes: Array<{ startLine: number; endLine: number; complexity: number; decisionPoints: number }> = [];

  for (const fn of sourceFile.getFunctions()) {
    nodes.push(buildNodeComplexity(fn));
  }

  for (const method of sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
    nodes.push(buildNodeComplexity(method));
  }

  for (const decl of sourceFile.getVariableDeclarations()) {
    const initializer = decl.getInitializer();
    if (!initializer) continue;
    if (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer)) continue;
    nodes.push(buildNodeComplexity(initializer));
  }

  for (const prop of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyDeclaration)) {
    const initializer = prop.getInitializer();
    if (!initializer) continue;
    if (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer)) continue;
    nodes.push(buildNodeComplexity(initializer));
  }

  for (const prop of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    const initializer = prop.getInitializer();
    if (!initializer) continue;
    if (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer)) continue;
    nodes.push(buildNodeComplexity(initializer));
  }

  return nodes;
}

function buildNodeComplexity(node: Node): { startLine: number; endLine: number; complexity: number; decisionPoints: number } {
  const decisionPoints = countDecisionPoints(node);
  return {
    startLine: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
    complexity: 1 + decisionPoints,
    decisionPoints,
  };
}

function countDecisionPoints(root: Node): number {
  let count = 0;

  const visit = (node: Node): void => {
    if (node !== root && isFunctionLike(node)) return;

    if (
      Node.isIfStatement(node) ||
      Node.isConditionalExpression(node) ||
      Node.isForStatement(node) ||
      Node.isForInStatement(node) ||
      Node.isForOfStatement(node) ||
      Node.isWhileStatement(node) ||
      Node.isDoStatement(node) ||
      Node.isCatchClause(node) ||
      Node.isCaseClause(node) ||
      Node.isDefaultClause(node)
    ) {
      count += 1;
    }

    if (Node.isBinaryExpression(node)) {
      const operator = node.getOperatorToken().getText();
      if (operator === '&&' || operator === '||') count += 1;
    }

    node.forEachChild(visit);
  };

  root.forEachChild(visit);

  return count;
}

function isFunctionLike(node: Node): boolean {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isFunctionExpression(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isArrowFunction(node)
  );
}

function impactScore(impact: 'low' | 'medium' | 'high'): number {
  return impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
}

function effortScore(effort: 'low' | 'medium' | 'high'): number {
  return effort === 'high' ? 3 : effort === 'medium' ? 2 : 1;
}
