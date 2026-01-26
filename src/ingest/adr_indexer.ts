import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { getErrorMessage } from '../utils/errors.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';

export interface AdrRecord {
  path: string;
  title: string;
  status: string | null;
  context: string;
  decision: string;
  consequences: string;
  relatedFiles: string[];
  links: string[];
  summary: string;
}

export interface AdrIngestionOptions {
  include?: string[];
  exclude?: string[];
  maxFileBytes?: number;
}

const DEFAULT_ADR_GLOBS = [
  '**/adr/**/*.md',
  '**/adrs/**/*.md',
  '**/decisions/**/*.md',
  'docs/adr/**/*.md',
  'docs/decisions/**/*.md',
];
const DEFAULT_MAX_BYTES = 512_000;
const ADR_TAXONOMY: TaxonomyItem[] = ['decision_records_linkage', 'rationale_for_changes', 'architecture_layer_boundaries'];

function normalizePath(workspace: string, filePath: string): string {
  const relative = path.relative(workspace, filePath);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replace(/\\/g, '/');
  return filePath.replace(/\\/g, '/');
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function extractLinks(line: string): string[] {
  const links: string[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match = regex.exec(line);
  while (match) {
    if (match[2]) links.push(match[2]);
    match = regex.exec(line);
  }
  return links;
}

function extractFilePaths(text: string): string[] {
  const results = new Set<string>();
  const regex = /\b(?:src|lib|packages|apps|services|docs|config|infra|scripts|test|tests)[^\s)"']+\.(?:ts|tsx|js|jsx|json|yml|yaml|md|sql|prisma|go|rs|py|java|kt|rb|cs|cpp|c|h)\b/g;
  let match = regex.exec(text);
  while (match) {
    results.add(match[0]);
    match = regex.exec(text);
  }
  return Array.from(results.values());
}

function parseAdr(content: string): Omit<AdrRecord, 'path'> {
  const lines = content.split(/\r?\n/);
  let title = '';
  let status: string | null = null;
  const sections: Record<string, string[]> = { context: [], decision: [], consequences: [] };
  let currentSection: keyof typeof sections | null = null;
  const links: string[] = [];

  for (const line of lines) {
    if (!title) {
      const titleMatch = /^#\s+(.+)$/.exec(line.trim());
      if (titleMatch) {
        title = titleMatch[1]?.trim() ?? '';
      }
    }

    const statusMatch = /^status\s*:\s*(.+)$/i.exec(line.trim());
    if (statusMatch) {
      status = statusMatch[1]?.trim() ?? null;
    }

    const headingMatch = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      const heading = (headingMatch[2] ?? '').toLowerCase();
      if (heading.includes('context')) currentSection = 'context';
      else if (heading.includes('decision')) currentSection = 'decision';
      else if (heading.includes('consequence')) currentSection = 'consequences';
      else currentSection = null;
      continue;
    }

    links.push(...extractLinks(line));

    if (currentSection) {
      sections[currentSection].push(line.trim());
    }
  }

  const context = sections.context.join(' ').trim();
  const decision = sections.decision.join(' ').trim();
  const consequences = sections.consequences.join(' ').trim();
  const summary = decision || context || title || 'ADR recorded.';
  const relatedFiles = extractFilePaths(content);

  return {
    title: title || 'Untitled ADR',
    status,
    context,
    decision,
    consequences,
    relatedFiles,
    links,
    summary,
  };
}

export function createAdrIngestionSource(options: AdrIngestionOptions = {}): IngestionSource {
  const include = options.include ?? DEFAULT_ADR_GLOBS;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;

  return {
    type: 'adr',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { title?: string; path?: string } };
      return typeof item.payload?.title === 'string' && typeof item.payload?.path === 'string';
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const files = await glob(include, { cwd: ctx.workspace, ignore: exclude, absolute: true, nodir: true });
      const items: IngestionItem[] = [];
      const errors: string[] = [];

      for (const filePath of files) {
        let content = '';
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileBytes) continue;
          content = await fs.readFile(filePath, 'utf8');
        } catch (error: unknown) {
          errors.push(`Failed to read ADR ${filePath}: ${getErrorMessage(error)}`);
          continue;
        }

        const relativePath = normalizePath(ctx.workspace, filePath);
        const parsed = parseAdr(content);
        const payload: AdrRecord = {
          ...parsed,
          path: relativePath,
        };

        items.push({
          id: `adr:${relativePath}`,
          sourceType: 'adr',
          sourceVersion: 'v1',
          ingestedAt: ctx.now(),
          payload,
          metadata: {
            hash: hashContent(content),
            taxonomy: ADR_TAXONOMY,
            status: parsed.status ?? 'unknown',
            related_files: parsed.relatedFiles.length,
          },
        });
      }

      return { items, errors };
    },
  };
}
