import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import YAML from 'yaml';
import { getErrorMessage } from '../utils/errors.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';
import { safeJsonParse, getResultErrorMessage } from '../utils/safe_json.js';

export interface DependencyNode { name: string; version: string; dev?: boolean; }
export interface DependencyEdge { from: string; to: string; }
export interface DependencyGraph { nodes: DependencyNode[]; edges: DependencyEdge[]; }
export interface VulnerabilitySummary { package: string; severity: string; title: string; url?: string; }
export interface ExternalServiceDependency { service: string; packages: string[]; }

export interface DepsIngestionOptions {
  lockfileGlobs?: string[];
  auditGlobs?: string[];
  exclude?: string[];
  maxFileBytes?: number;
  maxLockfiles?: number;
}

const DEFAULT_LOCK_GLOBS = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'pnpm-lock.yml'];
const DEFAULT_AUDIT_GLOBS = ['**/npm-audit.json', '**/npm-audit-report.json', '**/audit.json'];
const DEFAULT_MAX_BYTES = 512_000;
const DEFAULT_MAX_LOCKFILES = 10;
const DEPS_TAXONOMY: TaxonomyItem[] = [
  'dependency_versions_lockfile',
  'dependency_risk_health',
  'external_service_dependencies',
  'runtime_topology_services',
];

const SERVICE_PATTERNS: Array<{ service: string; pattern: RegExp }> = [
  { service: 'aws', pattern: /(^@aws-sdk|aws-sdk|dynamodb|s3|sns|sqs)/i },
  { service: 'gcp', pattern: /(google-cloud|@google-cloud|firebase|gcp)/i },
  { service: 'azure', pattern: /(azure|@azure)/i },
  { service: 'stripe', pattern: /stripe/i },
  { service: 'twilio', pattern: /twilio/i },
  { service: 'sendgrid', pattern: /sendgrid/i },
  { service: 'datadog', pattern: /datadog|dd-trace/i },
  { service: 'sentry', pattern: /sentry/i },
];

function hashPayload(payload: unknown): string {
  try {
    return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
  } catch {
    return createHash('sha256').update('{}').digest('hex');
  }
}

function addNode(nodes: Map<string, DependencyNode>, name: string, version: string, dev?: boolean): void {
  if (!name) return;
  const key = `${name}@${version || 'unknown'}`;
  if (nodes.has(key)) return;
  nodes.set(key, { name, version: version || 'unknown', dev });
}

function mergeGraph(target: DependencyGraph, incoming: DependencyGraph): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  for (const node of target.nodes) addNode(nodes, node.name, node.version, node.dev);
  for (const node of incoming.nodes) addNode(nodes, node.name, node.version, node.dev);
  const edges = [...target.edges, ...incoming.edges];
  return { nodes: Array.from(nodes.values()), edges };
}

function parsePackageLockDeps(
  deps: Record<string, unknown>,
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  parent?: string
): void {
  for (const [name, info] of Object.entries(deps)) {
    if (!info || typeof info !== 'object') continue;
    const entry = info as { version?: string; dev?: boolean; dependencies?: Record<string, unknown> };
    const version = typeof entry.version === 'string' ? entry.version : 'unknown';
    addNode(nodes, name, version, entry.dev);
    if (parent) edges.push({ from: parent, to: name });
    if (entry.dependencies && typeof entry.dependencies === 'object') {
      parsePackageLockDeps(entry.dependencies, nodes, edges, name);
    }
  }
}

function parsePackageLock(data: Record<string, unknown>): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];
  const packages = data.packages && typeof data.packages === 'object' ? data.packages as Record<string, unknown> : null;
  if (packages) {
    for (const [pkgPath, infoRaw] of Object.entries(packages)) {
      if (pkgPath === '') continue;
      if (!infoRaw || typeof infoRaw !== 'object') continue;
      const info = infoRaw as { name?: string; version?: string; dev?: boolean; dependencies?: Record<string, string> };
      const name = typeof info.name === 'string' ? info.name : pkgPath.replace(/^node_modules\//, '');
      const version = typeof info.version === 'string' ? info.version : 'unknown';
      if (!name) continue;
      addNode(nodes, name, version, info.dev);
      if (info.dependencies) {
        for (const dep of Object.keys(info.dependencies)) edges.push({ from: name, to: dep });
      }
    }
  } else if (data.dependencies && typeof data.dependencies === 'object') {
    parsePackageLockDeps(data.dependencies as Record<string, unknown>, nodes, edges);
  }
  return { nodes: Array.from(nodes.values()), edges };
}

function extractNameFromSpecifier(spec: string): string {
  const cleaned = spec.replace(/^['"]|['"]$/g, '');
  if (cleaned.startsWith('@')) {
    const idx = cleaned.indexOf('@', 1);
    return idx === -1 ? cleaned : cleaned.slice(0, idx);
  }
  const idx = cleaned.indexOf('@');
  return idx === -1 ? cleaned : cleaned.slice(0, idx);
}

function parseYarnLock(content: string): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];
  const blocks = content.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const header = lines[0]?.trim() ?? '';
    if (!header.endsWith(':')) continue;
    const headerNames = header.slice(0, -1).split(/,\s*/).map((entry) => extractNameFromSpecifier(entry));
    const name = headerNames.find(Boolean);
    if (!name) continue;
    let version = 'unknown';
    let inDeps = false;
    const deps: string[] = [];
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('version ')) {
        version = trimmed.replace(/^version\s+/, '').replace(/^"|"$/g, '');
      }
      if (trimmed === 'dependencies:' || trimmed === 'optionalDependencies:') {
        inDeps = true;
        continue;
      }
      if (inDeps) {
        if (!trimmed || trimmed.endsWith(':')) {
          if (!trimmed.endsWith(':')) inDeps = false;
          continue;
        }
        const depMatch = trimmed.match(/^([^ ]+)\s+/);
        if (depMatch) deps.push(depMatch[1].replace(/^"|"$/g, ''));
      }
    }
    addNode(nodes, name, version, false);
    for (const dep of deps) edges.push({ from: name, to: dep });
  }
  return { nodes: Array.from(nodes.values()), edges };
}

function parsePnpmKey(key: string): { name: string; version: string } {
  const parts = key.split('/').filter(Boolean);
  if (parts.length < 2) return { name: key, version: 'unknown' };
  const version = parts[parts.length - 1] ?? 'unknown';
  const name = parts.slice(0, -1).join('/');
  return { name, version };
}

function parsePnpmLock(content: string): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];
  const parsed = YAML.parse(content) as Record<string, unknown>;
  const packages = parsed.packages && typeof parsed.packages === 'object' ? parsed.packages as Record<string, unknown> : {};
  for (const [pkgKey, infoRaw] of Object.entries(packages)) {
    if (!infoRaw || typeof infoRaw !== 'object') continue;
    const info = infoRaw as { dependencies?: Record<string, string>; dev?: boolean };
    const { name, version } = parsePnpmKey(pkgKey);
    addNode(nodes, name, version, info.dev);
    if (info.dependencies) {
      for (const dep of Object.keys(info.dependencies)) edges.push({ from: name, to: dep });
    }
  }
  return { nodes: Array.from(nodes.values()), edges };
}

function parseAuditReport(data: Record<string, unknown>): VulnerabilitySummary[] {
  const findings: VulnerabilitySummary[] = [];
  if (data.vulnerabilities && typeof data.vulnerabilities === 'object') {
    for (const [pkg, vulnRaw] of Object.entries(data.vulnerabilities as Record<string, unknown>)) {
      if (!vulnRaw || typeof vulnRaw !== 'object') continue;
      const vuln = vulnRaw as { severity?: string; via?: Array<string | { title?: string; url?: string; severity?: string }> };
      const severity = typeof vuln.severity === 'string' ? vuln.severity : 'unknown';
      const via = Array.isArray(vuln.via) ? vuln.via : [];
      if (!via.length) {
        findings.push({ package: pkg, severity, title: 'unknown' });
        continue;
      }
      for (const entry of via) {
        if (typeof entry === 'string') {
          findings.push({ package: pkg, severity, title: entry });
        } else if (entry && typeof entry === 'object') {
          findings.push({
            package: pkg,
            severity: entry.severity ?? severity,
            title: entry.title ?? 'unknown',
            url: entry.url,
          });
        }
      }
    }
  }
  if (data.advisories && typeof data.advisories === 'object') {
    for (const advisoryRaw of Object.values(data.advisories as Record<string, unknown>)) {
      if (!advisoryRaw || typeof advisoryRaw !== 'object') continue;
      const advisory = advisoryRaw as { module_name?: string; severity?: string; title?: string; url?: string };
      findings.push({
        package: advisory.module_name ?? 'unknown',
        severity: advisory.severity ?? 'unknown',
        title: advisory.title ?? 'unknown',
        url: advisory.url,
      });
    }
  }
  return findings;
}

function deriveExternalServices(nodes: DependencyNode[]): ExternalServiceDependency[] {
  const services = new Map<string, string[]>();
  for (const node of nodes) {
    for (const { service, pattern } of SERVICE_PATTERNS) {
      if (pattern.test(node.name)) {
        const list = services.get(service) ?? [];
        list.push(node.name);
        services.set(service, Array.from(new Set(list)));
      }
    }
  }
  return Array.from(services.entries()).map(([service, packages]) => ({ service, packages }));
}

export function createDepsIngestionSource(options: DepsIngestionOptions = {}): IngestionSource {
  const lockfileGlobs = options.lockfileGlobs ?? DEFAULT_LOCK_GLOBS;
  const auditGlobs = options.auditGlobs ?? DEFAULT_AUDIT_GLOBS;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;
  const maxLockfiles = options.maxLockfiles ?? DEFAULT_MAX_LOCKFILES;

  return {
    type: 'deps',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { graph?: DependencyGraph } };
      return Boolean(item.payload?.graph);
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const items: IngestionItem[] = [];
      const errors: string[] = [];
      let graph: DependencyGraph = { nodes: [], edges: [] };

      const lockfiles = await glob(lockfileGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true });
      const limitedLockfiles = lockfiles.slice(0, maxLockfiles);
      for (const filePath of limitedLockfiles) {
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
          if (filePath.endsWith('package-lock.json')) {
            const parsed = safeJsonParse<Record<string, unknown>>(content);
            if (!parsed.ok) throw new Error(getResultErrorMessage(parsed) || 'invalid JSON');
            graph = mergeGraph(graph, parsePackageLock(parsed.value));
          } else if (filePath.endsWith('yarn.lock')) {
            graph = mergeGraph(graph, parseYarnLock(content));
          } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
            graph = mergeGraph(graph, parsePnpmLock(content));
          }
        } catch (error: unknown) {
          errors.push(`Failed to parse lockfile ${filePath}: ${getErrorMessage(error)}`);
        }
      }

      const auditFiles = await glob(auditGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true });
      const vulnerabilities: VulnerabilitySummary[] = [];
      for (const filePath of auditFiles) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileBytes) continue;
          const content = await fs.readFile(filePath, 'utf8');
          const parsed = safeJsonParse<Record<string, unknown>>(content);
          if (!parsed.ok) continue;
          vulnerabilities.push(...parseAuditReport(parsed.value));
        } catch {
          continue;
        }
      }

      const externalServices = deriveExternalServices(graph.nodes);
      const payload = {
        lockfiles: limitedLockfiles.map((file) => path.relative(ctx.workspace, file)),
        graph,
        vulnerabilities,
        external_services: externalServices,
      };

      items.push({
        id: 'deps:knowledge',
        sourceType: 'deps',
        sourceVersion: 'v1',
        ingestedAt: ctx.now(),
        payload,
        metadata: {
          hash: hashPayload(payload),
          taxonomy: DEPS_TAXONOMY,
          dependency_count: graph.nodes.length,
          vulnerability_count: vulnerabilities.length,
          external_service_count: externalServices.length,
        },
      });

      return { items, errors };
    },
  };
}
