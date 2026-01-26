import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { getErrorMessage } from '../utils/errors.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';
import { noResult } from '../api/empty_values.js';
import { safeJsonParse, getResultErrorMessage } from '../utils/safe_json.js';

export interface CoverageFileSummary {
  path: string;
  linesTotal: number;
  linesCovered: number;
  functionsTotal?: number;
  functionsCovered?: number;
  branchesTotal?: number;
  branchesCovered?: number;
}

export interface CoverageModuleSummary {
  module: string;
  linesTotal: number;
  linesCovered: number;
  coveragePct: number;
}

export interface TestMapping { testFile: string; sourceFiles: string[]; }
export interface FixtureEntry { path: string; sizeBytes: number; extension: string; }
export interface FlakyTestSummary {
  name: string;
  runs: number;
  failures: number;
  lastStatus: 'passed' | 'failed' | 'skipped';
  flaky: boolean;
}

export interface TestIngestionOptions {
  coverageGlobs?: string[];
  testGlobs?: string[];
  fixtureGlobs?: string[];
  resultGlobs?: string[];
  exclude?: string[];
  maxFileBytes?: number;
  maxTestFiles?: number;
  maxFixtureFiles?: number;
  maxResultFiles?: number;
}

const DEFAULT_COVERAGE_GLOBS = [
  '**/coverage/lcov.info',
  '**/lcov*.info',
  '**/coverage/coverage-final.json',
  '**/coverage-final.json',
  '**/coverage/coverage.json',
];
const DEFAULT_TEST_GLOBS = [
  '**/*.{test,spec}.{ts,tsx,js,jsx}',
  '**/__tests__/**/*.{ts,tsx,js,jsx}',
];
const DEFAULT_FIXTURE_GLOBS = ['test/fixtures/**/*', 'tests/fixtures/**/*'];
const DEFAULT_RESULT_GLOBS = [
  '**/junit*.xml',
  '**/test-results*.xml',
  '**/test-results/**/*.xml',
  '**/test-results*.json',
  '**/test-results/**/*.json',
];
const DEFAULT_MAX_BYTES = 512_000;
const DEFAULT_MAX_TEST_FILES = 300;
const DEFAULT_MAX_FIXTURE_FILES = 500;
const DEFAULT_MAX_RESULT_FILES = 200;
const TEST_TAXONOMY: TaxonomyItem[] = [
  'test_coverage_by_module',
  'test_to_code_mapping',
  'flaky_test_history',
  'test_fixtures_golden_files',
  'sample_data_tests',
];

function normalizePath(workspace: string, filePath: string): string {
  const relative = path.relative(workspace, filePath);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replace(/\\/g, '/');
  return filePath.replace(/\\/g, '/');
}

function hashPayload(payload: unknown): string {
  try {
    return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
  } catch {
    return createHash('sha256').update('{}').digest('hex');
  }
}

function parseLcov(content: string, workspace: string): CoverageFileSummary[] {
  const entries: CoverageFileSummary[] = [];
  let current: CoverageFileSummary | null = null;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('SF:')) {
      if (current) entries.push(current);
      const filePath = line.slice(3).trim();
      current = { path: normalizePath(workspace, filePath), linesTotal: 0, linesCovered: 0 };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('LF:')) current.linesTotal = Number.parseInt(line.slice(3).trim(), 10) || 0;
    if (line.startsWith('LH:')) current.linesCovered = Number.parseInt(line.slice(3).trim(), 10) || 0;
    if (line.startsWith('FNF:')) current.functionsTotal = Number.parseInt(line.slice(4).trim(), 10) || 0;
    if (line.startsWith('FNH:')) current.functionsCovered = Number.parseInt(line.slice(4).trim(), 10) || 0;
    if (line.startsWith('BRF:')) current.branchesTotal = Number.parseInt(line.slice(4).trim(), 10) || 0;
    if (line.startsWith('BRH:')) current.branchesCovered = Number.parseInt(line.slice(4).trim(), 10) || 0;
  }
  if (current) entries.push(current);
  return entries;
}

function parseIstanbulJson(data: Record<string, unknown>, workspace: string): CoverageFileSummary[] {
  const entries: CoverageFileSummary[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'total') continue;
    if (!value || typeof value !== 'object') continue;
    const record = value as {
      path?: string;
      l?: Record<string, number>;
      s?: Record<string, number>;
      f?: Record<string, number>;
      b?: Record<string, number[]>;
    };
    const pathValue = typeof record.path === 'string' ? record.path : key;
    const lines = record.l ?? record.s ?? {};
    const lineCounts = Object.values(lines);
    const linesTotal = lineCounts.length;
    const linesCovered = lineCounts.filter((count) => count > 0).length;
    const functionsTotal = record.f ? Object.keys(record.f).length : undefined;
    const functionsCovered = record.f ? Object.values(record.f).filter((count) => count > 0).length : undefined;
    let branchesTotal: number | undefined;
    let branchesCovered: number | undefined;
    if (record.b) {
      let total = 0;
      let covered = 0;
      for (const entry of Object.values(record.b)) {
        total += entry.length;
        covered += entry.filter((count) => count > 0).length;
      }
      branchesTotal = total;
      branchesCovered = covered;
    }
    entries.push({
      path: normalizePath(workspace, pathValue),
      linesTotal,
      linesCovered,
      functionsTotal,
      functionsCovered,
      branchesTotal,
      branchesCovered,
    });
  }
  return entries;
}

function summarizeCoverage(entries: CoverageFileSummary[]): { linesTotal: number; linesCovered: number; coveragePct: number } {
  let linesTotal = 0;
  let linesCovered = 0;
  for (const entry of entries) {
    linesTotal += entry.linesTotal;
    linesCovered += entry.linesCovered;
  }
  const coveragePct = linesTotal ? Math.round((linesCovered / linesTotal) * 1000) / 10 : 0;
  return { linesTotal, linesCovered, coveragePct };
}

function groupCoverageByModule(entries: CoverageFileSummary[]): CoverageModuleSummary[] {
  const modules = new Map<string, { linesTotal: number; linesCovered: number }>();
  for (const entry of entries) {
    const moduleName = entry.path.split('/')[0] || 'root';
    const existing = modules.get(moduleName) ?? { linesTotal: 0, linesCovered: 0 };
    existing.linesTotal += entry.linesTotal;
    existing.linesCovered += entry.linesCovered;
    modules.set(moduleName, existing);
  }
  return Array.from(modules.entries()).map(([module, data]) => ({
    module,
    linesTotal: data.linesTotal,
    linesCovered: data.linesCovered,
    coveragePct: data.linesTotal ? Math.round((data.linesCovered / data.linesTotal) * 1000) / 10 : 0,
  }));
}

function extractImportSpecs(content: string): string[] {
  const specs = new Set<string>();
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match = pattern.exec(content);
    while (match) {
      const spec = match[1];
      if (spec) specs.add(spec);
      match = pattern.exec(content);
    }
  }
  return Array.from(specs);
}

async function resolveSourcePath(
  workspace: string,
  testFile: string,
  spec: string
): Promise<string | null> {
  if (!spec.startsWith('.')) return noResult();

  // Handle ESM imports with .js extension pointing to .ts files
  // e.g., import { foo } from '../../api/query.js' -> ../../api/query.ts
  let normalizedSpec = spec;
  if (spec.endsWith('.js')) {
    normalizedSpec = spec.slice(0, -3);
  } else if (spec.endsWith('.mjs') || spec.endsWith('.cjs')) {
    normalizedSpec = spec.slice(0, -4);
  }

  const base = path.resolve(path.dirname(testFile), normalizedSpec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.json`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (!stats.isFile()) continue;
      const relative = normalizePath(workspace, candidate);
      if (relative.startsWith('..')) continue;
      return relative;
    } catch {
      continue;
    }
  }
  return noResult();
}

async function mapTestsToSources(
  workspace: string,
  files: string[],
  maxFileBytes: number
): Promise<TestMapping[]> {
  const mappings: TestMapping[] = [];
  for (const filePath of files) {
    let content = '';
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > maxFileBytes) continue;
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    const specs = extractImportSpecs(content);
    const sources = new Set<string>();
    for (const spec of specs) {
      const resolved = await resolveSourcePath(workspace, filePath, spec);
      if (resolved) sources.add(resolved);
    }
    if (!sources.size) continue;
    mappings.push({
      testFile: normalizePath(workspace, filePath),
      sourceFiles: Array.from(sources.values()),
    });
  }
  return mappings;
}

async function collectFixtures(
  workspace: string,
  files: string[],
  maxFileBytes: number
): Promise<FixtureEntry[]> {
  const entries: FixtureEntry[] = [];
  for (const filePath of files) {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile() || stats.size > maxFileBytes) continue;
      entries.push({
        path: normalizePath(workspace, filePath),
        sizeBytes: stats.size,
        extension: path.extname(filePath).replace('.', ''),
      });
    } catch {
      continue;
    }
  }
  return entries;
}

function parseJUnit(content: string): Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }> {
  const results: Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }> = [];
  const regex = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  let match = regex.exec(content);
  while (match) {
    const attrText = match[1] ?? '';
    const body = match[2] ?? '';
    const attrs: Record<string, string> = {};
    let attrMatch = /(\w+)="([^"]*)"/g.exec(attrText);
    while (attrMatch) {
      attrs[attrMatch[1] ?? ''] = attrMatch[2] ?? '';
      attrMatch = /(\w+)="([^"]*)"/g.exec(attrText);
    }
    const name = attrs.name ?? 'unknown';
    const classname = attrs.classname ?? '';
    const fullName = classname ? `${classname}::${name}` : name;
    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    if (body.includes('<failure') || body.includes('<error')) status = 'failed';
    else if (body.includes('<skipped')) status = 'skipped';
    results.push({ name: fullName, status });
    match = regex.exec(content);
  }
  return results;
}

function parseJestJson(data: Record<string, unknown>): Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }> {
  const results: Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }> = [];
  const suites = Array.isArray(data.testResults) ? data.testResults as Array<Record<string, unknown>> : [];
  for (const suite of suites) {
    const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults as Array<Record<string, unknown>> : [];
    for (const assertion of assertions) {
      const name = typeof assertion.fullName === 'string'
        ? assertion.fullName
        : typeof assertion.title === 'string'
          ? assertion.title
          : 'unknown';
      const statusRaw = typeof assertion.status === 'string' ? assertion.status : 'passed';
      const status = statusRaw === 'failed' ? 'failed' : statusRaw === 'pending' ? 'skipped' : 'passed';
      results.push({ name, status });
    }
  }
  return results;
}

async function collectFlakyHistory(
  workspace: string,
  files: string[],
  maxFileBytes: number
): Promise<FlakyTestSummary[]> {
  const summary = new Map<string, { runs: number; failures: number; lastStatus: 'passed' | 'failed' | 'skipped'; seenPass: boolean; seenFail: boolean }>();
  for (const filePath of files) {
    let content = '';
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > maxFileBytes) continue;
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    let observations: Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }> = [];
    if (filePath.endsWith('.json')) {
      const parsed = safeJsonParse<Record<string, unknown>>(content);
      observations = parsed.ok ? parseJestJson(parsed.value) : [];
    } else {
      observations = parseJUnit(content);
    }
    for (const obs of observations) {
      const entry = summary.get(obs.name) ?? {
        runs: 0,
        failures: 0,
        lastStatus: 'passed' as const,
        seenPass: false,
        seenFail: false,
      };
      entry.runs += 1;
      entry.lastStatus = obs.status;
      if (obs.status === 'failed') {
        entry.failures += 1;
        entry.seenFail = true;
      }
      if (obs.status === 'passed') entry.seenPass = true;
      summary.set(obs.name, entry);
    }
  }
  return Array.from(summary.entries()).map(([name, entry]) => ({
    name,
    runs: entry.runs,
    failures: entry.failures,
    lastStatus: entry.lastStatus,
    flaky: entry.seenFail && entry.seenPass,
  }));
}

export function createTestIngestionSource(options: TestIngestionOptions = {}): IngestionSource {
  const coverageGlobs = options.coverageGlobs ?? DEFAULT_COVERAGE_GLOBS;
  const testGlobs = options.testGlobs ?? DEFAULT_TEST_GLOBS;
  const fixtureGlobs = options.fixtureGlobs ?? DEFAULT_FIXTURE_GLOBS;
  const resultGlobs = options.resultGlobs ?? DEFAULT_RESULT_GLOBS;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;
  const maxTestFiles = options.maxTestFiles ?? DEFAULT_MAX_TEST_FILES;
  const maxFixtureFiles = options.maxFixtureFiles ?? DEFAULT_MAX_FIXTURE_FILES;
  const maxResultFiles = options.maxResultFiles ?? DEFAULT_MAX_RESULT_FILES;

  return {
    type: 'test',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { coverage?: unknown; mappings?: unknown[] } };
      return Boolean(item.payload?.coverage) && Array.isArray(item.payload?.mappings);
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const errors: string[] = [];
      const items: IngestionItem[] = [];

      const coverageFiles = await glob(coverageGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true });
      const coverageEntries: CoverageFileSummary[] = [];
      for (const filePath of coverageFiles) {
        let content = '';
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileBytes) continue;
          content = await fs.readFile(filePath, 'utf8');
        } catch (error: unknown) {
          errors.push(`Failed to read ${filePath}: ${getErrorMessage(error)}`);
          continue;
        }
        try {
          if (filePath.endsWith('.json')) {
            const parsed = safeJsonParse<Record<string, unknown>>(content);
            if (!parsed.ok) throw new Error(getResultErrorMessage(parsed) || 'invalid JSON');
            coverageEntries.push(...parseIstanbulJson(parsed.value, ctx.workspace));
          } else {
            coverageEntries.push(...parseLcov(content, ctx.workspace));
          }
        } catch (error: unknown) {
          errors.push(`Failed to parse coverage ${filePath}: ${getErrorMessage(error)}`);
        }
      }

      const testFiles = await glob(testGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true });
      const limitedTests = testFiles.slice(0, maxTestFiles);
      const mappings = await mapTestsToSources(ctx.workspace, limitedTests, maxFileBytes);

      const fixtureFiles = await glob(fixtureGlobs, {
        cwd: ctx.workspace,
        ignore: [...exclude, '**/replay_golden/**'],
        absolute: true,
        nodir: true,
      });
      const limitedFixtures = fixtureFiles.slice(0, maxFixtureFiles);
      const fixtures = await collectFixtures(ctx.workspace, limitedFixtures, maxFileBytes);

      const resultFiles = await glob(resultGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true });
      const limitedResults = resultFiles.slice(0, maxResultFiles);
      const flakyHistory = await collectFlakyHistory(ctx.workspace, limitedResults, maxFileBytes);

      const payload = {
        coverage: {
          entries: coverageEntries,
          summary: summarizeCoverage(coverageEntries),
          by_module: groupCoverageByModule(coverageEntries),
          reports: coverageFiles.map((file) => normalizePath(ctx.workspace, file)),
        },
        mappings,
        fixtures,
        flaky_history: {
          tests: flakyHistory,
          total: flakyHistory.length,
          flaky_count: flakyHistory.filter((entry) => entry.flaky).length,
          reports: resultFiles.map((file) => normalizePath(ctx.workspace, file)),
        },
        sources: {
          test_files: limitedTests.map((file) => normalizePath(ctx.workspace, file)),
          fixture_files: limitedFixtures.map((file) => normalizePath(ctx.workspace, file)),
        },
      };

      items.push({
        id: 'test:knowledge',
        sourceType: 'test',
        sourceVersion: 'v1',
        ingestedAt: ctx.now(),
        payload,
        metadata: {
          hash: hashPayload(payload),
          taxonomy: TEST_TAXONOMY,
          coverage_reports: coverageFiles.length,
          test_files: limitedTests.length,
          fixture_files: limitedFixtures.length,
          flaky_tests: flakyHistory.filter((entry) => entry.flaky).length,
        },
      });

      return { items, errors };
    },
  };
}
