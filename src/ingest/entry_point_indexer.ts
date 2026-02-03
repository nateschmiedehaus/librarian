/**
 * @fileoverview Entry Point Ingestion Source
 *
 * Indexes detected entry points as ingestion items for semantic search.
 * Entry points include:
 * - Package.json declared entries (main, bin, exports)
 * - Dependency tree roots (modules not imported by anything)
 * - Factory functions (createX, makeX patterns)
 */

import { randomUUID } from 'crypto';
import type { IngestionItem, IngestionSource, IngestionResult, IngestionContext } from './types.js';
import type { ModuleKnowledge, FunctionKnowledge } from '../types.js';
import {
  detectEntryPoints,
  type DetectedEntryPoint,
  type EntryPointKind,
} from '../knowledge/entry_point_detector.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const ENTRY_POINT_SOURCE_TYPE = 'entry_point';
export const ENTRY_POINT_SOURCE_VERSION = '1.0.0';

// ============================================================================
// TYPES
// ============================================================================

export interface EntryPointPayload extends DetectedEntryPoint {
  /** Searchable text for semantic matching */
  searchText: string;

  /** Keywords for exact matching */
  keywords: string[];
}

export interface EntryPointIndexerOptions {
  modules: ModuleKnowledge[];
  functions: FunctionKnowledge[];
  includeIndexFiles?: boolean;
  includeCliEntries?: boolean;
}

// ============================================================================
// INGESTION SOURCE
// ============================================================================

/**
 * Create an ingestion source for entry points.
 */
export function createEntryPointIngestionSource(
  options: EntryPointIndexerOptions
): IngestionSource {
  return {
    type: ENTRY_POINT_SOURCE_TYPE,
    version: ENTRY_POINT_SOURCE_VERSION,

    async ingest(ctx: IngestionContext): Promise<IngestionResult> {
      const items: IngestionItem[] = [];
      const errors: string[] = [];

      try {
        const result = await detectEntryPoints({
          workspace: ctx.workspace,
          modules: options.modules,
          functions: options.functions,
          includeIndexFiles: options.includeIndexFiles ?? true,
          includeCliEntries: options.includeCliEntries ?? true,
        });

        for (const entryPoint of result.entryPoints) {
          const payload = createEntryPointPayload(entryPoint);

          items.push({
            id: `entry_point:${randomUUID()}`,
            sourceType: ENTRY_POINT_SOURCE_TYPE,
            sourceVersion: ENTRY_POINT_SOURCE_VERSION,
            ingestedAt: ctx.now(),
            payload,
            metadata: {
              kind: entryPoint.kind,
              path: entryPoint.path,
              confidence: entryPoint.confidence,
            },
          });
        }

        // Add summary item for quick overview queries
        if (result.entryPoints.length > 0) {
          items.push(createSummaryItem(result.entryPoints, ctx.now()));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Entry point detection failed: ${message}`);
      }

      return { items, errors };
    },

    validate(data: unknown): boolean {
      if (!data || typeof data !== 'object') return false;
      const payload = data as Record<string, unknown>;
      return (
        typeof payload.id === 'string' &&
        typeof payload.kind === 'string' &&
        typeof payload.path === 'string'
      );
    },
  };
}

// ============================================================================
// PAYLOAD BUILDERS
// ============================================================================

/**
 * Create a searchable payload from a detected entry point.
 */
function createEntryPointPayload(entryPoint: DetectedEntryPoint): EntryPointPayload {
  const keywords = buildKeywords(entryPoint);
  const searchText = buildSearchText(entryPoint, keywords);

  return {
    ...entryPoint,
    searchText,
    keywords,
  };
}

/**
 * Build keywords for exact matching.
 */
function buildKeywords(entryPoint: DetectedEntryPoint): string[] {
  const keywords: string[] = [
    'entry point',
    'entry_point',
    entryPoint.name,
    entryPoint.kind.replace(/_/g, ' '),
  ];

  // Add kind-specific keywords
  switch (entryPoint.kind) {
    case 'package_main':
      keywords.push('main', 'main entry', 'package main', 'primary entry');
      break;
    case 'package_bin':
      keywords.push('bin', 'binary', 'cli', 'command line', 'executable');
      break;
    case 'package_exports':
      keywords.push('exports', 'public api', 'exported');
      break;
    case 'dependency_root':
      keywords.push('root', 'root module', 'top level', 'not imported');
      break;
    case 'factory_function':
      keywords.push('factory', 'create', 'make', 'builder', 'constructor');
      break;
    case 'index_module':
      keywords.push('index', 'barrel', 're-export');
      break;
    case 'cli_entry':
      keywords.push('cli', 'command', 'terminal', 'shell');
      break;
  }

  // Add export names as keywords
  for (const exp of entryPoint.exports.slice(0, 10)) {
    keywords.push(exp);
    // Also add split camelCase
    const words = exp.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    if (words !== exp.toLowerCase()) {
      keywords.push(words);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Build searchable text for semantic matching.
 */
function buildSearchText(entryPoint: DetectedEntryPoint, keywords: string[]): string {
  const parts: string[] = [];

  // Primary description
  parts.push(`Entry point: ${entryPoint.name}`);
  parts.push(entryPoint.description);

  // Kind description
  const kindDescriptions: Record<EntryPointKind, string> = {
    package_main: 'Main entry point declared in package.json. This is the primary way to use this package programmatically.',
    package_bin: 'CLI binary entry point. Run this from the command line.',
    package_exports: 'Public API export from package.json exports field.',
    dependency_root: 'Root module in the dependency tree - not imported by other modules. Likely a top-level entry point.',
    factory_function: 'Factory function that creates and returns instances. Common entry point for API usage.',
    index_module: 'Index module that re-exports from the directory. Barrel file pattern.',
    cli_entry: 'Command-line interface entry point in bin/ or cli/ directory.',
    summary: 'Summary of all entry points in this codebase.',
  };
  parts.push(kindDescriptions[entryPoint.kind]);

  // Path info
  parts.push(`Located at: ${entryPoint.relativePath}`);

  // Exports
  if (entryPoint.exports.length > 0) {
    parts.push(`Exports: ${entryPoint.exports.slice(0, 5).join(', ')}`);
  }

  // Keywords for matching
  parts.push(`Keywords: ${keywords.join(', ')}`);

  return parts.join('\n');
}

/**
 * Create a summary item for overview queries.
 */
function createSummaryItem(entryPoints: DetectedEntryPoint[], now: string): IngestionItem {
  const byKind = new Map<EntryPointKind, DetectedEntryPoint[]>();
  for (const ep of entryPoints) {
    const list = byKind.get(ep.kind) ?? [];
    list.push(ep);
    byKind.set(ep.kind, list);
  }

  const summaryParts: string[] = [
    `# Entry Points Summary`,
    ``,
    `This codebase has ${entryPoints.length} detected entry points:`,
  ];

  // Package.json entries first (highest priority)
  const packageEntries = [
    ...(byKind.get('package_main') ?? []),
    ...(byKind.get('package_bin') ?? []),
    ...(byKind.get('package_exports') ?? []),
  ];
  if (packageEntries.length > 0) {
    summaryParts.push(``, `## Package.json Entry Points`);
    for (const ep of packageEntries) {
      summaryParts.push(`- **${ep.name}** (${ep.kind.replace(/_/g, ' ')}): ${ep.relativePath}`);
    }
  }

  // Factory functions
  const factories = byKind.get('factory_function') ?? [];
  if (factories.length > 0) {
    summaryParts.push(``, `## Factory Functions (Programmatic API)`);
    for (const ep of factories.slice(0, 10)) {
      summaryParts.push(`- **${ep.name}**: ${ep.description}`);
    }
    if (factories.length > 10) {
      summaryParts.push(`- ... and ${factories.length - 10} more`);
    }
  }

  // CLI entries
  const cliEntries = byKind.get('cli_entry') ?? [];
  if (cliEntries.length > 0) {
    summaryParts.push(``, `## CLI Entry Points`);
    for (const ep of cliEntries.slice(0, 5)) {
      summaryParts.push(`- **${ep.name}**: ${ep.relativePath}`);
    }
  }

  // Root modules
  const roots = byKind.get('dependency_root') ?? [];
  if (roots.length > 0 && roots.length <= 10) {
    summaryParts.push(``, `## Root Modules (Not Imported)`);
    for (const ep of roots) {
      summaryParts.push(`- ${ep.relativePath}`);
    }
  } else if (roots.length > 10) {
    summaryParts.push(``, `## Root Modules: ${roots.length} modules not imported by other modules`);
  }

  const searchText = summaryParts.join('\n');

  return {
    id: `entry_point:summary`,
    sourceType: ENTRY_POINT_SOURCE_TYPE,
    sourceVersion: ENTRY_POINT_SOURCE_VERSION,
    ingestedAt: now,
    payload: {
      id: 'entry_point_summary',
      kind: 'summary',
      path: '',
      relativePath: '',
      name: 'Entry Points Summary',
      description: `Overview of ${entryPoints.length} entry points in this codebase`,
      exports: [],
      confidence: 1.0,
      dependentCount: 0,
      source: 'summary',
      searchText,
      keywords: [
        'entry point',
        'entry points',
        'main',
        'start',
        'how to use',
        'getting started',
        'api',
        'cli',
        'factory',
        'overview',
        'summary',
      ],
    } as EntryPointPayload,
    metadata: {
      kind: 'summary',
      totalEntryPoints: entryPoints.length,
      byKind: Object.fromEntries(
        Array.from(byKind.entries()).map(([k, v]) => [k, v.length])
      ),
    },
  };
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Check if an ingestion item is an entry point.
 */
export function isEntryPointItem(item: IngestionItem): boolean {
  return item.sourceType === ENTRY_POINT_SOURCE_TYPE;
}

/**
 * Extract entry point payload from an ingestion item.
 */
export function getEntryPointPayload(item: IngestionItem): EntryPointPayload | null {
  if (!isEntryPointItem(item)) return null;
  return item.payload as EntryPointPayload;
}

/**
 * Get all entry points from a list of ingestion items.
 */
export function filterEntryPointItems(items: IngestionItem[]): EntryPointPayload[] {
  return items
    .filter(isEntryPointItem)
    .map(item => item.payload as EntryPointPayload)
    .filter(payload => payload.kind !== 'summary');
}

/**
 * Get the entry points summary from a list of ingestion items.
 */
export function getEntryPointSummary(items: IngestionItem[]): EntryPointPayload | null {
  const summary = items.find(
    item => isEntryPointItem(item) && (item.payload as EntryPointPayload).kind === 'summary'
  );
  return summary ? (summary.payload as EntryPointPayload) : null;
}
