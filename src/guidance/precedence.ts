/**
 * @fileoverview AGENTS.md Directory Precedence Rules
 *
 * Implements deterministic precedence rules for resolving AGENTS.md
 * in nested monorepo structures. Per the mandate:
 * - Nearest AGENTS.md via directory precedence rules
 * - Support nested AGENTS.md across monorepos
 * - Enforce precedence deterministically
 *
 * Precedence order (highest to lowest):
 * 1. Directory-specific guidance (closest to target path)
 * 2. Package root guidance (nearest package.json)
 * 3. Workspace root guidance
 * 4. Agent-specific files (CLAUDE.md, CODEX.md) extend base AGENTS.md
 *
 * @packageDocumentation
 */

import type { GuidanceSource, GuidanceFileType } from './types.js';

// ============================================================================
// PRECEDENCE CONFIGURATION
// ============================================================================

/**
 * File type priority (lower = higher priority within same directory)
 * Agent-specific files are additive, not replacing.
 */
export const FILE_TYPE_PRIORITY: Record<GuidanceFileType, number> = {
  'AGENTS.md': 1,       // Base guidance (highest base priority)
  'CLAUDE.md': 2,       // Agent-specific extension
  'CODEX.md': 2,        // Agent-specific extension
  'GEMINI.md': 2,       // Agent-specific extension
  'COPILOT.md': 2,      // Agent-specific extension
  'AI.md': 3,           // Generic AI guidance
  'CONTRIBUTING.md': 4, // Contributor guidance (lower priority)
  'custom': 5,          // Custom files (lowest priority)
};

/**
 * File names to search for in each directory
 */
export const GUIDANCE_FILE_NAMES: readonly string[] = [
  'AGENTS.md',
  'CLAUDE.md',
  'CODEX.md',
  'GEMINI.md',
  'COPILOT.md',
  'AI.md',
  '.claude/AGENTS.md',
  '.codex/AGENTS.md',
  'docs/AGENTS.md',
  'docs/CLAUDE.md',
] as const;

/**
 * Directories to skip when searching for guidance
 */
export const SKIP_DIRECTORIES: readonly string[] = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'target',
  'vendor',
] as const;

// ============================================================================
// PRECEDENCE RESOLUTION
// ============================================================================

/**
 * Calculate priority for a guidance source.
 * Lower number = higher priority.
 *
 * Priority is calculated as: (depth * 100) + fileTypePriority
 * This ensures closer files always win over farther files,
 * while file type breaks ties within the same directory.
 */
export function calculatePriority(depth: number, fileType: GuidanceFileType): number {
  const typePriority = FILE_TYPE_PRIORITY[fileType] ?? FILE_TYPE_PRIORITY.custom;
  return depth * 100 + typePriority;
}

/**
 * Compare two guidance sources for precedence.
 * Returns negative if a should come before b (a is higher priority).
 */
export function comparePrecedence(a: GuidanceSource, b: GuidanceSource): number {
  // First compare by priority (lower = higher priority)
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  // Then by depth (closer = higher priority)
  if (a.depth !== b.depth) {
    return a.depth - b.depth;
  }

  // Then by file type priority
  const aTypePriority = FILE_TYPE_PRIORITY[a.type] ?? FILE_TYPE_PRIORITY.custom;
  const bTypePriority = FILE_TYPE_PRIORITY[b.type] ?? FILE_TYPE_PRIORITY.custom;
  if (aTypePriority !== bTypePriority) {
    return aTypePriority - bTypePriority;
  }

  // Finally by path (for determinism)
  return a.path.localeCompare(b.path);
}

/**
 * Sort guidance sources by precedence.
 * Returns a new array with highest priority sources first.
 */
export function sortByPrecedence(sources: GuidanceSource[]): GuidanceSource[] {
  return [...sources].sort(comparePrecedence);
}

/**
 * Determine the file type from a file path.
 */
export function getFileType(filePath: string): GuidanceFileType {
  const fileName = filePath.split('/').pop()?.toUpperCase() ?? '';

  switch (fileName) {
    case 'AGENTS.MD':
      return 'AGENTS.md';
    case 'CLAUDE.MD':
      return 'CLAUDE.md';
    case 'CODEX.MD':
      return 'CODEX.md';
    case 'GEMINI.MD':
      return 'GEMINI.md';
    case 'COPILOT.MD':
      return 'COPILOT.md';
    case 'AI.MD':
      return 'AI.md';
    case 'CONTRIBUTING.MD':
      return 'CONTRIBUTING.md';
    default:
      return 'custom';
  }
}

/**
 * Check if a file name is a guidance file.
 */
export function isGuidanceFile(fileName: string): boolean {
  const upper = fileName.toUpperCase();
  return (
    upper === 'AGENTS.MD' ||
    upper === 'CLAUDE.MD' ||
    upper === 'CODEX.MD' ||
    upper === 'GEMINI.MD' ||
    upper === 'COPILOT.MD' ||
    upper === 'AI.MD' ||
    upper === 'CONTRIBUTING.MD'
  );
}

/**
 * Check if a directory should be skipped.
 */
export function shouldSkipDirectory(dirName: string): boolean {
  return SKIP_DIRECTORIES.includes(dirName);
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Calculate the directory depth relative to a root.
 * Root has depth 0, first-level subdirectory has depth 1, etc.
 * For file paths, returns the depth of the containing directory.
 */
export function calculateDepth(path: string, root: string): number {
  // Normalize paths
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(root);

  // Remove root prefix
  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(`Path "${path}" is not under root "${root}"`);
  }

  // Get relative path
  let relativePath = normalizedPath.slice(normalizedRoot.length);
  if (!relativePath || relativePath === '/') {
    return 0;
  }

  // Remove leading slash
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }

  // Count path segments, excluding the file name (last segment if it has an extension)
  const segments = relativePath.split('/').filter((s) => s.length > 0);

  // If the last segment looks like a file (has an extension), don't count it
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.includes('.')) {
      return segments.length - 1;
    }
  }

  return segments.length;
}

/**
 * Normalize a path for comparison.
 */
export function normalizePath(path: string): string {
  // Remove trailing slash
  let normalized = path.endsWith('/') ? path.slice(0, -1) : path;
  // Ensure leading slash for absolute paths
  if (!normalized.startsWith('/') && !normalized.startsWith('.')) {
    normalized = '/' + normalized;
  }
  return normalized;
}

/**
 * Get all parent directories of a path up to the root.
 * Returns directories in order from closest to root (for discovery).
 */
export function getParentDirectories(filePath: string, root: string): string[] {
  const normalizedPath = normalizePath(filePath);
  const normalizedRoot = normalizePath(root);

  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(`Path "${filePath}" is not under root "${root}"`);
  }

  const directories: string[] = [];
  let current = normalizedPath;

  // Get directory of the file (if filePath is a file)
  if (!current.endsWith('/')) {
    const lastSlash = current.lastIndexOf('/');
    if (lastSlash > 0) {
      current = current.slice(0, lastSlash);
    }
  }

  // Walk up to root
  while (current.length >= normalizedRoot.length) {
    directories.push(current);
    const lastSlash = current.lastIndexOf('/');
    if (lastSlash <= 0) break;
    current = current.slice(0, lastSlash);
  }

  // Ensure root is included
  if (!directories.includes(normalizedRoot)) {
    directories.push(normalizedRoot);
  }

  return directories;
}

// ============================================================================
// MERGE RULES
// ============================================================================

/**
 * Determine how two sources should be merged.
 * Agent-specific files extend rather than replace base AGENTS.md.
 */
export type MergeStrategy = 'replace' | 'extend' | 'skip';

/**
 * Get the merge strategy for a source given existing sources.
 */
export function getMergeStrategy(
  newSource: GuidanceSource,
  existingSources: GuidanceSource[]
): MergeStrategy {
  // Agent-specific files always extend
  if (
    newSource.type === 'CLAUDE.md' ||
    newSource.type === 'CODEX.md' ||
    newSource.type === 'GEMINI.md' ||
    newSource.type === 'COPILOT.md'
  ) {
    return 'extend';
  }

  // Check if we have a closer AGENTS.md
  const existingAgentsMd = existingSources.find(
    (s) => s.type === 'AGENTS.md' && s.depth < newSource.depth
  );

  if (existingAgentsMd) {
    // A closer AGENTS.md exists - the farther one should extend, not replace
    return 'extend';
  }

  // First AGENTS.md at this level replaces
  return 'replace';
}

/**
 * Filter sources to get the effective set for a path.
 * Applies precedence rules and merge strategies.
 */
export function getEffectiveSources(
  allSources: GuidanceSource[],
  targetPath: string
): GuidanceSource[] {
  // Sort by precedence
  const sorted = sortByPrecedence(allSources);

  // Apply merge rules
  const effective: GuidanceSource[] = [];

  for (const source of sorted) {
    const strategy = getMergeStrategy(source, effective);

    switch (strategy) {
      case 'replace':
        // Clear lower-priority sources of the same type
        const filteredReplace = effective.filter((s) => s.type !== source.type);
        filteredReplace.push(source);
        effective.length = 0;
        effective.push(...filteredReplace);
        break;

      case 'extend':
        effective.push(source);
        break;

      case 'skip':
        // Don't include
        break;
    }
  }

  return effective;
}

// ============================================================================
// PRECEDENCE REPORT
// ============================================================================

/**
 * Report explaining precedence resolution.
 */
export interface PrecedenceReport {
  /** Target path being resolved */
  targetPath: string;

  /** Workspace root */
  workspaceRoot: string;

  /** All discovered sources (sorted) */
  discoveredSources: GuidanceSource[];

  /** Effective sources after merge */
  effectiveSources: GuidanceSource[];

  /** Explanation of decisions */
  decisions: PrecedenceDecision[];
}

/** A single precedence decision */
export interface PrecedenceDecision {
  /** Source path */
  source: string;

  /** Decision made */
  decision: MergeStrategy;

  /** Reason for decision */
  reason: string;
}

/**
 * Generate a precedence report for debugging/auditing.
 */
export function generatePrecedenceReport(
  targetPath: string,
  workspaceRoot: string,
  discoveredSources: GuidanceSource[]
): PrecedenceReport {
  const sorted = sortByPrecedence(discoveredSources);
  const effective: GuidanceSource[] = [];
  const decisions: PrecedenceDecision[] = [];

  for (const source of sorted) {
    const strategy = getMergeStrategy(source, effective);

    let reason: string;
    switch (strategy) {
      case 'replace':
        reason = `Highest priority ${source.type} at depth ${source.depth}`;
        break;
      case 'extend':
        reason = source.type.includes('.md') && source.type !== 'AGENTS.md'
          ? `Agent-specific file extends base guidance`
          : `Extends higher-priority guidance from depth ${effective[0]?.depth ?? 0}`;
        break;
      case 'skip':
        reason = `Skipped due to higher-priority source`;
        break;
    }

    decisions.push({
      source: source.path,
      decision: strategy,
      reason,
    });

    if (strategy !== 'skip') {
      effective.push(source);
    }
  }

  return {
    targetPath,
    workspaceRoot,
    discoveredSources: sorted,
    effectiveSources: effective,
    decisions,
  };
}
