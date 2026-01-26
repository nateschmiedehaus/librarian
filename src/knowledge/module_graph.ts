import path from 'node:path';
import type { ModuleKnowledge } from '../storage/types.js';

export type ModuleGraph = Map<string, Set<string>>;

export interface ModuleGraphBundle {
  graph: ModuleGraph;
  reverse: ModuleGraph;
  unresolved: Array<{ from: string; specifier: string }>;
}

export function buildModuleGraphs(modules: ModuleKnowledge[]): ModuleGraphBundle {
  const graph: ModuleGraph = new Map();
  const reverse: ModuleGraph = new Map();
  const unresolved: Array<{ from: string; specifier: string }> = [];
  const index = buildModuleIndex(modules);

  for (const mod of modules) {
    if (!graph.has(mod.path)) graph.set(mod.path, new Set());
    if (!reverse.has(mod.path)) reverse.set(mod.path, new Set());
  }

  for (const mod of modules) {
    for (const dep of mod.dependencies) {
      const resolved = resolveDependency(dep, mod.path, index);
      if (resolved.length === 0) {
        unresolved.push({ from: mod.path, specifier: dep });
        continue;
      }
      for (const target of resolved) {
        if (target === mod.path) continue;
        (graph.get(mod.path) as Set<string>).add(target);
        (reverse.get(target) as Set<string>).add(mod.path);
      }
    }
  }

  return { graph, reverse, unresolved };
}

export function resolveTargetModule(modules: ModuleKnowledge[], target: string): ModuleKnowledge | null {
  const normalizedTarget = normalizeModuleKey(target);
  const direct = modules.find((mod) => mod.path === target || mod.id === target);
  if (direct) return direct;

  const matches = modules.filter((mod) => normalizeModuleKey(mod.path).endsWith(normalizedTarget));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const base = path.posix.basename(normalizedTarget);
    const baseMatches = matches.filter((mod) => path.posix.basename(normalizeModuleKey(mod.path)) === base);
    if (baseMatches.length === 1) return baseMatches[0];
  }

  return null;
}

function buildModuleIndex(modules: ModuleKnowledge[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const mod of modules) {
    const key = normalizeModuleKey(mod.path);
    if (!index.has(key)) index.set(key, []);
    index.get(key)?.push(mod.path);
    if (!index.has(mod.path)) index.set(mod.path, [mod.path]);
  }
  return index;
}

function resolveDependency(specifier: string, fromPath: string, index: Map<string, string[]>): string[] {
  const cleaned = stripQuery(specifier);
  if (index.has(cleaned)) return index.get(cleaned) ?? [];

  const normalized = normalizeSpecifier(cleaned, fromPath);
  if (index.has(normalized)) return index.get(normalized) ?? [];

  const normalizedWithIndex = normalized.endsWith('/index') ? normalized : `${normalized}/index`;
  if (index.has(normalizedWithIndex)) return index.get(normalizedWithIndex) ?? [];

  return [];
}

function normalizeSpecifier(specifier: string, fromPath: string): string {
  const normalized = specifier.replace(/\\/g, '/');
  if (normalized.startsWith('.')) {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), normalized));
    return normalizeModuleKey(resolved);
  }
  if (normalized.startsWith('/')) {
    return normalizeModuleKey(normalized);
  }
  if (normalized.includes('/')) {
    return normalizeModuleKey(normalized);
  }
  return normalized;
}

function normalizeModuleKey(modulePath: string): string {
  const normalized = modulePath.replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.[^.]+$/, '');
  return withoutExt.endsWith('/index') ? withoutExt.slice(0, -'/index'.length) : withoutExt;
}

function stripQuery(value: string): string {
  const hashIndex = value.indexOf('#');
  const queryIndex = value.indexOf('?');
  let end = value.length;
  if (hashIndex >= 0) end = Math.min(end, hashIndex);
  if (queryIndex >= 0) end = Math.min(end, queryIndex);
  return value.slice(0, end);
}
