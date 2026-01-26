import fs from 'node:fs';
import path from 'node:path';
import type { KnowledgeGap } from '../api/context_assembly.js';
import { logError, logWarning } from '../telemetry/logger.js';

export interface ReadPolicyContext {
  taskId: string;
  agentId?: string;
  providedFiles: string[];
  gaps: KnowledgeGap[];
  registeredAt: string;
  /**
   * updatedAt tracks last access (register or resolve) to support LRU + TTL expiry.
   */
  updatedAt: string;
}

interface RegisterReadPolicyInput {
  taskId: string;
  agentId?: string;
  workspaceRoot?: string;
  providedFiles?: string[];
  gaps?: KnowledgeGap[];
}

export interface ReadPolicyRegistryOptions {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => Date;
}

const DEFAULT_MAX_ENTRIES = 2000;
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_TTL_PRUNE_INTERVAL_MS = 5000;
const MAX_ID_LENGTH = 256;
const MAX_GAPS_PER_CONTEXT = 100;
const MAX_GAP_DESCRIPTION_LENGTH = 1000;
const MAX_FILE_PATH_LENGTH = 4096;
const MAX_FILES_PER_CONTEXT = 10000;
const CANONICAL_CACHE_TTL_MS = 5 * 60 * 1000;
const WINDOWS_DEVICE_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const contextsByTask = new Map<string, ReadPolicyContext>();
const taskByAgent = new Map<string, string>();

interface LruNode {
  taskId: string;
  prev: LruNode | null;
  next: LruNode | null;
}

const lruNodes = new Map<string, LruNode>();
let lruHead: LruNode | null = null;
let lruTail: LruNode | null = null;
let lastTtlPruneAt = 0;

let registryOptions: Required<ReadPolicyRegistryOptions> = {
  maxEntries: DEFAULT_MAX_ENTRIES,
  ttlMs: DEFAULT_TTL_MS,
  now: () => new Date(),
};

const canonicalCache = new Map<string, { value: string; expiresAt: number }>();

export function configureReadPolicyRegistry(options: ReadPolicyRegistryOptions): void {
  registryOptions = {
    ...registryOptions,
    ...options,
    maxEntries: Math.max(1, options.maxEntries ?? registryOptions.maxEntries),
    ttlMs: Math.max(1, options.ttlMs ?? registryOptions.ttlMs),
    now: options.now ?? registryOptions.now,
  };
}

export function resetReadPolicyRegistry(): void {
  contextsByTask.clear();
  taskByAgent.clear();
  lruNodes.clear();
  canonicalCache.clear();
  lruHead = null;
  lruTail = null;
  lastTtlPruneAt = 0;
  registryOptions = {
    maxEntries: DEFAULT_MAX_ENTRIES,
    ttlMs: DEFAULT_TTL_MS,
    now: () => new Date(),
  };
}

function normalizeId(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (trimmed.length > MAX_ID_LENGTH) {
    throw new Error(`${label} is too long`);
  }
  return trimmed;
}

function isWindowsPath(value: string): boolean {
  return value.includes('\\') || /^[A-Za-z]:/.test(value) || value.startsWith('\\\\');
}

function isWithinRoot(candidate: string, root: string): boolean {
  const useWin = isWindowsPath(root) || isWindowsPath(candidate);
  const relative = useWin ? path.win32.relative(root, candidate) : path.relative(root, candidate);
  const isAbsolute = useWin ? path.win32.isAbsolute(relative) : path.isAbsolute(relative);
  const sep = useWin ? path.win32.sep : path.sep;
  return relative === '' || (!relative.startsWith('..') && !relative.startsWith(`..${sep}`) && !isAbsolute);
}

function validatePathInput(value: string, label: string): void {
  if (value.includes('\0')) {
    throw new Error(`${label} contains null byte`);
  }
  if (value.length > MAX_FILE_PATH_LENGTH) {
    throw new Error(`${label} is too long`);
  }
  if (/^[A-Za-z]:(?![\\/])/.test(value)) {
    throw new Error(`${label} must not use drive-relative paths`);
  }
  if (value.startsWith('\\\\?\\') || value.startsWith('\\\\.\\')) {
    throw new Error(`${label} must not use device paths`);
  }
  const segments = value.split(/[\\/]+/);
  for (const segment of segments) {
    if (!segment) continue;
    if (WINDOWS_DEVICE_PATTERN.test(segment)) {
      throw new Error(`${label} contains unsafe path segment`);
    }
  }
}

function resolveCanonical(target: string, options: { allowMissing: boolean; label: string; now: Date }): string {
  validatePathInput(target, options.label);
  const cache = canonicalCache.get(target);
  const nowMs = options.now.getTime();
  if (cache && cache.expiresAt > nowMs) return cache.value;

  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      try {
        const resolved = fs.realpathSync(target);
        canonicalCache.set(target, { value: resolved, expiresAt: nowMs + CANONICAL_CACHE_TTL_MS });
        return resolved;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logWarning('Failed to resolve symlink path', { target, error: message });
        throw new Error(`Unable to resolve symlink for ${options.label}`);
      }
    }
    const resolved = fs.realpathSync(target);
    canonicalCache.set(target, { value: resolved, expiresAt: nowMs + CANONICAL_CACHE_TTL_MS });
    return resolved;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT' && options.allowMissing) {
      return target;
    }
    const message = error instanceof Error ? error.message : String(error);
    logWarning('Failed to resolve canonical path', { target, error: message });
    throw new Error(`Unable to resolve ${options.label}`);
  }
}

function normalizeWorkspaceRoot(workspaceRoot?: string): string | null {
  if (!workspaceRoot) return null;
  validatePathInput(workspaceRoot, 'workspaceRoot');
  const resolved = path.resolve(workspaceRoot);
  return resolveCanonical(resolved, { allowMissing: false, label: 'workspaceRoot', now: registryOptions.now() });
}

function normalizeFiles(files: string[] | undefined, workspaceRoot?: string): string[] {
  if (!Array.isArray(files) || files.length === 0) return [];
  const root = normalizeWorkspaceRoot(workspaceRoot);
  const normalized = new Set<string>();
  for (const file of files) {
    if (typeof file !== 'string') continue;
    const trimmed = file.trim();
    if (!trimmed) continue;
    validatePathInput(trimmed, 'provided file');
    const resolved = root ? path.resolve(root, trimmed) : path.resolve(trimmed);
    if (root && !isWithinRoot(resolved, root)) {
      throw new Error(`Path escapes workspace root: ${trimmed}`);
    }
    const canonical = resolveCanonical(resolved, { allowMissing: true, label: 'provided file', now: registryOptions.now() });
    if (root && !isWithinRoot(canonical, root)) {
      throw new Error(`Path escapes workspace root: ${trimmed}`);
    }
    normalized.add(canonical);
    if (normalized.size >= MAX_FILES_PER_CONTEXT) break;
  }
  return Array.from(normalized);
}

function mergeFiles(existing: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return existing.slice();
  return Array.from(new Set([...existing, ...incoming]));
}

function normalizeGaps(gaps: KnowledgeGap[] | undefined): KnowledgeGap[] {
  if (!Array.isArray(gaps) || gaps.length === 0) return [];
  const normalized: KnowledgeGap[] = [];
  for (const gap of gaps) {
    if (!gap || typeof gap.description !== 'string') continue;
    const trimmed = gap.description.trim();
    if (!trimmed) continue;
    const capped = trimmed.length > MAX_GAP_DESCRIPTION_LENGTH
      ? trimmed.slice(0, MAX_GAP_DESCRIPTION_LENGTH)
      : trimmed;
    normalized.push({ ...gap, description: capped });
    if (normalized.length >= MAX_GAPS_PER_CONTEXT) break;
  }
  return normalized;
}

function mergeGaps(existing: KnowledgeGap[], incoming: KnowledgeGap[]): KnowledgeGap[] {
  if (incoming.length === 0) return existing.slice();
  const seen = new Set(existing.map((gap) => gap.description));
  const merged = existing.slice();
  for (const gap of incoming) {
    if (!seen.has(gap.description)) {
      merged.push(gap);
      seen.add(gap.description);
    }
  }
  return merged;
}

function detachNode(node: LruNode): void {
  if (node.prev) node.prev.next = node.next;
  if (node.next) node.next.prev = node.prev;
  if (lruHead === node) lruHead = node.next;
  if (lruTail === node) lruTail = node.prev;
  node.prev = null;
  node.next = null;
}

function appendNode(node: LruNode): void {
  node.prev = lruTail;
  node.next = null;
  if (lruTail) {
    lruTail.next = node;
  } else {
    lruHead = node;
  }
  lruTail = node;
}

function touchLru(taskId: string): void {
  let node = lruNodes.get(taskId);
  if (!node) {
    node = { taskId, prev: null, next: null };
    lruNodes.set(taskId, node);
    appendNode(node);
    return;
  }
  if (lruTail === node) return;
  detachNode(node);
  appendNode(node);
}

function removeLru(taskId: string): void {
  const node = lruNodes.get(taskId);
  if (!node) return;
  detachNode(node);
  lruNodes.delete(taskId);
}

function removeEntry(taskId: string): void {
  const entry = contextsByTask.get(taskId);
  contextsByTask.delete(taskId);
  removeLru(taskId);
  if (entry?.agentId) taskByAgent.delete(entry.agentId);
}

function pruneRegistry(now: Date, options: { enforceMax: boolean } = { enforceMax: true }): void {
  const nowMs = now.getTime();
  const ttlInterval = Math.min(registryOptions.ttlMs, DEFAULT_TTL_PRUNE_INTERVAL_MS);
  if (nowMs - lastTtlPruneAt >= ttlInterval) {
    const cutoff = nowMs - registryOptions.ttlMs;
    for (const [taskId, entry] of contextsByTask) {
      const updatedAt = Date.parse(entry.updatedAt);
      if (!Number.isFinite(updatedAt)) {
        logWarning('Skipping entry with invalid updatedAt', { taskId, updatedAt: entry.updatedAt });
        continue;
      }
      if (updatedAt <= cutoff) {
        removeEntry(taskId);
      }
    }
    lastTtlPruneAt = nowMs;
  }

  if (!options.enforceMax || contextsByTask.size <= registryOptions.maxEntries) return;
  let iterations = 0;
  const maxIterations = registryOptions.maxEntries * 2;
  while (contextsByTask.size > registryOptions.maxEntries && lruHead && iterations++ < maxIterations) {
    const oldest = lruHead.taskId;
    removeEntry(oldest);
  }
  if (iterations >= maxIterations) {
    logError('pruneRegistry circuit breaker triggered', {
      size: contextsByTask.size,
      maxEntries: registryOptions.maxEntries,
    });
    throw new Error('Registry pruning failed: exceeded max iterations');
  }
}

function cloneContext(entry: ReadPolicyContext): ReadPolicyContext {
  return {
    ...entry,
    providedFiles: entry.providedFiles.slice(),
    gaps: entry.gaps.slice(),
  };
}

export function registerReadPolicyContext(input: RegisterReadPolicyInput): ReadPolicyContext {
  const taskId = normalizeId(input.taskId, 'taskId');
  const agentId = input.agentId ? normalizeId(input.agentId, 'agentId') : undefined;
  const now = registryOptions.now();
  const nowIso = now.toISOString();

  const existing = contextsByTask.get(taskId);
  const incomingFiles = normalizeFiles(input.providedFiles, input.workspaceRoot);
  const incomingGaps = normalizeGaps(input.gaps);
  const providedFiles = mergeFiles(existing?.providedFiles ?? [], incomingFiles);
  const gaps = mergeGaps(existing?.gaps ?? [], incomingGaps);

  const entry: ReadPolicyContext = {
    taskId,
    agentId: agentId ?? existing?.agentId,
    providedFiles,
    gaps,
    registeredAt: existing?.registeredAt ?? nowIso,
    updatedAt: nowIso,
  };

  contextsByTask.set(taskId, entry);
  if (existing?.agentId && existing.agentId !== entry.agentId) {
    taskByAgent.delete(existing.agentId);
  }
  if (entry.agentId) {
    taskByAgent.set(entry.agentId, taskId);
  }

  touchLru(taskId);
  pruneRegistry(now, { enforceMax: true });
  return cloneContext(entry);
}

export function resolveReadPolicyContext(input: { taskId?: string; agentId?: string }): ReadPolicyContext | null {
  if (!input.taskId && !input.agentId) return null;
  const now = registryOptions.now();
  pruneRegistry(now, { enforceMax: false });
  const nowIso = now.toISOString();

  const taskId = input.taskId ?? (input.agentId ? taskByAgent.get(input.agentId) ?? null : null);
  if (!taskId) return null;
  const entry = contextsByTask.get(taskId);
  if (!entry) return null;

  const updated: ReadPolicyContext = { ...entry, updatedAt: nowIso };
  contextsByTask.set(taskId, updated);
  touchLru(taskId);
  return cloneContext(updated);
}

export function clearReadPolicyContext(input: { taskId?: string; agentId?: string }): void {
  if (!input.taskId && !input.agentId) return;
  const taskId = input.taskId ? normalizeId(input.taskId, 'taskId') : undefined;
  const agentId = input.agentId ? normalizeId(input.agentId, 'agentId') : undefined;
  const mappedTask = agentId ? taskByAgent.get(agentId) : undefined;

  if (taskId && mappedTask && mappedTask !== taskId) {
    throw new Error('agentId does not match taskId');
  }

  const taskIds = new Set<string>();
  if (taskId) taskIds.add(taskId);
  if (mappedTask) taskIds.add(mappedTask);

  for (const id of taskIds) {
    removeEntry(id);
  }

  if (agentId && !mappedTask) {
    taskByAgent.delete(agentId);
  }
}

export function listReadPolicyContexts(): ReadPolicyContext[] {
  pruneRegistry(registryOptions.now(), { enforceMax: false });
  return Array.from(contextsByTask.values()).map(cloneContext);
}
