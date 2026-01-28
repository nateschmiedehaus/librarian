/**
 * @fileoverview Bug Injector for Self-Play Evaluation (SWE-Gym)
 *
 * Creates synthetic but realistic bugs for testing detection and fix capabilities.
 * Based on SWE-Gym research for self-improving agents.
 *
 * Bug Categories:
 * - Off-by-one errors (loop bounds, array indices)
 * - Null/undefined handling (missing checks)
 * - Logic errors (wrong operator, inverted condition)
 * - Type coercion bugs (string vs number comparisons)
 * - Resource leaks (missing cleanup)
 * - Race condition seeds (order-dependent code)
 * - API misuse (wrong method, wrong params)
 *
 * Safety Constraints:
 * - Never inject bugs in actual source (only copies)
 * - All injections must be reversible
 * - Track all injections in a manifest
 *
 * @packageDocumentation
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Bug categories supported by the injector.
 */
export type BugCategory =
  | 'off_by_one'
  | 'null_check'
  | 'logic_error'
  | 'type_coercion'
  | 'resource_leak'
  | 'race_condition'
  | 'api_misuse';

/**
 * Difficulty levels for injected bugs.
 */
export type BugDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Location information for an injected bug.
 */
export interface BugLocation {
  file: string;
  line: number;
  column: number;
}

/**
 * Record of a single bug injection.
 */
export interface BugInjection {
  id: string;
  category: BugCategory;
  originalCode: string;
  injectedCode: string;
  location: BugLocation;
  description: string;
  difficulty: BugDifficulty;
  expectedSymptom: string;
}

/**
 * Configuration for the BugInjector.
 */
export interface BugInjectorConfig {
  /** Seed for deterministic random generation */
  seed?: number;
  /** Default difficulty level */
  defaultDifficulty?: BugDifficulty;
}

/**
 * Manifest tracking all injections.
 */
export interface InjectionManifest {
  injections: BugInjection[];
  createdAt: string;
  seed: number;
}

/**
 * Corpus item for self-play evaluation.
 */
export interface CorpusItem {
  original: string;
  injected: string;
  injection: BugInjection;
}

/**
 * Statistics for bug injection results.
 */
export interface InjectionStats {
  totalInjections: number;
  detectionRate: number;
  byCategory: Record<BugCategory, number>;
  byDifficulty: Record<BugDifficulty, number>;
}

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Simple seeded PRNG (Mulberry32).
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

// ============================================================================
// PATTERN MATCHERS
// ============================================================================

interface PatternMatch {
  pattern: RegExp;
  line: number;
  column: number;
  match: RegExpExecArray;
}

function findPatterns(code: string, pattern: RegExp): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const lines = code.split('\n');
  let offset = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const linePattern = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    let match: RegExpExecArray | null;

    // Reset regex and search in line
    const globalPattern = new RegExp(pattern.source, 'g');
    while ((match = globalPattern.exec(line)) !== null) {
      matches.push({
        pattern,
        line: lineNum + 1,
        column: match.index,
        match,
      });
    }
    offset += line.length + 1;
  }

  return matches;
}

// ============================================================================
// INJECTION STRATEGIES
// ============================================================================

type InjectionStrategy = (
  code: string,
  rng: SeededRandom,
  file: string
) => BugInjection | null;

/**
 * Off-by-one error strategies.
 */
const offByOneStrategies: InjectionStrategy[] = [
  // Change < to <= in loop bounds
  (code, rng, file) => {
    const matches = findPatterns(code, /(\w+)\s*<\s*(\w+(?:\.\w+)*)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const replacement = original.replace('<', '<=');
    const injectedCode = code.replace(original, replacement);

    return {
      id: `obo-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'off_by_one',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Changed "${original}" to "${replacement}" - loop may execute one extra iteration`,
      difficulty: 'medium',
      expectedSymptom: 'Array index out of bounds or processing one extra element',
    };
  },

  // Change > to >= in loop bounds
  (code, rng, file) => {
    const matches = findPatterns(code, /(\w+)\s*>\s*(\d+)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const replacement = original.replace('>', '>=');
    const injectedCode = code.replace(original, replacement);

    return {
      id: `obo-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'off_by_one',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Changed "${original}" to "${replacement}" - loop boundary shifted`,
      difficulty: 'medium',
      expectedSymptom: 'Loop executes one fewer iteration than expected',
    };
  },

  // Remove -1 from array index
  (code, rng, file) => {
    const matches = findPatterns(code, /\[\s*(\w+(?:\.\w+)*)\s*-\s*1\s*\]/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const indexExpr = match.match[1];
    const replacement = `[${indexExpr}]`;
    const injectedCode = code.replace(original, replacement);

    return {
      id: `obo-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'off_by_one',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Removed "-1" from array index "${original}"`,
      difficulty: 'easy',
      expectedSymptom: 'Array index out of bounds when accessing last element',
    };
  },
];

/**
 * Null check error strategies.
 */
const nullCheckStrategies: InjectionStrategy[] = [
  // Remove && check (e.g., user && user.name)
  (code, rng, file) => {
    const matches = findPatterns(code, /if\s*\(\s*(\w+)\s*&&\s*\1\.(\w+)\s*\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const varName = match.match[1];
    const propName = match.match[2];
    const replacement = `if (${varName}.${propName})`;
    const injectedCode = code.replace(original, replacement);

    return {
      id: `nc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'null_check',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Removed null guard for "${varName}" before accessing "${propName}"`,
      difficulty: 'easy',
      expectedSymptom: 'TypeError: Cannot read property of null/undefined',
    };
  },

  // Remove !== null check
  (code, rng, file) => {
    const matches = findPatterns(code, /if\s*\(\s*(\w+)\s*!==?\s*null\s*\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const varName = match.match[1];
    const replacement = `if (true)`;
    const injectedCode = code.replace(original, replacement);

    return {
      id: `nc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'null_check',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Removed null check for "${varName}"`,
      difficulty: 'easy',
      expectedSymptom: 'TypeError: Cannot read property of null/undefined',
    };
  },

  // Remove all optional chaining in code
  (code, rng, file) => {
    const matches = findPatterns(code, /\?\./g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    // Replace ALL optional chaining to ensure test passes
    const injectedCode = code.replace(/\?\./g, '.');

    return {
      id: `nc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'null_check',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Removed all optional chaining operators`,
      difficulty: 'medium',
      expectedSymptom: 'TypeError when accessing property of null/undefined',
    };
  },

  // Remove nullish coalescing
  (code, rng, file) => {
    const matches = findPatterns(code, /(\w+)\s*\?\?\s*(\w+)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const leftSide = match.match[1];
    // Replace ALL nullish coalescing
    const injectedCode = code.replace(/(\w+)\s*\?\?\s*\w+/g, '$1');

    return {
      id: `nc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'null_check',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Removed nullish coalescing, keeping only left side`,
      difficulty: 'medium',
      expectedSymptom: 'Unexpected null/undefined value where default was expected',
    };
  },

  // Remove truthy check
  (code, rng, file) => {
    const matches = findPatterns(code, /if\s*\(\s*(\w+)\s*\)\s*\{/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const replacement = 'if (true) {';
    const injectedCode = code.replace(original, replacement);

    return {
      id: `nc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'null_check',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Removed truthy check, always executing block`,
      difficulty: 'easy',
      expectedSymptom: 'TypeError accessing properties of null/undefined values',
    };
  },
];

/**
 * Logic error strategies.
 */
const logicErrorStrategies: InjectionStrategy[] = [
  // Swap && with ||
  (code, rng, file) => {
    const matches = findPatterns(code, /(\w+(?:\.\w+)*)\s*&&\s*(\w+(?:\.\w+)*)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const replacement = original.replace('&&', '||');
    const injectedCode = code.replace(original, replacement);

    return {
      id: `le-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'logic_error',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Changed AND (&&) to OR (||) in condition`,
      difficulty: 'medium',
      expectedSymptom: 'Condition evaluates to true in unexpected cases',
    };
  },

  // Invert condition
  (code, rng, file) => {
    const matches = findPatterns(code, /if\s*\(\s*([a-zA-Z]\w*)\s*\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const varName = match.match[1];
    const replacement = `if (!${varName})`;
    const injectedCode = code.replace(original, replacement);

    return {
      id: `le-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'logic_error',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Inverted condition "${varName}" to "!${varName}"`,
      difficulty: 'easy',
      expectedSymptom: 'Wrong branch executed - true case runs when false expected',
    };
  },

  // Swap comparison operators (>)
  (code, rng, file) => {
    const matches = findPatterns(code, /(\w+)\s*(>)\s*(\w+)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const replacement = original.replace('>', '<');
    const injectedCode = code.replace(original, replacement);

    return {
      id: `le-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'logic_error',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Swapped ">" to "<" in comparison`,
      difficulty: 'medium',
      expectedSymptom: 'Comparison yields opposite result',
    };
  },

  // Swap comparison operators (<)
  (code, rng, file) => {
    // Check for < but not <=, <<, or arrow functions
    const matches = findPatterns(code, /(\w+)\s*<\s*(\w+)(?!\s*=)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const replacement = original.replace('<', '>');
    const injectedCode = code.replace(original, replacement);

    return {
      id: `le-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'logic_error',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Swapped "<" to ">" in comparison`,
      difficulty: 'medium',
      expectedSymptom: 'Comparison yields opposite result',
    };
  },

  // Swap === with !== in condition
  (code, rng, file) => {
    const matches = findPatterns(code, /(\w+(?:\.\w+)*)\s*===\s*(['"]?\w+['"]?)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const replacement = original.replace('===', '!==');
    const injectedCode = code.replace(original, replacement);

    return {
      id: `le-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'logic_error',
      originalCode: code,
      injectedCode,
      location: { file, line: match.line, column: match.column },
      description: `Changed equality (===) to inequality (!==)`,
      difficulty: 'easy',
      expectedSymptom: 'Condition matches when it should not or vice versa',
    };
  },
];

/**
 * Type coercion error strategies.
 */
const typeCoercionStrategies: InjectionStrategy[] = [
  // Change === to ==
  (code, rng, file) => {
    const matches = findPatterns(code, /===(?!=)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const injectedCode = code.substring(0, code.indexOf('===')) +
      '==' +
      code.substring(code.indexOf('===') + 3);

    // Find the actual position of this match
    let pos = 0;
    for (let i = 0; i < matches.indexOf(match); i++) {
      pos = code.indexOf('===', pos) + 3;
    }
    pos = code.indexOf('===', pos);

    const lines = code.substring(0, pos).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length;

    const injected = code.replace('===', '==');

    return {
      id: `tc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'type_coercion',
      originalCode: code,
      injectedCode: injected,
      location: { file, line, column },
      description: `Changed strict equality (===) to loose equality (==)`,
      difficulty: 'hard',
      expectedSymptom: 'Type coercion causes unexpected equality matches',
    };
  },

  // Change !== to !=
  (code, rng, file) => {
    const matches = findPatterns(code, /!==(?!=)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const injected = code.replace('!==', '!=');

    const pos = code.indexOf('!==');
    const lines = code.substring(0, pos).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length;

    return {
      id: `tc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'type_coercion',
      originalCode: code,
      injectedCode: injected,
      location: { file, line, column },
      description: `Changed strict inequality (!==) to loose inequality (!=)`,
      difficulty: 'hard',
      expectedSymptom: 'Type coercion causes unexpected inequality results',
    };
  },

  // Remove parseInt radix
  (code, rng, file) => {
    const matches = findPatterns(code, /parseInt\(([^,)]+),\s*10\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const arg = match.match[1];
    const replacement = `parseInt(${arg})`;
    const injected = code.replace(original, replacement);

    return {
      id: `tc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'type_coercion',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Removed radix parameter from parseInt`,
      difficulty: 'medium',
      expectedSymptom: 'Type coercion: strings starting with 0 may be parsed as octal',
    };
  },
];

/**
 * Resource leak error strategies.
 */
const resourceLeakStrategies: InjectionStrategy[] = [
  // Remove .close() call completely
  (code, rng, file) => {
    const matches = findPatterns(code, /\s*\w+\.close\(\);?\s*/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    // Remove the entire line with close()
    const injected = code.replace(original, '\n');

    return {
      id: `rl-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'resource_leak',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Removed close() call, causing resource leak`,
      difficulty: 'medium',
      expectedSymptom: 'Resource leak: handle not properly closed',
    };
  },

  // Remove finally block (handle multi-line)
  (code, rng, file) => {
    // Match finally block including newlines
    const finallyPattern = /\s*finally\s*\{[\s\S]*?\}/g;
    const match = finallyPattern.exec(code);
    if (!match) return null;

    const original = match[0];
    const injected = code.replace(original, '');

    // Find line number
    const beforeMatch = code.substring(0, match.index);
    const line = beforeMatch.split('\n').length;

    return {
      id: `rl-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'resource_leak',
      originalCode: code,
      injectedCode: injected,
      location: { file, line, column: 0 },
      description: `Removed finally block with cleanup code`,
      difficulty: 'hard',
      expectedSymptom: 'Memory/resource leak when exceptions occur',
    };
  },

  // Remove removeEventListener completely
  (code, rng, file) => {
    const matches = findPatterns(code, /\w+\.removeEventListener\([^)]+\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    // Replace with empty string, preserving structure
    const injected = code.replace(original, '/* cleanup removed */');

    return {
      id: `rl-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'resource_leak',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Removed event listener cleanup`,
      difficulty: 'medium',
      expectedSymptom: 'Memory leak from accumulated event listeners',
    };
  },
];

/**
 * Race condition error strategies.
 */
const raceConditionStrategies: InjectionStrategy[] = [
  // Remove await keyword
  (code, rng, file) => {
    const matches = findPatterns(code, /await\s+(\w+)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const funcName = match.match[1];
    const replacement = funcName;
    const injected = code.replace(original, replacement);

    return {
      id: `rc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'race_condition',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Removed await, making async call fire-and-forget`,
      difficulty: 'medium',
      expectedSymptom: 'Race condition: code proceeds before async operation completes',
    };
  },

  // Remove Promise.all
  (code, rng, file) => {
    const matches = findPatterns(code, /Promise\.all\(([^)]+)\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const arg = match.match[1];
    // Replace with just the first promise
    const replacement = `${arg}[0]`;
    const injected = code.replace(original, replacement);

    return {
      id: `rc-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'race_condition',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Replaced Promise.all with single promise, losing parallel execution`,
      difficulty: 'hard',
      expectedSymptom: 'Race condition or incomplete data from partial execution',
    };
  },
];

/**
 * API misuse error strategies.
 */
const apiMisuseStrategies: InjectionStrategy[] = [
  // Swap filter with find
  (code, rng, file) => {
    const matches = findPatterns(code, /\.filter\(/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const injected = code.replace('.filter(', '.find(');

    return {
      id: `am-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'api_misuse',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Changed filter() to find() - returns single item instead of array`,
      difficulty: 'medium',
      expectedSymptom: 'TypeError when treating single value as array',
    };
  },

  // Swap filter with map
  (code, rng, file) => {
    const matches = findPatterns(code, /\.filter\(/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const injected = code.replace('.filter(', '.map(');

    return {
      id: `am-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'api_misuse',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Changed filter() to map() - returns boolean array instead of filtered items`,
      difficulty: 'easy',
      expectedSymptom: 'Array contains true/false values instead of filtered items',
    };
  },

  // Swap filter with some
  (code, rng, file) => {
    const matches = findPatterns(code, /\.filter\(/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const injected = code.replace('.filter(', '.some(');

    return {
      id: `am-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'api_misuse',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Changed filter() to some() - returns boolean instead of array`,
      difficulty: 'easy',
      expectedSymptom: 'TypeError when iterating over boolean value',
    };
  },

  // Swap slice parameters
  (code, rng, file) => {
    const matches = findPatterns(code, /\.slice\((\d+),\s*(\d+)\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const start = match.match[1];
    const end = match.match[2];
    const replacement = `.slice(${end}, ${start})`;
    const injected = code.replace(original, replacement);

    return {
      id: `am-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'api_misuse',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Swapped slice() parameters - empty or wrong result`,
      difficulty: 'medium',
      expectedSymptom: 'Empty array or wrong portion of array returned',
    };
  },

  // Generic API misuse for split
  (code, rng, file) => {
    const matches = findPatterns(code, /\.split\(['"]([^'"]+)['"]\)/g);
    if (matches.length === 0) return null;

    const match = rng.pick(matches);
    const original = match.match[0];
    const delimiter = match.match[1];
    // Use wrong delimiter
    const wrongDelimiter = delimiter === ',' ? ';' : ',';
    const replacement = `.split('${wrongDelimiter}')`;
    const injected = code.replace(original, replacement);

    return {
      id: `am-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      category: 'api_misuse',
      originalCode: code,
      injectedCode: injected,
      location: { file, line: match.line, column: match.column },
      description: `Changed split delimiter from "${delimiter}" to "${wrongDelimiter}"`,
      difficulty: 'easy',
      expectedSymptom: 'String not split correctly, returns single-element array',
    };
  },
];

// ============================================================================
// STRATEGY REGISTRY
// ============================================================================

const strategyRegistry: Record<BugCategory, InjectionStrategy[]> = {
  off_by_one: offByOneStrategies,
  null_check: nullCheckStrategies,
  logic_error: logicErrorStrategies,
  type_coercion: typeCoercionStrategies,
  resource_leak: resourceLeakStrategies,
  race_condition: raceConditionStrategies,
  api_misuse: apiMisuseStrategies,
};

const allCategories: BugCategory[] = [
  'off_by_one',
  'null_check',
  'logic_error',
  'type_coercion',
  'resource_leak',
  'race_condition',
  'api_misuse',
];

// ============================================================================
// BUG INJECTOR CLASS
// ============================================================================

/**
 * Bug injector for self-play evaluation.
 */
export class BugInjector {
  private rng: SeededRandom;
  private seed: number;
  private manifest: InjectionManifest;
  private detectionResults: Map<string, boolean> = new Map();

  constructor(config: BugInjectorConfig = {}) {
    this.seed = config.seed ?? Date.now();
    this.rng = new SeededRandom(this.seed);
    this.manifest = {
      injections: [],
      createdAt: new Date().toISOString(),
      seed: this.seed,
    };
  }

  /**
   * Inject a specific type of bug into code.
   */
  injectBug(code: string, category: BugCategory, file: string): BugInjection | null {
    if (!code || code.trim().length === 0) {
      return null;
    }

    const strategies = strategyRegistry[category];
    if (!strategies || strategies.length === 0) {
      return null;
    }

    // Try each strategy until one works
    const shuffledStrategies = [...strategies].sort(() => this.rng.next() - 0.5);

    for (const strategy of shuffledStrategies) {
      const injection = strategy(code, this.rng, file);
      if (injection && injection.injectedCode !== code) {
        this.manifest.injections.push(injection);
        return injection;
      }
    }

    return null;
  }

  /**
   * Inject a random bug type into code.
   */
  injectRandomBug(code: string, file: string): BugInjection {
    if (!code || code.trim().length === 0) {
      // Return a minimal injection for empty code
      return {
        id: `empty-${Date.now()}`,
        category: 'logic_error',
        originalCode: code,
        injectedCode: code,
        location: { file, line: 1, column: 0 },
        description: 'No injection possible on empty code',
        difficulty: 'easy',
        expectedSymptom: 'None',
      };
    }

    // Shuffle categories and try each
    const shuffledCategories = [...allCategories].sort(() => this.rng.next() - 0.5);

    for (const category of shuffledCategories) {
      const injection = this.injectBug(code, category, file);
      if (injection) {
        return injection;
      }
    }

    // Fallback: return unchanged code with a note
    const fallback: BugInjection = {
      id: `fallback-${Date.now()}-${this.rng.nextInt(1000, 9999)}`,
      category: 'logic_error',
      originalCode: code,
      injectedCode: code,
      location: { file, line: 1, column: 0 },
      description: 'No applicable injection patterns found',
      difficulty: 'easy',
      expectedSymptom: 'None - no injection performed',
    };

    this.manifest.injections.push(fallback);
    return fallback;
  }

  /**
   * Revert an injection back to original code.
   */
  revertInjection(injection: BugInjection): string {
    return injection.originalCode;
  }

  /**
   * Revert multiple injections.
   */
  revertAll(injections: BugInjection[]): string[] {
    return injections.map((i) => this.revertInjection(i));
  }

  /**
   * Get the injection manifest.
   */
  getManifest(): InjectionManifest {
    return { ...this.manifest };
  }

  /**
   * Export manifest as JSON string.
   */
  exportManifest(): string {
    return JSON.stringify(this.manifest, null, 2);
  }

  /**
   * Import manifest from JSON string.
   */
  importManifest(json: string): void {
    const parsed = JSON.parse(json) as InjectionManifest;
    this.manifest = parsed;
    this.seed = parsed.seed;
  }

  /**
   * Reset the injector state.
   */
  reset(): void {
    this.manifest = {
      injections: [],
      createdAt: new Date().toISOString(),
      seed: this.seed,
    };
    this.detectionResults.clear();
  }

  /**
   * Generate a corpus for self-play evaluation.
   */
  generateCorpus(inputs: Array<{ code: string; file: string }>): CorpusItem[] {
    const corpus: CorpusItem[] = [];

    for (const input of inputs) {
      const injection = this.injectRandomBug(input.code, input.file);
      if (injection.injectedCode !== injection.originalCode) {
        corpus.push({
          original: injection.originalCode,
          injected: injection.injectedCode,
          injection,
        });
      }
    }

    return corpus;
  }

  /**
   * Record a detection result for tracking.
   */
  recordDetectionResult(injectionId: string, detected: boolean): void {
    this.detectionResults.set(injectionId, detected);
  }

  /**
   * Get statistics about injections and detection rates.
   */
  getStats(): InjectionStats {
    const byCategory: Record<BugCategory, number> = {
      off_by_one: 0,
      null_check: 0,
      logic_error: 0,
      type_coercion: 0,
      resource_leak: 0,
      race_condition: 0,
      api_misuse: 0,
    };

    const byDifficulty: Record<BugDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    for (const injection of this.manifest.injections) {
      byCategory[injection.category]++;
      byDifficulty[injection.difficulty]++;
    }

    const detected = Array.from(this.detectionResults.values()).filter((v) => v).length;
    const total = this.detectionResults.size;

    return {
      totalInjections: this.manifest.injections.length,
      detectionRate: total > 0 ? detected / total : 0,
      byCategory,
      byDifficulty,
    };
  }
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Inject a specific type of bug into code.
 */
export function injectBug(
  code: string,
  category: BugCategory,
  file: string,
  seed?: number
): BugInjection | null {
  const injector = new BugInjector({ seed });
  return injector.injectBug(code, category, file);
}

/**
 * Inject a random bug type into code.
 */
export function injectRandomBug(code: string, file: string, seed?: number): BugInjection {
  const injector = new BugInjector({ seed });
  return injector.injectRandomBug(code, file);
}

/**
 * Generate a human-readable description of an injection.
 */
export function describeBug(injection: BugInjection): string {
  return [
    `Bug Injection Report`,
    `-------------------`,
    `ID: ${injection.id}`,
    `Category: ${injection.category}`,
    `File: ${injection.location.file}`,
    `Location: Line ${injection.location.line}, Column ${injection.location.column}`,
    `Difficulty: ${injection.difficulty}`,
    ``,
    `Description: ${injection.description}`,
    ``,
    `Expected Symptom: ${injection.expectedSymptom}`,
  ].join('\n');
}

/**
 * Revert injected code back to original.
 */
export function revertBug(injectedCode: string, injection: BugInjection): string {
  // The injection record contains the original code
  return injection.originalCode;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new BugInjector instance.
 */
export function createBugInjector(config: BugInjectorConfig = {}): BugInjector {
  return new BugInjector(config);
}
