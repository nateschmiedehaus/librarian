import type { FunctionKnowledge, ModuleKnowledge } from '../storage/types.js';
import type { DetectedPattern, NamingConvention, PatternQuery, PatternResult } from './patterns.js';

export function analyzeNamingConventions(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const conventions: NamingConvention[] = [];

  const prefixCounts = new Map<string, { count: number; examples: string[] }>();
  const prefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'create', 'update', 'delete', 'handle', 'on', 'init', 'validate', 'parse', 'format', 'render', 'fetch', 'load', 'save'];

  for (const fn of functions) {
    for (const prefix of prefixes) {
      if (fn.name.toLowerCase().startsWith(prefix)) {
        if (!prefixCounts.has(prefix)) {
          prefixCounts.set(prefix, { count: 0, examples: [] });
        }
        const entry = prefixCounts.get(prefix) as { count: number; examples: string[] };
        entry.count += 1;
        if (entry.examples.length < 3) entry.examples.push(fn.name);
        break;
      }
    }
  }

  for (const [prefix, data] of prefixCounts) {
    if (data.count >= (query.minOccurrences ?? 5)) {
      conventions.push({
        pattern: `${prefix}*`,
        type: 'function',
        count: data.count,
        examples: data.examples,
        adherence: data.count / Math.max(1, functions.length),
      });
    }
  }

  const filePatterns = new Map<string, number>();
  for (const mod of modules) {
    const fileName = mod.path.split('/').pop() ?? '';
    if (fileName.includes('.test.')) filePatterns.set('*.test.*', (filePatterns.get('*.test.*') ?? 0) + 1);
    else if (fileName.includes('.spec.')) filePatterns.set('*.spec.*', (filePatterns.get('*.spec.*') ?? 0) + 1);
    else if (fileName.startsWith('index.')) filePatterns.set('index.*', (filePatterns.get('index.*') ?? 0) + 1);
    else if (fileName.includes('_')) filePatterns.set('snake_case', (filePatterns.get('snake_case') ?? 0) + 1);
    else if (/[A-Z]/.test(fileName)) filePatterns.set('PascalCase', (filePatterns.get('PascalCase') ?? 0) + 1);
    else filePatterns.set('kebab-case', (filePatterns.get('kebab-case') ?? 0) + 1);
  }

  for (const [pattern, count] of filePatterns) {
    if (count >= 3) {
      conventions.push({
        pattern,
        type: 'file',
        count,
        examples: [],
        adherence: count / Math.max(1, modules.length),
      });
    }
  }

  conventions.sort((a, b) => b.count - a.count);

  return {
    query,
    conventions,
    summary: `Found ${conventions.length} naming conventions`,
    recommendations: [],
  };
}

export function analyzeTeamStylePatterns(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  let camelCase = 0;
  let pascalCase = 0;
  let snakeCase = 0;

  for (const fn of functions) {
    if (fn.name.includes('_')) snakeCase += 1;
    else if (fn.name[0] === fn.name[0]?.toUpperCase()) pascalCase += 1;
    else camelCase += 1;
  }

  const total = camelCase + pascalCase + snakeCase;
  const dominantStyle = camelCase > pascalCase && camelCase > snakeCase ? 'camelCase'
    : pascalCase > snakeCase ? 'PascalCase' : 'snake_case';

  patterns.push({
    name: `${dominantStyle} functions`,
    type: 'team',
    occurrences: [],
    confidence: Math.max(camelCase, pascalCase, snakeCase) / Math.max(1, total),
    description: `Team uses ${dominantStyle} for function names`,
  });

  const asyncFunctions = functions.filter((f) =>
    f.signature.includes('async') || f.signature.includes('Promise')
  );
  const asyncRatio = asyncFunctions.length / Math.max(1, functions.length);
  if (asyncRatio > 0.3) {
    patterns.push({
      name: 'Async-First',
      type: 'team',
      occurrences: [],
      confidence: asyncRatio,
      description: `${Math.round(asyncRatio * 100)}% of functions are async`,
    });
  }

  const arrowFunctions = functions.filter((f) => f.signature.includes('=>'));
  if (arrowFunctions.length / Math.max(1, functions.length) > 0.4) {
    patterns.push({
      name: 'Arrow-Function Preference',
      type: 'team',
      occurrences: arrowFunctions.slice(0, 5).map((f) => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.signature.substring(0, 40),
      })),
      confidence: arrowFunctions.length / Math.max(1, functions.length),
      description: 'Team favors arrow functions for declarations',
    });
  }

  let namedExports = 0;
  let defaultExports = 0;
  for (const mod of modules) {
    if (mod.exports.includes('default')) defaultExports += 1;
    if (mod.exports.length > 1 || !mod.exports.includes('default')) namedExports += 1;
  }

  if (namedExports > defaultExports * 2) {
    patterns.push({
      name: 'Named Exports',
      type: 'team',
      occurrences: [],
      confidence: namedExports / Math.max(1, namedExports + defaultExports),
      description: 'Team prefers named exports over default exports',
    });
  }

  return {
    query,
    patterns,
    summary: 'Analyzed team coding style',
    recommendations: [],
  };
}
