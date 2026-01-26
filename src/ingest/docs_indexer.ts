import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { GovernorContext } from '../api/governor_context.js';
import { DEFAULT_GOVERNOR_CONFIG } from '../api/governors.js';
import { ProviderUnavailableError } from '../api/provider_check.js';
import { getErrorMessage } from '../utils/errors.js';
import { resolveLlmServiceAdapter, type LlmServiceAdapter } from '../adapters/llm_service.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';

export interface DocHeading { level: number; text: string; line: number; }
export interface DocLink { text: string; url: string; line: number; }
export interface DocCodeBlock { language: string | null; content: string; lineStart: number; lineEnd: number; }
export interface DocGraphNode { id: string; type: 'file' | 'heading' | 'link'; label: string; }
export interface DocGraphEdge { source: string; target: string; relation: 'contains' | 'links_to'; }
export interface DocParseResult {
  headings: DocHeading[];
  links: DocLink[];
  codeBlocks: DocCodeBlock[];
  wordCount: number;
}

export interface DocsIngestionOptions {
  include?: string[];
  exclude?: string[];
  llmProvider?: 'claude' | 'codex';
  llmModelId?: string;
  llmService?: LlmServiceAdapter;
  governorContext?: GovernorContext | null;
  maxFileBytes?: number;
}

const DEFAULT_DOC_GLOBS = ['**/*.md', '**/*.mdx'];
const DEFAULT_MAX_BYTES = 512_000;
const DOC_TAXONOMY: TaxonomyItem[] = [
  'decision_records_linkage',
  'rationale_for_changes',
  'todos_debt_hotspots',
  'incident_runbooks',
  'observability_dashboards',
  'alerting_rules',
  'slo_sla_definitions',
  'doc_freshness_coverage',
  'code_to_doc_linkage',
];

export function parseMarkdown(content: string): DocParseResult {
  const headings: DocHeading[] = [];
  const links: DocLink[] = [];
  const codeBlocks: DocCodeBlock[] = [];
  const lines = content.split(/\r?\n/);
  let inFence = false;
  let fenceMarker = '';
  let fenceLang: string | null = null;
  let fenceStart = 0;
  let fenceLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? '';

    const fenceMatch = line.match(/^(```|~~~)\s*(\w+)?\s*$/);
    if (!inFence && fenceMatch) {
      inFence = true;
      fenceMarker = fenceMatch[1] ?? '```';
      fenceLang = fenceMatch[2] ?? null;
      fenceStart = lineNumber + 1;
      fenceLines = [];
      continue;
    }

    if (inFence) {
      if (line.startsWith(fenceMarker)) {
        codeBlocks.push({
          language: fenceLang,
          content: fenceLines.join('\n'),
          lineStart: fenceStart,
          lineEnd: lineNumber - 1,
        });
        inFence = false;
        fenceMarker = '';
        fenceLang = null;
        continue;
      }
      fenceLines.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      headings.push({
        level: headingMatch[1]?.length ?? 1,
        text: (headingMatch[2] ?? '').trim(),
        line: lineNumber,
      });
    }

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let linkMatch: RegExpExecArray | null = linkRegex.exec(line);
    while (linkMatch) {
      links.push({ text: linkMatch[1] ?? '', url: linkMatch[2] ?? '', line: lineNumber });
      linkMatch = linkRegex.exec(line);
    }
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return { headings, links, codeBlocks, wordCount };
}

function buildDocGraph(relativePath: string, parse: DocParseResult): { nodes: DocGraphNode[]; edges: DocGraphEdge[] } {
  const nodes: DocGraphNode[] = [];
  const edges: DocGraphEdge[] = [];
  const fileId = `file:${relativePath}`;
  nodes.push({ id: fileId, type: 'file', label: relativePath });

  parse.headings.forEach((heading, index) => {
    const nodeId = `heading:${relativePath}:${index}`;
    nodes.push({ id: nodeId, type: 'heading', label: heading.text });
    edges.push({ source: fileId, target: nodeId, relation: 'contains' });
  });

  const linkNodes = new Map<string, string>();
  for (const link of parse.links) {
    const key = link.url || link.text;
    if (!key) continue;
    let nodeId = linkNodes.get(key);
    if (!nodeId) {
      nodeId = `link:${key}`;
      linkNodes.set(key, nodeId);
      nodes.push({ id: nodeId, type: 'link', label: key });
    }
    edges.push({ source: fileId, target: nodeId, relation: 'links_to' });
  }

  return { nodes, edges };
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function makeFallbackSummary(relativePath: string, parse: DocParseResult, content: string): string {
  if (parse.headings[0]?.text) return `Doc: ${parse.headings[0].text}`;
  const snippet = content.replace(/\s+/g, ' ').trim();
  if (!snippet) return `Doc: ${relativePath}`;
  return snippet.slice(0, 160);
}

class DocSummarizer {
  private readonly llm: LlmServiceAdapter | null;
  private readonly provider: 'claude' | 'codex' | null;
  private readonly modelId: string | null;
  private readonly governor: GovernorContext | null;

  constructor(options: DocsIngestionOptions) {
    this.provider = options.llmProvider ?? null;
    this.modelId = options.llmModelId ?? null;
    const canUseLlm = Boolean(this.provider && this.modelId);
    this.llm = canUseLlm ? resolveLlmServiceAdapter(options.llmService ?? null) : null;
    this.governor = options.governorContext ?? (canUseLlm ? new GovernorContext({
      phase: 'docs_ingestion',
      config: DEFAULT_GOVERNOR_CONFIG,
    }) : null);
  }

  async summarize(relativePath: string, parse: DocParseResult, content: string): Promise<string> {
    const fallback = makeFallbackSummary(relativePath, parse, content);
    if (!this.llm || !this.provider || !this.modelId) {
      // LLM is REQUIRED - no bypass allowed
      throw new ProviderUnavailableError({
        message: 'unverified_by_trace(provider_unavailable): Docs indexer requires live LLM providers. There is no non-agentic mode.',
        missing: ['docs_indexer_llm_not_configured'],
        suggestion: 'Authenticate via CLI (Claude: `claude setup-token` or run `claude`; Codex: `codex login`) and set LLM provider/model env vars. LLM providers are mandatory.',
      });
    }

    try {
      this.governor?.checkBudget();
    } catch (error: unknown) {
      if (isBudgetExceeded(error)) throw error;
      throw error;
    }

    const prompt = [
      `Summarize the documentation file ${relativePath} in 1-2 sentences.`,
      'Keep the summary grounded in the headings and content.',
      '',
      `Headings: ${parse.headings.map((heading) => heading.text).join(' | ') || 'none'}`,
      '',
      content.slice(0, 1800),
    ].join('\n');

    try {
      const response = await this.llm.chat({
        provider: this.provider,
        modelId: this.modelId,
        messages: [
          { role: 'system', content: 'You summarize documentation for a knowledge index.' },
          { role: 'user', content: prompt },
        ],
        governorContext: this.governor ?? undefined,
      });
      const cleaned = String(response.content ?? '').replace(/\s+/g, ' ').trim();
      if (!cleaned) return fallback;
      return cleaned.length <= 400 ? cleaned : cleaned.slice(0, 400).trim();
    } catch (error: unknown) {
      if (isBudgetExceeded(error)) throw error;
      // LLM errors must propagate - no graceful degradation
      const message = getErrorMessage(error);
      if (message.includes('provider_unavailable') || message.includes('No LLM providers available')) {
        throw new ProviderUnavailableError({
          message: 'unverified_by_trace(provider_unavailable): Docs indexer requires live LLM providers. There is no non-agentic mode.',
          missing: [message],
          suggestion: 'Authenticate via CLI (Claude: `claude setup-token` or run `claude`; Codex: `codex login`). LLM providers are mandatory.',
        });
      }
      throw error instanceof Error ? error : new Error(message);
    }
  }
}

function isBudgetExceeded(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('unverified_by_trace(budget_exhausted)');
}

export function createDocsIngestionSource(options: DocsIngestionOptions = {}): IngestionSource {
  const include = options.include ?? DEFAULT_DOC_GLOBS;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;
  const summarizer = new DocSummarizer(options);

  return {
    type: 'docs',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { path?: string; summary?: string } };
      return typeof item.payload?.path === 'string' && typeof item.payload?.summary === 'string';
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const files = await glob(include, { cwd: ctx.workspace, ignore: exclude, absolute: true });
      const items: IngestionItem[] = [];
      const errors: string[] = [];

      for (const filePath of files) {
        options.governorContext?.enterFile(filePath);
        let content: string;
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileBytes) continue;
          content = await fs.readFile(filePath, 'utf8');
        } catch (error: unknown) {
          errors.push(`Failed to read ${filePath}: ${getErrorMessage(error)}`);
          continue;
        }

        const parse = parseMarkdown(content);
        const relativePath = path.relative(ctx.workspace, filePath);
        const summary = await summarizer.summarize(relativePath, parse, content);
        const graph = buildDocGraph(relativePath, parse);
        const payload = {
          path: relativePath,
          summary,
          headings: parse.headings,
          links: parse.links,
          code_blocks: parse.codeBlocks,
          graph,
        };

        items.push({
          id: `doc:${relativePath}`,
          sourceType: 'docs',
          sourceVersion: 'v1',
          ingestedAt: ctx.now(),
          payload,
          metadata: {
            hash: hashContent(content),
            word_count: parse.wordCount,
            taxonomy: DOC_TAXONOMY,
          },
        });
      }

      return { items, errors };
    },
  };
}
