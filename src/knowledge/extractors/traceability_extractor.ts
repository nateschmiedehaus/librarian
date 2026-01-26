/**
 * @fileoverview Traceability Knowledge Extractor
 *
 * Links code entities to external artifacts:
 * - Requirements (from specs, comments, docs)
 * - User stories (from issue trackers)
 * - Issues (GitHub/Jira references in commits/comments)
 * - Incidents (from incident tracking systems)
 * - Deployments (from CI/CD metadata)
 * - Documentation (from docs linking to code)
 *
 * This extractor answers: "What external artifacts relate to this code?"
 * Critical for impact analysis, audit trails, and understanding context.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type {
  EntityTraceability,
  RequirementLink,
  RequirementStatus,
  UserStoryLink,
  IssueLink,
  IssueType,
  IncidentLink,
  DeploymentLink,
  DocLink,
  DocType,
} from '../universal_types.js';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface TraceabilityExtraction {
  traceability: EntityTraceability;
  confidence: number;
}

export interface TraceabilityInput {
  filePath: string;
  relativePath: string;
  workspaceRoot: string;
  content?: string;
  entityName?: string;

  // Pre-indexed data
  commits?: CommitReference[];
  documentation?: DocReference[];
  ciConfig?: CIConfig;
}

export interface CommitReference {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged?: string[];
}

export interface DocReference {
  path: string;
  title: string;
  content: string;
  links: Array<{ text: string; url: string }>;
}

export interface CIConfig {
  environments?: string[];
  deploymentStages?: string[];
  triggers?: string[];
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

// Issue tracker patterns (GitHub, Jira, Linear, etc.)
const ISSUE_PATTERNS: Array<{
  pattern: RegExp;
  platform: string;
  extractId: (match: RegExpMatchArray) => string;
  extractTitle?: (match: RegExpMatchArray) => string;
}> = [
  // GitHub issues: #123, GH-123, github.com/org/repo/issues/123
  {
    pattern: /(?:^|\s)#(\d{1,6})(?:\s|$|[.,!?])/g,
    platform: 'GitHub',
    extractId: (m) => `#${m[1]}`,
  },
  {
    pattern: /(?:GH|gh)-(\d{1,6})/g,
    platform: 'GitHub',
    extractId: (m) => `GH-${m[1]}`,
  },
  {
    pattern: /github\.com\/[\w-]+\/[\w-]+\/issues\/(\d+)/g,
    platform: 'GitHub',
    extractId: (m) => `#${m[1]}`,
  },
  // Jira: PROJ-123, [PROJ-123]
  {
    pattern: /\[?([A-Z]{2,10})-(\d{1,6})\]?/g,
    platform: 'Jira',
    extractId: (m) => `${m[1]}-${m[2]}`,
  },
  // Linear: LIN-123, ENG-123
  {
    pattern: /\b(LIN|ENG|FEAT|BUG)-(\d{1,6})\b/g,
    platform: 'Linear',
    extractId: (m) => `${m[1]}-${m[2]}`,
  },
];

// Requirement patterns
const REQUIREMENT_PATTERNS: Array<{
  pattern: RegExp;
  extractId: (match: RegExpMatchArray) => string;
  extractDescription: (match: RegExpMatchArray) => string;
}> = [
  // REQ-123, REQUIREMENT-123
  {
    pattern: /(?:REQ|REQUIREMENT|SPEC)-(\d+)(?:\s*:\s*(.+?))?(?:\n|$)/gi,
    extractId: (m) => `REQ-${m[1]}`,
    extractDescription: (m) => m[2] ?? 'Referenced requirement',
  },
  // @requirement annotation
  {
    pattern: /@requirement\s+(\S+)(?:\s+(.+?))?(?:\n|@|$)/gi,
    extractId: (m) => m[1] ?? 'unknown',
    extractDescription: (m) => m[2] ?? 'Referenced requirement',
  },
  // "implements requirement" pattern
  {
    pattern: /implements?\s+(?:requirement\s+)?([A-Z0-9-]+)(?:\s*[-:]\s*(.+?))?(?:\n|$)/gi,
    extractId: (m) => m[1] ?? 'unknown',
    extractDescription: (m) => m[2] ?? 'Implemented requirement',
  },
];

// User story patterns
const USER_STORY_PATTERNS: Array<{
  pattern: RegExp;
  extractId: (match: RegExpMatchArray) => string;
  extractTitle: (match: RegExpMatchArray) => string;
}> = [
  // US-123, USER-STORY-123
  {
    pattern: /(?:US|USER[-_]?STORY)-(\d+)(?:\s*:\s*(.+?))?(?:\n|$)/gi,
    extractId: (m) => `US-${m[1]}`,
    extractTitle: (m) => m[2] ?? 'Referenced user story',
  },
  // @story annotation
  {
    pattern: /@(?:user[-_]?)?story\s+(\S+)(?:\s+(.+?))?(?:\n|@|$)/gi,
    extractId: (m) => m[1] ?? 'unknown',
    extractTitle: (m) => m[2] ?? 'Referenced user story',
  },
  // "As a [user], I want [action]" pattern
  {
    pattern: /as\s+(?:a|an)\s+(\w+),?\s+I\s+want\s+(?:to\s+)?(.+?)(?:so\s+that|$)/gi,
    extractId: (m) => `AS-${m[1]?.toUpperCase().slice(0, 4) ?? 'USER'}`,
    extractTitle: (m) => m[2]?.trim() ?? 'Inline user story',
  },
];

// Incident patterns
const INCIDENT_PATTERNS: Array<{
  pattern: RegExp;
  extractId: (match: RegExpMatchArray) => string;
  severity: string | ((match: RegExpMatchArray) => string);
}> = [
  // INC-123, INCIDENT-123
  {
    pattern: /(?:INC|INCIDENT)-(\d+)/gi,
    extractId: (m) => `INC-${m[1]}`,
    severity: 'medium',
  },
  // SEV1, SEV-1, P0, P1
  {
    pattern: /(?:SEV|P)[-_]?([0-3])\s*(?:incident|issue)?(?:\s*[-:]\s*(.+?))?(?:\n|$)/gi,
    extractId: (m) => `SEV${m[1]}`,
    severity: (m: RegExpMatchArray) => {
      const level = parseInt(m[1] ?? '2');
      if (level <= 1) return 'critical';
      if (level === 2) return 'high';
      return 'medium';
    },
  },
  // "fix for incident" pattern
  {
    pattern: /(?:fix(?:ed|es)?|resolv(?:ed?|es))\s+(?:for\s+)?incident\s+([A-Z0-9-]+)/gi,
    extractId: (m) => m[1] ?? 'unknown',
    severity: 'medium',
  },
  // Post-mortem reference
  {
    pattern: /post[-_]?mortem\s*(?:for\s+)?([A-Z0-9-]+)?/gi,
    extractId: (m) => m[1] ?? 'PM-unknown',
    severity: 'high',
  },
];

// Issue type detection patterns
const ISSUE_TYPE_PATTERNS: Record<IssueType, RegExp[]> = {
  feature: [
    /\bfeat(?:ure)?[:(\s]/i,
    /\badd(?:s|ed|ing)?\s/i,
    /\bimplement(?:s|ed|ing)?\s/i,
    /\bnew\s/i,
  ],
  bug: [
    /\bfix(?:es|ed|ing)?[:(\s]/i,
    /\bbug[:(\s]/i,
    /\bissue[:(\s]/i,
    /\bresolve[sd]?\s/i,
    /\bpatch[:(\s]/i,
  ],
  improvement: [
    /\bimprove(?:s|d|ment)?[:(\s]/i,
    /\brefactor(?:s|ed|ing)?[:(\s]/i,
    /\bupdate(?:s|d)?[:(\s]/i,
    /\benhance(?:s|d|ment)?[:(\s]/i,
    /\boptimize(?:s|d)?[:(\s]/i,
  ],
};

// ============================================================================
// MAIN EXTRACTOR
// ============================================================================

/**
 * Extract traceability links for a code entity.
 *
 * Sources:
 * 1. Code comments (requirements, story references)
 * 2. Commit messages (issue references)
 * 3. Documentation (docs that reference this file)
 * 4. CI/CD config (deployment info)
 */
export async function extractTraceability(
  input: TraceabilityInput
): Promise<TraceabilityExtraction> {
  const content = input.content ?? '';

  // Extract from code content
  const requirements = extractRequirements(content);
  const userStories = extractUserStories(content);

  // Extract issues from code and commits
  const codeIssues = extractIssuesFromContent(content);
  let commitIssues: IssueLink[] = [];

  // Get commit data
  let commits = input.commits;
  if (!commits || commits.length === 0) {
    commits = await fetchCommitReferences(input.filePath, input.workspaceRoot);
  }
  commitIssues = extractIssuesFromCommits(commits);

  // Combine and deduplicate issues
  const issues = deduplicateIssues([...codeIssues, ...commitIssues]);

  // Extract incidents
  const incidents = extractIncidents(content, commits);

  // Extract deployment info
  const deployments = extractDeployments(input.ciConfig, input.relativePath);

  // Find documentation that references this file
  const documentation = extractDocumentation(input.documentation, input.relativePath);

  // Calculate confidence
  const hasRequirements = requirements.length > 0;
  const hasIssues = issues.length > 0;
  const hasDocs = documentation.length > 0;
  const hasCommits = commits.length > 0;

  let confidence = 0.3;
  if (hasRequirements) confidence += 0.2;
  if (hasIssues) confidence += 0.2;
  if (hasDocs) confidence += 0.15;
  if (hasCommits) confidence += 0.15;

  return {
    traceability: {
      requirements,
      userStories,
      issues,
      incidents,
      deployments,
      documentation,
    },
    confidence: Math.min(confidence, 1.0),
  };
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract requirement links from code comments.
 */
function extractRequirements(content: string): RequirementLink[] {
  const requirements: RequirementLink[] = [];
  const seen = new Set<string>();

  for (const { pattern, extractId, extractDescription } of REQUIREMENT_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const id = extractId(match);
      if (seen.has(id)) continue;
      seen.add(id);

      const description = extractDescription(match);
      const status = inferRequirementStatus(content, id);

      requirements.push({
        id,
        description: description.slice(0, 200),
        status,
      });
    }
  }

  return requirements;
}

function inferRequirementStatus(content: string, reqId: string): RequirementStatus {
  const lower = content.toLowerCase();

  // Look for status indicators near the requirement reference
  const reqIndex = lower.indexOf(reqId.toLowerCase());
  if (reqIndex === -1) return 'implemented';

  const context = lower.slice(Math.max(0, reqIndex - 100), reqIndex + 200);

  if (/partial(?:ly)?|incomplete|wip|todo/i.test(context)) {
    return 'partial';
  }
  if (/planned|future|upcoming|todo/i.test(context)) {
    return 'planned';
  }

  return 'implemented';
}

/**
 * Extract user story links from code comments.
 */
function extractUserStories(content: string): UserStoryLink[] {
  const stories: UserStoryLink[] = [];
  const seen = new Set<string>();

  for (const { pattern, extractId, extractTitle } of USER_STORY_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const id = extractId(match);
      if (seen.has(id)) continue;
      seen.add(id);

      const title = extractTitle(match);

      stories.push({
        id,
        title: title.slice(0, 200),
      });
    }
  }

  return stories;
}

/**
 * Extract issue links from code content.
 */
function extractIssuesFromContent(content: string): IssueLink[] {
  const issues: IssueLink[] = [];
  const seen = new Set<string>();

  for (const { pattern, platform, extractId } of ISSUE_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const id = extractId(match);
      const normalizedId = id.toLowerCase();
      if (seen.has(normalizedId)) continue;
      seen.add(normalizedId);

      // Determine issue type from context
      const issueType = inferIssueType(content, match.index ?? 0);

      issues.push({
        id,
        title: `${platform} issue ${id}`,
        type: issueType,
        status: 'referenced',
      });
    }
  }

  return issues;
}

/**
 * Extract issue links from commit messages.
 */
function extractIssuesFromCommits(commits: CommitReference[]): IssueLink[] {
  const issues: IssueLink[] = [];
  const seen = new Set<string>();

  for (const commit of commits) {
    const text = commit.message;

    for (const { pattern, platform, extractId } of ISSUE_PATTERNS) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const id = extractId(match);
        const normalizedId = id.toLowerCase();
        if (seen.has(normalizedId)) continue;
        seen.add(normalizedId);

        // Use commit message to determine issue type
        const issueType = inferIssueType(text, 0);

        // Extract title from commit message if possible
        const title = extractIssueTitle(text, id) ?? `${platform} issue ${id}`;

        issues.push({
          id,
          title,
          type: issueType,
          status: 'resolved', // Assume issues in commits are resolved
        });
      }
    }
  }

  return issues;
}

function extractIssueTitle(commitMessage: string, issueId: string): string | null {
  // Try to extract a meaningful title from the commit message
  // Format: "Fix #123: Some title" or "[JIRA-123] Some title"
  const colonMatch = commitMessage.match(new RegExp(`${escapeRegex(issueId)}\\s*[:-]\\s*(.+?)(?:\\n|$)`, 'i'));
  if (colonMatch?.[1]) {
    return colonMatch[1].trim().slice(0, 100);
  }

  // Use the commit message subject line
  const firstLine = commitMessage.split('\n')[0] ?? '';
  if (firstLine.length > 10 && firstLine.length < 150) {
    return firstLine;
  }

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferIssueType(text: string, contextStart: number): IssueType {
  const context = text.slice(Math.max(0, contextStart - 50), contextStart + 100);

  for (const [type, patterns] of Object.entries(ISSUE_TYPE_PATTERNS) as [IssueType, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(context)) {
        return type;
      }
    }
  }

  // Default to improvement
  return 'improvement';
}

function deduplicateIssues(issues: IssueLink[]): IssueLink[] {
  const seen = new Map<string, IssueLink>();

  for (const issue of issues) {
    const key = issue.id.toLowerCase();
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, issue);
    } else {
      // Prefer resolved status and longer titles
      if (issue.status === 'resolved' && existing.status !== 'resolved') {
        seen.set(key, { ...existing, status: 'resolved' });
      }
      if (issue.title.length > existing.title.length) {
        seen.set(key, { ...seen.get(key)!, title: issue.title });
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Extract incident links from content and commits.
 */
function extractIncidents(
  content: string,
  commits: CommitReference[]
): IncidentLink[] {
  const incidents: IncidentLink[] = [];
  const seen = new Set<string>();

  // From code content
  for (const { pattern, extractId, severity } of INCIDENT_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const id = extractId(match);
      if (seen.has(id)) continue;
      seen.add(id);

      const severityValue = typeof severity === 'function' ? severity(match) : severity;

      incidents.push({
        id,
        title: extractIncidentTitle(content, match.index ?? 0) ?? `Incident ${id}`,
        severity: severityValue,
        date: new Date().toISOString(), // Would need external data
        rootCause: extractRootCause(content, match.index ?? 0),
      });
    }
  }

  // From commits
  for (const commit of commits) {
    for (const { pattern, extractId, severity } of INCIDENT_PATTERNS) {
      const matches = commit.message.matchAll(pattern);
      for (const match of matches) {
        const id = extractId(match);
        if (seen.has(id)) continue;
        seen.add(id);

        const severityValue = typeof severity === 'function' ? severity(match) : severity;

        incidents.push({
          id,
          title: commit.message.split('\n')[0]?.slice(0, 100) ?? `Incident ${id}`,
          severity: severityValue,
          date: commit.date,
          rootCause: extractRootCause(commit.message, 0),
        });
      }
    }
  }

  return incidents;
}

function extractIncidentTitle(content: string, index: number): string | null {
  const context = content.slice(index, index + 200);
  const titleMatch = context.match(/[:-]\s*([^\n]+)/);
  return titleMatch?.[1]?.trim().slice(0, 100) ?? null;
}

function extractRootCause(content: string, index: number): string | undefined {
  const context = content.slice(index, index + 500);
  const rootCauseMatch = context.match(
    /(?:root\s*cause|caused\s+by|due\s+to|reason)[:\s]+([^\n.]+)/i
  );
  return rootCauseMatch?.[1]?.trim();
}

/**
 * Extract deployment information from CI config.
 */
function extractDeployments(
  ciConfig: CIConfig | undefined,
  relativePath: string
): DeploymentLink[] {
  const deployments: DeploymentLink[] = [];

  if (!ciConfig?.environments) {
    // Infer from path patterns
    if (/\/(prod|production)\//i.test(relativePath)) {
      deployments.push({
        environment: 'production',
        version: 'latest',
        deployedAt: new Date().toISOString(),
      });
    }
    if (/\/(staging|stage)\//i.test(relativePath)) {
      deployments.push({
        environment: 'staging',
        version: 'latest',
        deployedAt: new Date().toISOString(),
      });
    }
    return deployments;
  }

  for (const env of ciConfig.environments) {
    deployments.push({
      environment: env,
      version: 'latest', // Would need actual version
      deployedAt: new Date().toISOString(),
    });
  }

  return deployments;
}

/**
 * Find documentation that references this file.
 */
function extractDocumentation(
  docs: DocReference[] | undefined,
  relativePath: string
): DocLink[] {
  const docLinks: DocLink[] = [];

  if (!docs || docs.length === 0) return docLinks;

  const fileName = path.basename(relativePath);
  const fileNameWithoutExt = path.basename(relativePath, path.extname(relativePath));

  for (const doc of docs) {
    // Check if doc references this file
    const references =
      doc.content.includes(relativePath) ||
      doc.content.includes(fileName) ||
      doc.links.some(
        (l) => l.url.includes(relativePath) || l.url.includes(fileName)
      );

    if (references) {
      docLinks.push({
        title: doc.title,
        url: doc.path,
        type: inferDocType(doc.path, doc.content),
      });
    }
  }

  // Also look for docs with matching names
  for (const doc of docs) {
    const docName = path.basename(doc.path, path.extname(doc.path));
    if (
      docName.toLowerCase() === fileNameWithoutExt.toLowerCase() ||
      docName.toLowerCase().includes(fileNameWithoutExt.toLowerCase())
    ) {
      if (!docLinks.some((d) => d.url === doc.path)) {
        docLinks.push({
          title: doc.title,
          url: doc.path,
          type: inferDocType(doc.path, doc.content),
        });
      }
    }
  }

  return docLinks;
}

function inferDocType(docPath: string, content: string): DocType {
  const lower = docPath.toLowerCase();
  const contentLower = content.toLowerCase();

  if (/api|swagger|openapi/i.test(lower)) return 'api';
  if (/guide|how-?to|getting-?started/i.test(lower)) return 'guide';
  if (/tutorial|example|demo/i.test(lower)) return 'tutorial';
  if (/architect|design|adr/i.test(lower)) return 'architecture';

  // Check content
  if (/endpoint|request|response|http/i.test(contentLower)) return 'api';
  if (/step\s+\d|first|next|then/i.test(contentLower)) return 'guide';

  return 'reference';
}

// ============================================================================
// GIT INTEGRATION
// ============================================================================

async function fetchCommitReferences(
  filePath: string,
  workspaceRoot: string
): Promise<CommitReference[]> {
  try {
    const relativePath = filePath.replace(workspaceRoot + '/', '');
    const { stdout } = await execAsync(
      `git log --format="%H|%an|%aI|%s" -n 30 -- "${relativePath}"`,
      { cwd: workspaceRoot, timeout: 10000 }
    );

    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [hash, author, date, ...messageParts] = line.split('|');
        return {
          hash: hash ?? '',
          author: author ?? 'unknown',
          date: date ?? new Date().toISOString(),
          message: messageParts.join('|'),
        };
      });
  } catch {
    return [];
  }
}

// ============================================================================
// BATCH EXTRACTION
// ============================================================================

export interface BatchTraceabilityInput {
  workspaceRoot: string;
  files: Array<{
    filePath: string;
    relativePath: string;
    content?: string;
  }>;
  commits?: CommitReference[];
  documentation?: DocReference[];
  ciConfig?: CIConfig;
}

/**
 * Extract traceability for multiple files efficiently.
 * Shares commit and documentation data across files.
 */
export async function extractTraceabilityBatch(
  input: BatchTraceabilityInput
): Promise<Map<string, TraceabilityExtraction>> {
  const results = new Map<string, TraceabilityExtraction>();

  // Process files in parallel
  const extractions = await Promise.all(
    input.files.map((file) =>
      extractTraceability({
        filePath: file.filePath,
        relativePath: file.relativePath,
        workspaceRoot: input.workspaceRoot,
        content: file.content,
        commits: input.commits,
        documentation: input.documentation,
        ciConfig: input.ciConfig,
      }).then((result) => ({ file: file.filePath, result }))
    )
  );

  for (const { file, result } of extractions) {
    results.set(file, result);
  }

  return results;
}

// ============================================================================
// CROSS-FILE TRACEABILITY ANALYSIS
// ============================================================================

export interface TraceabilityGraph {
  nodes: TraceabilityNode[];
  edges: TraceabilityEdge[];
}

export interface TraceabilityNode {
  id: string;
  type: 'file' | 'requirement' | 'issue' | 'incident' | 'doc';
  label: string;
}

export interface TraceabilityEdge {
  source: string;
  target: string;
  relationship: 'implements' | 'fixes' | 'documents' | 'caused_by';
}

/**
 * Build a traceability graph from multiple file extractions.
 * Shows relationships between code and external artifacts.
 */
export function buildTraceabilityGraph(
  extractions: Map<string, TraceabilityExtraction>
): TraceabilityGraph {
  const nodes: TraceabilityNode[] = [];
  const edges: TraceabilityEdge[] = [];
  const seenNodes = new Set<string>();

  for (const [filePath, extraction] of extractions) {
    const fileId = `file:${filePath}`;

    if (!seenNodes.has(fileId)) {
      nodes.push({
        id: fileId,
        type: 'file',
        label: path.basename(filePath),
      });
      seenNodes.add(fileId);
    }

    // Add requirement nodes and edges
    for (const req of extraction.traceability.requirements) {
      const reqId = `req:${req.id}`;
      if (!seenNodes.has(reqId)) {
        nodes.push({
          id: reqId,
          type: 'requirement',
          label: req.id,
        });
        seenNodes.add(reqId);
      }
      edges.push({
        source: fileId,
        target: reqId,
        relationship: 'implements',
      });
    }

    // Add issue nodes and edges
    for (const issue of extraction.traceability.issues) {
      const issueId = `issue:${issue.id}`;
      if (!seenNodes.has(issueId)) {
        nodes.push({
          id: issueId,
          type: 'issue',
          label: issue.id,
        });
        seenNodes.add(issueId);
      }
      edges.push({
        source: fileId,
        target: issueId,
        relationship: issue.type === 'bug' ? 'fixes' : 'implements',
      });
    }

    // Add incident nodes and edges
    for (const incident of extraction.traceability.incidents) {
      const incidentId = `incident:${incident.id}`;
      if (!seenNodes.has(incidentId)) {
        nodes.push({
          id: incidentId,
          type: 'incident',
          label: incident.id,
        });
        seenNodes.add(incidentId);
      }
      edges.push({
        source: fileId,
        target: incidentId,
        relationship: 'caused_by',
      });
    }

    // Add documentation nodes and edges
    for (const doc of extraction.traceability.documentation) {
      const docId = `doc:${doc.url}`;
      if (!seenNodes.has(docId)) {
        nodes.push({
          id: docId,
          type: 'doc',
          label: doc.title,
        });
        seenNodes.add(docId);
      }
      edges.push({
        source: docId,
        target: fileId,
        relationship: 'documents',
      });
    }
  }

  return { nodes, edges };
}
