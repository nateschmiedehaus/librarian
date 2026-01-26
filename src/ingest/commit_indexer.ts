import { execa } from 'execa';
import { createHash } from 'crypto';
import { GovernorContext, estimateTokenCount } from '../api/governor_context.js';
import { DEFAULT_GOVERNOR_CONFIG } from '../api/governors.js';
import { getErrorMessage } from '../utils/errors.js';
import { logWarning } from '../telemetry/logger.js';
import { resolveLlmServiceAdapter, type LlmServiceAdapter } from '../adapters/llm_service.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';

export interface CommitRecord {
  commitHash: string;
  author: string;
  email?: string;
  timestamp: string;
  message: string;
  filesChanged: string[];
  semanticSummary: string;
  riskScore: number;
}

export interface CommitIngestionOptions {
  exclude?: string[];
  maxCommits?: number;
  maxFilesPerCommit?: number;
  maxSummaryCommits?: number;
  llmProvider?: 'claude' | 'codex';
  llmModelId?: string;
  llmService?: LlmServiceAdapter;
  governorContext?: GovernorContext | null;
}

const DEFAULT_MAX_COMMITS = 50;
const DEFAULT_MAX_FILES_PER_COMMIT = 120;
const DEFAULT_MAX_SUMMARY_COMMITS = 50;
const COMMIT_TAXONOMY: TaxonomyItem[] = ['change_history_for_files', 'rationale_for_changes'];

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

async function isGitRepo(workspace: string): Promise<boolean> {
  try {
    const result = await execa('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: workspace,
      reject: false,
    });
    return result.exitCode === 0 && String(result.stdout).trim() === 'true';
  } catch {
    return false;
  }
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

function parseGitLog(output: string, maxFilesPerCommit: number): Array<{
  hash: string;
  author: string;
  email?: string;
  timestamp: string;
  message: string;
  filesChanged: string[];
}> {
  const entries: Array<{
    hash: string;
    author: string;
    email?: string;
    timestamp: string;
    message: string;
    filesChanged: string[];
  }> = [];

  // Split by record separator that appears at the START of each commit header
  // Format: %x1e%H%x1f%an%x1f%ae%x1f%ad%x1f%s followed by files on subsequent lines
  // Each record looks like: "\nfiles...\n\n" followed by next "HEADER"
  // or for first record: "HEADER" directly
  const records = output.split('\u001e').map((chunk) => chunk.trim()).filter(Boolean);
  for (const record of records) {
    const lines = record.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) continue;

    // The header is ALWAYS the first line after record separator split
    // It contains unit separators (\u001f) between fields: hash, author, email, date, message
    // Do NOT search for it - commit messages could contain \u001f and break parsing
    const header = lines[0];
    if (!header || !header.includes('\u001f')) continue;

    const [hash, author, email, timestamp, message] = header.split('\u001f');
    if (!hash || !author || !timestamp) continue;

    // Files come AFTER the header (lines 1+)
    const fileLines = lines.slice(1);
    const files = Array.from(new Set(fileLines.map(normalizePath))).slice(0, maxFilesPerCommit);

    entries.push({
      hash,
      author,
      email: email || undefined,
      timestamp,
      message: message || '',
      filesChanged: files,
    });
  }

  return entries;
}

function scoreRisk(files: string[], message: string): number {
  if (files.length === 0) return 0;
  const lower = files.map((file) => file.toLowerCase());
  const criticalPrefixes = ['src/', 'lib/', 'services/', 'packages/'];
  const infraPrefixes = ['config/', 'infra/', '.github/', 'ops/', 'deploy/'];
  const dataPrefixes = ['db/', 'schema/', 'migrations/'];
  const testPrefixes = ['test/', 'tests/', '__tests__/'];
  const docPrefixes = ['docs/', 'readme', 'changelog'];

  const hasCritical = lower.some((file) => criticalPrefixes.some((prefix) => file.startsWith(prefix)));
  const hasInfra = lower.some((file) => infraPrefixes.some((prefix) => file.startsWith(prefix)));
  const hasData = lower.some((file) => dataPrefixes.some((prefix) => file.startsWith(prefix)));
  const hasTests = lower.some((file) => testPrefixes.some((prefix) => file.startsWith(prefix)));
  const hasDocsOnly = lower.every((file) => docPrefixes.some((prefix) => file.startsWith(prefix)));

  let score = Math.min(1, files.length / 15);
  if (hasCritical) score += 0.2;
  if (hasInfra) score += 0.15;
  if (hasData) score += 0.2;
  if (hasDocsOnly) score -= 0.2;
  if (hasTests) score -= 0.05;

  const msg = message.toLowerCase();
  if (msg.includes('fix') || msg.includes('bug') || msg.includes('hotfix')) score += 0.1;
  if (msg.includes('refactor') || msg.includes('cleanup')) score += 0.05;
  if (msg.includes('security') || msg.includes('auth')) score += 0.15;

  return Math.max(0, Math.min(1, score));
}

function hashPayload(payload: unknown): string {
  try {
    return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
  } catch {
    return createHash('sha256').update('{}').digest('hex');
  }
}

/**
 * Heuristic categorization of commit messages based on conventional commit patterns.
 * Used as fallback when LLM is unavailable.
 *
 * @param message - The commit message to categorize
 * @returns Category string (bugfix, feature, refactor, test, docs, chore, other)
 */
export function categorizeFromMessage(message: string): string {
  // Validate input type and handle null/undefined
  if (!message || typeof message !== 'string') {
    return 'other';
  }

  const lower = message.toLowerCase();
  const firstLine = lower.split('\n')[0] || '';

  // Check conventional commit prefixes first
  if (/^(fix|bugfix|hotfix)[\s:(]/.test(firstLine)) return 'bugfix';
  if (/^(feat|feature|add)[\s:(]/.test(firstLine)) return 'feature';
  if (/^(refactor|cleanup|clean)[\s:(]/.test(firstLine)) return 'refactor';
  if (/^(test|tests|spec)[\s:(]/.test(firstLine)) return 'test';
  if (/^(docs|doc|readme)[\s:(]/.test(firstLine)) return 'docs';
  if (/^(chore|build|ci|deps|bump)[\s:(]/.test(firstLine)) return 'chore';
  if (/^(perf|performance|optimize)[\s:(]/.test(firstLine)) return 'perf';
  if (/^(style|format|lint)[\s:(]/.test(firstLine)) return 'style';
  if (/^(revert)[\s:(]/.test(firstLine)) return 'revert';

  // Check for keywords anywhere in the message
  if (/\b(fix|bug|issue|resolve|patch)\b/.test(lower)) return 'bugfix';
  if (/\b(feat|feature|implement|add|new)\b/.test(lower)) return 'feature';
  if (/\b(refactor|restructure|reorganize|simplify)\b/.test(lower)) return 'refactor';
  if (/\b(test|spec|coverage)\b/.test(lower)) return 'test';
  if (/\b(doc|docs|documentation|readme|comment)\b/.test(lower)) return 'docs';

  return 'other';
}

class CommitSummarizer {
  private readonly llm: LlmServiceAdapter | null;
  private readonly provider: 'claude' | 'codex' | null;
  private readonly modelId: string | null;
  private readonly governor: GovernorContext | null;

  constructor(options: CommitIngestionOptions) {
    this.provider = options.llmProvider ?? null;
    this.modelId = options.llmModelId ?? null;
    const canUseLlm = Boolean(this.provider && this.modelId);
    this.llm = canUseLlm ? resolveLlmServiceAdapter(options.llmService ?? null) : null;
    this.governor = options.governorContext ?? (canUseLlm ? new GovernorContext({
      phase: 'commit_ingestion',
      config: DEFAULT_GOVERNOR_CONFIG,
    }) : null);
  }

  /**
   * Generate a heuristic summary when LLM is unavailable.
   * Format: "category: first line of message"
   */
  private generateHeuristicSummary(commit: { message: string; filesChanged: string[] }): string {
    const category = categorizeFromMessage(commit.message);
    const firstLine = (commit.message || '').split('\n')[0]?.trim() || '';
    if (firstLine) {
      return `${category}: ${firstLine}`;
    }
    return `${category}: Updated ${commit.filesChanged.slice(0, 3).join(', ')}`;
  }

  async summarize(commit: { message: string; filesChanged: string[] }): Promise<string> {
    // If LLM is not configured, use heuristic fallback (LLM-optional mode)
    if (!this.llm || !this.provider || !this.modelId) {
      return this.generateHeuristicSummary(commit);
    }

    const fileList = commit.filesChanged.slice(0, 12).join(', ') || 'none';
    const prompt = [
      'Summarize this commit in one sentence. Focus on the intent and impact.',
      `Message: ${commit.message || 'No message'}`,
      `Files: ${fileList}`,
    ].join('\n');

    try {
      this.governor?.checkBudget();
      this.governor?.recordTokens(estimateTokenCount(prompt));

      const response = await this.llm.chat({
        provider: this.provider,
        modelId: this.modelId,
        messages: [
          { role: 'system', content: 'You summarize git commits for a knowledge index.' },
          { role: 'user', content: prompt },
        ],
        governorContext: this.governor ?? undefined,
      });

      const summary = typeof response.content === 'string' ? response.content.trim() : '';
      return summary || this.generateHeuristicSummary(commit);
    } catch (error: unknown) {
      // On LLM error, log the issue and fall back to heuristic summary
      const message = getErrorMessage(error);
      logWarning(`Falling back to heuristic summary due to LLM error: ${message}`, {
        commit: commit.message.slice(0, 100),
        provider: this.provider,
        modelId: this.modelId,
      });
      return this.generateHeuristicSummary(commit);
    }
  }
}

export function createCommitIngestionSource(options: CommitIngestionOptions = {}): IngestionSource {
  const exclude = options.exclude ?? [];
  const maxCommits = options.maxCommits ?? DEFAULT_MAX_COMMITS;
  const maxFilesPerCommit = options.maxFilesPerCommit ?? DEFAULT_MAX_FILES_PER_COMMIT;
  const maxSummaryCommits = options.maxSummaryCommits ?? DEFAULT_MAX_SUMMARY_COMMITS;
  const excludeMatchers = buildExcludeMatchers(exclude);

  return {
    type: 'commit',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { commitHash?: string; filesChanged?: string[] } };
      return typeof item.payload?.commitHash === 'string' && Array.isArray(item.payload?.filesChanged);
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      if (maxCommits <= 0) return { items: [], errors: [] };
      const errors: string[] = [];
      const items: IngestionItem[] = [];
      const gitRepo = await isGitRepo(ctx.workspace);
      if (!gitRepo) {
        return { items, errors };
      }
      const summarizer = new CommitSummarizer(options);

      const gitArgs = [
        'log',
        '--name-only',
        '--pretty=format:\u001e%H\u001f%an\u001f%ae\u001f%ad\u001f%s',
        '--date=iso-strict',
        '-n',
        String(maxCommits),
        '--',
        '.',
      ];

      const result = await execa('git', gitArgs, {
        cwd: ctx.workspace,
        reject: false,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (result.exitCode !== 0) {
        errors.push(`git log failed: ${result.stderr || result.stdout || 'unknown error'}`);
        return { items, errors };
      }

      const commits = parseGitLog(result.stdout, maxFilesPerCommit);
      for (let index = 0; index < commits.length; index += 1) {
        const commit = commits[index]!;
        const filteredFiles = commit.filesChanged.filter((file) => !isExcluded(file, excludeMatchers));
        if (filteredFiles.length === 0) continue;
        let summary = commit.message || '';
        if (index < maxSummaryCommits) {
          // summarize() uses LLM if available, otherwise falls back to heuristic categorization
          summary = await summarizer.summarize({ message: commit.message, filesChanged: filteredFiles });
        }

        const payload: CommitRecord = {
          commitHash: commit.hash,
          author: commit.author,
          email: commit.email,
          timestamp: commit.timestamp,
          message: commit.message,
          filesChanged: filteredFiles,
          semanticSummary: summary || commit.message || 'No summary available',
          riskScore: scoreRisk(filteredFiles, commit.message),
        };

        items.push({
          id: `commit:${commit.hash}`,
          sourceType: 'commit',
          sourceVersion: 'v1',
          ingestedAt: ctx.now(),
          payload,
          metadata: {
            hash: hashPayload(payload),
            taxonomy: COMMIT_TAXONOMY,
            file_count: filteredFiles.length,
            risk_score: payload.riskScore,
          },
        });
      }

      return { items, errors };
    },
  };
}
