import { execa } from 'execa';
import { createHash } from 'crypto';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';

export interface OwnershipRecord {
  path: string;
  primaryOwner: string;
  contributors: string[];
  lastTouchedBy: string;
  lastTouchedAt: string;
  expertiseScore: Record<string, number>;
  commitCount: number;
}

export interface OwnershipIngestionOptions {
  exclude?: string[];
  maxCommits?: number;
  maxFilesPerCommit?: number;
  maxFiles?: number;
}

const DEFAULT_MAX_COMMITS = 150;
const DEFAULT_MAX_FILES_PER_COMMIT = 200;
const DEFAULT_MAX_FILES = 2000;
const OWNERSHIP_TAXONOMY: TaxonomyItem[] = ['code_ownership', 'team_collaboration_context'];

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

function compileGlob(pattern: string): RegExp | null {
  let normalized = pattern.trim();
  if (!normalized || normalized.startsWith('#')) return null;
  if (normalized.startsWith('!')) normalized = normalized.slice(1);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  const withPlaceholders = normalized
    .replace(/\\/g, '/')
    .replace(/\*\*/g, '__GLOBSTAR__')
    .replace(/\*/g, '__STAR__')
    .replace(/\?/g, '__QMARK__');
  const escaped = withPlaceholders.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const expanded = escaped
    .replace(/__GLOBSTAR__/g, '.*')
    .replace(/__STAR__/g, '[^/]*')
    .replace(/__QMARK__/g, '[^/]');
  return new RegExp(`^${expanded}$`);
}

function buildExcludeMatchers(patterns: string[]): RegExp[] {
  const matchers: RegExp[] = [];
  for (const pattern of patterns) {
    const matcher = compileGlob(pattern);
    if (matcher) matchers.push(matcher);
  }
  return matchers;
}

function isExcluded(pathname: string, matchers: RegExp[]): boolean {
  return matchers.some((matcher) => matcher.test(pathname));
}

function hashPayload(payload: unknown): string {
  try {
    return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
  } catch {
    return createHash('sha256').update('{}').digest('hex');
  }
}

export function createOwnershipIngestionSource(options: OwnershipIngestionOptions = {}): IngestionSource {
  const exclude = options.exclude ?? [];
  const maxCommits = options.maxCommits ?? DEFAULT_MAX_COMMITS;
  const maxFilesPerCommit = options.maxFilesPerCommit ?? DEFAULT_MAX_FILES_PER_COMMIT;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const excludeMatchers = buildExcludeMatchers(exclude);

  return {
    type: 'ownership',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { path?: string; primaryOwner?: string } };
      return typeof item.payload?.path === 'string' && typeof item.payload?.primaryOwner === 'string';
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      if (maxCommits <= 0) return { items: [], errors: [] };
      const errors: string[] = [];
      const items: IngestionItem[] = [];

      const gitArgs = [
        'log',
        '--name-only',
        '--pretty=format:\u001e%H\u001f%an\u001f%ae\u001f%ad',
        '--date=iso-strict',
        '-n',
        String(maxCommits),
      ];

      const result = await execa('git', gitArgs, {
        cwd: ctx.workspace,
        reject: false,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (result.exitCode !== 0) {
        const rawError = `${result.stderr || result.stdout || ''}`.trim();
        const normalized = rawError.toLowerCase();
        const notRepo =
          normalized.includes('not a git repository') ||
          normalized.includes('not a git repository (or any of the parent directories)') ||
          normalized.includes('this operation must be run in a work tree');
        if (!notRepo) {
          errors.push(`git log failed: ${rawError || 'unknown error'}`);
        }
        return { items, errors };
      }

      const records = result.stdout.split('\u001e').map((chunk) => chunk.trim()).filter(Boolean);
      const ownership = new Map<string, Map<string, number>>();
      const lastTouchedBy = new Map<string, { author: string; timestamp: string }>();

      for (const record of records) {
        const lines = record.split(/\r?\n/).filter((line) => line.trim().length > 0);

        // Find the header line - it contains unit separators (commit metadata)
        let headerIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]!.includes('\u001f')) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) continue;

        const header = lines[headerIdx];
        if (!header) continue;
        const [, author, , timestamp] = header.split('\u001f');
        if (!author || !timestamp) continue;

        // Files come AFTER the header
        const fileLines = lines.slice(headerIdx + 1);
        const files = Array.from(new Set(fileLines.map(normalizePath))).slice(0, maxFilesPerCommit);
        for (const file of files) {
          if (isExcluded(file, excludeMatchers)) continue;
          if (!lastTouchedBy.has(file)) {
            lastTouchedBy.set(file, { author, timestamp });
          }
          const authorCounts = ownership.get(file) ?? new Map<string, number>();
          authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
          ownership.set(file, authorCounts);
        }
      }

      for (const [file, authorCounts] of ownership.entries()) {
        if (items.length >= maxFiles) break;
        const total = Array.from(authorCounts.values()).reduce((sum, count) => sum + count, 0);
        const sorted = Array.from(authorCounts.entries()).sort((a, b) => b[1] - a[1]);
        const primaryOwner = sorted[0]?.[0] ?? 'unknown';
        const contributors = sorted.map(([author]) => author).slice(0, 6);
        const expertiseScore: Record<string, number> = {};
        for (const [author, count] of sorted) {
          expertiseScore[author] = total ? Math.round((count / total) * 1000) / 1000 : 0;
        }
        const lastTouched = lastTouchedBy.get(file) ?? { author: primaryOwner, timestamp: ctx.now() };
        const payload: OwnershipRecord = {
          path: file,
          primaryOwner,
          contributors,
          lastTouchedBy: lastTouched.author,
          lastTouchedAt: lastTouched.timestamp,
          expertiseScore,
          commitCount: total,
        };

        items.push({
          id: `ownership:${file}`,
          sourceType: 'ownership',
          sourceVersion: 'v1',
          ingestedAt: ctx.now(),
          payload,
          metadata: {
            hash: hashPayload(payload),
            taxonomy: OWNERSHIP_TAXONOMY,
            commit_count: total,
          },
        });
      }

      return { items, errors };
    },
  };
}
