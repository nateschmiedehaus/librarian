import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { getErrorMessage } from '../utils/errors.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';

export interface CodeownerEntry { pattern: string; owners: string[]; }
export interface TeamIngestionOptions { include?: string[]; exclude?: string[]; maxFileBytes?: number; }

const DEFAULT_CODEOWNERS = ['CODEOWNERS', '.github/CODEOWNERS', '.gitlab/CODEOWNERS'];
const DEFAULT_MAX_BYTES = 128_000;
const TEAM_TAXONOMY: TaxonomyItem[] = ['code_ownership', 'directory_purpose_ownership', 'team_collaboration_context'];

export function parseCodeowners(content: string): CodeownerEntry[] {
  const entries: CodeownerEntry[] = [];
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const line = trimmed.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const pattern = parts[0] ?? '';
    const owners = parts.slice(1);
    if (pattern && owners.length) entries.push({ pattern, owners });
  }
  return entries;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function buildOwnerMap(entries: CodeownerEntry[]): Record<string, string[]> {
  const owners: Record<string, string[]> = {};
  for (const entry of entries) {
    for (const owner of entry.owners) {
      if (!owners[owner]) owners[owner] = [];
      owners[owner]?.push(entry.pattern);
    }
  }
  return owners;
}

export function createTeamIngestionSource(options: TeamIngestionOptions = {}): IngestionSource {
  const include = options.include ?? DEFAULT_CODEOWNERS;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;

  return {
    type: 'team',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { path?: string; entries?: CodeownerEntry[] } };
      return typeof item.payload?.path === 'string' && Array.isArray(item.payload?.entries);
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const files = await glob(include, { cwd: ctx.workspace, ignore: exclude, absolute: true, dot: true });
      const items: IngestionItem[] = [];
      const errors: string[] = [];

      for (const filePath of files) {
        let content = '';
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileBytes) continue;
          content = await fs.readFile(filePath, 'utf8');
        } catch (error: unknown) {
          errors.push(`Failed to read ${filePath}: ${getErrorMessage(error)}`);
          continue;
        }

        const entries = parseCodeowners(content);
        const relativePath = path.relative(ctx.workspace, filePath);
        const payload = {
          path: relativePath,
          entries,
          owners: buildOwnerMap(entries),
        };

        items.push({
          id: `team:${relativePath}`,
          sourceType: 'team',
          sourceVersion: 'v1',
          ingestedAt: ctx.now(),
          payload,
          metadata: {
            hash: hashContent(content),
            taxonomy: TEAM_TAXONOMY,
          },
        });
      }

      return { items, errors };
    },
  };
}
