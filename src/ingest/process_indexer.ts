import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import YAML from 'yaml';
import { getErrorMessage } from '../utils/errors.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';
import { noResult } from '../api/empty_values.js';
import { safeJsonParse } from '../utils/safe_json.js';

export interface ProcessTemplate { path: string; headings: string[]; checklist: string[]; }
export interface ProcessIngestionOptions { include?: string[]; exclude?: string[]; maxFileBytes?: number; }

const DEFAULT_TEMPLATES = [
  'PULL_REQUEST_TEMPLATE.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/PULL_REQUEST_TEMPLATE/**/*.md',
];
const DEFAULT_BRANCH_RULES = ['.github/branch_protection.yml', '.github/branch_protection.yaml', '.github/branch_protection.json'];
const DEFAULT_MAX_BYTES = 128_000;
const PROCESS_TAXONOMY: TaxonomyItem[] = [
  'review_rules_gates',
  'branching_strategy',
  'release_process',
  'hotfix_process',
  'team_collaboration_context',
];

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) headings.push((match[2] ?? '').trim());
  }
  return headings;
}

function extractChecklist(content: string): string[] {
  const checklist: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^[\-*]\s+\[[ xX]\]\s+(.+)$/);
    if (match) checklist.push((match[1] ?? '').trim());
  }
  return checklist;
}

async function readBranchRules(workspace: string): Promise<Record<string, unknown> | null> {
  for (const fileName of DEFAULT_BRANCH_RULES) {
    const filePath = path.join(workspace, fileName);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      if (fileName.endsWith('.json')) {
        const parsed = safeJsonParse<Record<string, unknown>>(content);
        return parsed.ok ? parsed.value : noResult();
      }
      return YAML.parse(content) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return noResult();
}

export function createProcessIngestionSource(options: ProcessIngestionOptions = {}): IngestionSource {
  const include = options.include ?? DEFAULT_TEMPLATES;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;

  return {
    type: 'process',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { templates?: ProcessTemplate[] } };
      return Array.isArray(item.payload?.templates);
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const files = await glob(include, { cwd: ctx.workspace, ignore: exclude, absolute: true, dot: true });
      const items: IngestionItem[] = [];
      const errors: string[] = [];
      const templates: ProcessTemplate[] = [];

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

        templates.push({
          path: path.relative(ctx.workspace, filePath),
          headings: extractHeadings(content),
          checklist: extractChecklist(content),
        });
      }

      const branchRules = await readBranchRules(ctx.workspace);
      const payload = {
        templates,
        branch_rules: branchRules,
      };

      items.push({
        id: 'process:templates',
        sourceType: 'process',
        sourceVersion: 'v1',
        ingestedAt: ctx.now(),
        payload,
        metadata: {
          taxonomy: PROCESS_TAXONOMY,
        },
      });

      return { items, errors };
    },
  };
}
